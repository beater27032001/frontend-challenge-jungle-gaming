# Spec: Fase 4 — Detalhes do NFT

> Fonte de verdade visual: `specs/04-detalhe-nft.md` (complementada por
> `specs/02-design-system.md` e `specs/03-catalogo.md`). Ninguém neste pipeline
> tem acesso ao Figma — **nenhuma medida, cor ou copy pode ser inventada**. Tudo
> que falta está em Open Questions. Ler também CLAUDE.md §"Verificação — o
> instrumento erra mais que o código" antes de testar qualquer coisa.

## Open Questions

Todas são pedidos de extração do Figma (desktop `10:244`, mobile `15:5536`) —
nenhuma é decisão de produto. Sem elas as partes marcadas `[OQ-n]` abaixo não
podem ser implementadas com fidelidade.

1. **Cards do carrossel "Mais desta coleção"** (desktop, `Frame 204`,
   1200×347): largura/altura do card, tamanho e raio da arte, tipografia de
   título e preço, gaps internos, passo horizontal, quantos cards visíveis por
   página; e o grupo `Carousel Dots` (52×12): quantos pontos, diâmetro e gap.
   Confirmar também a copy exata do `Section Heading` (assumo "Mais desta
   coleção" até prova em contrário).
2. **Ícone de 30×30 sobreposto em `left-[530px] top-[15px]`** da coluna de
   imagens desktop: qual é o glifo e qual a função (zoom? favorito?
   compartilhar?). Sem saber a função, não dá para dar comportamento honesto.
3. **Chips de edição** (desktop §2 e mobile §4.2): a transcrição dá altura 28,
   larguras, gaps e tipografia, mas **não diz se o chip tem borda, fundo ou
   raio** de container, nem padding. É texto puro ou é uma "pílula"?
4. **Pontos do carrossel do hero mobile** (grupo 56×7 em `left-[179px]
   top-[365px]`): quantos pontos, diâmetro de cada um e gap. (Os grupos
   análogos do catálogo eram 3×8px/gap 8 e 3×7px/gap 6; 56×7 não fecha com
   nenhuma combinação inteira óbvia — preciso do valor real.)
5. **Ritmo vertical e stepper desktop**: (a) distância do header ao topo do
   bloco Product no frame 1440; (b) gap entre o bloco Product e o `Section
   Heading` de "Mais desta coleção"; (c) gap entre `Frame 204`/dots e o
   footer; (d) tamanho do glifo +/− dentro dos botões 33×49,5 do stepper
   desktop (o mobile transcreve "ícone 16px", o desktop não).

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
prop morta, flake de Tab, entradas obsoletas da lista de dívidas) e deixa
pronto para a fase 5: botões de favorito posicionados por design, `scope` nas
query keys do detalhe e carrinho de guest que o handler já mescla no login.

## Files to create / modify

**Criar:**

- `src/features/nft/components/nft-detail-desktop.tsx` — composição desktop
  completa (bloco Product: galeria + coluna de detalhes), `hidden lg:flex`.
- `src/features/nft/components/nft-detail-mobile.tsx` — composição mobile
  (Hero + Details Sheet + Buy Bar), `lg:hidden`.
- `src/features/nft/components/related-carousel.tsx` — "Mais desta coleção",
  desktop-only (o frame mobile não tem a seção). Estrutura e dados agora;
  medidas internas dependem de `[OQ-1]`.
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
  ARCHITECTURE.md" abaixo, mais a manutenção da lista de dívidas: itens 6
  (header) e 9 (slider `bg-white`) da lista "Dívidas para a fase 4" estão
  **obsoletos** — ambos já foram fechados na fase 3 (o próprio arquivo diz
  isso no item 11 da seção Fase 3; `header.tsx:17-21` e `slider.tsx` conferem
  no código). Corrigir a lista, adicionar a cross-ref do zoom (dívida 5) na
  decisão 2 da fase 2, e registrar a aceitação do `aria-current` do footer
  (dívida 3) como decisão consciente.

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

### Mapeamento visual — desktop (spec 04 §2, tudo transcrito)

Bloco Product na coluna de 1200: duas colunas, `gap-[32px]`, altura 448.
Posição vertical na página: `[OQ-5]`.

- Coluna de imagens (573, `gap-[28px]`): coluna de thumbnails de 100px com
  `gap-[16px]` — 4 botões 100×100 `rounded-[8px]` sobre placas
  `bg-surface-card` `rounded-[6px]`; o selecionado com borda 1px `primary` +
  `aria-current="true"`. Imagem principal 444×444 `bg-surface-card`
  `rounded-[6px]` `p-[16px]` com a arte 404×404 `rounded-[24px]`
  (`src = images[imageIndex]`, `alt = nft.title`). Ícone 30×30 sobreposto:
  `[OQ-2]`.
- Coluna de detalhes (`flex-1 justify-between`): título 28px bold
  (`text-heading-28`, `text-foreground`); preço 22px bold `leading-[16px]`
  `text-text-accent` (`text-title-22`); avaliação — `Math.floor(ratingAvg)`
  estrelas 15px preenchidas + vazias até 5 (lucide `Star`, preenchida via
  `fill="currentColor"`), `aria-hidden`, num container com
  `aria-label={`Avaliação: ${ratingAvg} de 5, ${ratingCount} avaliações`}`,
  seguido do texto `${ratingCount} avaliações de colecionadores` 15px;
  régua 1px de 573; "Sobre este NFT:" 15px bold `leading-[16px]` + descrição
  14px `leading-[24px]` `text-text-secondary` (#cfb28c) largura 574;
  "Edição:" 15px bold + chips (altura 28, `gap-[6px]`, largura por conteúdo,
  selecionado `text-text-accent` medium, demais `text-secondary`-#cfb28c…
  **atenção**: no vocabulário dos specs, "`text-secondary`" = token
  `--color-text-secondary` #cfb28c = classe `text-text-secondary`; container
  do chip: `[OQ-3]`); stepper — botões 33×49,5 `bg-primary` `rounded-[33px]`
  borda 1px `#140d0a` `drop-shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)]`,
  número 20px `leading-[28px]` (`text-title-20`), `gap-[12px]`, glifo
  `[OQ-5d]`; COMPRAR 130×40 `bg-primary` `rounded-[6px]` 14px bold
  `leading-[20px]` `text-ink`; Favoritar 130×40 borda 1px `primary`
  `rounded-[6px]` coração 20px + 14px medium `text-text-accent` `gap-[8px]`,
  **`disabled`** (fase 5 liga); metadados 15px `gap-[12px]` em
  `text-secondary` (#b39463 — o spec 04 diz "`secondary`", não
  "`text-secondary`"): `ID do token: #NNNN` (derivado do id: `nft-042` →
  `#0042`), `Coleção: {CATEGORY_LABELS[category]}`,
  `Atributos: {attributes.join(', ')}`; "Compartilhar este NFT:" 15px bold +
  3 links-ícone `gap-[8px]` (LinkedIn 15×14,4 · mensagem 18 · Twitter
  16×12,2) — comportamento honesto sem backend: `<a target="_blank"
  rel="noopener noreferrer">` para `linkedin.com/shareArticle?url=`,
  `mailto:?subject=…&body=` e `twitter.com/intent/tweet?url=`, com
  `aria-label` de cada rede; glifos genéricos do lucide v1 com `ponytail:`
  (mesmo precedente dos ícones sociais do footer, ARCHITECTURE fase 2 §3).

### Mapeamento visual — mobile (spec 04 §4, três camadas)

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
  (`src = images[imageIndex]`, `alt = nft.title`); pontos do carrossel sob a
  arte (`[OQ-4]`) — **funcionais**: um botão por imagem da galeria,
  `aria-label={`Imagem ${n} de 4`}`, `aria-current` no ativo (diferente dos
  pontos decorativos do catálogo: aqui existem 4 imagens reais).
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
  chips com **`gap-[12px]`** (não 6); Token Info = os 3 metadados do desktop,
  15px `gap-[12px]` em `text-secondary` (#b39463). Padding-bottom extra para
  o conteúdo não morrer sob a Buy Bar fixa (164px).
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
- **Esgotado** (nft-013): chips todos `disabled` com sufixo acessível
  "(esgotada)" (`sr-only` ou visível — ver `[OQ-3]` para o visual do chip),
  stepper e COMPRAR/"Comprar NFT" `disabled`, e texto de status "Esgotado"
  15px `text-text-secondary` junto ao CTA, com `role="status"`.

### Semântica e teclado

- Chips de edição: **radios nativos** (`<input type="radio" name="edition">`
  `sr-only` + `<label>` estilizado) — seleção única com teclado de graça;
  esgotada = `disabled`. Estado selecionado nunca só por cor: peso medium
  (transcrito) + o próprio `:checked` exposto por `aria`/foco + indicação de
  `[OQ-3]` se houver.
- Thumbnails/pontos da galeria: `<button>` com `aria-label` e
  `aria-current`; selecionado = borda `primary` (presença de borda, não só
  cor) no desktop.
- Stepper: botões `aria-label="Diminuir quantidade"`/"Aumentar quantidade";
  o número num elemento com `aria-live="polite"` (`Quantidade: N` via
  `aria-label` ou texto sr-only).
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
11. Galeria mobile: os pontos sob a arte trocam a imagem do hero e expõem
    `aria-current`; um botão por imagem (4).
12. Favoritar desktop (130×40) e o coração do hero mobile estão `disabled` e
    **nenhum request** é disparado ao cliká-los (interceptação Playwright
    comprova zero chamadas).
13. Header desktop em `/nft/nft-001`: "Mercado" tem `aria-current="page"` e
    "Início" **não** tem; o header renderiza **sem** a régua (`border-b`)
    nas rotas `/nft/*` e **com** régua em `/`; numa rota 404 nenhum item de
    nav fica ativo.
14. Em viewport mobile (390) na rota de detalhe: `MobileSearchBar` e `TabBar`
    não estão no DOM; a Buy Bar está fixa no fundo; em `/` ambas continuam
    presentes. Sem overflow horizontal em 390, 768 e 1440 no detalhe.
15. `src/index.css` contém os 5 tokens novos com os valores exatos do spec 04
    §1; o título desktop usa 28px, o mobile 20px, o preço desktop 22px
    (computed style confere).
16. "Mais desta coleção" (desktop) lista apenas NFTs da mesma `category` do
    NFT corrente, sem incluir o próprio; clicar um card navega para o detalhe
    dele (URL muda para `/nft/<id>`). *(Medidas visuais: após resolução de
    `[OQ-1]`.)*
17. Skeleton do detalhe aparece sob cenário de latência e preserva dimensões
    (mesma técnica de asserção do catálogo — sem layout shift do bloco
    principal).
18. Contrato: `GET /api/nfts/nft-001` responde `images` com 4 itens
    (`images[0] === imageUrl`), `ratingAvg` string com 1 decimal,
    `ratingCount` number, `attributes` com 3 strings PT; `seedVersion` é 4.
19. E2E consolidado: `e2e/` contém `api-contracts.spec.ts`,
    `runtime-behavior.spec.ts`, `catalog.spec.ts`, `nft-detail.spec.ts` e
    `helpers.ts` — `catalog-tester.spec.ts` e `catalog-e2e-tester.spec.ts`
    não existem mais e **nenhum teste foi perdido na fusão** (os 326 seguem
    verdes, apenas realocados/ajustados onde a fixture mudou, precedente
    ARCHITECTURE fase 3 item 14).
20. O flake do preâmbulo de Tabs (ex-`catalog.spec.ts:387-391`) agora assere o
    foco após **cada** Tab, não só no fim.
21. `pnpm build`, `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

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
- Voltar (mobile): com histórico → volta preservando a URL do catálogo
  (filtros intactos); acesso direto (sem histórico) → vai para `/`.
- Teclado de ponta a ponta no fluxo de compra desktop: Tab até chips →
  seleção por setas/Espaço → stepper → COMPRAR por Enter.
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
- **Placeholders de glifo**: comentário `ponytail:` + registro em
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
   galeria), ao contrário dos decorativos do catálogo (decisão 7 da fase 3).
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
10. Manutenção da lista de dívidas: 6 e 9 já estavam fechadas pela fase 3
    (entradas obsoletas corrigidas); dívida 3 (footer `aria-current` por match
    parcial) aceita e registrada; dívida 5 (cross-ref do zoom) adicionada.

## Prototype / design reference

Sem acesso ao Figma neste pipeline. Referência única:
`specs/04-detalhe-nft.md` (medidas, cores, copy — desktop `10:244`, mobile
`15:5536`), complementada por `specs/02-design-system.md` (header/footer,
primitivos, tokens) e `specs/03-catalogo.md` (cards, labels). O modo frontend
do E2E valida estilo contra os valores transcritos nesses arquivos (ex.:
título 28px bold, Buy Bar `rounded-t-[40px]`, stepper mobile 20×30, gradiente
do hero `137.64deg #241612→#2f1d15`).

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
  técnica. **Atenção**: as dívidas 6 (header) e 9 (slider) da lista "para a
  fase 4" NÃO são trabalho desta fase — já foram fechadas na fase 3
  (conferido no código: `header.tsx:17-21` usa igualdade exata + prefixo
  `/nft`; `slider.tsx` já usa `primary`/`border-soft`); aqui só se corrige o
  registro obsoleto e se cobre o comportamento com o teste do critério 13.
- Nenhuma dependência nova; nenhum carrossel-lib (o related pagina com
  botões/dots próprios após `[OQ-1]`).
- Seção editorial/promocional: continua fora (decisão 13 da fase 3).
