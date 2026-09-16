import { Heart, House, Plus, ShoppingCart, User } from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useCartCount } from '@/features/cart/queries'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * Mobile bottom navigation (spec §10, node `70395:245`). Mobile has no nav
 * drawer/Sheet (spec §11) — this fixed tab bar is the only mobile nav.
 */
export function TabBar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const isHomeActive = pathname === '/'
  const isProfileActive = pathname === '/perfil' || pathname === '/carteiras'
  const cartCount = useCartCount()

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-[126px] lg:hidden">
      {/* Camada de fundo isolada: o mask-image do entalhe fica só aqui, não
          no container — se estivesse no container, o recorte também
          "vazaria" para o FAB (que é filho e sobrepõe o topo da barra). */}
      <div
        aria-hidden
        className="absolute inset-0 bg-surface-card pb-[env(safe-area-inset-bottom)]"
        style={{
          // ponytail: placeholder — raio do entalhe não medido no Figma
          // (extração pixel-fina nasce na fase 10, junto das baselines visuais).
          maskImage: 'radial-gradient(circle 38px at 50% 0%, transparent 98%, black 100%)',
        }}
      />

      <Button
        type="button"
        size="icon"
        disabled // fases 3/6 ligam a criação de anúncio; sem consumidor ainda
        aria-label="Criar"
        className="absolute top-0 left-1/2 size-[65px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      >
        {/* ponytail: glifo não transcrito, calibrar com node 70395:245 */}
        <Plus className="size-6" />
      </Button>

      <nav aria-label="Navegação principal" className="relative flex h-full items-center justify-around px-6">
        <Link
          to="/"
          aria-current={isHomeActive ? 'page' : undefined}
          className={cn(
            linkFocusRing,
            'flex flex-col items-center gap-1 text-text-secondary',
            isHomeActive && 'text-text-accent',
          )}
        >
          <House className="size-5" />
          {/* Indicador não-cromático do item ativo (decisão 4 do
              ARCHITECTURE.md): estado nunca só por cor. */}
          {isHomeActive && <span aria-hidden className="size-1 rounded-full bg-current" />}
        </Link>
        <button
          type="button"
          disabled // fase 4 liga isto
          aria-label="Favoritos"
          className="flex flex-col items-center gap-1 text-text-secondary"
        >
          <Heart className="size-5" />
        </button>
        {/* Fase 6. Sem estado ativo: em `/carrinho` esta barra não é renderizada
            (a folha Payment Summary ocupa o fundo — __root.tsx). */}
        <Link
          to="/carrinho"
          aria-label={cartCount > 0 ? `Carrinho (${cartCount} ${cartCount === 1 ? 'item' : 'itens'})` : 'Carrinho'}
          className={cn(linkFocusRing, 'relative flex flex-col items-center gap-1 text-text-secondary')}
        >
          <ShoppingCart className="size-5" />
          {cartCount > 0 && (
            <span
              aria-hidden
              className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-primary text-tiny-10 font-bold text-primary-foreground"
            >
              {cartCount}
            </span>
          )}
        </Link>
        {/* Fase 8: rota real. `/perfil` é privada — sem sessão o `beforeLoad`
            redireciona para o login com `redirect=/perfil`, então o visitante
            não cai em tela vazia nem em 404. */}
        <Link
          to="/perfil"
          aria-label="Perfil"
          aria-current={isProfileActive ? 'page' : undefined}
          className={cn(
            linkFocusRing,
            'flex flex-col items-center gap-1 text-text-secondary',
            isProfileActive && 'text-text-accent',
          )}
        >
          <User className="size-5" />
          {isProfileActive && <span aria-hidden className="size-1 rounded-full bg-current" />}
        </Link>
      </nav>
    </div>
  )
}
