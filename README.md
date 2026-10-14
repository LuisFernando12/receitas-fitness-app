# Receitas Fitness

Aplicação web que lê uma foto de uma nota de mercado e sugere de 2 a 4 receitas fitness com os ingredientes comprados. O usuário pode revisar e editar os itens reconhecidos, informar uma meta — por exemplo, emagrecimento ou ganho de massa — e então gerar as receitas.

O projeto usa Next.js com App Router e TypeScript. A leitura da nota e a geração das receitas usam Gemini por meio do LangChain, exclusivamente no servidor.

## Requisitos

- Node.js
- pnpm (`pnpm@12.11.2`, conforme `package.json`)
- Uma chave da API Gemini para executar as funcionalidades de IA

## Configuração local

Instale as dependências e crie o arquivo de ambiente local:

```bash
pnpm install
cp .env.example .env.local
```

Preencha `GEMINI_API_KEY` em `.env.local`. `GEMINI_MODEL` é opcional; sem valor, a aplicação usa `gemini-2.5-flash`. `LOG_LEVEL` também é opcional e define o nível do logger Pino (o padrão é `info`).

```dotenv
GEMINI_API_KEY=sua-chave
GEMINI_MODEL=gemini-2.5-flash
LOG_LEVEL=info
```

Não compartilhe nem versiona `.env.local`. A chave é lida somente pelo servidor e não deve ser exposta ao navegador.

## Executar

```bash
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Para gerar receitas ou analisar notas, configure uma chave válida do Gemini.

## Fluxo e API

1. Envie uma imagem da nota — no celular, é possível usar a câmera.
2. Revise, edite, adicione ou remova os ingredientes reconhecidos.
3. Informe opcionalmente uma meta fitness e confirme a lista.
4. Consulte as receitas, com ingredientes comprados, itens básicos e complementos identificados separadamente.

As informações nutricionais são estimativas. A imagem, os ingredientes e as receitas ficam apenas em memória durante o fluxo; a aplicação não mantém contas, histórico ou armazenamento persistente.

As rotas disponíveis são:

- `POST /api/analyze-note` — recebe `image` como arquivo em `multipart/form-data` e retorna os ingredientes reconhecidos.
- `POST /api/generate-recipes` — recebe JSON com `ingredients` e, opcionalmente, `goal`; retorna de 2 a 4 receitas.

As entradas e respostas são validadas no servidor com Zod. Os erros usam o formato `{ "error": { "code": "...", "message": "..." } }`. Os logs estruturados ajudam na rastreabilidade de requisições e falhas sem registrar o conteúdo da nota ou a chave da API.

## Verificações

```bash
pnpm test          # testes unitários e de integração (Vitest)
pnpm test:watch    # Vitest em modo watch
pnpm typecheck     # verificação TypeScript
pnpm lint          # ESLint
pnpm test:ci       # typecheck, lint e testes
pnpm test:e2e      # build e testes de navegador com Playwright
```

Os testes automatizados não precisam de uma chave Gemini: os testes de API e interface usam mocks. A validação de ponta a ponta da integração real exige configurar `GEMINI_API_KEY`.

## Estrutura principal

```text
src/app/                 Interface e rotas do App Router
src/app/api/             Route Handlers para análise e geração
src/lib/                 Contratos, validação, integração Gemini e logging
tests/                   Testes Vitest e Playwright
docs/prd/                PRD do produto
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
