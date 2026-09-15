import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/lib/api'
import type { Session } from '@/types'

/**
 * No login UI exists yet (fase 5) — this hook only exists to scope catalogue
 * query keys by user (CLAUDE.md rule) so cache never leaks between a guest
 * and a logged-in user. An anonymous visitor's 401 is the default, expected
 * shape, not a failure: it resolves to `null` instead of throwing, so Query
 * never enters an error state. O console do navegador NÃO fica silencioso: o
 * Chromium loga a resposta 401 na camada de rede, fora do alcance do JS — é
 * por isso que `isExpectedBootNoise` existe em `e2e/helpers.ts`, escopado a
 * esta rota.
 */
export function useSession(): UseQueryResult<Session | null> {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return (await api.get<Session>('/auth/session')).data
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) return null
        throw err
      }
    },
    retry: false,
  })
}
