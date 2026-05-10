---
phase: 03-humyn-capture-native-module
plan_id: 03-04
plan: 4
type: execute
wave: 2
depends_on: [03-03]
files_modified:
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapperTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/StartGateCarryoverTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/EventEmissionTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ClockAlignmentTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/RealtimeGateTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FileFidelityTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
  - apps/mobile/src/native/HumynCapture.ts
  - apps/mobile/src/native/HumynCapture.types.ts
  - apps/mobile/__tests__/native/HumynCapture.test.ts
  - shared/types/src/CaptureSessionOpts.ts
  - shared/types/src/index.ts
requirements: [CAP-02, CAP-15, CAP-18]
autonomous: true
must_haves:
  truths:
    - androidx.media3:media3-muxer:1.10.0 dependency lands in apps/mobile/android/app/build.gradle and resolves at sync time
    - FragmentedMuxerWrapper.kt wraps FragmentedMp4Muxer.Builder(WritableByteChannel).setFragmentDurationMs(30_000L) and exposes addTrack/writeSampleData/start/stop/release
    - All 17 Wave 0 Kotlin test stubs exist under apps/mobile/android/app/src/test/java/ai/humynlabs/capture/{capture,fgs}/ — each compiles and either fails-with-MISSING or passes against an interim no-op implementation
    - FragmentedMuxerWrapperTest.kt fails with a meaningful "no encoder yet" or passes against a synthetic ByteBuffer + WritableByteChannel fixture (covers CAP-02 fragmented-MP4 boot path)
    - HumynCapture.ts JS bridge declares CaptureSessionOpts + start/stop method signatures + NativeEventEmitter helpers (onSegmentStart/onSegmentComplete/onSessionStop/onThermalAbort/onError)
    - shared/types/src/CaptureSessionOpts.ts Zod schema mirrors D-API-02 exactly and is exported from shared/types/src/index.ts
    - JS bridge contract test (HumynCapture.test.ts) covers the four "rejects when missing" + "forwards args" + "propagates rejection" + "event subscribe/unsubscribe" cases
    - schema_version field on shared/types/src/CaptureSessionOpts.ts is documented as 1.1.0 (the per-segment metadata JSON bump)
  artifacts:
    - path: apps/mobile/android/app/build.gradle
      provides: androidx.media3:media3-muxer:1.10.0 dependency
      contains: androidx.media3:media3-muxer:1.10.0
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt
      provides: thin adapter around FragmentedMp4Muxer with setFragmentDurationMs(30_000L)
      contains: setFragmentDurationMs
    - path: apps/mobile/src/native/HumynCapture.ts
      provides: typed JS bridge for HumynCaptureModule (start/stop + NativeEventEmitter helpers)
      exports:
        [
          'start',
          'stop',
          'onSegmentStart',
          'onSegmentComplete',
          'onSessionStop',
          'onThermalAbort',
          'onError',
        ]
    - path: shared/types/src/CaptureSessionOpts.ts
      provides: Zod schema for start(opts) bridge map per D-API-02
      exports: ['CaptureSessionOptsSchema', 'CaptureSessionOpts']
  key_links:
    - from: apps/mobile/src/native/HumynCapture.ts
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
      via: ensure() error message references MainApplication.kt
      pattern: HumynCapture native module not registered
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt
      to: androidx.media3.muxer.FragmentedMp4Muxer
      via: import androidx.media3.muxer.FragmentedMp4Muxer
      pattern: androidx\.media3\.muxer\.FragmentedMp4Muxer
    - from: shared/types/src/index.ts
      to: shared/types/src/CaptureSessionOpts.ts
      via: export * from './CaptureSessionOpts'
      pattern: export\s+\*\s+from\s+'\./CaptureSessionOpts'
---

<objective>
Wave 2 entry — land the Gradle dependency, the muxer wrapper (the "single most important architectural call" per RESEARCH.md Pitfall 1), the 17 Wave 0 Kotlin test stubs, and the JS bridge + Zod schema scaffolding. Per CONTEXT.md, "the very first Wave 2 task is the muxer-wrapper task — encoder/audio/IMU bind on top of it." This plan ships that foundation in a single commit so all subsequent Wave 2 plans (04 onward) can write against compile-clean test scaffolds and an existing JS bridge contract.

Purpose: per RESEARCH.md `## Validation Architecture` "Wave 0 Gaps" lines 1149–1170, 17 Kotlin test files + 1 JS bridge test file MUST be created BEFORE any production code lands so the Nyquist sampling rate (per-task <30 s feedback) holds for every subsequent plan. CAP-02 (fragmented MP4 with periodic moov flush) is the project-killer pitfall — landing the muxer wrapper here, with its own dedicated test, de-risks all downstream encoder/audio/IMU work.

Output: 1 new Gradle dep, 1 new Kotlin file (FragmentedMuxerWrapper.kt), 17 Kotlin test stubs, 2 new JS files (HumynCapture.ts + .types.ts), 1 new Vitest spec, 1 new Zod schema with index.ts re-export.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/03-humyn-capture-native-module/03-RESEARCH.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md
@.planning/phases/03-humyn-capture-native-module/03-VALIDATION.md
@apps/mobile/src/native/HumynCompat.ts
@apps/mobile/__tests__/native/HumynCompat.test.ts
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt
@apps/mobile/android/app/build.gradle
@video_metadata.json
@shared/types/src/CompatResult.ts

<interfaces>
<!-- D-API-02 contract (verbatim from CONTEXT.md). Zod schema must match this exactly. Native module reads via fromBridge(ReadableMap). -->

```ts
type CaptureSessionOpts = {
  taskId: string;
  taskName: string;
  taskCategory: string;
  taskSetting: 'indoor' | 'outdoor';
  contributor: {
    name: string;
    email: string;
    age: number | null;
    gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
    consent: true;
  };
  isPractice: boolean;
  startGate: {
    type: 'hand_detection';
    passed: boolean;
    skipped: boolean;
    bypassed: boolean;
    durationMs: number;
    consecutiveHitsRequired: number;
    platformCadenceMs: number;
  };
  location: string | null; // coarse, JS pre-resolves
  appVersion: string; // BuildConfig.VERSION_NAME
  dfovDegrees: number; // JS pre-resolves from compat.lastResult.v1
};
```

<!-- D-API-03 event payload contracts (verbatim from CONTEXT.md). NativeEventEmitter helpers in HumynCapture.ts must match these. -->

```ts
onSegmentStart: { segmentId, recordingId, startedAt: string, filenameBase: string };
onSegmentComplete: { segmentId, recordingId, mp4Path, csvPath, jsonPath, durationMs,
                     drift: { max: number, mean: number, p99: number },
                     imuMinRateHzObservedP1: number };
onSessionStop: { sessionId, segmentsCompleted: number };
onThermalAbort: { segmentId, currentStatus: string };
onError: { code: string, message: string, recoverable: boolean, segmentId?: string };
```

<!-- HumynCompat.ts is the canonical Phase-2 JS-side native-module pattern that HumynCapture.ts mirrors structurally. -->

From apps/mobile/src/native/HumynCompat.ts (the ensure() pattern):

```typescript
function ensure(): HumynCompatNativeModule {
  const native = NativeModules.HumynCompat as HumynCompatNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynCompat native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}
```

<!-- FragmentedMp4Muxer Builder API per RESEARCH.md Pitfall 1 lines 542–561 + GitHub source verification. -->

```kotlin
import androidx.media3.muxer.FragmentedMp4Muxer
import java.io.FileOutputStream
import java.nio.channels.WritableByteChannel

val ch: WritableByteChannel = FileOutputStream(mp4File).channel
val muxer = FragmentedMp4Muxer.Builder(ch).setFragmentDurationMs(30_000L).build()
// addTrack(MediaFormat) → trackId
// writeSampleData(trackId, ByteBuffer, BufferInfo) — note: muxer-specific BufferInfo, NOT MediaCodec.BufferInfo
// stop() / close()
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Pre-flight — confirm Wave 1 acceptance gate (D-WAVE-08 operator re-walk)</name>
  <files>.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md</files>
  <read_first>
    - .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md (authored by Plan 03-03 Task 4C; operator fills the re-walked-on stamp)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-08 — Wave 2 acceptance gate steps; operator on-device re-walk required)
  </read_first>
  <action>
    Verify `.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` exists AND contains a populated `re-walked-on: 2026-MM-DD` stamp filled in by the operator. If either condition is missing:

      1. Abort this plan immediately.
      2. Surface a blocking message to the user: "Wave 2 entry blocked — operator re-walk on Pixel 10a per D-WAVE-08 has not signed off. The 03-WAVE1-SMOKE.md runbook (authored by Plan 03-03 Task 4C) is missing or unstamped. Run the smoke walk on a Pixel 10a-class device, fill the `re-walked-on:` line, then re-run this plan."
      3. Do NOT begin Task 1.

    Per CONTEXT.md D-WAVE-08, Wave 2 (HumynCapture native module) MUST NOT start until ALL of:
      a. Plans 03-01 + 03-02 + 03-03 executor `done` commits landed (verify-work passed).
      b. Operator re-walks the 10-step Pixel 10a runbook in 03-WAVE1-SMOKE.md.
      c. Operator signs off in 03-WAVE1-SMOKE.md with the `re-walked-on: 2026-MM-DD` stamp.

    This pre-flight task makes the gate visible to the executor — without it, the gate is buried in CONTEXT.md and easy to skip.

    No code changes ship in this task. The verify command IS the gate.

  </action>
  <verify>
    <automated>test -f /Users/adnaan/Documents/hl-homelander/.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md && grep -E '^re-walked-on:[[:space:]]+2026-[0-9]{2}-[0-9]{2}' /Users/adnaan/Documents/hl-homelander/.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` exists
    - `grep -E '^re-walked-on:[[:space:]]+2026-[0-9]{2}-[0-9]{2}' .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` returns at least one match (operator-filled stamp)
  </acceptance_criteria>
  <done>Wave 1 operator re-walk confirmed; Wave 2 entry unblocked. Task 1 may now proceed.</done>
</task>

<task type="auto">
  <name>Task 1: Add androidx.media3:media3-muxer:1.10.0 Gradle dep + create FragmentedMuxerWrapper.kt</name>
  <files>apps/mobile/android/app/build.gradle, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapperTest.kt</files>
  <read_first>
    - apps/mobile/android/app/build.gradle (current dependencies block; check existing implementation entries to know the formatting style)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt (lines 162–182 — the encoder→muxer pump pattern HumynCapture inherits; see how MediaCodec.BufferInfo flows into MediaMuxer.writeSampleData and verify the same type translates to androidx.media3.muxer.BufferInfo)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt (Robolectric @Config + temp-file fixture pattern)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Pitfall 1 lines 542–561 + Code Example 8 for FileChannel pattern + State of the Art line 1033 for media3 1.6.0+ BufferInfo move)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("FragmentedMuxerWrapper.kt" section)
  </read_first>
  <action>
    **1A — Verify Maven Central pin:** before editing build.gradle, run:

      ```bash
      curl -s "https://maven.google.com/androidx/media3/media3-muxer/maven-metadata.xml" | grep -E "<latest>|<release>"
      ```

    Expected: `<latest>1.10.0</latest>` or `<release>1.10.0</release>`. If a newer 1.10.x or 1.11.x has shipped between RESEARCH.md (2026-05-10) and the executor's pull date, prefer the latest patch within the same minor (1.10.x). Document the resolved version in the SUMMARY.md.

    **1B — Update Gradle:** add the dependency to `apps/mobile/android/app/build.gradle` `dependencies` block. Insert near the existing `implementation` lines (preserve the file's existing ordering convention):

      ```groovy
      implementation 'androidx.media3:media3-muxer:1.10.0'
      ```

    Run `cd apps/mobile/android && ./gradlew :app:dependencies --configuration apkRolloutDebugRuntimeClasspath` (or whichever existing flavor is closest to apkRollout) and confirm `androidx.media3:media3-muxer:1.10.0` appears in the resolved tree.

    **1C — Create `FragmentedMuxerWrapper.kt`:**

      ```kotlin
      package ai.humynlabs.capture.capture

      import android.media.MediaCodec
      import android.media.MediaFormat
      import androidx.media3.muxer.BufferInfo as MuxerBufferInfo
      import androidx.media3.muxer.FragmentedMp4Muxer
      import androidx.media3.muxer.Muxer
      import java.io.File
      import java.io.FileOutputStream
      import java.nio.ByteBuffer

      /**
       * Phase 3 — fragmented MP4 muxer wrapper.
       *
       * RESEARCH.md Pitfall 1: stock `android.media.MediaMuxer` does NOT support
       * fragmented MP4. CAP-02 ("periodic moov flush every 30 s") requires
       * `androidx.media3.muxer.FragmentedMp4Muxer` with
       * `setFragmentDurationMs(30_000L)`.
       *
       * The wrapper exposes a `MediaMuxer`-shaped surface to keep the
       * encoder→muxer pump loop in `EncoderProbe.kt` (lines 162–182, Phase 2)
       * structurally identical for Phase 3.
       *
       * Internal: translates `MediaCodec.BufferInfo` →
       * `androidx.media3.muxer.BufferInfo` per State of the Art line 1033
       * (Media3 1.6.0+ moved `BufferInfo` into the muxer module).
       */
      class FragmentedMuxerWrapper private constructor(
          private val muxer: Muxer,
          private val output: FileOutputStream,
      ) {
          fun addTrack(format: MediaFormat): Int = muxer.addTrack(format)

          fun writeSampleData(trackId: Int, buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
              val muxerInfo = MuxerBufferInfo(
                  /* presentationTimeUs = */ info.presentationTimeUs,
                  /* size = */ info.size,
                  /* offset = */ info.offset,
                  /* flags = */ info.flags,
              )
              muxer.writeSampleData(trackId, buffer, muxerInfo)
          }

          fun close() {
              try { muxer.close() } finally { output.close() }
          }

          companion object {
              private const val FRAGMENT_DURATION_MS_30S = 30_000L

              /**
               * Constructs a fragmented MP4 muxer with 30 s moof intervals.
               * @param mp4File output file (created if absent; truncated if exists)
               */
              fun create(mp4File: File): FragmentedMuxerWrapper {
                  val out = FileOutputStream(mp4File)
                  val muxer = FragmentedMp4Muxer.Builder(out.channel)
                      .setFragmentDurationMs(FRAGMENT_DURATION_MS_30S)
                      .build()
                  return FragmentedMuxerWrapper(muxer, out)
              }
          }
      }
      ```

    Note: the exact `MuxerBufferInfo` constructor signature may have shifted between Media3 1.6 and 1.10 — if `MuxerBufferInfo(...)` does not compile against `1.10.0`, check `androidx.media3.muxer.BufferInfo`'s API in the resolved jar (`./gradlew :app:dependencies` to find it under `~/.gradle/caches/modules-2/`), and adjust to the actual constructor.

    **1D — Create `FragmentedMuxerWrapperTest.kt`:** Robolectric test that:
      1. Creates a temp `.mp4` file in `RuntimeEnvironment.getApplication().cacheDir`.
      2. Calls `FragmentedMuxerWrapper.create(tempFile)`.
      3. Adds a synthetic HEVC track (use `MediaFormat.createVideoFormat("video/hevc", 1920, 1080)`).
      4. Writes 90 sample buffers (3 s @ 30 fps) of small synthetic ByteBuffer payload, with `presentationTimeUs` advancing by 33333 µs.
      5. Calls `close()`.
      6. Asserts the output file exists, is non-zero size, AND its first 8 bytes start with the ISO-BMFF signature `ftyp` (read via `FileInputStream`).
      7. Marks B-frame moof flush verification (RESEARCH.md A1 assumption) as deferred — the 30 s flush is not exercised by a 3 s fixture, but the wrapper compile-clean and the ftyp signature confirms the integration.

    The test is intentionally narrow — it confirms the muxer wrapper is wired and the dependency resolves. Full fragmented-MP4 verification (parse `moof` boxes via `mp4parser` after a 60 s recording) lives in Phase 4 manual smoke per CONTEXT.md D-WAVE-01.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.FragmentedMuxerWrapperTest" 2>&1 | tail -30 && grep -q "androidx.media3:media3-muxer:1.10.0" /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/build.gradle</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "androidx.media3:media3-muxer:1.10.0" apps/mobile/android/app/build.gradle` matches (the dependency line is present)
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt` exists
    - `grep -q "setFragmentDurationMs(30_000L)" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt` matches OR the wrapper exposes the constant `FRAGMENT_DURATION_MS_30S = 30_000L` (verify with grep on either token)
    - `grep -q "import androidx.media3.muxer.FragmentedMp4Muxer" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt` matches
    - `grep -q "MediaCodec.BufferInfo" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt` matches (the translation surface)
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.FragmentedMuxerWrapperTest"` exits 0
    - The compile pass `./gradlew :app:compileApkRolloutDebugSources` exits 0 (the new dep resolves and the wrapper compiles)
  </acceptance_criteria>
  <done>media3-muxer dependency lands; FragmentedMuxerWrapper compiles + passes its narrow unit test.</done>
</task>

<task type="auto">
  <name>Task 2a: Author 17 capture/ Wave 0 Kotlin test stubs (CAP-01..CAP-19 coverage minus FGS)</name>
  <files>apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/StartGateCarryoverTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/EventEmissionTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ClockAlignmentTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/RealtimeGateTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FileFidelityTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt (pure-fn test pattern over synthetic timestamps — the canonical Robolectric pattern Phase 3 mirrors)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt (file-fixture + @Config(sdk = [33]) pattern)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/NalParserTest.kt (config-audit + hevc-fixtures pattern)
    - .planning/phases/03-humyn-capture-native-module/03-VALIDATION.md (Wave 0 Requirements list — 17 stubs in capture/ + 1 stub in fgs/)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (## Validation Architecture lines 1117–1167; ## Code Examples lines 670–1027 — algorithms the tests will eventually exercise)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md (Pattern D — Robolectric + pure-fn test seam)
    - apps/mobile/android/app/src/test/resources/hevc-fixtures/ (existing fixtures `ibp.h265`, `i-only.h265` — reusable for HevcEncoderConfigTest)
  </read_first>
  <action>
    Author **17 test files** under `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/`. Each stub:

      1. Lives at `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/{ClassName}.kt`.
      2. Uses `@RunWith(RobolectricTestRunner::class)` + `@Config(sdk = [33])`.
      3. Compiles cleanly against an interim no-op test body.
      4. Body shape: ONE `@Test fun \`{requirement} stub fails until {ClassName} ships\`()` that calls `org.junit.Assert.fail("MISSING — Wave 0 stub. Implementation lands in plan {plan_id}.")` to match the Nyquist guidance from `<deep_work_rules>`.

    The 17 capture/ tests:

| Test                            | Tests                                                                                      | Will Be Implemented In |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- |
| `DriftCalculatorTest`           | CAP-08 — drift `{max, mean, p99}` from synthetic timestamp arrays                          | Plan 03-05             |
| `ImuRateObserverTest`           | CAP-19 — sliding-window-1s p1 over inter-sample intervals                                  | Plan 03-05             |
| `FilenameGeneratorTest`         | CAP-17 — YYYYMMDD_HHMMSS_NNN + per-day NNN counter + ls-derived recovery                   | Plan 03-05             |
| `UlidGeneratorTest`             | ULID format + monotonicity (no specific CAP — internal primitive)                          | Plan 03-05             |
| `HashStreamerTest`              | CAP-15 — SHA-256 of fixed test fixtures matches expected hex                               | Plan 03-05             |
| `SidecarManagerTest`            | D-FS-05 — `.session.json` round-trip + corrupt-detection                                   | Plan 03-05             |
| `MetadataSchemaConformanceTest` | CAP-16 — metadata JSON conforms to schema 1.1.0                                            | Plan 03-06             |
| `SegmentTimerTest`              | CAP-09 — Handler.postDelayed scheduling for 10-min auto-cut                                | Plan 03-08             |
| `ThermalGateTest`               | CAP-11/CAP-12 — pre-flight refuse + mid-record listener                                    | Plan 03-07             |
| `HevcEncoderConfigTest`         | CAP-01 — MediaFormat keys produce zero-B-frame Annex B (config audit; reuse hevc-fixtures) | Plan 03-08             |
| `AacEncoderConfigTest`          | CAP-03 — AAC-LC encoder MediaFormat 48 kHz mono 128 kbps                                   | Plan 03-08             |
| `ImuWriterCsvFormatTest`        | CAP-04, CAP-05 — CSV column format + sensor interleave                                     | Plan 03-08             |
| `StartGateCarryoverTest`        | CAP-10 — start_gate carries forward across segments via sidecar                            | Plan 03-10             |
| `EventEmissionTest`             | CAP-13 — onSessionStart / onSessionStop event emission                                     | Plan 03-10             |
| `ClockAlignmentTest`            | CAP-06 — single-clock domain across video / audio / IMU                                    | Plan 03-10             |
| `RealtimeGateTest`              | CAP-07 — REALTIME timestamp source check refuses non-REALTIME devices                      | Plan 03-10             |
| `FileFidelityTest`              | CAP-18 — files never re-encoded; SHA invariance through finalize restart                   | Plan 03-10             |

    Concrete stub template (substitute `{ClassName}` and `{Requirement}`):

      ```kotlin
      package ai.humynlabs.capture.capture

      import org.junit.Assert.fail
      import org.junit.Test
      import org.junit.runner.RunWith
      import org.robolectric.RobolectricTestRunner
      import org.robolectric.annotation.Config

      @RunWith(RobolectricTestRunner::class)
      @Config(sdk = [33])
      class {ClassName} {
          @Test
          fun `{Requirement} stub fails until {ClassName.removeSuffix("Test")} ships`() {
              fail("MISSING — Wave 0 stub. Implementation lands in plan {plan_id}.")
          }
      }
      ```

    For `HevcEncoderConfigTest` and `AacEncoderConfigTest`, optionally include a comment referencing the existing `hevc-fixtures/` directory:

      ```kotlin
      // Reuses apps/mobile/android/app/src/test/resources/hevc-fixtures/{ibp.h265, i-only.h265}.
      ```

    Each stub MUST be on its own commit-line so the executor in Plan 03-05+ can flip a single test from MISSING to GREEN per task. Do NOT attempt to implement any stub here — that's the failure mode the Nyquist rule is designed to prevent.

    Run the capture/ test suite to confirm:
      - All 17 stubs compile.
      - All 17 stubs FAIL with `MISSING — Wave 0 stub`.

      ```bash
      cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.*"
      ```

    Expected: `BUILD FAILED` with exactly 17 MISSING failures (FragmentedMuxerWrapperTest from Task 1 passes; the rest fail with MISSING).

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:compileApkRolloutDebugUnitTestSources 2>&1 | tail -10 && test "$(find /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture -name '*Test.kt' | wc -l)" = "18"</automated>
  </verify>
  <acceptance_criteria>
    - `find apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture -name '*Test.kt' | wc -l` returns exactly `18` (17 new MISSING stubs + 1 FragmentedMuxerWrapperTest from Task 1)
    - The 17 new stubs all contain `MISSING — Wave 0 stub`: `grep -lE "MISSING — Wave 0 stub" apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/*.kt | wc -l` returns exactly `17`
    - `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugUnitTestSources` exits 0 (all stubs compile)
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.*" 2>&1 | grep -c "MISSING — Wave 0 stub"` returns at least 17
  </acceptance_criteria>
  <done>17 capture/ Kotlin test stubs compile-clean and fail meaningfully with MISSING. Each downstream Wave 2 plan flips its target stubs from MISSING to GREEN.</done>
</task>

<task type="auto">
  <name>Task 2b: Author the 1 fgs/ Wave 0 Kotlin test stub (HumynForegroundServiceTest with @Config(sdk = [34]))</name>
  <files>apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt (Robolectric @Config + temp-file pattern)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (line 812 — Android 14 FGS strict-mode is API 34; @Config(sdk = [34]) required for the strict-bitmask invariant)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("HumynForegroundService.kt" + Pattern D Robolectric)
  </read_first>
  <action>
    Author **1 test file** at `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt`.

    Same structure as Task 2a, with two changes:

      - `package ai.humynlabs.capture.fgs` (NOT `ai.humynlabs.capture.capture`).
      - `@Config(sdk = [34])` (Android 14 FGS strict-mode).

    Concrete stub:

      ```kotlin
      package ai.humynlabs.capture.fgs

      import org.junit.Assert.fail
      import org.junit.Test
      import org.junit.runner.RunWith
      import org.robolectric.RobolectricTestRunner
      import org.robolectric.annotation.Config

      @RunWith(RobolectricTestRunner::class)
      @Config(sdk = [34])
      class HumynForegroundServiceTest {
          @Test
          fun `CAP-14 stub fails until HumynForegroundService ships`() {
              fail("MISSING — Wave 0 stub. Implementation lands in plan 03-07.")
          }
      }
      ```

    Plan 03-07 flips this stub to GREEN when HumynForegroundService.kt + AndroidManifest.xml `<service>` declaration ship.

    Run the fgs/ test to confirm:
      - The stub compiles.
      - It fails with the MISSING marker.

      ```bash
      cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.fgs.*"
      ```

    Expected: `BUILD FAILED` with exactly 1 MISSING failure.

  </action>
  <verify>
    <automated>test "$(find /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs -name '*Test.kt' 2>/dev/null | wc -l)" = "1" && grep -q "MISSING — Wave 0 stub" /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt && grep -q "@Config(sdk = \[34\])" /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt</automated>
  </verify>
  <acceptance_criteria>
    - `find apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs -name '*Test.kt' | wc -l` returns exactly `1`
    - `grep -q "MISSING — Wave 0 stub" apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt`
    - `grep -q "@Config(sdk = \[34\])" apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt` (FGS strict-mode requires API 34)
    - `grep -q "package ai.humynlabs.capture.fgs" apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt`
    - `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugUnitTestSources` exits 0
  </acceptance_criteria>
  <done>1 fgs/ Wave 0 Kotlin test stub compiles + fails meaningfully with MISSING. Plan 03-07 flips it to GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Create JS bridge stubs (HumynCapture.ts + .types.ts), Vitest contract test, Zod schema in shared/types</name>
  <files>apps/mobile/src/native/HumynCapture.ts, apps/mobile/src/native/HumynCapture.types.ts, apps/mobile/__tests__/native/HumynCapture.test.ts, shared/types/src/CaptureSessionOpts.ts, shared/types/src/index.ts</files>
  <read_first>
    - apps/mobile/src/native/HumynCompat.ts (canonical JS bridge pattern — entire 116 lines)
    - apps/mobile/__tests__/native/HumynCompat.test.ts (canonical Vitest bridge contract — entire 79 lines)
    - shared/types/src/CompatResult.ts (Phase 2 Zod-schema-in-shared-types pattern)
    - shared/types/src/index.ts (existing re-export pattern)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-API-01..03 — JS API surface contracts)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("apps/mobile/src/native/HumynCapture.ts (typed JS bridge)")
    - video_metadata.json (canonical metadata schema; verify start_gate fields used in CaptureSessionOpts.startGate align)
  </read_first>
  <action>
    **3A — `shared/types/src/CaptureSessionOpts.ts`:** Zod schema mirroring D-API-02 verbatim:

      ```ts
      import { z } from 'zod';

      /**
       * Phase 3 D-API-02 — start(opts) bridge map for HumynCapture.start().
       * Cross-validated against the Kotlin CaptureSessionOpts.fromBridge(ReadableMap)
       * parser via a Vitest test that asserts both schemas reject the same inputs.
       *
       * Schema-version note: when this contract changes, bump
       * video_metadata.json `schema_version` (currently 1.0.0 → 1.1.0 with the
       * `imu_min_rate_hz_observed_p1` addition that lands in plan 03-05).
       */
      export const CaptureSessionOptsSchema = z.object({
        taskId: z.string().min(1),
        taskName: z.string().min(1),
        taskCategory: z.string().min(1),
        taskSetting: z.enum(['indoor', 'outdoor']),
        contributor: z.object({
          name: z.string().min(1),
          email: z.string().email(),
          age: z.number().int().nullable(),
          gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).nullable(),
          consent: z.literal(true), // hard refuse on consent !== true (T-3.3-01)
        }),
        isPractice: z.boolean(),
        startGate: z.object({
          type: z.literal('hand_detection'),
          passed: z.boolean(),
          skipped: z.boolean(),
          bypassed: z.boolean(),
          durationMs: z.number().int().nonnegative(),
          consecutiveHitsRequired: z.number().int().positive(),
          platformCadenceMs: z.number().int().positive(),
        }),
        location: z.string().nullable(), // coarse, JS pre-resolves
        appVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[+-].+)?$/), // semver
        dfovDegrees: z.number().positive(), // JS pre-resolves from compat.lastResult.v1
      });
      export type CaptureSessionOpts = z.infer<typeof CaptureSessionOptsSchema>;
      ```

    Re-export from `shared/types/src/index.ts` (append to existing exports):
      ```ts
      export * from './CaptureSessionOpts';
      ```

    **3B — `apps/mobile/src/native/HumynCapture.types.ts`:** TypeScript types for the bridge return shapes + event payloads (D-API-03 verbatim):

      ```ts
      // Phase 3 D-API-03 event payload contracts.
      // Mirrored on the Kotlin side via WritableMap composition in HumynCaptureModule.kt.

      export interface SegmentStartEvent {
        segmentId: string;
        recordingId: string;
        startedAt: string; // ISO 8601 with offset
        filenameBase: string; // YYYYMMDD_HHMMSS_NNN
      }

      export interface SegmentCompleteEvent {
        segmentId: string;
        recordingId: string;
        mp4Path: string;
        csvPath: string;
        jsonPath: string;
        durationMs: number;
        drift: { max: number; mean: number; p99: number };
        imuMinRateHzObservedP1: number;
      }

      export interface SessionStopEvent { sessionId: string; segmentsCompleted: number }
      export interface ThermalAbortEvent { segmentId: string; currentStatus: string }
      export interface CaptureErrorEvent {
        code: string; // e.g. 'thermal_throttling', 'storage_full', 'permission_revoked'
        message: string;
        recoverable: boolean;
        segmentId?: string;
      }

      export interface CaptureStartResponse {
        sessionId: string;
        segmentId: string;
        recordingId: string;
        filenameBase: string;
      }
      ```

    **3C — `apps/mobile/src/native/HumynCapture.ts`:** The JS bridge mirroring `HumynCompat.ts`'s `ensure()` pattern. Until Plan 03-09 + 03-10 wire the native side, the bridge stub:
      - Imports `NativeModules` + `NativeEventEmitter` from `react-native`.
      - Re-exports `CaptureSessionOpts` from `@humyn/shared-types` (or wherever the workspace alias resolves).
      - Declares `HumynCaptureNativeModule` with `start(opts)` + `stop()` typed against the response/error contracts.
      - Exports `start(opts: CaptureSessionOpts): Promise<CaptureStartResponse>` and `stop(): Promise<void>` as thin wrappers.
      - Exports `onSegmentStart(listener)`, `onSegmentComplete(listener)`, `onSessionStop(listener)`, `onThermalAbort(listener)`, `onError(listener)` — each returns the EventSubscription so callers can call `.remove()`.

      ```ts
      import { NativeEventEmitter, NativeModules } from 'react-native';
      import type { CaptureSessionOpts } from '@humyn/shared-types';
      import {
        type CaptureStartResponse,
        type SegmentStartEvent,
        type SegmentCompleteEvent,
        type SessionStopEvent,
        type ThermalAbortEvent,
        type CaptureErrorEvent,
      } from './HumynCapture.types';

      interface HumynCaptureNativeModule {
        start(opts: CaptureSessionOpts): Promise<CaptureStartResponse>;
        stop(): Promise<void>;
      }

      function ensure(): HumynCaptureNativeModule {
        const native = NativeModules.HumynCapture as HumynCaptureNativeModule | undefined;
        if (!native) {
          throw new Error(
            'HumynCapture native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
          );
        }
        return native;
      }

      export async function start(opts: CaptureSessionOpts): Promise<CaptureStartResponse> {
        return ensure().start(opts);
      }

      export async function stop(): Promise<void> {
        return ensure().stop();
      }

      // NativeEventEmitter — D-API-01 + D-API-03.
      // Constructed lazily on first subscribe so JSDOM unit tests that don't
      // mock NativeModules.HumynCapture don't crash on file load.
      let _emitter: NativeEventEmitter | null = null;
      function emitter(): NativeEventEmitter {
        if (_emitter == null) {
          _emitter = new NativeEventEmitter(NativeModules.HumynCapture);
        }
        return _emitter;
      }

      export function onSegmentStart(listener: (e: SegmentStartEvent) => void) {
        return emitter().addListener('onSegmentStart', listener);
      }
      export function onSegmentComplete(listener: (e: SegmentCompleteEvent) => void) {
        return emitter().addListener('onSegmentComplete', listener);
      }
      export function onSessionStop(listener: (e: SessionStopEvent) => void) {
        return emitter().addListener('onSessionStop', listener);
      }
      export function onThermalAbort(listener: (e: ThermalAbortEvent) => void) {
        return emitter().addListener('onThermalAbort', listener);
      }
      export function onError(listener: (e: CaptureErrorEvent) => void) {
        return emitter().addListener('onError', listener);
      }

      export type {
        CaptureStartResponse,
        SegmentStartEvent,
        SegmentCompleteEvent,
        SessionStopEvent,
        ThermalAbortEvent,
        CaptureErrorEvent,
      };
      ```

    **3D — `apps/mobile/__tests__/native/HumynCapture.test.ts`:** mirror the 3-test pattern from `HumynCompat.test.ts`:

      1. `describe('HumynCapture (native module not registered)')`:
        - `start({...validOpts}) rejects when native module missing` (asserts `'HumynCapture native module not registered'` substring in error)
        - `stop() rejects when native module missing` (same)

      2. `describe('HumynCapture (native module registered)')`:
        - `start forwards opts and returns resolved value verbatim` — `vi.doMock('react-native', () => ({ NativeModules: { HumynCapture: { start: vi.fn().mockResolvedValue({sessionId:'s1', segmentId:'g1', recordingId:'r1', filenameBase:'20260510_120000_001'}) } } }))`
        - `start propagates rejection (thermal_throttling)` — mock `start` to reject with `Error('thermal_throttling')`; assert the error propagates
        - `stop forwards no args + returns void`

      3. `describe('HumynCapture event subscriptions')`:
        - Mock `NativeEventEmitter` with `vi.doMock('react-native', () => ({ NativeModules: { HumynCapture: {...} }, NativeEventEmitter: vi.fn().mockImplementation(() => ({ addListener: vi.fn().mockReturnValue({ remove: vi.fn() }) })) }))`
        - Subscribe via `onSegmentStart(listener)`; assert `addListener` called with `'onSegmentStart'`
        - Repeat for the other 4 events
        - Assert returned EventSubscription has `.remove`

      4. `describe('CaptureSessionOpts Zod cross-validation')`:
        - Import `CaptureSessionOptsSchema` from `@humyn/shared-types`
        - Assert valid opts parse OK
        - Assert `consent: false` → Zod parse throws (T-3.3-01 mitigation)
        - Assert `appVersion: 'invalid'` → Zod parse throws

    Use Pattern 47 vi.hoisted spy binding when mocking `react-native` to avoid TDZ races.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts --reporter=verbose && cd /Users/adnaan/Documents/hl-homelander && npx tsc --noEmit -p shared/types/tsconfig.json 2>/dev/null || cd /Users/adnaan/Documents/hl-homelander/shared/types && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/src/native/HumynCapture.ts` exists with `export async function start` and `export async function stop`
    - `apps/mobile/src/native/HumynCapture.types.ts` exists with `SegmentStartEvent`, `SegmentCompleteEvent`, `SessionStopEvent`, `ThermalAbortEvent`, `CaptureErrorEvent`, `CaptureStartResponse` interfaces
    - `grep -q "HumynCapture native module not registered" apps/mobile/src/native/HumynCapture.ts` (the canonical error message)
    - `grep -E "onSegmentStart|onSegmentComplete|onSessionStop|onThermalAbort|onError" apps/mobile/src/native/HumynCapture.ts | wc -l` returns ≥ 5 (one for each event helper)
    - `shared/types/src/CaptureSessionOpts.ts` exists with `CaptureSessionOptsSchema` exported
    - `grep -q "CaptureSessionOpts" shared/types/src/index.ts` (re-export)
    - `apps/mobile/__tests__/native/HumynCapture.test.ts` exists with at least 4 `describe(...)` blocks (not-registered, registered, event-subscriptions, zod-cross-validation)
    - `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts` exits 0
    - `cd shared/types && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>JS bridge stub + types + Zod schema land; Vitest contract test green; all subsequent Wave 2 plans can call `import { start, onSegmentComplete } from '../../src/native/HumynCapture'` directly.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                               | Description                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------- |
| JS → Kotlin (TurboModule bridge)       | start(opts) ReadableMap untrusted from Kotlin's perspective — must validate |
| Kotlin → on-disk (.mp4 / .csv / .json) | Files written under app-private filesDir; never world-readable              |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                                                | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                   |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.3-01  | Tampering              | `start({contributor: { consent: false }})` could bypass consent in metadata JSON                                         | mitigate    | `CaptureSessionOptsSchema` uses `z.literal(true)` on `consent` field — Zod parse rejects with `consent_invalid`. Plan 03-09's Kotlin `CaptureSessionOpts.fromBridge` does the same on the native side (defense-in-depth). The HumynCapture.test.ts cross-validation test exercises the rejection path explicitly. |
| T-3.3-02  | Information disclosure | Source map exposure for `HumynCapture.ts` could leak internal type contracts to APK reverse-engineering                  | accept      | Source maps are dev-only; release builds via `apkRollout` flavor strip them per Phase 2 plan 02-01 baseline. The internal contracts mirror the public Phase 1 backend wire schema (already exposed via `apps/api/src/`) so there's no incremental disclosure.                                                     |
| T-3.3-03  | Tampering              | Gradle dep substitution attack (someone publishes a malicious `androidx.media3:media3-muxer:1.10.0` to a typosquat repo) | accept      | `apps/mobile/android/app/build.gradle` uses `mavenCentral()` + `google()` repositories only (Phase 1 baseline). Maven Central is GPG-signed; the AndroidX team owns the artifact signing key. Acceptable risk vs supply-chain attestation tooling overhead.                                                       |
| T-3.3-04  | DoS                    | NativeEventEmitter listener leak (caller forgets to `.remove()`) holds the JS context refs indefinitely                  | mitigate    | Each event helper returns the subscription; caller MUST `.remove()` on unmount. Phase 4 RecordingScreen will use `useEffect` cleanup pattern. Plan 03-09 documents the leak risk in `HumynCapture.ts` JSDoc.                                                                                                      |

</threat_model>

<verification>
- `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources :app:compileApkRolloutDebugUnitTestSources` exits 0 (Gradle dep resolves; Kotlin test stubs compile).
- `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.FragmentedMuxerWrapperTest"` exits 0 (the only Wave 0 test that ships GREEN in this plan).
- The other 17 Kotlin test stubs each fail with `MISSING — Wave 0 stub` (verifiable by counting failure lines in the test report).
- `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts` exits 0 (JS bridge contract green).
- `cd apps/mobile && npx tsc --noEmit` and `cd shared/types && npx tsc --noEmit` both exit 0.
- The full Phase 2 + Phase 3 Wave 1 test suite remains green: `cd apps/mobile && npm test` exits 0 (no regressions).
</verification>

<success_criteria>

- ✓ `androidx.media3:media3-muxer:1.10.0` (or latest 1.10.x) Gradle dep resolves.
- ✓ `FragmentedMuxerWrapper.kt` compiles + passes its narrow Robolectric ftyp-signature test (CAP-02 entry point).
- ✓ 17+ Kotlin test stubs (capture/ + fgs/) compile-clean and fail meaningfully with `MISSING — Wave 0 stub` markers; each downstream plan flips its target stubs to GREEN.
- ✓ `apps/mobile/src/native/HumynCapture.ts` + `.types.ts` ship the typed JS bridge with `start`, `stop`, and 5 NativeEventEmitter helpers (D-API-01..03).
- ✓ `shared/types/src/CaptureSessionOpts.ts` Zod schema mirrors D-API-02 exactly + is re-exported from `index.ts`.
- ✓ `apps/mobile/__tests__/native/HumynCapture.test.ts` covers 4 describe blocks (not-registered / registered / events / Zod cross-validation) — all green.
- ✓ Phase 2 + Phase 3 Wave 1 suites stay green (no regressions).
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-04-SUMMARY.md` per the canonical summary template — including:

- Resolved Media3 muxer version pin (1.10.0 or latest 1.10.x verified at execution time).
- The exact `androidx.media3.muxer.BufferInfo` constructor signature used (the 4-arg vs 5-arg variant — RESEARCH.md flagged ambiguity).
- Pattern callout: "Wave 0 test stub" (the `MISSING — Wave 0 stub` Nyquist-compatible failure marker).
- Pattern callout: "Lazy NativeEventEmitter" — `_emitter` constructed on first subscribe so JSDOM tests don't crash on file load.
- Cross-link to each downstream plan's stub-flip targets (Plan 03-05: 6 stubs; Plan 03-06: 1 stub; Plan 03-07: 2 stubs; Plan 03-08: 4 stubs; Plan 03-10: 5 stubs).
  </output>
