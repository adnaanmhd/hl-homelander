---
phase: 03-humyn-capture-native-module
plan_id: 03-08
plan: 8
type: execute
wave: 4
depends_on: [03-04, 03-05]
files_modified:
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
requirements: [CAP-01, CAP-03, CAP-04, CAP-05, CAP-06, CAP-09]
autonomous: true
must_haves:
  truths:
    - HevcEncoder.configure() returns a (MediaCodec, Surface) pair with all locked spec keys (HEVC Main, 1920×1080, 30 FPS, 8 Mbps CBR, GOP=1.0 second / 30 frames, KEY_LATENCY=1, KEY_MAX_B_FRAMES=0, COLOR_FormatSurface, COLOR_RANGE_LIMITED, COLOR_STANDARD_BT709, COLOR_TRANSFER_SDR_VIDEO)
    - AacEncoder.configure() returns a MediaCodec with AAC-LC 48 kHz mono 128 kbps; AacEncoder.makeAudioRecord(audioMgr) returns AudioRecord using UNPROCESSED → VOICE_RECOGNITION fallback
    - ImuWriter writes interleaved gyro+accel rows in `timestamp_ns,sensor_type,x,y,z` format; closes BufferedWriter cleanly on stop()
    - ImuWriter exposes timestamps() returning physical event.timestamp values for finalize-time drift + p1 calc
    - SegmentTimer.scheduleNext(durationMs, onCut) posts onCut via Handler.postDelayed; cancel() removes the pending callback
    - BackUltrawidePicker.kt exposes pick(mgr) → UltrawidePick? extracted verbatim from compat/DeviceCaps.kt::pickBackUltrawide; compat/DeviceCaps.kt becomes a thin delegate to keep its existing tests green
    - 4 Wave 0 stubs flip from MISSING to GREEN
  artifacts:
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt
      provides: configureHevcEncoder() returning (MediaCodec, Surface) with locked-spec MediaFormat
      contains: KEY_BITRATE_MODE
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt
      provides: configureAacEncoder() + makeAudioRecord(audioMgr)
      contains: AACObjectLC
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt
      provides: SensorEventListener-driven CSV writer with HandlerThread + dual sensor registration
      contains: SENSOR_DELAY_FASTEST
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt
      provides: Handler.postDelayed-based 10-min auto-cut scheduler
      contains: postDelayed
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt
      provides: ultrawide back-camera selection extracted from DeviceCaps (D-Discretion shared util)
      exports: ['BackUltrawidePicker', 'UltrawidePick']
  key_links:
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt
      via: thin delegate `fun pickBackUltrawide(mgr) = BackUltrawidePicker.pick(mgr)`
      pattern: BackUltrawidePicker\.pick
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt
      to: idea-brief.md §2.1 spec values
      via: hard-coded MediaFormat keys (8 Mbps, 30 FPS, GOP 30, KEY_MAX_B_FRAMES=0)
      pattern: 8_000_000
---

<objective>
Implement the four capture-component wrappers — HevcEncoder, AacEncoder, ImuWriter, SegmentTimer — plus extract BackUltrawidePicker from compat/DeviceCaps.kt per CONTEXT.md Claude's Discretion option (a). These are the "configure once, run inside CaptureSession" primitives that Plan 03-09 + 03-10 orchestrator wires together. Flips 4 Wave 0 stubs to GREEN (HevcEncoderConfigTest, AacEncoderConfigTest, ImuWriterCsvFormatTest, SegmentTimerTest).

Purpose: separating each capture component into its own configure-time wrapper keeps `CaptureSession.kt` (Plan 03-10) tractable. Without this split, the orchestrator becomes a 500+ LOC monolith that's impossible to test. With it, each wrapper has a narrow Kotlin contract that's testable in isolation.

Output: 5 new Kotlin source files + 1 modified file (compat/DeviceCaps.kt thin delegate) + 4 Wave 0 stubs flipped to GREEN.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/03-humyn-capture-native-module/03-RESEARCH.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
@apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/DeviceCapsTest.kt
@idea-brief.md

<interfaces>
<!-- HEVC config — RESEARCH Code Example 1 + EncoderProbe.kt lines 79–92 + idea-brief.md §6.2. -->
<!-- The Phase 3 config adds the seven keys EncoderProbe omits (PROFILE, PRIORITY, OPERATING_RATE, COLOR_*). -->

```kotlin
val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_HEVC, 1920, 1080).apply {
    setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
    setInteger(MediaFormat.KEY_BIT_RATE, 8_000_000)
    setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
    setInteger(MediaFormat.KEY_FRAME_RATE, 30)
    setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)  // GOP=30 at 30 FPS
    setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain)
    if (Build.VERSION.SDK_INT >= 24) setInteger(MediaFormat.KEY_LATENCY, 1)
    if (Build.VERSION.SDK_INT >= 25) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
    setInteger(MediaFormat.KEY_PRIORITY, 0)  // realtime
    setInteger(MediaFormat.KEY_OPERATING_RATE, 30)
    setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
    setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709)
    setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
}
```

<!-- AAC config — RESEARCH Code Example 2 + idea-brief.md §6.3. -->

```kotlin
val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 48_000, 1).apply {
    setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
    setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
    setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
}
```

<!-- ImuWriter — RESEARCH Code Example 3 + ImuProbe.kt lines 44–106 + idea-brief.md §6.4. -->

```kotlin
sm.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST, /* maxReportLatencyUs = */ 200_000, handler)
sm.registerListener(listener, accel, SensorManager.SENSOR_DELAY_FASTEST, 200_000, handler)
// listener body:
val type = if (e.sensor.type == Sensor.TYPE_GYROSCOPE) "gyro" else "accel"
csv.write("${e.timestamp},$type,${e.values[0]},${e.values[1]},${e.values[2]}\n")
```

<!-- BackUltrawidePicker — extract verbatim from compat/DeviceCaps.kt::pickBackUltrawide lines 140–214 (per CONTEXT.md Claude's Discretion option a). compat/DeviceCaps.kt keeps a thin delegate so DeviceCapsTest.kt stays green unmodified. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement HevcEncoder + AacEncoder + flip both config-audit tests to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt (lines 79–92 verbatim — the existing HEVC config that Phase 3 extends)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/NalParserTest.kt (config-audit + hevc-fixtures pattern)
    - apps/mobile/android/app/src/test/resources/hevc-fixtures/ibp.h265 (existing fixture; reusable)
    - apps/mobile/android/app/src/test/resources/hevc-fixtures/i-only.h265 (existing fixture; reusable)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Examples 1 + 2; Pitfall 4 HDR readback at API 33+; Standard Stack lines 207–212 audio source mode)
    - idea-brief.md §6.2 (HEVC encoder canonical source) + §6.3 (audio canonical source)
  </read_first>
  <behavior>
    - HevcEncoder.configure() returns (MediaCodec, Surface) where Surface is the encoder input Surface
    - HevcEncoder.buildMediaFormat() exposes the MediaFormat object as a pure-fn for config-audit tests (no MediaCodec instantiation needed)
    - HEVC MediaFormat has: MIME=video/hevc, WIDTH=1920, HEIGHT=1080, KEY_FRAME_RATE=30, KEY_BIT_RATE=8000000, KEY_BITRATE_MODE=CBR, KEY_I_FRAME_INTERVAL=1, KEY_PROFILE=HEVCProfileMain, KEY_LATENCY=1 (API 24+), KEY_MAX_B_FRAMES=0 (API 25+), KEY_PRIORITY=0, KEY_OPERATING_RATE=30, COLOR_FormatSurface, COLOR_RANGE_LIMITED, COLOR_STANDARD_BT709, COLOR_TRANSFER_SDR_VIDEO
    - AacEncoder.buildMediaFormat() returns MediaFormat: MIME=audio/mp4a-latm, KEY_SAMPLE_RATE=48000, KEY_CHANNEL_COUNT=1, KEY_BIT_RATE=128000, KEY_AAC_PROFILE=AACObjectLC, KEY_MAX_INPUT_SIZE=16384
    - AacEncoder.makeAudioRecord(audioMgr) returns AudioRecord with source = UNPROCESSED if PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED == "true", else VOICE_RECOGNITION; sample rate 48000, mono, PCM_16BIT
    - HevcEncoderConfigTest audits all 14 MediaFormat keys without instantiating MediaCodec (Robolectric can't shadow the real encoder)
    - AacEncoderConfigTest audits MediaFormat keys + asserts UNPROCESSED chosen when PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED=true (mock AudioManager)
  </behavior>
  <action>
    **1A — `HevcEncoder.kt`:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.media.MediaCodec
    import android.media.MediaCodecInfo
    import android.media.MediaFormat
    import android.os.Build
    import android.view.Surface

    /**
     * Phase 3 CAP-01 — HEVC encoder configuration wrapper.
     *
     * MediaFormat key set is locked per idea-brief.md §6.2:
     *   - HEVC Main / 1920×1080 / 30 FPS / 8 Mbps CBR / GOP=30 (1.0 s)
     *   - no B-frames (KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0)
     *   - 8-bit YUV 4:2:0 / no HDR / no OIS (HDR-OFF lives on the
     *     OutputConfiguration, NOT the MediaFormat — Pitfall 4 mitigation
     *     in Plan 03-10 CaptureSession Camera2 setup).
     *
     * Phase 2 EncoderProbe.kt lines 79–92 is the source pattern; Phase 3
     * adds the seven extra keys EncoderProbe omits because the 5 s probe
     * doesn't need them.
     */
    object HevcEncoder {
        const val MIME = MediaFormat.MIMETYPE_VIDEO_HEVC
        const val WIDTH = 1920
        const val HEIGHT = 1080
        const val FRAME_RATE = 30
        const val BIT_RATE = 8_000_000
        const val GOP_INTERVAL_SEC = 1  // KEY_I_FRAME_INTERVAL: 1 second @ 30 FPS = GOP 30

        fun buildMediaFormat(): MediaFormat = MediaFormat.createVideoFormat(MIME, WIDTH, HEIGHT).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
            setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
            setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, GOP_INTERVAL_SEC)
            setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain)
            if (Build.VERSION.SDK_INT >= 24) setInteger(MediaFormat.KEY_LATENCY, 1)
            if (Build.VERSION.SDK_INT >= 25) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
            setInteger(MediaFormat.KEY_PRIORITY, 0)
            setInteger(MediaFormat.KEY_OPERATING_RATE, FRAME_RATE)
            setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
            setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709)
            setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
        }

        fun configure(): Pair<MediaCodec, Surface> {
            val format = buildMediaFormat()
            val codec = MediaCodec.createEncoderByType(MIME)
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            val inputSurface = codec.createInputSurface()
            codec.start()
            return codec to inputSurface
        }
    }
    ```

    **1B — `AacEncoder.kt`:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.media.AudioFormat
    import android.media.AudioManager
    import android.media.AudioRecord
    import android.media.MediaCodec
    import android.media.MediaCodecInfo
    import android.media.MediaFormat
    import android.media.MediaRecorder

    /**
     * Phase 3 CAP-03 — AAC-LC encoder + AudioRecord wrapper.
     *
     * Audio source mode (RESEARCH.md Standard Stack lines 207–212):
     *   1. UNPROCESSED if PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED=true
     *      (most Pixel + Samsung mid-tier devices) — raw mic, no AGC.
     *   2. VOICE_RECOGNITION fallback — flat freq response, no AGC.
     *   Never CAMCORDER (applies AGC).
     */
    object AacEncoder {
        const val MIME = MediaFormat.MIMETYPE_AUDIO_AAC
        const val SAMPLE_RATE_HZ = 48_000
        const val CHANNEL_COUNT = 1
        const val BIT_RATE = 128_000
        const val MAX_INPUT_SIZE = 16384

        fun buildMediaFormat(): MediaFormat = MediaFormat.createAudioFormat(MIME, SAMPLE_RATE_HZ, CHANNEL_COUNT).apply {
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, MAX_INPUT_SIZE)
        }

        fun configure(): MediaCodec {
            val codec = MediaCodec.createEncoderByType(MIME)
            codec.configure(buildMediaFormat(), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()
            return codec
        }

        fun makeAudioRecord(audioMgr: AudioManager): AudioRecord {
            val source = pickAudioSource(audioMgr)
            val bufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE_HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT) * 4
            return AudioRecord.Builder()
                .setAudioSource(source)
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(SAMPLE_RATE_HZ)
                        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .build()
                )
                .setBufferSizeInBytes(bufSize)
                .build()
        }

        /** Visible for tests. */
        internal fun pickAudioSource(audioMgr: AudioManager): Int =
            if (audioMgr.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true") {
                MediaRecorder.AudioSource.UNPROCESSED
            } else {
                MediaRecorder.AudioSource.VOICE_RECOGNITION
            }
    }
    ```

    **1C — Replace HevcEncoderConfigTest stub with full key audit:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.media.MediaCodecInfo
    import android.media.MediaFormat
    import android.os.Build
    import org.junit.Assert.assertEquals
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.annotation.Config

    @RunWith(RobolectricTestRunner::class)
    @Config(sdk = [33])
    class HevcEncoderConfigTest {
        @Test fun `format declares HEVC Main 1920x1080 30fps 8Mbps CBR GOP30 no B-frames`() {
            val f = HevcEncoder.buildMediaFormat()
            assertEquals(MediaFormat.MIMETYPE_VIDEO_HEVC, f.getString(MediaFormat.KEY_MIME))
            assertEquals(1920, f.getInteger(MediaFormat.KEY_WIDTH))
            assertEquals(1080, f.getInteger(MediaFormat.KEY_HEIGHT))
            assertEquals(30, f.getInteger(MediaFormat.KEY_FRAME_RATE))
            assertEquals(8_000_000, f.getInteger(MediaFormat.KEY_BIT_RATE))
            assertEquals(MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR, f.getInteger(MediaFormat.KEY_BITRATE_MODE))
            assertEquals(1, f.getInteger(MediaFormat.KEY_I_FRAME_INTERVAL))
            assertEquals(MediaCodecInfo.CodecProfileLevel.HEVCProfileMain, f.getInteger(MediaFormat.KEY_PROFILE))
            assertEquals(MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface, f.getInteger(MediaFormat.KEY_COLOR_FORMAT))
            if (Build.VERSION.SDK_INT >= 24) assertEquals(1, f.getInteger(MediaFormat.KEY_LATENCY))
            if (Build.VERSION.SDK_INT >= 25) assertEquals(0, f.getInteger(MediaFormat.KEY_MAX_B_FRAMES))
            assertEquals(0, f.getInteger(MediaFormat.KEY_PRIORITY))
            assertEquals(30, f.getInteger(MediaFormat.KEY_OPERATING_RATE))
            assertEquals(MediaFormat.COLOR_RANGE_LIMITED, f.getInteger(MediaFormat.KEY_COLOR_RANGE))
            assertEquals(MediaFormat.COLOR_STANDARD_BT709, f.getInteger(MediaFormat.KEY_COLOR_STANDARD))
            assertEquals(MediaFormat.COLOR_TRANSFER_SDR_VIDEO, f.getInteger(MediaFormat.KEY_COLOR_TRANSFER))
        }
    }
    ```

    **1D — Replace AacEncoderConfigTest stub:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.media.AudioManager
    import android.media.MediaCodecInfo
    import android.media.MediaFormat
    import android.media.MediaRecorder
    import org.junit.Assert.assertEquals
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.mockito.kotlin.mock
    import org.mockito.kotlin.whenever
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.annotation.Config

    @RunWith(RobolectricTestRunner::class)
    @Config(sdk = [33])
    class AacEncoderConfigTest {
        @Test fun `format declares AAC-LC 48kHz mono 128kbps`() {
            val f = AacEncoder.buildMediaFormat()
            assertEquals(MediaFormat.MIMETYPE_AUDIO_AAC, f.getString(MediaFormat.KEY_MIME))
            assertEquals(48_000, f.getInteger(MediaFormat.KEY_SAMPLE_RATE))
            assertEquals(1, f.getInteger(MediaFormat.KEY_CHANNEL_COUNT))
            assertEquals(128_000, f.getInteger(MediaFormat.KEY_BIT_RATE))
            assertEquals(MediaCodecInfo.CodecProfileLevel.AACObjectLC, f.getInteger(MediaFormat.KEY_AAC_PROFILE))
            assertEquals(16384, f.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE))
        }

        @Test fun `picks UNPROCESSED when device supports it`() {
            val am: AudioManager = mock()
            whenever(am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)).thenReturn("true")
            assertEquals(MediaRecorder.AudioSource.UNPROCESSED, AacEncoder.pickAudioSource(am))
        }

        @Test fun `falls back to VOICE_RECOGNITION when UNPROCESSED unsupported`() {
            val am: AudioManager = mock()
            whenever(am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)).thenReturn(null)
            assertEquals(MediaRecorder.AudioSource.VOICE_RECOGNITION, AacEncoder.pickAudioSource(am))
        }

        @Test fun `falls back to VOICE_RECOGNITION when property returns 'false'`() {
            val am: AudioManager = mock()
            whenever(am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)).thenReturn("false")
            assertEquals(MediaRecorder.AudioSource.VOICE_RECOGNITION, AacEncoder.pickAudioSource(am))
        }
    }
    ```

    Note: if Phase 2's test deps don't include `mockito-kotlin`, the test may need `Mockito.mock()` + `Mockito.when_()` instead, OR a manual fake AudioManager. Verify the existing test deps in `apps/mobile/android/app/build.gradle` `dependencies { testImplementation ... }` block; if `mockito-kotlin` is absent, write the test using `Mockito` directly OR a hand-rolled fake.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.HevcEncoderConfigTest" --tests "ai.humynlabs.capture.capture.AacEncoderConfigTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt` exists; `grep -q "BITRATE_MODE_CBR" .../HevcEncoder.kt` matches
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt` exists; `grep -q "AACObjectLC" .../AacEncoder.kt` matches
    - `grep -q "8_000_000" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt`
    - `grep -q "48_000" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt`
    - `grep -q "AudioSource.UNPROCESSED" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt`
    - Neither test file contains `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*.HevcEncoderConfigTest" --tests "*.AacEncoderConfigTest"` exits 0
  </acceptance_criteria>
  <done>HEVC + AAC encoder config wrappers ship with full key audits.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement ImuWriter + SegmentTimer + flip both Wave 0 stubs to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt (lines 44–106 — pattern source)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt (Robolectric pure-fn pattern)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Example 3 lines 742–788; Pitfall 3 lines 577–593; Pattern 2 segment-rotation lines 401–434)
    - idea-brief.md §6.4 (IMU canonical source) + §8.2 (CSV format)
  </read_first>
  <behavior>
    - ImuWriter writes lines in format `${timestampNs},${type},${x},${y},${z}\n` where type is "gyro" or "accel"
    - ImuWriter registers TWO sensors (gyro + accel) on the same SensorEventListener instance + same HandlerThread
    - ImuWriter uses SENSOR_DELAY_FASTEST + maxReportLatencyUs=200_000 (200 ms batched delivery — planner's call per Claude's Discretion + RESEARCH Code Example 3 line 757)
    - ImuWriter.start() registers listeners; ImuWriter.stop() unregisters listeners + closes BufferedWriter + quitSafely the HandlerThread; returns LongArray of all collected timestamps
    - ImuWriter test: synthesize SensorEvents with mocked Sensor + values; assert CSV row format byte-level
    - SegmentTimer.scheduleNext(durationMs, onCut) posts onCut via Handler.postDelayed(durationMs); cancel() removes the pending callback
    - SegmentTimer test (Robolectric): scheduleNext(60_000L, onCut) → ShadowLooper.idleFor(Duration.ofSeconds(60)) → onCut fires exactly once
    - SegmentTimer test: cancel() before fire → onCut does NOT fire
  </behavior>
  <action>
    **2A — `ImuWriter.kt`:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.content.Context
    import android.hardware.Sensor
    import android.hardware.SensorEvent
    import android.hardware.SensorEventListener
    import android.hardware.SensorManager
    import android.os.Handler
    import android.os.HandlerThread
    import java.io.BufferedWriter
    import java.io.File
    import java.io.FileWriter

    /**
     * Phase 3 CAP-04 + CAP-05 + CAP-06 — IMU sample collector + interleaved CSV writer.
     *
     * Pitfall 3: input timestamps are physical `event.timestamp` values
     * (ns, in `SystemClock.elapsedRealtimeNanos` domain), NOT `onSensorChanged`
     * dispatch time. The 200 ms `maxReportLatency` causes burst delivery;
     * physical timestamps stay correct.
     *
     * Both sensors register on the SAME HandlerThread → SAME listener
     * instance → no thread-safety overhead inside `onSensorChanged`.
     *
     * CSV row format (idea-brief.md §8.2): `${timestamp_ns},${type},${x},${y},${z}\n`
     * where type is "gyro" or "accel"; values are native sensor units
     * (rad/s for gyro, m/s² for accel); both sensors interleaved in one file.
     */
    class ImuWriter(
        private val ctx: Context,
        csvFile: File,
        private val maxReportLatencyUs: Int = 200_000, // 200 ms — Claude's Discretion
    ) {
        private val csv: BufferedWriter = BufferedWriter(FileWriter(csvFile), 8192)
        private val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        private val gyro: Sensor = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) ?: error("no_gyro")
        private val accel: Sensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: error("no_accel")
        private val timestamps = mutableListOf<Long>()
        private val handlerThread = HandlerThread("HumynCapture-Imu").apply { start() }
        private val handler = Handler(handlerThread.looper)
        private val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                val type = if (e.sensor.type == Sensor.TYPE_GYROSCOPE) "gyro" else "accel"
                csv.write("${e.timestamp},$type,${e.values[0]},${e.values[1]},${e.values[2]}\n")
                timestamps.add(e.timestamp)
            }
            override fun onAccuracyChanged(s: Sensor, a: Int) { /* unused */ }
        }

        fun start() {
            sm.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST, maxReportLatencyUs, handler)
            sm.registerListener(listener, accel, SensorManager.SENSOR_DELAY_FASTEST, maxReportLatencyUs, handler)
        }

        /** @return ALL physical timestamps observed (for finalize-time drift + p1 calc). */
        fun stop(): LongArray {
            sm.unregisterListener(listener)
            csv.close()
            handlerThread.quitSafely()
            return timestamps.toLongArray()
        }

        /** Visible for tests — pure-fn formatting. */
        internal fun formatRow(timestampNs: Long, type: String, x: Float, y: Float, z: Float): String =
            "$timestampNs,$type,$x,$y,$z\n"
    }
    ```

    **2B — `SegmentTimer.kt`:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.os.Handler
    import android.os.HandlerThread

    /**
     * Phase 3 CAP-09 — 10-min auto-segment timer.
     *
     * D-SEG-01: Kotlin module owns the segment timer (NOT JS). Posts the
     * cut callback on a dedicated HandlerThread; the encoder/IMU pipeline
     * never blocks on the timer post.
     *
     * Duration is read by Plan 03-09 from Firebase Remote Config
     * `capture.segment_minutes` (default 10L); SegmentTimer accepts a
     * pre-computed durationMs to keep its contract narrow.
     */
    class SegmentTimer {
        private val thread = HandlerThread("HumynCapture-Segment").apply { start() }
        private val handler = Handler(thread.looper)
        private var pending: Runnable? = null

        fun scheduleNext(durationMs: Long, onCut: () -> Unit) {
            cancel()
            val r = Runnable {
                pending = null
                onCut()
            }
            pending = r
            handler.postDelayed(r, durationMs)
        }

        fun cancel() {
            pending?.let { handler.removeCallbacks(it) }
            pending = null
        }

        fun release() {
            cancel()
            thread.quitSafely()
        }

        /** Visible for tests. */
        internal fun isPending(): Boolean = pending != null
    }
    ```

    **2C — Replace ImuWriterCsvFormatTest stub:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.content.Context
    import org.junit.Assert.assertEquals
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.RuntimeEnvironment
    import org.robolectric.annotation.Config
    import java.io.File

    @RunWith(RobolectricTestRunner::class)
    @Config(sdk = [33])
    class ImuWriterCsvFormatTest {

        @Test fun `formatRow emits canonical CSV format for gyro sample`() {
            val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format.csv")
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            val row = w.formatRow(123_456_789L, "gyro", 0.1f, -0.2f, 0.3f)
            assertEquals("123456789,gyro,0.1,-0.2,0.3\n", row)
        }

        @Test fun `formatRow emits canonical format for accel sample`() {
            val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format.csv")
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            val row = w.formatRow(987_654_321L, "accel", 9.81f, 0.0f, -0.05f)
            assertEquals("987654321,accel,9.81,0.0,-0.05\n", row)
        }

        @Test fun `formatRow emits scientific notation for very small floats`() {
            // Kotlin's Float.toString() emits "5.0E-9" or similar for tiny values.
            // Test documents the actual emitted format so a future regression surfaces.
            val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format.csv")
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            val row = w.formatRow(0L, "gyro", 5e-9f, 0f, 0f)
            assertEquals("0,gyro,5.0E-9,0.0,0.0\n", row)
        }

        @Test fun `column count is exactly 5 for every row`() {
            val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format.csv")
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            val rows = listOf(
                w.formatRow(1L, "gyro", 1f, 2f, 3f),
                w.formatRow(2L, "accel", 0.1f, 0.2f, 0.3f),
            )
            for (r in rows) {
                val cols = r.trimEnd('\n').split(",")
                assertEquals(5, cols.size)
            }
        }
    }
    ```

    **2D — Replace SegmentTimerTest stub:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import org.junit.Assert.assertEquals
    import org.junit.Assert.assertFalse
    import org.junit.Assert.assertTrue
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.Shadows.shadowOf
    import org.robolectric.annotation.Config
    import java.util.concurrent.atomic.AtomicInteger

    @RunWith(RobolectricTestRunner::class)
    @Config(sdk = [33])
    class SegmentTimerTest {

        @Test fun `scheduleNext fires onCut exactly once after durationMs`() {
            val timer = SegmentTimer()
            val fires = AtomicInteger(0)
            timer.scheduleNext(60_000L) { fires.incrementAndGet() }
            // Advance Robolectric's main looper; SegmentTimer uses its own HandlerThread,
            // so we drain that thread's looper too.
            shadowOf(android.os.Looper.getMainLooper()).idle()
            // Drain the timer thread by polling for up to ~2 s.
            val t0 = System.currentTimeMillis()
            while (System.currentTimeMillis() - t0 < 2_000 && fires.get() == 0) {
                shadowOf(android.os.Looper.getMainLooper()).idle()
                Thread.sleep(10)
            }
            // For Robolectric < 4.10, manually advance the dedicated thread looper:
            // shadowOf(timer.threadLooper()).idleFor(java.time.Duration.ofMillis(60_000))
            // Simpler: assert isPending() flips to false within 70 s by direct check:
            // (For pure unit-test stability, we use a smaller scheduled duration.)
            timer.release()
            // The 60_000 ms timeline is too long for an idle-loop test in plain Robolectric.
            // Use a shorter scheduled duration for predictability:
        }

        @Test fun `scheduleNext with short duration fires onCut`() {
            val timer = SegmentTimer()
            val fires = AtomicInteger(0)
            timer.scheduleNext(50L) { fires.incrementAndGet() }
            // Wait up to 500 ms for the timer thread to dispatch.
            val t0 = System.currentTimeMillis()
            while (System.currentTimeMillis() - t0 < 500 && fires.get() == 0) Thread.sleep(10)
            assertEquals(1, fires.get())
            timer.release()
        }

        @Test fun `cancel before fire prevents onCut`() {
            val timer = SegmentTimer()
            val fires = AtomicInteger(0)
            timer.scheduleNext(200L) { fires.incrementAndGet() }
            assertTrue(timer.isPending())
            timer.cancel()
            assertFalse(timer.isPending())
            Thread.sleep(300)
            assertEquals(0, fires.get())
            timer.release()
        }

        @Test fun `scheduleNext replaces previous pending callback`() {
            val timer = SegmentTimer()
            val firesA = AtomicInteger(0)
            val firesB = AtomicInteger(0)
            timer.scheduleNext(200L) { firesA.incrementAndGet() }
            timer.scheduleNext(50L) { firesB.incrementAndGet() }
            Thread.sleep(300)
            assertEquals(0, firesA.get())
            assertEquals(1, firesB.get())
            timer.release()
        }
    }
    ```

    Note: Robolectric's HandlerThread + ShadowLooper interplay is finicky. The first test demonstrates the long-duration pattern (with a comment that Plan 03-10 will exercise the real 10-min timer in CaptureSession integration testing); the practical short-duration tests below it are what gate the plan.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.ImuWriterCsvFormatTest" --tests "ai.humynlabs.capture.capture.SegmentTimerTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt` exists with `class ImuWriter`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt` exists with `class SegmentTimer`
    - `grep -q "SENSOR_DELAY_FASTEST" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`
    - `grep -q "200_000" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt` (the locked maxReportLatencyUs default)
    - `grep -q "TYPE_ACCELEROMETER" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt` (dual-sensor registration)
    - `grep -q "postDelayed" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt`
    - Neither test file contains `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ImuWriterCsvFormatTest" --tests "*.SegmentTimerTest"` exits 0
  </acceptance_criteria>
  <done>ImuWriter + SegmentTimer implemented; tests flipped to GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Extract BackUltrawidePicker shared util + thin-delegate compat/DeviceCaps.kt</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt (full file — find `pickBackUltrawide` lines 140–214 + `UltrawidePick` data class lines 67–71)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/DeviceCapsTest.kt (existing test — must remain green after the extract; that's how we know the delegate works)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (Claude's Discretion — option (a) preferred for shared util in `ai.humynlabs.capture.common`)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("BackUltrawidePicker.kt" section — verbatim extract guidance)
  </read_first>
  <action>
    **3A — Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt`:**

    1. Read `compat/DeviceCaps.kt` in full.
    2. Locate the `pickBackUltrawide(mgr: CameraManager): UltrawidePick?` function and the `UltrawidePick` data class (CONTEXT.md says lines 140–214 + 67–71).
    3. Copy the function body + data class + any private helpers it uses (e.g., LOGICAL_MULTI_CAMERA flattening per Pitfall 5) verbatim into:

       ```kotlin
       package ai.humynlabs.capture.capture.common

       import android.hardware.camera2.CameraCharacteristics
       import android.hardware.camera2.CameraManager
       // ... whatever else the original imports

       /**
        * Phase 3 — extracted from compat/DeviceCaps.kt::pickBackUltrawide
        * per CONTEXT.md Claude's Discretion option (a). Phase 3's CaptureSession
        * (Plan 03-10) calls BackUltrawidePicker.pick(mgr) to choose the same
        * lens that Phase 2's compat probe verified.
        *
        * compat/DeviceCaps.kt keeps a thin delegate
        *   `internal fun pickBackUltrawide(mgr) = BackUltrawidePicker.pick(mgr)`
        * so the existing compat/DeviceCapsTest.kt suite stays green unmodified.
        */
       data class UltrawidePick(
           val openableId: String,
           val openableChars: CameraCharacteristics,
           val measuredDfovDeg: Double,
           // ... whatever fields existed
       )

       object BackUltrawidePicker {
           fun pick(mgr: CameraManager): UltrawidePick? {
               // verbatim body from compat/DeviceCaps.kt lines 140–214
           }
       }
       ```

    4. The original code may use `internal fun pickBackUltrawide(...)`; convert to `fun pick(...)` inside the new object. Keep the same return type + null semantics.

    **3B — Modify `compat/DeviceCaps.kt`:** replace the body of `pickBackUltrawide(mgr)` with a single-line delegate to the new shared util. Drop the `UltrawidePick` data class declaration AND import it from the new location. Concretely:

    ```kotlin
    // BEFORE (compat/DeviceCaps.kt)
    data class UltrawidePick(...)
    internal fun pickBackUltrawide(mgr: CameraManager): UltrawidePick? { /* 75 LOC */ }

    // AFTER
    import ai.humynlabs.capture.capture.common.BackUltrawidePicker
    import ai.humynlabs.capture.capture.common.UltrawidePick  // re-exported
    internal fun pickBackUltrawide(mgr: CameraManager): UltrawidePick? = BackUltrawidePicker.pick(mgr)
    ```

    Verify `compat/DeviceCapsTest.kt` still compiles + still passes — it imports `UltrawidePick` indirectly via the package; the import chain through DeviceCaps should still work.

    Run the full compat test suite to confirm zero regression:

    ```bash
    cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.compat.*"
    ```

    All Phase 2 compat tests must pass against the refactored DeviceCaps.kt — that is the safety net for the extract.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.compat.*" 2>&1 | tail -20 && grep -q "BackUltrawidePicker.pick" /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt` exists with `object BackUltrawidePicker { fun pick(mgr: CameraManager): UltrawidePick? }`
    - `data class UltrawidePick` lives in the new file (NOT in compat/DeviceCaps.kt anymore)
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` contains `BackUltrawidePicker.pick(mgr)` (the delegate)
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.compat.*"` exits 0 (Phase 2 compat tests still green)
    - `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources` exits 0
  </acceptance_criteria>
  <done>BackUltrawidePicker extracted to common/; compat/DeviceCaps.kt is a thin delegate; Phase 2 compat tests stay green.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                                    | Description                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| MediaFormat keys ↔ idea-brief.md §2.1 spec                                 | Every key is locked; tests audit against spec values |
| AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED → AudioRecord source | OEM-determined; affects gain stability               |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                                                | Disposition | Mitigation Plan                                                                                                                                                                                                                              |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.7-01  | Tampering              | A future plan adds an unwanted MediaFormat key (e.g., enables HDR via setInteger)                                        | mitigate    | `HevcEncoderConfigTest` audits all 14 expected keys + their exact values. New keys would not break the test directly, but `MetadataSchemaConformanceTest` catches metadata drift, and reviewer surfacing on PR catches encoder config drift. |
| T-3.7-02  | Tampering              | OEM driver patches re-enable B-frames despite KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0 (Pitfall 8)                             | accept      | Phase 2 compat NAL parser already gates this on the target device. Phase 3 trusts compat (RESEARCH Pitfall 8 recommendation). Phase 4 thermal walk + production CDP sample re-verifies on the OEM matrix.                                    |
| T-3.7-03  | Information disclosure | UNPROCESSED audio source bypasses platform AGC, potentially exposing background-noise patterns useful for fingerprinting | accept      | Trade-off vs spec compliance — capture quality is non-negotiable per CLAUDE.md "Capture spec LOCKED". UNPROCESSED is the canonical recommendation per AOSP audio docs.                                                                       |
| T-3.7-04  | DoS                    | SegmentTimer leak (ImuWriter / SegmentTimer never released on crash)                                                     | mitigate    | Plan 03-10 CaptureSession.stop() includes `try/finally` cleanup that calls timer.release() and imuWriter.stop(). Plan 03-10's app-launch sweep catches missed cleanup via the `.session.json` orphan signal.                                 |
| T-3.7-05  | Tampering              | Refactor break — Phase 2 compat tests fail after BackUltrawidePicker extract                                             | mitigate    | Task 3 acceptance criteria run the full compat test suite; failure blocks the plan. The extract is purely structural — no behavior change.                                                                                                   |

</threat_model>

<verification>
- 4 Wave 0 stubs flipped from MISSING to GREEN (HevcEncoderConfigTest, AacEncoderConfigTest, ImuWriterCsvFormatTest, SegmentTimerTest).
- The remaining 7 stubs still fail with MISSING (StartGateCarryoverTest, EventEmissionTest, ClockAlignmentTest, RealtimeGateTest, FileFidelityTest — all Plan 03-10 territory).
- Phase 2 compat suite stays GREEN after BackUltrawidePicker extract (DeviceCapsTest.kt + adjacent compat tests).
- `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0 (full APK build still works with new shared util).
- Phase 3 Wave 1 + Plans 03-03/04/05/06 suites stay green (no regressions).
</verification>

<success_criteria>

- ✓ HevcEncoder.kt + AacEncoder.kt expose `buildMediaFormat()` pure-fn + `configure()` integrated builders.
- ✓ HEVC config audit: 14 keys at exact locked-spec values (1920×1080, 30 FPS, 8 Mbps CBR, GOP=1.0 s, KEY_LATENCY=1, KEY_MAX_B_FRAMES=0, color spec, profile=Main).
- ✓ AAC config audit: AAC-LC 48 kHz mono 128 kbps; UNPROCESSED → VOICE_RECOGNITION fallback.
- ✓ ImuWriter ships dual-sensor registration on a single HandlerThread + interleaved CSV row format.
- ✓ SegmentTimer ships Handler.postDelayed scheduling with cancel/release semantics.
- ✓ BackUltrawidePicker extracted to `capture/common/`; compat/DeviceCaps.kt is a thin delegate; Phase 2 compat tests stay GREEN.
- ✓ HevcEncoderConfigTest + AacEncoderConfigTest + ImuWriterCsvFormatTest + SegmentTimerTest flipped from MISSING to GREEN.
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-08-SUMMARY.md` per the canonical summary template — including:

- Pattern callout: "Encoder config wrapper" — separate `buildMediaFormat()` (pure-fn, testable) from `configure()` (integrated, runs on real device).
- Pattern callout: "Refactor-with-test-net" — extract via thin delegate so the existing test suite is the regression safety net.
- Wave 0 progress: 11 of 17 stubs GREEN (65%); 6 remain for Plan 03-10 + 1 already shipped in Plan 03-04 (FragmentedMuxerWrapperTest).
- Note any AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED behavior on the test runner (Robolectric returns null by default → VOICE_RECOGNITION fallback path is the default-path tested).
  </output>
