---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 07
subsystem: ui
tags:
  [
    react-native,
    react-navigation,
    react-native-svg,
    reanimated,
    vitest,
    jest-image-snapshot,
    state-machine,
    recording,
  ]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-01)
    provides: Phase-4 RN lib pins + jsdom mocks (VisionCamera/svg/reanimated etc.) in vitest.setup.ts; __DEV__ shim
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-06)
    provides: PracticeIntro navigates to the 'Recording' route with practice route params { taskId:'__practice__', taskName:'Practice — 60 sec', isPractice:true }; PracticeIntro/PracticeComplete already in REQUIRED_PHASE_2_ROUTES
provides:
  - 'src/screens/recording/recState.ts — the §4.3 state machine: RecState type (verbatim shape + RecSubstate discriminant), pure recReducer (all transitions, no perf.now/Date.now inside), initialRecState(params, gateConfig?)'
  - "5 recording UI components (src/screens/recording/components/): GateRing (130×130 SVG, 6px stroke, accent fill on rgba(255,255,255,.18) track, strokeDashoffset clockwise, instant snap-to-0 on miss, loading spinner + 'Preparing camera…' caption), VoiceCuePill (260px, auto-fade, REC-15 on-screen duplicate), StopConfirmModal (LogoutModal template, Pattern-66 inFlightRef, LOCKED body copy), AlertPill (amber top-right), RotatePrompt (__DEV__-gated 'Pretend I rotated →' pill)"
  - 'src/screens/recording/RecordingScreen.tsx — the dark-theme recording-surface shell rendering substate-driven chrome (minute-bar, 36px circular X, task name, 3s overlay tip, rotate-prompt/ready/pre-flight/gate/active/stop-confirm/stopped); useReducer(recReducer, initialRecState(route.params)); __test_initialState escape hatch. NO live camera / NO lifecycle hook (plan 04-09)'
  - "RootNativeStack 'Recording' route (MainTabs sibling, gestureEnabled:false / headerShown:false / animation:fade)"
  - "route-registry.test.ts — REQUIRED_PHASE_4_ROUTES = ['Recording'] block (D-NAV-01 / Pattern 54); 'Recording' removed from the must-be-absent list"
  - 'tokens.ts dark-theme recording tokens (recTextPrimary/Secondary/Caption, recSkipLink, recOverlayTip, recToastBg, recVoiceCueBg, recRingTrack) + recGatePrompt/recSkipLink/recAlertPill typography variants'
  - '8 static-surface visual baselines (recording-rotate-prompt/-ready/-gate-ring-0/-50/-100/-active-t10s/-active-t05m32s/-stop-confirm-modal) + recState reducer tests (43) + RecordingScreen render test (12)'
  - 'vitest.setup.ts — ActivityIndicator in the RN host shim; RotateCw in the lucide allow-list'
affects:
  [
    04-08 (the __DEV__ task affordance that also navigates to 'Recording'),
    04-09 (RecordingScreen live wiring — VC <Camera> mount,
    useHandGate poll loop,
    gate-pass→active TTS transition,
    buildCaptureOpts,
    useRecordingLifecycle,
    brightness/orientation,
    HAND-14 analytics,
    §7h post-stop routing; consumes recState + RecordingScreen + the recording funnel events; adds PracticeIntro/PracticeComplete required-route assertions),
    Phase 5 (HumynUpload — the recState.gate block becomes metadata.start_gate per §7.3),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure reducer state machine in src/screens/recording/recState.ts — verbatim engineering-handoff §4.3 RecState shape + a planner-derived RecSubstate discriminant; no side effects, timestamps arrive via action payloads (mirrors src/state/initialRoute.ts's pure-module precedent)"
    - 'RecordingScreen __test_initialState escape hatch — a render-only prop that injects a complete RecState so visual baselines + the render test can exercise every substate deterministically (the same shape the visual tests build); production callers never pass it (threat T-4.7-01)'
    - 'Transient placeholder substates in the shell auto-advance via a setTimeout-in-useEffect (pre-flight → PRE_FLIGHT_OK after a tick) so the visual baseline can land on the next substate, with the real gating logic deferred to plan 04-09'
    - "GateRing instant snap-to-0 on a hits-decrease: bypass Animated.timing and call offset.setValue(CIRC) directly (HAND-04) — the only Animated path that isn't a timing"

key-files:
  created:
    - apps/mobile/src/screens/recording/recState.ts
    - apps/mobile/src/screens/recording/RecordingScreen.tsx
    - apps/mobile/src/screens/recording/components/GateRing.tsx
    - apps/mobile/src/screens/recording/components/VoiceCuePill.tsx
    - apps/mobile/src/screens/recording/components/StopConfirmModal.tsx
    - apps/mobile/src/screens/recording/components/AlertPill.tsx
    - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
    - apps/mobile/__tests__/screens/recording/recState.test.ts
    - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
    - apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-rotate-prompt.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-ready.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-gate-ring-0.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-gate-ring-50.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-gate-ring-100.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t10s.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t05m32s.png
    - apps/mobile/__tests__/visual/__image_snapshots__/recording-stop-confirm-modal.png
  modified:
    - apps/mobile/src/navigation/RootNativeStack.tsx
    - apps/mobile/src/ui/tokens.ts
    - apps/mobile/__tests__/navigation/route-registry.test.ts
    - apps/mobile/vitest.setup.ts

key-decisions:
  - "GateRing renders an <ActivityIndicator> in the ring well when gate.phase==='loading' (HAND-06). The RN host shim in vitest.setup.ts didn't export ActivityIndicator — added it as a pass-through host component (Rule 3); RotateCw added to the lucide allow-list for RotatePrompt's glyph."
  - "The shell hides the gate 'Skip' link once gate.phase==='confirmed' (skipped/bypassed/passed) — it would be a no-op and plan 04-09 transitions to 'active' from confirmed. The link is still visible from t=0 in the waiting/loading phases (HAND-02)."
  - "RecordingScreen route-param defaults: taskId='__practice__', taskName='Practice — 60 sec', isPractice=false (mirrors the PracticeIntro params; a real-task entry from plan 04-08's __DEV__ affordance supplies its own)."
  - 'Reused the existing typography variant mechanism + new recGatePrompt/recSkipLink/recAlertPill variants in tokens.ts rather than passing inline rgba — keeps the no-hex-literals gate clean and the dark-theme partial-opacity whites tokenised.'

patterns-established:
  - 'tokens.ts dark-theme recording slot — recBg + recText{Primary,Secondary,Caption} + recSkipLink + recOverlayTip/recToastBg/recVoiceCueBg/recRingTrack (rgba tokens, not hex literals, so they pass the D-UI-01 gate)'
  - 'Pure recording state machine (recState.ts) — the canonical recording reducer; plans 04-08/04-09 dispatch onto it'

requirements-completed:
  [REC-01, REC-02, REC-03, REC-05, REC-06, HAND-02, HAND-04, HAND-05, HAND-06, HAND-10, REC-15]

# Metrics
duration: 28min
completed: 2026-05-11
---

# Phase 4 Plan 07: Recording-surface scaffold (recState + components + shell + route) Summary

**The recording-surface scaffold: the verbatim §4.3 `recState` pure state machine (full `recReducer` — every transition, timestamps via action payloads), the five recording UI components (GateRing / VoiceCuePill / StopConfirmModal / AlertPill / RotatePrompt) per the UI-SPEC dark-theme contract, the `RecordingScreen.tsx` shell rendering substate-driven chrome with a `__test_initialState` escape hatch, the `Recording` route in `RootNativeStack`, the locked Pattern-54 `route-registry.test.ts` update, and 8 static-surface visual baselines — all behind a passing recState reducer test (43 cases) + RecordingScreen render test (12 cases).**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-05-11T14:46:00Z (approx)
- **Completed:** 2026-05-11T14:56:00Z
- **Tasks:** 2
- **Files modified:** 22 (18 created, 4 modified)

## Accomplishments

- **recState.ts** — `RecState` type reproduced verbatim from `engineering-handoff.md §4.3` (the `gate` block survives onto `metadata.start_gate` in Phase 5), plus a planner-derived `RecSubstate` discriminant; `recReducer` is a pure `switch(action.type)` with `switch(state.substate)` guards implementing every transition in the §4.3 diagram (rotate-prompt→ready, ready→pre-flight, pre-flight→gate / pre-flight→ready, gate.loading→gate.waiting, GATE_HIT increments / ≥target→confirmed, GATE_MISS→0, SKIP/BYPASS→confirmed, CAPTURE_STARTED→active, CAPTURE_START_FAILED→ready, TICK, PRACTICE_HARD_CAP→stopped, X_PRESSED→stop-confirm, STOP_CONFIRM_CANCEL/STOP, STOP with the `ended` double-stop guard, BATTERY/THERMAL alert overlays, RESET_FOR_FRESH); no `performance.now()` / `Date.now()` inside the reducer (the caller passes `now` via the action). `initialRecState(params, gateConfig?)` defaults to substate `rotate-prompt`, cap 60_000 (practice) / 1_200_000 (real), gate `idle` / targetHits 5 / cadenceMs 400 (RemoteConfig-overridable).
- **5 components** under `src/screens/recording/components/`:
  - `GateRing.tsx` — 130×130 SVG (track `colors.recRingTrack` rgba(255,255,255,.18), accent fill 6px stroke `strokeLinecap="round"`, `strokeDasharray`/`strokeDashoffset` clockwise via `rotate(-90 65 65)`, `useNativeDriver:false`); `Animated.timing` toward `CIRC·(1−hits/target)` on a hits-increase; on a hits-DROP it `setValue(CIRC)` directly (instant snap-to-0, HAND-04); when `loading` it renders an `<ActivityIndicator>` in the ring well + the "Preparing camera…" caption with the ring at 0 (HAND-06). `accessibilityLabel="gate-ring"`.
  - `VoiceCuePill.tsx` — 260px white-96% pill, dark text, centered; auto-fades after `durationMs ?? 1800` (design-spec §7d); renders the cue text so the TTS utterance is duplicated on-screen (REC-15). `accessibilityLabel="voice-cue-pill"`.
  - `StopConfirmModal.tsx` — `LogoutModal.tsx` template (`<Modal transparent visible animationType="fade">`, rgba(0,0,0,.5) scrim, dark card), Pattern-66 `inFlightRef` on `onStop`; verbatim copy: title "Stop recording?", body "Recordings under 1 minute are discarded." (LOCKED), actions "Keep recording" (btn-outline) / "Stop" (btn-coral). `accessibilityLabel="stop-confirm-modal"`.
  - `AlertPill.tsx` — amber pill, 38px from top / 14px from right, white 12/600 text ("Battery 15%" / "Phone too hot"). `accessibilityLabel="alert-pill"`.
  - `RotatePrompt.tsx` — centered `RotateCw` glyph + "Rotate to landscape and mount on rig"; the `__DEV__`-gated "Pretend I rotated →" accent pill (dead-code-eliminated in prod — threat T-4.7-04). `accessibilityLabel="rotate-prompt"`.
- **RecordingScreen.tsx** — the dark-theme surface shell: `<ScreenContainer backgroundColor={colors.recBg} noSafeArea padding={0}>` with a top 3px full-width minute-bar (fills only during `active` = `min(durationMs/60000,1)`), a top-row task name + a 36px circular `X` (`recording-close` — dispatches `X_PRESSED` when `active`, else `navigation.goBack()` silent dismiss, HAND-10), a 3s "Don't exit while recording." overlay (fades after 3s), and a `switch(substate)`: rotate-prompt → `<RotatePrompt>`, ready → 88×88 coral record button + "Start Recording", pre-flight → spinner (auto-`PRE_FLIGHT_OK` after a tick so the baseline can land on gate), gate → `<GateRing>` + the verbatim gate prompt + the "Skip" link (visible from t=0, hidden once confirmed), active/stop-confirm → 32px mono `HH:MM:SS` timer + a 64×64 white stop button (22×22 coral square) + `<VoiceCuePill>` + `<AlertPill>` (+ `<StopConfirmModal>` on stop-confirm), stopped → minimal. `useReducer(recReducer, __test_initialState ?? initialRecState(route.params))`; the `__test_initialState` render-only escape hatch is documented in the docstring. NO live camera / NO lifecycle hook — that's plan 04-09.
- **RootNativeStack.tsx** — `import RecordingScreen` + `<Root.Screen name="Recording" component={RecordingScreen} options={{ gestureEnabled:false, headerShown:false, animation:'fade' }} />` as a MainTabs sibling; the navigator comment block now lists `Recording`.
- **route-registry.test.ts** — `'Recording'` removed from the must-be-absent list (now `['Player']`); a new `REQUIRED_PHASE_4_ROUTES = ['Recording']` block with its own `it('registers screen name="Recording"')` loop (D-NAV-01 / Pattern 54). `PracticeIntro`/`PracticeComplete` are NOT touched here — plan 04-09 adds those assertions.
- **tokens.ts** — dark-theme recording color tokens (`recTextPrimary` #FFFFFF, `recTextSecondary` rgba(255,255,255,.95), `recTextCaption` rgba(255,255,255,.85), `recSkipLink` rgba(255,255,255,.7), `recOverlayTip` rgba(0,0,0,.6), `recToastBg` rgba(26,26,26,.94), `recVoiceCueBg` rgba(255,255,255,.96), `recRingTrack` rgba(255,255,255,.18)) + `recGatePrompt`/`recSkipLink`/`recAlertPill` typography variants. `recBg`/`accent`/`coral`/`amber` and the `coral`/`accent` Button variants already existed.
- **Tests** — `recState.test.ts` (43 cases — initialRecState defaults incl. cap + gateConfig override, every substate transition, the GATE_HIT-at-target boundary, GATE_MISS→0, SKIP/BYPASS, the no-op-for-wrong-substate cases, RESET_FOR_FRESH, PRACTICE_HARD_CAP, the alert overlays, the double-stop guard, and reducer purity); `RecordingScreen.test.tsx` (12 cases — the dark surface + each substate's chrome + the LOCKED stop-modal body + Skip→GATE_SKIP transition + close-while-active→stop-confirm + close-pre-record→goBack); `RecordingScreen.visual.test.tsx` (8 baselines).
- **vitest.setup.ts** — `ActivityIndicator` added to the RN host shim; `RotateCw` added to the lucide allow-list (Rule 3 — blocking; the canonical shims must export the primitives the new components import).

## Task Commits

Each task was committed atomically:

1. **Task 1: recState.ts state machine + reducer policy table** — `258fd3b` (feat)
2. **Task 2: recording UI components + RecordingScreen shell + Recording route + route-registry update + visual baselines** — `10f45d8` (feat)

**Plan metadata:** _(this commit)_ `docs(04-07): complete plan`

_(Two unrelated `docs(quick-260511-kfs): …` commits — `de09bcf`, `6e03c4a` — landed on `main` between the two task commits from a concurrent quick-task session; they touch only `.planning/` and are not part of this plan.)_

## Files Created/Modified

(See the `key-files` frontmatter for the full list.) Highlights:

- `apps/mobile/src/screens/recording/recState.ts` — NEW. The §4.3 pure state machine: `RecState`/`RecSubstate`/`RecAction` types, `recReducer`, `initialRecState`.
- `apps/mobile/src/screens/recording/RecordingScreen.tsx` — NEW. The dark-theme substate-driven shell + the `__test_initialState` escape hatch; no live camera/lifecycle (plan 04-09).
- `apps/mobile/src/screens/recording/components/{GateRing,VoiceCuePill,StopConfirmModal,AlertPill,RotatePrompt}.tsx` — NEW. The 5 recording components per the UI-SPEC dark-theme contract.
- `apps/mobile/src/navigation/RootNativeStack.tsx` — added the `Recording` route (MainTabs sibling) + comment block.
- `apps/mobile/src/ui/tokens.ts` — dark-theme recording color + typography tokens.
- `apps/mobile/__tests__/navigation/route-registry.test.ts` — `REQUIRED_PHASE_4_ROUTES = ['Recording']` block; `Recording` removed from the must-be-absent list.
- `apps/mobile/vitest.setup.ts` — `ActivityIndicator` (RN host shim) + `RotateCw` (lucide allow-list).
- `apps/mobile/__tests__/screens/recording/{recState.test.ts,RecordingScreen.test.tsx}` + `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx` + 8 baseline PNGs — NEW.

## Decisions Made

- **`ActivityIndicator` + `RotateCw` shim additions:** `GateRing` renders `<ActivityIndicator>` (HAND-06 "Preparing camera…" state) and `RotatePrompt` renders the `RotateCw` Lucide glyph; neither was in the canonical jsdom shims. Added both (Rule 3 — blocking; same precedent as plan 04-06's `Vibration` shim addition). No behavior change to existing tests.
- **Skip link visibility:** the gate "Skip" link is rendered while `gate.phase` is `loading`/`waiting` (HAND-02 — visible from t=0) and hidden once `confirmed` — at that point it would be a no-op and plan 04-09 transitions to `active`. The render test asserts the link disappears after a Skip tap.
- **Route-param defaults:** `RecordingScreen` reads `route.params.{taskId ?? '__practice__', taskName ?? 'Practice — 60 sec', isPractice ?? false}` — matching the params `PracticeIntro` already passes; a real-task entry (plan 04-08's `__DEV__` affordance) supplies its own.
- **Tokenised dark-theme partial-opacity whites:** added `recText{Primary,Secondary,Caption}`/`recSkipLink` + the rgba overlay tokens to `tokens.ts` and used the typography-variant mechanism for the gate prompt / skip link / alert pill rather than inline rgba — keeps the `no-hex-literals.test.ts` D-UI-01 gate green and the dark-theme palette in one place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `ActivityIndicator` to the react-native host shim + `RotateCw` to the lucide allow-list (vitest.setup.ts)**

- **Found during:** Task 2 (rendering `GateRing` in the `gate.loading` state + `RotatePrompt` under jsdom)
- **Issue:** the canonical jsdom shims export only the primitives prior plans needed — `ActivityIndicator` (RN core) and `RotateCw` (Lucide icon) were absent, so `GateRing` and `RotatePrompt` threw `Element type is invalid` / `No "RotateCw" export is defined` at render time, taking out the RecordingScreen render test + 2 visual baselines.
- **Fix:** added `ActivityIndicator: makeComponent('ActivityIndicator')` to the RN host shim and `'RotateCw'` to the lucide ICONS allow-list (same pass-through pattern as the existing entries; same precedent as plan 04-06's `Vibration` addition).
- **Files modified:** `apps/mobile/vitest.setup.ts`
- **Verification:** RecordingScreen.test.tsx (12 cases) + RecordingScreen.visual.test.tsx (8 baselines) green; no change to any other test.
- **Committed in:** `10f45d8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** A missing-test-shim fix — a direct consequence of in-scope work (the two new components import RN/Lucide primitives the canonical shims hadn't yet needed). No scope creep; no production-code change beyond the plan's stated edits.

## TDD Gate Compliance

Task 1 carries `tdd="true"`; config has `tdd_mode: false` (and `MVP_MODE`/`TDD_MODE` were not passed by the orchestrator), so the per-task RED/GREEN/REFACTOR commit-gate is not enforced. recState.ts + its 43-case test landed as a single `feat` commit (`258fd3b`). Task 2 is `type="auto"` (no `tdd` flag) — a single `feat` commit (`10f45d8`).

## Issues Encountered

- **Skip link did not disappear after a Skip tap (first test draft):** the screen rendered the Skip link whenever `substate==='gate'`, but `GATE_SKIP` keeps `substate==='gate'` (phase→`confirmed`). Adjusted the screen to gate the Skip link on `gate.phase !== 'confirmed'` — and re-baked the affected visual baselines (`recording-gate-ring-*`). Resolved before the Task-2 commit.
- **Pre-existing full-suite failures (NOT introduced by this plan):** `npm --prefix apps/mobile test -- --run` reports 2 failed tests + 3 unhandled errors — `__tests__/ui/no-hex-literals.test.ts` (`HomeSkeletonScreen.tsx` hex literals), `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` (baseline drift), and 3 `setPermsGranted is not a function` rejections in `__tests__/navigation/RootNativeStack.test.tsx`. Identical on the pre-plan baseline; already tracked as **D4-01** in `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` (the `15d8a16` `__DEV__` smoke seam in `HomeSkeletonScreen.tsx`, slated for removal in this Phase-4 RecordingScreen wave). Out of scope per the SCOPE BOUNDARY rule — not touched. Every test this plan owns or modifies is green; `tsc --noEmit` is clean across the mobile + api + shared/types workspaces.

## Known Stubs

The `RecordingScreen` shell is deliberately a chrome-only scaffold — by design (per the plan's `<objective>` and the docstring), the live VisionCamera `<Camera>` mount, the `useHandGate` poll loop, the gate-pass→active TTS-masked transition, `useRecordingLifecycle`, the `buildCaptureOpts` construction, the RemoteConfig gate reads, brightness/orientation, the HAND-14 analytics, and the §7h post-stop routing are all plan 04-09. This is not an accidental stub: the plan splits the recording surface into "the route + the substate chrome + the visual baselines land in Wave 3 (this plan)" and "the live wiring lands in plan 04-09". The `__DEV__` "Pretend I rotated →" pill in `RotatePrompt` and the auto-`PRE_FLIGHT_OK` tick in the `pre-flight` substate are explicitly the plan's "so the baseline can land on gate" devices, not unintended placeholders. The `VoiceCuePill visible={false}` prop in the `active` substate is a wired-but-not-yet-driven prop (plan 04-09 drives it from the gate-pass).

## Threat Flags

| Flag     | File | Description                                                                                                                                                                                                                                                       |
| -------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_ | —    | No new network endpoints / auth paths / file-access patterns / trust-boundary schema changes beyond the plan's `<threat_model>` (the `__test_initialState` render-only prop and the `__DEV__` rotate pill are already enumerated there as `accept` / `mitigate`). |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 04-08** (the `__DEV__` task affordance / TasksPlaceholder) can navigate to `'Recording'` with a real-task params shape — the route is registered and the screen reads `route.params` with practice-style defaults.
- **Plan 04-09** (RecordingScreen live wiring) consumes `recState.ts` (dispatch onto `recReducer`), the `RecordingScreen` shell (replace the placeholder substate bodies' stubs with the live camera + poll loop + lifecycle + routing), and the `recording_gate_*` / `recording_*` analytics event names (already in `EVENT_NAMES` from plan 04-06). It also owns adding `'PracticeIntro'`/`'PracticeComplete'` required-route assertions and removing the `HomeSkeletonScreen` `__DEV__` smoke seam (D4-01) — that plan should regenerate the `home-skeleton-screen` visual baseline and fix the `setPermsGranted` reference in `RootNativeStack.test.tsx` while it's there.
- **Concern:** the full mobile suite still does not exit 0 because of the pre-existing D4-01 failures (HomeSkeletonScreen hex + visual baseline + RootNativeStack `setPermsGranted`). All tests this plan touches are green; `tsc --noEmit` is clean.

## Self-Check: PASSED

All claimed files exist on disk (verified):

- `apps/mobile/src/screens/recording/recState.ts`, `RecordingScreen.tsx`, `components/{GateRing,VoiceCuePill,StopConfirmModal,AlertPill,RotatePrompt}.tsx`
- `apps/mobile/__tests__/screens/recording/{recState.test.ts,RecordingScreen.test.tsx}`, `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx`
- `apps/mobile/__tests__/visual/__image_snapshots__/recording-{rotate-prompt,ready,gate-ring-0,gate-ring-50,gate-ring-100,active-t10s,active-t05m32s,stop-confirm-modal}.png`
- modified: `apps/mobile/src/navigation/RootNativeStack.tsx`, `apps/mobile/src/ui/tokens.ts`, `apps/mobile/__tests__/navigation/route-registry.test.ts`, `apps/mobile/vitest.setup.ts`
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-07-SUMMARY.md`

Task commits present in `git log`: `258fd3b` (feat — Task 1), `10f45d8` (feat — Task 2).

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
