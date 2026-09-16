import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Fase 5 (specs/05-auth.md §7.1 + §8.4): o toggle de olho vale para TODO
 * campo de senha, nas duas superfícies — a assimetria do Figma (só "Senha"
 * no modal desktop, os dois campos no mobile) é resolvida a favor de dar o
 * olho a todos: esconder "Confirmar senha" sem poder revelá-lo é hostil, e
 * o próprio Figma já faz os dois no mobile (registrado em ARCHITECTURE.md).
 */
export function PasswordField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  inputClassName,
}: {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  placeholder: string
  inputClassName: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="sr-only">{label}</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                {...field}
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                className={cn(inputClassName, 'pr-11')}
              />
            </FormControl>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-4 top-1/2 flex h-5 w-[18px] -translate-y-1/2 items-center justify-center text-text-secondary"
            >
              {visible ? <EyeOff aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}
            </button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function TextField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = 'text',
  inputClassName,
}: {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  placeholder: string
  type?: string
  inputClassName: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="sr-only">{label}</FormLabel>
          <FormControl>
            <Input {...field} type={type} placeholder={placeholder} className={inputClassName} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
