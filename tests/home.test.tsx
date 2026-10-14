import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const recipe = {
  title: "Frango com legumes",
  ingredients: [
    { name: "Frango", amount: "200 g", source: "purchased" },
    { name: "Sal", amount: "a gosto", source: "basic" },
    { name: "Azeite", amount: "1 colher", source: "complementary" },
  ],
  usedPurchasedIngredients: ["Frango"],
  instructions: ["Grelhe o frango."],
  prepTimeMinutes: 20,
  servings: 2,
  nutrition: { caloriesKcal: 300, proteinGrams: 35, carbsGrams: 10, fatGrams: 9, isEstimate: true },
};

function validImage() {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "nota.jpg", { type: "image/jpeg" });
}

describe("fluxo da página", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/analyze-note") {
        return new Response(JSON.stringify({ ingredients: [{ name: "Frango", quantity: "500 g" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ recipes: [recipe, { ...recipe, title: "Bowl proteico" }] }), { status: 200 });
    }));
  });

  it("permite revisar ingredientes, informar meta e exibir receitas", async () => {
    render(<Home />);
    const input = screen.getByTestId("receipt-input");
    fireEvent.change(input, { target: { files: [validImage()] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Analisar nota" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Analisar nota" }));

    await screen.findByText("Está tudo certo?");
    fireEvent.change(screen.getByLabelText("Ingrediente 1"), { target: { value: "Peito de frango" } });
    fireEvent.change(screen.getByLabelText("Qual é a sua meta?"), { target: { value: "ganhar massa" } });
    fireEvent.click(screen.getByRole("button", { name: "Montar minhas receitas" }));

    await screen.findByText("Feito para você cozinhar.");
    expect(screen.getByText("Frango com legumes")).toBeInTheDocument();
    expect(screen.getAllByText(/nutrição estimada/)).toHaveLength(2);
  });

  it("limpa o resultado ao iniciar nova análise", async () => {
    render(<Home />);
    fireEvent.change(screen.getByTestId("receipt-input"), { target: { files: [validImage()] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Analisar nota" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Analisar nota" }));
    await screen.findByText("Está tudo certo?");
    fireEvent.click(screen.getByRole("button", { name: "Montar minhas receitas" }));
    await screen.findByText("Feito para você cozinhar.");
    fireEvent.click(screen.getByRole("button", { name: "+ Nova análise" }));

    expect(screen.getByText("Fotografe ou envie sua nota")).toBeInTheDocument();
    expect(screen.queryByText("Frango com legumes")).not.toBeInTheDocument();
  });
});
