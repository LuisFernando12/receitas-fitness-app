import { HumanMessage } from "@langchain/core/messages";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatGoogle } from "@langchain/google/node";
import { z } from "zod";
import {
  analyzeNoteResponseSchema,
  generateRecipesInputSchema,
  generateRecipesResponseSchema,
  nutritionSchema,
  recipeSchema,
  type GenerateRecipesInput,
  type GenerateRecipesResponse,
  type AnalyzeNoteResponse,
} from "@/lib/contracts";
import { AppError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { getRequestLogContext } from "@/lib/request-log-context";

const model = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const providerStatuses = new Set([
  "ABORTED",
  "CANCELLED",
  "DATA_LOSS",
  "DEADLINE_EXCEEDED",
  "FAILED_PRECONDITION",
  "INTERNAL",
  "INVALID_ARGUMENT",
  "NOT_FOUND",
  "OUT_OF_RANGE",
  "PERMISSION_DENIED",
  "RESOURCE_EXHAUSTED",
  "UNAUTHENTICATED",
  "UNAVAILABLE",
  "UNKNOWN",
  "UNIMPLEMENTED",
]);
const generateRecipeModelSchema = recipeSchema.extend({
  nutrition: nutritionSchema.omit({ isEstimate: true }),
});
const generateRecipesModelResponseSchema = generateRecipesResponseSchema.extend({
  recipes: z.array(generateRecipeModelSchema).min(2).max(4),
});
const unsupportedProviderKeywords = new Set([
  "$schema",
  "const",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProviderSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Gemini accepts only a subset of JSON Schema; Zod below remains authoritative.
  const simplify = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(simplify);
    if (!isRecord(value)) return value;

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !unsupportedProviderKeywords.has(key))
        .map(([key, nested]) => [key, simplify(nested)]),
    );
  };

  return simplify(toJsonSchema(schema)) as Record<string, unknown>;
}

function sanitizeProviderMessage(message: string): string {
  const apiKey = process.env.GEMINI_API_KEY;
  let sanitized = message;

  if (apiKey) sanitized = sanitized.split(apiKey).join("[REDACTED]");

  return sanitized
    .replace(/AIza[\w-]{20,}/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(api[_ -]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 500);
}

function getProviderDiagnostics(error: unknown) {
  if (!isRecord(error)) return undefined;

  const status =
    typeof error.status === "number"
      ? error.status
      : typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
  let providerHttpStatus =
    status && Number.isInteger(status) && status >= 400 && status <= 599
      ? status
      : undefined;
  let payload = error.data;

  if (!isRecord(payload) && typeof error.message === "string") {
    try {
      payload = JSON.parse(error.message);
    } catch {
      // Provider messages are intentionally not retained or logged.
    }
  }

  const details = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  let providerStatus: string | undefined;
  let providerMessage: string | undefined;

  if (details) {
    if (
      !providerHttpStatus &&
      typeof details.code === "number" &&
      Number.isInteger(details.code) &&
      details.code >= 400 &&
      details.code <= 599
    ) {
      providerHttpStatus = details.code;
    }
    if (typeof details.status === "string" && providerStatuses.has(details.status)) {
      providerStatus = details.status;
    }
    if (typeof details.message === "string") {
      providerMessage = sanitizeProviderMessage(details.message);
    }
  }

  const providerErrorType =
    typeof error.name === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(error.name)
      ? error.name
      : undefined;

  if (!providerHttpStatus && !providerStatus && !providerMessage && !providerErrorType) return undefined;

  return {
    provider: "gemini" as const,
    ...(providerHttpStatus ? { providerHttpStatus } : {}),
    ...(providerStatus ? { providerStatus } : {}),
    ...(providerMessage ? { providerMessage } : {}),
    ...(providerErrorType ? { providerErrorType } : {}),
  };
}

function getClient(): ChatGoogle {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "O serviço de análise não está configurado.",
      502,
    );
  }

  return new ChatGoogle({
    model: model(),
    apiKey,
    maxRetries: 2,
  });
}

function invalidResponse(message: string) {
  return new AppError("AI_INVALID_RESPONSE", message, 502);
}

async function invokeStructured<Schema extends z.ZodTypeAny>(
  prompt: string | HumanMessage[],
  schema: Schema,
  unavailableMessage: string,
  operation: "analyze-note" | "generate-recipes",
): Promise<z.output<Schema>> {
  const startedAt = Date.now();
  const logContext = {
    ...getRequestLogContext(),
    operation,
    provider: "gemini" as const,
    model: model(),
  };
  const durationMs = () => Date.now() - startedAt;

  logger.info(
    { ...logContext, event: "ai.request.started", maxRetries: 2 },
    "AI provider request started",
  );

  let response: unknown;
  try {
    response = await getClient()
      .withStructuredOutput(getProviderSchema(schema), { method: "jsonSchema" })
      .invoke(prompt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(
        {
          ...logContext,
          event: "ai.response.invalid",
          durationMs: durationMs(),
          validationIssueCount: error.issues.length,
          validationIssueCodes: [...new Set(error.issues.map((issue) => issue.code))],
        },
        "AI provider returned an invalid response",
      );
      throw invalidResponse("A IA retornou dados em formato inválido.");
    }
    const diagnostics = error instanceof AppError ? undefined : getProviderDiagnostics(error);
    logger.error(
      {
        ...logContext,
        event: "ai.request.failed",
        durationMs: durationMs(),
        ...(diagnostics ?? {}),
        ...(error instanceof AppError ? { errorCode: error.code } : {}),
      },
      "AI provider request failed",
    );
    if (error instanceof AppError) throw error;
    throw new AppError(
      "AI_UNAVAILABLE",
      unavailableMessage,
      502,
      undefined,
      diagnostics,
    );
  }

  try {
    const parsed = schema.parse(response);
    const resultCount = isRecord(parsed)
      ? [parsed.ingredients, parsed.recipes].find(Array.isArray)?.length
      : undefined;
    logger.info(
      {
        ...logContext,
        event: "ai.request.completed",
        durationMs: durationMs(),
        ...(typeof resultCount === "number" ? { resultCount } : {}),
      },
      "AI provider request completed",
    );
    return parsed;
  } catch (error) {
    const validationError = error instanceof z.ZodError ? error : undefined;
    logger.error(
      {
        ...logContext,
        event: "ai.response.invalid",
        durationMs: durationMs(),
        ...(validationError
          ? {
              validationIssueCount: validationError.issues.length,
              validationIssueCodes: [...new Set(validationError.issues.map((issue) => issue.code))],
              validationIssuePaths: [...new Set(
                validationError.issues.map((issue) => issue.path.join(".").slice(0, 120)),
              )],
            }
          : { validationIssueCount: 1, validationIssueCodes: ["unknown"] }),
      },
      "AI provider returned an invalid response",
    );
    throw invalidResponse("A IA retornou dados em formato inválido.");
  }
}

export async function analyzeReceiptImage(input: {
  bytes: ArrayBuffer;
  mimeType: string;
}): Promise<AnalyzeNoteResponse> {
  const base64 = Buffer.from(input.bytes).toString("base64");
  const prompt = [new HumanMessage([
    {
      type: "text",
      text: "Leia esta nota de mercado e extraia os produtos comprados. Retorne apenas os itens legíveis, com quantidade quando disponível. Não invente itens.",
    },
    {
      type: "image_url",
      image_url: `data:${input.mimeType};base64,${base64}`,
    },
  ])];
  const parsed = await invokeStructured(
    prompt,
    analyzeNoteResponseSchema,
    "A análise está indisponível no momento.",
    "analyze-note",
  );

  if (parsed.ingredients.length === 0) {
    throw new AppError(
      "NO_USABLE_INGREDIENTS",
      "Não encontramos ingredientes utilizáveis na nota.",
      422,
    );
  }

  return parsed;
}

export async function generateRecipes(input: GenerateRecipesInput): Promise<GenerateRecipesResponse> {
  const validatedInput = generateRecipesInputSchema.parse(input);
  const prompt = `Crie de 2 a 4 pratos fitness usando prioritariamente estes ingredientes comprados: ${JSON.stringify(validatedInput.ingredients)}. Meta do usuário: ${validatedInput.goal || "não informada"}. Pode usar sal, óleo e temperos básicos. Marque cada ingrediente como purchased, basic ou complementary. Os valores nutricionais são estimativas.`;

  const generated = await invokeStructured(
    prompt,
    generateRecipesModelResponseSchema,
    "A geração está indisponível no momento.",
    "generate-recipes",
  );

  return {
    recipes: generated.recipes.map((recipe) => ({
      ...recipe,
      nutrition: { ...recipe.nutrition, isEstimate: true },
    })),
  };
}
