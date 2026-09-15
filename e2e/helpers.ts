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

/**
 * Fase 3: toda tela agora dispara queries reais no boot (incl.
 * `GET /auth/session`, esperado 401 para visitante anônimo). O app trata
 * isso sem lançar (`useSession` devolve `null`, sem console.error do app),
 * mas o próprio Chromium loga "Failed to load resource" para qualquer
 * resposta XHR/fetch >=400, fora do alcance do JS da página — ruído
 * esperado do boot default, não erro do app. Filtra antes de comparar
 * `consoleErrors` com `[]`.
 */
export function isExpectedBootNoise(message: string): boolean {
  // Único ruído tolerado num boot limpo: o 401 de `GET /api/auth/session` para
  // visitante anônimo, que o Chromium loga na rede mesmo o app tratando-o como
  // resposta válida. Escopado pela URL (que vem de `msg.location()`, anexada ao
  // texto na coleta) — sem isso o filtro engoliria imagem quebrada, 404 de asset
  // ou 500 de qualquer rota, e o gate deixaria de cobrar.
  return (
    /ERR_FAILED|Failed to load resource/.test(message) && message.includes('/api/auth/session')
  )
}

/**
 * "Mock layer is up and answering" — the semantics `boot()` always meant,
 * now checked without depending on any screen's UI: `window.__mocks` is
 * installed by `startWorker()` before React mounts (see src/mocks/browser.ts),
 * and `/api/health` is the one route reachable even in every failure
 * scenario (src/mocks/handlers/index.ts keeps it outside `withScenario`).
 */
export async function awaitMswReady(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__mocks)
  const health = await apiFetch(page, '/api/health')
  expect(health.status).toBe(200)
}

export async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`)
  await awaitMswReady(page)
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

/**
 * Ciclo de correção fase 4 (ARCHITECTURE.md fase 4, decisão 20) — terceira
 * ocorrência da mesma família de flake em torno de um Radix Slider (antes:
 * clique-fora, foco). A causa raiz real, confirmada com um
 * `MutationObserver` instrumentado (não só suposta pela CPU contenda): o
 * `FilterPanel` inicia com `max` provisório `1` até a query de `facets`
 * resolver; se o usuário já estiver apertando `ArrowRight` quando essa
 * query assenta, o efeito que resincroniza o rascunho com a URL
 * (`filter-panel.tsx`, `if (syncedTo !== urlPrice) setDraft(...)`) devolve o
 * thumb para `0` no meio da sequência — não é o Radix perdendo `keydown`,
 * é uma corrida real entre o carregamento dos facets e a interação. Sob
 * paralelismo pesado essa janela cresce, daí a aparência de flake ligado a
 * CPU.
 *
 * A espera determinística correta não é por tecla: é esperar o **bound do
 * slider assentar** (deixar de ser o placeholder `1`, ou parar de mudar)
 * antes da primeira tecla — depois disso não há mais corrida e cada
 * `ArrowRight`/`ArrowLeft` avança de forma confiável.
 */
async function waitStable(
  read: () => Promise<string | null>,
  minStableMs = 300,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let last = await read()
  let lastChangeAt = Date.now()
  while (Date.now() < deadline) {
    if (Date.now() - lastChangeAt >= minStableMs) return
    await new Promise((r) => setTimeout(r, 50))
    const current = await read()
    if (current !== last) {
      last = current
      lastChangeAt = Date.now()
    }
  }
  throw new Error(`value never stabilized (stuck changing): last read "${last}"`)
}

export async function pressArrowAndWaitValue(
  thumb: import('@playwright/test').Locator,
  key: 'ArrowRight' | 'ArrowLeft',
  times: number,
): Promise<void> {
  // Espera o `aria-valuemax` (vem de `facets`, resolvido de forma
  // assíncrona) parar de mudar de fato — 300ms sem alteração — antes de
  // começar a apertar teclas, não só uma leitura que por acaso bateu com a
  // anterior.
  await waitStable(() => thumb.getAttribute('aria-valuemax'))

  for (let i = 0; i < times; i++) {
    const before = await thumb.getAttribute('aria-valuenow')
    await thumb.press(key)
    await expect.poll(() => thumb.getAttribute('aria-valuenow')).not.toBe(before)
  }
}

/**
 * Ciclo de correção fase 4 (iteração 2) — mesma família do `waitStable` do
 * slider, aplicada ao primeiro `Tab` de uma sequência de navegação por
 * teclado. `boot()`/`bootReset()` resolve quando os mocks respondem, não
 * quando o DOCUMENTO tem foco; sob paralelismo pesado, o primeiro `Tab`
 * pode disparar antes de `document.hasFocus()` ser verdade, e nesse caso o
 * navegador não move o foco para o primeiro elemento tabulável — a
 * asserção seguinte falha, mas o Tab em si nunca foi "perdido", só nunca
 * teve efeito. Converte a suposição ("o documento já tem foco") em espera
 * explícita antes do primeiro Tab da sequência; os Tabs seguintes não
 * precisam disso, o documento já está com foco.
 */
export async function pressFirstTab(page: Page): Promise<void> {
  await page.bringToFront()
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
  await page.keyboard.press('Tab')
}
