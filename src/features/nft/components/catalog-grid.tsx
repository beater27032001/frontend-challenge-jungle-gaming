import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { NftSummary, Paginated } from '@/types'
import type { CatalogSearch } from '../search-params'
import { NftCard } from './nft-card'
import { NftCardMobile } from './nft-card-mobile'

/**
 * specs/03-catalogo.md §3 + §4: desktop grid (3 cols) and mobile masonry (2
 * staggered columns) are distinct layouts, not one reflowing grid — both
 * exist in the DOM at once, toggled by `hidden lg:*` / `lg:hidden`, same
 * pattern as the hero/header/footer split (ARCHITECTURE.md decisão 1).
 */

// specs/03-catalogo.md §4: coluna direita do masonry começa mais abaixo
// (offset não transcrito — provisório, ARCHITECTURE.md).
function Masonry<T>({ items, renderItem, keyFor }: { items: T[]; renderItem: (item: T) => ReactNode; keyFor: (item: T) => string }) {
  const left = items.filter((_, i) => i % 2 === 0)
  const right = items.filter((_, i) => i % 2 === 1)
  return (
    <div className="flex gap-4 lg:hidden">
      <div className="flex flex-1 flex-col gap-4">
        {left.map((item) => (
          <div key={keyFor(item)}>{renderItem(item)}</div>
        ))}
      </div>
      <div className="mt-8 flex flex-1 flex-col gap-4">
        {right.map((item) => (
          <div key={keyFor(item)}>{renderItem(item)}</div>
        ))}
      </div>
    </div>
  )
}

function SkeletonDesktopCard() {
  return (
    <div className="flex w-full flex-col gap-3">
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}

function SkeletonMobileCard() {
  return (
    <div className="flex w-full flex-col gap-2">
      <Skeleton className="h-[200px] w-full rounded-[20px]" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}

const SKELETON_IDS = Array.from({ length: 12 }, (_, i) => `skeleton-${i}`)

function GridSkeleton() {
  return (
    <>
      <div className="hidden grid-cols-3 gap-x-[34px] gap-y-[56px] lg:grid">
        {SKELETON_IDS.map((id) => (
          <SkeletonDesktopCard key={id} />
        ))}
      </div>
      <Masonry items={SKELETON_IDS} keyFor={(id) => id} renderItem={() => <SkeletonMobileCard />} />
    </>
  )
}

/** Só os 5 campos que este componente usa — estrutural, não `UseQueryResult`,
 * para a visão de favoritos poder passar `{ ...list, data: filtrado }` sem
 * brigar com a união discriminada do TanStack Query. */
export interface CatalogGridQuery {
  data: Paginated<NftSummary> | undefined
  isPending: boolean
  isError: boolean
  isFetching: boolean
  refetch: () => void
}

export function CatalogGrid({
  query,
  search,
}: {
  query: CatalogGridQuery
  search: CatalogSearch
}) {
  const { data, isPending, isError, isFetching, refetch } = query
  const hasActiveFilters = Object.values(search).some((v) => v !== undefined)
  const isEmpty = !!data && data.items.length === 0
  const liveText = !data ? '' : isEmpty ? 'Nenhum NFT encontrado' : `${data.total} NFTs encontrados`

  return (
    <div>
      {/* Único role="status" permanente da página (spec "Estados"): anuncia
          a contagem de resultados a cada resolução da query. */}
      <p role="status" className="sr-only">
        {liveText}
      </p>

      {isPending && <GridSkeleton />}

      {!isPending && isError && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-body-16 text-text-secondary">Não foi possível carregar o catálogo.</p>
          <Button type="button" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!isPending && !isError && isEmpty && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <h2 className="text-body-18 font-bold text-foreground">Nenhum NFT encontrado</h2>
          <p className="text-body-14 text-text-secondary">Ajuste os filtros ou limpe a busca.</p>
          {hasActiveFilters && (
            <Link
              to="/"
              search={{}}
              resetScroll={false}
              className="h-auto w-fit rounded-[6px] bg-primary px-3 py-2 text-body-16 font-bold text-primary-foreground"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      )}

      {!isPending && !isError && data && !isEmpty && (
        <div aria-busy={isFetching} className={cn(isFetching && 'opacity-60')}>
          <div className="hidden grid-cols-3 gap-x-[34px] gap-y-[56px] lg:grid">
            {data.items.map((nft) => (
              <NftCard key={nft.id} nft={nft} />
            ))}
          </div>
          <Masonry items={data.items} keyFor={(nft) => nft.id} renderItem={(nft) => <NftCardMobile nft={nft} />} />
        </div>
      )}
    </div>
  )
}
