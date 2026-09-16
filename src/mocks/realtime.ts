import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type {
  NftDetail,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  RealtimeEvent,
} from '@/types'

/**
 * Transporte de tempo real do ambiente de mocks (desafio §6/§7).
 *
 * `ws.link()` do MSW intercepta a conexão WebSocket real aberta pelo
 * `socket.io-client`; `toSocketIo()` do `@mswjs/socket.io-binding` faz o
 * encode/decode do protocolo Socket.IO em cima dela. O app usa o
 * `socket.io-client` de verdade — nada aqui chama setter, callback ou o cache
 * do Query (regra eliminatória do CLAUDE.md).
 *
 * LIMITAÇÕES do transporte, documentadas por exigência do §6:
 *
 * 1. O binding não implementa namespaces, rooms nem broadcast do Socket.IO.
 *    O "fan-out" é este `Set` de conexões e o filtro por `userId` abaixo.
 * 2. Só o transporte `websocket` é interceptado — o cliente precisa de
 *    `transports: ['websocket']` (ver `src/lib/socket.ts`); o long-polling
 *    default do Socket.IO cairia em HTTP não tratado.
 * 3. Não há servidor: o handshake do engine.io é sintetizado pelo binding,
 *    que anuncia `pingInterval: 25000`. Sem ninguém mandando ping, o
 *    engine.io-client derrubaria a conexão por "ping timeout" em 30s — daí o
 *    keepalive manual (`'2'`) abaixo.
 * 4. Tudo roda no contexto da página (o handler do MSW, não o service
 *    worker), então "servidor" e "cliente" compartilham processo: uma aba
 *    nunca vê o evento de outra. Isolamento entre usuários é por conexão.
 * 5. Reconexão é a do próprio `socket.io-client`; `disconnectAll()` existe
 *    para o Playwright forçar a queda (código 4000, faixa livre da app).
 * 6. O `socket.io-client` precisa ser importado DEPOIS de `worker.start()`,
 *    senão o `engine.io-client` guarda o WebSocket nativo e escapa do mock —
 *    ver o comentário em `src/lib/socket.ts`.
 */

// Curinga, e NÃO um padrão contendo "socket.io": o `WebSocketHandler` do MSW
// remove o prefixo `/socket.io/` do path do cliente antes de casar (é a
// acomodação dele para o protocolo), então qualquer padrão que mencione
// socket.io nunca casa — a conexão vaza para a rede real e o handler não roda.
// Custou uma sessão de depuração: não "melhorar" isto para algo mais
// específico. Este é o único WebSocket do app, o curinga não gera ambiguidade.
const link = ws.link('*')

interface MockClient {
  io: ReturnType<typeof toSocketIo>
  /** Dono da conexão, fixado no handshake — ver `src/lib/socket.ts`. */
  userId: string
}

/** Uma entrada por evento despachado, na ordem em que saíram. Existe para o
 * `replay()` do `window.__mocks`: reenviar o MESMO evento (duplicata) ou um
 * evento já superado (versão antiga) pelo socket real, sem inventar payload. */
interface Dispatched {
  event: RealtimeEvent<string, unknown>
  /** `undefined` = evento público (catálogo); string = só para aquele userId. */
  targetUserId?: string
}

const clients = new Set<MockClient>()
const dispatched: Dispatched[] = []

const PING_MS = 20_000

export const realtimeHandlers = [
  link.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    const userId = connection.client.url.searchParams.get('userId') ?? 'guest'
    const client: MockClient = { io, userId }
    clients.add(client)

    // Keepalive do engine.io (limitação 3). '2' = PING; o cliente responde '3'.
    const ping = setInterval(() => connection.client.send('2'), PING_MS)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      clients.delete(client)
    })
  }),
]

function send(entry: Dispatched): void {
  for (const client of clients) {
    // Isolamento entre usuários (§7): evento de pedido nunca sai para uma
    // conexão de outro dono. Trocar de usuário fecha o socket antigo e abre
    // outro (`src/features/realtime/use-realtime.ts`), então um evento de
    // sessão anterior não tem para onde ir.
    if (entry.targetUserId !== undefined && entry.targetUserId !== client.userId) continue
    client.io.client.emit(entry.event.type, entry.event)
  }
}

function dispatch(event: RealtimeEvent<string, unknown>, targetUserId?: string): void {
  const entry: Dispatched = { event, targetUserId }
  dispatched.push(entry)
  send(entry)
}

/** Chamado por `bumpNftVersion` (src/mocks/db.ts): ponto único por onde passa
 * toda mutação de edição, então REST e evento nunca divergem (§6). */
export function emitNftUpdated(nft: NftDetail): void {
  const event: NftUpdatedEvent = {
    eventId: `${nft.id}:v${nft.version}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    emittedAt: new Date().toISOString(),
    data: {
      priceEth: nft.priceEth,
      available: nft.available,
      editions: nft.editions.map((e) => ({
        id: e.id,
        priceEth: e.priceEth,
        available: e.available,
      })),
    },
  }
  dispatch(event)
}

export function emitOrderUpdated(order: Order, ownerId: string): void {
  const event: OrderUpdatedEvent = {
    eventId: `${order.id}:v${order.version}`,
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    emittedAt: new Date().toISOString(),
    data: {
      status: order.status,
      txHash: order.txHash,
      declineReason: order.declineReason,
    },
  }
  dispatch(event, ownerId)
}

/**
 * Reenvia um evento já despachado, sem registrá-lo de novo.
 * `offsetFromEnd = 0` → o último (duplicata exata);
 * `offsetFromEnd = 1` → o penúltimo (evento antigo, se já houve um mais novo).
 */
export function replayEvent(offsetFromEnd = 0): RealtimeEvent<string, unknown> | null {
  const entry = dispatched[dispatched.length - 1 - offsetFromEnd]
  if (!entry) return null
  send(entry)
  return entry.event
}

/** Derruba as conexões abertas para exercitar a reconciliação pós-reconexão.
 * 4000 está na faixa reservada à aplicação (1006 não é construível). */
export function disconnectAll(): void {
  for (const client of clients) {
    client.io.rawClient.close(4000, 'mock disconnect')
  }
}

export function connectionCount(): number {
  return clients.size
}
