import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <main id="main">
        <Outlet />
      </main>
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
      <Link to="/" className="text-body-16 font-bold text-primary underline">
        Voltar ao início
      </Link>
    </div>
  )
}
