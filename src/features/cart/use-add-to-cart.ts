import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { AddCartItemRequest, Cart } from '@/types'

/**
 * Primeiro arquivo do domínio cart (fase 4, `nft.$nftId` "Comprar"); a fase 6
 * reutiliza para a tela de carrinho. `POST /cart/items` é a única fonte de
 * verdade da compra — nenhum sucesso otimista (CLAUDE.md regra 3): o toast só
 * dispara depois da resposta 200.
 */
export function useAddToCart(): UseMutationResult<Cart, unknown, AddCartItemRequest> {
  return useMutation({
    mutationFn: async (body: AddCartItemRequest) => (await api.post<Cart>('/cart/items', body)).data,
    onSuccess: () => {
      toast.success('Adicionado ao carrinho')
    },
    onError: (error) => {
      const message =
        isAxiosError<{ error?: { message?: string } }>(error) && error.response?.data?.error?.message
      toast.error(message || 'Não foi possível adicionar ao carrinho.')
    },
  })
}
