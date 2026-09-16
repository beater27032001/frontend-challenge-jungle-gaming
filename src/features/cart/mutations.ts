import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, apiErrorOf } from '@/lib/api'
import type { Cart } from '@/types'
import { cartOptions, useCartScope } from './queries'

/**
 * Alterar quantidade e remover item (specs/06-carrinho.md §4, CHALLENGE §3).
 *
 * As duas rotas devolvem o carrinho inteiro já redenormalizado pelo mock, então
 * a resposta é escrita no cache (`setQueryData`) em vez de disparar um refetch.
 * A cotação, sim, é invalidada: subtotal/desconto/taxa/total mudam e precisam
 * vir da API, nunca de recálculo local.
 *
 * Sem update otimista: a disponibilidade é decidida no servidor (409
 * `availability_conflict`), e antecipar um estado que ele pode recusar é
 * exatamente o "caminho alternativo de negócio" que o CLAUDE.md proíbe.
 */
function useCartWriter() {
  const client = useQueryClient()
  const { scope } = useCartScope()
  return (cart: Cart) => {
    client.setQueryData(cartOptions(scope).queryKey, cart)
    // Carrinho vazio: a cotação sai do cache em vez de ser invalidada —
    // invalidar dispararia um `POST /quote` que o mock recusa com 400
    // "Carrinho vazio." (ruído de rede por um resultado que não existe).
    if (cart.items.length === 0) client.removeQueries({ queryKey: ['quote', scope] })
    else client.invalidateQueries({ queryKey: ['quote', scope] })
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return apiErrorOf(error)?.message || fallback
}

export function useUpdateCartItem(): UseMutationResult<
  Cart,
  unknown,
  { itemId: string; quantity: number }
> {
  const write = useCartWriter()
  return useMutation({
    mutationFn: async ({ itemId, quantity }) =>
      (await api.patch<Cart>(`/cart/items/${itemId}`, { quantity })).data,
    onSuccess: write,
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível alterar a quantidade.')),
  })
}

export function useRemoveCartItem(): UseMutationResult<Cart, unknown, { itemId: string }> {
  const write = useCartWriter()
  return useMutation({
    mutationFn: async ({ itemId }) => (await api.delete<Cart>(`/cart/items/${itemId}`)).data,
    onSuccess: (cart) => {
      write(cart)
      toast.success('Item removido do carrinho')
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível remover o item.')),
  })
}
