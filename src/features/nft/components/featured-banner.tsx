import { Skeleton } from '@/components/ui/skeleton'
import type { NftSummary } from '@/types'

/**
 * Sidebar "NFT EM DESTAQUE" banner (specs/03-catalogo.md §6). Desktop-only —
 * the call site in `routes/index.tsx` wraps this in `hidden lg:block`.
 */
export function FeaturedBanner({ nft, isPending }: { nft: NftSummary | null; isPending: boolean }) {
  // Cenário `empty`/sem featured: a seção some por completo, não mostra um
  // estado vazio próprio (o grid já cobre "nenhum resultado").
  if (!isPending && nft === null) return null

  return (
    <section
      aria-labelledby="featured-banner-heading"
      className="w-[310px] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-primary)_10%,transparent),color-mix(in_srgb,var(--color-primary)_3%,transparent))] pt-6 pb-1"
    >
      <h2
        id="featured-banner-heading"
        className="px-5 text-heading-24 leading-[32px] font-bold text-text-accent"
      >
        NFT EM DESTAQUE
      </h2>
      <p className="text-center text-[22px] leading-[16px] font-bold text-foreground">OFERTA LIMITADA</p>

      <div className="relative mt-4">
        {/* ponytail: posições/gradiente exato das decorações não
            transcritos (specs/03-catalogo.md §6) — provisório, registrado em
            ARCHITECTURE.md. */}
        <span
          aria-hidden
          className="absolute top-3 right-3 z-10 size-[22px] rounded-[4px] border-2 border-[#46a358]/20"
        />
        <span aria-hidden className="absolute top-8 right-10 z-10 size-[45px] rounded-full bg-primary/30" />
        <span aria-hidden className="absolute top-6 right-20 z-10 size-[15px] rounded-full bg-primary/40" />

        {isPending || !nft ? (
          <Skeleton className="h-[368px] w-[310px] rounded-[22px]" />
        ) : (
          <img
            src={nft.imageUrl}
            alt={nft.title}
            className="h-[368px] w-[310px] rounded-[22px] object-cover"
          />
        )}
      </div>
    </section>
  )
}
