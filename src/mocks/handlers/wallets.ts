import { http, HttpResponse } from 'msw'
import { walletSchema } from '@/types'
import { db, persist } from '../db'
import { withScenario } from '../scenarios'
import { apiError, parseBody, requireSession } from '../utils'

/** Wallets: at most one primary per user, enforced on create and update. */

const updateWalletSchema = walletSchema.partial()

export const wallets = [
  http.get(
    '/api/wallets',
    withScenario(({ cookies }) => {
      const user = requireSession(cookies)
      return HttpResponse.json(db.wallets[user.id] ?? [])
    }),
  ),

  http.post(
    '/api/wallets',
    withScenario(async ({ request, cookies }) => {
      const user = requireSession(cookies)
      const body = await parseBody(request, walletSchema)
      const list = db.wallets[user.id] ?? (db.wallets[user.id] = [])

      const duplicate = list.some((w) => w.address.toLowerCase() === body.address.toLowerCase())
      if (duplicate) return apiError(409, 'conflict', 'Endereço de carteira já cadastrado.')

      if (body.role === 'primary') {
        for (const w of list) w.role = 'secondary'
      }

      db.counters.wallet += 1
      const wallet = { id: `wallet_${db.counters.wallet}`, createdAt: new Date().toISOString(), ...body }
      list.push(wallet)
      persist()
      return HttpResponse.json(wallet, { status: 201 })
    }),
  ),

  http.patch(
    '/api/wallets/:id',
    withScenario(async ({ request, cookies, params }) => {
      const user = requireSession(cookies)
      const list = db.wallets[user.id] ?? (db.wallets[user.id] = [])
      const wallet = list.find((w) => w.id === params.id)
      if (!wallet) return apiError(404, 'not_found', 'Carteira não encontrada.')

      const body = await parseBody(request, updateWalletSchema)
      if (body.address !== undefined) {
        const duplicate = list.some(
          (w) => w.id !== wallet.id && w.address.toLowerCase() === body.address!.toLowerCase(),
        )
        if (duplicate) return apiError(409, 'conflict', 'Endereço de carteira já cadastrado.')
        wallet.address = body.address
      }
      if (body.label !== undefined) wallet.label = body.label
      if (body.network !== undefined) wallet.network = body.network
      if (body.role !== undefined) {
        if (body.role === 'primary') {
          for (const w of list) if (w.id !== wallet.id) w.role = 'secondary'
        }
        wallet.role = body.role
      }
      persist()
      return HttpResponse.json(wallet)
    }),
  ),
]
