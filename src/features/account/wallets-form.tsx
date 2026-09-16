import { zodResolver } from '@hookform/resolvers/zod'
import { MoreVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { NETWORKS, WALLET_TYPES, type Wallet, type WalletRole } from '@/types'
import {
  AccountSelectField,
  AccountTextField,
  FieldRow,
  accountSubmitClass,
} from './fields'
import {
  applyFieldErrors,
  useCreateWallet,
  useDeleteWallet,
  useUpdateWallet,
} from './mutations'

/**
 * Carteiras (specs/08-perfil-carteiras.md §3, node `70390:239`).
 *
 * **O que saiu do desenho** (§3.5): "Nome de exibição", "Nome do perfil",
 * "E-mail" e "Nome ENS" são campos de PERFIL, duplicados aqui pelo designer —
 * gravar perfil e carteira na mesma submissão seria inventar comportamento
 * que o desafio não pede. Saiu também o input sem label da Field Row 3
 * ("ENS ou carteira secundária (opcional)"): §3.5 não lhe dá destino no
 * contrato, e campo que não salva é proibido pela regra 5. Registrado no
 * ARCHITECTURE.md.
 *
 * **Uma carteira por vez.** O Figma desenha um formulário ("Carteira
 * principal") e uma seção de "Carteira secundária" com estado vazio. Aqui é
 * um formulário só, e o `papel`/`carteira` da URL dizem o que ele está
 * fazendo: criar primária, criar secundária ou editar uma existente. Vai na
 * URL, não em `useState`, porque sobrevive a refresh (CLAUDE.md).
 */

const NETWORK_LABELS: Record<(typeof NETWORKS)[number], string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

const WALLET_TYPE_LABELS: Record<(typeof WALLET_TYPES)[number], string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

const networkOptions = NETWORKS.map((value) => ({ value, label: NETWORK_LABELS[value] }))
const typeOptions = WALLET_TYPES.map((value) => ({ value, label: WALLET_TYPE_LABELS[value] }))

const walletFormSchema = z.object({
  label: z.string().min(1, 'Informe um apelido.'),
  network: z.enum(NETWORKS, { message: 'Selecione uma rede.' }),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Use um endereço 0x com 40 caracteres hexadecimais.'),
  type: z.enum(WALLET_TYPES, { message: 'Selecione uma carteira.' }),
  referralCode: z.string().max(32, 'No máximo 32 caracteres.'),
})
type WalletFormValues = z.infer<typeof walletFormSchema>

const EMPTY: WalletFormValues = {
  label: '',
  network: 'ethereum',
  address: '',
  type: 'metamask',
  referralCode: '',
}

export interface WalletsFormProps {
  wallets: Wallet[]
  /** Carteira em edição; `null` = criando uma nova. Vem da URL. */
  editing: Wallet | null
  role: WalletRole
  onSelect: (params: { carteira?: string; papel?: WalletRole }) => void
}

export function WalletsForm({ wallets, editing, role, onSelect }: WalletsFormProps) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const remove = useDeleteWallet()
  const [confirming, setConfirming] = useState<Wallet | null>(null)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  const primary = wallets.find((w) => w.role === 'primary') ?? null
  const secondaries = wallets.filter((w) => w.role === 'secondary')

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: EMPTY,
  })

  // Trocar o alvo (editar outra, ou voltar a criar) recarrega o formulário.
  // Depende do id, não do objeto: um refetch que devolve a mesma carteira não
  // deve apagar o que o usuário está digitando.
  useEffect(() => {
    form.reset(
      editing
        ? {
            label: editing.label,
            network: editing.network,
            address: editing.address,
            type: editing.type,
            referralCode: editing.referralCode ?? '',
          }
        : EMPTY,
    )
    setSameAsPrimary(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  async function onSubmit(values: WalletFormValues) {
    const body = { ...values, role: editing ? editing.role : role }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      onSelect({})
      form.reset(EMPTY)
      setSameAsPrimary(false)
    } catch (error) {
      // O 409 de endereço duplicado vem sem `details` — cai no campo de
      // endereço, o único que pode causá-lo (§3.5, ⚠️).
      if (!applyFieldErrors(form, error, 'address')) {
        toast.error('Não foi possível salvar a carteira.')
      }
    }
  }

  const pending = create.isPending || update.isPending
  const formTitle = editing
    ? `Editando "${editing.label}"`
    : role === 'primary'
      ? 'Nova carteira principal'
      : 'Nova carteira secundária'

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-body-17 font-bold leading-4 text-foreground">Carteira principal</h2>
          <button
            type="button"
            onClick={() => onSelect({ papel: 'primary' })}
            className="text-body-16 font-medium leading-4 text-text-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
          >
            Adicionar
          </button>
        </div>
        <p className="text-body-14 leading-[15px] text-text-secondary">
          Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
        </p>
        {primary ? (
          <WalletCard
            wallet={primary}
            isEditing={editing?.id === primary.id}
            onEdit={() => onSelect({ carteira: primary.id })}
            onRemove={() => setConfirming(primary)}
            onMakePrimary={undefined}
            busy={remove.isPending || update.isPending}
          />
        ) : (
          <p className="text-body-14 leading-[15px] text-text-secondary">
            Você ainda não tem uma carteira principal.
          </p>
        )}
      </section>

      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
          <h3 className="text-body-16 font-medium leading-4 text-foreground">{formTitle}</h3>
          <div className="flex flex-col gap-6">
            <FieldRow>
              <AccountTextField
                control={form.control}
                name="label"
                label="Apelido da carteira"
                required
                gap="gap-1"
              />
              <AccountSelectField
                control={form.control}
                name="network"
                label="Rede"
                required
                placeholder="Selecione uma rede"
                options={networkOptions}
                gap="gap-1"
              />
            </FieldRow>
            <FieldRow>
              <AccountTextField
                control={form.control}
                name="address"
                label="Endereço da carteira"
                required
                placeholder="Endereço 0x da carteira"
                gap="gap-1"
              />
              <AccountSelectField
                control={form.control}
                name="type"
                label="Tipo de carteira"
                required
                placeholder="Selecione uma carteira"
                options={typeOptions}
                gap="gap-1"
              />
            </FieldRow>
            <FieldRow>
              {/* Sem asterisco, ao contrário do Figma: código de indicação
                  obrigatório trancaria quem não tem um (§3.5). */}
              <AccountTextField
                control={form.control}
                name="referralCode"
                label="Código de indicação"
                placeholder="Opcional"
                gap="gap-1"
              />
            </FieldRow>
          </div>
          <div className="flex items-center gap-6">
            <button type="submit" disabled={pending} className={accountSubmitClass}>
              {pending ? 'Salvando…' : 'Salvar carteira'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => onSelect({})}
                className="text-body-14 text-foreground underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </Form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-body-17 font-bold leading-4 text-foreground">Carteira secundária</h2>
          <div className="flex items-center gap-6">
            {/* Checkbox de verdade, com estado: copia rede, tipo e código da
                principal para o formulário. O ENDEREÇO não é copiado — dois
                registros com o mesmo endereço é justamente o 409 do POST. */}
            <label className="flex items-center gap-2 text-body-14 leading-4 text-foreground">
              <input
                type="checkbox"
                checked={sameAsPrimary}
                disabled={!primary}
                onChange={(event) => {
                  setSameAsPrimary(event.target.checked)
                  if (!primary) return
                  onSelect({ papel: 'secondary' })
                  form.reset(
                    event.target.checked
                      ? {
                          label: `${primary.label} (secundária)`,
                          network: primary.network,
                          address: '',
                          type: primary.type,
                          referralCode: primary.referralCode ?? '',
                        }
                      : EMPTY,
                  )
                }}
                className="size-4 rounded-full border border-border bg-transparent accent-primary disabled:opacity-50"
              />
              Igual à carteira principal
            </label>
            <button
              type="button"
              onClick={() => onSelect({ papel: 'secondary' })}
              className="text-body-16 font-medium leading-4 text-text-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
            >
              Adicionar
            </button>
          </div>
        </div>
        {secondaries.length === 0 ? (
          <p className="text-body-14 leading-[15px] text-text-secondary">
            Você ainda não adicionou uma carteira secundária.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {secondaries.map((wallet) => (
              <li key={wallet.id}>
                <WalletCard
                  wallet={wallet}
                  isEditing={editing?.id === wallet.id}
                  onEdit={() => onSelect({ carteira: wallet.id })}
                  onRemove={() => setConfirming(wallet)}
                  onMakePrimary={() =>
                    update.mutate({ id: wallet.id, body: { role: 'primary' } })
                  }
                  busy={remove.isPending || update.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Remover é destrutivo e irreversível: confirmação explícita (§3.5). */}
      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-md border-border-strong bg-card">
          <DialogTitle className="text-body-17 font-bold text-foreground">
            Remover carteira?
          </DialogTitle>
          <DialogDescription className="text-body-14 text-text-secondary">
            {confirming?.label} ({confirming?.address.slice(0, 6)}…
            {confirming?.address.slice(-4)}) deixa de estar disponível no pagamento. Não dá para
            desfazer.
          </DialogDescription>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="h-10 rounded-[3px] border border-border px-4 text-body-14 text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => {
                const target = confirming!
                remove.mutate(target, {
                  onSuccess: () => {
                    if (editing?.id === target.id) onSelect({})
                  },
                  onSettled: () => setConfirming(null),
                })
              }}
              className="h-10 rounded-[3px] bg-destructive px-4 text-body-14 font-bold text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
            >
              {remove.isPending ? 'Removendo…' : 'Remover'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Card de carteira derivado do único que o Figma tem: o do pagamento mobile
 * (spec 07 §6.3 — raio 14, nome 16px bold, detalhe 14px `text-secondary`,
 * menu `⋮`). O `⋮` é um disclosure com `aria-expanded`, não um menu ARIA
 * completo: três botões num painel resolvem o mesmo problema sem uma segunda
 * implementação de navegação por setas.
 */
function WalletCard({
  wallet,
  isEditing,
  onEdit,
  onRemove,
  onMakePrimary,
  busy,
}: {
  wallet: Wallet
  isEditing: boolean
  onEdit: () => void
  onRemove: () => void
  onMakePrimary?: () => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const panelId = `wallet-actions-${wallet.id}`

  return (
    <div
      className={cn(
        'flex min-h-[93px] flex-col justify-center gap-3 rounded-[14px] bg-surface-card p-4',
        isEditing && 'ring-1 ring-primary',
      )}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-body-16 font-bold text-foreground">{wallet.label}</span>
        <span className="truncate text-body-14 leading-[22px] text-text-secondary">
          {wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}
        </span>
        <span className="text-caption-12 text-text-secondary">
          {NETWORK_LABELS[wallet.network]} · {WALLET_TYPE_LABELS[wallet.type]} ·{' '}
          {wallet.role === 'primary' ? 'Principal' : 'Secundária'}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Ações da carteira ${wallet.label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
      >
        <MoreVertical aria-hidden className="size-5" />
      </button>
      </div>
      {/* O painel entra no fluxo em vez de flutuar sobre o card: sobreposto e
          absoluto, ele caía sob a TabBar fixa no mobile e ficava inclicável
          (pego pelo teste, não suposto). No fluxo, a página cresce e rola. */}
      {open && (
        <div
          id={panelId}
          className="flex flex-col rounded-[8px] border border-border-strong bg-surface-raised p-1"
        >
          {onMakePrimary && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                onMakePrimary()
              }}
              className="rounded-[6px] px-3 py-2 text-left text-body-14 text-foreground outline-none hover:bg-surface-card focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
            >
              Definir como principal
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
            className="rounded-[6px] px-3 py-2 text-left text-body-14 text-foreground outline-none hover:bg-surface-card focus-visible:ring-[3px] focus-visible:ring-ring/75"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
            className="rounded-[6px] px-3 py-2 text-left text-body-14 text-destructive outline-none hover:bg-surface-card focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
          >
            Remover
          </button>
        </div>
      )}
    </div>
  )
}
