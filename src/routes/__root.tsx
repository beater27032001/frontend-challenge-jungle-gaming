import { createRootRouteWithContext, Link, Outlet, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { MobileSearchBar } from '@/components/layout/mobile-search-bar'
import { TabBar } from '@/components/layout/tab-bar'
import { Toaster } from '@/components/ui/sonner'
import { cn, linkFocusRing } from '@/lib/utils'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

/**
 * Two distinct shell compositions (spec §11), not one header that adapts:
 * desktop (>=1024, `lg`) gets Header + Footer; mobile (<1024) gets the
 * search bar on top and the fixed TabBar at the bottom instead — no header,
 * no nav drawer on mobile (ARCHITECTURE.md decisions 1–2).
 */
function RootLayout() {
  // Fase 4 (specs/04-detalhe-nft.md §4): o frame mobile do detalhe (`15:5536`)
  // não tem MobileSearchBar nem TabBar — a Buy Bar fixa ocupa o fundo. O
  // header desktop de telas de mercado é sem divisor (specs/02 §2, doc do
  // componente).
  const pathname = useLocation({ select: (l) => l.pathname })
  const isNftDetail = pathname.startsWith('/nft/')
  // Fase 5 (specs/05-auth.md §8): no mobile, login/cadastro são telas
  // cheias com a própria composição (logo, título, form) — sem
  // MobileSearchBar/TabBar, mesmo tratamento do detalhe do NFT. No desktop
  // o Header/Footer seguem normais; a rota renderiza a "aparência de modal"
  // sobre o `<main>` (ver ARCHITECTURE.md — compromisso registrado: não é
  // um catálogo de fato montado por trás, é `redirect` de volta à página de
  // origem).
  const isAuthRoute = pathname === '/login' || pathname === '/cadastro'
  const isBareMobile = isNftDetail || isAuthRoute

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <Header withDivider={!isNftDetail} />
      {!isBareMobile && <MobileSearchBar />}
      {/* pb-[126px] evita que a TabBar fixa encubra o fim do conteúdo em
          telas < lg (critério 18); some em lg, onde não há TabBar. Em
          /nft/* a Buy Bar (164px) ocupa esse lugar em vez da TabBar; em
          /login e /cadastro a tela mobile não tem barra nenhuma no fundo. */}
      <main
        id="main"
        className={cn(isNftDetail ? 'pb-[164px]' : isAuthRoute ? 'pb-0' : 'pb-[126px]', 'lg:pb-0')}
      >
        <Outlet />
      </main>
      <Footer />
      {!isBareMobile && <TabBar />}
      <Toaster theme="dark" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-content flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-display-43 font-bold text-text-accent">404</h1>
      <p className="text-body-16 text-text-secondary">
        Esta página não existe.
      </p>
      <Link to="/" className={cn(linkFocusRing, 'text-body-16 font-bold text-primary underline')}>
        Voltar ao início
      </Link>
    </div>
  )
}
