---
phase: 2
slug: mobile-shell-onboarding-permissions-compat-profile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> Authoritative source: `02-RESEARCH.md` § "Validation Architecture" (lines 1066–1130). The planner translates the test-map rows below into concrete `<verify>` blocks per task and commits the enriched table back here when wave assignments are finalized.

---

## Test Infrastructure

| Property                 | Value                                                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework (JS/TS)**    | Vitest 4.1.5 + JSDOM 25.0.1 (already configured in Phase 1)                                                                                                                                                                                                     |
| **Framework (Kotlin)**   | JUnit 4 + Robolectric (NEW for Phase 2; planner adds to `apps/mobile/android/app/build.gradle` testImplementation)                                                                                                                                              |
| **Mobile config file**   | `apps/mobile/vitest.config.ts` (existing) + `apps/mobile/android/app/build.gradle` (Phase 2 adds Robolectric block)                                                                                                                                             |
| **Quick run (JS/TS)**    | `cd apps/mobile && npm run test`                                                                                                                                                                                                                                |
| **Quick run (Kotlin)**   | `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest`                                                                                                                                                                                          |
| **Full suite**           | `cd apps/mobile && npm run test && cd android && ./gradlew :app:testApkRolloutDebugUnitTest && cd ../.. && cd apps/api && pnpm run test`                                                                                                                        |
| **Estimated runtime**    | ~17 s vitest · ~30 s incremental Kotlin · ~2 min cold Kotlin · backend e2e ~Phase 1 baseline                                                                                                                                                                    |
| **Manual-smoke runbook** | `02-MANUAL-SMOKE.md` (NEW; written at phase end; covers cold-start sign-up, permissions, compat happy path, compat-fail simulation, Profile edit, Help mailto, Report-a-problem, force-upgrade APK install on apkRollout, force-upgrade market:// on playStore) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/mobile && npm run test` (the ~17 s vitest unit suite). Tasks touching Kotlin also run `./gradlew :app:testApkRolloutDebugUnitTest`.
- **After every plan wave:** Run the full suite (vitest + Kotlin unit + backend Phase 1 e2e — backend re-run only when Phase 2 changes touch a contract).
- **Before `/gsd-verify-work`:** Full suite green + 02-MANUAL-SMOKE checkbox-walkthrough on a physical Pixel 7a/8a/10a + Crashlytics zero-new-issues for the apkRollout build.
- **Max feedback latency:** ≤ 30 s for the JS/TS quick run; ≤ 2 min cold for the Kotlin quick run.

---

## Per-Task Verification Map

> Populated by the planner once PLAN.md task IDs are assigned. Source rows live in `02-RESEARCH.md` § "Phase Requirements → Test Map". Every REQ-ID in the phase's Requirements list (41 IDs: AUTH-01..05/07..11, PERM-01..04, COMPAT-01..08, ONB-01/02, HOME-07/08, PROF-01..05, HELP-01..05, UPG-01..05) MUST land in this table.

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior                     | Test Type                                                                    | Automated Command | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | ----------------------------------- | ---------------------------------------------------------------------------- | ----------------- | ----------- | ---------- |
| 02-XX-XX | XX   | N    | REQ-{XX}    | T-2-XX / — | {expected secure behavior or "N/A"} | unit / unit-snapshot / unit-Kotlin / unit-Robolectric / static / manual-only | `{command}`       | ✅ / ❌ W0  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Wave 0 must land before any Phase 2 feature plan executes. Pulled verbatim from `02-RESEARCH.md` § "Wave 0 gaps":

- [ ] Add `@testing-library/react-native` (or rely on existing JSDOM + react-test-renderer host-component shim)
- [ ] Add Kotlin `testImplementation` block in `apps/mobile/android/app/build.gradle` for JUnit 4 + Robolectric
- [ ] Create `apps/mobile/android/app/src/test/resources/hevc-fixtures/` with canned bitstream samples (1-frame I-only, 3-frame IBP) for the NAL B-frame parser
- [ ] Create `apps/mobile/__tests__/` test files for each screen (Signup, Permissions, Compat[Running|Pass|Fail|Recovery], RigTutorial, ProfileScreen, HelpCenterScreen, ReportProblemSheet, ForceUpgradeScreen, LogoutModal, DeleteAccountModal)
- [ ] Create `apps/mobile/__tests__/services/` for `compatService`, `versionService`, `feedbackService`, `installationId`, `telemetryRing`, `durationFormatter`, `semver`
- [ ] Create `apps/mobile/__tests__/state/` for `appStore` + `hydrate` (MMKV mock fixtures)
- [ ] Extend `verify-merged-manifests.sh` (or equivalent CI script) to grep `AndroidManifest.xml` for required Phase 2 permission declarations (PERM-04 static check)
- [ ] Create `02-MANUAL-SMOKE.md` runbook (template + sections) — content fills in across the phase, finalized at phase gate

---

## Manual-Only Verifications

| Behavior                                                                | Requirement | Why Manual                                                                                  | Test Instructions                                                                                                                                                          |
| ----------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavioral compat-check end-to-end on physical Pixel 7a/8a/10a          | COMPAT-07   | Camera2 + SensorManager OEM behavior cannot be faithfully shadowed for sustained 100 Hz IMU | Run app on physical device → reach Compat → assert all checks pass → repeat on a downgraded device (deliberately disabled OIS-OFF support) → assert fail UI                |
| Force-upgrade APK install on apkRollout flavor                          | UPG-03      | `PackageInstaller.Session` requires a real OS install dialog                                | Install old apkRollout APK → bump backend `min_supported` → cold-start app → tap Update → verify SHA-256 + system installer dialog → install → cold-start app on new build |
| Force-upgrade market:// hand-off on playStore flavor                    | UPG-03      | `Intent.ACTION_VIEW market://details` requires real Play Store                              | Install old playStore APK → bump backend `min_supported` → cold-start → tap Update → verify Play Store opens to listing                                                    |
| Soft-banner persistence across cold start (dismissed → not shown again) | UPG-04      | MMKV TTL + dismiss key only verifiable on real cold-start cycle                             | Dismiss banner → cold-start → assert hidden → bump backend `latest` to a different version → cold-start → assert banner reappears                                          |
| Crashlytics zero-new-issues for apkRollout build                        | (gate)      | Production-only signal                                                                      | Run apkRollout build for ≥ 1 h on smoke device → check Firebase Crashlytics dashboard → assert no new fatal/non-fatal issues                                               |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in the verification commands
- [ ] Feedback latency < 30 s (JS/TS) / < 2 min cold (Kotlin)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
