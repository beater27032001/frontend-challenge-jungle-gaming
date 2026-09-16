import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'
import type { Socket } from 'socket.io-client'
import { useSession } from '@/features/auth/use-session'
import { cartKey } from '@/features/cart/queries'
import { orderKey } from '@/features/checkout/queries'
import { connectRealtime } from '@/lib/socket'
import { mocksEnabled } from '@/mocks'
import type { Cart, NftDetail, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/types'

/**
 * Tempo real (desafio §7). Montado uma única vez, no `__root`.
 *
 * Um socket por escopo de usuário: o efeito depende de `scope`, então login,
 * logout e troca de usuário fecham a conexão anterior (`disconnect()` +
 * `removeAllListeners()`) e abrem outra. Isso resolve três requisitos de uma
 * vez — liberação de listeners no fim do ciclo de vida, impossibilidade de um
 * evento de sessão anterior atualizar dados de outro usuário (o socket antigo
 * já não existe, e as chaves de cache são por `scope`), e a identidade da
 * conexão que o mock usa para filtrar eventos de pedido.
 *
 * Tolerância a duplicata e a evento antigo é UMA guarda, não duas: o `ledger`
 * guarda a maior `version` já aplicada por recurso e só aceita `version`
 * estritamente maior. Duplicata chega com versão igual; evento atrasado, com
 * versão menor. Nenhum dos dois passa, nenhum efeito é reaplicado.
 */

/** Diagnóstico para o Playwright — contadores, não um caminho de simulação.
 * Os eventos continuam chegando só pelo `socket.io-client`; isto apenas conta o
 * que chegou, o que foi aplicado e o que a guarda de versão descartou. */
export interface RealtimeDiagnostics {
  connects: number
  reconciliations: number
  received: number
  applied: number
  skipped: number
  lastEventId: string | null
  orderEvents: Array<{ id: string; status: string }>
}

const diagnostics: RealtimeDiagnostics = {
  connects: 0,
  reconciliations: 0,
  received: 0,
  applied: 0,
  skipped: 0,
  lastEventId: null,
  orderEvents: [],
}

declare global {
  interface Window {
    __realtime?: RealtimeDiagnostics
  }
}

export function useRealtime(): void {
  const session = useSession()
  const queryClient = useQueryClient()
  const scope = session.data?.user.id ?? 'guest'
  // Sem mocks não há servidor de socket: conectar só geraria retry infinito.
  const enabled = !session.isPending && mocksEnabled

  useEffect(() => {
    if (!enabled) return

    /** recurso → maior `version` já aplicada nesta conexão. */
    const ledger = new Map<string, number>()
    /** Conexões DESTE socket. `diagnostics.connects` é cumulativo entre
     * escopos; a decisão de reconciliar só olha o socket atual. */
    let connectsHere = 0
    window.__realtime = diagnostics

    /** Guarda única de duplicata + evento antigo. */
    function accept(event: { resource: { type: string; id: string }; version: number }): boolean {
      diagnostics.received += 1
      const key = `${event.resource.type}:${event.resource.id}`
      if ((ledger.get(key) ?? 0) >= event.version) {
        diagnostics.skipped += 1
        return false
      }
      ledger.set(key, event.version)
      diagnostics.applied += 1
      return true
    }

    function onNftUpdated(event: NftUpdatedEvent) {
      if (!accept(event)) return
      diagnostics.lastEventId = event.eventId
      const nftId = event.resource.id

      // Detalhe: o evento traz preço e disponibilidade, então o patch é direto,
      // sem ida ao servidor.
      queryClient.setQueryData<NftDetail>(['nfts', scope, 'detail', nftId], (prev) => {
        if (!prev || prev.version >= event.version) return prev
        return {
          ...prev,
          version: event.version,
          priceEth: event.data.priceEth,
          available: event.data.available,
          editions: prev.editions.map((edition) => {
            const updated = event.data.editions.find((e) => e.id === edition.id)
            return updated ? { ...edition, ...updated } : edition
          }),
        }
      })

      // Catálogo, destaque e carrinho: o REST é a fonte dos campos derivados
      // (menor preço entre edições, soma de disponíveis, subtotal do carrinho).
      // Recalcular isso no cliente duplicaria regra de negócio — revalida.
      queryClient.invalidateQueries({ queryKey: ['nfts', scope, 'list'] })
      queryClient.invalidateQueries({ queryKey: ['nfts', scope, 'featured'] })

      // Cenário obrigatório §7, passo 3: se o NFT está no carrinho, avisa antes
      // de trocar o resumo — mudança de preço não pode ser silenciosa.
      const cart = queryClient.getQueryData<Cart>(cartKey(scope))
      const line = cart?.items.find((item) => item.nftId === nftId)
      if (line) {
        const edition = event.data.editions.find((e) => e.id === line.editionId)
        if (edition && edition.priceEth !== line.unitPriceEth) {
          toast.warning(`Preço de "${line.title}" mudou para ${edition.priceEth} ETH.`)
        } else if (edition && edition.available < line.quantity) {
          toast.warning(`"${line.title}": só ${edition.available} disponível(is) agora.`)
        }
        queryClient.invalidateQueries({ queryKey: cartKey(scope) })
      }
    }

    function onOrderUpdated(event: OrderUpdatedEvent) {
      if (!accept(event)) return
      diagnostics.lastEventId = event.eventId
      diagnostics.orderEvents.push({ id: event.resource.id, status: event.data.status })

      queryClient.setQueryData<Order>(orderKey(scope, event.resource.id), (prev) => {
        if (!prev || prev.version >= event.version) return prev
        return { ...prev, version: event.version, ...event.data }
      })
      // O recibo completo (txHash, resolvedAt) é do REST, não do evento.
      queryClient.invalidateQueries({ queryKey: orderKey(scope, event.resource.id) })

      if (event.data.status === 'confirmed') {
        toast.success('Pagamento confirmado.')
      } else if (event.data.status === 'declined') {
        toast.error(event.data.declineReason ?? 'Pagamento recusado.')
      }
    }

    function onConnect() {
      diagnostics.connects += 1
      connectsHere += 1
      // Reconexão (não a primeira conexão): o cliente pode ter perdido eventos
      // enquanto estava fora, então reconcilia os recursos ATIVOS com o REST.
      if (connectsHere > 1) {
        diagnostics.reconciliations += 1
        queryClient.invalidateQueries({ refetchType: 'active' })
      }
    }

    // `connectRealtime` é assíncrono porque o `socket.io-client` tem de ser
    // carregado DEPOIS dos mocks (ver src/lib/socket.ts). Se o efeito for
    // limpo antes de o módulo chegar, a conexão é encerrada na hora.
    let socket: Socket | undefined
    let cancelled = false
    void connectRealtime(scope).then((connected) => {
      if (cancelled) {
        connected.disconnect()
        return
      }
      socket = connected
      socket.on('connect', onConnect)
      socket.on('nft.updated', onNftUpdated)
      socket.on('order.updated', onOrderUpdated)
    })

    return () => {
      cancelled = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [enabled, scope, queryClient])
}
