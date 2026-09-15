import { http, HttpResponse } from 'msw'
import { activeScenario } from '../scenarios'
import { auth } from './auth'
import { cart } from './cart'
import { favorites } from './favorites'
import { nfts } from './nfts'
import { orders } from './orders'
import { realtimeHandlers } from '../realtime'
import { profile } from './profile'
import { quote } from './quote'
import { wallets } from './wallets'

/**
 * All resource handlers, each already wrapped in `withScenario`. Health stays
 * outside the wrapper: the smoke screen must answer even in `offline`.
 * `realtimeHandlers` é o link WebSocket do Socket.IO (fase 9) — fora do
 * `withScenario`, que é um wrapper de resolver HTTP.
 */
export const handlers = [
  ...realtimeHandlers,
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', scenario: activeScenario() })),
  ...auth,
  ...nfts,
  ...favorites,
  ...cart,
  ...quote,
  ...orders,
  ...profile,
  ...wallets,
]
