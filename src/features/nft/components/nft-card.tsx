import { Link } from '@tanstack/react-router'
import { linkFocusRing, cn } from '@/lib/utils'
import type { NftSummary } from '@/types'

/**
 * Desktop card (specs/02-design-system.md §4) — fluid width, exact only at
 * 1440. The 258/250/4px numbers from the transcription collapse to one rule:
 * the artwork insets 4px from the placa on every side (258 - 2*4 = 250), so a
 * fluid `w-full` placa keeps that relationship at any grid-cell width instead
 * of a fixed 258px that would overflow narrower `lg` viewports.
 */
export function NftCard({ nft }: { nft: NftSummary }) {
  return (
    <Link
      to="/nft/$nftId"
      params={{ nftId: nft.id }}
      aria-label={nft.title}
      className={cn(linkFocusRing, 'flex w-full flex-col gap-3')}
    >
      <div className="relative h-[300px] w-full bg-card">
        {/* Figma 4:137: 250x250 em left 4 / top 31 dentro da placa de 300 —
            não `inset-1`, que estica a arte e come a margem superior. */}
        <img
          src={nft.imageUrl}
          alt={nft.title}
          className="absolute top-[31px] left-1 size-[250px] rounded-[15px] object-cover"
        />
      </div>
      <p className="text-body-16 leading-[16px] text-foreground">{nft.title}</p>
      <p className="text-body-18 leading-[16px] font-bold text-text-accent">{nft.priceEth} ETH</p>
    </Link>
  )
}
