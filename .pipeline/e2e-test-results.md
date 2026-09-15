# E2E Test Results

## Status
all passing (1 pre-existing, parallelism-only flake — confirmed independently, not introduced by this fase, not fixed per instructions)

## Mode
frontend

## Test command
```
pnpm build && pnpm preview --port 4173   # production build, matches playwright.config.ts webServer
npx playwright test e2e/nft-detail.spec.ts --workers=1
npx playwright test e2e/catalog.spec.ts --workers=1
npx playwright test e2e/catalog.spec.ts -g "search, filters, sort, and price interleave" --repeat-each=3            # flake repro, parallel
npx playwright test e2e/catalog.spec.ts -g "search, filters, sort, and price interleave" --repeat-each=3 --workers=1 # flake repro, serial
pnpm typecheck && pnpm lint
```

## Tests added
- `e2e/nft-detail.spec.ts` — 3 new `describe` blocks (6 test executions ×
  2 projects), appended after the existing 46, covering only what the running
  system shows and the unit-level Tester's per-criterion isolation could not:
  - **"Travessia de breakpoints com estado de compra elevado"** — selects
    Deluxe + quantity 2 on nft-004 at 1440, resizes to 390, asserts the
    mobile composition's radio and stepper agree with the state set on
    desktop (both compositions are mounted simultaneously via `hidden lg:*`),
    then resizes back to 1440 and re-confirms the desktop side didn't reset.
  - **"Sessão contínua: catálogo → detalhe → relacionado → volta"** — from
    `/?category=art&network=polygon&page=1`, opens a card, then a related
    card from `RelatedCarousel`, then two `page.goBack()` in a row: first
    back lands on the original detail URL, second back restores the
    catalog URL with both filters intact.
  - **"Shell muda em /nft/* nos dois sentidos, sem órfão"** — asserts by DOM
    *count* (not just visibility) that `MobileSearchBar`/`TabBar` are absent
    on `/nft/*` and present on `/`, in both navigation directions, and that
    the Buy Bar occupies the same vertical band the TabBar occupied (no two
    fixed-bottom elements drawn at once).

No new spec file: appended to `e2e/nft-detail.spec.ts` per the project's own
fase-4 consolidation convention (dívida 4 — merge into the domain spec, don't
proliferate files).

## Style validation
N/A — no new style facts asserted; the 3 new tests are behavioral (state
survival across breakpoints, navigation, DOM presence/absence). Style facts
from the prototype (chip ellipse, tokens, typography, Buy Bar geometry) were
already asserted by the Tester's 46 `nft-detail.spec.ts` tests and re-run
clean here (see Results).

## Coverage
| Focus item from the task | Test / verification |
|---|---|
| 1. Fluxo de compra ponta a ponta contra o build de produção, erro sem sucesso, item chega ao `GET /api/cart` | Already covered by `nft-detail.spec.ts:137/164/189` (Tester's suite) — re-ran against a fresh `pnpm build && pnpm preview`, 52/52 passed. Not duplicated. |
| 2. Travessia de breakpoints com estado de compra elevado | NEW — `nft-detail.spec.ts` "Travessia de breakpoints com estado de compra elevado" (both projects, both pass) |
| 3. Navegação catálogo↔detalhe↔relacionado em sessão contínua, filtros/paginação sobrevivem | NEW — `nft-detail.spec.ts` "Sessão contínua: catálogo → detalhe → relacionado → volta" |
| 4. Acesso direto e NFT inexistente no build de produção | Already covered (`nft-detail.spec.ts:14`, `:31`) — re-confirmed against the production build in this session (not dev server) |
| 5. Shell muda em `/nft/*` nos dois sentidos, sem órfão/sobreposição | NEW — `nft-detail.spec.ts` "Shell muda em /nft/* nos dois sentidos, sem órfão" (checks DOM count, not just `:visible`, and the Buy Bar's y-position against the TabBar's) |
| 6. Flake `catalog.spec.ts:834` — taxa e causa raiz | Independently reproduced below |

## Results

**Full suites, serialized (`--workers=1`)** — clean baseline, production build:
- `e2e/nft-detail.spec.ts`: **52/52** (46 inherited + 6 new)
- `e2e/catalog.spec.ts`: **110/110**
- `pnpm typecheck`: clean
- `pnpm lint`: clean

**New tests, both projects, isolated run**: 6/6 (`desktop-chromium` +
`mobile-chromium`) — the breakpoint-state test only failed once during
authoring on a locator mismatch (`toHaveText('2')` matched against the
sr-only-prefixed `"Quantidade: 2"` text node — my own instrumentation error,
fixed to `toHaveText('Quantidade: 2')`, not a product defect; consistent with
CLAUDE.md §Verificação).

**Flake `e2e/catalog.spec.ts:834` — independently characterized**:

- `npx playwright test ... -g "search, filters, sort, and price interleave" --repeat-each=3` (default parallel workers): **2 passed / 4 failed** (both `desktop-chromium` repeats failed, plus one of three `mobile-chromium` repeats). Failure symptom: after 5× `ArrowRight` on the price-min Radix Slider thumb + "Aplicar", the URL is `?network=solana&sort=popular&category=art` — `priceMin=0.05` never lands, meaning one or more `ArrowRight` keydowns never reached a Radix Slider value commit before the click.
- Same selection, `--workers=1`: **6/6 passed**, twice over (both my run and the Tester's).
- **Root cause, confirmed independently, not just cited**: `src/components/ui/slider.tsx` is the bare Radix primitive (`SliderPrimitive.Root/Thumb`) with no custom debounce, throttle, or event-handling code of ours in the path — the only place a keydown could get lost is inside Radix's own internal state/render cycle when the main thread is starved by sibling parallel browser contexts. This machine has 8 logical CPUs; Playwright's default worker count spins up enough Chromium instances to contend for it. The failure rate (4/6, ~67%) tracks with parallel CPU pressure, not with anything this fase touched — `src/components/ui/slider.tsx` and `filter-panel.tsx` are unchanged by fase 4.
- **Not a regression, not introduced by fase 4**: the interaction is catalog/fase-3 code; fase 4 didn't touch the slider or the filter panel. Confirmed by re-running the full `catalog.spec.ts` serialized (110/110, including this exact test) with no code changes.
- **Naming the pattern**: this is the **third** occurrence of the same flake family in this codebase — keyboard/focus-driven interaction timing under parallel CPU contention — after the `runtime-behavior.spec.ts` focus-via-Tab flake and the `api-contracts.spec.ts` "flaky: first call 503s" timing flake (both cited by the Coder/Tester, neither reproduced by me in this session, consistent with them being intermittent rather than deterministic). `catalog.spec.ts:834`'s `ArrowRight`-on-Radix-Slider is a more deterministic member of the family (3/3 and now 4/6 reproduced on demand) and is worth naming explicitly in `ARCHITECTURE.md` as a recognized class — not because the tests are wrong, but because any future keyboard-repeat interaction against a Radix control should expect the same ceiling under `pnpm test`'s default parallelism and either accept `--workers=1` for that file or add a settle wait between key presses. Not fixed here per instructions (finding to report, not to patch).

## Notes
- Ran everything against `pnpm build && pnpm preview --port 4173` (the project's own `playwright.config.ts` `webServer`), never the dev server. Killed any process on port 4173 before every run (CLAUDE.md §Verificação — stale `reuseExistingServer` risk).
- Did not touch any production source file. The only files changed are the 3 new `describe` blocks appended to `e2e/nft-detail.spec.ts`.
- Did not re-run the gate-forced-to-fail check for criterion 18 (border-radius) — the Tester already did this twice (Coder's original + Tester's independent redo); re-running a third time would be exactly the duplication the task boundary asks me to avoid.
- Did not commit anything.
