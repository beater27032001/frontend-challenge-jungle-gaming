import { expect, test } from '@playwright/test'
import { ANA, apiFetch, bootReset, login } from './helpers'

/**
 * Regressões encontradas em teste MANUAL, com a suíte de 529 testes verde.
 *
 * As três eram funcionais e visíveis em cinco minutos de uso, e nenhuma foi
 * pega. O padrão comum: a suíte cobria cada tela isoladamente e nunca
 * percorria a navegação ENTRE elas — deslogar estando numa rota privada,
 * clicar num item do menu, chegar ao perfil pelo header. Estado alcançável
 * só por sequência não era exercitado por teste nenhum.
 *
 * Por isso este arquivo existe separado: ele testa transições, não telas.
 */
test.describe('Regressões de navegação', () => {
  test('deslogar de uma rota privada não prende o usuário num modal de login', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)

    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/perfil/)

    // O defeito: o logout recarregava NA rota privada, a guarda mandava para
    // /login?redirect=/perfil, e fechar o modal voltava para /perfil, que
    // redirecionava de novo — laço sem saída.
    // Dois "Sair" existem: o do header (só no desktop, que não tem header no
    // mobile) e o da navegação da conta. Locator amplo dispara strict mode no
    // desktop e não encontra nada no mobile — o CLAUDE.md descreve os dois
    // tropeços, e eu cometi ambos aqui antes de escopar.
    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024
    const sair = isDesktop
      ? page.locator('header').getByRole('button', { name: /^Sair$/ })
      : page.getByRole('navigation', { name: 'Minha conta' }).getByRole('button', { name: /^Sair$/ })
    await expect(sair).toBeVisible()
    await sair.click()

    await expect(page).toHaveURL(/\/$|\/\?/, { timeout: 10_000 })
    await expect(page).not.toHaveURL(/\/login/)
    // E a sessão realmente acabou. Verificado na API, não na interface: o
    // mobile não tem header, então "voltou a aparecer Entrar" só valeria num
    // dos dois projects — e o que importa provar é que a sessão morreu, não
    // que um botão mudou.
    const session = await apiFetch(page, '/api/auth/session')
    expect(session.status).toBe(401)
  })

  test('visitante que cai no login vindo de rota privada consegue fechar o modal', async ({
    page,
  }) => {
    await bootReset(page)

    // Sem sessão, /perfil manda para /login carregando o destino.
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/login/)

    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024
    test.skip(!isDesktop, 'o modal com botão de fechar só existe em >=lg; no mobile é página cheia')

    await page.getByRole('button', { name: /Fechar/i }).click()

    // Fechar não pode devolver para a rota privada: ela redirecionaria de volta.
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).not.toHaveURL(/\/perfil/)
  })

  test('itens do menu principal levam a algum lugar, ou não são links', async ({ page }) => {
    await bootReset(page)
    const header = page.locator('header')
    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024
    test.skip(!isDesktop, 'a navegação principal só existe no header desktop')

    // "Mercado" era um <span> inerte: parecia clicável e não era.
    const mercado = header.getByRole('link', { name: 'Mercado' })
    await expect(mercado).toBeVisible()
    await mercado.click()
    await expect(page).toHaveURL(/#catalogo|\/$/)

    // Criadores e Aprenda seguem sem destino — e a prova de que isso é
    // deliberado é não existirem como link. Se alguém os transformar em link
    // apontando para lugar nenhum, este teste cai.
    await expect(header.getByRole('link', { name: 'Criadores' })).toHaveCount(0)
    await expect(header.getByRole('link', { name: 'Aprenda' })).toHaveCount(0)
  })

  test('usuário autenticado chega ao perfil pelo header', async ({ page }) => {
    await bootReset(page)
    await login(page, ANA)
    await page.goto('/')

    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024
    test.skip(!isDesktop, 'no mobile o caminho para o perfil é a TabBar, coberta em runtime-behavior')

    // O defeito: avatar e nome eram texto morto — no desktop não havia
    // entrada alguma para /perfil.
    await page.locator('header').getByRole('link', { name: /Ana/ }).click()
    await expect(page).toHaveURL(/\/perfil/)
  })
})
