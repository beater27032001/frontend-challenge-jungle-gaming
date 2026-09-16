import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  ANA,
  apiFetch,
  awaitMswReady,
  awaitRealtimeReady,
  clearCart,
  login,
  setScenario,
} from './helpers'

/**
 * Fase 7 — Pagamento e confirmação (specs/07-checkout.md, CHALLENGE §3).
 *
 * Um spec por domínio (dívida 4 da fase 3). Três regras valem para tudo aqui:
 *
 * 1. **Nenhum valor é recalculado no teste.** Subtotal, desconto, taxa e total
 *    vêm de `POST /api/quote` ou do `Order`, e as asserções comparam a tela com
 *    a resposta da API.
 * 2. **As duas composições coexistem no DOM** (`hidden lg:*` / `lg:hidden`),
 *    então todo locator compartilhado leva `.filter({ visible: true })` — sem
 *    isso o strict mode dispara ou, pior, o teste lê a composição invisível.
 * 3. **Nada de atalho.** Cada pedido nasce de um clique em "Confirmar compra" e
 *    de uma resposta real do mock; nenhum teste escreve no cache do Query.
 */

/** A conta da Ana: carteira primária em Ethereum (`wallet_1`) + secundária em
 * Polygon (`wallet_2`), e carrinho de fixture com `nft-003` e `nft-007`. */
const NFT = 'nft-003'
const EDITION = 'nft-003-e1'

function visible(page: Page, role: 'button' | 'radio' | 'link', name: string | RegExp): Locator {
  return page.getByRole(role, { name }).filter({ visible: true })
}

/** O rótulo do CTA muda para "Enviando pedido…" enquanto o POST está no ar — é
 * o MESMO botão, e o locator tem de acompanhar, senão "não encontrado" viraria
 * um defeito reportado onde não há (CLAUDE.md, "o instrumento erra mais que o
 * código"). */
const confirmButton = (page: Page) =>
  visible(page, 'button', /^(Confirmar compra|Enviando pedido…)$/)
const receiptDialog = (page: Page) => page.getByRole('dialog')

/**
 * Escolhe um rádio clicando no **rótulo**, não no `<input>`. Os indicadores do
 * Figma são círculos desenhados; o input real é `sr-only` (1×1), e o círculo
 * visível fica por cima dele — então `input.check()` fica preso em "intercepts
 * pointer events" para sempre. O rótulo é exatamente o alvo que um usuário real
 * acerta, e o navegador propaga a seleção para o input associado.
 */
async function chooseRadio(page: Page, value: string): Promise<void> {
  await page.locator(`label:has(input[value="${value}"])`).filter({ visible: true }).click()
  await expect(page.locator(`input[value="${value}"]`).filter({ visible: true })).toBeChecked()
}

/** Sessão da Ana + carrinho reduzido a UMA linha de `nft-003`, para que ela seja
 * o primeiro item da cotação — é nele que os cenários `price-changed` e
 * `sold-out` agem (`handlers/orders.ts`). */
async function bootAsAna(page: Page, quantity = 1): Promise<void> {
  await page.goto('/?mock-reset=1')
  await awaitMswReady(page)
  await login(page, ANA)
  await clearCart(page)
  expect((await apiFetch(page, '/api/cart/items', {
    method: 'POST',
    body: { nftId: NFT, editionId: EDITION, quantity },
  })).status).toBe(200)
}

async function openCheckout(page: Page, search = ''): Promise<void> {
  await page.goto(`/pagamento${search}`)
  await awaitMswReady(page)
  await awaitRealtimeReady(page)
  await expect(confirmButton(page).or(visible(page, 'button', 'Ver recibo'))).toBeVisible()
}

/** Cotação corrente, lida da API — nunca calculada aqui. */
async function quoteNow(page: Page, network = 'ethereum') {
  const res = await apiFetch(page, '/api/quote', { method: 'POST', body: { network } })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

/** O id do pedido está na URL (`?order=`) — é o que faz o refresh recuperar. */
function orderIdFromUrl(page: Page): string {
  const id = new URL(page.url()).searchParams.get('order')
  expect(id, `esperava ?order= na URL, veio ${page.url()}`).toBeTruthy()
  return id!
}

test.describe('checkout', () => {
  test('visitante é mandado ao login e volta para o checkout', async ({ page }) => {
    await page.goto('/?mock-reset=1')
    await awaitMswReady(page)
    await page.goto('/pagamento')
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/pagamento')
  })

  test('o CTA do carrinho leva ao checkout e fica inerte com carrinho vazio', async ({ page }) => {
    await bootAsAna(page)
    await page.goto('/carrinho')
    const cta = visible(page, 'link', 'Conectar e finalizar')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('aria-disabled', 'false')
    await cta.click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/pagamento')

    // Carrinho vazio: o CTA continua desenhado (é o que o Figma mostra) mas não
    // navega — levar a um checkout sem cotação aparentaria função que não existe.
    await clearCart(page)
    await page.goto('/carrinho')
    const inert = visible(page, 'link', 'Conectar e finalizar')
    await expect(inert).toHaveAttribute('aria-disabled', 'true')
  })

  test('mostra os itens e os valores que a API cotou, e confirma só depois do mock', async ({
    page,
  }) => {
    await bootAsAna(page, 2)
    await openCheckout(page)
    const quote = await quoteNow(page)

    // "Seus NFTs" no desktop; no mobile o frame só desenha o Total (§6.5).
    await expect(page.getByText(`${quote.totalEth} ETH`).filter({ visible: true }).first()).toBeVisible()

    // Antes do clique não existe confirmação nenhuma na tela.
    await expect(receiptDialog(page)).toHaveCount(0)

    await confirmButton(page).click()

    // Pendente: anunciado, e ainda SEM recibo — regra eliminatória 3.
    await expect(page.getByText(/Aguardando a confirmação do pagamento/).filter({ visible: true })).toBeVisible()
    await expect(receiptDialog(page)).toHaveCount(0)

    // O recibo só aparece quando o mock resolve o pagamento (1500ms + evento).
    const receipt = receiptDialog(page)
    await expect(receipt).toBeVisible({ timeout: 15_000 })
    await expect(receipt.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()

    const orderId = orderIdFromUrl(page)
    const order = (await apiFetch(page, `/api/orders/${orderId}`)).body
    expect(order.status).toBe('confirmed')
    expect(order.txHash).toBeTruthy()
    await expect(receipt.getByText(`${order.totalEth} ETH`).first()).toBeVisible()
    // ID da transação abreviado no formato do Figma (`0xA91F…E82C`).
    const short = `${order.txHash.slice(0, 6)}…${order.txHash.slice(-4)}`
    await expect(receipt.getByText(short)).toBeVisible()

    // Apenas os itens comprados saem do carrinho (§3).
    const cart = (await apiFetch(page, '/api/cart')).body
    expect(cart.items).toEqual([])
  })

  test('o recibo é snapshot imutável: mudança posterior no catálogo não o altera', async ({
    page,
  }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await confirmButton(page).click()
    const receipt = receiptDialog(page)
    await expect(receipt).toBeVisible({ timeout: 15_000 })

    const orderId = orderIdFromUrl(page)
    const before = (await apiFetch(page, `/api/orders/${orderId}`)).body
    const lineBefore = before.items[0].lineTotalEth

    // O catálogo muda DEPOIS da compra, pelo mesmo caminho de um backend real.
    await page.evaluate((id) => window.__mocks!.realtime.editNftPrice(id, '999'), NFT)
    await expect(receipt.getByText(`${lineBefore} ETH`).first()).toBeVisible()
    await expect(receipt.getByText('999 ETH')).toHaveCount(0)

    const after = (await apiFetch(page, `/api/orders/${orderId}`)).body
    expect(after.items).toEqual(before.items)
    expect(after.totalEth).toBe(before.totalEth)
  })

  test('recuperação após refresh: o pedido reaparece pelo GET /orders/:id', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await confirmButton(page).click()
    await expect(page.getByText(/Aguardando a confirmação do pagamento/).filter({ visible: true })).toBeVisible()
    const orderId = orderIdFromUrl(page)

    // Recarrega AINDA pendente: o `setTimeout` que resolveria o pagamento morre
    // com a página. Quem resolve é o `GET /orders/:id` da carga nova.
    await page.reload()
    await awaitMswReady(page)
    await expect(receiptDialog(page)).toBeVisible({ timeout: 15_000 })
    expect(orderIdFromUrl(page)).toBe(orderId)
  })

  test('pedido recusado é terminal e nunca abre o recibo', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await setScenario(page, 'payment-declined')

    await confirmButton(page).click()
    await expect(page.getByText(/recusado/).filter({ visible: true }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(receiptDialog(page)).toHaveCount(0)

    const order = (await apiFetch(page, `/api/orders/${orderIdFromUrl(page)}`)).body
    expect(order.status).toBe('declined')
    expect(order.version).toBe(2)
    // Terminal: não há botão de confirmar de novo o MESMO pedido.
    await expect(confirmButton(page)).toHaveCount(0)
  })

  test('timeout: reenviar recupera o MESMO pedido, não cria um segundo', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await setScenario(page, 'order-timeout')

    await confirmButton(page).click()
    const resend = visible(page, 'button', 'Reenviar pedido')
    await expect(resend).toBeVisible({ timeout: 15_000 })
    // Nenhum pedido na URL ainda: o cliente não recebeu resposta.
    expect(new URL(page.url()).searchParams.get('order')).toBeNull()

    await resend.click()
    await expect(receiptDialog(page)).toBeVisible({ timeout: 20_000 })

    const orderId = orderIdFromUrl(page)
    const n = Number(orderId.replace('ord_', ''))
    expect(Number.isFinite(n)).toBe(true)
    // O gate da idempotência: o pedido SEGUINTE não existe. Se o reenvio tivesse
    // criado um segundo pedido, este GET responderia 200.
    const next = await apiFetch(page, `/api/orders/ord_${n + 1}`)
    expect(next.status, `ord_${n + 1} não deveria existir`).toBe(404)
  })

  test('clique repetido em Confirmar não cria dois pedidos', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    const button = confirmButton(page)

    // `slow` (2500ms por rota) para que a janela de "enviando" exista de fato:
    // com a latência default de 150–350ms o POST resolve antes de qualquer
    // asserção, e o teste mediria o próprio harness em vez do botão.
    await setScenario(page, 'slow')
    await button.click()
    // Primeira barreira: o botão está desabilitado e anuncia progresso.
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-busy', 'true')
    // Segundo clique, despachado à força sobre o botão desabilitado. Honestidade
    // sobre o que ESTA asserção prova: o navegador não entrega `click` a um
    // controle `disabled`, então o que fica provado aqui é a primeira barreira —
    // o handler não roda duas vezes. A segunda barreira (chave de idempotência
    // segurando um POST que de fato saiu duas vezes) é provada pelo teste de
    // timeout acima e pelos contratos de `api-contracts.spec.ts`. Verificado por
    // mutação: trocar a chave derivada por uma aleatória NÃO derruba este teste,
    // derruba o do timeout.
    await button.dispatchEvent('click')
    await setScenario(page, 'default')

    await expect(receiptDialog(page)).toBeVisible({ timeout: 25_000 })
    const n = Number(orderIdFromUrl(page).replace('ord_', ''))
    expect((await apiFetch(page, `/api/orders/ord_${n + 1}`)).status).toBe(404)
  })

  test('§7 passo 4: preço muda em tempo real → aviso → confirmar barrado → recotar libera', async ({
    page,
  }) => {
    await bootAsAna(page)
    await openCheckout(page)
    const button = confirmButton(page)
    await expect(button).toBeEnabled()

    const quoteBefore = await quoteNow(page)

    // O evento nasce de uma mutação no db simulado e chega pelo socket.io-client
    // (nenhum setter de cache aqui) — é o passo 2/3 do cenário obrigatório.
    await page.evaluate((id) => window.__mocks!.realtime.editNftPrice(id, '0.06'), NFT)

    // Passo 4: aviso na interface E confirmação barrada.
    await expect(
      page.getByRole('alert').filter({ visible: true }).filter({ hasText: /mudou depois da cotação/ }),
    ).toBeVisible()
    await expect(button).toBeDisabled()

    // Recotar destrava, e a cotação nova traz o preço novo da API.
    await visible(page, 'button', 'Atualizar cotação').click()
    await expect(button).toBeEnabled()
    const quoteAfter = await quoteNow(page)
    expect(quoteAfter.items[0].unitPriceEth).toBe('0.06')
    expect(quoteAfter.items[0].unitPriceEth).not.toBe(quoteBefore.items[0].unitPriceEth)

    // E a confirmação agora passa — com um clique NOVO e deliberado.
    await button.click()
    await expect(receiptDialog(page)).toBeVisible({ timeout: 15_000 })
  })

  test('cenário price-changed: 409 na confirmação barra e exige nova confirmação', async ({
    page,
  }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await setScenario(page, 'price-changed')

    await confirmButton(page).click()
    await expect(
      page.getByRole('alert').filter({ visible: true }).filter({ hasText: /Preço mudou/ }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(confirmButton(page)).toBeDisabled()
    // Nada foi comprado: o item segue no carrinho (§3, "preservar os itens em
    // falhas").
    expect((await apiFetch(page, '/api/cart')).body.items).toHaveLength(1)

    // Com o cenário de volta ao normal, recotar + confirmar fecha a compra.
    await setScenario(page, 'default')
    await visible(page, 'button', 'Atualizar cotação').click()
    await expect(confirmButton(page)).toBeEnabled()
    await confirmButton(page).click()
    await expect(receiptDialog(page)).toBeVisible({ timeout: 15_000 })
  })

  test('cenário sold-out: conflito de disponibilidade preserva o carrinho', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await setScenario(page, 'sold-out')

    await confirmButton(page).click()
    await expect(
      page.getByRole('alert').filter({ visible: true }).filter({ hasText: /disponível/ }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(receiptDialog(page)).toHaveCount(0)
    await expect(confirmButton(page)).toBeDisabled()
    expect((await apiFetch(page, '/api/cart')).body.items).toHaveLength(1)
  })

  test('seletor de rede troca a taxa e sobrevive a refresh', async ({ page, isMobile }) => {
    await bootAsAna(page)
    await openCheckout(page)

    const ethereumQuote = await quoteNow(page, 'ethereum')
    const polygonQuote = await quoteNow(page, 'polygon')
    expect(polygonQuote.networkFeeEth).not.toBe(ethereumQuote.networkFeeEth)

    // Por `value`, não por nome acessível: "Polygon" também aparece no rótulo da
    // carteira secundária da Ana, e o nome ambíguo dispararia strict mode.
    await chooseRadio(page, 'polygon')
    await expect.poll(() => new URL(page.url()).searchParams.get('network')).toBe('polygon')
    // O Total muda nas duas composições; a linha "Taxa de rede" só existe no
    // desktop — o frame mobile (§6.5) desenha apenas o Total.
    await expect(
      page.getByText(`${polygonQuote.totalEth} ETH`).filter({ visible: true }).first(),
    ).toBeVisible()
    if (!isMobile) {
      await expect(
        page.getByText(`${polygonQuote.networkFeeEth} ETH`).filter({ visible: true }).first(),
      ).toBeVisible()
    }

    await page.reload()
    await awaitMswReady(page)
    await expect(page.locator('input[value="polygon"]').filter({ visible: true })).toBeChecked()

    // E a rede escolhida é a que o pedido grava.
    await confirmButton(page).click()
    await expect(receiptDialog(page)).toBeVisible({ timeout: 15_000 })
    const order = (await apiFetch(page, `/api/orders/${orderIdFromUrl(page)}`)).body
    expect(order.network).toBe('polygon')
    expect(order.networkFeeEth).toBe(polygonQuote.networkFeeEth)
  })

  test('carteira: a seleção é a conexão, e "Trocar carteira" desconecta', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'a barra "Carteira conectada" só existe no frame mobile (§6.2)')
    await bootAsAna(page)
    await openCheckout(page)

    await expect(page.getByText('Carteira conectada')).toBeVisible()
    await expect(confirmButton(page)).toBeEnabled()

    await visible(page, 'button', 'Trocar carteira').click()
    await expect(page.getByText('Nenhuma carteira conectada')).toBeVisible()
    // Sem carteira não há como pagar, e a tela diz por quê.
    await expect(confirmButton(page)).toBeDisabled()
    await expect(
      page.getByText('Escolha a carteira que vai pagar.').filter({ visible: true }),
    ).toBeVisible()

    // Reconectar é escolher de novo — e o indicador não é só cor: é um rádio
    // real, com `checked` que o leitor de tela anuncia.
    const wallets = (await apiFetch(page, '/api/wallets')).body
    const radios = page.locator('input[name="checkout-wallet-mobile"]')
    await expect(radios).toHaveCount(wallets.length)
    await chooseRadio(page, wallets[0].id)
    await expect(page.getByText('Carteira conectada')).toBeVisible()
    await expect(confirmButton(page)).toBeEnabled()
  })

  test('recibo: foco entra, fica preso, Esc fecha e devolve o foco ao gatilho', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    await confirmButton(page).click()
    const receipt = receiptDialog(page)
    await expect(receipt).toBeVisible({ timeout: 15_000 })

    // Foco entra no diálogo.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
      .toBe(true)

    // Fica preso: tabular por todos os focáveis volta para dentro, nunca sai.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      )
      expect(inside, `Tab ${i + 1} escapou do diálogo`).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(receipt).toHaveCount(0)
    // E o foco volta ao gatilho visível ("Ver recibo"), não para o `body`.
    await expect(visible(page, 'button', 'Ver recibo')).toBeFocused()

    // Reabrir pelo gatilho continua funcionando (o pedido é terminal, o recibo
    // não é descartável).
    await visible(page, 'button', 'Ver recibo').click()
    await expect(receiptDialog(page)).toBeVisible()
  })

  test('sem overflow horizontal em 390, 768 e 1440', async ({ page }) => {
    await bootAsAna(page)
    await openCheckout(page)
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `overflow horizontal em ${width}px`).toBeLessThanOrEqual(0)
    }
  })
})
