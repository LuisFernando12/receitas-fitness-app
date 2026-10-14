import { AppError } from "@/lib/api-errors";
import { withApiLogging } from "@/lib/api-handler";
import {
  generateRecipesResponseSchema,
  generateRecipesInputSchema,
  normalizeGenerateInput,
} from "@/lib/contracts";
import { generateRecipes } from "@/lib/gemini";
import { z } from "zod";

export async function POST(request: Request) {
  return withApiLogging(
    request,
    {
      route: "/api/generate-recipes",
      fallbackMessage: "Não foi possível gerar as receitas.",
    },
    async () => {
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        throw new AppError("INVALID_INPUT", "Envie um JSON válido.", 400);
      }
      const input = generateRecipesInputSchema.safeParse(payload);

      if (!input.success) {
        throw new AppError("INVALID_INPUT", "Confira os ingredientes e a meta informados.", 400);
      }

      const normalized = normalizeGenerateInput(input.data);

      if (normalized.ingredients.length === 0) {
        throw new AppError(
          "NO_USABLE_INGREDIENTS",
          "Adicione pelo menos um ingrediente válido.",
          422,
          "ingredients",
        );
      }

      let result: ReturnType<typeof generateRecipesResponseSchema.parse>;
      try {
        result = generateRecipesResponseSchema.parse(await generateRecipes(normalized));
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new AppError("AI_INVALID_RESPONSE", "A IA retornou receitas em formato inválido.", 502);
        }
        throw error;
      }

      return Response.json(result);
    },
  );
}
