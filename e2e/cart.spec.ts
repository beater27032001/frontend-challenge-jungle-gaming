import { expect, test } from '@playwright/test'
import { addToCart, bootReset, clearCart, isExpectedBootNoise } from './helpers'

/**
 * Fase 6 — Carrinho (specs/06-carrinho.md). Um spec por domínio (dívida 4 da
 * fase 3: "um spec por agente" é o padrão errado).
 *
 * Os valores nunca são recalculados aqui: as asserções comparam o que a tela
 * mostra com o que `POST /api/quote` devolve, que é a única fonte de subtotal,
 * desconto, taxa e total.
 *
 * `4x4` = `nft-003` / `nft-003-e1`, uma edição com estoque > 1 na seed.
 */
const NFT = 'nft-003'
const EDITION = 'nft-003-e1'

/** Painel/folha de valores: `aside` no desktop, a folha inferior no mobile.
 * As duas composições coexistem no DOM (`hidden lg:*`), então todo locator de
 * valor tem de ser escopado — sem isso, um `dd` ambíguo dispara strict mode ou,
 * pior, lê o da composição invisível. */
function summary(page: import('@playwright/test').Page, mobile: boolean) {
  return mobile ? page.locator('section[aria-labelledby="payment-summary"]') : page.locator('aside')
}

async function gotoCart(page: import('@playwright/test').Page, search = '') {
  await page.goto(`/carrinho${search}`)
}

test.describe('carrinho', () => {
  test('mostra os itens e os valores que a API cotou', async ({ page, isMobile }) => {
    await bootReset(page)
    await clearCart(page)
    expect((await addToCart(page, NFT, EDITION, 2)).status).toBe(200)

    await gotoCart(page)
    const panel = summary(page, !!isMobile)
    const quote = await page.evaluate(async () => {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: 'ethereum' }),
      })
      return res.json()
    })

    await expect(panel.getByText(`${quote.totalEth} ETH`)).toBeVisible()
    await expect(panel.getByText(`${quote.subtotalEth} ETH`).first()).toBeVisible()
    await expect(panel.getByText(`${quote.networkFeeEth} ETH`)).toBeVisible()
    await expect(panel.getByText('Taxa estimada')).toBeVisible()

    // Desktop é tabela de 5 colunas; mobile é card — composições distintas,
    // não a mesma com CSS diferente (spec §6).
    if (isMobile) {
      await expect(page.getByRole('table')).toHaveCount(0)
      await expect(page.locator('main li')).toHaveCount(1)
    } else {
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'NFTs' })).toBeVisible()
    }
  })

  test('alterar quantidade recota na API e respeita a disponibilidade', async ({ page, isMobile }) => {
    await bootReset(page)
    await clearCart(page)
    await addToCart(page, NFT, EDITION, 1)

    await gotoCart(page)
    const panel = summary(page, !!isMobile)
    const total = panel.locator('dd').last()
    const before = await total.textContent()
    await expect(total).toHaveText(/ETH$/)

    await page.getByRole('button', { name: /^Aumentar quantidade de / }).click()
    await expect(total).not.toHaveText(before!)
    await expect(total).toHaveText(/ETH$/)

    // Teto: o `+` desabilita exatamente na disponibilidade da edição, e o
    // servidor nunca recebe pedido acima dela.
    const available = await page.evaluate(async (nftId) => {
      const res = await fetch(`/api/nfts/${nftId}`)
      const nft = await res.json()
      return nft.editions[0].available as number
    }, NFT)
    const inc = page.getByRole('button', { name: /^Aumentar quantidade de / })
    for (let q = 2; q < available; q++) {
      await inc.click()
      // O número do stepper carrega um rótulo sr-only ("Quantidade de X: N"),
      // então a espera é pelo valor daquele stepper — não por um dígito solto
      // em qualquer lugar da página.
      await expect(page.getByText(new RegExp(`Quantidade de .*: ${q + 1}$`)).first()).toBeAttached()
    }
    await expect(inc).toBeDisabled()

    const conflict = await addToCart(page, NFT, EDITION, 1)
    expect(conflict.status).toBe(409)
  })

  test('remover item esvazia o carrinho', async ({ page }) => {
    await bootReset(page)
    await clearCart(page)
    await addToCart(page, NFT, EDITION, 1)

    await gotoCart(page)
    await page.getByRole('button', { name: /^Remover .* do carrinho$/ }).click()
    // `filter({ visible: true })` e não `.first()`: o estado vazio existe nas
    // duas composições, e no mobile a primeira do DOM é a desktop (oculta) —
    // um `.first()` aqui mediria o harness, não a tela.
    await expect(page.getByText('Seu carrinho está vazio').filter({ visible: true })).toBeVisible()
    const cart = await page.evaluate(async () => (await fetch('/api/cart')).json())
    expect(cart.items).toHaveLength(0)
  })

  test('cupom válido, inválido e expirado', async ({ page, isMobile }) => {
    await bootReset(page)
    await clearCart(page)
    await addToCart(page, NFT, EDITION, 1)

    const field = isMobile ? '#coupon-mobile' : '#coupon-desktop'
    const errorId = isMobile ? 'coupon-mobile-error' : 'coupon-desktop-error'
    await gotoCart(page)
    const panel = summary(page, !!isMobile)
    const input = page.locator(field)
    const apply = panel.getByRole('button', { name: 'Aplicar', exact: true })
    const remove = panel.getByRole('button', { name: 'Remover', exact: true })

    // inválido: erro associado ao campo, não só em toast
    await input.fill('NOPE')
    await apply.click()
    await expect(page.locator(`#${errorId}`)).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAttribute('aria-describedby', errorId)

    // expirado: mensagem da API, não inventada na tela
    await remove.click()
    await input.fill('EXPIRED20')
    await apply.click()
    await expect(page.locator(`#${errorId}`)).toHaveText(/expirado/i)

    // válido: desconto vem da cotação
    await remove.click()
    await input.fill('GREEN10')
    await apply.click()
    await expect(panel.getByText(/Cupom GREEN10 aplicado/)).toBeVisible()
    const quote = await page.evaluate(async () => {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: 'GREEN10', network: 'ethereum' }),
      })
      return res.json()
    })
    await expect(panel.getByText(`(-) ${quote.discountEth} ETH`)).toBeVisible()
    await expect(panel.getByText(`${quote.totalEth} ETH`)).toBeVisible()

    // remover cupom volta ao total sem desconto
    await remove.click()
    await expect(panel.getByText(/Cupom GREEN10 aplicado/)).toHaveCount(0)
    await expect(page).toHaveURL(/\/carrinho$/)
  })

  test('carrinho e cupom sobrevivem a refresh', async ({ page, isMobile }) => {
    await bootReset(page)
    await clearCart(page)
    await addToCart(page, NFT, EDITION, 2)

    await gotoCart(page, '?coupon=GREEN10')
    const panel = summary(page, !!isMobile)
    await expect(panel.getByText(/Cupom GREEN10 aplicado/)).toBeVisible()
    const total = await panel.locator('dd').last().textContent()

    await page.reload()
    await expect(page).toHaveURL(/coupon=GREEN10/)
    await expect(panel.getByText(/Cupom GREEN10 aplicado/)).toBeVisible()
    await expect(panel.locator('dd').last()).toHaveText(total!)
  })

  test('alvo de toque do stepper mobile tem 44px sem alargar o desenho', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'geometria só existe no card mobile (spec §6.4)')
    await bootReset(page)
    await clearCart(page)
    await addToCart(page, NFT, EDITION, 1)
    await gotoCart(page)

    const button = page.getByRole('button', { name: /^Aumentar quantidade de / })
    const hit = (await button.boundingBox())!
    expect(hit.width).toBeGreaterThanOrEqual(44)
    expect(hit.height).toBeGreaterThanOrEqual(44)
    // A moldura visível continua 24 (o padding que amplia o alvo é invisível).
    const glyph = (await button.locator('span[aria-hidden]').boundingBox())!
    expect(Math.round(glyph.width)).toBe(24)
    expect(Math.round(glyph.height)).toBe(24)
  })

  test('sem rolagem horizontal e sem erro de console', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${msg.text()} ${msg.location().url}`)
    })

    await bootReset(page)
    await clearCart(page)
    await addToCart(page, NFT, EDITION, 2)
    await gotoCart(page)
    // `.first()`: desktop e mobile coexistem no DOM, só um está visível.
    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' }).first()).toBeAttached()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    expect(consoleErrors.filter((m) => !isExpectedBootNoise(m))).toEqual([])
  })
})
