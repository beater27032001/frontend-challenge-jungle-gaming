import type {
  NftDetail,
  Order,
  Quote,
  SessionUser,
  Wallet,
} from '@/types'
import { buildInitialDb, refreshNftDerived, SEED_VERSION } from './fixtures'

/**
 * In-memory store backing every MSW handler, hydrated from and persisted to
 * localStorage so state survives reloads (as the real backend would).
 * Handlers run in the page context (not the service worker), so localStorage
 * is directly reachable here.
 */

const STORAGE_KEY = 'greenmint:db:v1'

export interface Db {
  seedVersion: number
  users: Array<SessionUser & { passwordHash: string; salt: string; bio: string; createdAt: string }>
  sessions: Record<string /* token */, { userId: string; expiresAt: string }>
  nfts: NftDetail[]
  favorites: Record<string /* userId */, string[]>
  carts: Record<
    string /* userId | 'guest' */,
    Array<{ id: string; nftId: string; editionId: string; quantity: number }>
  >
  quotes: Record<string, Quote & { ownerId: string }>
  orders: Array<Order & { ownerId: string }>
  idempotency: Record<string /* chave */, { fingerprint: string; orderId: string }>
  coupons: Array<{ code: string; percentOff: number; expiresAt: string }>
  counters: { cartItem: number; quote: number; order: number; wallet: number }
  wallets: Record<string /* userId */, Wallet[]>
}

export const db: Db = buildInitialDb()

function reseed(): void {
  Object.assign(db, buildInitialDb())
}

/** Reads localStorage; reseeds from fixtures when absent or out of date. */
export function hydrateDb(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    reseed()
    persist()
    return
  }
  try {
    const parsed = JSON.parse(raw) as Db
    if (parsed.seedVersion !== SEED_VERSION) {
      reseed()
    } else {
      Object.assign(db, parsed)
    }
  } catch {
    reseed()
  }
  persist()
}

export function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

/** Restores the exact initial fixture state. */
export function resetDb(): void {
  reseed()
  persist()
}

/**
 * Marca um NFT como alterado: sobe a `version` E recalcula os campos derivados
 * do summary (`priceEth`, `available`). O nome fala só da versão por histórico —
 * chame isto após QUALQUER mutação de edição, nunca só `nft.version += 1`.
 */
export function bumpNftVersion(nftId: string): void {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (nft) {
    nft.version += 1
    refreshNftDerived(nft)
  }
}

export function findUserByToken(
  token: string | undefined,
): { user: Db['users'][number]; expired: boolean } | null {
  if (!token) return null
  const session = db.sessions[token]
  if (!session) return null
  const user = db.users.find((u) => u.id === session.userId)
  if (!user) return null
  const expired = Date.now() >= new Date(session.expiresAt).getTime()
  return { user, expired }
}
