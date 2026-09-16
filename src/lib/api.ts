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

/**
 * Unwraps the `{ error: { code, message } }` envelope of `src/types/common.ts`
 * from an Axios failure. Um lugar só: o carrinho precisa do `code` (cupom
 * inválido vs. expirado vs. conflito de disponibilidade), não só da mensagem.
 */
export function apiErrorOf(error: unknown): ApiError['error'] | null {
  return (isAxiosError<ApiError>(error) && error.response?.data?.error) || null
}
