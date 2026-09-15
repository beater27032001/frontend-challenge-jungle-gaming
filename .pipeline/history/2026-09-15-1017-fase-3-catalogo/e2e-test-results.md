# E2E Test Results

## Status
FAILURES

304/304 pre-existing tests stay green (unchanged, run in isolation and as
part of the full suite). This pass adds 11 new tests (22 executions across
the two Playwright projects) focused on running-system behavior the unit
Tester's mandate explicitly excluded. **5 of those 11 (16 of 22 executions)
pass; 3 (6 of 22 executions) fail deterministically**, all three for the
**same newly-found defect** — not three unrelated bugs. Full suite:
**320 passed / 6 failed (326 total)**. `pnpm build`, `pnpm typecheck`,
`pnpm lint` all clean. Not fixed — reporting only, per the Tester mandate.

## Mode
Frontend (Playwright against `pnpm build && pnpm preview`, both configured
projects: `desktop-chromium` 1440×900, `mobile-chromium` 390×844, plus two
viewport-specific checks at 720×800 and 640×800 as zoom proxies).

## Test command
```
pnpm build && pnpm preview --port 4173   # webServer, already wired in playwright.config.ts
pnpm typecheck && pnpm lint
npx playwright test e2e/catalog-e2e-tester.spec.ts   # this pass's 11 new tests, both projects
npx playwright test                                   # full suite, 326 tests
```

## Tests added
All in `e2e/catalog-e2e-tester.spec.ts` (new file). Does not repeat the 30
acceptance criteria — those are already owned by `e2e/catalog.spec.ts`
(Coder, 27 tests) and `e2e/catalog-tester.spec.ts` (unit Tester, 17 tests).

- **Long session across the URL (interleaved, non-happy order)** — 2 tests:
  one continuous session applying search → network → sort(tab) → category →
  price(slider) → search again, asserting the URL and every control
  (`aria-pressed`/`aria-current`/field value) agree at each step, survives a
  mid-session reload; a second test builds a 4-trigger page-reset chain
  (network → page2 → sort → page2 → price → search, each of the last three
  a *different* trigger type resetting `page`) and walks 3 `goBack()` +
  2 `goForward()` steps plus a reload mid-sequence, asserting the exact URL
  byte-for-byte against what was actually observed when that state was first
  created (not a hand-guessed literal — URL key order follows accumulation
  history, not the schema's declared field order, confirmed empirically).
- **Breakpoint crossing with shared URL state** — 1 test: applies
  category+network on the desktop sidebar `FilterPanel`, resizes to 390,
  confirms the Sheet's *separate* `FilterPanel` instance shows the identical
  state, toggles category off and applies a price filter **from inside the
  Sheet**, then resizes back to 1440 and confirms the sidebar instance picked
  up both changes — proving the two compositions never diverge, in both
  directions, without a reload.
- **out-of-order via a cross-control race** — 1 test: races a slow
  network-filter click (1500ms) against a fast header-search commit (100ms)
  that *composes* with it rather than replacing it (network AND q), proving
  the stale single-filter response never repaints the grid — a stronger,
  cross-component variant of the same-control races `catalog.spec.ts`/
  `catalog-tester.spec.ts` already cover.
- **empty scenario as a live mid-session transition** — 1 test: flips
  `mock-scenario` to `empty` *without a reload* mid-session (not a boot
  param, the way every prior `empty` test does it), forces a refetch via a
  new filter, confirms the real empty state renders, and that "Limpar
  filtros" both clears the URL and correctly disappears once there's nothing
  left to clear.
- **Skeleton in the slow scenario** — 2 tests: desktop grid box
  (position + literal 300px height) compared before/after data arrives
  (`toEqual`, not just a height check), plus `prefers-reduced-motion`
  freezing the shimmer's `animationDuration`; mobile masonry's first item in
  each column checked for position stability the same way.
- **Zero external dependency / clean console across a session** — 1 test:
  a representative interaction session (search, filters, sort, breakpoint
  switch) asserts zero non-localhost requests and zero console errors beyond
  the `/api/auth/session` noise `isExpectedBootNoise` is scoped to — and
  proves the gate had real work to do (asserts the raw, unfiltered log does
  contain that 401 entry) so the "clean" result isn't vacuous.
- **Zoom 200% at 1440 (fase-2 debt)** — 1 test: at 720×800 (1440 / 2, the
  spec's own equivalence math applied to this fase's actual desktop
  baseline, as requested — the existing zoom-proxy tests use 640/720 for a
  1280 baseline), confirms the footer (`contentinfo`) is genuinely hidden,
  then drives **all 5** footer-linked categories through the Sheet
  end-to-end (open → click → URL asserted → toggle off → next), not just a
  single spot-check.
- **DEFECT isolation** — 2 minimal tests, added after the long-session test
  surfaced the bug in the wild, to pin down the smallest possible repro
  (see "Results").

## Style validation
N/A — no visual/prototype changes in this pass; behavior only. (The
Ponytail's own visual pass against the Figma transcription is recorded in
`.pipeline/changes.md`; nothing in this E2E pass touches CSS/markup.)

## Coverage
| Focus item from the assignment | Test |
|---|---|
| Long session across the URL, non-happy order, back/forward, reload mid-sequence, pagination reset in any order | `catalog-e2e-tester.spec.ts` › "search, filters, sort, and price interleave…" + "page resets regardless of which control triggers the change…" |
| Breakpoint crossing with state, sidebar vs Sheet parity in both directions | `catalog-e2e-tester.spec.ts` › "a filter applied on the desktop panel shows identically in the mobile Sheet…" |
| `out-of-order` on the real system, rapid-fire, cross-control | `catalog-e2e-tester.spec.ts` › "a slow network-filter click immediately followed by a fast header search…" |
| `empty` on the real system | `catalog-e2e-tester.spec.ts` › "flipping the mock scenario to empty mid-session…" |
| Skeleton in `slow`: dimension preserved, `prefers-reduced-motion` | `catalog-e2e-tester.spec.ts` › both "Skeleton in the slow scenario" tests |
| Zero external dependency, console clean (scoped gate) | `catalog-e2e-tester.spec.ts` › "search + filters + sort + pagination + a breakpoint switch produce no request…" |
| Zoom 200% debt at 1440, footer "Coleções" functional equivalence | `catalog-e2e-tester.spec.ts` › "at the 720 CSS-px proxy for 1440 zoomed to 200%…" |

## Results

**320 passed / 6 failed (326 total).** `pnpm build`, `pnpm typecheck`,
`pnpm lint` clean. The 304 pre-existing tests are unaffected (verified both
standalone and inside the full run).

### The defect (real, reproducible, not fixed)

**Two Link-based "current" indicators simultaneously claim
`aria-current="page"` in the same nav group** — `CatalogToolbar`'s sort
tabs and `CatalogPagination`'s page links both carry the bug.

- **Where it's visible in this pass**: the long-session test's third
  `goBack()` lands on `?network=solana&sort=popular` (an ordinary, valid
  URL state — "Em alta" should be the only active tab) and finds **both**
  `getByRole('link', { name: 'Em alta' })` **and**
  `getByRole('link', { name: 'Todos os NFTs' })` reporting
  `aria-current="page"`.
- **Isolated, minimal repro (no session/history needed at all)** — added as
  two dedicated tests:
  - `page.goto('/?sort=newest')` → both "Novos lançamentos" *and* "Todos os
    NFTs" get `aria-current="page"`. Same for `?sort=popular` → "Em alta" +
    "Todos os NFTs". A plain default boot (no sort) is correct — exactly
    one tab active — which is what makes this a defect and not a
    selector/fixture issue.
  - `page.goto('/?network=solana&page=2')` → **both** page "2" *and* page
    "1" get `aria-current="page"` in `<nav aria-label="Paginação">`. Same
    root cause, a completely different component
    (`CatalogPagination`), confirming it's systemic, not local to the
    toolbar.
- **Root cause, read from the pinned dependency source, not guessed**
  (`node_modules/@tanstack/react-router/dist/esm/link.js`): both
  `ToolbarTab` (`catalog-toolbar.tsx`) and `CatalogPagination`'s page links
  pass a `search` **updater function** to `<Link>` (e.g.
  `search={(prev) => ({ ...prev, sort: undefined, page: undefined })}`) and
  rely on their own explicit `aria-current={active ? 'page' : undefined}`
  prop to mark exactly one control current. But TanStack Router's `<Link>`
  *also* computes its own `isActive` (`resolveIsActive`) and, when active,
  unconditionally writes `props['aria-current'] = 'page'` and
  `props['data-status'] = 'active'` itself (`applyLinkState`), on top of
  whatever the developer passed — confirmed live: the failing elements'
  `class` attribute has a trailing, unstyled `active` token neither
  component's own source ever writes. Its default `activeOptions` are
  `{ includeSearch: true, partial: true, ignoreUndefined: true }` (no
  component here overrides `activeOptions`), meaning: search matching is
  **partial** (the link's own search keys must be a *subset* of current,
  current's other keys are never checked for absence) and any key the
  link's `search` fn sets to `undefined` is **ignored** in the comparison
  entirely rather than required-absent. So "Todos os NFTs" — whose `search`
  fn clears `sort` and `page` to `undefined` — has, after
  `undefined`-stripping, no keys left to disagree with the current URL, and
  the router considers it "active" (⊆ current) whenever the pathname
  matches `/`, **regardless of what `sort` actually is**. Page 1's link is
  hit the identical way (`page: undefined` for `n === 1`).
- **Why 304 pre-existing tests never caught this**: every existing
  `aria-current` assertion across the whole suite (`grep -n
  "aria-current" e2e/catalog.spec.ts e2e/catalog-tester.spec.ts`) is
  positive only — "the right tab/page *has* it" — never negative ("the
  others *don't*"). The bug is invisible to a positive-only assertion
  because the intended-active element's own `aria-current` is still
  correct; it's just not *exclusively* correct.
- **User-facing impact**: visually near-invisible on desktop (the
  chromatic/underline styling is driven entirely by the app's own `active`
  boolean, unaffected) — but a real assistive-technology correctness bug:
  a screen reader traversing `<nav aria-label="Ordenar catálogo">` or
  `<nav aria-label="Paginação">` announces **two** "current page" items at
  once. This undermines criterion 8 ("aba ativa derivada da URL", which
  implies exactly one) and CHALLENGE §8's "feedback acessível" /
  "estado nunca só por cor" requirement, since `aria-current` is precisely
  the non-chromatic signal meant to disambiguate here and it now disagrees
  with itself.
- **Not fixed here**, per the Tester mandate — a failing test is the
  deliverable. A plausible direction for whoever picks this up: pass
  `activeOptions={{ exact: true }}` (or `{ explicitUndefined: true }`) on
  `ToolbarTab`'s `<Link>` and on `CatalogPagination`'s page links, so the
  router's own active-match stops disagreeing with the component's explicit
  `aria-current` logic. Confirmed **not** present in `catalog.spec.ts`/
  `catalog-tester.spec.ts`'s own assertions (checked by reading both files),
  so this is new information, not a regression of something already caught
  and green.

### Everything else in this pass: confirmed correct

- **Long session, happy-path portion** (search/network/sort/category/price
  all applied and preserved together, reload mid-session): passes cleanly.
- **Breakpoint crossing**: the sidebar `FilterPanel` and the Sheet's
  `FilterPanel` never diverge, in either direction, with no reload.
- **`out-of-order` cross-control race**: the stale single-filter response
  is correctly discarded even when the second, fast request comes from a
  *different* component (header search) than the first (filter panel) —
  the `signal`-based cancellation in `nftListOptions` is not scoped to
  same-control races only.
- **`empty` as a live transition**: the grid correctly reflects a scenario
  flip that happens *after* boot, mid-session, once a query key actually
  changes (facets/featured, on separate cache keys, correctly stay
  unaffected — not a bug, just outside what a filter-triggered refetch
  touches).
- **Skeleton**: desktop grid box is pixel-identical before/after (position
  *and* the literal 300px height), mobile masonry's first item in each
  column doesn't shift position either. `prefers-reduced-motion` genuinely
  freezes the shimmer (`animationDuration` collapses from the default 1.5s
  to ~0.00001s, i.e. the `0.01ms !important` rule in `index.css` is really
  applied — Chromium reports it back in seconds notation, not literally
  `"0.01ms"`, which is a test-authoring detail, not a product issue).
- **Zero external dependency / console**: no request left `localhost`
  across a full interactive session; no console error beyond the scoped
  `/api/auth/session` 401 noise, and that gate was proven non-vacuous
  (it did have a real entry to filter).
- **Zoom 200% at 1440 debt**: at the 720px proxy, the footer is genuinely
  gone and **all 5** footer-linked categories are fully reachable and
  operable via the Sheet (not just visible) — no functional content lost,
  confirming the fase-2 debt's resolution holds specifically at the
  1440 baseline, not only at the 1280-baseline proxy the earlier tests used.

### Flake

One flaky assertion observed and characterized, not chased to green:

- **Where**: `catalog-e2e-tester.spec.ts` › "search, filters, sort, and
  price interleave…" and the breakpoint-crossing test, both of which press
  `ArrowRight` several times on a Radix `Slider` thumb right after giving
  it focus.
- **Rate**: 2 occurrences observed across the runs performed while
  developing this pass (one via `.focus()`, one via `.click()` inside a
  still-settling Radix `Sheet`); **desktop-chromium only**, never observed
  on `mobile-chromium`; **0 occurrences in 6 consecutive isolated runs**
  (`--project=desktop-chromium --grep`, no worker contention) after the
  fix below, and 1 occurrence in 4 full-suite parallel runs after it
  (~1/24 test executions, ~4%).
  Not observed at all in the final full-suite run recorded in "Results"
  above (326/326 minus the 6 genuine defect failures).
- **Root cause**: `page.keyboard.press('ArrowRight')` dispatched
  immediately after `.focus()`/`.click()` on the slider thumb occasionally
  loses a keystroke under CPU contention from Playwright's 4 parallel
  workers — plausibly a race with Radix's own focus-management running
  during/after the `Sheet`'s 500ms entrance transition
  (`sheet.tsx`, `duration-500`), which can re-fire a focus guard mid
  keystroke-sequence. Mitigated (not fully eliminated under heavy
  contention) by switching `.focus()` → `.click()` + an explicit
  `await expect(minThumb).toBeFocused()` before the key sequence, and by
  waiting out the Sheet's entrance transition (550ms) before interacting
  with anything inside it.
- Not re-run to force green beyond the fixes above; the final recorded run
  (326 tests) had zero flaky failures — only the 6 deterministic,
  reproducible defect failures.

## Notes
- Did not modify any non-test source file. The dual-`aria-current` defect
  is reported, not patched.
- `e2e/catalog-e2e-tester.spec.ts` is a new file (11 tests, 22 executions);
  no existing spec file was touched.
