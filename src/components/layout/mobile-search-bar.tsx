import { Search, SlidersHorizontal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSession } from '@/features/auth/use-session'
import { SortSelect } from '@/features/nft/components/catalog-toolbar'
import { FilterPanel } from '@/features/nft/components/filter-panel'
import { nftFacetsOptions } from '@/features/nft/queries'
import type { CatalogSearch } from '@/features/nft/search-params'

/**
 * Mobile-only top bar (spec §10, node `70395:239`). There is no header on
 * mobile (spec §11) — this replaces it. Mounted globally by `__root.tsx`, so
 * it works on every route (edge case: submitting from `/nft/$nftId` still
 * navigates to `/` with `q`); the filter Sheet only makes sense on the
 * catalogue route, where `FilterPanel` is reused as-is from the sidebar.
 */
export function MobileSearchBar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const isCatalog = pathname === '/'
  const search = useSearch({ strict: false }) as CatalogSearch
  const navigate = useNavigate()
  const session = useSession()
  const scope = session.data?.user.id ?? 'guest'
  const facets = useQuery({ ...nftFacetsOptions(scope), enabled: isCatalog && !session.isPending })

  const [draft, setDraft] = useState(search.q ?? '')
  const [sheetOpen, setSheetOpen] = useState(false)

  // Reabrir mostra o `q` da URL, não um rascunho obsoleto (edge case da spec).
  // Ajuste durante o render, não useEffect: mesmo motivo do filter-panel — o
  // efeito commitaria um render com o rascunho velho antes de corrigir.
  const [syncedQ, setSyncedQ] = useState(search.q ?? '')
  if (syncedQ !== (search.q ?? '')) {
    setSyncedQ(search.q ?? '')
    setDraft(search.q ?? '')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const q = draft.trim()
    navigate({
      to: '/',
      search: (prev) => ({ ...(isCatalog ? prev : {}), q: q || undefined, page: undefined }),
      // Refinar a lista estando nela preserva o scroll; vir de outra rota é
      // troca de tela e deve começar do topo.
      resetScroll: !isCatalog,
    })
  }

  function handlePatch(patch: Partial<CatalogSearch>) {
    navigate({ to: '/', search: (prev) => ({ ...prev, ...patch }), resetScroll: !isCatalog })
  }

  return (
    <div className="px-6 py-4 lg:hidden">
      <form onSubmit={submit} className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[22px] -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor="mobile-search" className="sr-only">
            Explorar coleções
          </label>
          <Input
            id="mobile-search"
            type="search"
            placeholder="Explorar coleções"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-[45px] pl-11"
          />
        </div>

        {isCatalog ? (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button type="button" size="icon" aria-label="Filtrar" className="size-[45px] shrink-0">
                <SlidersHorizontal className="size-[22px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <FilterPanel search={search} facets={facets.data} onPatch={handlePatch} />
              <div className="flex flex-col gap-1.5 p-5">
                <SortSelect value={search.sort} onChange={(sort) => handlePatch({ sort, page: undefined })} />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Button
            type="button"
            size="icon"
            disabled // filtro só existe no catálogo ('/')
            aria-label="Filtrar"
            className="size-[45px] shrink-0"
          >
            <SlidersHorizontal className="size-[22px]" />
          </Button>
        )}
      </form>
    </div>
  )
}
