import { Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Mobile-only top bar (spec §10, node `70395:239`). There is no header on
 * mobile (spec §11) — this replaces it.
 */
export function MobileSearchBar() {
  return (
    <div className="px-6 py-4 lg:hidden">
      <div className="flex items-center gap-3">
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
            disabled // fase 3 liga a busca
            className="h-[45px] pl-11"
          />
        </div>
        <Button
          type="button"
          size="icon"
          disabled // fase 3: abre o Sheet de filtros
          aria-label="Filtrar"
          className="size-[45px] shrink-0"
        >
          <SlidersHorizontal className="size-[22px]" />
        </Button>
      </div>
    </div>
  )
}
