import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { linkFocusRing, cn } from '@/lib/utils'
import type { LoginRequest } from '@/types'
import { loginSchema } from '@/types'
import { applyLoginError, applyRegisterError, registerFormSchema, type RegisterFormValues } from './auth-schemas'
import { PasswordField, TextField } from './fields'
import { EsqueceuSenha, SocialButtons } from './social'
import { useLogin, useRegister } from './use-auth'

/**
 * Fase 5 (specs/05-auth.md §8) — descoberta que muda a seção 1: no mobile
 * login/cadastro NÃO são o modal do desktop encolhido, são telas cheias
 * próprias (`70399:239`/`70410:4345` etc.), outro conjunto de primitivos
 * (input `h-50` raio 10 `pl-16`, CTA `358×60` raio 10) — não escalar do
 * desktop (`h-40` raio 5).
 */
const rootRoute = getRouteApi('__root__')

const inputClassName =
  'h-[50px] rounded-[10px] border-border-strong bg-transparent pl-4 pr-4 text-body-14 text-foreground placeholder:text-secondary focus-visible:border-primary focus-visible:ring-0'

const socialButtonClassName =
  'flex h-10 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[5px] border border-border-strong text-body-13 font-medium text-text-secondary opacity-50'

function MobileShell({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col gap-10 bg-background px-7 pt-20 pb-6 lg:hidden">
      <div className="flex h-[136px] items-center justify-center">
        <span className="text-[32px] font-bold tracking-[3.2px] text-foreground">KURIO</span>
      </div>
      <h1 className="text-center text-title-20 font-bold leading-4 text-foreground">{title}</h1>
      {children}
      {footer}
    </div>
  )
}

export function LoginMobile({ redirectTo }: { redirectTo: string }) {
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

  const search = { redirect: redirectTo === '/' ? undefined : redirectTo }

  return (
    <MobileShell
      title="Entrar"
      footer={
        <p className="text-center text-body-15 text-secondary">
          Novo na Kurio?{' '}
          <Link to="/cadastro" search={search} className={cn(linkFocusRing, 'font-medium text-text-accent')}>
            Crie uma conta
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <TextField
            control={form.control}
            name="email"
            label="E-mail"
            placeholder="contato@email.com"
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
            className="mt-3 h-[60px] w-full rounded-[10px] text-body-16 font-bold text-ink"
          >
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-6 flex flex-col gap-3">
          <SocialButtons dividerGap="gap-[10px]" buttonClassName={socialButtonClassName} />
        </div>
      </Form>
    </MobileShell>
  )
}

export function RegisterMobile({ redirectTo }: { redirectTo: string }) {
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

  const search = { redirect: redirectTo === '/' ? undefined : redirectTo }

  return (
    <MobileShell
      title="Criar perfil de colecionador"
      footer={
        <p className="text-center text-body-15 text-secondary">
          Já tem uma conta?{' '}
          <Link to="/login" search={search} className={cn(linkFocusRing, 'font-medium text-text-accent')}>
            Entre
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {/* Erros do Figma corrigidos (specs/05-auth.md §8.4): "User Name"
              (inglês) → "Nome de usuário"; placeholder centralizado → pl-4
              como os outros três campos. */}
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
            className="mt-3 h-[60px] w-full rounded-[10px] text-body-16 font-bold text-ink"
          >
            {register.isPending ? 'Criando perfil…' : 'Criar perfil'}
          </Button>
        </form>
        <div className="mt-6 flex flex-col gap-3">
          <SocialButtons dividerGap="gap-[10px]" buttonClassName={socialButtonClassName} />
        </div>
      </Form>
    </MobileShell>
  )
}
