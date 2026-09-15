import { z } from 'zod'

/** Wallet contracts: one primary wallet max per user, enforced by handlers. */

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]
export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: string
  label: string
  address: string // 0x + 40 hex
  network: Network
  role: WalletRole
  createdAt: string
}

export const walletSchema = z.object({
  label: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'endereço inválido'),
  network: z.enum(NETWORKS),
  role: z.enum(['primary', 'secondary']),
})
export type CreateWalletRequest = z.infer<typeof walletSchema>
export type UpdateWalletRequest = Partial<CreateWalletRequest>
