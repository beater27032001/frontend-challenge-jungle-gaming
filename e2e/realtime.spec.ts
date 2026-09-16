import { expect, test, type Page } from '@playwright/test'
import { isQuoteStale } from '../src/features/checkout/quote-freshness'
import {
  ANA,
  addToCart,
  apiFetch,
  awaitMswReady,
  awaitRealtimeReady,
  clearCart,
  login,
  realtimeStats,
} from './helpers'

/**
 * Fase 9 — tempo real (desafio §7).
 *
 * Todo evento aqui nasce de uma mutação no db simulado (`window.__mocks.realtime.*`)
 * e chega ao app pelo `socket.io-client` real, interceptado pelo binding do MSW.
 * Nenhum teste chama setter, callback ou `queryClient` para fingir um evento —
 * é isso que o §11 trata como eliminatório.
 */

async function bootAt(page: Page, path: string): Promise<void> {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}mock-reset=1`)
  await awaitMswReady(page)
  await awaitRealtimeReady(page)
}

/** Desktop e mobile do detalhe (e do card) coexistem no DOM, escondidos por
 * CSS — `:visible` resolve para o que a viewport do projeto realmente mostra. */
function priceOf(scope: Page | import('@playwright/test').Locator) {
  return scope.locator('[data-testid="nft-price"]:visible')
}

async function editPrice(page: Page, nftId: string, priceEth: string): Promise<void> {
  await page.evaluate(
    ([id, price]) => window.__mocks!.realtime.editNftPrice(id, price),
    [nftId, priceEth] as const,
  )
}

test.describe('tempo real', () => {
  test('o socket.io-client conecta ao binding do MSW', async ({ page }) => {
    await bootAt(page, '/')
    const stats = await realtimeStats(page)
    expect(stats.connects).toBeGreaterThanOrEqual(1)
    // Prova que a conexão foi aberta pelo cliente de verdade e chegou ao
    // "servidor" simulado — não um listener registrado no vazio.
    expect(await page.evaluate(() => window.__mocks!.realtime.connections())).toBe(1)
  })

  test('reconexão reconcilia os recursos ativos com o REST', async ({ page }) => {
    await bootAt(page, '/nft/nft-001')
    const price = priceOf(page)
    await expect(price).toBeVisible()
    const before = await realtimeStats(page)

    // Derrubar e editar na MESMA task: `reconnectionDelay` é 300ms, um timer —
    // nada reconecta no meio de um bloco síncrono, então é garantido que o
    // evento saiu para zero conexões. Se a queda não tiver propagado, o teste
    // falha alto aqui em vez de medir uma janela que não existia.
    await page.evaluate(async () => {
      const realtime = window.__mocks!.realtime
      realtime.disconnect()
      await Promise.resolve()
      if (realtime.connections() !== 0) {
        throw new Error(`esperava 0 conexões após disconnect(), veio ${realtime.connections()}`)
      }
      realtime.editNftPrice('nft-001', '0.033')
    })

    await expect.poll(() => page.evaluate(() => window.__mocks!.realtime.connections())).toBe(1)
    await expect.poll(async () => (await realtimeStats(page)).reconciliations).toBeGreaterThanOrEqual(1)
    await expect(price).toHaveText('0.033 ETH')

    // Nenhum evento foi recebido nessa janela — a tela veio do REST.
    expect((await realtimeStats(page)).received).toBe(before.received)
  })

  test('order.updated confirma o pedido do próprio usuário', async ({ page }) => {
    await bootAt(page, '/')
    await login(page, ANA)
    await page.reload() // sessão passa a valer para o app: socket reabre como u-ana
    await awaitMswReady(page)
    await awaitRealtimeReady(page)

    const orderId = await createPendingOrder(page)

    // O pedido resolve no "servidor" e anuncia por evento — sem polling.
    await expect(page.getByText('Pagamento confirmado.')).toBeVisible({ timeout: 10_000 })
    expect((await realtimeStats(page)).orderEvents).toEqual([
      { id: orderId, status: 'confirmed' },
    ])
  })

  test('evento de pedido não chega a uma conexão de outro usuário', async ({ page }) => {
    // A conexão aberta no boot está identificada como visitante ('guest').
    await bootAt(page, '/')
    const before = await realtimeStats(page)

    // O login acontece só na camada REST: o socket em uso continua sendo o da
    // sessão anterior (guest). O pedido pertence a u-ana.
    await login(page, ANA)
    const orderId = await createPendingOrder(page)

    // O pedido resolve mesmo assim (confirmado via REST), mas o evento é
    // entregue apenas à conexão do dono — que não é esta.
    await expect
      .poll(
        async () => (await apiFetch(page, `/api/orders/${orderId}`)).body.status,
        { timeout: 10_000 },
      )
      .toBe('confirmed')
    // `received` sobe por causa do `nft.updated` público que a baixa de estoque
    // do pedido emite — o que não pode chegar é o evento DO PEDIDO.
    expect((await realtimeStats(page)).orderEvents).toEqual(before.orderEvents)
    await expect(page.getByText('Pagamento confirmado.')).toBeHidden()
  })

  test('cenário §7: NFT no carrinho muda de preço durante a navegação', async ({ page }) => {
    await bootAt(page, '/')
    await login(page, ANA)
    await page.reload()
    await awaitMswReady(page)
    await awaitRealtimeReady(page)

    // 1. NFT no carrinho (fixture: nft-003 e nft-007 já estão na conta da Ana).
    const { body: cartBefore } = await apiFetch(page, '/api/cart')
    const line = cartBefore.items.find((i: { nftId: string }) => i.nftId === 'nft-003')
    expect(line).toBeTruthy()
    await expect(page.getByTestId('cart-count')).toHaveText(
      String(cartBefore.items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)),
    )

    const { body: quote } = await apiFetch(page, '/api/quote', {
      method: 'POST',
      body: { network: 'ethereum' },
    })
    expect(quote.id).toBeTruthy()

    // 2. O preço muda durante a navegação.
    await page.goto('/nft/nft-003')
    await awaitRealtimeReady(page)
    // O aviso depende do carrinho já estar em cache nesta página — o badge é a
    // prova de que a query resolveu.
    await expect(page.getByTestId('cart-count')).toBeAttached()
    await editPrice(page, 'nft-003', '3.333')

    // 3. A interface avisa e o resumo atualiza.
    await expect(page.getByText(/Preço de .* mudou para 3\.333 ETH\./)).toBeVisible()
    const { body: cartAfter } = await apiFetch(page, '/api/cart')
    expect(
      cartAfter.items.find((i: { nftId: string }) => i.nftId === 'nft-003').unitPriceEth,
    ).toBe('3.333')

    // 4. O checkout não confirma com a cotação desatualizada — servidor…
    const created = await apiFetch(page, '/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'stale-quote-1' },
      body: {
        quoteId: quote.id,
        walletId: 'wallet_1',
        network: 'ethereum',
        payer: { name: 'Ana Volt', email: ANA.email },
      },
    })
    expect(created.status).toBe(409)
    expect(created.body.error.code).toBe('quote_outdated')

    // …e a mesma decisão disponível no cliente, para a tela da fase 7.
    expect(isQuoteStale(quote, cartAfter)).toBe(true)
    expect(isQuoteStale(quote, cartBefore)).toBe(false)
  })
})

/**
 * Asserções cujo observável é o preço RENDERIZADO ou um card clicável. A
 * camada de tempo real não muda com a viewport; o que muda é a composição que
 * exibe o preço — no mobile o Buy Bar mostra preço × quantidade (formatado por
 * `roundEth`, que corta zero à direita) e o carrossel de relacionados reusa o
 * card de desktop. Fixar texto de preço nas duas viewports testaria a
 * formatação das fases 3/4, não o evento. Os testes acima, que cobrem os
 * requisitos do §7, rodam nos dois projetos.
 */
test.describe('tempo real na interface (desktop)', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    'observável acoplado à composição de desktop',
  )

  test('nft.updated atualiza preço no detalhe e no catálogo', async ({ page }) => {
    await bootAt(page, '/nft/nft-001')
    const price = priceOf(page)
    await expect(price).toBeVisible()
    const before = await price.textContent()

    await editPrice(page, 'nft-001', '0.011')

    // Sem reload e sem refetch do detalhe: o patch vem do payload do evento.
    await expect(price).toHaveText('0.011 ETH')
    expect(before).not.toBe('0.011 ETH')

    // Mesmo NFT no catálogo: o card revalida pelo REST (fonte dos derivados).
    const { body: nft } = await apiFetch(page, '/api/nfts/nft-001')
    await page.goto(`/?q=${encodeURIComponent(nft.title)}`)
    await awaitRealtimeReady(page)
    const card = page.getByRole('link', { name: nft.title })
    await expect(priceOf(card)).toHaveText('0.011 ETH')

    await editPrice(page, 'nft-001', '0.022')
    await expect(priceOf(card)).toHaveText('0.022 ETH')
  })

  test('duplicata e evento antigo não regridem o estado', async ({ page }) => {
    await bootAt(page, '/nft/nft-001')
    const price = priceOf(page)
    await expect(price).toBeVisible()

    await editPrice(page, 'nft-001', '0.100')
    await expect(price).toHaveText('0.100 ETH')
    const afterFirst = await realtimeStats(page)

    // Duplicata exata: o MESMO evento reenviado pelo socket.
    const replayedId = await page.evaluate(() => window.__mocks!.realtime.replay(0))
    expect(replayedId).toBe(afterFirst.lastEventId)
    await expect
      .poll(async () => (await realtimeStats(page)).skipped)
      .toBe(afterFirst.skipped + 1)
    expect((await realtimeStats(page)).applied).toBe(afterFirst.applied)
    await expect(price).toHaveText('0.100 ETH')

    // Evento antigo: reenvia o penúltimo (versão menor) depois de um mais novo.
    await editPrice(page, 'nft-001', '0.200')
    await expect(price).toHaveText('0.200 ETH')
    const afterSecond = await realtimeStats(page)

    await page.evaluate(() => window.__mocks!.realtime.replay(1))
    await expect
      .poll(async () => (await realtimeStats(page)).skipped)
      .toBe(afterSecond.skipped + 1)
    expect((await realtimeStats(page)).applied).toBe(afterSecond.applied)
    // O estado mais recente não regrediu para o preço do evento antigo.
    await expect(price).toHaveText('0.200 ETH')
  })

  test('navegação client-side não acumula socket', async ({ page }) => {
    await bootAt(page, '/')
    const connections = () => page.evaluate(() => window.__mocks!.realtime.connections())

    // Navegação client-side: o __root (e o `useRealtime`) não remonta. Se a
    // conexão fosse aberta por rota, ou se o cleanup não fechasse a anterior,
    // a contagem subiria aqui.
    await page.locator('a[href^="/nft/"]').first().click()
    // A URL basta como prova de que a rota trocou: este teste conta conexões,
    // não renderização — esperar o preço aparecer só importaria skeleton e
    // latência do detalhe para dentro da asserção.
    await expect(page).toHaveURL(/\/nft\//)
    await expect.poll(connections).toBe(1)

    await page.goBack()
    await expect.poll(connections).toBe(1)
  })

})

/** Compra completa pela API até o pedido ficar `pending`. */
async function createPendingOrder(page: Page): Promise<string> {
  await clearCart(page)
  const added = await addToCart(page, 'nft-001', 'nft-001-e1', 1)
  expect(added.status, JSON.stringify(added.body)).toBe(200)

  const { body: quote, status: quoteStatus } = await apiFetch(page, '/api/quote', {
    method: 'POST',
    body: { network: 'ethereum' },
  })
  expect(quoteStatus, JSON.stringify(quote)).toBe(200)

  const created = await apiFetch(page, '/api/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': `rt-${Date.now()}-${Math.random()}` },
    body: {
      quoteId: quote.id,
      walletId: 'wallet_1',
      network: 'ethereum',
      payer: { name: 'Ana Volt', email: ANA.email },
    },
  })
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  expect(created.body.status).toBe('pending')
  return created.body.id
}
