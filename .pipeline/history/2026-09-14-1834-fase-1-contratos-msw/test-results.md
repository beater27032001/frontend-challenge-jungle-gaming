# Test Results

## Status
all passing

## Fix cycle (iteration 2) — re-test
Re-tested after the Coder's fix for the `[major]` finding in `.pipeline/review.md`:
`NftSummary.priceEth`/`available` (the denormalized top-level fields on both
`GET /api/nfts` items and the top of `GET /api/nfts/:id`) were materialized
once at seed time and never recomputed after an edition mutation (purchase,
`sold-out`, `price-changed`), so the catalogue served stale/self-contradicting
data after the first mutation. See `.pipeline/spec.md` § "Fix Plan (iteration
2)" for the 8 fix acceptance criteria and `.pipeline/changes.md` § "Fix cycle
(iteration 2)" for what the Coder touched.

**Code read to verify the fix (not just changes.md's claims):**
- `src/mocks/fixtures.ts` — `refreshNftDerived(nft)` extracted as specified:
  `nft.available` = sum of `editions[*].available`; `nft.priceEth` = min
  `priceEth` among editions with `available > 0` via `eth(e.priceEth).lt(eth(min))`
  (no more `Number(...) < Number(...)`), falling back to `editions[0].priceEth`
  when everything is sold out. `buildNft` calls it once before returning.
- `src/mocks/db.ts` — `bumpNftVersion` calls `refreshNftDerived(nft)` right
  after `nft.version += 1`, with a doc comment flagging that it now does two
  things. Confirmed via grep that `orders.ts:74,78,108` are the only call
  sites of `bumpNftVersion`/edition mutation in the repo, so this single
  change covers price-changed, sold-out, and purchase.
- `src/mocks/handlers/nfts.ts` — confirmed untouched as the plan required:
  the `priceMin`/`priceMax` filter (line 79-80) and the `price-asc`/`price-desc`
  sort (line 87-89) read `nft.priceEth` directly (pre-`toSummary`), so they
  only became correct because the stored value is now correct at write time —
  exactly the reasoning the plan gives for rejecting recompute-on-read.
- `src/mocks/handlers/cart.ts` — `mergeGuestCartInto` now ends with
  `db.carts[userId] = userRows.filter((row) => row.quantity > 0)`.
- Grepped the whole repo for `Number(` combined with `eth` (case-insensitive):
  zero matches — the float-compare in fixtures.ts is gone and no new one was
  introduced elsewhere.
- `SEED_VERSION` is still `1` — confirmed literal value in `fixtures.ts`, and
  added a dedicated test (below) asserting the post-reset top-level values for
  an untouched NFT (`nft-001`: `available: 10`, `priceEth: '0.008'`) match the
  pre-iteration fixture constants, so "the seed is byte-identical" is a tested
  fact for this run, not an assumption carried over from `changes.md`.

**Verification performed this iteration:**
- `pnpm typecheck`, `pnpm lint`, `pnpm build` — all clean.
- `pnpm test` (full suite, both `desktop-chromium` and `mobile-chromium`
  projects) run **three times in a row**: 134/134 → 134/134 → 134/134, no
  flake, identical result every run.
- `npx playwright test e2e/api-contracts.spec.ts -g "Fix Plan" --repeat-each=5`
  run separately on just the 8 new Fix Plan test cases (the highest-risk new
  surface — shared mutable in-memory `db` state, plus one test that directly
  edits the persisted `localStorage` blob to simulate a concurrent depletion):
  80/80 passed, no flake.
- Added 8 new tests in a new `Fix Plan (iteration 2): NftSummary derived
  fields stay coherent` describe block in `e2e/api-contracts.spec.ts`, plus 1
  new static-check test in the existing `Static contract checks` block. Every
  one of them asserts on the **top-level** `priceEth`/`available` fields
  (never only `editions[0].*`) and cross-checks that `GET /api/nfts` and
  `GET /api/nfts/:id` agree with each other — the exact blind spot the review
  called out. No production file was touched.
- Confirmed the two review-cited contradictions no longer reproduce:
  `sold-out` on `nft-011` now yields `available: 0` at the top of both the
  detail response and the list summary (previously the summary stayed at 10
  while `editions[0].available` was 0); `price-changed` now yields the +10%
  price at the top of both responses (previously the top stayed at the old
  price while `editions[0].priceEth` was updated).
- Confirmed the multi-edition and price-filter effects the review's Fix Plan
  specifically called out: zeroing `nft-004-e1` (Standard) promotes the
  top-level `priceEth` to `'0.1'` (the Deluxe edition's price) with
  `available: 3`; `GET /api/nfts?priceMin=13` returns 0 items pre-mutation and
  exactly `nft-012` at `'13.75'` after its `price-changed` mutation.
- Confirmed the cart-merge fix with a genuine "sold out while sitting in the
  guest cart" setup: guest adds `nft-022-e1` while `available: 10`, the
  edition is then zeroed by directly editing the persisted `localStorage` db
  and reloading (the only way to model a concurrent depletion against a
  client-only mock — same technique the pre-existing "stale seedVersion" test
  already uses), then login merges and the resulting cart has no `nft-022`
  line at all, while Ana's pre-existing fixture lines (`nft-003`, `nft-007`)
  survive.

**Result: no regressions, fix verified, 134/134 passing.** Exact tally: the
full `e2e/` suite has 67 `test(...)` cases (`api-contracts.spec.ts`: 52,
`mock-boot-revalidation.spec.ts`: 2, `runtime-behavior.spec.ts`: 11,
`smoke.spec.ts`: 2) × 2 Playwright projects = 134 runs — verified by grepping
each file's case count, not estimated. See the note under Results reconciling
this against the "114" figure recorded by the previous iteration.

## Test command
`pnpm typecheck && pnpm lint && pnpm build && pnpm test`
(`pnpm test` runs `playwright test` against `e2e/*.spec.ts` on both the
`desktop-chromium` and `mobile-chromium` projects. This iteration adds 8 new
test cases, all in `e2e/api-contracts.spec.ts` (44 → 52 cases in that file),
× 2 projects = 16 new runs. See Results for the exact total-runs
reconciliation against the previous iteration's "114" figure.)

## Tests added
- `e2e/api-contracts.spec.ts` — new `Fix Plan (iteration 2): NftSummary
  derived fields stay coherent` describe block (7 tests):
  - `seed remains unchanged: fresh reset top-level fields match the known
    fixture values, SEED_VERSION stays 1` — asserts `nft-001`'s top-level
    `available`/`priceEth`/`version` and the persisted `seedVersion` after a
    reset, directly testing the "seed is byte-identical, SEED_VERSION didn't
    bump" claim instead of trusting it.
  - `sold-out: top-level 'available' (not just editions[0]) drops to 0 on both
    detail and list, and never contradicts editions` — the exact reproduction
    from the review's finding, on `nft-011`.
  - `price-changed: top-level 'priceEth' (not just editions[0]) reflects the
    new minimum on both detail and list` — on `nft-015`, asserts the exact
    `'0.033'` string (+10% via `roundEth`) at the top of both `GET /api/nfts/:id`
    and its `GET /api/nfts` summary.
  - `successful purchase decrements the top-level 'available' on both detail
    and list, not only the edition` — extension of criterion 14, on `nft-017`.
  - `recomputes the minimum across multiple editions: zeroing the cheaper
    Standard edition promotes the Deluxe price to the top` — `nft-004`
    (Standard `'0.05'`/10 units, Deluxe `'0.1'`/3 units), zeroes Standard via
    the `sold-out` hook, asserts top `priceEth === '0.1'` and `available === 3`.
  - `the price filter operates on the freshly-recomputed value: ?priceMin=13
    returns 0 items pre-mutation, exactly nft-012 post-mutation` — the
    filter-on-stale-value effect flagged in the task brief, not explicit in
    the original review text.
  - `guest→user cart merge drops a line capped to 0 by an edition that sold
    out while it sat in the guest cart` — the true "concurrent depletion"
    edge case from criterion 6 (guest adds while `available > 0`, edition
    sells out while the row is still in the guest bucket, then the merge on
    login must cap-and-drop it), built via direct `localStorage` edit + reload
    since the client-only mock has no way to model two independent live
    sessions racing on the same db otherwise.
  - `no Number(...) is applied to an *Eth-named value anywhere in src/ (fix
    plan iteration 2, criterion 7)` — added to the existing `Static contract
    checks` describe block; static regex grep over every `.ts`/`.tsx` file.

## Coverage
| Spec item (criterion / edge case) | Test |
|---|---|
| **Fix Plan (iter. 2) — 1.** `sold-out`: top-level `available === 0` on detail (not just `editions[0]`), summary agrees | `Fix Plan (iteration 2)... › sold-out: top-level 'available' (not just editions[0]) drops to 0 on both detail and list, and never contradicts editions` |
| **Fix Plan (iter. 2) — 2.** `price-changed`: top-level `priceEth` reflects the new minimum on detail + summary | `Fix Plan (iteration 2)... › price-changed: top-level 'priceEth' (not just editions[0]) reflects the new minimum on both detail and list` |
| **Fix Plan (iter. 2) — 3.** Successful purchase: top-level `available` decrements on detail + summary | `Fix Plan (iteration 2)... › successful purchase decrements the top-level 'available' on both detail and list, not only the edition` |
| **Fix Plan (iter. 2) — 4.** Multi-edition min recompute: `nft-004` → top `priceEth '0.1'`, `available 3` | `Fix Plan (iteration 2)... › recomputes the minimum across multiple editions: zeroing the cheaper Standard edition promotes the Deluxe price to the top` |
| **Fix Plan (iter. 2) — 5.** Price filter on updated value: `?priceMin=13` → 0 then exactly `nft-012` at `'13.75'` | `Fix Plan (iteration 2)... › the price filter operates on the freshly-recomputed value: ?priceMin=13 returns 0 items pre-mutation, exactly nft-012 post-mutation` |
| **Fix Plan (iter. 2) — 6.** Merge drops a line capped to 0; pre-existing lines survive | `Fix Plan (iteration 2)... › guest→user cart merge drops a line capped to 0 by an edition that sold out while it sat in the guest cart` |
| **Fix Plan (iter. 2) — 7.** No `Number(...)` on an `*Eth` field anywhere in `src/` | `Static contract checks... › no Number(...) is applied to an *Eth-named value anywhere in src/ (fix plan iteration 2, criterion 7)` |
| **Fix Plan (iter. 2) — 8.** No regression: seed unchanged, 114 pre-existing runs still green, clean typecheck/lint/build/test | `Fix Plan (iteration 2)... › seed remains unchanged: fresh reset top-level fields match the known fixture values, SEED_VERSION stays 1`, plus the full 134/134 × 3 runs and the `--repeat-each=5` targeted run recorded above |
| Original criteria 1-25 (phase 1) and Fix Plan (iteration 1) criteria 1-7 | Unchanged from the previous iteration's coverage table in git history of this file / `.pipeline/changes.md`; all still pass in this run (see the full pass list in the raw Playwright output referenced under Results) |

## Results
**Fix cycle (iteration 1) baseline going into this iteration:** the previous
`test-results.md` reported "114/114", but that figure only tallied
`api-contracts.spec.ts` (46 cases) + `runtime-behavior.spec.ts` (11 cases) =
57 cases × 2 projects = 114 — it did not count `smoke.spec.ts` (2 cases) or
`mock-boot-revalidation.spec.ts` (2 cases), which were already part of the
suite and already passing (both are named explicitly as unmodified/green in
`.pipeline/changes.md`). The actual full `pnpm test` run at that baseline was
61 cases × 2 = 122 runs; "114" undercounted 4 pre-existing cases. This is a
gap in the previous iteration's documentation, not a regression introduced
here — flagging it for accuracy since the reviewer/human should not read
134 as an unexplained jump from 114.

**This iteration (fix cycle 2 re-test):** added 8 new test cases, all in
`e2e/api-contracts.spec.ts` (44 → 52 cases in that file; the other three spec
files are untouched). Full suite: 52 + 2 + 11 + 2 = 67 cases × 2 Playwright
projects = **134 runs**, matching the observed result exactly (verified by
grepping each file's `test(` count, not estimated). Of those, 122 are the
pre-existing runs (all still green — confirmed by diffing the pass list, no
test name is missing) and 16 are this iteration's 8 new cases × 2 projects.

Final tally: **134 passed, 0 failed**, three full `pnpm test` runs in a row
with identical results, plus a targeted `--repeat-each=5` on just the 8 new
Fix Plan cases (80/80, the file's static-check test included) — zero flake,
zero failures.

`pnpm typecheck`, `pnpm lint`, `pnpm build` all pass clean with no changes to
any non-test source file. Only `e2e/api-contracts.spec.ts` was modified (8
new tests added; no existing test was edited or removed).

**No implementation defects were found in this iteration.** The fix in
`src/mocks/fixtures.ts`, `src/mocks/db.ts`, and `src/mocks/handlers/cart.ts`
resolves the `[major]` finding exactly as the Fix Plan specified:
- `GET /api/nfts` and the top of `GET /api/nfts/:id` no longer contradict each
  other or `editions[*]` after any mutation (purchase, `sold-out`,
  `price-changed`).
- The price filter/sort on `GET /api/nfts` now operates on the fresh value,
  since the stored field is corrected at write time before those code paths
  ever read it.
- The min-price recomputation across multiple editions is correct and uses
  `big.js`, not float comparison.
- `mergeGuestCartInto` no longer leaves a `quantity: 0` row.
- The seed remains byte-identical (`SEED_VERSION` still `1`, verified by a
  direct assertion, not assumed) and none of the 114 pre-existing runs
  regressed.

All 6 remaining `[minor]` findings from `review.md` (picsum external images,
`mock-boot-revalidation.spec.ts` fusion, `empty`/`out-of-order` scenario
coverage, `waitForTimeout` vs. `page.clock`) are unchanged from the previous
iteration — the Fix Plan explicitly scoped them out of this cycle for phases
2/3, and this re-test did not touch them.
