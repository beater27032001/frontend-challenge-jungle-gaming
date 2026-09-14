import { http, HttpResponse } from 'msw'

/**
 * Smoke handler only. Real resource handlers (session, nfts, favourites, cart,
 * quote, orders, profile, wallets) land in phase 1 under src/mocks/handlers/.
 */
export const handlers = [
  http.get('/api/health', () =>
    HttpResponse.json({ status: 'ok', scenario: 'default' }),
  ),
]
