import { expect, test } from '@playwright/test'

/**
 * Phase 1 runtime checks: things only observable against the real running
 * system (production build + preview server), not against the contract
 * assertions in `e2e/api-contracts.spec.ts`. That suite already covers, and
 * is NOT duplicated here:
 *   - session cookie / favorites surviving `page.reload()` (proves the
 *     service worker keeps intercepting after a full reload and that
 *     localStorage persistence works);
 *   - cross-user data isolation (login Ana → logout → login Bruno, cart/
 *     favorites/profile/orders never leak) via `Isolation between users`
 *     and the 403-forbidden-order test.
 */

const SCENARIO_KEY = 'greenmint:scenario'

test.describe('Clean boot of the production build', () => {
  test('mock layer comes up with no console errors and no failed network requests', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()}`))

    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
    await page.waitForLoadState('networkidle')

    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })
})

test.describe('Scenario selection on a clean load', () => {
  test('?mock-scenario= query param activates the scenario from the very first request', async ({
    page,
  }) => {
    await page.goto('/?mock-scenario=server-error')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const health = await page.evaluate(async () => (await (await fetch('/api/health')).json()))
    expect(health.scenario).toBe('server-error')

    const nfts = await page.evaluate(async () => (await fetch('/api/nfts')).status)
    expect(nfts).toBe(500)
  })

  test('scenario preset via addInitScript (the pattern future phases will use) applies before the app makes its first request', async ({
    context,
    page,
  }) => {
    await context.addInitScript(
      (key) => localStorage.setItem(key, 'server-error'),
      SCENARIO_KEY,
    )
    await page.goto('/')
    // /api/health bypasses withScenario on purpose, so the smoke screen must
    // still render "ok" even though every other route is broken.
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const nfts = await page.evaluate(async () => (await fetch('/api/nfts')).status)
    expect(nfts).toBe(500)
  })
})

test.describe('offline scenario', () => {
  test('a cold boot with the offline scenario preset keeps the smoke screen responding, with no console error', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    await page.goto('/?mock-scenario=offline')
    // GET /api/health is deliberately outside withScenario, so the smoke
    // screen must still resolve even though every other route is offline.
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
    // Boot itself (the health check) must be clean; the browser's own
    // "net::ERR_FAILED" log for the *intentionally* rejected fetch below is
    // expected noise from the offline scenario, not an app error.
    expect(consoleErrors).toEqual([])

    const failed = await page.evaluate(async () => {
      try {
        await fetch('/api/nfts')
        return false
      } catch {
        return true
      }
    })
    expect(failed).toBe(true)
  })
})

test.describe('slow scenario', () => {
  test('produces the ~2500ms latency window the skeletons will rely on', async ({ page }) => {
    await page.goto('/?mock-scenario=slow')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const start = Date.now()
    await page.evaluate(async () => {
      await fetch('/api/nfts')
    })
    const elapsed = Date.now() - start

    // Spec fixes the delay at exactly 2500ms; allow scheduling jitter but
    // reject both "not actually slow" and "unreasonably slower than spec'd".
    expect(elapsed).toBeGreaterThanOrEqual(2300)
    expect(elapsed).toBeLessThan(3500)
  })
})

test.describe('?mock-reset=1 boot flag', () => {
  test('restores the exact fixture state on first load', async ({ page }) => {
    await page.goto('/?mock-reset=1')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const nft = await page.evaluate(async () => (await (await fetch('/api/nfts/nft-001')).json()))
    expect(nft.editions[0].available).toBe(10)
  })

  test('FINDING: reloading the page while ?mock-reset=1 is still in the address bar re-fires the reset, silently discarding data added after it', async ({
    page,
  }) => {
    await page.goto('/?mock-reset=1')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    await page.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ana@greenmint.dev', password: 'GreenMint#1' }),
      })
      await fetch('/api/favorites/nft-006', { method: 'PUT' })
    })

    const before = await page.evaluate(async () => (await (await fetch('/api/favorites')).json()))
    expect(before.nftIds).toContain('nft-006')

    // A real user hitting the browser's refresh button reloads the exact
    // same URL, `?mock-reset=1` included — installMockControls() re-reads
    // location.search on every boot and calls resetDb() again.
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const sessionAfter = await page.evaluate(async () => (await fetch('/api/auth/session')).status)
    // Expected per the spec's intent (a boot flag should apply once, not on
    // every subsequent reload of the same URL): the session and the favorite
    // added after the reset should still be there.
    expect(sessionAfter, 'session should survive a reload of the same ?mock-reset=1 URL').toBe(200)
  })
})

test.describe('Boot param cleanup (fix iteration 1)', () => {
  test('mock-reset=1 is stripped from the URL after boot, and there is no extra history entry to go back to', async ({
    page,
  }) => {
    await page.goto('/?mock-reset=1')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const search = await page.evaluate(() => location.search)
    expect(search).toBe('')

    // If the param were removed via history.pushState (instead of the
    // spec'd replaceState), this boot would have created a second history
    // entry and goBack() would land back on the URL carrying the param.
    // With replaceState there is nothing to go back to.
    const backResponse = await page.goBack()
    expect(backResponse).toBeNull()
    expect(page.url()).not.toContain('mock-reset')
  })

  test('foreign query params and the URL hash survive the cleanup, and the reset still applies', async ({
    page,
  }) => {
    await page.goto('/?foo=bar&mock-reset=1#section')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const { search, hash } = await page.evaluate(() => ({
      search: location.search,
      hash: location.hash,
    }))
    expect(search).toBe('?foo=bar')
    expect(hash).toBe('#section')

    const nft = await page.evaluate(async () => (await (await fetch('/api/nfts/nft-001')).json()))
    expect(nft.editions[0].available).toBe(10)
  })

  test('a clean boot with no mock params leaves the URL exactly as navigated', async ({ page }) => {
    // Note: the router itself (@tanstack/react-router) legitimately calls
    // history.replaceState on boot to sync its own location state, so this
    // asserts the observable outcome (the URL/query string is unchanged)
    // rather than spying on history.replaceState globally, which would
    // conflate the router's unrelated call with installMockControls()'s.
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const search = await page.evaluate(() => location.search)
    expect(search).toBe('')
  })

  test('a runtime setScenario() survives a reload even with a residual mock-scenario param semantics: reload keeps localStorage, not the URL', async ({
    page,
  }) => {
    await page.goto('/?mock-scenario=slow')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
    let health = await page.evaluate(async () => (await (await fetch('/api/health')).json()))
    expect(health.scenario).toBe('slow')
    expect(await page.evaluate(() => location.search)).toBe('')

    // Runtime switch, the way `window.__mocks` is meant to be used.
    await page.evaluate(() => window.__mocks?.setScenario('default'))
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    health = await page.evaluate(async () => (await (await fetch('/api/health')).json()))
    // No stale query param survives to re-impose 'slow' over the runtime
    // choice: localStorage is the only source of truth after boot.
    expect(health.scenario).toBe('default')
  })
})
