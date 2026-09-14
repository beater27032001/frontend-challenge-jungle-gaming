import { expect, test } from '@playwright/test'

test('foundation boots with the mock layer answering', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /seja dono do futuro/i }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(/MSW respondeu: ok/i)
})

test('unknown route renders the 404 boundary', async ({ page }) => {
  await page.goto('/rota-que-nao-existe')
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
})
