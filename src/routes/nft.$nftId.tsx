import { createFileRoute, Link } from '@tanstack/react-router'
import { linkFocusRing, cn } from '@/lib/utils'

/**
 * Stub only — fase 4 substitui `NftDetailStub` pela tela real e adiciona
 * `nftDetailOptions` em `src/features/nft/queries.ts`. Esta fase só garante
 * que Link/refresh/acesso direto não caem em 404 (spec "Rota stub do
 * detalhe"). Sem fetch, sem aparência de conteúdo pronto.
 */
export const Route = createFileRoute('/nft/$nftId')({ component: NftDetailStub })

function NftDetailStub() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 px-6 py-12">
      <h1 className="text-heading-24 font-bold text-foreground">Detalhes do NFT</h1>
      <p className="text-body-16 text-text-secondary">Esta tela chega na fase 4.</p>
      <Link to="/" className={cn(linkFocusRing, 'w-fit text-body-16 font-bold text-primary underline')}>
        Voltar ao catálogo
      </Link>
    </div>
  )
}
