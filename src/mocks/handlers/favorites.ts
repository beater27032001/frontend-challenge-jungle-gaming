import { http, HttpResponse } from 'msw'
import type { FavoritesResponse } from '@/types'
import { db, persist } from '../db'
import { withScenario } from '../scenarios'
import { apiError, requireSession } from '../utils'

/** Per-user favorite NFT ids. All routes require a session. */

export const favorites = [
  http.get(
    '/api/favorites',
    withScenario(({ cookies }) => {
      const user = requireSession(cookies)
      const body: FavoritesResponse = { nftIds: db.favorites[user.id] ?? [] }
      return HttpResponse.json(body)
    }),
  ),

  http.put(
    '/api/favorites/:nftId',
    withScenario(({ cookies, params }) => {
      const user = requireSession(cookies)
      const nftId = params.nftId as string
      if (!db.nfts.some((n) => n.id === nftId)) {
        return apiError(404, 'not_found', 'NFT não encontrado.')
      }
      const list = db.favorites[user.id] ?? (db.favorites[user.id] = [])
      if (!list.includes(nftId)) list.push(nftId)
      persist()
      return HttpResponse.json<FavoritesResponse>({ nftIds: list })
    }),
  ),

  http.delete(
    '/api/favorites/:nftId',
    withScenario(({ cookies, params }) => {
      const user = requireSession(cookies)
      const nftId = params.nftId as string
      const list = db.favorites[user.id] ?? (db.favorites[user.id] = [])
      const index = list.indexOf(nftId)
      if (index !== -1) list.splice(index, 1)
      persist()
      return HttpResponse.json<FavoritesResponse>({ nftIds: list })
    }),
  ),
]
