---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 06
subsystem: ui
tags: [react-navigation, reanimated, onboarding, vitest, jest-image-snapshot, tutorial]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-01)
    provides: __DEV__ shim in vitest.setup.ts (suite baseline)
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-03)
    provides: practiceDoneKey(sub) MMKV helper, appStore.setPracticeDone(sub) write-through, src/lib/jwtSub.ts (decodeGoogleSubFromJwt), computeInitialRoute step-5 per-account practice gate, RigTutorial Next-CTA retargeted to PracticeIntro
provides:
  - PracticeIntroScreen (design-spec §6 verbatim) — "One quick try" heading + body + muted line + btn-accent "Start practice"; Start practice → parent.replace('Recording', { taskId:'__practice__', taskName:'Practice — 60 sec', isPractice:true })
  - PracticeCompleteScreen (design-spec §8 verbatim) — 96×96 success badge + scale-pop 500ms + Confetti (18 particles) + Vibration.vibrate([0,40,80,40]) on enter + btn-primary "Continue" → setPracticeDone(sub) then navigation.reset({routes:[{name:'MainTabs'}]})
  - Confetti component (~50 LOC, Reanimated 3.16.x, no new dep) — design-spec §8 confetti burst
  - OnboardingStack registers PracticeIntro + PracticeComplete after RigTutorial
  - analytics.ts EVENT_NAMES: practice_intro_shown, practice_started, practice_complete_shown, practice_complete_continued + the recording funnel (recording_gate_started/passed/skipped/bypassed, recording_started/stopped/too_short)
  - tokens.ts confettiPalette (design-spec §8 accent-palette hues; keeps hex literals out of screen bodies)
  - 2 visual baselines (practice-intro.png, practice-complete-static.png) + the practiceFlow chain test
affects:
  [
    04-07 RecordingScreen (registers the 'Recording' RootNativeStack route + consumes the practice route params),
    04-09 RecordingGate (consumes recording_gate_skipped + the recording funnel events),
    Phase 6 Home (PracticeComplete.Continue resets to MainTabs → Home first-time hero),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Animations start in a useEffect (not at render) so the structural-render-tree visual baseline is captured at the deterministic pre-animation frame (Confetti rise, PracticeComplete badge scale-pop)'
    - 'Decorative/transient multi-hue palette (confetti) lives in tokens.ts (confettiPalette) — keeps the D-UI-01 no-hex-in-screens gate satisfied even for sanctioned multi-hue use'
    - 'Parent-navigator hop for cross-stack targets: PracticeIntro→Recording and PracticeComplete→MainTabs use navigation.getParent()?.{replace,reset} with a local-navigator fallback — same idiom RigTutorialScreen established'
    - "react-native shim extension for new RN modules per-test (Vibration) — mirrors the RigTutorialScreen test's Linking.openURL trick; the canonical vitest.setup.ts shim also gets a Vibration no-op stub"

key-files:
  created:
    - apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
    - apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx
    - apps/mobile/src/screens/tutorial/components/Confetti.tsx
    - apps/mobile/__tests__/screens/PracticeIntroScreen.test.tsx
    - apps/mobile/__tests__/screens/PracticeCompleteScreen.test.tsx
    - apps/mobile/__tests__/screens/practiceFlow.test.tsx
    - apps/mobile/__tests__/visual/PracticeIntroScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/PracticeCompleteScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/__image_snapshots__/practice-intro.png
    - apps/mobile/__tests__/visual/__image_snapshots__/practice-complete-static.png
  modified:
    - apps/mobile/src/navigation/OnboardingStack.tsx
    - apps/mobile/src/util/analytics.ts
    - apps/mobile/src/ui/tokens.ts
    - apps/mobile/vitest.setup.ts
    - apps/mobile/__tests__/navigation/route-registry.test.ts

key-decisions:
  - "Both PracticeIntro AND PracticeComplete registered in OnboardingStack in the Task-1 commit (not Task-1 then Task-2 as the plan staged it) — OnboardingStack imports PracticeCompleteScreen, so the screen + Confetti had to land with the navigator edit to keep tsc + the suite green at every commit; PracticeComplete's tests + visual baseline + practiceFlow chain test landed in the Task-2 commit"
  - "PracticeComplete heading = 'You got it.' verbatim per design-spec §8's recommended string (prototype heading not fully captured; PM may override). The prototype.html shows 'From here on, every recording counts' but the plan + design-spec §8 + 04-UI-SPEC § Copywriting all say 'You got it.' — followed the spec, not the prototype"
  - "Vibration.vibrate([0, 40, 80, 40]) — the leading 0 makes RN's off/on/off/on array interpretation produce the engineering-handoff §6.2 [40,80,40]ms practice-done pattern (off-0 / on-40 / off-80 / on-40)"
  - 'Confetti is deterministic (seeded pseudo-random per particle index) so the visual baseline is stable across runs even though the rise/rotate/fade animations are real on-device'

patterns-established:
  - 'tokens.ts confettiPalette — sanctioned decorative multi-hue palette outside the grayscale/accent design-system slots'
  - 'Effect-deferred animations for visual-baseline determinism'

requirements-completed: [ONB-03, ONB-07, ONB-08]

# Metrics
duration: 38min
completed: 2026-05-11
---

# Phase 4 Plan 06: Practice-tutorial screens (PracticeIntro + PracticeComplete) Summary

**The two light tutorial screens — PracticeIntroScreen (design-spec §6 verbatim, Start practice → Recording w/ isPractice:true) and PracticeCompleteScreen (design-spec §8 verbatim — 96×96 success badge + scale-pop + Confetti + [40,80,40]ms haptic, writes the per-account ONB-08 flag then resets to MainTabs) — plus a Confetti component, OnboardingStack registration, the practice/recording analytics events, 3 tests, and 2 visual baselines.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-05-11T14:33:00Z (approx)
- **Completed:** 2026-05-11T14:41:00Z
- **Tasks:** 2
- **Files modified:** 15 (10 created, 5 modified)

## Accomplishments

- **PracticeIntroScreen** — design-spec §6 verbatim: tutorialHeading "One quick try", tutBody "We'll walk you through one short recording — 60 seconds, just to get the feel.", caption muted line "This is a practice task — it does not count towards your contribution.", btn-accent "Start practice" (28px screen gutter per 04-UI-SPEC § Spacing). `practice_intro_shown` on mount; Start practice → `practice_started` + `parent.replace('Recording', { taskId:'__practice__', taskName:'Practice — 60 sec', isPractice:true })` (local-navigator fallback when getParent lacks replace).
- **PracticeCompleteScreen** — design-spec §8 verbatim: 96×96 `colors.success` badge with a 56px white check glyph + scale-pop 0→1.1→1.0 over 500ms (Reanimated), `<Confetti />` overlay, title28 "You got it.", btn-primary "Continue" (32px gutter / 48px top inset / 24px bottom inset). `practice_complete_shown` + `Vibration.vibrate([0,40,80,40])` on mount; Continue → `setPracticeDone(decodeGoogleSubFromJwt(jwt))` → `practice_complete_continued` → `parent.reset({ index:0, routes:[{ name:'MainTabs' }] })` (local-navigator fallback). Never logs the JWT or `sub` (T-4.6-03).
- **Confetti** — ~50 LOC, Reanimated 3.16.x (no new dependency): 18 absolutely-positioned particles with seeded-deterministic per-index hue (from `confettiPalette`), x-offset, rise 800–1200ms + rotate + fade-out; the rise animation starts in an effect so the baseline frame is static.
- **OnboardingStack** — `PracticeIntro` + `PracticeComplete` registered after `RigTutorial`; navigator comment updated to the full Phase-4 chain.
- **analytics.ts** — `practice_intro_shown`, `practice_started`, `practice_complete_shown`, `practice_complete_continued` + the recording funnel (`recording_gate_started/passed/skipped/bypassed`, `recording_started/stopped/too_short`) added to the frozen `EVENT_NAMES` allowlist (the recording events are pre-registered here for plan 04-09).
- **Tests** — `PracticeIntroScreen.test.tsx` (5 cases), `PracticeCompleteScreen.test.tsx` (6 cases), `practiceFlow.test.tsx` (4 cases — the wired RigTutorial → PracticeIntro → Recording → PracticeComplete → MainTabs chain + the screen-write-feeds-boot-read assertion via the real `computeInitialRoute`/`secureMmkv`/`practiceDoneKey`), 2 visual baselines.
- **route-registry.test.ts** — `PracticeIntro` + `PracticeComplete` added to the required-routes invariant (Rule 2 — keeps the D-NAV-02 navigator-registry gate authoritative; the 04-03 summary flagged this).

## Task Commits

Each task was committed atomically:

1. **Task 1: PracticeIntroScreen + OnboardingStack routes + practice/recording analytics events** — `d053978` (feat) — also includes PracticeCompleteScreen.tsx + components/Confetti.tsx (OnboardingStack imports them; their tests land in Task 2), tokens.ts confettiPalette, vitest.setup.ts Vibration stub, PracticeIntroScreen.test.tsx + visual + practice-intro.png baseline.
2. **Task 2: PracticeCompleteScreen + practiceFlow chain tests + visual baseline** — `56153b3` (test) — PracticeCompleteScreen.test.tsx (6 cases) + practiceFlow.test.tsx (4 cases) + PracticeCompleteScreen.visual.test.tsx + practice-complete-static.png + route-registry.test.ts additions.

**Plan metadata:** _(this commit)_ `docs(04-06): complete plan`

## Files Created/Modified

- `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx` — NEW. design-spec §6 verbatim; Start practice → Recording w/ practice route params; `practice_intro_shown`/`practice_started` events; parent-navigator hop + local-navigator fallback.
- `apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx` — NEW. design-spec §8 verbatim; 96×96 success badge + scale-pop + Confetti + [0,40,80,40]ms haptic; Continue → setPracticeDone(sub) then navigation.reset to MainTabs; never logs auth material.
- `apps/mobile/src/screens/tutorial/components/Confetti.tsx` — NEW. ~50-LOC Reanimated 3.16.x confetti burst (18 seeded-deterministic particles).
- `apps/mobile/src/navigation/OnboardingStack.tsx` — added `PracticeIntro` + `PracticeComplete` Stack.Screen registrations after `RigTutorial`; gestureEnabled-false comment + flow-chain comment updated.
- `apps/mobile/src/util/analytics.ts` — `EVENT_NAMES` extended with the 4 practice events + the 7 recording-funnel events under `// Onboarding — practice tutorial (Phase 4)` / `// Recording (Phase 4)` headers.
- `apps/mobile/src/ui/tokens.ts` — added `confettiPalette` (6 warm accent-palette hex tokens for the Confetti decorative use; keeps hex out of screen bodies).
- `apps/mobile/vitest.setup.ts` — `Vibration: { vibrate, cancel }` no-op stub added to the canonical react-native host shim.
- `apps/mobile/__tests__/screens/PracticeIntroScreen.test.tsx` — NEW. 5 cases (verbatim copy, CTA, mount event, Start-practice navigation+event, local-navigator fallback).
- `apps/mobile/__tests__/screens/PracticeCompleteScreen.test.tsx` — NEW. 6 cases (verbatim copy + badge, mount event, mount vibrate, Continue → setPracticeDone+event+reset, set-before-reset ordering, local-navigator-reset fallback).
- `apps/mobile/__tests__/screens/practiceFlow.test.tsx` — NEW. 4 cases (RigTutorial Next → 'PracticeIntro' not 'MainTabs'; PracticeIntro Start practice → 'Recording' practice params; PracticeComplete Continue → setPracticeDone then reset(MainTabs) + vibrate on enter; computeInitialRoute returns RigTutorial when `practiceDoneKey(sub)` unset / MainTabs when set — using the real boot-gate code).
- `apps/mobile/__tests__/visual/PracticeIntroScreen.visual.test.tsx` — NEW. baseline `practice-intro.png` (via `customSnapshotIdentifier: 'practice-intro'`).
- `apps/mobile/__tests__/visual/PracticeCompleteScreen.visual.test.tsx` — NEW. baseline `practice-complete-static.png` (captured at render() time = pre-confetti / pre-scale-pop static frame).
- `apps/mobile/__tests__/navigation/route-registry.test.ts` — `PracticeIntro` + `PracticeComplete` added to `REQUIRED_PHASE_2_ROUTES`.

## Decisions Made

- **Registered both routes in the Task-1 commit:** OnboardingStack imports `PracticeCompleteScreen`, so the screen + Confetti components had to land alongside the navigator edit to keep `tsc --noEmit` clean and the suite green at every commit (registering `PracticeComplete` without the screen module would fail the navigator import). PracticeComplete's tests + visual baseline + the practiceFlow chain test landed in the Task-2 commit, per the plan's task split. No production code beyond the plan's stated changes.
- **PracticeComplete heading = "You got it.":** design-spec §8 + 04-UI-SPEC § Copywriting both specify "You got it." (with a `[confirm w/ PM]` note — the prototype heading wasn't fully captured; the prototype.html DOM happens to show a different placeholder string). Followed the spec + the plan instruction verbatim. PM may override.
- **`Vibration.vibrate([0, 40, 80, 40])`:** RN interprets the array as off/on/off/on… durations; the leading `0` (no initial wait) makes the array off-0 / on-40 / off-80 / on-40 — i.e. the engineering-handoff §6.2 `[40, 80, 40]`ms practice-done pattern.
- **Confetti is seeded-deterministic:** per-particle index seeds a stable pseudo-random for hue/offset/duration so the visual baseline is reproducible while the on-device rise/rotate/fade is still real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `Vibration` to the react-native host shim (vitest.setup.ts)**

- **Found during:** Task 1 (creating PracticeCompleteScreen, which `import { Vibration } from 'react-native'`)
- **Issue:** `vitest.setup.ts`'s react-native shim did not export `Vibration` — `Vibration.vibrate(...)` would resolve to `undefined.vibrate` and throw under jsdom for any test that renders PracticeCompleteScreen via the canonical shim.
- **Fix:** Added `Vibration: { vibrate: () => undefined, cancel: () => undefined }` to the canonical shim (per-test files override with a spy where they need to assert the call args — same pattern as `Linking`/`AppState`/`BackHandler` already in the shim).
- **Files modified:** `apps/mobile/vitest.setup.ts`
- **Verification:** PracticeCompleteScreen.test.tsx + practiceFlow.test.tsx green; full suite no new failures.
- **Committed in:** `d053978` (Task 1 commit)

**2. [Rule 2 - Missing critical] Moved the confetti hue palette into tokens.ts (`confettiPalette`)**

- **Found during:** Task 1/2 (creating Confetti.tsx)
- **Issue:** design-spec §8 + 04-UI-SPEC sanction "random hues from the accent palette" for the confetti, but a hex-literal array inside `src/screens/.../Confetti.tsx` would fail the existing `__tests__/ui/no-hex-literals.test.ts` D-UI-01 gate (which walks `src/screens/` + `src/components/`).
- **Fix:** Added `confettiPalette` (6 hex tokens) to `tokens.ts` — the canonical hex source — and imported it into Confetti.tsx.
- **Files modified:** `apps/mobile/src/ui/tokens.ts`, `apps/mobile/src/screens/tutorial/components/Confetti.tsx`
- **Verification:** `__tests__/ui/no-hex-literals.test.ts` passes for the new files (the only failure is the pre-existing HomeSkeletonScreen one, D4-01); full suite green.
- **Committed in:** `d053978` (Task 1 commit)

**3. [Rule 2 - Missing test coverage] Added PracticeIntro + PracticeComplete to route-registry.test.ts**

- **Found during:** Task 2
- **Issue:** The plan adds two OnboardingStack routes; the D-NAV-02 navigator-registry invariant test (`route-registry.test.ts`) should list them so an accidental future removal surfaces in PR review (the 04-03 summary explicitly flagged this).
- **Fix:** Added `'PracticeIntro'` and `'PracticeComplete'` to `REQUIRED_PHASE_2_ROUTES`.
- **Files modified:** `apps/mobile/__tests__/navigation/route-registry.test.ts`
- **Verification:** route-registry.test.ts green.
- **Committed in:** `56153b3` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical/coverage)
**Impact on plan:** All three are direct consequences of in-scope work — a missing test-shim, a token-discipline-gate constraint, and a navigator-registry invariant. No scope creep. The minor commit-staging adjustment (PracticeCompleteScreen.tsx + Confetti.tsx in the Task-1 commit instead of Task-2) is a sequencing necessity, not a content change.

## TDD Gate Compliance

Plan frontmatter is `type: execute` (not `type: tdd`) and config has `tdd_mode: false`; the per-task `tdd="true"` flag is absent on these tasks, so the RED/GREEN/REFACTOR commit-gate sequence does not apply. Each task was committed as a single `feat`/`test` commit. (Task 2's commit is `test(...)` because its content is tests + a visual baseline + the route-registry addition — the production screens already landed in Task 1's `feat` commit.)

## Issues Encountered

- **`MMKV` type lacks `delete`:** the first practiceFlow.test.tsx draft used `secureMmkv.delete(...)` (which the shim supports) but the react-native-mmkv v4 type only exposes `remove`. `tsc --noEmit` flagged it; switched to `secureMmkv.remove(...)` (the form the rest of the codebase uses — `appStore.ts`, `appStore.test.ts`, `initialRoute.test.ts`). Resolved before the Task-2 commit.
- **Pre-existing full-suite failures (NOT introduced by this plan):** `npm --prefix apps/mobile test -- --run` reports 2 failed tests + 3 unhandled errors — `__tests__/ui/no-hex-literals.test.ts` (`HomeSkeletonScreen.tsx` hex literal), `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` (baseline), and 3 `setPermsGranted is not a function` rejections in `RootNativeStack.test.tsx`. Verified identical on the pre-plan baseline. Already tracked as **D4-01** in `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` (the `15d8a16` `__DEV__` smoke seam in `HomeSkeletonScreen.tsx`, slated for removal by the Phase 4 RecordingScreen wave). Out of scope per the SCOPE BOUNDARY rule — not touched. All tests this plan owns or modifies are green; `tsc --noEmit` is clean (mobile + api + shared/types workspaces).

## Known Stubs

None. PracticeIntroScreen and PracticeCompleteScreen are fully wired — PracticeIntro navigates to the `Recording` route (a RootNativeStack route registered by plan 04-07, which is the immediate next plan in this wave; until 04-07 lands, navigating to `'Recording'` would no-op at runtime, but the route arg + params are correct and the navigator registration is plan 04-07's stated responsibility). PracticeComplete writes the real `practiceDoneKey(sub)` MMKV flag (plan 04-03's `setPracticeDone`) and resets to `MainTabs` (a registered RootNativeStack route). No hardcoded empty data, no placeholder copy beyond the design-spec-sanctioned `[confirm w/ PM]` heading.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-07 (RecordingScreen) must register the `'Recording'` route in `RootNativeStack.tsx` and consume the practice route params (`taskId:'__practice__'`, `taskName:'Practice — 60 sec'`, `isPractice:true`) — PracticeIntro already navigates with exactly that shape. When `Recording` is registered, the `route-registry.test.ts` "does not register any unrecognized Phase-3+ routes" assertion's `'Recording'` entry must move into the required list (or a Phase-4 registry test).
- Plan 04-09 (RecordingGate) — the `recording_gate_started/passed/skipped/bypassed` + `recording_started/stopped/too_short` event names are already in `EVENT_NAMES`; the gate just calls `logEvent(...)` with them.
- Phase 6 (Home) — PracticeComplete.Continue resets to `MainTabs`, landing the user on the Home first-time hero.
- **Concern:** the full mobile suite does not exit 0 due to the pre-existing D4-01 failures (HomeSkeletonScreen hex + visual baseline + RootNativeStack `setPermsGranted`). Whichever Phase 4 plan removes the `HomeSkeletonScreen` `__DEV__` smoke seam should also regenerate that visual baseline and fix the stale `setPermsGranted` reference in `RootNativeStack.test.tsx`. All tests this plan touches are green.

## Self-Check: PASSED

All claimed files exist on disk:

- `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx`, `PracticeCompleteScreen.tsx`, `components/Confetti.tsx`
- `apps/mobile/__tests__/screens/PracticeIntroScreen.test.tsx`, `PracticeCompleteScreen.test.tsx`, `practiceFlow.test.tsx`
- `apps/mobile/__tests__/visual/PracticeIntroScreen.visual.test.tsx`, `PracticeCompleteScreen.visual.test.tsx`
- `apps/mobile/__tests__/visual/__image_snapshots__/practice-intro.png`, `practice-complete-static.png`
- modified: `OnboardingStack.tsx`, `analytics.ts`, `tokens.ts`, `vitest.setup.ts`, `route-registry.test.ts`
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-06-SUMMARY.md`

Task commits present in `git log`: `d053978` (feat — Task 1), `56153b3` (test — Task 2).

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
