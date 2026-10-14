import { z } from "zod";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_GOAL_LENGTH = 240;
export const MAX_INGREDIENTS = 100;
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(max).optional(),
  );

export const ingredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    quantity: optionalTrimmedString(80),
  })
  .strict();

export const ingredientsSchema = z
  .array(ingredientSchema)
  .min(1)
  .max(MAX_INGREDIENTS);

export const goalSchema = optionalTrimmedString(MAX_GOAL_LENGTH);

export const analyzeNoteResponseSchema = z
  .object({
    ingredients: z.array(ingredientSchema).max(MAX_INGREDIENTS),
  })
  .strict();

export const generateRecipesInputSchema = z
  .object({
    ingredients: ingredientsSchema,
    goal: goalSchema,
  })
  .strict();

export const recipeIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    amount: z.string().trim().min(1).max(80),
    source: z.enum(["purchased", "basic", "complementary"]),
  })
  .strict();

export const nutritionSchema = z
  .object({
    caloriesKcal: z.number().finite().min(0).max(100000),
    proteinGrams: z.number().finite().min(0).max(10000),
    carbsGrams: z.number().finite().min(0).max(10000),
    fatGrams: z.number().finite().min(0).max(10000),
    isEstimate: z.literal(true),
  })
  .strict();

export const recipeSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    ingredients: z.array(recipeIngredientSchema).min(1).max(80),
    usedPurchasedIngredients: z.array(z.string().trim().min(1).max(120)).max(100),
    instructions: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
    prepTimeMinutes: z.number().int().min(0).max(1440),
    servings: z.number().int().min(1).max(100),
    nutrition: nutritionSchema,
  })
  .strict();

export const generateRecipesResponseSchema = z
  .object({
    recipes: z.array(recipeSchema).min(2).max(4),
  })
  .strict();

export type Ingredient = z.infer<typeof ingredientSchema>;
export type AnalyzeNoteResponse = z.infer<typeof analyzeNoteResponseSchema>;
export type GenerateRecipesInput = z.infer<typeof generateRecipesInputSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type GenerateRecipesResponse = z.infer<typeof generateRecipesResponseSchema>;

export function normalizeIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients
    .map((ingredient) => ({
      name: ingredient.name.trim(),
      ...(ingredient.quantity?.trim()
        ? { quantity: ingredient.quantity.trim() }
        : {}),
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

export function normalizeGenerateInput(input: GenerateRecipesInput): GenerateRecipesInput {
  const normalizedIngredients = normalizeIngredients(input.ingredients);
  const goal = input.goal?.trim();

  return {
    ingredients: normalizedIngredients,
    ...(goal ? { goal } : {}),
  };
}
