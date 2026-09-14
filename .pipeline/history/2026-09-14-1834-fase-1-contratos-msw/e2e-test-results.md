# E2E Test Results

## Status
all passing

## Mode
API (MSW handlers running inside the page, no server process — driven via
`page.evaluate(fetch)`/`page.goto` per the project's own established pattern;
no UI surface in this phase beyond the Phase 0 smoke screen).

## Fix cycle (iteration 2) — re-validation of the `[major]` finding
Re-validating the fix for the `NftSummary.priceEth`/`available` denormalization
bug from `review.md` (recomputed inside `bumpNftVersion` via
`refreshNftDerived`, per `.pipeline/spec.md` §"Fix Plan (iteration 2)"). The
Tester's 8 new tests in `e2e/api-contracts.spec.ts` (`Fix Plan (iteration 2):
NftSummary derived fields stay coherent`) already cover every mutation kind
(purchase / sold-out / price-changed / multi-edition / price-filter /
cart-merge) **in isolation** — one mutation, one `bootReset()`, one assertion
pass. I read that block in full and did not duplicate it.

What I added targets only what a single isolated mutation can't show — the
five points from this iteration's brief:

1. **Coherence under a long, realistic session.** New test drives several
   purchases across different NFTs, mixed with `sold-out`/`price-changed`
   scenario mutations and page reloads interleaved between steps, and checks
   at every checkpoint that `GET /api/nfts` and `GET /api/nfts/:id` agree with
   each other **for every previously-touched NFT**, not just the one the last
   mutation hit. This is exactly the shape of the original bug (a
   contradiction that only appears after a sequence of mutations, when
   different NFTs' derived fields could in principle interfere with each
   other through a shared recompute path) — genuinely new coverage, since
   every existing test resets and mutates exactly one NFT per test.
2. **Persistence across reload.** New test reads the raw
   `localStorage['greenmint:db:v1']` JSON directly (bypassing the API) right
   after a purchase, confirms the recomputed top-level fields are actually in
   the persisted blob (not just correct in the live in-memory `db`), reloads
   the page (forcing `hydrateDb()` to re-parse that exact blob), and confirms
   both the API response and the blob written back out after the
   rehydrate/persist round-trip still agree. This is the one check that only
   the running system (real `localStorage`, real reload) can perform; a unit
   test of `refreshNftDerived()` in isolation can't show a hydration
   regression.
3. **Reset after a heavy session.** New test performs three different
   mutations across three different NFTs (a purchase, a `sold-out`, and a
   `price-changed`), confirms all three are genuinely mutated, then resets via
   `?mock-reset=1` and asserts each of the three previously-touched NFTs (not
   an untouched control like the Tester's `nft-001` check) is back to its
   exact seed `available`/`priceEth`/`version`, on both the detail route and
   the list summary.
4. **Scenario interaction with the paginated catalogue/filter as a whole.**
   New test runs `price-changed` (which reorders an item in `price-asc`) and
   `sold-out` (which doesn't change price but must not remove the item from
   the catalogue), then verifies: `total`/`totalPages` are unaffected, the
   full `price-asc` list has no duplicate/missing id versus the pre-mutation
   baseline, the entire 48-item list is genuinely non-decreasing by the
   freshly-recomputed price (checked pairwise, not just the one mutated
   item), fetching all 4 pages individually reconstructs exactly the same
   order as one `perPage=48` call, and a combined `category`+`priceMax`
   filter correctly includes/excludes the mutated NFT on either side of its
   new price. The Tester's existing filter test only checks a single-item
   `priceMin` query against one target NFT; this extends it to the dataset
   as a whole and to sort order.
5. **Points validated in prior rounds** (`offline`, `slow`, scenario
   selection on a clean load via `addInitScript`, the shareable-link flow,
   one-shot boot params) — re-ran the existing suites
   (`e2e/mock-boot-revalidation.spec.ts`, the `Boot param cleanup`/`Scenario
   selection`/`offline scenario`/`slow scenario` blocks of
   `e2e/runtime-behavior.spec.ts`) against this iteration's real production
   build: all still pass, unmodified, no new coverage needed — these are
   genuinely unaffected by the iteration 2 fix cycle (it touched
   `fixtures.ts`/`db.ts`/`cart.ts` only, nothing in `control.ts`/
   `scenarios.ts`).

No production/mocks/non-test source file was modified. Only
`e2e/nft-catalog-session-integrity.spec.ts` was added.

## Test command
```
pnpm build                                                  # real production artifact
npx playwright test                                         # full suite, both projects
npx playwright test e2e/nft-catalog-session-integrity.spec.ts
npx playwright test e2e/nft-catalog-session-integrity.spec.ts --repeat-each=3
pnpm typecheck && pnpm lint                                 # clean
```
(`playwright.config.ts`'s `webServer` runs `pnpm build && pnpm preview --port
4173` itself, so every `npx playwright test` invocation above already
exercises the real production build, not the dev server.)

## Tests added
- `e2e/nft-catalog-session-integrity.spec.ts` — new, 4 tests:
  - `Long-session coherence across multiple NFTs, mutations and reloads ›
    purchases + sold-out + price-changed, interleaved with reloads, never
    leave any touched NFT self-contradicting` — a realistic multi-step
    session (buy nft-005 ×2 → reload → sold-out on nft-006 → reload →
    price-changed on nft-009 → no reload → buy nft-005 ×3 more → reload),
    asserting `detail.available === Σeditions[*].available` and
    `summary.{available,priceEth,version} === detail.{...}` for **all three**
    touched NFTs at **every** checkpoint, including the compounding second
    purchase on the NFT touched first.
  - `Persistence of derived fields in localStorage › the raw persisted db
    blob (not just the live API response) carries the recomputed top-level
    fields after a mutation and a reload` — reads
    `localStorage['greenmint:db:v1']` directly before and after a reload to
    confirm the recompute is actually persisted, not just held in memory.
  - `Reset after a heavy multi-mutation session › ?mock-reset=1 restores the
    exact seed values for every previously-touched NFT, not just an untouched
    one` — mutates three distinct NFTs three different ways, then confirms
    `?mock-reset=1` restores each to its exact seed `available`/`priceEth`/
    `version`, in both detail and summary.
  - `Scenario mutations keep the paginated catalogue and price filter
    globally coherent › after price-changed and sold-out, the full price-asc
    listing is still fully sorted with no duplicate/missing NFT and
    pagination totals are unaffected` — dataset-wide checks: total/totalPages
    stability, no duplicate/missing id, full pairwise sort-order check across
    all 48 items, per-page reconstruction consistency, and a combined
    category+priceMax filter reacting correctly to the new price.

## Style validation
N/A — no UI surface in this phase besides the untouched Phase 0 smoke screen
(spec's Prototype/design reference is `N/A`).

## Coverage
| Item from this iteration's brief | Test | Result |
|---|---|---|
| 1. Coherence under a long sequence: multiple purchases on different NFTs, mixed edits, reloads in between — `GET /api/nfts` and `GET /api/nfts/:id` never contradict at any point | `Long-session coherence... › purchases + sold-out + price-changed, interleaved with reloads, never leave any touched NFT self-contradicting` | PASS |
| 2. Persistence of derived fields: recomputed values survive a reload via the actual `localStorage` blob, not just in-memory | `Persistence of derived fields in localStorage › the raw persisted db blob...` | PASS |
| 3. Reset after a heavy purchase session restores top-level fields to exact seed values | `Reset after a heavy multi-mutation session › ?mock-reset=1 restores the exact seed values for every previously-touched NFT...` | PASS |
| 4. `sold-out`/`price-changed` leave the paginated catalogue and price filter coherent, not just the affected NFT's own response | `Scenario mutations keep the paginated catalogue and price filter globally coherent › ...` | PASS |
| 5a. `offline` scenario still valid | Re-ran unmodified `e2e/runtime-behavior.spec.ts › offline scenario › a cold boot with the offline scenario preset keeps the smoke screen responding, with no console error` against this iteration's build | Already PASS, re-confirmed |
| 5b. `slow` scenario still valid | Re-ran unmodified `e2e/runtime-behavior.spec.ts › slow scenario › produces the ~2500ms latency window...` | Already PASS, re-confirmed |
| 5c. Scenario selection on a clean load (`addInitScript`) still valid | Re-ran unmodified `e2e/runtime-behavior.spec.ts › Scenario selection on a clean load › ...` (both sub-tests) | Already PASS, re-confirmed |
| 5d. Shareable scenario link still valid | Re-ran unmodified `e2e/mock-boot-revalidation.spec.ts › Shareable scenario link › ...` | Already PASS, re-confirmed |
| 5e. One-shot boot params (`?mock-reset=1`/`?mock-scenario=`) still valid | Re-ran unmodified `e2e/runtime-behavior.spec.ts › Boot param cleanup (fix iteration 1) › ...` (all 4 sub-tests) and `e2e/mock-boot-revalidation.spec.ts › Boot param cleanup — no regressions...` | Already PASS, re-confirmed |
| Fix Plan (iter. 2) criteria 1-8, isolated-mutation coverage | Already genuinely covered by the Tester's `Fix Plan (iteration 2): NftSummary derived fields stay coherent` describe block in `e2e/api-contracts.spec.ts` (8 tests) — read in full, not duplicated | Already PASS, confirmed by re-run below |

## Results
Full `pnpm build` + `npx playwright test` on the real production preview:
**142 passed / 0 failed** (67 `test(...)` cases × 2 Playwright projects = 134
pre-existing runs, unchanged, + 4 new cases × 2 projects = 8 new runs = 142
total). Ran the new file standalone (8/8) and under `--repeat-each=3`
(24/24) — zero flake, including the two timing/reload-heavy tests (the
long-session test does 3 reloads and ~12s of real network round-trips per
run; identical result all 3 repeats).

`pnpm typecheck` and `pnpm lint` clean. `git status` confirms only
`e2e/nft-catalog-session-integrity.spec.ts` is new; no production, mocks, or
existing test file was touched.

**No implementation defects found in this iteration.** The fix in
`src/mocks/fixtures.ts` (`refreshNftDerived`), `src/mocks/db.ts`
(`bumpNftVersion` calling it), and `src/mocks/handlers/cart.ts`
(`mergeGuestCartInto` filtering zero-quantity rows) holds up under conditions
none of the 8 new isolated-mutation tests exercise:
- A long session mixing purchases, `sold-out`, and `price-changed` across
  three different NFTs with reloads interleaved never produces a
  contradiction between `GET /api/nfts` and `GET /api/nfts/:id`, for any of
  the touched NFTs, at any checkpoint — including a *second*, compounding
  purchase on an NFT already mutated earlier in the same session.
- The recomputed fields are genuinely in the persisted `localStorage` blob,
  confirmed by reading the raw JSON directly, and survive a real
  reload/rehydrate/persist round-trip without drift.
- `?mock-reset=1` restores the exact seed state for NFTs that were mutated
  multiple different ways during a session, not only for an NFT nothing ever
  touched.
- The catalogue stays coherent as a whole after scenario mutations: no item
  is duplicated or dropped, the full price-sorted list is genuinely ordered
  by the fresh value end to end, per-page pagination reconstructs the same
  order as a single large page, and combined filters react correctly to the
  new price.
- All previously-validated runtime behavior (`offline`, `slow`,
  `addInitScript` scenario selection, the shareable scenario link, the
  one-shot boot-param fix from iteration 1) remains valid on this iteration's
  build, confirmed by re-run rather than assumed.

Phase 1 is validated end-to-end after fix cycle iteration 2.
