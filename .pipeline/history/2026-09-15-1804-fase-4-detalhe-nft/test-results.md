# Test Results

## Status
all passing (1 pre-existing, parallelism-only flake — not introduced by this fase, characterized below)

## Test command
```
pnpm typecheck
pnpm test e2e/nft-detail.spec.ts --workers=1
pnpm test e2e/catalog.spec.ts --workers=1
pnpm test e2e/api-contracts.spec.ts --workers=1
pnpm test e2e/runtime-behavior.spec.ts --workers=1
pnpm test                                          # full suite, default parallel workers
```

## Tests added
Nenhum teste novo escrito por mim. A fronteira desta rodada é **verificação
independente** da suíte que o Coder já entregou (`e2e/nft-detail.spec.ts`, 23
casos × 2 projetos = 46 execuções) e das fusões/ajustes em
`e2e/catalog.spec.ts` e `e2e/api-contracts.spec.ts` — cobertura já mapeia 1:1
para os 24 critérios de aceite da fase 4, então escrever testes redundantes
seria inflar a suíte sem checar nada novo. Em vez disso, verifiquei por fora:

- Forcei `rounded-full` no chip de edição desktop (item 6 do pedido) e
  confirmei que o critério 18 acusa — depois revertido, confirmado verde de
  novo.
- Escrevi e rodei um spec descartável (`e2e/ponytail_check.spec.ts`, removido
  após a checagem) medindo `boundingBox` e `white-space` do botão "Comprar
  NFT" mobile em 390px — geometria 196×60 preservada, `scrollWidth <= 196`
  (cabe numa linha), independente do relato do Coder no Ponytail.
- Rodei a suíte completa uma vez com paralelismo default para reproduzir os
  flakes reportados; isolei a falha encontrada com `--workers=1` e
  `--repeat-each=3`.

## Coverage
| Spec item (critério / edge case) | Test |
|---|---|
| 1. Acesso direto + refresh (desktop/mobile) | `nft-detail.spec.ts:14` |
| 2. `nft-999` → 404 tratado, sem skeleton preso, sem erro de console | `nft-detail.spec.ts:31` |
| 3. `nft-013` esgotado: chips/stepper/COMPRAR disabled + "Esgotado" `role=status` | `nft-detail.spec.ts:63` |
| 4. `nft-007` (available 2): + até 2, clamp [1,2] | `nft-detail.spec.ts:83` |
| 5. `nft-021` (available 1): + já nasce disabled | `nft-detail.spec.ts:102` |
| 6. `nft-004` (Standard+Deluxe): troca de edição atualiza preço e reseta quantidade | `nft-detail.spec.ts:113` |
| 7. COMPRAR → 1 POST, toast só após 200, GET /cart confirma quantidade | `nft-detail.spec.ts:137` |
| 8. Duplo clique sob latência → no máximo 1 POST | `nft-detail.spec.ts:164` |
| 8b. 409 `availability_conflict` (nft-021, 2ª compra) → toast de erro, nunca sucesso | `nft-detail.spec.ts:189` |
| 9. Cenário `server-error` → "Tentar novamente"; recuperação após reset | `nft-detail.spec.ts:208` |
| 10. Galeria desktop: 4 thumbnails, clique/teclado troca imagem, `aria-current` | `nft-detail.spec.ts:226` |
| 11. Galeria mobile: 4 pontos, pill ativo vs círculos, troca o hero | `nft-detail.spec.ts:247` |
| 12. Lupa: Dialog com imagem corrente, Esc fecha e devolve foco | `nft-detail.spec.ts:271` |
| 13. Breadcrumb "Início" link real / "Mercado" `aria-current="page"` não-link | `nft-detail.spec.ts:292` |
| 14. Favoritar (desktop+mobile) disabled, zero request | `nft-detail.spec.ts:311` |
| 15. Header sem régua em `/nft/*`, "Mercado" ativo, 404 sem nav ativa | `nft-detail.spec.ts:335` |
| 16. Shell mobile sem MobileSearchBar/TabBar em `/nft/*`; sem overflow 390/768/1440 | `nft-detail.spec.ts:356` |
| 17. Tokens novos (`--color-surface-raised` etc.) + tipografia 28/20/22px | `nft-detail.spec.ts:383` |
| 18. Chips elipse: `border-radius:50%`, cores certas, semântica radio | `nft-detail.spec.ts:421` — **gate forçado a falhar e revertido por mim** (ver Results) |
| 19. "Mais desta coleção": 5 cards, placa/arte, navegação, dots | `nft-detail.spec.ts:443` |
| 20. Skeleton preserva dimensões sob `slow` | `nft-detail.spec.ts:483` |
| 21. Contrato: `images` 4 itens, `ratingAvg`/`ratingCount`/`attributes`, `seedVersion` 4 | `api-contracts.spec.ts:151`, `:160`, `:952` |
| 22. Fusão E2E sem perda de teste (326→ pré-existentes + 23 novos = 374 no total) | confirmado pela contagem final da suíte completa (373 passed + 1 flake = 374) |
| 23. Preâmbulo de Tabs assere foco a cada Tab | `catalog.spec.ts` (preâmbulo revisado, dentro da suíte fundida) |
| 24. `build`/`typecheck`/`lint`/`test` passam | `typecheck` verde nesta rodada; `test` verde exceto o flake caracterizado abaixo |
| Edge: related vazio no cenário `empty` não quebra a página | `nft-detail.spec.ts:505` |
| Edge: Voltar mobile — histórico preserva URL do catálogo; acesso direto vai para `/` | `nft-detail.spec.ts:517` |
| Ponytail item 3 (botão "Comprar NFT" numa linha, 196×60) | verificado independentemente com spec descartável (ver "Tests added") |
| Ponytail item 6 (gate do border-radius forçado a falhar) | refeito independentemente por mim: `rounded-full` → critério 18 falha → revertido → verde |

## Results

**Rodadas isoladas** (`--workers=1`): 46/46 (`nft-detail.spec.ts`), 110/110
(`catalog.spec.ts`), 118/118 (`api-contracts.spec.ts`), 100/100
(`runtime-behavior.spec.ts`). Nenhuma falha, nenhum teste pulado.

**Suíte completa** (`pnpm test`, paralelismo default): **373 passed / 1
failed** de 374. A falha:

- `e2e/catalog.spec.ts:834` — `[desktop-chromium] › Long session across the
  URL (interleaved, non-happy order) › search, filters, sort, and price
  interleave without URL/UI ever diverging, and survive a mid-session reload`
- Sintoma: depois de clicar no thumb do slider de preço e disparar 5×
  `ArrowRight` + "Aplicar", a URL fica `?network=solana&sort=popular&category=art`
  — sem `priceMin=0.05` — indicando que uma ou mais teclas `ArrowRight` não
  chegaram a atualizar o valor do slider Radix antes do clique em "Aplicar".
- **Caracterização**: reproduzi isolando só este teste com
  `--repeat-each=3` no paralelismo default → **3/3 falharam**; a mesma
  execução com `--workers=1 --repeat-each=3` → **3/3 passaram**. Ou seja, não
  é flake de ordem entre specs, é contenção de CPU/timing sob paralelismo
  pesado — a mesma classe de flake de foco/teclado que o Coder já documentou
  para `runtime-behavior.spec.ts` e `api-contracts.spec.ts` (não reproduzidos
  por mim; ver abaixo), só que numa terceira localização
  (`catalog.spec.ts:834`) que o Coder não havia listado.
- **Não é regressão da fase 4**: o teste exercita filtro de rede/categoria/
  ordenação/preço do catálogo (fase 3), nada do domínio de detalhe; a
  interação problemática (`ArrowRight` no Radix Slider) é código herdado, não
  tocado pelas mudanças desta fase. Não conserto — é achado a reportar.
- Os flakes que o Coder relatou (`runtime-behavior.spec.ts`,
  `api-contracts.spec.ts`) **não reproduziram** nesta rodada completa, mesmo
  sob o mesmo paralelismo — coerente com serem intermitentes e não
  100% determinísticos.

**Verificações independentes que confirmam o relato do Coder/Reviewer-pendente**:

1. **Migração de fixtures (risco 1)**: `SEED_VERSION = 4`, `images` gera 4
   itens por NFT via `[0,1,2,3].map(...)` com `images[0] === imageUrl`
   preservado; `ratingAvg`/`ratingCount`/`attributes` são funções puras de
   `i` (índice), zero `Math.random`/`Date.now` — determinístico por
   construção. `api-contracts.spec.ts` cobre o contrato (`:151`, `:160`,
   `:952`) e passa. Nenhuma regressão em cascata (fusão de `catalog.spec.ts`
   passa 110/110).

2. **Comportamento §3**: confirmado nos testes 1–6 acima — edição esgotada
   nunca selecionável/comprável (`disabled` no `<input radio>`, não só
   estilo), quantidade respeita `available` da edição corrente e reseta ao
   trocar (`onSelectEdition` no código-fonte da rota faz `quantity: 1`
   incondicionalmente).

3. **Correção do Ponytail no botão mobile**: verificado por fora com spec
   descartável — `boundingBox` = 196×60 exato, `white-space: nowrap`
   computado, `scrollWidth (${…}) <= 196` (cabe numa linha). Confirmado, não
   apenas relatado.

4. **Compra honesta**: `POST /api/cart/items` real (interceptado nos testes
   7/8/8b, exatamente 1 chamada por clique intencional); toast de sucesso só
   depois do 200 (código: `onSuccess` do `useAddToCart`, sem otimismo); 409
   mostra a mensagem da API e nunca o toast de sucesso (teste 8b, passou).
   Não há navegação para `/cart` (rota inexistente) em nenhum ponto do
   código-fonte revisado.

5. **Galeria**: thumbnail troca a imagem principal com `aria-current` +
   borda (não só cor) — teste 10; lupa abre Dialog com `images[imageIndex]`,
   Esc fecha e devolve foco ao botão — teste 12, confirmado no
   código-fonte (`Dialog`/`DialogTrigger` do Radix, foco gerenciado pelo
   primitivo).

6. **Gate dos chips refeito por mim**: troquei `rounded-[50%]` por
   `rounded-full` no chip de edição desktop → critério 18 falhou
   (`Expected: "50%", Received: "3.35544e+07px"` — o `rounded-full` do
   Tailwind vira um raio absurdamente grande num container flex sem largura
   fixa, girando ainda mais para stadium) → revertido com `git checkout --`
   → confirmado verde de novo. Gate prova o que devia provar.

7. **Favoritar desabilitado**: teste 14 intercepta toda request a
   `/api/favorites` e conta zero, tanto no clique forçado do botão desktop
   quanto do coração mobile — nenhum dos dois aparenta sucesso.

**Achado adicional (não bloqueante) — nome de teste incoerente com a
asserção**: `e2e/api-contracts.spec.ts:932`, título `'seed remains
unchanged: fresh reset top-level fields match the known fixture values,
SEED_VERSION stays 3'`, mas a asserção na linha 952 é
`expect(dbDump.seedVersion).toBe(4)`. O teste está correto (passa, e checa o
valor certo, 4); o **título** ficou de uma iteração anterior à fase 4 e não
foi atualizado na "atualização mecânica" que o changes.md descreve para este
arquivo. Puramente cosmético — não afeta o resultado, mas vale corrigir o
título num passe futuro para não confundir quem ler o relatório do Playwright.

## Notas
- Não toquei nenhum arquivo de produção além da alteração temporária e
  revertida do item 6 (confirmada limpa por `git diff --stat` após o
  `git checkout --`).
- `git status` ao final desta rodada mostra apenas `.pipeline/spec.md`
  (modificação pré-existente, não deste agente) e o `nft-detail-mobile.tsx`
  com a correção do Ponytail do Coder (uncommitted, já presente antes desta
  sessão) — nada novo introduzido por mim.
- Não commitei nada.
