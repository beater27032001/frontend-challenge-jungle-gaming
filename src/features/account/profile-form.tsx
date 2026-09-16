import { zodResolver } from '@hookform/resolvers/zod'
import { Image as ImageIcon } from 'lucide-react'
import { useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Link } from '@tanstack/react-router'
import { Form } from '@/components/ui/form'
import { cn, linkFocusRing } from '@/lib/utils'
import type { Profile, Wallet } from '@/types'
import {
  AccountPasswordField,
  AccountTextField,
  EnsField,
  FieldRow,
  PlainLabel,
  accountInputClass,
  accountSubmitClass,
  fieldWidth,
} from './fields'
import {
  applyFieldErrors,
  useChangePassword,
  useUpdateProfile,
  useUpdateWallet,
} from './mutations'

/**
 * Perfil do colecionador (specs/08-perfil-carteiras.md §2, node `70386:239`).
 *
 * **Um formulário, um "Salvar".** O Figma desenha um único botão depois do
 * bloco "Alterar senha" (§2.3), então o submit faz as duas coisas: sempre
 * `PATCH /profile`, e `POST /profile/password` só quando o usuário digitou
 * algo nos campos de senha. Os três campos de senha são obrigatórios entre si
 * (nenhum tem asterisco no Figma, mas trocar senha exige os três).
 *
 * **"Apelido da carteira" está aqui, sim.** A §2.4 do spec mandava removê-lo
 * alegando que pertencia à tela de carteiras; o usuário corrigiu — o campo
 * está desenhado neste frame (linha 3, coluna esquerda) e tem destino real.
 * Ele edita o `label` da carteira **primária** e salva por
 * `PATCH /wallets/:id` junto do submit. Sem carteira nenhuma, o campo não
 * some: renderiza desabilitado, explicando o porquê e apontando para
 * `/carteiras`.
 *
 * **E-mail é `readOnly`**: o contrato o definiu imutável na fase 1, e um
 * campo editável que a API ignora é mentira de UI.
 */

// 512KB: um avatar é gravado como data URL no db simulado (localStorage), que
// tem cota de poucos MB — acima disso o `persist()` estouraria e a tela
// perderia estado que já parecia salvo. Limite meu, não do Figma.
const MAX_AVATAR_BYTES = 512 * 1024

const profileFormSchema = z
  .object({
    name: z.string().min(2, 'Informe pelo menos 2 caracteres.'),
    username: z
      .string()
      .min(3, 'Informe pelo menos 3 caracteres.')
      .max(24, 'No máximo 24 caracteres.'),
    ensPrefix: z.string().max(60, 'No máximo 60 caracteres.'),
    // `walletSchema.label` exige `min(1)` no servidor; o formulário cobra o
    // mesmo antes de mandar, mas só quando existe carteira para editar.
    walletLabel: z.string(),
    avatarUrl: z.string(),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    const touched = values.currentPassword || values.newPassword || values.confirmPassword
    if (!touched) return
    if (!values.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual.' })
    }
    if (values.newPassword.length < 8) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Use ao menos 8 caracteres.' })
    }
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'As senhas não coincidem.',
      })
    }
  })

type ProfileFormValues = z.infer<typeof profileFormSchema>

const ENS_SUFFIX = '.eth'

export function ProfileForm({
  profile,
  primaryWallet,
}: {
  profile: Profile
  primaryWallet: Wallet | null
}) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const updateWallet = useUpdateWallet()
  const fileRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: profile.name,
      username: profile.username,
      ensPrefix: profile.ensName.replace(/\.eth$/, ''),
      walletLabel: primaryWallet?.label ?? '',
      avatarUrl: profile.avatarUrl,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const avatarUrl = useWatch({ control: form.control, name: 'avatarUrl' })

  async function onSubmit(values: ProfileFormValues) {
    try {
      await updateProfile.mutateAsync({
        name: values.name,
        username: values.username,
        ensName: values.ensPrefix ? values.ensPrefix + ENS_SUFFIX : '',
        avatarUrl: values.avatarUrl,
      })
    } catch (error) {
      // O 409 de `username` vem com `details.username`, então cai no campo.
      if (!applyFieldErrors(form, error, 'username')) {
        toast.error('Não foi possível salvar o perfil.')
      }
      return
    }

    // Apelido da carteira: só vai ao servidor se existe primária E o valor
    // mudou — um PATCH por submit sem mudança poluiria o toast e o histórico.
    if (primaryWallet && values.walletLabel !== primaryWallet.label) {
      if (!values.walletLabel.trim()) {
        form.setError('walletLabel', { message: 'Informe um apelido.' })
        return
      }
      try {
        await updateWallet.mutateAsync({
          id: primaryWallet.id,
          body: { label: values.walletLabel },
        })
      } catch (error) {
        if (!applyFieldErrors(form, error, 'walletLabel')) {
          toast.error('Não foi possível salvar o apelido da carteira.')
        }
        return
      }
    }

    const changing =
      values.currentPassword || values.newPassword || values.confirmPassword ? true : false
    if (!changing) return
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      form.resetField('currentPassword')
      form.resetField('newPassword')
      form.resetField('confirmPassword')
    } catch (error) {
      // O handler devolve `{ currentPassword: 'Senha atual incorreta.' }`.
      if (!applyFieldErrors(form, error, 'currentPassword')) {
        toast.error('Não foi possível alterar a senha.')
      }
    }
  }

  function onAvatarPicked(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      form.setError('avatarUrl', { message: 'Escolha uma imagem de até 512 KB.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      form.clearErrors('avatarUrl')
      form.setValue('avatarUrl', String(reader.result), { shouldDirty: true })
    }
    reader.readAsDataURL(file)
  }

  const pending = updateProfile.isPending || changePassword.isPending || updateWallet.isPending

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
        <h2 className="text-body-16 font-bold leading-4 text-foreground">
          Perfil do colecionador
        </h2>

        <div className="flex flex-col gap-6">
          <FieldRow>
            <AccountTextField control={form.control} name="name" label="Nome de exibição" required />
            <AccountTextField
              control={form.control}
              name="username"
              label="Nome de usuário"
              required
            />
          </FieldRow>

          <FieldRow>
            {/* E-mail imutável no contrato (src/types/profile.ts): renderizado
                readOnly com a explicação associada por aria-describedby. */}
            <div className={`flex flex-col gap-[10px] ${fieldWidth}`}>
              <PlainLabel htmlFor="profile-email" required>
                E-mail
              </PlainLabel>
              <input
                id="profile-email"
                type="email"
                readOnly
                value={profile.email}
                aria-describedby="profile-email-hint"
                className={accountInputClass}
              />
              <p id="profile-email-hint" className="text-caption-12 text-text-secondary">
                O e-mail da conta não pode ser alterado por aqui.
              </p>
            </div>
            <EnsField control={form.control} name="ensPrefix" label="Nome ENS" />
          </FieldRow>

          {/* Linha 3 do frame `9:1238`: apelido da carteira à ESQUERDA,
              avatar à direita. Antes o avatar ocupava a linha inteira
              sozinho e o apelido não existia. */}
          <FieldRow>
            {primaryWallet ? (
              <AccountTextField
                control={form.control}
                name="walletLabel"
                label="Apelido da carteira"
                required
              />
            ) : (
              // Sem carteira o campo NÃO some: sumiço sem explicação é pior
              // que desabilitado que se explica.
              <div className={cn('flex min-w-0 flex-col gap-[10px]', fieldWidth)}>
                <PlainLabel htmlFor="profile-wallet-label" required>
                  Apelido da carteira
                </PlainLabel>
                <input
                  id="profile-wallet-label"
                  disabled
                  value=""
                  readOnly
                  aria-describedby="profile-wallet-label-hint"
                  className={cn(accountInputClass, 'opacity-50')}
                />
                <p id="profile-wallet-label-hint" className="text-caption-12 text-text-secondary">
                  Cadastre uma carteira em{' '}
                  <Link
                    to="/carteiras"
                    className={cn(linkFocusRing, 'text-text-accent underline')}
                  >
                    Carteiras
                  </Link>{' '}
                  para dar um apelido a ela.
                </p>
              </div>
            )}

            {/* `min-w-0` + `flex-wrap`: com a linha 3 em duas colunas, o
                bloco do avatar (50px + botão de 98px + "Remover") tem
                min-content rígido e, a 768, empurrava a página para 809 de
                scrollWidth. Medido antes/depois. */}
            <div className={cn('flex min-w-0 flex-col gap-[10px]', fieldWidth)}>
              <PlainLabel>Avatar</PlainLabel>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* O `p-12` do Figma emoldura o ícone de placeholder; com imagem
                  de verdade ele só encolheria o avatar. */}
              <span
                className={`flex size-[50px] shrink-0 items-center justify-center overflow-hidden rounded-[25px] border border-border bg-surface-raised ${avatarUrl ? '' : 'p-3'}`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  <ImageIcon aria-hidden className="size-6 text-text-secondary" />
                )}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Escolher imagem do avatar"
                onChange={(event) => onAvatarPicked(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-10 w-[98px] shrink-0 rounded-[3px] bg-primary text-body-14 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
              >
                Alterar
              </button>
              <button
                type="button"
                onClick={() => form.setValue('avatarUrl', '', { shouldDirty: true })}
                className="text-body-14 leading-4 text-foreground underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
              >
                Remover
              </button>
              </div>
              {form.formState.errors.avatarUrl?.message && (
                <p role="alert" className="text-caption-12 text-destructive">
                  {form.formState.errors.avatarUrl.message}
                </p>
              )}
            </div>
          </FieldRow>
        </div>

        <div className="flex flex-col gap-6">
          <h3 className="text-body-16 font-medium leading-4 text-foreground">Alterar senha</h3>
          <AccountPasswordField
            control={form.control}
            name="currentPassword"
            label="Senha atual"
          />
          <AccountPasswordField control={form.control} name="newPassword" label="Nova senha" />
          <AccountPasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirmar nova senha"
          />
        </div>

        <button type="submit" disabled={pending} className={accountSubmitClass}>
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Form>
  )
}
