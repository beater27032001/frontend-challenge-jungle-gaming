import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { eth } from '@/lib/money'
import { NFT_CATEGORIES } from '@/types'
import type { NftDetail, NftSummary, Paginated } from '@/types'
import { db } from '../db'
import { activeScenario, withScenario } from '../scenarios'
import { apiError } from '../utils'

/** Public catalogue: list (filter/sort/paginate) and detail. */

const boolParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional()

const listParamsSchema = z.object({
  q: z.string().optional(),
  category: z.enum(NFT_CATEGORIES).optional(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(12),
  featured: boolParam,
})

function toSummary(nft: NftDetail): NftSummary {
  const {
    id,
    title,
    creator,
    category,
    rarity,
    imageUrl,
    priceEth,
    available,
    featured,
    likes,
    createdAt,
    version,
  } = nft
  return { id, title, creator, category, rarity, imageUrl, priceEth, available, featured, likes, createdAt, version }
}

export const nfts = [
  http.get(
    '/api/nfts',
    withScenario(({ request }) => {
      const url = new URL(request.url)
      const result = listParamsSchema.safeParse(Object.fromEntries(url.searchParams))
      if (!result.success) {
        const details: Record<string, string> = {}
        for (const issue of result.error.issues) details[issue.path.join('.') || '_'] = issue.message
        return apiError(400, 'validation_error', 'Parâmetros inválidos.', details)
      }
      const params = result.data

      if (activeScenario() === 'empty') {
        const body: Paginated<NftSummary> = {
          items: [],
          page: params.page,
          perPage: params.perPage,
          total: 0,
          totalPages: 0,
        }
        return HttpResponse.json(body)
      }

      let list = db.nfts.filter((nft) => {
        if (params.category && nft.category !== params.category) return false
        if (params.rarity && nft.rarity !== params.rarity) return false
        if (params.featured !== undefined && nft.featured !== params.featured) return false
        if (params.q) {
          const q = params.q.toLowerCase()
          const matches = nft.title.toLowerCase().includes(q) || nft.creator.name.toLowerCase().includes(q)
          if (!matches) return false
        }
        if (params.priceMin && eth(nft.priceEth).lt(eth(params.priceMin))) return false
        if (params.priceMax && eth(nft.priceEth).gt(eth(params.priceMax))) return false
        return true
      })

      list = list.slice().sort((a, b) => {
        switch (params.sort) {
          case 'price-asc':
            return eth(a.priceEth).cmp(eth(b.priceEth))
          case 'price-desc':
            return eth(b.priceEth).cmp(eth(a.priceEth))
          case 'popular':
            return b.likes - a.likes
          case 'newest':
          default:
            return b.createdAt.localeCompare(a.createdAt)
        }
      })

      const total = list.length
      const totalPages = Math.ceil(total / params.perPage)
      const start = (params.page - 1) * params.perPage
      const items = list.slice(start, start + params.perPage).map(toSummary)

      const body: Paginated<NftSummary> = { items, page: params.page, perPage: params.perPage, total, totalPages }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    '/api/nfts/:id',
    withScenario(({ params }) => {
      const nft = db.nfts.find((n) => n.id === params.id)
      if (!nft) return apiError(404, 'not_found', 'NFT não encontrado.')
      return HttpResponse.json(nft)
    }),
  ),
]
