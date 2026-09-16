import { ArrowLeft } from 'lucide-react'
import { useCanGoBack, useRouter } from '@tanstack/react-router'
import { useRef } from 'react'
import { NETWORK_LABELS } from '@/features/nft/labels'
import { NETWORKS } from '@/types'
import { cn } from '@/lib/utils'
import { ethLabel, shortHex, type CheckoutViewProps } from '../checkout-state'
import { ConfirmBlock } from './confirm-block'
import { RadioDot } from './checkout-desktop'

/** Gradiente do Confirm Button (§6.6, 108.48deg) — quase o mesmo do CTA do
 * carrinho mobile (108.86deg). Tailwind não expressa o par de stops com
 * opacidade, então vai por `style`, como no carrinho. */
const CONFIRM_GRADIENT = {
  background: 'linear-gradient(108.48deg, #d28a4c 3.96%, rgba(210,138,76,0.8) 121.97%)',
} as const

/**
 * Composição mobile (specs/07-checkout.md §6, node `16:748`), `lg:hidden` — e o
 * desenho **canônico** desta fase: ele não tem formulário de pagamento nenhum,
 * só a escolha de carteira e de rede (§6.7). Foi ele que resolveu a tensão dos
 * nove campos do frame desktop.
 *
 * Coluna única: Screen Header, barra "Carteira conectada", cards de carteira,
 * "Carteira e rede", linha de Total e o Confirm Button — que é o **último
 * elemento da coluna**, não uma barra fixa (§6, "há 107px de folga"). É a
 * diferença em relação ao carrinho mobile, cuja folha de resumo é fixa; por isso
 * `/pagamento` não paga `padding-bottom` de barra no `__root`.
 */
export function CheckoutMobile(props: CheckoutViewProps) {
  const { summary, wallets, isWalletsPending, walletId, onSelectWallet, network, onSelectNetwork, phase } =
    props

  const router = useRouter()
  const canGoBack = useCanGoBack()
  const walletGroupRef = useRef<HTMLFieldSetElement>(null)
  const locked = phase.kind !== 'idle' && phase.kind !== 'revalidate' && phase.kind !== 'error'
  const selected = wallets.find((w) => w.id === walletId) ?? null

  function handleBack() {
    if (canGoBack) router.history.back()
    else router.navigate({ to: '/carrinho' })
  }

  /**
   * "Trocar carteira" (§6.2) — é ação, logo `<button>`. Ela representa a
   * **desconexão** que o §3 pede simular: solta a carteira escolhida e devolve o
   * grupo de cards ao estado sem seleção, com o foco no primeiro rádio para
   * quem navega por teclado. Não existe endpoint de "conectar/desconectar
   * carteira" no contrato; inventar um estado de conexão paralelo ao
   * `GET /wallets` seria caminho de negócio fora do mock (regra eliminatória 1).
   * A seleção É a conexão.
   */
  function handleSwitchWallet() {
    onSelectWallet(null)
    walletGroupRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
  }

  return (
    <div className="px-[28px] pb-[32px] pt-[32px] lg:hidden">
      {/* Screen Header — `70398:240` */}
      <div className="flex h-[44px] items-center gap-[24px]">
        <button
          type="button"
          aria-label="Voltar"
          onClick={handleBack}
          className="flex size-[35px] shrink-0 items-center justify-center rounded-[17.5px] border border-border-strong bg-surface-raised outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
        >
          <ArrowLeft aria-hidden className="size-5 text-foreground" />
        </button>
        <h1 className="text-title-20 font-bold leading-[16px] text-foreground">
          Pagamento com carteira
        </h1>
      </div>

      {/* "Carteira conectada" — `70304:365` (y 60, h 16) */}
      <div className="mt-[16px] flex h-[16px] items-center justify-between">
        <span className="text-body-16 font-bold text-foreground">
          {selected ? 'Carteira conectada' : 'Nenhuma carteira conectada'}
        </span>
        <button
          type="button"
          onClick={handleSwitchWallet}
          disabled={!selected || locked}
          className="rounded-xs text-body-14 font-bold text-text-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
        >
          Trocar carteira
        </button>
      </div>

      {/* Wallet Cards — `70398:241` (y 92, gap 20) */}
      <fieldset
        ref={walletGroupRef}
        aria-required="true"
        disabled={locked}
        className="mt-[32px] flex flex-col gap-[20px]"
      >
        <legend className="sr-only">Carteira do pagamento</legend>
        {isWalletsPending ? (
          <p className="text-body-14 text-text-secondary">Carregando carteiras…</p>
        ) : wallets.length === 0 ? (
          <p className="text-body-14 text-text-secondary">
            Nenhuma carteira cadastrada. Cadastre uma carteira para finalizar a compra.
          </p>
        ) : (
          wallets.map((wallet) => {
            const isSelected = walletId === wallet.id
            return (
              <label
                key={wallet.id}
                className={cn(
                  'relative flex h-[93px] cursor-pointer items-center rounded-[14px] bg-surface-card pl-[19px] pr-[19px]',
                  // §6.3 transcreve a sombra no card NÃO selecionado (contra a
                  // intuição, e está assim no Figma). O que distingue o estado
                  // é o indicador preenchido, nunca a elevação nem só a cor.
                  !isSelected && 'drop-shadow-[0_20px_20px_rgba(10,6,4,0.45)]',
                  locked && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  name="checkout-wallet-mobile"
                  value={wallet.id}
                  checked={isSelected}
                  onChange={() => onSelectWallet(wallet.id)}
                  className="peer sr-only"
                />
                <RadioDot className="peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/75" />
                <div className="ml-[19px] flex min-w-0 flex-col gap-[6px]">
                  <span className="truncate text-body-16 font-bold text-foreground">
                    {shortHex(wallet.address)}
                  </span>
                  <span className="text-body-14 leading-[22px] text-text-secondary">
                    Rede {NETWORK_LABELS[wallet.network]}
                    <br />
                    {wallet.label}
                  </span>
                </div>
              </label>
            )
          })
        )}
      </fieldset>

      {/* Wallet Options — `70398:244` (y 314, gap 16). Ver o comentário de
          `NetworkFieldset` no desktop: as três linhas são as três REDES, não as
          três marcas de carteira que o Figma rotula — provedor de carteira não
          existe em contrato até a fase 8. */}
      <fieldset disabled={locked} className="mt-[32px] flex flex-col gap-[16px]">
        <legend className="text-body-16 font-bold text-foreground">Carteira e rede</legend>
        {NETWORKS.map((value) => (
          <label
            key={value}
            className={cn(
              'flex h-[65px] cursor-pointer items-center gap-[11px] rounded-[15px] bg-surface-card px-[14px] drop-shadow-[0_0_20px_rgba(10,6,4,0.45)]',
              locked && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name="checkout-network-mobile"
              value={value}
              checked={network === value}
              onChange={() => onSelectNetwork(value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-surface-dark text-body-14 font-bold text-text-accent"
            >
              {NETWORK_LABELS[value].charAt(0)}
            </span>
            <span className="flex-1 text-body-14 text-foreground">{NETWORK_LABELS[value]}</span>
            <RadioDot className="peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/75" />
          </label>
        ))}
      </fieldset>

      {/* Total Row — `70398:248` (y 589). Só o Total é desenhado no frame; o
          desdobramento completo (subtotal, desconto, taxa) está na coluna
          desktop e no carrinho, de onde o usuário vem. */}
      <div className="mt-[32px] flex h-[16px] items-center justify-end gap-[28px]">
        <span className="text-body-16 font-bold text-foreground">Total:</span>
        <span className="text-body-18 font-bold text-text-accent">{ethLabel(summary?.totalEth)}</span>
      </div>
      {summary?.coupon && (
        <p role="status" className="mt-[8px] text-right text-caption-12 text-text-accent">
          Cupom {summary.coupon.code} aplicado (−{summary.coupon.percentOff}%)
        </p>
      )}

      {/* Confirm Button — `70398:249` (y 772, 358×60). Os 107px de folga do
          frame viram `mt-[107px]`: é o último elemento da coluna, não barra
          fixa. */}
      <div className="mt-[107px]">
        <ConfirmBlock
          {...props}
          variant="mobile"
          className="h-[60px] w-full rounded-[40px] text-body-15 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
          buttonStyle={CONFIRM_GRADIENT}
        />
      </div>
    </div>
  )
}
