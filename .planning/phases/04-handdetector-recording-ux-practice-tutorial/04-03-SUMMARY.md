---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 03
subsystem: state
tags: [mmkv, jwt, react-navigation, zustand, onboarding, vitest]

# Dependency graph
requires:
  - phase: 02-onboarding-shell-navigation
    provides: appStore (zustand), keys.ts versioned-MMKV registry, computeInitialRoute gate-decision tree, RigTutorialScreen
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-01)
    provides: __DEV__ shim in vitest.setup.ts (suite baseline)
provides:
  - practiceDoneKey(sub) parameterised MMKV-key helper (tutorial.practice_done.{sub}.v1) for the ONB-08 once-per-install-per-account gate
  - decodeGoogleSubFromJwt extracted to shared src/lib/jwtSub.ts (decode-without-verify; '' on malformed; never soft-locks)
  - appStore.setPracticeDone(sub) write-through action
  - computeInitialRoute step-5 per-account practice-tutorial gate (replaces the legacy s.tutorialDone bool, composed after the compat gate)
  - RigTutorialScreen Next CTA retargeted MainTabs → PracticeIntro
affects:
  [
    04-06 practice-tutorial flow (PracticeIntro/PracticeComplete screens),
    04-04/04-05 RecordingScreen,
    OnboardingStack route registration,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parameterised versioned MMKV key helper (practiceDoneKey(sub)) — mirrors softBannerDismissKey(latest); '.v1' suffix; reinstall wipes MMKV → semantics reset for free"
    - 'Decode-without-verify JWT sub claim → local cache key only (T-4.3-01): the JWT was verified at sign-in; never an authz decision; shared util, not re-rolled per call site'
    - 'Boot-time gate reads MMKV directly (computeInitialRoute) rather than threading the flag through the in-memory store'

key-files:
  created:
    - apps/mobile/src/lib/jwtSub.ts
    - apps/mobile/__tests__/lib/jwtSub.test.ts
  modified:
    - apps/mobile/src/state/keys.ts
    - apps/mobile/src/state/appStore.ts
    - apps/mobile/src/state/initialRoute.ts
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
    - apps/mobile/__tests__/state/initialRoute.test.ts
    - apps/mobile/__tests__/state/appStore.test.ts
    - apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx

key-decisions:
  - "RigTutorialScreen.handleNext navigates on the LOCAL navigator (navigation.replace('PracticeIntro')) because PracticeIntro is an OnboardingStack sibling — not the parent-navigator hop the old MainTabs target needed; falls back to getParent()?.replace if the local navigator lacks replace"
  - 'setPracticeDone(sub) sets no in-memory state field — computeInitialRoute reads the flag directly from MMKV at boot; the action is a pure write-through'
  - 'The legacy onboarding.tutorialDone.v1 flag (set by RigTutorial.handleNext) is kept as-is; the CANONICAL ONB-08 gate is now the per-account practice flag written by PracticeComplete (plan 04-06)'

patterns-established:
  - 'practiceDoneKey(sub) parameterised MMKV helper in keys.ts'
  - 'src/lib/jwtSub.ts shared decode-without-verify util'

requirements-completed: [ONB-08]

# Metrics
duration: 22min
completed: 2026-05-11
---

# Phase 4 Plan 03: Practice-tutorial gate plumbing (ONB-08) Summary

**Per-Google-account practice-tutorial gate: `tutorial.practice_done.{sub}.v1` MMKV key + `setPracticeDone(sub)` write-through + `computeInitialRoute` step-5 rewrite (per-account, composed after compat) + `decodeGoogleSubFromJwt` extracted to a shared util + RigTutorial Next CTA retargeted to PracticeIntro.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-11T08:13:00Z
- **Completed:** 2026-05-11T08:35:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `practiceDoneKey(sub)` parameterised MMKV-key helper in `keys.ts` (mirrors `softBannerDismissKey`) — `tutorial.practice_done.{sub}.v1`; empty sub still produces a deterministic key, never throws.
- `decodeGoogleSubFromJwt` extracted verbatim from `RigTutorialScreen.tsx` into `src/lib/jwtSub.ts` with a security docstring (decode-without-verify; cache-key-only; `''` on malformed) — now reused by RigTutorialScreen + computeInitialRoute (and ready for PracticeCompleteScreen in plan 04-06) instead of re-implemented.
- `appStore.setPracticeDone(sub)` — idempotent write-through of `true` to MMKV at `practiceDoneKey(sub)`; sets no in-memory state; never logs the `sub` (T-4.3-03).
- `computeInitialRoute` step 5 now reads the per-account MMKV flag (`practiceDoneKey(decodeGoogleSubFromJwt(s.jwt))`) instead of the legacy `s.tutorialDone` bool — re-runs the tutorial when the flag is missing; per-account semantics (sub A's flag does not satisfy sub B); composed AFTER the compat gate (compat-missing/stale still wins).
- `RigTutorialScreen` Next CTA retargeted `MainTabs` → `PracticeIntro` (the OnboardingStack route registered by plan 04-06) — RigTutorial → PracticeIntro → Recording → PracticeComplete → MainTabs.

## Task Commits

Each task was committed atomically:

1. **Task 1: practiceDoneKey helper + jwtSub util extraction + appStore setPracticeDone action + RigTutorial retarget** — `6a31dc4` (feat)
2. **Task 2: computeInitialRoute per-account tutorial-flag gate + initialRoute.test.ts cases** — `178b944` (feat)

**Plan metadata:** _(this commit)_ `docs(04-03): complete plan`

_Note: both tasks are `tdd="true"`. The RED phase was verified for each (jwtSub test failed pre-impl with a missing-module error; the new initialRoute cases failed pre-impl returning MainTabs) but committed together with the implementation as a single `feat` commit per task rather than separate `test`/`feat` commits — see TDD Gate Compliance below._

## Files Created/Modified

- `apps/mobile/src/lib/jwtSub.ts` — NEW. `decodeGoogleSubFromJwt(jwt)` shared util (base64url-decode the `sub` claim without verifying the signature; `''` on any malformed input).
- `apps/mobile/__tests__/lib/jwtSub.test.ts` — NEW. 7 cases: well-formed → sub, realistic 21-digit sub verbatim, `null` → `''`, non-3-part → `''`, non-base64url payload → `''`, no `sub` claim → `''`, non-string `sub` → `''`.
- `apps/mobile/src/state/keys.ts` — added `practiceDoneKey(sub)` helper alongside `softBannerDismissKey`.
- `apps/mobile/src/state/appStore.ts` — added `setPracticeDone(sub): void` to the `AppState` interface + implementation (write-through to `secureMmkv` at `practiceDoneKey(sub)`); imports `practiceDoneKey` from `./keys`.
- `apps/mobile/src/state/initialRoute.ts` — step 5 rewritten to read the per-account MMKV practice flag; imports `secureMmkv`, `practiceDoneKey`, `decodeGoogleSubFromJwt`; top-of-file docstring updated ("reads the per-account practice-tutorial flag from MMKV (ONB-08); otherwise pure over AppState").
- `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` — removed the local `decodeGoogleSubFromJwt`; imports it from `../../lib/jwtSub`; `handleNext` retargeted `MainTabs` → `PracticeIntro` on the local navigator; comment block updated.
- `apps/mobile/__tests__/state/initialRoute.test.ts` — `baseState` default `jwt` now encodes `sub: 'A'` + `setPracticeDone: () => {}` stub; new cases: practice gate composed after compat (Test 9c), missing flag → RigTutorial (Test 10), per-account A-vs-B (Test 10b), all-green + flag → MainTabs (Test 11), offline-boot + flag (Test 11b), empty-sub key parity (Test 11c); existing all-green cases now seed `practiceDoneKey('A')`.
- `apps/mobile/__tests__/state/appStore.test.ts` — Test 4: `setPracticeDone('sub-A')` writes `true` to `practiceDoneKey('sub-A')` and is idempotent; `freshState()` clears `practiceDoneKey('sub-A')`.
- `apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx` — Tests 3 & 5 assert `mockReplace` called with `'PracticeIntro'` (was `'MainTabs'`); comment block updated.

## Decisions Made

- **Local-navigator navigation for the retargeted CTA:** `PracticeIntro` lives in `OnboardingStack` (a sibling of `RigTutorial`), so `handleNext` calls `navigation.replace('PracticeIntro')` on the local navigator rather than the parent-navigator hop the old `MainTabs` (a RootNativeStack route) required. Falls back to `getParent()?.replace('PracticeIntro')` if the local navigator lacks `replace`. The PATTERNS doc framed this as a "surgical 1-line target change"; the navigator choice change is the minimal correct form of that.
- **`setPracticeDone` writes no in-memory state:** the flag is consumed only by `computeInitialRoute` at boot (which reads MMKV directly), so the action is a pure write-through with no `set(...)` — matches the plan's explicit instruction.
- **Legacy `s.tutorialDone` retained:** still flipped by `RigTutorialScreen.handleNext`; the canonical ONB-08 gate is now the per-account MMKV flag (written by PracticeComplete, plan 04-06). `s.tutorialDone` alone is no longer sufficient to reach MainTabs — noted in the updated test comments.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `RigTutorialScreen.test.tsx` for the retargeted CTA**

- **Found during:** Task 1 (RigTutorial Next-CTA retarget)
- **Issue:** Tests 3 & 5 asserted `mockReplace` called with `'MainTabs'` (and Test 3 asserted `getParent` was called); after the retarget they fail. The test file is not in the plan's `files_modified` list but is directly broken by the in-scope source change.
- **Fix:** Tests 3 & 5 now assert `mockReplace` called with `'PracticeIntro'`; Test 3's `getParent` assertion removed (the local navigator is used now); header comment + Test-3 docstring updated.
- **Files modified:** `apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx`
- **Verification:** `npm --prefix apps/mobile test -- --run __tests__/screens/RigTutorialScreen.test.tsx` — 6/6 green.
- **Committed in:** `6a31dc4` (Task 1 commit)

**2. [Rule 3 - Blocking] Added `setPracticeDone` stub to `initialRoute.test.ts` baseState (in Task 1)**

- **Found during:** Task 1 (appStore interface change)
- **Issue:** Adding `setPracticeDone` to the `AppState` interface makes `baseState()` (which constructs a full `AppState`) fail `tsc --noEmit` until the stub is added.
- **Fix:** Added `setPracticeDone: () => {}` to `baseState` in Task 1 (Task 2 then overwrites the file with the full new test); kept typecheck green at the Task-1 commit.
- **Files modified:** `apps/mobile/__tests__/state/initialRoute.test.ts`
- **Verification:** `npm --prefix apps/mobile run typecheck` green at `6a31dc4`.
- **Committed in:** `6a31dc4` (Task 1 commit)

**3. [Rule 2 - Missing test coverage] Added `setPracticeDone` test to `appStore.test.ts`**

- **Found during:** Task 1
- **Issue:** The plan's `<behavior>` for Task 1 specifies `setPracticeDone` write-through + idempotency assertions, but the plan's action step 5 only names `jwtSub.test.ts`. `appStore.test.ts` is the canonical home for store-action coverage.
- **Fix:** Added Test 4 to `appStore.test.ts` covering the write-through + idempotency; `freshState()` clears the key.
- **Files modified:** `apps/mobile/__tests__/state/appStore.test.ts`
- **Verification:** `npm --prefix apps/mobile test -- --run __tests__/state/appStore.test.ts` — 5/5 green.
- **Committed in:** `6a31dc4` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing test coverage)
**Impact on plan:** All three are direct consequences of the in-scope source changes (a broken existing test, a typecheck break from the interface change, and a `<behavior>`-mandated assertion). No scope creep — no production code beyond the plan's stated changes.

## TDD Gate Compliance

Both tasks carry `tdd="true"`. RED was verified for each before implementation:

- Task 1: `npm --prefix apps/mobile test -- --run __tests__/lib/jwtSub.test.ts` failed pre-impl with `Failed to resolve import "../../src/lib/jwtSub"` (module did not exist).
- Task 2: `npm --prefix apps/mobile test -- --run __tests__/state/initialRoute.test.ts` failed pre-impl — the new per-account / composition-order cases returned `{ stack: 'MainTabs' }` (the old `s.tutorialDone`-based step 5).

However, each task was committed as a **single `feat(...)` commit** (test + implementation together), not separate `test(...)` → `feat(...)` commits. Project config has `tdd_mode: false` and the plan frontmatter is `type: execute` (not `type: tdd`), so the plan-level RED/GREEN/REFACTOR commit-gate sequence is not enforced; the per-task TDD discipline (write test → see it fail → implement → see it pass) was followed in spirit. **Warning:** a strict reading of the per-task `tdd="true"` flag expects a `test(...)` commit ahead of the `feat(...)` commit — that split was not done here.

## Issues Encountered

- **Pre-existing full-suite failures (NOT introduced by this plan):** `npm --prefix apps/mobile test -- --run` reports 2 failed tests — `__tests__/ui/no-hex-literals.test.ts` (`HomeSkeletonScreen.tsx contains no hex-color literals`) and `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` (`matches baseline`), plus 3 unhandled rejections in `RootNativeStack.test.tsx` (`setPermsGranted is not a function`). Verified present on the pre-Task-1 baseline (`git stash` → same 2 failures + 3 errors). Already tracked as **D4-01** in `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` (the `15d8a16` `__DEV__` smoke seam in `HomeSkeletonScreen.tsx`, slated for removal by the Phase 4 RecordingScreen wave). Out of scope per the SCOPE BOUNDARY rule — not touched. All tests this plan owns or modifies are green; `tsc --noEmit` is clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `practiceDoneKey(sub)` + `setPracticeDone(sub)` are ready for `PracticeCompleteScreen.Continue` (plan 04-06) to write the flag and `navigation.reset` to MainTabs.
- `decodeGoogleSubFromJwt` in `src/lib/jwtSub.ts` is the shared util for plan 04-06's PracticeComplete (must reuse, not re-implement).
- `RigTutorialScreen.handleNext` already targets `'PracticeIntro'` — plan 04-06 must register that route (and `'PracticeComplete'`) in `OnboardingStack.tsx`, and `route-registry.test.ts` must add `'PracticeIntro'`/`'PracticeComplete'`/`'Recording'` to the required-routes list.
- **Concern:** the full mobile suite does not exit 0 due to the pre-existing D4-01 failures — whichever Phase 4 plan removes the `HomeSkeletonScreen` `__DEV__` smoke seam should also regenerate the visual baseline and fix the stale `setPermsGranted` reference in `RootNativeStack.test.tsx`.

## Self-Check: PASSED

All claimed files exist on disk (`jwtSub.ts`, `jwtSub.test.ts`, `keys.ts`, `appStore.ts`, `initialRoute.ts`, `RigTutorialScreen.tsx`, `initialRoute.test.ts`, `appStore.test.ts`, `RigTutorialScreen.test.tsx`, `04-03-SUMMARY.md`). All task commits present in `git log` (`6a31dc4`, `178b944`) plus the docs commit (`7eca0b9`).

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
