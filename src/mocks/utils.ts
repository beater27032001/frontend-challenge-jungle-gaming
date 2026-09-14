import { HttpResponse } from 'msw'
import type { ZodType, z } from 'zod'
import type { ApiError, ApiErrorCode } from '@/types'
import { activeScenario } from './scenarios'
import { findUserByToken, type Db } from './db'

/** Small shared helpers used by every resource handler. */

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string>,
): HttpResponse<ApiError> {
  return HttpResponse.json({ error: { code, message, details } }, { status })
}

export async function parseBody<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  const body = await request.json().catch(() => ({}))
  const result = schema.safeParse(body)
  if (!result.success) {
    const details: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '_'
      details[field] = issue.message
    }
    throw apiError(400, 'validation_error', 'Dados inválidos.', details)
  }
  return result.data
}

/**
 * Sem cookie → 401 unauthorized. Token desconhecido (db resetado) → 401
 * unauthorized. Sessão expirada, ou cenário `session-expired` ativo → 401
 * session_expired. Sucesso → o registro completo do usuário no db.
 */
export function requireSession(cookies: Record<string, string>): Db['users'][number] {
  const token = cookies['gm_session']
  const found = findUserByToken(token)
  if (!found) {
    throw apiError(401, 'unauthorized', 'Sessão ausente ou inválida.')
  }
  if (found.expired || activeScenario() === 'session-expired') {
    throw apiError(401, 'session_expired', 'Sessão expirada.')
  }
  return found.user
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
