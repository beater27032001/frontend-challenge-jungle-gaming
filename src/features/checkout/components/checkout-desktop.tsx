import { Link } from '@tanstack/react-router'
import { NETWORK_LABELS, tokenIdOf } from '@/features/nft/labels'
import { NETWORKS } from '@/types'
import { cn, linkFocusRing } from '@/lib/utils'
import {
  couponErrorOf,
  ethLabel,
  NO_VALUE,
  shortHex,
  type CheckoutViewProps,
} from '../checkout-state'
import { ConfirmBlock } from './confirm-block'

/**
 * Composição desktop (specs/07-checkout.md §2, node `70504:3190`), `hidden
 * lg:block`. Duas colunas de `gap-[32px]`: formulário (flex-1) e "Seus NFTs"
 * (405), que também abriga "Carteira e rede" e o botão de confirmar.
 *
 * **O formulário de nove campos do Figma não existe aqui, por decisão do
 * usuário registrada no spec §3 e §6.7** ("Tensão entre o design e o contrato
 * — RESOLVIDA"): sete daqueles campos são de perfil e de carteira desenhados
 * na tela errada (eles ganham dono na fase 8) e "Observação" não existe em
 * contrato nenhum. Campo que o usuário preenche e a API ignora é mentira de UI.
 * O que o checkout coleta é **carteira e rede** — exatamente o que o desenho
 * mobile (`16:748`) coleta, e ele é o canônico. `payer` vem da sessão.
 *
 * O tratamento visual dos campos (40 de altura, `rounded-[3px]`, borda
 * `border-strong`, rótulo 15px com asterisco 22px em `text-coral`) é o do spec
 * §2 e foi preservado — é ele que mantém a tela reconhecível como o frame.
 */
export function CheckoutDesktop(props: CheckoutViewProps) {
  const {
    payer,
    summary,
    quoteError,
    isQuotePending,
    wallets,
    isWalletsPending,
    walletId,
    onSelectWallet,
    network,
    onSelectNetwork,
    appliedCoupon,
    couponDraft,
    onCouponDraftChange,
    onApplyCoupon,
    onRemoveCoupon,
    phase,
  } = props

  const couponError = couponErrorOf(quoteError)
  const panelError = quoteError && !couponError ? quoteError.message : null
  // Depois do envio o pedido é a fonte: mexer na carteira, na rede ou no cupom
  // não muda mais nada, e um controle que aceita clique sem efeito é o mesmo
  // problema dos campos decorativos.
  const locked = phase.kind !== 'idle' && phase.kind !== 'revalidate' && phase.kind !== 'error'

  return (
    <div className="mx-auto hidden max-w-content px-6 py-8 lg:block">
      {/* Breadcrumb "Início / Mercado / Pagamento", 15px bold (spec §2) — o
          frame desktop não desenha título; o <h1> existe para leitor de tela,
          mesmo padrão das fases 4 e 6. */}
      <nav aria-label="Trilha de navegação" className="flex h-[16px] items-center gap-2 py-2">
        <Link to="/" className={cn(linkFocusRing, 'text-body-15 font-bold text-text-secondary')}>
          Início
        </Link>
        <span aria-hidden className="text-body-15 font-bold text-text-secondary">
          /
        </span>
        <Link to="/" className={cn(linkFocusRing, 'text-body-15 font-bold text-text-secondary')}>
          Mercado
        </Link>
        <span aria-hidden className="text-body-15 font-bold text-text-secondary">
          /
        </span>
        <span aria-current="page" className="text-body-15 font-bold text-foreground">
          Pagamento
        </span>
      </nav>
      <h1 className="sr-only">Pagamento</h1>

      <div className="mt-8 flex items-start gap-[32px]">
        <section aria-labelledby="collector-profile" className="flex min-w-0 flex-1 flex-col gap-[24px]">
          <h2 id="collector-profile" className="text-body-17 font-bold text-foreground">
            Perfil do colecionador
          </h2>

          {/* `payer` vem da sessão (fase 5), não de campo de formulário — logo
              é dado exibido para revisão, não coletado. Revisão antes do envio
              é requisito do §3. */}
          <dl className="grid grid-cols-2 gap-x-[24px] gap-y-[12px]">
            <div className="flex flex-col gap-[12px]">
              <dt className="text-body-15 leading-[15px] text-foreground">Nome de exibição</dt>
              <dd className="flex h-[40px] items-center rounded-[3px] border border-border-strong pl-[12px] text-body-14 text-foreground">
                {payer.name}
              </dd>
            </div>
            <div className="flex flex-col gap-[12px]">
              <dt className="text-body-15 leading-[15px] text-foreground">E-mail</dt>
              <dd className="flex h-[40px] items-center rounded-[3px] border border-border-strong pl-[12px] text-body-14 text-foreground">
                {payer.email}
              </dd>
            </div>
          </dl>

          <WalletFieldset
            wallets={wallets}
            isPending={isWalletsPending}
            walletId={walletId}
            onSelectWallet={onSelectWallet}
            disabled={locked}
          />
        </section>

        <aside aria-labelledby="your-nfts" className="flex w-[405px] shrink-0 flex-col gap-[24px]">
          <div className="flex items-baseline justify-between border-b border-border-strong pb-[12px]">
            <h2 id="your-nfts" className="text-body-16 font-bold text-foreground">
              NFTs
            </h2>
            <span className="text-body-16 text-foreground">Subtotal</span>
          </div>

          {summary && summary.items.length > 0 ? (
            <ul className="flex flex-col gap-[12px]">
              {summary.items.map((item) => (
                <li
                  key={`${item.nftId}-${item.editionId}`}
                  className="flex h-[70px] items-center gap-[16px] bg-surface-card"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="size-[70px] shrink-0 rounded-[8px] object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <span className="truncate text-body-16 font-bold text-foreground">{item.title}</span>
                    <span className="text-body-14 text-secondary">{tokenIdOf(item.nftId)}</span>
                  </div>
                  <span className="shrink-0 text-body-14 text-text-secondary">(x {item.quantity})</span>
                  <span className="shrink-0 pr-[8px] text-body-18 font-bold text-text-accent">
                    {item.lineTotalEth} ETH
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyCheckout />
          )}

          <CouponField
            appliedCoupon={appliedCoupon}
            couponDraft={couponDraft}
            couponError={couponError}
            coupon={summary?.coupon}
            isQuotePending={isQuotePending}
            disabled={locked}
            onCouponDraftChange={onCouponDraftChange}
            onApplyCoupon={onApplyCoupon}
            onRemoveCoupon={onRemoveCoupon}
          />

          <dl aria-busy={isQuotePending} className="flex flex-col gap-[12px] text-foreground">
            <div className="flex items-baseline justify-between">
              <dt className="text-body-15">Subtotal</dt>
              <dd className="text-body-18">{ethLabel(summary?.subtotalEth)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-body-15">Desconto do lançamento</dt>
              <dd className="text-body-15">
                {summary ? `(-) ${summary.discountEth} ETH` : NO_VALUE}
              </dd>
            </div>
            <div className="flex items-start justify-between">
              <dt className="text-body-15">Taxa de rede</dt>
              <dd className="flex flex-col items-end">
                <span className="text-body-18">{ethLabel(summary?.networkFeeEth)}</span>
                <span className="text-caption-12 text-text-accent">Taxa estimada</span>
              </dd>
            </div>
          </dl>

          <div className="flex items-baseline justify-between border-t border-border-strong pt-[12px]">
            <span className="text-body-16 font-bold text-foreground">Total</span>
            <span className="text-body-18 font-bold text-text-accent">{ethLabel(summary?.totalEth)}</span>
          </div>

          {panelError && (
            <p role="alert" className="text-caption-12 text-destructive">
              {panelError}
            </p>
          )}

          <NetworkFieldset network={network} onSelectNetwork={onSelectNetwork} disabled={locked} />

          <ConfirmBlock
            {...props}
            variant="desktop"
            className="h-[45px] w-full rounded-[8px] bg-primary text-body-15 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
          />
        </aside>
      </div>
    </div>
  )
}

/** Asterisco de obrigatório: 22px em `text-coral` (spec §2). `aria-hidden`
 * porque o grupo já é obrigatório por `aria-required`; o leitor de tela não
 * precisa ouvir "asterisco". */
function RequiredMark() {
  return (
    <span aria-hidden className="text-title-22 leading-none text-text-coral">
      *
    </span>
  )
}

/**
 * Carteiras cadastradas (`GET /wallets`). `<input type="radio">` nativo dentro
 * de `<fieldset>`: papel, agrupamento, `checked`, setas do teclado e roving
 * tabindex saem de graça do navegador — um `role="radiogroup"` à mão seria mais
 * código para reimplementar pior.
 *
 * O indicador não é só cor (CHALLENGE §8): o círculo selecionado recebe
 * preenchimento visível (um ponto sólido), além da borda em `primary`.
 */
function WalletFieldset({
  wallets,
  isPending,
  walletId,
  onSelectWallet,
  disabled,
}: {
  wallets: CheckoutViewProps['wallets']
  isPending: boolean
  walletId: string | null
  onSelectWallet: (id: string | null) => void
  disabled: boolean
}) {
  return (
    <fieldset aria-required="true" className="flex flex-col gap-[12px]" disabled={disabled}>
      <legend className="flex items-center gap-1 text-body-15 leading-[15px] text-foreground">
        Carteira
        <RequiredMark />
      </legend>

      {isPending ? (
        <p className="text-body-14 text-text-secondary">Carregando carteiras…</p>
      ) : wallets.length === 0 ? (
        <p className="text-body-14 text-text-secondary">
          Nenhuma carteira cadastrada. Cadastre uma carteira para finalizar a compra.
        </p>
      ) : (
        wallets.map((wallet) => (
          <label
            key={wallet.id}
            className={cn(
              'flex h-[40px] cursor-pointer items-center gap-[12px] rounded-[3px] border pl-[12px] pr-[12px]',
              walletId === wallet.id ? 'border-primary' : 'border-border-strong',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name="checkout-wallet"
              value={wallet.id}
              checked={walletId === wallet.id}
              onChange={() => onSelectWallet(wallet.id)}
              className="peer sr-only"
            />
            <RadioDot className="peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/75" />
            <span className="truncate text-body-14 text-foreground">
              {wallet.label} · {shortHex(wallet.address)}
            </span>
            <span className="ml-auto shrink-0 text-caption-12 text-text-secondary">
              {NETWORK_LABELS[wallet.network]}
            </span>
          </label>
        ))
      )}
    </fieldset>
  )
}

/**
 * "Carteira e rede" (spec §2): três opções de 45 de altura, rádio de 16px, a
 * selecionada com borda `primary`.
 *
 * **Desvio consciente, registrado no ARCHITECTURE.md:** o Figma rotula as três
 * linhas com marcas de carteira (chip `METAMASK • WALLETCONNECT • COINBASE`,
 * "MetaMask", "Coinbase Wallet"; no mobile, §6.4, as mesmas três). Provedor de
 * carteira não existe em contrato nenhum até a fase 8 (`Wallet.type`, dívida
 * 6), e renderizar um seletor que a API ignora é o campo decorativo que o
 * usuário proibiu. As três linhas passam a ser as três **redes** — que é o que
 * o título do bloco promete, o que a cotação consome (`POST /quote`
 * `{ network }`, taxa por rede) e o que o pedido grava. Mesma geometria, mesmo
 * número de opções, efeito real.
 */
function NetworkFieldset({
  network,
  onSelectNetwork,
  disabled,
}: {
  network: CheckoutViewProps['network']
  onSelectNetwork: CheckoutViewProps['onSelectNetwork']
  disabled: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-[20px]" disabled={disabled}>
      <legend className="w-full text-center text-body-17 font-bold text-foreground">
        Carteira e rede
      </legend>
      {NETWORKS.map((value) => (
        <label
          key={value}
          className={cn(
            'flex h-[45px] cursor-pointer items-center gap-[12px] rounded-[3px] border px-[12px]',
            network === value ? 'border-primary' : 'border-border-strong',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name="checkout-network"
            value={value}
            checked={network === value}
            onChange={() => onSelectNetwork(value)}
            className="peer sr-only"
          />
          <RadioDot className="peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/75" />
          <span className="text-body-15 text-foreground">{NETWORK_LABELS[value]}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** Círculo de 16px do Figma. O estado selecionado tem preenchimento (ponto
 * sólido de 8px), não só uma cor de borda diferente. */
export function RadioDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[16px] shrink-0 items-center justify-center rounded-full border border-border-soft',
        // O `peer` é o <input>, irmão DESTE span — o ponto interno não é irmão
        // de nada, por isso o preenchimento é pintado por variante aninhada
        // (`peer-checked:[&>span]`) e não por `peer-checked:` no próprio ponto,
        // que nunca casaria.
        'peer-checked:border-primary peer-checked:[&>span]:opacity-100',
        className,
      )}
    >
      <span className="size-[8px] rounded-full bg-primary opacity-0" />
    </span>
  )
}

/**
 * "Tem um código promocional? Aplique aqui" (spec §2, 14px centralizado). O
 * texto é o revelador do campo — o Figma não desenha o input, mas cupom é
 * requisito do §3 e o carrinho já o tem; a alternativa (texto inerte) cai em
 * "ação fora do escopo aparentando função".
 *
 * O cupom aplicado mora na URL (`?coupon=`), como no carrinho: sobrevive a
 * refresh, e é o que a cotação do checkout recebe.
 */
function CouponField({
  appliedCoupon,
  couponDraft,
  couponError,
  coupon,
  isQuotePending,
  disabled,
  onCouponDraftChange,
  onApplyCoupon,
  onRemoveCoupon,
}: {
  appliedCoupon: string | null
  couponDraft: string
  couponError: string | null
  coupon: { code: string; percentOff: number } | undefined
  isQuotePending: boolean
  disabled: boolean
  onCouponDraftChange: (v: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
}) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (appliedCoupon) onRemoveCoupon()
        else onApplyCoupon()
      }}
    >
      <label htmlFor="checkout-coupon" className="text-center text-body-14 text-text-secondary">
        Tem um código promocional? Aplique aqui
      </label>
      <div className="flex h-[40px] items-stretch rounded-[3px] border border-border-strong">
        <input
          id="checkout-coupon"
          name="coupon"
          value={appliedCoupon ?? couponDraft}
          readOnly={!!appliedCoupon}
          disabled={disabled}
          onChange={(event) => onCouponDraftChange(event.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={!!couponError}
          aria-describedby={couponError ? 'checkout-coupon-error' : undefined}
          className="min-w-0 flex-1 rounded-l-[3px] bg-transparent pl-[12px] text-caption-12 text-foreground outline-none placeholder:text-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || isQuotePending || (!appliedCoupon && couponDraft.trim() === '')}
          className="w-[102px] shrink-0 rounded-r-[3px] bg-primary text-body-15 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
        >
          {appliedCoupon ? 'Remover' : 'Aplicar'}
        </button>
      </div>
      {couponError && (
        <p id="checkout-coupon-error" role="alert" className="text-caption-12 text-destructive">
          {couponError}
        </p>
      )}
      {coupon && (
        <p role="status" className="text-caption-12 text-text-accent">
          Cupom {coupon.code} aplicado (−{coupon.percentOff}%)
        </p>
      )}
    </form>
  )
}

function EmptyCheckout() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[6px] bg-surface-card p-6">
      <p className="text-body-16 font-bold text-foreground">Nada para pagar</p>
      <p className="text-body-15 text-text-secondary">
        Seu carrinho está vazio — adicione um NFT antes de finalizar.
      </p>
      <Link to="/carrinho" className={cn(linkFocusRing, 'text-body-15 font-bold text-text-accent')}>
        Ver o carrinho
      </Link>
    </div>
  )
}
