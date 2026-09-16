import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AccountShell } from '@/components/account-sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { profileOptions, useAccountScope, walletsOptions } from '@/features/account/queries'
import { ProfileForm } from '@/features/account/profile-form'
import { sessionOptions } from '@/features/auth/use-session'
import { apiErrorOf } from '@/lib/api'

/**
 * Perfil do colecionador (specs/08-perfil-carteiras.md §2). Rota privada: a
 * proteção é do router (`beforeLoad`), como o §4 do desafio pede, e leva o
 * `redirect` para o login retomar exatamente aqui.
 */
export const Route = createFileRoute('/perfil')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionOptions)
    if (!session) throw redirect({ to: '/login', search: { redirect: location.pathname } })
  },
  component: PerfilPage,
})

function PerfilPage() {
  const { scope, ready } = useAccountScope()
  const profile = useQuery({ ...profileOptions(scope), enabled: ready })
  // "Apelido da carteira" (linha 3 do frame `9:1238`) edita o `label` da
  // carteira primária, então o formulário só nasce depois que as carteiras
  // chegam — `defaultValues` do react-hook-form é lido uma vez, no mount.
  const wallets = useQuery({ ...walletsOptions(scope), enabled: ready })
  const primaryWallet = wallets.data?.find((w) => w.role === 'primary') ?? null

  return (
    <AccountShell title="Perfil do colecionador">
      {profile.isPending || wallets.isPending || !ready ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-5 w-56" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full max-w-[417px] rounded-[3px]" />
          ))}
        </div>
      ) : profile.isError || !profile.data ? (
        <p role="alert" className="text-body-16 text-destructive">
          {apiErrorOf(profile.error)?.message ?? 'Não foi possível carregar seu perfil.'}
        </p>
      ) : (
        // `key` garante que o formulário renasça com os valores do usuário
        // corrente: trocar de usuário não pode deixar rascunho do anterior.
        <ProfileForm
          key={`${profile.data.id}:${primaryWallet?.id ?? 'none'}`}
          profile={profile.data}
          primaryWallet={primaryWallet}
        />
      )}
    </AccountShell>
  )
}
