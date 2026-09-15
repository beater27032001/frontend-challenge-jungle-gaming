import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@/features/auth/use-session'
import { CatalogGrid } from '@/features/nft/components/catalog-grid'
import { CatalogPagination } from '@/features/nft/components/catalog-pagination'
import { CatalogToolbar } from '@/features/nft/components/catalog-toolbar'
import { FeaturedBanner } from '@/features/nft/components/featured-banner'
import { FilterPanel } from '@/features/nft/components/filter-panel'
import { HeroDesktop, HeroMobile } from '@/features/nft/components/hero'
import { featuredNftOptions, nftFacetsOptions, nftListOptions } from '@/features/nft/queries'
import { catalogSearchSchema, toListParams } from '@/features/nft/search-params'
import type { CatalogSearch } from '@/features/nft/search-params'

/**
 * The catalogue home (specs/03-catalogo.md + specs/02-design-system.md §3/4).
 * `validateSearch` owns the 7 URL params (CLAUDE.md rule): q/category/
 * network/priceMin/priceMax/sort/page. Zero `useState` for any of them.
 */
export const Route = createFileRoute('/')({
  validateSearch: (search) => catalogSearchSchema.parse(search),
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const session = useSession()
  // scope isola cache entre usuários (CLAUDE.md); `enabled` evita disparar a
  // busca duas vezes (visitante -> usuário) enquanto a sessão resolve.
  const scope = session.data?.user.id ?? 'guest'
  const enabled = !session.isPending

  const params = toListParams(search)
  const list = useQuery({ ...nftListOptions(scope, params), enabled })
  const featured = useQuery({ ...featuredNftOptions(scope), enabled })
  const facets = useQuery({ ...nftFacetsOptions(scope), enabled })

  function handlePatch(patch: Partial<CatalogSearch>) {
    // resetScroll: false — ver catalog-toolbar.tsx
    navigate({ search: (prev) => ({ ...prev, ...patch }), resetScroll: false })
  }

  return (
    <div className="mx-auto max-w-content px-6 lg:px-0">
      <div className="hidden lg:block">
        <HeroDesktop />
      </div>
      <div className="py-6 lg:hidden">
        <HeroMobile />
      </div>

      <div className="flex flex-col gap-8 lg:mt-12 lg:flex-row lg:gap-12">
        <aside className="hidden lg:flex lg:w-[310px] lg:shrink-0 lg:flex-col">
          <FilterPanel search={search} facets={facets.data} onPatch={handlePatch} />
          <FeaturedBanner nft={featured.data ?? null} isPending={featured.isPending} />
        </aside>

        <div id="catalogo" className="flex flex-1 flex-col gap-6">
          <CatalogToolbar search={search} total={list.data?.total} />
          <CatalogGrid query={list} search={search} />
          <CatalogPagination page={params.page ?? 1} totalPages={list.data?.totalPages ?? 1} />
        </div>
      </div>
    </div>
  )
}
