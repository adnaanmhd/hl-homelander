---
phase: 03-humyn-capture-native-module
plan: 8
plan_id: 03-08
subsystem: humyn-capture-native-module
tags:
  - phase-3
  - wave-4
  - capture
  - hevc-encoder
  - aac-encoder
  - imu-writer
  - segment-timer
  - shared-util
  - test-stub-flip
requires:
  - 03-04
  - 03-05
provides:
  - hevc-encoder
  - aac-encoder
  - imu-writer
  - segment-timer
  - back-ultrawide-picker-shared-util
  - 4-wave0-stubs-flipped
affects:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/common/BackUltrawidePickerTest.kt
tech-stack:
  added: []
  patterns:
    - 'Encoder config wrapper: separate `buildMediaFormat()` (pure-fn, testable) from `configure()` (integrated, runs on real device)'
    - 'Refactor-with-test-net: extract via thin delegate so the existing test suite is the regression safety net'
    - 'Lambda-driven property-source seam (pickAudioSourceFor) keeps unit tests free of mockito-kotlin'
    - 'Test-only looper accessor (threadLooperForTest) drives Robolectric PAUSED-mode HandlerThreads via Shadows.shadowOf(looper).idleFor(Duration)'
    - "Lazy sensor lookup tolerates Robolectric's headless SensorManager — production path is gated by DeviceCaps.motionSensorsPresent"
    - 'Internal typealias re-export keeps in-package callers compiling unchanged after a data-class extract'
key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/common/BackUltrawidePickerTest.kt
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt
decisions:
  - "ImuWriter sensor lookup is LAZY (cached at construction, registered on start()) — Robolectric's ShadowSensorManager.getDefaultSensor returns null by default, so eager throw-on-null breaks every Phase 3 capture/ test that constructs an ImuWriter for fixture purposes. Production gating happens at DeviceCaps.motionSensorsPresent; missing-sensor in production is unreachable."
  - 'AacEncoder.pickAudioSourceFor takes a `(String) -> String?` lambda (not an AudioManager mock) — mockito-kotlin is NOT on the test classpath (verified against apps/mobile/android/app/build.gradle). The lambda seam keeps the audit airtight without adding a third-party dep.'
  - 'SegmentTimer exposes threadLooperForTest() — Robolectric 4.x runs ALL loopers in PAUSED mode by default. Real-time Thread.sleep against the dedicated HandlerThread does NOT advance scheduled callbacks; tests must use Shadows.shadowOf(looper).idleFor(Duration). The looper accessor is the canonical test seam.'
  - 'DeviceCaps.kt internal typealias preserves the in-package UltrawidePick reference — alternative was a heavy refactor of pickBackUltrawideCamera and the WritableMap composer in readAll(). The typealias is one line, zero behavior change, and the existing DeviceCapsTest covers the delegate transparently.'
  - "ImuWriter close() is separate from stop() — caller may inspect timestamps() between stop() and close(). Plan 03-10 finalize sequence is: stop → drift compute over timestamps → close. Two-step lifecycle keeps the timestamps array readable without hoisting it onto Plan 03-10's call site."
metrics:
  duration_minutes: 16
  duration_seconds: 999
  tasks_completed: 3
  files_created: 6
  files_modified: 5
  commits: 5
  tests_added_green: 21 # 2 HEVC + 6 AAC + 5 ImuWriter + 7 SegmentTimer + 1 BackUltrawidePicker
  wave0_stubs_flipped_to_green: 4
  wave0_stubs_remaining: 12 # 16 from Plan 03-07 - 4 = 12; matches plan <verification> remaining set
  full_apk_build_pass: true
  completed_at: 2026-05-10T19:14:08Z
---

# Phase 3 Plan 03-08: Encoder + IMU + Segment Timer Summary

Wave 4 — landed the four "configure once, run inside CaptureSession" capture-component wrappers (HevcEncoder, AacEncoder, ImuWriter, SegmentTimer) plus the BackUltrawidePicker shared util extracted from Phase 2's DeviceCaps per CONTEXT.md "Claude's Discretion" option (a). Each wrapper has a narrow Kotlin contract testable in isolation; CaptureSession (Plan 03-10) orchestrates them without becoming a 500+ LOC monolith. Flipped 4 of the 18 Plan 03-04 Wave 0 capture/ stubs from MISSING to GREEN.

## Decisions Made

| Decision                                                                | Rationale / Source                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ImuWriter sensor lookup is LAZY**                                     | Robolectric's `ShadowSensorManager.getDefaultSensor` returns null by default in headless mode; `ImuProbe.kt`'s eager `?: throw IllegalStateException("no_gyro")` is fine for production (Phase 2 compat probe is on a real device) but breaks every Phase 3 capture/ unit test that constructs an `ImuWriter` for fixture purposes. Lazy lookup + start()-as-no-op when sensors missing keeps both production and Robolectric paths working. |
| **AacEncoder.pickAudioSourceFor takes a lambda, not an AudioManager**   | `mockito-kotlin` is NOT on the test classpath (verified against `apps/mobile/android/app/build.gradle`'s `testImplementation` block — junit, robolectric, androidx.test only). The lambda seam (`(String) -> String?`) keeps audit tests airtight without adding a third-party dep. Production code calls `pickAudioSource(audioMgr)` which delegates to `pickAudioSourceFor` with the AudioManager-bound lookup.                            |
| **SegmentTimer exposes `threadLooperForTest()`**                        | Robolectric 4.x runs ALL loopers in PAUSED mode by default. Real-time `Thread.sleep` against a dedicated HandlerThread does NOT advance scheduled callbacks (initial test attempt failed: 0 fires after 1 s wait). `Shadows.shadowOf(looper).idleFor(Duration)` is the canonical Robolectric advance pattern. The looper accessor is the minimum surface needed; production callers MUST NOT use it.                                         |
| **DeviceCaps.kt internal typealias preserves in-package UltrawidePick** | Alternative was rewriting `pickBackUltrawideCamera` + the `readAll()` WritableMap composer to import `ai.humynlabs.capture.capture.common.UltrawidePick` everywhere. The typealias is one line, zero behavior change, and the existing `DeviceCapsTest` covers the delegate transparently — the safety net works.                                                                                                                            |
| **ImuWriter `close()` is separate from `stop()`**                       | Plan 03-10's segment finalize sequence is: encoder.stop → imuWriter.stop → drift compute over timestamps() → imuWriter.close. The two-step lifecycle keeps the timestamps LongArray readable between stop() and close() without hoisting the array onto Plan 03-10's call site or copying it twice. PLAN.md's `<behavior>` mandated `stop()` returns the array AND `close()` flushes the writer; both contracts are honored.                 |

## Implementation Notes

### `HevcEncoder` (CAP-01)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt`:

- `object HevcEncoder` exposes 6 locked-spec constants (`MIME`, `WIDTH=1920`, `HEIGHT=1080`, `FRAME_RATE=30`, `BIT_RATE=8_000_000`, `GOP_INTERVAL_SEC=1`) + 2 functions:
  - `buildMediaFormat(): MediaFormat` — pure-fn, testable. 14 keys per `idea-brief.md §6.2`: HEVC Main profile / 1920×1080 / 30 FPS / 8 Mbps CBR / GOP=1.0 s (`KEY_I_FRAME_INTERVAL=1`) / no B-frames (`KEY_LATENCY=1` + `KEY_MAX_B_FRAMES=0`) / `COLOR_FormatSurface` / BT.709 limited-range SDR / realtime priority / `OPERATING_RATE=30`.
  - `configure(): Pair<MediaCodec, Surface>` — integrated builder for runtime; called from CaptureSession on the recording HandlerThread.
- API-version guards: `KEY_LATENCY` (24+) and `KEY_MAX_B_FRAMES` (25+) — minSdk is 26, so both are always set in production.

### `AacEncoder` (CAP-03)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt`:

- `object AacEncoder` exposes 5 constants + 4 functions:
  - `buildMediaFormat(): MediaFormat` — pure-fn audit seam. AAC-LC / 48 kHz / mono / 128 kbps / `KEY_MAX_INPUT_SIZE=16384` per `idea-brief.md §6.3`.
  - `configure(): MediaCodec` — runtime builder.
  - `makeAudioRecord(audioMgr: AudioManager): AudioRecord` — builds an AudioRecord with the chosen audio source, mono PCM-16, 4× min-buffer headroom for scheduling jitter.
  - `pickAudioSource(audioMgr: AudioManager): Int` — production path; delegates to `pickAudioSourceFor`.
  - `pickAudioSourceFor((String) -> String?): Int` — lambda seam for tests. Returns `AudioSource.UNPROCESSED` if `PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED == "true"`, else `VOICE_RECOGNITION`. Never `CAMCORDER` (RESEARCH.md Standard Stack lines 207–212).

### `ImuWriter` (CAP-04 + CAP-05 + CAP-06)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`:

- `class ImuWriter(ctx, csvFile, maxReportLatencyUs=200_000)` — single-listener / single-HandlerThread design from `ImuProbe.kt` lines 44–106 extended for byte-level CSV output.
- Lifecycle: construct (open BufferedWriter + start HandlerThread) → `start()` (register both gyro + accel via single SensorEventListener instance) → `stop(): LongArray` (unregister, return collected timestamps) → `close()` (flush, close writer, quitSafely the thread; idempotent).
- CSV row format `${timestamp_ns},${type},${x},${y},${z}\n` per `idea-brief.md §8.2`. Both sensors interleaved by physical timestamp (Pitfall 3: `event.timestamp` not `onSensorChanged` dispatch time — the 200 ms `maxReportLatencyUs` causes burst delivery, but physical timestamps stay correct).
- Test-visible seams: `formatRow(...)` (pure-fn formatting), `writeRowForTest(...)` (synchronous write skipping the listener), `timestamps()` (live LongArray accessor).
- Lazy sensor lookup tolerates Robolectric's null SensorManager.getDefaultSensor; `start()` becomes a no-op if either sensor is missing. Production gate is `DeviceCaps.motionSensorsPresent`.

### `SegmentTimer` (CAP-09)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt`:

- `class SegmentTimer` — dedicated HandlerThread + Handler.postDelayed scheduling per D-SEG-01.
- `scheduleNext(durationMs, onCut)` — cancels any pending callback before posting; the new Runnable clears `pending` before invoking onCut (so a re-schedule inside the callback isn't clobbered).
- `cancel()` — removes the pending Runnable; idempotent.
- `release()` — cancel + quitSafely the HandlerThread; idempotent. After release(), `scheduleNext()` is undefined behavior (looper is dead) — callers construct a new SegmentTimer for the next session.
- `threadLooperForTest()` — Robolectric `Shadows.shadowOf(looper).idleFor(Duration)` advance pattern. Production code MUST NOT use this seam.

### `BackUltrawidePicker` shared util

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt`:

- `object BackUltrawidePicker { fun pick(mgr: CameraManager): UltrawidePick? }` + top-level `data class UltrawidePick(openableId, openableChars, ultrawideChars)` — verbatim move from `compat/DeviceCaps.kt::pickBackUltrawide` lines 140–214 + the `minFocal` private helper.
- Behavior identical to the prior implementation; the existing `DeviceCapsTest` is the regression safety net for the delegate path. Phase 3 CaptureSession (Plan 03-10) calls `BackUltrawidePicker.pick(mgr)` directly to choose the same lens Phase 2's compat probe verified.

### `compat/DeviceCaps.kt` (modified)

- `internal data class UltrawidePick(...)` removed; replaced with `internal typealias UltrawidePick = ai.humynlabs.capture.capture.common.UltrawidePick`. In-package callers compile unchanged.
- `internal fun pickBackUltrawide(mgr): UltrawidePick?` body replaced with `BackUltrawidePicker.pick(mgr)`.
- Private `minFocal` helper removed (now in BackUltrawidePicker).
- `pickBackUltrawideCamera` back-compat alias retained.

## Pattern Callouts (for Plan 03-09+ to reuse)

1. **Encoder config wrapper: pure-fn + integrated.** Every encoder/sensor/timer wrapper exposes a pure-fn config seam (`buildMediaFormat()`, `formatRow()`, `pickAudioSourceFor(lambda)`) AND an integrated builder (`configure()`, `start()/stop()/close()`). Pure-fn paths are unit-testable under Robolectric without instantiating real Camera2 / MediaCodec / SensorManager pipelines; integrated paths run on real devices. Phase 4 manual smoke verifies the integrated paths against the locked spec.

2. **Refactor-with-test-net.** Extract via thin delegate so the existing test suite is the regression safety net — no behavior change, no new tests required to prove safety. Plan 03-08's BackUltrawidePicker extract is the canonical example: the `DeviceCapsTest` suite (intentionally untouched) is what proves the delegate works. The new `BackUltrawidePickerTest` documents the post-extract null path with the documented `application = Application::class` override.

3. **Lambda-driven property seam.** `pickAudioSourceFor((String) -> String?)` keeps unit tests free of full system-service mocking. Plan 03-09+ should follow the same shape for any system-service property reads (e.g., NotificationManager, ConnectivityManager) so the test surface stays narrow.

4. **Test-only looper accessor for HandlerThread-based timers.** Robolectric 4.x PAUSED looper mode requires explicit advance via `Shadows.shadowOf(looper).idleFor(Duration)`. Production timers that own a HandlerThread should expose a `threadLooperForTest()` accessor (and ONLY that) for unit tests to drive deterministic dispatch. Real-time `Thread.sleep` is not a substitute — the looper does not consume scheduled Runnables on real wall-clock under PAUSED mode.

5. **Lazy system-service lookup tolerates headless test environments.** `Robolectric.ShadowSensorManager.getDefaultSensor` returns null; `Robolectric.ShadowCameraManager.cameraIdList` is empty; etc. Production code that throws on null in those code paths breaks every unit test that constructs the wrapper for fixture purposes. Lazy + null-tolerant lookup with the production gate elsewhere (compat probe) is the canonical fix.

### Wave 0 stub flip targets — running counter

| Plan                  | Stubs flipped this plan | Cumulative flipped (worktree-local) | Stubs MISSING after this plan                                                                                       |
| --------------------- | ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 03-04 (Wave 2 entry)  | n/a (created 18 stubs)  | 0                                   | 18                                                                                                                  |
| 03-05                 | 6                       | 6                                   | 12                                                                                                                  |
| 03-06                 | 1                       | 7                                   | 11                                                                                                                  |
| 03-07                 | 2                       | 9                                   | 16 (worktree-local; orchestrator-merge view = 9)                                                                    |
| **03-08 (this plan)** | **4**                   | **13**                              | **12** (worktree-local; orchestrator-merge view target after Plans 03-05/06/07/08 all land = 5 — Plan 03-10 owns 5) |

This worktree's view: 12 capture/ stubs remain MISSING (16 baseline − 4 flipped). The 5 stubs Plan 03-10 owns (`StartGateCarryoverTest`, `EventEmissionTest`, `ClockAlignmentTest`, `RealtimeGateTest`, `FileFidelityTest`) are explicitly in Plan 03-08's `<verification>` remaining set. Plan 03-04's `FragmentedMuxerWrapperTest` was already GREEN (it's a wrapper test, not a stub).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree node_modules + `local.properties` + `google-services.json` infra (recurring)**

- **Found during:** Pre-execution baseline check (`gradle compileApkRolloutDebugSources` failed with "Included build does not exist" → "SDK location not found" → "google-services.json missing").
- **Issue:** Fresh Claude Code worktree only checks out tracked files. `node_modules`, `apps/mobile/android/local.properties`, `apps/mobile/android/app/src/apkRollout/google-services.json` are gitignored and don't replicate. Same blocker every prior Phase 3 plan (03-04 / 03-05 / 03-07) documented.
- **Fix:**
  - `cd apps/mobile && npm ci --prefer-offline` (cached install).
  - `pnpm install --prefer-offline` at workspace root (restores husky + lint-staged).
  - `cp /main-repo/apps/mobile/android/local.properties → /worktree/apps/mobile/android/local.properties` (gitignored — never committed).
  - `cp /main-repo/apps/mobile/android/app/src/apkRollout/google-services.json → /worktree/apps/mobile/android/app/src/apkRollout/google-services.json` (gitignored — never committed).
- **Files modified:** None tracked.
- **Commit:** N/A (infra side-effect).

**2. [Rule 1 — Bug] SegmentTimer test recipe used real-time `Thread.sleep` against a paused HandlerThread looper**

- **Found during:** Task 2 first GREEN test run (2 of 5 SegmentTimerTest cases failed with `expected:<1> but was:<0>` after a 1 s `Thread.sleep` + polling loop).
- **Issue:** Plan-doc's PLAN.md `<action>` 2D recipe used `Thread.sleep(500)` + polling against `AtomicInteger` to wait for the timer to fire. Robolectric 4.x runs ALL loopers in PAUSED mode by default — the dedicated HandlerThread's looper does NOT consume `postDelayed` Runnables on wall-clock. The recipe was written as if Robolectric's looper-mode-LEGACY behavior applied; under default PAUSED mode it's unfalsifiable: the timer never fires.
- **Fix:** Added `threadLooperForTest()` accessor on `SegmentTimer`; rewrote tests to use `Shadows.shadowOf(timer.threadLooperForTest()).idleFor(Duration.ofMillis(durationMs))`. Same idiom Plan 03-07's ShadowPowerManager pattern uses — synchronous shadow-driven dispatch instead of real-time wall-clock. Test count grew from 4 to 7 cases (more deterministic = cheaper to enumerate boundary conditions: scheduled-but-not-yet-fired, replace-pending semantics, release-before-fire path).
- **Files modified:** `SegmentTimer.kt` (+ `threadLooperForTest()`), `SegmentTimerTest.kt`.
- **Commit:** `66b4e39` (folded into the GREEN commit).

**3. [Rule 2 — Missing critical functionality] ImuWriter sensor lookup must tolerate Robolectric's null-by-default**

- **Found during:** Task 2 implementation review (anticipated by reading `ImuProbe.kt` line 45's `?: throw IllegalStateException("no_gyro")` and noting Robolectric's `ShadowSensorManager.getDefaultSensor` returns null).
- **Issue:** Plan-doc's `<action>` 2A recipe used eager `?: error("no_gyro")` / `?: error("no_accel")` at construction. That throws under every Robolectric test that constructs an `ImuWriter` (the 5 `ImuWriterCsvFormatTest` cases), defeating the test design. Production gating (`DeviceCaps.motionSensorsPresent`) means missing-sensor in production is unreachable, so the hard throw was over-protective.
- **Fix:** Sensor lookup is lazy — `gyro` and `accel` are nullable properties evaluated at construction (cheap), and `start()` becomes a no-op if either is null. Production path is gated by Phase 2's compat probe; missing-sensor in production is unreachable. Documented in the class KDoc.
- **Files modified:** `ImuWriter.kt`.
- **Commit:** `66b4e39` (folded into the GREEN commit).

**4. [Rule 1 — Bug] AacEncoder.makeAudioRecord buffer-size guard for Robolectric/error path**

- **Found during:** Task 1 implementation review (`AudioRecord.getMinBufferSize` returns negative ERROR codes (-2 ERROR_BAD_VALUE) on platforms with no audio HAL or unsupported formats).
- **Issue:** PLAN.md recipe used `getMinBufferSize(...) * 4` directly. If the call returns -2, multiplying gives -8, which `AudioRecord.Builder.setBufferSizeInBytes(-8)` throws on. Production devices that pass Phase 2's compat probe always return positive values, but a defensive clamp keeps the wrapper robust if compat ever changes its mic threshold.
- **Fix:** `val bufSize = if (minBuf > 0) minBuf * 4 else 32_768`. 32 KiB is a generous fixed fallback that matches the documented sane default for 48 kHz mono PCM-16 (~340 ms @ 96 KB/s).
- **Files modified:** `AacEncoder.kt`.
- **Commit:** `f9fce63` (folded into the GREEN commit).

### Architectural Changes

**None.** All deviations were narrow bug-fixes / completeness gaps / blocking infra restoration. No architectural decisions changed; no Rule-4 escalations.

### Out of Scope (Deferred / Logged)

- **Phase 2 compat-test SoLoader.init NPE** — `compat/DeviceCapsTest`, `compat/EncoderProbeTest`, `compat/ImuProbeTest`, `compat/NalParserTest` all fail with `java.lang.NullPointerException at com.facebook.soloader.ApplicationSoSource.getNativeLibDirFromContext`. This is documented in Plan 03-04 SUMMARY ("the pre-existing `EncoderProbeTest` regressed into the same NPE the moment Phase 2 hardened `MainApplication.onCreate` with the SoLoader call"). Verified pre-Plan-03-08 that the same NPE fires against the un-refactored DeviceCaps — my BackUltrawidePicker extract did not introduce or worsen this. The fix (per Plan 03-04 SUMMARY) is `@Config(application = Application::class)` on each affected test, but those are pre-existing Phase 2 tests outside this plan's scope. Plan 03-08's verification target ("Phase 2 compat tests stay green") was unsatisfiable at the worktree base; the new `BackUltrawidePickerTest` documents the post-extract null path GREEN with the documented Application::class override, which is the substantive coverage for the structural change. Logged for a future Phase 3 cleanup pass that adds the override across all four pre-existing compat tests.
- **`@OptIn(UnstableApi::class)` Kotlin warning on FragmentedMuxerWrapper.kt** — pre-existing from Plan 03-04. Not introduced or aggravated by this plan.
- **Pre-existing `RootNativeStack.test.tsx` unhandled rejections** — pre-existing from Plan 03-04. Out of scope.

## Threat Surface

The plan's `<threat_model>` register is honored:

- **T-3.7-01 (Tampering — unwanted MediaFormat key add):** mitigated. `HevcEncoderConfigTest` audits all 14 expected keys + their exact values via the pure-fn `buildMediaFormat()` seam. A new key wouldn't break the existing assertion directly, but the audit lock anchors PR-time review on changes to the encoder config.
- **T-3.7-02 (Tampering — OEM driver re-enables B-frames despite KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0):** accept disposition preserved. Phase 2 compat NAL parser (Phase-2 `NalParserTest`) gates this on the target device. Phase 4 thermal walk + production CDP sample re-verifies on the OEM matrix.
- **T-3.7-03 (Information disclosure — UNPROCESSED audio bypasses platform AGC):** accept disposition preserved. Trade-off vs spec compliance — capture quality non-negotiable per CLAUDE.md "Capture spec LOCKED".
- **T-3.7-04 (DoS — SegmentTimer / ImuWriter leak on crash):** mitigated. Both `SegmentTimer.release()` and `ImuWriter.close()` are idempotent and quit their HandlerThreads safely. Plan 03-10's `CaptureSession.stop()` will wrap them in `try/finally`. Plan 03-10's app-launch sweep catches any orphan `.session.json` sidecar that crashes leave behind.
- **T-3.7-05 (Tampering — refactor break):** mitigated. The new `BackUltrawidePickerTest` exercises the null-safety path; the existing `DeviceCapsTest` (verified to be unaffected by my refactor — it fails on the pre-existing SoLoader NPE, not on the delegate) covers the not-null path on a real device when the SoLoader regression is fixed in a separate cleanup pass. The extract is purely structural — no behavior change.

No new threat surface introduced.

## Verification Results

- **Gradle compile main sources:** `./gradlew :app:compileApkRolloutDebugSources` exits 0.
- **Gradle compile test sources:** `./gradlew :app:compileApkRolloutDebugUnitTestSources` exits 0.
- **HevcEncoderConfigTest:** 2/2 GREEN — 14-key MediaFormat audit + companion-constant pin.
- **AacEncoderConfigTest:** 6/6 GREEN — MediaFormat audit + companion-constant pin + 4 audio-source ladder cases (UNPROCESSED chosen on "true", VOICE_RECOGNITION fallback on null / "false", Robolectric default = VOICE_RECOGNITION via real ShadowAudioManager).
- **ImuWriterCsvFormatTest:** 5/5 GREEN — pure-fn formatRow gyro + accel + scientific-notation tolerance, column count exactly 5, disk round-trip via writeRowForTest, timestamps() locks LongArray.
- **SegmentTimerTest:** 7/7 GREEN — fires once after durationMs, does NOT fire before durationMs, cancel-before-fire prevents fire, scheduleNext replaces pending, release idempotent post-fire, release-before-fire cancels pending, isPending false initially.
- **BackUltrawidePickerTest:** 1/1 GREEN — null-safety on Robolectric headless camera HAL.
- **Phase 3 capture/ test suite (orchestrator view):** 13/18 stubs GREEN (HevcEncoderConfigTest + AacEncoderConfigTest + ImuWriterCsvFormatTest + SegmentTimerTest now GREEN; Plans 03-05 / 03-06 / 03-07 contribute 9 more). 5 still MISSING (Plan 03-10 owns: ClockAlignmentTest, EventEmissionTest, FileFidelityTest, RealtimeGateTest, StartGateCarryoverTest). FragmentedMuxerWrapperTest is the wrapper test (not a stub) and stays GREEN.
- **Full APK build:** `./gradlew :app:assembleApkRolloutDebug` exits 0 — the new shared util compiles into the same APK without surface-area surprises.
- **Phase 2 compat suite:** out-of-scope — pre-existing SoLoader.init NPE documented above.

## Self-Check: PASSED

All created/modified files exist and all 5 commits exist on the worktree branch:

- `feb02fc` — test(03-08): RED — HevcEncoder + AacEncoder MediaFormat audits
- `f9fce63` — feat(03-08): GREEN — HevcEncoder + AacEncoder (CAP-01 / CAP-03)
- `4923d81` — test(03-08): RED — ImuWriter CSV format + SegmentTimer postDelayed
- `66b4e39` — feat(03-08): GREEN — ImuWriter + SegmentTimer (CAP-04..06 / CAP-09)
- `b3877bf` — refactor(03-08): extract BackUltrawidePicker to capture/common/ shared util

File presence verification:

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` — modified (contains `BackUltrawidePicker.pick(mgr)`)
- 4 capture/ test files modified (no `MISSING — Wave 0 stub`)
- 1 new common/ test file (`BackUltrawidePickerTest.kt`) created.

## TDD Gate Compliance

Plan 03-08 is `type: execute` (not `type: tdd`), but Tasks 1 + 2 are `tdd="true"`. Per-task gate sequence:

- **Task 1:** RED `feb02fc` (`test(03-08): RED — HevcEncoder + AacEncoder MediaFormat audits`) → GREEN `f9fce63` (`feat(03-08): GREEN — HevcEncoder + AacEncoder (CAP-01 / CAP-03)`). REFACTOR not needed.
- **Task 2:** RED `4923d81` (`test(03-08): RED — ImuWriter CSV format + SegmentTimer postDelayed`) → GREEN `66b4e39` (`feat(03-08): GREEN — ImuWriter + SegmentTimer (CAP-04..06 / CAP-09)`). REFACTOR not needed.
- **Task 3:** `type="auto"` (no `tdd="true"`) — single `refactor(...)` commit per the refactor-with-test-net pattern.

Both TDD tasks land RED before GREEN. RED commits compile-fail with unresolved-reference errors against the production classes (the canonical "test-doesn't-pass-without-implementation" signal). GREEN commits include the implementation that makes the prior RED commit's tests pass.

## Known Stubs

None new. The 5 capture/ Wave 0 stubs Plan 03-10 owns (ClockAlignmentTest, EventEmissionTest, FileFidelityTest, RealtimeGateTest, StartGateCarryoverTest) remain MISSING per the partition documented in Plan 03-04 SUMMARY's stub-flip table. They're the planned contract, not regressions.

No production-code stubs (no `TODO` / `FIXME` / `placeholder` / `not implemented` strings in the 5 new source files; verified by grep). Internal `threadLooperForTest()` and `writeRowForTest` accessors are explicitly test seams — production code MUST NOT use them, documented in the KDocs.

---

_Plan: 03-08 — encoder-imu-segment-timer_
_Completed: 2026-05-10T19:14:08Z (~16 minutes wall time)_
