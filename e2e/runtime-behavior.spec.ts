import { expect, test } from '@playwright/test'
import { boot } from './helpers'

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
 *
 * Fase 2 consolidation (spec §6): absorbs the 2 `describe` blocks from the
 * now-deleted `e2e/mock-boot-revalidation.spec.ts` (the "Boot param cleanup"
 * block below is theirs, joined with the pre-existing block of the same
 * name) and the 2 tests from the deleted `e2e/smoke.spec.ts` (new `Smoke`
 * describe at the bottom).
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

    await boot(page)
    await page.waitForLoadState('networkidle')

    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })
})

test.describe('Scenario selection on a clean load', () => {
  test('?mock-scenario= query param activates the scenario from the very first request', async ({
    page,
  }) => {
    await boot(page, '?mock-scenario=server-error')

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
    // /api/health bypasses withScenario on purpose, so the smoke screen must
    // still render "ok" even though every other route is broken.
    await boot(page)

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

    // GET /api/health is deliberately outside withScenario, so the smoke
    // screen must still resolve even though every other route is offline.
    await boot(page, '?mock-scenario=offline')
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
    await boot(page, '?mock-scenario=slow')

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
    await boot(page, '?mock-reset=1')

    const nft = await page.evaluate(async () => (await (await fetch('/api/nfts/nft-001')).json()))
    expect(nft.editions[0].available).toBe(10)
  })

  test('FINDING: reloading the page while ?mock-reset=1 is still in the address bar re-fires the reset, silently discarding data added after it', async ({
    page,
  }) => {
    await boot(page, '?mock-reset=1')

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
    await boot(page, '?mock-reset=1')

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
    await boot(page, '?foo=bar&mock-reset=1#section')

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
    await boot(page)

    const search = await page.evaluate(() => location.search)
    expect(search).toBe('')
  })

  test('a runtime setScenario() survives a reload even with a residual mock-scenario param semantics: reload keeps localStorage, not the URL', async ({
    page,
  }) => {
    await boot(page, '?mock-scenario=slow')
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

/**
 * Consolidated from `e2e/mock-boot-revalidation.spec.ts` (deleted, fase 2
 * E2E consolidation, spec §6). Targets only what the "Boot param cleanup"
 * block above and `e2e/api-contracts.spec.ts` do NOT already cover:
 *   - console cleanliness of the exact boot path that calls
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

    await boot(page, '?mock-reset=1&mock-scenario=slow')
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

    await boot(page, '?mock-scenario=offline')

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

/**
 * Consolidated from `e2e/smoke.spec.ts` (deleted, fase 2 E2E consolidation,
 * spec §6).
 */
test.describe('Smoke', () => {
  test('foundation boots with the mock layer answering', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /seja dono do futuro/i }),
    ).toBeVisible()
    await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
  })

  test('unknown route renders the 404 boundary', async ({ page }) => {
    await page.goto('/rota-que-nao-existe')
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  })

  test('document <title> and eyebrow use KURIO; "GreenMint" is not shown to the user (spec §0, criterion 22)', async ({
    page,
  }) => {
    await boot(page)
    await expect(page).toHaveTitle(/KURIO/)
    // The eyebrow above the heading, specifically (KURIO also legitimately
    // appears in the header wordmark and footer brand band).
    await expect(page.locator('#main').getByText('KURIO', { exact: true })).toBeVisible()
    await expect(page.getByText('GreenMint')).toHaveCount(0)
  })
})

/**
 * Fase 2 shell (spec §11, criteria 13–18, 23–24): two distinct compositions,
 * not one header that adapts. These describes drive the real production
 * build/preview (same pattern as the rest of this file), asserting the
 * structure against `specs/02-design-system.md` §§2/9/10.
 */
test.describe('Shell — desktop composition (>=1024, spec §2/§9)', () => {
  test('header renders KURIO, the 4 nav items with Início active, and the disabled search/cart/Entrar controls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    const header = page.locator('header')
    await expect(header).toBeVisible()
    await expect(header.getByRole('link', { name: 'KURIO' })).toBeVisible()

    const inicio = header.getByRole('link', { name: 'Início' })
    await expect(inicio).toHaveClass(/text-text-accent/)
    await expect(inicio).toHaveClass(/underline/)
    for (const label of ['Mercado', 'Criadores', 'Aprenda']) {
      await expect(header.getByText(label, { exact: true })).toBeVisible()
    }

    const search = header.getByRole('button', { name: 'Buscar' })
    const cart = header.getByRole('button', { name: 'Carrinho' })
    const entrar = header.getByRole('button', { name: /Entrar/ })
    await expect(search).toBeDisabled()
    await expect(cart).toBeDisabled()
    await expect(entrar).toBeDisabled()

    const entrarBox = await entrar.boundingBox()
    expect(entrarBox?.width).toBe(100)
    expect(entrarBox?.height).toBe(35)
    const entrarBg = await entrar.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(entrarBg).toBe('rgb(210, 138, 76)') // --color-primary #d28a4c

    // 44px header row + 1px divider = 45px total (spec §2).
    const rowBox = await header.locator(':scope > div').first().boundingBox()
    expect(rowBox?.height).toBe(44)
    const borderBottom = await header.evaluate((el) => getComputedStyle(el).borderBottomWidth)
    expect(borderBottom).toBe('1px')
  })

  test('cart badge is absent from the DOM while the count is unwired (criterion 15)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)
    // Phase 2 doesn't query the cart count (no consumer yet, spec §2) — the
    // badge (16x16, only rendered when count > 0) must never appear.
    await expect(page.locator('header [data-slot="badge"]')).toHaveCount(0)
  })

  test('mobile search bar and tab bar are absent at desktop widths', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)
    await expect(page.getByPlaceholder('Explorar coleções')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden()
  })

  test('footer renders the three bands: medallions, newsletter, brand band, link columns, wallet chip and copyright (criterion 14)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // Band 1: three 74x74 circular medallions with W/C/D, aria-hidden (decorative).
    const medallions = footer.locator('div[aria-hidden]', { hasText: /^[WCD]$/ })
    await expect(medallions).toHaveCount(3)
    for (const letter of ['W', 'C', 'D']) {
      const box = await medallions.filter({ hasText: letter }).boundingBox()
      expect(box?.width).toBe(74)
      expect(box?.height).toBe(74)
    }

    // Newsletter: disabled "Enviar" button, 85x40, rounded only on the right.
    const enviar = footer.getByRole('button', { name: 'Enviar' })
    await expect(enviar).toBeDisabled()
    const enviarBox = await enviar.boundingBox()
    expect(enviarBox?.width).toBe(85)
    expect(enviarBox?.height).toBe(40)
    const enviarRadius = await enviar.evaluate((el) => getComputedStyle(el).borderRadius)
    expect(enviarRadius).toBe('0px 6px 6px 0px')

    // Band 2: brand band with the KURIO wordmark.
    await expect(footer.getByText('KURIO', { exact: true })).toBeVisible()

    // Band 3: the four link columns from spec §9.
    for (const title of ['Meu perfil', 'Central de ajuda', 'Coleções', 'Redes sociais']) {
      await expect(footer.getByRole('heading', { name: title })).toBeVisible()
    }
    await expect(footer.getByText('METAMASK  •  WALLETCONNECT  •  COINBASE')).toBeVisible()
    await expect(footer.getByText('© 2026 Kurio. Propriedade digital para todos.')).toBeVisible()
  })
})

test.describe('Shell — mobile composition (<1024, spec §10/§11)', () => {
  // 768 is treated as mobile (ARCHITECTURE.md decision 1) and the Playwright
  // projects are only 1440/390 — this describe fixes the viewport explicitly
  // on every test so 768 gets exercised too (criteria 16–18, 23).
  for (const width of [390, 768]) {
    test(`at ${width}px: header/footer are absent; search bar + filter button on top, tab bar fixed at the bottom`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await boot(page)

      await expect(page.locator('header')).toBeHidden()
      await expect(page.locator('footer')).toBeHidden()

      const search = page.getByPlaceholder('Explorar coleções')
      await expect(search).toBeVisible()
      await expect(search).toBeDisabled()
      const searchBox = await search.boundingBox()
      expect(searchBox?.height).toBe(45)

      const filter = page.getByRole('button', { name: 'Filtrar' })
      await expect(filter).toBeVisible()
      await expect(filter).toBeDisabled()
      const filterBox = await filter.boundingBox()
      expect(filterBox?.width).toBe(45)
      expect(filterBox?.height).toBe(45)

      const nav = page.getByRole('navigation', { name: 'Navegação principal' })
      await expect(nav).toBeVisible()
      const tabbarContainer = page.locator('div.fixed.inset-x-0.bottom-0')
      const tabbarBox = await tabbarContainer.boundingBox()
      expect(tabbarBox?.height).toBe(126)
      const position = await tabbarContainer.evaluate((el) => getComputedStyle(el).position)
      expect(position).toBe('fixed')
      // pinned to the viewport bottom.
      expect(tabbarBox && tabbarBox.y + tabbarBox.height).toBe(900)

      const icons = nav.locator('svg')
      await expect(icons).toHaveCount(4)
      for (const icon of await icons.all()) {
        const box = await icon.boundingBox()
        expect(box?.width).toBe(20)
        expect(box?.height).toBe(20)
      }

      const fab = page.getByRole('button', { name: 'Criar' })
      await expect(fab).toBeVisible()
      await expect(fab).toBeDisabled()
      const fabBox = await fab.boundingBox()
      expect(fabBox?.width).toBe(65)
      expect(fabBox?.height).toBe(65)
    })
  }

  test('Home is aria-current + non-chromatic dot indicator; the other 3 items have neither and are out of tab order (criterion 17)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)

    const nav = page.getByRole('navigation', { name: 'Navegação principal' })
    const home = nav.getByRole('link')
    await expect(home).toHaveAttribute('aria-current', 'page')
    await expect(home).toHaveClass(/text-text-accent/)
    // Non-chromatic indicator: a 4px dot present only on the active item —
    // state is never color-only (ARCHITECTURE.md decision 4).
    await expect(home.locator('span[aria-hidden]')).toHaveCount(1)

    for (const label of ['Favoritos', 'Carrinho', 'Perfil']) {
      const btn = page.getByRole('button', { name: label })
      await expect(btn).toBeDisabled()
      await expect(btn).not.toHaveAttribute('aria-current', 'page')
      await expect(btn.locator('span[aria-hidden]')).toHaveCount(0)
    }
  })

  test('scrolled to the end at 390, the tab bar never covers the last content of <main> (padding-bottom 126px, criterion 18)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)

    const paddingBottom = await page
      .locator('main#main')
      .evaluate((el) => getComputedStyle(el).paddingBottom)
    expect(paddingBottom).toBe('126px')
  })
})

test.describe('Shell — crossing the breakpoint (edge case: resize 768 -> 1024+)', () => {
  test('resizing from 768 to 1280 swaps mobile for desktop composition with no crash and no leftover padding-bottom', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    await page.setViewportSize({ width: 768, height: 1024 })
    await boot(page)
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()
    await expect(page.locator('header')).toBeHidden()

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden()
    await expect(page.getByPlaceholder('Explorar coleções')).toBeHidden()

    const paddingBottom = await page
      .locator('main#main')
      .evaluate((el) => getComputedStyle(el).paddingBottom)
    expect(paddingBottom).toBe('0px')
    expect(consoleErrors).toEqual([])
  })
})

test.describe('Accessibility — keyboard navigation and focus (criterion 24)', () => {
  test('desktop: skip-link is the first focus stop; the KURIO wordmark and Início are reachable; disabled header controls are skipped', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'KURIO' }).first()).toBeFocused()
    // Visible focus indicator present (fix iteration 1: `linkFocusRing`
    // suppresses the native outline and renders the --ring box-shadow
    // instead — see the dedicated "plain <Link>" describe below for the
    // token-level assertion).
    const style = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement!)
      return { outline: cs.outlineStyle, boxShadow: cs.boxShadow }
    })
    expect(style.outline !== 'none' || style.boxShadow !== 'none').toBe(true)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Início' })).toBeFocused()

    // Next real stop is the footer newsletter input — disabled search/cart/Entrar
    // buttons never receive focus (out of tab order).
    await page.keyboard.press('Tab')
    const active = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      id: document.activeElement?.id,
    }))
    expect(active).toEqual({ tag: 'INPUT', id: 'newsletter-email' })
  })

  test('mobile: skip-link then the Home tab is the only other stop; Favoritos/Carrinho/Perfil/FAB never receive focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()

    await page.keyboard.press('Tab')
    const nav = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(nav.getByRole('link')).toBeFocused()
    // fix iteration 1: same visible-indicator check as the desktop test
    // above — `linkFocusRing` now renders a --ring box-shadow here too.
    const style = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement!)
      return { outline: cs.outlineStyle, boxShadow: cs.boxShadow }
    })
    expect(style.outline !== 'none' || style.boxShadow !== 'none').toBe(true)

    // One more Tab: nothing else is focusable (every other control is
    // disabled), so focus falls through to <body> — never lands on a
    // disabled button.
    await page.keyboard.press('Tab')
    const tag = await page.evaluate(() => document.activeElement?.tagName)
    expect(tag).not.toBe('BUTTON')
  })
})

test.describe('Accessibility — no horizontal overflow (criterion 23) and 200% zoom reflow (edge case)', () => {
  for (const width of [390, 768, 1440]) {
    test(`no horizontal overflow at ${width}px on /`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await boot(page)
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
    })
  }

  test('200% zoom at a 1440 baseline (proxied as a 720 CSS-px viewport, the effective viewport a real browser zoom leaves) produces no horizontal overflow', async ({
    page,
  }) => {
    // Playwright has no API for real browser page-zoom (Ctrl/Cmd +), which
    // is what CHALLENGE §8 means by "zoom 200%". A real zoom halves the CSS
    // pixels available to layout/media queries, so a 1440 window becomes a
    // 720 CSS-px viewport — that's the standard proxy for reflow testing.
    await page.setViewportSize({ width: 720, height: 450 })
    await boot(page)
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  })
})

test.describe('Primitives — skeleton shimmer preserves dimensions and respects prefers-reduced-motion (criterion 20)', () => {
  // `Skeleton` has no consumer in any phase-2 route (no card/grid exists yet
  // — spec's own "out of scope"), so `<Skeleton/>` never mounts through
  // real navigation. This probes the exact shipped CSS contract it relies
  // on (`animate-shimmer` utility + `rounded-lg bg-muted`, both already in
  // the production stylesheet) by mounting a DOM node with the same
  // classes the component's source uses — it exercises the compiled CSS,
  // not a re-declared component.
  test('a node sized via className keeps exactly 258x300, and the shimmer layer freezes under prefers-reduced-motion', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    await page.evaluate(() => {
      const d = document.createElement('div')
      d.id = 'skeleton-probe'
      d.className = 'relative overflow-hidden rounded-lg bg-muted h-[300px] w-[258px]'
      const inner = document.createElement('div')
      inner.setAttribute('aria-hidden', 'true')
      inner.className = 'absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-border-soft/40 to-transparent'
      d.appendChild(inner)
      document.body.appendChild(d)
    })

    const box = await page.locator('#skeleton-probe').boundingBox()
    expect(box?.width).toBe(258)
    expect(box?.height).toBe(300)

    const normalDuration = await page
      .locator('#skeleton-probe > div')
      .evaluate((el) => getComputedStyle(el).animationDuration)
    expect(normalDuration).toBe('1.5s')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reducedDuration = await page
      .locator('#skeleton-probe > div')
      .evaluate((el) => getComputedStyle(el).animationDuration)
    // Global media query in index.css zeroes it (not literally 0 — browsers
    // clamp to a tiny positive value — but far below the normal 1.5s).
    expect(parseFloat(reducedDuration)).toBeLessThan(0.01)
  })
})

test.describe('Primitives — sonner Toaster (criterion 21)', () => {
  test('the Toaster from __root.tsx mounts an accessible aria-live region', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)
    // No screen in phase 2 calls `toast()` (no mutation UI exists yet — out
    // of scope), so this asserts what IS verifiable without one: the
    // `<Toaster/>` mounted in `__root.tsx` renders its live region into the
    // DOM. sonner 2.x doesn't use `data-sonner-toaster` any more; it renders
    // an ARIA live-region `<section>` (react-aria "top layer").
    const region = page.locator('section[aria-live="polite"][aria-label*="Notifications"]')
    await expect(region).toHaveCount(1)
    await expect(region).toHaveAttribute('aria-relevant', 'additions text')
  })
})

/**
 * E2E-Tester pass (stage 3.5): everything below targets what only the
 * running system can show, and specifically the 3 non-blocking findings the
 * unit Tester left open in test-results.md. Does not duplicate anything
 * above (structure, pixel measurements, keyboard order, overflow, fixture
 * migration are already covered).
 */

test.describe('Primitives — Dialog/Sheet/Slider/Checkbox/toast exercised for real (criteria 19–21 + edge cases)', () => {
  // `Dialog`, `Sheet`, `Slider` and `Checkbox` have zero consumer in the
  // phase-2 route tree (confirmed by grepping `dist/assets/*.js` after a
  // real `pnpm build` — see Results) and no phase-2 screen calls `toast()`.
  // A production build/preview literally cannot exercise them: there is no
  // route that reaches them. The only honest way to drive them with a real
  // page and a real keyboard, without touching implementation source, is a
  // dev-only mount: `src/routes/e2e-sandbox.tsx` (new, added by this pass).
  // Its component is `import.meta.env.DEV ? SandboxPage : NotAvailable` —
  // Vite statically folds that to `NotAvailable` in `pnpm build`, so the
  // route's production chunk is ~0.1kB and pulls in none of these
  // primitives (verified: `grep DialogPrimitive|SheetPrimitive|
  // SliderPrimitive|CheckboxPrimitive dist/assets/*.js` matches nothing —
  // tree-shaking is exactly as intact as before this file existed). These
  // tests therefore spin up a throwaway `vite` dev server on a free port
  // and talk to it directly by absolute URL, leaving the shared
  // `webServer` (production preview) config and every other test in this
  // file untouched.
  test.describe.configure({ mode: 'serial' })

  let devServer: import('node:child_process').ChildProcess
  let sandboxUrl: string

  async function getFreePort(): Promise<number> {
    const net = await import('node:net')
    return new Promise((resolve, reject) => {
      const srv = net.createServer()
      srv.listen(0, () => {
        const { port } = srv.address() as import('node:net').AddressInfo
        srv.close(() => resolve(port))
      })
      srv.on('error', reject)
    })
  }

  async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(url)
        if (res.status < 500) return
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error(`dev server at ${url} never came up`)
  }

  test.beforeAll(async () => {
    const { spawn } = await import('node:child_process')
    const port = await getFreePort()
    sandboxUrl = `http://localhost:${port}/e2e-sandbox`
    devServer = spawn('node_modules/.bin/vite', ['--port', String(port), '--strictPort'], {
      stdio: 'ignore',
    })
    await waitForServer(sandboxUrl)
  })

  test.afterAll(() => {
    devServer?.kill()
  })

  test('Dialog traps focus inside its content and returns it to the trigger on Escape', async ({ page }) => {
    await page.goto(sandboxUrl)
    const trigger = page.getByRole('button', { name: 'Abrir diálogo' })
    await trigger.click()

    // Radix autofocuses the first focusable element inside the content.
    await expect(page.getByLabel('Campo dentro do diálogo')).toBeFocused()

    // Tab repeatedly: focus never escapes `[data-slot="dialog-content"]`.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const trapped = await page.evaluate(
        () => !!document.activeElement?.closest('[data-slot="dialog-content"]'),
      )
      expect(trapped).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(page.getByText('Diálogo de teste')).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Sheet traps focus inside its content and returns it to the trigger on Escape', async ({ page }) => {
    await page.goto(sandboxUrl)
    const trigger = page.getByRole('button', { name: 'Abrir painel' })
    await trigger.click()

    await expect(page.getByLabel('Campo dentro do painel')).toBeVisible()
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      const trapped = await page.evaluate(
        () => !!document.activeElement?.closest('[data-slot="sheet-content"]'),
      )
      expect(trapped).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(page.getByText('Painel de teste')).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Slider thumbs have distinct aria-labels and are keyboard-operable without their values crossing', async ({
    page,
  }) => {
    await page.goto(sandboxUrl)
    const min = page.locator('[role="slider"][aria-label="Preço mínimo"]')
    const max = page.locator('[role="slider"][aria-label="Preço máximo"]')
    await expect(min).toHaveAttribute('aria-valuenow', '20')
    await expect(max).toHaveAttribute('aria-valuenow', '80')

    await min.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    const minAfter = Number(await min.getAttribute('aria-valuenow'))
    const maxUnchanged = Number(await max.getAttribute('aria-valuenow'))
    expect(minAfter).toBeGreaterThan(20)
    expect(minAfter).toBeLessThanOrEqual(maxUnchanged) // never crosses the other thumb

    await max.focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    const maxAfter = Number(await max.getAttribute('aria-valuenow'))
    expect(maxAfter).toBeLessThan(maxUnchanged)
    expect(maxAfter).toBeGreaterThanOrEqual(minAfter) // never crosses the other thumb
  })

  test('Checkbox marks the checked state with a visible glyph, not color alone (edge case)', async ({ page }) => {
    await page.goto(sandboxUrl)
    const checkbox = page.getByRole('checkbox', { name: 'Aceito os termos' })
    await expect(checkbox).toHaveAttribute('data-state', 'unchecked')
    await expect(checkbox.locator('svg')).toHaveCount(0)

    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toHaveAttribute('data-state', 'checked')
    await expect(checkbox.locator('svg')).toHaveCount(1) // the Check glyph
  })

  test('toast() actually announces text inside the live region, not just an empty mounted region', async ({
    page,
  }) => {
    await page.goto(sandboxUrl)
    await page.getByRole('button', { name: 'Disparar toast' }).click()
    const region = page.locator('section[aria-live="polite"]')
    await expect(region).toContainText('Notificação de teste')
  })

  // E2E-tester regression check (fix iteration 1, focus review item 3): the
  // stray `data-[state=open]:*` classes removed from the Close buttons only
  // ever touched their own background/text color — confirm every other
  // interaction path survives the removal, not just Escape (already covered
  // above): outside click must still close the panel and return focus.
  test('Dialog closes on an outside click and returns focus to the trigger', async ({ page }) => {
    await page.goto(sandboxUrl)
    const trigger = page.getByRole('button', { name: 'Abrir diálogo' })
    await trigger.click()
    await expect(page.getByText('Diálogo de teste')).toBeVisible()

    // @radix-ui/react-dismissable-layer anexa o listener de pointerdown externo
    // dentro de um setTimeout(..., 0), de propósito, para não capturar o próprio
    // clique que abriu o painel. Sob contenção da suíte completa o clique
    // sintético do Playwright vencia essa corrida e o painel não fechava
    // (~1 falha em 3 rodadas, sempre mobile-chromium). Um round-trip pelo
    // macrotask queue da página drena o timer do Radix antes do clique: FIFO,
    // determinístico, não um sleep especulativo.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)))

    await page.mouse.click(5, 5) // corner of the viewport, outside the centered dialog content
    await expect(page.getByText('Diálogo de teste')).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Sheet closes on an outside click and returns focus to the trigger', async ({ page }) => {
    await page.goto(sandboxUrl)
    const trigger = page.getByRole('button', { name: 'Abrir painel' })
    await trigger.click()
    await expect(page.getByText('Painel de teste')).toBeVisible()

    // @radix-ui/react-dismissable-layer anexa o listener de pointerdown externo
    // dentro de um setTimeout(..., 0), de propósito, para não capturar o próprio
    // clique que abriu o painel. Sob contenção da suíte completa o clique
    // sintético do Playwright vencia essa corrida e o painel não fechava
    // (~1 falha em 3 rodadas, sempre mobile-chromium). Um round-trip pelo
    // macrotask queue da página drena o timer do Radix antes do clique: FIFO,
    // determinístico, não um sleep especulativo.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)))

    await page.mouse.click(5, 5) // corner of the viewport, outside the right-side panel
    await expect(page.getByText('Painel de teste')).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe('plain <Link> elements render the --ring token on focus-visible (fix iteration 1, criterion 24)', () => {
  // Every `<Link>` in the app (grep confirms exactly 4: header wordmark,
  // header Início, tab-bar Home, and 404's "Voltar ao início") now shares
  // `linkFocusRing` (src/lib/utils.ts): o mesmo mecanismo
  // `focus-visible:ring-[3px]` de `Button`/`Input`, mas a `/75` em vez de
  // `/50` — eles pareiam o `/50` com `border-ring` sólida, links não têm
  // borda e o anel precisa compositar >=3:1 sozinho. The systemic gap in
  // `Link` is closed; the 4th call-site (404) is
  // covered by the acceptance-criteria grep, not a test here — the
  // mechanism is identical.
  const RING_RGB = 'rgb(210, 138, 76)' // --ring = --color-primary = #d28a4c
  // Tailwind v4's `/50` alpha modifier compiles `--tw-ring-color` to
  // `color-mix(in oklab, var(--ring) 50%, transparent)`; Chromium keeps the
  // *computed* box-shadow color in that oklab() functional notation rather
  // than folding it back to rgb(), so `boxShadow` never literally contains
  // "210, 138, 76". `--tw-ring-color` itself resolves `var(--ring)` to its
  // hex value first, which is a stable, engine-independent way to prove the
  // same token drives the ring (verified empirically against dist/ preview).
  const RING_HEX = '#d28a4c'

  test('desktop: wordmark and Início render the --ring box-shadow on focus-visible, same token the newsletter Input uses', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // KURIO wordmark
    const wordmarkStyle = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement!)
      return {
        outline: cs.outlineStyle,
        boxShadow: cs.boxShadow,
        ringColor: cs.getPropertyValue('--tw-ring-color'),
      }
    })
    expect(wordmarkStyle.outline).toBe('none') // Tailwind v4 outline-none
    expect(wordmarkStyle.boxShadow).not.toBe('none') // ring box-shadow rendered
    expect(wordmarkStyle.ringColor).toContain(RING_HEX) // ring token applied

    await page.keyboard.press('Tab') // Início
    const inicioStyle = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement!)
      return {
        outline: cs.outlineStyle,
        boxShadow: cs.boxShadow,
        ringColor: cs.getPropertyValue('--tw-ring-color'),
      }
    })
    expect(inicioStyle.outline).toBe('none')
    expect(inicioStyle.boxShadow).not.toBe('none')
    expect(inicioStyle.ringColor).toContain(RING_HEX)

    // Control, same page: the one enabled input (newsletter) also turns its
    // border to the --ring token on focus-visible — same token, two
    // mechanisms (border vs. box-shadow ring), both wired to --ring. The
    // border-color utility has no alpha modifier, so it resolves straight
    // to rgb() — unlike the ring above, RING_RGB applies here directly.
    await page.keyboard.press('Tab') // newsletter email input
    const active = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      id: document.activeElement?.id,
      borderColor: getComputedStyle(document.activeElement!).borderColor,
    }))
    expect(active).toEqual({ tag: 'INPUT', id: 'newsletter-email', borderColor: RING_RGB })
  })

  test('mobile: tab-bar Home renders the --ring box-shadow on focus-visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // Home
    const homeStyle = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement!)
      return {
        outline: cs.outlineStyle,
        boxShadow: cs.boxShadow,
        ringColor: cs.getPropertyValue('--tw-ring-color'),
      }
    })
    expect(homeStyle.outline).toBe('none')
    expect(homeStyle.boxShadow).not.toBe('none')
    expect(homeStyle.ringColor).toContain(RING_HEX)
  })
})

test.describe('Zoom 200% at 1440 (edge case, CHALLENGE §8): footer/header content has no substitute at the mobile composition', () => {
  // The unit Tester's zoom-proxy test only checked for absence of
  // horizontal overflow. This checks the other half of the same CHALLENGE
  // §8 clause — "perda de conteúdo" — by asserting that footer-only content
  // (nav items, help/profile/collection links, the wallet chip, contact
  // info, the newsletter) is visible at 1440 and has NO visible equivalent
  // anywhere on the page once the viewport crosses under `lg` (the zoom
  // proxy), and that the mobile tab bar's 4 items don't reach any of it.
  const DESKTOP_ONLY_TEXT = [
    'Mercado',
    'Central de ajuda',
    'METAMASK  •  WALLETCONNECT  •  COINBASE',
    'contato@kurio.com',
    '+55 11 5555-0100',
    '© 2026 Kurio. Propriedade digital para todos.',
  ]

  test('header nav and all three footer bands are visible at 1440 and have no visible substitute at the 720 zoom-proxy viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)
    for (const text of DESKTOP_ONLY_TEXT) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible()
    }

    // Zoom proxy: halving the CSS-px viewport (1440 -> 720) is what a real
    // 200% browser zoom leaves behind (documented in the Tester's own test
    // above this one).
    await page.setViewportSize({ width: 720, height: 450 })
    for (const text of DESKTOP_ONLY_TEXT) {
      const matches = page.getByText(text, { exact: false })
      // The nodes still exist in the DOM (`hidden lg:block` is display:none,
      // not unmounted) — the point is that none of them is *visible* to a
      // sighted user who has just zoomed in, and nothing else on the page
      // repeats this content.
      for (const match of await matches.all()) {
        await expect(match).toBeHidden()
      }
    }

    // The tab bar is the only nav surface left, and it doesn't substitute
    // for any of the lost content (it only exposes Home/Favoritos/
    // Carrinho/Perfil, not links, contact info or the newsletter).
    const nav = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(nav).toBeVisible()
    await expect(nav.getByText(/ajuda|kurio\.com|newsletter|metamask/i)).toHaveCount(0)
  })
})

test.describe('NFT images in the production build (criterion: assets stable, no silent 404s, no external host)', () => {
  test('the 4 local webp files are served with a real image content-type, not the SPA HTML fallback', async ({
    page,
  }) => {
    await boot(page)
    // `vite preview` answers unmatched paths with `index.html` at status 200
    // (SPA fallback) — a bare status check would pass even for a missing
    // file. Asserting the content-type catches that silent-404 shape.
    for (const file of ['ape-01.webp', 'ape-02.webp', 'ape-03.webp', 'ape-04.webp']) {
      const res = await page.evaluate(async (f) => {
        const r = await fetch(`/nft/${f}`)
        return { status: r.status, contentType: r.headers.get('content-type') }
      }, file)
      expect(res.status).toBe(200)
      expect(res.contentType).toMatch(/^image\/webp/)
    }

    // Sanity check that the fallback shape above is real, not a fixture of
    // this dev machine: a genuinely missing file gets the HTML fallback.
    const missing = await page.evaluate(async () => {
      const r = await fetch('/nft/does-not-exist.webp')
      return { status: r.status, contentType: r.headers.get('content-type') }
    })
    expect(missing.contentType).toMatch(/^text\/html/)
  })

  test('no request during a clean boot goes to an external host', async ({ page }) => {
    const externalRequests: string[] = []
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.hostname !== 'localhost') externalRequests.push(req.url())
    })
    await boot(page)
    await page.waitForLoadState('networkidle')
    expect(externalRequests).toEqual([])
  })
})

test.describe('/e2e-sandbox in production (fix iteration 1, review item 1 regression)', () => {
  // Runs against the shared production `webServer` (pnpm build && pnpm
  // preview), unlike the dev-only sandbox describe above. Confirms the
  // `beforeLoad` gate lands on the real 404 boundary with no console error
  // and — the specific risk of a `beforeLoad` that throws — no flash of
  // `SandboxPage` content before the boundary renders.
  test('renders the __root 404 boundary, no console error, no flash of the dev-only sandbox content', async ({
    page,
  }) => {
    // Desktop viewport: the header (with the KURIO wordmark) is `hidden
    // lg:block`, so asserting its presence below is a real signal that the
    // full shell chrome (not a bare/special-cased 404) rendered.
    await page.setViewportSize({ width: 1440, height: 900 })

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (e) => pageErrors.push(e.message))

    // Sample the DOM repeatedly right after navigation commits, before the
    // network settles — a `beforeLoad` that threw asynchronously (it
    // doesn't here, but a future regression could reintroduce one) would
    // show SandboxPage's "Abrir diálogo" trigger for at least one frame.
    await page.goto('/e2e-sandbox', { waitUntil: 'commit' })
    const sawSandboxContent: boolean[] = []
    for (let i = 0; i < 8; i++) {
      sawSandboxContent.push(
        await page.evaluate(() => document.body.innerText.includes('Abrir diálogo')),
      )
      await page.waitForTimeout(20)
    }
    expect(sawSandboxContent.some(Boolean)).toBe(false)

    await page.waitForLoadState('networkidle')
    await expect(page.getByText('404', { exact: true })).toBeVisible()
    await expect(page.getByText('Esta página não existe.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible()
    // Same chrome (header/footer) as any other unknown route — not a
    // special-cased blank/empty state, the real shared 404 boundary.
    await expect(page.getByRole('link', { name: 'KURIO' }).first()).toBeVisible()

    expect(consoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
  })
})

test.describe('Focus ring on plain <Link> does not clip or overlap neighbouring content (fix iteration 1, review item 2 regression)', () => {
  // `linkFocusRing` renders as a 3px box-shadow ring rather than an outline
  // (Tailwind `outline-none`), which is visually clipped by `overflow:
  // hidden`/`clip` ancestors in a way a native outline never is, and can
  // visually collide with tightly-spaced neighbours. Neither hazard is
  // exercised by the existing token-presence test.
  test('desktop: wordmark and Início rings are not clipped by any ancestor and do not overlap the next nav item', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // wordmark
    const wordmarkOverflowChain = await page.evaluate(() => {
      const chain: string[] = []
      let el: Element | null = document.activeElement
      while (el) {
        chain.push(getComputedStyle(el).overflow)
        el = el.parentElement
      }
      return chain
    })
    expect(wordmarkOverflowChain.every((o) => o === 'visible')).toBe(true)

    await page.keyboard.press('Tab') // Início
    const { inicioRect, mercadoRect } = await page.evaluate(() => {
      const inicio = document.activeElement!
      const mercado = inicio.nextElementSibling! // the "Mercado" <span>
      return {
        inicioRect: inicio.getBoundingClientRect().toJSON(),
        mercadoRect: mercado.getBoundingClientRect().toJSON(),
      }
    })
    // The ring extends 3px past the element's own box on every side; as
    // long as the gap to the next item exceeds that, the ring can never
    // paint over sibling content.
    const gapToMercado = mercadoRect.x - (inicioRect.x + inicioRect.width)
    expect(gapToMercado).toBeGreaterThan(3)
  })

  test('mobile: tab-bar Home ring is not clipped by the fixed tab-bar container and does not overlap Favoritos', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // Home
    const overflowChain = await page.evaluate(() => {
      const chain: string[] = []
      let el: Element | null = document.activeElement
      while (el) {
        chain.push(getComputedStyle(el).overflow)
        el = el.parentElement
      }
      return chain
    })
    expect(overflowChain.every((o) => o === 'visible')).toBe(true)

    const { homeRect, nextRect } = await page.evaluate(() => {
      const home = document.activeElement!
      const nav = home.parentElement! // <nav>, items are its direct children
      const idx = Array.from(nav.children).indexOf(home)
      const next = nav.children[idx + 1] // the disabled "Favoritos" button
      return {
        homeRect: home.getBoundingClientRect().toJSON(),
        nextRect: next.getBoundingClientRect().toJSON(),
      }
    })
    const gapToFavoritos = nextRect.x - (homeRect.x + homeRect.width)
    expect(gapToFavoritos).toBeGreaterThan(3)
  })

  test('the ring color composites to >= 3:1 (WCAG SC 1.4.11) against both backgrounds it renders on (ink in the header, surface-card in the tab bar)', async ({
    page,
  }) => {
    // Fix iteration 2: this is now the real gate for SC 1.4.11, not a
    // report. The ring uses `focus-visible:ring-ring/75` (fix iteration 2 —
    // was `/50`, the same mechanism Button/Input still ship with).
    // Button/Input additionally get a solid `focus-visible:border-ring`,
    // which bare `<Link>` intentionally omits (no border to color), so the
    // ring alone has to clear 3:1 against every background it can sit on.
    // Everything measured below is parsed live from the page — nothing is
    // hardcoded into the blend — so a regression in `linkFocusRing` (e.g.
    // reverting to `/50`) fails this test via the alpha tripwire and/or the
    // contrast assertions themselves.
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // Home (tab-bar), shares linkFocusRing with the other 3 call-sites

    const { ringColorRaw, inkHex, surfaceCardHex } = await page.evaluate(() => {
      const ringColorRaw = getComputedStyle(document.activeElement!).getPropertyValue(
        '--tw-ring-color',
      )
      const root = getComputedStyle(document.documentElement)
      return {
        ringColorRaw,
        inkHex: root.getPropertyValue('--color-ink').trim(),
        surfaceCardHex: root.getPropertyValue('--color-surface-card').trim(),
      }
    })

    // `--tw-ring-color` resolves as `color-mix(in oklab, #d28a4c 75%,
    // transparent)` in Chromium (var(--ring) resolves to the hex; empirically
    // established in iteration 1 — this is why we read `--tw-ring-color`
    // rather than `boxShadow`, which stays stuck in `oklab()` notation).
    const hexMatch = ringColorRaw.match(/#[0-9a-fA-F]{6}/)
    // Percent-based color-mix syntax first; fallback covers a future engine
    // that resolves color-mix to a plain alpha-channel notation instead.
    const percentMatch = ringColorRaw.match(/(\d+(?:\.\d+)?)%\s*,/)
    const slashMatch = ringColorRaw.match(/\/\s*([\d.]+)\)/)

    if (!hexMatch || (!percentMatch && !slashMatch)) {
      throw new Error(`could not parse ring hex/alpha from --tw-ring-color: "${ringColorRaw}"`)
    }
    const ringHex = hexMatch[0]
    const alpha = percentMatch ? Number(percentMatch[1]) / 100 : Number(slashMatch![1])

    // Tripwire: if `linkFocusRing` regresses to `/50`, this fails before the
    // contrast math even runs.
    expect(alpha).toBe(0.75)
    expect(ringHex.toLowerCase()).toBe('#d28a4c')

    function hexToRgb(hex: string) {
      const n = Number.parseInt(hex.slice(1), 16)
      return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
    }
    function srgbToLin(c: number) {
      const cs = c / 255
      return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
    }
    function luminance([r, g, b]: number[]) {
      return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b)
    }
    function contrast(a: number[], b: number[]) {
      const l1 = luminance(a)
      const l2 = luminance(b)
      const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1]
      return (lighter + 0.05) / (darker + 0.05)
    }
    function blendOver(fg: number[], bg: number[], alpha: number) {
      return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i])
    }

    const ring = hexToRgb(ringHex)
    const ink = hexToRgb(inkHex)
    const surfaceCard = hexToRgb(surfaceCardHex)

    const ringOnInk = blendOver(ring, ink, alpha)
    const ringOnSurfaceCard = blendOver(ring, surfaceCard, alpha)

    // With alpha 0.75 these come out to ≈4.31:1 (ink) and ≈4.08:1
    // (surface-card, the worse case — it's the lighter background) — both
    // comfortably clear the WCAG 2.1 SC 1.4.11 non-text 3:1 minimum. This
    // is now the enforced gate, not a report: a regression to `/50` (≈2.55
    // and ≈2.53) fails here.
    console.log('ring-on-ink contrast', contrast(ringOnInk, ink))
    console.log('ring-on-surface-card contrast', contrast(ringOnSurfaceCard, surfaceCard))
    expect(contrast(ringOnInk, ink)).toBeGreaterThanOrEqual(3)
    expect(contrast(ringOnSurfaceCard, surfaceCard)).toBeGreaterThanOrEqual(3)
  })
})

test.describe('Full breakpoint round-trip (fix iteration 1 regression): 1440 -> keyboard -> 390 -> tab bar -> 1440', () => {
  test('no console error, no lost focus target, no overflow, across a continuous pass through both compositions', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page)

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // wordmark
    await expect(page.getByRole('link', { name: 'KURIO' }).first()).toBeFocused()
    await page.keyboard.press('Tab') // Início
    await expect(page.getByRole('link', { name: 'Início' })).toBeFocused()
    await page.keyboard.press('Tab') // falls through disabled search/cart/Entrar to the newsletter input
    await expect(page.locator('#newsletter-email')).toBeFocused()

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(100)

    await expect(page.locator('header')).toBeHidden()
    const tabBarNav = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(tabBarNav).toBeVisible()

    const home = tabBarNav.getByRole('link', { name: 'Home' }).or(tabBarNav.locator('a'))
    await home.first().click()
    await expect(page).toHaveURL('/')

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(100)

    await expect(page.locator('header')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden()
    await expect(page.locator('main')).toHaveCSS('padding-bottom', '0px')

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    expect(consoleErrors).toEqual([])
  })
})
