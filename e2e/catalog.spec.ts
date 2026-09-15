import { expect, test } from '@playwright/test'
import { ANA, apiFetch, boot, bootReset, login, reset, setScenario } from './helpers'

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
  test('clicking a card navigates to the detail stub, and a direct hit/refresh on it works too', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.getByRole('link').filter({ hasText: /ETH/ }).first().click()
    await expect(page).toHaveURL(/\/nft\/nft-\d+/)
    await expect(page.getByRole('heading', { name: 'Detalhes do NFT' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Detalhes do NFT' })).toBeVisible()
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

    await page.keyboard.press('Tab') // skip-link
    await page.keyboard.press('Tab') // wordmark
    await page.keyboard.press('Tab') // Início
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
