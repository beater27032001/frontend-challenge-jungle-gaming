import { Trash2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { QuantityStepper } from '@/components/quantity-stepper'
import { tokenIdOf } from '@/features/nft/labels'
import { mulQty } from '@/lib/money'
import { cn, linkFocusRing } from '@/lib/utils'
import { couponErrorOf, ethLabel, NO_VALUE, type CartViewProps } from '../cart-state'

/**
 * Composição desktop (specs/06-carrinho.md §1–§3, node `11:1278`), `hidden
 * lg:block`. Duas colunas: tabela de itens à esquerda, Resumo da carteira de
 * 332 à direita.
 *
 * `<table>` de verdade, não grid de divs: o Figma desenha um cabeçalho de cinco
 * colunas e cada linha é um registro com quatro campos — com `<th scope="col">`
 * o leitor de tela anuncia "Total, 0,09 ETH" em vez de um número solto. O
 * `border-spacing-y-[12px]` dá o `gap-[12px]` do spec sem margens em `<tr>`
 * (que não funcionam).
 */
export function CartDesktop(props: CartViewProps) {
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

  const couponError = couponErrorOf(quoteError)
  const panelError = quoteError && !couponError ? quoteError.message : null

  return (
    <div className="mx-auto hidden max-w-content px-6 py-8 lg:block">
      <h1 className="text-body-16 font-bold leading-[16px] text-foreground">Carrinho de NFTs</h1>

      <div className="mt-8 flex items-start justify-between gap-12">
        <div className="min-w-0 flex-1">
          {items.length === 0 ? (
            <EmptyCart />
          ) : (
            <table className="w-full border-separate border-spacing-y-[12px] text-left">
              <caption className="sr-only">Itens no carrinho</caption>
              <thead>
                <tr className="text-body-16">
                  <th scope="col" className="w-[250px] border-b border-border-strong pb-[12px] font-bold">
                    NFTs
                  </th>
                  <th scope="col" className="w-[77px] border-b border-border-strong pb-[12px] font-medium">
                    Preço
                  </th>
                  <th scope="col" className="w-[75px] border-b border-border-strong pb-[12px] font-bold">
                    Edições
                  </th>
                  <th scope="col" className="w-[87px] border-b border-border-strong pb-[12px] font-medium">
                    Total
                  </th>
                  <th scope="col" className="w-[48px] border-b border-border-strong pb-[12px]">
                    <span className="sr-only">Remover</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const overAvailable = item.quantity > item.available
                  const label = `${item.title}, edição ${item.editionLabel}`
                  return (
                    <tr key={item.id} className="h-[70px]">
                      <td className="bg-surface-card">
                        <div className="flex items-center gap-[16px]">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="size-[70px] shrink-0 rounded-[6px] object-cover"
                          />
                          <div className="flex min-w-0 flex-col gap-[6px]">
                            <span className="truncate text-body-16 font-bold leading-[16px] text-foreground">
                              {item.title}
                            </span>
                            <span className="text-body-14 text-secondary">{tokenIdOf(item.nftId)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="bg-surface-card text-body-16 font-bold text-text-secondary">
                        {item.unitPriceEth} ETH
                      </td>
                      <td className="bg-surface-card">
                        <QuantityStepper
                          quantity={item.quantity}
                          canDecrease={!isMutating && item.quantity > 1}
                          canIncrease={!isMutating && item.quantity < item.available}
                          onDelta={(delta) => onQuantityDelta(item, delta)}
                          itemLabel={label}
                          numberClassName="text-body-17 leading-[24px]"
                        />
                        {/* Disponibilidade pode cair por evento (fase 9) com o
                            carrinho aberto: a linha passa a exceder o estoque
                            e o usuário precisa ver por quê. */}
                        {overAvailable && (
                          <p role="status" className="mt-1 text-caption-12 text-text-accent">
                            Só {item.available} disponíveis
                          </p>
                        )}
                      </td>
                      <td className="w-[87px] bg-surface-card text-body-16 font-bold text-text-accent">
                        {mulQty(item.unitPriceEth, item.quantity)} ETH
                      </td>
                      <td className="bg-surface-card pr-[24px] text-right">
                        <button
                          type="button"
                          aria-label={`Remover ${label} do carrinho`}
                          disabled={isMutating}
                          onClick={() => onRemoveItem(item)}
                          className="rounded-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
                        >
                          <Trash2 aria-hidden className="size-6 text-foreground" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <aside aria-labelledby="wallet-summary" className="flex w-[332px] shrink-0 flex-col gap-[24px]">
          <h2
            id="wallet-summary"
            className="border-b border-border-strong pb-[12px] text-body-18 font-bold leading-[16px] text-foreground"
          >
            Resumo da carteira
          </h2>

          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (appliedCoupon) onRemoveCoupon()
              else onApplyCoupon()
            }}
          >
            <label htmlFor="coupon-desktop" className="text-body-14 font-bold text-foreground">
              Código promocional
            </label>
            <div className="flex h-[40px] items-stretch rounded-[3px] border border-primary">
              <input
                id="coupon-desktop"
                name="coupon"
                value={appliedCoupon ?? couponDraft}
                readOnly={!!appliedCoupon}
                onChange={(event) => onCouponDraftChange(event.target.value)}
                placeholder="Digite o código promocional..."
                aria-invalid={!!couponError}
                aria-describedby={couponError ? 'coupon-desktop-error' : undefined}
                className="min-w-0 flex-1 rounded-l-[3px] bg-transparent pl-[8px] text-caption-12 text-foreground outline-none placeholder:text-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <button
                type="submit"
                disabled={isQuotePending || (!appliedCoupon && couponDraft.trim() === '')}
                className="w-[102px] shrink-0 rounded-r-[3px] bg-primary text-body-15 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50"
              >
                {appliedCoupon ? 'Remover' : 'Aplicar'}
              </button>
            </div>
            {couponError && (
              <p id="coupon-desktop-error" role="alert" className="text-caption-12 text-destructive">
                {couponError}
              </p>
            )}
            {/* "Aplicado" só depois de a cotação confirmar o cupom: enquanto
                ela está no ar o veredito ainda não existe, e anunciar sucesso
                antes da resposta faria a mensagem piscar em cupom recusado. */}
            {quote?.coupon && (
              <p role="status" className="text-caption-12 text-text-accent">
                Cupom {quote.coupon.code} aplicado (−{quote.coupon.percentOff}%)
              </p>
            )}
          </form>

          {/* `aria-busy` enquanto a cotação está no ar: os valores mostram "—"
              (ausência explícita, nunca um zero calculado aqui) e o leitor de
              tela sabe que a região está atualizando. */}
          <dl aria-busy={isQuotePending} className="flex flex-col gap-[12px] text-foreground">
            <div className="flex items-baseline justify-between">
              <dt className="text-body-15">Subtotal</dt>
              <dd className="text-body-18">{ethLabel(quote?.subtotalEth ?? subtotalEth)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-body-15">Desconto do lançamento</dt>
              <dd className="text-body-15">
                {quote ? `(-) ${quote.discountEth} ETH` : NO_VALUE}
              </dd>
            </div>
            <div className="flex items-start justify-between">
              <dt className="text-body-15">Taxa de rede</dt>
              <dd className="flex flex-col items-end">
                <span className="text-body-18">{ethLabel(quote?.networkFeeEth)}</span>
                <span className="text-caption-12 text-text-accent">Taxa estimada</span>
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

          <div className="flex flex-col items-center gap-[12px]">
            {/* A fase 7 (Pagamento) liga isto: a copy é a do Figma, mas nada
                aqui conecta carteira — fingir sucesso é proibido pelo
                CHALLENGE §2. */}
            <button
              type="button"
              disabled
              className="h-[40px] w-full rounded-[3px] bg-primary text-body-15 font-bold text-ink disabled:opacity-50"
            >
              Conectar e finalizar
            </button>
            <Link to="/" className={cn(linkFocusRing, 'text-body-15 text-text-accent')}>
              Continuar explorando
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[6px] bg-surface-card p-8">
      <p className="text-body-16 font-bold text-foreground">Seu carrinho está vazio</p>
      <p className="text-body-15 text-text-secondary">
        Adicione um NFT do catálogo para ver o resumo da carteira.
      </p>
      <Link to="/" className={cn(linkFocusRing, 'text-body-15 font-bold text-text-accent')}>
        Continuar explorando
      </Link>
    </div>
  )
}
