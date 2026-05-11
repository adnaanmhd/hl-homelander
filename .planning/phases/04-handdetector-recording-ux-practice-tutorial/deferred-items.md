# Phase 4 — Deferred Items

Out-of-scope discoveries logged during Phase 4 execution. Per the executor SCOPE
BOUNDARY rule, these are NOT fixed by the plan that discovered them — they live
in files outside that plan's `files_modified` set.

---

## D4-01 — Pre-existing failures: the Phase-3 `__DEV__`-gated smoke seam in `HomeSkeletonScreen.tsx`

- **RESOLVED in plan 04-09** (the designated RecordingScreen-wave owner). The
  `__DEV__` smoke seam was deleted from `HomeSkeletonScreen.tsx`, the
  `home-skeleton-screen` visual baseline now passes cleanly (it never reflected
  the seam — the block crashed pre-04-01's `__DEV__` shim), and the
  `setPermsGranted is not a function` rejections in `RootNativeStack.test.tsx`
  were fixed by adding store-action stubs to that test's `freshState()`. Full
  mobile suite: **0 failed / 0 errors**. Trail: commit `fix(04-09): remove
Phase-3 __DEV__ smoke seam per 15d8a16 + D4-01`.
- **Discovered during:** Plan 04-01 (full-suite verification)
- **Status:** PRE-EXISTING — present on the plan 04-01 Task-1 commit baseline
  (`e716b51`) with zero Phase 4 source changes. `npx vitest run` at that commit:
  `364 tests, 12 failed`.
- **Root cause:** Commit `15d8a16` ("test(03): smoke walk closes UAT #5/#6/#7…")
  added a `__DEV__`-gated "▶ Smoke Capture (30s)" debug seam to
  `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` that calls
  `HumynCapture.start(...)`/`stop()`. The commit message itself says it is
  **"Removed in Phase 4 when the real RecordingScreen wires up start path."**
  The seam introduced two regressions the smoke-walk commit did not clean up:
  1. It references the RN bundler global `__DEV__`, which jsdom does not define
     → `ReferenceError: __DEV__ is not defined` at render time. Anything that
     renders `HomeSkeletonScreen` (the Home tab body, the navigator boot, the
     visual snapshot) crashed.
  2. The smoke UI uses hardcoded hex colors (`#ffaa00`, `#888`, `#0066cc`,
     `#fff`, `#cc0000`) instead of `colors.*` tokens — a D-UI-01/D-UI-02
     token-discipline regression — and the `HomeSkeletonScreen.visual` baseline
     was not regenerated.
- **Plan 04-01 partial fix (in-scope):** added a `globalThis.__DEV__ = true`
  shim to `apps/mobile/vitest.setup.ts` (mirrors Metro's debug-build default).
  This is a legit Rule 1/3 fix (the setup file is in plan 04-01's scope and the
  shim helps the whole suite). It unblocks **10 of the 12** failures
  (`HomeSkeletonScreen.test.tsx` ×5, `MainTabs.test.tsx` ×2, `RootNativeStack.test.tsx`
  ×3). Suite goes 364→**371** tests, 12→**2** failed.
- **Remaining failures (2) — NOT in plan 04-01 scope:**
  - `__tests__/ui/no-hex-literals.test.ts` › `HomeSkeletonScreen.tsx contains no
hex-color literals` — the 5 hex literals in the smoke seam.
  - `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` › `matches baseline` —
    ~1.96% pixel diff because the `__DEV__` block now renders (it crashed
    before, so the baseline never reflected it).
  - Plus 3 `Unhandled Rejection: setPermsGranted is not a function` originating
    in `RootNativeStack.test.tsx` (a separate stale-store-API issue in that test
    that only surfaces now that the navigator renders past `HomeSkeletonScreen`).
- **Fix (for the Phase 4 plan that owns `HomeSkeletonScreen.tsx` — likely the
  04-04/04-05 RecordingScreen wave, or a `/gsd-quick`):**
  1. **Delete the `__DEV__` smoke seam from `HomeSkeletonScreen.tsx`** per
     `15d8a16`'s own "removed in Phase 4" note — this resolves the hex-literal
     gate and lets the visual baseline be regenerated cleanly.
  2. Regenerate `__tests__/visual/__image_snapshots__/HomeSkeletonScreen-*.png`.
  3. Fix the `setPermsGranted` reference in `RootNativeStack.test.tsx` (stale
     `useAppStore`/`useOnboardingStore` setter name).
- **Why not fixed in plan 04-01:** `HomeSkeletonScreen.tsx`, `RootNativeStack.test.tsx`,
  and the visual baseline PNGs are outside plan 04-01's `files_modified` scope
  (which is package.json / vitest.setup.ts / AndroidManifest.xml / MainActivity.kt
  / the new phase4-deps.test.ts). Per the SCOPE BOUNDARY rule, pre-existing
  failures in unrelated files are not auto-fixed beyond the trivial `vitest.setup.ts`
  shim above.
- **Owner:** the Phase 4 RecordingScreen plan (the designated remover of the
  `15d8a16` smoke seam), or a standalone `/gsd-quick` if it blocks earlier work.
