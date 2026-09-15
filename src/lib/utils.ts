import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Anel de foco para <Link> "nus" — espelha o de Button/Input, mas a /75:
// eles pareiam o /50 com border-ring sólida; sem borda, o anel é o único
// indicador e precisa compositar ≥3:1 (WCAG SC 1.4.11) sobre ink E
// surface-card — /75 dá 4,31:1 e 4,08:1 (o gate E2E de contraste cobra).
export const linkFocusRing =
  'rounded-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75'
