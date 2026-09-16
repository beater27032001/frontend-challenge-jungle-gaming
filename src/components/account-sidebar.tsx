import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Download,
  Heart,
  LogOut,
  MapPin,
  ShoppingBag,
  User,
} from 'lucide-react'
import { Link, useCanGoBack, useLocation, useRouter } from '@tanstack/react-router'
import { useLogout } from '@/features/auth/use-auth'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * Account Sidebar (specs/08-perfil-carteiras.md §1). UM componente, não dois:
 * o Figma desenha a mesma sidebar de 310px nos nodes `70420:4536` (perfil) e
 * `70420:4594` (carteiras) — a única diferença é qual item está ativo, e isso
 * sai do pathname.
 *
 * **Estado ativo.** No Figma é só a barra de 6px à esquerda: todos os rótulos
 * já são `text-accent`, o ativo não muda de cor. Forma sem cor é o inverso do
 * problema usual, e não carrega nada para leitor de tela — por isso
 * `aria-current="page"` aqui não é enfeite, é o estado.
 *
 * **Os cinco itens sem tela** (Atividade, Lista de interesse, Ofertas,
 * Arquivos baixados, Suporte, decisão do usuário no §1) são `<span
 * aria-disabled>`, nunca `<a>`/`<Link>`: link para rota inexistente devolve
 * 404 e "ação fora do escopo não deve aparentar sucesso funcional"
 * (CHALLENGE §3).
 *
 * **Mobile** (nenhuma das duas telas tem frame): a sidebar vira a faixa de
 * navegação no topo da página (spec §5.1) e rola na horizontal dentro do
 * próprio container — o `<main>` nunca ganha scroll lateral.
 */

const INERT_ITEMS = [
  { label: 'Atividade', Icon: ShoppingBag, size: 'size-[18px]' },
  { label: 'Lista de interesse', Icon: Heart, size: 'size-4' },
  { label: 'Ofertas', Icon: Activity, size: 'size-[18px]' },
  { label: 'Arquivos baixados', Icon: Download, size: 'size-[18px]' },
  { label: 'Suporte', Icon: AlertTriangle, size: 'size-[18px]' },
] as const

const rowBase =
  'flex shrink-0 items-center px-4 text-body-15 leading-[45px] text-text-accent md:leading-[45px]'
// A barra do item ativo: à esquerda no desktop (Figma), embaixo no mobile,
// onde a faixa é horizontal e uma barra lateral não leria como "ativo".
const activeBar = 'border-b-4 border-primary md:border-b-0 md:border-l-[6px]'

/**
 * Shell das duas telas: `flex gap-28 items-start` no desktop (§1). No mobile
 * ganha o Screen Header do padrão carrinho/pagamento (círculo 35×35 + título
 * 20px bold), derivação §5.3 — nenhuma das duas telas tem frame mobile.
 */
export function AccountShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  return (
    <div className="mx-auto max-w-content px-7 py-8 md:px-6">
      <div className="mb-6 flex h-[44px] items-center gap-6 md:hidden">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (canGoBack ? router.history.back() : router.navigate({ to: '/' }))}
          className="flex size-[35px] shrink-0 items-center justify-center rounded-[17.5px] border border-border-strong bg-surface-raised outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
        >
          <ArrowLeft aria-hidden className="size-5 text-foreground" />
        </button>
        <h1 className="text-title-20 font-bold leading-4 text-foreground">{title}</h1>
      </div>
      <div className="flex flex-col items-stretch gap-8 md:flex-row md:items-start md:gap-28">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

export function AccountSidebar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const logout = useLogout()

  return (
    <nav
      aria-label="Minha conta"
      className="w-full shrink-0 bg-surface-card py-2 md:w-[310px] md:py-8"
    >
      <h2 className="px-4 pb-2 text-body-18 font-bold leading-4 text-foreground md:p-[10px] md:pb-[10px]">
        Meu perfil
      </h2>
      <ul className="flex overflow-x-auto md:flex-col md:overflow-x-visible">
        <li>
          <Link
            to="/perfil"
            aria-current={pathname === '/perfil' ? 'page' : undefined}
            className={cn(
              linkFocusRing,
              rowBase,
              'gap-4',
              pathname === '/perfil' && activeBar,
            )}
          >
            <User aria-hidden className="size-[18px] shrink-0" />
            Dados do perfil
          </Link>
        </li>
        <li>
          <Link
            to="/carteiras"
            aria-current={pathname === '/carteiras' ? 'page' : undefined}
            className={cn(
              linkFocusRing,
              rowBase,
              'gap-3',
              pathname === '/carteiras' && activeBar,
            )}
          >
            <MapPin aria-hidden className="size-5 shrink-0" />
            Carteiras
          </Link>
        </li>
        {INERT_ITEMS.map(({ label, Icon, size }) => (
          <li key={label}>
            <span aria-disabled="true" title="Em breve" className={cn(rowBase, 'gap-3')}>
              <Icon aria-hidden className={cn(size, 'shrink-0')} />
              {label}
            </span>
          </li>
        ))}
        <li className="md:mt-2 md:border-t md:border-border-strong md:pt-2">
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="flex h-10 shrink-0 items-center gap-2 px-4 text-body-15 leading-[15px] font-bold text-text-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
          >
            <LogOut aria-hidden className="size-5 shrink-0" />
            {logout.isPending ? 'Saindo…' : 'Sair'}
          </button>
        </li>
      </ul>
    </nav>
  )
}
