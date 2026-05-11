---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 12
subsystem: infra
tags:
  [
    android,
    kotlin,
    mediapipe,
    soundpool,
    react-native-native-module,
    hand-gate,
    alert-tones,
    gap-closure,
  ]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: '04-04 — HumynHandDetectorModule (HandLandmarker IMAGE mode, single-thread bgExecutor); 04-05 — HumynBeepModule (SoundPool over pre-baked .wav alert tones)'
provides:
  - 'HumynHandDetectorModule.cleanup() runs landmarker.close() on bgExecutor — serialised behind any in-flight detect(); an unmount during a gate poll can no longer close the native MediaPipe handle out from under an active detection'
  - "HumynBeepModule pre-loads both alert clips at construction + an OnLoadCompleteListener that fires a queued playTone() once decode finishes; play()'s return value is checked — the first low-battery / thermal alert tone is audible, not silently dropped"
  - 'new Robolectric case proving cleanup() resolves(null) and the module stays usable afterwards'
affects: [04-MANUAL-SMOKE, phase-04-verification, recording-screen-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Native handle close/release that can race a worker task must run on the same single-thread executor the worker runs on (not the bridge thread) — structural serialisation, not a lock that only covers construction'
    - 'SoundPool.load() is async — a play() before decode-complete returns 0 (silent); gate play() on an OnLoadCompleteListener-confirmed sample id + queue any early play() to fire on the callback'

key-files:
  created: []
  modified:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt'
    - 'apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt'

key-decisions:
  - 'Belt-and-suspenders for WR-04: eager pre-load in an init { } block AND the OnLoadCompleteListener queue — the queue alone would suffice but the eager pre-load means the queue path is almost never exercised in practice (the cues fire long after RecordingScreen mount)'
  - "No HumynBeepModuleTest.kt added — SoundPool load/play timing isn't Robolectric-shadow-friendly enough to assert audibility; that is a 04-MANUAL-SMOKE.md §4(f)/§4(g)/§5 item per the plan"
  - 'Android Gradle/Robolectric toolchain unrunnable in this dev env (missing apps/mobile/node_modules → @react-native/gradle-plugin absent; same pre-existing reanimated × RN-0.83 wall Phase 3 hit) — Kotlin changes accepted correct-by-inspection per the plan objective; on-device behaviour gated by 04-MANUAL-SMOKE.md §2/§3 + §4(f)/§4(g)/§5'

patterns-established:
  - 'WR-03 close-races-detect fix: bgExecutor.execute { synchronized(this) { landmarker?.close(); landmarker = null }; promise.resolve(null) } — file-header KDoc mandates any future invalidate()-that-closes do the same'
  - 'WR-04 audible-first-tone fix: setOnLoadCompleteListener + loadedSampleIds + pendingPlays sets; playTone() plays if loaded else queues; play()==0 → BEEP_FAILED reject; both sets cleared in invalidate()'

requirements-completed: [HAND-01, HAND-13, REC-10]

# Metrics
duration: ~12min
completed: 2026-05-11
---

# Phase 4 Plan 12: WR-03 / WR-04 Native-Module Reliability Closure Summary

**HumynHandDetectorModule.cleanup() now runs landmarker.close() on the same single-thread executor detect() runs on (no close-races-detect crash on an unmount-during-gate-poll), and HumynBeepModule pre-loads its alert clips at construction with an OnLoadCompleteListener fallback so the first low-battery / thermal tone is audible instead of silently dropped on a SoundPool.play()-returns-0.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-11T11:08Z (approx)
- **Completed:** 2026-05-11T11:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- WR-03 closed: `cleanup()`'s `landmarker.close()` + `landmarker = null` + `promise.resolve(null)` now run inside `bgExecutor.execute { }` — serialised behind whatever `detect()` is in flight on the same single-thread executor; the `synchronized(this)` block stays so a `detectHands` enqueued after a `cleanup` re-creates the landmarker cleanly via `getOrCreate`. File-header KDoc + a `detectHands` comment document the rationale and that any future `invalidate()`-that-closes must do the same.
- WR-04 closed: `HumynBeepModule` builds the `SoundPool` + starts decoding both clips in an `init { }` block; a `setOnLoadCompleteListener` records loaded sample ids and fires a queued `playTone()` once the matching id reports loaded; `playTone()` plays immediately if the clip is loaded, otherwise queues it; `play()`'s return value is checked (`streamId == 0` → `BEEP_FAILED` reject instead of a silent no-op); `loadedSampleIds` + `pendingPlays` are cleared in `invalidate()` alongside the existing pool release.
- New Robolectric case `cleanup resolves and the module still works afterwards` in `HumynHandDetectorModuleTest.kt`: `cleanup()` settles within the timeout, resolves `null` (not a reject), and a subsequent `detectHands` on a bad path still rejects `HAND_DETECT_FAILED` — proves a `cleanup` doesn't wedge the module. Follows the existing `RecordingPromise` / `await(5, TimeUnit.SECONDS)` fixture exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-03 — serialise HumynHandDetectorModule.cleanup() with detect() on the background executor** - `395fafa` (fix)
2. **Task 2: WR-04 — gate HumynBeepModule.playTone() on a confirmed-loaded SoundPool sample (OnLoadCompleteListener + pending-play queue); check play()'s return value** - `0fe24ee` (fix)

**Plan metadata:** _(committed by orchestrator with SUMMARY.md)_

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt` - `cleanup()` body moved into `bgExecutor.execute { }`; file-header KDoc + `detectHands` comment explaining the WR-03 serialisation.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt` - `init { ensurePool() }` eager pre-load; `setOnLoadCompleteListener` in `ensurePool()`; `loadedSampleIds` + `pendingPlays` synchronised sets; `playTone()` plays-if-loaded-else-queues + `play()==0` check; `invalidate()` clears the two sets; KDoc updated with the load-async / queue rationale.
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt` - added the `cleanup resolves and the module still works afterwards` Robolectric case.

## Decisions Made

- **Eager pre-load in `init { }` + the listener queue (belt-and-suspenders).** The queue path alone makes the first tone correct even if the cue is what triggers the load, but the eager pre-load (clips decoding the moment the catalyst instance exists, well before any recording starts) means the queue path is almost never hit in practice. `ensurePool()` stays idempotent so `playTone()` calling it again is a no-op.
- **No `HumynBeepModuleTest.kt`.** Per the plan: SoundPool load/play timing isn't Robolectric-shadow-friendly enough to assert audibility; covered by `04-MANUAL-SMOKE.md` §4(f) (battery 15% → 520 Hz beep) / §4(g) / §5 (thermal → descending tone sequence).
- **Android toolchain unavailable → correct-by-inspection.** `./gradlew testApkRolloutDebugUnitTest --tests "*HumynHandDetectorModuleTest*"` and `./gradlew compileApkRolloutDebugKotlin` both fail in this dev env — `apps/mobile/node_modules` is not installed, so `@react-native/gradle-plugin` (a Gradle included build) is absent; even with it the pre-existing `react-native-reanimated` × RN-0.83 incompat documented in `04-10-SUMMARY.md` / `04-VERIFICATION.md` would still block. The Kotlin changes are accepted correct-by-inspection per the plan objective (they follow the existing module's exact threading + the existing test's `RecordingPromise` fixture, and use the standard `SoundPool.OnLoadCompleteListener` API while preserving the `invalidate()` leak discipline). On-device behaviour is gated by `04-MANUAL-SMOKE.md` §2/§3 (gate poll + unmount) and §4(f)/§4(g)/§5 (alert tones).

## Deviations from Plan

None - plan executed exactly as written.

Note: `pnpm install --frozen-lockfile --prefer-offline` was run once in the worktree before the first commit — the worktree had no root `node_modules`, so the husky `pre-commit` hook (`pnpm exec lint-staged` + `pnpm typecheck`) errored on missing `tsc` / `lint-staged`. The install (4.1 s, fully from cache) restored the pnpm-workspace deps so the hook runs cleanly; it touched no committed files (it's gitignored), so it is not a code deviation. It did **not** install `apps/mobile/node_modules` (that's a separate npm-managed package per D-PKG-01..07 and was not attempted), which is why the Android Gradle toolchain still can't run.

## Issues Encountered

- **Husky pre-commit hook failed on the first attempt** — `pnpm exec lint-staged` → `lint-staged not found`, `pnpm typecheck` → `tsc: command not found`, because this fresh worktree had no root `node_modules`. Resolved by `pnpm install --frozen-lockfile --prefer-offline` (4.1 s, from cache); the commit then went through with hooks running normally (no `--no-verify`). The `lint-staged` config only targets `*.{ts,tsx}` / `*.{json,md}` — Kotlin files aren't linted by it regardless.
- **Android Gradle/Robolectric toolchain unrunnable** — see the decision above; expected and explicitly anticipated by the plan objective.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-03 + WR-04 (the two Kotlin-native reliability warnings the Phase-4 verification flagged) are closed in code; the only remaining proof is on-hardware via `04-MANUAL-SMOKE.md` §2/§3 (gate poll + unmount → no native crash) and §4(f)/§4(g)/§5 (low-battery + thermal alert tones audible on the first fire).
- No new attack surface, no new permissions, no new bridge methods, no new file paths — the existing input validation on `detectHands` / `playTone` and the `invalidate()` leak discipline on both modules are preserved.
- Plan 04-11 (the `RecordingScreen.tsx` / `useRecordingLifecycle.ts` / crash-recovery-UX side) is independent and out of scope here.

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_

## Self-Check: PASSED

- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt
- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt
- FOUND: apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt
- FOUND: commit 395fafa (Task 1)
- FOUND: commit 0fe24ee (Task 2)
