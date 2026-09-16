import { isAxiosError } from 'axios'
import type { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import type { ApiError, LoginRequest } from '@/types'
import { registerSchema } from '@/types'

/**
 * Fase 5 (specs/05-auth.md §7.1/§8.4): o Figma pede "Confirmar senha" nos
 * dois formulários de cadastro (desktop e mobile) e o toggle de olho nos
 * dois campos de senha — mas o contrato (`registerSchema`) não tem
 * `confirmPassword`. Validação 100% client-side (zod `refine`); o campo
 * nunca é enviado à API (`register.mutate` recebe só `{ name, email,
 * password }`).
 */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha.') })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })
export type RegisterFormValues = z.infer<typeof registerFormSchema>

/**
 * Erros: 401 invalid_credentials → erro no nível do form (login); 400
 * validation_error → mapeia `error.details[campo]` para os campos.
 */
export function applyLoginError(form: UseFormReturn<LoginRequest>, error: unknown): void {
  if (isAxiosError<ApiError>(error) && error.response) {
    const apiError = error.response.data.error
    if (apiError.code === 'validation_error' && apiError.details) {
      for (const [field, message] of Object.entries(apiError.details)) {
        form.setError(field as keyof LoginRequest, { message })
      }
      return
    }
    form.setError('root', { message: apiError.message })
    return
  }
  form.setError('root', { message: 'Não foi possível entrar. Verifique sua conexão.' })
}

/** 409 email_taken → erro associado ao campo email (register). */
export function applyRegisterError(form: UseFormReturn<RegisterFormValues>, error: unknown): void {
  if (isAxiosError<ApiError>(error) && error.response) {
    const apiError = error.response.data.error
    if (apiError.code === 'validation_error' && apiError.details) {
      for (const [field, message] of Object.entries(apiError.details)) {
        form.setError(field as keyof RegisterFormValues, { message })
      }
      return
    }
    if (apiError.code === 'email_taken') {
      form.setError('email', { message: apiError.message })
      return
    }
    form.setError('root', { message: apiError.message })
    return
  }
  form.setError('root', { message: 'Não foi possível cadastrar. Verifique sua conexão.' })
}
