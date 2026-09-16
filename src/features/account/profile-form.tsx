import { zodResolver } from '@hookform/resolvers/zod'
import { Image as ImageIcon } from 'lucide-react'
import { useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Form } from '@/components/ui/form'
import type { Profile } from '@/types'
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
import { applyFieldErrors, useChangePassword, useUpdateProfile } from './mutations'

/**
 * Perfil do colecionador (specs/08-perfil-carteiras.md §2, node `70386:239`).
 *
 * **Um formulário, um "Salvar".** O Figma desenha um único botão depois do
 * bloco "Alterar senha" (§2.3), então o submit faz as duas coisas: sempre
 * `PATCH /profile`, e `POST /profile/password` só quando o usuário digitou
 * algo nos campos de senha. Os três campos de senha são obrigatórios entre si
 * (nenhum tem asterisco no Figma, mas trocar senha exige os três).
 *
 * **"Apelido da carteira" não está aqui**: é `Wallet.label`, e o designer o
 * duplicou na tela errada (§2.4). **E-mail é `readOnly`**: o contrato o
 * definiu imutável na fase 1, e um campo editável que a API ignora é mentira
 * de UI.
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

export function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const fileRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: profile.name,
      username: profile.username,
      ensPrefix: profile.ensName.replace(/\.eth$/, ''),
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

  const pending = updateProfile.isPending || changePassword.isPending

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

          <div className="flex flex-col gap-[10px]">
            <PlainLabel>Avatar</PlainLabel>
            <div className="flex items-center gap-6">
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
