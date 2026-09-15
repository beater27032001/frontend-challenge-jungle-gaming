import { expect, test } from '@playwright/test'
import { apiFetch, boot, bootReset, isExpectedBootNoise, setScenario } from './helpers'

/**
 * E2E Tester pass, fase 3 (Início/catálogo) — first pass on this fase, no
 * defect open (the Tester's one finding was already fixed and re-verified in
 * `.pipeline/test-results.md`). This file does NOT repeat the 30 acceptance
 * criteria (`catalog.spec.ts` + `catalog-tester.spec.ts` already own that,
 * 88 tests). It covers only what a *running, continuous* session shows that
 * isolated per-criterion tests cannot: a long session crossing the URL in
 * non-happy orders, state surviving a breakpoint crossing between the two
 * distinct FilterPanel compositions (sidebar vs Sheet), out-of-order/empty
 * exercised as live mid-session transitions rather than boot params, skeleton
 * layout stability + reduced-motion, a full-session console/network audit,
 * and the fase-2 zoom debt re-verified specifically at the 1440 baseline the
 * spec's own equivalence math uses (1440 / 2 = 720 CSS px).
 */

test.describe('Long session across the URL (interleaved, non-happy order)', () => {
  test('search, filters, sort, and price interleave without URL/UI ever diverging, and survive a mid-session reload', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    const solana = page.getByRole('button', { name: 'Solana' })
    const art = page.getByRole('button', { name: 'Arte digital' })
    const emAlta = page.getByRole('link', { name: 'Em alta' })
    const searchBtn = page.locator('header').getByRole('button', { name: 'Buscar' })

    // 1. network filter
    await solana.click()
    expect(await page.evaluate(() => location.search)).toBe('?network=solana')
    await expect(solana).toHaveAttribute('aria-pressed', 'true')

    // 2. sort via tab (not the select — different control, same param)
    await emAlta.click()
    let search = await page.evaluate(() => location.search)
    expect(search).toContain('network=solana')
    expect(search).toContain('sort=popular')
    await expect(emAlta).toHaveAttribute('aria-current', 'page')
    await expect(solana).toHaveAttribute('aria-pressed', 'true') // untouched by the sort change

    // 3. category filter on top of network+sort — both rows must stay pressed
    await art.click()
    search = await page.evaluate(() => location.search)
    expect(search).toContain('category=art')
    expect(search).toContain('network=solana')
    expect(search).toContain('sort=popular')
    await expect(art).toHaveAttribute('aria-pressed', 'true')
    await expect(solana).toHaveAttribute('aria-pressed', 'true')

    // 4. price via the slider (a control with local draft state layered on
    // top of everything already applied) — must not drop the other 3 params
    const minThumb = page.getByRole('slider', { name: 'Preço mínimo' })
    await minThumb.click()
    await expect(minThumb).toBeFocused()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    search = await page.evaluate(() => location.search)
    expect(search).toContain('priceMin=0.05')
    expect(search).toContain('category=art')
    expect(search).toContain('network=solana')
    expect(search).toContain('sort=popular')
    expect(search).not.toContain('page=')

    // 5. search commit last — merges with prev, doesn't clobber the other 4
    await searchBtn.click()
    await page.locator('header').getByLabel('Explorar coleções').fill('a')
    await page.locator('header').getByLabel('Explorar coleções').press('Enter')
    search = await page.evaluate(() => location.search)
    expect(search).toContain('q=a')
    expect(search).toContain('priceMin=0.05')
    expect(search).toContain('category=art')
    expect(search).toContain('network=solana')
    expect(search).toContain('sort=popular')

    // Mid-session reload: every control must come back exactly as it was —
    // not just the URL (already proven for a single filter by catalog.spec.ts).
    await page.reload()
    await expect(art).toHaveAttribute('aria-pressed', 'true')
    await expect(solana).toHaveAttribute('aria-pressed', 'true')
    await expect(emAlta).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('header').getByRole('button', { name: 'Buscar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(await page.evaluate(() => location.search)).toBe(search)
    // Reopening the search shows the committed q, proving the reload restored
    // real URL state and not a component default.
    await page.locator('header').getByRole('button', { name: 'Buscar' }).click()
    await expect(page.locator('header').getByLabel('Explorar coleções')).toHaveValue('a')
  })

  test('page resets regardless of which control triggers the change, and 3 consecutive back/forward steps + a mid-sequence reload reconstruct every state exactly', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    // H1: a real 2-page filter (16 solana items)
    await page.getByRole('button', { name: 'Solana' }).click()
    // H2: page 2
    await page.getByRole('link', { name: '2', exact: true }).click()
    expect(await page.evaluate(() => location.search)).toBe('?network=solana&page=2')

    // H3: sort tab resets page (distinct trigger from catalog.spec.ts's own
    // category-after-page2 case)
    await page.getByRole('link', { name: 'Em alta' }).click()
    const searchH3 = await page.evaluate(() => location.search)
    expect(searchH3).toContain('network=solana')
    expect(searchH3).toContain('sort=popular')
    expect(searchH3).not.toContain('page=')

    // H4: page 2 again, now under the new sort
    await page.getByRole('link', { name: '2', exact: true }).click()
    const searchH4 = await page.evaluate(() => location.search)
    expect(searchH4).toContain('network=solana')
    expect(searchH4).toContain('sort=popular')
    expect(searchH4).toContain('page=2')

    // H5: price apply resets page — a 3rd distinct trigger type
    const minThumb = page.getByRole('slider', { name: 'Preço mínimo' })
    await minThumb.click()
    await expect(minThumb).toBeFocused()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    const searchH5 = await page.evaluate(() => location.search)
    expect(searchH5).toContain('priceMin=0.05')
    expect(searchH5).not.toContain('page=')

    // H6: search commit resets page — a 4th distinct trigger type, stacked
    // on top of the price filter still in the URL
    await page.locator('header').getByRole('button', { name: 'Buscar' }).click()
    await page.locator('header').getByLabel('Explorar coleções').fill('e')
    await page.locator('header').getByLabel('Explorar coleções').press('Enter')
    const searchH6 = await page.evaluate(() => location.search)
    expect(searchH6).toContain('q=e')
    expect(searchH6).toContain('priceMin=0.05')
    expect(searchH6).not.toContain('page=')

    // Walk back 3 steps: H6 -> H5 -> H4 -> H3, asserting the exact URL (byte
    // for byte against what was actually observed when that state was first
    // created — not a hand-guessed literal, since key order in the URL
    // follows accumulation history, not a fixed alphabetical/schema order)
    // and the UI it implies at every landing.
    await page.goBack()
    expect(await page.evaluate(() => location.search)).toBe(searchH5)

    await page.goBack()
    expect(await page.evaluate(() => location.search)).toBe(searchH4)
    await expect(page.getByRole('link', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page')

    // Reload right in the middle of the back-navigation sequence.
    await page.reload()
    expect(await page.evaluate(() => location.search)).toBe(searchH4)
    await expect(page.getByRole('link', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute('aria-current', 'page')

    await page.goBack()
    expect(await page.evaluate(() => location.search)).toBe(searchH3)
    await expect(page.getByRole('link', { name: 'Todos os NFTs' })).not.toHaveAttribute('aria-current', 'page')

    // Forward twice retraces H4 then H5 exactly.
    await page.goForward()
    expect(await page.evaluate(() => location.search)).toBe(searchH4)
    await page.goForward()
    expect(await page.evaluate(() => location.search)).toBe(searchH5)
  })
})

test.describe('Breakpoint crossing with shared URL state (desktop panel vs mobile Sheet)', () => {
  test('a filter applied on the desktop panel shows identically in the mobile Sheet, a change made in the Sheet reflects back on the desktop panel, in both directions, with no reload', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.getByRole('button', { name: 'Arte digital' }).click()
    await page.getByRole('button', { name: 'Polygon' }).click()
    expect(await page.evaluate(() => location.search)).toBe('?category=art&network=polygon')

    // Cross down to mobile — same session, no reload.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible()
    // The Sheet's own entrance transition is `duration-500` (sheet.tsx);
    // `toBeVisible()` only checks CSS visibility, not that the transform
    // animation (and Radix's post-animation focus handling) has settled —
    // interacting with the slider mid-transition intermittently drops
    // keyboard input when Radix's focus guard re-fires as the animation ends.
    await page.waitForTimeout(550)

    // The Sheet's FilterPanel is a SEPARATE component instance from the
    // sidebar's — both read the same URL, but nothing guarantees they agree
    // unless both are wired correctly. This is exactly where they could diverge.
    await expect(page.getByRole('button', { name: 'Arte digital' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Polygon' })).toHaveAttribute('aria-pressed', 'true')

    // Toggle category OFF from inside the Sheet.
    await page.getByRole('button', { name: 'Arte digital' }).click()
    expect(await page.evaluate(() => location.search)).toBe('?network=polygon')

    // Apply a price filter from inside the Sheet too.
    const minThumb = page.getByRole('slider', { name: 'Preço mínimo' })
    await minThumb.click()
    await expect(minThumb).toBeFocused()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    const search = await page.evaluate(() => location.search)
    expect(search).toContain('network=polygon')
    expect(search).toContain('priceMin=0.03')
    expect(search).not.toContain('category=')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Filtros' })).toBeHidden()

    // Cross back up to desktop — the sidebar panel (a mounted-but-hidden
    // instance the whole time) must show the state the Sheet just wrote.
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByRole('button', { name: 'Arte digital' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Polygon' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/0\.03 ETH\s*–\s*.*ETH/)).toBeVisible()
    expect(await page.evaluate(() => location.search)).toBe(search)
  })
})

test.describe('out-of-order in the running system: a cross-control race, not same-control twice', () => {
  test('a slow network-filter click immediately followed by a fast header search (which COMPOSES with it, not replaces it) never lets the stale single-filter response repaint the grid', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    // Two components race the same list query here (filter panel, then
    // header search) — catalog.spec.ts/catalog-tester.spec.ts only ever race
    // two clicks on the *same* control. Crucially, a search commit MERGES
    // with the URL (`{...prev, q, page: undefined}`), it doesn't replace the
    // network filter — so the correct settled state is the AND of both
    // (network=solana AND q=<title>), never just the network filter alone.
    const solana = (await apiFetch(page, '/api/nfts?network=solana&perPage=48')).body.items
    const target = solana[0]
    const other = solana[1]
    const combo = await apiFetch(page, `/api/nfts?network=solana&q=${encodeURIComponent(target.title)}`)
    expect(combo.body.total, 'fixture sanity: the title must isolate exactly one item').toBe(1)

    await setScenario(page, 'out-of-order')
    // Request 1 (network=solana, 1500ms — first call after the reset).
    await page.getByRole('button', { name: 'Solana' }).click()
    // Request 2 (network=solana&q=<title>, 100ms), fired by a DIFFERENT
    // component before request 1 resolves.
    await page.locator('header').getByRole('button', { name: 'Buscar' }).click()
    await page.locator('header').getByLabel('Explorar coleções').fill(target.title)
    await page.locator('header').getByLabel('Explorar coleções').press('Enter')

    await expect(page.getByRole('link', { name: target.title, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: other.title, exact: true })).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveText('1 NFTs encontrados')

    // Let the stale 1500ms "network=solana" (no q) response land — it must
    // not clobber the grid back to the unfiltered 16-item network result.
    await page.waitForTimeout(1700)
    await expect(page.getByRole('link', { name: target.title, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: other.title, exact: true })).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveText('1 NFTs encontrados')
    const params = await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))
    expect(params).toEqual({ network: 'solana', q: target.title })
  })
})

test.describe('empty scenario as a live mid-session transition (not a boot param)', () => {
  test('flipping the mock scenario to empty mid-session and triggering a refetch shows the real empty state, and "Limpar filtros" recovers coherently', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.getByRole('button', { name: 'Arte digital' }).click()
    await expect(page.getByRole('link').filter({ hasText: /ETH/ }).first()).toBeVisible()

    // Flip the scenario without a reload — the data source goes empty while
    // the user is mid-session, the way a real backend outage/emptying would.
    await setScenario(page, 'empty')
    // A different filter forces a fresh query key, so the flip is observed
    // by an actual refetch, not stale cache.
    await page.getByRole('button', { name: 'Solana' }).click()

    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    const clear = page.getByRole('link', { name: 'Limpar filtros' })
    await expect(clear).toBeVisible()
    await clear.click()
    expect(await page.evaluate(() => location.search)).toBe('')
    // Still empty (scenario is still 'empty'), but now with nothing active
    // to clear — the button must not linger past its own precondition.
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Limpar filtros' })).toHaveCount(0)

    // Recovery: back to default, full reload to confirm the real system
    // (not just component state) comes back.
    await setScenario(page, 'default')
    await page.reload()
    await expect(page.getByRole('link').filter({ hasText: /ETH/ }).first()).toBeVisible()
  })
})

test.describe('Skeleton in the slow scenario: dimension preserved, reduced-motion respected', () => {
  test('desktop grid: the same box (position + 300px height) the skeleton occupies is exactly what the first real card occupies, and the shimmer freezes under prefers-reduced-motion', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await boot(page, '?mock-reset=1&mock-scenario=slow')

    // `.grid-cols-3` alone: the actual token list is `hidden grid-cols-3
    // gap-x-[34px] gap-y-[56px] lg:grid` (Tailwind never emits a bare
    // "grid" token here, only the compound "lg:grid"), and this is the only
    // element in the page carrying it — the mobile masonry sibling (always
    // co-mounted, CSS-toggled) uses `flex gap-4 lg:hidden` instead.
    const grid = page.locator('#catalogo .grid-cols-3')
    const firstCell = page.locator('#catalogo .grid-cols-3 > :first-child > :first-child')
    await expect(firstCell).toBeVisible()

    const shimmer = page.locator('[data-slot="skeleton"] [aria-hidden]').first()
    const duration = await shimmer.evaluate((el) => getComputedStyle(el).animationDuration)
    // The global reduced-motion media query in index.css forces
    // `animation-duration: 0.01ms !important`; Chromium's computed style
    // reports that back in seconds notation (e.g. "1e-05s"), not "0.01ms" —
    // parse the number rather than string-matching the literal.
    expect(Number.parseFloat(duration)).toBeLessThan(0.001) // default (unfrozen) would read 1.5s

    const gridBefore = await grid.boundingBox()
    const cellBefore = await firstCell.boundingBox()
    expect(cellBefore?.height).toBe(300)

    // 'slow' delays every /api/* route uniformly, including the session
    // check the list query gates on — serial, roughly 2x 2500ms.
    await expect(page.getByRole('link').filter({ hasText: /ETH/ }).first()).toBeVisible({ timeout: 8000 })

    const gridAfter = await grid.boundingBox()
    const cellAfter = await firstCell.boundingBox()
    // No layout shift: same box, same position, same 300px height.
    expect(gridAfter).toEqual(gridBefore)
    expect(cellAfter).toEqual(cellBefore)
  })

  test('mobile masonry: the first card in each column keeps the same top-left position before and after data arrives', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page, '?mock-reset=1&mock-scenario=slow')

    // The desktop grid and the mobile masonry are always both mounted
    // (CSS-toggled, spec's "composições distintas coexistem" pattern) — the
    // masonry wrapper is the only `#catalogo` descendant carrying `flex
    // gap-4` (the desktop grid uses `grid-cols-3`, not `flex`/`gap-4`).
    const masonry = page.locator('#catalogo .flex.gap-4')
    const left = masonry.locator('> div').nth(0).locator('> div').first()
    const right = masonry.locator('> div').nth(1).locator('> div').first()
    await expect(left).toBeVisible()
    const leftBefore = await left.boundingBox()
    const rightBefore = await right.boundingBox()

    await expect(page.getByRole('link').filter({ hasText: /ETH/ }).first()).toBeVisible({ timeout: 8000 })

    const leftAfter = await left.boundingBox()
    const rightAfter = await right.boundingBox()
    expect(leftAfter?.x).toBe(leftBefore?.x)
    expect(leftAfter?.y).toBe(leftBefore?.y)
    expect(leftAfter?.width).toBe(leftBefore?.width)
    expect(rightAfter?.x).toBe(rightBefore?.x)
    expect(rightAfter?.y).toBe(rightBefore?.y)
  })
})

test.describe('Zero external dependency and clean console across a full interactive session', () => {
  test('search + filters + sort + pagination + a breakpoint switch produce no request to a non-localhost host and no console error beyond the scoped /api/auth/session noise', async ({
    page,
  }) => {
    const externalRequests: string[] = []
    const rawConsoleErrors: string[] = []
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.hostname !== 'localhost') externalRequests.push(req.url())
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') rawConsoleErrors.push(`${msg.text()} ${msg.location().url}`)
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.getByRole('button', { name: 'Arte digital' }).click()
    await page.getByRole('button', { name: 'Solana' }).click()
    await page.getByRole('link', { name: 'Em alta' }).click()
    const minThumb = page.getByRole('slider', { name: 'Preço mínimo' })
    await minThumb.click()
    await expect(minThumb).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Aplicar' }).click()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await page.keyboard.press('Escape')
    const input = page.getByPlaceholder('Explorar coleções')
    await input.fill('Neon')
    await input.press('Enter')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForLoadState('networkidle')

    // The gate must have real work to do here (anonymous boot's 401 on
    // /auth/session) — otherwise the filtered assertion below is vacuous.
    expect(rawConsoleErrors.some((m) => m.includes('/api/auth/session'))).toBe(true)

    const unexpected = rawConsoleErrors.filter((m) => !isExpectedBootNoise(m))
    expect(unexpected).toEqual([])
    expect(externalRequests).toEqual([])
  })
})

test.describe('Zoom 200% at 1440 (fase-2 debt, §8): the footer "Coleções" functional content specifically', () => {
  test('at the 720 CSS-px proxy for 1440 zoomed to 200%, all 5 footer-linked categories are reachable and operable via the Sheet, with no horizontal overflow', async ({
    page,
  }) => {
    // 1440 / 2 = 720 — the spec's own equivalence math ("1280 zoomed 200% ->
    // 640") applied to this fase's actual 1440 desktop baseline, as asked.
    await page.setViewportSize({ width: 720, height: 800 })
    await bootReset(page)

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    // The footer (and its "Coleções" column) is desktop-only — confirm the
    // content that would be lost really is inaccessible here, which is the
    // premise the Sheet has to make good on.
    await expect(page.getByRole('contentinfo')).toBeHidden()

    // Exactly the 5 categories the footer exposes (art/photography/music/
    // art-3d/utility — a subset of the 9 the Sheet offers).
    const FOOTER_CATEGORIES = [
      { label: 'Arte digital', slug: 'art' },
      { label: 'Fotografia', slug: 'photography' },
      { label: 'Música', slug: 'music' },
      { label: 'Arte 3D', slug: 'art-3d' },
      { label: 'Utilidade', slug: 'utility' },
    ]

    for (const { label, slug } of FOOTER_CATEGORIES) {
      await page.getByRole('button', { name: 'Filtrar' }).click()
      const row = page.getByRole('button', { name: label })
      await expect(row).toBeVisible()
      await row.click()
      expect(await page.evaluate(() => location.search)).toBe(`?category=${slug}`)
      await expect(row).toHaveAttribute('aria-pressed', 'true')
      // toggle off before the next iteration
      await row.click()
      expect(await page.evaluate(() => location.search)).toBe('')
      await page.keyboard.press('Escape')
    }
  })
})

test.describe('DEFECT: mutually-exclusive Link controls carry TanStack Router\'s own default aria-current alongside the app\'s explicit one', () => {
  // Found by the long-session test above (goBack landing on `sort=popular`
  // showed BOTH "Em alta" and "Todos os NFTs" as aria-current="page"). Isolated
  // here to the smallest possible repro, independent of any session/history
  // navigation — a single, fresh `page.goto` reproduces it every time.
  //
  // Root cause (read from the pinned dependency, not guessed): both
  // `ToolbarTab` (catalog-toolbar.tsx) and `CatalogPagination`'s page links
  // pass a `search` UPDATER FUNCTION to `<Link>` and rely on their OWN
  // explicit `aria-current={active ? 'page' : undefined}` prop to mark
  // exactly one control current. But `@tanstack/react-router`'s `<Link>`
  // (node_modules/@tanstack/react-router/dist/esm/link.js, `applyLinkState` /
  // `resolveIsActive`) ALSO computes its own `isActive` and — when active —
  // unconditionally sets `props['aria-current'] = 'page'` and
  // `props['data-status'] = 'active'` itself, layered on top of whatever the
  // developer passed. Its default `activeOptions` are
  // `{ includeSearch: true, partial: true, ignoreUndefined: true }` (i.e. no
  // `activeOptions` override on either component means partial/fuzzy search
  // matching, and any key the link's own `search` fn sets to `undefined` is
  // IGNORED in the comparison rather than required absent). So "Todos os
  // NFTs" — whose `search` fn is `{...prev, sort: undefined, page: undefined}`
  // — has, after `undefined`-stripping, NO search keys left to disagree with
  // the current URL, and the router considers it "active" (⊆ current)
  // whenever the pathname matches, REGARDLESS of what `sort`/`page` actually
  // is. Same mechanism hits `CatalogPagination`'s page-1 link (its own
  // `search` fn also clears `page` to `undefined` for n===1).
  //
  // Effect: two elements simultaneously claim `aria-current="page"` in the
  // same nav group — a real, user-facing feedback-correctness bug (screen
  // readers announce two "current page" tabs/pages at once; CHALLENGE §8's
  // "estado nunca só por cor" is undermined because the ONE non-chromatic
  // signal that's supposed to disambiguate now disagrees with itself), and
  // criterion 8's "aba ativa derivada da URL" (implying exactly one) does not
  // hold. Visually near-invisible on desktop (color/underline are correct,
  // driven by the app's own `active` boolean, not the Link's), which is
  // exactly why 304 pre-existing tests never caught it — every prior
  // `aria-current` assertion in this fase checked only the POSITIVE case
  // ("the right one has it"), never the negative one ("the others don't").
  //
  // Not fixed here per the Tester mandate. A plausible fix for whoever picks
  // this up: add `activeOptions={{ exact: true }}` (or `explicitUndefined:
  // true`) to `ToolbarTab`'s `<Link>` and to `CatalogPagination`'s page
  // links, so the router's own active-match no longer disagrees with the
  // component's explicit `aria-current` logic.
  test('toolbar: "Todos os NFTs" is ALSO aria-current="page" whenever any explicit sort is applied ("Novos lançamentos", "Em alta")', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Sanity: the plain default boot (no sort at all) is correct — exactly
    // one tab active. This is what makes the two cases below a real defect
    // and not a fixture/selector issue.
    await bootReset(page)
    await expect(page.getByRole('link', { name: 'Todos os NFTs' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Novos lançamentos' })).not.toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Em alta' })).not.toHaveAttribute('aria-current', 'page')

    await page.goto('/?sort=newest')
    await expect(page.getByRole('link', { name: 'Novos lançamentos' })).toHaveAttribute('aria-current', 'page')
    // EXPECTED (spec criterion 8, "ausente ou price-* → Todos os NFTs" —
    // an EXPLICIT sort must belong to exactly one tab): "Todos os NFTs"
    // should NOT also be current here.
    await expect(page.getByRole('link', { name: 'Todos os NFTs' })).not.toHaveAttribute('aria-current', 'page')

    await page.goto('/?sort=popular')
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Todos os NFTs' })).not.toHaveAttribute('aria-current', 'page')
  })

  test('pagination: page 1\'s link is ALSO aria-current="page" while on page 2 (same root cause, different component)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?network=solana&page=2')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('link', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page')
    // EXPECTED: page 1 is not the current page — `<nav aria-label="Paginação">`
    // should carry exactly one `aria-current="page"`, like any pagination.
    await expect(page.getByRole('link', { name: '1', exact: true })).not.toHaveAttribute('aria-current', 'page')
  })
})
