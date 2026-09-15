import { expect, type Page } from '@playwright/test'

/**
 * Shared Playwright helpers for exercising the MSW mock API from the page
 * context (the Playwright `request` fixture never touches the service
 * worker, so every assertion goes through `page.evaluate(fetch)`).
 *
 * Extracted from `api-contracts.spec.ts` — these were duplicated verbatim
 * across three spec files (fase 1 debt, spec §6). Not a `*.spec.ts` file
 * itself, so Playwright's `testMatch` ('*.spec.ts') never collects it as a
 * test suite.
 */

export const ANA = { email: 'ana@greenmint.dev', password: 'GreenMint#1' }
export const BRUNO = { email: 'bruno@greenmint.dev', password: 'GreenMint#2' }

export type ApiResult<T = any> = { status: number; body: T }

export async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`)
  await expect(page.getByRole('status')).toHaveText(/MSW respondeu/i)
}

/**
 * Resets the mock db via the one-shot `?mock-reset=1` boot param.
 * `installMockControls()` strips the param from the URL after consuming it,
 * so a later `page.reload()` doesn't repeat the reset.
 */
export async function bootReset(page: Page): Promise<void> {
  await boot(page, '?mock-reset=1')
}

export async function apiFetch<T = any>(
  page: Page,
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<ApiResult<T>> {
  return page.evaluate(async ({ url, init }) => {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // no/invalid JSON body (e.g. 204)
    }
    return { status: res.status, body }
  }, { url, init })
}

export async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  const res = await apiFetch(page, '/api/auth/login', { method: 'POST', body: creds })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

export async function logout(page: Page): Promise<void> {
  await apiFetch(page, '/api/auth/logout', { method: 'POST' })
}

export async function setScenario(page: Page, name: string): Promise<void> {
  await page.evaluate((name) => window.__mocks!.setScenario(name as never), name)
}

export async function reset(page: Page): Promise<void> {
  await page.evaluate(() => window.__mocks!.reset())
}

export async function addToCart(
  page: Page,
  nftId: string,
  editionId: string,
  quantity: number,
): Promise<ApiResult> {
  return apiFetch(page, '/api/cart/items', {
    method: 'POST',
    body: { nftId, editionId, quantity },
  })
}

/** Empties the current owner's cart — used so a target item lands as the
 * quote's first line, which is what the price-changed/sold-out scenario
 * hooks act on. */
export async function clearCart(page: Page): Promise<void> {
  const cart = await apiFetch(page, '/api/cart')
  for (const item of cart.body.items) {
    await apiFetch(page, `/api/cart/items/${item.id}`, { method: 'DELETE' })
  }
}
