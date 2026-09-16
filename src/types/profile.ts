import { z } from 'zod'

/** Profile contracts. Email is immutable in this phase. */

export interface Profile {
  id: string
  name: string
  /** Único entre todos os usuários — PATCH devolve 409 em colisão. */
  username: string
  email: string
  /** Nome ENS completo, com sufixo (ex.: `ana.eth`); '' quando não há. */
  ensName: string
  avatarUrl: string
  bio: string
  createdAt: string
}

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  // Fase 8 (specs/08-perfil-carteiras.md §2.4): o Figma desenha "Nome de
  // usuário" e "Nome ENS", e campo que a API ignora é mentira de UI (regra 5
  // do desafio). O formato do username não está no Figma — só o mínimo para
  // ser um identificador utilizável.
  username: z.string().min(3).max(24).optional(),
  // String vazia é "sem ENS": o campo é livre e limpável.
  ensName: z.union([z.string().max(64), z.literal('')]).optional(),
  // '' limpa o avatar (o "Remover" do Figma, §2.1). NÃO é `.url()`: os avatares
  // do mock são caminhos locais (`/nft/ape-01.webp`, fase 1) e o "Alterar" da
  // tela grava a imagem escolhida como `data:` URL — `.url()` recusava os dois,
  // o que fazia todo PATCH de perfil voltar 400.
  avatarUrl: z
    .union([
      z.literal(''),
      z.string().regex(/^(\/|https?:\/\/|data:image\/)/, 'Informe uma imagem válida.'),
    ])
    .optional(),
  bio: z.string().max(280).optional(),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
