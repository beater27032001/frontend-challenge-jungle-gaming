import { useEffect, useState } from 'react'

/**
 * Fase 5 (specs/05-auth.md §9): a composição desktop de `/login`/`/cadastro`
 * usa o Dialog do Radix (focus trap/Esc nativos) — mas `hidden lg:flex`
 * puro deixaria o trap ativo mesmo com o painel invisível em `<lg`,
 * roubando o foco da tela mobile por trás. Só monta o Dialog quando o
 * breakpoint bate, em vez de confiar só em CSS para essa composição.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
