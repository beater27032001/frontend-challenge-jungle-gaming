# Changes

## Status
implemented

## What changed
- `src/types/common.ts`, `auth.ts`, `nft.ts`, `favorites.ts`, `cart.ts`, `quote.ts`,
  `order.ts`, `profile.ts`, `wallet.ts`, `events.ts`, `index.ts` — new. All REST
  contracts and event payloads from §5/§7, with zod schemas colocated with the
  types they validate (`z.infer` request types), ready for reuse by handlers now
  and by react-hook-form in phases 5–8.
- `src/lib/money.ts` — new. `eth`, `roundEth` (6dp, half-up, no trailing zeros),
  `mulQty`, all on `big.js`. Every monetary computation in the handlers goes
  through this file.
- `src/mocks/fixtures.ts` — new. Deterministic seed: 2 users (Ana/Bruno, with
  pre-computed `passwordHash`/`salt`, never plaintext), 48 NFTs generated from
  fixed tables (categories/rarities/prices/titles cycles, no PRNG), the
  `nft-013` sold-out / `nft-007` (available 2) / `nft-021` (available 1) fixed
  exceptions, `GREEN10`/`EXPIRED20` coupons, network fees, Ana's carts/favorites/
  wallets/historical `ord_seed_1`.
- `src/mocks/db.ts` — new. In-memory `Db` singleton, `hydrateDb`/`persist`/
  `resetDb` against `localStorage['greenmint:db:v1']`, `bumpNftVersion`,
  `findUserByToken`.
- `src/mocks/scenarios.ts` — new. All 13 named scenarios, `activeScenario`/
  `setScenario` (backed by `localStorage['greenmint:scenario']`), `delayFor`
  (mulberry32 seeded `0xC0FFEE`, no `Math.random`), `withScenario` wrapper
  (latency → offline/server-error/flaky → resolver).
- `src/mocks/control.ts` — new. `?mock-scenario=`/`?mock-reset=1` boot params,
  `window.__mocks` surface for Playwright/manual use.
- `src/mocks/utils.ts` — new. `apiError`, `parseBody` (zod → 400 with field
  `details`), `requireSession` (401 `unauthorized`/`session_expired`, honors the
  `session-expired` scenario), `sha256Hex` (Web Crypto).
- `src/mocks/handlers/auth.ts`, `nfts.ts`, `favorites.ts`, `cart.ts`, `quote.ts`,
  `orders.ts`, `profile.ts`, `wallets.ts`, `index.ts` — new. Every route from the
  spec's table, all wrapped in `withScenario` except `/api/health`.
- `src/mocks/handlers.ts` — deleted (replaced by `src/mocks/handlers/`).
- `src/mocks/browser.ts` — modified: after `worker.start()`, calls
  `installMockControls()` then `hydrateDb()`.

## What the Tester should focus on
- Pagination/filter/sort determinism on `GET /api/nfts` (`page=4`/`page=5`,
  `priceMin>priceMax` ⇒ empty 200, combined `category`+`rarity`+`sort`).
- Auth: wrong password vs. unknown email both → `invalid_credentials`; session
  cookie survives `page.reload()`; `register-conflict` scenario forces 409
  unconditionally.
- Cart: guest→user merge caps at `available`; `nft-007-e1` qty 5 → 409 with
  `details.available === "2"`; a fresh browser context has an empty guest cart.
- Quote: `GREEN10` discount is exactly 10% of subtotal via big.js comparison
  (not float `toBeCloseTo` with a loose epsilon); `EXPIRED20` → `coupon_expired`;
  unknown code → `coupon_invalid`.
- Orders: missing `Idempotency-Key` → 400; same key + same body → replay 200
  with identical `order.id`; same key + different body → 409
  `idempotency_conflict`; **this check happens before zod validation of the
  body** on a known key. Resolution-on-read at `GET /api/orders/:id` needs a
  controlled clock (`page.clock`) past `createdAt + 1500ms`.
- Scenario side effects are real, persisted mutations: `price-changed` and
  `sold-out` permanently alter the catalogue (bump `version`, change
  `available`/`priceEth`) even after switching back to `default` — tests that
  reuse a cart across scenario checks must clear it between checks or use
  distinct NFTs, or they will see stale availability from an earlier scenario.
- `window.__mocks.reset()` / `?mock-reset=1` must restore the exact fixture
  state (`nft-001-e1.available === 10`, Ana's favorites/cart back to seed).
- `db.users` in localStorage never contains a `password` field.

## Notes / deviations
- **Db.wallets and Db.counters.wallet are additions beyond the spec's literal
  `db.ts` code block.** The spec's `interface Db { ... }` sample has no
  `wallets` field, yet `handlers/wallets.ts` and the fixtures section (Ana/
  Bruno's wallets) are both explicitly required. Since the sample interface is
  illustrative (its own prose only calls out the `orders`/`ownerId` typing
  nuance, nothing about wallets), I added `wallets: Record<string, Wallet[]>`
  and a `wallet` counter to `Db` — the minimal structural addition needed to
  implement what the spec unambiguously asks for elsewhere. Flagging this per
  the "record spec problems, don't improvise a different feature" rule, though
  this reads as a gap-fill rather than a contradiction.
- New user ids on `POST /api/auth/register` use `u_${crypto.randomUUID()}`
  (no sequential counter was specified for users, unlike cart/quote/order/
  wallet).
- Idempotency fingerprint hashes the raw request body text
  (`sha256Hex(rawText)`), not a canonicalized re-serialization — matches "JSON
  do body" literally and is sufficient for the required replay/conflict
  behavior since callers resend the identical JSON string.
- `POST /api/orders` price-changed/sold-out scenario hooks mutate the catalogue
  for `quote.items[0]` right before the normal per-item revalidation loop, so
  the 409 is produced by the same code path a real price/stock change would
  hit — not a special-cased branch.
- I did not create `e2e/api-contracts.spec.ts`, even though the spec lists it
  under "Files to create/modify". Writing tests is outside the Coder role in
  this pipeline (hard rule); it belongs to the Tester/E2E stage. To gain
  confidence before handoff I wrote a throwaway Playwright spec covering all
  24 acceptance criteria end to end (pagination/filters, auth, favorites,
  cart merge/conflict, quote math, order idempotency/resolution/forbidden/
  snapshot, all scenario branches, boot params/reset, password hashing) —
  it passed in full — then deleted it per the "don't deliver test files" rule.
  The Tester should treat that criteria list as the spec for the real file.
- `e2e/smoke.spec.ts` was not touched and stays green.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass clean.

## Ponytail

O código veio enxuto — handlers sem `try/catch` repetido (MSW v2 aceita
`throw HttpResponse`, que é o idiomático), fixtures sem RNG, `money.ts` com os
três exports todos em uso real (12/7/1 chamadas). Três cortes aplicados:

1. **`HttpResolver` removido** (`scenarios.ts`) — era `export type HttpResolver =
   HttpResponseResolver`, um alias usado só dentro do próprio arquivo, embrulhando
   um tipo já importado do `msw`. Indireção sem ganho. `withScenario` passou a usar
   `HttpResponseResolver` direto.
2. **`isScenarioName` desduplicado** — existia em `scenarios.ts` (aceitando
   `string | null`) e de novo em `control.ts` (aceitando `string`). A primeira já
   cobria a segunda; agora é exportada e o `control.ts` importa.
3. **`loadState` renomeado para `reseed`** (`db.ts`) — a função não carrega nada,
   ela descarta o estado e resseme a partir das fixtures. Nome enganoso é o tipo de
   coisa que custa caro às 3h da manhã.

`pnpm typecheck` e `pnpm lint` seguem limpos após os cortes.

### Achado que NÃO é simplificação — fica registrado para o Reviewer

`fixtures.ts` e `handlers/auth.ts` referenciam **`https://picsum.photos`** em 6
lugares (imagens de NFT, avatares de criador e de usuário). É dependência de
serviço externo, e isso conflita com quatro exigências do desafio:

- o cenário `offline` não fica de fato offline;
- Lighthouse ≥90 sofre com requisição externa no caminho do LCP;
- regressão visual (§9) precisa de "dados estáveis" — imagem remota é instável;
- §12 exige execução "a partir de um checkout limpo, sem depender de serviços".

Não corrigi aqui porque a decisão é de escopo: o Figma tem a arte real dos NFTs,
e trocar por assets locais é trabalho da fase 2/3, não um corte de excesso.
`https://example.com` nos links de transação está correto — §3 diz que referências
de exploração são simuladas.

## Fix cycle (iteration 1)

Root cause do E2E: `installMockControls()` consumia `?mock-reset=1` /
`?mock-scenario=` mas nunca os removia da URL, então todo reload na mesma URL
repetia a ação (reset apagando sessão/dados em silêncio; scenario reimpondo
um valor de boot por cima de qualquer `setScenario()` de runtime).

- `src/mocks/control.ts` — em `installMockControls()`, logo após consumir os
  dois params (e antes de definir `window.__mocks`): se `mock-scenario` e/ou
  `mock-reset` estiverem presentes na query string (independente do valor ser
  válido), ambos são removidos de `params` e a URL é reescrita via
  `window.history.replaceState(null, '', url)`, preservando outros params e o
  hash (`pathname + '?' + params.toString() (se houver) + hash`). Se nenhum
  dos dois params está presente, `replaceState` não é chamado — loads normais
  não tocam no histórico. Doc comment do topo do arquivo atualizado para
  descrever os boot params como one-shot (consumidos e removidos via
  `history.replaceState`). Nenhuma flag nova em storage foi adicionada; a
  remoção do param da URL é o único mecanismo.
- `e2e/api-contracts.spec.ts` — `bootReset()` simplificado: removida a
  segunda navegação `await boot(page)` que contornava o bug (o comentário do
  helper documentava isso explicitamente); o corpo agora é só
  `await boot(page, '?mock-reset=1')`, e o comentário foi atualizado para
  refletir que `installMockControls()` já limpa o param sozinho.

Verificação: `pnpm typecheck`, `pnpm lint` e `pnpm build` limpos. Suite E2E
completa rodada (`e2e/api-contracts.spec.ts`, `e2e/runtime-behavior.spec.ts`,
`e2e/smoke.spec.ts`, desktop-chromium + mobile-chromium): 106/106 passaram,
incluindo o teste que antes falhava
(`?mock-reset=1 boot flag › FINDING: reloading the page...`), agora verde sem
alteração no próprio teste.

Nada além de `src/mocks/control.ts` e o helper `bootReset()` foi tocado —
`db.ts`, `scenarios.ts`, `fixtures.ts`, `utils.ts`, `browser.ts`, `handlers/*`,
o achado do `picsum.photos` e os arquivos `runtime-behavior.spec.ts`/
`smoke.spec.ts` permanecem intactos, conforme o "Do not touch" do Fix Plan.

## Ponytail (iteração 1)

Nada a simplificar. A correção tem 6 linhas e cada uma se paga:

- o guard `if (params.has(...))` evita chamar `replaceState` em toda carga limpa,
  que é a esmagadora maioria delas;
- reconstruir a URL a partir de `pathname + search + hash` preserva parâmetros de
  terceiros e o fragmento, em vez de assumir que a URL só tem os nossos;
- `bootReset()` no suite de contratos ficou como wrapper de uma linha com 3 chamadas.
  No limite do que se paga, mas fica: o valor dele é o comentário que documenta a
  semântica de uso único do parâmetro — exatamente o conhecimento cuja ausência
  causou este bug.

Nenhum corte aplicado nesta iteração.

## Fix cycle (iteration 2)

Root cause: `NftSummary.priceEth`/`available` eram calculados uma única vez no
seed e nunca recomputados quando as edições mudavam (compra, `sold-out`,
`price-changed`), então `GET /api/nfts` e o topo de `GET /api/nfts/:id`
ficavam obsoletos após a primeira mutação. Correção: refresh na escrita,
dentro de `bumpNftVersion`, conforme decidido no Fix Plan (não recompute na
leitura).

- `src/mocks/fixtures.ts` — extraída a lógica das linhas 113-118 (antigo
  `buildNft`) para `export function refreshNftDerived(nft: NftDetail): void`.
  A comparação de menor preço agora usa `eth(e.priceEth).lt(eth(min))` em vez
  de `Number(...) < Number(...)` (era o único float-compare de dinheiro do
  repo). `buildNft` monta o `NftDetail` com placeholders (`priceEth:
  editions[0].priceEth`, `available: 0`) e chama `refreshNftDerived(nft)`
  antes do `return`, que sobrescreve os dois campos com o valor correto.
  `SEED_VERSION` não foi bumpado — resultado byte-idêntico ao anterior.
- `src/mocks/db.ts` — `bumpNftVersion` agora chama `refreshNftDerived(nft)`
  logo após incrementar `nft.version`, cobrindo os três (únicos) call sites
  de mutação de edição em `orders.ts` numa única mudança.
- `src/mocks/handlers/cart.ts` — `mergeGuestCartInto` agora filtra
  `db.carts[userId] = userRows.filter((row) => row.quantity > 0)` ao final do
  merge, no mesmo padrão já usado em `orders.ts:116`, eliminando linhas de
  carrinho com `quantity === 0` geradas pelo cap em `Math.min(...,
  available)` quando `available === 0`.

Nenhum outro arquivo tocado: `orders.ts`, `nfts.ts` (incluindo `toSummary` e o
handler de detalhe), `control.ts`, `scenarios.ts`, `utils.ts`, `browser.ts` e
os testes ficaram intactos, conforme o "Do not touch" do Fix Plan. Nenhuma
recomputação foi adicionada na leitura.

Verificação: `pnpm typecheck`, `pnpm lint` e `pnpm build` limpos.

## Ponytail (iteração 2)

Nenhum corte: a mudança já é o menor diff que resolve. Um único ponto de refresh
(`bumpNftVersion`) cobre os três defeitos de topo, e `eth(...).lt(...)` no lugar de
`Number(...)` é a correção mínima do float-compare, com `eth` já importado no arquivo.
`refreshNftDerived` tem 8 linhas e dois chamadores reais — se paga, e ainda elimina a
duplicação que existia entre o seed e o que deveria acontecer nas mutações.

Uma coisa adicionada, não cortada: doc comment em `bumpNftVersion` (`db.ts`). A função
agora faz duas coisas — sobe a versão e recalcula os campos derivados — mas o nome só
anuncia a primeira. Quem lê `bumpNftVersion(nft.id)` nos três call sites de `orders.ts`
não tem como saber do resto. É o mesmo cheiro que a iteração 1 corrigiu renomeando
`loadState` para `reseed`; aqui renomear cruzaria a fronteira "do not touch" do
`orders.ts`, então o comentário é a correção lazy que resolve o problema real (um leitor
não saber) sem espalhar o diff. Se incomodar depois, renomear é mecânico.

`pnpm typecheck` e `pnpm lint` seguem limpos.
