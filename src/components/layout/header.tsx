import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CatalogSearch } from '@/features/nft/search-params'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * Desktop-only header (spec §2, node `70522:3240`). The mobile frame
 * (`14:5226`) has no header at all — no hamburger, no nav Sheet — mobile
 * navigation is the bottom TabBar instead (spec §10/§11).
 */

// Dívida 1 da fase 2 fechada: igualdade exata para "Início" (não mais
// `startsWith('/')`, que marcava até a 404 como ativa); "Mercado" cobre o
// fluxo de mercado (specs/02-design-system.md §2) mesmo sem Link próprio.
function activeNavLabel(pathname: string): 'Início' | 'Mercado' | null {
  if (pathname === '/') return 'Início'
  if (pathname.startsWith('/nft')) return 'Mercado'
  return null
}

export function Header({ withDivider = true }: { withDivider?: boolean }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const active = activeNavLabel(pathname)

  // Busca inline (resolução OQ1, specs/03-catalogo.md): o Figma só desenha o
  // ícone de 20x20, sem estado expandido — desvio consciente registrado em
  // ARCHITECTURE.md. `useSearch`/`useNavigate` sem `from` porque o Header é
  // montado pelo __root em toda rota, não só em '/'.
  const search = useSearch({ strict: false }) as Partial<CatalogSearch>
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function openSearch() {
    setDraft(search.q ?? '')
    setOpen(true)
  }
  function commit() {
    const q = draft.trim()
    navigate({ to: '/', search: (prev) => ({ ...prev, q: q || undefined, page: undefined }) })
    setOpen(false)
  }
  function cancel() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <header className="hidden lg:block">
      {/* A régua acompanha a coluna de 1200 (Figma 70522:3240), não sangra a
          largura toda da viewport. */}
      <div
        className={cn(
          // h-[45px] e não h-11: com border-box a régua fica DENTRO da altura, e o
          // Figma pede 44 de linha + 1 de régua = 45 (70522:3240).
          'mx-auto flex h-[45px] max-w-content items-center justify-between px-6',
          withDivider && 'border-b',
        )}
      >
        <Link
          to="/"
          className={cn(linkFocusRing, 'text-body-14 font-bold tracking-[1.4px] text-foreground')}
        >
          KURIO
        </Link>

        <nav aria-label="Navegação" className="flex items-center gap-10">
          <Link
            to="/"
            aria-current={active === 'Início' ? 'page' : undefined}
            className={cn(
              linkFocusRing,
              'text-body-16',
              active === 'Início' ? 'text-text-accent underline' : 'text-foreground',
            )}
          >
            Início
          </Link>
          {/* Mercado/Criadores/Aprenda não têm rota ainda — um link falso é
              pior a11y que texto simples; viram <Link> quando a rota nascer.
              Mercado já recebe o estilo ativo no fluxo de mercado. */}
          <span
            aria-current={active === 'Mercado' ? 'page' : undefined}
            className={cn('text-body-16', active === 'Mercado' ? 'text-text-accent underline' : 'text-foreground')}
          >
            Mercado
          </span>
          <span className="text-body-16 text-foreground">Criadores</span>
          <span className="text-body-16 text-foreground">Aprenda</span>
        </nav>

        <div className="flex items-center gap-4">
          {open && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                commit()
              }}
            >
              <label htmlFor="header-search" className="sr-only">
                Explorar coleções
              </label>
              <input
                id="header-search"
                ref={inputRef}
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancel()
                  }
                }}
                placeholder="Explorar coleções"
                className="h-10 w-56 rounded-[6px] bg-surface-dark pl-3 text-body-14 text-foreground placeholder:text-text-secondary"
              />
            </form>
          )}
          <div className="flex items-center gap-7">
            <button
              ref={buttonRef}
              type="button"
              aria-label="Buscar"
              aria-expanded={open}
              onClick={() => (open ? cancel() : openSearch())}
            >
              <Search className="size-5" />
            </button>
            <button type="button" disabled aria-label="Carrinho" className="relative disabled:opacity-50">
              {/* fase 6 liga isto — contagem não é buscada nesta fase (sem
                  query), então o badge (16x16, só com contagem > 0) nunca
                  aparece aqui. */}
              <ShoppingCart className="size-6" />
            </button>
            <Button disabled className="h-[35px] w-[100px] gap-1 text-body-16 text-primary-foreground">
              {/* fase 5 liga isto */}
              <LogIn className="size-5" />
              Entrar
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
