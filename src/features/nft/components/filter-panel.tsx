import Big from 'big.js'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { eth, roundEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { NETWORKS, NFT_CATEGORIES } from '@/types'
import type { Network, NftCategory } from '@/types'
import { CATEGORY_LABELS, NETWORK_LABELS } from '../labels'
import type { CatalogSearch } from '../search-params'

/**
 * specs/02-design-system.md §3 + specs/03-catalogo.md resolução OQ3. Reused
 * as-is inside the desktop sidebar and inside the mobile filter `Sheet` — the
 * component itself never fetches or navigates, it only reports patches via
 * `onPatch` (always including `page: undefined`, spec's pagination-reset rule).
 */

export interface CatalogFacets {
  countsByCategory: Record<NftCategory, number>
  countsByNetwork: Record<Network, number>
  maxPriceEth: string
}

function ceilEth(v: string): number {
  return Number(eth(v).round(0, Big.roundUp))
}

function fmtEth(n: number): string {
  return roundEth(eth(n.toFixed(2)))
}

function FilterRow<T extends string>({
  value,
  label,
  count,
  selected,
  onToggle,
}: {
  value: T
  label: string
  count: number
  selected: boolean
  onToggle: (value: T) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(value)}
      className={cn(
        'flex w-full items-center justify-between px-3 text-body-15 leading-[40px]',
        selected ? 'font-bold text-text-accent' : 'text-text-secondary',
      )}
    >
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </button>
  )
}

export function FilterPanel({
  search,
  facets,
  onPatch,
}: {
  search: CatalogSearch
  facets: CatalogFacets | undefined
  onPatch: (patch: Partial<CatalogSearch>) => void
}) {
  const maxCeil = facets ? ceilEth(facets.maxPriceEth) : 1

  // Rascunho local (spec: "estado local só para rascunho ... o valor
  // commitado mora na URL"). Precisa resincronizar quando a URL muda por fora
  // — navegação, voltar, "Limpar filtros" —, e não só na montagem.
  //
  // Ajuste durante o render em vez de useEffect: é o padrão que o React
  // documenta para estado derivado de prop. O efeito equivalente commitaria um
  // render com o rascunho velho e só então corrigiria, o que além do flash é o
  // render em cascata que o lint acusa.
  const urlPrice = `${search.priceMin ?? ''}|${search.priceMax ?? ''}|${maxCeil}`
  const [syncedTo, setSyncedTo] = useState(urlPrice)
  const [draft, setDraft] = useState<[number, number]>([Number(search.priceMin ?? 0), Number(search.priceMax ?? maxCeil)])
  if (syncedTo !== urlPrice) {
    setSyncedTo(urlPrice)
    setDraft([Number(search.priceMin ?? 0), Number(search.priceMax ?? maxCeil)])
  }

  function toggleCategory(value: NftCategory) {
    onPatch({ category: search.category === value ? undefined : value, page: undefined })
  }
  function toggleNetwork(value: Network) {
    onPatch({ network: search.network === value ? undefined : value, page: undefined })
  }
  function applyPrice() {
    const [min, max] = draft
    onPatch({
      priceMin: min <= 0 ? undefined : fmtEth(min),
      priceMax: max >= maxCeil ? undefined : fmtEth(max),
      page: undefined,
    })
  }

  return (
    <div className="flex w-[310px] flex-col gap-10 bg-card p-5">
      <section>
        <h3 className="text-body-18 leading-[16px] font-bold text-foreground">Coleções</h3>
        <div className="mt-3">
          {NFT_CATEGORIES.map((category) => (
            <FilterRow
              key={category}
              value={category}
              label={CATEGORY_LABELS[category]}
              count={facets?.countsByCategory[category] ?? 0}
              selected={search.category === category}
              onToggle={toggleCategory}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-body-18 leading-[16px] font-bold text-foreground">Faixa de preço</h3>
        <div className="mt-3 px-3">
          <Slider
            min={0}
            max={maxCeil}
            step={0.01}
            value={draft}
            onValueChange={(v) => setDraft([v[0], v[1]])}
            thumbLabels={['Preço mínimo', 'Preço máximo']}
          />
          <p className="mt-3 text-body-15 text-foreground">
            {fmtEth(draft[0])} ETH – {fmtEth(draft[1])} ETH
          </p>
          <Button
            type="button"
            onClick={applyPrice}
            className="mt-3 h-auto w-fit rounded-[6px] px-3 py-2 text-body-16 leading-[20px] font-bold"
          >
            Aplicar
          </Button>
        </div>
      </section>

      <section>
        <h3 className="text-body-18 leading-[16px] font-bold text-foreground">Rede</h3>
        <div className="mt-3">
          {NETWORKS.map((network) => (
            <FilterRow
              key={network}
              value={network}
              label={NETWORK_LABELS[network]}
              count={facets?.countsByNetwork[network] ?? 0}
              selected={search.network === network}
              onToggle={toggleNetwork}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
