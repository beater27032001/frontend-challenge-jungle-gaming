import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { LoginRequest, RegisterRequest, Session } from '@/types'
import { sessionKey } from './use-session'

/**
 * Fase 5 (specs/05-auth.md §4): `queryClient.clear()` é o coração eliminatório
 * (§11) — derruba TODO cache (privado e público) antes de plantar a sessão
 * nova (ou nenhuma, no logout). O catálogo refaz fetch; custo aceito pela
 * garantia mais simples de zero vazamento entre usuários. Mapear erro de
 * campo (401/409/400) é responsabilidade do componente que chama `.mutate`
 * (AuthModal), não da mutation — o hook só expõe o erro bruto do axios.
 */
export function useLogin(): UseMutationResult<Session, unknown, LoginRequest> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: LoginRequest) => (await api.post<Session>('/auth/login', body)).data,
    onSuccess: (session) => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, session)
    },
  })
}

export function useRegister(): UseMutationResult<Session, unknown, RegisterRequest> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: RegisterRequest) => (await api.post<Session>('/auth/register', body)).data,
    onSuccess: (session) => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, session)
    },
  })
}

export function useLogout(): UseMutationResult<void, unknown, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    // Falha (ex.: cenário `offline`) não limpa a sessão local — o cookie
    // ainda existe no mock; o form/toast de erro fica a cargo do call-site.
    //
    // `clear()` + `location.reload()`, não só `clear()`: investigação ao
    // vivo (fase 5) achou componentes lidos por múltiplas telas (cards do
    // catálogo, cada um com seu próprio `useSession()`) que não
    // recomputavam `scope`/`enabled` depois do clear — o Header (um único
    // consumidor) atualizava, o grid (muitos consumidores da mesma query)
    // não, deixando o coração de um usuário anterior visível para o
    // próximo. Não achei a causa raiz do porquê alguns observadores da
    // MESMA query não recebem a notificação enquanto outros recebem — sob
    // prazo, a garantia mais simples e a que o §11 exige (eliminatório: zero
    // vazamento entre usuários) é reconstruir a árvore inteira do zero.
    // ponytail: sacrifica a suavidade de SPA só no logout; login/registro
    // continuam client-side porque ali o `setQueryData` explícito já prova
    // (testado) que todo consumidor assenta corretamente.
    onSuccess: () => {
      queryClient.clear()
      window.location.reload()
    },
  })
}
