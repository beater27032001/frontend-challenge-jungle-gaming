import { createFileRoute } from '@tanstack/react-router'
import { RegisterDesktop } from '@/features/auth/auth-desktop'
import { RegisterMobile } from '@/features/auth/auth-mobile'
import { loginSearchSchema } from './login'

/** Fase 5 — irmã de `/login` (specs/05-auth.md §8), mesmo `redirect`. */
export const Route = createFileRoute('/cadastro')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: RegisterRoute,
})

function RegisterRoute() {
  const { redirect } = Route.useSearch()
  const redirectTo = redirect ?? '/'
  return (
    <>
      <RegisterDesktop redirectTo={redirectTo} />
      <RegisterMobile redirectTo={redirectTo} />
    </>
  )
}
