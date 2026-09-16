import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CartDesktop } from '@/features/cart/components/cart-desktop'
import { CartMobile } from '@/features/cart/components/cart-mobile'
import { useRemoveCartItem, useUpdateCartItem } from '@/features/cart/mutations'
import { cartOptions, quoteOptions, useCartScope } from '@/features/cart/queries'
import type { CartViewProps } from '@/features/cart/cart-state'
import { apiErrorOf } from '@/lib/api'
import type { CartItem } from '@/types'

/**
 * Carrinho (specs/06-carrinho.md). Funciona para visitante: `ownerKey` no mock
 * devolve `'guest'` sem sessão e nunca lança, então esta rota não exige login
 * nem redireciona — o carrinho do visitante é mesclado no do usuário pelo
 * próprio mock ao autenticar (fase 5).
 *
 * O cupom aplicado mora na URL (`?coupon=GREEN10`) via `validateSearch`, não em
 * `useState`: assim sobrevive a refresh e ao histórico, como manda o CLAUDE.md.
 * O rascunho digitado no campo, não — rascunho não é estado de aplicação.
 *
 * O estado é elevado aqui porque `CartDesktop` e `CartMobile` montam juntos
 * (`hidden lg:*` / `lg:hidden`), mesmo padrão de `nft.$nftId.tsx`.
 */
const cartSearchSchema = z.object({
  coupon: z.string().min(1).max(32).optional().catch(undefined),
})

export const Route = createFileRoute('/carrinho')({
  validateSearch: (search) => cartSearchSchema.parse(search),
  component: CartPage,
})

function CartPage() {
  const { coupon } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { scope, ready } = useCartScope()

  const cart = useQuery({ ...cartOptions(scope), enabled: ready })
  const items = cart.data?.items ?? []
  // `POST /quote` responde 400 "Carrinho vazio." sem itens — não vale pedir
  // cotação nesse estado.
  const quote = useQuery({
    ...quoteOptions(scope, coupon, 'ethereum'),
    enabled: ready && items.length > 0,
  })

  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const [couponDraft, setCouponDraft] = useState('')

  function onApplyCoupon() {
    const code = couponDraft.trim().toUpperCase()
    if (!code) return
    navigate({ search: (prev) => ({ ...prev, coupon: code }), resetScroll: false })
  }

  function onRemoveCoupon() {
    setCouponDraft('')
    navigate({ search: (prev) => ({ ...prev, coupon: undefined }), resetScroll: false })
  }

  function onQuantityDelta(item: CartItem, delta: 1 | -1) {
    const next = item.quantity + delta
    // Piso 1 (o contrato do PATCH exige >= 1: remover é a rota DELETE) e teto
    // na disponibilidade — o servidor ainda valida com 409, isto só evita a
    // ida garantidamente recusada.
    if (next < 1 || next > item.available) return
    update.mutate({ itemId: item.id, quantity: next })
  }

  if (cart.isPending || !ready) return <CartSkeleton />

  if (cart.isError) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-4 px-6 py-24 text-center">
        <p className="text-body-16 text-text-secondary">
          {apiErrorOf(cart.error)?.message ?? 'Não foi possível carregar o carrinho.'}
        </p>
        <Button type="button" onClick={() => cart.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const viewProps: CartViewProps = {
    items,
    subtotalEth: cart.data?.subtotalEth ?? '0',
    // Carrinho vazio zera a cotação em vez de exibir a última em cache: a
    // query fica `enabled: false` e o Query preserva o dado da key, que já não
    // corresponde ao carrinho.
    quote: items.length > 0 ? quote.data ?? null : null,
    quoteError: items.length > 0 ? apiErrorOf(quote.error) : null,
    isCartPending: cart.isFetching,
    isQuotePending: quote.isFetching,
    appliedCoupon: coupon ?? null,
    couponDraft,
    onCouponDraftChange: setCouponDraft,
    onApplyCoupon,
    onRemoveCoupon,
    onQuantityDelta,
    onRemoveItem: (item) => remove.mutate({ itemId: item.id }),
    isMutating: update.isPending || remove.isPending,
  }

  return (
    <>
      <CartDesktop {...viewProps} />
      <CartMobile {...viewProps} />
    </>
  )
}

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <div className="hidden justify-between gap-12 lg:flex">
        <div className="flex flex-1 flex-col gap-[12px]">
          <Skeleton className="h-6 w-1/3" />
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[70px] w-full" />
          ))}
        </div>
        <div className="flex w-[332px] shrink-0 flex-col gap-[24px]">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-[40px] w-full rounded-[3px]" />
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[40px] w-full rounded-[3px]" />
        </div>
      </div>
      <div className="flex flex-col gap-[20px] lg:hidden">
        <Skeleton className="h-[44px] w-2/3" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-[14px]" />
        ))}
      </div>
    </div>
  )
}
