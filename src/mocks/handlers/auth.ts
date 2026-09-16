import { http, HttpResponse } from 'msw'
import { loginSchema, registerSchema } from '@/types'
import type { Session, SessionUser } from '@/types'
import { db, findUserByToken, persist } from '../db'
import { activeScenario, withScenario } from '../scenarios'
import { apiError, parseBody, sha256Hex } from '../utils'
import { mergeGuestCartInto } from './cart'

/** Register/login/session/logout — sessions live in a `gm_session` cookie. */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const SESSION_COOKIE = 'gm_session'

function toSessionUser(user: (typeof db.users)[number]): SessionUser {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
}

function createSession(userId: string): { token: string; expiresAt: string } {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.sessions[token] = { userId, expiresAt }
  return { token, expiresAt }
}

function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/`
}

export const auth = [
  http.post(
    '/api/auth/register',
    withScenario(async ({ request }) => {
      const body = await parseBody(request, registerSchema)

      if (activeScenario() === 'register-conflict') {
        return apiError(409, 'email_taken', 'Este e-mail já está cadastrado.')
      }
      const exists = db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())
      if (exists) {
        return apiError(409, 'email_taken', 'Este e-mail já está cadastrado.')
      }

      const salt = crypto.randomUUID()
      const passwordHash = await sha256Hex(salt + body.password)
      const id = `u_${crypto.randomUUID()}`
      const user = {
        id,
        name: body.name,
        // Fase 8: `username` é único (o PATCH do perfil devolve 409 em
        // colisão), então o valor inicial precisa nascer único também — a
        // parte local do e-mail, que já é único, e não o nome digitado.
        username: body.email.split('@')[0].slice(0, 24),
        ensName: '',
        email: body.email,
        avatarUrl: '/nft/ape-01.webp', // local asset, spec §5
        bio: '',
        createdAt: new Date().toISOString(),
        passwordHash,
        salt,
      }
      db.users.push(user)

      const { token, expiresAt } = createSession(id)
      mergeGuestCartInto(id)
      persist()

      const session: Session = { user: toSessionUser(user), expiresAt }
      return HttpResponse.json(session, {
        status: 201,
        headers: { 'Set-Cookie': sessionCookieHeader(token) },
      })
    }),
  ),

  http.post(
    '/api/auth/login',
    withScenario(async ({ request }) => {
      const body = await parseBody(request, loginSchema)
      const user = db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      if (!user) return apiError(401, 'invalid_credentials', 'E-mail ou senha inválidos.')

      const hash = await sha256Hex(user.salt + body.password)
      if (hash !== user.passwordHash) {
        return apiError(401, 'invalid_credentials', 'E-mail ou senha inválidos.')
      }

      const { token, expiresAt } = createSession(user.id)
      mergeGuestCartInto(user.id)
      persist()

      const session: Session = { user: toSessionUser(user), expiresAt }
      return HttpResponse.json(session, {
        status: 200,
        headers: { 'Set-Cookie': sessionCookieHeader(token) },
      })
    }),
  ),

  http.get(
    '/api/auth/session',
    withScenario(({ cookies }) => {
      const token = cookies[SESSION_COOKIE]
      const found = findUserByToken(token)
      if (!found) return apiError(401, 'unauthorized', 'Sessão ausente ou inválida.')
      if (found.expired || activeScenario() === 'session-expired') {
        return apiError(401, 'session_expired', 'Sessão expirada.')
      }
      const record = db.sessions[token!]!
      const session: Session = { user: toSessionUser(found.user), expiresAt: record.expiresAt }
      return HttpResponse.json(session)
    }),
  ),

  http.post(
    '/api/auth/logout',
    withScenario(({ cookies }) => {
      const token = cookies[SESSION_COOKIE]
      if (token) delete db.sessions[token]
      persist()
      return new HttpResponse(null, {
        status: 204,
        headers: { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0` },
      })
    }),
  ),
]
