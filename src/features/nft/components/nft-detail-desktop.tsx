import { AtSign, Heart, Link2, Mail, Minus, Plus, Search, Star } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { NftDetailViewProps } from '@/features/nft/detail-state'
import { cn, linkFocusRing } from '@/lib/utils'
import { CATEGORY_LABELS, tokenIdOf } from '../labels'
import { RelatedCarousel } from './related-carousel'

/**
 * Composição desktop (specs/04-detalhe-nft.md §2/§3, node `10:244`),
 * `hidden lg:*` — nunca a mobile reescalada (§4 do mesmo spec).
 */
export function NftDetailDesktop(props: NftDetailViewProps) {
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
  const [zoomOpen, setZoomOpen] = useState(false)

  const selectedEdition = nft.editions.find((e) => e.id === selectedEditionId) ?? null
  const allSoldOut = nft.editions.every((e) => e.available === 0)
  const price = selectedEdition?.priceEth ?? nft.priceEth
  const filledStars = Math.floor(Number(nft.ratingAvg))
  const tokenId = tokenIdOf(nft.id)
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="hidden lg:block">
      <div className="mx-auto max-w-content px-6">
        {/* Breadcrumb "Início / Mercado" (resolução OQ5, achado da resolução das
            Open Questions): 145×16, ritmo vertical de 32px entre o header e o
            Main, distribuído 8 acima / 8 abaixo do próprio breadcrumb —
            ponytail: distribuição interna não transcrita (só a caixa 145×16
            foi extraída), registrado em ARCHITECTURE.md fase 4. */}
        <nav aria-label="Trilha de navegação" className="flex h-[16px] items-center gap-2 py-2">
          <Link to="/" className={cn(linkFocusRing, 'text-body-14 text-text-secondary')}>
            Início
          </Link>
          <span aria-hidden className="text-body-14 text-text-secondary">
            /
          </span>
          <span aria-current="page" className="text-body-14 text-foreground">
            Mercado
          </span>
        </nav>

        <div className="mt-[28px] flex h-[448px] gap-[32px]">
          {/* Coluna de imagens */}
          <div className="relative flex w-[573px] gap-[28px]">
            <div className="flex flex-col gap-[16px]">
              {nft.images.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => onSelectImage(i)}
                  aria-current={i === imageIndex ? 'true' : undefined}
                  aria-label={`Imagem ${i + 1}`}
                  className={cn(
                    linkFocusRing,
                    'relative size-[100px] shrink-0 overflow-hidden rounded-[8px] bg-surface-card',
                    i === imageIndex && 'border border-primary',
                  )}
                >
                  <img src={img} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>

            <div className="relative size-[444px] shrink-0 rounded-[6px] bg-surface-card p-[16px]">
              <img
                src={nft.images[imageIndex]}
                alt={nft.title}
                className="size-[404px] rounded-[24px] object-cover"
              />
            </div>

            {/* Lupa (resolução OQ2): comportamento honesto — abre um Dialog com
                a imagem corrente ampliada. Nunca clicável-e-decorativo. */}
            <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Ampliar imagem"
                  className="absolute left-[530px] top-[15px] flex size-[30px] items-center justify-center rounded-[50%] border border-border-strong bg-surface-raised"
                >
                  <Search aria-hidden className="size-4 text-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl border-border-strong bg-card">
                <DialogTitle className="sr-only">{nft.title}</DialogTitle>
                <img
                  src={nft.images[imageIndex]}
                  alt={nft.title}
                  className="w-full rounded-[24px] object-cover"
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Coluna de detalhes */}
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-col gap-3">
              <h1 className="text-heading-28 font-bold text-foreground">{nft.title}</h1>
              <p className="text-title-22 leading-[16px] font-bold text-text-accent">{price} ETH</p>

              <div className="flex items-center gap-2">
                <div
                  aria-label={`Avaliação: ${nft.ratingAvg} de 5, ${nft.ratingCount} avaliações`}
                  className="flex items-center gap-1"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      aria-hidden
                      fill={i < filledStars ? 'currentColor' : 'none'}
                      className={cn('size-[15px]', i < filledStars ? 'text-text-accent' : 'text-border-strong')}
                    />
                  ))}
                </div>
                <span className="text-body-15 text-foreground">
                  {nft.ratingCount} avaliações de colecionadores
                </span>
              </div>

              <span aria-hidden className="h-px w-[573px] bg-border-strong" />

              <div className="flex flex-col gap-2">
                <p className="text-body-15 font-bold leading-[16px] text-foreground">Sobre este NFT:</p>
                <p className="w-[574px] text-body-14 leading-[24px] text-text-secondary">{nft.description}</p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-body-15 font-bold leading-[16px] text-foreground">Edição:</p>
                <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-[6px]">
                  {nft.editions.map((edition) => {
                    const soldOut = edition.available === 0
                    const checked = edition.id === selectedEditionId
                    return (
                      <span key={edition.id}>
                        <input
                          type="radio"
                          id={`edition-desktop-${edition.id}`}
                          name="edition-desktop"
                          value={edition.id}
                          checked={checked}
                          disabled={soldOut}
                          onChange={() => onSelectEdition(edition.id)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={`edition-desktop-${edition.id}`}
                          className={cn(
                            // Elipse inscrita na caixa (resolução OQ3): border-radius
                            // 50%, não `rounded-full` (que produziria um stadium).
                            'inline-flex h-[28px] items-center justify-center rounded-[50%] border px-4 text-body-14 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/75',
                            // ponytail: px-4 (padding horizontal) não transcrito —
                            // largura por conteúdo até inscrever o texto na elipse.
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

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-[12px]">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    disabled={!selectedEdition || quantity <= 1}
                    onClick={() => onQuantityDelta(-1)}
                    className="flex h-[49.5px] w-[33px] items-center justify-center rounded-[33px] border border-[#140d0a] bg-primary drop-shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)] disabled:opacity-50"
                  >
                    <Minus className="size-[26.4px] text-primary-foreground" />
                  </button>
                  <span aria-live="polite" className="text-title-20 leading-[28px] text-foreground">
                    <span className="sr-only">Quantidade: </span>
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    disabled={!selectedEdition || quantity >= selectedEdition.available}
                    onClick={() => onQuantityDelta(1)}
                    className="flex h-[49.5px] w-[33px] items-center justify-center rounded-[33px] border border-[#140d0a] bg-primary drop-shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)] disabled:opacity-50"
                  >
                    <Plus className="size-[26.4px] text-primary-foreground" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!selectedEdition || isBuying}
                  onClick={onBuy}
                  className="flex h-10 w-[130px] items-center justify-center rounded-[6px] bg-primary text-body-14 leading-[20px] font-bold text-ink disabled:opacity-50"
                >
                  COMPRAR
                </button>

                <button
                  type="button"
                  disabled
                  aria-label="Favoritar"
                  className="flex h-10 w-[130px] items-center justify-center gap-[8px] rounded-[6px] border border-primary text-body-14 font-medium text-text-accent disabled:opacity-50"
                >
                  <Heart aria-hidden className="size-5" />
                  Favoritar
                </button>

                {allSoldOut && (
                  <p role="status" className="text-body-15 text-text-secondary">
                    Esgotado
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-[12px] text-body-15 text-secondary">
                <p>ID do token: {tokenId}</p>
                <p>Coleção: {CATEGORY_LABELS[nft.category]}</p>
                <p>Atributos: {nft.attributes.join(', ')}</p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-body-15 font-bold leading-[16px] text-foreground">Compartilhar este NFT:</p>
                <div className="flex items-center gap-[8px]">
                  <a
                    href={`https://www.linkedin.com/shareArticle?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Compartilhar no LinkedIn"
                    className={cn(linkFocusRing, 'text-foreground')}
                  >
                    {/* ponytail: glifos genéricos do lucide v1 (sem ícones de
                        marca), mesmo precedente dos ícones sociais do footer
                        (ARCHITECTURE.md fase 2 §3). */}
                    <Link2 aria-hidden className="h-[14.4px] w-[15px]" />
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(nft.title)}&body=${encodeURIComponent(shareUrl)}`}
                    aria-label="Compartilhar por mensagem"
                    className={cn(linkFocusRing, 'text-foreground')}
                  >
                    <Mail aria-hidden className="size-[18px]" />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Compartilhar no Twitter"
                    className={cn(linkFocusRing, 'text-foreground')}
                  >
                    <AtSign aria-hidden className="h-[12.2px] w-[16px]" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <RelatedCarousel nft={nft} />
      </div>
    </div>
  )
}
