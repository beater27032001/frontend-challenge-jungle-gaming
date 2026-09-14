import { expect, test, type Page } from '@playwright/test'

/**
 * E2E Tester (post fix-cycle-2) re-validation of the `[major]` finding from
 * `review.md`: `NftSummary.priceEth`/`available` are now recomputed inside
 * `bumpNftVersion` instead of being frozen at seed time.
 *
 * `e2e/api-contracts.spec.ts`'s "Fix Plan (iteration 2)" describe block
 * already covers each mutation kind (purchase / sold-out / price-changed /
 * multi-edition / price-filter / cart-merge) in ISOLATION — one mutation,
 * one `bootReset()`, one assertion pass. This file does NOT repeat any of
 * that; it targets only what a single isolated mutation can't show:
 *
 *   1. Coherence across a LONG, REALISTIC session — several purchases on
 *      different NFTs, scenario mutations mixed in, with page reloads
 *      interleaved — checking that GET /api/nfts and GET /api/nfts/:id
 *      never contradict each other for ANY previously-touched NFT at ANY
 *      checkpoint (not just the NFT the last mutation touched).
 *   2. That the recomputed fields actually survive being written to and
 *      re-read from the localStorage blob, not just held correctly in the
 *      in-memory `db` singleton for the lifetime of one page.
 *   3. That `resetDb()` still restores the exact seed values for NFTs that
 *      were mutated during a heavy multi-step session, not just an
 *      NFT nothing ever touched.
 *   4. That the paginated catalogue and the price filter/sort stay globally
 *      coherent (no duplicate/missing ids, correct ordering, stable
 *      pagination) after scenario mutations — not only the single mutated
 *      NFT's own response.
 */

const ANA = { email: 'ana@greenmint.dev', password: 'GreenMint#1' }

type ApiResult<T = any> = { status: number; body: T }

async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`)
  await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
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
      // no/invalid JSON body
    }
    return { status: res.status, body }
  }, { url, init })
}

async function login(page: Page): Promise<void> {
  const res = await apiFetch(page, '/api/auth/login', { method: 'POST', body: ANA })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

async function setScenario(page: Page, name: string): Promise<void> {
  await page.evaluate((name) => window.__mocks!.setScenario(name as never), name)
}

async function clearCart(page: Page): Promise<void> {
  const cart = await apiFetch(page, '/api/cart')
  for (const item of cart.body.items) {
    await apiFetch(page, `/api/cart/items/${item.id}`, { method: 'DELETE' })
  }
}

/** Adds a single NFT/edition to a clean cart, quotes it, and submits an order. */
async function purchase(
  page: Page,
  nftId: string,
  editionId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ApiResult> {
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
async function assertCoherent(page: Page, nftId: string): Promise<{ available: number; priceEth: string; version: number }> {
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
    await login(page)

    // Step 1: plain purchase on nft-005 (single edition, untouched by fixtures).
    const buy1 = await purchase(page, 'nft-005', 'nft-005-e1', 2, 'session-buy-005-a')
    expect(buy1.status, JSON.stringify(buy1.body)).toBe(201)
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
    const s1 = await assertCoherent(page, 'nft-005')
    expect(s1.available).toBe(8) // 10 - 2

    // Step 2: sold-out scenario on a different NFT (nft-006).
    await login(page) // reload dropped in-page JS state, but session cookie survives; re-login is a no-op 200
    await setScenario(page, 'sold-out')
    const soldOut = await purchase(page, 'nft-006', 'nft-006-e1', 1, 'session-soldout-006')
    expect(soldOut.status).toBe(409)
    await setScenario(page, 'default')
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
    // Both NFTs touched so far must independently still be coherent.
    const s2a = await assertCoherent(page, 'nft-005')
    expect(s2a.available).toBe(8) // untouched by step 2, must not have drifted
    const s2b = await assertCoherent(page, 'nft-006')
    expect(s2b.available).toBe(0)

    // Step 3: price-changed scenario on yet another NFT (nft-009).
    await login(page)
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
    await login(page)
    const buy2 = await purchase(page, 'nft-005', 'nft-005-e1', 3, 'session-buy-005-b')
    expect(buy2.status, JSON.stringify(buy2.body)).toBe(201)
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)

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
    await login(page)

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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
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
    await login(page)

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
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)

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
    await login(page)

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
    // not the stale seed value — checked pairwise across all 48 items.
    for (let i = 1; i < after.body.items.length; i++) {
      const prevPrice = Number(after.body.items[i - 1].priceEth)
      const currPrice = Number(after.body.items[i].priceEth)
      expect(currPrice, `item ${i} out of order vs item ${i - 1}`).toBeGreaterThanOrEqual(prevPrice)
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
    // nft-006 is category cycle index (6-1)%4=1 -> 'gaming'.
    const filteredBefore = await apiFetch(page, '/api/nfts?category=gaming&priceMax=0.13&perPage=48')
    expect(filteredBefore.body.items.some((i: { id: string }) => i.id === 'nft-006')).toBe(false) // 0.132 > 0.13
    const filteredWide = await apiFetch(page, '/api/nfts?category=gaming&priceMax=0.14&perPage=48')
    expect(filteredWide.body.items.some((i: { id: string }) => i.id === 'nft-006')).toBe(true)
  })
})
