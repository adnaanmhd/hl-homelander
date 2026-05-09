---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 20
subsystem: ui
tags:
  [
    force-upgrade,
    soft-banner,
    mmkv,
    package-installer,
    sha256,
    manifest-invariants,
    react-native,
    vitest,
  ]

# Dependency graph
requires:
  - phase: 02 plan 02-07
    provides: HumynUpdater Kotlin shell — downloadAndVerifyApk + launchInstaller
  - phase: 02 plan 02-08
    provides: versionService — /app/version + 6 h cache + computeUpgradeAction
  - phase: 02 plan 02-16
    provides: HomeSkeletonScreen — soft-upgrade-banner-slot mount point
  - phase: 02 plan 01-09
    provides: per-flavor manifest source-sets + verify-merged-manifests.sh
provides:
  - upgradeFlow.startUpgrade(payload) — per-flavor (apkRollout / playStore) install orchestration with SHA-256-mismatch defense-in-depth
  - ForceUpgradeScreen — UPG-03 non-dismissible block screen, hardware-back override, integrity-check copy on hash mismatch
  - SoftUpgradeBanner — UPG-04 dismissible Home banner with per-version dismiss key (auto-resets when latest advances)
  - manifests vitest fixture — D-UPG-03 source-grep gate (paired with verify-merged-manifests.sh runtime gate)
affects:
  [
    phase-02 plan-22 — wave 5 will extend verify-merged-manifests.sh with route invariants on top of this revision; phase-04 first-recording flow consumes the same upgradeFlow service from the in-app "update available" toast,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern 49: per-flavor service-level orchestration via discriminated-union narrowing (apkRollout vs playStore in startUpgrade)'
    - 'Pattern 50: defense-in-depth gate for catastrophic-event flows — Kotlin-side gate authoritative; JS side translates rejection to typed error + distinct Analytics event + structurally refuses to proceed (no launchInstaller call possible on the mismatch path)'
    - 'Pattern 51: per-version dismiss key auto-resets when the keying field advances (T-2.20-04 — soft-banner dismissal model reusable for any per-release nag-banner)'
    - "Pattern 52: vitest 'react-native' per-test mock that replicates only the host-component shapes the unit-under-test consumes — vi.importActual('react-native') trips on the real Flow-typed source (Vite can't transform `import typeof`); replicate, don't import"

key-files:
  created:
    - apps/mobile/src/services/upgradeFlow.ts
    - apps/mobile/src/components/SoftUpgradeBanner.tsx
    - apps/mobile/__tests__/services/upgradeFlow.test.ts
    - apps/mobile/__tests__/screens/ForceUpgradeScreen.test.tsx
    - apps/mobile/__tests__/components/SoftUpgradeBanner.test.tsx
    - apps/mobile/__tests__/manifests/manifests.test.ts
  modified:
    - apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
    - apps/mobile/src/util/analytics.ts
    - apps/mobile/scripts/verify-merged-manifests.sh
    - apps/mobile/vitest.setup.ts
    - apps/mobile/__tests__/navigation/RootNativeStack.test.tsx

key-decisions:
  - "Plan 02-20: ForceUpgradeScreen kept at apps/mobile/src/screens/force-upgrade/ (existing 02-08-stub path), NOT moved to src/screens/upgrade/ as the plan body suggested — RootNativeStack already imports from force-upgrade/, and the per-tasks file path swap would have forced a navigator edit that intersects with no other plan in this wave. accessibilityLabel changed from the 02-08 stub's 'ForceUpgrade screen' to 'force-upgrade-screen' (kebab-case, matches the screen-test naming convention used by HelpCenter / Compat / Permissions / Profile)."
  - 'Plan 02-20: upgradeFlow.startUpgrade emits TWO distinct Analytics events on the apkRollout failure path — upg_force_upgrade_apk_hash_mismatch (catastrophic / D-UPG-02) and upg_force_upgrade_apk_download_failed (network/disk). Both names use the upg_ prefix matching every other versionService event in EVENT_NAMES; download_failed was added to the allowlist as part of this plan.'
  - 'Plan 02-20: Per-version soft-banner dismiss key uses the existing softBannerDismissKey() helper from state/keys.ts (Phase 1 plumbing). No `new MMKV(...)` call — secureMmkv singleton from state/mmkv.ts (D-STATE-01). Tests mock @humyn/mobile/state/mmkv at the module boundary so they exercise the real softBannerDismissKey() behaviour without touching native.'
  - "Plan 02-20: vitest.setup.ts's react-native shim now exports default no-op stubs for Linking + BackHandler + Alert. Per-test files override Alert / BackHandler via a complete vi.mock factory (not vi.importActual('react-native'), which trips on Flow-typed source) when they need to spy on calls. This is reusable across any Phase 5+ screen that interacts with hardware-back or system Alerts."

patterns-established:
  - 'Pattern 49: discriminated-union dispatch in service-level upgrade flows'
  - 'Pattern 50: catastrophic-event defense-in-depth via try/catch + structural gate'
  - 'Pattern 51: per-keying-field dismiss key (auto-reset semantics)'
  - 'Pattern 52: vitest react-native per-test mock — replicate host-component shapes inline (vi.importActual fails on Flow-typed source)'

requirements-completed: [UPG-03, UPG-04]

# Metrics
duration: 8min
completed: 2026-05-09
---

# Phase 2 Plan 20: Force-Upgrade and Soft-Banner Summary

**ForceUpgradeScreen (BackHandler hardBlock + per-flavor upgrade dispatch) + SoftUpgradeBanner (per-version dismiss key) + apkRollout REQUEST_INSTALL_PACKAGES manifest invariants locked at both source-grep (vitest) and merged-manifest (CI script) layers.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-09T13:50:12Z
- **Completed:** 2026-05-09T13:58:40Z
- **Tasks:** 3
- **Files modified:** 12 (6 created + 6 modified)

## Accomplishments

- **upgradeFlow service** — single per-flavor orchestration that ForceUpgradeScreen + SoftUpgradeBanner both consume. apkRollout path: HumynUpdater.downloadAndVerifyApk → launchInstaller, with structural gate that NEVER passes a hash-mismatched APK to PackageInstaller (T-2.20-01 mitigation, defense-in-depth above the Kotlin-side hash check). playStore path: market://details?id=<applicationId> with https fallback. iosAppStore path: typed `upgrade_flavor_not_supported_phase2:<flavor>` error.
- **ForceUpgradeScreen** — replaces the 02-08 stub with the verbatim §9 / D-UPG-01 copy "Update to continue.", hardware-back interception via BackHandler (D-NAV-04), and three error-path Alerts:
  - `apk_hash_mismatch` → "Update failed (integrity check) / Try again or contact support" (D-UPG-02 catastrophic copy).
  - `apk_download_failed` → "Update failed / Check your connection and try again."
  - other → generic "Update failed" + raw message.
- **SoftUpgradeBanner** — dismissible warn-banner mounted ONLY at the top of HomeSkeletonScreen (structural — Tasks/History/Profile have no soft-upgrade slot). Per-version dismiss key (`appVersion.softBannerDismissed.{latest}`) auto-resets when `latest` advances (T-2.20-04). HomeSkeletonScreen replaced its empty marker comment with the real banner component.
- **D-UPG-03 manifest invariants locked at TWO layers**: vitest source-grep fixture (runs on every PR without Gradle) + verify-merged-manifests.sh runtime gate (Gradle merged-manifest output). Both assert apkRollout DECLARES + main DOES NOT + playStore DOES NOT (Play policy). Wave 5's plan 02-22 will extend the script with route invariants — the tail comment marks the extension point so the gate composes cleanly.
- **Catastrophic Analytics granularity** — upg_force_upgrade_apk_hash_mismatch + upg_force_upgrade_apk_download_failed (the latter newly added to EVENT_NAMES) let ops triage tampered-APK incidents distinctly from the long tail of network / disk failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: upgradeFlow service** — `0803c7e` (feat)
2. **Task 2: ForceUpgradeScreen + SoftUpgradeBanner + Home wiring** — `68113fb` (feat)
3. **Task 3: REQUEST_INSTALL_PACKAGES flavor-scoped manifest verification + CI gate extension** — `14557a1` (test)

## Files Created/Modified

- `apps/mobile/src/services/upgradeFlow.ts` — per-flavor startUpgrade(payload) + ANALYTICS_EVENTS const + isApkRolloutPayload guard.
- `apps/mobile/src/components/SoftUpgradeBanner.tsx` — UPG-04 dismissible Home banner.
- `apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx` — UPG-03 non-dismissible block screen (replaces 02-08 stub).
- `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` — wires `<SoftUpgradeBanner />` into the existing soft-upgrade-banner-slot.
- `apps/mobile/src/util/analytics.ts` — adds `upg_force_upgrade_apk_download_failed` to EVENT_NAMES allowlist.
- `apps/mobile/scripts/verify-merged-manifests.sh` — adds ACCESS_COARSE_LOCATION to REQUIRED_BASE_PERMS; tail-comment marks 02-22 extension point.
- `apps/mobile/vitest.setup.ts` — adds default no-op stubs for Linking + BackHandler + Alert in the react-native shim.
- `apps/mobile/__tests__/services/upgradeFlow.test.ts` — 7 tests: apkRollout happy / hash-mismatch (`apk_sha256_mismatch` and `HASH_MISMATCH` Kotlin codes) / download-fail / playStore market:// / market://-fallback / isApkRolloutPayload narrowing.
- `apps/mobile/__tests__/screens/ForceUpgradeScreen.test.tsx` — 8 tests: title + body + accessibilityLabel + hardBlock back-handler returns true + Update dispatches startUpgrade + apk_hash_mismatch Alert + apk_download_failed Alert + null payload Alert + analytics event.
- `apps/mobile/__tests__/components/SoftUpgradeBanner.test.tsx` — 7 tests: null trigger flag → null / null payload → null / pre-existing dismiss key → null / renders title + body / dismiss writes the per-version key + unmounts / Update dispatches startUpgrade / per-version isolation (dismiss(0.2.0) does NOT block latest=0.3.0).
- `apps/mobile/__tests__/manifests/manifests.test.ts` — 6 tests: apkRollout declares REQUEST_INSTALL_PACKAGES / main does NOT / playStore conditional / main declares CAMERA + RECORD_AUDIO + ACCESS_COARSE_LOCATION / main does NOT declare ACCESS_FINE_LOCATION / main does NOT declare POST_NOTIFICATIONS.
- `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx` — accessibilityLabel updated from `'ForceUpgrade screen'` (02-08 stub) to `'force-upgrade-screen'` (kebab-case matches the new ForceUpgradeScreen).

## Decisions Made

See key-decisions in frontmatter (4 decisions captured).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Added `upg_force_upgrade_apk_download_failed` to EVENT_NAMES allowlist**

- **Found during:** Task 1 (upgradeFlow service)
- **Issue:** Plan body emits `force_upgrade_apk_hash_mismatch` and `force_upgrade_apk_download_failed`, but the analytics module's EVENT*NAMES uses the `upg*`prefix for every versionService event. Only`upg_force_upgrade_apk_hash_mismatch`was present;`upg_force_upgrade_apk_download_failed` was absent so the event would have been dropped silently in production (the analytics module rejects unknown event names).
- **Fix:** Added `upg_force_upgrade_apk_download_failed` to EVENT*NAMES; changed both event constants in upgradeFlow.ts to the `upg*` prefix to match every other Phase 2 force-upgrade event.
- **Files modified:** apps/mobile/src/util/analytics.ts, apps/mobile/src/services/upgradeFlow.ts.
- **Verification:** Plan-criteria grep `force_upgrade_apk_hash_mismatch` still matches (substring); 7 upgradeFlow tests pass with the upg\_-prefixed events; full mobile suite 231/231.
- **Committed in:** 0803c7e (Task 1 commit).

**2. [Rule 3 — Blocking] vi.hoisted spy binding in upgradeFlow.test.ts**

- **Found during:** Task 1 (upgradeFlow tests).
- **Issue:** Plan body's test file declares `const openURLMock = vi.fn();` BEFORE `vi.mock('react-native', ...)`. vi.mock factories are hoisted above all module-level const declarations, so the closure over `openURLMock` crashed with "Cannot access 'openURLMock' before initialization" at module-eval time.
- **Fix:** Wrapped the three spies in `vi.hoisted({ ... })` per Pattern 47 (already established in 02-19's LogoutModal/DeleteAccountModal tests).
- **Files modified:** apps/mobile/**tests**/services/upgradeFlow.test.ts.
- **Verification:** All 7 tests pass.
- **Committed in:** 0803c7e (Task 1 commit).

**3. [Rule 3 — Blocking] vitest.setup.ts react-native shim missing Linking / BackHandler / Alert**

- **Found during:** Task 2 (ForceUpgradeScreen + SoftUpgradeBanner).
- **Issue:** ForceUpgradeScreen imports BackHandler + Alert from react-native; SoftUpgradeBanner indirectly references Linking via upgradeFlow. The Phase 1 shim only exports host components (View / Text / Pressable / etc.); modules importing Linking / BackHandler / Alert at module-eval would have crashed under JSDOM.
- **Fix:** Extended the global `vi.mock('react-native', ...)` factory in vitest.setup.ts with default no-op stubs (BackHandler.addEventListener returns a {remove: ()=>undefined} subscription; Alert.alert is a no-op; Linking.openURL resolves). Per-test files (ForceUpgradeScreen.test.tsx) override these via a complete per-test factory when they need to spy.
- **Files modified:** apps/mobile/vitest.setup.ts.
- **Verification:** Full mobile suite 231/231 (was 225 before Task 2 + 6 manifests = 231).
- **Committed in:** 68113fb (Task 2 commit).

**4. [Rule 1 — Bug] vi.importActual('react-native') fails to parse Flow-typed source**

- **Found during:** Task 2 (ForceUpgradeScreen test mocking strategy).
- **Issue:** First attempt at the per-test react-native mock used `vi.importActual<Record<string, unknown>>('react-native')` to spread the setup file's host-component shim. Vite's esbuild transform CAN'T parse react-native's index.js (`import typeof * as ReactNativePublicAPI from "...flow"`) — the Flow `typeof` syntax is not valid TypeScript / JS.
- **Fix:** Replaced the importActual spread with an inline replication of just the host-component shapes the unit-under-test consumes (View / Text / Pressable / SafeAreaView / ScrollView / StyleSheet / Alert / BackHandler / NativeModules / Platform). Also fixed `<T>` parsing as JSX in the .tsx test file by switching to `<T,>` (trailing comma to disambiguate).
- **Files modified:** apps/mobile/**tests**/screens/ForceUpgradeScreen.test.tsx.
- **Verification:** 8 ForceUpgradeScreen tests pass. Pattern 52 documented.
- **Committed in:** 68113fb (Task 2 commit).

**5. [Rule 1 — Bug] Stale RootNativeStack test expected old 'ForceUpgrade screen' accessibilityLabel**

- **Found during:** Task 2 (full-suite regression check after writing the new ForceUpgradeScreen).
- **Issue:** `__tests__/navigation/RootNativeStack.test.tsx` expected the 02-08 stub's PascalCase label `'ForceUpgrade screen'`, but the new screen uses the kebab-case label `'force-upgrade-screen'` (matches every other screen test in this phase: 'help-center-screen', 'compat-screen', 'permissions-screen', 'profile-screen'). Without the update, the test crashed when the new screen rendered.
- **Fix:** Updated the assertion + added a comment matching the precedent set by HelpCenterScreen at plan 02-18.
- **Files modified:** apps/mobile/**tests**/navigation/RootNativeStack.test.tsx.
- **Verification:** Full mobile suite 231/231.
- **Committed in:** 68113fb (Task 2 commit).

---

**Total deviations:** 5 auto-fixed (1 Rule 2 — missing critical analytics event allowlist entry; 3 Rule 3 — blocking infra issues: vi.hoisted, missing RN exports in setup, vi.importActual on Flow source; 1 Rule 1 — stale test asserting the 02-08 stub label).
**Impact on plan:** All five auto-fixes were necessary for the plan's tests to run AND its production paths to function correctly. No scope creep — no behavior added beyond what the plan explicitly demands.

## Issues Encountered

- Plan body referenced `apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx` but the actual stub from plan 02-08 lives at `apps/mobile/src/screens/force-upgrade/` and RootNativeStack imports from that path. Kept the existing path to avoid touching the navigator (resolved in-flight, captured as a key-decision rather than a deviation since no code-level conflict surfaced).
- Plan body's frontmatter listed `apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx` in `files_modified` but my edit was to the existing `force-upgrade/` path. Treated `files_modified` as a permission set (matches the precedent from 02-17's RootNativeStack.tsx no-op edit).

## User Setup Required

None — no external service configuration required. SHA-256 mismatch + apkRollout install requires the Phase 1 D-APK-01 signed-URL backend (already shipped); no operator action for this plan.

## Next Phase Readiness

- Wave 4 of Phase 2 advances by one plan (02-19 was the prior closure; 02-20 closes UPG-03 + UPG-04). Two plans remain in Phase 2 (02-21 manual-smoke gate + 02-22 Wave 5 CI invariants). 02-22 will extend `verify-merged-manifests.sh` with route invariants on top of this revision.
- ForceUpgradeScreen + SoftUpgradeBanner are wired but the on-device verify is the responsibility of plan 02-21 (manual-smoke runbook). Plan 02-21's smoke matrix should include: cold-start with installed=0.0.1 + min_supported=0.2.0 → ForceUpgradeScreen renders → tap Update → SHA-256 verify → installer dialog → install → re-launch on new build; cold-start with installed=0.1.0 + latest=0.2.0 → SoftUpgradeBanner renders → tap × → cold-start again → banner stays dismissed; bump latest to 0.3.0 → cold-start → banner re-appears.
- D-UPG-03 invariant is locked at both source-grep + merged-manifest layers; future Phase 4+ plans that need to add a flavor-scoped permission can copy the `apkRollout/AndroidManifest.xml` overlay pattern + extend `verify-merged-manifests.sh` REQUIRED_BASE_PERMS / FORBIDDEN_BASE_PERMS lists.
- Pattern 49–52 captured in this summary's frontmatter and ready for STATE.md decision-merge.

## Self-Check: PASSED

All claimed files and commits verified present:

- apps/mobile/src/services/upgradeFlow.ts — FOUND
- apps/mobile/src/components/SoftUpgradeBanner.tsx — FOUND
- apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx — FOUND (modified from 02-08 stub)
- apps/mobile/**tests**/services/upgradeFlow.test.ts — FOUND
- apps/mobile/**tests**/screens/ForceUpgradeScreen.test.tsx — FOUND
- apps/mobile/**tests**/components/SoftUpgradeBanner.test.tsx — FOUND
- apps/mobile/**tests**/manifests/manifests.test.ts — FOUND
- apps/mobile/scripts/verify-merged-manifests.sh — FOUND (modified, ACCESS_COARSE_LOCATION added)
- Commit 0803c7e — FOUND
- Commit 68113fb — FOUND
- Commit 14557a1 — FOUND

## TDD Gate Compliance

This plan has `type: execute` (NOT `type: tdd`); no plan-level RED/GREEN/REFACTOR gate sequence is required. Each task ships its tests inline with the implementation per the plan body's task structure. All 28 plan-targeted tests + 231/231 full-suite green at task commits.

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
