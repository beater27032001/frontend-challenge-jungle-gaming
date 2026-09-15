# Test Results

## Status
all passing

## Test command
```
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```
`pnpm test` = Playwright, `desktop-chromium` (1440) + `mobile-chromium` (390) projects,
against `pnpm build && pnpm preview` (the config's own `webServer`). Run 4 times in
full to check for flake; `pnpm test --list` used to confirm the total count.

This is a re-test of **Fix Plan (iteration 2)** — the last iteration under the
review ceiling. Scope per `.pipeline/spec.md`/`.pipeline/changes.md` is exactly
3 files: `src/lib/utils.ts` (`linkFocusRing` alpha `/50` → `/75`),
`e2e/runtime-behavior.spec.ts` (the contrast test at ~1187-1276, hardened from
`toBeGreaterThan(1)` to `toBeGreaterThanOrEqual(3)`), and `ARCHITECTURE.md`
(new `## Dívidas para a fase 3` section). No new test files were added by this
pass — the required gate already exists in the file the Coder touched; the
Tester's job this cycle was to independently re-measure and to prove the gate
is falsifiable, not to author new specs.

## Tests added
None — iteration 2 does not introduce new test files or blocks. Independent
verification performed outside the committed suite (temporary, reverted after use):
- Re-measured ring contrast independently by reading `getComputedStyle` in a
  headless Chromium session against the real production preview build.
- **Forced the regression**: temporarily reverted `linkFocusRing`'s alpha from
  `/75` back to `/50` in `src/lib/utils.ts`, rebuilt, and re-ran the contrast
  test in isolation to confirm it actually fails (not just reads correctly).
- **Isolated the contrast math from the tripwire**: with alpha still reverted
  to `/50`, additionally commented out the two tripwire assertions
  (`expect(alpha).toBe(0.75)` / `expect(ringHex...).toBe('#d28a4c')`) to prove
  the `toBeGreaterThanOrEqual(3)` assertions themselves also fail independently,
  not just the tripwire.
- Restored both files from backup immediately after, confirmed via `git diff`
  that no residual changes remained, then re-ran typecheck/lint/build/test to
  confirm the restored state is clean.
- Checked file mtimes (`find ... -newer .pipeline/spec.md`) to independently
  confirm which files were actually touched in this iteration, rather than
  trusting `changes.md`'s account of scope.

## Coverage

| Spec item (Fix Plan iteration 2, acceptance criteria 1–7) | Test |
|---|---|
| 1. `src/lib/utils.ts` contains `focus-visible:ring-ring/75`, not `/50`; `rounded-xs`/`outline-none`/`focus-visible:ring-[3px]` kept; exactly 4 `linkFocusRing` usages, no call-site edited | Verified by direct source read + `grep -rn "linkFocusRing" src/` → definition + `header.tsx` ×2, `tab-bar.tsx` ×1, `__root.tsx` ×1 |
| 2. Contrast test asserts `toBeGreaterThanOrEqual(3)` twice (ink, surface-card); no `toBeGreaterThan(1)` remains; alpha/hex parsed live from `--tw-ring-color`, backgrounds parsed live from `--color-ink`/`--color-surface-card`; no literal `0.5`/`0.75` feeds `blendOver` | Verified by source read of `e2e/runtime-behavior.spec.ts:1187-1276`; confirmed no hardcoded blend inputs, only the `0.75`/`#d28a4c` tripwire literals compared against parsed values |
| 3. With `/75`, measured contrast ≈4.31:1 (ink) / ≈4.08:1 (surface-card); regression to `/50` fails the test | **Independently measured** (own run, not the Coder's numbers): `ring-on-ink contrast 4.308552129464832`, `ring-on-surface-card contrast 4.078516115777691` — matches the Planner's calculation and the Coder's report. **Regression forced**: reverted alpha to `/50`, rebuilt, re-ran the test in isolation → fails via the alpha tripwire (`Expected: 0.75, Received: 0.5`). With the tripwire additionally disabled, the contrast assertions themselves fail too: `ring-on-ink contrast 2.550067916819434` (< 3), `ring-on-surface-card contrast 2.528721128443642` (< 3) — both match the review's `~2.55:1`/`~2.53:1` figures. The gate is real and falsifiable at both layers |
| 4. The 2 inverted focus-ring token tests (`runtime-behavior.spec.ts:892-975`) pass unchanged: `--tw-ring-color` still `.toContain('#d28a4c')`, `boxShadow !== 'none'` | Confirmed present at the expected line range (892/910/954/957) with unchanged assertions; both pass in the full run (desktop wordmark/Início + mobile Home) |
| 5. Clipping/overlap tests in the same describe (~1104-1185) and the rest of the suite pass unchanged; 216/216 both projects; build/typecheck/lint clean | `pnpm typecheck`, `pnpm lint`, `pnpm build` clean (run twice). `pnpm test`: 216/216 passed on 3 of 4 full runs; 1 run had a single unrelated flake (see Results) unconnected to any file touched this iteration. `pnpm test --list` confirms `Total: 216 tests in 2 files` |
| 6. `ARCHITECTURE.md` contains `## Dívidas para a fase 3` with all 6 items, each citing file:line; decisions 1-4 byte-for-byte intact | Verified by direct read: section present with all 6 items (header prefix-matching, `--foreground` shadowing, card radius, slider thumb color, unused badge variants, uncovered mock scenarios), each with file:line; decisions 1-4 read back identical to the iteration-1 fix content |
| 7. `git status`/mtime check: only `src/lib/utils.ts`, `e2e/runtime-behavior.spec.ts`, `ARCHITECTURE.md` modified this iteration | Confirmed independently via `find . -newer .pipeline/spec.md -type f` (excluding build artifacts): only these 3 source files, matching the Coder's claimed scope exactly |

## Results

**All checks pass. 216/216 E2E tests green on 3 of 4 full runs; typecheck/lint/build clean (verified twice).**

### 1. Real contrast, measured independently — CONFIRMED, and CONFIRMED FALSIFIABLE

This is the central item of the iteration. Findings:

- **Current state (`/75`) genuinely clears 3:1 on both backgrounds**, measured
  by my own run against the real production preview, tabbing to the mobile
  tab-bar Home link (which shares the single `linkFocusRing` constant with
  the other 3 call-sites): **4.3086:1 on ink, 4.0785:1 on surface-card** —
  matching both the Planner's hand-calculated 4.31/4.08 and the Coder's
  reported 4.3086/4.0785 to 4 decimal places. Surface-card (the tab bar) is
  indeed the worse case, as the spec's fix plan states, and it still clears
  3:1 with ~36% margin.
- **The new gate is genuinely falsifiable — I did not trust the source
  reading alone.** I reverted `linkFocusRing`'s alpha to `/50`, rebuilt
  production, and re-ran the contrast test in isolation:
  - With the tripwire active (as shipped): fails immediately with
    `Expected: 0.75, Received: 0.5` before any contrast math runs.
  - With the tripwire additionally disabled (to check the math isn't a dead
    branch): the test still fails, this time on the `toBeGreaterThanOrEqual(3)`
    assertions, with measured contrast **2.5501:1 (ink)** and **2.5287:1
    (surface-card)** — both below 3, and matching the review's own
    independently-cited `~2.55:1`/`~2.53:1` figures for the old `/50` value.
  - Both files were restored from backup immediately after and reconfirmed
    clean via `git diff` and a full green re-run.
  - Conclusion: the old test's `toBeGreaterThan(1)` was indeed a decorative
    gate that would never fail; the new test fails exactly when it should,
    at two independent layers (tripwire and contrast math), and passes with
    real margin in the shipped state.

### 2. No regression in token/clipping/overlap tests — CONFIRMED

The 2 inverted focus-ring token tests (lines 892-975: desktop wordmark/Início,
mobile Home) and the 2 clipping/overlap tests (lines 1119-1185) were read
directly and match the line ranges and assertions the review expected —
untouched by this iteration, and all 4 pass in every full run.

### 3. Scope — CONFIRMED: exactly 3 files touched

`find . -newer .pipeline/spec.md -type f` (excluding `dist/`, `node_modules/`,
`.git/`, `playwright-report/`, `test-results/`) returns exactly
`ARCHITECTURE.md`, `e2e/runtime-behavior.spec.ts`, `src/lib/utils.ts` — no
other source file was modified in this iteration, confirming `changes.md`'s
claim independently rather than trusting the narrative.

### 4. Full suite regression — 216/216, one unrelated flake noted

- Run 1: 216/216 passed.
- Run 2: **1 failed** — `Primitives … › Dialog closes on an outside click and
  returns focus to the trigger` (mobile-chromium). This test lives in a
  describe untouched by this iteration (not one of the 3 files modified;
  file mtime confirms it predates this cycle) and is unrelated to the focus-
  ring/contrast change under review.
- Run 3: 216/216 passed (same test that failed in run 2 passed cleanly).
- Run 4: 216/216 passed.

This reads as a pre-existing flake in an outside-click/focus-return test
(timing-sensitive Radix Dialog interaction), not a regression introduced by
this iteration's 3-file diff — it is not part of the scope reviewed here, and
it passed in 3 of 4 runs including runs immediately before and after the
failure. Flagging it for visibility rather than silently discarding it:
**if this flake recurs with any frequency, it is a pre-existing test-quality
issue predating iteration 2 and outside this cycle's scope, not something the
fix under review introduced or that should block it.**

### 5. Build/typecheck/lint — CONFIRMED clean, twice

`pnpm typecheck` and `pnpm lint` clean on every run. `pnpm build` clean on
every run; `dist/assets/e2e-sandbox-*.js` still 0.09 kB (unaffected by this
iteration, confirmed as a side check since the build was run repeatedly).

## Conclusion

The single "Required before merge" item from `.pipeline/review.md` — raising
`linkFocusRing`'s composited contrast to ≥3:1 on both `ink` and
`surface-card`, and turning the contrast test into a real, falsifiable gate —
is verified independently and directly, including by forcing the regression
condition and watching it fail at both the tripwire and the contrast-math
layer. The `ARCHITECTURE.md` minor is also verified. Scope was exactly the 3
files specified; decisions 1-4 are untouched. No implementation files were
modified to produce this result — the one flaky failure observed is reported
here, not silently ignored or fixed.
