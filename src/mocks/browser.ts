import { setupWorker } from 'msw/browser'
import { installMockControls } from './control'
import { hydrateDb } from './db'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

export async function startWorker() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  installMockControls()
  hydrateDb()
}
