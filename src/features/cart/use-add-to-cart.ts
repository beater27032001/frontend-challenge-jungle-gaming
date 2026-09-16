import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, apiErrorOf } from '@/lib/api'
import type { AddCartItemRequest, Cart } from '@/types'
import { cartOptions, useCartScope } from './queries'

/**
 * Primeiro arquivo do domínio cart (fase 4, `nft.$nftId` "Comprar"); a fase 6
 * reutiliza para a tela de carrinho. `POST /cart/items` é a única fonte de
 * verdade da compra — nenhum sucesso otimista (CLAUDE.md regra 3): o toast só
 * dispara depois da resposta 200.
 *
 * A fase 6 acrescentou a sincronia de cache: a resposta já é o carrinho
 * completo, então vai direto para `['cart', scope]` (badge do header e tela do
 * carrinho) e invalida a cotação daquele dono.
 */
export function useAddToCart(): UseMutationResult<Cart, unknown, AddCartItemRequest> {
  const client = useQueryClient()
  const { scope } = useCartScope()
  return useMutation({
    mutationFn: async (body: AddCartItemRequest) => (await api.post<Cart>('/cart/items', body)).data,
    onSuccess: (cart) => {
      client.setQueryData(cartOptions(scope).queryKey, cart)
      client.invalidateQueries({ queryKey: ['quote', scope] })
      toast.success('Adicionado ao carrinho')
    },
    onError: (error) => {
      toast.error(apiErrorOf(error)?.message || 'Não foi possível adicionar ao carrinho.')
    },
  })
}
