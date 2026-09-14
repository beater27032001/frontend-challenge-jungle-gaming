import { expect, test } from '@playwright/test'

/**
 * E2E Tester re-validation, fix cycle iteration 1. Targets only what
 * `e2e/runtime-behavior.spec.ts` (Tester's `Boot param cleanup` block) and
 * `e2e/api-contracts.spec.ts` do NOT already cover:
 *   - console cleanliness of the exact boot path that now calls
 *     `history.replaceState` (both params present at once), and that the
 *     MSW service worker keeps intercepting through a reload that happens
 *     AFTER the URL has already been rewritten by `installMockControls()`;
 *   - the shareable-scenario-link flow: a brand-new browser context opening
 *     a URL with `?mock-scenario=` should apply and persist the scenario,
 *     and a plain reload afterwards (no runtime `setScenario()` in between)
 *     should keep it — this is the exact way link recipients, not just
 *     Playwright's `addInitScript` pattern, will select a scenario.
 */

test.describe('Boot param cleanup — no regressions introduced by the fix', () => {
  test('booting with both mock-reset and mock-scenario present produces no console error, and the service worker keeps intercepting through a later reload', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    await page.goto('/?mock-reset=1&mock-scenario=slow')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
    expect(consoleErrors).toEqual([])

    // URL was rewritten by installMockControls(); reload again now that the
    // params are gone, to prove the SW isn't a one-shot artifact of the
    // param-carrying boot — it keeps answering on the plain reload too.
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
    expect(consoleErrors).toEqual([])

    const nft = await page.evaluate(async () => (await (await fetch('/api/nfts/nft-001')).json()))
    // A real network request to a route no static preview server serves
    // would 404/HTML, not return this JSON shape — proof the worker is
    // still the one answering after the rewritten reload.
    expect(nft.editions[0].available).toBe(10)
    expect(await page.evaluate(() => location.search)).toBe('')
  })
})

test.describe('Shareable scenario link', () => {
  test('opening a URL with ?mock-scenario= in a clean context applies and persists the scenario; a later reload with no runtime override keeps it', async ({
    browser,
  }) => {
    // Fresh context = no prior localStorage, simulating a link recipient's
    // browser, not the same context another test already touched.
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/?mock-scenario=offline')
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const scenarioAfterOpen = await page.evaluate(() =>
      localStorage.getItem('greenmint:scenario'),
    )
    expect(scenarioAfterOpen).toBe('offline')
    expect(await page.evaluate(() => location.search)).toBe('')

    const failedRightAfterOpen = await page.evaluate(async () => {
      try {
        await fetch('/api/nfts')
        return false
      } catch {
        return true
      }
    })
    expect(failedRightAfterOpen).toBe(true)

    // The recipient reloads (or navigates back to the bookmarked, now-clean
    // URL) with no `window.__mocks.setScenario()` call in between — the
    // scenario must come from localStorage, not from a param that's gone.
    await page.reload()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)

    const health = await page.evaluate(async () => (await (await fetch('/api/health')).json()))
    expect(health.scenario).toBe('offline')

    await context.close()
  })
})
