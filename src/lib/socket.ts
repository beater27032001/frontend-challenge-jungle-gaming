import type { Socket } from 'socket.io-client'

/**
 * Única fábrica de conexão de tempo real do app — o análogo de `lib/api.ts`
 * para o Socket.IO. Os eventos chegam pelo `socket.io-client` de verdade,
 * interceptado pelo binding do MSW (`src/mocks/realtime.ts`).
 *
 * O `import()` dinâmico NÃO é code splitting: é obrigatório para o mock
 * funcionar. O `engine.io-client` captura o construtor de WebSocket UMA VEZ, na
 * avaliação do módulo (`const WebSocketCtor = globalThis.WebSocket`). Importado
 * estaticamente, ele é avaliado antes de `worker.start()` trocar o global e
 * guarda o WebSocket nativo — a conexão então ignora o MSW e vai para a rede
 * real (na demo, um 200 do servidor de arquivos). Carregar sob demanda, depois
 * dos mocks, é o que faz o binding interceptar. O tipo entra por
 * `import type`, que é apagado na compilação e não avalia o módulo.
 */
export async function connectRealtime(scope: string): Promise<Socket> {
  const { io } = await import('socket.io-client')
  return io(window.location.origin, {
    path: '/socket.io/',
    // O binding do MSW só intercepta WebSocket; o long-polling default do
    // Socket.IO cairia em requisição HTTP sem handler.
    transports: ['websocket'],
    // Identidade da conexão, fixada no handshake: o mock só entrega evento de
    // pedido para a conexão do dono (§7, isolamento entre usuários). Trocar de
    // usuário fecha este socket e abre outro com o novo escopo.
    query: { userId: scope },
    // Sem espera exponencial longa: a reconciliação pós-reconexão precisa ser
    // observável em teste e rápida na demonstração.
    reconnectionDelay: 300,
    reconnectionDelayMax: 1000,
  })
}
