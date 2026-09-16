import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/lib/api'
import type { Session } from '@/types'

/**
 * Fase 5 (specs/05-auth.md): agora com consumidor real — `AuthModal`
 * (login/cadastro) e `use-auth.ts` (mutations) escrevem nesta mesma
 * `sessionKey` via `queryClient.setQueryData`/`.clear()`. Continua sendo a
 * fonte de verdade de `scope` (CLAUDE.md) e continua tratando o 401 anônimo
 * como resposta válida (`null`), não como erro — um visitante nunca lançou
 * exceção aqui e login/logout não mudam isso. O console do navegador NÃO
 * fica silencioso: o Chromium loga a resposta 401 na camada de rede, fora do
 * alcance do JS — é por isso que `isExpectedBootNoise` existe em
 * `e2e/helpers.ts`, escopado a esta rota.
 */
export const sessionKey = ['session'] as const

/**
 * Fase 8: extraído para `queryOptions` porque o `beforeLoad` das rotas
 * privadas (`/perfil`, `/carteiras`) precisa da MESMA query — proteção de
 * fluxo privado pelo router, como pede o §4 do desafio, sem um segundo
 * caminho de leitura de sessão.
 */
export const sessionOptions = queryOptions({
  queryKey: sessionKey,
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

export function useSession(): UseQueryResult<Session | null> {
  return useQuery(sessionOptions)
}
