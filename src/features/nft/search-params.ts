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
  // Visão "meus favoritos" do catálogo (`/?fav=true`). Mora na URL como todo
  // o resto do estado de busca — sobrevive a refresh e ao histórico, e é o
  // destino que a aba do coração da TabBar mobile deve apontar.
  // NÃO `z.coerce.boolean()`: `Boolean('false') === true`, então `?fav=false`
  // ligaria a visão. Aceita o booleano (o parser do router lê JSON) e a
  // string 'true'; qualquer outra coisa degrada para `undefined`.
  fav: z
    .union([z.literal(true), z.literal('true').transform(() => true as const)])
    .optional()
    .catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const PER_PAGE = 12

export function toListParams(s: CatalogSearch): NftListParams {
  const { fav, ...rest } = s
  // Na visão de favoritos a API não tem filtro por id, então a página traz o
  // catálogo inteiro (`perPage: 48`, o mesmo teto que `nftFacetsOptions` já
  // usa) e o cruzamento com `GET /favorites` acontece no call-site. `fav`
  // nunca vai no request: não é parâmetro do contrato.
  return fav
    ? { ...rest, sort: rest.sort ?? 'newest', page: 1, perPage: 48 }
    : { ...rest, sort: rest.sort ?? 'newest', page: rest.page ?? 1, perPage: PER_PAGE }
}
