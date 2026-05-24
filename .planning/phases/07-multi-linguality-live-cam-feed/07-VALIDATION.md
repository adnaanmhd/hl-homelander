---
phase: 7
slug: multi-linguality-live-cam-feed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Distilled from `07-RESEARCH.md` §Validation Architecture; per-task rows populated by `gsd-planner` when PLAN.md files are authored.

---

## Test Infrastructure

| Property                   | Value                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **JS framework**           | Vitest 4.1.5 (installed)                                                                                                          |
| **JS config**              | `apps/mobile/vitest.config.ts`                                                                                                    |
| **JS quick (per file)**    | `cd apps/mobile && npm test -- --run path/to/test.test.ts`                                                                        |
| **JS full**                | `cd apps/mobile && npm test -- --run`                                                                                             |
| **Kotlin framework**       | Robolectric / JUnit 4 (installed — `apps/mobile/android/app/src/test/`)                                                           |
| **Kotlin quick**           | `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests ClassName`                                                    |
| **Kotlin full**            | `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest`                                                                      |
| **Backend framework**      | Vitest 4.x (`apps/api/`)                                                                                                          |
| **API full**               | `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test` (per `feedback_post_merge_test_env`) |
| **On-hardware**            | `07-MANUAL-SMOKE.md` runbook on Pixel 10a `5C161JEA304304` (Wave 4 artifact)                                                      |
| **Estimated runtime (JS)** | ~5–10 s for the new i18n suites; ~60 s full mobile suite                                                                          |

---

## Sampling Rate

- **After every task commit:** Run JS quick on the touched test file(s).
- **After every plan wave:** Full mobile JS suite + Kotlin unit suite.
- **Phase gate (before `/gsd-verify-work`):** Full mobile JS suite green + Kotlin unit suite green + `07-MANUAL-SMOKE.md` operator sign-off **YES** on Pixel 10a — the D-04 drift A/B is the BLOCKING line.
- **Max feedback latency:** ~10 s (JS quick); ~120 s (full mobile + Kotlin); ~25 min (on-hardware drift A/B walk).

---

## Per-Task Verification Map

> Populated by the `gsd-planner` agent when PLAN.md files are authored. Each plan's `<tasks>` block maps task IDs to one row here.

| Task ID           | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | File Exists | Status     |
| ----------------- | ---- | ---- | ----------- | ---------- | --------- | ----------------- | ----------- | ---------- |
| _(planner fills)_ | —    | —    | —           | —          | —         | —                 | —           | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

### Coverage Index (from `07-RESEARCH.md` §Validation Architecture)

| Req ID      | Behavior                                  | Test Type                                   | Automated Command                                                                                                | File Exists?                          |
| ----------- | ----------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| I18N-01     | 8 locales selectable                      | unit (JS)                                   | `npm test -- src/i18n/__tests__/i18n.test.ts`                                                                    | ❌ Wave 0                             |
| I18N-02     | ChooseLanguageScreen MMKV gate            | unit (JS)                                   | `npm test -- src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx`                                 | ❌ Wave 0                             |
| I18N-03     | Tokens-only ChooseLanguage design         | visual snapshot (jest-image-snapshot)       | `npm test -- src/screens/chooseLanguage/__tests__/visual.test.tsx`                                               | ❌ Wave 0                             |
| I18N-04     | Profile language row + tap-commit         | unit (JS)                                   | `npm test -- src/screens/profile/__tests__/ProfileScreen.test.tsx`                                               | partial — Phase 6 exists              |
| I18N-05     | Generator script with vernacular brief    | unit (Node)                                 | `cd tools && npx tsx --test i18n/__tests__/generate.test.ts`                                                     | ❌ Wave 0                             |
| I18N-06     | TTS per-locale fallback chain             | unit (JS) + on-hardware                     | `npm test -- src/lib/__tests__/ttsVoice.test.ts` + Pixel 10a walk                                                | partial — current `ttsVoice` exists   |
| I18N-07     | Bilingual consent renders                 | unit (JS)                                   | `npm test -- src/screens/signup/__tests__/TermsOfUseModal.test.tsx`                                              | partial — Phase 2 exists              |
| I18N-08     | API error → translated toast              | unit (JS)                                   | `npm test -- src/i18n/__tests__/errorMap.test.ts`                                                                | ❌ Wave 0                             |
| I18N-09     | `Intl.DateTimeFormat` with `latn`         | unit (JS)                                   | `npm test -- src/lib/__tests__/dates.test.ts`                                                                    | ❌ Wave 0                             |
| I18N-10     | Reverse-search map                        | unit (JS)                                   | `npm test -- src/i18n/__tests__/reverseSearch.test.ts`                                                           | ❌ Wave 0                             |
| I18N-11     | Phase 6 cosmetic gaps NOT re-opened       | manual (planner enforces in PR review)      | n/a                                                                                                              | n/a                                   |
| I18N-12     | locale_chosen / locale_changed events     | unit (JS)                                   | `npm test -- src/services/__tests__/telemetryRing.locale.test.ts`                                                | partial — `telemetryRing.test` exists |
| REC-LIVE-01 | 15-s initial preview                      | unit (JS state machine) + manual Pixel 10a  | `npm test -- src/screens/recording/__tests__/livePreview.test.tsx`                                               | ❌ Wave 0                             |
| REC-LIVE-02 | Tap-reveal 10-s rolling                   | unit (JS state machine) + manual            | same as above                                                                                                    | ❌ Wave 0                             |
| REC-LIVE-03 | Brightness wrapper drives both states     | unit (JS) — mock `HumynScreenBrightness`    | same as above                                                                                                    | ❌ Wave 0                             |
| REC-LIVE-04 | Practice + real both use preview          | unit (JS) + manual practice walk            | same as above                                                                                                    | ❌ Wave 0                             |
| REC-LIVE-05 | Drift A/B regression bound (`<50%` p99)   | on-hardware ONLY (Pixel 10a)                | `07-MANUAL-SMOKE.md` §A/B walk                                                                                   | ❌ Wave 0 (runbook)                   |
| REC-LIVE-06 | Surface-approach captured in PLAN.md      | manual (PLAN.md contains the table)         | n/a                                                                                                              | n/a                                   |
| REC-LIVE-07 | Capture-quality cancel gates UNCHANGED    | unit (Kotlin) — re-run `FinalizeWorkerTest` | `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests FinalizeWorkerTest`                          | ✅ exists                             |
| I18N-20     | Renumber sweep clean                      | shell grep gate in runbook                  | `grep -rE 'Phase 7.*(observ\|distribution\|HumynUpdater\|Bull-Board)' .planning/ CLAUDE.md \| grep -v annotated` | ❌ Wave 0 (runbook)                   |
| I18N-21     | Android only — no `apps/mobile/ios/` diff | shell grep gate                             | `git diff --stat main -- apps/mobile/ios/` (must be empty)                                                       | ❌ Wave 0 (runbook)                   |

---

## Wave 0 Requirements

Test scaffolds the planner MUST schedule before requirement-bearing tasks:

- [ ] `apps/mobile/src/i18n/__tests__/i18n.test.ts` — I18N-01
- [ ] `apps/mobile/src/i18n/__tests__/errorMap.test.ts` — I18N-08
- [ ] `apps/mobile/src/i18n/__tests__/reverseSearch.test.ts` — I18N-10
- [ ] `apps/mobile/src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx` — I18N-02
- [ ] `apps/mobile/src/screens/chooseLanguage/__tests__/visual.test.tsx` — I18N-03
- [ ] `apps/mobile/src/lib/__tests__/dates.test.ts` — I18N-09
- [ ] `apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx` — REC-LIVE-01..04
- [ ] `apps/mobile/src/services/__tests__/telemetryRing.locale.test.ts` — I18N-12
- [ ] `tools/i18n/__tests__/generate.test.ts` — I18N-05 (JSON-shape parity, no real LLM call)
- [ ] `tools/package.json` + `tools/tsconfig.json` — bootstrap for the `tools/` workspace if absent
- [ ] `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` — Wave 4 runbook (drift A/B + capture-quality re-verification + renumber grep gate + Android-only grep gate)

---

## Manual-Only Verifications

| Behavior                                             | Requirement | Why Manual                                                                                  | Test Instructions                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TTS per-locale audibility on real device             | I18N-06     | Voice availability is device/OEM dependent; emulator TTS is en-only                         | Pixel 10a: pre-install pt-BR / es / hi-IN / bn-IN / ta-IN / te-IN / mr-IN TTS voices via Settings → Languages & input → Voice → Google TTS. Trigger one cue per locale from a real recording. Confirm Crashlytics fallback is NOT logged when voice exists. |
| Live-cam preview drift A/B (D-04)                    | REC-LIVE-05 | The `imu_video_drift_{max,mean,p99}_ms` baseline is hardware-bound to Pixel 10a's ultrawide | Same-device same-day A/B: (1) 10-min record with preview OFF (control); (2) 10-min record with preview ON (treatment); (3) compute `(p99_on − p99_off) / p99_off`. BLOCK phase if delta ≥ 0.50.                                                             |
| Bilingual consent visual sanity                      | I18N-07     | Translated typography rendering varies by font fallback per device                          | Pixel 10a: open Signup in pt-BR / hi-IN / bn-IN / ta-IN. Confirm Translated paragraph on top, English at ~70% opacity below. Verify no clipping / overflow.                                                                                                 |
| Screen-by-screen translation visual sweep            | I18N-11     | All 23 screens must render correctly in each of the 8 locales                               | Pixel 10a: cycle through each locale via Profile picker. Visit every screen (onboarding 8 + main 14 + ChooseLanguage 1 = 23). Confirm no overflow / clipping / missing keys (visible `{{key}}` placeholders).                                               |
| Capture-quality cancel gates UNCHANGED (REC-LIVE-07) | REC-LIVE-07 | Re-verifies on-hardware behavior that JVM tests can't fully simulate                        | Pixel 10a: force `fps_dropped` (cover camera lens to drop fps); force `resolution_dropped` (rotate during start); force `insufficient_frames` (Stop within 1 s of Start). Confirm History shows the chip-failed visual with correct copy.                   |
| Renumber sweep clean                                 | I18N-20     | Cross-file consistency over the planning directory + CLAUDE.md                              | `grep -rE 'Phase 7.*(observ\|distribution\|HumynUpdater\|Bull-Board)' .planning/ CLAUDE.md \| grep -v 'was Phase 7 pre-2026-05-24'` — expect zero hits.                                                                                                     |
| Android-only artifact set                            | I18N-21     | Confirms iOS native module surfaces are not accidentally touched                            | `git diff --stat main -- apps/mobile/ios/` against the merge base — expect empty output.                                                                                                                                                                    |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (11 items above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s (full mobile JS + Kotlin)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
