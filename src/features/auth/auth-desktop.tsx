import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/use-media-query'
import type { LoginRequest } from '@/types'
import { loginSchema } from '@/types'
import { applyLoginError, applyRegisterError, registerFormSchema, type RegisterFormValues } from './auth-schemas'
import { PasswordField, TextField } from './fields'
import { EsqueceuSenha, SocialButtons, SocialButtonsList, SocialDivider } from './social'
import { useLogin, useRegister } from './use-auth'

/**
 * Fase 5 (specs/05-auth.md §3/§7) — modal desktop, node `70381:239`
 * (login) / `70383:239` (cadastro): mesma casca (500×600, `bg-surface-card`,
 * raio 8), conteúdo que difere só em abas/subtítulo/campos/CTA.
 *
 * `DialogPrimitive.Content`/`DialogOverlay` diretos (não `<DialogContent>`)
 * porque as duas composições (`LoginDesktop`+`LoginMobile` no mesmo
 * `/login`) montam juntas — `hidden lg:grid`/`hidden lg:block` escondem o
 * painel E o overlay em `<lg`; `<DialogContent>` só expõe a classe do
 * painel, deixando o overlay escuro cobrindo a tela mobile por trás.
 */
const rootRoute = getRouteApi('__root__')

const inputClassName =
  'h-10 rounded-[5px] border-border-strong bg-transparent px-4 py-3 text-body-14 text-foreground placeholder:text-secondary focus:border-primary focus-visible:ring-0'

const socialButtonClassName =
  'flex h-10 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[5px] border border-border-strong text-body-13 font-medium text-text-secondary opacity-50'

/** Rotas com guarda de sessão. Fechar o modal de auth não pode navegar para
 * elas: a guarda devolveria para /login e o modal reabriria. */
const PRIVATE_ROUTES = new Set(['/perfil', '/carteiras', '/pagamento'])

function DesktopTabs({ active, redirectTo }: { active: 'login' | 'register'; redirectTo: string }) {
  const search = { redirect: redirectTo === '/' ? undefined : redirectTo }
  return (
    <div role="tablist" aria-label="Entrar ou criar conta" className="flex justify-center gap-2">
      <Link
        to="/login"
        search={search}
        role="tab"
        aria-selected={active === 'login'}
        className={cn(
          'text-title-20-medium font-medium leading-4',
          active === 'login' ? 'text-text-accent' : 'text-foreground',
        )}
      >
        Entrar
      </Link>
      <span aria-hidden className="h-4 w-px bg-text-coral" />
      <Link
        to="/cadastro"
        search={search}
        role="tab"
        aria-selected={active === 'register'}
        className={cn(
          'text-title-20-medium font-medium leading-4',
          active === 'register' ? 'text-text-accent' : 'text-foreground',
        )}
      >
        Criar conta
      </Link>
    </div>
  )
}

function DesktopShell({
  mode,
  subtitle,
  redirectTo,
  showBottomBar,
  children,
}: {
  mode: 'login' | 'register'
  subtitle: string
  redirectTo: string
  showBottomBar: boolean
  children: React.ReactNode
}) {
  const navigate = rootRoute.useNavigate()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  function close() {
    // Fechar NUNCA pode voltar para uma rota privada: a guarda dela manda de
    // volta para /login com o mesmo `redirect`, e o modal reabre — laço sem
    // saída. Visitante que caiu aqui vindo de /perfil fecha e vai para a home.
    navigate({ to: PRIVATE_ROUTES.has(redirectTo) ? '/' : redirectTo })
  }

  // Só monta o Dialog do Radix (focus trap/Esc) em >=lg — ver
  // use-media-query.ts. Abaixo de lg é `LoginMobile`/`RegisterMobile` quem
  // recebe o foco, não um painel invisível deste Dialog.
  if (!isDesktop) return null

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-[8px] border border-border-strong bg-surface-card outline-none',
          )}
        >
          <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</DialogTitle>
          <DialogClose
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-xs text-foreground opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/75"
          >
            <X aria-hidden className="size-[18px]" />
          </DialogClose>

          <div className="flex flex-col gap-10 px-12 pt-12">
            <DesktopTabs active={mode} redirectTo={redirectTo} />
            <p className="text-center text-caption-13 leading-4 text-foreground">{subtitle}</p>
          </div>

          {children}

          {/* Barra de 10px em `primary` colada no rodapé — só o login (§3);
              o cadastro tem a mesma faixa fora dos 600px (§7.4), sobra de
              composição descartada, registrado em ARCHITECTURE.md. */}
          {showBottomBar && <div aria-hidden className="absolute inset-x-0 bottom-0 h-[10px] bg-primary" />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export function LoginDesktop({ redirectTo }: { redirectTo: string }) {
  const navigate = rootRoute.useNavigate()
  const login = useLogin()
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: LoginRequest) {
    form.clearErrors('root')
    login.mutate(values, {
      onSuccess: () => navigate({ to: redirectTo }),
      onError: (error) => applyLoginError(form, error),
    })
  }

  return (
    <DesktopShell
      mode="login"
      subtitle="Entre para gerenciar sua carteira, coleção e perfil de criador."
      redirectTo={redirectTo}
      showBottomBar
    >
      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 px-20 pt-6">
          <TextField
            control={form.control}
            name="email"
            label="E-mail"
            placeholder="E-mail"
            type="email"
            inputClassName={inputClassName}
          />
          <PasswordField
            control={form.control}
            name="password"
            label="Senha"
            placeholder="Senha"
            inputClassName={inputClassName}
          />
          <EsqueceuSenha className="cursor-not-allowed text-body-14 text-text-accent opacity-50" />
          {form.formState.errors.root?.message && (
            <p role="alert" className="text-body-14 text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={login.isPending}
            className="mt-3 h-[45px] w-full rounded-[5px] text-body-16 font-bold text-ink"
          >
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        <div className="flex flex-col gap-3 px-20 pt-6 pb-[22px]">
          <SocialButtons dividerGap="gap-3" buttonClassName={socialButtonClassName} />
        </div>
      </Form>
    </DesktopShell>
  )
}

export function RegisterDesktop({ redirectTo }: { redirectTo: string }) {
  const navigate = rootRoute.useNavigate()
  const register = useRegister()
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  function onSubmit(values: RegisterFormValues) {
    form.clearErrors('root')
    register.mutate(
      { name: values.name, email: values.email, password: values.password },
      {
        onSuccess: () => navigate({ to: redirectTo }),
        onError: (error) => applyRegisterError(form, error),
      },
    )
  }

  return (
    <DesktopShell
      mode="register"
      subtitle="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      redirectTo={redirectTo}
      showBottomBar={false}
    >
      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 px-20 pt-6">
          <TextField
            control={form.control}
            name="name"
            label="Nome de usuário"
            placeholder="Nome de usuário"
            inputClassName={inputClassName}
          />
          <TextField
            control={form.control}
            name="email"
            label="E-mail"
            placeholder="Digite seu e-mail"
            type="email"
            inputClassName={inputClassName}
          />
          <PasswordField
            control={form.control}
            name="password"
            label="Senha"
            placeholder="Senha"
            inputClassName={inputClassName}
          />
          <PasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirmar senha"
            placeholder="Confirmar senha"
            inputClassName={inputClassName}
          />
          {form.formState.errors.root?.message && (
            <p role="alert" className="text-body-14 text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={register.isPending}
            className="mt-3 h-[45px] w-full rounded-[5px] text-body-16 font-bold text-ink"
          >
            {register.isPending ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>
        {/* Divisor largura total do modal, sem o inset de 80px (§7.3);
            botões mantêm o inset. */}
        <div className="flex flex-col gap-4 pt-6 pb-[22px]">
          <SocialDivider className="flex items-center gap-3 text-caption-13 text-foreground" />
          <div className="flex flex-col gap-3 px-20">
            <SocialButtonsList buttonClassName={socialButtonClassName} />
          </div>
        </div>
      </Form>
    </DesktopShell>
  )
}
