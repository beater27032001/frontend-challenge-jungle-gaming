import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginDesktop } from '@/features/auth/auth-desktop'
import { LoginMobile } from '@/features/auth/auth-mobile'

/**
 * Fase 5 (specs/05-auth.md §8, "Consequências"): rota real, não search
 * param — o mobile prova que login/cadastro são páginas. `redirect` carrega
 * a página de origem (setada pelo gatilho: header, coração de favorito,
 * interceptor de sessão expirada) para o "retorno ao fluxo anterior" (§3).
 * Uma rota, duas apresentações por breakpoint (`hidden lg:*`/`lg:hidden`) —
 * não dois mecanismos, mesmo padrão de `nft.$nftId.tsx`.
 */
export const loginSearchSchema = z.object({
  redirect: z.string().startsWith('/').optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  const redirectTo = redirect ?? '/'
  return (
    <>
      <LoginDesktop redirectTo={redirectTo} />
      <LoginMobile redirectTo={redirectTo} />
    </>
  )
}
