import { queryOptions, useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { FavoritesResponse } from '@/types'

/**
 * Fase 5 (specs/05-auth.md §4): favoritos são domínio nft, não uma feature
 * própria — mesma convenção de `queries.ts` (`['recurso', scope, ...]`).
 * `enabled` fica a cargo do call-site (`enabled: !!session.data`, mesmo
 * padrão de `nftListOptions`): visitante nunca dispara `GET /favorites`.
 */
export function favoritesOptions(scope: string) {
  return queryOptions({
    queryKey: ['favorites', scope] as const,
    queryFn: async ({ signal }) => (await api.get<FavoritesResponse>('/favorites', { signal })).data,
  })
}

/**
 * Otimista (padrão canônico TanStack v5, mesmo formato de rollback do
 * `use-add-to-cart.ts` para o toast de erro): `onMutate` já reflete o toggle
 * antes da resposta (critério 10 — visível com o cenário `slow`); `onError`
 * restaura o snapshot anterior (critério 10 — provado com `server-error`);
 * `onSettled` sempre revalida contra o servidor, então um duplo clique
 * rápido converge para o estado real independente da ordem de chegada
 * (edge case "não pode piscar errado após as respostas").
 */
export function useToggleFavorite(
  scope: string,
): UseMutationResult<FavoritesResponse, unknown, { nftId: string; favorited: boolean }> {
  const queryClient = useQueryClient()
  const queryKey = favoritesOptions(scope).queryKey

  return useMutation({
    mutationFn: async ({ nftId, favorited }) =>
      favorited
        ? (await api.delete<FavoritesResponse>(`/favorites/${nftId}`)).data
        : (await api.put<FavoritesResponse>(`/favorites/${nftId}`)).data,
    onMutate: async ({ nftId, favorited }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<FavoritesResponse>(queryKey)
      queryClient.setQueryData<FavoritesResponse>(queryKey, (current) => {
        const ids = current?.nftIds ?? []
        return { nftIds: favorited ? ids.filter((id) => id !== nftId) : [...ids, nftId] }
      })
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      const message =
        isAxiosError<{ error?: { message?: string } }>(error) && error.response?.data?.error?.message
      toast.error(message || 'Não foi possível atualizar seus favoritos.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
