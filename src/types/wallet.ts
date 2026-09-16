import { z } from 'zod'

/** Wallet contracts: one primary wallet max per user, enforced by handlers. */

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]
export type WalletRole = 'primary' | 'secondary'

/**
 * Fase 8 (specs/08-perfil-carteiras.md §3.5): o Figma desenha um select
 * "Selecione uma carteira" sem listar as opções — derivadas das que o
 * pagamento mobile oferece (spec 07 §6.4), o que amarra as duas telas.
 */
export const WALLET_TYPES = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletType = (typeof WALLET_TYPES)[number]

export interface Wallet {
  id: string
  label: string
  address: string // 0x + 40 hex
  network: Network
  type: WalletType
  role: WalletRole
  /** Opcional apesar do asterisco no Figma: obrigatório trancaria o cadastro
   * de quem não tem código (desvio registrado em ARCHITECTURE.md). */
  referralCode?: string
  createdAt: string
}

export const walletSchema = z.object({
  label: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'endereço inválido'),
  network: z.enum(NETWORKS),
  type: z.enum(WALLET_TYPES),
  role: z.enum(['primary', 'secondary']),
  referralCode: z.union([z.string().max(32), z.literal('')]).optional(),
})
export type CreateWalletRequest = z.infer<typeof walletSchema>
export type UpdateWalletRequest = Partial<CreateWalletRequest>
