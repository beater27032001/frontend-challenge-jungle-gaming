import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * Desktop-only header (spec §2, node `70522:3240`). The mobile frame
 * (`14:5226`) has no header at all — no hamburger, no nav Sheet — mobile
 * navigation is the bottom TabBar instead (spec §10/§11).
 */

// fase 3+ estende esta tabela quando as rotas de mercado existirem; hoje só
// '/' tem destino real, então só "Início" pode ficar ativo.
const ACTIVE_PREFIXES: Array<[prefix: string, label: string]> = [['/', 'Início']]

function activeNavLabel(pathname: string): string {
  const match = ACTIVE_PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix))
  return match?.[1] ?? ''
}

export function Header({ withDivider = true }: { withDivider?: boolean }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const active = activeNavLabel(pathname)

  return (
    <header className={cn('hidden lg:block', withDivider && 'border-b')}>
      <div className="mx-auto flex h-11 max-w-content items-center justify-between px-6">
        <Link
          to="/"
          className={cn(linkFocusRing, 'text-body-14 font-bold tracking-[1.4px] text-foreground')}
        >
          KURIO
        </Link>

        <nav aria-label="Navegação" className="flex items-center gap-10">
          <Link
            to="/"
            className={cn(
              linkFocusRing,
              'text-body-16',
              active === 'Início' ? 'text-text-accent underline' : 'text-foreground',
            )}
          >
            Início
          </Link>
          {/* Mercado/Criadores/Aprenda não têm rota ainda — um link falso é
              pior a11y que texto simples; viram <Link> quando a rota nascer. */}
          <span className="text-body-16 text-foreground">Mercado</span>
          <span className="text-body-16 text-foreground">Criadores</span>
          <span className="text-body-16 text-foreground">Aprenda</span>
        </nav>

        <div className="flex items-center gap-7">
          <button type="button" disabled aria-label="Buscar" className="disabled:opacity-50">
            {/* fase 3 liga isto */}
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
    </header>
  )
}
