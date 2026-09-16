import { expect, test, type Page } from '@playwright/test'
import { ANA, apiFetch, awaitMswReady, bootReset, BRUNO, login } from './helpers'

/**
 * Fase 8 (specs/08-perfil-carteiras.md): perfil do colecionador e carteiras.
 *
 * Os contratos novos (`username`, `ensName`, `type`, `referralCode`,
 * `DELETE /api/wallets/:id`) estão cobertos em `api-contracts.spec.ts`. Aqui
 * é a tela: o que o usuário digita salva de verdade, o erro do servidor
 * chega associado AO campo, e a alteração confirmada permanece após refresh
 * (CHALLENGE §3, "Conta e sessão").
 */

/** Loga via API e abre a tela já autenticada — a rota é privada. */
async function openAs(page: Page, creds: typeof ANA, path: string): Promise<void> {
  await bootReset(page)
  await login(page, creds)
  await page.goto(path)
  await awaitMswReady(page)
}

/** O input associado a um label visível, pelo próprio `for`/`id` do form. */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true })
}

test.describe('Rota privada', () => {
  test('visitante em /perfil é levado ao login com redirect de volta', async ({ page }) => {
    await bootReset(page)
    await page.goto('/perfil')
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/perfil')
  })

  test('visitante em /carteiras é levado ao login com redirect de volta', async ({ page }) => {
    await bootReset(page)
    await page.goto('/carteiras')
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/carteiras')
  })
})

test.describe('Shell das telas de conta', () => {
  // Os frames `9:1238` e `9:1670` têm 1080px exatos e terminam logo depois do
  // formulário — sem rodapé, ao contrário de todo outro frame desktop (1657 a
  // 3668px). O caso positivo (`/` ainda tem rodapé) vai junto: sem ele o teste
  // passaria até se o Footer sumisse do app inteiro.
  test('/perfil e /carteiras não renderizam o rodapé; a home continua renderizando', async ({
    page,
  }) => {
    // Ancorar em conteúdo JÁ renderizado antes de afirmar ausência: logo após
    // `awaitMswReady` o React ainda não pintou, e `toHaveCount(0)` casaria com
    // a página vazia — passando mesmo com o rodapé no lugar (medido: 3 polls
    // com 0 elementos antes de virar 1).
    await openAs(page, ANA, '/perfil')
    await expect(page.getByRole('navigation', { name: 'Minha conta' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)

    await page.goto('/carteiras')
    await awaitMswReady(page)
    await expect(page.getByRole('navigation', { name: 'Minha conta' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)

    await page.goto('/')
    await awaitMswReady(page)
    await expect(page.locator('footer')).toHaveCount(1)
  })
})

test.describe('Account Sidebar', () => {
  test('aria-current marca só a página atual, nas duas telas', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    const nav = page.getByRole('navigation', { name: 'Minha conta' })
    await expect(nav.getByRole('link', { name: 'Dados do perfil' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // O caso negativo importa tanto quanto o positivo (lição do CLAUDE.md).
    await expect(nav.getByRole('link', { name: 'Carteiras' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )

    await nav.getByRole('link', { name: 'Carteiras' }).click()
    await expect(nav.getByRole('link', { name: 'Carteiras' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('link', { name: 'Dados do perfil' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('os cinco itens sem tela são inertes: nenhum link, todos aria-disabled', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    const nav = page.getByRole('navigation', { name: 'Minha conta' })
    for (const label of [
      'Atividade',
      'Lista de interesse',
      'Ofertas',
      'Arquivos baixados',
      'Suporte',
    ]) {
      const item = nav.getByText(label, { exact: true })
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      // Link para rota inexistente devolveria 404: não pode existir nenhum.
      await expect(nav.getByRole('link', { name: label })).toHaveCount(0)
    }
  })
})

test.describe('Perfil do colecionador', () => {
  test('nome e nome de usuário salvam e permanecem após refresh', async ({ page }) => {
    await openAs(page, ANA, '/perfil')

    await field(page, 'Nome de exibição').fill('Ana Voltagem')
    await field(page, 'Nome de usuário').fill('ana_voltagem')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil salvo')).toBeVisible()

    await page.reload()
    await awaitMswReady(page)
    await expect(field(page, 'Nome de exibição')).toHaveValue('Ana Voltagem')
    await expect(field(page, 'Nome de usuário')).toHaveValue('ana_voltagem')
  })

  test('nome ENS é gravado com o sufixo .eth', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    await field(page, 'Nome ENS').fill('anavolt3')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil salvo')).toBeVisible()

    const profile = await apiFetch(page, '/api/profile')
    expect(profile.body.ensName).toBe('anavolt3.eth')
  })

  test('nome de usuário já em uso: erro NO campo, não só num toast', async ({ page }) => {
    await openAs(page, BRUNO, '/perfil')
    const input = field(page, 'Nome de usuário')
    await input.fill('anavolt') // já é da Ana
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const message = page.locator(`#${describedBy!.split(' ').at(-1)}`)
    await expect(message).toContainText('já está em uso')
  })

  test('senha atual incorreta: erro associado ao campo Senha atual', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    await field(page, 'Senha atual').fill('SenhaErrada#9')
    await field(page, 'Nova senha').fill('NovaSenha#123')
    await field(page, 'Confirmar nova senha').fill('NovaSenha#123')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const input = field(page, 'Senha atual')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await input.getAttribute('aria-describedby')
    const message = page.locator(`#${describedBy!.split(' ').at(-1)}`)
    await expect(message).toContainText('Senha atual incorreta')
  })

  test('troca de senha bem-sucedida e a senha nova passa a valer', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    await field(page, 'Senha atual').fill(ANA.password)
    await field(page, 'Nova senha').fill('NovaSenha#123')
    await field(page, 'Confirmar nova senha').fill('NovaSenha#123')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Senha alterada')).toBeVisible()
    // Os campos de senha são limpos depois de trocar.
    await expect(field(page, 'Senha atual')).toHaveValue('')

    await apiFetch(page, '/api/auth/logout', { method: 'POST' })
    const withNew = await apiFetch(page, '/api/auth/login', {
      method: 'POST',
      body: { email: ANA.email, password: 'NovaSenha#123' },
    })
    expect(withNew.status).toBe(200)
  })

  test('confirmação divergente é barrada no cliente, sem ida ao servidor', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    await field(page, 'Senha atual').fill(ANA.password)
    await field(page, 'Nova senha').fill('NovaSenha#123')
    await field(page, 'Confirmar nova senha').fill('OutraSenha#123')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
    // A senha antiga continua valendo: nada foi enviado.
    const stillOld = await apiFetch(page, '/api/auth/login', { method: 'POST', body: ANA })
    expect(stillOld.status).toBe(200)
  })

  test('e-mail é readOnly e explica por quê', async ({ page }) => {
    await openAs(page, ANA, '/perfil')
    const email = field(page, 'E-mail')
    await expect(email).toHaveAttribute('readonly', '')
    await expect(email).toHaveValue(ANA.email)
    const hintId = await email.getAttribute('aria-describedby')
    await expect(page.locator(`#${hintId}`)).toContainText('não pode ser alterado')
  })
})

test.describe('Carteiras', () => {
  test('cadastra uma secundária e ela aparece na lista', async ({ page }) => {
    await openAs(page, ANA, '/carteiras')

    await page.getByRole('button', { name: 'Adicionar' }).last().click()
    await field(page, 'Apelido da carteira').fill('Carteira Base')
    await field(page, 'Endereço da carteira').fill('0x666666666666666666666666666666666666666f')
    await field(page, 'Rede').selectOption('ethereum')
    await field(page, 'Tipo de carteira').selectOption('coinbase')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()

    await expect(page.getByText('Carteira salva')).toBeVisible()
    await expect(page.getByText('Carteira Base')).toBeVisible()

    await page.reload()
    await awaitMswReady(page)
    await expect(page.getByText('Carteira Base')).toBeVisible()
  })

  test('endereço duplicado: 409 pendurado no campo de endereço', async ({ page }) => {
    await openAs(page, ANA, '/carteiras')
    const wallets = await apiFetch(page, '/api/wallets')

    await page.getByRole('button', { name: 'Adicionar' }).last().click()
    await field(page, 'Apelido da carteira').fill('Repetida')
    await field(page, 'Endereço da carteira').fill(wallets.body[0].address)
    await field(page, 'Tipo de carteira').selectOption('metamask')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()

    const input = field(page, 'Endereço da carteira')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await input.getAttribute('aria-describedby')
    const message = page.locator(`#${describedBy!.split(' ').at(-1)}`)
    await expect(message).toContainText('já cadastrado')
  })

  test('promover a secundária avisa qual carteira foi rebaixada', async ({ page }) => {
    await openAs(page, ANA, '/carteiras')
    await page.getByRole('button', { name: /Ações da carteira Carteira Polygon/ }).click()
    await page.getByRole('button', { name: 'Definir como principal' }).click()

    await expect(page.getByText(/Carteira Principal.*passou a secundária/)).toBeVisible()
    const wallets = await apiFetch(page, '/api/wallets')
    const primary = wallets.body.find((w: { role: string }) => w.role === 'primary')
    expect(primary.label).toBe('Carteira Polygon')
  })

  test('remover pede confirmação e a remoção persiste', async ({ page }) => {
    await openAs(page, ANA, '/carteiras')
    await page.getByRole('button', { name: /Ações da carteira Carteira Polygon/ }).click()
    await page.getByRole('button', { name: 'Remover' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Remover carteira?')

    // Cancelar não remove nada.
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByText('Carteira Polygon')).toBeVisible()

    await page.getByRole('button', { name: /Ações da carteira Carteira Polygon/ }).click()
    await page.getByRole('button', { name: 'Remover' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText('Carteira removida')).toBeVisible()
    await page.reload()
    await awaitMswReady(page)
    await expect(page.getByText('Carteira Polygon')).toHaveCount(0)
  })

  test('remover a única primária: a UI mostra o motivo e a carteira fica', async ({ page }) => {
    await openAs(page, BRUNO, '/carteiras') // uma carteira só, primária
    await page.getByRole('button', { name: /Ações da carteira Carteira Principal/ }).click()
    await page.getByRole('button', { name: 'Remover' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText(/precisa de uma carteira principal/)).toBeVisible()
    // Localizador específico: "Carteira Principal" aparece em vários nós da
    // tela (título da seção, card, diálogo), e um getByText amplo cai em
    // strict mode — lição do CLAUDE.md.
    await expect(
      page.getByRole('button', { name: /Ações da carteira Carteira Principal/ }),
    ).toBeVisible()
    const wallets = await apiFetch(page, '/api/wallets')
    expect(wallets.body).toHaveLength(1)
  })

  test('remover uma primária com secundária avisa quem foi promovida', async ({ page }) => {
    await openAs(page, ANA, '/carteiras')
    await page.getByRole('button', { name: /Ações da carteira Carteira Principal/ }).click()
    await page.getByRole('button', { name: 'Remover' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText(/Carteira Polygon.*passou a ser a principal/)).toBeVisible()
  })

  test('o alvo da edição fica na URL e sobrevive a refresh', async ({ page }) => {
    await openAs(page, ANA, '/carteiras')
    await page.getByRole('button', { name: /Ações da carteira Carteira Polygon/ }).click()
    await page.getByRole('button', { name: 'Editar' }).click()

    await expect.poll(() => new URL(page.url()).searchParams.get('carteira')).toBe('wallet_2')
    await page.reload()
    await awaitMswReady(page)
    await expect(field(page, 'Apelido da carteira')).toHaveValue('Carteira Polygon')
  })
})

test.describe('Layout das duas telas', () => {
  for (const path of ['/perfil', '/carteiras']) {
    test(`${path} não tem overflow horizontal`, async ({ page }) => {
      await openAs(page, ANA, path)
      await expect(page.getByRole('navigation', { name: 'Minha conta' })).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
})
