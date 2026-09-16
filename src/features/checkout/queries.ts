import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Order, Wallet } from '@/types'

/**
 * Chave canônica do pedido. A tela de pagamento/confirmação é a fase 7; aqui
 * só nasce a chave, porque `order.updated` (fase 9) precisa de um lugar
 * determinístico para escrever o novo estado — e a fase 7 lê daqui sem
 * renegociar contrato.
 *
 * **`refetchInterval` só enquanto `pending`** (ajuste da fase 7). A fase 9
 * deixou a query sem polling nenhum, com o argumento de que o estado chega por
 * `order.updated`. Isso vale para a página que criou o pedido — mas NÃO para a
 * recuperação após refresh: o `setTimeout` que resolve o pagamento no mock morre
 * com a página anterior, e quem resolve na carga nova é o próprio
 * `GET /orders/:id` (ARCHITECTURE.md decisão 27). Sem uma segunda leitura, um
 * pedido recarregado antes dos 1500ms ficaria `pending` para sempre — e
 * "recuperação após refresh" é requisito explícito do §3.
 *
 * O intervalo é curto e **para sozinho no estado terminal**: confirmado e
 * recusado nunca voltam a `pending`, então não há polling perpétuo. Isto não
 * substitui o evento (que continua chegando primeiro no caminho normal); é a
 * rede de segurança do caminho em que não há emissor vivo.
 */
export function orderKey(scope: string, orderId: string) {
  return ['orders', scope, orderId] as const
}

export function orderOptions(scope: string, orderId: string) {
  return queryOptions({
    queryKey: orderKey(scope, orderId),
    queryFn: async ({ signal }) => (await api.get<Order>(`/orders/${orderId}`, { signal })).data,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 1000 : false),
  })
}

/**
 * Carteiras cadastradas (CHALLENGE §3: "utilizar as carteiras cadastradas").
 * A key leva o escopo pelo mesmo motivo do carrinho — `GET /wallets` exige
 * sessão e serve dois donos diferentes na mesma aba ao longo da vida do app.
 *
 * A fase 8 é a dona do CRUD de carteiras; aqui só existe a leitura que o
 * checkout precisa para montar o seletor, e ela reusa esta key em vez de
 * criar outra.
 */
export function walletsKey(scope: string) {
  return ['wallets', scope] as const
}

export function walletsOptions(scope: string) {
  return queryOptions({
    queryKey: walletsKey(scope),
    queryFn: async ({ signal }) => (await api.get<Wallet[]>('/wallets', { signal })).data,
  })
}
