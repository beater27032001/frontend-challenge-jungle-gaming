# Spec: Fase 4 — Detalhes do NFT

> Fonte de verdade visual: `specs/04-detalhe-nft.md` (236 linhas, incluindo a
> seção "Resolução das Open Questions do Planner" no fim — ler inteira),
> complementada por `specs/02-design-system.md` e `specs/03-catalogo.md`.
> Ninguém neste pipeline tem acesso ao Figma — **nenhuma medida, cor ou copy
> pode ser inventada**. Ler também CLAUDE.md §"Verificação — o instrumento
> erra mais que o código" antes de testar qualquer coisa.

## Open Questions

None.

(As 5 da primeira versão foram resolvidas pelo usuário e transcritas em
`specs/04-detalhe-nft.md` §3 e §"Resolução das Open Questions": cards do
carrossel, lupa 30×30, chips-elipse, pontos do hero mobile, ritmo vertical +
glifo do stepper. A resolução também revelou um **breadcrumb "Início /
Mercado"** não transcrito antes — incorporado abaixo.)

## Goal

Substituir o stub de `/nft/$nftId` pela tela real de Detalhes do NFT em duas
composições distintas (desktop `10:244` e mobile `15:5536`), com o
comportamento que o CHALLENGE §3 exige: acesso direto, NFT inexistente
tratado, edição esgotada não selecionável nem comprável, quantidade limitada
pelo `available` da edição, galeria funcional e compra que adiciona de verdade
ao carrinho via API (o carrinho-tela é fase 6). Favoritar fica **desabilitado**
nesta fase (decisão já tomada — favoritos exigem sessão, fase 5; a atualização
otimista com rollback do §4 vai junto). A fase também quita dívidas do
`ARCHITECTURE.md` que vencem aqui (consolidação dos 3 specs E2E de catálogo,
prop morta, flake de Tab) e deixa pronto para a fase 5: botões de favorito
posicionados por design, `scope` nas query keys do detalhe e carrinho de guest
que o handler já mescla no login.

## Files to create / modify

**Criar:**

- `src/features/nft/components/nft-detail-desktop.tsx` — composição desktop
  completa (breadcrumb + bloco Product: galeria + coluna de detalhes),
  `hidden lg:*`.
- `src/features/nft/components/nft-detail-mobile.tsx` — composição mobile
  (Hero + Details Sheet + Buy Bar), `lg:hidden`.
- `src/features/nft/components/related-carousel.tsx` — "Mais desta coleção",
  desktop-only (o frame mobile não tem a seção).
- `src/features/cart/use-add-to-cart.ts` — mutation `POST /cart/items` +
  toasts. Primeiro arquivo do domínio cart; a fase 6 o reutiliza.
- `e2e/nft-detail.spec.ts` — spec E2E do domínio detalhe (desktop + mobile).

**Modificar:**

- `src/routes/nft.$nftId.tsx` — troca o stub pela página real: query do
  detalhe, estados (skeleton/404/erro), estado de compra (edição, quantidade,
  índice da galeria) **elevado à rota** e passado às duas composições — as
  duas montam ao mesmo tempo (`hidden lg:*`), então o estado não pode viver
  dentro de cada uma.
- `src/features/nft/queries.ts` — `nftDetailOptions(scope, nftId)`; related
  reusa `nftListOptions` com `{ category, perPage: 12 }`.
- `src/index.css` — 5 tokens novos (spec 04 §1): `--color-surface-raised:
  #2f1d15`, `--color-amber: #e3a44e`, `--text-title-20: 1.25rem`,
  `--text-title-22: 1.375rem`, `--text-heading-28: 1.75rem`. **Dívida 7**: só
  comentar o sombreamento `--color-foreground` (#f5f1eb) vs `--foreground`
  (#f7f3ec) explicando que são dois tokens Figma distintos — NÃO mudar
  valores (mudança de cor = churn de baseline sem ganho).
- `src/types/nft.ts` — `NftDetail` ganha `ratingAvg: string`, `ratingCount:
  number`, `attributes: string[]`; comentário de `images` passa de "3 por
  NFT" para "4 por NFT". Nada muda em `NftSummary` (o catálogo não mostra
  rating) — `toSummary` no handler fica intocado e já descarta os campos
  novos.
- `src/mocks/fixtures.ts` — ver "Mudanças de fixture" abaixo. `SEED_VERSION`
  3 → 4.
- `src/features/nft/labels.ts` — `RARITY_LABELS: Record<NftRarity, string>`
  (`Comum`/`Raro`/`Épico`/`Lendário`, capitalizado — distinto do
  `RARITY_BADGES` em caixa alta) para o 3º atributo e usos futuros.
- `src/routes/__root.tsx` — shell por rota: em `/nft/*` o frame mobile
  (`15:5536`) **não tem** MobileSearchBar nem TabBar (a Buy Bar ocupa o
  fundo), e o header desktop das telas de mercado é **sem divisor**
  (specs/02 §2, doc do componente). Via `useLocation`:
  `isNftDetail = pathname.startsWith('/nft/')` →
  `<Header withDivider={!isNftDetail} />`, `{!isNftDetail && <MobileSearchBar />}`,
  `{!isNftDetail && <TabBar />}`, e o `pb` do `<main>` vira `pb-[164px]`
  (altura da Buy Bar) em vez de `pb-[126px]` nessas rotas.
- `src/features/nft/components/catalog-toolbar.tsx` + `src/routes/index.tsx` —
  **dívida 2**: remover a prop `total` morta (recebida e nunca usada) e o
  argumento no call site.
- `e2e/catalog.spec.ts` — **dívida 4**: absorver `catalog-tester.spec.ts` e
  `catalog-e2e-tester.spec.ts` como `describe`s (testes preservados, não
  deletados — mesmo movimento da fase 2, spec 02 §6). **Dívida 1** no mesmo
  passe: o preâmbulo de contagem fixa de Tabs (linhas ~387-391) passa a
  asserir o foco a cada Tab.
- `e2e/catalog-tester.spec.ts`, `e2e/catalog-e2e-tester.spec.ts` — **apagar**
  após a fusão.
- `e2e/api-contracts.spec.ts` — atualização mecânica (precedente documentado
  no próprio teste): `seedVersion` 3→4 (linhas ~913-931), `images` com 4 itens
  (linha ~149, mantendo `images[0] === imageUrl`), e cobrir os campos novos
  (`ratingAvg`/`ratingCount`/`attributes`) no teste de contrato do detalhe.
- `ARCHITECTURE.md` — seção "Fase 4" com as decisões listadas em "Registro em
  ARCHITECTURE.md" abaixo. (As entradas obsoletas das dívidas 6 e 9 já foram
  corrigidas pelo usuário — não retrabalhar; registrar apenas a aceitação do
  `aria-current` do footer (dívida 3) e a cross-ref do zoom (dívida 5), se o
  usuário ainda não as tiver adicionado.)

**Mudanças de fixture (`src/mocks/fixtures.ts`)** — todas determinísticas,
zero PRNG, `SEED_VERSION = 4`:

- `images`: `[0, 1, 2, 3].map(...)` — 4 imagens por NFT (o desktop tem 4
  thumbnails, `10:244`; hoje são 3 e sobraria uma placa vazia). Invariante
  `images[0] === imageUrl` preservada.
- `ratingAvg: ((35 + (i * 7) % 16) / 10).toFixed(1)` → '3.5'…'5.0';
  `ratingCount: 7 + (i * 13) % 43` → 7…49. (O design mostra avaliação — 5
  estrelas + "19 avaliações" no desktop, pill "4.8 (19)" no mobile — e o
  modelo não tinha o dado. Renderizar número fixo no componente violaria
  "nenhum dado fictício fora de `src/mocks/`", então o dado nasce na fixture,
  mesmo racional da resolução `network` da fase 3.)
- `attributes`: `[TRAIT_A[i % 4], TRAIT_B[i % 5], RARITY_LABELS[rarity]]` com
  `TRAIT_A = ['Óculos', 'Capacete', 'Coroa', 'Máscara']` e `TRAIT_B =
  ['Esmeralda', 'Rubi', 'Safira', 'Âmbar', 'Ônix']` ("Óculos, Esmeralda,
  Raro" é o exemplo do Figma; as demais palavras são conteúdo de mock, casa
  legítima de dado fictício).
- `description` passa a PT, moldada na copy do Figma:
  `` `${title} é um colecionável digital da coleção ${categoryLabelPt},
  finalizado à mão, verificado na ${networkLabelPt}, com arte desbloqueável e
  acesso para colecionadores.` `` — os labels PT ficam duplicados como tabela
  local da fixture (mocks não devem importar de `src/features/`). Nenhum teste
  atual assere o texto da descrição (verificado por grep).

## Function / API signatures

```ts
// src/types/nft.ts
export interface NftDetail extends NftSummary {
  description: string
  images: string[] // galeria, 4 por NFT; images[0] === imageUrl
  editions: NftEdition[]
  ratingAvg: string // '3.5'…'5.0', 1 casa decimal
  ratingCount: number
  attributes: string[] // 3 itens, PT
}

// src/features/nft/queries.ts
export function nftDetailOptions(scope: string, nftId: string) {
  return queryOptions({
    queryKey: ['nfts', scope, 'detail', nftId] as const,
    queryFn: async ({ signal }) =>
      (await api.get<NftDetail>(`/nfts/${nftId}`, { signal })).data,
    // 404 é resposta final, não falha transitória — não gastar o retry.
    retry: (count, error) =>
      !(isAxiosError(error) && error.response?.status === 404) && count < 1,
  })
}
// Related: reusar nftListOptions(scope, { category: nft.category, perPage: 12 })
// e filtrar o próprio id no componente. Nenhuma query nova.

// src/features/cart/use-add-to-cart.ts
export function useAddToCart(): UseMutationResult<Cart, unknown, AddCartItemBody>
// mutationFn: (await api.post<Cart>('/cart/items', body)).data
// body: { nftId, editionId, quantity } — tipo inferido de addCartItemSchema
// (src/types); onSuccess: toast.success('Adicionado ao carrinho');
// onError: toast.error(<message do payload de erro da API, fallback
// 'Não foi possível adicionar ao carrinho.'>). Sem navegação (não existe /cart).

// src/routes/nft.$nftId.tsx — estado elevado, passado às duas composições:
interface NftDetailViewProps {
  nft: NftDetail
  selectedEditionId: string | null // null ⇔ todas as edições esgotadas
  quantity: number
  imageIndex: number
  onSelectEdition: (editionId: string) => void // reseta quantity para 1
  onQuantityDelta: (delta: 1 | -1) => void // clamp [1, edition.available]
  onSelectImage: (index: number) => void
  onBuy: () => void
  isBuying: boolean
}
export function NftDetailDesktop(props: NftDetailViewProps): JSX.Element
export function NftDetailMobile(props: NftDetailViewProps): JSX.Element
export function RelatedCarousel({ nft }: { nft: NftDetail }): JSX.Element
```

Regras do estado de compra (na rota):

- Edição inicial: **primeira edição com `available > 0`**; se nenhuma
  (nft-013), `selectedEditionId = null` e chips/stepper/COMPRAR desabilitados.
- Chip de edição com `available === 0`: `disabled`, nunca selecionável.
- `quantity`: inteiro, mínimo 1, máximo `edition.available`; trocar de edição
  reseta para 1; botão − desabilitado em 1, + desabilitado no máximo.
- `onBuy`: `mutate({ nftId, editionId: selectedEditionId, quantity })`. O
  toast de sucesso só existe porque o handler respondeu 200 — nada de sucesso
  otimista. 409 `availability_conflict` (ex.: carrinho já contém unidades)
  mostra a mensagem da API.
- Preços com `big.js` (`mulQty` de `src/lib/money.ts`), nunca `number`:
  desktop mostra o **preço unitário da edição selecionada** (22px, bloco do
  título); a Buy Bar mobile mostra **`mulQty(priceEth, quantity)`** (o preço
  fica na mesma linha do stepper). Decisão registrada em ARCHITECTURE — o
  Figma só mostra números estáticos.

### Mapeamento visual — desktop (spec 04 §2, §3, OQ2/3/5)

Ritmo vertical (resolução OQ5): entre o fim do header (h 45) e o topo de
`Main` (y=77 do container `Top`) há uma faixa de **32px** onde vive o
**breadcrumb** de 145×16; o bloco Product começa a **28px** do topo de `Main`.
Implementar como: breadcrumb com 8px acima e 8px abaixo (8+16+8=32 —
distribuição interna não transcrita, provisória com `ponytail:`), Product com
`mt-[28px]`. O offset de 24px do container `Top` acima do header é margem do
frame, não aplicada (o shell compartilhado não a tem em rota nenhuma —
registrar em ARCHITECTURE).

- **Breadcrumb "Início / Mercado"** (145×16, achado da resolução OQ5):
  `<nav aria-label="Trilha de navegação">` com lista — "Início" é `<Link
  to="/">` (preserva `linkFocusRing`), separador "/", "Mercado" é o item
  atual: **texto, não link**, com `aria-current="page"`. Tipografia não
  transcrita além da caixa de 145×16 → 15px regular provisório, link em
  `text-text-secondary`, atual em `text-foreground`, com `ponytail:` e
  registro em ARCHITECTURE (extração fina pendente).
- **Bloco Product**: duas colunas na coluna de 1200, `gap-[32px]`, altura 448.
- **Coluna de imagens** (573, `gap-[28px]`): coluna de thumbnails de 100px com
  `gap-[16px]` — 4 botões 100×100 `rounded-[8px]` sobre placas
  `bg-surface-card` `rounded-[6px]`; o selecionado com borda 1px `primary` +
  `aria-current="true"`. Imagem principal 444×444 `bg-surface-card`
  `rounded-[6px]` `p-[16px]` com a arte 404×404 `rounded-[24px]`
  (`src = images[imageIndex]`, `alt = nft.title`).
- **Lupa** (resolução OQ2): botão circular 30×30 em `left-[530px] top-[15px]`
  sobre a imagem principal — `bg-surface-raised`, borda 1px `border-strong`,
  glifo de lupa (lucide `Search`/`ZoomIn`), `aria-label="Ampliar imagem"`.
  **Comportamento honesto**: abre um `Dialog` (primitivo já existente e
  exercitado) com a imagem corrente (`images[imageIndex]`) em tamanho maior,
  `rounded-[24px]`, `alt = nft.title`; Esc fecha, foco controlado pelo Radix.
  Nunca clicável-e-decorativo.
- **Coluna de detalhes** (`flex-1 justify-between`): título 28px bold
  (`text-heading-28`, `text-foreground`); preço 22px bold `leading-[16px]`
  `text-text-accent` (`text-title-22`); avaliação — `Math.floor(ratingAvg)`
  estrelas 15px preenchidas + vazias até 5 (lucide `Star`, preenchida via
  `fill="currentColor"`), `aria-hidden`, num container com
  `aria-label={`Avaliação: ${ratingAvg} de 5, ${ratingCount} avaliações`}`,
  seguido de `${ratingCount} avaliações de colecionadores` 15px; régua 1px de
  573; "Sobre este NFT:" 15px bold `leading-[16px]` + descrição 14px
  `leading-[24px]` `text-text-secondary` (#cfb28c) largura 574; "Edição:"
  15px bold + **chips-elipse** (ver abaixo) com `gap-[6px]`; stepper — botões
  33×49,5 `bg-primary` `rounded-[33px]` borda 1px `#140d0a`
  `drop-shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)]`, glifo +/− de **26,4px**
  (resolução OQ5; lucide `Plus`/`Minus` `size-[26.4px]`), número 20px
  `leading-[28px]` (`text-title-20`), `gap-[12px]`; COMPRAR 130×40
  `bg-primary` `rounded-[6px]` 14px bold `leading-[20px]` `text-ink`;
  Favoritar 130×40 borda 1px `primary` `rounded-[6px]` coração 20px + 14px
  medium `text-text-accent` `gap-[8px]`, **`disabled`** (fase 5 liga);
  metadados 15px `gap-[12px]` em `text-secondary` (#b39463 — o spec 04 diz
  "`secondary`", não "`text-secondary`"): `ID do token: #NNNN` (derivado do
  id: `nft-042` → `#0042`), `Coleção: {CATEGORY_LABELS[category]}`,
  `Atributos: {attributes.join(', ')}`; "Compartilhar este NFT:" 15px bold +
  3 links-ícone `gap-[8px]` (LinkedIn 15×14,4 · mensagem 18 · Twitter
  16×12,2) — comportamento honesto sem backend: `<a target="_blank"
  rel="noopener noreferrer">` para `linkedin.com/shareArticle?url=`,
  `mailto:?subject=…&body=` e `twitter.com/intent/tweet?url=`, com
  `aria-label` de cada rede; glifos genéricos do lucide v1 com `ponytail:`
  (mesmo precedente dos ícones sociais do footer, ARCHITECTURE fase 2 §3).

**Chips de edição** (resolução OQ3 — vale para desktop e mobile): altura 28,
**elipse inscrita na caixa**, i.e. `border-radius: 50%` — **não**
`rounded-full`, que num chip de 66×28 vira stadium (lados retos), outra forma.
Traço 1px, **sem preenchimento**: não selecionado em `border-strong`
(#3f2319), selecionado em `primary` (#d28a4c). Texto 14px: selecionado
`text-text-accent` medium, demais `text-text-secondary` regular. Largura por
conteúdo com padding horizontal para inscrever o texto na elipse (`px-4`
provisório, `ponytail:`). Semântica: **radios nativos** (`<input
type="radio" name="edition">` `sr-only` + `<label>` estilizado) — cobre o
`role="radio"`/`aria-checked` pedido pela resolução OQ3 com teclado de graça;
esgotada = `disabled` + sufixo acessível "(esgotada)" (sr-only) +
`opacity-50`.

**"Mais desta coleção"** (resolução OQ1, spec 04 §3): `Section Heading`
1200×28 com título **"Mais desta coleção"** e régua ao lado; `Frame 204`
1200×347 com **5 cards visíveis, `justify-between`**; cada card `flex-col
gap-[12px]`: placa **219×255 `bg-surface-card` sem raio**, arte **212×212
`rounded-[13px]` centralizada** `object-cover`, título 15px regular
`text-foreground`, preço 16px bold `leading-[16px]` `text-text-accent`.
**Padronização deliberada**: o Figma varia paddings e alterna raio 11/13 entre
os cards — não replicar; 219×255/212/13 é o valor de 4 dos 5 cards. Registrar
o desvio em ARCHITECTURE (o spec 04 §3 manda). Dados: itens da mesma
`category` via API, excluindo o NFT atual; cada card é `<Link>` para o
detalhe (padrão `nft-card.tsx`). Dots 52×12 centralizados, `gap-[32px]`
abaixo dos cards: paginam de 5 em 5; composição interna do grupo não
verificada no SVG → espelhar provisoriamente a composição verificada do hero
mobile (ativo = pill, inativos = círculos, tudo `primary`), com `ponytail:` e
registro em ARCHITECTURE; cada dot é `<button>` com `aria-label={`Página
${n}`}` e `aria-current` — o ativo muda de **forma**, não só de cor.

### Mapeamento visual — mobile (spec 04 §4, OQ3/4)

Container fluido (390–<1024), medidas do frame 414 aplicadas como transcritas,
larguras internas fluidas como no resto do app.

- **Hero**: fundo `linear-gradient(137.64deg,#241612 11.999%,#2f1d15 106.59%)`
  cobrindo 414×506; conteúdo `left-[28px] top-[23px]` largura 361 `flex-col
  gap-[8px]`; linha `justify-between` com botão voltar (35×35
  `bg-surface-raised` borda 1px `border-strong` `rounded-[17.5px]`, ícone
  20×20 `p-[8px]`, `aria-label="Voltar"`, `useCanGoBack()` ?
  `router.history.back()` : `navigate({ to: '/' })` — hook verificado no
  pacote instalado v1.170) e coração 16×14,2 centralizado, **`disabled`**
  (fase 5); arte h-356 `rounded-[24px]` `object-cover`
  (`src = images[imageIndex]`, `alt = nft.title`).
- **Pontos do carrossel** (resolução OQ4) sob a arte (grupo 56×7 centrado):
  **funcionais**, um botão por imagem da galeria (4) — o **ativo é um pill de
  28×7 (`rx 3.5`)**, os inativos são **círculos de 7px (`r=3.5`)**, todos em
  `primary`, gaps de 7. O estado muda de **forma**, o que já satisfaz o §8
  sozinho; ainda assim cada botão leva `aria-label={`Imagem ${n} de 4`}` e
  `aria-current` no ativo. Área de toque ≥24px via padding transparente
  (visual permanece 7px). **Não** copiar esta composição para os heroes do
  catálogo — lá os SVGs não foram verificados (aviso da resolução OQ4).
- **Details Sheet**: sobrepõe o hero a partir de y=392 → `-mt-[114px]`
  relativo (506−392), `bg-surface-card` `rounded-t-[31px]` `pt-[32px]
  pb-[24px] px-[24px]` `flex-col gap-[12px]`; título 20px bold
  `leading-[16px]` (`text-title-20`); pill de avaliação 80,16×27 borda 1px
  `primary` `rounded-[32px]` — estrela 14px, `{ratingAvg}` 14px medium
  `text-foreground`, `({ratingCount})` 14px `text-text-secondary`, mesmo
  `aria-label` composto do desktop; descrição 14px `leading-[24px]`
  `text-text-secondary` com **`line-clamp-3`** (altura 71 do frame ≈ 3 linhas
  de 24px — é a mesma descrição da API, clampada; a copy mobile mais curta do
  Figma é o clamp, não outro dado); "Edição:" 15px bold, gap 8 até os chips,
  chips-elipse (OQ3) com **`gap-[12px]`** (não 6); Token Info = os 3
  metadados do desktop, 15px `gap-[12px]` em `text-secondary` (#b39463).
  Padding-bottom extra para o conteúdo não morrer sob a Buy Bar fixa (164px).
- **Buy Bar**: `fixed bottom-0 inset-x-0` (o `<main>` compensa com
  `pb-[164px]`, ver `__root.tsx`), `bg-surface-card` `rounded-t-[40px]`
  `pt-[20px] pb-[36px] px-[24px]` `drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]`,
  `flex-col gap-[20px]`; linha 1 `justify-between`: "Qtd." 15px medium
  `text-text-secondary` `gap-[8px]`, stepper `gap-[12px]` com botões 20×30
  `bg-primary` borda 1px `#140d0a` `rounded-[20px]`
  `drop-shadow-[0_4px_6px_rgba(20,13,10,0.15)]` ícone 16px, número 18px
  medium `leading-[25px]`, preço 20px bold `leading-[16px]`
  `text-text-accent` (= `mulQty`); linha 2 `gap-[12px]`: "Comprar NFT"
  196×60 `rounded-[40px]` `pl-[48px] pr-[44px] py-[20px]` fundo
  `linear-gradient(100.37deg,#d28a4c 3.96%,rgba(210,138,76,0.8) 121.97%)`
  texto 16px bold `leading-[20px]` `text-ink`; botão de carrinho 60×60
  `bg-surface-raised` borda 1px `border-strong` `rounded-[40px]` ícone 20px
  `p-[20px]`, **`disabled`** com `aria-label="Carrinho"` (a rota /cart é
  fase 6 — link para lugar nenhum aparentaria navegação funcional).

### Estados não desenhados (CHALLENGE §1: seguem o padrão visual)

- **Skeleton** (carregando): shimmer preservando as dimensões — desktop:
  placas 100×100 ×4 + 444×444 + linhas de texto na coluna de detalhes;
  mobile: bloco 356 + sheet com linhas. Mesmo padrão de `catalog-grid.tsx`
  (`SkeletonDesktopCard`/`SkeletonMobileCard`); `prefers-reduced-motion` já é
  global.
- **404** (API respondeu `not_found`): mesmo padrão do `NotFound` do
  `__root.tsx` — título "NFT não encontrado", texto curto, link "Voltar ao
  início" (`linkFocusRing`). Renderizado dentro da rota, sem redirect.
- **Erro transitório** (5xx/rede): mensagem + botão "Tentar novamente" que
  chama `refetch()` — mesmo padrão do estado de erro do `catalog-grid.tsx`.
- **Esgotado** (nft-013): chips todos `disabled` com "(esgotada)" acessível,
  stepper e COMPRAR/"Comprar NFT" `disabled`, e texto de status "Esgotado"
  15px `text-text-secondary` junto ao CTA, com `role="status"`.

### Semântica e teclado

- Chips: radios nativos (ver acima) — seleção única com teclado de graça.
- Thumbnails/pontos da galeria e dots do carrossel: `<button>` com
  `aria-label` e `aria-current`; selecionado nunca só por cor (borda no
  desktop, forma no mobile).
- Stepper: botões `aria-label="Diminuir quantidade"`/"Aumentar quantidade";
  o número num elemento com `aria-live="polite"` (`Quantidade: N` via
  `aria-label` ou texto sr-only).
- Lupa → Dialog: foco preso e devolvido pelo Radix; Esc fecha.
- Toasts do sonner (Toaster já montado no `__root`) para sucesso/erro da
  mutation — feedback acessível de mutation, padrão já aceito.
- Foco visível em tudo (`linkFocusRing` / `focus-visible` dos primitivos).

## Acceptance criteria

1. `page.goto('/nft/nft-001')` (acesso direto, sem navegar antes) renderiza o
   título do NFT vindo da API (`Solar Drift`) nas composições desktop (1440) e
   mobile (390); refresh mantém a tela.
2. `page.goto('/nft/nft-999')` mostra "NFT não encontrado" com link "Voltar ao
   início" que navega para `/`; nenhum skeleton fica preso; nenhum erro de
   console não filtrado.
3. Em `/nft/nft-013` (todas as edições `available: 0`): todo chip de edição
   está `disabled`, o botão COMPRAR (desktop) e "Comprar NFT" (mobile) estão
   `disabled`, os botões do stepper estão `disabled`, e um texto "Esgotado"
   com `role="status"` está visível.
4. Em `/nft/nft-007` (`available: 2`): o botão + incrementa até 2 e então fica
   `disabled`; o número exibido nunca passa de 2 nem cai abaixo de 1 (− fica
   `disabled` em 1).
5. Em `/nft/nft-021` (`available: 1`): + já nasce `disabled`.
6. Em `/nft/nft-004` (Standard + Deluxe): os 2 chips vêm da API; selecionar
   "Deluxe" atualiza o preço desktop para o `priceEth` da Deluxe e reseta a
   quantidade para 1; os rótulos exibidos são os `label`s da API, não texto
   hardcoded.
7. Clicar COMPRAR dispara exatamente um `POST /api/cart/items` com
   `{ nftId, editionId, quantity }` correntes; o toast "Adicionado ao
   carrinho" só aparece **depois** da resposta 200, e um `GET /api/cart`
   subsequente contém o item com a quantidade comprada (resultado honesto).
8. Com quantidade acima do disponível acumulado (comprar 2× em `nft-021`): o
   segundo POST responde 409 e a UI mostra toast de erro com a mensagem da
   API — nenhum toast de sucesso.
9. Cenário de falha do MSW (`http-500` ou equivalente do motor de cenários)
   no detalhe: estado de erro com "Tentar novamente"; restaurar o cenário e
   tentar de novo recupera a tela (CHALLENGE §9.12).
10. Galeria desktop: 4 thumbnails; clicar a thumbnail N troca o `src` da
    imagem principal para `images[N]`; a selecionada tem `aria-current="true"`
    e borda `primary`; as thumbnails são alcançáveis e acionáveis por teclado
    (Tab + Enter/Space) com foco visível.
11. Galeria mobile: os 4 pontos sob a arte trocam a imagem do hero; o ativo é
    o pill 28×7 e expõe `aria-current`; os inativos são círculos de 7px.
12. Lupa desktop: clicar abre um Dialog com a imagem corrente ampliada
    (`src === images[imageIndex]`); Esc fecha e o foco volta ao botão da
    lupa; nunca é clicável sem efeito.
13. Breadcrumb desktop em `/nft/*`: `<nav>` com "Início" como link real para
    `/` e "Mercado" como item atual com `aria-current="page"` que **não** é
    link.
14. Favoritar desktop (130×40) e o coração do hero mobile estão `disabled` e
    **nenhum request** é disparado ao cliká-los (interceptação Playwright
    comprova zero chamadas).
15. Header desktop em `/nft/nft-001`: "Mercado" tem `aria-current="page"` e
    "Início" **não** tem; o header renderiza **sem** a régua (`border-b`)
    nas rotas `/nft/*` e **com** régua em `/`; numa rota 404 nenhum item de
    nav fica ativo.
16. Em viewport mobile (390) na rota de detalhe: `MobileSearchBar` e `TabBar`
    não estão no DOM; a Buy Bar está fixa no fundo; em `/` ambas continuam
    presentes. Sem overflow horizontal em 390, 768 e 1440 no detalhe.
17. `src/index.css` contém os 5 tokens novos com os valores exatos do spec 04
    §1; o título desktop usa 28px, o mobile 20px, o preço desktop 22px
    (computed style confere).
18. Chips de edição: computed style com `border-radius: 50%` (elipse, não
    stadium), traço 1px `#d28a4c` no selecionado e `#3f2319` nos demais, sem
    background; semântica de radio (`role`/`checked` conferíveis).
19. "Mais desta coleção" (desktop): 5 cards visíveis da mesma `category`,
    sem incluir o NFT corrente; placa 219×255 sem raio, arte com
    `border-radius` 13px; clicar um card navega para `/nft/<id>` dele; os
    dots paginam e o ativo se distingue por forma + `aria-current`.
20. Skeleton do detalhe aparece sob cenário de latência e preserva dimensões
    (mesma técnica de asserção do catálogo — sem layout shift do bloco
    principal).
21. Contrato: `GET /api/nfts/nft-001` responde `images` com 4 itens
    (`images[0] === imageUrl`), `ratingAvg` string com 1 decimal,
    `ratingCount` number, `attributes` com 3 strings PT; `seedVersion` é 4.
22. E2E consolidado: `e2e/` contém `api-contracts.spec.ts`,
    `runtime-behavior.spec.ts`, `catalog.spec.ts`, `nft-detail.spec.ts` e
    `helpers.ts` — `catalog-tester.spec.ts` e `catalog-e2e-tester.spec.ts`
    não existem mais e **nenhum teste foi perdido na fusão** (os 326 seguem
    verdes, apenas realocados/ajustados onde a fixture mudou, precedente
    ARCHITECTURE fase 3 item 14).
23. O flake do preâmbulo de Tabs (ex-`catalog.spec.ts:387-391`) agora assere o
    foco após **cada** Tab, não só no fim.
24. `pnpm build`, `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Edge cases to cover

- Acesso direto e refresh em `/nft/<id>` (SPA fallback já coberto pelo dev
  server; o teste usa `goto` direto).
- `nft-999` / id malformado → 404 tratado (o handler responde 404 para
  qualquer id desconhecido).
- Todas as edições esgotadas (nft-013) vs uma edição com estoque baixo
  (nft-007: 2, nft-021: 1) vs duas edições (nft-004).
- Troca de edição com quantidade alta selecionada → reset para 1 (nunca
  quantidade > available da nova edição).
- 409 `availability_conflict` quando o carrinho de guest já contém unidades da
  mesma edição.
- Duplo clique rápido em COMPRAR: botão `disabled` enquanto `isBuying` — no
  máximo um POST por clique intencional.
- Cenário `slow`/latência: skeleton; cenário de erro: retry recupera.
- Related com menos de 5 itens na categoria (após excluir o atual): renderiza
  os que existem, sem dots se couber numa página; related não pode quebrar no
  cenário `empty`.
- Voltar (mobile): com histórico → volta preservando a URL do catálogo
  (filtros intactos); acesso direto (sem histórico) → vai para `/`.
- Teclado de ponta a ponta no fluxo de compra desktop: Tab até chips →
  seleção por setas/Espaço → stepper → COMPRAR por Enter.
- Dialog da lupa: `scrollY` lido com dialog Radix aberto é 0 por construção —
  medir depois de fechar (CLAUDE.md §Verificação).
- `prefers-reduced-motion`: já global; nenhum shimmer/transição nova pode
  contornar o media query.
- Zero regressão nos cenários existentes do catálogo (fusão E2E é
  movimentação, não reescrita).

## Existing pattern to follow

- **Rota + query + estados**: `src/routes/index.tsx` (useQuery com
  `scope = session.data?.user.id ?? 'guest'`, `enabled: !session.isPending`)
  e `src/features/nft/components/catalog-grid.tsx` (skeleton/vazio/erro
  inline). Query keys `['nfts', scope, ...]` como em
  `src/features/nft/queries.ts`.
- **Duas composições no DOM com `hidden lg:*` / `lg:hidden`**: catalog-grid,
  hero, header/tab-bar — mesmo padrão para
  `NftDetailDesktop`/`NftDetailMobile`.
- **Medidas do frame aplicadas fluidas**: comentário-modelo em
  `src/features/nft/components/nft-card.tsx` (a relação, não o pixel travado).
- **Dinheiro**: `src/lib/money.ts` (`eth`, `mulQty`) — nunca `number`.
- **REST**: só via `src/lib/api.ts`; a mutation segue o shape do handler
  `src/mocks/handlers/cart.ts` (`POST /api/cart/items`, 409
  `availability_conflict` com `details.available`).
- **Dialog**: primitivo `src/components/ui/dialog.tsx`, já adaptado e
  exercitado.
- **Placeholders de glifo/medida fina**: comentário `ponytail:` + registro em
  ARCHITECTURE, como no FAB da tab bar e nos ícones sociais do footer.
- **Toasts**: `Toaster` já montado em `__root.tsx`; usar `toast` do `sonner`.
- **E2E**: `e2e/helpers.ts` (`boot`, `awaitMswReady`, `setScenario`);
  disciplina de verificação do CLAUDE.md §"Verificação" (checar
  visível/clicável antes de afirmar defeito; `getByRole` específico;
  matar preview antes de rodar).

## Registro em ARCHITECTURE.md (seção "Fase 4")

1. Favoritar desabilitado nesta fase — favoritos exigem sessão (fase 5); a
   atualização otimista com rollback (§4) entra lá, junto dos favoritos reais.
2. `ratingAvg`/`ratingCount`/`attributes` entram em `NftDetail` (mesmo
   racional da resolução `network`): o design exibe avaliação e atributos e o
   modelo não tinha o dado. `SEED_VERSION` 3→4; `images` 3→4.
3. "Coleção" nos metadados = rótulo PT da `category` (o produto chama
   categorias de "Coleções" no filtro e no footer; "Kurio Apes" é conteúdo de
   exemplo do Figma).
4. Preço no detalhe: desktop = unitário da edição selecionada; Buy Bar mobile
   = unitário × quantidade (big.js). O Figma só mostra números estáticos.
5. Pontos do hero mobile do detalhe são **funcionais** (4 imagens reais na
   galeria), ao contrário dos decorativos do catálogo (decisão 7 da fase 3);
   composição pill-ativo + círculos verificada no SVG — não extrapolada para
   os heroes do catálogo.
6. Em `/nft/*` mobile não há MobileSearchBar nem TabBar (frame `15:5536`); a
   Buy Bar ocupa o fundo. Header desktop de telas de mercado sem divisor
   (doc do componente, spec 02 §2).
7. Compartilhar = links reais de share (LinkedIn/mailto/Twitter intent) em
   nova aba — comportamento coerente sem aparentar recurso inexistente.
   Glifos lucide genéricos provisórios (lucide v1 sem ícones de marca).
8. Descrição mobile = mesma descrição da API com `line-clamp-3` (71px ≈ 3
   linhas de 24px no frame).
9. Estado "esgotado" e demais estados não desenhados seguem o padrão visual
   (CHALLENGE §1).
10. Carrossel "Mais desta coleção" **padronizado deliberadamente** (placa
    219×255, arte 212×212 `rounded-[13px]`): o Figma varia paddings e alterna
    raio 11/13 entre os 5 cards — inconsistência do arquivo, não intenção de
    design (spec 04 §3 manda registrar).
11. Lupa da imagem principal = Dialog com a imagem ampliada — comportamento
    honesto para um affordance de zoom desenhado sem estado aberto no Figma.
12. Provisórios com `ponytail:` (extração fina pendente): tipografia e
    distribuição vertical do breadcrumb (só a caixa 145×16 foi extraída);
    padding horizontal dos chips-elipse; composição interna dos dots do
    carrossel desktop (52×12 — espelha a composição verificada do hero mobile
    até extração). O offset de 24px do container `Top` acima do header não é
    aplicado (margem do frame; o shell compartilhado não a tem em nenhuma
    rota).
13. Dívida 3 (footer `aria-current` por match parcial): aceita como decisão
    consciente; dívida 5: cross-ref do zoom adicionada à decisão 2 da fase 2
    — ambas só se ainda não constarem (o usuário já corrigiu as entradas
    obsoletas 6 e 9).

## Prototype / design reference

Sem acesso ao Figma neste pipeline. Referência única:
`specs/04-detalhe-nft.md` (236 linhas — medidas, cores, copy e a seção
"Resolução das Open Questions" com os valores extraídos dos SVGs; desktop
`10:244`, mobile `15:5536`), complementada por `specs/02-design-system.md` e
`specs/03-catalogo.md`. O modo frontend do E2E valida estilo contra os
valores transcritos (ex.: título 28px bold, chips `border-radius: 50%` com
traço `#d28a4c`/`#3f2319`, Buy Bar `rounded-t-[40px]`, pill ativo 28×7 dos
pontos mobile, placa 219×255 do carrossel, gradiente do hero
`137.64deg #241612→#2f1d15`).

## Out of scope

- **Favoritos funcionais** e atualização otimista com rollback — fase 5 (os
  botões existem, desabilitados, posicionados por design).
- **Tela de carrinho** e badge de contagem no header/TabBar — fase 6 (o botão
  de carrinho da Buy Bar e o do header seguem `disabled`).
- **Autenticação/sessão** — fase 5 (o `scope` guest já isola o cache).
- **Checkout, pedidos, tempo real** — fases 7 e 9.
- **Baselines de regressão visual** — fase 10.
- Dívidas **adiadas com justificativa**: 8 (`card.tsx` `rounded-xl`) e 10
  (variantes do badge) — nenhum consumidor desta fase aciona os primitivos
  Card/Badge no detalhe, mesmo critério das fases anteriores; 11 (botão de
  filtro mobile não-fixo) — fiel ao Figma, observação de UX, não dívida
  técnica. As dívidas 6 (header) e 9 (slider) **não são trabalho desta
  fase** — já estavam fechadas pela fase 3 e o usuário já corrigiu as
  entradas obsoletas no ARCHITECTURE.md; aqui só se cobre o comportamento com
  o teste do critério 15.
- Replicar a composição pill+círculos nos pontos dos heroes do catálogo —
  aqueles SVGs não foram verificados (aviso explícito da resolução OQ4).
- Nenhuma dependência nova; nenhuma lib de carrossel (paginação por dots
  próprios).
- Seção editorial/promocional: continua fora (decisão 13 da fase 3).
