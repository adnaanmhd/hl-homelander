---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 09
subsystem: auth
tags:
  [
    react-native,
    signup,
    terms-of-use,
    consent,
    google-sign-in,
    fnv-1a,
    mmkv,
    design-spec-§2,
    idea-brief-§5.2,
    modal,
    alert-gate,
    AUTH-01,
    AUTH-02,
    AUTH-03,
    AUTH-04,
    AUTH-05,
    AUTH-08,
  ]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: signInWithGoogle orchestration (services/auth.ts), POST /auth/google + /auth/nonce + Play Integrity, MMKV humyn.secure singleton
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile (earlier waves)
    provides: tokens.ts, ScreenContainer/Text/Button/Pressable/Modal primitives, useAppStore (setJwt/setConsent), util/analytics.ts (logEvent + EVENT_NAMES)
provides:
  - SignupScreen — full design-spec §2 layout (logo + tagline + 3-line pitch + Continue-with-Google + consent row + Terms-of-Use link + error state)
  - TermsOfUseModal — verbatim §5.2 / §18.1 consent text rendered via canonical TERMS_OF_USE_TEXT export
  - signOut() helper exported from services/auth.ts (consumed by plan 02-18 Profile Logout)
  - Client-side FNV-1a consent-version stamp (server SHA-256 remains authoritative legal hash per D-LEGAL-03)
  - 13 unit tests across the two components covering consent gate, success, error, modal, and AUTH-04 nullable-fields paths
affects: [02-18-profile, 02-21-manual-smoke, phase-7-ios]

# Tech tracking
tech-stack:
  added: [] # no new libs — wraps Phase 1 + Phase 2 earlier-wave primitives
  patterns:
    - 'Client-side consent-version stamp via FNV-1a 32-bit hash of TERMS_OF_USE_TEXT; server-side SHA-256 (D-LEGAL-03) remains the canonical legal hash'
    - 'Logo as a stable accessibilityLabel contract (Humyn Labs logo) — wordmark stub renders today; brand SVG lands in plan 02-15 without changing the a11y contract'
    - 'data-testid sentinel (checkbox-checked-indicator) forwarded through host-component shim for JSDOM-side assertions where role+aria-state alone is insufficient'
    - 'Verbatim canonical-text constant guarded by per-line concatenation + `// prettier-ignore` so prettier cannot drift the string'

key-files:
  created:
    - apps/mobile/src/screens/signup/TermsOfUseModal.tsx
    - apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx
    - apps/mobile/__tests__/screens/SignupScreen.test.tsx
  modified:
    - apps/mobile/src/services/auth.ts # +signOut() export, +useAppStore import
    - apps/mobile/src/screens/signup/SignupScreen.tsx # stub → full design-spec §2 body

key-decisions:
  - 'Client-side FNV-1a stamp for the local consent-version identifier; the server LEGAL-02 SHA-256 stays authoritative.'
  - 'Logo rendered as a wordmark Text node with a stable accessibilityLabel; the real brand SVG lands in plan 02-15.'
  - 'TermsOfUseModal Test 1 (visible=false) asserts the prop forwarding contract instead of DOM-tree absence — the JSDOM host-component shim from vitest.setup.ts does NOT honor RN Modal visibility (passthrough <div> always renders children).'
  - "Adapt to the actual primitive APIs (Modal.onDismiss, Button.label) rather than the plan's example signatures (Modal.onRequestClose, Button children) — Rule 3 blocking adaptation."

patterns-established:
  - 'Pattern A: Verbatim canonical-text constant (`TERMS_OF_USE_TEXT`) + length sanity-check test — cheap drift detector for legal copy. Future Phase 5 hash-verify pipeline + Phase 7 iOS parity will reuse this exact constant.'
  - 'Pattern B: vi.hoisted() block for screen tests that need spy refs inside vi.mock factories (auth.signInWithGoogle, store.setJwt, navigation.replace, analytics.logEvent, RN Alert.alert). Mirrors the RigTutorialScreen / PermissionsScreen test scaffolds.'
  - 'Pattern C: react-native shim extension inside the test file — Alert.alert is not exposed in vitest.setup.ts so each test file that needs it stamps its own factory, same as RigTutorialScreen.test.tsx does for Linking.openURL.'

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-08]

# Metrics
duration: 9min
completed: 2026-05-09
---

# Phase 02 Plan 09: SignupScreen + TermsOfUseModal Summary

**Full design-spec §2 sign-up screen wrapping Phase 1 `signInWithGoogle` with verbatim §5.2 / §18.1 consent text, default-checked consent gate, alert-on-unchecked, and persisted consent stamp.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-09T10:41:57Z
- **Completed:** 2026-05-09T10:50:13Z
- **Tasks:** 2
- **Files created/modified:** 5 (3 new + 2 modified)
- **Tests added:** 13 (4 TermsOfUseModal + 9 SignupScreen)

## Accomplishments

- **TermsOfUseModal** ships the canonical legal copy as `TERMS_OF_USE_TEXT` — verbatim from idea-brief.md §5.2 and design-spec.md §18.1, byte-for-byte. The constant carries a `// CANONICAL — do not edit` comment + a length-sanity assertion in Test 4 so any drift is caught at PR time.
- **SignupScreen** replaces the 02-05 stub with the full §2 layout: logo wordmark + tagline ("Real Humyns. Real Intelligence.") + 3-line pitch ("Record real moments." / "Train real intelligence." / accent "Get paid") + Continue-with-Google CTA + default-checked consent + Terms-of-Use link + inline error display.
- **Consent gate**: tap CTA with consent unchecked → `Alert.alert('Please accept the Terms of Use to continue.')`; `signInWithGoogle` is NOT called and `navigation.replace` is NOT fired. Tap with consent checked → `signInWithGoogle()` → `setJwt(jwt)` + `setConsent({acceptedAt, consentVersion})` → `navigation.replace('Permissions')`.
- **Consent versioning**: a FNV-1a 32-bit hex stamp of `TERMS_OF_USE_TEXT` is computed once at module load and stored alongside the consent acceptance time. The server-side LEGAL-02 SHA-256 (Phase 1 plan 01-11) remains the authoritative legal hash; the client stamp is local bookkeeping.
- **Error path**: when `signInWithGoogle` rejects, the message is captured into local state and rendered via an `accessibilityLabel="signup error"` Text node; `signup_google_failed` analytics event fires with the reason; the screen returns to idle so the user can retry.
- **Logout helper**: `signOut()` is now exported from `services/auth.ts` (plan 02-18 Profile Logout will import it). Clears the persisted JWT via `clearStoredJwt()` and resets the in-memory auth slice via `useAppStore.getState().signOut()`.

## Task Commits

Each task was committed atomically (TDD cycle for Task 2):

1. **Task 1: TermsOfUseModal + signOut helper** — `e429804` (feat) — TermsOfUseModal verbatim §5.2 copy + Modal/Button/ScrollView composition, auth.ts + signOut() export, 4 unit tests.
2. **Task 2 (RED): 9 failing SignupScreen tests** — `bd8f4df` (test) — full behavior matrix (logo, pitch, CTA, default-checked consent, alert gate, success path, error path, terms-modal-open, AUTH-04 nullable-avatar). All 9 tests fail against the 02-05 stub.
3. **Task 2 (GREEN): SignupScreen body** — `2353aad` (feat) — full design-spec §2 layout + consent gate + auth orchestration. 9/9 RED tests now pass; full mobile suite at 92/92 actual tests passing.

**Plan metadata commit:** (this SUMMARY.md commit, hash recorded after this file is committed).

_Note: Task 2 followed the TDD cycle (test → feat). No REFACTOR step needed — the GREEN body landed cleanly._

## Files Created/Modified

- `apps/mobile/src/screens/signup/TermsOfUseModal.tsx` — NEW. Renders canonical §5.2 / §18.1 consent text inside the Modal primitive; "Got it" closes via the onClose prop.
- `apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx` — NEW. 4 tests: visible-prop forwarding, verbatim body assertion, onClose callback, canonical-text byte-for-byte.
- `apps/mobile/src/services/auth.ts` — MODIFIED. Adds `signOut()` export wrapping `clearStoredJwt()` + `useAppStore.getState().signOut()`. Adds `useAppStore` import. AUTH-08 client surface for plan 02-18.
- `apps/mobile/src/screens/signup/SignupScreen.tsx` — MODIFIED. Stub → full design-spec §2 implementation. New: FNV-1a `consentVersionFromText`, logo wordmark stub, tagline, 3-line pitch, CTA loading state, consent toggle + custom checkbox, Terms-of-Use link, inline error display, TermsOfUseModal mount.
- `apps/mobile/__tests__/screens/SignupScreen.test.tsx` — NEW. 9 tests covering the design-spec §2 contract end-to-end (mocks: `services/auth`, `state/appStore`, `@react-navigation/native`, `util/analytics`, RN `Alert.alert`).

## Decisions Made

1. **FNV-1a for client-side consent-version stamp**, not SHA-256 — the legal source of truth lives server-side (D-LEGAL-03); the client stamp is a local audit-trail marker. FNV-1a is sync, dependency-free, and 32-bit hex is sufficient for a stable per-text identifier. This decision is documented inline in `SignupScreen.tsx` so a future reader doesn't accidentally swap it for a heavier hash.
2. **Logo accessibilityLabel contract over actual SVG** — TopBar already does the same; plan 02-15 will provide the brand SVG. The `accessibilityLabel="Humyn Labs logo"` query is the stable test contract.
3. **Custom checkbox via Pressable + nested View indicator** instead of a third-party checkbox component — keeps the dependency tree small and matches design-spec §2's "16px square + accent-color fill" exactly. The `data-testid="checkbox-checked-indicator"` sentinel is the JSDOM-side assertion handle; on a real device the indicator is just a 8x8 surface-color square inside the accent-bg checkbox.
4. **Alert.alert via the JSDOM shim extension** — vitest.setup.ts does not export Alert; the test file stamps its own RN factory (same pattern RigTutorialScreen.test.tsx uses for Linking.openURL).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Modal primitive uses `onDismiss`, not `onRequestClose`**

- **Found during:** Task 1 (TermsOfUseModal authoring)
- **Issue:** The plan body's example code passed `onRequestClose={onClose}` to the Modal primitive, but `apps/mobile/src/ui/primitives/Modal.tsx` defines its prop as `onDismiss` (with type `ModalProps.onDismiss`).
- **Fix:** Used `onDismiss={onClose}` in TermsOfUseModal.
- **Files modified:** `apps/mobile/src/screens/signup/TermsOfUseModal.tsx`
- **Verification:** typecheck clean; 4 modal tests pass.
- **Committed in:** `e429804`

**2. [Rule 3 - Blocking] Button primitive uses `label` prop, not children**

- **Found during:** Task 1 + Task 2
- **Issue:** The plan body wrapped Button-as-a-children-consumer (`<Button>Got it</Button>`), but `apps/mobile/src/ui/primitives/Button.tsx` defines `ButtonProps.label: string` (children are not rendered).
- **Fix:** Used `<Button label="Got it" />` and `<Button label="Continue with Google" />` (with stateful loading-text label `Signing in…`).
- **Files modified:** `TermsOfUseModal.tsx`, `SignupScreen.tsx`
- **Verification:** typecheck clean; both screens render the labels and tests find them via `getByLabelText`.
- **Committed in:** `e429804`, `2353aad`

**3. [Rule 3 - Blocking] `logo.js` is a DOM script, not an RN component**

- **Found during:** Task 2 (SignupScreen authoring)
- **Issue:** The plan body imported `Logo from '../../../../logo'` and used `<Logo width={140} height={48} accessibilityLabel="Humyn Labs logo" />`. Inspection of `logo.js` shows it is a plain DOM script (`document.querySelectorAll('img.logo-img').forEach(...)`) — it has no React Native default export and would crash Hermes at module load.
- **Fix:** Used a wordmark stub (`<View accessibilityLabel="Humyn Labs logo"><Text variant="title28">Humyn Labs</Text></View>`) — same pattern as `apps/mobile/src/components/TopBar.tsx`. The accessibilityLabel contract is preserved; the brand SVG lands in plan 02-15.
- **Files modified:** `apps/mobile/src/screens/signup/SignupScreen.tsx`
- **Verification:** Test 1 passes (`getByLabelText('Humyn Labs logo')`); typecheck clean.
- **Committed in:** `2353aad`

**4. [Rule 1 - Bug] TermsOfUseModal Test 1 (visible=false) wrongly asserted DOM-tree absence**

- **Found during:** Task 1 (test authoring)
- **Issue:** The first version of Test 1 asserted that `queryByLabelText('Terms of Use body')` returned null when `visible={false}`. The JSDOM host-component shim from `vitest.setup.ts` (lines 130-133) maps RN `<Modal>` to a passthrough `<div>` that always renders its children — `visible` is forwarded as a DOM attribute but never gates rendering. The test failed because the body text was always queryable.
- **Fix:** Re-wrote Test 1 to assert the prop-forwarding contract: `container.querySelector('[data-testid="Modal"]').getAttribute('visible')` is `'false'` (or absent). On a real device, RN's Modal honors `visible={false}` and renders nothing — that's the contract that matters.
- **Files modified:** `apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx`
- **Verification:** All 4 tests pass.
- **Committed in:** `e429804` (rolled into the same Task 1 commit)

**5. [Rule 3 - Blocking] String concatenation broke `Humyn's Privacy Policy` substring grep**

- **Found during:** Task 1 verification
- **Issue:** Initial `TERMS_OF_USE_TEXT` split the trailing sentence as `"Humyn's " + 'Privacy Policy.'` across two source lines. Runtime concatenation produced the correct string but the acceptance-criteria grep `grep -q "Humyn's Privacy Policy"` failed against the source.
- **Fix:** Reformatted the string so the final segment is a single line `"I understand that ... Humyn's Privacy Policy."` and added `// prettier-ignore` so prettier can't re-wrap it. Tests + grep both pass.
- **Files modified:** `apps/mobile/src/screens/signup/TermsOfUseModal.tsx`
- **Verification:** All 7 acceptance-criteria greps pass; tests still 4/4 green.
- **Committed in:** `e429804`

---

**Total deviations:** 5 auto-fixed (3 blocking adapt-to-actual-API, 1 test bug, 1 string-format).
**Impact on plan:** All deviations were API-shape adaptations and one test-design fix; none expand scope or violate any threat-model mitigation. The verbatim consent text, the consent gate, and the AUTH-08 logout export all match the plan body's intent.

## Issues Encountered

- **Multi-agent worktree contention** — the worktree branch (`worktree-agent-abadb4606602655c3`) shows a number of plan-02-08/02-10/02-11 GREEN commits (`9fdf290`, `379ace6`, `72f1d17`) that landed during this session and one deviation in my own RED commit `bd8f4df` that bundled in unrelated PermissionsScreen + vitest.setup.ts changes via lint-staged's interaction with the working tree. The end-state files are correct; the commit-message labeling is loose. Already documented in `.planning/phases/02-.../deferred-items.md` rows 9 + 12. No history rewrite was attempted (per `<destructive_git_prohibition>`).
- **Pre-existing `versionService.ts(84,33): Property 'getJson' does not exist`** — was visible in the baseline typecheck before any of my changes. Out of scope per the SCOPE BOUNDARY rule (different plan: 02-08).
- **`__tests__/navigation/RootNativeStack.test.tsx` syntax error** — pre-existing failing test suite; out of scope. Already noted in deferred-items.md.

## Threat Flags

None — every threat in the plan's `<threat_model>` was addressed:

- **T-2.9-01 (consent text tampering, mitigate):** TermsOfUseModal carries `// CANONICAL — sourced verbatim from idea-brief.md §5.2 / design-spec.md §18.1` comment block, and Test 4 asserts byte-for-byte equality with a duplicate canonical string in the test file (drift detector).
- **T-2.9-02 (Google account spoofing, accept):** unchanged — backend re-validates ID token via Phase 1 D-AUTH-01.
- **T-2.9-03 (consent repudiation, mitigate):** `setConsent({acceptedAt: new Date().toISOString(), consentVersion: <FNV-1a-stamp>})` writes the stamp to MMKV via the appStore action; server-side LEGAL-02 audit log captures the SHA-256 server-side at `/auth/google` time.
- **T-2.9-04 (PII leakage via console.log, mitigate):** SignupScreen does not call `console.log`. The error message stored in state is the captured `Error.message` (e.g. `google_sign_in_cancelled`), never the user object. analytics.logEvent passes only `{reason: <error-code>}` to `signup_google_failed`.

No new security-relevant surface was introduced beyond what the plan's threat model anticipated.

## User Setup Required

None — no external service configuration required. Wired via Phase 1's existing Google Sign-In + Play Integrity setup.

## Next Phase Readiness

- **Plan 02-18 (Profile Logout)** can `import { signOut } from 'src/services/auth';` — the helper is exported and the `useAppStore.getState().signOut()` action wipes the JWT slice.
- **Plan 02-21 (Manual smoke runbook)** should append a step to the apkRollout walk-through that opens the Sign-up screen, taps the Terms-of-Use link, visually compares the modal text against `idea-brief.md §5.2`, and asserts that the consent checkbox is pre-checked.
- **Phase 7 (iOS)** consumes `TERMS_OF_USE_TEXT` unchanged — the constant is platform-agnostic. The Swift analogue of `signOut()` will mirror the same shape.
- **Phase 5 (upload pipeline)** will extend `signOut()` to additionally cancel any in-flight uploads; call sites do NOT need to change (intentional design).

## Self-Check: PASSED

All claimed artifacts and commits verified at `2026-05-09T10:52:18Z`:

- ✓ `apps/mobile/src/screens/signup/TermsOfUseModal.tsx` exists
- ✓ `apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx` exists
- ✓ `apps/mobile/src/services/auth.ts` exists (signOut export verified via grep)
- ✓ `apps/mobile/src/screens/signup/SignupScreen.tsx` exists (full body, 251 LOC)
- ✓ `apps/mobile/__tests__/screens/SignupScreen.test.tsx` exists
- ✓ `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-09-signup-screen-and-terms-modal-SUMMARY.md` exists (this file)
- ✓ Commit `e429804` (Task 1 feat: TermsOfUseModal + signOut helper) present in git log
- ✓ Commit `bd8f4df` (Task 2 RED: 9 failing SignupScreen tests) present in git log
- ✓ Commit `2353aad` (Task 2 GREEN: SignupScreen body) present in git log
- ✓ Final `npm run typecheck` clean
- ✓ Final `npm run test -- __tests__/screens/SignupScreen.test.tsx __tests__/screens/TermsOfUseModal.test.tsx` reports 13/13 tests pass

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
