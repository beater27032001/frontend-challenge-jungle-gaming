import { ArrowLeft, Heart, Minus, Plus, ShoppingCart, Star } from 'lucide-react'
import { useCanGoBack, useRouter } from '@tanstack/react-router'
import type { NftDetailViewProps } from '@/features/nft/detail-state'
import { mulQty } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS } from '../labels'

/**
 * Composição mobile (specs/04-detalhe-nft.md §4, node `15:5536`), `lg:hidden`
 * — três camadas sobrepostas (Hero, Details Sheet, Buy Bar), não o desktop
 * reescalado.
 */
export function NftDetailMobile(props: NftDetailViewProps) {
  const {
    nft,
    selectedEditionId,
    quantity,
    imageIndex,
    onSelectEdition,
    onQuantityDelta,
    onSelectImage,
    onBuy,
    isBuying,
  } = props
  const router = useRouter()
  const canGoBack = useCanGoBack()

  const selectedEdition = nft.editions.find((e) => e.id === selectedEditionId) ?? null
  const allSoldOut = nft.editions.every((e) => e.available === 0)
  const totalPrice = selectedEdition ? mulQty(selectedEdition.priceEth, quantity) : nft.priceEth
  const tokenId = `#${nft.id.replace('nft-', '').padStart(4, '0')}`

  function handleBack() {
    if (canGoBack) router.history.back()
    else router.navigate({ to: '/' })
  }

  return (
    <div className="lg:hidden">
      {/* Hero */}
      <section
        className="relative h-[506px] w-full overflow-hidden"
        style={{
          background: 'linear-gradient(137.64deg, #241612 11.999%, #2f1d15 106.59%)',
        }}
      >
        <div className="absolute left-[28px] top-[23px] flex w-[361px] flex-col gap-[8px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Voltar"
              onClick={handleBack}
              className="flex size-[35px] items-center justify-center rounded-[17.5px] border border-border-strong bg-surface-raised"
            >
              <ArrowLeft aria-hidden className="size-5 text-foreground" />
            </button>
            <button
              type="button"
              disabled
              aria-label="Favoritar"
              className="flex size-[35px] items-center justify-center rounded-[17.5px] border border-border-strong bg-surface-raised disabled:opacity-50"
            >
              <Heart aria-hidden className="h-[14.2px] w-4 text-foreground" />
            </button>
          </div>

          <img
            src={nft.images[imageIndex]}
            alt={nft.title}
            className="h-[356px] w-full rounded-[24px] object-cover"
          />
        </div>

        {/* Pontos do carrossel (resolução OQ4): funcionais, um por imagem —
            ativo é pill 28×7, inativos são círculos de 7px, todos em
            `primary`. Não copiar esta composição para os heroes do
            catálogo (aviso da resolução OQ4). */}
        <div className="absolute left-1/2 top-[365px] flex -translate-x-1/2 items-center gap-[7px]">
          {nft.images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Imagem ${i + 1} de ${nft.images.length}`}
              aria-current={i === imageIndex ? 'true' : undefined}
              onClick={() => onSelectImage(i)}
              className="flex items-center justify-center p-[8px]"
            >
              <span
                aria-hidden
                className={cn(
                  'block bg-primary',
                  i === imageIndex ? 'h-[7px] w-[28px] rounded-[3.5px]' : 'size-[7px] rounded-full',
                )}
              />
            </button>
          ))}
        </div>
      </section>

      {/* Details Sheet */}
      <section className="relative -mt-[114px] flex flex-col gap-[12px] rounded-t-[31px] bg-surface-card px-[24px] pb-[24px] pt-[32px]">
        <h1 className="text-title-20 leading-[16px] font-bold text-foreground">{nft.title}</h1>

        <div
          aria-label={`Avaliação: ${nft.ratingAvg} de 5, ${nft.ratingCount} avaliações`}
          className="flex h-[27px] w-fit items-center gap-1 rounded-[32px] border border-primary px-3"
        >
          <Star aria-hidden fill="currentColor" className="size-[14px] text-text-accent" />
          <span className="text-body-14 font-medium text-foreground">{nft.ratingAvg}</span>
          <span className="text-body-14 text-text-secondary">({nft.ratingCount})</span>
        </div>

        <p className="line-clamp-3 w-[361px] max-w-full text-body-14 leading-[24px] text-text-secondary">
          {nft.description}
        </p>

        <div className="flex flex-col gap-2">
          <p className="text-body-15 font-bold leading-[16px] text-foreground">Edição:</p>
          <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-[12px]">
            {nft.editions.map((edition) => {
              const soldOut = edition.available === 0
              const checked = edition.id === selectedEditionId
              return (
                <span key={edition.id}>
                  <input
                    type="radio"
                    id={`edition-mobile-${edition.id}`}
                    name="edition-mobile"
                    value={edition.id}
                    checked={checked}
                    disabled={soldOut}
                    onChange={() => onSelectEdition(edition.id)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={`edition-mobile-${edition.id}`}
                    className={cn(
                      'inline-flex h-[28px] items-center justify-center rounded-[50%] border px-4 text-body-14 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/75',
                      soldOut
                        ? 'cursor-not-allowed border-border-strong text-text-secondary opacity-50'
                        : checked
                          ? 'cursor-pointer border-primary font-medium text-text-accent'
                          : 'cursor-pointer border-border-strong text-text-secondary',
                    )}
                  >
                    {edition.label}
                    {soldOut && <span className="sr-only"> (esgotada)</span>}
                  </label>
                </span>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-[12px] text-body-15 text-secondary">
          <p>ID do token: {tokenId}</p>
          <p>Coleção: {CATEGORY_LABELS[nft.category]}</p>
          <p>Atributos: {nft.attributes.join(', ')}</p>
        </div>

        {allSoldOut && (
          <p role="status" className="text-body-15 text-text-secondary">
            Esgotado
          </p>
        )}
      </section>

      {/* Buy Bar — fixa no fundo; o <main> compensa com pb-[164px]
          (__root.tsx) para o conteúdo acima não morrer embaixo dela. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-[20px] rounded-t-[40px] bg-surface-card px-[24px] pb-[36px] pt-[20px] drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <span className="text-body-15 font-medium text-text-secondary">Qtd.</span>
            <div className="flex items-center gap-[12px]">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                disabled={!selectedEdition || quantity <= 1}
                onClick={() => onQuantityDelta(-1)}
                className="flex h-[30px] w-[20px] items-center justify-center rounded-[20px] border border-[#140d0a] bg-primary drop-shadow-[0_4px_6px_rgba(20,13,10,0.15)] disabled:opacity-50"
              >
                <Minus aria-hidden className="size-4 text-primary-foreground" />
              </button>
              <span aria-live="polite" className="text-body-18 font-medium leading-[25px] text-foreground">
                <span className="sr-only">Quantidade: </span>
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                disabled={!selectedEdition || quantity >= selectedEdition.available}
                onClick={() => onQuantityDelta(1)}
                className="flex h-[30px] w-[20px] items-center justify-center rounded-[20px] border border-[#140d0a] bg-primary drop-shadow-[0_4px_6px_rgba(20,13,10,0.15)] disabled:opacity-50"
              >
                <Plus aria-hidden className="size-4 text-primary-foreground" />
              </button>
            </div>
          </div>

          <span className="text-title-20 leading-[16px] font-bold text-text-accent">{totalPrice} ETH</span>
        </div>

        <div className="flex items-center gap-[12px]">
          <button
            type="button"
            disabled={!selectedEdition || isBuying}
            onClick={onBuy}
            // O pl-48/pr-44 do Figma vinha do auto-layout dele e, com a nossa métrica
            // de Roboto Mono, deixa 104px para um texto de ~106px — "Comprar NFT"
            // quebrava em duas linhas. O padding era redundante com justify-center;
            // a geometria medida (196x60) fica, o padding sai.
            className="flex h-[60px] w-[196px] items-center justify-center rounded-[40px] text-body-16 font-bold leading-[20px] whitespace-nowrap text-ink disabled:opacity-50"
            style={{
              background: 'linear-gradient(100.37deg, #d28a4c 3.96%, rgba(210,138,76,0.8) 121.97%)',
            }}
          >
            Comprar NFT
          </button>
          <button
            type="button"
            disabled
            aria-label="Carrinho"
            className="flex size-[60px] items-center justify-center rounded-[40px] border border-border-strong bg-surface-raised p-[20px] disabled:opacity-50"
          >
            <ShoppingCart aria-hidden className="size-5 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}
