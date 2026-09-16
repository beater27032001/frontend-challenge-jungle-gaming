import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { cn } from '@/lib/utils'

/**
 * Primitivos das telas de perfil e carteiras (specs/08-perfil-carteiras.md
 * §2.1/§3.2): input `h-40` raio 3 borda `border`, sem fundo; label 15px
 * seguido do asterisco 22px `text-coral`. Não são os primitivos do login
 * (`h-50` raio 10) — o Figma usa outra família aqui, e escalar de uma para a
 * outra foi exatamente o erro das fases anteriores.
 *
 * `FormControl` do shadcn já pendura `aria-describedby` + `aria-invalid`, que
 * é o que faz o erro do servidor chegar ao leitor de tela junto do campo.
 */

export const accountInputClass =
  'h-10 w-full min-w-0 rounded-[3px] border border-border bg-transparent px-[13px] text-body-14 text-foreground outline-none placeholder:text-secondary focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive read-only:text-text-secondary'

/** 417px é a medida do Figma; em telas estreitas o campo é fluido (§5.2). */
export const fieldWidth = 'w-full md:max-w-[417px]'

export function RequiredMark() {
  return (
    <span aria-hidden className="text-title-22 leading-[29px] text-text-coral">
      *
    </span>
  )
}

/**
 * O asterisco fica FORA do `<label>`, como irmão. Dentro dele, o nome
 * acessível do campo viraria "Nome de exibição*" — o `aria-hidden` não tira o
 * glifo do texto do label. A obrigatoriedade viaja por `aria-required` no
 * input; o asterisco é só a marca visual do Figma.
 */
export function AccountFormLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  // `h-[29px]`: o asterisco é 22px com `leading-[29px]` (Figma), o rótulo é
  // 15/15. Sem altura fixa a linha do rótulo mede 29 COM asterisco e 15 SEM,
  // e as duas colunas de uma FieldRow saem desalinhadas por 14px — foi
  // exatamente isso entre "E-mail" (com) e "Nome ENS" (sem), e entre
  // "Apelido da carteira" (com) e "Avatar" (sem). 29 é a altura máxima que o
  // auto-layout do Figma já produz; fixá-la alinha sem inventar medida.
  return (
    <div className="flex h-[29px] items-center gap-1">
      <FormLabel className="text-body-15 leading-[15px] font-normal text-foreground">
        {children}
      </FormLabel>
      {required && <RequiredMark />}
    </div>
  )
}

/** Mesma aparência de label, fora do contexto do react-hook-form (campos que
 * não são estado de formulário: o e-mail readOnly e o grupo do avatar). */
export function PlainLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string
  children: React.ReactNode
  required?: boolean
}) {
  // Mesma altura fixa do AccountFormLabel, pelo mesmo motivo.
  return (
    <div className="flex h-[29px] items-center gap-1">
      <label htmlFor={htmlFor} className="text-body-15 leading-[15px] text-foreground">
        {children}
      </label>
      {required && <RequiredMark />}
    </div>
  )
}

export function AccountTextField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  placeholder,
  gap = 'gap-[10px]',
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  placeholder?: string
  gap?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('flex flex-col', gap, fieldWidth)}>
          <AccountFormLabel required={required}>{label}</AccountFormLabel>
          <FormControl>
            <input
              {...field}
              aria-required={required || undefined}
              placeholder={placeholder}
              className={accountInputClass}
            />
          </FormControl>
          <FormMessage className="text-caption-12" />
        </FormItem>
      )}
    />
  )
}

export function AccountSelectField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  placeholder,
  options,
  gap = 'gap-[10px]',
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  placeholder: string
  options: ReadonlyArray<{ value: string; label: string }>
  gap?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('flex flex-col', gap, fieldWidth)}>
          <AccountFormLabel required={required}>{label}</AccountFormLabel>
          <FormControl>
            {/* `<select>` nativo, não o Radix Select: o Figma pede caixa +
                Arrow-Down e nada mais — popover próprio seria código a mais
                para o mesmo comportamento, com pior teclado no mobile. */}
            <select
              {...field}
              aria-required={required || undefined}
              className={cn(accountInputClass, 'appearance-none pr-8')}
            >
              <option value="">{placeholder}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage className="text-caption-12" />
        </FormItem>
      )}
    />
  )
}

/**
 * Campo ENS composto (§2.1, node `70386:249`): caixa de 78px com o domínio à
 * esquerda e o input à direita. O domínio é um `<select>` de verdade — o
 * Figma desenha a seta — mas o arquivo só tem `.eth`, então essa é a única
 * opção; o valor gravado é o nome COMPLETO (prefixo + sufixo), composto no
 * submit.
 */
export function EnsField<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        // `gap-[10px]`, não `gap-1`: os vizinhos de linha (AccountTextField e
        // o bloco do e-mail) usam 10px entre rótulo e controle, e os 4px daqui
        // subiam o composto do ENS em relação ao campo E-mail ao lado.
        <FormItem className={cn('flex flex-col gap-[10px]', fieldWidth)}>
          {/* Sem asterisco, ao contrário do Figma: exigir um nome ENS trancaria
              quem não tem domínio — mesmo argumento do código de indicação
              (§3.5). Asterisco que o formulário não cobra é mentira de UI. */}
          <AccountFormLabel>{label}</AccountFormLabel>
          <div className="flex items-center gap-[10px]">
            <label className="sr-only" htmlFor={`${name}-domain`}>
              Domínio ENS
            </label>
            <select
              id={`${name}-domain`}
              defaultValue=".eth"
              className={cn(accountInputClass, 'w-[78px] shrink-0 px-[10px]')}
            >
              <option value=".eth">.eth</option>
            </select>
            <FormControl>
              <input {...field} placeholder="seunome" className={accountInputClass} />
            </FormControl>
          </div>
          <FormMessage className="text-caption-12" />
        </FormItem>
      )}
    />
  )
}

/** Password Input do Figma (`70504:2973`): 417×40, raio 3, ícone Hide à
 * direita. O componente não tem nó de texto no arquivo; o toggle é um
 * `<button>` com `aria-pressed`, como na fase 5. */
export function AccountPasswordField<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('flex flex-col gap-3', fieldWidth)}>
          <AccountFormLabel>{label}</AccountFormLabel>
          <div className="relative">
            <FormControl>
              <input
                {...field}
                type={visible ? 'text' : 'password'}
                autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
                className={cn(accountInputClass, 'pr-12')}
              />
            </FormControl>
            <button
              type="button"
              aria-pressed={visible}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setVisible((v) => !v)}
              className="absolute right-4 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-text-secondary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
            >
              {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
            </button>
          </div>
          <FormMessage className="text-caption-12" />
        </FormItem>
      )}
    />
  )
}

/** Duas colunas de 417 no desktop, uma coluna no mobile (§5.2). */
export function FieldRow({
  children,
  align = 'items-start',
}: {
  children: React.ReactNode
  align?: string
}) {
  return (
    <div className={cn('flex flex-col gap-6 md:flex-row md:justify-between', align)}>
      {children}
    </div>
  )
}

/** CTA: `131×40` raio 3 no desktop; no mobile o padrão dos frames existentes
 * (largura total, `h-60`, raio 40, gradiente) — §5.4. */
export const accountSubmitClass =
  'h-[60px] w-full rounded-[40px] bg-[linear-gradient(108.5deg,#d28a4c_0%,rgba(210,138,76,0.8)_100%)] text-body-16 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50 md:h-10 md:w-[131px] md:rounded-[3px] md:bg-primary md:bg-none md:text-body-14'
