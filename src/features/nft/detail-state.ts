import type { NftDetail } from '@/types'

/**
 * Estado de compra elevado à rota (`nft.$nftId.tsx`, specs/04-detalhe-nft.md):
 * `NftDetailDesktop`/`NftDetailMobile` montam ao mesmo tempo (`hidden lg:*`),
 * então o estado não pode viver dentro de cada composição — precisaria
 * sincronizar duas cópias. Tipo compartilhado para não duplicar a interface.
 */
export interface NftDetailViewProps {
  nft: NftDetail
  selectedEditionId: string | null // null ⇔ todas as edições esgotadas
  quantity: number
  imageIndex: number
  onSelectEdition: (editionId: string) => void // reseta quantity para 1
  onQuantityDelta: (delta: 1 | -1) => void // clamp [1, edition.available]
  onSelectImage: (index: number) => void
  onBuy: () => void
  isBuying: boolean
}
