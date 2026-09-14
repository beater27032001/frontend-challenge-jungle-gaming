import type { EthAmount } from './common'

/** NFT catalogue contracts: list/detail shapes and list query params. */

export type NftCategory = 'art' | 'gaming' | 'music' | 'photography'
export type NftRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type NftSort = 'newest' | 'price-asc' | 'price-desc' | 'popular'

export interface NftEdition {
  id: string // `${nftId}-e1`
  label: string // "Standard" | "Deluxe"
  priceEth: EthAmount
  totalSupply: number // inteiro
  available: number // inteiro, 0 = esgotada
}

export interface NftSummary {
  id: string // "nft-001" … "nft-048"
  title: string
  creator: { id: string; name: string; avatarUrl: string }
  category: NftCategory
  rarity: NftRarity
  imageUrl: string
  priceEth: EthAmount // menor preço entre edições disponíveis (ou da 1ª, se todas esgotadas)
  available: number // soma dos available das edições
  featured: boolean
  likes: number
  createdAt: string
  version: number // monotônico; incrementa a cada mutação do NFT
}

export interface NftDetail extends NftSummary {
  description: string
  images: string[] // galeria, 3 por NFT
  editions: NftEdition[]
}

export interface NftListParams {
  q?: string
  category?: NftCategory
  rarity?: NftRarity
  priceMin?: EthAmount
  priceMax?: EthAmount
  sort?: NftSort // default 'newest'
  page?: number // default 1
  perPage?: number // default 12, máx 48
  featured?: boolean
}
