import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { tokenIdOf } from '@/features/nft/labels'
import { mulQty } from '@/lib/money'
import { cn, linkFocusRing } from '@/lib/utils'
import { couponErrorOf, ethLabel, NO_VALUE, type CartViewProps } from '../cart-state'

/**
 * Composição mobile (specs/06-carrinho.md §6, node `16:360`), `lg:hidden` —
 * NÃO é o desktop reescalado: a tabela de cinco colunas desaparece e dá lugar
 * a cards de 100 de altura, e o resumo vira folha inferior fixa com raio 40 só
 * no topo (irmã da Buy Bar da fase 4).
 */
export function CartMobile(props: CartViewProps) {
  const {
    items,
    subtotalEth,
    quote,
    quoteError,
    isQuotePending,
    appliedCoupon,
    couponDraft,
    onCouponDraftChange,
    onApplyCoupon,
    onRemoveCoupon,
    onQuantityDelta,
    onRemoveItem,
    isMutating,
  } = props

  const router = useRouter()
  const canGoBack = useCanGoBack()
  const couponError = couponErrorOf(quoteError)
  const panelError = quoteError && !couponError ? quoteError.message : null

  function handleBack() {
    if (canGoBack) router.history.back()
    else router.navigate({ to: '/' })
  }

  return (
    <div className="lg:hidden">
      {/* Content — `70397:239` (y 32) */}
      <section className="px-[28px] pt-[32px]">
        <div className="flex h-[44px] items-center gap-[24px]">
          <button
            type="button"
            aria-label="Voltar"
            onClick={handleBack}
            className="flex size-[35px] shrink-0 items-center justify-center rounded-[17.5px] border border-border-strong bg-surface-raised outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
          >
            <ArrowLeft aria-hidden className="size-5 text-foreground" />
          </button>
          <h1 className="text-title-20 font-bold leading-[16px] text-foreground">Carrinho de NFTs</h1>
        </div>

        {items.length === 0 ? (
          <div className="mt-[24px] flex flex-col items-start gap-3 rounded-[14px] bg-surface-card p-6">
            <p className="text-body-15 font-bold text-foreground">Seu carrinho está vazio</p>
            <p className="text-body-14 text-text-secondary">
              Adicione um NFT do catálogo para ver o resumo do pagamento.
            </p>
            <Link to="/" className={cn(linkFocusRing, 'text-body-14 font-bold text-text-accent')}>
              Continuar explorando
            </Link>
          </div>
        ) : (
          <ul className="mt-[24px] flex flex-col gap-[20px]">
            {items.map((item) => {
              const label = `${item.title}, edição ${item.editionLabel}`
              return (
                <li
                  key={item.id}
                  className="flex h-[100px] items-stretch rounded-[14px] bg-surface-card drop-shadow-[0_6px_20px_rgba(10,6,4,0.45)]"
                >
                  {/* Uma <img> só: a duplicata `mix-blend-multiply` do Figma é
                      artefato de composição do designer (spec §6.3). */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="size-[100px] shrink-0 rounded-l-[14px] object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-[6px] pl-[9px]">
                    <span className="truncate text-body-15 font-bold leading-[16px] text-foreground">
                      {item.title}
                    </span>
                    <span className="truncate text-body-14 leading-[16px] text-text-secondary">
                      Edição: {item.editionLabel}
                    </span>
                    <span className="text-body-18 font-bold leading-[16px] text-text-accent">
                      {mulQty(item.unitPriceEth, item.quantity)} ETH
                    </span>
                    <span className="sr-only">Token {tokenIdOf(item.nftId)}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-[8px] pr-[12px]">
                    <CardStepper
                      quantity={item.quantity}
                      canDecrease={!isMutating && item.quantity > 1}
                      canIncrease={!isMutating && item.quantity < item.available}
                      onDelta={(delta) => onQuantityDelta(item, delta)}
                      itemLabel={label}
                    />
                    <button
                      type="button"
                      aria-label={`Remover ${label} do carrinho`}
                      disabled={isMutating}
                      onClick={() => onRemoveItem(item)}
                      // Alvo de 44px sem mexer no visual de 24px: o ícone fica
                      // 24, a área clicável cresce via padding + margem
                      // negativa (spec §6.4).
                      className="-m-[10px] rounded-xs p-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
                    >
                      <Trash2 aria-hidden className="size-6 text-foreground" />
                    </button>
                  </div>
                  {item.quantity > item.available && (
                    <p role="status" className="sr-only">
                      {label}: só {item.available} disponíveis
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Payment Summary — `70397:245`, folha inferior fixa (raio 40 só no topo) */}
      <section
        aria-labelledby="payment-summary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[342px] flex-col justify-between rounded-t-[40px] bg-surface-card px-[24px] pb-[36px] pt-[24px]"
      >
        <h2 id="payment-summary" className="sr-only">
          Resumo do pagamento
        </h2>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (appliedCoupon) onRemoveCoupon()
            else onApplyCoupon()
          }}
        >
          <label htmlFor="coupon-mobile" className="sr-only">
            Código promocional
          </label>
          <div className="flex h-[50px] items-stretch rounded-[40px] border border-border bg-surface-card pl-[16px] drop-shadow-[0_6px_10px_rgba(10,6,4,0.45)]">
            <input
              id="coupon-mobile"
              name="coupon"
              value={appliedCoupon ?? couponDraft}
              readOnly={!!appliedCoupon}
              onChange={(event) => onCouponDraftChange(event.target.value)}
              placeholder="Digite o código promocional…"
              aria-invalid={!!couponError}
              aria-describedby={couponError ? 'coupon-mobile-error' : undefined}
              className="min-w-0 flex-1 rounded-l-[40px] bg-transparent text-caption-13 leading-[22px] text-foreground outline-none placeholder:text-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <button
              type="submit"
              disabled={isQuotePending || (!appliedCoupon && couponDraft.trim() === '')}
              className="w-[97px] shrink-0 rounded-[40px] text-body-15 font-bold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
              style={{
                background:
                  'linear-gradient(96.02deg, color-mix(in srgb, var(--color-primary) 54%, transparent) 0.94%, var(--color-primary) 105%)',
              }}
            >
              {appliedCoupon ? 'Remover' : 'Aplicar'}
            </button>
          </div>
          {couponError && (
            <p id="coupon-mobile-error" role="alert" className="mt-2 text-caption-12 text-destructive">
              {couponError}
            </p>
          )}
          {/* Ver comentário gêmeo em cart-desktop.tsx. */}
          {quote?.coupon && (
            <p role="status" className="mt-2 text-caption-12 text-text-accent">
              Cupom {quote.coupon.code} aplicado (−{quote.coupon.percentOff}%)
            </p>
          )}
        </form>

        {/* Ver `aria-busy` em cart-desktop.tsx. */}
        <dl aria-busy={isQuotePending} className="flex flex-col gap-[12px] text-foreground">
          <div className="flex items-baseline justify-between">
            <dt className="text-body-15">Subtotal</dt>
            <dd className="text-body-16 leading-[16px]">{ethLabel(quote?.subtotalEth ?? subtotalEth)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-body-15">Desconto do lançamento</dt>
            <dd className="text-body-15">{quote ? `(-) ${quote.discountEth} ETH` : NO_VALUE}</dd>
          </div>
          <div className="flex items-start justify-between">
            <dt className="text-body-15">Taxa de rede</dt>
            <dd className="flex flex-col items-end">
              <span className="text-body-16 leading-[16px]">{ethLabel(quote?.networkFeeEth)}</span>
              <span className="text-caption-12 leading-[16px] text-text-accent">Taxa estimada</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-body-16 font-bold">Total</dt>
            <dd className="text-body-18 font-bold text-text-accent">{ethLabel(quote?.totalEth)}</dd>
          </div>
        </dl>

        {panelError && (
          <p role="alert" className="text-caption-12 text-destructive">
            {panelError}
          </p>
        )}

        {/* Fase 7: ver o comentário gêmeo em cart-desktop.tsx. */}
        <Link
          to="/pagamento"
          search={{ coupon: appliedCoupon ?? undefined }}
          disabled={items.length === 0}
          aria-disabled={items.length === 0}
          className={cn(
            linkFocusRing,
            'flex h-[60px] w-full items-center justify-center rounded-[40px] text-body-16 font-bold text-ink',
            items.length === 0 && 'pointer-events-none opacity-50',
          )}
          style={{
            background: 'linear-gradient(108.86deg, var(--color-primary) 3.96%, color-mix(in srgb, var(--color-primary) 80%, transparent) 121.97%)',
          }}
        >
          Conectar e finalizar
        </Link>
      </section>
    </div>
  )
}

/**
 * Stepper do card (spec §6.4): 24×24 circulares, visual diferente da pílula do
 * desktop — componente próprio, não variante do `QuantityStepper`.
 *
 * Os 24px do Figma ficam abaixo do alvo de toque de 44px. `p-[10px]` +
 * `-m-[10px]` levam a área clicável a 44 sem deslocar um pixel do desenho.
 */
function CardStepper({
  quantity,
  canDecrease,
  canIncrease,
  onDelta,
  itemLabel,
}: {
  quantity: number
  canDecrease: boolean
  canIncrease: boolean
  onDelta: (delta: 1 | -1) => void
  itemLabel: string
}) {
  // A moldura de 24px vive no <span>, não no <button>: o padding que amplia o
  // alvo fica fora dela, então borda, fundo e raio continuam medindo 24.
  const hit = '-m-[10px] rounded-full p-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50'
  const circle =
    'flex size-[24px] items-center justify-center rounded-full border border-border bg-surface-raised text-title-21 leading-none text-foreground'

  return (
    <div className="flex items-center gap-[6px]">
      <button
        type="button"
        aria-label={`Diminuir quantidade de ${itemLabel}`}
        disabled={!canDecrease}
        onClick={() => onDelta(-1)}
        className={hit}
      >
        <span aria-hidden className={circle}>
          −
        </span>
      </button>
      <span aria-live="polite" className="text-body-16 leading-[22px] text-foreground">
        <span className="sr-only">Quantidade de {itemLabel}: </span>
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Aumentar quantidade de ${itemLabel}`}
        disabled={!canIncrease}
        onClick={() => onDelta(1)}
        className={hit}
      >
        <span aria-hidden className={circle}>
          +
        </span>
      </button>
    </div>
  )
}
