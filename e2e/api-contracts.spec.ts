import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import Big from 'big.js'
import {
  ANA,
  apiFetch,
  addToCart,
  awaitMswReady,
  boot,
  bootReset,
  BRUNO,
  clearCart,
  login,
  logout,
  reset,
  setScenario,
} from './helpers'

/**
 * Phase 1 contract tests: exercise the MSW mock API (types, db, scenarios)
 * entirely from the page context — the Playwright `request` fixture never
 * touches the service worker, so every assertion goes through
 * `page.evaluate(fetch)`. `GET /api/health` is the only route reachable
 * outside a booted app; everything else requires `boot()` first.
 *
 * Shared boot/fetch/auth helpers live in `./helpers` (fase 2 consolidation,
 * spec §6) — this file also absorbs the 4 `describe` blocks that used to
 * live in the now-deleted `nft-catalog-session-integrity.spec.ts` (see the
 * "Long-session coherence…" section below).
 */

test.describe('NFT catalogue', () => {
  test('pagination: default page 1 of 12, last page, and past-the-end page', async ({ page }) => {
    await boot(page, '?mock-reset=1')

    const p1 = await apiFetch(page, '/api/nfts')
    expect(p1.status).toBe(200)
    expect(p1.body).toMatchObject({ page: 1, perPage: 12, total: 48, totalPages: 4 })
    expect(p1.body.items).toHaveLength(12)

    // Default sort is 'newest' (createdAt desc), so page 1 opens on the
    // newest NFT and the last page closes on the oldest one.
    expect(p1.body.items[0].id).toBe('nft-048')

    const p4 = await apiFetch(page, '/api/nfts?page=4')
    expect(p4.body.items).toHaveLength(12)
    expect(p4.body.items[11].id).toBe('nft-001')

    const p5 = await apiFetch(page, '/api/nfts?page=5')
    expect(p5.status).toBe(200)
    expect(p5.body.items).toEqual([])
    expect(p5.body.total).toBe(48)
  })

  test('search with no matches returns total 0 with 200, not an error', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    const res = await apiFetch(page, '/api/nfts?q=zzznope')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ total: 0, items: [] })
  })

  test('combined category+rarity+sort is deterministic and every item matches both filters', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    const url = '/api/nfts?category=art&rarity=epic&sort=price-asc&perPage=48'
    const [first, second] = await Promise.all([apiFetch(page, url), apiFetch(page, url)])

    expect(second.body).toEqual(first.body)
    // 9 categories x 4 rarities, gcd(9,4)=1: art+epic lands on exactly two
    // NFTs, i=0 (nft-001) and i=36 (nft-037), both priced '0.008' (i%12=0
    // on the price table for both).
    expect(first.body.total).toBe(2)
    for (const item of first.body.items) {
      expect(item.category).toBe('art')
      expect(item.rarity).toBe('epic')
    }
    expect(first.body.items.map((i: { id: string }) => i.id).sort()).toEqual(['nft-001', 'nft-037'])
    for (const item of first.body.items) expect(item.priceEth).toBe('0.008')

    // Pairwise price-asc check via big.js — never `Number()` on an
    // *Eth-named field (static contract check below guards this repo-wide).
    for (let i = 1; i < first.body.items.length; i++) {
      const prev = first.body.items[i - 1].priceEth
      const curr = first.body.items[i].priceEth
      expect(new Big(curr).gte(prev), `item ${i} out of order vs item ${i - 1}`).toBe(true)
    }

    // With 9 categories and 4 rarities, gcd(9,4)=1: every category×rarity
    // pair now exists — the "impossible pair" from the old 4-category
    // fixtures doesn't exist anymore. art+rare has exactly one NFT.
    const artRare = await apiFetch(page, '/api/nfts?category=art&rarity=rare')
    expect(artRare.status).toBe(200)
    expect(artRare.body.total).toBe(1)
    expect(artRare.body.items[0].id).toBe('nft-028')
  })

  test('a new (fase 2) category value is a real filter; an unknown category value is rejected with 400', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    // 9 categories over 48 NFTs (i % 9): the first 3 (art/photography/music)
    // get 6 each, the remaining 6 (including generative) get 5 each.
    const generative = await apiFetch(page, '/api/nfts?category=generative')
    expect(generative.status).toBe(200)
    expect(generative.body.total).toBe(5)

    const bogus = await apiFetch(page, '/api/nfts?category=nunca-existiu')
    expect(bogus.status).toBe(400)
    expect(bogus.body.error.code).toBe('validation_error')
  })

  test('priceMin > priceMax returns an empty list, not an error', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    const res = await apiFetch(page, '/api/nfts?priceMin=1&priceMax=0.01')
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
    expect(res.body.total).toBe(0)
  })

  test('invalid page/perPage params are rejected with 400 validation_error', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    const nonNumeric = await apiFetch(page, '/api/nfts?page=abc')
    expect(nonNumeric.status).toBe(400)
    expect(nonNumeric.body.error.code).toBe('validation_error')

    const zero = await apiFetch(page, '/api/nfts?page=0')
    expect(zero.status).toBe(400)
    expect(zero.body.error.code).toBe('validation_error')
  })

  test('detail: 404 for unknown id, 200 with editions/priceEth as string and local cycling webp images for a known id', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    const missing = await apiFetch(page, '/api/nfts/nft-999')
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('not_found')

    const found = await apiFetch(page, '/api/nfts/nft-001')
    expect(found.status).toBe(200)
    expect(found.body.editions.length).toBeGreaterThanOrEqual(1)
    expect(typeof found.body.priceEth).toBe('string')

    // External placeholder-image debt paid off (spec §5): 4 local assets cycled by
    // index (fase 4: 3 -> 4 imagens, specs/04-detalhe-nft.md §2 — desktop tem 4
    // thumbnails).
    expect(found.body.imageUrl).toBe('/nft/ape-01.webp')
    expect(found.body.images).toEqual([
      '/nft/ape-01.webp',
      '/nft/ape-02.webp',
      '/nft/ape-03.webp',
      '/nft/ape-04.webp',
    ])
    expect(found.body.images[0]).toBe(found.body.imageUrl)
  })

  test('detail: fase-4 fields — ratingAvg is a 1-decimal string, ratingCount a number, attributes 3 PT strings', async ({
    page,
  }) => {
    await bootReset(page)
    const found = await apiFetch(page, '/api/nfts/nft-001')
    expect(found.status).toBe(200)
    expect(found.body.ratingAvg).toMatch(/^\d\.\d$/)
    expect(typeof found.body.ratingCount).toBe('number')
    expect(found.body.attributes).toHaveLength(3)
    for (const attr of found.body.attributes) expect(typeof attr).toBe('string')
  })
})

test.describe('Auth', () => {
  test('login: wrong password → invalid_credentials; correct → session cookie survives reload', async ({
    page,
  }) => {
    await bootReset(page)

    const bad = await apiFetch(page, '/api/auth/login', {
      method: 'POST',
      body: { email: ANA.email, password: 'wrong-password' },
    })
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('invalid_credentials')

    const ok = await apiFetch(page, '/api/auth/login', { method: 'POST', body: ANA })
    expect(ok.status).toBe(200)
    expect(ok.body.user.email).toBe(ANA.email)

    await page.reload()
    await awaitMswReady(page)
    const session = await apiFetch(page, '/api/auth/session')
    expect(session.status).toBe(200)
    expect(session.body.user.email).toBe(ANA.email)
  })

  test('register: known email → 409 email_taken; new email → 201 with an active session', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')

    const taken = await apiFetch(page, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Ana Duplicada', email: ANA.email, password: 'whatever1' },
    })
    expect(taken.status).toBe(409)
    expect(taken.body.error.code).toBe('email_taken')

    const created = await apiFetch(page, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Nova Pessoa', email: 'nova@greenmint.dev', password: 'whatever1' },
    })
    expect(created.status).toBe(201)

    const session = await apiFetch(page, '/api/auth/session')
    expect(session.status).toBe(200)
    expect(session.body.user.email).toBe('nova@greenmint.dev')
  })
})

test.describe('Authorization', () => {
  test('protected routes return 401 unauthorized without a session', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    const routes: Array<[string, string?]> = [
      ['/api/favorites', 'GET'],
      ['/api/profile', 'GET'],
      ['/api/wallets', 'GET'],
    ]
    for (const [url, method] of routes) {
      const res = await apiFetch(page, url, { method })
      expect(res.status, url).toBe(401)
      expect(res.body.error.code, url).toBe('unauthorized')
    }
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'anon' },
      body: {},
    })
    expect(order.status).toBe(401)
    expect(order.body.error.code).toBe('unauthorized')
  })

  test('edge case: cookie present but token unknown after reset → 401 unauthorized, no crash', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    const before = await apiFetch(page, '/api/auth/session')
    expect(before.status).toBe(200)

    await reset(page) // wipes db.sessions; browser still holds the gm_session cookie

    const after = await apiFetch(page, '/api/auth/session')
    expect(after.status).toBe(401)
    expect(after.body.error.code).toBe('unauthorized')
  })
})

test.describe('Favorites', () => {
  test('add/remove is idempotent-shaped and persists across reload', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)

    const added = await apiFetch(page, '/api/favorites/nft-005', { method: 'PUT' })
    expect(added.status).toBe(200)
    expect(added.body.nftIds).toContain('nft-005')

    await page.reload()
    await awaitMswReady(page)
    const afterReload = await apiFetch(page, '/api/favorites')
    expect(afterReload.body.nftIds).toContain('nft-005')

    const removed = await apiFetch(page, '/api/favorites/nft-005', { method: 'DELETE' })
    expect(removed.status).toBe(200)
    expect(removed.body.nftIds).not.toContain('nft-005')
  })
})

test.describe('Cart', () => {
  test('guest cart works without login and a fresh context starts empty', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    const add = await addToCart(page, 'nft-017', 'nft-017-e1', 2)
    expect(add.status).toBe(200)
    const cart = await apiFetch(page, '/api/cart')
    expect(cart.body.items).toHaveLength(1)
    expect(cart.body.items[0]).toMatchObject({ nftId: 'nft-017', quantity: 2 })
  })

  test('fresh browser context has an empty guest cart', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await boot(page)
    const cart = await apiFetch(page, '/api/cart')
    expect(cart.body.items).toEqual([])
    await context.close()
  })

  test('guest→user merge caps at current availability on login', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    // nft-017 has no fixture presence in Ana's cart, so this is a pure addition.
    await addToCart(page, 'nft-017', 'nft-017-e1', 1)
    await login(page, ANA)
    const cart = await apiFetch(page, '/api/cart')
    // Ana's 2 fixture lines (nft-003/e1, nft-007/e1) plus the merged guest line.
    expect(cart.body.items).toHaveLength(3)
    const merged = cart.body.items.find((i: { nftId: string }) => i.nftId === 'nft-017')
    expect(merged).toMatchObject({ quantity: 1 })
  })

  test('adding beyond availability returns 409 with details.available', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    // nft-007-e1 has a fixture-wide availability override of 2.
    const res = await addToCart(page, 'nft-007', 'nft-007-e1', 5)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('availability_conflict')
    expect(res.body.error.details.available).toBe('2')
  })

  test('two editions of the same NFT are two distinct cart lines', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await addToCart(page, 'nft-004', 'nft-004-e1', 1)
    await addToCart(page, 'nft-004', 'nft-004-e2', 1)
    const cart = await apiFetch(page, '/api/cart')
    const lines = cart.body.items.filter((i: { nftId: string }) => i.nftId === 'nft-004')
    expect(lines).toHaveLength(2)
    expect(new Set(lines.map((l: { editionId: string }) => l.editionId)).size).toBe(2)
  })

  test('edge case: PATCH on a line whose edition sold out elsewhere returns 409 with current available', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')

    // Ana keeps a cart line on nft-021-e1 (fixture-wide available: 1), but
    // never buys it.
    await login(page, ANA)
    const addAna = await addToCart(page, 'nft-021', 'nft-021-e1', 1)
    const anaItemId = addAna.body.items.find((i: { nftId: string }) => i.nftId === 'nft-021').id
    await logout(page)

    // Bruno buys the last unit, depleting the edition to 0 — via the same
    // cookie jar, sequentially, so no second browser context is needed.
    await login(page, BRUNO)
    await addToCart(page, 'nft-021', 'nft-021-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'deplete-nft-021' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Bruno Chain', email: BRUNO.email },
      },
    })
    expect(order.status).toBe(201)
    await logout(page)

    await login(page, ANA)
    const patch = await apiFetch(page, `/api/cart/items/${anaItemId}`, {
      method: 'PATCH',
      body: { quantity: 1 },
    })
    expect(patch.status).toBe(409)
    expect(patch.body.error.code).toBe('availability_conflict')
    expect(patch.body.error.details.available).toBe('0')
  })
})

test.describe('Quote', () => {
  test('GREEN10 discount is exactly 10% of subtotal (big.js, no float drift)', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    // Ana's fixture cart: nft-003/e1 x1 @ "0.03" + nft-007/e1 x2 @ "0.25" = "0.53"
    const res = await apiFetch(page, '/api/quote', {
      method: 'POST',
      body: { couponCode: 'GREEN10', network: 'ethereum' },
    })
    expect(res.status).toBe(200)
    expect(res.body.subtotalEth).toBe('0.53')
    expect(res.body.discountEth).toBe('0.053')
    expect(res.body.networkFeeEth).toBe('0.0025')
    expect(res.body.totalEth).toBe('0.4795')
    expect(res.body.coupon).toMatchObject({ code: 'GREEN10', percentOff: 10 })
  })

  test('expired coupon → 400 coupon_expired; unknown coupon → 400 coupon_invalid', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    const expired = await apiFetch(page, '/api/quote', {
      method: 'POST',
      body: { couponCode: 'EXPIRED20' },
    })
    expect(expired.status).toBe(400)
    expect(expired.body.error.code).toBe('coupon_expired')

    const unknown = await apiFetch(page, '/api/quote', {
      method: 'POST',
      body: { couponCode: 'NOPE' },
    })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.code).toBe('coupon_invalid')
  })

  test('empty cart → 400 validation_error', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await login(page, BRUNO) // Bruno's fixture cart is empty
    const res = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_error')
  })

  test('edge case: order uses the quote snapshot, not a cart later edited', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const cart = await apiFetch(page, '/api/cart')
    const line = cart.body.items[0]

    // Remove the item from the cart after quoting it.
    await apiFetch(page, `/api/cart/items/${line.id}`, { method: 'DELETE' })

    const wallets = await apiFetch(page, '/api/wallets')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'snapshot-vs-cart' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(201)
    expect(order.body.items.some((i: { nftId: string }) => i.nftId === line.nftId)).toBe(true)
  })

  test('network: solana is accepted and priced with NETWORK_FEES.solana; wallet and order schemas accept it too', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)

    // Ana's fixture cart already has lines; quoting under solana swaps in the
    // solana fee instead of the ethereum default (spec §3: 3 networks now).
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: { network: 'solana' } })
    expect(quote.status).toBe(200)
    expect(quote.body.networkFeeEth).toBe('0.0001')
    expect(quote.body.network).toBe('solana')

    // Wallet schema: 'solana' is a valid enum value, not a validation_error.
    // No solana wallet ships in the fixtures on purpose (out of scope, spec
    // §3) — this one is created fresh, just for this test.
    const wallet = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Carteira Solana',
        address: '0x222222222222222222222222222222222222222b',
        network: 'solana',
        type: 'metamask',
        role: 'secondary',
      },
    })
    expect(wallet.status).toBe(201)
    expect(wallet.body.network).toBe('solana')

    // Order schema: 'solana' goes all the way through to a confirmed order.
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'solana-order-1' },
      body: {
        quoteId: quote.body.id,
        walletId: wallet.body.id,
        network: 'solana',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status, JSON.stringify(order.body)).toBe(201)
    expect(order.body.network).toBe('solana')
  })
})

test.describe('Orders: idempotency and side effects', () => {
  test('missing Idempotency-Key → 400; replay same key+body → same order; same key+different body → 409', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    const beforeNft = await apiFetch(page, '/api/nfts/nft-003')
    const beforeAvailable = beforeNft.body.editions[0].available
    const beforeVersion = beforeNft.body.version

    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const walletId = wallets.body.find((w: { role: string }) => w.role === 'primary').id

    const noHeader = await apiFetch(page, '/api/orders', {
      method: 'POST',
      body: { quoteId: quote.body.id, walletId, network: 'ethereum', payer: { name: 'Ana Volt', email: ANA.email } },
    })
    expect(noHeader.status).toBe(400)
    expect(noHeader.body.error.code).toBe('validation_error')

    const bodyV1 = {
      quoteId: quote.body.id,
      walletId,
      network: 'ethereum',
      payer: { name: 'Ana Volt', email: ANA.email },
    }
    const created = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k1' },
      body: bodyV1,
    })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('pending')
    const orderId = created.body.id

    const replay = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k1' },
      body: bodyV1,
    })
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(orderId)

    const conflict = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k1' },
      body: { ...bodyV1, payer: { name: 'Someone Else', email: ANA.email } },
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('idempotency_conflict')

    // Side effects happened exactly once (not twice, thanks to the replay).
    const afterNft = await apiFetch(page, '/api/nfts/nft-003')
    expect(afterNft.body.editions[0].available).toBe(beforeAvailable - 1)
    expect(afterNft.body.version).toBe(beforeVersion + 1)

    const cart = await apiFetch(page, '/api/cart')
    expect(cart.body.items.some((i: { nftId: string }) => i.nftId === 'nft-003')).toBe(false)
  })

  test('GET /api/orders/:id resolves pending → confirmed after 1500ms with txHash and version 2', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const created = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'resolve-1' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(created.body.status).toBe('pending')

    const immediate = await apiFetch(page, `/api/orders/${created.body.id}`)
    expect(immediate.body.status).toBe('pending')

    await page.waitForTimeout(1700)

    const resolved = await apiFetch(page, `/api/orders/${created.body.id}`)
    expect(resolved.body.status).toBe('confirmed')
    expect(resolved.body.version).toBe(2)
    expect(typeof resolved.body.txHash).toBe('string')
    expect(resolved.body.txHash.length).toBeGreaterThan(0)
  })

  test('a pedido from another user returns 403 forbidden', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await login(page, BRUNO)
    const res = await apiFetch(page, '/api/orders/ord_seed_1') // belongs to Ana
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('forbidden')
  })

  test('edge case: idempotency replay after confirmation returns the confirmed order, not a fresh pending one', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const body = {
      quoteId: quote.body.id,
      walletId: wallets.body[0].id,
      network: 'ethereum',
      payer: { name: 'Ana Volt', email: ANA.email },
    }
    const created = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'replay-after-confirm' },
      body,
    })
    expect(created.body.status).toBe('pending')

    await page.waitForTimeout(1700)
    const confirmed = await apiFetch(page, `/api/orders/${created.body.id}`)
    expect(confirmed.body.status).toBe('confirmed')

    const replay = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'replay-after-confirm' },
      body,
    })
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(created.body.id)
    expect(replay.body.status).toBe('confirmed')
    expect(replay.body.txHash).toBe(confirmed.body.txHash)
  })

  test('snapshot immutability: a later catalogue price change does not alter a resolved order', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    // Clear Ana's fixture cart lines so this quote covers only nft-010,
    // keeping the expected totals below exact and easy to verify.
    await clearCart(page)

    await addToCart(page, 'nft-010', 'nft-010-e1', 1)
    const quoteA = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const orderA = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'snap-a' },
      body: {
        quoteId: quoteA.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(orderA.status).toBe(201)
    expect(orderA.body.subtotalEth).toBe('1.2')

    await page.waitForTimeout(1700)
    const confirmedA = await apiFetch(page, `/api/orders/${orderA.body.id}`)
    expect(confirmedA.body.status).toBe('confirmed')

    // Trigger a real catalogue price change on the same NFT via a second
    // (failed) order attempt under the price-changed scenario.
    await addToCart(page, 'nft-010', 'nft-010-e1', 1)
    const quoteB = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    await setScenario(page, 'price-changed')
    const orderB = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'snap-b' },
      body: {
        quoteId: quoteB.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(orderB.status).toBe(409)
    expect(orderB.body.error.code).toBe('quote_outdated')
    await setScenario(page, 'default')

    const nftAfter = await apiFetch(page, '/api/nfts/nft-010')
    expect(nftAfter.body.editions[0].priceEth).toBe('1.32') // +10%

    const orderAAfter = await apiFetch(page, `/api/orders/${orderA.body.id}`)
    expect(orderAAfter.body.items[0].unitPriceEth).toBe('1.2')
    expect(orderAAfter.body.subtotalEth).toBe('1.2')
    expect(orderAAfter.body.totalEth).toBe('1.2025')
  })
})

test.describe('Scenarios', () => {
  test('server-error: every route 500s, and reverting to default restores 200', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await setScenario(page, 'server-error')
    const broken = await apiFetch(page, '/api/nfts')
    expect(broken.status).toBe(500)
    expect(broken.body.error.code).toBe('transient')

    await setScenario(page, 'default')
    const ok = await apiFetch(page, '/api/nfts')
    expect(ok.status).toBe(200)
  })

  test('offline: /api/* fetches reject as a network error, but /api/health still answers', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await setScenario(page, 'offline')

    const failed = await page.evaluate(async () => {
      try {
        await fetch('/api/nfts')
        return false
      } catch {
        return true
      }
    })
    expect(failed).toBe(true)

    const health = await apiFetch(page, '/api/health')
    expect(health.status).toBe(200)
    expect(health.body.status).toBe('ok')
  })

  test('flaky: first call 503s, retry succeeds; resetting the scenario resets the counter', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await setScenario(page, 'flaky')

    const first = await apiFetch(page, '/api/nfts')
    expect(first.status).toBe(503)
    const second = await apiFetch(page, '/api/nfts')
    expect(second.status).toBe(200)

    // Edge case: re-selecting the scenario mid-session zeroes its counters.
    await setScenario(page, 'flaky')
    const afterReselect = await apiFetch(page, '/api/nfts')
    expect(afterReselect.status).toBe(503)
  })

  test('session-expired: an active session starts failing session checks', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    await setScenario(page, 'session-expired')
    const res = await apiFetch(page, '/api/auth/session')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('session_expired')
  })

  test('register-conflict: register always 409s regardless of email', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await setScenario(page, 'register-conflict')
    const res = await apiFetch(page, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Alguém', email: 'nunca-visto@greenmint.dev', password: 'whatever1' },
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('email_taken')
  })

  test('sold-out: order fails with availability_conflict and catalogue reflects 0 available', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    // The sold-out hook zeroes the *first* item of the quote — clear Ana's
    // fixture cart lines first so nft-011 is unambiguously that item.
    await clearCart(page)
    await addToCart(page, 'nft-011', 'nft-011-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    await setScenario(page, 'sold-out')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'sold-out-1' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(409)
    expect(order.body.error.code).toBe('availability_conflict')

    const nft = await apiFetch(page, '/api/nfts/nft-011')
    expect(nft.body.editions[0].available).toBe(0)
  })

  test('order-timeout: first attempt errors as network failure, replay recovers the persisted order', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    await addToCart(page, 'nft-014', 'nft-014-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const body = {
      quoteId: quote.body.id,
      walletId: wallets.body[0].id,
      network: 'ethereum',
      payer: { name: 'Ana Volt', email: ANA.email },
    }

    await setScenario(page, 'order-timeout')
    const firstFailed = await page.evaluate(async (body) => {
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'k2' },
          body: JSON.stringify(body),
        })
        return false
      } catch {
        return true
      }
    }, body)
    expect(firstFailed).toBe(true)

    const replay = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k2' },
      body,
    })
    expect(replay.status).toBe(200)
    expect(replay.body.status).toBe('pending')

    const cart = await apiFetch(page, '/api/cart')
    expect(cart.body.items.some((i: { nftId: string }) => i.nftId === 'nft-014')).toBe(false)

    const nft = await apiFetch(page, '/api/nfts/nft-014')
    expect(nft.body.editions[0].available).toBe(9) // decremented exactly once
  })

  test('payment-declined: order resolves to declined with a reason, never confirmed', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    await addToCart(page, 'nft-015', 'nft-015-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    await setScenario(page, 'payment-declined')
    const created = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'declined-1' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(created.body.status).toBe('pending')

    await page.waitForTimeout(1700)
    const resolved = await apiFetch(page, `/api/orders/${created.body.id}`)
    expect(resolved.body.status).toBe('declined')
    expect(typeof resolved.body.declineReason).toBe('string')
    expect(resolved.body.txHash).toBeUndefined()
  })

  test('boot query param ?mock-scenario=slow activates the scenario, visible via /api/health', async ({
    page,
  }) => {
    await boot(page, '?mock-scenario=slow')
    const health = await apiFetch(page, '/api/health')
    expect(health.body.scenario).toBe('slow')
  })

  test('reset (window.__mocks.reset() and ?mock-reset=1) restores the exact fixture state', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    // Mutate: buy nft-001-e1 (decrements availability + bumps version) and
    // add a favorite that isn't in the fixtures.
    await addToCart(page, 'nft-001', 'nft-001-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'reset-check-1' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    await apiFetch(page, '/api/favorites/nft-006', { method: 'PUT' })

    const mutatedNft = await apiFetch(page, '/api/nfts/nft-001')
    expect(mutatedNft.body.editions[0].available).toBe(9)

    await page.evaluate(() => window.__mocks!.reset())

    const nftAfterReset = await apiFetch(page, '/api/nfts/nft-001')
    expect(nftAfterReset.body.editions[0].available).toBe(10)
    // Session was wiped by reset too — log back in to check Ana's own data.
    await login(page, ANA)
    const favorites = await apiFetch(page, '/api/favorites')
    expect(favorites.body.nftIds.sort()).toEqual(['nft-002', 'nft-007', 'nft-021'])
    const cart = await apiFetch(page, '/api/cart')
    expect(cart.body.items).toHaveLength(2)

    // Mutate again, this time restore via the query-param form.
    await apiFetch(page, '/api/favorites/nft-006', { method: 'PUT' })
    await page.goto('/?mock-reset=1')
    await awaitMswReady(page)
    await login(page, ANA)
    const favoritesAfterQueryReset = await apiFetch(page, '/api/favorites')
    expect(favoritesAfterQueryReset.body.nftIds).not.toContain('nft-006')
  })
})

/**
 * Fix Plan (iteration 2) — regression suite for the [major] finding in
 * review.md: `NftSummary.priceEth`/`available` (the top-level fields on both
 * `GET /api/nfts` items and the top of `GET /api/nfts/:id`) were computed
 * once at seed time and never recomputed after an edition mutation, so they
 * went stale after the very first purchase/scenario. Every test below
 * deliberately asserts on the TOP-LEVEL fields, not `editions[0].*` — that
 * was the blind spot that let the bug through 114 previously-green tests.
 * Distinct NFTs are used per test (never reusing nft-011/nft-010, which the
 * pre-existing Scenarios/Orders tests already mutate) purely so this block
 * has no ordering dependency on the rest of the file; `bootReset()` at the
 * top of every test already makes that unnecessary, but it costs nothing to
 * also avoid stepping on the same fixture data.
 */
test.describe('Fix Plan (iteration 2): NftSummary derived fields stay coherent', () => {
  async function findSummary(page: Page, nftId: string) {
    const list = await apiFetch(page, '/api/nfts?perPage=48')
    expect(list.status).toBe(200)
    const item = list.body.items.find((i: { id: string }) => i.id === nftId)
    expect(item, `expected ${nftId} in the catalogue`).toBeTruthy()
    return item
  }

  test('seed remains unchanged: fresh reset top-level fields match the known fixture values, SEED_VERSION is 6', async ({
    page,
  }) => {
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    // nft-001 is untouched by any scenario/purchase in this suite's fixtures.
    expect(detail.body.available).toBe(10)
    expect(detail.body.priceEth).toBe('0.008')
    expect(detail.body.version).toBe(1)

    const dump = await page.evaluate(() => localStorage.getItem('greenmint:db:v1'))
    const dbDump = JSON.parse(dump!)
    // Fase 2 (spec §3): fixtures reconciled with the 9-category/3-network
    // design system, SEED_VERSION bumped from 1 to 2. Fase 3 bumps it again
    // to 3 (network field added to the NFT model, specs/03-catalogo.md
    // resolução OQ3). Fase 4 bumps it again to 4 (images 3->4, ratingAvg/
    // ratingCount/attributes added, specs/04-detalhe-nft.md §1) — the spec's
    // own "mapa de impacto" claim that no test asserts `seedVersion` missed
    // this one; updated, not deleted (same precedent as the fase-2/3
    // fixture test updates). Fase 4, ciclo de correção (review item 1,
    // opção A): bumps once more to 5 — `editions[].label` passa a ser
    // gerado de `totalSupply` (`1/{totalSupply}`/`ABERTA`) em vez do nome
    // fantasia "Standard"/"Deluxe" (ARCHITECTURE.md fase 4 decisão 17). Fase 8
    // bumps para 6: `username`/`ensName` no usuário e `type`/`referralCode` na
    // carteira (spec 08 §2.4 e §3.5) — sem o bump, um localStorage da fase
    // anterior serviria perfil sem esses campos.
    expect(dbDump.seedVersion).toBe(6)
  })

  test('sold-out: top-level `available` (not just editions[0]) drops to 0 on both detail and list, and never contradicts editions', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    await clearCart(page)
    await addToCart(page, 'nft-011', 'nft-011-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    await setScenario(page, 'sold-out')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fixplan-sold-out' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(409)
    await setScenario(page, 'default')

    const detail = await apiFetch(page, '/api/nfts/nft-011')
    const editionsSum = detail.body.editions.reduce((sum: number, e: { available: number }) => sum + e.available, 0)
    expect(detail.body.available).toBe(0) // top-level, criterion 20 as written
    expect(detail.body.available).toBe(editionsSum) // detail top never contradicts its own editions
    expect(detail.body.editions[0].available).toBe(0)

    const summary = await findSummary(page, 'nft-011')
    expect(summary.available).toBe(0) // list summary agrees with detail
    expect(summary.priceEth).toBe(detail.body.priceEth)
  })

  test('price-changed: top-level `priceEth` (not just editions[0]) reflects the new minimum on both detail and list', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    await clearCart(page)
    await addToCart(page, 'nft-015', 'nft-015-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const before = await apiFetch(page, '/api/nfts/nft-015')
    expect(before.body.priceEth).toBe('0.03')

    await setScenario(page, 'price-changed')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fixplan-price-changed' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(409)
    expect(order.body.error.code).toBe('quote_outdated')
    await setScenario(page, 'default')

    const detail = await apiFetch(page, '/api/nfts/nft-015')
    expect(detail.body.priceEth).toBe('0.033') // +10% via roundEth, exact string
    expect(detail.body.priceEth).toBe(detail.body.editions[0].priceEth) // top never contradicts editions
    expect(detail.body.version).toBeGreaterThan(before.body.version)

    const summary = await findSummary(page, 'nft-015')
    expect(summary.priceEth).toBe('0.033')
  })

  test('successful purchase decrements the top-level `available` on both detail and list, not only the edition', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    await clearCart(page)
    await addToCart(page, 'nft-017', 'nft-017-e1', 3)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fixplan-purchase' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(201)

    const detail = await apiFetch(page, '/api/nfts/nft-017')
    expect(detail.body.available).toBe(7) // 10 - 3, at the top level
    expect(detail.body.priceEth).toBe('0.08') // unaffected, still the seed price

    const summary = await findSummary(page, 'nft-017')
    expect(summary.available).toBe(7)
  })

  test('recomputes the minimum across multiple editions: zeroing the cheaper Standard edition promotes the Deluxe price to the top', async ({
    page,
  }) => {
    await bootReset(page)
    // nft-004 has Standard e1 @ '0.05' (10 units) and Deluxe e2 @ '0.1' (3 units).
    const before = await apiFetch(page, '/api/nfts/nft-004')
    expect(before.body.priceEth).toBe('0.05')
    expect(before.body.available).toBe(13)

    await login(page, ANA)
    await clearCart(page)
    await addToCart(page, 'nft-004', 'nft-004-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    await setScenario(page, 'sold-out') // zeroes the quote's first item: nft-004-e1
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fixplan-multi-edition' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(409)
    await setScenario(page, 'default')

    const detail = await apiFetch(page, '/api/nfts/nft-004')
    expect(detail.body.editions[0].available).toBe(0) // Standard is gone
    expect(detail.body.editions[1].available).toBe(3) // Deluxe untouched
    expect(detail.body.priceEth).toBe('0.1') // top-level min now the Deluxe price
    expect(detail.body.available).toBe(3) // top-level sum, not the stale 13
  })

  test('the price filter operates on the freshly-recomputed value: ?priceMin=13 returns 0 items pre-mutation, exactly nft-012 post-mutation', async ({
    page,
  }) => {
    await bootReset(page)
    const before = await apiFetch(page, '/api/nfts?priceMin=13')
    expect(before.body.total).toBe(0)
    expect(before.body.items).toHaveLength(0)

    await login(page, ANA)
    await clearCart(page)
    // nft-012-e1 (Standard) is '12.5'; the Deluxe e2 is '25' but has only 3
    // units and isn't touched by the sold-out/price-changed hooks here.
    await addToCart(page, 'nft-012', 'nft-012-e1', 1)
    const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
    const wallets = await apiFetch(page, '/api/wallets')
    await setScenario(page, 'price-changed')
    const order = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fixplan-price-filter' },
      body: {
        quoteId: quote.body.id,
        walletId: wallets.body[0].id,
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(order.status).toBe(409)
    await setScenario(page, 'default')

    const detail = await apiFetch(page, '/api/nfts/nft-012')
    expect(detail.body.priceEth).toBe('13.75') // 12.5 * 1.1, exact via roundEth

    const after = await apiFetch(page, '/api/nfts?priceMin=13')
    expect(after.body.total).toBe(1)
    expect(after.body.items).toHaveLength(1)
    expect(after.body.items[0].id).toBe('nft-012')
    expect(after.body.items[0].priceEth).toBe('13.75')
  })

  test('guest→user cart merge drops a line capped to 0 by an edition that sold out while it sat in the guest cart', async ({
    page,
  }) => {
    await bootReset(page)
    // Guest adds while nft-022-e1 still has stock (available: 10).
    const guestAdd = await addToCart(page, 'nft-022', 'nft-022-e1', 2)
    expect(guestAdd.status).toBe(200)

    // Simulate the edition selling out via another concurrent actor: mutate
    // the persisted db directly (same technique as the "stale seedVersion"
    // test above) and reload so hydrateDb() picks it up — this is the only
    // way to model a concurrent depletion against a client-only mock db,
    // without going through this same page's guest session (which would
    // consume/merge the guest cart the moment it logs in).
    await page.evaluate(() => {
      const raw = localStorage.getItem('greenmint:db:v1')
      const dbDump = JSON.parse(raw!)
      const nft = dbDump.nfts.find((n: { id: string }) => n.id === 'nft-022')
      nft.editions[0].available = 0
      nft.available = nft.editions.reduce((sum: number, e: { available: number }) => sum + e.available, 0)
      nft.priceEth = nft.editions[0].priceEth
      nft.version += 1
      localStorage.setItem('greenmint:db:v1', JSON.stringify(dbDump))
    })
    await page.reload()
    await awaitMswReady(page)

    const depleted = await apiFetch(page, '/api/nfts/nft-022')
    expect(depleted.body.available).toBe(0)

    // Now the guest logs in: the merge must cap the nft-022 line to 0 and
    // then drop it, not persist a quantity: 0 row.
    await login(page, ANA)
    const cart = await apiFetch(page, '/api/cart')
    const zeroRow = cart.body.items.find((i: { nftId: string }) => i.nftId === 'nft-022')
    expect(zeroRow).toBeUndefined()
    // Ana's own pre-existing fixture lines were not lost by the merge.
    expect(cart.body.items.map((i: { nftId: string }) => i.nftId).sort()).toEqual(['nft-003', 'nft-007'])
  })
})

/**
 * Consolidated from `e2e/nft-catalog-session-integrity.spec.ts` (deleted,
 * fase 2 E2E consolidation, spec §6): long-session/localStorage/reset/
 * pagination coherence checks that don't fit any single mutation kind above.
 * `purchase` and `assertCoherent` stay local to this file (module scope, not
 * exported from `./helpers`) — they're specific to this coherence-testing
 * section, shared across its 4 `describe` blocks below.
 */

/** Adds a single NFT/edition to a clean cart, quotes it, and submits an order. */
async function purchase(
  page: Page,
  nftId: string,
  editionId: string,
  quantity: number,
  idempotencyKey: string,
) {
  await clearCart(page)
  const add = await apiFetch(page, '/api/cart/items', {
    method: 'POST',
    body: { nftId, editionId, quantity },
  })
  expect(add.status, JSON.stringify(add.body)).toBe(200)
  const quote = await apiFetch(page, '/api/quote', { method: 'POST', body: {} })
  expect(quote.status, JSON.stringify(quote.body)).toBe(200)
  const wallets = await apiFetch(page, '/api/wallets')
  return apiFetch(page, '/api/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      quoteId: quote.body.id,
      walletId: wallets.body[0].id,
      network: 'ethereum',
      payer: { name: 'Ana Volt', email: ANA.email },
    },
  })
}

/** Fetches detail + the matching list summary and asserts they never contradict. */
async function assertCoherent(page: Page, nftId: string) {
  const detail = await apiFetch(page, `/api/nfts/${nftId}`)
  expect(detail.status, `detail fetch for ${nftId}`).toBe(200)
  const editionsSum = detail.body.editions.reduce((sum: number, e: { available: number }) => sum + e.available, 0)
  expect(detail.body.available, `${nftId} detail top-level available vs its own editions sum`).toBe(editionsSum)

  const list = await apiFetch(page, '/api/nfts?perPage=48')
  const summary = list.body.items.find((i: { id: string }) => i.id === nftId)
  expect(summary, `${nftId} missing from catalogue`).toBeTruthy()

  expect(summary.available, `${nftId} list summary vs detail: available`).toBe(detail.body.available)
  expect(summary.priceEth, `${nftId} list summary vs detail: priceEth`).toBe(detail.body.priceEth)
  expect(summary.version, `${nftId} list summary vs detail: version`).toBe(detail.body.version)

  return { available: detail.body.available, priceEth: detail.body.priceEth, version: detail.body.version }
}

test.describe('Long-session coherence across multiple NFTs, mutations and reloads', () => {
  test('purchases + sold-out + price-changed, interleaved with reloads, never leave any touched NFT self-contradicting', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    // Step 1: plain purchase on nft-005 (single edition, untouched by fixtures).
    const buy1 = await purchase(page, 'nft-005', 'nft-005-e1', 2, 'session-buy-005-a')
    expect(buy1.status, JSON.stringify(buy1.body)).toBe(201)
    await page.reload()
    await awaitMswReady(page)
    const s1 = await assertCoherent(page, 'nft-005')
    expect(s1.available).toBe(8) // 10 - 2

    // Step 2: sold-out scenario on a different NFT (nft-006).
    await login(page, ANA) // reload dropped in-page JS state, but session cookie survives; re-login is a no-op 200
    await setScenario(page, 'sold-out')
    const soldOut = await purchase(page, 'nft-006', 'nft-006-e1', 1, 'session-soldout-006')
    expect(soldOut.status).toBe(409)
    await setScenario(page, 'default')
    await page.reload()
    await awaitMswReady(page)
    // Both NFTs touched so far must independently still be coherent.
    const s2a = await assertCoherent(page, 'nft-005')
    expect(s2a.available).toBe(8) // untouched by step 2, must not have drifted
    const s2b = await assertCoherent(page, 'nft-006')
    expect(s2b.available).toBe(0)

    // Step 3: price-changed scenario on yet another NFT (nft-009).
    await login(page, ANA)
    await setScenario(page, 'price-changed')
    const priceChanged = await purchase(page, 'nft-009', 'nft-009-e1', 1, 'session-pricechanged-009')
    expect(priceChanged.status).toBe(409)
    await setScenario(page, 'default')
    // No reload this time: check the in-memory-then-persisted state right away too.
    const s3a = await assertCoherent(page, 'nft-005')
    const s3b = await assertCoherent(page, 'nft-006')
    const s3c = await assertCoherent(page, 'nft-009')
    expect(s3a.available).toBe(8)
    expect(s3b.available).toBe(0)
    expect(s3c.priceEth).toBe('0.825') // 0.75 * 1.1 via roundEth

    // Step 4: a second, compounding purchase on the NFT touched in step 1.
    await login(page, ANA)
    const buy2 = await purchase(page, 'nft-005', 'nft-005-e1', 3, 'session-buy-005-b')
    expect(buy2.status, JSON.stringify(buy2.body)).toBe(201)
    await page.reload()
    await awaitMswReady(page)

    // Final checkpoint: all three NFTs touched across the whole session are
    // still each internally coherent AND correctly reflect every mutation
    // that was applied to them specifically (no cross-talk between refreshes).
    const final5 = await assertCoherent(page, 'nft-005')
    const final6 = await assertCoherent(page, 'nft-006')
    const final9 = await assertCoherent(page, 'nft-009')
    expect(final5.available).toBe(5) // 10 - 2 - 3
    expect(final6.available).toBe(0) // still sold out
    expect(final9.priceEth).toBe('0.825') // still the raised price, no further change applied
    expect(final9.available).toBe(10) // sold-out/price-changed hooks mutate but the order itself was rejected (409)
  })
})

test.describe('Persistence of derived fields in localStorage', () => {
  test('the raw persisted db blob (not just the live API response) carries the recomputed top-level fields after a mutation and a reload', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    const buy = await purchase(page, 'nft-019', 'nft-019-e1', 4, 'persist-check-019')
    expect(buy.status, JSON.stringify(buy.body)).toBe(201)

    // Inspect the actual localStorage JSON directly, bypassing the API, to
    // rule out a regression where refreshNftDerived() runs correctly at
    // mutation time but the write to storage races or is skipped.
    const rawBefore = await page.evaluate(() => localStorage.getItem('greenmint:db:v1'))
    const dbBefore = JSON.parse(rawBefore!)
    const nftBefore = dbBefore.nfts.find((n: { id: string }) => n.id === 'nft-019')
    expect(nftBefore.available).toBe(6) // 10 - 4, persisted top-level field
    expect(nftBefore.available).toBe(
      nftBefore.editions.reduce((sum: number, e: { available: number }) => sum + e.available, 0),
    )

    // Reload: hydrateDb() re-parses this exact blob. If the recompute only
    // ever happened transiently in-memory, this would resurface the seed's
    // stale `available: 10` after rehydration.
    await page.reload()
    await awaitMswReady(page)
    const detail = await apiFetch(page, '/api/nfts/nft-019')
    expect(detail.body.available).toBe(6)

    // And the blob written back out after rehydration+persist must still
    // agree — no drift introduced by a rehydrate/persist round-trip.
    const rawAfter = await page.evaluate(() => localStorage.getItem('greenmint:db:v1'))
    const dbAfter = JSON.parse(rawAfter!)
    const nftAfter = dbAfter.nfts.find((n: { id: string }) => n.id === 'nft-019')
    expect(nftAfter.available).toBe(6)
    expect(nftAfter.priceEth).toBe(nftBefore.priceEth)
  })
})

test.describe('Reset after a heavy multi-mutation session', () => {
  test('?mock-reset=1 restores the exact seed values for every previously-touched NFT, not just an untouched one', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    const buy = await purchase(page, 'nft-025', 'nft-025-e1', 5, 'reset-check-buy-025')
    expect(buy.status).toBe(201)

    await setScenario(page, 'sold-out')
    const soldOut = await purchase(page, 'nft-030', 'nft-030-e1', 1, 'reset-check-soldout-030')
    expect(soldOut.status).toBe(409)

    await setScenario(page, 'price-changed')
    const priceChanged = await purchase(page, 'nft-006', 'nft-006-e1', 1, 'reset-check-pricechanged-006')
    expect(priceChanged.status).toBe(409)
    await setScenario(page, 'default')

    // Sanity: the session really did mutate all three before resetting.
    const beforeReset025 = await apiFetch(page, '/api/nfts/nft-025')
    const beforeReset030 = await apiFetch(page, '/api/nfts/nft-030')
    const beforeReset006 = await apiFetch(page, '/api/nfts/nft-006')
    expect(beforeReset025.body.available).toBe(5)
    expect(beforeReset030.body.available).toBe(0)
    expect(beforeReset006.body.priceEth).toBe('0.132')

    await page.goto('/?mock-reset=1')
    await awaitMswReady(page)

    const after025 = await apiFetch(page, '/api/nfts/nft-025')
    const after030 = await apiFetch(page, '/api/nfts/nft-030')
    const after006 = await apiFetch(page, '/api/nfts/nft-006')
    expect(after025.body).toMatchObject({ available: 10, priceEth: '0.008', version: 1 })
    expect(after030.body).toMatchObject({ available: 10, priceEth: '0.12', version: 1 })
    expect(after006.body).toMatchObject({ available: 10, priceEth: '0.12', version: 1 })

    // The summary side of the catalogue agrees too, not just the detail route.
    const list = await apiFetch(page, '/api/nfts?perPage=48')
    for (const [id, expected] of [
      ['nft-025', { available: 10, priceEth: '0.008' }],
      ['nft-030', { available: 10, priceEth: '0.12' }],
      ['nft-006', { available: 10, priceEth: '0.12' }],
    ] as const) {
      const summary = list.body.items.find((i: { id: string }) => i.id === id)
      expect(summary, `${id} in reset catalogue`).toMatchObject(expected)
    }
  })
})

test.describe('Scenario mutations keep the paginated catalogue and price filter globally coherent', () => {
  test('after price-changed and sold-out, the full price-asc listing is still fully sorted with no duplicate/missing NFT and pagination totals are unaffected', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)

    const baseline = await apiFetch(page, '/api/nfts?sort=price-asc&perPage=48')
    expect(baseline.body.total).toBe(48)
    expect(baseline.body.totalPages).toBe(1) // 48 items / perPage 48
    const baselineIds = new Set(baseline.body.items.map((i: { id: string }) => i.id))
    expect(baselineIds.size).toBe(48)

    // price-changed on nft-006 ('0.12' -> '0.132') moves it within the
    // price-asc ordering (it now sits strictly above every remaining
    // '0.12'-priced NFT it used to tie with).
    await setScenario(page, 'price-changed')
    const pc = await purchase(page, 'nft-006', 'nft-006-e1', 1, 'catalog-coherence-pricechanged')
    expect(pc.status).toBe(409)

    // sold-out on nft-030 doesn't change its price, only its availability —
    // it must not disappear from the catalogue or change page counts.
    await setScenario(page, 'sold-out')
    const so = await purchase(page, 'nft-030', 'nft-030-e1', 1, 'catalog-coherence-soldout')
    expect(so.status).toBe(409)
    await setScenario(page, 'default')

    const after = await apiFetch(page, '/api/nfts?sort=price-asc&perPage=48')
    expect(after.body.total).toBe(48) // sold-out item still counted
    expect(after.body.totalPages).toBe(1) // 48 items / perPage 48, unaffected by the mutations
    const afterIds = after.body.items.map((i: { id: string }) => i.id)
    expect(new Set(afterIds).size).toBe(48) // no duplicate
    expect(new Set(afterIds)).toEqual(baselineIds) // no missing/extra item

    // The whole list is genuinely sorted by the freshly-recomputed price,
    // not the stale seed value — checked pairwise across all 48 items via
    // big.js (never `Number()` on an *Eth-named field).
    for (let i = 1; i < after.body.items.length; i++) {
      const prev = after.body.items[i - 1].priceEth
      const curr = after.body.items[i].priceEth
      expect(new Big(curr).gte(prev), `item ${i} out of order vs item ${i - 1}`).toBe(true)
    }
    const mutated = after.body.items.find((i: { id: string }) => i.id === 'nft-006')
    expect(mutated.priceEth).toBe('0.132')

    // Per-page pagination is stable too: fetching all 4 pages individually
    // reconstructs exactly the same 48 ids as the single perPage=48 call.
    const paged: string[] = []
    for (let p = 1; p <= 4; p++) {
      const page_ = await apiFetch(page, `/api/nfts?sort=price-asc&page=${p}&perPage=12`)
      expect(page_.body.items).toHaveLength(12)
      paged.push(...page_.body.items.map((i: { id: string }) => i.id))
    }
    expect(paged).toEqual(afterIds)

    // Combined filter (category + priceMin) reflects the updated price too:
    // nft-006 is category cycle index i=5 -> CATEGORIES[5 % 9] = 'generative'
    // (fase 2: 9-category cycle, was 'gaming' under the old 4-category one).
    const filteredBefore = await apiFetch(page, '/api/nfts?category=generative&priceMax=0.13&perPage=48')
    expect(filteredBefore.body.items.some((i: { id: string }) => i.id === 'nft-006')).toBe(false) // 0.132 > 0.13
    const filteredWide = await apiFetch(page, '/api/nfts?category=generative&priceMax=0.14&perPage=48')
    expect(filteredWide.body.items.some((i: { id: string }) => i.id === 'nft-006')).toBe(true)
  })
})

test.describe('Wallets', () => {
  test('promoting a second wallet to primary demotes the existing primary atomically', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await login(page, BRUNO) // starts with exactly one primary wallet
    const created = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Nova Principal',
        address: '0x111111111111111111111111111111111111111a',
        network: 'ethereum',
        type: 'metamask',
        role: 'primary',
      },
    })
    expect(created.status).toBe(201)

    const wallets = await apiFetch(page, '/api/wallets')
    const primaries = wallets.body.filter((w: { role: string }) => w.role === 'primary')
    expect(primaries).toHaveLength(1)
    expect(primaries[0].id).toBe(created.body.id)
  })

  test('duplicate address for the same user is rejected with 409 conflict', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    await login(page, ANA)
    const wallets = await apiFetch(page, '/api/wallets')
    const dup = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Duplicada',
        address: wallets.body[0].address,
        network: 'ethereum',
        type: 'metamask',
        role: 'secondary',
      },
    })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('conflict')
  })
})

/**
 * Fase 8 (specs/08-perfil-carteiras.md §2.4 e §3.5). O mock ganhou quatro
 * campos e um verbo: `Profile.username`/`ensName`, `Wallet.type`/
 * `referralCode` e `DELETE /api/wallets/:id`. Cada regra nova tem um gate
 * aqui; os dois 409 (username duplicado e última primária) foram forçados a
 * falhar antes de virarem verdes, pela regra do CLAUDE.md.
 */
test.describe('Profile (fase 8)', () => {
  test('username and ensName round-trip through PATCH and GET', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)

    const patched = await apiFetch(page, '/api/profile', {
      method: 'PATCH',
      body: { username: 'ana_volt_2', ensName: 'anavolt2.eth' },
    })
    expect(patched.status, JSON.stringify(patched.body)).toBe(200)
    expect(patched.body).toMatchObject({ username: 'ana_volt_2', ensName: 'anavolt2.eth' })

    const read = await apiFetch(page, '/api/profile')
    expect(read.body).toMatchObject({ username: 'ana_volt_2', ensName: 'anavolt2.eth' })
  })

  test('a username already taken by another user is rejected with 409 and a field-level detail', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, BRUNO)
    const conflict = await apiFetch(page, '/api/profile', {
      method: 'PATCH',
      body: { username: 'anavolt' }, // fixture da Ana
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('conflict')
    // Sem `details.username` a UI não tem como pendurar o erro NO campo, que é
    // o requisito do §4 — o gate cobra o detalhe, não só o status.
    expect(conflict.body.error.details?.username).toBeTruthy()

    const read = await apiFetch(page, '/api/profile')
    expect(read.body.username).toBe('brunochain')
  })

  test('keeping your own username is not a conflict', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)
    const same = await apiFetch(page, '/api/profile', {
      method: 'PATCH',
      body: { username: 'anavolt', name: 'Ana V.' },
    })
    expect(same.status).toBe(200)
    expect(same.body.name).toBe('Ana V.')
  })

  test('email is immutable: a PATCH carrying a new email leaves it untouched', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)
    const patched = await apiFetch(page, '/api/profile', {
      method: 'PATCH',
      body: { email: 'outra@greenmint.dev', name: 'Ana Volt' },
    })
    expect(patched.status).toBe(200)
    expect(patched.body.email).toBe(ANA.email)
  })

  test('wrong current password is a 400 with the error attached to currentPassword', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    const wrong = await apiFetch(page, '/api/profile/password', {
      method: 'POST',
      body: { currentPassword: 'ErradaDeProposito#9', newPassword: 'NovaSenha#123' },
    })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.details?.currentPassword).toBe('Senha atual incorreta.')

    // Nada foi trocado: a senha antiga continua entrando.
    await logout(page)
    await login(page, ANA)
  })

  test('changing the password invalidates the old one and the new one logs in', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    const changed = await apiFetch(page, '/api/profile/password', {
      method: 'POST',
      body: { currentPassword: ANA.password, newPassword: 'NovaSenha#123' },
    })
    expect(changed.status).toBe(204)
    await logout(page)

    const withOld = await apiFetch(page, '/api/auth/login', { method: 'POST', body: ANA })
    expect(withOld.status).toBe(401)
    const withNew = await apiFetch(page, '/api/auth/login', {
      method: 'POST',
      body: { email: ANA.email, password: 'NovaSenha#123' },
    })
    expect(withNew.status).toBe(200)
  })
})

test.describe('Wallets: type, referralCode and DELETE (fase 8)', () => {
  test('type is required and referralCode is optional on create', async ({ page }) => {
    await bootReset(page)
    await login(page, BRUNO)

    const missingType = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Sem tipo',
        address: '0x333333333333333333333333333333333333333c',
        network: 'ethereum',
        role: 'secondary',
      },
    })
    expect(missingType.status).toBe(400)
    expect(missingType.body.error.details?.type).toBeTruthy()

    const created = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Sem indicação',
        address: '0x333333333333333333333333333333333333333c',
        network: 'ethereum',
        type: 'walletconnect',
        role: 'secondary',
      },
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    expect(created.body.type).toBe('walletconnect')
    expect(created.body.referralCode).toBeUndefined()

    const patched = await apiFetch(page, `/api/wallets/${created.body.id}`, {
      method: 'PATCH',
      body: { type: 'coinbase', referralCode: 'KURIO-BRU' },
    })
    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({ type: 'coinbase', referralCode: 'KURIO-BRU' })
  })

  test('an unknown wallet type is a validation error, not free text', async ({ page }) => {
    await bootReset(page)
    await login(page, BRUNO)
    const bad = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Tipo inventado',
        address: '0x444444444444444444444444444444444444444d',
        network: 'ethereum',
        type: 'ledger',
        role: 'secondary',
      },
    })
    expect(bad.status).toBe(400)
  })

  test('DELETE a secondary wallet: 204 and the list shrinks', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA) // wallet_1 primary + wallet_2 secondary
    const before = await apiFetch(page, '/api/wallets')
    expect(before.body).toHaveLength(2)

    const removed = await apiFetch(page, '/api/wallets/wallet_2', { method: 'DELETE' })
    expect(removed.status).toBe(204)

    const after = await apiFetch(page, '/api/wallets')
    expect(after.body).toHaveLength(1)
    expect(after.body[0].id).toBe('wallet_1')
    expect(after.body[0].role).toBe('primary')
  })

  test('DELETE the only primary wallet: 409 and the list is untouched', async ({ page }) => {
    await bootReset(page)
    await login(page, BRUNO) // exatamente uma carteira, primária
    const conflict = await apiFetch(page, '/api/wallets/wallet_3', { method: 'DELETE' })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('conflict')

    const after = await apiFetch(page, '/api/wallets')
    expect(after.body).toHaveLength(1)
    expect(after.body[0].id).toBe('wallet_3')
    expect(after.body[0].role).toBe('primary')
  })

  test('DELETE a primary wallet that has a secondary: 204 and the oldest secondary is promoted', async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    // Uma terceira carteira, mais nova que wallet_2, para provar que a
    // promovida é a MAIS ANTIGA e não a última criada.
    const newer = await apiFetch(page, '/api/wallets', {
      method: 'POST',
      body: {
        label: 'Mais nova',
        address: '0x555555555555555555555555555555555555555e',
        network: 'ethereum',
        type: 'metamask',
        role: 'secondary',
      },
    })
    expect(newer.status).toBe(201)

    const removed = await apiFetch(page, '/api/wallets/wallet_1', { method: 'DELETE' })
    expect(removed.status).toBe(204)

    const after = await apiFetch(page, '/api/wallets')
    const primaries = after.body.filter((w: { role: string }) => w.role === 'primary')
    expect(primaries).toHaveLength(1)
    expect(primaries[0].id).toBe('wallet_2') // a mais antiga das secundárias
    expect(after.body.some((w: { id: string }) => w.id === 'wallet_1')).toBe(false)
  })

  test("DELETE another user's wallet: 404, and that wallet survives (isolation)", async ({
    page,
  }) => {
    await bootReset(page)
    await login(page, ANA)
    const forbidden = await apiFetch(page, '/api/wallets/wallet_3', { method: 'DELETE' })
    expect(forbidden.status).toBe(404)

    await logout(page)
    await login(page, BRUNO)
    const brunoWallets = await apiFetch(page, '/api/wallets')
    expect(brunoWallets.body.some((w: { id: string }) => w.id === 'wallet_3')).toBe(true)
  })

  test('a removed wallet stays removed after a reload (persist)', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)
    expect((await apiFetch(page, '/api/wallets/wallet_2', { method: 'DELETE' })).status).toBe(204)

    await page.reload()
    await awaitMswReady(page)
    const after = await apiFetch(page, '/api/wallets')
    expect(after.body).toHaveLength(1)
  })
})

test.describe('Isolation between users', () => {
  test('Ana and Bruno never see each other\'s cart, favorites or profile', async ({ page }) => {
    await boot(page, '?mock-reset=1')

    await login(page, ANA)
    const anaCart = await apiFetch(page, '/api/cart')
    const anaFavorites = await apiFetch(page, '/api/favorites')
    const anaProfile = await apiFetch(page, '/api/profile')
    await logout(page)

    await login(page, BRUNO)
    const brunoCart = await apiFetch(page, '/api/cart')
    const brunoFavorites = await apiFetch(page, '/api/favorites')
    const brunoProfile = await apiFetch(page, '/api/profile')

    expect(brunoCart.body.items).toEqual([])
    expect(anaCart.body.items.length).toBeGreaterThan(0)
    expect(brunoFavorites.body.nftIds).toEqual(['nft-001'])
    expect(anaFavorites.body.nftIds.sort()).toEqual(['nft-002', 'nft-007', 'nft-021'])
    expect(brunoProfile.body.email).not.toBe(anaProfile.body.email)
  })
})

test.describe('Data hygiene', () => {
  test('localStorage db never stores a plaintext password field', async ({ page }) => {
    await boot(page, '?mock-reset=1')
    const dump = await page.evaluate(() => localStorage.getItem('greenmint:db:v1'))
    expect(dump).toBeTruthy()
    const db = JSON.parse(dump!)
    for (const user of db.users) {
      expect(user).not.toHaveProperty('password')
      expect(typeof user.passwordHash).toBe('string')
      expect(typeof user.salt).toBe('string')
    }
    expect(dump).not.toContain('GreenMint#1')
    expect(dump).not.toContain('GreenMint#2')
  })

  test('edge case: a stale seedVersion in localStorage silently reseeds instead of corrupting state', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')
    await page.evaluate(() => {
      localStorage.setItem(
        'greenmint:db:v1',
        JSON.stringify({ seedVersion: 0, users: [], nfts: [], carts: {}, favorites: {} }),
      )
    })
    await page.reload()
    await awaitMswReady(page)

    const list = await apiFetch(page, '/api/nfts')
    expect(list.body.total).toBe(48)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    expect(detail.status).toBe(200)
  })
})

test.describe('Static contract checks (source, not runtime)', () => {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const srcDir = path.join(root, '..', 'src')

  function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }

  test('no ETH-amount field is typed as number anywhere in src/', () => {
    const ethFields = /(priceEth|totalEth|subtotalEth|discountEth|networkFeeEth|unitPriceEth|lineTotalEth)\s*:\s*number/
    for (const file of walk(srcDir)) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content, file).not.toMatch(ethFields)
    }
  })

  test('no Number(...) is applied to an *Eth-named value anywhere in src/ (fix plan iteration 2, criterion 7)', () => {
    // The removed offender: fixtures.ts used to pick the min price via
    // `Number(e.priceEth) < Number(min)` — a float compare of money. The
    // fix replaced it with `eth(...).lt(eth(...))`. This guards against the
    // pattern reappearing anywhere in the repo, not just in fixtures.ts.
    const numberOnEth = /Number\([^)]*Eth[^)]*\)/
    for (const file of walk(srcDir)) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content, file).not.toMatch(numberOnEth)
    }
  })

  test('src/lib/api.ts contains no mocked data and is unmodified plain axios setup', () => {
    const content = fs.readFileSync(path.join(srcDir, 'lib', 'api.ts'), 'utf8')
    expect(content).not.toContain('picsum')
    expect(content).not.toMatch(/mocks\//)
    expect(content).toContain('axios.create')
  })

  test('no fictitious/mocked data lives outside src/mocks/ — including src/mocks/ itself now (fase 2, criterion 6)', () => {
    // Fase 1 skipped src/mocks/ here because fixtures still used an external
    // placeholder-image service. That debt is paid off (spec §5: local
    // /nft/*.webp assets) — src/mocks/ is no longer exempt from this check.
    for (const file of walk(srcDir)) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content, file).not.toContain('picsum.photos')
    }
  })
})
