---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 01
subsystem: ui
tags: [react-native, kotlin, recording-lifecycle, crash-recovery, android, vitest, robolectric]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    provides: CaptureLaunchSweep boot orphan sweep, MetadataComposer/SidecarManager
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: RecordingScreen + useRecordingLifecycle (§10 policy table), bootRecoveryListener, 04-COSMETIC-GAPS.md
provides:
  - 'CaptureLaunchSweep discards ALL crash-truncated orphan fragments (D-03) — run() always returns []; no degenerate-metadata bundle (duration_seconds:0 / null drift) can reach the upload queue'
  - 'Device-distress mid-record stop (battery ≤5% / thermal abort) navigates to Home (MainTabs), or PracticeComplete mid-practice (D-05); a normal sub-60s manual discard keeps RESET_FOR_FRESH on-screen'
  - "useRecordingLifecycle.onThermalAbort now emits onStop('thermal') while active (the thermal StopReason is delivered)"
  - 'Crash-recovery toast duration reverted 15s → 5s (D-07) with do-not-re-bump + D-03 dead-code annotations'
affects: [upload-pipeline, hash-verify-worker, recording-ux, crash-recovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Discard-not-recover for crash-truncated capture fragments — metadata honesty over salvaging bytes'
    - "Device-distress stop routes the user OUT of the recording surface (Home / PracticeComplete) rather than to the on-screen 'ready' reset"

key-files:
  created:
    - apps/mobile/__tests__/boot/bootRecoveryListener.test.ts
    - .planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/deferred-items.md
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt
    - apps/mobile/src/screens/recording/RecordingScreen.tsx
    - apps/mobile/src/screens/recording/useRecordingLifecycle.ts
    - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
    - apps/mobile/__tests__/screens/recording/useRecordingLifecycle.test.tsx
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt

key-decisions:
  - 'D-03 — CaptureLaunchSweep discards all crash-truncated fragments (even a playable post-30s one) instead of re-finalizing; run() typed List<String> but always returns emptyList()'
  - 'D-05 — device-distress (battery_critical / thermal) sub-60s real stop → Home; ≥60s stop unchanged (segment saved → Home); mid-practice device-distress → PracticeComplete (simplest sane destination for a brand-new user)'
  - "D-05 thermal wiring: onThermalAbort emits onStop('thermal') from useRecordingLifecycle (smaller diff than wiring a new onSessionStop listener in the screen; HumynCapture.stop() is recall-safe)"
  - "D-07 — RECOVERY_TOAST_MS reverted to 5_000; App.tsx-mount toast architecture & dual-channel plumbing unchanged; the 'stash + trigger from Home mount' refactor is explicitly rejected for MVP"

patterns-established:
  - 'Crash-truncated capture fragment → discard the whole triple (mp4 + csv + .session.json); never re-finalize into an upload-able bundle'
  - 'A device-distress recording stop navigates the user away from the recording surface rather than dropping them one tap from another (doomed) take'

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-05-12
---

# Phase 5 Plan 01: Wave-1 Android + RN cleanup (D-03 / D-05 / D-07) Summary

**CaptureLaunchSweep now discards every crash-truncated orphan fragment (no degenerate bundle reaches uploads), a battery-≤5%/thermal mid-record stop routes the user to Home instead of the on-screen reset, and the crash-recovery toast is back to 5s with do-not-re-bump annotations.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-12T11:00:15Z
- **Completed:** 2026-05-12T11:15:00Z
- **Tasks:** 3
- **Files modified:** 7 modified + 2 created (incl. deferred-items.md)

## Accomplishments

- **D-03** — `CaptureLaunchSweep.sweepRecordings()` Pass 1's orphan-with-sidecar branch now always deletes the triple (mp4 + csv + `.session.json`); removed the dead `tryReFinalize` / `mp4LooksPlayable` / `adaptSidecar` helpers and their now-unused imports; `run()` keeps its `List<String>` shape but always returns `emptyList()`. `CaptureLaunchSweepTest` updated (the "orphan playable-mp4 + sidecar" case asserts the triple is DELETED and `run()` returns `[]`; the recovered-list cases assert always-empty). Robolectric suite green.
- **D-05** — `RecordingScreen.handleStop`: a `battery_critical` / `thermal` stop on a sub-60s real recording finalizes+discards then `navigateToHome(navigation)` instead of `RESET_FOR_FRESH`; a normal sub-60s manual discard is unchanged; mid-practice device-distress lands on `PracticeComplete` (the practice branch runs first); the ≥60s branch is unchanged (segment saved → Home). `useRecordingLifecycle.onThermalAbort` now also emits `onStop('thermal')` while active so the `thermal` StopReason is actually delivered.
- **D-07** — `bootRecoveryListener.RECOVERY_TOAST_MS` 15_000 → 5_000 with the D-07 "do not re-bump" annotation and the D-03 reconciliation note (the listener is effectively dead code now — CaptureLaunchSweep never produces an upload-able recovered segment — kept as a safety net). New `__tests__/boot/bootRecoveryListener.test.ts` pins the 5s duration + clean no-op on `[]` / malformed payloads / native-module-not-registered.
- All targeted tests pass: Robolectric `CaptureLaunchSweepTest` (BUILD SUCCESSFUL), vitest `RecordingScreen.test.tsx` (24), `useRecordingLifecycle.test.tsx` (19), `crashRecoveryToast.test.tsx` (7), `bootRecoveryListener.test.ts` (4); `tsc --noEmit` clean for `apps/mobile`.

## Task Commits

Each task was committed atomically:

1. **Task 1: CaptureLaunchSweep discards all crash-truncated fragments (D-03)** — `0a4f4f8` (fix)
2. **Task 2: Device-distress mid-record stop navigates to Home (D-05)** — `6c719dc` (feat)
3. **Task 3: Revert crash-recovery toast to 5s + annotate (D-07)** — `fc74ab9` (chore)

**Plan metadata:** _(this commit)_ — docs(05-01): complete Wave-1 cleanup plan

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt` — Pass 1 always-discard; removed dead re-finalize helpers/imports; KDoc updated to "never re-finalizes, run() always empty, D-07 toast is dead-code safety net"
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt` — updated for the always-discard behaviour + always-empty `run()`
- `apps/mobile/src/screens/recording/RecordingScreen.tsx` — `isDeviceDistress` branch in `handleStop`; sub-60s device-distress → `navigateToHome`; practice/≥60s branches annotated, unchanged
- `apps/mobile/src/screens/recording/useRecordingLifecycle.ts` — `onThermalAbort` now also emits `onStop('thermal')` while active (with the D-05 rationale comment)
- `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx` — the `useRecordingLifecycle` mock now captures the `callbacks` object; 4 new cases (battery_critical→Home, thermal→Home, normal sub-60s→RESET, practice+battery_critical→PracticeComplete)
- `apps/mobile/__tests__/screens/recording/useRecordingLifecycle.test.tsx` — `onThermalAbort` case now asserts `onStop('thermal')` while active; new "not active → no onStop" case
- `apps/mobile/__tests__/boot/bootRecoveryListener.test.ts` — NEW; pins `RECOVERY_TOAST_MS === 5_000` (via the `showToast` mock arg) + no-op on `[]` / malformed / native-not-registered
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt` — `ReactApplicationContext(ctx)` → `BridgeReactContext(ctx)` (blocking-issue fix — see Deviations)
- `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/deferred-items.md` — NEW; logs DEF-5-01 (the pre-existing RN-0.83 test breakage)

## Decisions Made

- **Thermal StopReason delivery** — there is no `onSessionStop`-driven `handleStop` wired in `RecordingScreen` today, so the plan's "OR — simpler — track a `thermalStoppedRef`" path had nothing to hook into. The smallest reliable diff was to make `useRecordingLifecycle.onThermalAbort` emit `onStop('thermal')` directly (gated on `isActive()`); HC self-stops anyway and `HumynCapture.stop()` rejects `'no_active_session'` harmlessly when it already did. The alert pill / voice cue / haptic still fire first, then the stop+nav runs.
- Followed D-03 / D-05 / D-07 as specified otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `HumynHandDetectorModuleTest.kt` no longer compiled (RN 0.83 made `ReactApplicationContext` abstract)**

- **Found during:** Task 1 (running `:app:testApkRolloutDebugUnitTest --tests CaptureLaunchSweepTest`)
- **Issue:** `app:compileApkRolloutDebugUnitTestKotlin` FAILED — `HumynHandDetectorModuleTest.kt:65/:85 Cannot create an instance of an abstract class` at `HumynHandDetectorModule(ReactApplicationContext(ctx))`. In `react-native@0.83` `ReactApplicationContext` is `abstract`; this aborted the entire `app` module unit-test compilation, so `CaptureLaunchSweepTest` (the plan's own verify step) couldn't run. Confirmed pre-existing — reproduced on a clean tree with all Plan 05-01 changes stashed.
- **Fix:** Replaced `ReactApplicationContext(ctx)` with the concrete `BridgeReactContext(ctx)` (import `com.facebook.react.bridge.BridgeReactContext`) — 2-line change. Compile + tests now succeed (deprecation warnings only). Also logged as `DEF-5-01` in `deferred-items.md`.
- **Files modified:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt`
- **Verification:** `./gradlew :app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.capture.CaptureLaunchSweepTest'` → BUILD SUCCESSFUL
- **Committed in:** `0a4f4f8` (Task 1 commit)

**2. [Rule 1 - Bug] `useRecordingLifecycle.test.tsx` thermal case contradicted the new D-05 behaviour**

- **Found during:** Task 2 (running `useRecordingLifecycle.test.tsx`)
- **Issue:** the existing case `'HumynCapture.onThermalAbort → … NO onStop'` asserted `c.onStop` was never called — directly at odds with D-05's "thermal abort is a device-distress stop". This file is not in the plan's `files_modified` list.
- **Fix:** updated the case to assert `onStop('thermal')` while active, and added a new `'not active (e.g. gate) → no onStop'` case for the substate guard. All 19 lifecycle tests pass.
- **Files modified:** `apps/mobile/__tests__/screens/recording/useRecordingLifecycle.test.tsx`
- **Verification:** `npx vitest run __tests__/screens/recording/useRecordingLifecycle.test.tsx` → 19 passed
- **Committed in:** `6c719dc` (Task 2 commit)

**3. [Rule 3 - Blocking, minor] Plan verify commands referenced `pnpm jest`; project uses `vitest`**

- **Found during:** Task 2 / Task 3 verification
- **Issue:** `apps/mobile/package.json` `test` script is `vitest run` (no jest); `pnpm jest …` errors. The plan's verify lines (`pnpm jest …`) and one acceptance criterion (`grep -c 'RECOVERY_TOAST_MS = 5_000' …`) were written against a jest assumption.
- **Fix:** ran the equivalent `npx vitest run <file>` for the same test files; `RECOVERY_TOAST_MS` is not exported so the new test asserts the 5s duration via the `showToast` mock argument rather than a direct symbol read (kept the `grep -c 'RECOVERY_TOAST_MS = 5_000' src/boot/bootRecoveryListener.ts` source check passing — it returns 1). No production behaviour affected.
- **Files modified:** (none beyond the planned test files)
- **Verification:** vitest suites green; `grep -c 'RECOVERY_TOAST_MS = 5_000' apps/mobile/src/boot/bootRecoveryListener.ts` → 1
- **Committed in:** test changes are in `6c719dc` / `fc74ab9`

---

**Total deviations:** 3 (1 blocking compile fix, 1 bug fix in an unlisted test, 1 tooling-mismatch workaround)
**Impact on plan:** Deviation 1 was required to run the plan's own verification; deviation 2 was forced by the D-05 behaviour change; deviation 3 is a no-op tooling adjustment. No scope creep — all three changes are in service of the plan's three tasks.

## Issues Encountered

- The plan's verification grep `grep -rn 'tryReFinalize\|mp4LooksPlayable\|adaptSidecar' apps/mobile/android/app/src/main` still returns two `adaptSidecar` matches — but those are in `FinalizeWorker.kt`, which has its OWN long-standing `adaptSidecar` method (the plan task text even references `[FinalizeWorker.adaptSidecar]`). The intent — that `CaptureLaunchSweep.kt` no longer contains those symbols — is satisfied: `grep 'tryReFinalize\|mp4LooksPlayable\|adaptSidecar' .../CaptureLaunchSweep.kt` returns nothing, and `tryReFinalize` / `mp4LooksPlayable` are gone repo-wide.
- Pre-existing RN-0.83 test-infra breakage (`DEF-5-01`) — fixed inline as a blocker; see Deviations.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 1 (cleanup) of Phase 5 is complete. The upload-pipeline work (plans 05-02..05-08) can proceed; D-03 guarantees the per-segment metadata stays honest before the upload queue is wired.
- One pre-existing item is logged in `deferred-items.md` (`DEF-5-01`) — already fixed here as a blocker, no follow-up needed.

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_

## Self-Check: PASSED

- All created files present (05-01-SUMMARY.md, **tests**/boot/bootRecoveryListener.test.ts, deferred-items.md)
- All task commits present (0a4f4f8, 6c719dc, fc74ab9)
