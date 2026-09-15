/** Mocks are config-driven so the demo build can ship with them enabled. */
export const mocksEnabled = import.meta.env.VITE_ENABLE_MSW !== 'false'

/**
 * Loaded through a dynamic import so MSW (~400 kB) never enters the main chunk.
 * With mocks disabled the bundle is not downloaded at all.
 */
export async function startMocks() {
  if (!mocksEnabled) return
  const { startWorker } = await import('./browser')
  await startWorker()
}
