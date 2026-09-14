import { z } from 'zod'

/** Profile contracts. Email is immutable in this phase. */

export interface Profile {
  id: string
  name: string
  email: string
  avatarUrl: string
  bio: string
  createdAt: string
}

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(280).optional(),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
