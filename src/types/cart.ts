import { z } from 'zod'
import type { EthAmount } from './common'

/** Cart contracts. Items are denormalized on read so price/stock stay fresh. */

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
  id: string // id da linha, "ci_1"…
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

export interface Cart {
  items: CartItem[]
  subtotalEth: EthAmount
}
