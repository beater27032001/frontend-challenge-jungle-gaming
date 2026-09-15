import { eth, roundEth } from '@/lib/money'
import { NFT_CATEGORIES } from '@/types'
import type { NftCategory, NftDetail, NftEdition, NftRarity, Network } from '@/types'
import type { Db } from './db'

/**
 * Deterministic seed data: zero PRNG. Every value is derived from fixed
 * tables and the loop index so two fresh builds are byte-identical.
 */

export const SEED_VERSION = 2

// --- fixed tables -----------------------------------------------------

// 9 categories (spec §3: fixtures reconciled with the design system).
// gcd(9,4)=1 against RARITIES below, so every category×rarity pair exists.
const CATEGORIES: NftCategory[] = [...NFT_CATEGORIES]
const RARITIES: NftRarity[] = ['common', 'rare', 'epic', 'legendary']
// Offset by 2 against CATEGORIES so category/rarity combinations vary.
const RARITY_OFFSET = 2

const PRICE_TABLE = [
  '0.008',
  '0.015',
  '0.03',
  '0.05',
  '0.08',
  '0.12',
  '0.25',
  '0.45',
  '0.75',
  '1.2',
  '3.5',
  '12.5',
]

const ADJECTIVES = [
  'Solar',
  'Neon',
  'Crimson',
  'Obsidian',
  'Astral',
  'Verdant',
  'Glacial',
  'Ember',
]
const NOUNS = ['Drift', 'Bloom', 'Circuit', 'Mirage', 'Echo', 'Fable']

const CREATORS = [
  { id: 'creator-1', name: 'Lior Sato' },
  { id: 'creator-2', name: 'Maya Odera' },
  { id: 'creator-3', name: 'Théo Brandt' },
  { id: 'creator-4', name: 'Nadia Reyes' },
  { id: 'creator-5', name: 'Ken Alvarez' },
  { id: 'creator-6', name: 'Iris Fontaine' },
// External placeholder-image debt paid off (spec §5): reuse the 4 local NFT
// artworks as avatar crops instead — less code than a separate initials
// component, and sanctioned by the design system ("recortes dos mesmos assets").
].map((c, idx) => ({ ...c, avatarUrl: `/nft/ape-0${(idx % 4) + 1}.webp` }))

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.0025',
  polygon: '0.0008',
  solana: '0.0001', // dado de mock determinístico (não é medida de Figma)
}

export const COUPONS: Array<{ code: string; percentOff: number; expiresAt: string }> = [
  { code: 'GREEN10', percentOff: 10, expiresAt: '2027-01-01T00:00:00.000Z' },
  { code: 'EXPIRED20', percentOff: 20, expiresAt: '2025-01-01T00:00:00.000Z' },
]

// Fixed availability exceptions applied after the base generation loop.
const SOLD_OUT_NFTS = new Set(['nft-013'])
const AVAILABILITY_OVERRIDES: Record<string, number> = {
  'nft-007': 2,
  'nft-021': 1,
}

function pad(n: number): string {
  return String(n).padStart(3, '0')
}

function buildNft(i: number): NftDetail {
  const id = `nft-${pad(i + 1)}`
  const category = CATEGORIES[i % 9]
  const rarity = RARITIES[(i + RARITY_OFFSET) % 4]
  const basePrice = PRICE_TABLE[i % PRICE_TABLE.length]
  const creator = CREATORS[i % CREATORS.length]
  const title = `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[Math.floor(i / ADJECTIVES.length) % NOUNS.length]}`
  const createdAt = new Date(Date.UTC(2026, 0, 1) + i * 24 * 60 * 60 * 1000).toISOString()

  const editions: NftEdition[] = [
    {
      id: `${id}-e1`,
      label: 'Standard',
      priceEth: basePrice,
      totalSupply: 10,
      available: 10,
    },
  ]
  // Every 4th NFT (nft-004, nft-008, ...) also ships a Deluxe edition.
  if ((i + 1) % 4 === 0) {
    editions.push({
      id: `${id}-e2`,
      label: 'Deluxe',
      priceEth: roundEth(eth(basePrice).times(2)),
      totalSupply: 3,
      available: 3,
    })
  }

  if (SOLD_OUT_NFTS.has(id)) {
    for (const edition of editions) edition.available = 0
  }
  const overrideAvailable = AVAILABILITY_OVERRIDES[id]
  if (overrideAvailable !== undefined) {
    editions[0].available = overrideAvailable
  }

  const nft: NftDetail = {
    id,
    title,
    creator: { id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl },
    category,
    rarity,
    // External placeholder-image debt paid off (spec §5): 4 local webp
    // assets, cycled deterministically by index. `images[0] === imageUrl`
    // always holds.
    imageUrl: `/nft/ape-0${(i % 4) + 1}.webp`,
    priceEth: editions[0].priceEth,
    available: 0,
    featured: i % 6 === 0,
    likes: (i * 37) % 500,
    createdAt,
    version: 1,
    description: `${title} is a GreenMint original from the ${category} collection, ${rarity} rarity.`,
    images: [0, 1, 2].map((n) => `/nft/ape-0${((i + n) % 4) + 1}.webp`),
    editions,
  }
  refreshNftDerived(nft)
  return nft
}

/**
 * Recomputes the denormalized summary fields (`priceEth`, `available`) from
 * the current editions. Must run after ANY edition mutation — called from
 * `bumpNftVersion` so every call site stays correct automatically.
 */
export function refreshNftDerived(nft: NftDetail): void {
  nft.available = nft.editions.reduce((sum, e) => sum + e.available, 0)
  const inStock = nft.editions.filter((e) => e.available > 0)
  nft.priceEth =
    inStock.length > 0
      ? inStock.reduce((min, e) => (eth(e.priceEth).lt(eth(min)) ? e.priceEth : min), inStock[0].priceEth)
      : nft.editions[0].priceEth
}

// --- users --------------------------------------------------------------
// passwordHash = sha256Hex(salt + plaintext password), pre-computed offline.
// Plaintext passwords never touch the db — they only appear here as the
// fictional demo credential, in a comment, for whoever needs to log in.

const ANA_SALT = 'a3f1c2d4-11e2-4b3a-9c5d-6f7a8b9c0d1e'
// ana@greenmint.dev / GreenMint#1
const ANA_PASSWORD_HASH = 'b127b22ec7bca7d4c24a9f135f4a0163e0ff44f33a1e4962409aa4d8c8267578'

const BRUNO_SALT = 'f0e1d2c3-22b3-4a5c-8d6e-1f2a3b4c5d6e'
// bruno@greenmint.dev / GreenMint#2
const BRUNO_PASSWORD_HASH = '66f16b672e9bae5b878c17e49953c35c941f8a9fda55d6fe6391f53b483b7bb1'

const ANA_ETH_ADDRESS = '0x473f34be97dc38b37ddcb5ae9689882d653bcf0b'
const ANA_POLYGON_ADDRESS = '0x7a902f50fc16bc2a75e3ef0c2bdba495fd480224'
const BRUNO_ETH_ADDRESS = '0x65acdfb82baa4ca658c9e8d6f88f0d9e3906e9b7'

export function buildInitialDb(): Db {
  const nfts = Array.from({ length: 48 }, (_, i) => buildNft(i))
  const ord1UnitPrice = nfts[1].editions[0].priceEth // nft-002 e1
  const ord1Fee = NETWORK_FEES.ethereum
  const ord1Total = roundEth(eth(ord1UnitPrice).plus(ord1Fee))

  return {
    seedVersion: SEED_VERSION,
    users: [
      {
        id: 'u-ana',
        name: 'Ana Volt',
        email: 'ana@greenmint.dev',
        avatarUrl: '/nft/ape-01.webp',
        bio: 'Colecionadora de arte generativa desde o primeiro bloco.',
        createdAt: '2025-06-01T00:00:00.000Z',
        passwordHash: ANA_PASSWORD_HASH,
        salt: ANA_SALT,
      },
      {
        id: 'u-bruno',
        name: 'Bruno Chain',
        email: 'bruno@greenmint.dev',
        avatarUrl: '/nft/ape-02.webp',
        bio: 'Explorando fotografia on-chain nos fins de semana.',
        createdAt: '2025-07-10T00:00:00.000Z',
        passwordHash: BRUNO_PASSWORD_HASH,
        salt: BRUNO_SALT,
      },
    ],
    sessions: {},
    nfts,
    favorites: {
      'u-ana': ['nft-002', 'nft-007', 'nft-021'],
      'u-bruno': ['nft-001'],
    },
    carts: {
      'u-ana': [
        { id: 'ci_1', nftId: 'nft-003', editionId: 'nft-003-e1', quantity: 1 },
        { id: 'ci_2', nftId: 'nft-007', editionId: 'nft-007-e1', quantity: 2 },
      ],
      'u-bruno': [],
      guest: [],
    },
    quotes: {},
    orders: [
      {
        id: 'ord_seed_1',
        ownerId: 'u-ana',
        status: 'confirmed',
        items: [
          {
            nftId: 'nft-002',
            editionId: 'nft-002-e1',
            title: nfts[1].title,
            editionLabel: 'Standard',
            quantity: 1,
            unitPriceEth: ord1UnitPrice,
            lineTotalEth: ord1UnitPrice,
            nftVersion: 1,
          },
        ],
        subtotalEth: ord1UnitPrice,
        discountEth: '0',
        networkFeeEth: ord1Fee,
        totalEth: ord1Total,
        network: 'ethereum',
        walletAddress: ANA_ETH_ADDRESS,
        payer: { name: 'Ana Volt', email: 'ana@greenmint.dev' },
        txHash: '0x42108d661f5883fdb224816928ff9e7903bdc5761cbc356465e669a7aa1729c0',
        explorerUrl:
          'https://example.com/tx/0x42108d661f5883fdb224816928ff9e7903bdc5761cbc356465e669a7aa1729c0',
        createdAt: '2026-01-05T00:00:00.000Z',
        resolvedAt: '2026-01-05T00:00:05.000Z',
        version: 2,
      },
    ],
    idempotency: {},
    coupons: COUPONS.map((c) => ({ ...c })),
    counters: { cartItem: 2, quote: 0, order: 0, wallet: 3 },
    wallets: {
      'u-ana': [
        {
          id: 'wallet_1',
          label: 'Carteira Principal',
          address: ANA_ETH_ADDRESS,
          network: 'ethereum',
          role: 'primary',
          createdAt: '2025-06-01T00:05:00.000Z',
        },
        {
          id: 'wallet_2',
          label: 'Carteira Polygon',
          address: ANA_POLYGON_ADDRESS,
          network: 'polygon',
          role: 'secondary',
          createdAt: '2025-06-02T00:00:00.000Z',
        },
      ],
      'u-bruno': [
        {
          id: 'wallet_3',
          label: 'Carteira Principal',
          address: BRUNO_ETH_ADDRESS,
          network: 'ethereum',
          role: 'primary',
          createdAt: '2025-07-10T00:05:00.000Z',
        },
      ],
    },
  }
}
