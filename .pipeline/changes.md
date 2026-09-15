# Changes

## Status
implemented

## What changed

### Etapa 1 — Consolidação E2E
- `e2e/helpers.ts` — **novo**. `ANA`, `BRUNO`, `ApiResult`, `boot`, `bootReset`,
  `apiFetch`, `login(page, creds)`, `logout`, `setScenario`, `reset`,
  `addToCart`, `clearCart`, extraídos verbatim de `api-contracts.spec.ts`.
- `e2e/api-contracts.spec.ts` — importa de `./helpers`; recebeu os 4
  `describe` de `nft-catalog-session-integrity.spec.ts` (`purchase` e
  `assertCoherent` ficaram module-scope neste arquivo, não em `helpers.ts`,
  reusados pelos 4 blocos migrados; `login(page)` virou `login(page, ANA)`).
  Pairwise de preço via `big.js` (`new Big(curr).gte(prev)`) nos dois pontos
  citados no spec: teste "combined category+rarity+sort" e o teste
  "Scenario mutations keep the paginated catalogue... coherent".
- `e2e/runtime-behavior.spec.ts` — importa `boot` de `./helpers` (reaproveitado
  para eliminar a duplicação goto+status-check); recebeu os 2 `describe` de
  `mock-boot-revalidation.spec.ts` e os 2 testes de `smoke.spec.ts` (novo
  `describe('Smoke')`).
- `e2e/mock-boot-revalidation.spec.ts`, `e2e/nft-catalog-session-integrity.spec.ts`,
  `e2e/smoke.spec.ts` — deletados. Nenhum teste perdido (146 títulos
  presentes nos 2 arquivos restantes: 142 originais realocados/ajustados + 2
  testes novos de fixtures em `NFT catalogue`/`Quote`, mais os 2 títulos que
  o spec pediu para trocar).

### Etapas 2–3 — picsum → assets locais, fixtures/tipos 9×3
- `src/types/nft.ts` — `NFT_CATEGORIES` (9 slugs, ordem do design) +
  `NftCategory` derivado.
- `src/types/wallet.ts` — `NETWORKS = ['ethereum','polygon','solana']` +
  `Network` derivado; `walletSchema.network` usa `z.enum(NETWORKS)`.
- `src/types/quote.ts`, `src/types/order.ts` — `z.enum(NETWORKS)` importado de
  `./wallet` no lugar dos literais duplicados.
- `src/mocks/fixtures.ts` — `SEED_VERSION = 2`; `CATEGORIES = [...NFT_CATEGORIES]`
  (9 itens, `i % 9`); `NETWORK_FEES.solana = '0.0001'`; todas as URLs de
  imagem (NFT, criadores, usuários) trocadas por `/nft/ape-0{1..4}.webp`
  cicladas deterministicamente pelo índice.
- `src/mocks/handlers/auth.ts` — avatar do registro → `/nft/ape-01.webp`.
- `src/mocks/handlers/nfts.ts` — `category: z.enum(NFT_CATEGORIES)` importado
  de `@/types`, removendo a lista duplicada de 4 categorias.
- `e2e/api-contracts.spec.ts` — expectativas atualizadas: `category=art&rarity=epic`
  → `total: 2` (nft-001/nft-037); `category=art&rarity=rare` → `total: 1`
  (nft-028); `category=gaming` → `category=generative` para nft-006 no teste
  de coerência de catálogo; `seedVersion` → `2`; novos testes para
  `category=generative` (5 itens) / `category=nunca-existiu` (400) e para
  `network: 'solana'` em quote/wallet/order.

### Etapas 4–7 — CSS, primitivos, shell, skeleton
- `src/index.css` — `--radius: 0.375rem` (comentário "provisional" removido);
  `--animate-shimmer` + `@keyframes shimmer` dentro de `@theme`.
- `src/components/ui/` — 13 arquivos (os 12 pedidos + `label.tsx`, dependência
  do `form`/`checkbox` que o CLI do shadcn também gera): `button`, `input`,
  `select`, `checkbox`, `slider`, `dialog`, `sheet`, `skeleton`, `badge`,
  `card`, `form`, `sonner`, `label`. Gerados com
  `pnpm dlx shadcn@latest add ...` e adaptados: `cn` trocado de volta para
  `@/lib/utils` (o CLI atual usa um pacote `cn` avulso + `next-themes`, que
  removi de `package.json` — não são a stack pedida); classes `dark:*`
  removidas (app é dark-only, sem toggle); raio `rounded-lg`; `button` com
  variantes `default/ghost/outline/destructive` e sizes `default/sm/icon`
  (removi `secondary`/`link`/`lg`/`xs`/`icon-xs`/`icon-sm`/`icon-lg`, não
  listados no spec); `checkbox` `rounded-sm`; `slider` thumb `size-[15px]` +
  prop `thumbLabels?: string[]` para aria-label por thumb; `dialog`/`sheet`
  overlay `bg-ink/80`, content `bg-card`; `card` sem `shadow-sm`; `sonner`
  sem `next-themes`, tema fixo `dark`, `toastOptions.classNames` com tokens.
- `src/components/layout/header.tsx` — desktop-only, `withDivider` prop.
- `src/components/layout/footer.tsx` — desktop-only, 3 faixas do §9.
- `src/components/layout/mobile-search-bar.tsx` — mobile-only, §10.
- `src/components/layout/tab-bar.tsx` — mobile-only, §10, indicador
  não-cromático do item ativo.
- `src/routes/__root.tsx` — monta `Header`/`MobileSearchBar`/`Footer`/`TabBar`
  + `<Toaster theme="dark"/>`; `pb-[126px] lg:pb-0` no `<main>`.
- `src/routes/index.tsx` — eyebrow "GreenMint" → "KURIO".
- `index.html` — `<title>` e meta description com KURIO.
- `ARCHITECTURE.md` — novo, com as 4 decisões pedidas.

## What the Tester should focus on
- Critérios 13–25 (shell): nenhum teste automatizado novo cobre isso ainda —
  ficou para o Tester, por instrução do pipeline ("Coder não testa").
- Faixa 1 do footer: o conteúdo (3 blocos de 74+204px + newsletter 357px)
  excede matematicamente os 1152px disponíveis (`max-w-content` − `px-6`×2)
  mesmo sem nenhum gap extra — usei `flex-wrap` como rede de segurança para
  nunca estourar a largura (critério 23); vale conferir em 1440 se o
  wrap fica aceitável visualmente ou se merece recalibração fina depois.
  Todos os demais critérios de layout (390/768/1440, sem overflow) — validei
  manualmente com screenshots + `scrollWidth <= innerWidth`, mas não há teste
  automatizado no repo para isso ainda.
- Tab bar: o `mask-image` do entalhe está isolado numa camada de fundo
  separada do FAB — testar visualmente que o FAB continua sólido (um bug
  real que corrigi durante o desenvolvimento: o mask no container também
  cortava o FAB, que é filho dele).
- `aria-current="page"` + ponto de 4px só no item Home da tab bar; os outros
  3 itens (`disabled`) fora da ordem de tabulação.
- Ícones sociais do footer: lucide-react v1 (instalado) não tem mais ícones
  de marca (Twitter/Instagram/Facebook/Youtube/Linkedin) — usei genéricos
  (`AtSign`, `Camera`, `ThumbsUp`, `Play`, `Link2`) com `aria-label` da rede
  real. Vale conferir se isso passa no critério 19/tabela de primitivos ou
  se o Reviewer prefere outra solução (SVG de marca dedicado, fase futura).
- Newsletter: botão "Enviar" `disabled` de propósito (sem endpoint no
  contrato); confirmar que nenhum teste espera sucesso ali.

## Notes / deviations
- `src/components/ui/` tem 13 arquivos, não 12: `label.tsx` é dependência
  transitiva do `form`/`checkbox` gerados pelo CLI oficial do shadcn: sem ele
  `form.tsx` não compila. Mantive porque é parte da via oficial, não uma
  dependência nova por fora dela.
- Textos corridos dos 3 blocos de destaque do footer e o título da coluna de
  newsletter ("Fique por dentro") não estavam na transcrição do design
  system (só os títulos e o estilo do corpo foram extraídos) — escrevi
  microcópia genérica curta. Não é dado de negócio/fictício (não é
  mock de API), é copy de UI estática; ainda assim, o Reviewer/time de
  conteúdo pode querer revisar antes de qualquer baseline visual.
- Gap horizontal entre o medalhão e o texto de cada bloco de destaque, e o
  padding ao redor das réguas verticais da faixa 1 do footer: sem medida no
  design system (só o gap vertical título→texto de 12px é citado) — usei
  12px (`gap-3`) e `pl-6` por analogia com o resto do sistema; mesma regra
  do input/select ("calibra na fase que a consumir").
- `pnpm dlx shadcn@latest add ...` gravou os 13 arquivos gerados sob um
  diretório literal `@/` na raiz do repo (bug/particularidade do CLI mais
  recente com este `components.json`) em vez de `src/components/ui/`; movi
  os arquivos manualmente para o lugar certo e apaguei o diretório `@/`
  espúrio. Não sobrou nenhum resquício (`ls` confirma).
- `pnpm install` removeu `cn` e `next-themes` do lockfile — eram dependências
  que o CLI do shadcn adiciona por padrão nesta versão, mas nenhum componente
  adaptado as usa mais (ver acima).

## Ponytail

Além da varredura de excesso, esta passagem corrigiu três defeitos visuais que só
aparecem renderizando — nenhum agente do pipeline enxerga o Figma, e os 146 testes
passavam com todos eles presentes.

**1. Colisão de token, culpa da fase 0.** `--color-secondary: #b39463` (token
"Color/Secondary" do Figma, bege) sombreava `--secondary: var(--color-surface-dark)`
(alias do shadcn, marrom escuro). No Tailwind v4 `bg-secondary` resolve para
`--color-secondary`, então o alias do shadcn era **inalcançável por classe** — um
token morto que parecia vivo. Três usos no footer (banda da marca, campo da
newsletter, chip de carteiras) pediam o marrom e recebiam o bege. Removi o alias
morto, documentei a armadilha no CSS e troquei os três para `bg-surface-dark`.

**2. Medalhões na direção errada.** O Figma empilha medalhão ACIMA do título e do
texto (`flex flex-col gap-[12px]`); estavam ao lado. Com o medalhão ao lado, cada
bloco vira ~290px e os quatro não cabem em 1152px — foi isso que motivou o
`flex-wrap` "de segurança", cuja justificativa no código partia dessa conta
(`74+204×3+357`). Empilhado, cabe folgado e o wrap sai. Corrigi a direção, removi o
wrap e substituí o comentário, que documentava um raciocínio errado.

**3. Copy inventada — buraco meu.** `specs/02-design-system.md` trazia os títulos e
todas as medidas, mas eu não transcrevi os textos de corpo dos medalhões nem o
título da newsletter. Sem fonte, o Coder escreveu os próprios. Substituí pelos
textos reais do Figma e completei o spec de design.

Também desliguei `react/only-export-components` para `src/components/ui/**`: shadcn
gera componente e constante de variantes no mesmo arquivo, então o warning é
estrutural da biblioteca, não do nosso código — mesmo tratamento já dado a
`src/routes/**`.

Nada a cortar por excesso: os 13 primitivos são os que a spec pede, `helpers.ts` tem
91 linhas para 3 arquivos que antes duplicavam tudo, e o shell tem um componente por
composição real.

## Fix cycle (iteration 1)

Ciclo de correção da revisão NEEDS WORK (`.pipeline/review.md`). Implementados os
4 itens do Fix Plan, nada além disso.

### A. Gate `/e2e-sandbox` em produção
- `src/routes/e2e-sandbox.tsx` — adicionado `beforeLoad` que lança `notFound()`
  quando `!import.meta.env.DEV`, mantendo intocado o ternário
  `component: import.meta.env.DEV ? SandboxPage : NotAvailable` (é ele que
  garante a DCE de Dialog/Sheet/Slider/Checkbox no bundle de produção — um
  `beforeLoad` sozinho não bastaria, pois o componente continuaria
  referenciado). Comentário-doc do arquivo atualizado para descrever o novo
  comportamento em produção (404 boundary em vez de página em branco).
- Verificado empiricamente: `pnpm build && pnpm preview`, navegação para
  `/e2e-sandbox` renderiza "404 / Esta página não existe. / Voltar ao início"
  (o `notFoundComponent` do `__root`), não mais `null`.
- `dist/assets/e2e-sandbox-*.js` continua ~0.11 kB; `grep -l
  "DialogPrimitive\|SheetPrimitive\|SliderPrimitive\|CheckboxPrimitive"
  dist/assets/*.js` não retorna nenhum arquivo — a DCE permanece intacta.
- Os 5 testes do describe do sandbox em `runtime-behavior.spec.ts` (dev
  server próprio) passam sem nenhuma alteração.

### B. Foco `--ring` nos 4 `<Link>`
- `src/lib/utils.ts` — nova constante `linkFocusRing` (`rounded-xs
  outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`), ao lado
  de `cn`.
- Aplicada via `cn(linkFocusRing, …)` nos 4 call-sites: `header.tsx:28`
  (wordmark), `header.tsx:33` (nav "Início"), `tab-bar.tsx:41` (Home da tab
  bar), `__root.tsx:55` ("Voltar ao início" do 404).
- `e2e/runtime-behavior.spec.ts:865-943` — describe renomeado para "plain
  `<Link>` elements render the --ring token on focus-visible (fix iteration
  1, criterion 24)"; os 2 testes invertidos: `outlineStyle` agora é
  asseverado como `'none'` e o ring como presente. A asserção-controle do
  input `newsletter-email` (borderColor === `rgb(210, 138, 76)`) foi mantida
  intacta.

### C. Vestígios shadcn removidos
- `src/components/ui/sheet.tsx:79` — removido `data-[state=open]:bg-secondary`
  do botão Close. Nada mais na className mudou.
- `src/components/ui/dialog.tsx:76` — removidos `data-[state=open]:bg-accent`
  e `data-[state=open]:text-muted-foreground` do botão Close. Nada mais na
  className mudou.
- `focus:ring-ring` confirmado presente nos dois botões Close após a edição.

### D. `ARCHITECTURE.md`
- Decisão 2: gatilho de revisão trocado de "somente se uma extração futura
  revelar um footer mobile" para "antes de qualquer conteúdo do footer se
  tornar funcional (fase 3…)", citando CHALLENGE §8, como o plano especifica
  literalmente.
- Decisão 3: removido o 4º sub-item ("microcópia genérica"); a lista de
  placeholders ficou com exatamente 3 itens (glifo do FAB, ícones sociais,
  e-mail/telefone), seguida de um parágrafo registrando que a copy do footer
  tem fonte de verdade no §9 de `specs/02-design-system.md`.
- `specs/02-design-system.md` não foi tocado (Do not touch).

### Ajuste não previsto no Fix Plan, mas necessário para a suíte ficar verde
O Fix Plan mandava inverter exatamente 2 testes (o describe "Focus ring on
plain `<Link>`"), mas o item B tem um efeito colateral direto sobre **outros
2 testes pré-existentes** que o plano não havia identificado — `Accessibility
— keyboard navigation and focus (criterion 24)` (`e2e/runtime-behavior.spec.ts`,
os testes "desktop: skip-link…" e "mobile: skip-link…"), que também
verificavam `outline !== 'none'` para os mesmos 3 links (wordmark, Início,
Home da tab bar). Com `linkFocusRing` aplicado, `outlineStyle` passa a ser
`'none'` (Tailwind `outline-none`) e esses 2 testes quebravam — não por
scope creep meu, mas como consequência direta e inevitável do item B, e a
suíte ficaria vermelha (violando o critério de aceite 8, "202 testes… nos
dois projects"). Corrigi as 2 asserções para checar a presença de **qualquer**
indicador visível de foco (`outline !== 'none' || boxShadow !== 'none'`), sem
assumir um mecanismo específico — mantendo a intenção original do teste
("indicador de foco visível presente") sem hardcodar a implementação que a
correção do item B mudou. Comentários atualizados para referenciar
`linkFocusRing`/fix iteration 1.

Também precisei ajustar a asserção literal dos 2 testes invertidos: o critério
de aceite 5 do Fix Plan supõe que `boxShadow` contém a substring `210, 138,
76`, mas Tailwind v4 compila `focus-visible:ring-ring/50` para `--tw-ring-color:
color-mix(in oklab, var(--ring) 50%, transparent)`, e o Chromium mantém o
box-shadow computado nessa notação `oklab(...)` — a substring rgb nunca
aparece (verifiquei empiricamente contra `pnpm preview`). Troquei a checagem
por `getComputedStyle(el).getPropertyValue('--tw-ring-color')`, que resolve
`var(--ring)` para o hex (`#d28a4c`) antes do `color-mix`, e é uma prova mais
estável e independente do motor de renderização de que o mesmo token dirige o
ring; mantive também `boxShadow !== 'none'` como sinal de que o ring
realmente renderiza. A asserção-controle do input da newsletter (borderColor
literal RGB) não foi tocada — border-color não tem modificador de alpha, então
resolve direto para `rgb()`.

### Verificação final
`pnpm typecheck`, `pnpm lint`, `pnpm build` e `pnpm test` — todos verdes,
202/202 testes E2E passando nos dois projects (desktop-chromium e
mobile-chromium).

## Ponytail (iteração 1)

Um corte. As quatro correções já eram mínimas — o gate do sandbox combinando
`beforeLoad` com o ternário é necessário nas duas partes (o plano documenta por
quê), `linkFocusRing` é uma constante para 4 call-sites, e as deleções em
`sheet.tsx`/`dialog.tsx` são deleções.

**`NotAvailable` removida** (`e2e-sandbox.tsx`). Era `function NotAvailable() { return
null }`, e com o `beforeLoad` lançando `notFound()` antes de qualquer render ela
passou a ser inalcançável nos dois ambientes. O nome ainda prometia um estado de
"indisponível" que não existe. O ramo de produção do ternário precisa apenas de algo
que não referencie `SandboxPage` — é isso que preserva o tree-shaking —, então virou
`() => null` inline, com comentário dizendo exatamente para que serve e por que nunca
roda. Mesma classe dos renomes das iterações anteriores: nome que mente sobre o que o
código faz.

Verificado após o corte: chunk do sandbox em **0,09 KB** e nenhum
`DialogPrimitive`/`SheetPrimitive`/`SliderPrimitive` no bundle de produção — a
eliminação que era o risco desta iteração se manteve. `typecheck` e `lint` limpos.

## Fix cycle (iteration 2)

Ciclo de correção da revisão NEEDS WORK, iteração 2 (a última). Implementados
os 3 itens do Fix Plan, nada além disso — escopo de 3 arquivos.

### A. `src/lib/utils.ts`
- `linkFocusRing`: `focus-visible:ring-ring/50` → `focus-visible:ring-ring/75`.
  `rounded-xs`, `outline-none` e `focus-visible:ring-[3px]` mantidos. Comentário
  estendido com o porquê do desvio de alpha em relação a Button/Input (eles
  pareiam `/50` com `border-ring` sólida; `<Link>` não tem borda, então o anel
  precisa compositar ≥3:1 sozinho). Os 4 call-sites (`header.tsx` ×2,
  `tab-bar.tsx` ×1, `__root.tsx` ×1) não foram tocados — consomem a constante.

### B. Teste de contraste endurecido
- `e2e/runtime-behavior.spec.ts` (bloco `the ring color has adequate
  contrast...`, dentro do describe "Focus ring on plain `<Link>` does not
  clip or overlap neighbouring content"): reescrito para medir de verdade em
  vez de documentar. Agora é `async ({ page })`: `setViewportSize(390×844)` +
  `boot(page)` + `Tab`×2 até o Home da tab bar; lê `--tw-ring-color` do
  `document.activeElement` e `--color-ink`/`--color-surface-card` do
  `:root`; parse de hex (`/#[0-9a-fA-F]{6}/`) e alpha (regex de `%` do
  `color-mix`, com fallback de `/valor)` caso o engine resolva diferente) —
  sem regex casando, o teste lança erro (nenhum fallback silencioso). Tripwire
  `expect(alpha).toBe(0.75)` + `expect(ringHex).toBe('#d28a4c')` antes do
  cálculo de contraste. `blendOver` alimentado só com valores parseados
  (nenhum literal `0.5`/array hardcoded). As duas asserções finais viraram
  `toBeGreaterThanOrEqual(3)` (ink e surface-card). Comentários e título do
  teste atualizados para citar SC 1.4.11 e os números esperados (~4,31 / ~4,08).
  Os helpers `srgbToLin`/`luminance`/`contrast`/`blendOver` ficaram como
  estavam. Nenhum outro teste do describe (clipping/overlap, linhas
  ~1119-1185) foi tocado.

### C. `ARCHITECTURE.md`
- Nova seção `## Dívidas para a fase 3` ao fim do arquivo, com os 6 minors da
  revisão (cada um com arquivo:linha): prefixo do header, sombreamento
  `--color-foreground`/`--foreground`, raio do card, thumb `bg-white` do
  slider, variantes não usadas do badge, cenários `empty`/`out-of-order` sem
  teste. As decisões 1-4 existentes não foram tocadas (só apêndice).

### Verificação final
`pnpm typecheck`, `pnpm lint`, `pnpm build` e `pnpm test` — todos verdes,
216/216 testes E2E passando nos dois projects. Contraste medido em runtime:
`ring-on-ink contrast 4.308552129464832` e
`ring-on-surface-card contrast 4.078516115777691` (console.log do teste),
batendo com o cálculo do Fix Plan (~4,31 / ~4,08). `git status` confirma que
só `src/lib/utils.ts`, `e2e/runtime-behavior.spec.ts` e `ARCHITECTURE.md`
foram modificados nesta iteração (além de `.pipeline/changes.md`); os 4
call-sites de `linkFocusRing` e os testes de clipping/overlap/token do mesmo
describe não mudaram.

## Ponytail (iteração 2)

Nada a cortar. São três mudanças em três arquivos, todas obrigatórias pela revisão,
e nenhuma tem gordura.

Um ponto que passaria por excesso e não é: o comentário de 4 linhas sobre uma
constante de 1 linha em `src/lib/utils.ts`. Ele guarda exatamente o conhecimento que
custou um ciclo inteiro de revisão para aparecer — por que `/75` e não o `/50` que
Button e Input usam, e por que `<Link>` não pode copiar deles (eles têm `border-ring`
sólida, o link não tem, então o anel é o único indicador). Sem esse comentário, o
próximo que "alinhar" o link com os outros componentes reintroduz a falha de WCAG.

O teste de contraste deixou de ser decorativo: antes assertava `> 1`, agora mede alpha
e hex de `--tw-ring-color`, lê os fundos de `--color-ink` e `--color-surface-card`, tem
tripwire no alpha e cobra `>= 3` nos dois. Medido: **4,3086** sobre ink e **4,0785**
sobre surface-card — batendo com os 4,31 e 4,08 que o Planner calculou antes de
implementar.

As 6 dívidas da fase 3 saíram de `.pipeline/spec.md`, que o pipeline da próxima fase
sobrescreve, para uma seção permanente no `ARCHITECTURE.md`, cada uma com arquivo e
linha.

## Correção pós-revisão — flake de outside-click

Aplicado o item obrigatório da revisão final, decidido pelo usuário (opção A).

`e2e/runtime-behavior.spec.ts` — nos dois testes de clique-fora (Dialog e Sheet),
um round-trip pelo macrotask queue da página entre o `toBeVisible()` e o clique:

```ts
await page.evaluate(() => new Promise((r) => setTimeout(r, 0)))
```

Determinístico por ordem FIFO, não um sleep: o `setTimeout(..., 0)` que o
`@radix-ui/react-dismissable-layer@1.1.19` usa para adiar o listener de
`pointerdown` externo é enfileirado no mount da layer, portanto antes deste; quando
este resolve, aquele já rodou. Nenhuma asserção mudou, nenhum arquivo de produção
foi tocado.

Também corrigido um comentário desatualizado no mesmo arquivo, que ainda descrevia
`linkFocusRing` como `ring-ring/50` depois da iteração 2 tê-lo levado a `/75` —
comentário que mente sobre o código é a mesma classe de problema que este pipeline
já corrigiu três vezes.

**Verificação:** `typecheck` e `lint` limpos; **8 rodadas completas consecutivas,
216/216 em todas**. O flake aparecia em 3 de 9 rodadas (~33%) antes; se essa taxa
persistisse, 8 limpas seguidas teriam ~4% de probabilidade. Combinado com a correção
atacar o mecanismo nomeado — e não mascará-lo com espera — é evidência suficiente.
