import { QueryClient } from '@tanstack/react-query'

/**
 * Cache policy (documented in ARCHITECTURE.md):
 * - staleTime 30s: catalogue data is refreshed by Socket.IO events, so polling
 *   on focus would only duplicate work.
 * - retry 1 on queries: MSW scenarios exercise transient failures; one retry
 *   proves recovery without hiding a real outage behind a long backoff.
 * - retry 0 on mutations: order creation is idempotency-key driven, retries are
 *   an explicit user action, never automatic.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})
