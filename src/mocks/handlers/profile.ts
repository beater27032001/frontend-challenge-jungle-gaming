import { http, HttpResponse } from 'msw'
import { changePasswordSchema, updateProfileSchema } from '@/types'
import type { Profile } from '@/types'
import { persist } from '../db'
import { withScenario } from '../scenarios'
import { apiError, parseBody, requireSession, sha256Hex } from '../utils'

/** Collector profile: read, patch (email is immutable), change password. */

function toProfile(user: { id: string; name: string; email: string; avatarUrl: string; bio: string; createdAt: string }): Profile {
  const { id, name, email, avatarUrl, bio, createdAt } = user
  return { id, name, email, avatarUrl, bio, createdAt }
}

export const profile = [
  http.get(
    '/api/profile',
    withScenario(({ cookies }) => HttpResponse.json(toProfile(requireSession(cookies)))),
  ),

  http.patch(
    '/api/profile',
    withScenario(async ({ request, cookies }) => {
      const user = requireSession(cookies)
      const body = await parseBody(request, updateProfileSchema)
      if (body.name !== undefined) user.name = body.name
      if (body.avatarUrl !== undefined) user.avatarUrl = body.avatarUrl
      if (body.bio !== undefined) user.bio = body.bio
      persist()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.post(
    '/api/profile/password',
    withScenario(async ({ request, cookies }) => {
      const user = requireSession(cookies)
      const body = await parseBody(request, changePasswordSchema)
      const currentHash = await sha256Hex(user.salt + body.currentPassword)
      if (currentHash !== user.passwordHash) {
        return apiError(400, 'validation_error', 'Senha atual incorreta.', {
          currentPassword: 'Senha atual incorreta.',
        })
      }
      const salt = crypto.randomUUID()
      user.salt = salt
      user.passwordHash = await sha256Hex(salt + body.newPassword)
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
