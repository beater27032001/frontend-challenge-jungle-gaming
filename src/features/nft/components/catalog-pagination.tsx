import { ChevronRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * specs/03-catalogo.md §5. No truncation/ellipsis logic — 48 fixtures / 12
 * perPage tops out at 4 pages (ponytail: add ellipsis only if the dataset
 * grows past what fits on one row).
 */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const isLast = page >= totalPages

  return (
    <nav aria-label="Paginação" className="flex items-center gap-2">
      {pages.map((n) => (
        <Link
          key={n}
          to="/"
          search={(prev) => ({ ...prev, page: n === 1 ? undefined : n })}
          // Mesmo motivo do ToolbarTab (ver catalog-toolbar.tsx): a página 1 zera
          // `page`, e o match parcial do router a lia como ativa junto da página
          // corrente.
          // Filtrar/paginar refina a lista; o router sobe ao topo por padrão e tira
          // o grid da vista. Vale para <Link> igual vale para navigate().
          resetScroll={false}
          activeOptions={{ exact: true }}
          aria-current={n === page ? 'page' : undefined}
          className={cn(
            linkFocusRing,
            'flex size-[35px] items-center justify-center rounded-[4px] text-body-18',
            n === page
              ? 'bg-primary font-bold text-primary-foreground'
              : 'border border-border font-normal text-foreground',
          )}
        >
          {n}
        </Link>
      ))}

      {isLast ? (
        <span
          aria-disabled="true"
          aria-label="Próxima página"
          className="flex size-[35px] items-center justify-center rounded-[4px] border border-border text-foreground opacity-50"
        >
          <ChevronRight className="size-[18px]" />
        </span>
      ) : (
        <Link
          to="/"
          search={(prev) => ({ ...prev, page: page + 1 })}
          resetScroll={false}
          aria-label="Próxima página"
          className={cn(
            linkFocusRing,
            'flex size-[35px] items-center justify-center rounded-[4px] border border-border text-foreground',
          )}
        >
          <ChevronRight className="size-[18px]" />
        </Link>
      )}
    </nav>
  )
}
