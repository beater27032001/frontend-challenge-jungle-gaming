import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 1 contract tests: exercise the MSW mock API (types, db, scenarios)
 * entirely from the page context — the Playwright `request` fixture never
 * touches the service worker, so every assertion goes through
 * `page.evaluate(fetch)`. `GET /api/health` is the only route reachable
 * outside a booted app; everything else requires `boot()` first.
 */

const ANA = { email: 'ana@greenmint.dev', password: 'GreenMint#1' }
const BRUNO = { email: 'bruno@greenmint.dev', password: 'GreenMint#2' }

type ApiResult<T = any> = { status: number; body: T }

async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`)
  await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
}

/**
 * Resets the mock db via the one-shot `?mock-reset=1` boot param.
 * `installMockControls()` strips the param from the URL after consuming it,
 * so a later `page.reload()` doesn't repeat the reset.
 */
async function bootReset(page: Page): Promise<void> {
  await boot(page, '?mock-reset=1')
}

async function apiFetch<T = any>(
  page: Page,
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<ApiResult<T>> {
  return page.evaluate(async ({ url, init }) => {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // no/invalid JSON body (e.g. 204)
    }
    return { status: res.status, body }
  }, { url, init })
}

async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  const res = await apiFetch(page, '/api/auth/login', { method: 'POST', body: creds })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

async function logout(page: Page): Promise<void> {
  await apiFetch(page, '/api/auth/logout', { method: 'POST' })
}

async function setScenario(page: Page, name: string): Promise<void> {
  await page.evaluate((name) => window.__mocks!.setScenario(name as never), name)
}

async function reset(page: Page): Promise<void> {
  await page.evaluate(() => window.__mocks!.reset())
}

async function addToCart(
  page: Page,
  nftId: string,
  editionId: string,
  quantity: number,
): Promise<ApiResult> {
  return apiFetch(page, '/api/cart/items', {
    method: 'POST',
    body: { nftId, editionId, quantity },
  })
}

/** Empties the current owner's cart — used so a target item lands as the
 * quote's first line, which is what the price-changed/sold-out scenario
 * hooks act on. */
async function clearCart(page: Page): Promise<void> {
  const cart = await apiFetch(page, '/api/cart')
  for (const item of cart.body.items) {
    await apiFetch(page, `/api/cart/items/${item.id}`, { method: 'DELETE' })
  }
}

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
    expect(first.body.total).toBe(12)
    for (const item of first.body.items) {
      expect(item.category).toBe('art')
      expect(item.rarity).toBe('epic')
    }
    const prices = first.body.items.map((i: { priceEth: string }) => Number(i.priceEth))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    // A mismatched (impossible, per the fixture generator) category/rarity
    // pair is also deterministic and simply empty — not an error.
    const impossible = await apiFetch(page, '/api/nfts?category=art&rarity=rare')
    expect(impossible.status).toBe(200)
    expect(impossible.body.total).toBe(0)
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

  test('detail: 404 for unknown id, 200 with editions/priceEth as string for a known id', async ({
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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
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

  test('seed remains unchanged: fresh reset top-level fields match the known fixture values, SEED_VERSION stays 1', async ({
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
    expect(dbDump.seedVersion).toBe(1)
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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)

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
        role: 'secondary',
      },
    })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('conflict')
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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)

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

  test('no fictitious/mocked data lives outside src/mocks/', () => {
    for (const file of walk(srcDir)) {
      if (file.includes(`${path.sep}mocks${path.sep}`)) continue
      const content = fs.readFileSync(file, 'utf8')
      expect(content, file).not.toContain('picsum.photos')
    }
  })
})
