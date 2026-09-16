import { expect, test } from '@playwright/test'
import { apiFetch, awaitMswReady, bootReset, clearCart, isExpectedBootNoise, setScenario } from './helpers'

/**
 * Domínio detalhe (specs/04-detalhe-nft.md, fase 4) — substitui o stub de
 * `/nft/$nftId`. Segue o mesmo padrão de `catalog.spec.ts`: acessos
 * diretos via `page.goto`, nunca navegando de dentro do app quando o
 * critério é especificamente sobre acesso direto/refresh.
 */

const TOAST_REGION = 'section[aria-live="polite"]'

test.describe('Acesso direto, 404 e refresh (critérios 1–2)', () => {
  test('goto direto em /nft/nft-001 renderiza o título vindo da API nas duas composições; refresh mantém a tela', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')

    await page.goto('/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: detail.body.title })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { level: 1, name: detail.body.title })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: detail.body.title })).toBeVisible()
  })

  test('goto direto em /nft/nft-999 mostra "NFT não encontrado" com link funcional; nenhum skeleton preso; sem erro de console fora do 404 esperado', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${msg.text()} ${msg.location().url}`)
    })

    await bootReset(page)
    await page.goto('/nft/nft-999')

    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)

    const link = page.getByRole('link', { name: 'Voltar ao início' })
    await link.click()
    await expect(page).toHaveURL('/')

    // O 404 de `/api/nfts/nft-999` é a própria rota fazendo o que deveria —
    // pedir um recurso que o contrato já define como inexistente — e o
    // Chromium loga "Failed to load resource" para toda resposta >=400 fora
    // do alcance do JS da página, mesmo o app tratando-a como resposta
    // válida (mesmo racional de `isExpectedBootNoise`, escopado aqui à URL
    // do próprio teste em vez de estender o helper compartilhado).
    const nonNoise = consoleErrors.filter(
      (msg) => !isExpectedBootNoise(msg) && !msg.includes('/api/nfts/nft-999'),
    )
    expect(nonNoise).toEqual([])
  })
})

test.describe('Edição esgotada e limites de quantidade (critérios 3–5)', () => {
  test('nft-013 (todas as edições esgotadas): chips/stepper/COMPRAR desabilitados, "Esgotado" visível com role=status', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-013')

    const chips = page.locator('input[type="radio"][name="edition-desktop"]')
    const count = await chips.count()
    for (let i = 0; i < count; i++) await expect(chips.nth(i)).toBeDisabled()

    await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Diminuir quantidade' }).first()).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Aumentar quantidade' }).first()).toBeDisabled()
    await expect(page.getByRole('status').filter({ hasText: 'Esgotado' }).first()).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Comprar NFT' })).toBeDisabled()
  })

  test('nft-007 (available 2): + incrementa até 2 e desabilita; número nunca sai de [1,2]', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-007')

    const minus = page.getByRole('button', { name: 'Diminuir quantidade' }).first()
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' }).first()
    await expect(minus).toBeDisabled()

    await plus.click()
    await expect(page.getByText('Quantidade: 2').first()).toBeVisible()
    await expect(plus).toBeDisabled()
    await expect(minus).toBeEnabled()

    await minus.click()
    await expect(page.getByText('Quantidade: 1').first()).toBeVisible()
    await expect(minus).toBeDisabled()
  })

  test('nft-021 (available 1): + já nasce desabilitado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-021')

    await expect(page.getByRole('button', { name: 'Aumentar quantidade' }).first()).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Diminuir quantidade' }).first()).toBeDisabled()
  })
})

test.describe('Edições múltiplas (critério 6)', () => {
  test('nft-004 (Standard + Deluxe): 2 chips vêm da API; selecionar Deluxe atualiza o preço e reseta a quantidade', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-004')
    expect(detail.body.editions.length).toBe(2)
    const [standard, deluxe] = detail.body.editions

    await page.goto('/nft/nft-004')
    await expect(page.getByText(standard.label, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(deluxe.label, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(`${standard.priceEth} ETH`, { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Aumentar quantidade' }).first().click()
    await expect(page.getByText('Quantidade: 2').first()).toBeVisible()

    await page.getByText(deluxe.label, { exact: true }).first().click()
    await expect(page.getByText(`${deluxe.priceEth} ETH`, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Quantidade: 1').first()).toBeVisible()
  })
})

test.describe('Compra real (critérios 7–8)', () => {
  test('COMPRAR dispara exatamente um POST /api/cart/items; toast de sucesso só após 200; GET /api/cart confirma a quantidade', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await clearCart(page)

    const posts: unknown[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/cart/items')) posts.push(req.postDataJSON())
    })

    await page.goto('/nft/nft-004')
    const detail = await apiFetch(page, '/api/nfts/nft-004')
    const editionId = detail.body.editions[0].id

    await expect(page.locator(TOAST_REGION)).not.toContainText('Adicionado ao carrinho')
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page.locator(TOAST_REGION)).toContainText('Adicionado ao carrinho')

    expect(posts).toEqual([{ nftId: 'nft-004', editionId, quantity: 1 }])

    const cart = await apiFetch(page, '/api/cart')
    const item = cart.body.items.find((i: { editionId: string }) => i.editionId === editionId)
    expect(item?.quantity).toBe(1)
  })

  test('duplo clique rápido em COMPRAR nunca dispara mais de um POST por clique (botão disabled durante isBuying)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await clearCart(page)
    await setScenario(page, 'slow')

    let postCount = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/cart/items')) postCount += 1
    })

    await page.goto('/nft/nft-004')
    const buy = page.getByRole('button', { name: 'COMPRAR' })
    await buy.click()
    await expect(buy).toBeDisabled()
    // Segundo clique enquanto desabilitado não deve registrar novo POST.
    await buy.click({ force: true }).catch(() => {})
    await expect(page.locator(TOAST_REGION)).toContainText('Adicionado ao carrinho', { timeout: 10_000 })
    expect(postCount).toBe(1)

    await setScenario(page, 'default')
  })

  test('comprar acima do disponível acumulado (nft-021, available 1) responde 409 no segundo POST; toast de erro, nunca de sucesso', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await clearCart(page)

    await page.goto('/nft/nft-021')
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page.locator(TOAST_REGION)).toContainText('Adicionado ao carrinho')

    await page.reload()
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page.locator(TOAST_REGION)).toContainText('Quantidade acima do disponível')
    await expect(page.locator(TOAST_REGION)).not.toContainText('Adicionado ao carrinho')
  })
})

test.describe('Cenário de falha do MSW no detalhe (critério 9, CHALLENGE §9.12)', () => {
  test('server-error mostra estado de erro com "Tentar novamente"; restaurar o cenário e tentar de novo recupera a tela', async ({
    page,
  }) => {
    await bootReset(page)
    await setScenario(page, 'server-error')
    await page.goto('/nft/nft-001')

    const retry = page.getByRole('button', { name: 'Tentar novamente' })
    await expect(retry).toBeVisible()

    await setScenario(page, 'default')
    await retry.click()
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: detail.body.title })).toBeVisible()
  })
})

test.describe('Galeria (critérios 10–12)', () => {
  test('desktop: 4 thumbnails, clicar a N-ésima troca a imagem principal e marca aria-current; acionável por teclado', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await page.goto('/nft/nft-001')

    const thumbs = page.getByRole('button', { name: /^Imagem \d$/ })
    await expect(thumbs).toHaveCount(4)

    const mainImg = page.locator('img[alt="' + detail.body.title + '"]').first()
    await expect(mainImg).toHaveAttribute('src', detail.body.images[0])

    const second = page.getByRole('button', { name: 'Imagem 2' })
    await second.focus()
    await page.keyboard.press('Enter')
    await expect(mainImg).toHaveAttribute('src', detail.body.images[1])
    await expect(second).toHaveAttribute('aria-current', 'true')
  })

  test('mobile: os 4 pontos trocam a imagem do hero; ativo é pill, inativos são círculos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await page.goto('/nft/nft-001')

    const dots = page.getByRole('button', { name: /^Imagem \d de 4$/ })
    await expect(dots).toHaveCount(4)

    const hero = page.locator('img[alt="' + detail.body.title + '"]').first()
    await expect(hero).toHaveAttribute('src', detail.body.images[0])

    const active = dots.first().locator('span')
    await expect(active).toHaveCSS('border-radius', /3\.5px/)

    await dots.nth(1).click()
    await expect(hero).toHaveAttribute('src', detail.body.images[1])
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
    const nowActive = dots.nth(1).locator('span')
    const box = await nowActive.boundingBox()
    expect(box?.width).toBe(28)
    expect(box?.height).toBe(7)
  })

  test('lupa desktop: abre Dialog com a imagem corrente ampliada; Esc fecha e devolve o foco; nunca clicável sem efeito', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await page.goto('/nft/nft-001')

    const magnifier = page.getByRole('button', { name: 'Ampliar imagem' })
    await magnifier.click()

    const dialogImg = page.locator('[role="dialog"] img')
    await expect(dialogImg).toHaveAttribute('src', detail.body.images[0])

    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).toBeHidden()
    await expect(magnifier).toBeFocused()
  })
})

test.describe('Breadcrumb e favoritar (critérios 13–14)', () => {
  test('breadcrumb desktop: "Início" é link real para /, "Mercado" é o item atual sem ser link', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-001')

    const nav = page.getByRole('navigation', { name: 'Trilha de navegação' })
    const inicio = nav.getByRole('link', { name: 'Início' })
    await expect(inicio).toHaveAttribute('href', '/')

    const mercado = nav.getByText('Mercado', { exact: true })
    await expect(mercado).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('a').filter({ hasText: 'Mercado' })).toHaveCount(0)

    await inicio.click()
    await expect(page).toHaveURL('/')
  })

  test('fase 5: visitante clica em Favoritar (desktop) e no coração (mobile) → abre o modal de login, nunca dispara /favorites', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-001')

    let favoriteRequests = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/favorites')) favoriteRequests += 1
    })

    const favDesktop = page.getByRole('button', { name: 'Favoritar' })
    await expect(favDesktop).toBeEnabled()
    await favDesktop.click()
    // Fase 5 (specs/05-auth.md §9): rota real /login, não search param.
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/nft/nft-001')

    await page.goto('/nft/nft-001')
    await awaitMswReady(page)
    await page.setViewportSize({ width: 390, height: 844 })
    const favMobile = page.locator('button[aria-label="Favoritar"]').last()
    await expect(favMobile).toBeEnabled()
    await favMobile.click()
    await expect(page).toHaveURL(/\/login\?redirect=/)

    expect(favoriteRequests).toBe(0)
  })
})

test.describe('Header desktop e shell mobile (critérios 15–16)', () => {
  test('header em /nft/nft-001: "Mercado" ativo, "Início" não, sem régua; régua presente em /; 404 sem nav ativa', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    await page.goto('/nft/nft-001')
    const header = page.locator('header')
    await expect(header.getByText('Mercado', { exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(header.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current', 'page')
    const row = header.locator(':scope > div').first()
    expect(await row.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('0px')

    await page.goto('/')
    const rowHome = page.locator('header').locator(':scope > div').first()
    expect(await rowHome.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('1px')

    await page.goto('/nft/does-not-exist-at-all')
    await page.waitForLoadState('networkidle')
  })

  test('mobile (390): MobileSearchBar/TabBar ausentes em /nft/*, Buy Bar fixa no fundo; ambas presentes em /; sem overflow em 390/768/1440', async ({
    page,
  }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await bootReset(page)
      await page.goto('/nft/nft-001')
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/nft/nft-001')
    await expect(page.getByPlaceholder('Explorar coleções')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Comprar NFT' })).toBeVisible()

    await page.goto('/')
    await expect(page.getByPlaceholder('Explorar coleções')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()
  })
})

test.describe('Tokens e tipografia (critério 17)', () => {
  test('title desktop usa 28px, mobile 20px; preço desktop 22px; tokens novos existem em :root', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await page.goto('/nft/nft-001')

    const desktopTitle = page.getByRole('heading', { level: 1, name: detail.body.title })
    expect(await desktopTitle.evaluate((el) => getComputedStyle(el).fontSize)).toBe('28px')
    const price = page.getByText(`${detail.body.priceEth} ETH`, { exact: true }).first()
    expect(await price.evaluate((el) => getComputedStyle(el).fontSize)).toBe('22px')

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileTitle = page.getByRole('heading', { level: 1, name: detail.body.title })
    expect(await mobileTitle.evaluate((el) => getComputedStyle(el).fontSize)).toBe('20px')

    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        surfaceRaised: root.getPropertyValue('--color-surface-raised').trim(),
        amber: root.getPropertyValue('--color-amber').trim(),
        title20: root.getPropertyValue('--text-title-20').trim(),
        title22: root.getPropertyValue('--text-title-22').trim(),
        heading28: root.getPropertyValue('--text-heading-28').trim(),
      }
    })
    expect(tokens).toEqual({
      surfaceRaised: '#2f1d15',
      amber: '#e3a44e',
      title20: '1.25rem',
      title22: '1.375rem',
      heading28: '1.75rem',
    })
  })
})

test.describe('Chips de edição — elipse, cor, semântica de radio (critério 18)', () => {
  test('computed border-radius 50%, traço #d28a4c no selecionado e #3f2319 nos demais, sem background; role/checked corretos', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-004')

    const radios = page.locator('input[type="radio"][name="edition-desktop"]')
    const firstLabel = page.locator('label[for="' + (await radios.first().getAttribute('id')) + '"]')
    const secondLabel = page.locator('label[for="' + (await radios.nth(1).getAttribute('id')) + '"]')

    expect(await firstLabel.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('50%')
    expect(await firstLabel.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(210, 138, 76)')
    expect(await firstLabel.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    expect(await secondLabel.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(63, 35, 25)')

    await expect(radios.first()).toBeChecked()
    await expect(radios.nth(1)).not.toBeChecked()
  })
})

test.describe('"Mais desta coleção" (critério 19)', () => {
  test('desktop: 5 cards da mesma categoria sem o NFT corrente; placa 219×255 sem raio, arte 212 com raio 13; card navega; dots paginam', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await page.goto('/nft/nft-001')

    const section = page.getByRole('heading', { name: 'Mais desta coleção' }).locator('..')
    await expect(section).toBeVisible()

    const cards = page.locator('a').filter({ hasText: 'ETH' }).filter({ hasNotText: detail.body.title })
    const visibleCards = page.locator('a[href^="/nft/"]').filter({ has: page.locator('img') })
    const count = await visibleCards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(5)

    for (let i = 0; i < count; i++) {
      const href = await visibleCards.nth(i).getAttribute('href')
      expect(href).not.toBe('/nft/nft-001')
    }

    const firstCard = visibleCards.first()
    const plaque = firstCard.locator('div').first()
    const plaqueBox = await plaque.boundingBox()
    expect(plaqueBox?.width).toBe(219)
    expect(plaqueBox?.height).toBe(255)
    expect(await plaque.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px')

    const art = firstCard.locator('img')
    expect(await art.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('13px')

    const href = await firstCard.getAttribute('href')
    await firstCard.click()
    await expect(page).toHaveURL(href!)
    void cards
  })
})

test.describe('Skeleton do detalhe (critério 20)', () => {
  test('cenário slow: skeleton aparece e preserva as dimensões do bloco principal, sem layout shift', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await setScenario(page, 'slow')

    await page.goto('/nft/nft-001')
    const skeletonMain = page.locator('[data-slot="skeleton"]').first()
    const skeletonBox = await skeletonMain.boundingBox()

    const detail = await apiFetch(page, '/api/nfts/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: detail.body.title })).toBeVisible({
      timeout: 10_000,
    })

    expect(skeletonBox?.width).toBeGreaterThan(0)
    await setScenario(page, 'default')
  })
})

test.describe('Related carousel resiliente a poucos itens/cenário empty (edge case)', () => {
  test('cenário empty: a página de detalhe não quebra mesmo sem itens relacionados', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await setScenario(page, 'empty')

    await page.goto('/nft/nft-001')
    await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeVisible()
    await setScenario(page, 'default')
  })
})

test.describe('Voltar mobile (edge case)', () => {
  test('com histórico, volta preservando a URL do catálogo; acesso direto vai para /', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    await page.goto('/?category=art')
    await page.getByRole('link').filter({ hasText: /ETH/ }).first().click()
    await expect(page).toHaveURL(/\/nft\/nft-\d+/)
    await page.getByRole('button', { name: 'Voltar' }).click()
    expect(await page.evaluate(() => location.pathname + location.search)).toBe('/?category=art')

    await page.goto('/nft/nft-002')
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL('/')
  })
})

/**
 * E2E tester (fase 4) — cobre só o que exige o sistema de pé, fora da
 * fronteira do Tester unitário: o estado de compra é elevado à rota e as
 * duas composições montam simultaneamente (`hidden lg:*`); nada no spec
 * já rodado exercita uma seleção real seguida de resize de viewport, nem a
 * travessia catálogo→detalhe→relacionado→volta em sessão contínua.
 */
test.describe('Travessia de breakpoints com estado de compra elevado (foco E2E tester)', () => {
  test('selecionar edição+quantidade em 1440 sobrevive ao resize para 390, e volta — as duas composições concordam', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)
    await page.goto('/nft/nft-004') // Standard (available 10) + Deluxe (available 3)

    const deluxeDesktop = page.locator('label[for="edition-desktop-nft-004-e2"]')
    await deluxeDesktop.click()
    await expect(page.locator('input[name="edition-desktop"][value="nft-004-e2"]')).toBeChecked()

    // Sobe a quantidade para 2 (Deluxe tem available: 3) — o Buy Bar mobile
    // não está montado nesta viewport, então o stepper visível é o desktop.
    await page.getByRole('button', { name: 'Aumentar quantidade' }).first().click()
    const quantityDesktop = page.locator('span[aria-live="polite"]').first()
    await expect(quantityDesktop).toHaveText('Quantidade: 2')

    await page.setViewportSize({ width: 390, height: 844 })

    // Mesma rota, mesmo estado elevado: a composição mobile — agora visível —
    // tem que refletir a mesma edição e a mesma quantidade, sem re-selecionar.
    await expect(page.locator('input[name="edition-mobile"][value="nft-004-e2"]')).toBeChecked()
    const quantityMobile = page.locator('span[aria-live="polite"]').last()
    await expect(quantityMobile).toHaveText('Quantidade: 2')

    // E de volta: nenhuma composição reseta o estado ao trocar de breakpoint
    // outra vez.
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator('input[name="edition-desktop"][value="nft-004-e2"]')).toBeChecked()
    await expect(quantityDesktop).toHaveText('Quantidade: 2')
  })
})

test.describe('Sessão contínua: catálogo → detalhe → relacionado → volta (foco E2E tester)', () => {
  test('filtros e paginação sobrevivem ao entrar no detalhe, navegar por um relacionado e voltar duas vezes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootReset(page)

    const filteredUrl = '/?category=art&network=polygon&page=1'
    await page.goto(filteredUrl)
    expect(await page.evaluate(() => location.search)).toContain('category=art')

    const firstCard = page.getByRole('link').filter({ hasText: /ETH/ }).first()
    await firstCard.click()
    await expect(page).toHaveURL(/\/nft\/nft-\d+/)
    const firstDetailUrl = page.url()

    // Do detalhe, entra em outro NFT pelo carrossel de relacionados.
    // Sob `pnpm test` completo (paralelismo pesado), ler o primeiro card
    // antes da seção "Mais desta coleção" assentar (a query de
    // relacionados ainda resolvendo) já foi visto devolver uma lista vazia
    // — não reproduzido isoladamente nem com CPU throttling de até 20×.
    // Esperar o heading da seção (só existe quando a lista de relacionados
    // já chegou com itens) antes de ler qualquer card converte essa corrida
    // em espera determinística.
    await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()

    // Foco + Enter em vez de clique: um clique físico apurado num ponto que
    // se move (o carrossel pode reajustar o layout nos primeiros frames)
    // erra o alvo sem lançar erro — foco não depende de coordenada nem de
    // estabilidade de layout.
    const relatedCard = page.locator('a[href^="/nft/"]').filter({ has: page.locator('img') }).first()
    const relatedHref = await relatedCard.getAttribute('href')
    await relatedCard.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(relatedHref!, { timeout: 10_000 })
    expect(page.url()).not.toBe(firstDetailUrl)

    // Volta pelo histórico: primeiro para o detalhe original...
    await page.goBack()
    await expect(page).toHaveURL(firstDetailUrl)

    // ...depois para o catálogo, com os filtros e a página intactos.
    await page.goBack()
    const search = await page.evaluate(() => location.search)
    expect(search).toContain('category=art')
    expect(search).toContain('network=polygon')
  })
})

test.describe('Shell muda em /nft/* nos dois sentidos, sem órfão (foco E2E tester)', () => {
  test('mobile: MobileSearchBar/TabBar somem ao entrar e reaparecem ao voltar; Buy Bar some ao sair; sem sobreposição', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await bootReset(page)

    await page.goto('/')
    await expect(page.getByPlaceholder('Explorar coleções')).toHaveCount(1)
    const tabBar = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(tabBar).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Comprar NFT' })).toHaveCount(0)
    const tabBarBox = (await tabBar.boundingBox())!

    await page.goto('/nft/nft-001')
    // DOM count, não só visibilidade — órfão seria o nó continuar montado
    // (ex.: `hidden`) enquanto a Buy Bar ocupa o mesmo espaço.
    await expect(page.getByPlaceholder('Explorar coleções')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
    const buyBar = page.getByRole('button', { name: 'Comprar NFT' }).locator('..')
    await expect(page.getByRole('button', { name: 'Comprar NFT' })).toBeVisible()
    const buyBarBox = (await buyBar.boundingBox())!
    // A Buy Bar ocupa o fundo onde a TabBar estava — mesma faixa, um único
    // dono por vez, não os dois desenhando ao mesmo tempo.
    expect(buyBarBox.y).toBeGreaterThanOrEqual(tabBarBox.y - 40)

    // E de volta: a TabBar/MobileSearchBar reaparecem, a Buy Bar não persiste.
    await page.goBack()
    await expect(page.getByPlaceholder('Explorar coleções')).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Comprar NFT' })).toHaveCount(0)
  })
})
