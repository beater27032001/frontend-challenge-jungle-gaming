import { expect, test, type Page } from '@playwright/test'
import { ANA, awaitMswReady, awaitRealtimeReady, login } from './helpers'

/**
 * Baselines de regressão visual das telas principais, desktop 1440 e mobile 390.
 *
 * `playwright.config.ts` já trazia `expect.toHaveScreenshot.maxDiffPixelRatio:
 * 0.01` desde a fase 2 sem nenhum teste usando — este spec é quem usa.
 *
 * **Armadilha do `snapshotPathTemplate`.** O template configurado é
 * `{testDir}/__screenshots__/{testFilePath}/{arg}{ext}` — sem `{projectName}`
 * nem `{platform}`. Com nome auto-gerado, desktop e mobile gravariam NO MESMO
 * arquivo e um sobrescreveria o outro em silêncio (a suíte ficaria verde
 * comparando mobile contra baseline de desktop). Por isso todo
 * `toHaveScreenshot` aqui passa nome explícito com o projeto dentro.
 *
 * **Determinismo.** Nada aqui espera tempo de parede. Cada tela passa por
 * `settle()`, que espera, em ordem: mocks de pé → socket conectado → zero
 * skeleton no DOM → imagens carregadas e decodificadas (incluindo as abaixo da
 * dobra, forçadas por uma rolagem até o fim e volta ao topo) → `document.fonts
 * .ready`. As animações o próprio `toHaveScreenshot` congela (`animations:
 * 'disabled'` é o default dele), e ele ainda re-tira o print até dois quadros
 * consecutivos baterem.
 *
 * **Datas.** Nenhum componente de tela renderiza `new Date()` — o "Diário da
 * Cunhagem" vem de `src/mocks/fixtures.ts` com `Date.UTC(2026, 0, 1)` fixo. A
 * única exceção da base é `order-receipt.tsx` (data do pedido, "hoje"), e é
 * justamente por isso que a Confirmação de Pedido NÃO tem baseline aqui.
 */

/**
 * `maxDiffPixels: 200` aperta o `maxDiffPixelRatio: 0.01` do config, e não é
 * capricho: medido. Trocar `--color-primary` de `#d28a4c` para `#4c8ad2` — a
 * cor da marca inteira — mudou entre 0.02 e 0.06 da imagem, e o teto de 1%
 * deixou passar 9 das 14 baselines. Em print `fullPage` de 1440×3943, 1% são
 * ~57 mil pixels: espaço de sobra para uma regressão de marca passar batido.
 * Quando os dois limites estão presentes, o Playwright aplica o mais estrito.
 */
const shot = (page: Page, slug: string) =>
  expect(page).toHaveScreenshot(`${slug}-${test.info().project.name}.png`, {
    fullPage: true,
    maxDiffPixels: 200,
  })

async function settle(page: Page): Promise<void> {
  await awaitMswReady(page)
  await awaitRealtimeReady(page)

  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)

  // Nem todo carregamento usa skeleton: o resumo do carrinho e do checkout
  // marca `aria-busy` enquanto `POST /quote` está no ar e mostra "—" no lugar
  // dos valores. Sem esta espera a baseline do carrinho congelava justamente
  // nesse estado — foi o que aconteceu na primeira geração, e `toHaveScreenshot`
  // não acusou porque dois quadros consecutivos "pendente" são idênticos entre si.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

  // Rola até o fim e volta: sem isso, imagem abaixo da dobra ainda não pedida
  // aparece vazia no print de `fullPage` — o CDP captura além da viewport sem
  // disparar o carregamento preguiçoso.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    }
    window.scrollTo(0, 0)
  })

  await expect
    .poll(() => page.evaluate(() => [...document.images].every((img) => img.complete)))
    .toBe(true)
  await page.evaluate(async () => {
    // `decode()` garante pixel pronto, não só byte recebido. O `catch` cobre
    // imagem que falhou em carregar — ela vira um print determinístico de
    // imagem quebrada, que é exatamente o que uma baseline deve acusar.
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})))
    await document.fonts.ready
  })
}

async function bootAnonymous(page: Page, path: string): Promise<void> {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}mock-reset=1`)
  await settle(page)
}

/** Sessão da ANA com o carrinho de fixture intacto (nft-003 + nft-007), que é
 * o que dá conteúdo determinístico a carrinho, pagamento, perfil e carteiras. */
async function bootAsAna(page: Page, path: string): Promise<void> {
  await page.goto('/?mock-reset=1')
  await awaitMswReady(page)
  await login(page, ANA)
  await page.goto(path)
  await settle(page)
}

test.describe('regressão visual', () => {
  test('início', async ({ page }) => {
    await bootAnonymous(page, '/')
    await shot(page, 'home')
  })

  test('detalhe do NFT', async ({ page }) => {
    await bootAnonymous(page, '/nft/nft-001')
    await shot(page, 'nft-detail')
  })

  test('login', async ({ page }) => {
    await bootAnonymous(page, '/login')
    await shot(page, 'login')
  })

  test('carrinho', async ({ page }) => {
    await bootAsAna(page, '/carrinho')
    await shot(page, 'cart')
  })

  test('pagamento', async ({ page }) => {
    await bootAsAna(page, '/pagamento')
    // A cotação é a última coisa a chegar; sem ela o resumo ainda está vazio.
    await expect(page.getByRole('button', { name: 'Confirmar compra' }).first()).toBeVisible()
    await settle(page)
    await shot(page, 'checkout')
  })

  test('perfil', async ({ page }) => {
    await bootAsAna(page, '/perfil')
    await shot(page, 'profile')
  })

  test('carteiras', async ({ page }) => {
    await bootAsAna(page, '/carteiras')
    await shot(page, 'wallets')
  })
})
