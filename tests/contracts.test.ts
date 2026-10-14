import {
  generateRecipesInputSchema,
  generateRecipesResponseSchema,
  normalizeGenerateInput,
} from "@/lib/contracts";

const validRecipe = {
  title: "Frango com legumes",
  ingredients: [
    { name: "Peito de frango", amount: "200 g", source: "purchased" as const },
    { name: "Sal", amount: "a gosto", source: "basic" as const },
  ],
  usedPurchasedIngredients: ["Peito de frango"],
  instructions: ["Grelhe o frango.", "Sirva com os legumes."],
  prepTimeMinutes: 25,
  servings: 2,
  nutrition: {
    caloriesKcal: 320,
    proteinGrams: 38,
    carbsGrams: 18,
    fatGrams: 10,
    isEstimate: true as const,
  },
};

describe("contratos do fluxo de receitas", () => {
  it("normaliza espaços de ingredientes e meta", () => {
    const input = generateRecipesInputSchema.parse({
      ingredients: [{ name: "  arroz integral ", quantity: "  1 xícara " }],
      goal: "  ganhar massa  ",
    });

    expect(normalizeGenerateInput(input)).toEqual({
      ingredients: [{ name: "arroz integral", quantity: "1 xícara" }],
      goal: "ganhar massa",
    });
  });

  it("rejeita meta acima do limite e lista vazia", () => {
    expect(
      generateRecipesInputSchema.safeParse({
        ingredients: [],
        goal: "a".repeat(241),
      }).success,
    ).toBe(false);
  });

  it("aceita somente receitas entre 2 e 4", () => {
    expect(generateRecipesResponseSchema.safeParse({ recipes: [validRecipe] }).success).toBe(false);
    expect(
      generateRecipesResponseSchema.safeParse({ recipes: [validRecipe, { ...validRecipe, title: "Omelete" }] }).success,
    ).toBe(true);
    expect(
      generateRecipesResponseSchema.safeParse({ recipes: Array.from({ length: 5 }, (_, index) => ({ ...validRecipe, title: `Receita ${index}` })) }).success,
    ).toBe(false);
  });

  it("rejeita informação nutricional negativa", () => {
    expect(
      generateRecipesResponseSchema.safeParse({
        recipes: [
          validRecipe,
          { ...validRecipe, nutrition: { ...validRecipe.nutrition, caloriesKcal: -1 } },
        ],
      }).success,
    ).toBe(false);
  });
});
