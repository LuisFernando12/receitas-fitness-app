"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  analyzeNoteResponseSchema,
  generateRecipesInputSchema,
  generateRecipesResponseSchema,
  type Ingredient,
  type Recipe,
} from "@/lib/contracts";
import { AppError } from "@/lib/api-errors";
import { validateImageFile } from "@/lib/image-validation";

type Step = "upload" | "review" | "results";

type ApiErrorResponse = {
  error?: { message?: string };
};

async function getResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [goal, setGoal] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<"analyze" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const validIngredientCount = useMemo(
    () => ingredients.filter((ingredient) => ingredient.name.trim()).length,
    [ingredients],
  );

  async function handleFileChange(event: FormEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0] || null;
    setError(null);

    if (!selectedFile) return;

    try {
      await validateImageFile(selectedFile);
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } catch (reason) {
      setFile(null);
      setPreviewUrl(null);
      setError(reason instanceof AppError ? reason.message : "Não foi possível usar essa imagem.");
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Escolha uma foto da nota antes de continuar.");
      return;
    }

    setLoading("analyze");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/analyze-note", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível analisar a nota."));
      }

      const result = analyzeNoteResponseSchema.parse(await response.json());
      setIngredients(result.ingredients);
      setStep("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível analisar a nota.");
    } finally {
      setLoading(null);
    }
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    setIngredients((current) =>
      current.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient,
      ),
    );
  }

  function removeIngredient(index: number) {
    setIngredients((current) => current.filter((_, ingredientIndex) => ingredientIndex !== index));
  }

  function addIngredient() {
    setIngredients((current) => [...current, { name: "", quantity: "" }]);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = generateRecipesInputSchema.safeParse({ ingredients, goal });

    if (!parsed.success || validIngredientCount === 0) {
      setError("Adicione pelo menos um ingrediente válido antes de gerar as receitas.");
      return;
    }

    setLoading("generate");
    setError(null);

    try {
      const response = await fetch("/api/generate-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível gerar as receitas."));
      }

      const result = generateRecipesResponseSchema.parse(await response.json());
      setRecipes(result.recipes);
      setFile(null);
      setPreviewUrl(null);
      setIngredients([]);
      setGoal("");
      setStep("results");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível gerar as receitas.");
    } finally {
      setLoading(null);
    }
  }

  function startNewAnalysis() {
    setStep("upload");
    setFile(null);
    setPreviewUrl(null);
    setIngredients([]);
    setGoal("");
    setRecipes([]);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#183b32]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-[#d9e2d8] pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#d9f36b] text-xl">✦</span>
            <span className="text-lg font-bold tracking-tight">Prato Pronto</span>
          </div>
          <span className="hidden text-sm text-[#658074] sm:block">Receitas a partir das suas compras</span>
        </header>

        <section className="flex flex-1 flex-col py-10 sm:py-14">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#5b8066]">Seu mercado, sua cozinha</p>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              Transforme sua nota em comida de verdade.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#5e746a]">
              Envie uma foto das compras, revise os ingredientes e receba pratos fitness que fazem sentido para a sua meta.
            </p>
          </div>

          <div className="mb-8 flex max-w-xl items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#7b9085]" aria-label="Etapas">
            {(["upload", "review", "results"] as Step[]).map((item, index) => {
              const labels = { upload: "Nota", review: "Revisão", results: "Receitas" };
              const active = item === step;
              const complete = (step !== "upload" && item === "upload") || (step === "results" && item === "review");
              return (
                <div className="flex flex-1 items-center gap-2" key={item}>
                  <span className={`grid size-7 place-items-center rounded-full text-[11px] ${active || complete ? "bg-[#183b32] text-white" : "bg-[#e3e9e0]"}`}>
                    {complete ? "✓" : index + 1}
                  </span>
                  <span className={active ? "text-[#183b32]" : ""}>{labels[item]}</span>
                  {index < 2 && <span className="h-px flex-1 bg-[#d9e2d8]" />}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mb-6 flex max-w-3xl items-start gap-3 rounded-2xl border border-[#e5b8a6] bg-[#fff4ef] p-4 text-sm text-[#8b4937]" role="alert">
              <span aria-hidden="true">!</span>
              <p>{error}</p>
            </div>
          )}

          {step === "upload" && (
            <form className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]" onSubmit={handleAnalyze}>
              <div className="rounded-[2rem] border border-dashed border-[#afc3b3] bg-white/70 p-6 sm:p-10">
                <div className="flex min-h-72 flex-col items-center justify-center rounded-[1.5rem] bg-[#eef4e9] px-6 text-center">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="max-h-64 rounded-xl object-contain shadow-sm" src={previewUrl} alt="Prévia da nota enviada" />
                  ) : (
                    <>
                      <span className="mb-5 grid size-16 place-items-center rounded-3xl bg-[#d9f36b] text-3xl" aria-hidden="true">⌁</span>
                      <h2 className="text-xl font-semibold">Fotografe ou envie sua nota</h2>
                      <p className="mt-2 max-w-xs text-sm leading-6 text-[#658074]">JPEG, PNG ou WEBP. Até 10 MB.</p>
                    </>
                  )}
                  <label className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-[#183b32] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2a5749]">
                    {previewUrl ? "Trocar imagem" : "Escolher imagem"}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handleFileChange}
                      onInput={handleFileChange}
                      data-testid="receipt-input"
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col justify-end rounded-[2rem] bg-[#183b32] p-7 text-[#f7f4ee] sm:p-9">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d9f36b]">Comece por aqui</p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight">Uma foto basta para abrir novas possibilidades.</h2>
                <p className="mt-4 text-sm leading-7 text-[#c1d1c5]">A IA identifica os itens da nota. Você confere tudo antes de receber qualquer sugestão.</p>
                <button className="mt-8 rounded-full bg-[#d9f36b] px-6 py-3.5 text-sm font-bold text-[#183b32] transition hover:bg-[#e5ff94] disabled:cursor-not-allowed disabled:opacity-50" disabled={!file || loading === "analyze"}>
                  {loading === "analyze" ? "Lendo sua nota…" : "Analisar nota"}
                </button>
              </div>
            </form>
          )}

          {step === "review" && (
            <form className="grid gap-6 lg:grid-cols-[1fr_0.8fr]" onSubmit={handleGenerate}>
              <div className="rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_rgba(24,59,50,0.06)] sm:p-9">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5b8066]">Confira suas compras</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">Está tudo certo?</h2>
                  </div>
                  <span className="rounded-full bg-[#eef4e9] px-3 py-1 text-xs font-bold text-[#5b8066]">{validIngredientCount} itens</span>
                </div>
                <div className="mt-7 space-y-3" data-testid="ingredient-list">
                  {ingredients.map((ingredient, index) => (
                    <div className="flex gap-2" key={`${index}-${ingredient.name}`}>
                      <input className="min-w-0 flex-1 rounded-xl border border-[#d9e2d8] px-4 py-3 text-sm outline-none transition focus:border-[#6e9b75] focus:ring-2 focus:ring-[#d9f36b]" value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} aria-label={`Ingrediente ${index + 1}`} placeholder="Ingrediente" />
                      <input className="w-28 rounded-xl border border-[#d9e2d8] px-3 py-3 text-sm outline-none transition focus:border-[#6e9b75] focus:ring-2 focus:ring-[#d9f36b]" value={ingredient.quantity || ""} onChange={(event) => updateIngredient(index, "quantity", event.target.value)} aria-label={`Quantidade do ingrediente ${index + 1}`} placeholder="Quantidade" />
                      <button type="button" className="size-11 rounded-xl text-lg text-[#8b4937] transition hover:bg-[#fff4ef]" onClick={() => removeIngredient(index)} aria-label={`Remover ${ingredient.name || "ingrediente"}`}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-5 text-sm font-bold text-[#4f805b] hover:underline" onClick={addIngredient}>+ Adicionar ingrediente</button>
              </div>
              <div className="flex flex-col rounded-[2rem] bg-[#e6f0df] p-6 sm:p-9">
                <label className="text-sm font-bold uppercase tracking-[0.18em] text-[#5b8066]" htmlFor="goal">Qual é a sua meta?</label>
                <h2 className="mt-3 text-2xl font-semibold leading-tight">Dê um pouco de contexto para a IA.</h2>
                <textarea id="goal" className="mt-6 min-h-36 resize-none rounded-2xl border border-[#c8d9c4] bg-white/80 p-4 text-sm leading-6 outline-none transition focus:border-[#6e9b75] focus:ring-2 focus:ring-[#d9f36b]" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={240} placeholder="Ex.: quero refeições com bastante proteína para ganhar massa" />
                <span className="mt-2 text-right text-xs text-[#6c8373]">{goal.length}/240</span>
                <button className="mt-auto rounded-full bg-[#183b32] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#2a5749] disabled:cursor-not-allowed disabled:opacity-50" disabled={validIngredientCount === 0 || loading === "generate"}>
                  {loading === "generate" ? "Montando receitas…" : "Montar minhas receitas"}
                </button>
              </div>
            </form>
          )}

          {step === "results" && (
            <div>
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5b8066]">Sua próxima refeição</p>
                  <h2 className="mt-2 text-4xl font-semibold tracking-tight">Feito para você cozinhar.</h2>
                </div>
                <button type="button" className="rounded-full border border-[#b7cbb8] px-5 py-3 text-sm font-bold text-[#315f4a] transition hover:bg-white" onClick={startNewAnalysis}>+ Nova análise</button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {recipes.map((recipe) => (
                  <article className="rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_rgba(24,59,50,0.06)] sm:p-8" key={recipe.title}>
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-2xl font-semibold leading-tight">{recipe.title}</h3>
                      <span className="shrink-0 rounded-full bg-[#d9f36b] px-3 py-1 text-xs font-bold text-[#183b32]">{recipe.prepTimeMinutes} min</span>
                    </div>
                    <p className="mt-2 text-sm text-[#658074]">{recipe.servings} porções · nutrição estimada</p>
                    <div className="mt-6 grid gap-5 text-sm">
                      <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#5b8066]">Ingredientes</h4>
                        <ul className="space-y-2 text-[#52685e]">
                          {recipe.ingredients.map((ingredient) => (
                            <li className="flex items-start justify-between gap-3" key={`${recipe.title}-${ingredient.name}`}>
                              <span>{ingredient.name}</span><span className="text-right text-[#7f9387]">{ingredient.amount} · {ingredient.source === "purchased" ? "da compra" : ingredient.source === "basic" ? "básico" : "complementar"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#5b8066]">Preparo</h4>
                        <ol className="list-decimal space-y-2 pl-5 leading-6 text-[#52685e]">
                          {recipe.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
                        </ol>
                      </div>
                      <div className="rounded-2xl bg-[#eef4e9] p-4 text-xs text-[#52685e]">
                        <strong className="text-[#183b32]">Por porção:</strong> {recipe.nutrition.caloriesKcal} kcal · {recipe.nutrition.proteinGrams}g proteína · {recipe.nutrition.carbsGrams}g carboidratos · {recipe.nutrition.fatGrams}g gorduras
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
        <footer className="border-t border-[#d9e2d8] py-5 text-xs text-[#7b9085]">As informações nutricionais são estimativas e não substituem orientação profissional.</footer>
      </div>
    </main>
  );
}
