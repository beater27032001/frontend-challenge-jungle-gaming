import { Wallet as WalletIcon, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { NETWORK_LABELS, tokenIdOf } from '@/features/nft/labels'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'
import { shortHex } from '../checkout-state'

/**
 * Confirmação de pedido — node `70376:239` (578×821), **modal sobre a própria
 * página de pagamento**, não uma rota (spec §1 e §3). Os dois frames do Figma
 * compartilham a mesma `Checkout Page`; o que muda é este diálogo por cima.
 *
 * Isso é o que casa com a regra eliminatória 3: o modal só monta com um `Order`
 * **confirmado** em mão — o chamador só o renderiza na fase `confirmed`, e essa
 * fase só existe com resposta do mock. Não há caminho em que a confirmação
 * apareça por otimismo.
 *
 * **Mobile não tem frame** (§6.8). Derivado do padrão do Payment Summary do
 * carrinho mobile: folha inferior com `rounded-t-[40px]`, `pt-24 px-24 pb-36`.
 * Uma composição só, com as duas aparências por breakpoint, em vez de dois
 * diálogos — dois montariam ao mesmo tempo (as duas composições do checkout
 * montam juntas) e haveria dois modais no DOM.
 *
 * Foco: `DialogPrimitive` do Radix já traz entrada, trava e `Esc`. O retorno ao
 * gatilho é explícito (`onCloseAutoFocus`) porque o gatilho é o botão "Ver
 * recibo" renderizado nas DUAS composições, e só uma está visível — o Radix
 * devolveria o foco ao elemento que o tinha na abertura, que na recuperação por
 * refresh (modal já aberto no primeiro paint) não existe.
 */
export function OrderReceipt({
  order,
  open,
  onOpenChange,
}: {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const date = new Date(order.resolvedAt ?? order.createdAt)

  function returnFocusToTrigger(event: Event) {
    const trigger = Array.from(
      document.querySelectorAll<HTMLElement>('[data-receipt-trigger]'),
    ).find((el) => el.offsetParent !== null)
    if (!trigger) return
    event.preventDefault()
    trigger.focus()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/80" />
        <DialogPrimitive.Content
          onCloseAutoFocus={returnFocusToTrigger}
          aria-describedby="receipt-footnote"
          className={cn(
            // Mobile (§6.8, derivado): folha inferior, largura cheia.
            'fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[40px] bg-surface-card pb-[36px] pl-[24px] pr-[24px] pt-[24px] outline-none',
            // Desktop (`70376:239`): 578 de largura, centralizado, sem raio no topo.
            'lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[578px] lg:max-w-[calc(100vw-2rem)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-none lg:p-0',
          )}
        >
          {/* Cabeçalho — 156 de altura, centralizado, gap 16 */}
          <div className="flex flex-col items-center gap-[16px] lg:h-[156px] lg:justify-center">
            {/* ponytail: o Figma põe uma ilustração de 80x80 aqui e a transcrição
                não a nomeia — glifo provisório do lucide (mesmo precedente dos
                ícones do footer na fase 2), calibrar com o node 70376:239. */}
            <WalletIcon aria-hidden className="size-[80px] text-primary" strokeWidth={1} />
            <DialogPrimitive.Title className="text-center text-body-16 font-bold text-text-secondary">
              Seus NFTs agora estão na sua carteira
            </DialogPrimitive.Title>
          </div>

          <hr className="border-t border-primary" />

          {/* Meta da transação — 65 de altura, px-36, quatro blocos separados por
              réguas verticais de 31px. `<dl>` porque são pares rótulo/valor. */}
          <dl className="flex flex-wrap items-center justify-between gap-y-3 py-[12px] lg:h-[65px] lg:flex-nowrap lg:px-[36px] lg:py-0">
            <Meta label="ID da transação" value={shortHex(order.txHash)} />
            <Rule />
            <Meta label="Data" value={date.toLocaleDateString('pt-BR')} />
            <Rule />
            <Meta label="Total" value={`${order.totalEth} ETH`} />
            <Rule />
            <Meta label="Carteira" value={shortHex(order.walletAddress)} />
          </dl>

          <hr className="border-t border-primary" />

          {/* Detalhes da transação — pt-20 pb-48 px-44 */}
          <div className="pb-[24px] pt-[20px] lg:px-[44px] lg:pb-[48px]">
            <div className="flex items-baseline justify-between gap-[48px] border-b border-border-strong pb-[12px] text-body-14 text-text-secondary">
              <span className="flex-1">NFTs</span>
              <span>Edições</span>
              <span>Subtotal</span>
            </div>
            <ul className="mt-[12px] flex flex-col gap-[12px]">
              {order.items.map((item) => (
                <li
                  key={`${item.nftId}-${item.editionId}`}
                  className="flex h-[70px] items-center gap-[16px]"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="size-[70px] shrink-0 rounded-[8px] object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <span className="truncate text-body-16 font-bold text-foreground">
                      {item.title}
                    </span>
                    <span className="text-body-14 text-secondary">{tokenIdOf(item.nftId)}</span>
                  </div>
                  <span className="shrink-0 text-body-14 text-text-secondary">
                    (x {item.quantity})
                  </span>
                  <span className="shrink-0 text-body-18 font-bold text-text-accent">
                    {item.lineTotalEth} ETH
                  </span>
                </li>
              ))}
            </ul>

            {/* Totais — 321 de largura, alinhados à direita */}
            <dl className="ml-auto mt-[24px] flex w-full flex-col gap-[12px] lg:w-[321px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-body-15 text-foreground">Taxa de rede</dt>
                <dd className="text-body-16 text-foreground">{order.networkFeeEth} ETH</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-body-16 font-bold text-foreground">Total</dt>
                <dd className="text-body-18 font-bold text-text-accent">{order.totalEth} ETH</dd>
              </div>
            </dl>

            {/* Nota de rodapé — 14px, lh 22, text-secondary, centralizada. A copy
                do Figma diz "Ethereum" fixo; aqui vem a rede DO pedido, senão o
                recibo de um pedido em Polygon mentiria. */}
            <p
              id="receipt-footnote"
              className="mt-[24px] text-center text-body-14 leading-[22px] text-text-secondary"
            >
              Transação confirmada na {NETWORK_LABELS[order.network]}. A propriedade foi transferida
              para sua carteira conectada e registrada na rede.
            </p>

            {/* "Ver no Etherscan" — o link é SIMULADO (spec §3, CHALLENGE §3:
                "referências de transação e links de exploração são simulados").
                O href aponta para `example.com` (domínio reservado pela IANA
                exatamente para isso), e a legenda diz que é simulado — copy do
                Figma preservada, sem fingir que abre um explorador real. */}
            <a
              href={order.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby="receipt-explorer-note"
              className="mt-[24px] flex items-center justify-center rounded-[5px] bg-primary p-[16px] text-body-16 font-bold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
            >
              Ver no Etherscan
            </a>
            <p
              id="receipt-explorer-note"
              className="mt-[8px] text-center text-caption-12 text-text-secondary"
            >
              Link de exploração simulado (ambiente de demonstração).
            </p>
          </div>

          {/* Barra de 10px em `primary` no rodapé */}
          <div aria-hidden className="h-[10px] bg-primary" />

          <DialogPrimitive.Close className="absolute right-[16px] top-[16px] rounded-xs p-[4px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75">
            <X aria-hidden className="size-5 text-foreground" />
            <span className="sr-only">Fechar o recibo</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[4px] text-text-secondary">
      <dt className="text-body-14">{label}</dt>
      <dd className="text-body-15">{value}</dd>
    </div>
  )
}

/** Régua vertical de 31px entre blocos da meta (§3). Decorativa, e um `<div>`
 * e não um `<span>`: `<dl>` só aceita `dt`/`dd`/`div` como filhos. */
function Rule() {
  return <div aria-hidden className="hidden h-[31px] w-px bg-border-strong lg:block" />
}
