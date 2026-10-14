import { expect, test } from "@playwright/test";

const recipe = {
  title: "Frango com legumes",
  ingredients: [{ name: "Frango", amount: "200 g", source: "purchased" }],
  usedPurchasedIngredients: ["Frango"],
  instructions: ["Grelhe o frango."],
  prepTimeMinutes: 20,
  servings: 2,
  nutrition: { caloriesKcal: 300, proteinGrams: 35, carbsGrams: 10, fatGrams: 9, isEstimate: true },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/analyze-note", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ingredients: [{ name: "Frango", quantity: "500 g" }] }) });
  });
  await page.route("**/api/generate-recipes", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: [recipe, { ...recipe, title: "Bowl proteico" }] }) });
  });
});

test("completes the receipt to recipes flow", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("receipt-input").setInputFiles({ name: "nota.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) });
  await expect(page.getByRole("button", { name: "Analisar nota" })).toBeEnabled();
  await page.getByRole("button", { name: "Analisar nota" }).click();
  await expect(page.getByText("Está tudo certo?")).toBeVisible();
  await page.getByRole("button", { name: "Montar minhas receitas" }).click();
  await expect(page.getByText("Feito para você cozinhar.")).toBeVisible();
  await expect(page.getByText("Frango com legumes")).toBeVisible();
});

test("exposes the camera input on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("receipt-input")).toHaveAttribute("capture", "environment");
});
