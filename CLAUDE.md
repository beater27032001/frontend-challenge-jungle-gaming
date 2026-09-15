# GreenMint — Marketplace de NFTs

Resposta ao desafio em `docs/CHALLENGE.md`. **Leia o desafio antes de propor qualquer coisa:**
ele é a especificação, este arquivo é como a construímos.

## Fonte da verdade

| Assunto | Onde |
| --- | --- |
| O que entregar | `docs/CHALLENGE.md` |
| Plano de fases | `specs/00-plano.md` |
| Spec da fase atual | `specs/NN-*.md` |
| Identidade visual | Figma `BliVZDosX5BcSpvhYvdE0V` (cópia nossa, com edit access) |
| Decisões e desvios | `ARCHITECTURE.md` |

Figma: arquivo **"Marketplace de NFTs GreenMint"**, página `0:1`.

| Tela | Desktop (1440) | Mobile (414) |
| --- | --- | --- |
| Início | `2:2` | `14:5226` |
| Detalhes do NFT | `10:244` | `15:5536` |
| Carrinho | `11:1278` | `16:360` |
| Pagamento | `11:2862` | `16:748` |
| Confirmação de Pedido | `11:4385` | — |
| Login | `9:115` | `16:1022` |
| Cadastro | `9:1022` | `16:1228` |
| Perfil do Colecionador | `9:1238` | — |
| Carteiras | `9:1670` | — |

Confirmação, Perfil e Carteiras não têm frame mobile. O desafio exige que funcionem
mesmo assim — derive do padrão dos outros frames mobile e registre em `ARCHITECTURE.md`.

## Stack — obrigatória, não negociável

Trocar qualquer item abaixo, ou usá-lo de fachada, é **eliminatório** no desafio.

React 19 · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO ·
Tailwind v4 · shadcn/ui · MSW · Playwright · Lighthouse

Build: Vite. Gerenciador: pnpm.

## Regras que o desafio torna eliminatórias

1. **Nenhum dado fictício fora de `src/mocks/`.** Componentes, hooks e o cliente Axios
   não podem conter resposta simulada nem caminho alternativo de negócio.
2. **Eventos de tempo real passam pelo `socket.io-client`.** Chamar setter, callback ou
   o cache do Query direto para simular um evento não atende ao requisito.
3. **Nenhuma compra confirmada sem resposta da simulação.** A confirmação só aparece
   para pedido efetivamente confirmado pelo mock.
4. **Zero vazamento entre usuários.** Logout e troca de usuário limpam cache privado e
   subscriptions. Evento de sessão anterior não atualiza dado de outro usuário.
5. **Fluxo principal nunca é só visual.** Toda tela tem comportamento real contra a API.

## Convenções de código

- **Todo REST passa por `src/lib/api.ts`.** Nunca `fetch()` direto numa feature.
- **Valores em ETH são `string` decimal.** Cálculo com `big.js`, nunca `number` —
  `0.1 + 0.2` em float corrompe preço. Quantidade é inteiro.
- **Estado de busca/filtro/ordenação/paginação mora na URL**, via `validateSearch` do
  TanStack Router. Nada de `useState` para isso: tem que sobreviver a refresh e histórico.
- **Query keys incluem o usuário e os parâmetros da consulta**, para isolar cache
  entre usuários e entre buscas.
- Path alias `@/` → `src/`.
- Componentes shadcn/ui vão em `src/components/ui/` e são adaptados à identidade
  do Figma, não usados no estilo padrão.

## Design tokens

Ficam em `src/index.css`, extraídos do Figma com `get_variable_defs`.
**Não invente valor de cor, fonte ou tamanho.** Se faltar token, leia do Figma.

Paleta: `ink #140d0a` (fundo) · `surface-card #241612` · `surface-dark #38220f` ·
`border-strong #3f2319` · `border-soft #55321f` · `primary #d28a4c` ·
`secondary #b39463` · `text-accent #e89b55` · `text-primary #f7f3ec` ·
`text-secondary #cfb28c`

Tipografia: **Roboto Mono** (self-hosted via `@fontsource-variable`, exigência de
execução local). Escala `text-tiny-9` … `text-display-43`.

Layout: coluna de conteúdo **1200px** dentro do frame de 1440 (`max-w-content`).

Tema é **dark-only** — o Figma não tem versão clara. Não construa toggle.

O raio de borda (`--radius`) é provisório: calibre por tela com `get_design_context`.

## Estrutura

```
src/
  routes/      rotas file-based do TanStack Router (routeTree.gen.ts é gerado)
  features/    um diretório por domínio: nft, cart, auth, checkout, profile, wallets
  components/  ui/ = shadcn adaptado; resto = compartilhado entre features
  lib/         api.ts (axios), query.ts (queryClient), utils.ts, money, socket
  mocks/       MSW: handlers, db, fixtures, cenários, binding socket.io
  types/       contratos REST e payloads de evento
e2e/           specs Playwright + baselines visuais
specs/         plano de fases e spec de cada fase
docs/          CHALLENGE.md (enunciado original)
```

## Comandos

```bash
pnpm dev         # dev com mocks
pnpm build       # tsr generate && tsc -b && vite build
pnpm preview     # serve o build
pnpm typecheck   # tipos
pnpm lint        # oxlint
pnpm test        # Playwright (desktop 1440 + mobile 390)
pnpm test:report # relatório HTML
```

## Responsividade e acessibilidade

Larguras a validar: **390, 768, 1440**. O frame mobile do Figma é 414 — construa
fluido, não travado em 414.

Obrigatórios: navegação por teclado com foco visível, controle de foco em diálogos
e drawers, labels e erros associados aos campos, alt text, contraste legível,
estado nunca só por cor, feedback acessível para mutations e eventos, sem overflow
horizontal. Skeletons com shimmer preservam as dimensões do conteúdo e respeitam
`prefers-reduced-motion` (já tratado globalmente em `index.css`).

## Fluxo de trabalho

Trabalhamos **um ponto do desafio por vez**, via `/pipeline`.

**Branches:** `dev` é o tronco do projeto — `main` guarda apenas o enunciado
original. Toda branch nova, inclusive as que o `/pipeline` cria por fase, sai de
`dev` e volta para `dev`. Nunca ramifique de `main`.

**Commits:** sem trailer `Co-Authored-By`.

**Entrega por PR (da fase 2 em diante):** branch da fase → commit com OK do
usuário → `git push -u origin feat/fase-N-...` → `gh pr create --base dev`, com a
descrição montada a partir dos handoffs do pipeline. Nunca mergear local.
As fases 0 e 1 foram mergeadas localmente, antes desta decisão.

**Cuidado:** o VS Code empurra para `origin` automaticamente após cada commit.
Commit feito é commit publicado — não há janela para `git reset` sem force-push.

**Ao fim de cada ponto, pare e peça validação do usuário antes de commitar.**
Não commite por conta própria.
