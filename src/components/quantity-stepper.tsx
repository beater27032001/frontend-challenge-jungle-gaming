import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stepper de pílula do Figma: botões 20×30 em `primary`, borda 1px `#140d0a`,
 * raio 20, sombra `0 4px 6px rgba(20,13,10,.15)`, `gap-[12px]`. Nasceu na Buy
 * Bar mobile (fase 4) e a linha do carrinho desktop pede o mesmo componente
 * (specs/06-carrinho.md §2) — extraído aqui em vez de copiado.
 *
 * Só o número muda de escala entre os dois call-sites (18px medium na Buy Bar,
 * 17px regular na linha do carrinho), daí `numberClassName`.
 */
export function QuantityStepper({
  quantity,
  canDecrease,
  canIncrease,
  onDelta,
  itemLabel,
  numberClassName,
  className,
}: {
  quantity: number
  canDecrease: boolean
  canIncrease: boolean
  onDelta: (delta: 1 | -1) => void
  /** Sufixo dos aria-labels: com N steppers na tela, "Aumentar quantidade"
   * repetido N vezes não diz de qual item se trata. */
  itemLabel?: string
  numberClassName?: string
  className?: string
}) {
  const suffix = itemLabel ? ` de ${itemLabel}` : ''
  const button =
    'flex h-[30px] w-[20px] items-center justify-center rounded-[20px] border border-ink bg-primary drop-shadow-[0_4px_6px_rgba(20,13,10,0.15)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:opacity-50'

  return (
    <div className={cn('flex items-center gap-[12px]', className)}>
      <button
        type="button"
        aria-label={`Diminuir quantidade${suffix}`}
        disabled={!canDecrease}
        onClick={() => onDelta(-1)}
        className={button}
      >
        <Minus aria-hidden className="size-4 text-primary-foreground" />
      </button>
      <span aria-live="polite" className={cn('text-foreground', numberClassName)}>
        <span className="sr-only">Quantidade{suffix}: </span>
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Aumentar quantidade${suffix}`}
        disabled={!canIncrease}
        onClick={() => onDelta(1)}
        className={button}
      >
        <Plus aria-hidden className="size-4 text-primary-foreground" />
      </button>
    </div>
  )
}
