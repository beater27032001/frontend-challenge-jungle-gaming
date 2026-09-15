# Test Results

## Status
all passing (re-tested after fix cycle iteration 2)

326/326 pass, both Playwright projects, **three** consecutive full-suite
runs under default (fully-parallel) workers — no flake observed in any of
the three, including in the slider-heavy tests the E2E report flagged as
~4% flaky. `pnpm build`, `pnpm typecheck`, `pnpm lint` all clean. See
"Re-test — iteration 2" below for the independent verification of the
dual-`aria-current` fix (including the negative assertions the original
defect report says were missing), the navigation-regression check, the
scope sweep of every other `<Link>` in the app, and the footer
characterization. "Re-test — iteration 1" below it covers the prior cycle
(the `priceMin > priceMax` deep-link bug) and remains valid — not re-run
this pass since it's out of this iteration's diff.

---

**Everything below this line is the original (pre-fix) report, kept
unmodified as the record of what was found and why the fix cycle happened.**

## Status (original, pre-fix)
FAILURES

2 of 304 tests fail, both deterministic (same result on every run, both
Playwright projects), root-caused, and isolated to a single new test file
(`e2e/catalog-tester.spec.ts`). All 216 pre-existing tests and all 68 of the
Coder's own `e2e/catalog.spec.ts` tests are green — the failures are a new,
real finding about the shipped code, not noise, not flake, and not a defect
in the test itself (repro confirmed independently outside Playwright, see
"Results").

## Test command
```
pnpm build && pnpm typecheck && pnpm lint
pnpm exec playwright test                                    # full suite, once, at the end
pnpm exec playwright test e2e/catalog.spec.ts e2e/catalog-tester.spec.ts   # affected, run repeatedly while working
pnpm exec playwright test e2e/api-contracts.spec.ts e2e/runtime-behavior.spec.ts   # the 216 legacy tests, isolated
```

## Tests added
- `e2e/catalog-tester.spec.ts` — independent of the Coder's own
  `e2e/catalog.spec.ts` (which already exists as part of the fase-3
  deliverable). Focus: the specific risk items named in the test brief,
  verified independently rather than trusted from `changes.md`, plus gaps
  the Coder's own "What the Tester should focus on" note flagged:
  - Ponytail fix #1 (`isExpectedBootNoise` scoping) — a pure unit test of the
    predicate, plus a live-page integration test proving the gate does not
    swallow a console error from an origin other than `/api/auth/session`.
  - Ponytail fix #2 (render-time draft resync) — the price slider legend and
    the mobile search input resync when the URL changes from *outside* the
    component (browser back, "Limpar filtros"), not just on remount.
  - `network` contract traps — every category×network pair checked
    exhaustively (not a spot check), the exact 16/16/16 network totals,
    `toSummary` field presence on both the list and detail payloads, and the
    `network=bitcoin` → 400 failure case.
  - A stronger `out-of-order` assertion: not just `aria-pressed`, but that
    the stale response's title never repaints the grid.
  - Spec edge cases without a test anywhere yet: `?page=99` against a real
    (non-empty) 2-page filter, `priceMin > priceMax`, search with no
    matches, double-click toggle history coherence, combined
    category+network+price+q AND semantics, `MobileSearchBar` submit from
    `/nft/$nftId`, and the sold-out `nft-013` card (spec's own edge-case
    list names this one; no existing test touched it).

## Coverage

| # | Spec item | Test |
|---|---|---|
| 1 | Deep link combo renders matching controls/results | `catalog.spec.ts` › "deep link with a filter combo renders matching state, survives reload, and degrades invalid params" |
| 2 | `page.reload()` preserves state | same test (reload block) |
| 3 | Filter change mid-pagination resets page | `catalog.spec.ts` › "changing a filter mid-pagination resets page, and back/forward restore prior state step by step" |
| 4 | back/forward restore step by step | same test |
| 5 | Invalid params degrade, no crash | `catalog.spec.ts` (same test, `goto` with `category=invalida&network=bitcoin&page=abc`) |
| 6 | None of the 7 params live in `useState` | Verified by code review (`grep` for `useState` in `search-params.ts` consumers — only draft/UI-ephemeral state) **and** empirically: every filter/sort/page interaction across both spec files asserts on `location.search`, never on component state |
| 7 | Search commits `q` on Enter, clears on empty submit | `catalog.spec.ts` › "search commits `q` on Enter and clears it when submitted empty..." |
| 8 | Tabs write sort shortcuts + active/underline state | `catalog.spec.ts` › "tabs write sort shortcuts and drive the active/underline state" |
| 9 | `network=solana` → 16 items; `network=bitcoin` → 400 | `catalog.spec.ts` › "network=solana returns exactly 16 items..." + `catalog-tester.spec.ts` › "failure case: an unknown network value is a 400 validation_error, not a silent no-op filter" |
| 10 | Every category×network pair exists | `catalog-tester.spec.ts` › "every category×network pair has at least one item, and totals are exactly 16/16/16" (exhaustive 9×3, not a spot check) — also verified analytically outside Playwright (Node script against the fixture formula, see Results) |
| 11 | List items carry `network` (toSummary trap) | `catalog-tester.spec.ts` › "toSummary does not silently drop `network`: every list item and the detail payload carry it" |
| 12 | Query keys scoped by user | `catalog.spec.ts` › "logging in as Ana and reloading never leaks a guest catalogue query into her scope" |
| 13 | `slow`: 12 same-sized skeletons, no layout shift | `catalog.spec.ts` › "slow scenario shows 12 same-sized skeletons with no layout shift once data arrives" |
| 14 | `empty`: "Nenhum NFT encontrado" + "Limpar filtros" | `catalog.spec.ts` › "empty scenario shows..." |
| 15 | `server-error`: retry recovers without reload | `catalog.spec.ts` › "server-error scenario shows a retry affordance that recovers without reload" |
| 16 | `out-of-order`: stale response discarded | `catalog.spec.ts` › "out-of-order scenario..." + `catalog-tester.spec.ts` › "the stale first response never repaints a title that only belongs to the discarded filter" (stronger: asserts the stale title's absence, not just `aria-pressed`) |
| 17 | Pagination background fetch: `aria-busy`, previous page visible | `catalog.spec.ts` › "paginating keeps the previous page visible with aria-busy during the background fetch" |
| 18 | Live region announces/updates count | `catalog.spec.ts` › "the live region announces the result count and updates it on filter change" |
| 19 | Featured banner shows/hides with `empty` | `catalog.spec.ts` › "featured banner shows the featured NFT by default and disappears in the empty scenario" |
| 20 | Facet counts 6/5 and 16/16/16 | `catalog.spec.ts` › "facet counts match the fixtures..." + `catalog-tester.spec.ts` (network totals, item 10 above) |
| 21 | Card click → detail stub; direct hit/refresh works | `catalog.spec.ts` › "clicking a card navigates to the detail stub, and a direct hit/refresh on it works too" |
| 22 | Header active states ("Mercado" on detail, none on 404) | `catalog.spec.ts` › "header marks 'Mercado' active on the detail route, and nothing active on a 404" |
| 23 | Footer collection links apply category | `catalog.spec.ts` › "the 5 footer collection links navigate to / with the matching category applied" |
| 24 | Mobile Sheet: focus, Escape, category applies | `catalog.spec.ts` › "mobile: the filter Sheet traps focus, Escape returns it to the button, and applying a category updates the masonry" |
| 25 | Zoom 200% equivalence (Sheet reachable) | `catalog.spec.ts` › "zoom-proxy viewport (640x800) has no horizontal overflow and the category filter stays reachable via the Sheet" |
| 26 | No horizontal overflow at 390/768/1440 | `catalog.spec.ts` (3 parametrized tests) |
| 27 | Keyboard reaches every interactive control | `catalog.spec.ts` › "keyboard: Tab from the skip link reaches search, tabs, sort, filter rows, the price slider, cards and pagination" |
| 28 | Mobile card: disabled heart, badge only rare+ | `catalog.spec.ts` › "mobile card: favourite heart is a disabled placeholder; rarity badge only shows on rare/epic/legendary" |
| 29 | `build`/`typecheck`/`lint`/`test` pass | `pnpm build`, `pnpm typecheck`, `pnpm lint` all clean (verified directly, see Results); `pnpm test` — **FAILURES**, see Results |
| 30 | 216 legacy tests stay green; `empty`/`out-of-order` debt closed | `e2e/api-contracts.spec.ts` + `e2e/runtime-behavior.spec.ts` run in isolation: 216/216 green. `empty`/`out-of-order` covered by items 14/16 above |

### Edge cases

| Edge case | Test |
|---|---|
| `?page=99` out of range | `catalog-tester.spec.ts` › "?page=99 out of range on a real >1-page filter shows the empty state, not a crash" (uses `network=solana`, a real 2-page filter — not a 0-result filter that would show empty for an unrelated reason) |
| `?priceMin=abc` / `priceMin > priceMax` | `catalog-tester.spec.ts` › "priceMin > priceMax degrades to an empty result set at the API layer, no exception" (**passes**, API layer) + "BUG: a hand-typed price deep link..." (**fails** — the client never sends the filter; see Results) |
| Anonymous 401 boot stays silent | Pre-existing `runtime-behavior.spec.ts` clean-boot test (unchanged, still green) + `catalog-tester.spec.ts`'s two `isExpectedBootNoise` tests (independent verification of the gate that makes that assertion trustworthy) |
| `empty`: counts 0, slider fallback `'1'`, no NaN | `catalog-tester.spec.ts` › "filter-panel draft resyncs after 'Limpar filtros' clears the URL" (asserts the `0 ETH – 1 ETH` fallback explicitly under `mock-scenario=empty`) |
| `out-of-order` mid-flight filter change, no mixed/regressed state | Item 16 above |
| `prefers-reduced-motion` | Unchanged, global, covered pre-existing by `runtime-behavior.spec.ts` — not re-tested (out of this fase's diff) |
| Double-click same filter row = toggle, 2 history entries | `catalog-tester.spec.ts` › "double-click on the same filter row toggles it on then off, leaving two coherent history entries" |
| Sold-out `nft-013` renders normally | `catalog-tester.spec.ts` › "a sold-out NFT (nft-013, available 0) renders normally in the catalogue, not excluded or specially marked" (**NOT COVERED before this fase** — neither `catalog.spec.ts` nor any legacy spec touches `nft-013` in a catalogue context) |
| `q=zzz` no results | `catalog-tester.spec.ts` › "search with no matches ('zzz') shows the empty state with 'Limpar filtros'" |
| `MobileSearchBar` submit from `/nft/$nftId` | `catalog-tester.spec.ts` › "MobileSearchBar submit from /nft/$nftId navigates to / with `q` applied" |
| Desktop search: Escape discards draft, reopen shows committed `q` | `catalog.spec.ts` › "desktop header search: Enter commits and closes, Escape discards the draft and returns focus" |
| Combined category+network+price+q = AND | `catalog-tester.spec.ts` › "category + network + price + q combined apply as AND (intersection), not OR" |

## Results

**302 passed / 2 failed** (304 total, both projects included: 216 legacy +
54 in `catalog.spec.ts` [27 tests × 2 projects] + 34 in
`catalog-tester.spec.ts` [17 tests × 2 projects]).
`pnpm build`, `pnpm typecheck`, `pnpm lint` are all clean. No flake: every
failure reproduced identically across repeated runs and both projects
(desktop-chromium, mobile-chromium); this is a deterministic logic bug, not
timing-sensitive.

### The 2 failures — one real defect, found independently, not fixed

**`e2e/catalog-tester.spec.ts` › "BUG: a hand-typed price deep link (spec
edge case 'priceMin > priceMax', unquoted) is silently dropped, not
applied"** — fails on both `desktop-chromium` and `mobile-chromium`.

- **Expected** (per the spec's own edge-case wording, typed exactly as
  written there: `?priceMin=5&priceMax=1`): the catalogue shows "Nenhum NFT
  encontrado" — the API-layer sibling test in the same file
  (`priceMin > priceMax degrades to an empty result set at the API layer, no
  exception`) confirms `GET /api/nfts?priceMin=5&priceMax=1` really does
  return `items: []`, so an empty state is the correct expectation.
- **Actual**: the full default 48-item catalogue renders. The price filter
  never reaches the request at all.
- **Root cause** (confirmed by direct reproduction with a throwaway Node +
  Playwright script against the built preview, independent of the test
  file, before writing the assertion): TanStack Router's default
  `parseSearch` (`@tanstack/router-core/dist/esm/searchParams.js`,
  `defaultParseSearch` / `jsonStart` regex) JSON-parses any URL value whose
  first character looks like the start of a JSON literal — digits included.
  `priceMin=5` and `priceMax=1`, typed as plain numbers in the URL, become
  the JavaScript **numbers** `5` and `1` before `validateSearch` ever runs.
  `catalogSearchSchema`'s `ethString` field is `z.string().regex(...)` — a
  strict string type — so a number fails validation and falls through
  `.catch(undefined)`, exactly the same mechanism the spec relies on for
  `?category=invalida`, except here it fires on a **semantically valid**
  price, purely because of a type mismatch introduced one layer up by the
  router's default parser. No `parseSearch`/`stringifySearch` override was
  configured for the router (confirmed: `grep -rn "parseSearch" src` —
  no hits outside the generated route tree).
- **Why it doesn't show up anywhere else**: the app's own `FilterPanel`
  never hits this path when a user applies a price filter through the UI —
  `navigate()` passes the search object directly, and when it *is* later
  serialized to the URL bar, `stringifySearch` round-trips the string with
  a leading/trailing JSON quote (`priceMin=%220.05%22`), which
  `parseSearch` then correctly turns back into the string `"0.05"` on the
  next parse (verified: Apply → reload → the filter persists correctly,
  `0.05 ETH – 13 ETH`, confirmed by direct reproduction). The bug is
  reachable **only** for a URL a human or an external link constructs by
  hand, unquoted — but that is exactly the literal shape of this spec's own
  `priceMin`/`priceMax` edge-case bullet, and of criterion 1's "acesso
  direto, sem interação" principle applied to price. `category`/`network`
  are unaffected because non-numeric strings (`"music"`, `"polygon"`) never
  match the router's `jsonStart` heuristic; only `priceMin`/`priceMax` (and,
  in principle, a purely-numeric `q`, spot-checked separately and reproduced
  too, though no NFT title is ever purely numeric so it has no real-world
  trigger) are exposed.
- **Not a test bug**: the companion test in the same `describe` block using
  a *quoted* URL (`quoted('0.05')` → `%220.05%22`, i.e. exactly the shape the
  app itself produces) passes — see "filter-panel price slider legend
  resyncs when the URL changes from outside (browser back)" and "filter-panel
  draft resyncs after 'Limpar filtros' clears the URL", both green. Those
  two tests exist specifically to isolate the Ponytail-fix-#2 resync
  behaviour from this parser quirk, so that verifying one doesn't get a
  false negative from the other.
- **Scope note**: I did not touch `src/features/nft/search-params.ts` or
  any router configuration to fix this — per the Tester's mandate, this is
  a finding to report, not a task to solve. A plausible fix (for whoever
  picks this up) is a custom `parseSearch`/`stringifySearch` pair on the
  router that never attempts JSON-parsing string-typed search fields, or
  loosening `ethString` to accept `z.union([z.string(), z.number()]).transform(String)`
  — but that's a decision for the Coder/Reviewer, not something I applied
  here.

### Everything else independently verified and confirmed correct

- **`network` contract** (risk item 2): `toSummary` in
  `src/mocks/handlers/nfts.ts` does destructure and return `network` — the
  "silent omission" trap is closed. The distribution formula
  `NETWORKS[(i + Math.floor(i / 9)) % 3]` is **not** `i % 3` — confirmed both
  by an exhaustive Playwright test (`catalog-tester.spec.ts`, item 10 above)
  and analytically with a standalone Node script reproducing the exact
  formula: every one of the 9×3 category×network pairs has ≥1 item, and the
  three networks split exactly 16/16/16.
- **`isExpectedBootNoise` gate** (risk item 4a, Ponytail fix #1): the unit
  test proves the predicate returns `true` only for `/api/auth/session`
  messages and `false` for a same-shaped 404/`ERR_FAILED` from any other
  URL. The integration test proves the live collection code path (the exact
  `${msg.text()} ${msg.location().url}` pattern the other spec files use)
  still flags an unrelated console error as a real failure. (Note:
  `page.route()` cannot intercept the hero/card `<img>` requests in this
  app at all — they're served through the MSW service worker's own fetch
  handler, a separate CDP target; confirmed zero route hits and zero
  `requestfailed` events across every glob tried. The dev server's SPA
  fallback also turns a genuinely-missing static path into a `200`, so a
  real broken-image console error isn't reproducible through this app's
  static serving either. The integration test injects a synthetic
  `console.error` with the same shape instead, which keeps the assertion
  about the gate's own logic rather than about defeating the SW.)
- **Render-time draft resync** (risk item 4b, Ponytail fix #2): both
  `filter-panel.tsx` and `mobile-search-bar.tsx` do use the render-time
  adjustment pattern (`if (synced !== current) { setSynced(current); ... }`
  during render), not `useEffect` — confirmed by reading both files. Forcing
  the URL to change from *outside* the component (browser back for the
  price slider legend and the mobile search input; "Limpar filtros" for the
  price slider) resyncs the draft correctly in all three scenarios tested.
  `pnpm lint` is clean with zero warnings — the two `react(set-state-in-effect)`
  warnings `changes.md` mentioned from before the fix are gone, consistent
  with the effect having been removed rather than merely silenced.
- **URL as source of truth** (risk item 1): every filter/sort/search/page
  interaction across both spec files reads `location.search` directly
  (never component state) to assert on. `?category=lixo`,
  `?network=bitcoin`, `?page=abc` degrade via `.catch` as specified. Filter
  changes always drop `page` from the URL (tested for category, network,
  and — via the price-deep-link tests above — implicitly for price too,
  modulo the bug documented above).
- **`empty`/`out-of-order`** (risk item 3): both scenarios are exercised
  by the Coder's own tests and strengthened by mine (stale-title absence
  for `out-of-order`; explicit `'1'` slider fallback for `empty`).
- **Accessibility** (risk item 6): skeleton dimensions, empty/error states
  with recovery, live region, keyboard reachability, and no-overflow at
  390/768/1440 are all covered by the Coder's `catalog.spec.ts` and pass.

## Notes

- My testing boundary per the assignment was contract, unit, and the 30
  acceptance criteria; I did not add coverage for long-session persistence,
  breakpoint-crossing, or reload-across-navigation scenarios beyond what the
  criteria above already require — that's the next E2E phase's job, and it
  won't repeat what's already proven here.
- I did not modify any non-test source file. The one real defect found
  above is reported, not patched.

---

## Re-test — iteration 1

Scope of this re-test, per the fix cycle's own boundary: contract, unit, and
acceptance criteria. E2E (session-length, breakpoint-crossing, persistence)
is out of scope here and belongs to the next phase.

### Test command
```
pnpm exec playwright test e2e/catalog.spec.ts e2e/catalog-tester.spec.ts   # affected, run first
pnpm typecheck && pnpm lint && pnpm build
pnpm exec playwright test                                                  # full suite, once, at the end
```
Plus a throwaway Node + `@playwright/test` script driven against `pnpm
preview` (production build), used only to independently re-verify the six
items in the re-test request without trusting `changes.md`'s account of
them. Deleted after use; not part of the delivered test suite.

### Diff actually touched (confirmed by reading, not by trusting `changes.md`)
`src/main.tsx` (25 lines added: `parseSearch`/`stringifySearch` pair +
comment, passed into `createRouter`) and `e2e/catalog-tester.spec.ts`
(`quoted()` removed, the two URLs at lines 102/132 now plain, the
"BUG:"-prefixed test renamed and its comment updated — its assertion,
`expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado'
})).toBeVisible()`, is byte-for-byte what it was before the fix). No other
file in the working tree carries changes attributable to this iteration.

### 1. Defect is dead — verified independently
Rebuilt (`pnpm build`), served via `pnpm preview` (not `pnpm dev`, not the
Playwright webServer config already exercised by the suite — a fully
separate process), hit `/?priceMin=5&priceMax=1` with a throwaway script:
`getByRole('heading', { name: 'Nenhum NFT encontrado' })` visible, 0
`a[href^="/nft/"]` cards. Confirmed independently of the human's own
production-build check and of the Coder's own new test.

### 2. No regression in the 34 URL-shape assertions
Ran `e2e/catalog.spec.ts` + `e2e/catalog-tester.spec.ts` (88 tests across
both projects) and the full 304-test suite: all green, no assertion text
in either file was touched beyond the two setup lines the plan called out
(confirmed by reading the file directly, not by trusting the diff
description — see "Diff actually touched" above). The Planner's prediction
of zero assertion changes across the 34 URL-shape checks held.

### 3. Round-trip
Independent check (prod build, throwaway script): navigating directly to
`/?priceMin=0.05&priceMax=1` (the plain form the app's own
`stringifySearch` now writes) leaves `location.search` unchanged at
`?priceMin=0.05&priceMax=1` and the price-slider legend reads `0.05 ETH –
1 ETH` — i.e. app-written and hand-typed forms are now the same string, and
neither round-trip introduces `%22`. `e2e/catalog-tester.spec.ts`'s own
"filter-panel price slider legend resyncs..." test covers the
UI-apply → URL direction; the deep-link test above covers the
hand-typed → UI direction — both converge on the same state.

### 4. `stringify` never writes the literal string `"undefined"`
Forced the condition directly against the guard's own trigger (a filter
change that drops `page`, not just a passive read): booted at
`?category=music&page=2`, clicked the Solana network filter (which resets
`page`). Result: `location.search` became `?category=music&network=solana`
— `page` disappeared entirely, no `page=undefined` and no bare `undefined`
substring anywhere in the URL. This is the `if (value !== undefined)` guard
doing exactly what the plan said it exists for; without it `String(undefined)`
would have written the literal word `undefined` into the query string.

### 5. Duplicate key — "last wins" assumption verified, not assumed
`?category=music&category=art`: `Object.fromEntries(new
URLSearchParams(...))` — confirmed on the live page, not just read in
source — resolves to `category=art`; the "Arte digital" filter row renders
`aria-pressed="true"` and the grid shows the art-filtered set, music does
not. The `ponytail:` comment's claim ("chave duplicada = última vence,
aceitável porque nenhum param é array") is now a verified fact, not a
hope, and remains true only as long as no param is turned into an array —
worth a line in review if a future phase adds a multi-select param.

### 6. Live-region content on the empty state — resolved, method documented
Independently reproduced the earlier Tester's own false lead before
concluding anything: a raw `page.locator('[aria-live]')` CSS-attribute
query on the empty-state page finds exactly **one** element —
`<section aria-label="Notifications alt+T" aria-live="polite" ...>`, the
Sonner Toaster's container, permanently empty because no toast is active
during this flow. That is the "empty text" the note flagged, and it is not
a bug: it is a toast region with nothing in it.

The catalogue's own live region does not use a literal `aria-live`
attribute at all — it uses `role="status"` (`src/features/nft/components/
catalog-grid.tsx:91`), which carries an *implicit* ARIA live-region role
or ("polite") and therefore never matches an `[aria-live]` selector. Queried
it correctly via `getByRole('status')` instead (the same selector
`catalog.spec.ts`'s own "the live region announces the result count..."
test already uses and passes): on default boot it reads `"48 NFTs
encontrados"`, and navigating to `/?priceMin=5&priceMax=1` changes it to
`"Nenhum NFT encontrado"` — both confirmed directly against the prod
build, independent of the existing Playwright test. §8's "feedback
acessível para mudança de resultados" requirement is met; there is no
second, silent live region to fix. The prior note's uncertainty is now
closed.

### Flake
None observed. The full 304-test run and the 88-test affected-file run
were each executed once and passed outright; no test was re-run to force a
green result, per the no-flake-chasing rule. If flake appears in a future
run it should be characterized (which test, how often, what differs
between runs) rather than silently re-run — nothing here required that.

### Results
**304 passed / 0 failed (304 total).** `pnpm build`, `pnpm typecheck`, `pnpm lint`
all clean. The one defect from the original report
(`?priceMin=5&priceMax=1` rendering the full catalogue instead of the empty
state) is confirmed fixed, independently, at the contract/unit/E2E-lite
boundary this pass owns. No new defect found. No regression found in the
34 URL-shape assertions, the duplicate-key assumption, the `undefined`
guard, or the live-region accessibility requirement.

---

## Re-test — iteration 2

Short cycle, no Planner, no E2E stage — the E2E's own 3 previously-failing
tests in `e2e/catalog-e2e-tester.spec.ts` (unmodified this pass) are what's
being validated; my job is to confirm they, and everything around them,
are green for the right reason, and to run the negative assertions the
original report says nothing else in the suite ever ran.

### Test command
```
pnpm typecheck && pnpm lint && pnpm build
npx playwright test          # full suite, 326 tests, run 3 times
```
Plus one throwaway spec (`e2e/footer-check.spec.ts`, deleted after use, not
part of the delivered suite) to independently characterize the footer
`aria-current` variant `changes.md` flagged but didn't fix.

### Diff actually touched (confirmed by reading, not by trusting `changes.md`)
`src/features/nft/components/catalog-toolbar.tsx` — `activeOptions={{
exact: true }}` added to `ToolbarTab`'s `<Link>`, comment trimmed to 6
lines. `src/features/nft/components/catalog-pagination.tsx` — same prop on
the page-number `<Link>`, comment trimmed to 3 lines. No other file in the
working tree carries changes attributable to this iteration (confirmed:
`git status` shows only these two under `src/features/nft/components/`
plus the untouched `e2e/catalog-e2e-tester.spec.ts` from the E2E stage).

### 1. Defect is dead — measured with the negative assertion, not just the positive
The three URLs named in the re-test request, each checked for **exactly
one** `aria-current="page"` per nav group, both the true-positive and the
false-negatives:

| URL | Group | Has `aria-current="page"` | Confirmed absent on the rest |
|---|---|---|---|
| `?sort=popular` | Ordenar catálogo | "Em alta" | "Todos os NFTs", "Novos lançamentos" |
| `?sort=newest` | Ordenar catálogo | "Novos lançamentos" | "Todos os NFTs" |
| `?network=solana&page=2` | Paginação | page "2" | page "1" |

All three are exactly the assertions in
`e2e/catalog-e2e-tester.spec.ts`'s `DEFECT:` describe block (lines
508-543), which I read in full, not just trusted by test name — each does
call `.not.toHaveAttribute('aria-current', 'page')` on the sibling
control, which is precisely the negative assertion the original E2E report
says was missing everywhere else in the suite. All three pass, in all
three full-suite runs. The long-session test's own `goBack()` regression
case (landing on `?network=solana&sort=popular`, the exact state that
surfaced the bug originally) also asserts the negative
(`e2e/catalog-e2e-tester.spec.ts:162`) and passes.

### 2. No regression in navigation
Ran the full long-session tests (interleaved search/network/sort/category/
price, mid-session reload; the 4-trigger page-reset chain with 3
`goBack()` + 2 `goForward()` + a mid-sequence reload) three times — every
step asserts the exact URL byte-for-byte and the active-control state at
that step, including combinations where `q`, `category`, `network`, and
`priceMin` are all present simultaneously while sort/page links (the ones
`exact: true` now governs) are clicked. None of those untouched params
were ever dropped, duplicated, or mismatched against the active-link
state — `exact: true` only changes what counts as "active" for display
purposes, it doesn't touch what `search` the link navigates to, so this is
expected, but I verified it rather than assumed it.

### 3. Other `<Link>`s in the app — scope sweep confirmed independently
- **Header (`Início`) and tab-bar (`Home`)**: read both files directly.
  Each nav group has exactly one `<Link>` with an explicit `aria-current`;
  every other item in the same group is a `<span>` or a disabled
  `<button>`, never a competing `<Link>`. There is structurally nothing for
  the router's own `isActive` to conflict with, regardless of
  `activeOptions`. Confirmed, not just read: `runtime-behavior.spec.ts`'s
  own header/tab-bar active-state tests (all green, 3 runs) never show a
  second element with `aria-current`.
- **Footer** (5 category links, `search={{ category }}` literal): built a
  throwaway spec and drove it against the running preview —
  `/` → all 5 `aria-current: null`; `/?category=music` → only "Música" gets
  `aria-current="page"`; `/?category=art` → only "Arte digital"; and, to
  check the claim that unrelated URL params don't leak a false match,
  `/?category=music&sort=popular&page=2` → still only "Música", exactly
  one. This matches `changes.md`'s characterization exactly: the router
  grants this link an `aria-current` the component itself never asked for,
  but because category is single-valued and no sibling link competes, at
  most one is ever marked, and it's always the correct one. Not the
  reported defect (never two simultaneous), and not something I touched —
  the Coder flagged it for the Reviewer to decide, and I'm not the
  Reviewer. Deleted the throwaway spec after use;
  `git status --short e2e/` shows no leftover file.

### 4. Comment-only cut verified behavior-neutral
Read both trimmed files in full: the diff from iteration 2's fix is
`activeOptions={{ exact: true }}` plus a short comment in each of the two
files, nothing else — confirmed by re-reading the current file contents
against what `changes.md` describes as unchanged since the fix landed
(only the comment length differs, 23→6 and 10→3 lines, as claimed). Three
green full-suite runs at 326/326, identical pass count each time, is
itself evidence of no behavioral drift, but I also diffed the JSX/logic
lines of both files by eye against what "Fix cycle (iteration 2)" in
`changes.md` describes landing, and found no discrepancy.

### 5. Full suite, 3 rounds
| Run | Result |
|---|---|
| 1 | 326 passed, 0 failed |
| 2 | 326 passed, 0 failed |
| 3 | 326 passed, 0 failed |

`pnpm typecheck`, `pnpm lint`, `pnpm build` all clean (run once before the
first round, all exit 0 with no warnings beyond the pre-existing Vite
chunk-size notice, which is unrelated to this change).

### Flake
Not reproduced. The E2E's ~4% desktop-only slider flake (Radix focus race
under worker contention) did not appear in any of the 3 full parallel
runs (`workers: undefined`, i.e. default fully-parallel, the exact
contention condition the E2E report names) — including the two tests that
exercise the price slider under a mid-session sequence
(`catalog-e2e-tester.spec.ts`'s two "Long session" tests). Consistent with
the E2E's own final recorded number (0 flaky failures in the run they
shipped); not chased further since it didn't reappear, per the standing
no-flake-chasing rule.

### Results
**326 passed / 0 failed**, three consecutive full-suite runs. The
dual-`aria-current` defect from `.pipeline/e2e-test-results.md` is
confirmed dead, verified with the specific negative assertions the
original report says were the whole reason it went unnoticed for 304
tests. No regression in navigation, no other `<Link>` in the app shares
the defect's mechanism (header/tab-bar structurally can't; footer has a
milder, non-conflicting variant, confirmed and left for the Reviewer per
plan), and the comment-only cut is behavior-neutral. Nothing to report as
a new finding this pass.
