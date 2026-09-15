# Spec: Fase 2 — Design system (primitivos, shell, dívidas de fixtures e E2E)

> Fonte de verdade visual: `specs/02-design-system.md` (250 linhas, seções 0–11).
> **Nenhuma medida, cor ou raio pode ser inventada** — tudo abaixo cita esse
> arquivo ou tokens já em `src/index.css`. As duas Open Questions da versão
> anterior deste spec foram extraídas do Figma e viraram as seções 9–11 de lá.

## Open Questions

None.

## Goal

Fechar a fase 2: quitar as três dívidas da fase 1 (consolidação dos testes
E2E, `picsum.photos` → assets locais, fixtures desalinhadas do design),
corrigir `--radius` para os 6px medidos no Figma, e entregar os primitivos
shadcn/ui adaptados à identidade KURIO mais o shell de layout. O shell são
**duas composições distintas** (spec §11): desktop (≥1024) com header KURIO +
footer de três faixas; mobile (<1024) com search bar no topo e **tab bar
inferior fixa** — não existe header nem drawer de navegação no mobile.
Nenhuma tela de negócio — o resultado é o terreno pronto para a fase 3.

## Decisões registradas (não são Open Questions)

O Coder cria `ARCHITECTURE.md` (ainda não existe; `CLAUDE.md` já o referencia
como casa de "decisões e desvios") com estas entradas:

1. **768 é mobile.** O Figma não tem frame tablet; spec §11 recomenda tratar
   768 como mobile porque a tab bar escala bem até lá. Breakpoint único do
   shell: `lg` (1024px) — abaixo, composição mobile; a partir dele, desktop.
2. **Footer é desktop-only (`hidden lg:block`).** O frame mobile (`14:5226`)
   não mostra footer nenhum, e o rodapé mobile é ocupado pela tab bar fixa.
   Inventar um layout mobile para as três faixas densas do §9 violaria a
   regra "não invente"; omitir é o que o Figma mostra. Revisitar somente se
   uma extração futura revelar footer mobile.
3. **Placeholders de conteúdo pendentes de extração fina** (nenhum é medida —
   são glifos/strings que a transcrição não nomeia; cada um leva comentário
   `// ponytail: placeholder — calibrar com extração do node X`):
   - glifo do FAB da tab bar (node `70395:245`): `Plus` provisório;
   - os 5 ícones sociais do footer (§9 faixa 3): Twitter, Instagram,
     Facebook, Youtube, Linkedin provisórios, todos lucide-react 30x30;
   - e-mail e telefone da faixa 2 do footer: `contato@kurio.com` e
     `+55 11 5555-0100` provisórios.
4. **Indicador não-cromático do item ativo da tab bar** (exigido pelo spec
   §10, ausente no Figma por ser ajuste de a11y): `aria-current="page"` +
   ponto de 4px sob o ícone ativo — presença de forma, não só cor. Documentado
   como ajuste de acessibilidade (CHALLENGE §8 pede esse registro).

## Ordem de execução (obrigatória)

1. Consolidação E2E (`e2e/helpers.ts`, fusão em 2 specs, big.js no pairwise).
2. `picsum.photos` → `public/nft/ape-0{1..4}.webp` (6 referências).
3. Reconciliação design × fixtures (9 categorias, 3 redes, `SEED_VERSION` 2)
   **junto com** a atualização dos testes afetados — os 142 voltam ao verde
   antes de qualquer componente novo.
4. `--radius` 0.375rem.
5. Primitivos shadcn/ui.
6. Shell de layout (header desktop, footer desktop, search bar + tab bar mobile).
7. Skeleton com shimmer.

## Files to create / modify

### Etapa 1 — E2E
- `e2e/helpers.ts` — **novo**. Extraído verbatim de `api-contracts.spec.ts`
  (as cópias nos outros arquivos são idênticas): `ANA`, `BRUNO`,
  `type ApiResult<T>`, `boot`, `bootReset`, `apiFetch`, `login(page, creds)`,
  `logout`, `setScenario`, `reset`, `addToCart`, `clearCart`. Playwright não
  coleta o arquivo (testMatch é `*.spec.ts`).
- `e2e/api-contracts.spec.ts` — importa de `./helpers`; recebe os 4 describes
  de `nft-catalog-session-integrity.spec.ts` (com `purchase` e
  `assertCoherent` como funções locais do bloco; o `login(page)` de lá vira
  `login(page, ANA)`); pairwise de preço via big.js (2 pontos, ver critérios).
- `e2e/runtime-behavior.spec.ts` — importa de `./helpers`; recebe os 2
  describes de `mock-boot-revalidation.spec.ts` (junto ao bloco
  `Boot param cleanup`) e os 2 testes de `smoke.spec.ts` (novo describe
  `Smoke`).
- `e2e/mock-boot-revalidation.spec.ts`, `e2e/nft-catalog-session-integrity.spec.ts`,
  `e2e/smoke.spec.ts` — **deletar** (conteúdo movido, nenhum teste perdido).

### Etapas 2–3 — fixtures, tipos, handlers
- `src/types/nft.ts` — `export const NFT_CATEGORIES = [...] as const` (9
  slugs) e `export type NftCategory = (typeof NFT_CATEGORIES)[number]`.
- `src/types/wallet.ts` — `export const NETWORKS = ['ethereum', 'polygon',
  'solana'] as const`; `Network` derivado; `z.enum(NETWORKS)` no schema local.
- `src/types/quote.ts`, `src/types/order.ts` — `z.enum(NETWORKS)` (importado
  de `./wallet`) no lugar dos literais duplicados.
- `src/mocks/fixtures.ts` — `SEED_VERSION = 2`; `CATEGORIES` = as 9; índice
  `i % 9`; `NETWORK_FEES.solana`; todas as URLs de imagem → assets locais.
- `src/mocks/handlers/auth.ts` — avatar do registro → asset local.
- `src/mocks/handlers/nfts.ts` — `category: z.enum(NFT_CATEGORIES)` importado
  de `@/types` (remove a lista duplicada de 4).
- `e2e/api-contracts.spec.ts` — expectativas atualizadas (ver critérios 8–10).

### Etapas 4–7 — CSS, primitivos, shell
- `src/index.css` — `--radius: 0.375rem` (remover o comentário "provisional");
  `--animate-shimmer` + `@keyframes shimmer` no `@theme`.
- `src/components/ui/` — **novos**: `button.tsx`, `input.tsx`, `select.tsx`,
  `checkbox.tsx`, `slider.tsx`, `dialog.tsx`, `sheet.tsx` (o "drawer"),
  `skeleton.tsx`, `badge.tsx`, `card.tsx`, `form.tsx`, `sonner.tsx`.
  Gerados com `pnpm dlx shadcn@latest add button input select checkbox slider
  dialog sheet skeleton badge card form sonner` e então adaptados (abaixo).
  O CLI adiciona as deps radix/sonner ao `package.json` — são a via oficial da
  stack obrigatória shadcn/ui, não deps novas gratuitas. **Nota verificada na
  doc oficial**: o componente `toast` foi descontinuado pelo shadcn; `sonner`
  é o substituto recomendado (https://ui.shadcn.com/docs/components/radix/sonner).
  O "drawer" da lista do §7 é o **Sheet** (painel lateral baseado em Radix
  Dialog, com focus trap nativo) — não instalar o `drawer`/vaul, que é
  bottom-sheet. Com a correção do §10 o Sheet **não tem consumidor no shell**
  da fase 2; fica como primitivo pronto (o botão de filtro mobile da fase 3 é
  o consumidor natural).
- `src/components/layout/header.tsx` — **novo**, desktop-only.
- `src/components/layout/footer.tsx` — **novo**, desktop-only (spec §9).
- `src/components/layout/mobile-search-bar.tsx` — **novo**, mobile-only (§10).
- `src/components/layout/tab-bar.tsx` — **novo**, mobile-only (§10).
- `src/routes/__root.tsx` — monta o shell (abaixo) e o `<Toaster/>` do
  sonner; mantém o skip-link existente.
- `src/routes/index.tsx` — eyebrow "GreenMint" → "KURIO" (spec §0: tudo
  visível usa KURIO). Heading e status intactos (o teste de smoke depende).
- `index.html` — `<title>KURIO — Marketplace de NFTs</title>` e meta
  description com KURIO (spec §0). Chaves internas `greenmint:*` **não mudam**.
- `ARCHITECTURE.md` — **novo**, com as 4 decisões registradas acima.

## Function / API signatures

### Tipos
```ts
// src/types/nft.ts — ordem = ordem do design (§3); os 4 slugs existentes preservados
export const NFT_CATEGORIES = [
  'art',          // Arte digital
  'photography',  // Fotografia
  'music',        // Música
  'art-3d',       // Arte 3D
  'collectibles', // Colecionáveis
  'generative',   // Generativa
  'gaming',       // Jogos
  'memberships',  // Assinaturas
  'utility',      // Utilidade
] as const
export type NftCategory = (typeof NFT_CATEGORIES)[number]

// src/types/wallet.ts
export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]
```
Labels PT para a UI são da fase 3 (ficam onde o filtro nascer). Slugs são
contrato interno, não medida visual — decisão registrada aqui, não OQ.

### Fixtures (`src/mocks/fixtures.ts`)
```ts
export const SEED_VERSION = 2
const CATEGORIES: NftCategory[] = [...NFT_CATEGORIES]   // 9 itens
// em buildNft: category = CATEGORIES[i % 9]            // era i % 4
// RARITIES, RARITY_OFFSET, PRICE_TABLE, ADJECTIVES/NOUNS, overrides: INTACTOS
// (preços e disponibilidade não mudam — só a categoria de cada NFT)

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.0025',
  polygon: '0.0008',
  solana: '0.0001', // dado de mock determinístico (não é medida de Figma)
}

// imagens — ciclo determinístico pelo índice (spec §5):
imageUrl: `/nft/ape-0${(i % 4) + 1}.webp`
images: [0, 1, 2].map((n) => `/nft/ape-0${((i + n) % 4) + 1}.webp`) // images[0] === imageUrl

// avatares (spec §5 sanciona "recortes dos mesmos assets"; iniciais ficam de fora — menos código):
// CREATORS: avatarUrl: `/nft/ape-0${(idx % 4) + 1}.webp` (idx = posição no array)
// u-ana → '/nft/ape-01.webp'; u-bruno → '/nft/ape-02.webp'
// handlers/auth.ts (registro): avatarUrl: '/nft/ape-01.webp'
```
Nenhuma carteira solana nova nas fixtures (YAGNI — o tipo e a taxa bastam
para a fase 7). Não adicionar solana ao pedido seed.

### Distribuição resultante (para o Tester conferir)
`i % 9` sobre 48 NFTs: `art`, `photography`, `music` → 6 NFTs cada;
demais 6 categorias → 5 cada. Com gcd(9,4)=1, **toda** combinação
categoria×raridade passa a existir — o conceito de "par impossível" morre.
Pontos fixos usados nos testes: `nft-001`(i=0) e `nft-037`(i=36) são
art+epic @ '0.008'; `nft-028`(i=27) é o único art+rare; `nft-006`(i=5) vira
**`generative`** (era 'gaming' no comentário do teste de coerência).

### Shell no `__root.tsx`
```tsx
// RootLayout (mantém o skip-link como primeiro elemento focável):
<Header />            {/* hidden lg:block */}
<MobileSearchBar />   {/* lg:hidden */}
<main id="main" className="pb-[126px] lg:pb-0"> <Outlet /> </main>
<Footer />            {/* hidden lg:block */}
<TabBar />            {/* lg:hidden, fixed bottom */}
<Toaster theme="dark" />
```

### Header desktop (`src/components/layout/header.tsx`) — spec §2
```tsx
export function Header({ withDivider = true }: { withDivider?: boolean })
// spec §2: telas de mercado (fases 4+) usam withDivider={false}
```
- Desktop-only: `hidden lg:block`. **Sem hambúrguer, sem Sheet** — o mobile
  não tem header (spec §10).
- Linha de 44px + divisor de 1px embaixo (total 45; §2): wrapper `border-b`
  (cor default `border-border` = border-strong, já global) quando
  `withDivider`; conteúdo `mx-auto max-w-content px-6` (px-6 = padrão já
  usado em `routes/index.tsx` e `__root.tsx`).
- Wordmark: `<Link to="/">KURIO</Link>`, `text-body-14 font-bold
  tracking-[1.4px] text-foreground`.
- Nav (`flex gap-10` = 40px): Início, Mercado, Criadores, Aprenda.
  `text-body-16`. Ativo: `text-text-accent underline`; inativo:
  `text-foreground`. Só Início é `<Link to="/">`; Mercado/Criadores/Aprenda
  são `<span>` não interativos (nenhuma rota existe ainda; link falso é pior
  a11y que texto). Ativo derivado do pathname por uma tabela de prefixos —
  hoje só `'/' → Início`; fase 3+ estende (comentário no código).
- Ações (`flex gap-7` = 28px): busca `<button disabled aria-label="Buscar">`
  com `<Search className="size-5"/>` (20px); carrinho `<button disabled
  aria-label="Carrinho">` com `<ShoppingCart className="size-6"/>` (24px) e
  badge 16x16 renderizado **somente com contagem > 0** — na fase 2 a contagem
  não é ligada (sem query), logo o badge não aparece; botão Entrar:
  `<Button disabled className="h-[35px] w-[100px]">` com `<LogIn
  className="size-5"/>` (20px) e gap 4px, texto 16px medium em
  `text-primary-foreground` (= ink). Cada `disabled` leva comentário
  `{/* fase N liga isto */}` (busca=3, carrinho=6, entrar=5).
- Ícones exclusivamente de `lucide-react` (§2 — não baixar SVG).

### Mobile — search bar (`mobile-search-bar.tsx`) — spec §10
- `lg:hidden`, dentro do container `px-6`: campo 45px de altura
  (`h-[45px]`, largura fluida — 366 no frame de 414 = campo flexível),
  ícone `<Search className="size-[22px]"/>`, placeholder "Explorar coleções",
  `<label>` sr-only associado; input `readOnly`/`disabled` com comentário
  `{/* fase 3 liga a busca */}`.
- Botão de filtro separado à direita: `size-[45px] bg-primary rounded-lg`,
  ícone `<SlidersHorizontal className="size-[22px]"/>`,
  `aria-label="Filtrar"`, `disabled` `{/* fase 3: abre o Sheet de filtros */}`.

### Mobile — tab bar (`tab-bar.tsx`) — spec §10, node `70395:245`
- `lg:hidden`, `fixed inset-x-0 bottom-0`, altura total 126px (inclui a
  região do FAB), `bg-surface-card`, `pb-[env(safe-area-inset-bottom)]`.
- **Entalhe (notch)**: recorte central via
  `mask-image: radial-gradient(...)` de uma linha na barra (pixel-fino é
  calibrado na fase 10, quando nascem as baselines).
- **FAB**: botão circular 65px (`size-[65px] rounded-full bg-primary`),
  centrado sobrepondo o topo da barra (absoluto, `-translate-y`), `disabled`,
  ícone `<Plus/>` — `// ponytail: glifo não transcrito, calibrar com node 70395:245`.
- Quatro itens com ícones lucide de 20x20 (`size-5`): **Home** (`<House/>`,
  `<Link to="/">`, ativo), **Favoritos** (`<Heart/>`), **Carrinho**
  (`<ShoppingCart/>`), **Perfil** (`<User/>`). Favoritos/Carrinho/Perfil são
  `<button disabled aria-label="…">` `{/* fases 4/6/8 ligam */}`.
- Item ativo: `text-text-accent` **+ `aria-current="page"` + ponto de 4px
  (`size-1 rounded-full bg-current`) sob o ícone**, presente só no ativo —
  estado nunca só por cor (decisão 4). Inativos em `text-text-secondary`.
- `<nav aria-label="Navegação principal">` como landmark.

### Footer (`src/components/layout/footer.tsx`) — spec §9, node `70492:696`
Desktop-only (`hidden lg:block`, decisão 2). Conteúdo em `max-w-content px-6`
sobre faixas full-width. Alturas do Figma viram `min-h` (zoom/reflow não pode
cortar conteúdo — CHALLENGE §8).

- **Faixa 1** (`bg-card min-h-[250px] p-8`): três blocos de destaque +
  coluna de newsletter (`w-[357px]`), separados por réguas verticais de 1px
  em `bg-primary`.
  - Medalhão: `size-[74px] rounded-full bg-primary`, letra 24px bold
    (`text-heading-24`) em `text-primary-foreground` — letras `W`, `C`, `D`,
    com `aria-hidden` (decorativas).
  - Blocos (gap interno 12px): título `text-body-17 font-bold leading-[16px]
    text-foreground`; texto `text-body-14 leading-[22px] text-text-secondary
    w-[204px]`. Conteúdo: "Segurança da carteira" · "Criadores em destaque" ·
    "Alertas de lançamentos" (textos corridos conforme extração).
  - Newsletter: título `text-body-18 font-bold`; input `bg-secondary
    (= surface-dark) h-10 rounded-lg pl-3
    drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]`, placeholder `text-body-14
    text-text-secondary`, `<label>` sr-only associado; botão **Enviar**
    embutido à direita `h-10 w-[85px] bg-primary rounded-r-[6px] rounded-l-none
    text-body-18 font-bold text-primary-foreground`, `disabled`
    `{/* nenhum endpoint de newsletter existe no contrato; simular sucesso
    violaria a regra "nenhum dado fictício fora de src/mocks" */}`.
- **Faixa 2** (`bg-secondary min-h-[88px] p-8`, colunas com `gap-[92px]`):
  wordmark KURIO (`text-body-14 font-bold tracking-[1.4px]`) · "Feito para
  colecionadores, criadores e cultura" (`text-body-14 leading-[22px]`) ·
  e-mail · telefone (placeholders da decisão 3). Tudo `text-foreground`.
- **Faixa 3** (`bg-card min-h-[236px] p-8`, colunas com `gap-[124px]`):
  título `text-body-18 font-bold leading-[16px]`, gap título→lista 8px,
  itens `text-body-14 leading-[30px]` como `<li>` de texto simples (sem
  `href` falso; fases futuras linkam — Coleções vira filtro na fase 3).
  - Colunas e itens exatamente como no §9: **Meu perfil** (Meu perfil, Minha
    coleção, Atividade, Estúdio do criador, Lista de interesse) · **Central
    de ajuda** (Central de ajuda, Como comprar NFTs, Carteira e segurança,
    Política do mercado, Denunciar item) · **Coleções** (Arte digital,
    Fotografia, Música, Arte 3D, Utilidade) · **Redes sociais** (`w-[228px]`):
    5 ícones lucide `size-[30px]` com `gap-[10px]` (placeholders da decisão
    3, cada um com `aria-label`); abaixo, "Carteiras compatíveis" + chip
    `bg-secondary border border-input rounded-lg h-[26px] text-tiny-9
    font-bold text-text-accent tracking-[0.1px]` com
    `METAMASK  •  WALLETCONNECT  •  COINBASE`.
  - Última linha da faixa, centralizada, `text-body-14 leading-[30px]`:
    `© 2026 Kurio. Propriedade digital para todos.`
- `<footer>` semântico (landmark `contentinfo`). Nota §9: em telas com scrim
  de modal o footer fica **abaixo** do scrim — garantido por não dar
  `z-index` ao footer (overlays Radix já são portais no fim do body).

### Primitivos — mapeamento de tokens (todos usam `cn` de `@/lib/utils`)
Os aliases semânticos em `src/index.css` (`--primary`, `--card`, `--border`,
`--ring`…) já vestem os componentes gerados; a adaptação é garantir o que
segue, removendo o que o shadcn traz de diferente:

| Componente | Adaptação obrigatória |
| --- | --- |
| `button` | raio `rounded-lg` (= `--radius` = 6px, spec §1); variantes mantidas: `default` (bg-primary, texto `text-primary-foreground`), `ghost`, `outline`, `destructive`; sizes `default` = `h-[35px] px-[12px] text-body-16 font-medium` (Entrar 35px alto, Aplicar px-12px — spec §§2–3), `sm`, `icon`. Peso bold do "Aplicar"/"Enviar" via className no call-site. Deletar variantes/sizes não listados (`link`, `lg`). |
| `input` | `rounded-lg`, `border-input` (= border-soft), `bg-transparent`, placeholder `text-muted-foreground`, foco `ring-ring`. Altura/padding = default shadcn (sem medida no design system; calibra na fase 5 contra o frame de Login — o campo da newsletter e a search bar mobile têm medidas próprias e as aplicam via className). |
| `select` | trigger igual ao input; content `bg-popover` (= surface-card) `border-border`. |
| `checkbox` | `rounded-sm`, marcado = `bg-primary` + glifo `Check` (estado nunca só por cor). |
| `slider` | dois thumbs (value = array), thumb `size-[15px]` (spec §3), track `bg-muted` (= surface-dark), range `bg-primary`, thumbs com `aria-label` obrigatório via props. |
| `dialog` | overlay `bg-ink/80`, content `bg-card border rounded-lg`; focus trap/Esc nativos do Radix. |
| `sheet` | idem dialog; `side` configurável; é o drawer do desafio. Sem consumidor na fase 2 (spec §10 eliminou o drawer de nav); fase 3 o usa para filtros mobile. |
| `skeleton` | ver Etapa 7 abaixo. |
| `badge` | `default` = `bg-primary text-primary-foreground`; uso contador do carrinho: `size-4 text-tiny-10 font-medium` (16x16, 10px — spec §2). |
| `card` | `bg-card` sem sombra decorativa; **não** modelar a placa de NFT aqui (placa 258x300 sem raio é componente da fase 3). |
| `form` | stock shadcn (react-hook-form + zod + @hookform/resolvers, todos já instalados): `FormLabel` associa por `htmlFor`, `FormMessage` associa por `aria-describedby`. |
| `sonner` | `<Toaster theme="dark" />` no `__root`; cores via tokens (`toastOptions.classNames` com `bg-card text-foreground border-border`). |

### Skeleton com shimmer (Etapa 7)
```css
/* src/index.css, dentro de @theme */
--animate-shimmer: shimmer 1.5s linear infinite;
@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
```
```tsx
// src/components/ui/skeleton.tsx
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>)
// <div className={cn('relative overflow-hidden rounded-lg bg-muted', className)} {...props}>
//   <div aria-hidden className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-border-soft/40 to-transparent" />
// </div>
```
- Dimensões vêm SEMPRE do caller (`className="h-4 w-32"`) — contrato
  documentado em comentário: skeleton nunca define tamanho próprio, preserva
  o espaço do conteúdo que substitui (CHALLENGE §8).
- `prefers-reduced-motion`: **nenhum código novo** — o media query global de
  `index.css` já zera `animation-duration`/`iteration-count`, congelando o
  shimmer. Cores do gradiente derivam de tokens (`border-soft`); o shimmer não
  é um visual do Figma (estado de loading não existe lá), é exigência do
  desafio §8.

## Acceptance criteria

Gerais
1. `pnpm build`, `pnpm typecheck`, `pnpm lint` e `pnpm test` passam; a suíte
   completa (os 142 originais, realocados/ajustados, + novos) verde nos dois
   projects (desktop 1440 e mobile 390).
2. `ls e2e/*.spec.ts` retorna exatamente `api-contracts.spec.ts` e
   `runtime-behavior.spec.ts`; `e2e/helpers.ts` existe; nenhum teste dos 3
   arquivos deletados foi perdido (mesmos títulos presentes nos 2 restantes).
3. `grep -r "picsum" src/ e2e/ index.html public/` retorna 0 linhas.
4. `src/index.css` contém `--radius: 0.375rem` e não contém `0.5rem` na linha
   do `--radius`.

E2E / big.js
5. `e2e/api-contracts.spec.ts` não contém `Number(` aplicado a preço: os dois
   pontos pairwise (o `prices.map(Number)` do teste de filtro combinado e o
   loop `Number(after.body.items[i].priceEth)` vindo do teste de coerência de
   catálogo) usam `new Big(curr).gte(prev)` (import `big.js`, já dependência).
6. O teste estático "no fictitious/mocked data lives outside src/mocks" passa
   a varrer também `src/mocks/` para `picsum.photos` (remove o skip só para
   essa asserção), e falha se qualquer arquivo de `src/` citar picsum.

Fixtures / tipos
7. `GET /api/nfts?category=generative` retorna 200 com 5 itens;
   `?category=nunca-existiu` retorna 400 `validation_error`.
8. Teste "combined category+rarity+sort" atualizado: `category=art&rarity=epic
   &sort=price-asc&perPage=48` → `total: 2` (nft-001 e nft-037, ambos
   '0.008'); a sub-asserção do "par impossível" é substituída por
   `category=art&rarity=rare` → `total: 1`, item `nft-028` (par raro, não mais
   impossível — comentário explica o gcd(9,4)=1).
9. Teste de coerência de catálogo (migrado): filtro `category=gaming` vira
   `category=generative` para nft-006 (i=5 → índice 5 da nova lista); as
   asserções de `priceMax=0.13`/`0.14` permanecem (preço 0.132 não mudou).
10. Teste "seed remains unchanged": `expect(dbDump.seedVersion).toBe(2)` e
    título atualizado; teste de "stale seedVersion" (blob com `seedVersion: 0`)
    continua passando sem mudança (0 ≠ 2 → reseed).
11. `GET /api/nfts/nft-001` retorna `imageUrl: '/nft/ape-01.webp'` e `images`
    `['/nft/ape-01.webp','/nft/ape-02.webp','/nft/ape-03.webp']`; nenhum teste
    de preço/disponibilidade existente muda de valor esperado (PRICE_TABLE e
    overrides intactos).
12. `POST /api/quote` com `network: 'solana'` é aceito (200) e usa fee
    '0.0001'; `network: 'solana'` também validado em order e wallet schemas.

Shell desktop (1440)
13. Header renderiza "KURIO" (wordmark), nav com os 4 itens, Início em
    `text-text-accent` com sublinhado, ícones busca/carrinho e botão Entrar de
    100x35 com bg-primary; linha do header 44px + divisor 1px; search bar
    mobile e tab bar **ausentes**.
14. Footer presente com as três faixas: 3 medalhões circulares de 74px com as
    letras W/C/D, campo de newsletter com botão Enviar 85x40 de cantos
    arredondados só à direita, banda da marca com KURIO, 4 colunas de links
    (títulos "Meu perfil", "Central de ajuda", "Coleções", "Redes sociais"),
    chip `METAMASK • WALLETCONNECT • COINBASE` e a linha
    `© 2026 Kurio. Propriedade digital para todos.` centralizada.
15. Badge do carrinho ausente do DOM quando a contagem é 0 (estado da fase 2).

Shell mobile (390 **e** 768 — 768 é mobile por decisão 1; teste de 768 fixa o
viewport explicitamente, já que os projects são 1440/390)
16. Header desktop e footer **ausentes**; no topo, search bar com placeholder
    "Explorar coleções" + botão de filtro 45x45 bg-primary; no rodapé, tab bar
    fixa (`position: fixed`, bottom 0) com 4 ícones de 20px e FAB circular de
    65px sobreposto ao centro.
17. Item Home da tab bar tem `aria-current="page"`, cor `text-text-accent` E o
    indicador de forma (ponto 4px) presente; os demais itens não têm nenhum
    dos três. Favoritos/Carrinho/Perfil estão `disabled` e fora da ordem de
    tabulação.
18. Com a página rolada até o fim em 390, o último conteúdo do `<main>` não
    fica encoberto pela tab bar (padding-bottom de 126px ativo em `< lg`).

Primitivos / a11y / meta
19. `src/components/ui/` contém os 12 arquivos listados; cada um exporta os
    componentes com a adaptação de token da tabela acima (verificável:
    button default tem `bg-primary` e raio 6px computado; slider thumb 15px).
20. `<Skeleton className="h-[300px] w-[258px]"/>` ocupa exatamente 258x300;
    com `prefers-reduced-motion: reduce` emulado, o pseudo-elemento do shimmer
    não anima (animation-duration efetiva ~0).
21. Toaster do sonner montado: `toast('x')` disparado numa página produz um
    elemento com role de status/alert acessível.
22. `<title>` do documento contém "KURIO"; a página inicial não exibe mais o
    texto "GreenMint" (eyebrow trocado); heading "Seja dono do futuro…" e o
    `role="status"` do MSW seguem intactos (smoke test migrado passa).
23. Nenhum overflow horizontal em 390/768/1440 na rota `/`
    (`document.documentElement.scrollWidth <= innerWidth`).
24. Navegação por teclado: skip-link continua sendo o primeiro foco; wordmark
    (desktop) e Home da tab bar (mobile) são focáveis com foco visível (ring
    `--ring`); controles `disabled` (busca/carrinho/Entrar/filtro/FAB/
    Favoritos/Perfil/Enviar) fora da ordem de tabulação.
25. `ARCHITECTURE.md` existe com as 4 decisões registradas.

## Edge cases to cover

- Reload com blob localStorage de `seedVersion: 1` (usuário vindo da fase 1)
  → reseed silencioso para o seed v2, sem crash (mesma mecânica do teste de
  stale seedVersion existente).
- Cruzar o breakpoint (resize 768 → 1024+): tab bar e search bar somem,
  header e footer aparecem, sem crash e sem sobra de padding-bottom no main.
- Tab bar em tela com `env(safe-area-inset-bottom)` > 0: ícones não colam na
  borda inferior (padding aplicado).
- `prefers-reduced-motion: reduce`: shimmer congelado E transições de
  Dialog/Sheet reduzidas (media query global cobre ambos).
- Zoom 200% em 1440: header e footer não perdem conteúdo nem geram overflow
  (CHALLENGE §8) — por isso `min-h` e não `h` fixo nas faixas do footer.
- Slider com dois thumbs: cada thumb tem `aria-label` próprio e é operável por
  setas do teclado (Radix), valores nunca se cruzam.
- Checkbox marcado é distinguível sem cor (glifo Check presente).
- `images[0] === imageUrl` para todo NFT (o ciclo `(i+n)%4` garante; teste
  pode amostrar nft-001/nft-002/nft-005).
- 48 requests de imagem apontam para só 4 arquivos → cache; nenhum 404 de
  `/nft/*.webp` no boot do preview (os arquivos já existem em `public/nft/`).
- Medalhões W/C/D e ícones sociais são decorativos/rotulados corretamente
  (`aria-hidden` nas letras; `aria-label` nos ícones sociais).

## Existing pattern to follow

- Tokens e aliases semânticos: `src/index.css` — os primitivos consomem
  `--primary`/`--card`/`--border`/`--ring` via classes Tailwind
  (`bg-primary`, `border-input`…), nunca hex novo. Únicas arbitrárias
  permitidas: medidas citadas do Figma (`h-[45px]`, `size-[65px]`,
  `gap-[124px]`, `drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]`…).
- `cn()` de `src/lib/utils.ts` em todo componente (padrão shadcn do repo,
  `components.json` já aponta aliases `@/components/ui`, `@/lib/utils`).
- Container: `mx-auto max-w-content px-6` como em `src/routes/index.tsx` e no
  NotFound de `__root.tsx`.
- Estilo de teste E2E: mesmos padrões de `api-contracts.spec.ts` (boot via
  `getByRole('status')`, `bootReset`, comentários explicando o porquê).
- Dinheiro: comparação sempre `big.js` (`eth()` em src; `new Big()` nos specs)
  — regra de `CLAUDE.md`, vigiada pelos testes estáticos.
- Fixtures: determinismo por índice, zero PRNG (comentário no topo de
  `fixtures.ts` — manter).
- Novos testes de UI da fase 2 entram como describes em
  `runtime-behavior.spec.ts` (mantém o critério de 2 specs; "specs por
  domínio" começa na fase 3 com `catalog.spec.ts`).

## Prototype / design reference

`specs/02-design-system.md` (transcrição integral do Figma
`BliVZDosX5BcSpvhYvdE0V`, página `0:1`) — validar: header desktop contra §2
(wordmark 14px bold tracking 1.4px; nav gap 40px; ações gap 28px; Entrar
100x35 bg `#d28a4c` raio 6px texto em `#140d0a`; divisor 1px); footer contra
§9 (faixas 250/88/236, medalhões 74px, newsletter h40 + Enviar 85x40, colunas
gap 124, chip 26px texto 9px); mobile contra §10 (search bar h45 + filtro
45x45, tab bar 414x126, FAB 65px, ícones 20px); botões contra §§2–3; slider
thumb 15px contra §3; raio global 6px contra §1. Grid masonry, hero mobile e
badges de card mobile (§10) são referência para a **fase 3**, não desta.

## Out of scope

- Telas de negócio: catálogo, detalhe, carrinho, checkout, login (fases 3–7).
  O painel de filtros de §3, o card de NFT de §4, o grid masonry mobile, o
  hero mobile e os badges de card do §10 NÃO são construídos agora — só os
  primitivos que eles consumirão.
- Ligar busca (desktop e mobile), botão de filtro, contagem do carrinho,
  sessão/Entrar, FAB e itens Favoritos/Carrinho/Perfil da tab bar (fases 3,
  5, 6, 8; controles ficam `disabled` com comentário).
- Endpoint/fluxo de newsletter (não existe no contrato; botão Enviar
  `disabled` — simular sucesso violaria "nenhum dado fictício fora de mocks").
- Labels PT das categorias e contagens do filtro (fase 3).
- Carteira/pedido solana nas fixtures e endereços base58 (tipo e fee bastam).
- Avatar por iniciais (`bg-surface-dark`) — spec §5 permite reuso dos assets,
  que é menos código; iniciais só se alguma fase futura exigir.
- Calibração fina de input/select/checkbox/dialog contra frames específicos
  (Login etc.) — sem medida no design system; usam default shadcn + tokens e
  calibram na fase da tela que os usa (regra "calibre por tela" do CLAUDE.md).
- Renomear chaves internas `greenmint:*` (spec §0 proíbe).
- Regressão visual com baseline — nasce na fase 10; esta fase só garante
  assets estáveis e o entalhe/notch pixel-fino calibra lá.
- Toggle de tema (dark-only, CLAUDE.md).

## Como a fase 2 deixa o terreno pronto para a fase 3

O catálogo da fase 3 vira montagem: as 9 categorias e 3 redes já existem nos
tipos, no zod dos handlers e nas fixtures (com distribuição conhecida:
6/6/6/5/5/5/5/5/5), então o painel de filtros de §3 só consome
`NFT_CATEGORIES` + slider + checkbox prontos; o card de NFT de §4 compõe
`card` + `skeleton` (que já preserva 258x300) sobre imagens locais estáveis;
o grid desktop entra no `max-w-content` dentro do `<Outlet/>` do shell e o
masonry mobile ganha a search bar e o botão de filtro já posicionados (o
Sheet primitivo é o drawer de filtros que esse botão abre); o header já tem a
tabela de prefixo→item-ativo para "Mercado" acender; a coluna "Coleções" do
footer vira links de filtro; e `catalog.spec.ts` nasce importando
`e2e/helpers.ts` sem duplicar boot/login.

## Fix Plan (iteration 1)

Ciclo de correção da revisão NEEDS WORK (`.pipeline/review.md`). A fase está
implementada e os 202 testes passam — **não replaneje nada acima**; só os
quatro itens abaixo. O item 4 da revisão (copy do footer) já foi parcialmente
resolvido fora do pipeline: a copy real do Figma está persistida no §9 de
`specs/02-design-system.md` (três textos de corpo dos medalhões + título,
placeholder e texto de apoio da newsletter) — **não toque nesse arquivo**;
resta só a ponta de documentação em `ARCHITECTURE.md` (mudança D abaixo).

### Root cause

Os quatro achados compartilham uma causa: resíduos de andaime e de defaults
stock que nunca foram reconciliados com a fronteira dev/produção e com o tema
KURIO. (a) `src/routes/e2e-sandbox.tsx:29-31` gateia só o *componente* pelo
`import.meta.env.DEV` — a *rota* continua registrada no route tree de
produção e casa com a URL, então o router nunca chega ao `notFoundComponent`
do `__root` e entrega o stub `NotAvailable` (página em branco). (b) Os 4
`<Link>` do app (`header.tsx:28,33`, `tab-bar.tsx:41`, `__root.tsx:54`) nunca
receberam a classe `focus-visible:*` que `Button`/`Input` trazem embutida —
e `e2e/runtime-behavior.spec.ts:855-912` cristalizou o desvio asseverando
`expect(outline).toBe('auto')`, transformando o bug em contrato. (c) Os
botões Close de `sheet.tsx:79` e `dialog.tsx:76` mantêm as classes stock
`data-[state=open]:bg-secondary` / `bg-accent`, escritas para temas onde
essas cores são superfícies sutis — aqui são bege/laranja da marca, e o X
fica ~2.2:1 sempre que o painel está aberto. (d) `ARCHITECTURE.md` ficou
defasado do código e do design system em duas decisões (gatilho errado na 2;
classificação de "microcópia genérica" na 3 para copy que agora é transcrição
oficial do Figma).

### Changes for the Coder

**A. Gatear `/e2e-sandbox` em produção** — `src/routes/e2e-sandbox.tsx`
- Adicionar `beforeLoad` à definição da rota, **mantendo** o ternário do
  `component` exatamente como está:
  ```ts
  import { createFileRoute, notFound } from '@tanstack/react-router'

  export const Route = createFileRoute('/e2e-sandbox')({
    beforeLoad: () => {
      // Produção: a URL deve cair no boundary de 404 do __root, não num
      // componente vazio. Vite substitui import.meta.env.DEV estaticamente.
      if (!import.meta.env.DEV) throw notFound()
    },
    component: import.meta.env.DEV ? SandboxPage : NotAvailable,
  })
  ```
- **Por que as duas coisas juntas** (e não uma das saídas isolada que a
  revisão sugeriu): `beforeLoad` sozinho deixaria `component: SandboxPage`
  referenciado incondicionalmente e re-injetaria Dialog/Sheet/Slider/Checkbox
  no chunk de produção, desfazendo o tree-shaking provado (chunk 0.1 kB);
  o ternário sozinho não alcança o `NotFound` do `__root` sem exportá-lo (e
  renderizar 404 com a rota "casando" é semanticamente pior que `notFound()`,
  que aciona o `notFoundComponent` real). Combinados: em produção o
  `beforeLoad` (que vira `throw notFound()` após a substituição estática)
  dispara antes de qualquer render e o router mostra o boundary de 404
  existente; em dev os testes E2E do sandbox (que sobem seu próprio Vite dev
  server, onde `DEV === true`) seguem intocados. `notFound()` existe na
  versão instalada (`@tanstack/react-router` ^1.170).
- Atualizar o comentário-doc do arquivo (o parágrafo "It only renders when
  exercised against `pnpm dev`…") para descrever o novo comportamento em
  produção: rota responde com o boundary de 404.
- Manter `NotAvailable` como está — é o alvo do ternário que garante a DCE;
  nunca renderiza (o `beforeLoad` lança antes).

**B. Foco `--ring` nos 4 `<Link>`** — `src/lib/utils.ts`,
`src/components/layout/header.tsx`, `src/components/layout/tab-bar.tsx`,
`src/routes/__root.tsx`, `e2e/runtime-behavior.spec.ts`
- Em `src/lib/utils.ts`, ao lado de `cn`, exportar a classe compartilhada
  (constante, não componente — 4 call-sites não justificam um wrapper de
  `Link`):
  ```ts
  // Anel de foco para <Link> "nus" — espelha o de Button/Input
  // (focus-visible:border-ring omitido: links não têm borda).
  export const linkFocusRing =
    'rounded-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
  ```
- Aplicar via `cn(linkFocusRing, …)` nos 4 call-sites:
  - `header.tsx:28` — wordmark KURIO;
  - `header.tsx:33` — nav "Início" (dentro do `cn()` existente);
  - `tab-bar.tsx:41` — Home da tab bar (dentro do `cn()` existente);
  - `__root.tsx:54` — "Voltar ao início" do NotFound.
- Inverter os 2 testes do describe `Focus ring on plain <Link> elements`
  (`e2e/runtime-behavior.spec.ts:855-912`) — eles hoje documentam o bug:
  - Renomear describe/títulos para afirmar o comportamento correto (ex.:
    "plain <Link> elements render the --ring token on focus-visible").
  - Nos dois testes, trocar as asserções de desvio pelas de conformidade:
    `outlineStyle` deixa de ser `'auto'` e passa a ser `'none'`
    (Tailwind v4 `outline-none`), e o anel aparece como box-shadow — asseverar
    `getComputedStyle(el).boxShadow` contém `210, 138, 76` (RGB de `--ring`,
    o alpha /50 muda só o canal A). Cobrir os mesmos elementos de hoje:
    wordmark + Início (desktop) e Home da tab bar (mobile).
  - **Manter** a asserção-controle do input da newsletter
    (`newsletter-email` com `borderColor === RING_RGB`) — continua válida.
  - Atualizar o comentário do describe (linhas 856-861): o gap sistêmico foi
    fechado via `linkFocusRing`; o 4º call-site (404) é coberto pelo grep do
    critério de aceite, não precisa de teste próprio (a mecânica é idêntica).

**C. Remover vestígios shadcn dos botões Close** —
`src/components/ui/sheet.tsx:79`, `src/components/ui/dialog.tsx:76`
- Em `sheet.tsx:79`, deletar da className do `SheetPrimitive.Close` apenas o
  trecho `data-[state=open]:bg-secondary`.
- Em `dialog.tsx:76`, deletar da className do `DialogPrimitive.Close` apenas
  os trechos `data-[state=open]:bg-accent` e
  `data-[state=open]:text-muted-foreground`.
- Nada mais muda nessas classNames (`focus:ring-2 focus:ring-ring` etc.
  ficam). Nenhum estilo substituto: o X herda `opacity-70 hover:opacity-100`
  sobre `bg-card`, que já tem contraste adequado.

**D. Atualizar `ARCHITECTURE.md` (decisões 2 e 3)** — `ARCHITECTURE.md`
- **Decisão 2 (linhas 14-18)**: substituir a frase final "Revisitar somente
  se uma extração futura revelar um footer mobile." por um gatilho ligado à
  funcionalidade, não ao Figma — texto na linha de: "Revisitar **antes de
  qualquer conteúdo do footer se tornar funcional** (fase 3: a coluna
  'Coleções' vira filtro; ajuda/carteiras viram links). Hoje a perda do
  footer sob zoom 200% é aceitável porque todo o conteúdo é inerte, mas o
  CHALLENGE §8 lista 'perda de conteúdo com zoom' como obrigatório — no
  momento em que o footer carregar conteúdo funcional sem equivalente na
  composição mobile, esta decisão expira."
- **Decisão 3 (linhas 34-38)**: deletar o quarto sub-item ("textos corridos
  dos 3 blocos de destaque e o título da newsletter … microcópia genérica"):
  essa copy **não é mais placeholder** — foi extraída do Figma e persistida
  no §9 de `specs/02-design-system.md` (textos de corpo dos 3 medalhões +
  título/placeholder/texto de apoio da newsletter), e o código já a entrega.
  A lista de placeholders da decisão 3 fica com exatamente 3 itens (glifo do
  FAB, ícones sociais, e-mail/telefone). Acrescentar uma linha registrando
  que a copy do footer tem fonte de verdade no §9.

### Acceptance criteria (fix)

1. Após `pnpm build`, servir `dist/` (`pnpm preview`) e navegar para
   `/e2e-sandbox`: a página renderiza o boundary de 404 do `__root` ("404",
   "Esta página não existe.", link "Voltar ao início") — nunca página em
   branco.
2. O chunk `dist/assets/e2e-sandbox-*.js` continua ≈0.1 kB e não contém
   código de Dialog/Sheet/Slider/Checkbox (a DCE do ternário permanece).
3. O describe do sandbox em `runtime-behavior.spec.ts` (que sobe o Vite dev
   server próprio) continua passando sem alteração nos seus 5 testes.
4. `grep -rn "linkFocusRing" src/` retorna a definição em `lib/utils.ts` e
   exatamente 4 usos: `header.tsx` (2), `tab-bar.tsx` (1), `__root.tsx` (1).
5. Com Tab até o wordmark (desktop 1440) e até o Home da tab bar (mobile
   390): `outlineStyle === 'none'` e `boxShadow` do elemento focado contém
   `210, 138, 76` — asseverado pelos 2 testes invertidos, que passam; a
   asserção-controle do input `newsletter-email` permanece e passa.
6. `grep -c "data-\[state=open\]:bg-secondary" src/components/ui/sheet.tsx`
   retorna 0; `grep -Ec "data-\[state=open\]:(bg-accent|text-muted-foreground)"
   src/components/ui/dialog.tsx` retorna 0; `focus:ring-ring` segue presente
   nos dois botões Close.
7. `ARCHITECTURE.md` decisão 2 não contém mais "extração futura" e contém
   "fase 3" e "CHALLENGE §8"; decisão 3 não contém mais "microcópia
   genérica", lista exatamente 3 placeholders e aponta o §9 de
   `specs/02-design-system.md` como fonte de verdade da copy do footer.
8. Suíte completa verde: `pnpm build`, `pnpm typecheck`, `pnpm lint` e os
   202 testes E2E (com os 2 invertidos) passando nos dois projects.

### Do not touch

- `specs/02-design-system.md` — o §9 já foi atualizado fora do pipeline com a
  copy real; qualquer edição adicional é regressão.
- `src/components/layout/footer.tsx` — a copy do código está correta; o item
  4 da revisão se resolve só em documentação (mudança D).
- O bootstrap do dev server do sandbox (`runtime-behavior.spec.ts:711-853`)
  e o stub `NotAvailable`/ternário de DCE — funcionam com o gate novo.
- As classes `focus-visible:*` internas dos primitivos de `src/components/ui/`
  (Button/Input/Checkbox/Badge/Select/Slider) — já corretas.
- Todos os achados `[minor]` da revisão (ver Out of scope abaixo).
- Qualquer outro teste dos 202 além dos 2 explicitamente invertidos.

### Out of scope (fix) — itens nomeados para a fase 3

Os 6 `[minor]` da revisão NÃO entram nesta iteração; a revisão recomendou
levá-los como itens nomeados do plano da fase 3, e ficam aqui registrados
para não se perderem:

1. `header.tsx:14-18` — `pathname.startsWith('/')` marca "Início" ativo em
   qualquer rota (inclusive 404); trocar por igualdade exata / prefixo mais
   específico primeiro quando a tabela crescer na fase 3.
2. `src/index.css:24,65` — sombreamento de `--color-foreground` sobre o alias
   `--foreground` (mesma armadilha da colisão `--secondary`); consolidar ou
   comentar.
3. `src/components/ui/card.tsx:12` — `rounded-xl` (10px) foge do raio de
   sistema de 6px; alinhar para `rounded-lg`.
4. `src/components/ui/slider.tsx:62` — thumb `bg-white` fora da paleta;
   calibrar cor na fase 3 (quando o filtro de preço nascer).
5. `src/components/ui/badge.tsx:15-19` — variantes `secondary`/`link`/`ghost`
   não usadas; podar ou justificar, espelhando o que foi feito no button.
6. `src/mocks/scenarios.ts:12,14` — cenários `empty`/`out-of-order` sem
   nenhum teste E2E (dívida rolando desde a fase 1); cobrir junto do
   `catalog.spec.ts` da fase 3.

## Fix Plan (iteration 2)

Ciclo de correção da revisão NEEDS WORK (`.pipeline/review.md`, iteração 2 —
a última). A entrega está pronta: 216/216 verdes e o Reviewer aprovou tudo
exceto **um** item major (o anel de foco dos `<Link>` abaixo de 3:1) mais um
minor de registro. Escopo total desta iteração: **3 arquivos** —
`src/lib/utils.ts` (1 token de classe), o bloco de teste de contraste em
`e2e/runtime-behavior.spec.ts:1187-1230`, e uma seção nova no
`ARCHITECTURE.md`. Nada além disso.

### Root cause

A iteração 1 trocou o outline nativo do Chromium (azul, alto contraste,
WCAG-ok) pelo anel do design system copiando o alpha de `Button`/`Input`
(`ring-ring/50`) — mas esses componentes só passam no SC 1.4.11 porque
pareiam o anel translúcido com uma `focus-visible:border-ring` **sólida**;
`<Link>` não tem borda, então o anel a 50% é o único indicador e composita a
~2,55:1 sobre `ink` (`#140d0a`, header/404) e ~2,53:1 sobre `surface-card`
(`#241612`, tab bar) — abaixo do mínimo de 3:1 do WCAG 2.1 SC 1.4.11 para
indicador não-textual. O teste que mediu isso
(`runtime-behavior.spec.ts:1187-1230`) asseverava apenas `> 1`, então
documentou a falha em vez de bloqueá-la. Causa em uma linha: **alpha copiado
de um contexto que tinha reforço sólido para um contexto que não tem, com o
gate de teste desligado.**

### Escolha do valor: `ring-ring/75`, justificado por cálculo

Luminâncias relativas WCAG (sRGB linearizado): `--ring` `#d28a4c` L=0,3240;
`ink` `#140d0a` L=0,00458; `surface-card` `#241612` L=0,00992. O composto do
anel com alpha `a` sobre fundo `bg` é o blend em espaço sRGB gamma
(`a·ring + (1−a)·bg` por canal) — fiel ao rendering real porque
`color-mix(in oklab, C 75%, transparent)` com alpha pré-multiplicado produz
os próprios canais de `C` com alpha 0,75 (misturar com `transparent` não
desloca a cor), e o browser então composita normalmente em sRGB.

| Alpha | sobre `ink` #140d0a | sobre `surface-card` #241612 (pior caso) |
| --- | --- | --- |
| `/50` (atual) | rgb(115, 75,5, 43) → **2,55:1** ✗ | rgb(123, 80, 47) → **2,53:1** ✗ |
| `/60` | ≈3,3:1 ✓ | ≈**3,2:1** ✓ mas sem margem |
| **`/75` (escolhido)** | rgb(162,5, 106,75, 59,5), L=0,1851 → **4,31:1** ✓ | rgb(166,5, 109, 61,5), L=0,1944 → **4,08:1** ✓ (~36% de margem) |
| sólido | **6,85:1** ✓ | **6,24:1** ✓ |

Contas do valor escolhido: sobre `ink`, (0,1851+0,05)/(0,00458+0,05) =
4,31; sobre `surface-card`, (0,1944+0,05)/(0,00992+0,05) = 4,08. O pior caso
é a tab bar (`surface-card`, o fundo mais claro), e mesmo lá `/75` fica ≥3:1
com ~36% de folga. `/60` passa raspando (≈3,2:1) — margem fina demais para
um gate de acessibilidade; o sólido passa com sobra mas muda o peso visual
do anel mais do que o necessário e abandona a linguagem translúcida dos
demais rings do sistema. `/75` é o menor desvio do `/50` de Button/Input que
cumpre o critério com margem real.

### Changes for the Coder

**A. `src/lib/utils.ts:10-11`** — na constante `linkFocusRing`, trocar
`focus-visible:ring-ring/50` por `focus-visible:ring-ring/75`. **Só isso.**
`rounded-xs outline-none focus-visible:ring-[3px]` ficam; os 4 call-sites
(`header.tsx:30,39`, `tab-bar.tsx:45`, `__root.tsx:55`) não mudam — consomem
a constante. Estender o comentário existente da constante com o porquê do
desvio de alpha em relação a Button/Input, na linha de:
```ts
// Anel de foco para <Link> "nus" — espelha o de Button/Input, mas a /75:
// eles pareiam o /50 com border-ring sólida; sem borda, o anel é o único
// indicador e precisa compositar ≥3:1 (WCAG SC 1.4.11) sobre ink E
// surface-card — /75 dá 4,31:1 e 4,08:1 (o gate E2E de contraste cobra).
```

**B. Endurecer o teste de contraste** —
`e2e/runtime-behavior.spec.ts:1187-1230` (só este teste; os demais do
describe — clipping/overlap — intocados):
- **De onde sai o valor medido** (a parte que a iteração 1 deixou hardcoded):
  o teste vira `async ({ page }) => {…}`, faz `setViewportSize(390×844)` +
  `boot(page)` + `Tab`×2 até o Home da tab bar (mesmo caminho do teste da
  linha 957), e lê da página:
  - `getComputedStyle(document.activeElement).getPropertyValue('--tw-ring-color')`
    — no Chromium isso vem como `color-mix(in oklab, #d28a4c 75%, transparent)`
    (o `var(--ring)` resolve para o hex; estabelecido empiricamente na
    iteração 1, é por isso que se mede por `--tw-ring-color` e não por
    `boxShadow`, que fica preso na notação `oklab()`). Dali extrair:
    - o hex-base do anel via `/#[0-9a-fA-F]{6}/`;
    - o **alpha** via `/(\d+(?:\.\d+)?)%\s*,/` → dividir por 100 (fallback,
      se algum dia o engine resolver o color-mix: `/\/\s*([\d.]+)\)/`).
    Se nenhum regex casar, o teste **falha** (asseverar que o parse retornou
    valor — nunca cair num default silencioso).
  - `getComputedStyle(document.documentElement).getPropertyValue('--color-ink')`
    e `--color-surface-card` — o Tailwind v4 emite as variáveis de `@theme`
    no `:root`, então resolvem para `#140d0a` / `#241612` literais.
  Como `linkFocusRing` é uma constante única compartilhada pelos 4
  call-sites (grep do critério 4 da iteração 1), medir 1 consumidor pina o
  alpha de todos.
- Asseverar que o alpha extraído é `0.75` (tripwire: se alguém reverter para
  `/50`, o teste acusa o valor antes mesmo do contraste) e que o hex-base é
  `#d28a4c`.
- Manter os helpers `srgbToLin`/`luminance`/`contrast`/`blendOver` como
  estão; alimentar `blendOver` com o alpha e as cores **parseados**, não
  mais com literais `0.5`/arrays hardcoded.
- Trocar as duas asserções finais de `toBeGreaterThan(1)` por
  `toBeGreaterThanOrEqual(3)` — uma para o composto sobre `ink`, outra sobre
  `surface-card`. Os `console.log` podem ficar.
- Reescrever o comentário "Recorded for the report, not asserted…"
  (linhas 1218-1225): agora o teste **é** o gate do SC 1.4.11, com os valores
  esperados (≈4,31 e ≈4,08) citados.
- Título do teste: acrescentar o número, ex. "…composites to >= 3:1 (WCAG
  SC 1.4.11) against both backgrounds…".

**C. `ARCHITECTURE.md`** — apêndice, sem tocar nas decisões 1-4: nova seção
`## Dívidas para a fase 3` ao fim do arquivo, com os 6 minors da revisão
(hoje só em `.pipeline/spec.md` §"Out of scope (fix)", que a fase 3
sobrescreve). Os 6 itens, cada um com arquivo:linha:
1. `src/components/layout/header.tsx:14-18` — `pathname.startsWith('/')`
   marca "Início" ativo em qualquer rota (inclusive 404); trocar por
   igualdade exata / prefixo mais específico quando a tabela crescer.
2. `src/index.css:24,65` — sombreamento de `--color-foreground` sobre o
   alias `--foreground` (mesma armadilha da colisão `--secondary`);
   consolidar ou comentar.
3. `src/components/ui/card.tsx:12` — `rounded-xl` (10px) foge do raio de
   sistema de 6px; alinhar para `rounded-lg`.
4. `src/components/ui/slider.tsx:62` — thumb `bg-white` fora da paleta;
   calibrar cor quando o filtro de preço nascer.
5. `src/components/ui/badge.tsx:15-19` — variantes `secondary`/`link`/`ghost`
   não usadas; podar ou justificar, espelhando o button.
6. `src/mocks/scenarios.ts:12,14` — cenários `empty`/`out-of-order` sem
   teste E2E (dívida desde a fase 1); cobrir junto do `catalog.spec.ts`.

### Acceptance criteria (fix 2)

1. `src/lib/utils.ts` contém `focus-visible:ring-ring/75` e **não** contém
   `ring-ring/50`; contém ainda `rounded-xs`, `outline-none` e
   `focus-visible:ring-[3px]`. `grep -rn "linkFocusRing" src/` segue
   retornando a definição + exatamente 4 usos (`header.tsx` ×2,
   `tab-bar.tsx` ×1, `__root.tsx` ×1) — nenhum call-site editado.
2. O teste de contraste asserta `toBeGreaterThanOrEqual(3)` duas vezes (ink
   e surface-card) e não contém mais `toBeGreaterThan(1)`; o alpha e o hex
   do anel usados no cálculo são parseados de `--tw-ring-color` lido de um
   `<Link>` focado na página, e os fundos de `--color-ink`/
   `--color-surface-card` no `:root` — nenhum literal `0.5`/`0.75` alimenta
   o `blendOver` (o `0.75` aparece só na asserção-tripwire do alpha
   parseado).
3. Com `/75`, os compostos medem ≈4,31:1 (ink) e ≈4,08:1 (surface-card) —
   ambos os `>= 3` passam com margem; se `linkFocusRing` regredir a `/50`,
   o teste falha (tripwire do alpha e/ou contraste ~2,5 < 3).
4. Os 2 testes de foco invertidos (`runtime-behavior.spec.ts:892-975`)
   passam **sem alteração**: `--tw-ring-color` segue `.toContain('#d28a4c')`
   (o hex sobrevive dentro da string do color-mix independente do
   percentual) e `boxShadow !== 'none'` segue verdadeiro.
5. Os testes de clipping/overlap do mesmo describe (linhas ~1104-1185) e o
   restante da suíte passam sem alteração: 216/216 verdes nos dois projects;
   `pnpm build`, `pnpm typecheck`, `pnpm lint` limpos.
6. `ARCHITECTURE.md` contém a seção `## Dívidas para a fase 3` com os 6
   itens, cada um citando arquivo:linha; as decisões 1-4 existentes estão
   byte a byte intactas.
7. `git status`/`git diff`: somente `src/lib/utils.ts`,
   `e2e/runtime-behavior.spec.ts` e `ARCHITECTURE.md` modificados (além dos
   artefatos de `.pipeline/`).

### Do not touch

- Os 4 call-sites de `linkFocusRing` (`header.tsx`, `tab-bar.tsx`,
  `__root.tsx`) — a mudança vive só na constante.
- Os 2 testes de foco invertidos (892-975) e suas asserções de
  `--tw-ring-color`/`outline`/`boxShadow` — continuam válidos com `/75`.
- Os testes de clipping (`ring is not clipped…`, `overflow: visible`) e
  overlap do mesmo describe — geometria não muda (o `ring-[3px]` fica).
- `src/components/ui/*` — Button/Input **mantêm** `ring/50`: eles passam no
  SC 1.4.11 pela `border-ring` sólida; "consertá-los" seria regressão de
  escopo.
- O gate do `/e2e-sandbox`, o footer, `specs/02-design-system.md`, e as
  decisões 1-4 do `ARCHITECTURE.md` (só a seção nova é apêndice).
- Qualquer outro teste dos 216 além do único bloco de contraste
  (1187-1230).
