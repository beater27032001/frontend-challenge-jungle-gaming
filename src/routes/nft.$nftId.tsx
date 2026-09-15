import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart/use-add-to-cart'
import { useSession } from '@/features/auth/use-session'
import { NftDetailDesktop } from '@/features/nft/components/nft-detail-desktop'
import { NftDetailMobile } from '@/features/nft/components/nft-detail-mobile'
import { nftDetailOptions } from '@/features/nft/queries'
import { linkFocusRing, cn } from '@/lib/utils'

/**
 * Detalhes do NFT (specs/04-detalhe-nft.md): substitui o stub da fase 2. O
 * estado de compra é elevado aqui — desktop e mobile montam ao mesmo tempo
 * (`hidden lg:*` / `lg:hidden`), então não pode viver dentro de cada
 * composição.
 */
export const Route = createFileRoute('/nft/$nftId')({ component: NftDetailRoute })

interface PurchaseState {
  nftId: string
  editionId: string | null
  quantity: number
  imageIndex: number
}

function NftDetailRoute() {
  const { nftId } = Route.useParams()
  const session = useSession()
  const scope = session.data?.user.id ?? 'guest'
  const query = useQuery({ ...nftDetailOptions(scope, nftId), enabled: !session.isPending })
  const addToCart = useAddToCart()

  const [state, setState] = useState<PurchaseState | null>(null)
  const nft = query.data

  // Inicializa (ou reinicializa, ao navegar para outro NFT) a edição
  // selecionada durante o render, não em um efeito (mesmo padrão de
  // `mobile-search-bar.tsx`: sincronizar um valor derivado de props/query
  // não é "sincronizar com um sistema externo", é só derivar estado — um
  // efeito aqui custaria um render em cascata à toa). A primeira edição com
  // `available > 0`; nenhuma disponível → null (chips/stepper/COMPRAR
  // ficam desabilitados).
  if (nft && state?.nftId !== nft.id) {
    const firstAvailable = nft.editions.find((e) => e.available > 0)
    setState({ nftId: nft.id, editionId: firstAvailable?.id ?? null, quantity: 1, imageIndex: 0 })
  }

  const current = nft && state?.nftId === nft.id ? state : null

  function onSelectEdition(editionId: string) {
    setState((s) => (s ? { ...s, editionId, quantity: 1 } : s))
  }

  function onQuantityDelta(delta: 1 | -1) {
    setState((s) => {
      if (!s || !nft) return s
      const edition = nft.editions.find((e) => e.id === s.editionId)
      const max = edition?.available ?? 1
      return { ...s, quantity: Math.min(Math.max(s.quantity + delta, 1), max) }
    })
  }

  function onSelectImage(index: number) {
    setState((s) => (s ? { ...s, imageIndex: index } : s))
  }

  function onBuy() {
    if (!nft || !current?.editionId) return
    addToCart.mutate({ nftId: nft.id, editionId: current.editionId, quantity: current.quantity })
  }

  if (query.isPending) {
    return <DetailSkeleton />
  }

  if (query.isError) {
    if (isAxiosError(query.error) && query.error.response?.status === 404) {
      return <NotFoundState />
    }
    return <ErrorState onRetry={() => query.refetch()} />
  }

  if (!nft || !current) {
    // query resolved successfully but the init effect hasn't committed the
    // first render yet (state === null) — one extra frame of skeleton.
    return <DetailSkeleton />
  }

  const viewProps = {
    nft,
    selectedEditionId: current.editionId,
    quantity: current.quantity,
    imageIndex: current.imageIndex,
    onSelectEdition,
    onQuantityDelta,
    onSelectImage,
    onBuy,
    isBuying: addToCart.isPending,
  }

  return (
    <>
      <NftDetailDesktop {...viewProps} />
      <NftDetailMobile {...viewProps} />
    </>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <div className="hidden gap-8 lg:flex">
        <div className="flex gap-4">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-[100px] rounded-[8px]" />
            ))}
          </div>
          <Skeleton className="size-[444px] rounded-[6px]" />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:hidden">
        <Skeleton className="h-[356px] w-full rounded-[24px]" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

function NotFoundState() {
  return (
    <div className="mx-auto flex max-w-content flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-heading-24 font-bold text-foreground">NFT não encontrado</h1>
      <p className="text-body-16 text-text-secondary">O item que você procura não existe ou foi removido.</p>
      <Link to="/" className={cn(linkFocusRing, 'text-body-16 font-bold text-primary underline')}>
        Voltar ao início
      </Link>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-content flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="text-body-16 text-text-secondary">Não foi possível carregar este NFT.</p>
      <Button type="button" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}
