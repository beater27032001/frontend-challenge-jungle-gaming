import axios, { isAxiosError } from 'axios'
import type { ApiError } from '@/types'

/**
 * Single Axios instance. Every REST call in the app goes through here so that
 * MSW has exactly one surface to intercept and so auth/error handling lives in
 * one place. Never call fetch() directly in features.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Fase 5 (specs/05-auth.md §4/§6): sessão expira em qualquer chamada
// autenticada, não só em /auth/session — o interceptor de resposta cobre a
// instância inteira. `session_expired` (usuário estava logado) dispara o
// handler; `unauthorized` (visitante anônimo, o 401 default do boot) nunca
// dispara — critério 9 do spec, e é o que mantém os 380 testes existentes
// verdes.
let sessionExpiredHandler: (() => void) | null = null
let firedThisBurst = false

export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler
}

api.interceptors.response.use(undefined, (error) => {
  if (
    isAxiosError<ApiError>(error) &&
    error.response?.status === 401 &&
    error.response.data?.error?.code === 'session_expired'
  ) {
    // Debounce simples por flag: várias queries em voo ao mesmo tempo caem
    // todas em 401 session_expired, mas só a primeira deve navegar/tostar.
    if (!firedThisBurst) {
      firedThisBurst = true
      sessionExpiredHandler?.()
      // ponytail: debounce por tempo (não por promise), porque as N queries
      // em voo resolvem em tasks separadas, não no mesmo microtask; 300ms
      // cobre a rajada real (várias queries lançadas juntas no boot/troca de
      // tela) sem represar um segundo evento genuíno depois de relogar.
      setTimeout(() => {
        firedThisBurst = false
      }, 300)
    }
  }
  return Promise.reject(error)
})

/**
 * Unwraps the `{ error: { code, message } }` envelope of `src/types/common.ts`
 * from an Axios failure. Um lugar só: o carrinho precisa do `code` (cupom
 * inválido vs. expirado vs. conflito de disponibilidade), não só da mensagem.
 */
export function apiErrorOf(error: unknown): ApiError['error'] | null {
  return (isAxiosError<ApiError>(error) && error.response?.data?.error) || null
}
