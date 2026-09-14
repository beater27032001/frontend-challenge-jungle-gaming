import { z } from 'zod'

/** Auth contracts: register/login payloads + the session shape both return. */

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})
export type RegisterRequest = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof loginSchema>

export interface SessionUser {
  id: string
  name: string
  email: string
  avatarUrl: string
}

export interface Session {
  user: SessionUser
  expiresAt: string // ISO
}
