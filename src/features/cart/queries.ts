import { queryOptions, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useSession } from '@/features/auth/use-session'
import { api } from '@/lib/api'
import type { Cart, Network, Quote } from '@/types'

/**
 * Carrinho e cotação (specs/06-carrinho.md §4). Duas regras do CLAUDE.md
 * moldam este arquivo:
 *
 * - **Query key com o dono** (`['cart', scope]`): `ownerKey` no mock devolve
 *   `'guest'` sem sessão, então o mesmo endpoint serve dois donos distintos.
 *   Sem o `scope` na key, o carrinho de um usuário apareceria para o próximo
 *   (regra eliminatória 4).
 * - **Nenhum valor calculado localmente**: subtotal vem de `GET /cart`;
 *   desconto, taxa de rede e total vêm de `POST /quote`. Nada de `big.js`
 *   aqui — a matemática é do mock.
 */

/** `guest` enquanto a sessão não resolve ou não existe; `ready` evita a
 * consulta dupla (visitante → usuário) no primeiro paint. */
export function useCartScope(): { scope: string; ready: boolean } {
  const session = useSession()
  return { scope: session.data?.user.id ?? 'guest', ready: !session.isPending }
}

/** Chave canônica do carrinho. Existe separada porque a fase 9 invalida o
 * resumo a partir de `nft.updated` (§7, passo 3) sem montar a query. */
export function cartKey(scope: string) {
  return ['cart', scope] as const
}

export function cartOptions(scope: string) {
  return queryOptions({
    queryKey: cartKey(scope),
    queryFn: async ({ signal }) => (await api.get<Cart>('/cart', { signal })).data,
  })
}

/**
 * `POST /quote` é mutation em HTTP e leitura em semântica: o resultado é
 * derivado do carrinho + cupom + rede, e re-renderiza sozinho quando qualquer
 * um muda. Modelado como query (com os parâmetros na key) e não como mutation
 * para que o painel de resumo tenha estados de pending/erro/refetch de graça.
 *
 * Retry só em falha de servidor: cupom inválido/expirado (400) e conflito de
 * disponibilidade (409) são respostas finais — repetir não muda o veredito e
 * atrasa o erro na tela.
 */
export function quoteOptions(scope: string, couponCode: string | undefined, network: Network) {
  return queryOptions({
    queryKey: ['quote', scope, { couponCode: couponCode ?? null, network }] as const,
    queryFn: async ({ signal }) =>
      (await api.post<Quote>('/quote', { couponCode, network }, { signal })).data,
    retry: (count, error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined
      return (status === undefined || status >= 500) && count < 1
    },
  })
}

/** Contagem para o badge do header/TabBar: soma de quantidades, não de linhas. */
export function useCartCount(): number {
  const { scope, ready } = useCartScope()
  const cart = useQuery({ ...cartOptions(scope), enabled: ready })
  return cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
}
