import { resetDb } from './db'
import {
  SCENARIOS,
  setScenario,
  activeScenario,
  isScenarioName,
  type ScenarioName,
} from './scenarios'

/**
 * Boot-time and runtime knobs for the mock layer: a query param to pick the
 * scenario/reset on load, and a `window.__mocks` surface for Playwright and
 * manual debugging to flip scenarios without reloading. The boot params are
 * one-shot: consumed and stripped from the URL via `history.replaceState` so
 * a same-URL reload doesn't repeat them.
 */

declare global {
  interface Window {
    __mocks?: {
      setScenario: (name: ScenarioName) => void
      getScenario: () => ScenarioName
      reset: () => void
      scenarios: readonly ScenarioName[]
    }
  }
}

export function installMockControls(): void {
  const params = new URLSearchParams(window.location.search)

  const scenarioParam = params.get('mock-scenario')
  if (scenarioParam && isScenarioName(scenarioParam)) {
    setScenario(scenarioParam)
  }
  if (params.get('mock-reset') === '1') {
    resetDb()
  }

  if (params.has('mock-scenario') || params.has('mock-reset')) {
    params.delete('mock-scenario')
    params.delete('mock-reset')
    const search = params.toString()
    const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash
    window.history.replaceState(null, '', url)
  }

  window.__mocks = {
    setScenario,
    getScenario: activeScenario,
    reset: resetDb,
    scenarios: SCENARIOS,
  }
}
