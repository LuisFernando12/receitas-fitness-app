import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { withRequestLogContext } from "@/lib/request-log-context";

const invoke = vi.hoisted(() => vi.fn());
const withStructuredOutput = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => {
    void args;
    return { invoke };
  }),
);
const ChatGoogle = vi.hoisted(() =>
  vi.fn(function ChatGoogleMock() {
    return { withStructuredOutput };
  }),
);

vi.mock("@langchain/google/node", () => ({ ChatGoogle }));

import { analyzeReceiptImage, generateRecipes } from "@/lib/gemini";

const recipe = {
  title: "Frango com legumes",
  ingredients: [{ name: "Frango", amount: "200 g", source: "purchased" as const }],
  usedPurchasedIngredients: ["Frango"],
  instructions: ["Grelhe o frango."],
  prepTimeMinutes: 20,
  servings: 2,
  nutrition: { caloriesKcal: 300, proteinGrams: 35, carbsGrams: 10, fatGrams: 9, isEstimate: true as const },
};

describe("adapter LangChain para Gemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test");
  });

  it("analisa a imagem com saída estruturada e retry limitado", async () => {
    invoke.mockResolvedValue({ ingredients: [{ name: "Arroz", quantity: "1 kg" }] });

    await expect(analyzeReceiptImage({ bytes: new Uint8Array([1]).buffer, mimeType: "image/jpeg" })).resolves.toEqual({
      ingredients: [{ name: "Arroz", quantity: "1 kg" }],
    });

    expect(ChatGoogle).toHaveBeenCalledWith({ model: "gemini-test", apiKey: "test-key", maxRetries: 2 });
    expect(withStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({ type: "object" }),
      { method: "jsonSchema" },
    );
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0][0][0].content).toContainEqual({
      type: "image_url",
      image_url: "data:image/jpeg;base64,AQ==",
    });
  });

  it("rejeita saída estruturada inválida da análise", async () => {
    invoke.mockResolvedValue({ unexpected: true });

    await expect(analyzeReceiptImage({ bytes: new Uint8Array([1]).buffer, mimeType: "image/jpeg" })).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
      status: 502,
    });
  });

  it("converte falha do provider em erro 502 com status sanitizado", async () => {
    const providerError = Object.assign(new Error("private provider details"), {
      statusCode: 503,
      data: {
        error: {
          code: 503,
          status: "UNAVAILABLE",
          message: "Gemini rejected apiKey=test-key",
        },
      },
    });
    const errorLog = vi.spyOn(logger, "error").mockImplementation(() => logger);
    invoke.mockRejectedValue(providerError);

    await withRequestLogContext(
      { requestId: "request-failure-456", route: "/api/generate-recipes", method: "POST" },
      () => expect(generateRecipes({ ingredients: [{ name: "Arroz" }] })).rejects.toMatchObject({
        code: "AI_UNAVAILABLE",
        status: 502,
        diagnostics: {
          provider: "gemini",
          providerHttpStatus: 503,
          providerStatus: "UNAVAILABLE",
          providerMessage: "Gemini rejected apiKey=[REDACTED]",
          providerErrorType: "Error",
        },
      }),
    );
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.request.failed",
        operation: "generate-recipes",
        provider: "gemini",
        model: "gemini-test",
        providerHttpStatus: 503,
        providerStatus: "UNAVAILABLE",
        providerMessage: "Gemini rejected apiKey=[REDACTED]",
        providerErrorType: "Error",
        requestId: "request-failure-456",
      }),
      "AI provider request failed",
    );
    errorLog.mockRestore();
    expect(withStructuredOutput).toHaveBeenCalledWith(expect.anything(), { method: "jsonSchema" });
  });

  it("registra início e conclusão sem dados da requisição ou resposta", async () => {
    const infoLog = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const { isEstimate, ...nutrition } = recipe.nutrition;
    expect(isEstimate).toBe(true);
    const modelRecipe = { ...recipe, nutrition };
    invoke.mockResolvedValue({ recipes: [modelRecipe, { ...modelRecipe, title: "Bowl proteico" }] });

    await withRequestLogContext(
      { requestId: "request-test-123", route: "/api/generate-recipes", method: "POST" },
      () => generateRecipes({ ingredients: [{ name: "Frango confidencial" }], goal: "emagrecimento" }),
    );

    expect(infoLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.request.started",
        operation: "generate-recipes",
        provider: "gemini",
        model: "gemini-test",
        requestId: "request-test-123",
      }),
      "AI provider request started",
    );
    expect(infoLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.request.completed",
        operation: "generate-recipes",
        provider: "gemini",
        model: "gemini-test",
        resultCount: 2,
        requestId: "request-test-123",
      }),
      "AI provider request completed",
    );
    expect(JSON.stringify(infoLog.mock.calls)).not.toContain("Frango confidencial");
    expect(JSON.stringify(infoLog.mock.calls)).not.toContain("emagrecimento");
    expect(JSON.stringify(infoLog.mock.calls)).not.toContain("Frango com legumes");
    infoLog.mockRestore();
  });

  it("não tenta chamar o provider sem chave", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    await expect(generateRecipes({ ingredients: [{ name: "Arroz" }] })).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
      status: 502,
    });
    expect(ChatGoogle).not.toHaveBeenCalled();
  });

  it("valida a quantidade mínima de receitas retornadas", async () => {
    invoke.mockResolvedValue({ recipes: [recipe] });

    await expect(generateRecipes({ ingredients: [{ name: "Frango" }] })).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
      status: 502,
    });
  });

  it("envia schema simplificado e mantém a nutrição como estimativa", async () => {
    const { isEstimate, ...modelNutrition } = recipe.nutrition;
    expect(isEstimate).toBe(true);
    const modelRecipe = { ...recipe, nutrition: modelNutrition };
    invoke.mockResolvedValue({ recipes: [modelRecipe, { ...modelRecipe, title: "Bowl proteico" }] });

    await expect(generateRecipes({ ingredients: [{ name: "Frango" }] })).resolves.toMatchObject({
      recipes: [{ nutrition: { isEstimate: true } }, { nutrition: { isEstimate: true } }],
    });

    const [providerSchema] = withStructuredOutput.mock.calls[0];
    expect(providerSchema).toMatchObject({ type: "object" });
    const forbiddenKeywords = new Set([
      "$schema",
      "const",
      "maxItems",
      "maxLength",
      "maximum",
      "minItems",
      "minLength",
      "minimum",
    ]);
    const foundKeywords = new Set<string>();
    const collectKeywords = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(collectKeywords);
      } else if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
          if (forbiddenKeywords.has(key)) foundKeywords.add(key);
          collectKeywords(nested);
        }
      }
    };
    collectKeywords(providerSchema);
    expect([...foundKeywords]).toEqual([]);
  });
});
