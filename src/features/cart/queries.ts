import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Cart } from '@/types'

/**
 * Chave canônica do carrinho. Nasce na fase 9 porque `nft.updated` precisa
 * invalidar o resumo do carrinho (§7, passo 3) e o badge do header precisa de
 * uma contagem real; a tela de carrinho (fase 6) reusa o mesmo `queryOptions`.
 * `scope` (id do usuário ou 'guest') isola o cache entre usuários.
 */
export function cartKey(scope: string) {
  return ['cart', scope] as const
}

export function cartOptions(scope: string) {
  return queryOptions({
    queryKey: cartKey(scope),
    queryFn: async ({ signal }) => (await api.get<Cart>('/cart', { signal })).data,
  })
}
