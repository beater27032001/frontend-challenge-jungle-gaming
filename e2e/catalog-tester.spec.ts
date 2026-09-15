import { expect, test } from '@playwright/test'
import { apiFetch, boot, bootReset, isExpectedBootNoise, setScenario } from './helpers'

/**
 * TanStack Router's default `parseSearch` used to JSON-parse any URL value
 * whose first character looked like the start of a JSON literal (digit,
 * `-`, `"`, `[`, `{`, `true`/`false`/`null` prefixes) — see
 * `@tanstack/router-core/dist/esm/searchParams.js`. `src/main.tsx` now
 * configures a custom `parseSearch`/`stringifySearch` pair (plain
 * `URLSearchParams`, no JSON) that fixed this: a digit-leading value now
 * round-trips as a plain string (`priceMin=0.05`, no quoting) whether
 * written by the app or typed by hand. Tests below build URLs the same
 * plain way the app itself now writes them.
 */

/**
 * Tester-authored, independent of `catalog.spec.ts` (Coder-authored). Focus:
 * the risk items named in the fase-3 test brief — the two Ponytail fixes
 * verified independently, the `network` contract traps, and gaps left open
 * by the Coder's own "What the Tester should focus on" note. Does not repeat
 * assertions `catalog.spec.ts` already makes unless strengthening them.
 */

test.describe('isExpectedBootNoise gate (Ponytail fix #1) — independent verification', () => {
  test('unit: only tolerates a /api/auth/session failure, not any ERR_FAILED/404', () => {
    // The session 401, exactly as Chromium logs it (text + location appended).
    expect(
      isExpectedBootNoise(
        'Failed to load resource: the server responded with a status of 401 (Unauthorized) http://localhost:4173/api/auth/session',
      ),
    ).toBe(true)

    // Same shape of message, different origin — must NOT be swallowed.
    expect(
      isExpectedBootNoise(
        'Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:4173/nft/ape-01.webp',
      ),
    ).toBe(false)
    expect(
      isExpectedBootNoise('net::ERR_FAILED http://localhost:4173/nft/ape-02.webp'),
    ).toBe(false)
    expect(isExpectedBootNoise('Failed to load resource: the server responded with a status of 500 () http://localhost:4173/api/nfts')).toBe(
      false,
    )
    // Unrelated console error entirely.
    expect(isExpectedBootNoise('TypeError: Cannot read properties of undefined')).toBe(false)
  })

  test('integration: a console error from a different origin is NOT filtered out by the live gate', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${msg.text()} ${msg.location().url}`)
    })

    // `page.route()` cannot intercept these images at all — both hero and
    // cards fetch them through the MSW service worker's own fetch handler,
    // a separate CDP target Playwright's page-level routing doesn't reach
    // here (verified: 0 route hits, 0 `requestfailed` events on every glob
    // tried; the dev server's SPA fallback also turns a truly-missing asset
    // path into a 200, so a real broken-image console error isn't
    // reproducible through this app's static serving either). So the error
    // is injected the same way Chromium would report a real one — same
    // collection code path (`${text} ${location}`), same predicate — to
    // keep the assertion about the gate itself, not about how to break an
    // <img> tag under this specific dev server.
    await boot(page, '?mock-reset=1')
    await page.evaluate(() => {
      console.error('Failed to load resource: the server responded with a status of 404 (Not Found)')
    })
    await page.waitForTimeout(200)

    const nonNoise = consoleErrors.filter((msg) => !isExpectedBootNoise(msg))
    // If the gate were still the old unscoped regex (or someone widened it
    // again), this 404 from an unrelated origin would vanish from
    // `nonNoise` and the assertion below would wrongly pass on an empty
    // array.
    expect(nonNoise.length).toBeGreaterThan(0)
  })
})

test.describe('render-time draft resync (Ponytail fix #2) — independent verification', () => {
  test('filter-panel price slider legend resyncs when the URL changes from outside (browser back)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    const facets = await apiFetch(page, '/api/nfts?perPage=48')
    const maxPriceEth = Math.max(...facets.body.items.map((i: { priceEth: string }) => Number(i.priceEth)))
    const ceilMax = Math.ceil(maxPriceEth)

    await page.goto('/')
    const legend = page.getByText(/ETH\s*–\s*.*ETH/)
    await expect(legend).toHaveText(`0 ETH – ${ceilMax} ETH`)

    // External URL change (not through the panel's own "Aplicar" button) —
    // this plain URL is exactly the shape the app's own `stringifySearch`
    // now writes (see the router-parsing note at the top of this file), so
    // this test isolates the resync logic itself from that unrelated quirk.
    await page.goto('/?priceMin=0.05&priceMax=1')
    await expect(legend).toHaveText('0.05 ETH – 1 ETH')

    // Back button: URL loses the price params — the draft/legend must
    // resync to the new (default) URL state, not keep showing 0.05–1.
    await page.goBack()
    expect(await page.evaluate(() => location.search)).toBe('')
    await expect(legend).toHaveText(`0 ETH – ${ceilMax} ETH`)
  })

  test('mobile search draft resyncs to the URL after a browser-back removes `q`', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    const input = page.getByPlaceholder('Explorar coleções')
    await page.goto('/')
    await expect(input).toHaveValue('')

    await page.goto('/?q=Neon')
    await expect(input).toHaveValue('Neon')

    // Nothing typed this value locally — it must track the URL, including
    // on a pure history navigation the component didn't initiate itself.
    await page.goBack()
    expect(await page.evaluate(() => location.search)).toBe('')
    await expect(input).toHaveValue('')
  })

  test('filter-panel draft resyncs after "Limpar filtros" clears the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page, '?mock-reset=1&mock-scenario=empty&priceMin=0.05&priceMax=1')

    const clear = page.getByRole('link', { name: 'Limpar filtros' })
    await clear.click()
    expect(await page.evaluate(() => location.search)).toBe('')

    const legend = page.getByText(/ETH\s*–\s*.*ETH/)
    // maxCeil falls back to 1 in the `empty` scenario (spec "Estados" +
    // edge case "slider com bounds fallback max '1' sem NaN").
    await expect(legend).toHaveText('0 ETH – 1 ETH')
  })
})

test.describe('network contract traps (spec §"Mudança de contrato: network")', () => {
  test('every category×network pair has at least one item, and totals are exactly 16/16/16', async ({ page }) => {
    await bootReset(page)
    const { NETWORKS, CATEGORIES } = {
      NETWORKS: ['ethereum', 'polygon', 'solana'] as const,
      CATEGORIES: [
        'art',
        'photography',
        'music',
        'art-3d',
        'collectibles',
        'generative',
        'gaming',
        'memberships',
        'utility',
      ] as const,
    }

    for (const network of NETWORKS) {
      const res = await apiFetch(page, `/api/nfts?network=${network}&perPage=48`)
      expect(res.status, network).toBe(200)
      expect(res.body.total, network).toBe(16)
      expect(res.body.items.every((i: { network: string }) => i.network === network), network).toBe(true)
    }

    for (const category of CATEGORIES) {
      for (const network of NETWORKS) {
        const res = await apiFetch(page, `/api/nfts?category=${category}&network=${network}&perPage=48`)
        expect(res.body.total, `${category}×${network}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('toSummary does not silently drop `network`: every list item and the detail payload carry it', async ({
    page,
  }) => {
    await bootReset(page)
    const list = await apiFetch(page, '/api/nfts?perPage=48')
    expect(list.body.items.length).toBe(48)
    for (const item of list.body.items) {
      expect(item).toHaveProperty('network')
      expect(['ethereum', 'polygon', 'solana']).toContain(item.network)
    }

    const detail = await apiFetch(page, '/api/nfts/nft-001')
    expect(detail.body).toHaveProperty('network')
  })

  test('failure case: an unknown network value is a 400 validation_error, not a silent no-op filter', async ({
    page,
  }) => {
    await bootReset(page)
    const bogus = await apiFetch(page, '/api/nfts?network=bitcoin')
    expect(bogus.status).toBe(400)
    expect(bogus.body.error.code).toBe('validation_error')

    // Sanity: a valid network really does filter (contrast with the 400
    // above — proves the schema, not just the shape of the error).
    const valid = await apiFetch(page, '/api/nfts?network=ethereum&perPage=48')
    expect(valid.status).toBe(200)
    expect(valid.body.total).toBe(16)
  })
})

test.describe('out-of-order — stronger assertion than a pressed-state check', () => {
  test('the stale first response never repaints a title that only belongs to the discarded filter', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await setScenario(page, 'out-of-order')

    // nft-001 ("Solar Drift", i=0) is category=art and does NOT exist in
    // photography (titles are index-derived and provably disjoint between
    // the two categories — verified analytically, not asserted here).
    await page.getByRole('button', { name: 'Arte digital' }).click() // request 1: 1500ms
    await page.getByRole('button', { name: 'Fotografia' }).click() // request 2: 100ms

    // Give request 2 time to land and paint photography's page 1.
    await expect(page.getByRole('link', { name: 'Neon Drift', exact: true })).toBeVisible()

    // Now let the stale 1500ms response for "art" arrive. It must not
    // clobber the grid back to art's page-1 content.
    await page.waitForTimeout(1700)
    await expect(page.getByRole('link', { name: 'Solar Drift', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Fotografia' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Arte digital' })).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('edge cases from the spec not exercised elsewhere', () => {
  test('?page=99 out of range on a real >1-page filter shows the empty state, not a crash', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page, '?mock-reset=1&network=solana&page=99')

    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Limpar filtros' })).toBeVisible()
    expect(await page.evaluate(() => location.search)).toContain('page=99')
  })

  test('priceMin > priceMax degrades to an empty result set at the API layer, no exception', async ({ page }) => {
    await bootReset(page)
    const res = await apiFetch(page, '/api/nfts?priceMin=5&priceMax=1')
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
  })

  test('a hand-typed price deep link (spec edge case "priceMin > priceMax", unquoted) renders the empty state', async ({
    page,
  }) => {
    // This is the literal edge case from the spec, typed exactly as the
    // spec writes it: `?priceMin=5&priceMax=1`. Previously TanStack
    // Router's default `parseSearch` JSON-parsed any URL value that looks
    // like the start of a JSON literal — digits included — before
    // `validateSearch` ever ran (`@tanstack/router-core`
    // `dist/esm/searchParams.js`, `jsonStart` regex), so "5" and "1" became
    // the NUMBERS 5 and 1, `ethString` (`z.string().regex(...)`) rejected a
    // number, and `.catch(undefined)` dropped both silently. Fixed by the
    // custom `parseSearch`/`stringifySearch` pair in `src/main.tsx`, which
    // never JSON-parses and always round-trips plain strings.
    await boot(page, '?mock-reset=1&priceMin=5&priceMax=1')

    // Expected per the spec: empty state (the API-level test above proves
    // the API itself returns `items: []` for this exact query).
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
  })

  test('search with no matches ("zzz") shows the empty state with "Limpar filtros"', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.goto('/?q=zzz')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Limpar filtros' })).toBeVisible()
  })

  test('a sold-out NFT (nft-013, available 0) renders normally in the catalogue, not excluded or specially marked', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    // nft-013 ("Astral Bloom", category art-3d, available 0) — sold-out
    // handling is fase 4's job; this fase must not hide it, disable its
    // link, or otherwise imply a state the catalogue doesn't actually track.
    await page.goto('/?category=art-3d')
    const card = page.getByRole('link', { name: 'Astral Bloom', exact: true })
    await expect(card).toBeVisible()
    await expect(card).toBeEnabled()
    await expect(card).toHaveAttribute('href', '/nft/nft-013')
    await expect(card.getByText('0.008 ETH')).toBeVisible()
  })

  test('double-click on the same filter row toggles it on then off, leaving two coherent history entries', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    const row = page.getByRole('button', { name: 'Solana' })
    await row.click()
    await expect(row).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => location.search)).toContain('network=solana')

    await row.click()
    await expect(row).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() => location.search)).not.toContain('network=')

    await page.goBack()
    await expect(row).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => location.search)).toContain('network=solana')
  })

  test('category + network + price + q combined apply as AND (intersection), not OR', async ({ page }) => {
    await bootReset(page)
    // nft-001 = "Solar Drift", category art, price '0.008' (i%12=0).
    const nft001 = await apiFetch(page, '/api/nfts/nft-001')
    const combo = await apiFetch(
      page,
      `/api/nfts?category=art&network=${nft001.body.network}&q=Solar&priceMax=${nft001.body.priceEth}`,
    )
    expect(combo.body.items.map((i: { id: string }) => i.id)).toContain('nft-001')

    // Flip one axis to a value nft-001 doesn't satisfy — intersection must
    // drop it (proves AND, not an OR that would keep matching on `q` alone).
    const other = nft001.body.network === 'ethereum' ? 'polygon' : 'ethereum'
    const notCombo = await apiFetch(page, `/api/nfts?category=art&network=${other}&q=Solar`)
    expect(notCombo.body.items.map((i: { id: string }) => i.id)).not.toContain('nft-001')
  })

  test('MobileSearchBar submit from /nft/$nftId navigates to / with `q` applied', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    await page.goto('/nft/nft-001')
    const input = page.getByPlaceholder('Explorar coleções')
    await input.fill('Neon')
    await input.press('Enter')

    const { pathname, search } = await page.evaluate(() => ({
      pathname: location.pathname,
      search: location.search,
    }))
    expect(pathname).toBe('/')
    expect(search).toContain('q=Neon')
  })
})
