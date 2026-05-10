---
phase: 03-humyn-capture-native-module
plan: 11
subsystem: ui
tags: [react-native, visual-snapshots, safe-area-context, jest-image-snapshot, vitest, design-spec]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module/03
    provides: CompatFail merged screen + 3 visual baselines added by Plan 03-03; placeholder rig assets from Plan 03-01; orange wordmark @1x/@2x/@3x density buckets from Plan 03-01
provides:
  - PermissionsScreen idle body tightened to 'Used only while you hit record' (no manifesto)
  - BottomNav lifted above device gesture indicator via useSafeAreaInsets() (`paddingBottom: insets.bottom + 12`, `height: 68 + insets.bottom`)
  - TopBar wordmark Image (orange logo) replaces the literal "Humyn Labs" Text node — propagates to Home/Tasks/History via Pattern 71
  - CompatFailScreen "What Now" 3-bullet recovery block deleted; recoveryBody tightened to 1 sentence
  - Splash + Sign-up logos shrunk ~20% via explicit 256×58 dp style on Image
  - 4 visual snapshot baselines refreshed (Home, Tasks, History, CompatFail) — 2 surfaces (Splash, Signup) had no structural shift so the encoder did not refresh those baselines
  - 03-W1-AMENDMENTS.md frontmatter stamped `partial-closed-by-03-11-2026-05-10-a2-escalated`; per-amendment Closure lines for A1, A3, A4, A5, A6; A2 escalated to user
affects: [03-04, 03-12, 03-W2, ux-polish, design-spec-alignment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSafeAreaInsets() for bottom-nav lift on Android gesture-bar devices (Plan 03-11 / A3)"
    - "Source-level grep gate as the single source of truth when the structural-render-tree-PNG visual encoder cannot detect style-only changes (Plan 03-11 / A6)"

key-files:
  created:
    - .planning/phases/03-humyn-capture-native-module/03-11-SUMMARY.md
  modified:
    - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
    - apps/mobile/src/components/BottomNav.tsx
    - apps/mobile/src/components/TopBar.tsx
    - apps/mobile/src/screens/compat/CompatFailScreen.tsx
    - apps/mobile/src/screens/splash/SplashScreen.tsx
    - apps/mobile/src/screens/signup/SignupScreen.tsx
    - apps/mobile/__tests__/screens/PermissionsScreen.test.tsx
    - apps/mobile/__tests__/screens/CompatFailScreen.test.tsx
    - apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx
    - apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx
    - apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx
    - apps/mobile/__tests__/components/TopBar.test.tsx
    - apps/mobile/__tests__/visual/__image_snapshots__/home-skeleton-screen-visual-test-tsx-home-skeleton-screen-visual-matches-baseline-top-bar-skeleton-body-no-soft-upgrade-banner-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/tasks-placeholder-screen-visual-test-tsx-tasks-placeholder-screen-visual-plan-03-03-task-1-pattern-71-matches-baseline-top-bar-wordmark-google-avatar-body-copy-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/history-placeholder-screen-visual-test-tsx-history-placeholder-screen-visual-plan-03-03-task-1-pattern-71-matches-baseline-top-bar-wordmark-google-avatar-body-copy-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/compat-fail-screen-visual-test-tsx-compat-fail-screen-visual-post-plan-03-03-merge-matches-baseline-failure-list-inline-recovery-contact-support-1-snap.png
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md

key-decisions:
  - "A2 escalated to user — no source rig artwork found; CLAUDE.md 'Designs LOCKED' rule blocks AI/line-art substitutes."
  - "Splash + Sign-up visual baselines intentionally unchanged — the structural-render-tree-PNG visual encoder is shape-only by design (Plan 03-02 _utils/renderToImage.ts); style-only diffs do not shift the wireframe. Source-level grep gate verifies the A6 change instead."
  - "PermissionsScreen visual baseline also unchanged — A1 is text-only, same DOM shape."
  - "TopBar visual baselines (Home/Tasks/History) DID refresh — the DOM shape changed (Text → Image inside the same parent View) so the wireframe rectangle hash differs."

patterns-established:
  - "Pattern: source-level grep gate as fallback for style-only visual changes — when the wireframe encoder cannot distinguish a style mutation, document the limitation and rely on the grep gate. Avoids the false negative of 'tests pass but the change didn't ship'."

requirements-completed: []

# Metrics
duration: 18m
completed: 2026-05-10
---

# Phase 3 Plan 11: Wave 1 Polish Summary

**Six bounded UX amendments (A1–A6) from the Pixel 10a re-walk landed: Permissions copy tightened, BottomNav lifted via safe-area, TopBar promoted from text stub to orange wordmark Image, CompatFail "What Now" bullets deleted, Splash + Sign-up logos shrunk ~20%, A2 rig artwork escalated to user.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-10T16:03:29Z
- **Completed:** 2026-05-10T16:21:30Z
- **Tasks:** 6 (1 of 6 escalated — A2)
- **Files modified:** 17 (6 source + 6 tests + 4 baselines + 1 amendments doc)

## Accomplishments

- A1 (Permissions copy) — idle body tightened to single line; recovery branches unchanged.
- A3 (BottomNav lift) — `useSafeAreaInsets()` consumed; nav floats Instagram-style above the gesture indicator.
- A4 (TopBar wordmark Image) — single-component edit propagates to Home/Tasks/History via Pattern 71. 3 visual baselines refreshed.
- A5 (CompatFail recovery bullets removed) — 3 bullets + wrapper View deleted; recoveryBody tightened to 1 sentence; orphan styles dropped. Visual baseline refreshed.
- A6 (Splash + Sign-up logos shrunk) — explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` on Image, ~20% smaller; aspect within ±1% of source 320:73.
- A2 (RigTutorial illustration) — escalated to user with explicit deviation entry. No source artwork in `design-system/illustrations/` (directory does not exist) and CLAUDE.md "Designs LOCKED" rule blocks substitutes.

## Task Commits

Each task was committed atomically:

1. **Task 1: A1 + A3 (Permissions copy + BottomNav lift)** — `c29c139` (feat)
2. **Task 2: A4 (TopBar orange wordmark Image)** — `e181eee` (feat)
3. **Task 3: A5 (CompatFail "What Now" bullets removal)** — `ea822b5` (feat)
4. **Task 4: A6 (Splash + Sign-up logo shrink)** — `508dc74` (feat)
5. **Task 5: A2 escalation + per-amendment closure stamps** — `4db9262` (docs)
6. **Task 6: Final test sweep** — no source edits; verification only (full mobile suite green: 345/345 tests pass, tsc clean).

## Files Created/Modified

### Source (6)

- `apps/mobile/src/screens/permissions/PermissionsScreen.tsx` — idle body string tightened (A1).
- `apps/mobile/src/components/BottomNav.tsx` — `useSafeAreaInsets()` import + `paddingBottom: insets.bottom + 12` + `height: 68 + insets.bottom` (A3).
- `apps/mobile/src/components/TopBar.tsx` — Text wordmark replaced with `<Image source={require('../assets/logos/orange_logo.png')} ... />` at 28 dp height + aspectRatio 320/73 (A4).
- `apps/mobile/src/screens/compat/CompatFailScreen.tsx` — `<View style={styles.bullets}>` block + 3 `recovery-bullet-*` Text nodes deleted; `recoveryBody` Text tightened to 1 sentence; `bullets`/`bullet` style entries dropped; `recoveryBody.marginBottom` bumped from `ll` to `xxxl` (A5).
- `apps/mobile/src/screens/splash/SplashScreen.tsx` — explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` on Image (A6).
- `apps/mobile/src/screens/signup/SignupScreen.tsx` — same explicit style on Image (A6).

### Tests (6)

- `apps/mobile/__tests__/screens/PermissionsScreen.test.tsx` — Test 1 body assertion in lockstep with A1.
- `apps/mobile/__tests__/screens/CompatFailScreen.test.tsx` — Test 6 rewritten to assert the 1-sentence body; new Test 6b regression-guards the absence of `recovery-bullet-*` accessibilityLabels.
- `apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx` — wordmark assertions migrated from `getByText('Humyn Labs')` to `getByLabelText('Humyn Labs Capture wordmark')` (2 locations).
- `apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx` — same migration (1 location).
- `apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx` — same migration (1 location).
- `apps/mobile/__tests__/components/TopBar.test.tsx` — same migration (1 location, the canonical TopBar test).

### Visual baselines (4 refreshed of 7 expected)

- HomeSkeletonScreen — refreshed (DOM tree shape changed: Text → Image).
- TasksPlaceholderScreen — refreshed (same).
- HistoryPlaceholderScreen — refreshed (same).
- CompatFailScreen — refreshed (3 Text nodes + wrapping View removed → fewer wireframe rectangles).
- PermissionsScreen — **NOT refreshed** (A1 is text-only; same DOM shape).
- SplashScreen — **NOT refreshed** (A6 is style-only; same DOM shape).
- SignupScreen — **NOT refreshed** (same).

The Plan 03-02 visual encoder (`__tests__/visual/_utils/renderToImage.ts`) is intentionally shape-only — it walks the DOM tree and emits one rectangle per element keyed by accessibilityLabel hash, ignoring inline styles and text content. This is by design (catches CTA-moved / icon-missing / logo-asset-path-wrong regressions, ignores text content drift). For A1/A6 the source-level grep gate is the binding contract.

### Docs (1)

- `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` — frontmatter stamped `partial-closed-by-03-11-2026-05-10-a2-escalated`; per-amendment **Closure:** lines added for A1/A3/A4/A5/A6; A2 closure-attempt subsection added with escalate-to-user disposition; sign-off section gains a Plan 03-11 closure note.

## Decisions Made

- **A2 escalated to user.** No source rig artwork present. Per CLAUDE.md "Designs LOCKED — no new design work", the planner did not generate substitute artwork. The Plan 03-01 transparent placeholders ship as-is until the user drops a real rig PNG at `design-system/illustrations/rig.png`. RigTutorialScreen.tsx require path is unchanged so the asset replacement needs no code change.
- **Visual encoder limitations documented.** The structural-render-tree-PNG encoder cannot detect text-content or inline-style differences. For text-only changes (A1) and style-only changes (A6), the source-level grep gate (defined in the plan's `<acceptance_criteria>` and verified at PR review) is the binding regression detector. Documented as a known limitation in the relevant **Closure:** entries; no change to the encoder for this plan.
- **Test migration shape: getByText → getByLabelText.** A4 changes the wordmark from a Text node to an Image. Tests that asserted `getByText('Humyn Labs')` were migrated to `getByLabelText('Humyn Labs Capture wordmark')`. The accessibilityLabel is the stable contract (it survives the Text→Image swap and the explicit aspectRatio styling); the rendered text content is not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Symlinked node_modules into the worktree**

- **Found during:** Task 1 (first attempt to run vitest in the worktree)
- **Issue:** The Claude Code worktree was spawned without per-package `node_modules`. `pnpm` workspaces use centralized `node_modules` at the workspace root + per-package, so the worktree's vitest could not resolve `@vitejs/plugin-react`, and the apps/api typecheck (run by the pre-commit hook) failed because zod types were unresolvable.
- **Fix:** Symlinked `node_modules`, `apps/mobile/node_modules`, and `apps/api/node_modules` from the main repo into the worktree. Symlinks are gitignored (`node_modules/` rule in `.gitignore`) so they don't pollute commits.
- **Files modified:** none staged/committed (symlinks are filesystem-only artifacts of the worktree environment)
- **Verification:** vitest runs cleanly inside the worktree; pre-commit hook's apps/api typecheck step passes.
- **Committed in:** none (environmental setup, not code)

**2. [Rule 1 - Bug] Updated 4 screen tests + 1 component test that asserted the legacy "Humyn Labs" Text wordmark**

- **Found during:** Task 2 (TopBar A4 — first run of the verify gate showed 4 test failures across HomeSkeleton, Tasks, History, plus the canonical TopBar test)
- **Issue:** Pre-Plan-03-11 tests asserted `getByText('Humyn Labs')` to verify the wordmark renders. After A4 promoted the wordmark from Text to Image, those assertions failed because the literal text node no longer exists.
- **Fix:** Migrated all 5 affected assertions to `getByLabelText('Humyn Labs Capture wordmark')` — the accessibility label is the stable contract for both the legacy Text and the new Image. Same Test 1 docstring kept (still describes "Humyn Labs wordmark") for searchability; only the assertion shape changed.
- **Files modified:** `apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx` (2 locations), `apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx`, `apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx`, `apps/mobile/__tests__/components/TopBar.test.tsx`
- **Verification:** All 5 tests pass post-edit; full mobile suite stays at 345/345.
- **Committed in:** `e181eee` (Task 2 commit)

**3. [Rule 1 - Bug] Tightened TopBar docstring grep gate so the JSX-content count of "Humyn Labs" stays ≤ 1**

- **Found during:** Task 2 (TopBar A4 — initial draft included a docstring sentence with the literal "Humyn Labs" verbatim, which would have left 2 occurrences in the file: docstring + accessibilityLabel)
- **Issue:** The plan's acceptance criterion `grep -c "Humyn Labs" apps/mobile/src/components/TopBar.tsx ≤ 1` interacts with the also-required `accessibilityLabel="Humyn Labs Capture wordmark"` grep. The literal grep counts ALL occurrences (it doesn't distinguish docstring vs accessibilityLabel), so to satisfy ≤ 1 with the accessibilityLabel mandatory, the docstring mention had to be reworded.
- **Fix:** Reworded the Plan-03-11 docstring callout to describe the change without using the literal "Humyn Labs" string (now: "TopBar wordmark promoted from the Phase 2 Text stub to the orange wordmark Image"). Final count is 1 (the accessibilityLabel only).
- **Files modified:** `apps/mobile/src/components/TopBar.tsx`
- **Verification:** `grep -c "Humyn Labs" apps/mobile/src/components/TopBar.tsx` returns 1; all other Task 2 grep gates pass.
- **Committed in:** `e181eee` (Task 2 commit)

**4. [Rule 1 - Bug] cwd-drift in worktree mode wrote first edits to the main repo instead of the worktree**

- **Found during:** Task 1 (first commit attempt failed with `FATAL: not a worktree` because `[ -f .git ]` checked the main repo where `.git` is a directory)
- **Issue:** Without an explicit `cd` to the worktree root, the `Edit` tool's absolute paths resolved to `/Users/adnaan/Documents/hl-homelander/...` (the main repo), not `/Users/adnaan/Documents/hl-homelander/.claude/worktrees/agent-a574a247825fdd8a6/...` (the worktree). The worktree-path-safety guard in `references/worktree-path-safety.md` warns about this exact failure mode.
- **Fix:** Restored the main-repo files via `git restore` and re-applied all Task 1 edits against the explicit worktree-root absolute paths. Subsequent tasks consistently used the worktree-root paths and an explicit `cd` to the worktree root in every Bash call.
- **Files modified:** none in the final state (the main-repo edits were reverted before any commit landed; the bug was caught before any cross-tree contamination shipped)
- **Verification:** `git status --short` in the main repo showed clean; the worktree's commits all reside on the per-agent branch.
- **Committed in:** none (no contaminating commits ever landed)

---

**Total deviations:** 4 auto-fixed (1 Rule 3 environment, 2 Rule 1 test-contract migration, 1 Rule 1 worktree-path-safety self-correction)
**Impact on plan:** All deviations either environmental (symlinks) or self-corrections from interaction surface that the plan's `<acceptance_criteria>` correctly anchored on. No scope creep beyond the planned amendments. A2 escalation is in-plan (Branch B path was an explicit option).

## Issues Encountered

- **Pre-existing 3 unhandled rejections in `__tests__/navigation/RootNativeStack.test.tsx`** — surface even on the parent commit (`69396df`, before Plan 03-11). Out of scope for this plan; logged here so the next executor sees them and they're not picked up as a Plan 03-11 regression. Tests still pass (345/345); only the unhandled-rejection warning is present.
- **`03-WAVE1-SMOKE.md` line 113 misalignment** — the runbook still tells the operator "Wordmark visible in the TopBar — typographic stub still renders 'Humyn Labs' (the wordmark Image upgrade in TopBar is deferred to a future plan...)". Post Plan 03-11, the wordmark IS the orange Image. Per the plan's `<verification>` rules, do NOT silently rewrite the operator runbook — the operator owns it. Surface it here so the operator notices during the D-WAVE-08 re-walk and amends the runbook in the same pass that stamps `re-walked-on:`.

## User Setup Required

**Manual artwork drop required to fully close A2.** See `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` § "A2 — closure attempt (Plan 03-11 Task 5)":

- Drop a real rig PNG (≥ 4096 bytes, transparent background, ~280 dp wide intrinsic) at `/Users/adnaan/Documents/hl-homelander/design-system/illustrations/rig.png`.
- A future plan will use the Plan 03-01 / Pattern 65 density-bucket re-export workflow (`sharp(source).trim()` → 280/560/840 dp) to land `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png`.
- RigTutorialScreen.tsx require path is unchanged; the artwork landing closes A2 with no code change.

**No environment variables, dashboard configuration, or external service setup needed for the Plan 03-11 changes themselves.**

## Visual Baseline Refresh Inventory

| Surface     | Baseline mtime advanced? | Reason                                                                                          |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| Splash      | No                       | A6 is style-only (width/height + resizeMode); structural-render-tree-PNG encoder ignores style. |
| Sign-up     | No                       | Same.                                                                                           |
| Permissions | No                       | A1 is text-only (idle body string change); same DOM shape.                                      |
| Home        | **Yes**                  | A4 swapped Text → Image inside top-bar-logo View; DOM shape changed.                            |
| Tasks       | **Yes**                  | Same as Home (Pattern 71 propagation).                                                          |
| History     | **Yes**                  | Same as Home (Pattern 71 propagation).                                                          |
| CompatFail  | **Yes**                  | A5 deleted 3 Text nodes + wrapping View; fewer wireframe rectangles.                            |
| HelpCenter  | No (untouched)           | Plan 03-11 did not modify this surface.                                                         |
| RigTutorial | No (untouched)           | A2 escalated; no asset replacement landed in this plan.                                         |
| CompatPass  | No (untouched)           | Plan 03-11 did not modify this surface.                                                         |

The Wave-1 baseline COUNT stays at 10. Plan 03-11 refreshes 4 of the 7 surfaces it touched; the other 3 (Splash, Signup, Permissions) are intentionally unchanged because the visual encoder is shape-only.

## Wave 2 Gate State

D-WAVE-08 acceptance gate (Wave 2 entry — Plan 03-04 capture-foundation-muxer-bridge):

- ✅ **Step 1 (planning-side amendment closure)** — Plan 03-11 closes A1, A3, A4, A5, A6 in source. A2 escalated to user (operator's call whether to ship Wave 2 with the rig page still showing transparent placeholder).
- ⚠ **Step 2 (operator on-device re-walk on Pixel 10a)** — operator-driven; not in this plan's executable scope.
- ⚠ **Step 3 (`re-walked-on: 2026-MM-DD` stamp in `03-WAVE1-SMOKE.md`)** — operator-driven.

Plan 03-04's `depends_on: [03-03, 03-11]` is honored at the planning level. Wave 2 plan-phase opens once the operator stamps the re-walk.

## Reminder to Operator

**Re-walk Pixel 10a per `03-WAVE1-SMOKE.md` to verify A1/A3/A4/A5/A6 closures on-device.** Stamp `re-walked-on: 2026-MM-DD` to unblock D-WAVE-08 Step 4 + Wave 2. While re-walking, please also fix the `03-WAVE1-SMOKE.md` line 113 misalignment (`typographic stub still renders 'Humyn Labs'` — the post-polish state is the orange wordmark Image).

## Self-Check: PASSED

- ✅ All 5 source files modified per plan acceptance criteria (PermissionsScreen, BottomNav, TopBar, CompatFailScreen, SplashScreen, SignupScreen).
- ✅ All 6 task commits exist on the worktree branch (verified via `git log --oneline -7`).
- ✅ A1 grep gate: `Used only while you hit record` present, `Nothing leaves your phone` absent.
- ✅ A3 grep gate: `useSafeAreaInsets`, `insets.bottom + 12`, `height: 68 + insets.bottom` all match.
- ✅ A4 grep gate: `require('.*assets/logos/orange_logo`, `aspectRatio: 320 / 73`, `accessibilityLabel="Humyn Labs Capture wordmark"` all match; no JSX `>Humyn Labs<` Text node.
- ✅ A5 grep gate: 0 occurrences of `recovery-bullet-`, 0 of `styles.bullets`, support email + Contact Support CTA preserved.
- ✅ A6 grep gate: `width: 256, height: 58` and `resizeMode: 'contain'` both present in Splash + Signup.
- ✅ A2 escalation gate: `open-escalated` and `Plan 03-11 Task 5` both present in 03-W1-AMENDMENTS.md.
- ✅ Closure-line gate: 6 `**Closure:**` lines (one per A1–A6) at line-start in 03-W1-AMENDMENTS.md.
- ✅ Frontmatter stamp: `partial-closed-by-03-11-2026-05-10-a2-escalated` present.
- ✅ TypeScript clean: `npx tsc --noEmit` exits 0.
- ✅ Full mobile test suite green: 345/345 tests pass across 61 test files (3 pre-existing unhandled rejections in unrelated nav test, out of scope).

---

_Phase: 03-humyn-capture-native-module_
_Completed: 2026-05-10_
