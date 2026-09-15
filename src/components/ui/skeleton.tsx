import type * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Dimensions always come from the caller (`className="h-4 w-32"`) — this
 * component never sets its own size, it preserves the space of the content
 * it replaces while loading (CHALLENGE §8). The shimmer gradient uses
 * `border-soft` (a design token, not a Figma value: loading states don't
 * exist in the Figma file) and `--animate-shimmer` from `src/index.css`;
 * `prefers-reduced-motion` needs no extra code here — the global media query
 * in `index.css` already freezes all animations, including this one.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" className={cn("relative overflow-hidden rounded-lg bg-muted", className)} {...props}>
      <div
        aria-hidden
        className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-border-soft/40 to-transparent"
      />
    </div>
  )
}

export { Skeleton }
