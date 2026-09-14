# Spec: Fase 1 — Contratos tipados + camada MSW (dados apenas, sem UI)

## Open Questions
None.

## Goal
Criar a camada de dados completa do GreenMint: tipos TS dos 8 recursos REST de §5
(+ payloads dos eventos de §7), banco em memória com persistência em localStorage e
reset integral, fixtures determinísticas (2 usuários, 48 NFTs), handlers MSW para
todas as operações com todos os erros exigidos (incluindo idempotência de pedidos),
e um motor de cenários nomeados, selecionável por configuração e reproduzível no
Playwright. Nenhuma tela ou componente visual nesta fase.

## Decisões de modelagem (não são open questions — degradam graciosamente)
- **Edições**: cada NFT tem `editions: NftEdition[]` (≥1). O desafio fala em
  "disponibilidade por NFT e edição" e "edição esgotada"; a lista cobre tanto NFT
  de edição única quanto múltipla. Fases 3/4 leem o Figma e usam o que precisarem.
- **Sessão via cookie** `gm_session` (Set-Cookie no login/register). `api.ts` já usa
  `withCredentials: true`; MSW suporta ler/escrever cookies nos handlers
  (https://mswjs.io/docs/http/intercepting-requests/ + recipe de cookies em
  https://mswjs.io/docs/recipes/cookies). Sem header Authorization manual.
- **Carrinho de visitante**: o db é por navegador, então o carrinho guest vive em
  `carts['guest']` — sem cookie extra. Login/register fazem merge de
  `carts['guest']` no carrinho do usuário e limpam o guest (contrato da Fase 6
  nasce pronto no servidor).
- **Confirmação de pagamento sem socket (fase 1)**: pedido nasce `pending`; a
  resolução acontece *na leitura*: `GET /api/orders/:id` com
  `Date.now() >= createdAt + 1500ms` transiciona para `confirmed` (ou `declined`
  no cenário `payment-declined`), persiste e incrementa `version`. Playwright
  controla o relógio quando precisar. A fase 9 pluga o `order.updated` nesse mesmo
  ponto de transição.

## Files to create / modify

### Tipos — `src/types/` (novos)
- `src/types/common.ts` — `EthAmount`, `ApiErrorCode`, `ApiError`, `Paginated<T>`.
- `src/types/auth.ts` — schemas zod de register/login + `Session`, `SessionUser`.
- `src/types/nft.ts` — `NftEdition`, `NftSummary`, `NftDetail`, `NftListParams`, `NftSort`.
- `src/types/favorites.ts` — `FavoritesResponse`.
- `src/types/cart.ts` — `Cart`, `CartItem`, payloads de add/update (zod).
- `src/types/quote.ts` — `QuoteRequest` (zod), `Quote`, `QuoteItem`.
- `src/types/order.ts` — `OrderStatus`, `CreateOrderRequest` (zod), `Order`.
- `src/types/profile.ts` — `Profile`, `UpdateProfileRequest` e `ChangePasswordRequest` (zod).
- `src/types/wallet.ts` — `Network`, `WalletRole`, `Wallet`, payloads (zod).
- `src/types/events.ts` — `RealtimeEvent<T, D>`, `NftUpdatedEvent`, `OrderUpdatedEvent`.
- `src/types/index.ts` — barrel re-exportando tudo.

Os schemas zod moram junto dos tipos (request = `z.infer`) para serem reutilizados
pelos handlers agora e pelos formulários (react-hook-form + @hookform/resolvers)
nas fases 5–8. Schema ≠ dado fictício; não viola a regra de mocks.

### Mocks — `src/mocks/`
- `src/mocks/fixtures.ts` — seed determinístico (ver seção Fixtures) + `SEED_VERSION`.
- `src/mocks/db.ts` — store tipado, hidratação/persistência em localStorage, `resetDb()`.
- `src/mocks/scenarios.ts` — nomes de cenário, estado ativo, PRNG semeado, `delayFor()`.
- `src/mocks/control.ts` — boot params de URL + `window.__mocks`.
- `src/mocks/utils.ts` — `requireSession`, `apiError`, `parseBody(schema)`, `sha256Hex`.
- `src/mocks/handlers/index.ts` — agrega os 8 arquivos abaixo + mantém `GET /api/health`
  (a tela de smoke e `e2e/smoke.spec.ts` dependem dele) + aplica o wrapper de cenário.
- `src/mocks/handlers/auth.ts`, `nfts.ts`, `favorites.ts`, `cart.ts`, `quote.ts`,
  `orders.ts`, `profile.ts`, `wallets.ts`.
- **Deletar** `src/mocks/handlers.ts` (o próprio comentário dele diz que a fase 1 o
  substitui por `src/mocks/handlers/`). `src/mocks/browser.ts` continua com
  `import { handlers } from './handlers'` — o Vite resolve `handlers/index.ts`.
- `src/mocks/browser.ts` — **modificar**: após `worker.start()`, chamar
  `installMockControls()` de `control.ts` e `hydrateDb()` de `db.ts`.

### Lib
- `src/lib/money.ts` — helpers `big.js` (já previsto na estrutura do CLAUDE.md):
  `eth(v: string): Big`, `roundEth(b: Big): EthAmount` (6 casas, half-up, sem zeros
  à direita — `Big.toString()` após `.round(6)`), `mulQty(price: string, qty: number)`.
  Usado pelos handlers agora e pela UI depois. Nunca `number` para ETH.

### Testes
- `e2e/api-contracts.spec.ts` — exercita contratos, cenários e reset via
  `page.evaluate(fetch)` (o fixture `request` do Playwright NÃO passa pelo service
  worker do MSW; toda chamada de teste deve partir do contexto da página).
- `e2e/smoke.spec.ts` — não tocar; deve continuar verde.

## Function / API signatures

### `src/types/common.ts`
```ts
/** String decimal, ex.: "0.045". Nunca number. Cálculo só via src/lib/money.ts. */
export type EthAmount = string

export type ApiErrorCode =
  | 'validation_error'      // 400 — corpo/params inválidos; details = erro por campo
  | 'invalid_credentials'   // 401 — login errado
  | 'unauthorized'          // 401 — sem sessão
  | 'session_expired'       // 401 — sessão existiu e expirou
  | 'forbidden'             // 403 — recurso de outro usuário
  | 'not_found'             // 404
  | 'email_taken'           // 409 — conflito de cadastro
  | 'conflict'              // 409 — conflito genérico (ex.: endereço de carteira duplicado)
  | 'availability_conflict' // 409 — quantidade > disponível / edição esgotada
  | 'quote_outdated'        // 409 — preço/cupom/taxa mudou entre cotação e pedido
  | 'idempotency_conflict'  // 409 — mesma chave, conteúdo diferente
  | 'coupon_invalid'        // 400
  | 'coupon_expired'        // 400
  | 'transient'             // 500/503 — falha transitória, retry recupera

export interface ApiError {
  error: { code: ApiErrorCode; message: string; details?: Record<string, string> }
}

export interface Paginated<T> {
  items: T[]
  page: number       // 1-based
  perPage: number
  total: number
  totalPages: number
}
```

### `src/types/auth.ts`
```ts
export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})
export type RegisterRequest = z.infer<typeof registerSchema>

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
export type LoginRequest = z.infer<typeof loginSchema>

export interface SessionUser { id: string; name: string; email: string; avatarUrl: string }
export interface Session { user: SessionUser; expiresAt: string /* ISO */ }
```

### `src/types/nft.ts`
```ts
export type NftCategory = 'art' | 'gaming' | 'music' | 'photography'
export type NftRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type NftSort = 'newest' | 'price-asc' | 'price-desc' | 'popular'

export interface NftEdition {
  id: string          // `${nftId}-e1`
  label: string       // "Standard" | "Deluxe"
  priceEth: EthAmount
  totalSupply: number // inteiro
  available: number   // inteiro, 0 = esgotada
}

export interface NftSummary {
  id: string                 // "nft-001" … "nft-048"
  title: string
  creator: { id: string; name: string; avatarUrl: string }
  category: NftCategory
  rarity: NftRarity
  imageUrl: string
  priceEth: EthAmount        // menor preço entre edições disponíveis (ou da 1ª, se todas esgotadas)
  available: number          // soma dos available das edições
  featured: boolean
  likes: number
  createdAt: string
  version: number            // monotônico; incrementa a cada mutação do NFT
}

export interface NftDetail extends NftSummary {
  description: string
  images: string[]           // galeria, 3 por NFT
  editions: NftEdition[]
}

export interface NftListParams {
  q?: string
  category?: NftCategory
  rarity?: NftRarity
  priceMin?: EthAmount
  priceMax?: EthAmount
  sort?: NftSort             // default 'newest'
  page?: number              // default 1
  perPage?: number           // default 12, máx 48
  featured?: boolean
}
```

### `src/types/favorites.ts`
```ts
export interface FavoritesResponse { nftIds: string[] }
```

### `src/types/cart.ts`
```ts
export const addCartItemSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
})
export type AddCartItemRequest = z.infer<typeof addCartItemSchema>

export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1) })
export type UpdateCartItemRequest = z.infer<typeof updateCartItemSchema>

/** Denormalizado na leitura: preço/estoque SEMPRE atuais do catálogo. */
export interface CartItem {
  id: string            // id da linha, "ci_1"…
  nftId: string
  editionId: string
  editionLabel: string
  title: string
  imageUrl: string
  quantity: number
  unitPriceEth: EthAmount
  available: number
  nftVersion: number
}
export interface Cart { items: CartItem[]; subtotalEth: EthAmount }
```

### `src/types/quote.ts`
```ts
export const quoteRequestSchema = z.object({
  couponCode: z.string().optional(),
  network: z.enum(['ethereum', 'polygon']).default('ethereum'),
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

export interface QuoteItem {
  nftId: string; editionId: string; title: string; editionLabel: string
  quantity: number; unitPriceEth: EthAmount; lineTotalEth: EthAmount; nftVersion: number
}
export interface Quote {
  id: string              // "q_1"…, contador determinístico no db
  items: QuoteItem[]
  subtotalEth: EthAmount
  discountEth: EthAmount  // "0" sem cupom
  networkFeeEth: EthAmount
  totalEth: EthAmount     // subtotal - desconto + taxa (big.js, roundEth)
  coupon?: { code: string; percentOff: number }
  network: Network
  createdAt: string
  expiresAt: string       // createdAt + 5 min
}
```

### `src/types/order.ts`
```ts
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export const createOrderSchema = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  network: z.enum(['ethereum', 'polygon']),
  payer: z.object({ name: z.string().min(2), email: z.string().email() }),
})
export type CreateOrderRequest = z.infer<typeof createOrderSchema>

/** Recibo = snapshot imutável da cotação no momento da criação. */
export interface Order {
  id: string                    // "ord_1"…
  status: OrderStatus
  items: QuoteItem[]            // snapshot, nunca relido do catálogo
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
  coupon?: { code: string; percentOff: number }
  network: Network
  walletAddress: string         // snapshot da carteira usada
  payer: { name: string; email: string }
  txHash?: string               // presente quando confirmed; determinístico a partir do id
  explorerUrl?: string          // `https://example.com/tx/${txHash}` (simulado)
  declineReason?: string        // presente quando declined
  createdAt: string
  resolvedAt?: string
  version: number               // 1 = pending, 2 = confirmed/declined
}
```

### `src/types/profile.ts`
```ts
export interface Profile {
  id: string; name: string; email: string; avatarUrl: string; bio: string; createdAt: string
}
export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(280).optional(),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
```

### `src/types/wallet.ts`
```ts
export type Network = 'ethereum' | 'polygon'
export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: string; label: string
  address: string               // 0x + 40 hex
  network: Network; role: WalletRole; createdAt: string
}
export const walletSchema = z.object({
  label: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'endereço inválido'),
  network: z.enum(['ethereum', 'polygon']),
  role: z.enum(['primary', 'secondary']),
})
export type CreateWalletRequest = z.infer<typeof walletSchema>
export type UpdateWalletRequest = Partial<CreateWalletRequest>
```

### `src/types/events.ts`
```ts
/** Contrato dos eventos de §7. Handlers de socket entram na fase 9; o tipo nasce aqui. */
export interface RealtimeEvent<TType extends string, TData> {
  eventId: string                       // identidade estável p/ dedup: `${resource.id}:v${version}`
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  version: number                       // versão do recurso APÓS o evento; cliente descarta version <= atual
  emittedAt: string
  data: TData
}

export type NftUpdatedEvent = RealtimeEvent<'nft.updated', {
  priceEth: EthAmount
  available: number
  editions: Array<Pick<NftEdition, 'id' | 'priceEth' | 'available'>>
}>

export type OrderUpdatedEvent = RealtimeEvent<'order.updated', {
  status: OrderStatus
  txHash?: string
  declineReason?: string
}>
```

### `src/mocks/db.ts`
```ts
interface Db {
  seedVersion: number
  users: Array<SessionUser & { passwordHash: string; salt: string; bio: string; createdAt: string }>
  sessions: Record<string /* token */, { userId: string; expiresAt: string }>
  nfts: NftDetail[]
  favorites: Record<string /* userId */, string[]>
  carts: Record<string /* userId | 'guest' */, Array<{ id: string; nftId: string; editionId: string; quantity: number }>>
  quotes: Record<string, Quote & { ownerId: string }>
  orders: Order[] & /* cada ordem guarda */ { /* ownerId: string junto ao registro */ }
  idempotency: Record<string /* chave */, { fingerprint: string; orderId: string }>
  coupons: Array<{ code: string; percentOff: number; expiresAt: string }>
  counters: { cartItem: number; quote: number; order: number }
}

export const db: Db                       // singleton em memória
export function hydrateDb(): void         // lê localStorage 'greenmint:db:v1'; se ausente
                                          // ou seedVersion ≠ SEED_VERSION → seed das fixtures
export function persist(): void           // JSON.stringify(db) → localStorage; chamar após TODA mutação
export function resetDb(): void           // deep-clone das fixtures + persist; restaura o estado inicial EXATO
export function bumpNftVersion(nftId: string): void
export function findUserByToken(token: string | undefined):
  { user: Db['users'][number]; expired: boolean } | null
```
Observação de arquitetura: os handlers do MSW browser executam no contexto da
página (não dentro do service worker), então `localStorage` é acessível
diretamente. `orders` guardam `ownerId` (tipar como
`Array<Order & { ownerId: string }>`; o `ownerId` é removido na resposta).

### `src/mocks/scenarios.ts`
```ts
export const SCENARIOS = [
  'default',           // sucesso; latência semeada 150–350ms; pagamento confirma
  'empty',             // GET /api/nfts responde lista vazia (total 0), resto normal
  'slow',              // 2500ms fixos em toda rota (skeletons)
  'out-of-order',      // 1ª chamada GET /api/nfts da página: 1500ms; seguintes: 100ms
  'offline',           // toda rota /api (exceto /api/health) → HttpResponse.error()
  'server-error',      // toda rota → 500 { code: 'transient' }
  'flaky',             // 1ª chamada de cada rota+método → 503 'transient'; retry sucede
  'session-expired',   // toda rota autenticada (e GET /api/auth/session) → 401 'session_expired'
  'register-conflict', // POST /api/auth/register → 409 'email_taken' incondicional
  'price-changed',     // POST /api/orders: antes de validar, +10% no preço da 1ª edição
                       //   cotada (persistido + bumpNftVersion) → 409 'quote_outdated'
  'sold-out',          // POST /api/orders: zera available da 1ª edição cotada
                       //   (persistido + bump) → 409 'availability_conflict'
  'order-timeout',     // POST /api/orders: persiste o pedido pending e responde
                       //   HttpResponse.error(). SÓ na 1ª tentativa por Idempotency-Key;
                       //   o replay da mesma chave cai no caminho normal e devolve o pedido
  'payment-declined',  // pedidos resolvem para 'declined' (declineReason fixo) em vez de 'confirmed'
] as const
export type ScenarioName = (typeof SCENARIOS)[number]

export function activeScenario(): ScenarioName   // localStorage 'greenmint:scenario' ?? 'default'
export function setScenario(name: ScenarioName): void // valida contra SCENARIOS, persiste, zera contadores
export function delayFor(): Promise<void>        // latência do cenário ativo via PRNG mulberry32
                                                 // com seed fixo 0xC0FFEE (nada de Math.random)
export function withScenario(resolver: HttpResolver): HttpResolver
// wrapper aplicado em handlers/index.ts a todos os handlers /api/* (exceto /api/health):
// 1. await delayFor()  2. aplica offline/server-error/flaky  3. delega ao resolver
```
Cenários de cupom NÃO existem: `coupon_invalid`/`coupon_expired` são orientados a
dados (código desconhecido / cupom `EXPIRED20` das fixtures) e funcionam em
qualquer cenário. `payment-confirmed` = `default`. "Resultado vazio" também é
alcançável naturalmente (`q` sem match); o cenário `empty` existe para forçá-lo.

### `src/mocks/control.ts`
```ts
declare global {
  interface Window {
    __mocks?: {
      setScenario: (name: ScenarioName) => void
      getScenario: () => ScenarioName
      reset: () => void            // resetDb() — devolve o estado inicial exato
      scenarios: readonly ScenarioName[]
    }
  }
}
export function installMockControls(): void
// 1. lê URLSearchParams: ?mock-scenario=<name> → setScenario; ?mock-reset=1 → resetDb()
// 2. define window.__mocks (só roda quando mocks estão ativos — chamado de browser.ts)
```
Mecanismo de seleção, exato e único: cenário ativo = `localStorage['greenmint:scenario']`.
Três formas de setar, todas convergindo nessa chave: query param de boot
(`/?mock-scenario=slow`), `window.__mocks.setScenario('slow')` em runtime
(Playwright: `page.evaluate`), ou escrever a chave antes do load
(Playwright: `page.addInitScript`). Reset: `?mock-reset=1` ou `window.__mocks.reset()`.

### `src/mocks/utils.ts`
```ts
export function apiError(status: number, code: ApiErrorCode, message: string,
  details?: Record<string, string>): HttpResponse   // corpo no formato ApiError
export async function parseBody<S extends ZodType>(request: Request, schema: S):
  Promise<z.infer<S>>  // ZodError → lança apiError(400,'validation_error', …, fieldErrors)
export function requireSession(cookies: Record<string, string>):
  Db['users'][number]  // sem cookie → 401 unauthorized; expirada (ou cenário
                       // session-expired) → 401 session_expired; lança HttpResponse
export async function sha256Hex(text: string): Promise<string> // crypto.subtle (Web Crypto, stdlib)
```

### Rotas — todas sob `/api`, todas envelopadas por `withScenario`

`handlers/auth.ts`
| Verbo/rota | Comportamento |
| --- | --- |
| `POST /api/auth/register` | zod → 400; email já existe → 409 `email_taken`; cria user (hash = sha256Hex(salt + password), salt = crypto.randomUUID()), cria sessão (expiresAt +24h), `Set-Cookie: gm_session=<token>; Path=/`, merge do carrinho guest, 201 `Session` |
| `POST /api/auth/login` | zod → 400; par inválido → 401 `invalid_credentials`; sessão + cookie + merge guest→user (linhas somam quantidade, cap no available; guest esvaziado); 200 `Session` |
| `GET /api/auth/session` | cookie válido → 200 `Session`; ausente → 401 `unauthorized`; expirado → 401 `session_expired` |
| `POST /api/auth/logout` | remove sessão do db, `Set-Cookie` expirando o cookie, 204 |

`handlers/nfts.ts` (público)
| Verbo/rota | Comportamento |
| --- | --- |
| `GET /api/nfts` | Parse dos params com zod coerce (inválido → 400). Filtros combináveis por AND: `q` (case-insensitive em title + creator.name), `category`, `rarity`, `priceMin`/`priceMax` (comparação Big sobre `priceEth`), `featured`. Sort: `newest` (createdAt desc, default), `price-asc`/`price-desc` (Big), `popular` (likes desc). Paginação depois de filtro+sort. 200 `Paginated<NftSummary>` |
| `GET /api/nfts/:id` | 404 `not_found`; 200 `NftDetail` |

`handlers/favorites.ts` (requireSession)
| Verbo/rota | Comportamento |
| --- | --- |
| `GET /api/favorites` | 200 `{ nftIds }` do usuário |
| `PUT /api/favorites/:nftId` | NFT inexistente → 404; adiciona (idempotente); 200 `{ nftIds }` |
| `DELETE /api/favorites/:nftId` | remove (idempotente); 200 `{ nftIds }` |

`handlers/cart.ts` (guest OU autenticado: owner = userId da sessão, senão `'guest'`)
| Verbo/rota | Comportamento |
| --- | --- |
| `GET /api/cart` | 200 `Cart` denormalizado com preço/available atuais; subtotal via money.ts |
| `POST /api/cart/items` | zod → 400; nft/edição inexistente → 404; linha existente do mesmo nft+edição soma quantidade; (existente + novo) > available → 409 `availability_conflict` com `details.available`; 200 `Cart` |
| `PATCH /api/cart/items/:itemId` | item inexistente → 404; zod (quantity ≥ 1) → 400; > available → 409 `availability_conflict`; 200 `Cart` |
| `DELETE /api/cart/items/:itemId` | item inexistente → 404; 200 `Cart` |

`handlers/quote.ts` (guest OU autenticado — o carrinho mostra resumo antes do login)
| Verbo/rota | Comportamento |
| --- | --- |
| `POST /api/quote` | Carrinho vazio → 400 `validation_error`. Cupom desconhecido → 400 `coupon_invalid`; `expiresAt` passado → 400 `coupon_expired`. Item com quantidade > available → 409 `availability_conflict` (`details` com nftId). Cálculo 100% big.js: subtotal = Σ mulQty; discount = roundEth(subtotal × percentOff/100); fee = tabela por rede das fixtures; total = roundEth(subtotal − discount + fee). Persiste em `db.quotes` com ownerId e expiresAt +5min. 200 `Quote` |

`handlers/orders.ts` (requireSession)
| Verbo/rota | Comportamento |
| --- | --- |
| `POST /api/orders` | Header `Idempotency-Key` ausente → 400 `validation_error`. fingerprint = sha256Hex(JSON do body). Chave conhecida + mesmo fingerprint → **200** com o pedido existente (replay); fingerprint diferente → 409 `idempotency_conflict`. zod → 400. quoteId inexistente ou de outro owner → 404; quote expirada → 409 `quote_outdated`. walletId não pertence ao usuário → 404. Revalida item a item contra o catálogo atual: preço unitário mudou → 409 `quote_outdated` (details com nftId); available < quantity → 409 `availability_conflict`. Sucesso: decrementa available das edições, `bumpNftVersion` de cada NFT, remove do carrinho **apenas** os itens/quantidades comprados, cria `Order` pending (version 1, snapshot da quote), grava idempotency, 201 `Order` |
| `GET /api/orders/:id` | Sem sessão → 401; inexistente → 404; de outro usuário → 403 `forbidden` (é este o caso de "falta de permissão" de §5). Resolução na leitura: pending + 1500ms decorridos → `confirmed` (txHash = `'0x' + sha256Hex(order.id)` truncado em 64 hex, explorerUrl simulado) ou `declined` no cenário `payment-declined`; version → 2, resolvedAt, persist. 200 `Order` |

`handlers/profile.ts` (requireSession)
| Verbo/rota | Comportamento |
| --- | --- |
| `GET /api/profile` | 200 `Profile` |
| `PATCH /api/profile` | zod → 400; aplica name/avatarUrl/bio; 200 `Profile` (email imutável nesta fase) |
| `POST /api/profile/password` | zod → 400; currentPassword não confere com o hash → 400 `validation_error` com `details.currentPassword`; grava novo hash (novo salt); 204 |

`handlers/wallets.ts` (requireSession)
| Verbo/rota | Comportamento |
| --- | --- |
| `GET /api/wallets` | 200 `Wallet[]` do usuário |
| `POST /api/wallets` | zod (regex de address) → 400; address duplicado para o usuário → 409 `conflict`; `role: 'primary'` com primary existente → a existente é rebaixada a `secondary` (invariante: no máx. 1 primary por usuário); 201 `Wallet` |
| `PATCH /api/wallets/:id` | 404 se não é do usuário; mesmas regras de validação/role; 200 `Wallet` |

`handlers/index.ts`
```ts
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', scenario: activeScenario() })),
  ...[...auth, ...nfts, ...favorites, ...cart, ...quote, ...orders, ...profile, ...wallets]
    // cada arquivo exporta seus handlers já construídos com withScenario em volta do resolver
]
```

## Fixtures (`src/mocks/fixtures.ts`) — zero aleatoriedade
- **Usuários (2, dados isolados):**
  - `u-ana` — Ana Volt, `ana@greenmint.dev`, senha `GreenMint#1`; favoritos
    `['nft-002','nft-007','nft-021']`; carrinho `[{nft-003/e1, qty 1}, {nft-007/e1, qty 2}]`;
    1 pedido confirmado histórico (`ord_seed_1`, snapshot fixo); carteiras: 1 primary
    (ethereum) + 1 secondary (polygon), endereços hex fixos.
  - `u-bruno` — Bruno Chain, `bruno@greenmint.dev`, senha `GreenMint#2`; favoritos
    `['nft-001']`; carrinho vazio; 1 carteira primary.
  - `passwordHash`/`salt` **pré-computados e hardcoded em hex** (nunca a senha em
    claro no db; as senhas em claro aparecem só em comentário/README como credencial
    fictícia). Gerar os hex uma vez com `sha256Hex(salt + senha)` e colar.
- **NFTs: 48**, ids `nft-001`…`nft-048`, gerados por loop determinístico sobre
  tabelas fixas (sem PRNG): título de lista fixa de 48 nomes; categoria = ciclo das
  4; raridade = ciclo das 4 (defasado, para combinações variadas); preço de tabela
  fixa de 12 valores entre `"0.008"` e `"12.5"` (ciclo); likes = `(i * 37) % 500`;
  `createdAt` = `2026-01-01T00:00:00Z + i dias`; `featured` = true para i % 6 === 0
  (8 destaques); imagens `https://picsum.photos/seed/gm-nft-{id}-{n}/800/800` (n = 1..3,
  determinístico por seed).
- **Edições:** todo NFT tem `e1` ("Standard", totalSupply 10, available 10);
  a cada 4º NFT, também `e2` ("Deluxe", preço ×2, totalSupply 3, available 3).
  Exceções fixas: `nft-013` esgotado (available 0 em todas), `nft-007` com
  available 2 (limite de quantidade), `nft-021` com available 1.
- **Cupons:** `GREEN10` (10%, expira 2027-01-01) e `EXPIRED20` (20%, expirou 2025-01-01).
- **Taxas de rede:** ethereum `"0.0025"`, polygon `"0.0008"`.
- 48 itens / perPage 12 = 4 páginas reais; 4 categorias × 4 raridades × faixa de
  preço exercitam filtros combinados com contagens previsíveis.

## Acceptance criteria
(Toda chamada de teste parte do contexto da página — `page.evaluate(fetch)` —
porque o fixture `request` do Playwright não atravessa o service worker do MSW.)

1. `pnpm build`, `pnpm typecheck`, `pnpm lint` e `pnpm test` passam; `e2e/smoke.spec.ts` continua verde.
2. `GET /api/nfts` sem params retorna `{ page: 1, perPage: 12, total: 48, totalPages: 4 }` com 12 itens; `?page=4` retorna os 12 últimos; `?page=5` retorna `items: []` com `total: 48`.
3. `GET /api/nfts?q=zzznope` retorna `total: 0, items: []` com status 200.
4. Duas chamadas idênticas a `GET /api/nfts?category=art&rarity=rare&sort=price-asc` retornam exatamente o mesmo corpo (determinismo), e todos os itens satisfazem ambos os filtros.
5. `GET /api/nfts/nft-999` retorna 404 `{ error: { code: 'not_found' } }`; `GET /api/nfts/nft-001` retorna `NftDetail` com `editions.length >= 1` e `priceEth` string decimal.
6. `POST /api/auth/login` com `ana@greenmint.dev`/`GreenMint#1` retorna 200 `Session` e seta cookie; com senha errada retorna 401 `invalid_credentials`. Após login, `GET /api/auth/session` retorna a mesma sessão (sobrevive a reload da página).
7. `POST /api/auth/register` com email `ana@greenmint.dev` retorna 409 `email_taken`; com payload válido inédito retorna 201 e a sessão fica ativa.
8. Sem sessão, `GET /api/favorites`, `GET /api/profile`, `GET /api/wallets` e `POST /api/orders` retornam 401 `unauthorized`.
9. Logada como Ana, `PUT /api/favorites/nft-005` inclui e `DELETE /api/favorites/nft-005` remove; após reload da página o estado persiste (localStorage).
10. Sem login, `POST /api/cart/items { nftId: 'nft-001', editionId: 'nft-001-e1', quantity: 2 }` retorna 200 e o item aparece em `GET /api/cart`; após login da Ana, `GET /api/cart` contém os 2 itens de fixture dela MAIS o item guest (merge), e um novo contexto guest tem carrinho vazio.
11. `POST /api/cart/items` com quantity 5 em `nft-007-e1` (available 2) retorna 409 `availability_conflict` com `details.available = "2"`.
12. `POST /api/quote` com carrinho da Ana e `couponCode: 'GREEN10'` retorna `discountEth` = exatamente 10% do `subtotalEth` (comparação via big.js) e `totalEth = subtotal − discount + networkFeeEth`; `'EXPIRED20'` → 400 `coupon_expired`; `'NOPE'` → 400 `coupon_invalid`.
13. `POST /api/orders` sem header `Idempotency-Key` retorna 400. Com chave `k1` e body válido retorna 201 pending; repetir chave `k1` com o MESMO body retorna 200 com o MESMO `order.id`; chave `k1` com body diferente retorna 409 `idempotency_conflict`.
14. Após pedido criado com sucesso: `available` das edições compradas diminuiu, `version` dos NFTs comprados aumentou, e o carrinho não contém mais as quantidades compradas.
15. `GET /api/orders/:id` do pedido recém-criado retorna `pending`; após 1500ms (relógio controlado no teste), retorna `confirmed` com `txHash` e `version: 2`. O pedido `ord_seed_1` da Ana acessado logado como Bruno retorna 403 `forbidden`.
16. Snapshot imutável: após confirmar um pedido, alterar o catálogo (novo pedido que muda preço/estoque) não altera `items`, `subtotalEth` nem `totalEth` do pedido antigo.
17. Cenário `server-error` (`window.__mocks.setScenario('server-error')`): `GET /api/nfts` retorna 500 `transient`; voltar a `default` retorna 200. Cenário `offline`: fetch rejeita (network error).
18. Cenário `flaky`: primeira chamada a `GET /api/nfts` → 503; segunda → 200 (recuperação por retry).
19. Cenário `order-timeout`: `POST /api/orders` com chave `k2` falha como erro de rede, mas replay com a mesma chave `k2` e mesmo body retorna 200 com o pedido que foi persistido na primeira tentativa (recuperação por idempotência), sem criar segundo pedido.
20. Cenário `price-changed`: `POST /api/orders` retorna 409 `quote_outdated` e o preço no catálogo mudou de fato (GET do NFT reflete +10% e version maior). Cenário `sold-out`: 409 `availability_conflict` e o NFT aparece com available 0.
21. Cenário `payment-declined`: pedido criado resolve para `declined` com `declineReason`, nunca `confirmed`. Cenário `session-expired`: com sessão ativa, `GET /api/auth/session` passa a retornar 401 `session_expired`.
22. Boot com `/?mock-scenario=slow` ativa o cenário `slow` (visível em `GET /api/health` → `scenario: 'slow'`); `/?mock-reset=1` e `window.__mocks.reset()` restauram o estado inicial EXATO: após comprar/alterar dados, reset devolve `nft-001-e1.available = 10`, favoritos e carrinho da Ana idênticos às fixtures.
23. Nenhum valor ETH é `number` em nenhum tipo ou resposta (grep por `priceEth`/`totalEth` etc. só encontra `EthAmount`/string); todos os cálculos monetários dos handlers passam por `src/lib/money.ts`.
24. `db.users` nunca contém campo `password`; apenas `passwordHash` + `salt` (verificável lendo o localStorage no teste).
25. Nenhum arquivo fora de `src/mocks/` contém dado fictício ou resposta simulada; `src/lib/api.ts` permanece intocado.

## Edge cases to cover
- Cookie `gm_session` presente mas token não existe no db (db resetado) → 401 `unauthorized`, não crash.
- localStorage com `seedVersion` antigo → reseed silencioso, sem estado corrompido.
- `PATCH /api/cart/items/:id` de um item cujo NFT ficou esgotado depois de adicionado → 409 com available atual.
- Quote referenciando item removido do carrinho depois (order usa o snapshot da quote, não o carrinho — a revalidação é contra o catálogo).
- Duas edições do mesmo NFT no carrinho = duas linhas distintas.
- `page`/`perPage` não numéricos ou ≤ 0 → 400 `validation_error` (zod coerce + min).
- `priceMin > priceMax` → 200 com lista vazia (não é erro).
- Replay de idempotência depois do pedido já confirmado → 200 com o pedido confirmado (não recria pending).
- Promover segunda carteira a primary → a antiga primary vira secondary na mesma operação (invariante mantida atomicamente).
- Cenário trocado no meio da sessão zera os contadores internos (`flaky`, `out-of-order`) para manter reprodutibilidade.
- `withScenario` nunca envolve `GET /api/health` (a tela de smoke precisa responder mesmo em `offline`).

## Existing pattern to follow
- Comentários de intenção curtos em inglês no topo de cada módulo, como em
  `src/lib/query.ts`, `src/mocks/index.ts` e `src/lib/api.ts`.
- `src/mocks/browser.ts` já importa `{ handlers } from './handlers'` — preservar o
  nome do export ao migrar para o diretório.
- MSW v2 (`msw@^2.15.0`): `http.get/post/...`, `HttpResponse.json`,
  `HttpResponse.error()`, `delay()`; cookies do request via o argumento `cookies`
  do resolver (docs: https://mswjs.io/docs/).
- Path alias `@/` → `src/` nos imports.
- E2E no estilo de `e2e/smoke.spec.ts` (test/expect de `@playwright/test`, sem page objects).

## Prototype / design reference
N/A (fase sem UI).

## Out of scope
- Qualquer tela, componente, hook ou rota de UI. A tela de smoke existente não muda.
- Binding Socket.IO / emissão de eventos (`@mswjs/socket.io-binding`) — fase 9. Aqui nascem apenas os TIPOS dos eventos.
- Hooks de TanStack Query, query keys, invalidation — fases 3+.
- `GET /api/orders` (listagem) e `DELETE /api/wallets/:id` — §5 não pede; adicionar na fase 8 se o Figma exigir.
- Alteração de email no perfil e upload real de avatar (avatar é `avatarUrl` string).
- Assets locais de imagem — fixtures usam picsum com seed determinístico; a fase 3/11 decide assets definitivos para Lighthouse/execução local.
- Documentação em README/ARCHITECTURE (fase 12); os handlers levam comentários de contrato, suficiente por ora.
- Segurança real de sessão (httpOnly, CSRF) — é um mock de front; o requisito coberto é "senha nunca em claro".

## Fix Plan (iteration 1)

### Root cause
Os boot params são ações one-shot, mas `installMockControls()`
(`src/mocks/control.ts`, linhas 27–36) os consome sem removê-los da URL: como um
reload de navegador mantém a URL exata (incluindo a query string) e a função
relê `window.location.search` a cada carregamento, `?mock-reset=1` re-executa
`resetDb()` em todo reload, apagando silenciosamente sessão e dados criados
depois do primeiro boot (reproduzido no E2E: boot com reset → login Ana →
favorito → `page.reload()` → 401 e favorito perdido). O mesmo vale para
`?mock-scenario=`: o param persistente re-executa `setScenario()` a cada load,
sobrescrevendo qualquer `window.__mocks.setScenario()` feito em runtime — o que
contradiz o mecanismo declarado nesta spec ("cenário ativo =
`localStorage['greenmint:scenario']`"; a URL é uma das três formas de *setar*
essa chave, não uma fonte contínua de verdade). Portanto: **ambos** os params
são consumidos e removidos. Compartilhar link de cenário continua funcionando —
o primeiro load do destinatário aplica e persiste o cenário no localStorage;
manter o param na URL não adiciona nada além do bug de precedência.

### Changes for the Coder
- `src/mocks/control.ts` — única mudança de código, dentro de
  `installMockControls()`, imediatamente após o bloco que consome os params
  (depois do `if (params.get('mock-reset') === '1')`) e antes da atribuição de
  `window.__mocks`:
  1. Se `params.has('mock-scenario') || params.has('mock-reset')` (presença de
     qualquer um dos dois, independentemente do valor ser válido — um
     `mock-scenario=bogus` ou `mock-reset=0` também é endereçado à camada de
     mocks e não deve sobreviver a reload):
     - `params.delete('mock-scenario')` e `params.delete('mock-reset')`;
     - `window.history.replaceState(null, '', url)` onde `url` =
       `window.location.pathname` + (`'?' + params.toString()` se `params`
       ainda tiver entradas, senão string vazia) + `window.location.hash`.
       Params alheios (ex.: `?foo=bar`) e o hash são preservados; NÃO usar
       `replaceState(null, '', window.location.pathname)` seco, que os
       descartaria.
  2. Se nenhum dos dois params está presente, não chamar `replaceState`
     (não tocar no histórico em loads normais).
  3. Atualizar o doc comment do arquivo para dizer que os boot params são
     one-shot: consumidos e removidos da URL via `history.replaceState`.
- `e2e/api-contracts.spec.ts` — simplificar `bootReset()`: remover a segunda
  navegação `await boot(page)` (o contorno documentado no próprio comentário do
  helper, linhas 24–32) e atualizar o comentário — o corpo vira só
  `await boot(page, '?mock-reset=1')`. Manter o contorno esconderia uma
  regressão futura: com ele removido, qualquer `page.reload()` do suite que
  acontece depois de um `bootReset()` passa a exercitar exatamente o
  comportamento corrigido.

### Do not touch
- `src/mocks/db.ts`, `scenarios.ts`, `fixtures.ts`, `utils.ts`, `browser.ts` e
  todos os `handlers/*` — a ordem `installMockControls()` → `hydrateDb()` em
  `browser.ts` está correta e fora deste fix.
- O achado do `picsum.photos` registrado em `## Ponytail` do `changes.md` —
  decisão de escopo de outra fase, não deste ciclo.
- `e2e/runtime-behavior.spec.ts` e `e2e/smoke.spec.ts` — os testes existentes
  são o critério de aceite; não adaptá-los ao código.
- Nenhuma flag em localStorage/sessionStorage para "reset já aplicado" — a
  remoção do param da URL é o mecanismo, não adicionar estado novo.

### Acceptance criteria (fix)
1. Caso exato que falhou: `page.goto('/?mock-reset=1')` → login como Ana →
   `PUT /api/favorites/nft-006` → `page.reload()` → `GET /api/auth/session`
   retorna 200 com a sessão da Ana e `GET /api/favorites` contém `nft-006`
   (nada foi resetado pelo reload). O teste
   `?mock-reset=1 boot flag › FINDING: reloading the page…` de
   `e2e/runtime-behavior.spec.ts` passa sem alteração.
2. Após `page.goto('/?mock-reset=1')` e o boot completar (smoke screen com
   "MSW respondeu"), `page.evaluate(() => location.search)` não contém
   `mock-reset` (URL limpa via `replaceState`, sem nova navegação —
   `page.goBack()` não deve voltar para a URL com o param).
3. Após `page.goto('/?mock-scenario=slow')`: `GET /api/health` retorna
   `scenario: 'slow'`, `location.search` não contém `mock-scenario`, e um
   `page.reload()` mantém `slow` (vem do localStorage, não da URL). Em seguida,
   `window.__mocks.setScenario('default')` + `page.reload()` → `/api/health`
   retorna `scenario: 'default'` (nenhum param fantasma reimpõe `slow`).
4. Params alheios e hash sobrevivem: `page.goto('/?foo=bar&mock-reset=1')` →
   após o boot, `location.search === '?foo=bar'` e o reset foi aplicado
   (estado igual às fixtures).
5. Boot sem params de mock (`page.goto('/')`) não altera a URL nem o histórico
   (`location.href` idêntico ao navegado).
6. Suites existentes continuam verdes sem edições além do `bootReset()`
   simplificado: `e2e/api-contracts.spec.ts` (92/92), `e2e/smoke.spec.ts`, e
   `e2e/runtime-behavior.spec.ts` completo (os 16 runs, incluindo os 2 que
   falhavam). `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` limpos.
7. Critério 22 da spec original permanece satisfeito (reset restaura o estado
   inicial exato; `?mock-scenario=slow` ativa o cenário no boot).

## Fix Plan (iteration 2)

### Root cause
`NftSummary.priceEth` ("menor preço entre edições disponíveis") e
`NftSummary.available` ("soma dos available das edições") são campos
**derivados** das edições, mas são materializados uma única vez no seed
(`src/mocks/fixtures.ts:113-118`) e nunca mais reescritos. As três únicas
mutações de edição do repo — `orders.ts:73` (`price-changed`), `orders.ts:77`
(`sold-out`) e `orders.ts:105` (compra) — alteram `nft.editions[*]` e chamam
`bumpNftVersion`, mas nada recalcula o topo. Como `toSummary` (`nfts.ts:28-44`)
só desestrutura os campos guardados, o handler de detalhe serializa o objeto do
db direto (`nfts.ts:113`), e o filtro de preço lê `nft.priceEth` **antes** de
`toSummary` rodar (`nfts.ts:79-80`, e o sort em `nfts.ts:87-89`), lista, detalhe,
filtro e ordenação passam a servir o valor do seed após a primeira mutação —
`GET /api/nfts/:id` chega a se autocontradizer (topo `available: 10` vs.
`editions[0].available: 0` no cenário `sold-out`). Os 118 runs não pegaram
porque toda asserção era em `editions[0].*`, nunca no topo.
A comparação de menor preço no seed usa `Number()` (float em dinheiro, proibido
pelo CLAUDE.md/critério 23), e o merge guest→user (`cart.ts:77,83`) pode
persistir linha com `quantity === 0` quando o cap `Math.min(..., available)`
encontra `available === 0` — dois defeitos vizinhos, corrigidos no mesmo passe.

### Decisão: refresh na escrita, dentro de `bumpNftVersion` (não recompute na leitura)
Das duas abordagens sugeridas pela revisão, a escolhida é o helper
`refreshNftDerived(nft)` — e chamado **dentro** de `bumpNftVersion`, não "junto
de": grep confirma que toda mutação de edição do repo já é seguida de
`bumpNftVersion` (`orders.ts:74,78,108` são os únicos call sites), então uma
única mudança em `db.ts` cobre os três pontos e torna impossível esquecer o
refresh em call sites futuros. Recompute-on-read foi descartado porque:
1. O filtro de preço (`nfts.ts:79-80`) e o sort (`nfts.ts:87-89`) leem
   `nft.priceEth` armazenado ANTES de `toSummary`; recomputar só em
   `toSummary` + detalhe deixaria filtro/ordenação (fase 3) errados — seriam
   necessários 4+ pontos de recálculo em vez de 1.
2. A fase 9 emite `nft.updated` com `priceEth`/`available` no momento da
   mutação, exatamente onde `bumpNftVersion` roda; só o refresh na escrita
   garante payload correto do evento sem recálculo duplicado.
3. O blob persistido no localStorage fica sempre coerente — uma única fonte de
   verdade, verificável direto pelos testes.

### Changes for the Coder
- `src/mocks/fixtures.ts` —
  1. Extrair o cálculo das linhas 113-118 de `buildNft` para uma função
     exportada:
     ```ts
     /** Recomputes the denormalized summary fields from the editions.
      *  Must run after ANY edition mutation (bumpNftVersion calls it). */
     export function refreshNftDerived(nft: NftDetail): void
     ```
     Regra inalterada: `nft.available` = soma dos `available`;
     `nft.priceEth` = menor `priceEth` entre edições com `available > 0`,
     ou `editions[0].priceEth` se todas esgotadas.
  2. Dentro do helper, a comparação de menor preço usa big.js:
     `eth(e.priceEth).lt(eth(min))` — elimina o `Number(...) < Number(...)`
     da linha 117 (único float-compare de dinheiro do repo; `eth` já está
     importado no arquivo).
  3. `buildNft` constrói o `NftDetail` e chama `refreshNftDerived(nft)` antes
     do `return` (os dois campos podem inicializar com `editions[0].priceEth`
     e `0`; o helper sobrescreve).
  4. **Não bumpar `SEED_VERSION`**: com a tabela de preços atual o resultado do
     seed é byte-idêntico ao anterior (nenhum valor da PRICE_TABLE perde
     precisão em float); não há mudança de shape nem de dados.
- `src/mocks/db.ts` — em `bumpNftVersion`, após localizar o nft:
  `refreshNftDerived(nft)` além do `nft.version += 1`. Import de
  `./fixtures` (direção `db → fixtures` já existe via `buildInitialDb`;
  `fixtures → db` importa apenas `type { Db }`, sem ciclo em runtime).
- `src/mocks/handlers/cart.ts` — em `mergeGuestCartInto`, após o loop de merge
  e antes de esvaziar o guest:
  `db.carts[userId] = userRows.filter((row) => row.quantity > 0)` —
  mesmo padrão já usado em `orders.ts:116` após a compra. Uma linha cobre os
  dois ramos: linha nova capada a 0 (`cart.ts:83`) e linha existente zerada
  pelo cap (`cart.ts:77`).
- Nenhuma outra mudança: `orders.ts`, `nfts.ts` (incluindo `toSummary`) e o
  handler de detalhe ficam intocados — passam a servir valores corretos porque
  o dado armazenado passa a ser correto.

### Do not touch
- `src/mocks/handlers/orders.ts` e `nfts.ts` — os call sites de
  `bumpNftVersion` e o `persist()` que os segue já estão na ordem certa; nada
  a mudar neles.
- `toSummary` e o handler de `GET /api/nfts/:id` — NÃO adicionar recálculo na
  leitura (criaria segunda fonte de verdade).
- `control.ts`, `scenarios.ts`, `utils.ts`, `browser.ts` e os testes do fix da
  iteração 1 (`Boot param cleanup` em `e2e/runtime-behavior.spec.ts`).
- `SEED_VERSION` — sem bump (seed idêntico). Estado antigo de localStorage de
  dev pode carregar topo defasado até a próxima mutação; irrelevante para os
  testes (todos bootam com reset) e sanável com `?mock-reset=1`.
- Fora de escopo desta iteração (aceito pela revisão, fica para as fases 2/3):
  `picsum.photos` → asset local (prazo duro: antes da primeira baseline visual
  /Lighthouse/deploy); fusão de `e2e/mock-boot-revalidation.spec.ts` em
  `runtime-behavior.spec.ts`; cobertura dos cenários `empty`/`out-of-order`;
  troca de `waitForTimeout` por `page.clock`.

### Acceptance criteria (fix iteration 2)
1. **`sold-out`, asserção de topo que faltava**: no teste existente do cenário,
   após o 409 `availability_conflict`, `GET /api/nfts/:id` do NFT alvo retorna
   `available === 0` **no topo** (igual à soma de `editions[*].available`) e o
   summary desse NFT em `GET /api/nfts` mostra o mesmo `available: 0` — critério
   20 da spec passa a valer como escrito.
2. **`price-changed`, asserção de topo que faltava**: após o 409
   `quote_outdated`, `GET /api/nfts/:id` do NFT alvo retorna `priceEth` **no
   topo** igual ao novo mínimo (+10%, string decimal exata via `roundEth`) e
   `version` maior; o summary em `GET /api/nfts` reflete o mesmo `priceEth`.
3. **Compra com sucesso (extensão do critério 14)**: após `POST /api/orders`
   201, o `available` de topo do NFT comprado (em detalhe E no summary da
   lista) reflete o decremento — não só `editions[*].available`.
4. **Recomputação do mínimo com multi-edição**: com o carrinho contendo apenas
   `nft-004-e1` (Standard `'0.05'`; o NFT tem Deluxe `nft-004-e2` a `'0.1'`),
   disparar o cenário `sold-out` (zera e1). Depois, `GET /api/nfts/nft-004`
   retorna topo `priceEth === '0.1'` (menor preço entre edições AINDA
   disponíveis = Deluxe) e `available === 3`.
5. **Filtro de preço opera sobre valor atualizado**: `GET /api/nfts?priceMin=13`
   retorna 0 itens no estado de seed. Com o carrinho contendo apenas
   `nft-012-e1` (`'12.5'`), disparar `price-changed` (409; preço vira
   `'13.75'`). A mesma query passa a retornar exatamente 1 item: `nft-012` com
   `priceEth === '13.75'` no summary.
6. **Merge sem linha zero**: guest adiciona `quantity ≥ 1` de uma edição; a
   edição esgota antes do login (ex.: cenário `sold-out` disparado por outro
   usuário sobre essa edição, ou compra que zera o estoque); após o login,
   `GET /api/cart` não contém nenhuma linha com `quantity === 0` (a linha
   capada a zero foi filtrada no merge) e nenhuma linha pré-existente com
   `quantity > 0` foi perdida.
7. **Checagem estática do float**: nenhum `Number(` aplicado a campo `*Eth` em
   `src/` (o único caso, `fixtures.ts:117`, foi removido) — ampliar/confirmar o
   grep estático do critério 23.
8. **Sem regressão**: o seed permanece idêntico (o teste do critério 22 —
   reset restaura o estado exato — passa sem alteração); os 114 runs
   existentes continuam verdes; `pnpm typecheck`, `pnpm lint`, `pnpm build`,
   `pnpm test` limpos.
