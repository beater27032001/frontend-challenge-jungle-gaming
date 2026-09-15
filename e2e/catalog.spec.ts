import { expect, test } from '@playwright/test'
import { ANA, apiFetch, boot, bootReset, isExpectedBootNoise, login, reset, setScenario } from './helpers'

/**
 * Catalogue domain spec (specs/03-catalogo.md + specs/02-design-system.md
 * §3/4) — the real Início screen that replaces the fase-2 smoke page.
 * Covers the URL-as-state contract, the `network` contract, MSW data
 * states (including `empty`/`out-of-order`, phase-1 debt closed here per
 * ARCHITECTURE.md "Dívidas para a fase 3" item 6), and navigation/shell.
 */

test.describe('URL is the source of truth for search/filter/sort/page', () => {
  test('deep link with a filter combo renders matching state, survives reload, and degrades invalid params', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    // Single-network filter (16 items) so page=2 is a real, non-empty page —
    // unlike category+network combos, capped at 6 items (never 2 pages).
    await boot(page, '?mock-reset=1&network=solana&sort=price-asc&page=2')

    await expect(page.getByRole('button', { name: 'Solana' })).toHaveAttribute('aria-pressed', 'true')
    const sortTrigger = page.getByRole('combobox', { name: 'Ordenar por' })
    await expect(sortTrigger).toContainText('Menor preço')
    await expect(page.getByRole('link', { name: '2' })).toHaveAttribute('aria-current', 'page')

    const expected = await apiFetch(page, '/api/nfts?network=solana&sort=price-asc&page=2')
    expect(expected.body.items.length).toBeGreaterThan(0)
    for (const item of expected.body.items) {
      await expect(page.getByRole('link', { name: item.title, exact: true })).toBeVisible()
    }

    // Reload preserves the same controls/results (criterion 2).
    await page.reload()
    await expect(page.getByRole('button', { name: 'Solana' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('link', { name: '2' })).toHaveAttribute('aria-current', 'page')

    // Invalid params degrade to the default catalogue, no crash (criterion 5).
    await page.goto('/?category=invalida&network=bitcoin&page=abc')
    await expect(page.getByRole('heading', { name: /seja dono d[oa]/i })).toBeVisible()
    expect(await page.evaluate(() => location.search)).toBe('')
  })

  test('a category+network combo marks both rows pressed and every card matches the intersection', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    // art∩polygon = {nft-010, nft-037} (deterministic: network offsets by
    // floor(i/9), so category and network are decorrelated — coder trap #3).
    const expected = await apiFetch(page, '/api/nfts?category=art&network=polygon')
    expect(expected.body.total).toBeGreaterThan(0)

    await page.goto('/?category=art&network=polygon')
    await expect(page.getByRole('button', { name: 'Arte digital' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Polygon' })).toHaveAttribute('aria-pressed', 'true')
    for (const item of expected.body.items) {
      await expect(page.getByRole('link', { name: item.title, exact: true })).toBeVisible()
    }
  })

  test('changing a filter mid-pagination resets page, and back/forward restore prior state step by step', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.goto('/?category=art')
    expect(await page.evaluate(() => location.search)).toContain('category=art')

    await page.goto('/?category=art&page=2')
    expect(await page.evaluate(() => location.search)).toContain('page=2')

    // Any filter/sort/search change resets pagination (criterion 3): applying
    // a network filter must drop `page` from the URL.
    await page.getByRole('button', { name: 'Polygon' }).click()
    let search = await page.evaluate(() => location.search)
    expect(search).toContain('network=polygon')
    expect(search).not.toContain('page=')

    await page.goBack()
    search = await page.evaluate(() => location.search)
    expect(search).toContain('page=2')
    expect(search).not.toContain('network=')

    await page.goBack()
    search = await page.evaluate(() => location.search)
    expect(search).toContain('category=art')
    expect(search).not.toContain('page=')

    await page.goForward()
    search = await page.evaluate(() => location.search)
    expect(search).toContain('page=2')
  })

  test('search commits `q` on Enter and clears it when submitted empty; none of the 7 params ever live in useState', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    const input = page.getByPlaceholder('Explorar coleções')
    await input.fill('Solar')
    await input.press('Enter')
    expect(await page.evaluate(() => location.search)).toContain('q=Solar')

    await input.fill('')
    await input.press('Enter')
    expect(await page.evaluate(() => location.search)).not.toContain('q=')
  })

  test('desktop header search: Enter commits and closes, Escape discards the draft and returns focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    const header = page.locator('header')
    const button = header.getByRole('button', { name: 'Buscar' })
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const field = header.getByLabel('Explorar coleções')
    await expect(field).toBeFocused()

    await field.fill('zzz-draft')
    await field.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(button).toBeFocused()
    expect(await page.evaluate(() => location.search)).toBe('')

    await button.click()
    // Reopening shows the committed `q`, not the discarded draft (edge case).
    await expect(header.getByLabel('Explorar coleções')).toHaveValue('')

    await header.getByLabel('Explorar coleções').fill('Neon')
    await header.getByLabel('Explorar coleções').press('Enter')
    expect(await page.evaluate(() => location.search)).toContain('q=Neon')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('tabs write sort shortcuts and drive the active/underline state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.getByRole('link', { name: 'Em alta' }).click()
    expect(await page.evaluate(() => location.search)).toContain('sort=popular')
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('combobox', { name: 'Ordenar por' }).click()
    await page.getByRole('option', { name: 'Listados recentemente' }).click()
    expect(await page.evaluate(() => location.search)).not.toContain('sort=')
    await expect(page.getByRole('link', { name: 'Todos os NFTs' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('network contract (resolução OQ3)', () => {
  test('network=solana returns exactly 16 items, all solana; an unknown network is a 400', async ({ page }) => {
    await bootReset(page)
    const solana = await apiFetch(page, '/api/nfts?network=solana&perPage=48')
    expect(solana.status).toBe(200)
    expect(solana.body.total).toBe(16)
    for (const item of solana.body.items) expect(item.network).toBe('solana')

    const bogus = await apiFetch(page, '/api/nfts?network=bitcoin')
    expect(bogus.status).toBe(400)
    expect(bogus.body.error.code).toBe('validation_error')
  })

  test('every category×network pair has at least one NFT, and list items carry `network`', async ({ page }) => {
    await bootReset(page)
    const combo = await apiFetch(page, '/api/nfts?category=art&network=polygon')
    expect(combo.body.total).toBeGreaterThanOrEqual(1)

    const list = await apiFetch(page, '/api/nfts?perPage=1')
    expect(list.body.items[0]).toHaveProperty('network')
  })
})

test.describe('Data states (skeleton/empty/error/background update)', () => {
  test('slow scenario shows 12 same-sized skeletons with no layout shift once data arrives', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page, '?mock-reset=1&mock-scenario=slow')

    // Scoped to the main column: the sidebar's FeaturedBanner also renders a
    // (368px) skeleton while its own query is pending, and comes first in
    // DOM order — unscoped `.first()` would grab that one instead.
    const skeleton = page.locator('#catalogo [data-slot="skeleton"]').first()
    await expect(skeleton).toBeVisible()
    const before = await skeleton.boundingBox()

    // 'slow' delays EVERY /api/* route uniformly, including the session
    // check the list query gates on (`enabled: !session.isPending`) — the
    // two waits are serial under this scenario, ~2x the single 2500ms delay.
    await expect(page.getByRole('link').filter({ hasText: /ETH/ }).first()).toBeVisible({ timeout: 8000 })
    // The first real card's artwork placeholder occupies the same box the
    // skeleton did (h-[300px] w-full at this viewport).
    expect(before?.height).toBe(300)
  })

  test('empty scenario shows "Nenhum NFT encontrado" with a working "Limpar filtros"; banner hides too', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page, '?mock-reset=1&mock-scenario=empty&category=art')

    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByText('NFT EM DESTAQUE')).toHaveCount(0)

    const clear = page.getByRole('link', { name: 'Limpar filtros' })
    await expect(clear).toBeVisible()
    await clear.click()
    expect(await page.evaluate(() => location.search)).toBe('')
  })

  test('server-error scenario shows a retry affordance that recovers without reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page, '?mock-reset=1&mock-scenario=server-error')

    await expect(page.getByText('Não foi possível carregar o catálogo.')).toBeVisible()
    const retry = page.getByRole('button', { name: 'Tentar novamente' })
    await expect(retry).toBeVisible()

    await setScenario(page, 'default')
    await retry.click()
    await expect(page.getByRole('link').first()).toBeVisible({ timeout: 5000 })
  })

  test('out-of-order scenario: a fast second response is not clobbered by a slower stale first response', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await setScenario(page, 'out-of-order')

    // Request 1 (category=art, 1500ms) then immediately request 2
    // (category=photography, 100ms) — the stale 1500ms response must never
    // repaint the grid after the fast one already resolved.
    await page.getByRole('button', { name: 'Arte digital' }).click()
    await page.getByRole('button', { name: 'Fotografia' }).click()

    await expect(page.getByRole('button', { name: 'Fotografia' })).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(1700) // past the 1500ms stale response's arrival

    await expect(page.getByRole('button', { name: 'Fotografia' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Arte digital' })).toHaveAttribute('aria-pressed', 'false')
    const expectedPhotography = await apiFetch(page, '/api/nfts?category=photography')
    for (const item of expectedPhotography.body.items.slice(0, 3)) {
      await expect(page.getByRole('link', { name: item.title, exact: true })).toBeVisible()
    }
  })

  test('paginating keeps the previous page visible with aria-busy during the background fetch', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await setScenario(page, 'slow')
    await page.goto('/')

    await page.getByRole('link', { name: '2', exact: true }).click()
    const container = page.locator('[aria-busy]').first()
    await expect(container).toHaveAttribute('aria-busy', 'true')
    await expect(container).toHaveClass(/opacity-60/)
  })

  test('the live region announces the result count and updates it on filter change', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await expect(page.getByRole('status')).toHaveText('48 NFTs encontrados')
    await page.getByRole('button', { name: 'Solana' }).click()
    await expect(page.getByRole('status')).toHaveText('16 NFTs encontrados')
  })

  test('featured banner shows the featured NFT by default and disappears in the empty scenario', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await expect(page.getByText('NFT EM DESTAQUE')).toBeVisible()
    await expect(page.getByText('OFERTA LIMITADA')).toBeVisible()

    await setScenario(page, 'empty')
    await page.reload()
    await expect(page.getByText('NFT EM DESTAQUE')).toHaveCount(0)
  })

  test('facet counts match the fixtures: categories split 6/5, networks split 16/16/16', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await expect(page.getByRole('button', { name: 'Arte digital' })).toContainText('6')
    await expect(page.getByRole('button', { name: 'Generativa' })).toContainText('5')
    await expect(page.getByRole('button', { name: 'Ethereum' })).toContainText('16')
    await expect(page.getByRole('button', { name: 'Polygon' })).toContainText('16')
    await expect(page.getByRole('button', { name: 'Solana' })).toContainText('16')
  })
})

test.describe('Navigation and shell', () => {
  test('clicking a card navigates to the real detail page, and a direct hit/refresh on it works too (fase 4)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    const card = page.getByRole('link').filter({ hasText: /ETH/ }).first()
    const title = await card.getAttribute('aria-label')
    await card.click()
    await expect(page).toHaveURL(/\/nft\/nft-\d+/)
    // Fase 4 substitui o stub ("Detalhes do NFT") pela tela real — o <h1>
    // agora carrega o título do NFT vindo da API (e2e/nft-detail.spec.ts
    // cobre o resto do critério de aceite 1).
    await expect(page.getByRole('heading', { level: 1, name: title! })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: title! })).toBeVisible()
  })

  test('header marks "Mercado" active on the detail route, and nothing active on a 404', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await boot(page, '?mock-reset=1')

    await page.goto('/nft/nft-001')
    const mercado = page.locator('header').getByText('Mercado', { exact: true })
    await expect(mercado).toHaveClass(/text-text-accent/)
    await expect(page.locator('header').getByRole('link', { name: 'Início' })).not.toHaveClass(/text-text-accent/)

    await page.goto('/rota-que-nao-existe')
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  })

  test('the 5 footer collection links navigate to / with the matching category applied', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.getByRole('link', { name: 'Fotografia' }).click()
    expect(await page.evaluate(() => location.search)).toContain('category=photography')
    await expect(page.getByRole('button', { name: 'Fotografia' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('mobile: the filter Sheet traps focus, Escape returns it to the button, and applying a category updates the masonry', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    const filterButton = page.getByRole('button', { name: 'Filtrar' })
    await filterButton.click()
    await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible()

    await page.getByRole('button', { name: 'Música' }).click()
    expect(await page.evaluate(() => location.search)).toContain('category=music')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Filtros' })).toBeHidden()
    await expect(filterButton).toBeFocused()
  })

  test('zoom-proxy viewport (640x800) has no horizontal overflow and the category filter stays reachable via the Sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 800 })
    await bootReset(page)

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page.getByRole('button', { name: 'Arte digital' })).toBeVisible()
  })

  for (const width of [390, 768, 1440]) {
    test(`no horizontal overflow at ${width}px with default catalogue data`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await bootReset(page)
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    })
  }

  test('keyboard: Tab from the skip link reaches search, tabs, sort, filter rows, the price slider, cards and pagination', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    // Dívida 1 da fase 3 fechada (ARCHITECTURE.md "Dívidas para a fase 4"
    // item 1): flake de ~1 em 20 vinha de uma contagem fixa de 4 Tabs sem
    // asserção intermediária — assere o foco a cada Tab, não só no fim.
    await page.keyboard.press('Tab') // skip-link
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
    await page.keyboard.press('Tab') // wordmark
    await expect(page.getByRole('link', { name: 'KURIO' })).toBeFocused()
    await page.keyboard.press('Tab') // Início
    await expect(page.getByRole('link', { name: 'Início' })).toBeFocused()
    await page.keyboard.press('Tab') // Buscar
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeFocused()

    const categoryRow = page.getByRole('button', { name: 'Arte digital' })
    await categoryRow.focus()
    await expect(categoryRow).toBeFocused()

    const minThumb = page.locator('[role="slider"][aria-label="Preço mínimo"]')
    await minThumb.focus()
    const before = await minThumb.getAttribute('aria-valuenow')
    await page.keyboard.press('ArrowRight')
    const after = await minThumb.getAttribute('aria-valuenow')
    expect(Number(after)).toBeGreaterThan(Number(before))

    const sortTrigger = page.getByRole('combobox', { name: 'Ordenar por' })
    await sortTrigger.focus()
    await expect(sortTrigger).toBeFocused()

    const firstCard = page.getByRole('link').filter({ hasText: /ETH/ }).first()
    await firstCard.focus()
    await expect(firstCard).toBeFocused()

    const pageTwo = page.getByRole('link', { name: '2', exact: true })
    await pageTwo.focus()
    await expect(pageTwo).toBeFocused()
  })

  test('mobile card: favourite heart is a disabled placeholder; rarity badge only shows on rare/epic/legendary', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    const heart = page.getByRole('button', { name: 'Favoritar' }).first()
    await expect(heart).toBeVisible()
    await expect(heart).toBeDisabled()

    // nft-037 is on page 1 (default `newest` sort) and `epic` (RARITY_OFFSET=2
    // on the fixed rarity table) — badge must read ÉPICO. Not every page-1
    // card is rare+, so the badge count must stay under the 12-card page size
    // (`common` cards render none, criterion 28).
    const epicCard = await apiFetch(page, '/api/nfts/nft-037')
    expect(epicCard.body.rarity).toBe('epic')
    // 3 epic NFTs land on page 1 by design (nft-037/041/045) — only the
    // mobile card renders a badge at all (desktop card has none, spec §4).
    await expect(page.getByText('ÉPICO').first()).toBeVisible()
    const badges = page.locator('span', { hasText: /^(RARO|ÉPICO|LENDÁRIO)$/ })
    expect(await badges.count()).toBeGreaterThan(0)
    expect(await badges.count()).toBeLessThan(12)
  })
})

test.describe('Cross-user cache isolation (criterion 12, spec query-key scoping)', () => {
  test('logging in as Ana and reloading never leaks a guest catalogue query into her scope', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)
    await page.reload()
    await expect(page.getByRole('link').filter({ hasText: /ETH/ }).first()).toBeVisible()
    await reset(page)
  })
})

/**
 * Dívida 4 da fase 3 fechada (ARCHITECTURE.md "Dívidas para a fase 4" item
 * 4): `catalog-tester.spec.ts` e `catalog-e2e-tester.spec.ts` fundidos aqui
 * como `describe`s — testes preservados, não deletados (mesmo movimento da
 * fase 2, specs/02-design-system.md §6). Nada abaixo foi reescrito, só
 * realocado; os dois arquivos de origem foram apagados.
 */

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

  // Fase 4 (specs/04-detalhe-nft.md §4, ARCHITECTURE.md fase 4 decisão 6):
  // `/nft/*` mobile deixa de ter MobileSearchBar/TabBar (a Buy Bar ocupa o
  // fundo) — este teste, herdado da fase 3, assumia que a busca inline
  // funcionava em QUALQUER rota não-catálogo; `/nft/*` era a única rota
  // assim e passou a não ter mais o campo. Ajustado (não deletado, mesmo
  // precedente da fusão desta fase) para a nova asserção negativa —
  // e2e/nft-detail.spec.ts cobre o critério 16 por completo.
  test('MobileSearchBar is absent from /nft/$nftId (fase 4: the Buy Bar takes its place)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    await page.goto('/nft/nft-001')
    await expect(page.getByPlaceholder('Explorar coleções')).toHaveCount(0)
  })
})

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
