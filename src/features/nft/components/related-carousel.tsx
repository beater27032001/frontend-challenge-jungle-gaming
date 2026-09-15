import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useSession } from '@/features/auth/use-session'
import { cn } from '@/lib/utils'
import type { NftDetail } from '@/types'
import { nftListOptions } from '../queries'

const PAGE_SIZE = 5

/**
 * "Mais desta coleção" (specs/04-detalhe-nft.md §3, resolução OQ1) —
 * desktop-only (o frame mobile `15:5536` não tem a seção). Reusa
 * `nftListOptions` com `{ category, perPage: 12 }`, sem query nova; filtra o
 * próprio NFT no componente.
 */
export function RelatedCarousel({ nft }: { nft: NftDetail }) {
  const session = useSession()
  const scope = session.data?.user.id ?? 'guest'
  const list = useQuery({
    ...nftListOptions(scope, { category: nft.category, perPage: 12 }),
    enabled: !session.isPending,
  })

  const [page, setPage] = useState(0)

  const items = (list.data?.items ?? []).filter((item) => item.id !== nft.id)
  if (items.length === 0) return null

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const clampedPage = Math.min(page, totalPages - 1)
  const visible = items.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <section className="mt-12 hidden w-full flex-col gap-6 lg:flex">
      <div className="flex h-[28px] w-full items-center gap-4">
        <h2 className="shrink-0 text-body-15 font-bold leading-[16px] text-foreground">Mais desta coleção</h2>
        <span aria-hidden className="h-px flex-1 bg-border-strong" />
      </div>

      <div className="flex w-full items-start justify-between">
        {visible.map((item) => (
          <Link
            key={item.id}
            to="/nft/$nftId"
            params={{ nftId: item.id }}
            className="flex w-[219px] flex-col gap-3"
          >
            <div className="flex h-[255px] w-[219px] items-center justify-center bg-surface-card">
              {/* Padronização deliberada (specs/04-detalhe-nft.md §3, ARCHITECTURE
                  fase 4): o Figma alterna raio 11/13 e padding entre os 5 cards —
                  219×255/212/13 é o valor que aparece em 4 dos 5, replicado aqui
                  para todos. */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="size-[212px] rounded-[13px] object-cover"
              />
            </div>
            <p className="text-body-15 text-foreground">{item.title}</p>
            <p className="text-body-16 font-bold leading-[16px] text-text-accent">{item.priceEth} ETH</p>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div aria-hidden={false} className="flex w-full items-center justify-center gap-[7px]">
          {/* ponytail: composição interna dos dots (52×12) não verificada no SVG
              — espelha provisoriamente a composição verificada do hero mobile
              (pill ativo + círculos), registrado em ARCHITECTURE.md fase 4. */}
          {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Página ${i + 1}`}
              aria-current={i === clampedPage ? 'true' : undefined}
              onClick={() => setPage(i)}
              className={cn(
                'shrink-0 bg-primary transition-[width]',
                i === clampedPage ? 'h-[7px] w-[28px] rounded-[3.5px]' : 'size-[7px] rounded-full',
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}
