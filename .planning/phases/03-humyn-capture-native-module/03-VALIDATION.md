---
phase: 3
slug: humyn-capture-native-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Robolectric 4.x for Kotlin pure-fn unit tests · Vitest 4.x for JS bridge contract tests                                                     |
| **Config file**        | `apps/mobile/android/app/build.gradle` (Robolectric block — Wave 0 installs if absent) · `apps/mobile/vitest.config.ts` (existing)          |
| **Quick run command**  | `cd apps/mobile/android && ./gradlew testDebugUnitTest --tests '*HumynCapture*'` (Kotlin) · `cd apps/mobile && pnpm vitest run` (JS bridge) |
| **Full suite command** | `cd apps/mobile/android && ./gradlew testDebugUnitTest && cd .. && pnpm vitest run`                                                         |
| **Estimated runtime**  | ~120 seconds (Kotlin) + ~30 seconds (JS) = ~150 s total                                                                                     |

---

## Sampling Rate

- **After every task commit:** Run quick command for the changed module's package
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 150 seconds

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md `## Validation Architecture` section. The 16 test files identified in research map 1:1 to CAP-01..CAP-19. Plans must declare each test file in their tasks' `<acceptance_criteria>` and (where the file does not yet exist) flag the dependency under Wave 0 Requirements below.

| Task ID        | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status     |
| -------------- | ---- | ---- | ----------- | ---------- | --------------- | --------- | ----------------- | ----------- | ---------- |
| TBD-by-planner | TBD  | TBD  | CAP-XX      | TBD        | TBD             | unit      | TBD               | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Robolectric test scaffolding under `apps/mobile/android/app/src/test/kotlin/ai/humynlabs/capture/` (16 test stubs from RESEARCH.md `## Validation Architecture`)
- [ ] Vitest spec files under `apps/mobile/__tests__/native-bridge/` for HumynCaptureModule TurboModule contract
- [ ] Shared Kotlin fixtures: NAL parser fixtures (sample HEVC NAL units), IMU fixture CSV, drift fixture, hash fixture
- [ ] Confirm `androidx.media3:media3-muxer:1.10.0` Gradle pin lands in Wave 0 (precondition for muxer-wrapper tests)

---

## Manual-Only Verifications

> Per CONTEXT.md D-WAVE-01: Phase 3 acceptance is module-ready + unit tests + JS bridge contract. Full 10-min E2E HEVC capture verification, drift methodology validation under live IMU, thermal cut-out timing, and 25-min battery/thermal soak are deferred to Phase 4 smoke walks. Items below are the manual-only Phase 3 acceptance behaviors.

| Behavior                                                                        | Requirement    | Why Manual                                                                                                          | Test Instructions                                                                                                                                                         |
| ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixel 7a/8a 30 s capture produces conformant fragmented MP4                     | CAP-01, CAP-02 | Requires real device + HEVC encoder; NAL-unit verification on real bytes                                            | Run `HumynCapture.start({segmentSec:30})` from dev menu; finalize; pull MP4 via `adb pull`; run `tools/nal-verify.sh out.mp4` and confirm zero B-frames + 30 s moov flush |
| Real-IMU clock alignment yields drift-residual within ±1 ms                     | CAP-04, CAP-05 | Requires live IMU stream on real Pixel hardware                                                                     | Same 30 s capture as above; inspect emitted `*_metadata.json`; confirm `imu_video_drift_max_ms` ≤ 1.0                                                                     |
| Foreground service survives screen-off, recents-swipe, and battery-saver toggle | CAP-12, CAP-13 | Lifecycle behavior cannot be Robolectric'd                                                                          | Start capture; lock screen; swipe recents; toggle battery saver; confirm capture continues + segment rolls                                                                |
| Pre-record thermal refusal toast renders and start() rejects                    | CAP-14         | Requires `PowerManager` `getCurrentThermalStatus()` ≥ THROTTLING; thermal-throttle simulator only on rooted devices | Use Pixel adb shell `cmd thermalservice override-status 3`; tap Record; confirm toast + start() rejection promise                                                         |
| Mid-record THROTTLING_SEVERE ends segment cleanly within ~2.5 s                 | CAP-14         | Same as above; live timing required                                                                                 | Begin capture; `cmd thermalservice override-status 4`; stopwatch the segment-close; confirm < 2.5 s                                                                       |
| Concurrent finalize completes within 0.5 s gap on full segment                  | CAP-08, CAP-09 | Requires real device file I/O on a 600 MB segment                                                                   | 10-min capture rolling at 30 s segments; instrument `segmentRolled` event timestamps; confirm gap stays < 500 ms                                                          |
| 25-min sustained capture without thermal cut-out, ≤8 % battery drain            | CAP-13         | Long-running real-hardware test                                                                                     | Phase 4 manual smoke walk (deferred per D-WAVE-01)                                                                                                                        |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner to populate map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (16 test stubs + media3-muxer Gradle pin)
- [ ] No watch-mode flags
- [ ] Feedback latency < 150 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
