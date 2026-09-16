import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type {
  ApiError,
  ChangePasswordRequest,
  CreateWalletRequest,
  Profile,
  UpdateProfileRequest,
  UpdateWalletRequest,
  Wallet,
} from '@/types'
import { profileOptions, useAccountScope, walletsOptions } from './queries'

/**
 * Fase 8 (specs/08-perfil-carteiras.md §4). Toda mutation daqui dá feedback
 * acessível (toast do sonner, que é `role="status"`) e, quando o servidor
 * aponta um campo, o erro é pendurado NO campo — `applyFieldErrors` abaixo é
 * o único caminho para isso, para o 409 de `username` e o de endereço não
 * divergirem.
 */

/**
 * Mapeia o erro do servidor para o formulário. Duas formas de resposta:
 *
 * - com `details` (validação e o 409 de `username`): campo a campo;
 * - sem `details` (o 409 de endereço duplicado, que o mock devolve seco):
 *   `fallbackField` diz em qual input pendurar — na tela de carteiras, o de
 *   endereço, que é o único que pode causá-lo.
 *
 * Devolve `true` quando conseguiu associar a algum campo: o call-site só
 * mostra toast quando ninguém ficou responsável pelo erro.
 */
export function applyFieldErrors(
  // Qualquer um dos dois formulários desta feature; o que importa é o
  // `setError`, e tipar o campo por formulário exigiria um genérico por
  // call-site sem ganhar nada.
  form: UseFormReturn<any>,
  error: unknown,
  fallbackField?: string,
): boolean {
  if (!isAxiosError<ApiError>(error) || !error.response) return false
  const apiError = error.response.data?.error
  if (!apiError) return false

  const details = apiError.details
  if (details && Object.keys(details).length > 0) {
    for (const [field, message] of Object.entries(details)) {
      form.setError(field as never, { message })
    }
    return true
  }
  if (fallbackField && error.response.status === 409) {
    form.setError(fallbackField, { message: apiError.message })
    return true
  }
  return false
}

function messageOf(error: unknown, fallback: string): string {
  return (
    (isAxiosError<ApiError>(error) && error.response?.data?.error?.message) || fallback
  )
}

export function useUpdateProfile(): UseMutationResult<Profile, unknown, UpdateProfileRequest> {
  const client = useQueryClient()
  const { scope } = useAccountScope()
  return useMutation({
    mutationFn: async (body) => (await api.patch<Profile>('/profile', body)).data,
    onSuccess: (profile) => {
      client.setQueryData(profileOptions(scope).queryKey, profile)
      // O nome e o avatar aparecem no header, que lê a sessão — não o perfil.
      client.invalidateQueries({ queryKey: ['session'] })
      toast.success('Perfil salvo')
    },
  })
}

export function useChangePassword(): UseMutationResult<void, unknown, ChangePasswordRequest> {
  return useMutation({
    mutationFn: async (body) => {
      await api.post('/profile/password', body)
    },
    onSuccess: () => toast.success('Senha alterada'),
  })
}

/**
 * `POST /wallets` rebaixa as outras a `secondary` quando entra uma `primary`
 * (handler da fase 1). O aviso não é cosmético: sem ele o usuário só descobre
 * que perdeu a principal ao recarregar (spec §3.5, ⚠️).
 */
export function useCreateWallet(): UseMutationResult<Wallet, unknown, CreateWalletRequest> {
  const client = useQueryClient()
  const { scope } = useAccountScope()
  const key = walletsOptions(scope).queryKey
  return useMutation({
    mutationFn: async (body) => (await api.post<Wallet>('/wallets', body)).data,
    onSuccess: (wallet) => {
      const demoted = client
        .getQueryData<Wallet[]>(key)
        ?.find((w) => w.role === 'primary' && w.id !== wallet.id)
      client.invalidateQueries({ queryKey: key })
      toast.success(
        wallet.role === 'primary' && demoted
          ? `${wallet.label} agora é a carteira principal. "${demoted.label}" passou a secundária.`
          : 'Carteira salva',
      )
    },
  })
}

export function useUpdateWallet(): UseMutationResult<
  Wallet,
  unknown,
  { id: string; body: UpdateWalletRequest }
> {
  const client = useQueryClient()
  const { scope } = useAccountScope()
  const key = walletsOptions(scope).queryKey
  return useMutation({
    mutationFn: async ({ id, body }) => (await api.patch<Wallet>(`/wallets/${id}`, body)).data,
    onSuccess: (wallet, { body }) => {
      const demoted = client
        .getQueryData<Wallet[]>(key)
        ?.find((w) => w.role === 'primary' && w.id !== wallet.id)
      client.invalidateQueries({ queryKey: key })
      toast.success(
        body.role === 'primary' && demoted
          ? `${wallet.label} agora é a carteira principal. "${demoted.label}" passou a secundária.`
          : 'Carteira atualizada',
      )
    },
  })
}

/**
 * O 204 do DELETE não diz qual secundária foi promovida (spec §3.5), então o
 * aviso é montado aqui: a lista em cache antes da remoção mais a regra do
 * handler (a secundária mais antiga) dão o nome sem inventar um contrato.
 * Promoção silenciosa é a armadilha que o spec pede para evitar.
 */
export function useDeleteWallet(): UseMutationResult<void, unknown, Wallet> {
  const client = useQueryClient()
  const { scope } = useAccountScope()
  const key = walletsOptions(scope).queryKey
  return useMutation({
    mutationFn: async (wallet) => {
      await api.delete(`/wallets/${wallet.id}`)
    },
    onSuccess: (_data, wallet) => {
      const heir =
        wallet.role === 'primary'
          ? client
              .getQueryData<Wallet[]>(key)
              ?.filter((w) => w.id !== wallet.id && w.role === 'secondary')
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
          : undefined
      client.invalidateQueries({ queryKey: key })
      toast.success(
        heir
          ? `Carteira removida. "${heir.label}" passou a ser a principal.`
          : 'Carteira removida',
      )
    },
    onError: (error) =>
      toast.error(messageOf(error, 'Não foi possível remover a carteira.')),
  })
}
