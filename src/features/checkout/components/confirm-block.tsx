import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { cn, linkFocusRing } from '@/lib/utils'
import { canConfirm, type CheckoutViewProps } from '../checkout-state'

/**
 * O CTA de confirmar e todo o feedback do envio, num só lugar para as duas
 * composições (spec §2 desktop, §6.6 mobile). Só a aparência do botão muda
 * entre elas — a máquina de estados, não.
 *
 * Quatro garantias vivem aqui, e cada uma corresponde a um requisito do §3:
 *
 * - **Nada de confirmação sem resposta da simulação** (regra eliminatória 3):
 *   nenhuma fase daqui abre o recibo; o recibo só existe na fase `confirmed`,
 *   que por tipo só existe com um `Order` da API.
 * - **Nenhum pedido duplicado**: `disabled` enquanto `submitting` cobre o
 *   clique repetido; o estado `timeout` oferece **reenviar**, não "confirmar de
 *   novo", e o reenvio usa a mesma chave de idempotência.
 * - **Mudança exige nova confirmação**: em `revalidate` o botão de confirmar
 *   fica barrado e o único caminho é recotar — o que devolve o botão ao estado
 *   `idle` e exige um segundo clique deliberado.
 * - **Feedback acessível**: cada fase anuncia por `role="status"` (progresso) ou
 *   `role="alert"` (bloqueio/falha), nunca só por cor.
 */
export function ConfirmBlock({
  className,
  buttonStyle,
  variant,
  ...props
}: CheckoutViewProps & {
  className: string
  buttonStyle?: CSSProperties
  variant: 'desktop' | 'mobile'
}) {
  const { phase, walletId, summary, onConfirm, onResend, onRefreshQuote, onOpenReceipt } = props
  const secondary = cn(
    linkFocusRing,
    'text-body-14 font-bold text-text-accent underline underline-offset-2',
  )
  const noteId = `confirm-note-${variant}`

  if (phase.kind === 'confirmed') {
    return (
      <div className="flex flex-col items-center gap-[12px]">
        <p role="status" className="text-center text-body-14 text-text-accent">
          Pedido {phase.order.id} confirmado.
        </p>
        <button
          type="button"
          data-receipt-trigger
          onClick={onOpenReceipt}
          className={className}
          style={buttonStyle}
        >
          Ver recibo
        </button>
        <Link to="/" className={secondary}>
          Continuar explorando
        </Link>
      </div>
    )
  }

  if (phase.kind === 'declined') {
    return (
      <div className="flex flex-col items-center gap-[12px]">
        {/* Recusado é terminal (§4): não há botão de tentar de novo para o
            MESMO pedido. O caminho é voltar ao carrinho e cotar outra vez. */}
        <p role="alert" className="text-center text-body-14 text-destructive">
          Pedido {phase.order.id} recusado.{' '}
          {phase.order.declineReason ?? 'O pagamento não foi aprovado.'}
        </p>
        <Link to="/carrinho" className={secondary}>
          Voltar ao carrinho
        </Link>
      </div>
    )
  }

  if (phase.kind === 'pending') {
    return (
      <div className="flex flex-col items-center gap-[12px]">
        <p role="status" aria-busy="true" className="text-center text-body-14 text-text-secondary">
          Pedido {phase.order.id} enviado. Aguardando a confirmação do pagamento…
        </p>
        {/* Nenhum botão: o resultado chega por `order.updated` (fase 9) ou, se a
            página for recarregada, pelo `GET /orders/:id`. */}
      </div>
    )
  }

  if (phase.kind === 'timeout') {
    return (
      <div className="flex flex-col items-center gap-[12px]">
        <p role="alert" className="text-center text-body-14 text-destructive">
          Não recebemos resposta do envio. O pedido pode ter sido criado — reenvie a mesma tentativa
          para recuperá-lo; isso não cria um segundo pedido.
        </p>
        <button type="button" onClick={onResend} className={className} style={buttonStyle}>
          Reenviar pedido
        </button>
      </div>
    )
  }

  const blocked = phase.kind === 'revalidate'
  const enabled = canConfirm(phase, walletId, summary)

  return (
    <div className="flex flex-col items-center gap-[12px]">
      {blocked && (
        <p id={noteId} role="alert" className="text-center text-body-14 text-destructive">
          {phase.message}
        </p>
      )}
      {phase.kind === 'error' && (
        <p id={noteId} role="alert" className="text-center text-body-14 text-destructive">
          {phase.message}
        </p>
      )}
      {!blocked && phase.kind === 'idle' && !walletId && (
        <p id={noteId} className="text-center text-body-14 text-text-secondary">
          Escolha a carteira que vai pagar.
        </p>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={!enabled}
        aria-busy={phase.kind === 'submitting'}
        aria-describedby={blocked || phase.kind === 'error' || !walletId ? noteId : undefined}
        className={className}
        style={buttonStyle}
      >
        {phase.kind === 'submitting' ? 'Enviando pedido…' : 'Confirmar compra'}
      </button>

      {blocked && (
        <button type="button" onClick={onRefreshQuote} className={secondary}>
          Atualizar cotação
        </button>
      )}
      {phase.kind === 'submitting' && (
        <p role="status" className="sr-only">
          Enviando o pedido.
        </p>
      )}
    </div>
  )
}
