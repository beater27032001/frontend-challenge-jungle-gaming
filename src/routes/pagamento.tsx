import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/use-session'
import { cartOptions, quoteOptions } from '@/features/cart/queries'
import { CheckoutDesktop } from '@/features/checkout/components/checkout-desktop'
import { CheckoutMobile } from '@/features/checkout/components/checkout-mobile'
import { OrderReceipt } from '@/features/checkout/components/order-receipt'
import { confirmPhaseOf, type CheckoutViewProps } from '@/features/checkout/checkout-state'
import { createErrorOf, useCreateOrder } from '@/features/checkout/mutations'
import { orderOptions, walletsOptions } from '@/features/checkout/queries'
import { isQuoteStale } from '@/features/checkout/quote-freshness'
import { apiErrorOf } from '@/lib/api'
import { NETWORKS, type Network } from '@/types'

/**
 * Pagamento e confirmação (specs/07-checkout.md). Uma rota, duas composições
 * (`hidden lg:*` / `lg:hidden`) e **um** modal de confirmação por cima — o modal
 * fica aqui, não dentro de cada composição, porque as duas montam ao mesmo
 * tempo e dois diálogos no DOM seriam dois diálogos de verdade.
 *
 * ### O que mora na URL, e por quê
 *
 * `?coupon` · `?network` · `?order`. Os três têm de sobreviver a refresh, e o
 * terceiro é o que torna a **recuperação após refresh** (§3) um efeito colateral
 * do roteador em vez de código: recarregar `/pagamento?order=ord_3` remonta a
 * query do pedido, o `GET /orders/:id` resolve o pagamento na leitura (o mock
 * faz isso de propósito, ARCHITECTURE.md decisão 27) e a tela reencontra o
 * estado terminal — mesmo tendo o `setTimeout` da criação morrido com a página
 * anterior.
 *
 * A carteira escolhida é `useState`: é seleção de formulário, não parâmetro de
 * consulta, e o §3 pede que ela seja "conectável" e "desconectável" dentro da
 * sessão da tela. `payer` nunca entra na URL nem em campo — vem da sessão.
 *
 * ### Proteção do fluxo privado
 *
 * O CHALLENGE §3 exige autenticação no checkout. A guarda é um `<Navigate>` com
 * `redirect=/pagamento`, o mesmo contrato que `/login` já lê desde a fase 5 —
 * e não um `beforeLoad`, porque a sessão é uma query do TanStack Query
 * (`useSession`) e não um dado de contexto do roteador; duplicá-la no
 * `beforeLoad` criaria uma segunda fonte de verdade de sessão.
 */
const checkoutSearchSchema = z.object({
  coupon: z.string().min(1).max(32).optional().catch(undefined),
  network: z.enum(NETWORKS).optional().catch(undefined),
  order: z.string().min(1).max(64).optional().catch(undefined),
})

export const Route = createFileRoute('/pagamento')({
  validateSearch: (search) => checkoutSearchSchema.parse(search),
  component: CheckoutPage,
})

function CheckoutPage() {
  const { coupon, network: networkParam, order: orderId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const session = useSession()
  const scope = session.data?.user.id ?? 'guest'
  const signedIn = !!session.data
  // Default `ethereum` = o mesmo que o carrinho cota (spec 06), e é o que faz o
  // Total do carrinho mobile e o do checkout baterem (§6.5).
  const network: Network = networkParam ?? 'ethereum'

  const cart = useQuery({ ...cartOptions(scope), enabled: signedIn })
  const wallets = useQuery({ ...walletsOptions(scope), enabled: signedIn })
  const items = cart.data?.items ?? []
  // Mesma regra do carrinho: `POST /quote` responde 400 "Carrinho vazio." sem
  // itens. Depois de um pedido criado o carrinho fica vazio e a cotação sai do
  // cache — daí `summary` cair para o pedido, que é o snapshot dela.
  const quote = useQuery({
    ...quoteOptions(scope, coupon, network),
    enabled: signedIn && items.length > 0,
  })
  const order = useQuery({ ...orderOptions(scope, orderId ?? ''), enabled: signedIn && !!orderId })

  const create = useCreateOrder(scope)
  const [couponDraft, setCouponDraft] = useState('')
  /**
   * O estado guardado é o **descarte**, não a abertura. O recibo está aberto por
   * derivação — "existe pedido confirmado e o usuário não fechou o recibo DESSE
   * pedido" — e não por um efeito que chama `setState` quando a confirmação
   * chega. Assim a abertura funciona igual nos três caminhos (resposta do POST,
   * `order.updated` com a tela aberta, `GET /orders/:id` depois de um refresh)
   * sem render em cascata, e fechar continua sendo decisão do usuário.
   */
  const [dismissedOrder, setDismissedOrder] = useState<string | null>(null)
  // `ready` separa "ainda não sei qual é a carteira primária" de "o usuário
  // desconectou a carteira": sem isso, "Trocar carteira" seria desfeito pelo
  // próximo render.
  const [wallet, setWallet] = useState<{ ready: boolean; id: string | null }>({
    ready: false,
    id: null,
  })

  // Derivado durante o render, não em efeito (mesmo padrão de `nft.$nftId.tsx`):
  // escolher a primária é derivar de dado carregado, não sincronizar com sistema
  // externo, e um efeito custaria um render em cascata.
  if (!wallet.ready && wallets.data) {
    const primary = wallets.data.find((w) => w.role === 'primary') ?? wallets.data[0]
    setWallet({ ready: true, id: primary?.id ?? null })
  }

  const staleQuote = quote.data ? isQuoteStale(quote.data, cart.data) : false
  const phase = confirmPhaseOf({
    order: order.data,
    isSubmitting: create.isPending,
    createError: createErrorOf(create.error),
    staleQuote,
  })

  const confirmedId = phase.kind === 'confirmed' ? phase.order.id : null
  const receiptOpen = !!confirmedId && dismissedOrder !== confirmedId

  if (session.isPending) return <CheckoutSkeleton />
  if (!signedIn) return <Navigate to="/login" search={{ redirect: '/pagamento' }} replace />
  // Com `?order` na URL o pedido é a fonte e a tela não espera carrinho nem
  // carteiras: é o caminho da recuperação após refresh, em que o carrinho já foi
  // debitado e pode estar vazio.
  if ((cart.isPending || wallets.isPending) && !orderId) return <CheckoutSkeleton />

  const user = session.data!.user

  function onConfirm() {
    if (!quote.data || !wallet.id) return
    create.mutate(
      {
        quoteId: quote.data.id,
        walletId: wallet.id,
        network,
        payer: { name: user.name, email: user.email },
      },
      {
        // O id do pedido vai para a URL: é isso que faz o refresh recuperar.
        // `replace` para que "voltar" leve ao carrinho e não a um checkout
        // pré-envio que já não existe.
        onSuccess: (created) =>
          navigate({ search: (prev) => ({ ...prev, order: created.id }), replace: true }),
      },
    )
  }

  const viewProps: CheckoutViewProps = {
    payer: { name: user.name, email: user.email },
    // Antes do envio a fonte é a cotação; depois, o pedido — que é o snapshot
    // imutável dela e nunca relê o catálogo.
    summary: order.data ?? (items.length > 0 ? quote.data ?? null : null),
    quoteError: items.length > 0 ? apiErrorOf(quote.error) : null,
    isQuotePending: quote.isFetching,
    wallets: wallets.data ?? [],
    isWalletsPending: wallets.isPending,
    walletId: wallet.id,
    onSelectWallet: (id) => setWallet({ ready: true, id }),
    network,
    onSelectNetwork: (next) =>
      navigate({ search: (prev) => ({ ...prev, network: next }), resetScroll: false }),
    appliedCoupon: coupon ?? null,
    couponDraft,
    onCouponDraftChange: setCouponDraft,
    onApplyCoupon: () => {
      const code = couponDraft.trim().toUpperCase()
      if (!code) return
      navigate({ search: (prev) => ({ ...prev, coupon: code }), resetScroll: false })
    },
    onRemoveCoupon: () => {
      setCouponDraft('')
      navigate({ search: (prev) => ({ ...prev, coupon: undefined }), resetScroll: false })
    },
    phase,
    onConfirm,
    // Reenvio: a MESMA chamada, logo a mesma chave de idempotência — recupera o
    // pedido criado antes do timeout em vez de criar outro.
    onResend: onConfirm,
    // Recotar destrava a confirmação: novo `POST /quote` com as versões atuais
    // do catálogo, `reset()` na mutation para o 409 anterior sair da tela, e o
    // usuário confirma DE NOVO — a "nova confirmação explícita" do §3.
    onRefreshQuote: () => {
      create.reset()
      void quote.refetch()
    },
    onOpenReceipt: () => setDismissedOrder(null),
  }

  return (
    <>
      <CheckoutDesktop {...viewProps} />
      <CheckoutMobile {...viewProps} />
      {phase.kind === 'confirmed' && (
        <OrderReceipt
          order={phase.order}
          open={receiptOpen}
          onOpenChange={(open) => setDismissedOrder(open ? null : confirmedId)}
        />
      )}
    </>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <div className="hidden items-start gap-[32px] lg:flex">
        <div className="flex flex-1 flex-col gap-[24px]">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-[40px] w-full rounded-[3px]" />
          <Skeleton className="h-[40px] w-full rounded-[3px]" />
        </div>
        <div className="flex w-[405px] shrink-0 flex-col gap-[24px]">
          <Skeleton className="h-6 w-2/3" />
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[70px] w-full" />
          ))}
          <Skeleton className="h-[45px] w-full rounded-[8px]" />
        </div>
      </div>
      <div className="flex flex-col gap-[20px] lg:hidden">
        <Skeleton className="h-[44px] w-2/3" />
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-[93px] w-full rounded-[14px]" />
        ))}
        <Skeleton className="h-[60px] w-full rounded-[40px]" />
      </div>
    </div>
  )
}
