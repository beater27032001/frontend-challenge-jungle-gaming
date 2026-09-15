# Spec: Fase 3 — Início / catálogo

> Fontes de verdade visual: `specs/03-catalogo.md` (incl. a seção "Resolução das
> Open Questions do Planner", que fecha as 6 OQs da primeira versão deste spec)
> e `specs/02-design-system.md`. O pipeline NÃO tem acesso ao MCP do Figma.
> Nenhuma medida/cor/copy abaixo foi inventada; onde a extração não cobre, a
> resolução das OQs registrou a decisão, e o resto é placeholder provisório com
> comentário `ponytail:` + entrada em `ARCHITECTURE.md` (precedente da fase 2,
> decisão 3).

## Open Questions

None.

## Goal

Substituir a tela de smoke pela tela Início real: hero (desktop e mobile),
sidebar (filtros + banner de destaque), toolbar (abas + ordenação), grid do
catálogo (desktop 3 colunas / mobile masonry com card próprio), paginação —
com **todo o estado de busca/filtro/ordenação/página na URL** via
`validateSearch`, dados reais via TanStack Query + Axios, estados de
skeleton/vazio/erro/atualização em segundo plano, o campo `network` adicionado
ao modelo de NFT (resolução da OQ 3: a seção "Rede" do painel não tinha dado
para filtrar), e quitação das duas dívidas obrigatórias da fase 2 (zoom 200% e
cobertura dos cenários `empty` e `out-of-order`).

## Mudança de contrato: `network` entra no NFT (resolução OQ 3)

O painel de filtros do design tem três seções transcritas (02 §3 + resolução):
**"Coleções"** (9 categorias), **"Faixa de preço"** e **"Rede"** (Ethereum,
Polygon, Solana). `network` não existia em `NftSummary`/`NftDetail` — renderizar
a seção sem filtrar violaria "ações fora do escopo não devem aparentar sucesso
funcional". Mesmo movimento da fase 2 com as 9 categorias:

- `src/types/nft.ts` — `network: Network` em `NftSummary` (herda em
  `NftDetail`); `network?: Network` em `NftListParams`. `Network`/`NETWORKS`
  já existem em `src/types/wallet.ts` — importar, não redeclarar.
- `src/mocks/fixtures.ts` — em `buildNft`:
  ```ts
  // Decorrelacionado da categoria (i % 9): dentro de cada bloco de 9 o ciclo
  // de rede desloca 1, então todo par categoria×rede existe (mesmo racional
  // do RARITY_OFFSET). 48 itens → exatamente 16 por rede.
  network: NETWORKS[(i + Math.floor(i / 9)) % 3],
  ```
  `SEED_VERSION` sobe de 2 para **3**.
- `src/mocks/handlers/nfts.ts` — `network: z.enum(NETWORKS).optional()` no
  `listParamsSchema`; cláusula `if (params.network && nft.network !==
  params.network) return false` no filtro; **e `network` na lista de campos
  destructurados de `toSummary`** (sem isso a lista omite o campo em silêncio).
- Sem mudança na cotação/carrinho: o `network` do quote é a rede de pagamento
  escolhida pelo usuário, conceito distinto do `network` do NFT — os dois
  coexistem.

**Mapa de impacto nos 216 testes existentes** (verificado por grep — nenhum
teste faz igualdade estrita do shape completo de NFT):

- `api-contracts.spec.ts:58` — compara duas respostas idênticas entre si
  (determinismo), não contra um literal: continua verde com o campo novo.
- Contagens asseridas: `total=48` (l.41), `art∩epic = {nft-001, nft-037}`
  (l.62-67), `art∩rare = nft-028` (l.81-84), `generative = 5` (l.93-95),
  `images` de nft-001 (l.136) — nenhuma depende de rede nem muda com um campo
  aditivo. A fórmula de distribuição não altera nenhum campo existente.
- O bump de `SEED_VERSION` só força reseed de localStorage antigo; os testes
  já partem de `bootReset`/`reset`. Nenhum teste assere `seedVersion`.
- Conclusão: **zero ajuste esperado nos 216 por causa do `network`**. Se o
  Tester encontrar um vermelho aqui, é bug de implementação, não de fixture.

## Files to create / modify

**Criar**
- `src/features/nft/search-params.ts` — schema zod dos search params + conversão para `NftListParams`.
- `src/features/nft/labels.ts` — `CATEGORY_LABELS`, `NETWORK_LABELS`, `SORT_LABELS`, `RARITY_BADGES`.
- `src/features/nft/queries.ts` — `queryOptions` do catálogo (lista, destaque, facetas) com query keys por usuário.
- `src/features/auth/use-session.ts` — hook `useSession` (GET `/auth/session`, 401 → `null`).
- `src/features/nft/components/hero.tsx` — `HeroDesktop` + `HeroMobile` (composições distintas, ambas transcritas).
- `src/features/nft/components/featured-banner.tsx` — banner "NFT EM DESTAQUE" da sidebar.
- `src/features/nft/components/filter-panel.tsx` — painel de filtros (sidebar desktop; dentro do `Sheet` no mobile).
- `src/features/nft/components/catalog-toolbar.tsx` — abas + seletor de ordenação (desktop-only, `hidden lg:flex`).
- `src/features/nft/components/nft-card.tsx` — card desktop (02 §4).
- `src/features/nft/components/nft-card-mobile.tsx` — card mobile (03 §4), componente distinto, não reuso.
- `src/features/nft/components/catalog-grid.tsx` — grid desktop + masonry mobile + skeleton/vazio/erro/atualização + região viva.
- `src/features/nft/components/catalog-pagination.tsx` — paginação (03 §5).
- `src/routes/nft.$nftId.tsx` — rota stub do detalhe (fase 4 troca o componente).
- `e2e/catalog.spec.ts` — spec E2E do domínio catálogo (inclui `empty` e `out-of-order`).

**Modificar**
- `src/types/nft.ts`, `src/mocks/fixtures.ts`, `src/mocks/handlers/nfts.ts` — contrato `network` (seção acima).
- `src/routes/index.tsx` — vira a página Início real, com `validateSearch`.
- `src/components/layout/header.tsx` — corrige tabela de prefixo ativo (dívida 1); busca inline (OQ 1 resolvida).
- `src/components/layout/mobile-search-bar.tsx` — liga busca (`q` na URL) e o botão de filtro (abre `Sheet` com `FilterPanel`).
- `src/components/layout/footer.tsx` — coluna "Coleções" vira `Link`s com `search={{ category }}`. **Não tocar no form da newsletter** (`#newsletter-email` é asserido por 2 testes de foco).
- `src/components/ui/slider.tsx` — calibração da dívida 4 (resolução OQ 3): thumb e trecho ativo do trilho em `primary`, trilho inativo `border-soft`.
- `e2e/helpers.ts` — `boot()` deixa de depender do texto da tela de smoke (ver "Migração dos 216 testes").
- `e2e/api-contracts.spec.ts` / `e2e/runtime-behavior.spec.ts` — troca mecânica das asserções de prontidão (ver abaixo).
- `ARCHITECTURE.md` — nova seção "Fase 3" com as decisões listadas em "Decisões a registrar".

**Não tocar:** demais arquivos de `src/mocks/**` (cenários/db/handlers já
cobrem tudo), `src/routes/e2e-sandbox.tsx`, `src/lib/api.ts`, `src/lib/query.ts`.

## Function / API signatures

### Search params (o coração da nota)

```ts
// src/features/nft/search-params.ts  (zod v4, já instalado)
import { z } from 'zod'
import { NFT_CATEGORIES } from '@/types'
import { NETWORKS } from '@/types'
import type { NftListParams } from '@/types'

const ethString = z.string().regex(/^\d+(\.\d+)?$/)

export const catalogSearchSchema = z.object({
  q: z.string().min(1).optional().catch(undefined),
  category: z.enum(NFT_CATEGORIES).optional().catch(undefined),
  network: z.enum(NETWORKS).optional().catch(undefined),
  priceMin: ethString.optional().catch(undefined),
  priceMax: ethString.optional().catch(undefined),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'popular']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const PER_PAGE = 12

export function toListParams(s: CatalogSearch): NftListParams {
  return { ...s, sort: s.sort ?? 'newest', page: s.page ?? 1, perPage: PER_PAGE }
}
```

Sem `rarity` no schema: o design não tem seção de raridade (resolução OQ 3),
logo nenhum controle escreve o parâmetro — a API continua suportando, mas
deep-link de raridade fica fora do escopo (YAGNI).

Regras de manuseio:
- **Defaults ficam FORA da URL**: campo no default grava `undefined` (o Router
  remove a chave). `?page=1` nunca aparece; `/` limpa é o estado default.
- `.catch(undefined)` faz valor inválido na URL degradar para o default em vez
  de quebrar a rota (ex.: `?category=lixo`, `?network=bitcoin` → sem filtro).
- **Todo controle que muda `q`/`category`/`network`/`priceMin`/`priceMax`/`sort`
  grava `page: undefined`** (reinicia paginação). Só a paginação escreve `page`.
- Zero `useState` para esses 7 parâmetros. Estado local só para rascunho de
  input ainda não submetido (texto da busca antes do Enter, thumbs do slider
  antes do Aplicar) — o valor commitado mora na URL.
- Navegações via `<Link search={(prev) => ({ ...prev, ... })}>` (abas,
  paginação, footer) ou `navigate()` do `Route.useNavigate()` (linhas de
  filtro, select, submit de busca). Todas são pushes de histórico (o desafio
  exige restauração pelo botão voltar).

```ts
// src/routes/index.tsx
export const Route = createFileRoute('/')({
  validateSearch: (search) => catalogSearchSchema.parse(search),
  component: HomePage,
})
```

### Labels

```ts
// src/features/nft/labels.ts
export const CATEGORY_LABELS: Record<NftCategory, string>
// art→Arte digital, photography→Fotografia, music→Música, art-3d→Arte 3D,
// collectibles→Colecionáveis, generative→Generativa, gaming→Jogos,
// memberships→Assinaturas, utility→Utilidade  (transcritos, 02 §3)

export const NETWORK_LABELS: Record<Network, string>
// ethereum→Ethereum, polygon→Polygon, solana→Solana  (transcritos, 02 §3)

export const SORT_LABELS: Record<NftSort, string>
// newest→"Listados recentemente" (transcrito), price-asc→"Menor preço",
// price-desc→"Maior preço", popular→"Em alta"  (resolução OQ 2)

export const RARITY_BADGES: Partial<Record<NftRarity, string>>
// rare→RARO (transcrito), epic→ÉPICO, legendary→LENDÁRIO; common ausente —
// badge só acima de comum (resolução OQ 4)
```

### Queries

```ts
// src/features/auth/use-session.ts
export function useSession(): UseQueryResult<Session | null>
// queryKey: ['session']; queryFn: GET /auth/session via api;
// axios error com response.status 401 → retorna null (não lança, não loga);
// retry: false. Nenhuma UI de login nesta fase — o hook existe para escopar
// query keys por usuário (regra do CLAUDE.md) e a fase 5 o consome.
```

```ts
// src/features/nft/queries.ts — tudo com queryOptions() do TanStack Query v5
export function nftListOptions(scope: string, params: NftListParams) {
  return queryOptions({
    queryKey: ['nfts', scope, 'list', params],
    queryFn: async ({ signal }) =>
      (await api.get<Paginated<NftSummary>>('/nfts', { params, signal })).data,
    placeholderData: keepPreviousData,
  })
}
export function featuredNftOptions(scope: string)
// key ['nfts', scope, 'featured']; GET /nfts?featured=true&perPage=1 → items[0] ?? null
export function nftFacetsOptions(scope: string)
// key ['nfts', scope, 'facets']; GET /nfts?perPage=48 → deriva:
//   countsByCategory: Record<NftCategory, number>
//   countsByNetwork: Record<Network, number>
//   maxPriceEth: string (maior priceEth via big.js; fallback '1' se vazio)
// Alimenta as contagens do painel e os limites do slider. 48 itens, 1 request.
```

- `scope = session.data?.user.id ?? 'guest'`; as queries de catálogo usam
  `enabled: !session.isPending` para não disparar duas vezes (guest → user).
- **Cancelamento de resposta obsoleta**: o `signal` do contexto do queryFn é
  repassado ao Axios (`api.get(url, { signal })`). Trocar de key (mudou filtro)
  cancela o request em voo — é isso que o teste `out-of-order` prova.
- Query keys distintas por parâmetro já isolam o cache entre buscas; o `scope`
  isola entre usuários (regra CLAUDE.md).
- Atualização em segundo plano: `keepPreviousData` na lista → durante fetch com
  dado anterior visível, o contêiner do grid recebe `aria-busy="true"` e
  `opacity-60`.

### Componentes

```ts
// Todos recebem dados por props; nenhum busca dados sozinho exceto onde indicado.
function HeroDesktop(): JSX.Element                    // estático, sem dados
function HeroMobile(): JSX.Element                     // estático, specs na resolução OQ 5
function FeaturedBanner(props: { nft: NftSummary | null; isPending: boolean })
function FilterPanel(props: {
  search: CatalogSearch
  facets: {
    countsByCategory: Record<NftCategory, number>
    countsByNetwork: Record<Network, number>
    maxPriceEth: string
  } | undefined
  onPatch: (patch: Partial<CatalogSearch>) => void   // sempre inclui page: undefined
})
function CatalogToolbar(props: { search: CatalogSearch; total: number | undefined })
function NftCard(props: { nft: NftSummary })           // desktop
function NftCardMobile(props: { nft: NftSummary })     // mobile — componente distinto
function CatalogGrid(props: {
  query: UseQueryResult<Paginated<NftSummary>>
  search: CatalogSearch
})
function CatalogPagination(props: { page: number; totalPages: number })
```

### Rota stub do detalhe

```ts
// src/routes/nft.$nftId.tsx — a fase 4 substitui o componente; a fase 3 só
// garante que Link/refresh/acesso direto não caem em 404.
export const Route = createFileRoute('/nft/$nftId')({ component: NftDetailStub })
// NftDetailStub: h1 "Detalhes do NFT", parágrafo "Esta tela chega na fase 4."
// e Link "Voltar ao catálogo" para '/' (padrão do NotFound do __root).
// Sem fetch, sem aparência de conteúdo pronto.
```

## Mapeamento visual (medidas transcritas → implementação)

Regra geral: **fixo nas medidas do Figma a 1440, fluido abaixo** (padrão da
fase 2). Onde "fluido" aparece, a implementação resolve exatamente a medida
transcrita no viewport 1440.

### Composição da página (`routes/index.tsx`)
- Desktop (`lg:`): container `mx-auto max-w-content px-6 lg:px-0`. Dentro:
  `HeroDesktop` (1200×450), depois linha `lg:flex lg:gap-12` → sidebar
  `w-[310px] shrink-0` com **FilterPanel em cima e FeaturedBanner embaixo**
  (ordem confirmada por coordenada: filtros y=0, banner y=809) e coluna
  principal `flex-1` (CatalogToolbar → CatalogGrid → CatalogPagination).
  310 + 48 + 842 = 1200 exatos; o `lg:px-0` é o que fecha a conta (o `px-6`
  do header já desvia 24px do Figma desde a fase 2 — registrar, não corrigir).
- Mobile (`<lg`): MobileSearchBar (shell) → HeroMobile → masonry → paginação.
  Toolbar de abas não existe no frame mobile; ordenação entra no Sheet de
  filtros (decisão a registrar). FeaturedBanner é desktop-only (`hidden lg:block`
  na sidebar — o frame mobile não o mostra).

### Hero desktop (03 §1) — copy exata da transcrição
- Sobretítulo "Bem-vindo à Kurio": 14px medium, `leading-[16px]`, `tracking-[1.4px]`, `text-foreground`.
- `h1` "SEJA DONO DO FUTURO" / "DA ARTE DIGITAL": `text-display-43` bold,
  `leading-[70px]`, duas linhas (quebra via `<span className="block">`).
- Texto (copy exata do §1): 14px regular `leading-[24px]` `text-text-secondary` `max-w-[557px]`.
- CTA "EXPLORAR": `<a href="#catalogo">` com 140×40, `bg-primary`,
  `rounded-[6px]`, `pl-[28px] pr-[36px]`, 16px bold `leading-[20px]`,
  `text-primary-foreground` (ink). Âncora rola até o grid (id `catalogo` na
  coluna principal) — comportamento real, acessível por teclado.
- Arte: `/nft/ape-01.webp` (a transcrição diz "um dos ape-01…04"), 450×450,
  `rounded-[24px]`, `object-cover`, alt descritivo.
- 3 pontos (40×8 total, gap 44 abaixo do CTA): **decorativos, `aria-hidden`**
  (resolução OQ 6: não existem slides 2 e 3 no arquivo; carrossel exigiria
  inventá-los).

### Hero mobile (resolução OQ 5, node `70395:240`) — composição própria
- 366×190 (fluido em largura), `rounded-[12px]`, `p-4`.
- Fundo: o Figma exporta um SVG de máscara com gradiente + 2 círculos.
  **Aproximar com CSS a partir dos tokens** (`primary` a baixa opacidade sobre
  `bg-card`), comentário `ponytail: aproximação CSS do SVG exportado — pedir
  extração do SVG se a baseline visual da fase 10 acusar` + registro em
  ARCHITECTURE.md.
- Sobretítulo "Bem-vindo à Kurio": 12px medium `leading-[16px]` `text-foreground`.
- Título "SEJA DONO DA" / "CULTURA DIGITAL": 18px bold `leading-[29px]`,
  `max-w-[190px]`, duas linhas. (É `h1` no mobile; o hero desktop está
  `hidden` abaixo de `lg` — apenas um h1 renderizado por viewport.)
- Texto "Descubra NFTs selecionados de criadores do mundo todo.": 12px regular
  `leading-[18px]` `text-text-secondary`.
- CTA "EXPLORAR" + seta 16px (`ArrowRight` lucide): **link (`<a
  href="#catalogo">`), não botão preenchido** — 12px bold `leading-[14px]`
  `text-text-accent`, gap 8, foco via `linkFocusRing`.
- Artes: duas sobrepostas, 138×138 e 58×58, ambas `rounded-[16px]`; a menor
  com `ml-[14px] mt-[88px]`. Usar `/nft/ape-01.webp` e `/nft/ape-02.webp`.
- Pontos 33×7 abaixo do bloco (gap 16): decorativos, `aria-hidden` (OQ 6).

### Toolbar (03 §2) — desktop only
- Largura da coluna (842), `flex justify-between`.
- Abas (gap 20, 15px medium `leading-[16px]`): `Link`s "Todos os NFTs",
  "Novos lançamentos", "Em alta". Ativa em `text-text-accent` com sublinhado
  de 101px em `bg-primary` a 23px do topo (pseudo-elemento ou span absoluto)
  e `aria-current="true"`; inativas `text-foreground`.
- **Mapeamento aba ↔ sort** (as abas são atalhos de ordenação, 03 §2):
  - "Todos os NFTs" → grava `sort: undefined` (default `newest`);
  - "Novos lançamentos" → grava `sort: 'newest'` (explícito na URL);
  - "Em alta" → grava `sort: 'popular'`;
  - aba ativa derivada da URL: `popular` → Em alta; `newest` explícito →
    Novos lançamentos; ausente ou `price-*` → Todos os NFTs. Registrar em
    ARCHITECTURE.md (a API não tem "janela de lançamento"; 03 §2 proíbe filtro novo).
- Ordenação: rótulo "Ordenar por:" 15px regular `text-foreground` + shadcn
  `Select` com trigger "nu" (sem borda/fundo, 15px, seta 16×16 `ChevronDown`
  lucide) e `aria-label="Ordenar por"`. Rótulos de `SORT_LABELS` (OQ 2:
  Listados recentemente / Menor preço / Maior preço / Em alta); menu aberto no
  estilo do `SelectContent` já adaptado. Valor exibido para `newest` (ou
  ausente) é "Listados recentemente". `onValueChange` grava
  `sort: value === 'newest' ? undefined : value` — vira "explícito" só via aba.

### Busca desktop (resolução OQ 1) — desvio consciente, registrar
- O Figma só tem o ícone 20×20; não existe estado expandido no arquivo.
- Implementação: o botão de busca do header (hoje `disabled`) passa a alternar
  um campo inline na própria linha do header, reaproveitando o `Input`
  adaptado com o tratamento do campo mobile: `h-10 bg-surface-dark
  rounded-[6px] pl-3`, placeholder "Explorar coleções", label sr-only.
  Ao abrir, foco vai ao campo; Enter grava `q` (com `page: undefined`) e
  fecha; Escape fecha sem gravar e devolve o foco ao botão; valor inicial = `q`
  atual. `aria-expanded` no botão.
- Estado aberto/fechado é UI efêmera (pode ser `useState` — não é parâmetro de
  consulta; o valor commitado vai para a URL).

### Painel de filtros (02 §3 + resolução OQ 3)
- `w-[310px] bg-card p-5`, seções com `gap-10`, título 18px bold
  `leading-[16px]`, lista `px-3`. Seções, nesta ordem e com estes títulos:
  **"Coleções"**, **"Faixa de preço"**, **"Rede"**. Sem seção de raridade
  (o design não tem; raridade só aparece como badge no card mobile).
- Linha de lista (Coleções: 9 categorias via `CATEGORY_LABELS`; Rede: 3 redes
  via `NETWORK_LABELS`): `<button aria-pressed={selected}>` full-width, 15px,
  `leading-[40px]`; selecionada `text-text-accent` **e** rótulo bold
  (indicador não-cromático, mesmo racional da decisão 4 da fase 2); não
  selecionada `text-text-secondary`. Contagem à direita, 15px bold, sem
  parênteses (`countsByCategory` / `countsByNetwork`). Clique alterna:
  seleciona ou, se já selecionada, remove (`category`/`network: undefined`).
  Sempre `page: undefined`. Coleções e Rede são independentes e combináveis.
- Faixa de preço: `Slider` existente (dois thumbs 15px, `thumbLabels`
  ["Preço mínimo", "Preço máximo"]), min 0, max = `ceil(maxPriceEth)` via
  big.js, step 0.01. Estado local (rascunho) inicializado da URL; legenda 15px
  `text-foreground` no formato `"{min} ETH – {max} ETH"`. Botão "Aplicar"
  (`bg-primary px-3 py-2 rounded-[6px]`, 16px bold `leading-[20px]` ink) grava
  `priceMin`/`priceMax` como strings decimais (`undefined` quando no limite
  cheio) + `page: undefined`.
- Cores do slider (resolução OQ 3, fecha a dívida 4): em
  `src/components/ui/slider.tsx`, thumb `bg-primary` (era `bg-white`) e trecho
  ativo do trilho `bg-primary`; trilho inativo `bg-border-soft`. Registrar
  como calibração.
- Mobile: o botão de filtro da MobileSearchBar abre `Sheet` (ui/sheet, foco
  gerenciado pelo Radix) contendo o mesmo `FilterPanel` + o `Select` de
  ordenação (com `Label` visível "Ordenar por"). `SheetTitle` "Filtros".

### Card desktop (02 §4) — fluido, exato a 1440
- Container `flex flex-col gap-3`. Placa `bg-card` **sem raio**, h-[300px],
  artwork `rounded-[15px] object-cover` inset 4px (a 1440: 250×250 em placa 258).
- Título 16px regular `leading-[16px]` `text-foreground`; preço 18px bold
  `leading-[16px]` `text-text-accent`, formato `"{priceEth} ETH"` (string da
  API, sem conversão float).
- Card inteiro é `<Link to="/nft/$nftId" params>` com nome acessível = título;
  foco visível via `linkFocusRing`. Alt da imagem = título.
- Grid: `grid grid-cols-3 gap-x-[34px] gap-y-[56px]` (passos 292/412 a 1440).

### Card mobile (03 §4 + resolução OQ 4) — componente distinto
- Placa `rounded-[20px] h-[200px]` com
  `bg-[linear-gradient(139.55deg,#241612_12%,#2f1d15_106.59%)]`; artwork
  `rounded-[16px]` centrado (a 414: 168 em 175 → inset fluido 3.5px).
- Badge de raridade: **só para raridade acima de comum** (`RARITY_BADGES`:
  RARO/ÉPICO/LENDÁRIO; `common` não renderiza badge). Estilo do exemplo
  transcrito: h-8, `bg-primary`, `top-[16px]` à esquerda, texto 13px medium
  ink. **Largura por conteúdo** ("LENDÁRIO" não cabe nos 68px de RARO):
  `inline-flex h-8 items-center px-[18px]` — padding derivado para RARO
  renderizar ≈68px; comentário `ponytail: px derivado do exemplo RARO (68×32)`.
  Offset esquerdo não transcrito → provisório 16px com `ponytail:`.
- Coração de favorito no canto superior direito: `<button disabled
  aria-label="Favoritar">` com `Heart` lucide — **nesta fase é um placeholder
  desabilitado** (padrão das fases 2: TabBar/Header), comentário
  `// fase 4 liga isto (favoritos exigem autenticação)`. Tamanho/offset não
  transcritos → provisórios com `ponytail:`.
- Título 15px regular `text-foreground pl-2`; preço 16px bold `text-text-accent`.
- Masonry: duas colunas flex (`flex gap-4`), itens pares na esquerda, ímpares
  na direita, coluna direita com offset superior (não transcrito → provisório
  `mt-8` com `ponytail:`; frame mostra L 513 / R 544). Card fluido `w-full`.
- Card inteiro também é Link para o detalhe (exceto o botão de coração).

### Paginação (03 §5)
- `<nav aria-label="Paginação">`, botões 35×35 `rounded-[4px]` gap-2, como
  `Link`s: página atual `bg-primary` número 18px bold ink +
  `aria-current="page"`; demais `border border-border` 18px regular
  `text-foreground`. Botão "Próxima" com seta 18×18 (`ChevronRight` lucide),
  `aria-label="Próxima página"`, desabilitado (renderiza `span` estilizado com
  `aria-disabled`) na última página. Com 48 itens / perPage 12 → botões 1–4;
  sem lógica de truncamento (`ponytail:` — elipse só se o dataset crescer).
- Página fora do range (ex.: `?page=99`): API responde `items: []` → estado
  vazio com "Limpar filtros". Não redirecionar silenciosamente.

### Banner NFT em destaque (03 §6)
- `w-[310px] pt-6 pb-1`, fundo
  `bg-[linear-gradient(to_bottom,rgba(210,138,76,0.1),rgba(210,138,76,0.03))]`.
- "NFT EM DESTAQUE" 24px bold `leading-[32px]` `text-text-accent` `px-5`;
  "OFERTA LIMITADA" 22px bold `leading-[16px]` `text-foreground` centralizado.
- Arte 310×368 `rounded-[22px] object-cover` do `featuredNftOptions`
  (`items[0]`; com fixtures default = o featured mais recente, determinístico);
  alt = título do NFT. Skeleton 310×368 enquanto pende; seção some se `null`
  (cenário `empty`).
- Decorações: quadrado 22px borda 2px `#46a358` a 20% + círculos âmbar 45px e
  15px — posições/gradiente exato não transcritos → provisórios `aria-hidden`
  com `ponytail:` e entrada em ARCHITECTURE.md.

### Estados (CatalogGrid)
- **Skeleton**: 12 placeholders com as MESMAS dimensões do card real (desktop:
  placa 300px + linhas de título/preço; mobile: nas duas colunas do masonry),
  usando `Skeleton` existente (shimmer + reduced-motion já resolvidos).
  Mostrado quando `isPending`.
- **Vazio** (`data.total === 0`): título "Nenhum NFT encontrado", texto
  "Ajuste os filtros ou limpe a busca."; se qualquer parâmetro de
  busca/filtro estiver ativo, botão "Limpar filtros" que navega para `/`
  (search vazio). Estados não desenhados seguem o padrão visual (CHALLENGE §1).
- **Erro** (`isError`): texto "Não foi possível carregar o catálogo." + botão
  "Tentar novamente" chamando `refetch()`. (retry 1 do queryClient já cobre o
  cenário `flaky` sozinho.)
- **Atualização em segundo plano** (`isFetching && !isPending`): dado anterior
  visível (keepPreviousData) + `aria-busy="true"` + `opacity-60` no contêiner.
- **Região viva**: `<p role="status" className="sr-only">` que, quando a query
  resolve, anuncia `"{total} NFTs encontrados"` (ou "Nenhum NFT encontrado").
  É o único `role="status"` permanente da página (pré-requisito da migração
  E2E abaixo).

### Header (dívida 1) e footer (dívida de zoom)
- `header.tsx`: substituir `ACTIVE_PREFIXES`/`activeNavLabel` por: `Início`
  ativo somente em `pathname === '/'`; `Mercado` ativo em
  `pathname.startsWith('/nft')` (spec 02 §2: fluxo de mercado) — "Mercado"
  continua `<span>` (sem rota), mas recebe o estilo ativo. 404 → nada ativo.
- `footer.tsx`: os 5 itens de "Coleções" viram
  `<Link to="/" search={{ category: <slug> }}>` (Arte digital→`art`,
  Fotografia→`photography`, Música→`music`, Arte 3D→`art-3d`,
  Utilidade→`utility`) com `linkFocusRing`. Substituem o search inteiro
  (atalho de entrada, não preserva filtros anteriores). Demais colunas ficam
  como estão (texto inerte); newsletter intocada.

### Resolução da dívida "zoom 200%"
A 200% de zoom numa janela de 1280, o viewport efetivo é 640px < `lg` → a
composição vira mobile e o footer (desktop-only) some. **Não há perda de
conteúdo** porque a única função do footer (filtro por categoria via
"Coleções") tem equivalente completo na composição mobile: o Sheet de filtros
aberto pela MobileSearchBar. Ou seja, a resolução é garantir a equivalência
funcional (esta fase cria o Sheet) e prová-la em teste a 640px de largura —
não é reexibir o footer no mobile (o frame `14:5226` não tem footer; decisão 2
da fase 2 continua válida, com o gatilho quitado). Registrar em ARCHITECTURE.md
substituindo o texto de expiração da decisão 2.

## Migração dos 216 testes (obrigatória, mecânica)

`e2e/helpers.ts:21` (`boot`) e mais 15 asserções inline esperam
`getByRole('status')` com "MSW respondeu" — texto da tela de smoke que esta
fase apaga. Sem isto, a suíte inteira quebra:

1. Em `helpers.ts`, `boot()` passa a: `page.goto` → `page.waitForFunction(() =>
   !!window.__mocks)` (instalado por `startWorker()` antes do React montar) →
   `apiFetch(page, '/api/health')` com `expect(status).toBe(200)`. Mesma
   semântica ("camada de mocks de pé e respondendo"), sem depender de UI.
   Exportar `awaitMswReady(page)` com esses dois passos para reuso.
2. Substituir as 11 asserções `getByRole('status')…MSW respondeu` de
   `api-contracts.spec.ts` (linhas 159, 237, 870, 1115, 1198, 1209, 1235,
   1275, 1317, 1494) e as 4 de `runtime-behavior.spec.ts` (151, 218, 258, 301)
   por `awaitMswReady(page)`.
3. `runtime-behavior.spec.ts` teste "Smoke" (linha ~314): o heading
   `/seja dono do futuro/i` continua válido (é o h1 do hero desktop novo; no
   project mobile o h1 é "SEJA DONO DA CULTURA DIGITAL" — se o teste rodar nos
   dois projects, a asserção vira regex que aceita os dois títulos
   transcritos); a asserção de status vira `awaitMswReady`.
4. Teste do cenário offline (linha ~76): a home agora dispara queries reais
   que falham como `net::ERR_FAILED` (ruído esperado do cenário, como o
   comentário do próprio teste já reconhece); filtrar do array
   `consoleErrors` mensagens de recurso `/api/` com `ERR_FAILED`/
   `Failed to load resource` antes do `toEqual([])`.
5. Nenhum teste é removido: os 216 continuam existindo e verdes.

Cuidado de app para o item 1 do "clean boot": o queryFn de `useSession`
**retorna `null` em 401 sem lançar** — visitante anônimo não pode gerar erro
de console nem request "failed" no boot default.

(Impacto do `network`/`SEED_VERSION` nos 216: nenhum — mapa na seção de
contrato acima.)

## Acceptance criteria

URL como fonte de verdade:
1. Navegar para `/?category=music&network=polygon&sort=price-asc&page=2`
   (acesso direto, sem interação) renderiza: "Música" e "Polygon" marcados
   (`aria-pressed="true"`), seletor mostrando "Menor preço", página 2 com
   `aria-current="page"` (se o subconjunto tiver 2+ páginas; senão página 1 de
   resultados coerentes), e todo item do grid pertencente a música∩polygon
   (títulos determinísticos das fixtures).
2. Com filtros aplicados, `page.reload()` preserva exatamente o mesmo estado
   de controles e resultados.
3. Aplicar categoria → ir para página 2 → aplicar rede/preço ou nova busca:
   a URL resultante não contém `page` (paginação reiniciada) e o grid mostra a
   página 1 do novo conjunto.
4. Sequência busca → filtro → página 2 seguida de dois `page.goBack()` restaura,
   passo a passo, URL e resultados anteriores; `page.goForward()` refaz.
5. `?category=invalida&network=bitcoin&page=abc` não quebra: renderiza o
   catálogo default (parâmetros inválidos degradam via `.catch`).
6. Nenhum dos 7 parâmetros vive em `useState`: mudar filtro/ordenação/página
   sempre altera `window.location.search` (verificável em cada interação dos
   testes acima).
7. Buscar (Enter no campo mobile; no desktop, ícone do header abre o campo
   inline — Enter grava, Escape fecha sem gravar) grava `q` na URL e o grid
   filtra por título/criador; submeter vazio remove `q`.
8. Abas: clicar "Em alta" põe `sort=popular` na URL e a aba fica ativa com
   sublinhado + `aria-current`; escolher "Listados recentemente" no select
   remove `sort` e ativa "Todos os NFTs".

Contrato `network`:
9. `GET /api/nfts?network=solana&perPage=48` retorna exatamente 16 itens,
   todos com `network: 'solana'`; `network=bitcoin` → 400 `validation_error`.
10. Todo par categoria×rede existe nas fixtures (ex.:
    `?category=art&network=polygon` tem `total ≥ 1`) — é o que torna os
    filtros combináveis testáveis.
11. Os itens de `GET /api/nfts` (lista) incluem o campo `network` (o
    `toSummary` foi atualizado).

Dados e estados:
12. As query keys da lista têm a forma `['nfts', scope, 'list', params]` com
    `scope` = id do usuário logado ou `'guest'`, e `params` contendo todos os
    parâmetros enviados (verificável no código; o Tester valida indiretamente:
    logar via `login(page, ANA)` + reload não vaza estado entre usuários).
13. Cenário `slow`: o grid mostra 12 skeletons com as dimensões do card
    (sem deslocamento de layout quando o dado chega — mesma altura antes/depois),
    shimmer presente.
14. Cenário `empty` (`boot(page, '?mock-scenario=empty')`): grid mostra
    "Nenhum NFT encontrado"; com filtro ativo na URL aparece "Limpar filtros",
    que ao ser clicado navega para `/` limpa.
15. Cenário `server-error`: aparece "Não foi possível carregar o catálogo." com
    botão "Tentar novamente"; após `setScenario('default')` + clique no botão,
    o grid carrega (recuperação sem reload).
16. Cenário `out-of-order`: com a página carregada, `setScenario('out-of-order')`;
    clicar filtro A (request 1, 1500ms) e imediatamente filtro B (request 2,
    100ms): o grid renderiza o resultado de A+B combinados; após >1600ms o
    resultado NÃO regride para o de A (resposta obsoleta cancelada/descartada
    — request 1 é abortado via signal).
17. Paginar com dados carregados mantém a lista anterior visível durante o
    fetch com `aria-busy="true"` no contêiner (atualização em segundo plano).
18. A região viva `role="status"` anuncia "48 NFTs encontrados" no load default
    e atualiza (ex.: "16 NFTs encontrados" ao filtrar por uma rede).
19. Banner "NFT EM DESTAQUE" mostra o NFT featured vindo de
    `GET /nfts?featured=true&perPage=1`; no cenário `empty` a seção não renderiza.
20. Contagens no painel batem com as fixtures: categorias com 5 ou 6
    (48/9, determinístico) e redes com 16/16/16.

Navegação e shell:
21. Clicar num card (desktop e mobile) navega para `/nft/nft-XXX`; a rota stub
    renderiza (sem 404) e o acesso direto/refresh nela também funciona.
22. Na rota `/nft/$nftId`, o header marca "Mercado" (estilo ativo), não
    "Início"; numa rota 404, nenhum item fica ativo.
23. Os 5 links "Coleções" do footer navegam para `/` com a `category`
    correspondente aplicada (URL + grid + painel).
24. Mobile (390): botão de filtro abre o Sheet com o painel + ordenação; o foco
    entra no Sheet, Escape fecha e devolve o foco ao botão; aplicar categoria
    pelo Sheet atualiza URL e masonry.
25. Zoom 200%: em viewport 640×800 (equivalente CSS de 1280 a 200%), não há
    scroll horizontal (`document.documentElement.scrollWidth <=
    clientWidth + 1`) e o filtro por categoria segue alcançável (Sheet), i.e.
    nenhuma função do footer é perdida.
26. Sem overflow horizontal em 390, 768 e 1440 na home com dados default.
27. Teclado: percorrer por Tab a partir do skip link alcança busca, abas,
    ordenação, linhas de filtro, slider (setas movem thumbs), cards, paginação
    — todos com foco visível.
28. Card mobile: coração presente, desabilitado, `aria-label="Favoritar"`, não
    navega nem simula sucesso; badge de raridade presente APENAS em cards
    rare/epic/legendary, com rótulos RARO/ÉPICO/LENDÁRIO; card `common` sem
    badge.

Suíte e build:
29. `pnpm build`, `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.
30. Os 216 testes existentes seguem verdes após a migração mecânica descrita
    (nenhum teste deletado); `e2e/catalog.spec.ts` cobre os critérios novos,
    incluindo `empty` (14) e `out-of-order` (16) — dívida 2 quitada.

## Edge cases to cover

- `?page=99` (fora do range) → estado vazio com "Limpar filtros", sem crash.
- `?priceMin=abc` ou `priceMin > priceMax` → degrada para default / lista vazia
  conforme a API responder; sem exceção no cliente.
- Visitante anônimo no boot: `GET /auth/session` 401 → `null` silencioso (sem
  erro de console — o teste "clean boot" existente pega isso).
- Cenário `empty`: painel com contagens 0 e slider com bounds fallback (max
  '1') sem NaN; banner de destaque oculto.
- Trocar de filtro durante fetch em voo (out-of-order) não deixa o grid num
  estado misto nem regride.
- `prefers-reduced-motion`: shimmer congelado (media query global já cobre —
  não reimplementar).
- Duplo clique rápido na mesma linha de filtro = seleciona e remove (toggle),
  duas entradas de histórico coerentes.
- Card de NFT esgotado (`nft-013`, available 0) renderiza normal no catálogo
  (tratamento de esgotado é fase 4).
- Busca com `q` sem resultados ("zzz") → vazio com "Limpar filtros" (além do
  cenário `empty` global).
- MobileSearchBar em `/nft/$nftId`: submit navega para `/` com `q`.
- Busca desktop: Escape com texto digitado fecha sem gravar; reabrir mostra o
  `q` da URL, não o rascunho descartado.
- Filtros categoria+rede combinados com busca e preço simultâneos retornam a
  interseção (a API aplica todos em AND — asserção com par determinístico).

## Existing pattern to follow

- Container e breakpoints: `mx-auto max-w-content px-6` + corte único em `lg`
  (`__root.tsx`, `header.tsx`); composições distintas desktop/mobile, nunca
  "um componente que se adapta" (ARCHITECTURE.md decisão 1).
- Controles sem função ainda: botão `disabled` + comentário `// fase N liga
  isto` (header/tab-bar) — usar no coração de favorito.
- Indicador não-cromático de estado ativo: decisão 4 do ARCHITECTURE.md
  (tab bar) — replicar em linhas de filtro (bold) e abas (sublinhado).
- Placeholder visual não transcrito: comentário `ponytail:` + entrada em
  ARCHITECTURE.md (notch da tab bar, fase 2 decisão 3).
- Foco visível em Link "nu": `linkFocusRing` de `src/lib/utils.ts`.
- REST: sempre via `api` de `src/lib/api.ts`; preços ETH como string, cálculo
  só com big.js via `src/lib/money.ts` (bounds do slider, comparações).
- Fixtures: determinísticas, zero PRNG, derivadas do índice (`fixtures.ts`) —
  a fórmula do `network` segue o racional documentado do `RARITY_OFFSET`.
- E2E: helpers de `e2e/helpers.ts` (`boot`, `setScenario`, `login`, `reset`),
  spec por domínio (`catalog.spec.ts`), fixtures determinísticas para asserção
  de títulos/contagens. Roda nos dois projects (1440 e 390) — testes de
  composição usam o viewport do project ou `test.skip` explícito por project.
- Skeleton: `src/components/ui/skeleton.tsx` — dimensões sempre do chamador.

## Prototype / design reference

Sem acesso ao Figma no pipeline. Validar estilo contra as transcrições:
`specs/03-catalogo.md` §§1–6 + "Resolução das Open Questions do Planner"
(hero mobile, rótulos de ordenação, badge de raridade, busca desktop, seções
do painel) e `specs/02-design-system.md` §§2–4, 9–11 (header, filtros, card
desktop, footer, composição mobile). Node ids citados lá referem-se ao arquivo
Figma `BliVZDosX5BcSpvhYvdE0V` — para o pipeline, a transcrição É o protótipo.

## Decisões a registrar (Coder acrescenta seção "Fase 3" no ARCHITECTURE.md)

1. Zoom 200% resolvido por equivalência funcional (Sheet de filtros) — decisão
   2 da fase 2 revalidada com o gatilho quitado.
2. `network` adicionado ao modelo de NFT (fixture determinística + filtro no
   handler, SEED_VERSION 3): a seção "Rede" do design não tinha dado para
   filtrar; renderizar sem filtrar aparentaria sucesso funcional.
3. Busca desktop: estado expandido não existe no Figma — campo inline no
   header derivado do campo mobile, desvio consciente (busca é requisito §3).
4. Rótulos de ordenação: só "Listados recentemente" existe no Figma; demais
   rótulos definidos para os 4 valores de `NftSort`, sem ordenação nova.
5. Badge de raridade: Figma só desenha `RARO`; badge restrito a raridades
   acima de comum, largura por conteúdo (LENDÁRIO não cabe em 68px).
6. Hero mobile: fundo é SVG exportado no Figma — aproximado com CSS a partir
   dos tokens; revisitar se a baseline visual da fase 10 acusar.
7. Pontos dos heroes: decoração estática `aria-hidden` — não existem slides
   2/3 no arquivo; carrossel exigiria inventá-los.
8. Mapeamento aba↔sort (Todos=default, Novos lançamentos=`newest` explícito,
   Em alta=`popular`) e o porquê (API sem filtro de lançamento; 03 §2).
9. Adaptações mobile sem frame: ordenação dentro do Sheet, paginação abaixo do
   masonry, banner de destaque desktop-only.
10. Placeholders provisórios pendentes de extração fina: offsets do coração e
    do badge no card mobile, offset da coluna direita do masonry, posições das
    decorações do banner de destaque, gradiente CSS do hero mobile.
11. Dívida 1 da fase 2 (prefixo ativo do header) fechada; dívida 4 (slider)
    fechada com thumb/trilho ativo em `primary` e trilho inativo `border-soft`
    (cores não transcritas — calibração); dívidas 3 e 5 permanecem (sem
    consumidor nesta fase).
12. Migração da prontidão E2E: `boot()` agora espera `window.__mocks` +
    `/api/health`, não mais o texto da tela de smoke.
13. Seção editorial "Diário da Cunhagem" e cards promocionais omitidos por
    completo (desafio exclui editoriais; blocos inertes aparentariam navegação).

## O que a fase 3 deixa pronto para a fase 4

- Rota `/nft/$nftId` criada (stub) — a fase 4 só troca o componente e adiciona
  `nftDetailOptions` em `src/features/nft/queries.ts`, seguindo o padrão
  `['nfts', scope, 'detail', id]`.
- `useSession` (`src/features/auth/use-session.ts`) para gating de favoritos.
- Coração de favorito já posicionado no card mobile (é só ligar a mutation
  otimista).
- `network` no `NftDetail` — a tela de detalhe pode exibir a rede do NFT sem
  nova mudança de contrato.
- `labels.ts` (categorias/redes/raridades/sort) e `search-params.ts` como
  padrão de `validateSearch` para as próximas rotas.
- Cards com Link + nome acessível — a navegação catálogo→detalhe já testada.

## Out of scope

- Seção editorial "Diário da Cunhagem" e os dois cards promocionais: **omitidos
  por completo** (nem como blocos estáticos — registrar em ARCHITECTURE.md).
- Tela de detalhe do NFT (fase 4) — aqui só rota stub + link.
- Favoritos funcionais/persistidos, autenticação/login UI, carrinho (fases 4–6).
- Filtro/deep-link de raridade na URL (o design não tem seção de raridade; a
  API continua aceitando o parâmetro, sem consumidor).
- Carrossel nos heroes (não existem slides 2/3 no Figma; pontos decorativos).
- Baselines de regressão visual (nascem na fase 10) — inclusive a validação
  fina do gradiente CSS do hero mobile contra o SVG exportado.
- Newsletter do footer, ícones sociais, colunas "Meu perfil"/"Central de
  ajuda" — continuam inertes.
- Truncamento/elipse de paginação para >4 páginas.
- Renomear chaves internas `greenmint:*` (02 §0).

## Fix Plan (iteration 1)

Decisão do usuário (não replanejada): **OPÇÃO A** — `parseSearch`/
`stringifySearch` customizados no router. Corrige a classe (todo search param
futuro das próximas 9 fases) em vez da instância, e produz URL limpa
(`?priceMin=0.05`, não `?priceMin=%220.05%22`) numa entrega em que "estado na
URL" é critério avaliado.

### Root cause

O router é criado em `src/main.tsx:10-14` sem `parseSearch`/`stringifySearch`,
então vale o par default do TanStack Router (pinado:
`@tanstack/router-core@1.171.30`, `dist/esm/searchParams.js` + `dist/esm/qss.js`).
Na **leitura**, `decode()` chama `toValue()` (qss.js:41-46), que converte
qualquer valor numérico da URL em `number` — `?priceMin=5` chega ao
`validateSearch` como o número `5`; `ethString` em
`src/features/nft/search-params.ts:13` é `z.string().regex(...)`, a validação
falha e `.catch(undefined)` descarta o filtro em silêncio (o catálogo cheio de
48 itens renderiza onde a API devolveria `items: []`). Na **escrita**,
`defaultStringifySearch` envolve em aspas JSON toda string que "parece JSON"
(regex `jsonStart`, searchParams.js:3) — por isso o app grava
`?priceMin=%220.05%22`, o round-trip interno funciona e o bug só aparece em
link digitado à mão. Doc oficial da opção:
https://tanstack.com/router/v1/docs/framework/react/guide/custom-search-param-serialization

**Forma escolhida: parser "burro" — nenhum JSON.parse, todo valor é string.**
Justificativa: os search params deste app são todos escalares planos (string ou
inteiro `page`; zero objeto aninhado, zero array), e a conversão de tipo já é
responsabilidade do zod nas rotas (`z.coerce.number()` no `page` converte a
string "2" — funciona idêntico com número ou string na entrada). Tratamento por
tipo no parser duplicaria a responsabilidade do schema e reintroduziria a
ambiguidade "5 é número ou string?" que é exatamente o defeito. Parser burro +
schema esperto = round-trip identidade: o que o app escreve e o que o humano
digita convergem para a mesma string.

**Armadilha verificada no fonte pinado — NÃO usar `parseSearchWith((v) => v)`:**
`parseSearchWith` chama `decode()` internamente ANTES do parser custom rodar, e
o `toValue()` do `decode` já converte `"5"` → número 5 e `"true"` → boolean
(qss.js:41-46, 55-65). Um "identity parser" via helper da lib NÃO corrige o
bug. O par tem que ser escrito à mão com `URLSearchParams` (stdlib).

### Changes for the Coder

- `src/main.tsx` — único arquivo de `src/` a tocar. Definir o par acima do
  `createRouter` e passá-lo nas opções:

  ```ts
  // Search params deste app são sempre escalares planos (string/number),
  // validados por zod no validateSearch de cada rota. O parser default do
  // TanStack Router JSON-parseia valores que começam com dígito (?priceMin=5
  // virava o número 5, falhava no z.string() e o filtro sumia em silêncio) e
  // o serializer default cita strings numéricas (?priceMin=%220.05%22). Par
  // simétrico sem JSON: tudo é string na leitura (o zod converte onde precisa,
  // ex. page via z.coerce) e String() na escrita — round-trip identidade,
  // URL limpa. NÃO trocar por parseSearchWith((v) => v): o decode interno da
  // lib (qss.js/toValue) converte "5" em número antes do parser custom rodar.
  // ponytail: chave duplicada na URL = última vence (nenhum param é array).
  function parseSearch(searchStr: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(searchStr))
  }

  function stringifySearch(search: Record<string, unknown>): string {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const str = params.toString()
    return str ? `?${str}` : ''
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    parseSearch,
    stringifySearch,
  })
  ```

  Contratos que o par respeita (iguais ao default, confirmados no fonte):
  `parseSearch` tolera `?` inicial (o construtor de `URLSearchParams` o
  descarta); `stringifySearch` devolve string com `?` inicial ou `''` quando
  vazio, e **pula chave com valor `undefined`** (é assim que `page: undefined`
  remove a chave da URL — `String(undefined)` gravaria a string "undefined";
  o `if` é obrigatório).

- `e2e/catalog-tester.spec.ts` — únicos ajustes de teste, todos de SETUP
  (nenhuma asserção muda):
  1. As 2 URLs construídas com `quoted()` viram valores planos — linha 108:
     `` await page.goto('/?priceMin=0.05&priceMax=1') `` e linha 138:
     `` await boot(page, '?mock-reset=1&mock-scenario=empty&priceMin=0.05&priceMax=1') ``.
     Sem isto esses 2 testes (hoje verdes) regridem: com o parser novo,
     `%220.05%22` parseia como a string literal `"0.05"` (aspas inclusas),
     falha no regex do `ethString` e o filtro some. A forma plana é agora
     exatamente "a URL como o app mesmo escreve", preservando a intenção
     declarada dos testes.
  2. Remover a função `quoted()` (linhas 18-20), que fica sem uso.
  3. Atualizar o comentário de cabeçalho do arquivo (linhas 4-17) e o
     comentário/título do teste `BUG: a hand-typed price deep link...`
     (linhas 258-276) para registrar que o defeito foi corrigido via
     serializer custom no router — o prefixo "BUG:" pode sair do título;
     **as asserções desses testes ficam byte a byte como estão**.

### Impacto medido nos 304 testes (levantado por grep, não estimado)

- `%22` no diretório `e2e/`: **1 ocorrência, em comentário**
  (catalog-tester.spec.ts:10). Zero asserções contêm `%22`.
- Asserções de forma de URL (`location.search` / `page.url()` / `toHaveURL`):
  **34 ocorrências em 4 arquivos**. Todas asserem valores que serializam
  idêntico nos dois pares: strings não-numéricas (`category=art`, `q=Solar`,
  `q=Neon`, `sort=popular`, `network=solana`, `category=music|photography`,
  `''`, `'?foo=bar'`) — que o default nunca citou — ou `page=2`/`page=99`,
  que ambos os serializers gravam sem aspas. **Zero ajustes.**
- Testes que constroem URL com aspas (`quoted()`): **2 testes × 2 projects =
  4 execuções** (catalog-tester.spec.ts:108 e :138) — os únicos verdes que
  quebrariam; ajuste de setup descrito acima.
- Os 216 legados (`api-contracts` + `runtime-behavior` + `helpers`): só usam
  query params `mock-reset`/`mock-scenario`/`foo=bar`, consumidos por
  `installMockControls()` direto de `location.search`, fora do router; as
  asserções `search === ''`/`'?foo=bar'` dependem do replaceState dos mocks,
  não do serializer. **Zero ajustes.**
- Deep links numéricos hoje verdes (`?page=2` em catalog.spec.ts:19,
  `?page=99` em catalog-tester.spec.ts:244): antes chegavam como número via
  `toValue`, agora como string — `z.coerce.number()` cobre os dois. Verdes
  nos dois mundos.
- Saldo: 300 testes intocados e verdes + 2 com setup ajustado (asserções
  idênticas) + 2 vermelhos que passam a verde = **304/304**.

### Acceptance criteria

1. **O caso que falha hoje**: no build de produção (`pnpm build && pnpm
   preview`), acesso direto a `/?priceMin=5&priceMax=1` renderiza o estado
   vazio — heading "Nenhum NFT encontrado" (a API devolve `items: []` para
   essa query, já provado pelo teste irmão de camada de API).
2. Os 2 testes que falham (`catalog-tester.spec.ts` › "…hand-typed price deep
   link…", desktop e mobile) passam **sem alteração de asserção**.
3. **Round-trip / convergência**: aplicar preço 0.05–1 pelo FilterPanel produz
   `location.search === '?priceMin=0.05&priceMax=1'`; digitar essa mesma
   string à mão produz o mesmo estado (legenda `0.05 ETH – 1 ETH`, mesma
   contagem de resultados) e a mesma `location.search`, byte a byte.
4. **URL limpa**: após uma sequência aplicando categoria, rede, busca, sort,
   página e preço pela UI, `location.search` nunca contém `%22` nem `"` em
   nenhum passo.
5. Sem regressão de degradação: `?category=invalida&network=bitcoin&page=abc`
   continua renderizando o catálogo default (a degradação é do `.catch` do
   schema, intocado); `?page=2` digitado à mão continua abrindo a página 2.
6. `pnpm test` → 304/304 nos dois projects; `pnpm build`, `pnpm typecheck` e
   `pnpm lint` limpos. Diff restrito a `src/main.tsx` e
   `e2e/catalog-tester.spec.ts`.

### Do not touch

- `src/features/nft/search-params.ts` — **não** afrouxar `ethString` para
  `z.union([z.string(), z.number()]).transform(String)`: consertaria só a
  instância e manteria as aspas `%22` na URL (é a opção B, descartada pelo
  usuário). O schema estrito é correto; o defeito era uma camada acima.
- `src/routes/index.tsx`, `filter-panel.tsx`, `mobile-search-bar.tsx`,
  `header.tsx` — navegação e resync de rascunho já corretos e verificados
  pelo Tester; nada a mudar neles.
- `e2e/catalog.spec.ts`, `e2e/api-contracts.spec.ts`,
  `e2e/runtime-behavior.spec.ts`, `e2e/helpers.ts` — zero asserções afetadas
  (mapa acima); um vermelho nesses arquivos é regressão da implementação, não
  teste desatualizado.
- Qualquer asserção de `e2e/catalog-tester.spec.ts` — só as 2 URLs de setup,
  o helper morto `quoted()` e comentários/título.
- `src/mocks/**` — o handler já responde certo a `priceMin=5&priceMax=1`.
- Qualquer outro achado da fase — fora do escopo desta iteração.
