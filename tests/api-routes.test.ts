import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as analyzeNote } from "@/app/api/analyze-note/route";
import { POST as generateRecipe } from "@/app/api/generate-recipes/route";
import { analyzeReceiptImage, generateRecipes } from "@/lib/gemini";
import { AppError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";

vi.mock("@/lib/gemini", () => ({
  analyzeReceiptImage: vi.fn(),
  generateRecipes: vi.fn(),
}));

const mockedAnalyze = vi.mocked(analyzeReceiptImage);
const mockedGenerate = vi.mocked(generateRecipes);

function jpeg() {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "nota.jpg", { type: "image/jpeg" });
}

const recipe = {
  title: "Frango com legumes",
  ingredients: [
    { name: "Frango", amount: "200 g", source: "purchased" as const },
    { name: "Sal", amount: "a gosto", source: "basic" as const },
  ],
  usedPurchasedIngredients: ["Frango"],
  instructions: ["Grelhe o frango."],
  prepTimeMinutes: 20,
  servings: 2,
  nutrition: { caloriesKcal: 300, proteinGrams: 35, carbsGrams: 10, fatGrams: 9, isEstimate: true as const },
};

describe("API de receitas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("analisa uma imagem válida", async () => {
    mockedAnalyze.mockResolvedValue({ ingredients: [{ name: "Frango", quantity: "500 g" }] });
    const body = new FormData();
    body.append("image", jpeg());

    const response = await analyzeNote(new Request("http://localhost/api/analyze-note", { method: "POST", body }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ingredients: [{ name: "Frango", quantity: "500 g" }] });
    expect(mockedAnalyze).toHaveBeenCalledOnce();
  });

  it("rejeita upload sem imagem antes de chamar a IA", async () => {
    const response = await analyzeNote(new Request("http://localhost/api/analyze-note", { method: "POST", body: new FormData() }));

    expect(response.status).toBe(400);
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it("rejeita imagem incompatível", async () => {
    const body = new FormData();
    body.append("image", new File(["not an image"], "nota.png", { type: "image/png" }));

    const response = await analyzeNote(new Request("http://localhost/api/analyze-note", { method: "POST", body }));

    expect(response.status).toBe(415);
  });

  it("rejeita análise sem ingredientes utilizáveis", async () => {
    mockedAnalyze.mockResolvedValue({ ingredients: [] });
    const body = new FormData();
    body.append("image", jpeg());

    const response = await analyzeNote(new Request("http://localhost/api/analyze-note", { method: "POST", body }));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "NO_USABLE_INGREDIENTS" } });
  });

  it("gera receitas com a lista validada", async () => {
    mockedGenerate.mockResolvedValue({ recipes: [recipe, { ...recipe, title: "Bowl proteico" }] });
    const response = await generateRecipe(
      new Request("http://localhost/api/generate-recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingredients: [{ name: "Frango" }], goal: "ganhar massa" }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).recipes).toHaveLength(2);
    expect(mockedGenerate).toHaveBeenCalledWith({ ingredients: [{ name: "Frango" }], goal: "ganhar massa" });
  });

  it("preserva o contrato de erro para payload inválido", async () => {
    const response = await generateRecipe(
      new Request("http://localhost/api/generate-recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingredients: [] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_INPUT" } });
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON malformado", async () => {
    const response = await generateRecipe(
      new Request("http://localhost/api/generate-recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_INPUT" } });
  });

  it("converte resposta de IA fora do contrato em 502", async () => {
    mockedGenerate.mockResolvedValue({ recipes: [recipe] });
    const response = await generateRecipe(
      new Request("http://localhost/api/generate-recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingredients: [{ name: "Frango" }] }),
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "AI_INVALID_RESPONSE" } });
  });

  it("registra status sanitizado do Gemini sem expor detalhes ao cliente", async () => {
    const errorLog = vi.spyOn(logger, "error").mockImplementation(() => logger);
    mockedGenerate.mockRejectedValue(
      new AppError("AI_UNAVAILABLE", "A geração está indisponível no momento.", 502, undefined, {
        provider: "gemini",
        providerHttpStatus: 503,
        providerStatus: "UNAVAILABLE",
        providerMessage: "Request contains an invalid argument.",
      }),
    );

    const response = await generateRecipe(
      new Request("http://localhost/api/generate-recipes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "recipe-error-test" },
        body: JSON.stringify({ ingredients: [{ name: "Frango" }] }),
      }),
    );

    const responseBody = await response.text();
    expect(response.status).toBe(502);
    expect(responseBody).not.toContain('"providerStatus"');
    expect(responseBody).not.toContain("providerHttpStatus");
    expect(responseBody).not.toContain("Request contains an invalid argument.");
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "api.request.failed",
        provider: "gemini",
        providerHttpStatus: 503,
        providerStatus: "UNAVAILABLE",
        providerMessage: "Request contains an invalid argument.",
      }),
      "API request failed",
    );
    errorLog.mockRestore();
  });
});
