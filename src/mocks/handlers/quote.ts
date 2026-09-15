import { http, HttpResponse } from 'msw'
import { eth, mulQty, roundEth } from '@/lib/money'
import { quoteRequestSchema } from '@/types'
import type { Quote, QuoteItem } from '@/types'
import { db, persist } from '../db'
import { NETWORK_FEES } from '../fixtures'
import { withScenario } from '../scenarios'
import { apiError, parseBody } from '../utils'
import { ownerKey } from './cart'

/** Prices the current cart (guest or signed-in) into a short-lived Quote. */

const QUOTE_TTL_MS = 5 * 60 * 1000

export const quote = [
  http.post(
    '/api/quote',
    withScenario(async ({ request, cookies }) => {
      const body = await parseBody(request, quoteRequestSchema)
      const owner = ownerKey(cookies)
      const rows = db.carts[owner] ?? []
      if (rows.length === 0) {
        return apiError(400, 'validation_error', 'Carrinho vazio.')
      }

      const items: QuoteItem[] = []
      for (const row of rows) {
        const nft = db.nfts.find((n) => n.id === row.nftId)
        const edition = nft?.editions.find((e) => e.id === row.editionId)
        if (!nft || !edition) continue
        if (row.quantity > edition.available) {
          return apiError(409, 'availability_conflict', 'Quantidade acima do disponível.', {
            nftId: row.nftId,
          })
        }
        items.push({
          nftId: row.nftId,
          editionId: row.editionId,
          title: nft.title,
          editionLabel: edition.label,
          quantity: row.quantity,
          unitPriceEth: edition.priceEth,
          lineTotalEth: mulQty(edition.priceEth, row.quantity),
          nftVersion: nft.version,
        })
      }

      const subtotalEth = roundEth(
        items.reduce((sum, item) => sum.plus(eth(item.lineTotalEth)), eth('0')),
      )

      let discountEth = '0'
      let coupon: Quote['coupon']
      if (body.couponCode) {
        const found = db.coupons.find((c) => c.code === body.couponCode)
        if (!found) return apiError(400, 'coupon_invalid', 'Cupom desconhecido.')
        if (Date.now() > new Date(found.expiresAt).getTime()) {
          return apiError(400, 'coupon_expired', 'Cupom expirado.')
        }
        discountEth = roundEth(eth(subtotalEth).times(found.percentOff).div(100))
        coupon = { code: found.code, percentOff: found.percentOff }
      }

      const networkFeeEth = NETWORK_FEES[body.network]
      const totalEth = roundEth(eth(subtotalEth).minus(discountEth).plus(networkFeeEth))

      db.counters.quote += 1
      const id = `q_${db.counters.quote}`
      const createdAt = new Date().toISOString()
      const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString()

      const result: Quote = {
        id,
        items,
        subtotalEth,
        discountEth,
        networkFeeEth,
        totalEth,
        coupon,
        network: body.network,
        createdAt,
        expiresAt,
      }
      db.quotes[id] = { ...result, ownerId: owner }
      persist()

      return HttpResponse.json(result)
    }),
  ),
]
