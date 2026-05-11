---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 01
subsystem: infra
tags:
  [
    react-native,
    vision-camera,
    react-native-tts,
    react-native-fs,
    react-native-orientation-locker,
    vitest,
    jsdom,
    android-manifest,
  ]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: RN 0.83 mobile scaffold, vitest+jsdom host-component shim (vitest.setup.ts), AppFlavor module
  - phase: 03-humyn-capture-native-module
    provides: HumynCapture native module + NativeEventEmitter bridge pattern, __tests__/native/ test conventions
provides:
  - Phase 4 RN library deps at CLAUDE.md-pinned exact versions (react-native-vision-camera 4.7.3, react-native-worklets-core 1.6.3, react-native-reanimated ~3.16.7, react-native-tts 4.1.1, react-native-fs 2.20.0, react-native-orientation-locker 1.7.0, @react-native-firebase/{analytics,crashlytics} 24.0.0)
  - jsdom vi.mock blocks for the four new RN libs (VisionCamera preview+takePhoto only, Tts idea-brief §13 voice chain, RNFS storage surface, Orientation landscape lock)
  - documented canonical Phase 4 native-module stub shapes (HumynHandDetector / HumynPhoneState / HumynBattery / HumynScreenBrightness / HumynBeep) — preserves the per-file vi.doMock('react-native', ...) NativeModules contract
  - react-native-orientation-locker Android wiring (MainActivity.onConfigurationChanged broadcast + the pre-existing AndroidManifest android:configChanges orientation|screenSize flags)
  - globalThis.__DEV__ shim in vitest.setup.ts (unblocks the Phase-3 smoke-seam render crashes)
affects:
  [
    04-02 (MainApplication native-package registration),
    04-03..04-10 (every Wave 2/3/4 plan that imports VisionCamera/Tts/RNFS/Orientation or the new Humyn* native modules and unit-tests them),
  ]

# Tech tracking
tech-stack:
  added:
    - react-native-vision-camera@4.7.3 (preview + takePhoto/takeSnapshot only — NOT the HEVC pipeline)
    - react-native-worklets-core@1.6.3 (transitive VC peer)
    - react-native-reanimated@~3.16.7
    - react-native-tts@4.1.1
    - react-native-fs@2.20.0
    - react-native-orientation-locker@1.7.0
    - '@react-native-firebase/analytics@24.0.0'
    - '@react-native-firebase/crashlytics@24.0.0'
  patterns:
    - 'Pattern: VisionCamera mock = forwardRef Camera returning null + useImperativeHandle exposing takePhoto/takeSnapshot on the ref; device hooks return a stub back ultra-wide device'
    - 'Pattern: react-native-tts / react-native-fs / react-native-orientation-locker mocked as { default: X, ...X } so both default-import and named-import consumers resolve'
    - "Pattern: Phase 4 native-module stubs are documented in vitest.setup.ts but NOT injected globally — per-file tests vi.doMock('react-native', ...) to add them (preserves HumynCapture.test.ts contract)"
    - "Pattern: globalThis.__DEV__ = true shim in vitest.setup.ts mirrors Metro's debug-build default for components that read __DEV__"

key-files:
  created:
    - apps/mobile/__tests__/native/phase4-deps.test.ts
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md
  modified:
    - apps/mobile/package.json
    - apps/mobile/package-lock.json
    - apps/mobile/vitest.setup.ts
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainActivity.kt

key-decisions:
  - "Skia (@shopify/react-native-skia) NOT installed — it is an OPTIONAL VisionCamera peer (peerDependenciesMeta marks it optional); takePhoto-only usage doesn't need it. Avoids pulling a heavy native binding for a preview-only surface."
  - 'AndroidManifest.xml already declares android:configChanges with orientation|screenSize (plan 02 base manifest) — no edit needed; the new test grep-asserts it as a regression gate.'
  - "Ran npm install from apps/mobile/ (its own package-lock.json) — the repo root is a pnpm workspace, not an npm workspace, so the plan's 'npm install -w apps/mobile ... from repo root' is a no-op there (Rule 3 blocking-issue adjustment)."
  - "Added globalThis.__DEV__ shim to vitest.setup.ts (Rule 1/3) — Metro's __DEV__ global is undefined in jsdom; the Phase-3 smoke seam in HomeSkeletonScreen.tsx reads it and crashed 10 pre-existing tests. The remaining 2 failures are inherent to that seam (hex literals + stale visual baseline) and belong to the Phase 4 plan that removes it."

patterns-established:
  - 'VisionCamera jsdom mock with imperative still-capture surface on the ref'
  - 'Default+named dual-export mock shape for RN libs consumed both ways'
  - 'Documented-but-not-globally-injected native-module stub shapes (per-file vi.doMock convention)'
  - 'globalThis.__DEV__ jsdom shim'

requirements-completed: [REC-01, HAND-12]

# Metrics
duration: 18min
completed: 2026-05-11
---

# Phase 4 Plan 01: Phase 4 Foundation (RN library deps + jsdom mocks + orientation-locker Android wiring) Summary

**Installed the locked Phase 4 RN libraries (VisionCamera 4.7.3 preview/takePhoto, react-native-tts, react-native-fs, react-native-orientation-locker, worklets-core, reanimated, RNFB analytics+crashlytics) at CLAUDE.md-pinned versions, added jsdom vi.mock blocks for them plus the documented Humyn\* native-module stub shapes, and wired react-native-orientation-locker's `MainActivity.onConfigurationChanged` broadcast so `lockToLandscape()` works on the (only) landscape-locked RecordingScreen.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-11T~13:30Z (planning-complete → first task)
- **Completed:** 2026-05-11T13:46:27+05:30 (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- All 8 Phase 4 RN library deps present in `apps/mobile/package.json` at the CLAUDE.md pins (VC/tts/fs/orientation-locker/worklets-core pinned exact; reanimated `~3.16.7`); no forbidden libs (`react-native-worklets` non-core, Skia 2.x, react-native-sound, react-native-track-player) added; `@react-native-firebase/crashlytics` added per idea-brief §12.
- `vitest.setup.ts` mocks `react-native-vision-camera` (Camera forwardRef + takePhoto/takeSnapshot on the ref, `useCameraDevice`/`useCameraDevices`/`getCameraDevice`, `getAvailableCameraDevices`), `react-native-tts` (idea-brief §13 voice chain: `getInitStatus` 'success', `voices` en-IN + en-US, `speak`/`stop`/`addEventListener`), `react-native-fs` (named + default; `CachesDirectoryPath`/`DocumentDirectoryPath`, `mkdir`/`moveFile`/`unlink`/`exists`/`readDir`, `getFSInfo` 64 GB / 32 GB free), and `react-native-orientation-locker` (default `Orientation` with `lockToLandscape`/`unlockAllOrientations`/listeners, named `OrientationType` enum + `OrientationLocker` no-op component).
- Documented the canonical Phase 4 native-module stub shapes (`HumynHandDetector`, `HumynPhoneState`, `HumynBattery`, `HumynScreenBrightness`, `HumynBeep`) in `vitest.setup.ts` while preserving the existing per-file `vi.doMock('react-native', ...)` `NativeModules` contract (the `HumynCapture.test.ts` pattern).
- `MainActivity.onConfigurationChanged` override broadcasts the `"onConfigurationChanged"` Intent (the `OrientationActivityLifecycle` contract); `AndroidManifest.xml` already carries `android:configChanges` with `orientation|screenSize` — the new test grep-asserts both as a regression gate.
- `__tests__/native/phase4-deps.test.ts` (7 tests, all green) asserts the new library mocks resolve under jsdom, the Humyn\* stub shapes inject via the per-file `vi.doMock` convention, and the manifest/MainActivity orientation-locker source invariants hold.
- `typecheck` (`tsc --noEmit`) clean; full mobile suite at **369/371 passing** — the 2 remaining failures are pre-existing (the Phase-3 `__DEV__`-gated smoke seam in `HomeSkeletonScreen.tsx`, documented in `deferred-items.md` D4-01).

## Task Commits

1. **Task 1: Install Phase 4 RN library deps at CLAUDE.md pins** — `e716b51` (chore)
2. **Task 2: jsdom mocks for the new libraries + native-module stub doc** — `12c399d` (test)
3. **Task 3: orientation-locker MainActivity wiring + phase4-deps smoke test** — `e05f374` (feat)

**Plan metadata:** (final docs commit — see git log)

## Files Created/Modified

- `apps/mobile/package.json` — added the 8 Phase 4 RN library deps; pinned VC/tts/fs/orientation-locker/worklets-core exact; bumped RNFB analytics+crashlytics to the unified 24.0.0; pinned RNFB analytics+crashlytics exact (no caret).
- `apps/mobile/package-lock.json` — lockfile synced (committed per supply-chain mitigation T-4.1-01).
- `apps/mobile/vitest.setup.ts` — added the four library `vi.mock` blocks, the documented Humyn\* native-module stub-shape comment block, and the `globalThis.__DEV__ = true` shim.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainActivity.kt` — added the `onConfigurationChanged` override (orientation-locker README requirement); documented that the companion `MainApplication.onCreate()` `OrientationActivityLifecycle.getInstance(...)` registration is owned by plan 04-02.
- `apps/mobile/__tests__/native/phase4-deps.test.ts` — new Phase 4 foundation smoke test (library mocks resolve / Humyn\* stub injection / manifest+MainActivity source invariants).
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` — logs D4-01 (the pre-existing Phase-3 smoke-seam failures, out of plan 04-01 scope).

## Decisions Made

See `key-decisions` in the frontmatter — the four substantive calls: (1) Skia not installed (optional VC peer); (2) AndroidManifest already had the configChanges flags (no edit); (3) `npm install` run from `apps/mobile/` because the repo root is pnpm not an npm workspace; (4) `globalThis.__DEV__` shim added to unblock the Phase-3 smoke-seam render crashes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm install -w apps/mobile ... from repo root` is a no-op — repo root is a pnpm workspace, not an npm workspace**

- **Found during:** Task 1
- **Issue:** The plan's install command (`npm install -w apps/mobile ... from the repo root`) doesn't work — the repo root `package.json` declares `"packageManager": "pnpm@9.15.0"` and has no `workspaces` field, so `npm -w apps/mobile` matches nothing. `apps/mobile` is a standalone npm project with its own `package-lock.json` (the `mobile:install` script does `cd apps/mobile && npm ci`).
- **Fix:** Ran `npm install ...` from inside `apps/mobile/` instead, then re-ran `npm install` after pinning versions in `package.json` to sync the lockfile.
- **Files modified:** `apps/mobile/package.json`, `apps/mobile/package-lock.json`
- **Verification:** `node -e` dep-presence check (plan Task 1 verify) exits 0; `react-native-vision-camera` is exactly `"4.7.3"`; no `react-native-worklets` key.
- **Committed in:** `e716b51`

**2. [Rule 2 - Missing critical functionality] `@react-native-firebase/crashlytics@24.0.0` added**

- **Found during:** Task 1
- **Issue:** `package.json` did not list `@react-native-firebase/crashlytics`; idea-brief §12 + CLAUDE.md mandate Crashlytics, and the existing RNFB modules are on 24.0.0 (unified minor). The plan's Task 1 action calls this out explicitly.
- **Fix:** `npm install @react-native-firebase/crashlytics@24.0.0 --save`; pinned exact (no caret) alongside the other unified RNFB modules.
- **Files modified:** `apps/mobile/package.json`, `apps/mobile/package-lock.json`
- **Verification:** present in `dependencies` at `24.0.0`.
- **Committed in:** `e716b51`

**3. [Rule 1/3 - Bug/Blocking] `globalThis.__DEV__` shim added to `vitest.setup.ts`**

- **Found during:** Task 2 (full-suite verification)
- **Issue:** 12 tests were failing on the plan's Task-1 commit baseline (`e716b51`) — pre-existing, NOT caused by this plan. Root cause: the Phase-3 commit `15d8a16` added a `__DEV__`-gated smoke seam to `HomeSkeletonScreen.tsx` that the smoke-walk commit said would be "removed in Phase 4". jsdom never defines Metro's `__DEV__` global, so the screen threw `ReferenceError: __DEV__ is not defined` at render time, taking out the Home tab, the navigator boot, and the visual snapshot (`HomeSkeletonScreen.test.tsx` ×5, `MainTabs.test.tsx` ×2, `RootNativeStack.test.tsx` ×3). The plan's acceptance criteria require a green suite for downstream plans, and `vitest.setup.ts` is in this plan's scope, so a minimal `globalThis.__DEV__ = true` shim (mirroring Metro's debug default) is the right fix.
- **Fix:** Added a guarded `globalThis.__DEV__ = true` at the top of `vitest.setup.ts`.
- **Files modified:** `apps/mobile/vitest.setup.ts`
- **Verification:** suite goes 364→371 tests, 12→2 failed; the 10 render-path failures clear.
- **Committed in:** `12c399d`

---

**Total deviations:** 3 auto-fixed (1× Rule 3 blocking, 1× Rule 2 missing-functionality, 1× Rule 1/3 bug/blocking).
**Impact on plan:** No scope creep — all three are within the plan's `files_modified` set and serve correctness/the plan's own stated intent. The remaining 2 suite failures (hex literals + stale visual baseline in `HomeSkeletonScreen.tsx`) are inherent to the Phase-3 smoke seam that a later Phase 4 plan will delete; logged in `deferred-items.md` D4-01.

## Issues Encountered

- **TypeScript strictness on the new test file:** initial `as { default: Record<string, unknown> }` casts of the library modules tripped `TS2352` (no overlap) and `noUncheckedIndexedAccess` (`TS18048`). Fixed by switching to static `import Tts from 'react-native-tts'` etc. (types come from each package's bundled `.d.ts`; runtime values come from the vitest mocks) and adding non-null assertions on the `NativeModules.Humyn*` accesses. `tsc --noEmit` clean after.
- **vitest `vi.doUnmock('react-native')` ordering:** an initial "default contract preserved" test in `phase4-deps.test.ts` ran after a `vi.doMock`/`vi.doUnmock` block and hit the _real_ `react-native/index.js` (Flow `import typeof` syntax Vite can't parse). Removed that test — the default `NativeModules == {}` contract is already covered by `HumynCapture.test.ts`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 04-02 (native-package registration) can now register the orientation-locker autolink package in `MainApplication.onCreate()` alongside the other native packages, plus the `OrientationActivityLifecycle.getInstance(...)` lifecycle listener (the `MainActivity.onConfigurationChanged` broadcast it consumes is in place).
- All Wave 2/3/4 plans can `import` `react-native-vision-camera` / `react-native-tts` / `react-native-fs` / `react-native-orientation-locker` and the `Humyn*` native modules and unit-test them under jsdom (mocks + documented stub shapes ready).
- **Carry-forward for the Phase 4 RecordingScreen plan (04-04/04-05):** delete the Phase-3 `__DEV__` smoke seam from `HomeSkeletonScreen.tsx` (per commit `15d8a16`'s own "removed in Phase 4" note), regenerate the `HomeSkeletonScreen` visual baseline, and fix the stale `setPermsGranted` reference in `RootNativeStack.test.tsx` — see `deferred-items.md` D4-01. These are the only 2 currently-red mobile tests.

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
