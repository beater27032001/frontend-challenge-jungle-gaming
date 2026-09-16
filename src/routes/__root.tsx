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
  // - `/pagamento` (fase 7, specs/07-checkout.md §6): Screen Header próprio e
  //   Confirm Button como ÚLTIMO elemento da coluna — não é barra fixa, então
  //   não paga `padding-bottom` de barra nenhuma.
  const isCheckout = pathname === '/pagamento'
  const isBareMobile = isNftDetail || isAuthRoute || isCart || isCheckout

  // /perfil e /carteiras (fase 8, spec 08 §5.3) são um caso à parte: têm Screen
  // Header próprio, então a MobileSearchBar sairia duplicada — mas a TabBar
  // FICA, porque é por ela que se chega ao perfil, e estas telas não ocupam o
  // fundo com folha nenhuma. Por isso um flag separado, e não mais um termo em
  // `isBareMobile`.
  const isAccount = pathname === '/perfil' || pathname === '/carteiras'

  // Fase 9: uma única conexão Socket.IO para o app inteiro, atrelada ao
  // escopo do usuário. Ver src/features/realtime/use-realtime.ts.
  useRealtime()

  // `min-h-dvh` sozinho esticava ESTE div além do conteúdo em página curta
  // (/login media 715 de conteúdo em viewport de 900): os 185px sobrando ficavam
  // ABAIXO do footer pintados de `ink`, que é a tira preta no fim da página.
  // Coluna flex com o `main` crescendo empurra o footer para a base — o espaço
  // sobrando passa a ser do main, e nada sobra depois do rodapé.
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
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
      {/* lg:pt-8 — no frame desktop o `Main` começa 32px abaixo do Header Row
          (specs/04-detalhe-nft.md OQ5: Top y=24, Header Row 45, Main y=77).
          /nft/*, /carrinho e /pagamento já pagam esse respiro no `py-8` da
          própria coluna; somar aqui daria 64. */}
      <main
        id="main"
        className={cn(
          'flex-1',
          isCart
            ? 'pb-[358px]'
            : isNftDetail
              ? 'pb-[166px]' // Buy Bar mede 166, não 164 — medido no DOM
              : isAuthRoute || isCheckout
                ? 'pb-0'
                : 'pb-[159px]', // TabBar 126 + o overhang de 33 do botão flutuante
          'lg:pb-0',
          !(isNftDetail || isCart || isCheckout) && 'lg:pt-8',
        )}
      >
        <Outlet />
      </main>
      {/* Sem rodapé em /perfil e /carteiras: os frames `9:1238` e `9:1670` têm
          1080px exatos e acabam logo depois do formulário, enquanto todo outro
          frame desktop vai de 1657 a 3668px. A ausência é recorte de viewport no
          Figma; seguir o recorte mesmo assim foi decisão do usuário. O Header
          fica (o Figma o desenha nas duas) e a TabBar mobile também, que é por
          onde se chega ao perfil. */}
      {!isAccount && <Footer />}
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
