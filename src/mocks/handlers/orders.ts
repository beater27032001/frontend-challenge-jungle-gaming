import { http, HttpResponse } from 'msw'
import { eth, roundEth } from '@/lib/money'
import { createOrderSchema } from '@/types'
import type { Order } from '@/types'
import { bumpNftVersion, db, persist } from '../db'
import { emitOrderUpdated } from '../realtime'
import { activeScenario, withScenario } from '../scenarios'
import { apiError, requireSession, sha256Hex } from '../utils'

/** Orders: idempotency-key driven creation + payment resolution. */

const RESOLVE_AFTER_MS = 1500

function toResponse(order: (typeof db.orders)[number]): Order {
  const { ownerId: _ownerId, ...rest } = order
  return rest
}

/**
 * Resolve o pagamento quando o prazo venceu e emite `order.updated` uma única
 * vez (o segundo chamador encontra `status !== 'pending'` e sai). Dois
 * gatilhos: o `setTimeout` da criação (caminho de tempo real, sem polling) e o
 * `GET /orders/:id` (caminho de recuperação após refresh, quando o timer do
 * contexto anterior morreu com a página). Pedido confirmado ou recusado é
 * terminal — nunca volta para `pending` (§7).
 */
async function resolveOrderIfDue(order: (typeof db.orders)[number]): Promise<void> {
  if (order.status !== 'pending') return
  if (Date.now() < new Date(order.createdAt).getTime() + RESOLVE_AFTER_MS) return
  // Um reset do db durante a espera descarta o pedido: nada a resolver nem a
  // anunciar para um recurso que não existe mais.
  if (!db.orders.includes(order)) return

  if (activeScenario() === 'payment-declined') {
    order.status = 'declined'
    order.declineReason = 'Pagamento recusado pela operadora simulada.'
  } else {
    order.status = 'confirmed'
    order.txHash = `0x${await sha256Hex(order.id)}`
    order.explorerUrl = `https://example.com/tx/${order.txHash}`
  }
  order.version = 2
  order.resolvedAt = new Date().toISOString()
  persist()
  emitOrderUpdated(toResponse(order), order.ownerId)
}

export const orders = [
  http.post(
    '/api/orders',
    withScenario(async ({ request, cookies }) => {
      const user = requireSession(cookies)

      const idempotencyKey = request.headers.get('Idempotency-Key')
      if (!idempotencyKey) {
        return apiError(400, 'validation_error', 'Header Idempotency-Key é obrigatório.')
      }

      const rawText = await request.text()
      const fingerprint = await sha256Hex(rawText)

      const known = db.idempotency[idempotencyKey]
      if (known) {
        if (known.fingerprint !== fingerprint) {
          return apiError(409, 'idempotency_conflict', 'Chave de idempotência já usada com outro corpo.')
        }
        const existing = db.orders.find((o) => o.id === known.orderId)
        if (existing) return HttpResponse.json(toResponse(existing), { status: 200 })
      }

      let bodyJson: unknown
      try {
        bodyJson = JSON.parse(rawText)
      } catch {
        bodyJson = {}
      }
      const parsed = createOrderSchema.safeParse(bodyJson)
      if (!parsed.success) {
        const details: Record<string, string> = {}
        for (const issue of parsed.error.issues) details[issue.path.join('.') || '_'] = issue.message
        return apiError(400, 'validation_error', 'Dados inválidos.', details)
      }
      const body = parsed.data

      const quote = db.quotes[body.quoteId]
      if (!quote || quote.ownerId !== user.id) {
        return apiError(404, 'not_found', 'Cotação não encontrada.')
      }
      if (Date.now() >= new Date(quote.expiresAt).getTime()) {
        return apiError(409, 'quote_outdated', 'Cotação expirada.')
      }

      const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
      if (!wallet) return apiError(404, 'not_found', 'Carteira não encontrada.')

      // Scenario hooks mutate the catalogue up front so the normal
      // revalidation loop below discovers the conflict organically.
      const firstItem = quote.items[0]
      if (firstItem) {
        const scenario = activeScenario()
        const nft = db.nfts.find((n) => n.id === firstItem.nftId)
        const edition = nft?.editions.find((e) => e.id === firstItem.editionId)
        if (nft && edition) {
          if (scenario === 'price-changed') {
            edition.priceEth = roundEth(eth(edition.priceEth).times('1.1'))
            bumpNftVersion(nft.id)
            persist()
          } else if (scenario === 'sold-out') {
            edition.available = 0
            bumpNftVersion(nft.id)
            persist()
          }
        }
      }

      for (const item of quote.items) {
        const nft = db.nfts.find((n) => n.id === item.nftId)
        const edition = nft?.editions.find((e) => e.id === item.editionId)
        if (!nft || !edition) {
          return apiError(404, 'not_found', 'NFT ou edição inexistente.')
        }
        if (!eth(edition.priceEth).eq(eth(item.unitPriceEth))) {
          return apiError(409, 'quote_outdated', 'Preço mudou desde a cotação.', { nftId: item.nftId })
        }
        if (edition.available < item.quantity) {
          return apiError(409, 'availability_conflict', 'Quantidade acima do disponível.', {
            nftId: item.nftId,
          })
        }
      }

      // Everything checks out: commit the purchase.
      const touchedNftIds = new Set<string>()
      for (const item of quote.items) {
        const nft = db.nfts.find((n) => n.id === item.nftId)!
        const edition = nft.editions.find((e) => e.id === item.editionId)!
        edition.available -= item.quantity
        touchedNftIds.add(nft.id)
      }
      for (const nftId of touchedNftIds) bumpNftVersion(nftId)

      const userCart = db.carts[user.id] ?? []
      for (const item of quote.items) {
        const row = userCart.find((r) => r.nftId === item.nftId && r.editionId === item.editionId)
        if (!row) continue
        row.quantity -= item.quantity
      }
      db.carts[user.id] = userCart.filter((row) => row.quantity > 0)

      db.counters.order += 1
      const orderId = `ord_${db.counters.order}`
      const order: Order & { ownerId: string } = {
        id: orderId,
        ownerId: user.id,
        status: 'pending',
        items: quote.items.map((item) => ({ ...item })),
        subtotalEth: quote.subtotalEth,
        discountEth: quote.discountEth,
        networkFeeEth: quote.networkFeeEth,
        totalEth: quote.totalEth,
        coupon: quote.coupon,
        network: quote.network,
        walletAddress: wallet.address,
        payer: body.payer,
        createdAt: new Date().toISOString(),
        version: 1,
      }
      db.orders.push(order)
      db.idempotency[idempotencyKey] = { fingerprint, orderId }
      persist()

      // O pagamento resolve sozinho e anuncia por `order.updated` — o cliente
      // não precisa fazer polling. O timer morre com a página; quem recarrega
      // recupera pelo `GET /orders/:id`, que resolve na leitura.
      setTimeout(() => void resolveOrderIfDue(order), RESOLVE_AFTER_MS + 50)

      if (activeScenario() === 'order-timeout') {
        return HttpResponse.error()
      }
      return HttpResponse.json(toResponse(order), { status: 201 })
    }),
  ),

  http.get(
    '/api/orders/:id',
    withScenario(async ({ cookies, params }) => {
      const user = requireSession(cookies)
      const order = db.orders.find((o) => o.id === params.id)
      if (!order) return apiError(404, 'not_found', 'Pedido não encontrado.')
      if (order.ownerId !== user.id) return apiError(403, 'forbidden', 'Este pedido pertence a outro usuário.')

      await resolveOrderIfDue(order)

      return HttpResponse.json(toResponse(order))
    }),
  ),
]
