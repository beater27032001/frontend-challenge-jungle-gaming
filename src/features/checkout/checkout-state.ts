import type { ApiError, EthAmount, Network, Order, QuoteItem, Wallet } from '@/types'

/**
 * Estado do checkout elevado à rota (`routes/pagamento.tsx`), mesmo padrão de
 * `features/cart/cart-state.ts`: `CheckoutDesktop` e `CheckoutMobile` são
 * composições distintas (specs/07-checkout.md §2 e §6) que montam ao mesmo
 * tempo (`hidden lg:*` / `lg:hidden`), então nenhuma das duas pode ser dona do
 * estado.
 */

/**
 * Fase da confirmação. Uma união discriminada em vez de cinco booleanos
 * (`isSubmitting`, `hasTimedOut`, `needsRevalidation`…) porque os estados são
 * mutuamente exclusivos e cada composição precisa renderizar exatamente um
 * deles — com booleanos separados existiria a combinação impossível
 * "confirmado e aguardando" e as duas telas teriam de decidir a precedência
 * por conta própria.
 *
 * `pending`, `confirmed` e `declined` só existem com um `Order` real vindo da
 * API: é isto que garante a regra eliminatória 3 (nenhuma compra confirmada
 * sem resposta da simulação) por construção de tipo, não por disciplina.
 */
export type ConfirmPhase =
  /** Nada enviado ainda. */
  | { kind: 'idle' }
  /** `POST /orders` no ar. */
  | { kind: 'submitting' }
  /**
   * Erro de rede: o pedido PODE ter sido criado (é exatamente o cenário
   * `order-timeout`). Reenviar com a MESMA chave de idempotência recupera o
   * mesmo pedido — nunca cria um segundo.
   */
  | { kind: 'timeout' }
  /**
   * 409 do servidor (`quote_outdated` / `availability_conflict`) ou cotação
   * detectada obsoleta no cliente (`isQuoteStale`). Exige recotar e uma NOVA
   * confirmação explícita (CHALLENGE §3).
   */
  | { kind: 'revalidate'; message: string }
  /** Qualquer outra falha da criação. */
  | { kind: 'error'; message: string }
  | { kind: 'pending'; order: Order }
  | { kind: 'confirmed'; order: Order }
  | { kind: 'declined'; order: Order }

/**
 * Deriva a fase a partir das três fontes que a decidem. Pura e sem React de
 * propósito: é a regra que o teste E2E cobra e que as duas composições leem.
 *
 * Precedência, e o porquê de cada uma:
 *
 * 1. **O pedido ganha de tudo.** Existindo pedido, ele é o estado do mundo —
 *    confirmado e recusado são terminais (§4), e um 409 de uma tentativa
 *    anterior não pode reaparecer por cima de um recibo.
 * 2. **Erro de rede vem antes da cotação obsoleta.** Um `POST` que falhou sem
 *    resposta pode ter criado o pedido E derrubado a versão do NFT (o commit
 *    acontece antes do `HttpResponse.error()` no cenário `order-timeout`), o
 *    que torna a cotação obsoleta como *consequência* do envio. Tratar isso
 *    como "recotar" mandaria o usuário criar um segundo pedido — o oposto do
 *    requisito. Reenviar é o caminho certo.
 * 3. **Cotação obsoleta bloqueia antes de qualquer envio novo** (passo 4 do
 *    cenário obrigatório do §7).
 */
export function confirmPhaseOf(input: {
  order: Order | undefined
  isSubmitting: boolean
  /** Erro da mutation de criação, já desembrulhado; `null` se houve resposta. */
  createError: { networkFailure: boolean; error: ApiError['error'] | null } | null
  staleQuote: boolean
}): ConfirmPhase {
  const { order, isSubmitting, createError, staleQuote } = input

  if (order) return { kind: order.status, order } as ConfirmPhase
  if (isSubmitting) return { kind: 'submitting' }

  if (createError) {
    if (createError.networkFailure) return { kind: 'timeout' }
    const code = createError.error?.code
    if (code === 'quote_outdated' || code === 'availability_conflict') {
      return { kind: 'revalidate', message: createError.error!.message }
    }
    return { kind: 'error', message: createError.error?.message ?? 'Não foi possível enviar o pedido.' }
  }

  if (staleQuote) {
    return {
      kind: 'revalidate',
      message: 'O preço ou a disponibilidade de um item mudou depois da cotação. Atualize a cotação e confirme de novo.',
    }
  }

  return { kind: 'idle' }
}

/**
 * O que a coluna "Seus NFTs" (§2) e o recibo (§3) precisam mostrar. `Quote` e
 * `Order` satisfazem os dois esta mesma forma, o que é o ponto: antes de
 * enviar, a fonte é a cotação; depois, é o pedido — que é um snapshot imutável
 * dela. Uma interface só, e a tela não precisa saber qual das duas está lendo.
 */
export interface OrderSummary {
  items: QuoteItem[]
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
  coupon?: { code: string; percentOff: number }
}

/** Confirmar só é possível com carteira escolhida, cotação válida e nenhuma
 * pendência — e nunca quando já existe pedido (terminal ou em andamento). */
export function canConfirm(
  phase: ConfirmPhase,
  walletId: string | null,
  summary: OrderSummary | null,
): boolean {
  return phase.kind === 'idle' && !!walletId && !!summary && summary.items.length > 0
}

export interface CheckoutViewProps {
  payer: { name: string; email: string }
  /** Cotação antes do envio; pedido depois dele. */
  summary: OrderSummary | null
  quoteError: ApiError['error'] | null
  isQuotePending: boolean
  wallets: Wallet[]
  isWalletsPending: boolean
  walletId: string | null
  onSelectWallet: (walletId: string | null) => void
  network: Network
  onSelectNetwork: (network: Network) => void
  appliedCoupon: string | null
  couponDraft: string
  onCouponDraftChange: (value: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  phase: ConfirmPhase
  onConfirm: () => void
  /** Reenvio com a mesma chave de idempotência (estado `timeout`). */
  onResend: () => void
  /** Recotar: novo `POST /quote`, que destrava a confirmação. */
  onRefreshQuote: () => void
  /** Abre o recibo de um pedido confirmado (o modal mora na rota). */
  onOpenReceipt: () => void
}

/** Sem cotação não existe valor para mostrar; inventar "0" seria cálculo local
 * disfarçado (mesmo contrato de `cart-state.ts`). */
export const NO_VALUE = '—'

export function ethLabel(value: EthAmount | undefined): string {
  return value === undefined ? NO_VALUE : `${value} ETH`
}

/** `0x473f34be…cf0b` → `0x473f…cf0b`, o formato que o Figma desenha
 * (`0xA91F…E82C`, spec §3 e §6.3): 6 caracteres + elipse + 4. */
export function shortHex(value: string | undefined): string {
  if (!value) return NO_VALUE
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`
}

/** Cupom inválido/expirado é erro de campo; qualquer outro é erro de painel. */
export function couponErrorOf(error: ApiError['error'] | null): string | null {
  if (!error) return null
  return error.code === 'coupon_invalid' || error.code === 'coupon_expired' ? error.message : null
}
