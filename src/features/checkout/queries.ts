import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Order } from '@/types'

/**
 * Chave canônica do pedido. A tela de pagamento/confirmação é a fase 7; aqui
 * só nasce a chave, porque `order.updated` (fase 9) precisa de um lugar
 * determinístico para escrever o novo estado — e a fase 7 lê daqui sem
 * renegociar contrato.
 *
 * `refetchInterval` não existe de propósito: o estado do pedido chega por
 * evento, e a reconciliação pós-reconexão revalida pelo REST.
 */
export function orderKey(scope: string, orderId: string) {
  return ['orders', scope, orderId] as const
}

export function orderOptions(scope: string, orderId: string) {
  return queryOptions({
    queryKey: orderKey(scope, orderId),
    queryFn: async ({ signal }) => (await api.get<Order>(`/orders/${orderId}`, { signal })).data,
  })
}
