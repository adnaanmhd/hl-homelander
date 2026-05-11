---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 11
subsystem: ui
tags:
  [
    react-native,
    react-native-orientation-locker,
    recording,
    state-machine,
    remote-config,
    foreground-service,
  ]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial (plans 04-07/08/09/10)
    provides: the recording-surface JS module cluster — RecordingScreen, recState reducer, useRecordingLifecycle, RotatePrompt, the VisionCamera hand-gate, the crash-recovery UX, 04-MANUAL-SMOKE.md
provides:
  - 'CR-01 fix: a production rotate-prompt → ready path (device-orientation effect) — the recording surface is no longer a dead-end in non-__DEV__ builds; SC1–SC5 of the Phase-4 goal are reachable'
  - 'WR-01 fix: RemoteConfig gate.consecutive_hits_required / gate.cadence_ms reach the reducer via SET_GATE_CONFIG — they drive the GateRing target, the poll cadence, and the per-segment metadata, not the hard-coded 5/400'
  - 'WR-02 fix: HumynCapture.stop() in the mount-effect cleanup + after a cancelled start() — no orphaned native capture session / stuck FGS notification on a gate→record-handoff exit'
  - "WR-07 fix: the practice 60s cap is re-armed off wall-clock (nowMs() - startedAt), not the frozen durationMs, so the stop-confirm modal can't overrun it; 'stop-confirm' added to the §10 monitoring predicate"
  - 'WR-06/IN-01/IN-02/IN-09 cleanups: loggedOut wired to appStore.jwt; dead `timers` array removed; radii.pill replaces borderRadius:999; handleStop logs+surfaces a stop-finalize failure'
  - 'A render test that mounts RecordingScreen with the DEFAULT initialRecState (no __test_initialState) — would have caught CR-01'
  - '04-MANUAL-SMOKE.md §2 amendment: rotate-prompt → ready walked by PHYSICAL rotation with the apkRollout-debug __DEV__===true masking caveat'
affects: [phase-4-verification, phase-5-upload-queue, phase-7-observability-apk-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "rotate-prompt exit: a `state.substate === 'rotate-prompt'`-guarded useEffect that registers an Orientation.addDeviceOrientationListener + a fire-once Orientation.getDeviceOrientation read, dispatching LANDSCAPE_DETECTED on a landscape value; tears down once substate changes"
    - 'RemoteConfig → reducer: read via readGateConfig().then(), then dispatch a reducer action (SET_GATE_CONFIG) that is clamped + a no-op once the consuming substate is entered — the hard-coded default stays the unconditional pre-resolve fallback'
    - "native-session teardown chokepoint: HumynCapture.stop().catch(() => undefined) in the mount-effect cleanup is the single place that recalls camera/IMU/FGS on any exit; rejects 'no_active_session' harmlessly"
    - "wall-clock caps over frozen-TICK durations: lifecycle caps that must survive a paused TICK are computed off `nowMs() - state.startedAt`, not the reducer's last `durationMs`"

key-files:
  created:
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-11-SUMMARY.md
  modified:
    - apps/mobile/src/screens/recording/RecordingScreen.tsx
    - apps/mobile/src/screens/recording/recState.ts
    - apps/mobile/src/screens/recording/useRecordingLifecycle.ts
    - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
    - apps/mobile/src/util/analytics.ts
    - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
    - apps/mobile/__tests__/screens/recording/recState.test.ts
    - apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md

key-decisions:
  - 'WR-01 wired via a lazy SET_GATE_CONFIG dispatch from readGateConfig().then() rather than re-keying the reducer with a gateConfig 2nd arg — keeps the default 5/400 as the pre-resolve value and is a harmless no-op once the gate has been entered'
  - "useRecordingLifecycle's `startedAt` arg is OPTIONAL (`startedAt?: number | null`) so the existing hook unit test (not in this plan's file list) keeps compiling and falls back to `durationMs`; production always passes `state.startedAt`"
  - "WR-06: `loggedOut` is genuinely wired (appStore exposes `jwt`, null after signOut()) rather than left as a documented TODO — and the RecordingScreen visual test gained an appStore mock (signed-in user) so the now-live §10 logout-stop doesn't trip the `active` baselines"
  - "Task 1's RotatePrompt change is comment-only (the __DEV__ 'Pretend I rotated →' pill is KEPT as a supplementary dev affordance)"

patterns-established:
  - 'Default-state render test: a screen whose initial state has a single production exit gets a test that mounts it WITHOUT the __test_initialState escape hatch and drives that exit — the escape-hatch-only tests are what missed CR-01'

requirements-completed:
  [REC-01, REC-04, REC-05, REC-06, ONB-03, ONB-05, ONB-08, HAND-09, HAND-10, HAND-11]

# Metrics
duration: ~30min
completed: 2026-05-11
---

# Phase 4 Plan 11: Recording-surface gap closure (CR-01 / WR-01 / WR-02 / WR-07 + WR-06/IN-01/IN-02/IN-09) Summary

**Wired the production rotate-prompt → ready path so the recording surface is reachable in release builds (CR-01), pushed RemoteConfig gate config into the reducer (WR-01), made the gate→record handoff stop the native session on exit (WR-02), re-armed the practice 60s cap off wall-clock so the stop-confirm modal can't overrun it (WR-07), plus the cheap in-file cleanups and the smoke-runbook amendment — full mobile suite (579 tests) green, tsc clean.**

## Performance

- **Duration:** ~30 min (excludes the one-time `pnpm install --frozen-lockfile` + `npm ci` to populate the fresh worktree)
- **Started:** 2026-05-11 (worktree spawn)
- **Completed:** 2026-05-11
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- **CR-01 closed** — `RecordingScreen` has a new `rotate-prompt`-guarded `useEffect` that registers `Orientation.addDeviceOrientationListener` + a fire-once `Orientation.getDeviceOrientation` read and dispatches `LANDSCAPE_DETECTED` on `LANDSCAPE-LEFT`/`LANDSCAPE-RIGHT`; the `__DEV__`-only "Pretend I rotated →" pill is kept but is now a supplementary dev shortcut, not the only exit. A new `describe('CR-01 — rotate-prompt is reachable in a non-__DEV__ build')` block mounts the screen with the DEFAULT state and drives the listener.
- **WR-01 closed** — `recState` gains a `SET_GATE_CONFIG` action (clamped: `targetHits ≥ 1`, `cadenceMs ≥ 100`; no-op once `substate === 'gate'`); `RecordingScreen`'s `readGateConfig().then()` now dispatches it, so the GateRing target, the `useHandGate` poll cadence, and `buildCaptureOpts`'s `gateConfig` all reflect the live RemoteConfig values.
- **WR-02 closed** — `HumynCapture.stop().catch(() => undefined)` added to the mount-effect cleanup (the single teardown chokepoint) and to the `if (cancelled)` branch after `await HumynCapture.start(opts)` — no orphaned camera/IMU/FGS, no stuck "recording" notification on a handoff exit.
- **WR-07 closed** — the practice 60s cap effect computes `remaining = max(0, PRACTICE_HARD_CAP_MS - (nowMs() - startedAt))` (falling back to `durationMs` if `startedAt` is absent), so a stop-confirm modal that freezes the TICK can't overrun it; `'stop-confirm'` was added to `useRecordingLifecycle`'s `monitoring` predicate so the §10 safety-stop subscriptions stay live under the modal.
- **WR-06 / IN-01 / IN-02 / IN-09** — `loggedOut` wired to `appStore.jwt == null`; dead `timers` array + its cleanup loop removed; `radii.pill` replaces the two `borderRadius: 999` literals (overlayTip + toast); `handleStop` captures the `HumynCapture.stop()` rejection, logs `recording_stop_failed`, and on the real-recording ≥60s path shows "Recording saved, but finalizing failed — it may not upload." instead of the clean-save toast.
- **04-MANUAL-SMOKE.md §2** — a new "rotate-prompt → ready (CR-01 regression check)" bullet that is walked by PHYSICALLY rotating the device, with the `apkRollout` _debug_ build's `__DEV__ === true` masking caveat explicitly called out; §2 Acceptance updated to match.

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 — production orientation→LANDSCAPE_DETECTED path + the no-`__test_initialState` render test** — `4f08457` (fix; combined TDD test+impl in one commit since the impl is small and the test is the regression guard)
2. **Task 2: WR-01 / WR-02 / WR-07 — RemoteConfig gate values reach the reducer; no orphaned capture on a gate→record exit; practice cap survives the stop-confirm modal (+IN-01)** — `f663254` (fix)
3. **Task 3: IN-02 / IN-09 / WR-06 in-file polish + the 04-MANUAL-SMOKE.md §2 amendment** — `a5701b7` (fix)

_Note: the orchestrator commits SUMMARY.md (this file) + REQUIREMENTS.md separately after the wave; STATE.md/ROADMAP.md are owned by the orchestrator._

## Files Created/Modified

- `apps/mobile/src/screens/recording/RecordingScreen.tsx` — new `rotate-prompt` device-orientation effect (CR-01); `SET_GATE_CONFIG` dispatch from `readGateConfig().then()` (WR-01); `HumynCapture.stop()` in the mount-effect cleanup + after a cancelled `start()` (WR-02); `startedAt`/`loggedOut` passed into `useRecordingLifecycle` (WR-07/WR-06); `radii.pill` for the two pill StyleSheet entries (IN-02); `handleStop` logs+surfaces the stop-finalize failure (IN-09); `import type OrientationType` + `radii`
- `apps/mobile/src/screens/recording/recState.ts` — new `SET_GATE_CONFIG` action + reducer case (clamped, pre-gate-substate only), transition-table comment updated
- `apps/mobile/src/screens/recording/useRecordingLifecycle.ts` — `startedAt?` arg + `startedAtRef` + local `nowMs()` helper; practice cap re-armed off wall-clock; `'stop-confirm'` in the `monitoring` predicate; dead `timers` array + loop removed (IN-01)
- `apps/mobile/src/screens/recording/components/RotatePrompt.tsx` — header comment only: the production exit is the `RecordingScreen` device-orientation effect; the `__DEV__` pill is a supplementary dev shortcut
- `apps/mobile/src/util/analytics.ts` — new `recording_stop_failed` event name (IN-09)
- `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx` — new `CR-01 — rotate-prompt is reachable in a non-__DEV__ build` describe block (mounts with DEFAULT state, drives the device-orientation listener, covers the device-already-in-landscape and the PORTRAIT no-op cases); per-file orientation mock now ships `getDeviceOrientation`/`getInitialOrientation` and captures the registered listeners
- `apps/mobile/__tests__/screens/recording/recState.test.ts` — `SET_GATE_CONFIG` cases (updates on `ready`/`rotate-prompt`/`pre-flight`, no-op on `gate`/`active`/`stop-confirm`, clamps)
- `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx` — added an `appStore` mock (signed-in user, `jwt` non-null) so the now-live §10 logout-stop doesn't trip the `active` baselines (deviation Rule 1 — see below)
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md` — §2 "rotate-prompt → ready (CR-01 regression check)" bullet + Acceptance line update

## Decisions Made

- **WR-01 via lazy dispatch, not a re-keyed reducer.** `initialRecState({...})` stays as-is; `readGateConfig().then()` dispatches `SET_GATE_CONFIG`. The reducer's own substate guard makes a late resolve (after the user already pressed record) a harmless no-op, and the hard-coded 5/400 remain the unconditional pre-resolve fallback. (Plan's preferred path.)
- **`startedAt` is an OPTIONAL arg on `useRecordingLifecycle`.** The plan said to "add it to `UseRecordingLifecycleArgs`"; making it required would break `useRecordingLifecycle.test.tsx` (not in this plan's file list), so it's `startedAt?: number | null` with a `durationMs` fallback. Production (`RecordingScreen`) always passes `state.startedAt`.
- **WR-06: `loggedOut` genuinely wired.** `appStore` exposes `jwt` (null after `signOut()`), so per the plan's "IF such a field exists" branch it's wired via `useAppStore((s) => s.jwt == null)` — not left as a documented TODO.
- **Task 1 committed test+impl together** (rather than a separate RED commit). The impl is ~12 lines and the new render test is precisely the CR-01 regression guard; a stand-alone RED commit on an unreachable surface adds no signal. The plan's `tdd="true"` intent (a test that would have caught CR-01) is satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] RecordingScreen visual baselines tripped by the now-live §10 logout-stop**

- **Found during:** Task 3 (after wiring `loggedOut`)
- **Issue:** `__tests__/visual/RecordingScreen.visual.test.tsx` mocks neither `appStore` nor `useRecordingLifecycle`, so once `RecordingScreen` started passing `loggedOut={appStore.jwt == null}` and `appStore.jwt` defaulted to `null`, the real `useRecordingLifecycle` fired `onStop('logout')` on the two `active` baselines (`recording-active-t10s`, `recording-active-t05m32s`), flipping the rendered substate to `stopped` (~1.57% pixel diff).
- **Fix:** Added a minimal `vi.mock('../../src/state/appStore', ...)` to the visual test returning a signed-in user (`jwt: 'test-jwt'`), mirroring the selector/`getState()` shape `RecordingScreen` uses — exactly how `RecordingScreen.test.tsx` already mocks it.
- **Files modified:** `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx`
- **Verification:** `npx vitest run __tests__/visual/RecordingScreen.visual.test.tsx` → 8/8 green; full suite 579/579 green.
- **Committed in:** `a5701b7` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a regression directly introduced by the WR-06 wiring this plan mandated).
**Impact on plan:** Necessary to keep the suite green; no scope creep — the fix is one `vi.mock` block in a test file, matching an existing pattern.

## Issues Encountered

- **Fresh worktree had no `node_modules`.** This worktree-agent spawn started with neither the root `node_modules` (pnpm) nor `apps/mobile/node_modules` (npm — the mobile package is intentionally outside the pnpm workspace per `pnpm-workspace.yaml`). Ran `pnpm install --frozen-lockfile` at the repo root and `npm ci` in `apps/mobile/` once at the start; both are gitignored so no commit impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The recording surface is now reachable in a release build — Phase 4's SC1–SC5 are exercisable end-to-end (the §2 practice E2E in `04-MANUAL-SMOKE.md` can be walked). The `[BLOCKING]` §5b drift re-measurement on the gate→record handoff still owns the on-hardware gate (unchanged by this plan).
- Plan 04-12 owns the remaining Kotlin native-module gaps (`HumynHandDetectorModule.kt` WR-03 / `HumynBeepModule.kt` WR-04); WR-05 (`SETTLE_MS` re-measure) stays with the on-hardware `[BLOCKING]` §5b walk.
- No new blockers introduced.

## Self-Check: PASSED

- All 9 modified files exist on disk.
- All 4 commits (`4f08457`, `f663254`, `a5701b7`, `0bff422`) are in the branch history.
- `04-11-SUMMARY.md` created.
- Full mobile suite `npx vitest run`: 579/579 green. `npx tsc --noEmit -p tsconfig.json`: clean.

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
