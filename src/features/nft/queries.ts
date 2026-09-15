import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { eth } from '@/lib/money'
import { NETWORKS, NFT_CATEGORIES } from '@/types'
import type { Network, NftCategory, NftDetail, NftListParams, NftSummary, Paginated } from '@/types'

/**
 * `queryOptions()` (TanStack Query v5) so the same key/fn/config is shared
 * between components and any imperative `queryClient` call. Every key starts
 * with `['nfts', scope, ...]` — `scope` isolates cache between users (CLAUDE.md
 * rule), the rest isolates cache between distinct searches.
 */

export function nftListOptions(scope: string, params: NftListParams) {
  return queryOptions({
    queryKey: ['nfts', scope, 'list', params] as const,
    queryFn: async ({ signal }) =>
      (await api.get<Paginated<NftSummary>>('/nfts', { params, signal })).data,
    // Atualização em segundo plano: mantém a página anterior visível durante
    // o refetch (o cenário `out-of-order` prova que o request obsoleto é
    // cancelado via `signal`, não que o dado antigo nunca aparece).
    placeholderData: keepPreviousData,
  })
}

/**
 * Fase 4 (specs/04-detalhe-nft.md). 404 é resposta final, não falha
 * transitória — não gastar o retry padrão do Query nela; qualquer outro
 * erro ganha uma tentativa extra.
 */
export function nftDetailOptions(scope: string, nftId: string) {
  return queryOptions({
    queryKey: ['nfts', scope, 'detail', nftId] as const,
    queryFn: async ({ signal }) => (await api.get<NftDetail>(`/nfts/${nftId}`, { signal })).data,
    retry: (count, error) => !(isAxiosError(error) && error.response?.status === 404) && count < 1,
  })
}

export function featuredNftOptions(scope: string) {
  return queryOptions({
    queryKey: ['nfts', scope, 'featured'] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<NftSummary>>('/nfts', {
        params: { featured: true, perPage: 1 },
        signal,
      })
      return data.items[0] ?? null
    },
  })
}

export interface NftFacets {
  countsByCategory: Record<NftCategory, number>
  countsByNetwork: Record<Network, number>
  maxPriceEth: string
}

function emptyCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
}

export function nftFacetsOptions(scope: string) {
  return queryOptions({
    queryKey: ['nfts', scope, 'facets'] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<NftSummary>>('/nfts', {
        params: { perPage: 48 },
        signal,
      })
      const countsByCategory = emptyCounts(NFT_CATEGORIES)
      const countsByNetwork = emptyCounts(NETWORKS)
      let maxPrice = eth('0')
      for (const item of data.items) {
        countsByCategory[item.category] += 1
        countsByNetwork[item.network] += 1
        const price = eth(item.priceEth)
        if (price.gt(maxPrice)) maxPrice = price
      }
      const facets: NftFacets = {
        countsByCategory,
        countsByNetwork,
        // Fallback '1' quando não há itens (cenário `empty`): evita bounds
        // NaN/0 no slider.
        maxPriceEth: maxPrice.gt(0) ? maxPrice.toString() : '1',
      }
      return facets
    },
  })
}
