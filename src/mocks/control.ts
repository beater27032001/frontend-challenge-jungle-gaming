import { bumpNftVersion, db, persist, resetDb } from './db'
import { connectionCount, disconnectAll, replayEvent } from './realtime'
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
      /** Fase 9. Alavancas do "backend" simulado: editam o db (portanto o
       * REST) e, por consequência de `bumpNftVersion`, emitem o evento
       * correspondente pelo socket. Nenhuma delas toca na UI ou no cache. */
      realtime: {
        editNftPrice: (nftId: string, priceEth: string) => void
        setNftAvailable: (nftId: string, available: number) => void
        replay: (offsetFromEnd?: number) => string | null
        disconnect: () => void
        connections: () => number
      }
    }
  }
}

/** Muda o preço da 1ª edição de um NFT como um backend faria: REST e evento
 * saem do mesmo ponto (`bumpNftVersion`), nunca divergem (§6). */
function editNftPrice(nftId: string, priceEth: string): void {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft?.editions[0]) throw new Error(`Unknown nft: ${nftId}`)
  nft.editions[0].priceEth = priceEth
  bumpNftVersion(nftId)
  persist()
}

function setNftAvailable(nftId: string, available: number): void {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft?.editions[0]) throw new Error(`Unknown nft: ${nftId}`)
  nft.editions[0].available = available
  bumpNftVersion(nftId)
  persist()
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
    realtime: {
      editNftPrice,
      setNftAvailable,
      replay: (offsetFromEnd) => replayEvent(offsetFromEnd)?.eventId ?? null,
      disconnect: disconnectAll,
      connections: connectionCount,
    },
  }
}
