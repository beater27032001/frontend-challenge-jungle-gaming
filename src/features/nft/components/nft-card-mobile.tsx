import { Heart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useSession } from '@/features/auth/use-session'
import { favoritesOptions, useToggleFavorite } from '@/features/nft/favorites'
import { linkFocusRing, cn } from '@/lib/utils'
import type { NftSummary } from '@/types'
import { RARITY_BADGES } from '../labels'

/**
 * Mobile card (specs/03-catalogo.md §4 + resolução OQ4) — a distinct
 * component, not the desktop card rescaled. The favourite heart is a sibling
 * of the `Link`, not nested inside it (a `<button>` inside an `<a>` is
 * invalid interactive-in-interactive markup); it overlaps visually via the
 * shared `relative` wrapper.
 *
 * Fase 5 (specs/05-auth.md §4): visitante clica → abre o modal de login, sem
 * chamar `/favorites` (critério 12). Logado: reflete `favoritesOptions` e
 * dispara `useToggleFavorite` otimista.
 */
export function NftCardMobile({ nft }: { nft: NftSummary }) {
  const badge = RARITY_BADGES[nft.rarity]
  const session = useSession()
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const scope = session.data?.user.id ?? 'guest'
  const favorites = useQuery({ ...favoritesOptions(scope), enabled: !!session.data })
  const isFavorited = favorites.data?.nftIds.includes(nft.id) ?? false
  const toggleFavorite = useToggleFavorite(scope)

  function onFavoriteClick() {
    if (!session.data) {
      // Fase 5 (specs/05-auth.md §9): rota real — visitante vai para
      // /login com `redirect` de volta a esta página.
      navigate({ to: '/login', search: { redirect: pathname === '/' ? undefined : pathname } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, favorited: isFavorited })
  }

  return (
    <div className="relative flex w-full flex-col gap-2">
      <Link
        to="/nft/$nftId"
        params={{ nftId: nft.id }}
        aria-label={nft.title}
        className={cn(linkFocusRing, 'flex flex-col gap-2')}
      >
        <div className="relative h-[200px] w-full rounded-[20px] bg-[linear-gradient(139.55deg,#241612_12%,#2f1d15_106.59%)]">
          <img
            src={nft.imageUrl}
            alt={nft.title}
            className="absolute inset-[3.5px] rounded-[16px] object-cover"
          />
          {badge && (
            // ponytail: px derivado do exemplo RARO (68×32); offset esquerdo
            // não transcrito, provisório 16px (specs/03-catalogo.md §4 +
            // resolução OQ4).
            <span className="absolute top-4 left-4 inline-flex h-8 items-center bg-primary px-[18px] text-[13px] font-medium text-primary-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="pl-2 text-body-15 text-foreground">{nft.title}</p>
        <p className="pl-2 text-body-16 font-bold text-text-accent">{nft.priceEth} ETH</p>
      </Link>

      <button
        type="button"
        onClick={onFavoriteClick}
        aria-label="Favoritar"
        aria-pressed={isFavorited}
        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-ink/40 text-foreground"
      >
        <Heart
          aria-hidden
          fill={isFavorited ? 'currentColor' : 'none'}
          className={cn('size-4', isFavorited && 'text-text-accent')}
        />
      </button>
    </div>
  )
}
