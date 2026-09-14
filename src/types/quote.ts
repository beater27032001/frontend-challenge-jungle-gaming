import { z } from 'zod'
import type { EthAmount } from './common'
import type { Network } from './wallet'

/** Quote contracts: a priced snapshot of a cart, valid for a short window. */

export const quoteRequestSchema = z.object({
  couponCode: z.string().optional(),
  network: z.enum(['ethereum', 'polygon']).default('ethereum'),
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

export interface QuoteItem {
  nftId: string
  editionId: string
  title: string
  editionLabel: string
  quantity: number
  unitPriceEth: EthAmount
  lineTotalEth: EthAmount
  nftVersion: number
}

export interface Quote {
  id: string // "q_1"…, contador determinístico no db
  items: QuoteItem[]
  subtotalEth: EthAmount
  discountEth: EthAmount // "0" sem cupom
  networkFeeEth: EthAmount
  totalEth: EthAmount // subtotal - desconto + taxa (big.js, roundEth)
  coupon?: { code: string; percentOff: number }
  network: Network
  createdAt: string
  expiresAt: string // createdAt + 5 min
}
