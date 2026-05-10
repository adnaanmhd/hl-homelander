---
phase: 3
slug: humyn-capture-native-module
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-10
updated: 2026-05-10 (post-revision — per-task verification map populated)
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Robolectric 4.x for Kotlin pure-fn unit tests · Vitest 4.x for JS bridge contract tests                                                                                                                       |
| **Config file**        | `apps/mobile/android/app/build.gradle` (Robolectric block — Wave 0 installs if absent) · `apps/mobile/vitest.config.ts` (existing)                                                                            |
| **Quick run command**  | `cd apps/mobile/android && ./gradlew testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.capture.*'` (Kotlin) · `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts` (JS bridge) |
| **Full suite command** | `cd apps/mobile && npm test && cd android && ./gradlew :app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.*' --tests 'ai.humynlabs.capture.fgs.*'`                                                |
| **Estimated runtime**  | ~120 seconds (Kotlin) + ~30 seconds (JS) = ~150 s total                                                                                                                                                       |

---

## Sampling Rate

- **After every task commit:** Run quick command for the changed module's package
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 150 seconds

---

## Per-Task Verification Map

> Populated 2026-05-10 from the revised plan set (post checker issue #13). Each row maps a Wave 0 test target (or visual snapshot test) to the plan that owns it, the plan that flips it from MISSING to GREEN, and the automated command. Status reflects the plan-set state at revision time.

### Visual snapshot tests (Wave 1 — Plan 03-02)

| Test File                                                   | Plan  | Wave | Threat Ref | Behavior                                              | Test Type           | Automated Command                                                                               | File Exists | Status     |
| ----------------------------------------------------------- | ----- | ---- | ---------- | ----------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- | ----------- | ---------- |
| `__tests__/visual/SplashScreen.visual.test.tsx`             | 03-02 | 1    | T-3.2-01   | Logo asset wired + animation timings render           | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/SplashScreen.visual.test.tsx`             | ❌ W0       | ⬜ pending |
| `__tests__/visual/SignupScreen.visual.test.tsx`             | 03-02 | 1    | T-3.2-01   | Logo + value-props + CTA position baseline            | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/SignupScreen.visual.test.tsx`             | ❌ W0       | ⬜ pending |
| `__tests__/visual/PermissionsScreen.visual.test.tsx`        | 03-02 | 1    | T-3.2-01   | CTA position baseline                                 | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/PermissionsScreen.visual.test.tsx`        | ❌ W0       | ⬜ pending |
| `__tests__/visual/HomeSkeletonScreen.visual.test.tsx`       | 03-02 | 1    | T-3.2-01   | TopBar wordmark + BottomNav Lucide icons              | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/HomeSkeletonScreen.visual.test.tsx`       | ❌ W0       | ⬜ pending |
| `__tests__/visual/RigTutorialScreen.visual.test.tsx`        | 03-02 | 1    | T-3.2-01   | Rig illustration + mailto email                       | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/RigTutorialScreen.visual.test.tsx`        | ❌ W0       | ⬜ pending |
| `__tests__/visual/HelpCenterScreen.visual.test.tsx`         | 03-02 | 1    | T-3.2-02   | All 4-of-5 EMAIL_ADDRESS replaced + accordions render | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/HelpCenterScreen.visual.test.tsx`         | ❌ W0       | ⬜ pending |
| `__tests__/visual/CompatFailScreen.visual.test.tsx`         | 03-03 | 1    | T-3.3-02   | Merged Compat-fail + recovery body baseline           | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/CompatFailScreen.visual.test.tsx`         | ❌ W0       | ⬜ pending |
| `__tests__/visual/CompatPassScreen.visual.test.tsx`         | 03-03 | 1    | —          | Auto-advance success body (no CTA) baseline           | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/CompatPassScreen.visual.test.tsx`         | ❌ W0       | ⬜ pending |
| `__tests__/visual/TasksPlaceholderScreen.visual.test.tsx`   | 03-03 | 1    | —          | TopBar avatar (NOT 'U') + tab body baseline           | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/TasksPlaceholderScreen.visual.test.tsx`   | ❌ W0       | ⬜ pending |
| `__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx` | 03-03 | 1    | —          | TopBar avatar (NOT 'U') + tab body baseline           | jest-image-snapshot | `cd apps/mobile && npm test -- --run __tests__/visual/HistoryPlaceholderScreen.visual.test.tsx` | ❌ W0       | ⬜ pending |

### JS bridge contract tests (Plan 03-04 + 03-09)

| Test File                                                                        | Plan  | Wave | Threat Ref | Behavior                                                                                   | Test Type    | Automated Command                                                                       | File Exists | Status     |
| -------------------------------------------------------------------------------- | ----- | ---- | ---------- | ------------------------------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------- | ----------- | ---------- |
| `__tests__/native/HumynCapture.test.ts` (4 describe blocks)                      | 03-04 | 2    | T-3.3-01   | not-registered / registered / events / Zod cross-validation                                | Vitest jsdom | `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts`             | ❌ W0       | ⬜ pending |
| `__tests__/native/HumynCapture.test.ts` (5th describe block — full module wired) | 03-09 | 5    | T-3.9-01   | Plan 03-09 surfaces validation-only stub; Plan 03-10 lights up full path                   | Vitest jsdom | `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts`             | ❌ W0       | ⬜ pending |
| `__tests__/navigation/ForegroundRehydrate.test.tsx`                              | 03-03 | 1    | T-3.3-01   | useForegroundUserRehydrate fires fetchMe on AppState 'active' when user==null && jwt!=null | Vitest jsdom | `cd apps/mobile && npm test -- --run __tests__/navigation/ForegroundRehydrate.test.tsx` | ❌ W0       | ⬜ pending |

### Kotlin Wave 0 stubs (capture/) — 17 tests

| Test File                                  | Plan (target → GREEN) | Wave | Requirement    | Threat Ref | Behavior                                                                                                                                  | Test Type                       | Automated Command                                                                      | File Exists | Status                                        |
| ------------------------------------------ | --------------------- | ---- | -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| `capture/FragmentedMuxerWrapperTest.kt`    | 03-04                 | 2    | CAP-02         | T-3.4-01   | media3-muxer 1.10.0 + setFragmentDurationMs(30_000L) ftyp signature                                                                       | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.FragmentedMuxerWrapperTest"`    | ❌ W0       | ⬜ pending (lands GREEN in Plan 03-04 Task 1) |
| `capture/DriftCalculatorTest.kt`           | 03-05                 | 3    | CAP-08         | T-3.10-01  | Least-squares drift {max,mean,p99} + monotonic-growth nonzero-drift case                                                                  | Robolectric pure-fn             | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.DriftCalculatorTest"`           | ❌ W0       | ⬜ pending                                    |
| `capture/ImuRateObserverTest.kt`           | 03-05                 | 3    | CAP-19         | T-3.4-04   | Sliding-window-1s p1 over physical event.timestamp                                                                                        | Robolectric pure-fn             | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ImuRateObserverTest"`           | ❌ W0       | ⬜ pending                                    |
| `capture/FilenameGeneratorTest.kt`         | 03-05                 | 3    | CAP-17         | T-3.4-03   | YYYYMMDD_HHMMSS_NNN ls-derived counter + filename_seq_exhausted at NNN=999                                                                | Robolectric pure-fn             | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.FilenameGeneratorTest"`         | ❌ W0       | ⬜ pending                                    |
| `capture/UlidGeneratorTest.kt`             | 03-05                 | 3    | —              | T-3.4-04   | io.azam.ulidj wrapper: 26 chars, monotonic, Crockford alphabet                                                                            | Robolectric pure-fn             | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.UlidGeneratorTest"`             | ❌ W0       | ⬜ pending                                    |
| `capture/HashStreamerTest.kt`              | 03-05                 | 3    | CAP-15, CAP-18 | T-3.4-05   | SHA-256 of empty + abc + 1 MiB random; FileChannel read-only                                                                              | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.HashStreamerTest"`              | ❌ W0       | ⬜ pending                                    |
| `capture/SidecarManagerTest.kt`            | 03-05                 | 3    | D-FS-05        | T-3.4-01   | Round-trip + corrupt-detection (sidecar_corrupt) + null fields                                                                            | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.SidecarManagerTest"`            | ❌ W0       | ⬜ pending                                    |
| `capture/MetadataSchemaConformanceTest.kt` | 03-06                 | 3    | CAP-16         | T-3.5-02   | Composed JSON conforms to schema 1.1.0 template                                                                                           | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.MetadataSchemaConformanceTest"` | ❌ W0       | ⬜ pending                                    |
| `capture/ThermalGateTest.kt`               | 03-07                 | 3    | CAP-11, CAP-12 | T-3.6-03   | preFlight refuses on THROTTLING; subscribeMidRecord fires on SEVERE                                                                       | Robolectric (PowerManager mock) | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ThermalGateTest"`               | ❌ W0       | ⬜ pending                                    |
| `capture/HevcEncoderConfigTest.kt`         | 03-08                 | 4    | CAP-01         | —          | MediaFormat keys produce zero-B-frame Annex B (config audit; reuses hevc-fixtures)                                                        | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.HevcEncoderConfigTest"`         | ❌ W0       | ⬜ pending                                    |
| `capture/AacEncoderConfigTest.kt`          | 03-08                 | 4    | CAP-03         | —          | AAC-LC encoder MediaFormat 48 kHz mono 128 kbps                                                                                           | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.AacEncoderConfigTest"`          | ❌ W0       | ⬜ pending                                    |
| `capture/ImuWriterCsvFormatTest.kt`        | 03-08                 | 4    | CAP-04, CAP-05 | —          | CSV `timestamp_ns,sensor_type,x,y,z` + interleave                                                                                         | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ImuWriterCsvFormatTest"`        | ❌ W0       | ⬜ pending                                    |
| `capture/SegmentTimerTest.kt`              | 03-08                 | 4    | CAP-09         | T-3.7-04   | Handler.postDelayed scheduling + cancel                                                                                                   | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.SegmentTimerTest"`              | ❌ W0       | ⬜ pending                                    |
| `capture/CaptureSessionOptsBridgeTest.kt`  | 03-09                 | 5    | —              | T-3.9-01   | ReadableMap → Kotlin opts + consent_invalid + invalid_opts:$field                                                                         | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.CaptureSessionOptsBridgeTest"`  | ❌ W0       | ⬜ pending                                    |
| `capture/CaptureLaunchSweepTest.kt`        | 03-09                 | 5    | D-FS-04        | T-3.9-04   | orphan-without-sidecar deletes; orphan-with-valid-sidecar preserves; orphan-json deletes; old-practice deletes; complete-triple untouched | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.CaptureLaunchSweepTest"`        | ❌ W0       | ⬜ pending                                    |
| `capture/RealtimeGateTest.kt`              | 03-10                 | 6    | CAP-07         | T-3.10-01  | REALTIME passes; UNKNOWN throws RealtimeClockUnavailableException                                                                         | Robolectric (Mockito)           | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.RealtimeGateTest"`              | ❌ W0       | ⬜ pending                                    |
| `capture/EventEmissionTest.kt`             | 03-10                 | 6    | CAP-13         | —          | onSegmentStart/onSessionStop/onSegmentComplete payload key shape                                                                          | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.EventEmissionTest"`             | ❌ W0       | ⬜ pending                                    |
| `capture/ClockAlignmentTest.kt`            | 03-10                 | 6    | CAP-06         | T-3.10-02  | SystemClock.elapsedRealtimeNanos non-decreasing (Pattern 1 contract)                                                                      | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ClockAlignmentTest"`            | ❌ W0       | ⬜ pending                                    |
| `capture/StartGateCarryoverTest.kt`        | 03-10                 | 6    | CAP-10         | —          | Two segments with same start_gate emit byte-identical metadata.start_gate                                                                 | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.StartGateCarryoverTest"`        | ❌ W0       | ⬜ pending                                    |
| `capture/FileFidelityTest.kt`              | 03-10                 | 6    | CAP-18         | T-3.10-01  | SHA-256 invariant across simulated finalize restart + byte-for-byte read                                                                  | Robolectric                     | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.FileFidelityTest"`              | ❌ W0       | ⬜ pending                                    |

### Kotlin Wave 0 stubs (fgs/) — 1 test

| Test File                           | Plan (target → GREEN) | Wave | Requirement | Threat Ref | Behavior                                                                                                    | Test Type   | Automated Command                                                                   | File Exists | Status     |
| ----------------------------------- | --------------------- | ---- | ----------- | ---------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- | ----------- | ---------- |
| `fgs/HumynForegroundServiceTest.kt` | 03-07                 | 3    | CAP-14      | —          | FGS type bitmask matches manifest declaration (camera\|microphone\|dataSync); strict-mode @Config(sdk=[34]) | Robolectric | `./gradlew :app:testApkRolloutDebugUnitTest --tests "*.HumynForegroundServiceTest"` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] Robolectric test scaffolding under `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/{capture,fgs}/` — Plan 03-04 Tasks 2a + 2b ship 17 capture/ stubs + 1 fgs/ stub MISSING; subsequent plans flip them to GREEN.
- [x] Vitest spec files under `apps/mobile/__tests__/native/` for HumynCaptureModule TurboModule contract — Plan 03-04 Task 3 ships HumynCapture.test.ts (4 describe blocks); Plan 03-09 Task 2 extends with the 5th describe block.
- [x] Shared Kotlin fixtures: NAL parser fixtures (sample HEVC NAL units, reused from Phase 2 hevc-fixtures), IMU fixture CSV, drift fixture, hash fixture — covered by Plan 03-05 Task 1-3 + Plan 03-08 Task 1.
- [x] Confirm `androidx.media3:media3-muxer:1.10.0` Gradle pin lands in Wave 0 — Plan 03-04 Task 1.
- [x] Confirm `io.azam.ulidj:ulidj:2.0.0` Gradle pin lands in Wave 0 — Plan 03-05 Task 2 (per checker issue #15).

---

## Manual-Only Verifications

> Per CONTEXT.md D-WAVE-01: Phase 3 acceptance is module-ready + unit tests + JS bridge contract. Full 10-min E2E HEVC capture verification, drift methodology validation under live IMU, thermal cut-out timing, and 25-min battery/thermal soak are deferred to Phase 4 smoke walks. Items below are the manual-only Phase 3 acceptance behaviors.

| Behavior                                                                        | Requirement    | Why Manual                                                                                                          | Test Instructions                                                                                                                                                         |
| ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixel 7a/8a 30 s capture produces conformant fragmented MP4                     | CAP-01, CAP-02 | Requires real device + HEVC encoder; NAL-unit verification on real bytes                                            | Run `HumynCapture.start({segmentSec:30})` from dev menu; finalize; pull MP4 via `adb pull`; run `tools/nal-verify.sh out.mp4` and confirm zero B-frames + 30 s moov flush |
| Real-IMU clock alignment yields drift-residual within ±1 ms                     | CAP-04, CAP-05 | Requires live IMU stream on real Pixel hardware                                                                     | Same 30 s capture as above; inspect emitted `*_metadata.json`; confirm `imu_video_drift_max_ms` ≤ 1.0                                                                     |
| Foreground service survives screen-off, recents-swipe, and battery-saver toggle | CAP-12, CAP-13 | Lifecycle behavior cannot be Robolectric'd                                                                          | Start capture; lock screen; swipe recents; toggle battery saver; confirm capture continues + segment rolls                                                                |
| Pre-record thermal refusal toast renders and start() rejects                    | CAP-11         | Requires `PowerManager` `getCurrentThermalStatus()` ≥ THROTTLING; thermal-throttle simulator only on rooted devices | Use Pixel adb shell `cmd thermalservice override-status 3`; tap Record; confirm toast + start() rejection promise                                                         |
| Mid-record THROTTLING_SEVERE ends segment cleanly within ~2.5 s                 | CAP-12         | Same as above; live timing required                                                                                 | Begin capture; `cmd thermalservice override-status 4`; stopwatch the segment-close; confirm < 2.5 s                                                                       |
| Concurrent finalize completes within 0.5 s gap on full segment                  | CAP-08, CAP-09 | Requires real device file I/O on a 600 MB segment                                                                   | 10-min capture rolling at 30 s segments; instrument `segmentRolled` event timestamps; confirm gap stays < 500 ms                                                          |
| 25-min sustained capture without thermal cut-out, ≤8 % battery drain            | CAP-13         | Long-running real-hardware test                                                                                     | Phase 4 manual smoke walk (deferred per D-WAVE-01)                                                                                                                        |
| Wave 1 operator re-walk on Pixel 10a                                            | D-WAVE-08      | Pixel-perfect snapshots can't catch perceptual regressions ("logo still looks small in person")                     | Operator walks `03-WAVE1-SMOKE.md` end-to-end; signs `re-walked-on:` stamp                                                                                                |
| Phase 3 phase-end smoke (apkRollout module-load + JS bridge contract)           | D-WAVE-01      | Module-ready state requires real-device boot to confirm registration                                                | Operator walks `03-MANUAL-SMOKE.md` (authored by Plan 03-09); signs `Smoke-walked-on:` stamp after Plan 03-10 ships                                                       |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (per-task map populated above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (verified by inspection of plans 03-01..10)
- [x] Wave 0 covers all MISSING references (17 capture/ + 1 fgs/ stubs + 1 always-GREEN FragmentedMuxerWrapperTest + media3-muxer + ulidj Gradle pins)
- [x] No watch-mode flags
- [x] Feedback latency < 150 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
