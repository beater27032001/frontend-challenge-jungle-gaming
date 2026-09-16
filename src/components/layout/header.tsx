import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/use-auth'
import { useSession } from '@/features/auth/use-session'
import { useCartCount } from '@/features/cart/queries'
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
  // Fase 7: o spec 07 §2 desenha o header do Pagamento com "Mercado" ativo — o
  // checkout é a ponta do fluxo de mercado, não uma seção própria.
  if (pathname.startsWith('/nft') || pathname === '/pagamento') return 'Mercado'
  return null
}

export function Header({ withDivider = true }: { withDivider?: boolean }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const active = activeNavLabel(pathname)
  const cartCount = useCartCount()

  // Busca inline (resolução OQ1, specs/03-catalogo.md): o Figma só desenha o
  // ícone de 20x20, sem estado expandido — desvio consciente registrado em
  // ARCHITECTURE.md. `useSearch`/`useNavigate` sem `from` porque o Header é
  // montado pelo __root em toda rota, não só em '/'.
  const search = useSearch({ strict: false }) as Partial<CatalogSearch>
  const navigate = useNavigate()
  const session = useSession()
  const logout = useLogout()
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
          {/* "Mercado" é a grade do catálogo, que vive na própria home — vai
              para lá e ancora na seção, em vez de ser texto morto. Criadores e
              Aprenda não têm destino algum: link falso é pior a11y que texto
              simples, então seguem inertes até a rota nascer. */}
          <Link
            to="/"
            hash="catalogo"
            aria-current={active === 'Mercado' ? 'page' : undefined}
            className={cn(
              'text-body-16',
              linkFocusRing,
              active === 'Mercado' ? 'text-text-accent underline' : 'text-foreground',
            )}
          >
            Mercado
          </Link>
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
            <Link
              to="/carrinho"
              aria-label={cartCount > 0 ? `Carrinho (${cartCount} ${cartCount === 1 ? 'item' : 'itens'})` : 'Carrinho'}
              className={cn(linkFocusRing, 'relative')}
            >
              <ShoppingCart className="size-6" />
              {/* Badge 16x16, só com contagem > 0 (fase 6). */}
              {cartCount > 0 && (
                <span
                  aria-hidden
                  data-testid="cart-count"
                  className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-primary text-tiny-10 font-bold text-primary-foreground"
                >
                  {cartCount}
                </span>
              )}
            </Link>
            {session.data ? (
              <div className="flex items-center gap-3">
                {/* Avatar e nome são o caminho para o perfil — era o que
                    faltava para /perfil ter entrada pela interface no desktop
                    (no mobile é a TabBar). */}
                <Link
                  to="/perfil"
                  className={cn(linkFocusRing, 'flex items-center gap-3 rounded-[3px]')}
                >
                  <img
                    src={session.data.user.avatarUrl}
                    alt=""
                    className="size-6 shrink-0 rounded-full object-cover"
                  />
                  <span className="max-w-[120px] truncate text-body-16 text-foreground">
                    {session.data.user.name}
                  </span>
                </Link>
                <Button
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                  className="h-[35px] w-[85px] text-body-16 text-primary-foreground"
                >
                  {logout.isPending ? 'Saindo…' : 'Sair'}
                </Button>
              </div>
            ) : (
              <Button asChild className="h-[35px] w-[100px] gap-1 text-body-16 text-primary-foreground">
                {/* Fase 5 (specs/05-auth.md §9): rota real, não search param
                    — `redirect` carrega a página de origem para o "retorno
                    ao fluxo anterior" (§3). */}
                <Link to="/login" search={{ redirect: pathname === '/' ? undefined : pathname }}>
                  <LogIn className="size-5" />
                  Entrar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
