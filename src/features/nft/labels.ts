import type { Network } from '@/types'
import type { NftCategory, NftRarity, NftSort } from '@/types'

/** Transcribed labels (specs/02-design-system.md §3, specs/03-catalogo.md
 * "Resolução das Open Questions") — nenhum inventado. */

export const CATEGORY_LABELS: Record<NftCategory, string> = {
  art: 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  'art-3d': 'Arte 3D',
  collectibles: 'Colecionáveis',
  generative: 'Generativa',
  gaming: 'Jogos',
  memberships: 'Assinaturas',
  utility: 'Utilidade',
}

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

// OQ2: só "Listados recentemente" está no Figma; os demais valores de
// NftSort recebem rótulo sem inventar ordenação nova.
export const SORT_LABELS: Record<NftSort, string> = {
  newest: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Em alta',
}

// OQ4: o Figma só desenha RARO; badge restrito a acima de comum, `common`
// fica de fora do mapa (nenhum consumidor deve renderizar badge para ele).
export const RARITY_BADGES: Partial<Record<NftRarity, string>> = {
  rare: 'RARO',
  epic: 'ÉPICO',
  legendary: 'LENDÁRIO',
}
