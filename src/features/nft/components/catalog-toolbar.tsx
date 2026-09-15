import { Link, useNavigate } from '@tanstack/react-router'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { NftSort } from '@/types'
import { SORT_LABELS } from '../labels'
import type { CatalogSearch } from '../search-params'

/**
 * specs/03-catalogo.md §2. Desktop-only (`hidden lg:flex` on its own root,
 * same pattern as `header.tsx`) — the mobile frame has no toolbar, ordering
 * moves into the filter `Sheet` instead (`SortSelect` below is reused there).
 */

const SORT_VALUES: NftSort[] = ['newest', 'price-asc', 'price-desc', 'popular']

type Tab = 'todos' | 'novos' | 'alta'

function activeTab(sort: CatalogSearch['sort']): Tab {
  if (sort === 'popular') return 'alta'
  if (sort === 'newest') return 'novos'
  return 'todos'
}

/**
 * Shared with the mobile filter Sheet (`mobile-search-bar.tsx`): `naked`
 * drops the border/background for the desktop toolbar's inline look;
 * the mobile Sheet instead gets a normal bordered trigger with a visible
 * `Label` ("Ordenar por").
 */
export function SortSelect({
  value,
  onChange,
  naked = false,
}: {
  value: NftSort | undefined
  onChange: (value: NftSort | undefined) => void
  naked?: boolean
}) {
  const current = value ?? 'newest'
  const select = (
    <Select value={current} onValueChange={(v) => onChange(v === 'newest' ? undefined : (v as NftSort))}>
      <SelectTrigger
        id={naked ? undefined : 'mobile-sort'}
        aria-label="Ordenar por"
        className={cn(naked && 'h-auto gap-2 border-0 bg-transparent p-0 text-body-15 shadow-none')}
      >
        <SelectValue />
      </SelectTrigger>
      {/* position="popper" + offset: o padrão do Radix é "item-aligned", que
          põe o item selecionado por cima do gatilho e tapa "Ordenar por". */}
      <SelectContent position="popper" sideOffset={6} align="end">
        {SORT_VALUES.map((sort) => (
          <SelectItem key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (naked) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-body-15 text-foreground">Ordenar por:</span>
        {select}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="mobile-sort">Ordenar por</Label>
      {select}
    </div>
  )
}

export function CatalogToolbar({ search }: { search: CatalogSearch; total: number | undefined }) {
  const navigate = useNavigate({ from: '/' })
  const tab = activeTab(search.sort)

  return (
    <div className="hidden w-full items-center justify-between lg:flex">
      <nav aria-label="Ordenar catálogo" className="flex items-center gap-5">
        <ToolbarTab active={tab === 'todos'} sort={undefined}>
          Todos os NFTs
        </ToolbarTab>
        <ToolbarTab active={tab === 'novos'} sort="newest">
          Novos lançamentos
        </ToolbarTab>
        <ToolbarTab active={tab === 'alta'} sort="popular">
          Em alta
        </ToolbarTab>
      </nav>

      <SortSelect
        naked
        value={search.sort}
        onChange={(sort) =>
          // resetScroll: false — filtrar é refinar a lista, não navegar para outra
          // página; o router sobe ao topo por padrão e isso tira o grid da vista.
          navigate({ search: (prev) => ({ ...prev, sort, page: undefined }), resetScroll: false })
        }
      />
    </div>
  )
}

function ToolbarTab({
  active,
  sort,
  children,
}: {
  active: boolean
  sort: NftSort | undefined
  children: string
}) {
  return (
    <Link
      to="/"
      search={(prev) => ({ ...prev, sort, page: undefined })}
      // O <Link> do router calcula o próprio aria-current e o escreve por cima
      // do explícito abaixo. Seu match padrão é parcial e ignora undefined, então
      // uma chave que o link zera (`page`) conta como "não importa" em vez de
      // "precisa estar ausente" — e a aba sem `sort` acabava ativa para qualquer
      // sort. `exact: true` compara contagem de chaves; como todo `search` aqui é
      // `{ ...prev, override }`, isso reduz ao mesmo teste que o `active` já faz.
      // Filtrar/paginar refina a lista; o router sobe ao topo por padrão e tira
      // o grid da vista. Vale para <Link> igual vale para navigate().
      resetScroll={false}
      activeOptions={{ exact: true }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative pb-2 text-body-15 leading-[16px] font-medium',
        active ? 'text-text-accent' : 'text-foreground',
      )}
    >
      {children}
      {active && <span aria-hidden className="absolute top-[23px] left-0 h-[2px] w-[101px] bg-primary" />}
    </Link>
  )
}
