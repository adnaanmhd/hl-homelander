---
phase: 03-humyn-capture-native-module
plan: 03
subsystem: ui-navigation

tags:
  [
    cosmetic-fixup,
    nav-graph,
    foreground-rehydrate,
    compat-fail-merge,
    auto-advance,
    open-questions,
    visual-snapshot,
    operator-runbook,
    wave-1-close,
  ]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    plan: 01
    provides: density-bucketed orange_logo PNGs + jest-image-snapshot Vitest
      adapter + apps/mobile/__tests__/visual/__image_snapshots__/
  - phase: 03-humyn-capture-native-module
    plan: 02
    provides: 6 visual snapshot baselines + 4 of 5 [EMAIL_ADDRESS] swaps +
      RethinkSans on-device dispatch hardening + Animated mock siblings +
      Pattern 67/68/69/70 (font dispatch + render-tree-PNG helper + per-test
      RN shim + ambient .d.ts pair)
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: Phase 2 cosmetic gap inventory (02-COSMETIC-GAPS.md frozen
      2026-05-10) + 02-OPEN-QUESTIONS.md (OQ-1 + OQ-2 carry-forward) +
      Pattern 47 vi.hoisted spy binding + Pattern 48 device-bound vs
      user-bound MMKV-key contract + Pattern 64 transient appStore.user
      slice + 02-MANUAL-SMOKE.md operator runbook shape (Pattern 56)
provides:
  - useTabTopBarProps() shared TopBar avatar hook (Pattern 71) wired to
    Home + Tasks + History tab bodies — single source of truth for
    avatar Pressable + Image + initial fallback
  - useForegroundUserRehydrate() AppState-change-driven /me hook
    (Pattern 72) mounted at navigator root (RootNativeStack); fires
    when user==null && jwt!=null on cold-mount + AppState 'active'
  - Merged CompatFailScreen — failure list + inline recovery body +
    3 recovery bullets + Contact Support CTA in one centered scrollable
    surface; standalone CompatRecoveryScreen + its test deleted; route
    registry updated (REQUIRED list shrinks; new REMOVED list asserts
    re-introduction fails)
  - CompatPassScreen auto-advance — 1.5 s setTimeout fires
    navigation.replace('RigTutorial') with no manual tap; 40 ms haptic
    preserved; cleanup clears timer on unmount (T-3.2-05)
  - 5th and final [EMAIL_ADDRESS] placeholder swapped for
    support@humynlabs.ai inside the merged CompatFailScreen mailto
    (closes OQ-1 end-to-end across all 5 occurrences; OQ-2 marked
    superseded-by-03-02-merge)
  - 4 new visual snapshot baselines (CompatFail merged, CompatPass
    auto-advance, TasksPlaceholder + HistoryPlaceholder TopBar avatar);
    total Wave 1 visual baseline count is now 10 (6 from Plan 03-02 +
    1 from this plan's Task 3 + 3 from this plan's Task 4)
  - 03-WAVE1-SMOKE.md operator re-walk runbook (Pattern 56 lineage from
    apps/mobile/02-MANUAL-SMOKE.md) — 12 sections + sign-off shape
    + D-WAVE-09 amendment protocol pointing at 03-W1-AMENDMENTS.md
  - 02-OPEN-QUESTIONS.md updates: OQ-1 marked resolved end-to-end;
    OQ-2 marked superseded-by-03-02-merge with the new resolution
    path pointing at the merged CompatFailScreen body
affects:
  - 03-04 onward (HumynCapture native module — Wave 2 acceptance gate
    D-WAVE-08 requires both Wave 1 plans landed + operator re-walk on
    Pixel 10a; this plan is the LAST Wave 1 plan)
  - Phase 4 RecordingScreen + lifecycle screens (visual snapshot infra
    + Pattern 71 hook reusable; foreground-rehydrate hook covers the
    avatar surfaces those screens will mount)
  - Phase 6 Home/Tasks/History tile rendering (Pattern 71 hook is the
    canonical TopBar prop source; new tab bodies that replace the
    placeholders will reuse the hook)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern 71: useTabTopBarProps() — single source of TopBar avatar
      props (avatarInitial, avatarUrl, onAvatarPress) for all three
      MainTabs tab bodies (Home / Tasks / History). Extracted from the
      verbatim HomeSkeletonScreen lines 32-37 + 41-45 spread shape per
      02-COSMETIC-GAPS.md "Refactor candidate (Phase 3 W1)". Without the
      hook, Tasks + History rendered <TopBar onAvatarPress={...} /> with
      no avatarInitial / avatarUrl, so switching tabs reverted the
      avatar to the U fallback even when appStore.user was populated
      (regression captured during Phase 2 §13 Crashlytics soak,
      2026-05-10).'
    - 'Pattern 72: useForegroundUserRehydrate() — AppState-change-driven
      /me rehydrate hook mounted at the navigator root (RootNativeStack).
      Fires fetchMe() when (user == null && jwt != null) on cold-mount
      AND on AppState transition to active. The user slice is transient
      by design (Pattern 64 — staleness-vs-backend trade-off; not
      MMKV-backed); pre-fix, every avatar surface (Home/Tasks/History
      TopBar, Profile) showed U after Android process kill until
      ProfileScreen mount fired /me. The tab TopBars NEVER fired it on
      their own. Hook short-circuits when user!=null so rapid AppState
      thrash does not spam the backend (T-3.2-03 mitigation; backend
      /me 60/min per-user rate-limit is the backstop). Errors are
      swallowed — next ProfileScreen mount or next AppState active
      retries. Adapter shape: fetchMe() returns MeResponse (id, email,
      name, age, gender, avatarUrl, …); hook projects to UserDisplay
      ({id, email, name, avatarUrl}) before calling setUser. Same wire-
      shape adapter as ProfileScreen.tsx mount path.'

key-files:
  created:
    - apps/mobile/src/hooks/useTabTopBarProps.ts (Pattern 71 — extracted
      Plan 03-03 Task 1; committed in cdd1d81)
    - apps/mobile/src/hooks/useForegroundUserRehydrate.ts (Pattern 72)
    - apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx
      (5 cases — committed in cdd1d81 Task 1)
    - apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx
      (5 cases — committed in cdd1d81 Task 1)
    - apps/mobile/__tests__/navigation/ForegroundRehydrate.test.tsx
      (7 cases — Task 2)
    - apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx
      (Task 3 — merged-screen visual baseline)
    - apps/mobile/__tests__/visual/CompatPassScreen.visual.test.tsx
      (Task 4 — auto-advance success-state visual baseline)
    - apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx
      (Task 4 — Pattern 71 avatar visual baseline)
    - apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx
      (Task 4 — Pattern 71 avatar visual baseline)
    - 4 new PNG baselines under
      apps/mobile/__tests__/visual/__image_snapshots__/
      (compat-fail merged, compat-pass auto-advance, tasks-placeholder,
      history-placeholder)
    - .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md
      (operator re-walk runbook — 12 sections + Pre-flight + Sign-off +
      D-WAVE-09 amendment protocol)
  modified:
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (Task 1 — wire
      Pattern 71 hook; committed in cdd1d81)
    - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
      (Task 1 — wire Pattern 71 hook; committed in cdd1d81)
    - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx
      (Task 1 — wire Pattern 71 hook; committed in cdd1d81)
    - apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx
      (Task 1 — extend with 2 new avatar cases; committed in cdd1d81)
    - apps/mobile/src/navigation/RootNativeStack.tsx (Task 2 — invoke
      useForegroundUserRehydrate at top of component body)
    - apps/mobile/src/screens/compat/CompatFailScreen.tsx (Task 3 —
      absorb CompatRecoveryScreen body inline; replace 5th [EMAIL_ADDRESS]
      placeholder; centered scrollable layout per 02-COSMETIC-GAPS.md;
      content-driven CTA width)
    - apps/mobile/src/navigation/OnboardingStack.tsx (Task 3 — drop
      CompatRecoveryScreen import + Stack.Screen registration)
    - apps/mobile/__tests__/navigation/route-registry.test.ts (Task 3 —
      drop CompatRecovery from REQUIRED_PHASE_2_ROUTES; add
      REMOVED_PHASE_2_ROUTES list with re-introduction-fails assertion)
    - apps/mobile/__tests__/screens/CompatFailScreen.test.tsx (Task 3 —
      drop navigate('CompatRecovery') test; add 4 new cases —
      inline recovery body + Contact Support mailto with canonical
      email + no nav.navigate fired + COMPAT-06 enforcement)
    - apps/mobile/src/screens/compat/CompatPassScreen.tsx (Task 4 —
      replace manual Next CTA with 1.5 s setTimeout auto-advance;
      40 ms haptic preserved; clearTimeout on unmount; centered body)
    - apps/mobile/__tests__/screens/CompatPassScreen.test.tsx (Task 4 —
      drop tap-CTA test; add 3 new cases — auto-advance via fake timers,
      no manual Pressable, unmount cancels timer)
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (Task 3 — update
      stale doc-comment that pointed at deleted CompatRecoveryScreen
      file path)
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (Task 3 —
      same stale doc-comment update)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md
      (Task 3 — OQ-1 status flipped to **resolved** end-to-end; OQ-2
      status flipped to **superseded-by-03-02-merge** with merged-screen
      resolution path)
  deleted:
    - apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx
    - apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx

key-decisions:
  - 'Pattern 71 hook lives at apps/mobile/src/hooks/useTabTopBarProps.ts
    (NOT in src/components/TopBar.tsx). The hook is read-only over
    appStore.user + useNavigation; TopBar itself stays a presentational
    component receiving avatarInitial / avatarUrl / onAvatarPress as
    props. Keeps TopBar reusable for future surfaces (Phase 4
    RecordingScreen, Phase 6 settings) that may not consume the
    Profile-tap navigation contract.'
  - 'Pattern 72 hook fires on AppState change AND mount (not just
    AppState change). Cold boot from Splash has user==null && jwt!=null
    when MMKV restored the JWT but the transient user slice rehydrated
    null. Without the mount fire, the user would have to background +
    foreground the app to hydrate. The mount fire is gated by the same
    user==null && jwt!=null short-circuit so a cold boot from Sign-up
    (no JWT yet) does not spam the backend.'
  - 'Adapter at the boundary, not at the call site. fetchMe() returns
    MeResponse (full /me payload); useForegroundUserRehydrate projects
    to UserDisplay before calling setUser. Mirrors the
    ProfileScreen.tsx Promise.all().then() shape (lines 90-110 of
    ProfileScreen.tsx). Future surfaces that need only a subset of /me
    can reuse the same projection.'
  - 'CompatFail merge keeps CompatFailScreen as the surviving file
    (deletes CompatRecoveryScreen). Reasoning: failure list is the
    primary surface; recovery body is the secondary follow-up. Inline
    ordering — failure list (top) → recovery body → bullets → Contact
    Support CTA (bottom) — matches the eye-flow per 02-COSMETIC-GAPS.md.
    The CompatFail navigator route stays; CompatRecovery is gone.'
  - 'Route-registry test gains a NEW REMOVED_PHASE_2_ROUTES list
    instead of just dropping CompatRecovery from the REQUIRED list.
    Without the explicit "this route is gone — re-introduction fails
    CI" assertion, an accidental revert (e.g., during a future phase
    that touches OnboardingStack) would silently land. The explicit
    REMOVED list makes the deletion intentional and auditable.'
  - 'CompatPass auto-advance window = 1500 ms (per 02-COSMETIC-GAPS.md
    "≤1.5 s with the existing 40 ms haptic"). Long enough for the user
    to register the success state; short enough that it does not feel
    like a gate. setTimeout cleanup in useEffect cleanup function so
    a hardware-back during the window cancels navigation (T-3.2-05).'
  - 'Hardcode the 1500ms inside CompatPassScreen rather than reading
    from Firebase Remote Config. The auto-advance window is a UX
    decision, not a runtime knob — Remote Config keys cost a startup
    fetch + a stale-cache window. Keep the constant local with a
    Plan 03-03 comment so a future plan that wants to RC-gate it knows
    where to look.'
  - 'Visual snapshot for CompatPassScreen uses vi.useFakeTimers() so the
    auto-advance does not unmount the screen mid-render. The baseline
    captures the success-state body BEFORE navigation fires; without
    fake timers the snapshot would be a torn-down DOM tree.'
  - 'Per-test inline RN shim (Pattern 69) for CompatFailScreen.visual,
    CompatPassScreen.visual, TasksPlaceholderScreen.visual,
    HistoryPlaceholderScreen.visual. Same rationale as the 6 baselines
    Plan 03-02 shipped: visual tests need RN system modules NOT in the
    canonical vitest.setup.ts surface (Linking, Animated.View, etc.),
    and vi.importActual trips on Flow `import typeof` syntax.'
  - 'vi.hoisted({ FAIL_RESULT }) in CompatFailScreen.visual.test.tsx
    so the appStore mock factory can close over the fixture without
    a TDZ at hoist time. Same shape as Pattern 47 (vi.hoisted spy
    binding from Phase 2 plan 02-19) extended to fixtures.'

patterns-established:
  - 'Pattern 71: useTabTopBarProps() — shared TopBar avatar props hook
    for all three MainTabs tab bodies (Home / Tasks / History)'
  - 'Pattern 72: useForegroundUserRehydrate() — AppState-change-driven
    /me hook mounted at the navigator root; fires when
    user == null && jwt != null on cold-mount + AppState active'

requirements-completed: []

# Metrics
duration: ~13min (Task 2 start 2026-05-10T14:19:51Z → Task 4 commit
  2026-05-10T14:32:51Z; Task 1 was committed in a prior session as
  cdd1d81 — adds an estimated +12 min for Task 1's hook extract +
  3-screen wireup + 12 new test cases, putting the plan total at ~25min)
completed: 2026-05-10
---

# Phase 3 Plan 03: Cosmetic Functional Regressions Summary

**Closes Phase 3 Wave 1 — every navigation-graph-touching entry from `02-COSMETIC-GAPS.md` resolved + 02-OPEN-QUESTIONS.md OQ-1 (5/5 placeholder occurrences swapped) + OQ-2 (superseded by merge) + 03-WAVE1-SMOKE.md operator runbook authored. CompatRecovery route deleted; CompatPass auto-advances; foreground rehydrate hook lives at the navigator root; useTabTopBarProps hook is the single source of TopBar avatar props for all three tabs.**

## Performance

- **Plan duration (this session, Tasks 2-4 + wrap-up):** ~13 min (start
  14:19:51Z, Task 4 commit 14:32:51Z); +~12 min in prior session for
  Task 1 (committed as cdd1d81). Plan total ≈ 25 min.
- **Started:** 2026-05-10 (Task 1 in prior session); resumed 2026-05-10T14:19:51Z (Tasks 2-4)
- **Completed:** 2026-05-10
- **Tasks:** 4 (1 from prior session + 3 in this session)
- **Files modified:** 24 (per `git diff --stat cdd1d81..HEAD~3 HEAD`):
  10 source-file modifications, 5 deletions (2 file deletes + Stack.Screen + import + REQUIRED list entry), 9 test-file creations or rewrites, 4 PNG baselines, 1 doc creation (03-WAVE1-SMOKE.md), 1 Open-Questions doc update.

## Accomplishments

- **Wave 1 closes** — both navigation-graph-touching plan and the operator runbook for the D-WAVE-08 acceptance gate are now in-repo. Plan 03-04 (Wave 2 entry) is unblocked from a planning standpoint; the operator re-walk on Pixel 10a is the remaining gate before Wave 2 plan-phase starts.
- **2 new patterns established (71 + 72)** — both small, focused hooks at `apps/mobile/src/hooks/` covering specific Phase 2 §13 soak regressions. Pattern 71 is the structural fix for the Tasks/History tab avatar regression; Pattern 72 is the foreground-rehydrate fix for the Android-process-kill avatar regression.
- **CompatFail + CompatRecovery merged** with the recovery body, 3 bullets, and Contact Support CTA all on one centered scrollable surface. The CompatRecovery navigator route + screen file + test file are gone; the route registry test now asserts re-introduction fails CI.
- **CompatPass auto-advances** in 1.5 s with no manual tap; the 40 ms haptic survives; setTimeout cleanup ensures hardware-back during the window cancels navigation (T-3.2-05). Pre-merge users had to tap "Next" — now the pass state is a transient confirmation.
- **OQ-1 RESOLVED end-to-end.** All 5 `[EMAIL_ADDRESS]` placeholder occurrences across the entire mobile codebase are now `support@humynlabs.ai`. Plan 03-02 swapped 4 (RigTutorialScreen, HelpCenterScreen, content.json via build-help, help-center-content.md). Plan 03-03 swaps the 5th and final (the merged CompatFailScreen mailto). Test assertions across 4 test files enforce the canonical email; a regression that re-introduces the placeholder fails CI.
- **OQ-2 SUPERSEDED.** The compat-fail final-wording writer pass now applies to the merged CompatFailScreen body, not the deleted standalone screen. The original wording-quality concern remains (a writer pass is still owed); the resolution path now points at the merged file.
- **4 new visual baselines** lifting Wave 1's total to 10 (6 from Plan 03-02 + 1 from Task 3 + 3 from Task 4). Coverage: CompatFail merged surface, CompatPass auto-advance success body (with fake timers so the snapshot captures pre-navigation), Tasks tab with Pattern 71 avatar wiring, History tab with Pattern 71 avatar wiring.
- **03-WAVE1-SMOKE.md operator runbook** authored — 12 sections + Pre-flight + Sign-off + D-WAVE-09 amendment protocol. Mirrors `apps/mobile/02-MANUAL-SMOKE.md`'s Pattern 56 shape; §11 (foreground rehydrate) directly targets the §13-soak regression Pattern 72 fixes.
- **Full mobile test suite stays green** at 344/344 across 61 test files (was 320/320 after Plan 03-02; +24 new tests added across Wave 1 — 12 in Task 1 cdd1d81, 7 in Task 2, ~4 net in Task 3, ~3 net in Task 4 + the visual baselines counted as 1 test each). The 3 unhandled rejections in PermissionsScreen tests are pre-existing per Plan 03-02 SUMMARY (out of scope per SCOPE BOUNDARY).

## Task Commits

Each task was committed atomically:

1. **Task 1: useTabTopBarProps hook + Home/Tasks/History wireup** — `cdd1d81` (feat) — committed in prior session before stream-idle-timeout interruption.
2. **Task 2: useForegroundUserRehydrate hook + 7-case test** — `61e2a8b` (feat).
3. **Task 3: CompatFail+CompatRecovery merge + OQ-1 5/5 swap + visual baseline + OQ-2 superseded** — `1d5ec76` (feat).
4. **Task 4: CompatPass auto-advance + 3 visual baselines + 03-WAVE1-SMOKE.md operator runbook** — `041c257` (feat).

## Files Created/Modified

See `key-files` in frontmatter.

## Decisions Made

See `key-decisions` in frontmatter. Most consequential:

- **Pattern 72 hook lives at the navigator root, not the tab bodies.** Mounting once via RootNativeStack means every screen that mounts via this stack — including the three MainTabs tab bodies — observes a populated user slice without any per-screen wiring. Alternative was to mount it inside each tab body (Pattern 71 style); rejected because (a) tab-body remounts would re-fire fetchMe redundantly, (b) Profile + HelpCenter + ForceUpgrade siblings need the same hydrate guarantee, (c) navigator-root keeps the lifecycle tied to "app open" which matches the AppState 'active' semantics.

- **Route-registry test gains a NEW REMOVED_PHASE_2_ROUTES list.** Without the "this route is intentionally gone" assertion, an accidental revert during a future phase that touches OnboardingStack would silently land — turning a deliberate Plan 03-03 deletion into a stealthy re-introduction. The explicit REMOVED list makes the deletion intentional and auditable; it also documents WHICH plans deleted WHICH routes for posterity.

- **5th `[EMAIL_ADDRESS]` placeholder swap delivered with the merge, not as a standalone task.** Plan 03-02 deferred the 5th occurrence to Plan 03-03 because the file it lived in (CompatRecoveryScreen.tsx) was scheduled for deletion in this plan. The swap lands inside the merged screen's mailto inside Task 3's commit boundary — single atomic commit closes OQ-1 across all 5 occurrences.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.hoisted required around `FAIL_RESULT` fixture in CompatFailScreen.visual.test.tsx**

- **Found during:** Task 3 visual snapshot bake.
- **Issue:** Initial visual-test file declared `const FAIL_RESULT = {...}` at top level, then `vi.mock('../../src/state/appStore', () => { ... compatLastResult: FAIL_RESULT ... })` — vi.mock factories are hoisted above all imports + above all top-level const declarations, so the factory body referenced FAIL_RESULT before it was initialised, raising a `ReferenceError: Cannot access 'FAIL_RESULT' before initialization`. Same shape as Plan 03-02 Pattern 47 fix for spy bindings.
- **Fix:** Wrapped FAIL_RESULT in `vi.hoisted(() => ({ FAIL_RESULT: { ... } }))` so the fixture is declared in the same hoist-scope as the mock factory body. Pattern 47 generalises from spy bindings to fixtures with this shape.
- **Files modified:** apps/mobile/**tests**/visual/CompatFailScreen.visual.test.tsx
- **Committed in:** `1d5ec76` (Task 3 commit)

**2. [Rule 1 - Bug] CompatFailScreen literal `[EMAIL_ADDRESS]` doc-comment trips acceptance criterion grep**

- **Found during:** Task 3 acceptance-criteria check (`grep -c '\[EMAIL_ADDRESS\]' apps/mobile/src/screens/compat/CompatFailScreen.tsx` should return 0).
- **Issue:** Initial doc-comment described the swap as `(was \`[EMAIL_ADDRESS]\` placeholder)`— technically accurate prose but the literal characters`[EMAIL_ADDRESS]` appeared in the file, failing the grep. The acceptance criterion is enforced precisely so a future copy-paste regression of the placeholder string fails CI.
- **Fix:** Reworded the doc-comment to describe the swap without quoting the literal placeholder string ("Plan 03-03 — OQ-1 5th and final placeholder occurrence: SUPPORT_EMAIL is now `support@humynlabs.ai`").
- **Files modified:** apps/mobile/src/screens/compat/CompatFailScreen.tsx
- **Committed in:** `1d5ec76` (Task 3 commit)

**3. [Rule 2 - Missing Critical] Stale doc-comments in HelpCenterScreen + RigTutorialScreen pointing at deleted CompatRecoveryScreen file path**

- **Found during:** Task 3 post-deletion grep (`grep -rln "CompatRecovery" src __tests__`).
- **Issue:** HelpCenterScreen.tsx line 23 and RigTutorialScreen.tsx line 42 both carried doc-comments that pointed at `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — a now-deleted file. Future contributors reading the comment would chase a dead reference.
- **Fix:** Updated both comments to describe the merge: "5th and final placeholder occurrence landed inside Plan 03-03's merged CompatFailScreen (the standalone CompatRecoveryScreen was merged into CompatFailScreen and deleted in the same plan)."
- **Files modified:** apps/mobile/src/screens/help/HelpCenterScreen.tsx, apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
- **Committed in:** `1d5ec76` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 — placeholder grep regression caught at acceptance time; 1 Rule 2 — stale doc references after a file deletion; 1 Rule 3 — TDZ in vi.mock factory closure over fixture).

**Impact on plan:** All deviations preserve the plan's stated intent. The vi.hoisted fix unblocks Task 3 visual baseline bake. The grep-fix resolves a precise acceptance criterion without changing CompatFailScreen behavior. The stale-comment update is a hygiene fix that keeps the codebase navigable for the next reader. No scope creep.

## Issues Encountered

- **3 unhandled rejections in PermissionsScreen tests are pre-existing.** Same diagnosis as Plan 03-02 SUMMARY: PermissionsScreen rendered inside RootNativeStack.test.tsx with a bare-bones state mock missing setPermsGranted. Reproduces with all my changes stashed; not caused by Plan 03-03. Out of scope per SCOPE BOUNDARY rule.
- **`grep -E "OQ-1.*resolved|OQ-2.*superseded"` is line-scoped** but the OQ status keywords land on different lines than the OQ heading (the heading is `## OQ-1: ...` and the status is `**Status (2026-05-10):** **resolved**` on the next paragraph). Acceptance criterion was satisfied by the substring presence within each OQ section (verified via `awk '/^## OQ-N/,/^---$/'` block-scoped match). The plan's regex shape was a quick-check approximation, not a strict requirement.
- **Linter reformatted CompatFailScreen.tsx during commit hook.** Prettier rewrapped the recovery body Text node from single-line to two-line. Behavior unchanged; only whitespace/wrap. Documented for posterity in case a future PR diff shows the same lines re-wrapping.

## Known Stubs

| Stub                                                         | File                                                         | Reason                                                                                                                                                                                                                                                                                                              | Resolution Path                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HomeSkeletonScreen wordmark still a typographic Text stub    | `apps/mobile/src/components/TopBar.tsx`                      | Carried forward from Plan 03-02 Known Stubs. The wordmark Image upgrade requires re-laying-out TopBar's row + recomputing its 48 dp min-height; that's a separate refactor.                                                                                                                                         | A future plan that takes ownership of TopBar should swap `<Text variant="title28">Humyn Labs</Text>` for `<Image source={require('.../orange_logo.png')} />` at the same path.                                                      |
| Transparent placeholder rig illustration (no actual artwork) | `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` | Carried forward from Plan 03-01 / 03-02 Known Stubs. No source artwork exists in `design-system/` or `prototype.html`. Image renders transparent in RigTutorialScreen at the design-spec §5 280 px size; functional parity preserved.                                                                               | Real artwork lands by re-exporting to the same paths — no JSX edit required.                                                                                                                                                        |
| CompatFail merged screen wording — writer pass still owed    | `apps/mobile/src/screens/compat/CompatFailScreen.tsx`        | OQ-2 was originally about the standalone CompatRecoveryScreen body wording. With the merge, the wording-quality concern transferred to the merged CompatFailScreen recovery body but a Product/Writer pass has not yet happened. Current copy is technically accurate (carried verbatim from CompatRecoveryScreen). | Operator/Writer reviews the merged CompatFailScreen body alongside the prototype.html `#compat-fail` recovery state; settles on final copy; edits the file + the corresponding test fixtures. Tracked in 02-OPEN-QUESTIONS.md OQ-2. |

## Threat Flags

None. All files modified by this plan are within the existing trust boundaries (UI rendering + navigator graph mutation + an additive read-only `/me` fetch path that already exists for ProfileScreen). No new network endpoints, no auth changes, no schema changes, no file-access patterns added.

The threat-model entries in the plan body (T-3.2-01 through T-3.2-05) are all `accept` or `mitigate` dispositions:

- **T-3.2-01 (accept):** useForegroundUserRehydrate uses the same JWT trust model as ProfileScreen.tsx mount — Phase 1 backend's requireAuth middleware verifies cryptographically.
- **T-3.2-02 (accept):** mailto link with no diagnostic snapshot — pre-filled body has only generic field labels (no PII).
- **T-3.2-03 (mitigate):** Pattern 72 short-circuits when user!=null; backend /me 60/min per-user rate-limit is the backstop.
- **T-3.2-04 (accept):** Route-registry test now asserts CompatRecovery is NOT re-registered (REMOVED_PHASE_2_ROUTES list); a future PR that re-adds the route fails CI.
- **T-3.2-05 (mitigate):** CompatPassScreen useEffect cleanup `clearTimeout(t)` cancels the pending route call on unmount.

## User Setup Required

None for the test suite. The 03-WAVE1-SMOKE.md operator re-walk on Pixel 10a is operator-driven (per D-WAVE-08) but happens AFTER Plan 03-03 lands; it gates Wave 2 plan-phase, not Plan 03-03 completion.

## Self-Check: PASSED

Verification commands run:

- `git log --oneline -10` → all 4 task commits FOUND (cdd1d81, 61e2a8b, 1d5ec76, 041c257)
- `git show --stat cdd1d81` → confirmed Task 1's diff stats (7 files, 301 insertions)
- `[ -f apps/mobile/src/hooks/useTabTopBarProps.ts ]` → FOUND
- `[ -f apps/mobile/src/hooks/useForegroundUserRehydrate.ts ]` → FOUND
- `[ -f apps/mobile/__tests__/navigation/ForegroundRehydrate.test.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/visual/CompatPassScreen.visual.test.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx ]` → FOUND
- `[ -f .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md ]` → FOUND
- `[ ! -f apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx ]` → DELETED
- `[ ! -f apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx ]` → DELETED
- `ls apps/mobile/__tests__/visual/__image_snapshots__/*.png | wc -l` → 10
- `grep -q "support@humynlabs.ai" apps/mobile/src/screens/compat/CompatFailScreen.tsx` → MATCH
- `grep -c '\[EMAIL_ADDRESS\]' apps/mobile/src/screens/compat/CompatFailScreen.tsx` → 0
- `grep -E "name=\"CompatRecovery\"" apps/mobile/src/navigation/RootNativeStack.tsx apps/mobile/src/navigation/MainTabs.tsx apps/mobile/src/navigation/OnboardingStack.tsx` → no matches (route deleted)
- `grep -q "useForegroundUserRehydrate()" apps/mobile/src/navigation/RootNativeStack.tsx` → MATCH
- `grep -q "useTabTopBarProps" apps/mobile/src/screens/{home/HomeSkeletonScreen,tasks/TasksPlaceholderScreen,history/HistoryPlaceholderScreen}.tsx` → 3 matches
- `grep -q "re-walked-on:" .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` → MATCH
- `grep -q "03-W1-AMENDMENTS.md" .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` → MATCH
- `cd apps/mobile && npx tsc --noEmit` → exit 0
- `cd apps/mobile && npx vitest run` → 344/344 tests passing in 61 test files (3 unrelated unhandled rejections in PermissionsScreen tests, pre-existing per Plan 03-02 SUMMARY)
- 02-OPEN-QUESTIONS.md OQ-1 status block contains `**resolved**` → PASS
- 02-OPEN-QUESTIONS.md OQ-2 status block contains `**superseded-by-03-02-merge**` → PASS

## Next Phase Readiness

- **Plan 03-04 (capture-foundation-muxer-bridge) is unblocked from a planning standpoint.** Wave 2 acceptance gate D-WAVE-08 has 4 conditions; this plan satisfies (1) and (2) (both Wave 1 plans landed). Conditions (3) operator re-walk on Pixel 10a per 03-WAVE1-SMOKE.md and (4) re-walked-on: stamp are operator-driven; they happen on a real device + a single commit closing the runbook.
- **02-OPEN-QUESTIONS.md OQ-1 + OQ-2 transitions documented.** OQ-1 fully resolved (all 5 occurrences); OQ-2 superseded with new resolution path. Future Phase 7 staged-rollout entry checklist should reference this plan's commit hashes for the audit trail.
- **Pattern 71 + Pattern 72 both reusable for Phase 4 RecordingScreen + Phase 6 Tasks/History bodies.** The Pattern 71 hook is the canonical TopBar prop source — when Phase 6 lands the real Tasks + History tab bodies, they swap the placeholder import for the real screen but keep the Pattern 71 hook wiring identically. Pattern 72 covers Phase 4 RecordingScreen too — the avatar surface there will benefit from the same foreground rehydrate guarantee.
- **Wave 1 closes; Wave 2 awaits operator re-walk.** Both Wave 1 plans (03-01, 03-02, 03-03) landed; awaiting operator re-walk on Pixel 10a per `03-WAVE1-SMOKE.md` D-WAVE-08 step 3 + 4 sign-off. Until that sign-off lands, Plan 03-04 plan-phase MUST NOT start (per D-WAVE-08 hard gate).
- **02-COSMETIC-GAPS.md remains the historical record (frozen-2026-05-10).** Any new gaps the operator surfaces during the re-walk land in `03-W1-AMENDMENTS.md` per D-WAVE-09 — NEVER back into `02-COSMETIC-GAPS.md`. The runbook authored in Task 4 reminds the operator of this protocol on every walk.

---

_Phase: 03-humyn-capture-native-module_
_Plan: 03 (cosmetic-functional-regressions)_
_Completed: 2026-05-10_
