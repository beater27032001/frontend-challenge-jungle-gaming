import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { queryClient } from '@/lib/query'
import { startMocks } from '@/mocks'
import { routeTree } from './routeTree.gen'
import './index.css'

// Search params deste app são sempre escalares planos (string/number),
// validados por zod no validateSearch de cada rota. O parser default do
// TanStack Router JSON-parseia valores que começam com dígito (?priceMin=5
// virava o número 5, falhava no z.string() e o filtro sumia em silêncio) e
// o serializer default cita strings numéricas (?priceMin=%220.05%22). Par
// simétrico sem JSON: tudo é string na leitura (o zod converte onde precisa,
// ex. page via z.coerce) e String() na escrita — round-trip identidade,
// URL limpa. NÃO trocar por parseSearchWith((v) => v): o decode interno da
// lib (qss.js/toValue) converte "5" em número antes do parser custom rodar.
// ponytail: chave duplicada na URL = última vence (nenhum param é array).
function parseSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr))
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const str = params.toString()
  return str ? `?${str}` : ''
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  parseSearch,
  stringifySearch,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Mocks must be listening before React issues its first request.
startMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
