import { http, HttpResponse } from 'msw'
import { eth, roundEth } from '@/lib/money'
import { addCartItemSchema, updateCartItemSchema } from '@/types'
import type { Cart, CartItem, NftDetail, NftEdition } from '@/types'
import { db, findUserByToken, persist } from '../db'
import { withScenario } from '../scenarios'
import { apiError, parseBody } from '../utils'

/**
 * Cart works for guests (`carts['guest']`) and signed-in users alike. No
 * separate guest cookie is needed — the db itself is per-browser.
 */

type CartRow = { id: string; nftId: string; editionId: string; quantity: number }

/** Resolves the owner key for cart routes: userId if a valid session cookie
 * exists, otherwise 'guest'. Never throws — cart works without auth. */
export function ownerKey(cookies: Record<string, string>): string {
  const found = findUserByToken(cookies['gm_session'])
  return found && !found.expired ? found.user.id : 'guest'
}

function findEdition(nftId: string, editionId: string): { nft: NftDetail; edition: NftEdition } | undefined {
  const nft = db.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : undefined
}

function rowsFor(owner: string): CartRow[] {
  return db.carts[owner] ?? (db.carts[owner] = [])
}

function nextCartItemId(): string {
  db.counters.cartItem += 1
  return `ci_${db.counters.cartItem}`
}

export function buildCart(owner: string): Cart {
  const rows = rowsFor(owner)
  const items: CartItem[] = []
  for (const row of rows) {
    const found = findEdition(row.nftId, row.editionId)
    if (!found) continue
    items.push({
      id: row.id,
      nftId: row.nftId,
      editionId: row.editionId,
      editionLabel: found.edition.label,
      title: found.nft.title,
      imageUrl: found.nft.imageUrl,
      quantity: row.quantity,
      unitPriceEth: found.edition.priceEth,
      available: found.edition.available,
      nftVersion: found.nft.version,
    })
  }
  const subtotalEth = roundEth(
    items.reduce((sum, item) => sum.plus(eth(item.unitPriceEth).times(item.quantity)), eth('0')),
  )
  return { items, subtotalEth }
}

/** Merges guest cart rows into a user's cart on login/register, capping each
 * line at current availability, then empties the guest cart. */
export function mergeGuestCartInto(userId: string): void {
  const guestRows = db.carts['guest']
  if (!guestRows || guestRows.length === 0) return
  const userRows = rowsFor(userId)

  for (const guestRow of guestRows) {
    const found = findEdition(guestRow.nftId, guestRow.editionId)
    if (!found) continue
    const existing = userRows.find(
      (row) => row.nftId === guestRow.nftId && row.editionId === guestRow.editionId,
    )
    if (existing) {
      existing.quantity = Math.min(existing.quantity + guestRow.quantity, found.edition.available)
    } else {
      userRows.push({
        id: nextCartItemId(),
        nftId: guestRow.nftId,
        editionId: guestRow.editionId,
        quantity: Math.min(guestRow.quantity, found.edition.available),
      })
    }
  }
  db.carts[userId] = userRows.filter((row) => row.quantity > 0)
  db.carts['guest'] = []
}

export const cart = [
  http.get(
    '/api/cart',
    withScenario(({ cookies }) => HttpResponse.json(buildCart(ownerKey(cookies)))),
  ),

  http.post(
    '/api/cart/items',
    withScenario(async ({ request, cookies }) => {
      const body = await parseBody(request, addCartItemSchema)
      const found = findEdition(body.nftId, body.editionId)
      if (!found) return apiError(404, 'not_found', 'NFT ou edição inexistente.')

      const owner = ownerKey(cookies)
      const rows = rowsFor(owner)
      const existing = rows.find(
        (row) => row.nftId === body.nftId && row.editionId === body.editionId,
      )
      const nextQuantity = (existing?.quantity ?? 0) + body.quantity
      if (nextQuantity > found.edition.available) {
        return apiError(409, 'availability_conflict', 'Quantidade acima do disponível.', {
          available: String(found.edition.available),
        })
      }
      if (existing) {
        existing.quantity = nextQuantity
      } else {
        rows.push({ id: nextCartItemId(), nftId: body.nftId, editionId: body.editionId, quantity: nextQuantity })
      }
      persist()
      return HttpResponse.json(buildCart(owner))
    }),
  ),

  http.patch(
    '/api/cart/items/:itemId',
    withScenario(async ({ request, params, cookies }) => {
      const body = await parseBody(request, updateCartItemSchema)
      const owner = ownerKey(cookies)
      const rows = rowsFor(owner)
      const row = rows.find((r) => r.id === params.itemId)
      if (!row) return apiError(404, 'not_found', 'Item de carrinho inexistente.')

      const found = findEdition(row.nftId, row.editionId)
      const available = found?.edition.available ?? 0
      if (body.quantity > available) {
        return apiError(409, 'availability_conflict', 'Quantidade acima do disponível.', {
          available: String(available),
        })
      }
      row.quantity = body.quantity
      persist()
      return HttpResponse.json(buildCart(owner))
    }),
  ),

  http.delete(
    '/api/cart/items/:itemId',
    withScenario(({ params, cookies }) => {
      const owner = ownerKey(cookies)
      const rows = rowsFor(owner)
      const index = rows.findIndex((r) => r.id === params.itemId)
      if (index === -1) return apiError(404, 'not_found', 'Item de carrinho inexistente.')
      rows.splice(index, 1)
      persist()
      return HttpResponse.json(buildCart(owner))
    }),
  ),
]
