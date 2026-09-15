import { z } from 'zod'
import { NFT_CATEGORIES, NETWORKS } from '@/types'
import type { NftListParams } from '@/types'

/**
 * The single source of truth for catalogue state (spec "Search params"):
 * `validateSearch` owns q/category/network/priceMin/priceMax/sort/page —
 * zero `useState` for any of the 7. Defaults live OUTSIDE the URL (a field
 * at its default writes `undefined`, and the router strips the key), and
 * every invalid value degrades via `.catch(undefined)` instead of throwing.
 */

const ethString = z.string().regex(/^\d+(\.\d+)?$/)

export const catalogSearchSchema = z.object({
  q: z.string().min(1).optional().catch(undefined),
  category: z.enum(NFT_CATEGORIES).optional().catch(undefined),
  network: z.enum(NETWORKS).optional().catch(undefined),
  priceMin: ethString.optional().catch(undefined),
  priceMax: ethString.optional().catch(undefined),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'popular']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const PER_PAGE = 12

export function toListParams(s: CatalogSearch): NftListParams {
  return { ...s, sort: s.sort ?? 'newest', page: s.page ?? 1, perPage: PER_PAGE }
}
