import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'

/**
 * E2E-TESTER SCAFFOLDING — NOT A FEATURE, NOT PART OF THE PHASE-2 DELIVERY.
 *
 * `Dialog`, `Sheet`, `Slider` and `Checkbox` have zero consumer anywhere in
 * the shipped route tree (confirmed by the unit Tester via `dist/assets`
 * grep) and `toast()` is never called by any phase-2 screen — so acceptance
 * criteria 19–21 and three edge cases (focus trap, Escape, thumb keyboard
 * operation, checkbox glyph, toast announcing) have nothing real to drive.
 * This route mounts them so they can be exercised with a real page and a
 * real keyboard, not a re-implemented mock.
 *
 * `import.meta.env.DEV` is statically replaced by Vite at build time, so in
 * `pnpm build` this resolves to `NotAvailable` and the whole `SandboxPage`
 * closure (and everything it imports) is dead-code-eliminated — this route
 * pulls in none of those primitives in the production bundle, exactly like
 * every other unconsumed primitive today. In production `beforeLoad` also
 * throws `notFound()` before any render, so `/e2e-sandbox` on a real deploy
 * hits the `__root` 404 boundary instead of an empty page. It only mounts
 * `SandboxPage` when exercised against `pnpm dev`. Reviewer/Coder decide
 * whether to keep, gate permanently, or delete this file before phase 3.
 */
export const Route = createFileRoute('/e2e-sandbox')({
  beforeLoad: () => {
    // Produção: a URL deve cair no boundary de 404 do __root, não num
    // componente vazio. Vite substitui import.meta.env.DEV estaticamente.
    if (!import.meta.env.DEV) throw notFound()
  },
  // O ramo de produção existe só para não referenciar SandboxPage no build —
  // é o que preserva o tree-shaking dos primitivos. Nunca renderiza: o
  // beforeLoad acima já lançou notFound().
  component: import.meta.env.DEV ? SandboxPage : () => null,
})

function SandboxPage() {
  const [checked, setChecked] = useState(false)

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 p-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir diálogo</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Diálogo de teste</DialogTitle>
          <input aria-label="Campo dentro do diálogo" />
          <Button type="button">Ação dentro do diálogo</Button>
        </DialogContent>
      </Dialog>

      <Sheet>
        <SheetTrigger asChild>
          <Button>Abrir painel</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Painel de teste</SheetTitle>
          <input aria-label="Campo dentro do painel" />
        </SheetContent>
      </Sheet>

      <Slider
        defaultValue={[20, 80]}
        min={0}
        max={100}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        className="w-64"
      />

      <label className="flex items-center gap-2 text-body-16 text-foreground">
        <Checkbox
          checked={checked}
          onCheckedChange={(state) => setChecked(state === true)}
          aria-label="Aceito os termos"
        />
        Aceito os termos
      </label>

      <Button type="button" onClick={() => toast('Notificação de teste')}>
        Disparar toast
      </Button>
    </div>
  )
}
