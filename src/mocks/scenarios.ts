import type { HttpResponseResolver } from 'msw'
import { HttpResponse } from 'msw'
import { apiError } from './utils'

/**
 * Named, URL/localStorage-selectable failure & latency scenarios so the app
 * (and Playwright) can exercise every error path deterministically.
 */

export const SCENARIOS = [
  'default', // sucesso; latência semeada 150–350ms; pagamento confirma
  'empty', // GET /api/nfts responde lista vazia (total 0), resto normal
  'slow', // 2500ms fixos em toda rota (skeletons)
  'out-of-order', // 1ª chamada da página: 1500ms; seguintes: 100ms
  'offline', // toda rota /api (exceto /api/health) → HttpResponse.error()
  'server-error', // toda rota → 500 { code: 'transient' }
  'flaky', // 1ª chamada de cada rota+método → 503 'transient'; retry sucede
  'session-expired', // toda rota autenticada (e GET /api/auth/session) → 401 'session_expired'
  'register-conflict', // POST /api/auth/register → 409 'email_taken' incondicional
  'price-changed', // POST /api/orders: +10% no preço da 1ª edição cotada → 409 'quote_outdated'
  'sold-out', // POST /api/orders: zera available da 1ª edição cotada → 409 'availability_conflict'
  'order-timeout', // POST /api/orders: 1ª tentativa por Idempotency-Key falha como erro de rede
  'payment-declined', // pedidos resolvem para 'declined' em vez de 'confirmed'
] as const
export type ScenarioName = (typeof SCENARIOS)[number]

const SCENARIO_KEY = 'greenmint:scenario'

export function isScenarioName(value: string | null): value is ScenarioName {
  return !!value && (SCENARIOS as readonly string[]).includes(value)
}

export function activeScenario(): ScenarioName {
  const stored = localStorage.getItem(SCENARIO_KEY)
  return isScenarioName(stored) ? stored : 'default'
}

let outOfOrderCallCount = 0
let flakyCallCounts: Record<string, number> = {}

export function setScenario(name: ScenarioName): void {
  if (!isScenarioName(name)) throw new Error(`Unknown mock scenario: ${String(name)}`)
  localStorage.setItem(SCENARIO_KEY, name)
  outOfOrderCallCount = 0
  flakyCallCounts = {}
}

// mulberry32: tiny seeded PRNG, deterministic across a page session.
function mulberry32(seed: number) {
  let a = seed
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = mulberry32(0xc0ffee)

export async function delayFor(): Promise<void> {
  const scenario = activeScenario()
  let ms: number
  if (scenario === 'slow') {
    ms = 2500
  } else if (scenario === 'out-of-order') {
    outOfOrderCallCount += 1
    ms = outOfOrderCallCount === 1 ? 1500 : 100
  } else {
    ms = 150 + Math.floor(random() * 200) // seeded 150–350ms
  }
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps every /api/* resolver (except /api/health): applies latency, then
 * offline/server-error/flaky short-circuits, then delegates to the resolver.
 */
export function withScenario(resolver: HttpResponseResolver): HttpResponseResolver {
  return async (info) => {
    await delayFor()
    const scenario = activeScenario()

    if (scenario === 'offline') return HttpResponse.error()
    if (scenario === 'server-error') {
      return apiError(500, 'transient', 'Falha transitória do servidor.')
    }
    if (scenario === 'flaky') {
      const { request } = info
      const key = `${request.method} ${new URL(request.url).pathname}`
      const count = (flakyCallCounts[key] ?? 0) + 1
      flakyCallCounts[key] = count
      if (count === 1) {
        return apiError(503, 'transient', 'Falha transitória, tente novamente.')
      }
    }

    return resolver(info)
  }
}
