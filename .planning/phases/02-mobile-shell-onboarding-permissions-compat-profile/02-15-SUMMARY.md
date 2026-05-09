---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 15
subsystem: ui-screens
tags:
  [
    compat,
    react-native,
    react-native-svg,
    animated,
    haptics,
    auth-11,
    compat-01,
    compat-02,
    compat-03,
    compat-05,
    compat-06,
    compat-07,
    compat-08,
    d-compat-03,
    d-compat-05,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'Phase 2 RN deps + UI primitives + token discipline (02-02), Zustand store + CompatResult Zod schema + computeInitialRoute (02-03), AppFlavor + installationId service (02-04), navigation skeleton with 4 compat screen stubs registered (02-05), HumynCompat Kotlin shell + JS bridge (02-06), EncoderProbe + NalParser bodies (02-12), ImuProbe sustained-rate body (02-13), DeviceCaps.readAll() + locationPermission helper (02-14)'
provides:
  - 'apps/mobile/src/services/compatService.ts — runCompatCheck/needsRerun/getStoredCompatResult/clearStoredCompatResult orchestrating all three native HumynCompat probes into a CompatResult per D-COMPAT-05; signature math via AppFlavor.sha256First16Hex (D-COMPAT-03) backs AUTH-11 cross-device re-run'
  - 'apps/mobile/src/screens/compat/checks.ts — DISPLAY_ROWS + rowsFromResult() collapsing 12 internal CompatResult fields into 7 user-facing rows per design-spec §4'
  - 'apps/mobile/src/components/CompatRing.tsx — 130×130 stroke-dashoffset progress ring per design-spec §4 visual + §0.4 motion (350 ms standard ease curve); react-native-svg + RN built-in Animated, NO Reanimated dep at this seam'
  - "apps/mobile/src/screens/compat/CompatRunningScreen.tsx — design-spec §4a/§4b: 'Checking your phone' + 130×130 ring + 7-row checklist with cosmetic walk while runCompatCheck() in flight; nav.replace to CompatPass/CompatFail on resolve"
  - "apps/mobile/src/screens/compat/CompatPassScreen.tsx — design-spec §4c: 'You're in.' / 'All checks passed.' + 40 ms haptic on mount + Next CTA → RigTutorial; COMPAT-03 storage-warning banner when warningOnly=true"
  - 'apps/mobile/src/screens/compat/CompatFailScreen.tsx — design-spec §4d: failed-key copy with measured-value substitution + What now CTA → CompatRecovery; NO proceed CTA (COMPAT-06 enforced)'
  - "apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx — COMPAT-08 non-brick 'what now' page: 3 actionable bullets + Contact Support mailto with [EMAIL_ADDRESS] placeholder (matches HELP-03 placeholder)"
  - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt — sha256First16Hex(input) sync @ReactMethod (isBlockingSynchronousMethod = true) backing computeSignatureSync()'
  - 'apps/mobile/vitest.setup.ts — extended canonical react-native mock with Animated + Easing stubs so CompatRing + transitive importers render under JSDOM without crashing'
affects:
  - "plan 02-16 (compat signature wiring): compatService.computeSignatureSync now real; RootNativeStack's rootInitialRouteName() activates AUTH-11 the moment 02-16's hydrate-before-route lands"
  - 'plan 02-17 (rig tutorial → MainTabs): CompatPass.Next → RigTutorial entry point is wired'
  - 'plan 02-19 (HelpCenter): same [EMAIL_ADDRESS] placeholder convention reused for HELP-03 mailto; 02-21 manual-smoke flags both'
  - 'plan 02-21 (manual smoke): on-device walkthrough of compat-running → pass → tutorial AND compat-running → fail → recovery → mailto; ring 0→100% animation visual check'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: signature compute split — async getInstallationId() first, then sync sha256First16Hex via Kotlin @ReactMethod(isBlockingSynchronousMethod=true). Async-then-sync split lets RootNativeStack's gate-decision tree call computeSignatureSync inline at boot once installation_id is in MMKV (plan 02-16 wiring)."
    - 'Pattern: 12-internal-checks → 7-display-rows collapse owned by checks.ts. CompatRunningScreen and CompatFailScreen both consume the same rowsFromResult helper; design-spec changes flow through one function. The collapse rules (e.g. integrity = root && encoderNoBFrames && oisOff && hdrSdrForced) are encoded once.'
    - "Pattern: react-native-haptic-feedback ESM default-import (NOT require()) — vitest cannot resolve require() against an ESM mock. CompatPassScreen uses `import HapticFeedback from 'react-native-haptic-feedback'`; the canonical setup mock exposes `default.trigger` as a vi.fn() so per-test assertions observe the same spy."
    - 'Pattern: 130×130 progress ring uses RN built-in Animated (not Reanimated). The 350 ms cubic-bezier transition is achieved with Animated.timing + Easing.bezier; useNativeDriver MUST be false because SVG attribute animation cannot use the native driver. Reanimated is not in the Phase 2 capture seam — pulling it would add worklets-core for one ring.'
    - 'Pattern: vitest.setup.ts canonical react-native mock owns Animated + Easing. Adding Animated to the setup file means every screen test in the import graph (RootNativeStack → OnboardingStack → CompatRunningScreen → CompatRing) loads cleanly. Per-test mocks may still override (CompatRing.test.tsx supplies its own to control timing) but the canonical surface is the floor.'
    - "Pattern: COMPAT-06 enforced structurally on CompatRecoveryScreen. The screen has NO Next/Continue/Proceed Pressable in source; the test asserts the absence with screen.queryByText. Adding such a CTA later requires passing through COMPAT-06's grep gate (`grep -v '^[[:space:]]*//' ... | grep -c 'Next|Continue|Proceed'` → 0)."
    - 'Pattern: per-test compat-result fixture via vi.hoisted holder. Both CompatPass and CompatFail tests use a shared `compatHolder.value` cell so the useAppStore selector returns either the happy fixture (default), a low-storage variant (Test 5), or null (defensive). Mutating the holder across tests avoids re-mocking the entire store.'
    - 'Pattern: cosmetic row-walk timer + 400 ms ring-fill hold in CompatRunningScreen. The screen advances rows speculatively while runCompatCheck is in flight (~33 s) so the user sees motion; the real result overwrites the speculative state, then the screen waits 400 ms for the ring transition before nav.replace. Avoids a hard cut from 0 → 100% on resolve.'

key-files:
  created:
    - 'apps/mobile/src/services/compatService.ts (~155 LOC) — runCompatCheck + signature math + needsRerun + getStored/clearStored. Wraps the three native probes; assembles the 12-check result; persists both blobs to MMKV; returns the parsed CompatResult.'
    - 'apps/mobile/src/screens/compat/checks.ts (~85 LOC) — DISPLAY_ROWS (7 rows verbatim from design-spec §4) + rowsFromResult() collapse + DisplayRow / DisplayRowKey type exports.'
    - 'apps/mobile/src/components/CompatRing.tsx (~95 LOC) — 130×130 SVG ring with stroke-dashoffset interpolation; built-in Animated drives the 350 ms cubic-bezier transition; clamps percent to [0,100].'
    - 'apps/mobile/__tests__/services/compatService.test.ts — 8 vitest cases.'
    - 'apps/mobile/__tests__/components/CompatRing.test.tsx — 7 vitest cases + 3 committed snapshots.'
    - 'apps/mobile/__tests__/screens/CompatRunningScreen.test.tsx — 5 vitest cases.'
    - 'apps/mobile/__tests__/screens/CompatPassScreen.test.tsx — 5 vitest cases.'
    - 'apps/mobile/__tests__/screens/CompatFailScreen.test.tsx — 6 vitest cases.'
    - 'apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx — 3 vitest cases.'
    - 'apps/mobile/__tests__/components/__snapshots__/CompatRing.test.tsx.snap — 3 snapshots (percent=0/42/100).'
  modified:
    - 'apps/mobile/src/screens/compat/CompatRunningScreen.tsx — replaced 02-05 stub with the real screen body.'
    - 'apps/mobile/src/screens/compat/CompatPassScreen.tsx — replaced 02-05 stub with the real §4c body.'
    - 'apps/mobile/src/screens/compat/CompatFailScreen.tsx — replaced 02-05 stub with the real §4d body.'
    - 'apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx — replaced 02-05 stub with the real COMPAT-08 body.'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt — added sha256First16Hex sync @ReactMethod backing the compat-signature recipe (D-COMPAT-03).'
    - 'apps/mobile/vitest.setup.ts — extended the canonical react-native mock with Animated + Easing stubs.'

key-decisions:
  - "AppFlavorModule.sha256First16Hex added as a sync @ReactMethod(isBlockingSynchronousMethod = true) — the plan body assumed this method existed but 02-04 didn't ship it. Required by computeSignatureSync() inside compatService AND by RootNativeStack's gate-decision tree, both of which run at boot before any async bridge round-trip is acceptable. (Rule 3 - blocking.)"
  - "Used `import HapticFeedback from 'react-native-haptic-feedback'` instead of the plan body's `require('react-native-haptic-feedback').default` pattern. Reason: vitest cannot resolve require() against an ESM mock, so the test's spy was never invoked. The canonical setup mock already exposes a `default.trigger` shape; ESM default-import binds to the same vi.fn() so per-test assertions observe it. (Rule 1 - bug.)"
  - "DeviceCapsResult.resolutionMax is `{w, h}` not Int — honored the locked JS contract from 02-06 + 02-14 over the plan body's `caps.resolutionMax >= 1920` integer comparison. compatService computes the long-edge via Math.max(w, h) then >= 1920 for the resolution check. (Rule 1 - bug; the plan body's `caps.resolutionMax >= 1920` would be a runtime `[object Object] >= 1920` comparison that always returns false.)"
  - 'Used `@humyn/shared-types` import path, not `@humyn/types`. The plan body assumed `@humyn/types` but the workspace alias is `@humyn/shared-types` (per package.json + every existing consumer). (Rule 1 - bug.)'
  - 'Used default exports for the four compat screens (matches every existing screen stub from 02-05 + the wired OnboardingStack imports). The plan body suggested named exports but the navigator imports them as default. (Rule 1 - bug had I followed the plan literally.)'
  - 'Extended vitest.setup.ts with Animated + Easing stubs. Adding CompatRing to the dependency graph means RootNativeStack.test transitively imports Animated.createAnimatedComponent at module-init time. The setup file owns the canonical surface; per-test mocks override only when behavior differs (CompatRing.test supplies its own for snapshot determinism). (Rule 3 - blocking; the canonical mock had no Animated.)'
  - "CompatRing uses useNativeDriver: false (NOT true). SVG attribute animation cannot use the native driver — the React Native docs are explicit. The plan body had `useNativeDriver: true` which would crash with 'attempting to run JS driven animation on animated node that has been moved to native'. (Rule 1 - bug.)"
  - "Storage-warning banner read from `compat?.checks.freeStorageGB.warningOnly === true` (not `compat?.checks.freeStorageGB.warningOnly`). Triple-equals against true so an `undefined` (no compat result yet) doesn't render the banner with measuredGB.toFixed crash. Defensive."
  - 'Cosmetic row-walk + 400 ms hold in CompatRunningScreen — chose to ship the timer inside useEffect (with cancelled.current ref) rather than a state-machine library. The screen has exactly one happy path and one error path; a state-machine would add a dep for no clarity. The cancelled-ref pattern matches Phase 1 + 02-09 SignupScreen.'

patterns-established:
  - 'Pattern: signature compute is a sync function callable inside non-async paths. Use `getInstallationIdSync()` + `sha256First16Hex` after `getInstallationId()` has been awaited at least once during the session.'
  - 'Pattern: shared display-row mapping (checks.ts) consumed by both running + fail screens. Future compat-related screens (e.g. a settings re-run page) reuse rowsFromResult; design-spec changes touch one function.'
  - 'Pattern: vitest.setup.ts canonical mock grows as plans land. Added Animated + Easing in this plan; 02-05 added bottom-tabs tabBar invocation; 02-04 added @react-native-firebase/* surfaces. The pattern: when a third file in the import graph touches the same RN-ecosystem module, extend setup.ts.'
  - 'Pattern: per-test compat-result fixture via vi.hoisted holder. Reusable across CompatPass + CompatFail tests; mutate the holder rather than re-mocking the store.'

requirements-completed:
  [COMPAT-01, COMPAT-02, COMPAT-03, COMPAT-05, COMPAT-06, COMPAT-07, COMPAT-08]

# Metrics
duration: ~12min
completed: 2026-05-09
---

# Phase 2 Plan 15: Compat screens + service Summary

**Five user-facing compat surfaces (Running / Pass / Fail / Recovery + the 130×130 progress ring component) replace 02-05's stubs on top of compatService — a 3-probe orchestrator that assembles a CompatResult per D-COMPAT-05, computes the AUTH-11 signature via a new Kotlin sha256 sync method, and persists both the full blob (for FailScreen diagnostics) and the small summary (for the gate-decision tree). The Phase 2 mobile suite goes from 102 to 136 tests, all green; no Reanimated dep added at this seam; zero hex literals across compat sources.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09T17:54:37Z
- **Completed:** 2026-05-09T18:08:00Z
- **Tasks:** 5/5 (all autonomous)
- **Commits:** 5
- **Files created:** 10
- **Files modified:** 6
- **Test delta:** +34 (102 → 136); 26 / 26 test files green
- **Lines added:** ~1.55 KLOC across 5 commits

## Accomplishments

- **compatService orchestration in place (Task 1).** `runCompatCheck()` awaits `getInstallationId()` once for signature hydration, then runs `runEncoderProbe` + `runImuProbe(30000, true)` + `readDeviceCaps` serially. The 12-check assembly pulls measured values from the native probes; failedKeys is computed by walking Object.entries; the result is Zod-parsed via `CompatResultSchema.parse` (defense-in-depth — same schema as 02-03's hydrate path). MMKV writes both `compat.lastResult.v1` (full blob) and `onboarding.compatPassed.v1` (small summary) on pass; clears the summary on fail.
- **AUTH-11 signature math wired (Task 1).** `computeSignatureSync()` reads `AppFlavor.versionCode + Build.MODEL + installation_id` and pipes through the new Kotlin `sha256First16Hex` sync method. `needsRerun()` returns true when no stored result, when stored=fail, or when the freshly-computed signature differs from stored. Cross-device restore (same Google account, fresh installation_id) trips the gate cleanly.
- **CompatRing component ships (Task 2).** 130×130 SVG with stroke-dashoffset interpolated by RN built-in Animated; 350 ms cubic-bezier(.2,.8,.2,1) transition per design-spec §0.4. Clamps percent to [0,100]; renders `Math.round(clamped) + '%'` label. NO Reanimated dependency at this seam.
- **CompatRunningScreen replaces stub (Task 3).** Title + sub copy verbatim from design-spec §4a/§4b. Cosmetic 700 ms row-walk timer advances the 7-row checklist while runCompatCheck() is in flight; on resolve, real results overwrite via rowsFromResult; 400 ms hold for the ring fill, then nav.replace. On probe rejection, defensive route to CompatFail.
- **CompatPassScreen + CompatFailScreen replace stubs (Task 4).** Pass: "You're in." + "All checks passed." + 40 ms impactLight haptic + Next CTA → RigTutorial; storage-warning banner when warningOnly=true. Fail: "This phone can't record yet" + per-failed-key §4d copy with measured-value substitution + What now CTA → CompatRecovery. Both consume Text/Button/ScreenContainer primitives + tokens; zero hex literals.
- **CompatRecoveryScreen replaces stub (Task 5).** "What now" + 3 actionable bullets + Contact Support mailto with [EMAIL_ADDRESS] placeholder + pre-filled body (Phone model / What / When). NO Next/Continue/Proceed CTA — COMPAT-06 enforced structurally and asserted in test.
- **No regressions to 02-01..02-14.** All 102 prior tests still pass.

## Task Commits

1. **Task 1: compatService + checks.ts + AppFlavor.sha256First16Hex** — `ef938c2` (feat)
2. **Task 2: CompatRing component + 7 tests + 3 snapshots** — `298148c` (feat)
3. **Task 3: CompatRunningScreen + canonical Animated stub** — `cb44486` (feat)
4. **Task 4: CompatPassScreen + CompatFailScreen + 11 tests** — `0ac7cf9` (feat)
5. **Task 5: CompatRecoveryScreen + 3 tests** — `671fe4c` (feat)

## Files Created/Modified

### Created (10)

- `apps/mobile/src/services/compatService.ts` (~155 LOC)
- `apps/mobile/src/screens/compat/checks.ts` (~85 LOC)
- `apps/mobile/src/components/CompatRing.tsx` (~95 LOC)
- `apps/mobile/__tests__/services/compatService.test.ts` (8 tests)
- `apps/mobile/__tests__/components/CompatRing.test.tsx` (7 tests)
- `apps/mobile/__tests__/screens/CompatRunningScreen.test.tsx` (5 tests)
- `apps/mobile/__tests__/screens/CompatPassScreen.test.tsx` (5 tests)
- `apps/mobile/__tests__/screens/CompatFailScreen.test.tsx` (6 tests)
- `apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx` (3 tests)
- `apps/mobile/__tests__/components/__snapshots__/CompatRing.test.tsx.snap` (3 snapshots)

### Modified (6)

- `apps/mobile/src/screens/compat/CompatRunningScreen.tsx` — stub → real body
- `apps/mobile/src/screens/compat/CompatPassScreen.tsx` — stub → real body
- `apps/mobile/src/screens/compat/CompatFailScreen.tsx` — stub → real body
- `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — stub → real body
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` — added sha256First16Hex sync @ReactMethod
- `apps/mobile/vitest.setup.ts` — extended canonical react-native mock with Animated + Easing

## Decisions Made

- **AppFlavorModule.sha256First16Hex sync method added.** isBlockingSynchronousMethod=true so JS reads the value as a plain function call. Required by computeSignatureSync (called inside compatService AND by RootNativeStack at boot). The plan body assumed it existed but 02-04 didn't ship it.
- **ESM `import HapticFeedback from 'react-native-haptic-feedback'`** instead of the plan body's `require()`. Vitest cannot resolve require() against an ESM mock; ESM default-import binds to the same vi.fn() the canonical setup mock exposes.
- **DeviceCapsResult.resolutionMax is `{w, h}` not Int.** Honored the locked JS contract; compatService computes long-edge via Math.max(w, h).
- **`@humyn/shared-types` import path**, not `@humyn/types` — workspace alias.
- **Default exports** for all four compat screens — matches every other screen stub from 02-05 and the wired OnboardingStack imports.
- **vitest.setup.ts extended with Animated + Easing.** Required by the import graph (RootNativeStack → OnboardingStack → CompatRunningScreen → CompatRing).
- **`useNativeDriver: false` on the ring animation** — SVG attribute animation cannot use the native driver.
- **Cosmetic row-walk timer + 400 ms ring hold** — visual smoothness without a state-machine dep.
- **Per-test compat-result fixture via vi.hoisted holder** — mutate one cell across tests rather than re-mocking the store.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AppFlavorModule.sha256First16Hex did not exist; the plan body assumed it.**

- **Found during:** Task 1 — the plan body's compatService example invokes `NativeModules.AppFlavor.sha256First16Hex` but `git grep sha256First16Hex` returned no matches.
- **Issue:** computeSignatureSync would throw at runtime ("AppFlavor.sha256First16Hex not registered") on the very first compat run, blocking the entire flow.
- **Fix:** Added `sha256First16Hex(input: String): String` to AppFlavorModule.kt with `@ReactMethod(isBlockingSynchronousMethod = true)`. Uses java.security.MessageDigest("SHA-256"); returns the first 8 bytes (16 hex chars) lowercase. Single new dependency: `java.security.MessageDigest` (already on the JVM classpath; no Gradle change needed).
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt`.
- **Verification:** Vitest tests pin the JS-side surface via a faked `sha256Spy`; on-device verification deferred to 02-21 manual smoke.
- **Committed in:** `ef938c2` (Task 1).

**2. [Rule 1 - Bug] Plan body's `require('react-native-haptic-feedback')` would fail under vitest.**

- **Found during:** Task 4 — first run of CompatPassScreen.test.tsx Test 2 (haptic invocation).
- **Issue:** The plan body used `const Haptics = require('...').default` inside a try/catch. Vitest cannot resolve `require()` against an ESM mock factory under jsdom; the screen's code path triggered the catch silently and the spy was never invoked. The test failed with "expected to be called 1 times, but got 0 times".
- **Fix:** Switched to `import HapticFeedback from 'react-native-haptic-feedback'` at the top of the file; the canonical setup.ts mock already exposes `default.trigger` as a vi.fn(), so ESM default-import binds to the same spy the test imports.
- **Files modified:** `apps/mobile/src/screens/compat/CompatPassScreen.tsx`, `apps/mobile/__tests__/screens/CompatPassScreen.test.tsx`.
- **Verification:** Test 2 passes; the trigger spy is called exactly once with `('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false })`.
- **Committed in:** `0ac7cf9` (Task 4).

**3. [Rule 1 - Bug] Plan body's `caps.resolutionMax >= 1920` would be a no-op comparison.**

- **Found during:** Task 1 source authoring (compatService.runCompatCheck).
- **Issue:** The plan body had `resolution: caps.resolutionMax >= 1920`, but DeviceCapsResult.resolutionMax is `{w: number; h: number}` (locked by 02-06 + 02-14). Object-vs-number comparison returns false unconditionally; the `resolution` check would always fail in production even on a 1080p+ device.
- **Fix:** `const longEdge = Math.max(caps.resolutionMax.w, caps.resolutionMax.h); resolution: longEdge >= 1920`. Test fixtures use `{w: 1920, h: 1080}` (Pixel 7a typical) and pass.
- **Files modified:** `apps/mobile/src/services/compatService.ts`.
- **Verification:** compatService.test.ts Test 1 (happy path) asserts `result.passed === true` — would fail if the resolution check were broken.
- **Committed in:** `ef938c2` (Task 1).

**4. [Rule 1 - Bug] Plan body's `@humyn/types` import path is not the workspace alias.**

- **Found during:** Task 1 (and again on every subsequent screen file).
- **Issue:** The plan body uses `import type { CompatResult } from '@humyn/types'`. The actual workspace alias is `@humyn/shared-types` (per `apps/mobile/package.json` + every existing consumer including 02-03's `appStore.ts` and 02-08's `versionService.ts`). Following the plan literally would have broken the typecheck on every file.
- **Fix:** Used `@humyn/shared-types` everywhere. (No new dep; the alias was already present.)
- **Files modified:** `apps/mobile/src/services/compatService.ts`, `apps/mobile/src/screens/compat/checks.ts`, `apps/mobile/src/screens/compat/CompatFailScreen.tsx`.
- **Committed in:** `ef938c2` + `0ac7cf9`.

**5. [Rule 3 - Blocking] vitest.setup.ts canonical react-native mock had no Animated / Easing.**

- **Found during:** Task 3 — running the full mobile suite after CompatRunningScreen landed; RootNativeStack.test.tsx (transitive importer) crashed with `No "Animated" export is defined on the "react-native" mock`.
- **Issue:** CompatRing imports `Animated` + `Easing` from `react-native` at module-init time. The canonical setup mock didn't include them (Phase 2 hadn't needed them before). Test file's local mock would have worked for CompatRing.test alone but other screens transitively import the chain through OnboardingStack → CompatRunningScreen.
- **Fix:** Extended the canonical setup mock with minimal Animated (Value class, timing/spring/sequence/parallel returning `{start: () => undefined}`, createAnimatedComponent identity) + Easing (bezier/linear/inOut/out/in returning constant 0). Same pattern 02-05 used to extend the bottom-tabs mock.
- **Files modified:** `apps/mobile/vitest.setup.ts`.
- **Verification:** Full suite re-run; 23 → 26 files pass; no regressions.
- **Committed in:** `cb44486` (Task 3).

**6. [Rule 1 - Bug] Plan body's `useNativeDriver: true` for SVG attribute animation would crash at runtime.**

- **Found during:** Task 2 source authoring (CompatRing).
- **Issue:** React Native's docs are explicit: native driver doesn't support SVG attribute animation (only transform / opacity / non-layout properties). With useNativeDriver=true, the runtime throws "Style property 'strokeDashoffset' is not supported by native animated module" on first ring update.
- **Fix:** `useNativeDriver: false`. Animation runs on the JS thread; for a 350 ms one-shot transition on the boot path, this is a non-issue.
- **Files modified:** `apps/mobile/src/components/CompatRing.tsx`.
- **Committed in:** `298148c` (Task 2).

**7. [Rule 1 - Bug] Plan body's named-export screens would have broken OnboardingStack imports.**

- **Found during:** Task 3 source authoring (CompatRunningScreen).
- **Issue:** The plan body exports screens as `export function CompatRunningScreen()`. OnboardingStack.tsx (from 02-05) imports them as `import CompatRunningScreen from '../screens/compat/CompatRunningScreen'` (default). Following the plan literally would have broken every OnboardingStack registration.
- **Fix:** Used `export default function ...` for all four compat screens — matches every other 02-05 stub and the canonical convention from SignupScreen / SplashScreen / etc.
- **Files modified:** all four compat screen files.
- **Committed in:** `cb44486`, `0ac7cf9`, `671fe4c`.

**8. [Rule 2 - Missing functionality] CompatRing test needed a cleanup hook to avoid stale DOM between tests.**

- **Found during:** Task 2 — Tests 5+6 (clamping) failed with "Found multiple elements with text 0%".
- **Issue:** @testing-library/react under JSDOM doesn't auto-clean between tests; the second `render()` finds two ring instances.
- **Fix:** Added `afterEach(cleanup)`; same pattern as RigTutorialScreen.test.tsx and SignupScreen.test.tsx.
- **Files modified:** `apps/mobile/__tests__/components/CompatRing.test.tsx`.
- **Committed in:** `298148c` (Task 2).

---

**Total deviations:** 8 auto-fixed (5 Rule 1 plan-body bugs caused by drift between plan-body code-text and actual library/codebase contracts, 2 Rule 3 environment / canonical-mock blockers, 1 Rule 2 test-infra missing functionality).
**Impact on plan:** All 5 tasks landed under acceptance commands; the 8 fixes were upstream (plan-body drift + canonical-mock surface), none changed the navigator behavior or the design contracts. Future Phase 2 plans benefit from the upgraded canonical Animated/Easing surface.

## Issues Encountered

- **react-native-haptic-feedback ESM-vs-require asymmetry.** Plan-body convention drifts from runtime; documented in Decisions and the affected file's import block. Future haptic call sites in 02-19 (Profile delete confirmation) should use the same ESM default-import shape.
- **vitest fake-timers conflict with waitFor.** Initial CompatRunningScreen test used `vi.useFakeTimers()` to advance the cosmetic walk; `waitFor` polls with real timers and never advanced the fake clock, timing out at 15 s. Switched to real timers + `waitFor({timeout: 2000})` which exercises the actual 700 ms tick + 400 ms hold sequence. Total test runtime impact: +400 ms × 3 tests = ~1.2 s; acceptable.
- **Cosmetic row-walk timer interaction with quick probe resolution.** If runCompatCheck were synchronous (e.g. fully mocked to resolve on the same tick), the timer's first tick would race the resolution handler. Real probes run ~33 s; the cosmetic walk covers ~4.9 s before any real result lands, so this is theoretical. Defensive: cleanInterval is called inside the .then() handler before setRowStates, so a same-tick resolve still wins.

## Threat Flags

None — this plan does not introduce new endpoints, auth paths, file-access patterns, or schema mutations at trust boundaries that aren't already declared in the plan's `<threat_model>` block. The CompatResult MMKV write is on an existing key (`compat.lastResult.v1`, established in 02-03); the threat register's T-2.15-01 mitigation remains as documented (encrypted-at-rest MMKV; Play Integrity at sign-in is the binding upload-time check; tampered cache cannot upload non-spec recordings because the capture pipeline enforces the real spec).

The new Kotlin sha256First16Hex method runs on a string the JS side fully controls (versionCode|deviceModel|installation_id) — no untrusted input crosses the bridge, no information disclosure beyond the hash itself.

## User Setup Required

None — pure mobile-side wiring. The new sha256First16Hex Kotlin method requires no Gradle change (java.security.MessageDigest is on the standard JVM classpath); the Animated/Easing extensions to the vitest mock are test-only.

The Phase-2-level google-services.json gap (carried over from 02-01) is unrelated and remains outstanding for the eventual `:app:assembleApkRolloutDebug` operator-smoke / mobile-ci.yml `android-build` job.

## Next Phase Readiness

- **Plan 02-16 (compat signature wiring):** compatService.computeSignatureSync is ready; this plan only needs to wire it into RootNativeStack's `rootInitialRouteName()` so AUTH-11 activates at boot. The hash math is already exercised by compatService.test.ts.
- **Plan 02-17 (RigTutorial → MainTabs):** CompatPassScreen.Next button calls `navigation.replace('RigTutorial')` — the entry point is in place.
- **Plan 02-19 (Profile + HelpCenter):** The same `[EMAIL_ADDRESS]` placeholder convention is reused for HELP-03 (Help Center contact link). 02-21 manual-smoke runbook should flag both for operator follow-up at phase gate.
- **Plan 02-21 (manual smoke):** On-device walkthrough sequence:
  1. signup → permissions → compat-running. Watch the 130×130 ring fill from 0 → 100% smoothly per design-spec §0.4 (350 ms).
  2. Pass path: lands on CompatPassScreen with the 40 ms haptic on mount; tap Next → RigTutorial.
  3. Fail path (deliberately mock IMU low or test on a non-qualifying device): lands on CompatFailScreen showing 'Stable motion sensors at 100 Hz+ required (yours: <measured> Hz)'; tap What now → CompatRecoveryScreen → tap Contact Support → mailto sheet opens with `[EMAIL_ADDRESS]` placeholder.

## Self-Check: PASSED

- File `apps/mobile/src/services/compatService.ts` — FOUND
- File `apps/mobile/src/screens/compat/checks.ts` — FOUND
- File `apps/mobile/src/components/CompatRing.tsx` — FOUND
- File `apps/mobile/src/screens/compat/CompatRunningScreen.tsx` — FOUND (replaced 02-05 stub)
- File `apps/mobile/src/screens/compat/CompatPassScreen.tsx` — FOUND (replaced 02-05 stub)
- File `apps/mobile/src/screens/compat/CompatFailScreen.tsx` — FOUND (replaced 02-05 stub)
- File `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — FOUND (replaced 02-05 stub)
- File `apps/mobile/__tests__/services/compatService.test.ts` — FOUND (8 cases)
- File `apps/mobile/__tests__/components/CompatRing.test.tsx` — FOUND (7 cases)
- File `apps/mobile/__tests__/components/__snapshots__/CompatRing.test.tsx.snap` — FOUND (3 snapshots)
- File `apps/mobile/__tests__/screens/CompatRunningScreen.test.tsx` — FOUND (5 cases)
- File `apps/mobile/__tests__/screens/CompatPassScreen.test.tsx` — FOUND (5 cases)
- File `apps/mobile/__tests__/screens/CompatFailScreen.test.tsx` — FOUND (6 cases)
- File `apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx` — FOUND (3 cases)
- File `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` — MODIFIED (sha256First16Hex sync @ReactMethod present)
- File `apps/mobile/vitest.setup.ts` — MODIFIED (Animated + Easing in canonical react-native mock)
- `grep -q "export const CompatResultSchema" shared/types/src/CompatResult.ts` — succeeds
- `grep -q "export async function runCompatCheck" apps/mobile/src/services/compatService.ts` — succeeds
- `grep -q "export function needsRerun" apps/mobile/src/services/compatService.ts` — succeeds
- `grep -q "computeSignature\|sha256First16Hex" apps/mobile/src/services/compatService.ts` — succeeds
- `grep -q "compat.lastResult.v1\|COMPAT_LAST_RESULT" apps/mobile/src/services/compatService.ts` — succeeds
- `grep -q "Checking your phone" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` — succeeds
- `grep -q "Takes around 30 secs" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` — succeeds
- `grep -q "You're in." apps/mobile/src/screens/compat/CompatPassScreen.tsx` — succeeds
- `grep -q "All checks passed." apps/mobile/src/screens/compat/CompatPassScreen.tsx` — succeeds
- `grep -q "This phone can't record yet" apps/mobile/src/screens/compat/CompatFailScreen.tsx` — succeeds
- `grep -q "navigate.*CompatRecovery" apps/mobile/src/screens/compat/CompatFailScreen.tsx` — succeeds
- `grep -q "What now" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — succeeds
- `grep -q "Contact Support" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — succeeds
- `grep -q "Linking.openURL" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — succeeds
- `grep -q "EMAIL_ADDRESS" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — succeeds
- `grep -rnE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/compat/ apps/mobile/src/components/CompatRing.tsx` — returns nothing (no hex literals)
- `cd apps/mobile && npm run typecheck` — exits 0
- `cd apps/mobile && npm run test` — 26 files / 136 tests / all passing
- 02-01..02-14 contributions intact: full mobile suite green; no regressions to navigation, store, or native-bridge tests
- Commit `ef938c2` (Task 1) — FOUND in git log
- Commit `298148c` (Task 2) — FOUND in git log
- Commit `cb44486` (Task 3) — FOUND in git log
- Commit `0ac7cf9` (Task 4) — FOUND in git log
- Commit `671fe4c` (Task 5) — FOUND in git log

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
_COMPAT-01..03/05..08 all closed; AUTH-11 trigger landed via needsRerun(); 02-16 only needs to wire computeSignatureSync into the gate-decision tree._
