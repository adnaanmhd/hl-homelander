---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 18
subsystem: ui
tags:
  [
    react-native,
    help-center,
    multipart-upload,
    accordion,
    modal-sheet,
    build-time-codegen,
    idempotency-key,
    telemetry-snapshot,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: |
      02-04 telemetryRing.snapshot() consumed by buildDiagnosticSnapshot.
      02-05 RootNativeStack already registers HelpCenter as a sibling of MainTabs (HELP-04 surface).
      02-17 Profile row navigates to HelpCenter via navigation.navigate('HelpCenter').
  - phase: 01-foundation-backend-distribution-recon
    provides: |
      POST /feedback multipart route + FEEDBACK_CATEGORIES enum (Phase 1 plan 01-08).
provides:
  - apps/mobile/scripts/build-help-content.mjs — build-time markdown→JSON parser (D-HELP-01)
  - apps/mobile/src/screens/help/content.json — baked accordion + Contact Support content
  - apps/mobile/src/components/AccordionItem.tsx — generic disclosure component
  - apps/mobile/src/components/ReportProblemSheet.tsx — bottom-sheet HELP-05 form
  - apps/mobile/src/services/feedbackService.ts — submitFeedback({category, message}) + buildDiagnosticSnapshot()
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx — full HELP-01..04 surface
  - apiClient.postMultipart — multipart-form-data sibling of post/patch (does NOT set content-type)
affects:
  - 02-19 (Profile/Help drawer wiring or modal routes)
  - 02-21 (manual smoke — needs final support email + on-device mailto/share-sheet test)
  - 05-* (recordings) — feedbackService + diagnostic snapshot pattern reusable for upload-failure reports

# Tech tracking
tech-stack:
  added:
    - build-time markdown→JSON parser (zero-dep node ESM, runs at npm prebuild)
    - apiClient.postMultipart wrapper for FormData payloads
  patterns:
    - 'MD→JSON build-time bake (D-HELP-01): committed JSON for review, runtime never parses markdown'
    - 'Pre-flight validation in service layer rejects bad input before burning rate-limit budget'
    - 'Per-test react-native re-mock to expose Linking.openURL / Alert.alert as spies'
    - 'FormData wire-shape adapter: Blob branch for JSDOM tests + RN polyfill blob-shape branch for device runtime'
    - 'Dual export (named + default) on screens to keep existing default-import navigators working without churn'

key-files:
  created:
    - apps/mobile/scripts/build-help-content.mjs
    - apps/mobile/src/screens/help/content.json
    - apps/mobile/src/components/AccordionItem.tsx
    - apps/mobile/src/components/ReportProblemSheet.tsx
    - apps/mobile/src/services/feedbackService.ts
    - apps/mobile/__tests__/scripts/build-help-content.test.ts
    - apps/mobile/__tests__/components/AccordionItem.test.tsx
    - apps/mobile/__tests__/components/ReportProblemSheet.test.tsx
    - apps/mobile/__tests__/services/feedbackService.test.ts
    - apps/mobile/__tests__/screens/HelpCenterScreen.test.tsx
  modified:
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (stub → full design-spec §17 surface)
    - apps/mobile/src/services/api.ts (added postMultipart + PostMultipartOptions)
    - apps/mobile/package.json (build:help + prebuild scripts)
    - apps/mobile/vitest.setup.ts (lucide allow-list extended with ChevronDown/ChevronUp)
    - apps/mobile/__tests__/navigation/RootNativeStack.test.tsx (HelpCenter accessibility-label updated to match new screen)

key-decisions:
  - 'Plan 02-18: react-native-uuid v4 (NOT ulid) for the POST /feedback Idempotency-Key — mobile dep tree ships uuid not ulid; Phase 1 plan 01-08 stores idempotency keys raw so UUIDv4 satisfies the uniqueness contract identically (matches 02-17 deviation).'
  - 'Plan 02-18: HelpCenterScreen exports BOTH named and default — RootNativeStack already imports it as a default; replacing the stub with a named-only export would force a navigator edit that plan 02-19 also touches.'
  - 'Plan 02-18: apiClient.postMultipart deliberately does NOT set Content-Type — fetch derives the boundary from the FormData instance; a manual content-type would strip the boundary parameter and make @fastify/multipart reject the body.'
  - 'Plan 02-18: build-time markdown→JSON parsing (D-HELP-01) — committed content.json for PR review, no runtime markdown dependency, deterministic offline-friendly. Source of truth is help-center-content.md at the repo root; `npm run prebuild` re-emits content.json on every install/start.'
  - 'Plan 02-18: Diagnostic snapshot (D-HELP-02) attaches the telemetryRing buffer as a multipart `diagnostic` JSON part. Per RESEARCH § Security pattern row 8 + engineering-handoff §11, ring entries already exclude PII (event names + non-PII attrs only) — so this attachment is safe by construction.'

patterns-established:
  - 'Pattern 47: Build-time markdown bake with HELP-01 invariants asserted in main() — malformed markdown commits fail the build with a useful error rather than shipping broken content'
  - 'Pattern 48: feedbackService pre-flight validation (category enum + 1..4000 char message) gates the network hop — bad input never burns the per-user rate-limit budget (Phase 1 plan 01-08: 5/min)'
  - 'Pattern 49: Per-test re-mock of react-native to expose Linking/Alert as spies (already used by RigTutorialScreen + SignupScreen; 02-18 reuses verbatim) — mirror the canonical vitest.setup.ts shim, swap the leaf module surface'

requirements-completed: [HELP-01, HELP-02, HELP-03, HELP-04, HELP-05]

# Metrics
duration: 12min
completed: 2026-05-09
---

# Phase 02 Plan 18: Help Center & Feedback Summary

**Help Center surface (3-accordion layout from baked help-center-content.md, mailto Contact Support, in-app Report-a-problem sheet posting multipart feedback with telemetryRing diagnostic snapshot to POST /feedback) — closes HELP-01..05 with 23 vitest cases.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09T18:50:00Z
- **Completed:** 2026-05-09T13:29:28Z (note: clock skew — the wave-4 dev box is on UTC)
- **Tasks:** 4
- **Files modified:** 14 (10 created + 4 modified)

## Accomplishments

- D-HELP-01 build-time MD→JSON parser bakes help-center-content.md into apps/mobile/src/screens/help/content.json (3 accordions, 38 items) at npm prebuild; HELP-01 ordering invariant baked into the script so malformed markdown commits fail the build.
- AccordionItem disclosure component (collapsed-by-default, ChevronDown/Up flip on toggle, accessibilityState.expanded for screen readers) with no hex literals.
- feedbackService.submitFeedback POSTs multipart `{category, message, diagnostic}` to /feedback with a fresh react-native-uuid v4 Idempotency-Key per call; pre-flight rejects bad category + out-of-range messages before the wire hop.
- buildDiagnosticSnapshot assembles the D-HELP-02 shape `{appVersion, buildIdentifier, osVersion, deviceModel, telemetryRing}` from the AppFlavor native module + telemetryRing.snapshot().
- HelpCenterScreen renders the three accordions verbatim from content.json plus a Contact Support headline, mailto:[EMAIL_ADDRESS] CTA, and a Report-a-problem CTA that mounts the ReportProblemSheet.
- ReportProblemSheet ships the design-spec §18 bottom-sheet form (8 chips for FEEDBACK_CATEGORIES, multiline textarea, Cancel + Send CTAs); pre-flight Alert when category/message is empty; failure surfaces via Alert and keeps the sheet open.
- 23 vitest cases cover the parser shape, accordion disclosure, multipart wire form (FormData entries + Idempotency-Key), screen layout (mailto: openURL + sheet mount + 7 Instructions Guide subsection headings), and sheet flow (8 chips + cancel + missing-category Alert + submit-success-closes-sheet + rejection-keeps-sheet-open).

## Task Commits

Each task was committed atomically:

1. **Task 1: build-help-content.mjs script + content.json + prebuild wiring** - `8fecaa4` (feat)
2. **Task 2: AccordionItem component + tests** - `ddd97fe` (feat)
3. **Task 3: feedbackService — POST /feedback multipart + diagnostic snapshot + tests** - `f16034c` (feat)
4. **Task 4: HelpCenterScreen + ReportProblemSheet + RootStack registration** - `7507356` (feat)

**Plan metadata:** TBD (docs commit pending state-update step)

## Files Created/Modified

- `apps/mobile/scripts/build-help-content.mjs` - Build-time markdown→JSON parser (D-HELP-01); HELP-01 ordering + non-empty-accordion invariants asserted in main()
- `apps/mobile/src/screens/help/content.json` - Baked help content (committed for PR review)
- `apps/mobile/src/components/AccordionItem.tsx` - Generic disclosure component (collapsed default, accessibilityState.expanded)
- `apps/mobile/src/components/ReportProblemSheet.tsx` - Slide-up bottom-sheet HELP-05 form (8 chips + textarea + cancel/send)
- `apps/mobile/src/services/feedbackService.ts` - POST /feedback multipart + buildDiagnosticSnapshot + pre-flight validation
- `apps/mobile/src/screens/help/HelpCenterScreen.tsx` - Full design-spec §17 Help Center surface (replaces stub)
- `apps/mobile/src/services/api.ts` - apiClient.postMultipart added (FormData wrapper; does NOT set content-type)
- `apps/mobile/package.json` - build:help + prebuild npm scripts
- `apps/mobile/vitest.setup.ts` - Lucide allow-list extended with ChevronDown/ChevronUp
- `apps/mobile/__tests__/scripts/build-help-content.test.ts` - 5 cases (HELP-01 order, 7 IG subsections, FAQ Q/A kind, Troubleshooting issue kind, [EMAIL_ADDRESS] preserved)
- `apps/mobile/__tests__/components/AccordionItem.test.tsx` - 3 cases (collapsed default, defaultOpen=true, header-tap toggles)
- `apps/mobile/__tests__/services/feedbackService.test.ts` - 6 cases (snapshot shape, multipart entries + idempotency key, pre-flight rejections, FEEDBACK_CATEGORIES order)
- `apps/mobile/__tests__/screens/HelpCenterScreen.test.tsx` - 4 cases (3 accordions render, mailto: openURL, Report-a-problem mounts sheet, IG subsections render after open)
- `apps/mobile/__tests__/components/ReportProblemSheet.test.tsx` - 5 cases (all 8 chips, Cancel→onClose, missing-category Alert, submit-success closes sheet, rejection keeps sheet open)
- `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx` - HelpCenter accessibility-label updated from `HelpCenter screen` (stub) to `help-center-screen` (real screen)

## Decisions Made

- Reused 02-17's react-native-uuid pattern instead of ulid (mobile bundle stays single-key-library).
- Kept HelpCenterScreen's default + named export so RootNativeStack's existing `import HelpCenterScreen from ...` resolves without a navigator edit (plan 02-19 also touches that file).
- Treated `files_modified.RootNativeStack.tsx` as a permission set — the existing 02-05 sibling registration already satisfies HELP-04 reachability.
- ReportProblemSheet uses the raw RN `Modal` (bottom-sheet layout) rather than the centered-card Modal primitive shipped in plan 02-02; the primitive's variant axis isn't extensible to bottom-sheets without adding a presentation prop.
- Build-script ESM (.mjs) instead of TypeScript so `node scripts/build-help-content.mjs` runs without a TS toolchain — vitest tests import the parser via `@ts-expect-error`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched ulid → react-native-uuid in feedbackService**

- **Found during:** Task 3 (feedbackService implementation)
- **Issue:** Plan body's `import { ulid } from 'ulid'` would fail — the mobile dep tree ships `react-native-uuid` (already proven by profileService 02-17) but NOT `ulid`. Adding ulid as a dependency would bring a second key-generation library into the bundle.
- **Fix:** Used `import uuid from 'react-native-uuid'` + `uuid.v4() as string` per the 02-17 deviation pattern. Phase 1 plan 01-08's idempotency hook stores keys raw — the shape is opaque to the backend, so a UUIDv4 satisfies the uniqueness contract identically.
- **Files modified:** apps/mobile/src/services/feedbackService.ts, apps/mobile/**tests**/services/feedbackService.test.ts
- **Verification:** 6/6 feedbackService tests pass; matches 02-17's STATE.md decision row.
- **Committed in:** f16034c (Task 3 commit)

**2. [Rule 1 - Bug] Replaced `vi.importActual('react-native')` with direct stub in feedbackService.test.ts**

- **Found during:** Task 3 (running feedbackService tests)
- **Issue:** Vitest hit a parse error inside `node_modules/react-native/index.js` — `import typeof * as ReactNativePublicAPI from "..."` is Flow syntax that Rollup can't parse. `vi.importActual` triggers loading of the real RN module, which is exactly what the canonical vitest.setup.ts mock avoids.
- **Fix:** Removed the importActual call; declared a plain object mock with the surface feedbackService.ts touches (Platform + NativeModules.AppFlavor only). Same pattern as RigTutorialScreen + SignupScreen which build their own RN shim.
- **Files modified:** apps/mobile/**tests**/services/feedbackService.test.ts
- **Verification:** Tests pass (6/6).
- **Committed in:** f16034c (Task 3 commit)

**3. [Rule 3 - Blocking] Extended vitest.setup.ts lucide allow-list with ChevronDown + ChevronUp**

- **Found during:** Task 2 (planning AccordionItem component)
- **Issue:** AccordionItem renders ChevronDown / ChevronUp but the canonical lucide-react-native mock has an explicit ICONS allow-list that didn't include them. Without the extension, `import { ChevronDown, ChevronUp } from 'lucide-react-native'` would resolve to undefined under JSDOM and the component would crash.
- **Fix:** Added both icons to the allow-list with a comment pointing back to plan 02-18.
- **Files modified:** apps/mobile/vitest.setup.ts
- **Verification:** AccordionItem tests pass (3/3); HelpCenterScreen tests pass; full mobile suite still 183/183 green.
- **Committed in:** ddd97fe (Task 2 commit)

**4. [Rule 1 - Bug] Updated RootNativeStack.test.tsx HelpCenter accessibility-label**

- **Found during:** Task 4 (full-suite regression check after replacing the stub HelpCenterScreen)
- **Issue:** The earlier stub used `accessibilityLabel="HelpCenter screen"`; the new design-spec §17 implementation uses the canonical hyphenated `help-center-screen` label (matches the screen-test pattern across the codebase). The pre-existing RootNativeStack.test.tsx Test 3 (HOME-08 sibling assertion) referenced the stub label and broke.
- **Fix:** Updated the test's `getAllByLabelText('HelpCenter screen')` → `getAllByLabelText('help-center-screen')` with an inline comment pointing back to plan 02-18.
- **Files modified:** apps/mobile/**tests**/navigation/RootNativeStack.test.tsx
- **Verification:** Full mobile suite 183/183.
- **Committed in:** 7507356 (Task 4 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 — bugs; 2 Rule 3 — blocking dependency mismatches)
**Impact on plan:** All four deviations were necessary to make the plan's spec executable in the actual mobile dep tree + test harness. No scope creep — every fix maps directly to a Task in the plan body and was contained inside that task's commit.

## Issues Encountered

- None beyond the Deviations above. The build-script + parser landed first-try; tests passed without iteration once the lucide and react-native mock surfaces were aligned.

## User Setup Required

None - no external service configuration required.

The OPEN QUESTION on the final support email (`[EMAIL_ADDRESS]` placeholder in help-center-content.md, content.json, and HelpCenterScreen.tsx) is preserved end-to-end. Replacement is a single-character edit at gate-close time:

1. Update help-center-content.md (verbatim text).
2. Run `npm run build:help` from `apps/mobile/` (re-emits content.json).
3. Update `SUPPORT_EMAIL_PLACEHOLDER` in HelpCenterScreen.tsx.
4. Manual smoke test (02-21) verifies the mailto: opens the system mail composer with the real address.

## Next Phase Readiness

- Plan 02-19 can extend RootNativeStack with modal routes alongside the existing HelpCenter sibling registration without conflict.
- The diagnostic-snapshot pattern (`buildDiagnosticSnapshot`) is reusable for any future "report a problem" surface — Phase 5 upload-failure reports and Phase 7 iOS App Store crash dialogs can call it directly.
- `apiClient.postMultipart` is the canonical multipart wrapper for any future endpoint that ships file blobs — Phase 5 recording uploads (presigned URLs) bypass it (S3 direct), but consent receipts / DSR exports / future support attachments can reuse it.

## Self-Check: PASSED

Verified files exist and commits exist:

- apps/mobile/scripts/build-help-content.mjs — FOUND
- apps/mobile/src/screens/help/content.json — FOUND
- apps/mobile/src/components/AccordionItem.tsx — FOUND
- apps/mobile/src/components/ReportProblemSheet.tsx — FOUND
- apps/mobile/src/services/feedbackService.ts — FOUND
- apps/mobile/src/screens/help/HelpCenterScreen.tsx — FOUND (replaced stub)
- 8fecaa4 (Task 1) — FOUND
- ddd97fe (Task 2) — FOUND
- f16034c (Task 3) — FOUND
- 7507356 (Task 4) — FOUND
- 23/23 plan-level vitest cases pass; full mobile suite 183/183.

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
