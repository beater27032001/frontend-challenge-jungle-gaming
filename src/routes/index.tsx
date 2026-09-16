import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSession } from '@/features/auth/use-session'
import { CatalogGrid } from '@/features/nft/components/catalog-grid'
import { CatalogPagination } from '@/features/nft/components/catalog-pagination'
import { HomeEditorial } from '@/features/nft/components/home-editorial'
import { CatalogToolbar } from '@/features/nft/components/catalog-toolbar'
import { FeaturedBanner } from '@/features/nft/components/featured-banner'
import { FilterPanel } from '@/features/nft/components/filter-panel'
import { HeroDesktop, HeroMobile } from '@/features/nft/components/hero'
import { favoritesOptions } from '@/features/nft/favorites'
import { featuredNftOptions, nftFacetsOptions, nftListOptions } from '@/features/nft/queries'
import { catalogSearchSchema, toListParams } from '@/features/nft/search-params'
import { cn, linkFocusRing } from '@/lib/utils'
import type { CatalogSearch } from '@/features/nft/search-params'

/**
 * The catalogue home (specs/03-catalogo.md + specs/02-design-system.md §3/4).
 * `validateSearch` owns the 8 URL params (CLAUDE.md rule): q/category/
 * network/priceMin/priceMax/sort/page/fav. Zero `useState` for any of them.
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
  const isFavView = search.fav === true

  const params = toListParams(search)
  const list = useQuery({ ...nftListOptions(scope, params), enabled })
  const featured = useQuery({ ...featuredNftOptions(scope), enabled })
  const facets = useQuery({ ...nftFacetsOptions(scope), enabled })
  // Visitante nunca dispara `GET /favorites` (mesma regra de favorites.ts).
  const favorites = useQuery({ ...favoritesOptions(scope), enabled: isFavView && !!session.data })

  // A API não filtra por id, então a visão de favoritos cruza a página cheia
  // (perPage 48, ver toListParams) com os ids de `GET /favorites`. `isPending`
  // soma as duas queries — mostrar a grade completa enquanto os ids não
  // chegaram seria "favoritos" mentindo por um instante.
  const gridQuery = !isFavView
    ? list
    : {
        ...list,
        isPending: list.isPending || favorites.isPending,
        isError: list.isError || favorites.isError,
        data:
          list.data && favorites.data
            ? {
                ...list.data,
                items: list.data.items.filter((nft) => favorites.data.nftIds.includes(nft.id)),
                total: list.data.items.filter((nft) => favorites.data.nftIds.includes(nft.id)).length,
                totalPages: 1,
                page: 1,
              }
            : undefined,
      }

  function handlePatch(patch: Partial<CatalogSearch>) {
    // resetScroll: false — ver catalog-toolbar.tsx
    navigate({ search: (prev) => ({ ...prev, ...patch }), resetScroll: false })
  }

  return (
    // pb-[33px] no mobile: o "+" da TabBar é um círculo de 65px ancorado no
    // topo da barra com -translate-y-1/2, então sobra 33px POR CIMA do
    // conteúdo — e o `pb-[126px]` do <main> só paga a altura da barra. Medido:
    // com o scroll no fim, o botão "4" da paginação ficava sob o FAB.
    // ponytail: o conserto de raiz é o `pb` do <main> em `__root.tsx` virar
    // 159px, o que cobriria TODA rota com TabBar; esse arquivo é de outro
    // agente nesta rodada, então o pagamento fica local e está no relatório.
    <div className="mx-auto max-w-content px-6 pb-[33px] lg:px-0 lg:pb-0">
      <div className="hidden lg:block">
        <HeroDesktop />
      </div>
      <div className="py-6 lg:hidden">
        <HeroMobile />
      </div>

      <div className="flex flex-col gap-8 lg:mt-12 lg:flex-row lg:gap-12">
        {/* gap-10 entre o painel de filtros e o banner: os dois estavam
            encostados (medido 0px). O valor vem do próprio painel —
            specs/02-design-system.md §3, "Gap entre seções: 40px" —, não de
            estimativa; a distância exata entre os dois blocos da sidebar não
            está transcrita (specs/03-catalogo.md OQ3 só dá as ordenadas). */}
        <aside className="hidden lg:flex lg:w-[310px] lg:shrink-0 lg:flex-col lg:gap-10">
          <FilterPanel search={search} facets={facets.data} onPatch={handlePatch} />
          <FeaturedBanner nft={featured.data ?? null} isPending={featured.isPending} />
        </aside>

        <div id="catalogo" className="flex min-w-0 flex-1 flex-col gap-6">
          {isFavView ? <FavoritesHeader authenticated={!!session.data} /> : <CatalogToolbar search={search} />}

          {isFavView && !session.data && !session.isPending ? null : (
            <CatalogGrid query={gridQuery} search={search} />
          )}

          {/* mb-14 (56px) até a seção seguinte: a paginação encostava no
              rodapé (medido 0px). 56 é o passo vertical que o próprio grid
              usa (specs/03-catalogo.md §3, `gap-y-[56px]`) — a régua da
              página, não um número novo.
              Alinhada à DIREITA da coluna do grid, conferido pelo usuário no
              Figma: a §5 transcreve tamanho, raio e gap dos botões e omite o
              alinhamento, e a leitura por medição tinha ficado à esquerda. */}
          {!isFavView && (
            <div className="mb-14 flex justify-end">
              <CatalogPagination page={params.page ?? 1} totalPages={list.data?.totalPages ?? 1} />
            </div>
          )}
        </div>
      </div>

      {/* Cards promocionais e "Diário da Cunhagem" (specs/03-catalogo.md §7).
          Ficam FORA da coluna do grid, largura total do conteúdo, como no
          Figma. Só na visão do catálogo: na de favoritos seriam ruído. */}
      {!isFavView && (
        <div className="mt-14 pb-14">
          <HomeEditorial />
        </div>
      )}
    </div>
  )
}

/**
 * Cabeçalho da visão `/?fav=true`, no lugar da toolbar de ordenação (que não
 * faz sentido numa lista de até 48 itens já filtrada). Sem sessão a tela não
 * finge: manda para o login, que é a rota real (specs/05-auth.md §9).
 */
function FavoritesHeader({ authenticated }: { authenticated: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-body-18 font-bold text-foreground">Meus favoritos</h2>
      {authenticated ? (
        <Link
          to="/"
          search={{}}
          resetScroll={false}
          className={cn(linkFocusRing, 'w-fit text-body-14 text-text-accent underline')}
        >
          Ver todo o catálogo
        </Link>
      ) : (
        <p className="text-body-14 text-text-secondary">
          <Link
            to="/login"
            search={{ redirect: '/' }}
            className={cn(linkFocusRing, 'text-text-accent underline')}
          >
            Entre na sua conta
          </Link>{' '}
          para ver os NFTs que você favoritou.
        </p>
      )}
    </div>
  )
}
