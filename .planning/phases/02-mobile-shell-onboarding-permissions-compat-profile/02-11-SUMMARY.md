---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 11
subsystem: mobile/onboarding
tags: [onboarding, tutorial, off-ramp, ONB-01, ONB-02, design-spec-§5]
dependency_graph:
  requires:
    - 02-02-test-scaffolding-and-deps (Sheet, Button, Pressable, ScreenContainer, Text primitives + JSDOM host-component shim)
    - 02-03-state-store-and-hydration (useAppStore.setTutorialDone(googleSub), s.jwt selector)
    - 02-04-installation-id-and-telemetry-ring (logEvent + EVENT_NAMES allowlist; rig_tutorial_shown / rig_no_rig_link_tapped pre-registered)
    - 02-05-navigation-skeleton (RigTutorial registered in OnboardingStack; MainTabs sibling at Root level)
  provides:
    - RigTutorialScreen verbatim §5 implementation
    - ONB-02 off-ramp Sheet pattern (mailto + non-soft-locking)
    - tutorialDone persistence on Next-tap
  affects:
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (replaced 02-05 stub)
    - apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx (NEW — 6 tests)
tech_stack:
  added: []
  patterns:
    - vi.hoisted FAKE_JWT pattern (mock factory needs the value before module-level consts initialise)
    - per-screen react-native shim extension for Linking.openURL (vitest.setup.ts shim doesn't include Linking; layered factory adds it without disturbing other tests)
    - parent-navigator preferred replace pattern (navigation.getParent()?.replace ?? navigation.replace) so Phase 4 can splice Practice without restructuring the navigator
key_files:
  created:
    - apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx
  modified:
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (was the 02-05 placeholder stub; now the full §5 implementation + off-ramp)
decisions:
  - 'Decoded googleSub from JWT in-screen rather than via auth.ts helper — auth.ts owns the sign-in flow and persists the JWT but does not yet export a getGoogleSub() helper; inlining the JWS-payload decoder keeps the screen self-contained and matches the plan body verbatim. A future refactor can extract decodeGoogleSubFromJwt() into auth.ts when a second consumer appears.'
  - 'Used `catch {}` (no binding) to satisfy the project ESLint @typescript-eslint/no-unused-vars rule — argsIgnorePattern: ^_ does not apply to catch clauses; binding `_e` still triggered the error during pre-commit lint-staged.'
  - 'Sheet API uses `onDismiss` (not `onClose` as the plan body suggested) — confirmed against the actual Sheet primitive in apps/mobile/src/ui/primitives/Sheet.tsx.'
  - 'Button primitive takes `label` prop (not children) — confirmed against the actual Button primitive; the plan body suggested children but the implementation in 02-02 is label-based.'
metrics:
  duration_min: 14
  completed_date: 2026-05-09
---

# Phase 02 Plan 11: RigTutorialScreen + "Don't have a rig yet" off-ramp Summary

Verbatim design-spec §5 Rig tutorial screen plus the ONB-02 off-ramp Sheet — Phase 2's onboarding terminus before Phase 4 inserts the practice-recording flow.

## What Shipped

- **RigTutorialScreen** (`apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`)
  - Heading "You'll need a head rig" (typography variant `tutorialHeading`, 30/36, 700)
  - Body "Mount your phone on the head rig and make sure it is steady while recording." (variant `tutBody`, 17/25)
  - Sticky "Next" Button → `setTutorialDone(googleSub)` + `navigation.getParent()?.replace('MainTabs')`
  - "Don't have a rig yet?" Pressable link → opens off-ramp Sheet
  - Off-ramp Sheet contains body copy with the `[EMAIL_ADDRESS]` placeholder, an "Email support" Button (Linking.openURL → mailto), and a "Got it" outline Button
  - rig_tutorial_shown analytics event on mount; rig_no_rig_link_tapped on link tap
  - Accessibility labels on every interactive node + the heading/body/illustration placeholder
- **6 unit tests** (`apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx`)
  - Test 1: verbatim §5 heading + body copy renders
  - Test 2: Next CTA + "Don't have a rig yet?" link both render
  - Test 3: tap Next → setTutorialDone(googleSub) → parent.replace('MainTabs')
  - Test 4: tap off-ramp → Sheet opens; body mentions [EMAIL_ADDRESS]; Email-support button calls Linking.openURL with the mailto URL
  - Test 5: off-ramp does NOT soft-lock — Next still works after viewing
  - Test 6: rig_tutorial_shown on mount; rig_no_rig_link_tapped on link tap

## Verbatim copy delta vs design-spec §5

The screen ships exactly the 3 strings design-spec §5 specifies. No copy delta.

| design-spec §5 element                                                                       | Plan-02-11 implementation                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading (30/36, 700): "You'll need a head rig"                                               | `<Text variant="tutorialHeading">You'll need a head rig</Text>` (apostrophe escaped via `&apos;`)                                                                                                                                                                                                 |
| Body (17/25): "Mount your phone on the head rig and make sure it is steady while recording." | `<Text variant="tutBody" tone="secondary">Mount your phone on the head rig and make sure it is steady while recording.</Text>`                                                                                                                                                                    |
| Button (`btn-primary`): "Next" → tutorial-practice                                           | `<Button variant="primary" label="Next" onPress={handleNext} />` — Phase 2 routes to MainTabs (Phase 4 will insert Practice between this and MainTabs without restructuring)                                                                                                                      |
| Padding 24/28/28, illustration 280 px                                                        | StyleSheet `screen` style sets paddingTop=24 (spacing.xxxl), paddingHorizontal=28 (spacing.h), paddingBottom=28 (spacing.h); illustration is a 240×280 placeholder rectangle in `colors.accentSoft` (real asset is a design-system follow-up; functional parity is the heading + body + Next CTA) |

## ONB-02 off-ramp design

**Trigger:** secondary "Don't have a rig yet?" Pressable beneath the body copy. Accent-colored, underlined, accessibilityRole="link".

**Sheet contents** (top-anchored Sheet primitive):

- `sheetTitle`: "No rig yet?"
- Body: explanatory copy mentioning `[EMAIL_ADDRESS]` placeholder
- "Email support" primary Button → `Linking.openURL('mailto:[EMAIL_ADDRESS]?subject=No%20rig%20yet')`
- "Got it" outline Button → closes the Sheet

**Non-soft-locking guarantee:** the user can tap "Next" at any time — before or after opening the Sheet, before or after tapping "Email support". Test 5 validates this explicitly. CONTEXT.md "must NOT soft-lock the user" honored.

## [EMAIL_ADDRESS] placeholder location

**File:** `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`
**Line:** `const SUPPORT_EMAIL = '[EMAIL_ADDRESS]';` (constant near the top of the file, plus interpolated body copy and mailto URL).

**Tracker:** `02-21-manual-smoke-runbook-PLAN.md` owns the swap; the `[EMAIL_ADDRESS]` literal string is greppable for a one-shot replace before Play Store submission. Two occurrences in the screen file (the constant and the body-copy interpolation) — both touch the same const so the swap is single-edit.

## Deviations from Plan

Three minor adjustments while staying within the plan's intent. None required user permission (Rule 1 / Rule 2 auto-fixes documented in the executor's deviation rules).

### 1. [Rule 1 - Bug] Sheet API uses `onDismiss`, not `onClose`

- **Found during:** Task 1, GREEN phase
- **Issue:** The plan body's reference implementation passed `onClose={...}` to the Sheet primitive, but the actual `Sheet.tsx` (from plan 02-02) exposes `onDismiss`. Wrong prop name would have produced a TypeScript error and the Sheet would never close.
- **Fix:** changed `onClose` → `onDismiss` in two places (the off-ramp Sheet's outer prop and the test file's assertion-target labels).
- **Files modified:** apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
- **Commit:** 72f1d17 (GREEN)

### 2. [Rule 1 - Bug] Button primitive takes `label`, not children

- **Found during:** Task 1, GREEN phase
- **Issue:** The plan body's reference implementation rendered `<Button>...</Button>` with children. The actual Button primitive (plan 02-02) takes a `label` prop with no children prop.
- **Fix:** swapped to `<Button label="Next" />` etc. for all three Button instances (Next, Email support, Got it).
- **Files modified:** apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
- **Commit:** 72f1d17 (GREEN)

### 3. [Rule 1 - Bug] `catch (_e)` triggered ESLint @typescript-eslint/no-unused-vars

- **Found during:** Task 1, GREEN-phase pre-commit lint-staged
- **Issue:** The eslint config has `argsIgnorePattern: '^_'` and `varsIgnorePattern: '^_'` but neither applies to catch-clause bindings; `catch (_e) {}` still raised the error.
- **Fix:** dropped the binding entirely → `catch {}`.
- **Files modified:** apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
- **Commit:** 72f1d17 (GREEN)

## Test approach notes (for future screen tests)

The vitest setup (`apps/mobile/vitest.setup.ts`) shims `react-native` with a fixed-shape factory that does NOT export `Linking`. To spy on `Linking.openURL` from a screen test, add a per-test-file `vi.mock('react-native', …)` factory that re-declares the host-component shim AND adds `Linking: { openURL: spy, canOpenURL: spy }`. The most-recent vi.mock wins, so the in-test factory takes precedence over the setup file's. Pattern reusable by future Phase 2 screens that import `Linking`.

## TDD Gate Compliance

Plan-level TDD cycle (per `type=execute` plan with `tdd="true"` task):

- **RED:** commit `6485455 test(02-11): add failing tests for RigTutorialScreen + off-ramp` — 6 tests written; all 6 fail because the screen is still the 02-05 stub.
- **GREEN:** commit `72f1d17 feat(02-11): RigTutorialScreen + ONB-02 off-ramp (GREEN)` — 6 tests pass; mobile typecheck exits 0.
- **REFACTOR:** none required.

## Acceptance Criteria — All Pass

| Criterion                                                                                         | Status                                                |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `grep -q "You'll need a head rig"` succeeds                                                       | ✓ (1 occurrence)                                      |
| `grep -q "Mount your phone on the head rig and make sure it is steady while recording."` succeeds | ✓                                                     |
| `grep -q "Don't have a rig yet?"` succeeds                                                        | ✓ (2 occurrences — link label + sheet body reference) |
| `grep -q "MainTabs"` succeeds                                                                     | ✓ (5 occurrences)                                     |
| `grep -q "\[EMAIL_ADDRESS\]"` succeeds                                                            | ✓ (2 occurrences)                                     |
| `cd apps/mobile && npm run test -- __tests__/screens/RigTutorialScreen.test.tsx` passes (6 tests) | ✓                                                     |
| `cd apps/mobile && npm run typecheck` exits 0                                                     | ✓                                                     |

## Commits

| Hash    | Type | Subject                                                  |
| ------- | ---- | -------------------------------------------------------- |
| 6485455 | test | add failing tests for RigTutorialScreen + off-ramp (RED) |
| 72f1d17 | feat | RigTutorialScreen + ONB-02 off-ramp (GREEN)              |

## Self-Check: PASSED

- FOUND: apps/mobile/**tests**/screens/RigTutorialScreen.test.tsx
- FOUND: apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
- FOUND: .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-11-SUMMARY.md
- FOUND commit: 6485455 (test RED)
- FOUND commit: 72f1d17 (feat GREEN)
