import { http, HttpResponse } from 'msw'
import { changePasswordSchema, updateProfileSchema } from '@/types'
import type { Profile } from '@/types'
import { db, persist } from '../db'
import { withScenario } from '../scenarios'
import { apiError, parseBody, requireSession, sha256Hex } from '../utils'

/** Collector profile: read, patch (email is immutable), change password. */

function toProfile(user: (typeof db.users)[number]): Profile {
  const { id, name, username, email, ensName, avatarUrl, bio, createdAt } = user
  return { id, name, username, email, ensName, avatarUrl, bio, createdAt }
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

      // Fase 8 (spec §2.4): `username` é único, como o endereço de carteira.
      // 409 com `details` para a UI poder pendurar o erro NO campo, não só
      // num toast.
      if (body.username !== undefined) {
        const taken = db.users.some(
          (u) => u.id !== user.id && u.username.toLowerCase() === body.username!.toLowerCase(),
        )
        if (taken) {
          return apiError(409, 'conflict', 'Este nome de usuário já está em uso.', {
            username: 'Este nome de usuário já está em uso.',
          })
        }
        user.username = body.username
      }
      if (body.name !== undefined) user.name = body.name
      if (body.ensName !== undefined) user.ensName = body.ensName
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
