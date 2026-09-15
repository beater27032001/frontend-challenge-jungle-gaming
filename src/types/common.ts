/** Shared REST contract primitives: error envelope, pagination, ETH amounts. */

/** String decimal, ex.: "0.045". Nunca number. Cálculo só via src/lib/money.ts. */
export type EthAmount = string

export type ApiErrorCode =
  | 'validation_error' // 400 — corpo/params inválidos; details = erro por campo
  | 'invalid_credentials' // 401 — login errado
  | 'unauthorized' // 401 — sem sessão
  | 'session_expired' // 401 — sessão existiu e expirou
  | 'forbidden' // 403 — recurso de outro usuário
  | 'not_found' // 404
  | 'email_taken' // 409 — conflito de cadastro
  | 'conflict' // 409 — conflito genérico (ex.: endereço de carteira duplicado)
  | 'availability_conflict' // 409 — quantidade > disponível / edição esgotada
  | 'quote_outdated' // 409 — preço/cupom/taxa mudou entre cotação e pedido
  | 'idempotency_conflict' // 409 — mesma chave, conteúdo diferente
  | 'coupon_invalid' // 400
  | 'coupon_expired' // 400
  | 'transient' // 500/503 — falha transitória, retry recupera

export interface ApiError {
  error: { code: ApiErrorCode; message: string; details?: Record<string, string> }
}

export interface Paginated<T> {
  items: T[]
  page: number // 1-based
  perPage: number
  total: number
  totalPages: number
}
