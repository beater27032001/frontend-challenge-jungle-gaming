import type { EthAmount } from './common'
import type { Network } from './wallet'

/** NFT catalogue contracts: list/detail shapes and list query params. */

// Ordem = ordem do design (spec §3); os 4 slugs da fase 1 preservados dentro
// da lista de 9. Slugs são contrato interno, não medida visual — labels PT
// para a UI nascem na fase 3, junto do filtro que os consome.
export const NFT_CATEGORIES = [
  'art', // Arte digital
  'photography', // Fotografia
  'music', // Música
  'art-3d', // Arte 3D
  'collectibles', // Colecionáveis
  'generative', // Generativa
  'gaming', // Jogos
  'memberships', // Assinaturas
  'utility', // Utilidade
] as const
export type NftCategory = (typeof NFT_CATEGORIES)[number]
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
  network: Network // resolução OQ 3 (specs/03-catalogo.md): filtro "Rede" do painel
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
  images: string[] // galeria, 4 por NFT; images[0] === imageUrl
  editions: NftEdition[]
  ratingAvg: string // '3.5'…'5.0', 1 casa decimal
  ratingCount: number
  attributes: string[] // 3 itens, PT
}

export interface NftListParams {
  q?: string
  category?: NftCategory
  network?: Network
  rarity?: NftRarity
  priceMin?: EthAmount
  priceMax?: EthAmount
  sort?: NftSort // default 'newest'
  page?: number // default 1
  perPage?: number // default 12, máx 48
  featured?: boolean
}
