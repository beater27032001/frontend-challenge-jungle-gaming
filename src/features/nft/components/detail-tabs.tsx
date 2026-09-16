import { Star } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import type { NftDetail } from '@/types'
import { NETWORK_LABELS, tokenIdOf } from '../labels'

/**
 * Bloco de abas do detalhe desktop — "Detalhes do NFT" | "Avaliações de
 * colecionadores (N)" — entre o bloco Product e "Mais desta coleção". Existe
 * no frame `10:244` e faltava por completo na aplicação.
 *
 * ⚠️ **O que NÃO está transcrito.** `specs/04-detalhe-nft.md` não cobre este
 * bloco, e o MCP do Figma estourou a cota do plano antes de eu conseguir
 * extrair. Então:
 *
 * - Os rótulos das abas e os três sub-títulos (Rede / Contrato / Direitos
 *   autorais) vieram do relato do usuário, que leu o frame.
 * - A **tipografia da aba** é derivada da toolbar do catálogo, que É
 *   transcrita (`specs/03-catalogo.md` §2: 15px medium, sublinhado em
 *   `primary` sob a ativa) — mesma família de controle, não um chute.
 * - O **texto corrido longo** de cada sub-bloco do Figma não foi extraído.
 *   Em vez de inventar copy, cada sub-bloco mostra o campo real da API que
 *   ele nomeia (`network`, id do token / edições, `creator`). Quando a cota
 *   do Figma voltar, trocar por transcrição.
 *
 * O painel de avaliações mostra o agregado que a API realmente devolve
 * (`ratingAvg` / `ratingCount`). A API não expõe avaliação individual, e
 * fabricar uma lista de comentários violaria "nenhum dado fictício fora de
 * `src/mocks/`" (CLAUDE.md).
 *
 * ponytail: sem roving tabindex — as duas abas são `<button>` na ordem de
 * tabulação natural, com foco visível. Ligar setas ←/→ se o bloco crescer.
 */
export function NftDetailTabs({ nft }: { nft: NftDetail }) {
  const [tab, setTab] = useState<'detalhes' | 'avaliacoes'>('detalhes')
  const id = useId()
  const filledStars = Math.floor(Number(nft.ratingAvg))
  const totalUnits = nft.editions.reduce((sum, e) => sum + e.available, 0)

  return (
    <section className="mt-[56px]">
      <div role="tablist" aria-label="Informações do NFT" className="flex items-center gap-8 border-b border-border-strong">
        <TabButton id={id} value="detalhes" current={tab} onSelect={setTab}>
          Detalhes do NFT
        </TabButton>
        <TabButton id={id} value="avaliacoes" current={tab} onSelect={setTab}>
          {`Avaliações de colecionadores (${nft.ratingCount})`}
        </TabButton>
      </div>

      {tab === 'detalhes' ? (
        <div
          role="tabpanel"
          id={`${id}-panel-detalhes`}
          aria-labelledby={`${id}-tab-detalhes`}
          tabIndex={0}
          className="flex flex-col gap-6 pt-6 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
        >
          <p className="max-w-[820px] text-body-14 leading-[24px] text-text-secondary">
            {nft.description}
          </p>
          <SubBlock title="Rede">{NETWORK_LABELS[nft.network]}</SubBlock>
          <SubBlock title="Contrato">
            {`Token ${tokenIdOf(nft.id)} · ${nft.editions.length} ${nft.editions.length === 1 ? 'edição' : 'edições'} · ${totalUnits} ${totalUnits === 1 ? 'unidade disponível' : 'unidades disponíveis'}`}
          </SubBlock>
          <SubBlock title="Direitos autorais">{nft.creator.name}</SubBlock>
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${id}-panel-avaliacoes`}
          aria-labelledby={`${id}-tab-avaliacoes`}
          tabIndex={0}
          className="flex flex-col gap-3 pt-6 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75"
        >
          <div
            aria-label={`Avaliação média: ${nft.ratingAvg} de 5, ${nft.ratingCount} avaliações`}
            className="flex items-center gap-2"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                aria-hidden
                fill={i < filledStars ? 'currentColor' : 'none'}
                className={cn('size-[15px]', i < filledStars ? 'text-text-accent' : 'text-border-strong')}
              />
            ))}
            <span className="text-title-22 leading-[16px] font-bold text-text-accent">{nft.ratingAvg}</span>
          </div>
          <p className="text-body-15 text-foreground">
            {`${nft.ratingCount} avaliações de colecionadores`}
          </p>
        </div>
      )}
    </section>
  )
}

function TabButton({
  id,
  value,
  current,
  onSelect,
  children,
}: {
  id: string
  value: 'detalhes' | 'avaliacoes'
  current: string
  onSelect: (v: 'detalhes' | 'avaliacoes') => void
  children: string
}) {
  const active = current === value
  return (
    <button
      type="button"
      role="tab"
      id={`${id}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${id}-panel-${value}`}
      onClick={() => onSelect(value)}
      className={cn(
        'relative -mb-px cursor-pointer border-b-2 pb-3 text-body-15 leading-[16px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75',
        // O sublinhado carrega o estado junto da cor — `aria-selected` cobre
        // o leitor de tela, e a borda cobre "estado nunca só por cor".
        active ? 'border-primary text-text-accent' : 'border-transparent text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body-15 font-bold leading-[16px] text-foreground">{title}</h3>
      <p className="text-body-14 leading-[24px] text-text-secondary">{children}</p>
    </div>
  )
}
