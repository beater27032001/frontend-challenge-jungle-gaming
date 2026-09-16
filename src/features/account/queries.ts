import { queryOptions } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import { api } from '@/lib/api'
import type { Profile, Wallet } from '@/types'

/**
 * Fase 8 (specs/08-perfil-carteiras.md §4). Perfil e carteiras dividem este
 * arquivo porque dividem a tela (mesma Account Sidebar) e a mesma regra de
 * cache: a key carrega o id do usuário, senão o perfil de um aparece para o
 * próximo (regra eliminatória 4). O logout continua limpando tudo (fase 5).
 */
export function useAccountScope(): { scope: string; ready: boolean } {
  const session = useSession()
  return { scope: session.data?.user.id ?? 'guest', ready: !session.isPending }
}

export function profileOptions(scope: string) {
  return queryOptions({
    queryKey: ['profile', scope] as const,
    queryFn: async ({ signal }) => (await api.get<Profile>('/profile', { signal })).data,
  })
}

export function walletsOptions(scope: string) {
  return queryOptions({
    queryKey: ['wallets', scope] as const,
    queryFn: async ({ signal }) => (await api.get<Wallet[]>('/wallets', { signal })).data,
  })
}
