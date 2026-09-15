import type { EthAmount } from './common'
import type { NftEdition } from './nft'
import type { OrderStatus } from './order'

/** Contrato dos eventos de §7. Handlers de socket entram na fase 9; o tipo nasce aqui. */
export interface RealtimeEvent<TType extends string, TData> {
  eventId: string // identidade estável p/ dedup: `${resource.id}:v${version}`
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  version: number // versão do recurso APÓS o evento; cliente descarta version <= atual
  emittedAt: string
  data: TData
}

export type NftUpdatedEvent = RealtimeEvent<
  'nft.updated',
  {
    priceEth: EthAmount
    available: number
    editions: Array<Pick<NftEdition, 'id' | 'priceEth' | 'available'>>
  }
>

export type OrderUpdatedEvent = RealtimeEvent<
  'order.updated',
  {
    status: OrderStatus
    txHash?: string
    declineReason?: string
  }
>
