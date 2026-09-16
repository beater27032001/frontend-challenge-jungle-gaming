import type { ApiError, CartItem, EthAmount, Quote } from '@/types'

/**
 * Estado do carrinho elevado à rota (`routes/carrinho.tsx`), no mesmo padrão de
 * `features/nft/detail-state.ts`: `CartDesktop` e `CartMobile` são composições
 * distintas (specs/06-carrinho.md §1 e §6) que montam ao mesmo tempo
 * (`hidden lg:*` / `lg:hidden`), então nenhuma das duas pode ser dona do
 * estado — seriam duas cópias a sincronizar.
 */
export interface CartViewProps {
  items: CartItem[]
  /** `GET /cart` — subtotal vem da API mesmo sem cotação (carrinho vazio, ou
   * cupom recusado): nunca é somado aqui. */
  subtotalEth: EthAmount
  /** `POST /quote`: desconto, taxa de rede e total. `null` = sem cotação
   * válida no momento (carrinho vazio, erro, ou primeira carga). */
  quote: Quote | null
  quoteError: ApiError['error'] | null
  isCartPending: boolean
  isQuotePending: boolean
  /** Cupom que está na URL (`?coupon=`), logo sobrevive a refresh. */
  appliedCoupon: string | null
  couponDraft: string
  onCouponDraftChange: (value: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onQuantityDelta: (item: CartItem, delta: 1 | -1) => void
  onRemoveItem: (item: CartItem) => void
  isMutating: boolean
}

/** Cupom inválido/expirado é erro de campo (associado ao input via
 * `aria-describedby`); qualquer outro erro da cotação é erro do painel. */
export function couponErrorOf(error: ApiError['error'] | null): string | null {
  if (!error) return null
  return error.code === 'coupon_invalid' || error.code === 'coupon_expired' ? error.message : null
}

/** Sem cotação não existe valor para mostrar — e inventar "0" seria cálculo
 * local disfarçado. O traço é a ausência explícita. */
export const NO_VALUE = '—'

export function ethLabel(value: EthAmount | undefined): string {
  return value === undefined ? NO_VALUE : `${value} ETH`
}
