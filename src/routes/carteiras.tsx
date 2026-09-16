import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountShell } from '@/components/account-sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountScope, walletsOptions } from '@/features/account/queries'
import { WalletsForm } from '@/features/account/wallets-form'
import { sessionOptions } from '@/features/auth/use-session'
import { apiErrorOf } from '@/lib/api'
import type { WalletRole } from '@/types'

/**
 * Carteiras (specs/08-perfil-carteiras.md §3). Rota privada, mesma proteção
 * do perfil.
 *
 * `carteira` (id em edição) e `papel` (o papel da carteira nova) moram na
 * URL: sobrevivem a refresh e ao histórico, como manda o CLAUDE.md. Valor
 * inválido cai no `catch` do zod e volta ao default — link velho não quebra a
 * tela.
 */
const walletsSearchSchema = z.object({
  carteira: z.string().min(1).max(64).optional().catch(undefined),
  papel: z.enum(['primary', 'secondary']).optional().catch(undefined),
})

export const Route = createFileRoute('/carteiras')({
  validateSearch: (search) => walletsSearchSchema.parse(search),
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionOptions)
    if (!session) throw redirect({ to: '/login', search: { redirect: location.pathname } })
  },
  component: CarteirasPage,
})

function CarteirasPage() {
  const { carteira, papel } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { scope, ready } = useAccountScope()
  const wallets = useQuery({ ...walletsOptions(scope), enabled: ready })

  const list = wallets.data ?? []
  const editing = list.find((w) => w.id === carteira) ?? null
  const role: WalletRole = papel ?? 'primary'

  return (
    <AccountShell title="Carteiras">
      {wallets.isPending || !ready ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-[93px] w-full rounded-[14px]" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full max-w-[417px] rounded-[3px]" />
          ))}
        </div>
      ) : wallets.isError ? (
        <p role="alert" className="text-body-16 text-destructive">
          {apiErrorOf(wallets.error)?.message ?? 'Não foi possível carregar suas carteiras.'}
        </p>
      ) : (
        <WalletsForm
          wallets={list}
          editing={editing}
          role={role}
          onSelect={({ carteira, papel }) =>
            navigate({ search: { carteira, papel }, resetScroll: false })
          }
        />
      )}
    </AccountShell>
  )
}
