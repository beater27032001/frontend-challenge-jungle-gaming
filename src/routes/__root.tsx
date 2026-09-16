import { createRootRouteWithContext, Link, Outlet, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { MobileSearchBar } from '@/components/layout/mobile-search-bar'
import { TabBar } from '@/components/layout/tab-bar'
import { Toaster } from '@/components/ui/sonner'
import { useRealtime } from '@/features/realtime/use-realtime'
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
  // Rotas que no mobile trazem composição própria e dispensam a
  // MobileSearchBar e a TabBar:
  //
  // - `/nft/*` (fase 4): Buy Bar fixa de 164px no fundo.
  // - `/login` e `/cadastro` (fase 5, specs/05-auth.md §8): telas cheias com
  //   logo, título e form; nada no fundo. No desktop o Header/Footer seguem
  //   normais e a rota renderiza a aparência de modal sobre o `<main>` — não
  //   é um catálogo montado por trás, é `redirect` de volta à origem
  //   (compromisso registrado no ARCHITECTURE.md).
  // - `/carrinho` (fase 6, specs/06-carrinho.md §6): folha Payment Summary de
  //   342px no fundo; o frame tem Screen Header próprio.
  const isAuthRoute = pathname === '/login' || pathname === '/cadastro'
  const isCart = pathname === '/carrinho'
  const isBareMobile = isNftDetail || isAuthRoute || isCart
  // Fase 8: /perfil e /carteiras trazem Screen Header próprio (spec 08 §5.3),
  // então a MobileSearchBar sairia duplicada — mas a TabBar FICA: é por ela que
  // se chega ao perfil, e estas telas não ocupam o fundo com folha nenhuma.
  const isAccount = pathname === '/perfil' || pathname === '/carteiras'

  // Fase 9: uma única conexão Socket.IO para o app inteiro, atrelada ao
  // escopo do usuário. Ver src/features/realtime/use-realtime.ts.
  useRealtime()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <Header withDivider={!isNftDetail} />
      {!isBareMobile && !isAccount && <MobileSearchBar />}
      {/* pb-[126px] evita que a TabBar fixa encubra o fim do conteúdo em
          telas < lg (critério 18); some em lg, onde não há TabBar. Cada rota
          com composição própria paga o fundo que ela mesma ocupa: /carrinho
          a folha de 342px, /nft/* a Buy Bar de 164px, e /login e /cadastro
          nada, porque não têm barra no fundo. */}
      <main
        id="main"
        className={cn(
          isCart ? 'pb-[358px]' : isNftDetail ? 'pb-[164px]' : isAuthRoute ? 'pb-0' : 'pb-[126px]',
          'lg:pb-0',
        )}
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
