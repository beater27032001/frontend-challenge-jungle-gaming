import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api, apiErrorOf } from '@/lib/api'
import { cartKey } from '@/features/cart/queries'
import type { ApiError, CreateOrderRequest, Order } from '@/types'
import { orderKey } from './queries'

/**
 * `POST /orders` — a mutation mais delicada do desafio (§3: "impedir pedidos
 * duplicados em cliques repetidos ou reenvios após timeout").
 *
 * **A chave de idempotência é derivada, não sorteada.** `order:{quoteId}:{walletId}`
 * é determinística e por isso resolve os três casos de uma vez:
 *
 * - **clique repetido**: o botão já fica desabilitado por `isPending`, mas se
 *   dois envios escaparem, a segunda chamada cai no `db.idempotency` do mock e
 *   volta o MESMO pedido com 200;
 * - **reenvio após timeout**: o cenário `order-timeout` cria o pedido e devolve
 *   erro de rede. O reenvio recalcula exatamente a mesma chave — sem depender
 *   de `useRef`, de `sessionStorage`, nem de a página ter sobrevivido —, então
 *   recupera o pedido criado em vez de criar um segundo;
 * - **refresh no meio do envio**: idem, a chave renasce igual.
 *
 * A chave inclui `walletId` porque o `walletId` entra no corpo e o contrato
 * devolve 409 `idempotency_conflict` para mesma chave com corpo diferente
 * (fase 1). `network` não precisa entrar: ela faz parte da cotação, então
 * mudar de rede já produz outro `quoteId`. `payer` vem da sessão, é constante
 * dentro de um escopo. Resultado: a relação chave↔corpo é 1:1, e o 409 de
 * conflito nunca é alcançável por navegação normal.
 */
export function idempotencyKeyFor(quoteId: string, walletId: string): string {
  return `order:${quoteId}:${walletId}`
}

/** Erro de rede (sem resposta) vs. erro com resposta — a distinção que separa
 * "reenvie a mesma tentativa" de "o servidor recusou". */
export function createErrorOf(
  error: unknown,
): { networkFailure: boolean; error: ApiError['error'] | null } | null {
  if (!error) return null
  const noResponse = isAxiosError(error) && !error.response
  return { networkFailure: noResponse, error: apiErrorOf(error) }
}

export function useCreateOrder(scope: string): UseMutationResult<Order, unknown, CreateOrderRequest> {
  const client = useQueryClient()
  return useMutation({
    // `retry` fica no default (0) de propósito: reenviar automaticamente
    // esconderia do usuário o estado de timeout que o §3 pede para representar,
    // e o reenvio é uma decisão dele.
    mutationFn: async (body: CreateOrderRequest) =>
      (
        await api.post<Order>('/orders', body, {
          headers: { 'Idempotency-Key': idempotencyKeyFor(body.quoteId, body.walletId) },
        })
      ).data,
    onSuccess: (order) => {
      // O pedido nasce `pending` e resolve por `order.updated` (fase 9), que
      // escreve nesta mesma chave. Plantar a resposta aqui evita um GET
      // redundante logo depois do POST.
      client.setQueryData(orderKey(scope, order.id), order)
      // O mock já debitou as linhas compradas do carrinho; o badge do header e
      // a tela do carrinho precisam disso. A cotação SAI do cache em vez de ser
      // invalidada: com o carrinho vazio, `POST /quote` responde 400
      // "Carrinho vazio." (mesmo raciocínio de `cart/mutations.ts`).
      client.invalidateQueries({ queryKey: cartKey(scope) })
      client.removeQueries({ queryKey: ['quote', scope] })
    },
    // Sem `onError` com toast: a tela precisa distinguir timeout (reenviar) de
    // 409 (recotar) de falha genérica, e um toast único apagaria a diferença.
    // Quem renderiza é `ConfirmPhase`.
  })
}
