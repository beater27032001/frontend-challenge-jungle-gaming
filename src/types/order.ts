import { z } from 'zod'
import type { EthAmount } from './common'
import type { QuoteItem } from './quote'
import { NETWORKS } from './wallet'
import type { Network } from './wallet'

/** Order contracts: an immutable receipt snapshot resolved after creation. */

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export const createOrderSchema = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  network: z.enum(NETWORKS),
  payer: z.object({ name: z.string().min(2), email: z.string().email() }),
})
export type CreateOrderRequest = z.infer<typeof createOrderSchema>

/** Recibo = snapshot imutável da cotação no momento da criação. */
export interface Order {
  id: string // "ord_1"…
  status: OrderStatus
  items: QuoteItem[] // snapshot, nunca relido do catálogo
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
  coupon?: { code: string; percentOff: number }
  network: Network
  walletAddress: string // snapshot da carteira usada
  payer: { name: string; email: string }
  txHash?: string // presente quando confirmed; determinístico a partir do id
  explorerUrl?: string // `https://example.com/tx/${txHash}` (simulado)
  declineReason?: string // presente quando declined
  createdAt: string
  resolvedAt?: string
  version: number // 1 = pending, 2 = confirmed/declined
}
