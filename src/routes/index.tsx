import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '@/lib/api'

export const Route = createFileRoute('/')({ component: Home })

/**
 * Foundation smoke screen: proves Router + Query + Axios + MSW + Tailwind
 * tokens are wired end to end. Replaced by the real catalogue in phase 3.
 */
function Home() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<{ status: string }>('/health')).data,
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-content flex-col justify-center gap-6 px-6">
      <p className="text-caption-12 font-bold tracking-widest text-text-secondary uppercase">
        GreenMint
      </p>
      <h1 className="text-display-43 font-bold text-text-primary">
        Seja dono do futuro da arte digital
      </h1>
      <p className="text-body-16 text-text-secondary">
        Fundação instalada. Router, Query, Axios, MSW e os tokens do Figma estão
        ligados.
      </p>
      <p className="text-body-14 text-text-accent" role="status">
        {health.isPending && 'Verificando a camada de mocks…'}
        {health.isError && 'MSW não respondeu.'}
        {health.data && `MSW respondeu: ${health.data.status}`}
      </p>
    </div>
  )
}
