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

// Fase 4 (specs/04-detalhe-nft.md, resolução OQ1): 3º atributo do detalhe —
// capitalizado, distinto do `RARITY_BADGES` em caixa alta.
export const RARITY_LABELS: Record<NftRarity, string> = {
  common: 'Comum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
}

/** "nft-003" → "#0003". A fase 4 formatava isto inline no detalhe desktop e no
 * mobile; a linha do carrinho (fase 6) é o terceiro call-site. */
export function tokenIdOf(nftId: string): string {
  return `#${nftId.replace('nft-', '').padStart(4, '0')}`
}
