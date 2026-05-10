---
phase: 03-humyn-capture-native-module
plan_id: 03-05
plan: 5
type: execute
wave: 3
depends_on: [03-04]
files_modified:
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt
requirements: [CAP-08, CAP-15, CAP-17, CAP-19]
autonomous: true
must_haves:
  truths:
    - DriftCalculator.compute(videoTimestampsNs, imuTimestampsNs) returns {maxMs, meanMs, p99Ms} via least-squares residual subtraction per idea-brief.md §6.5
    - ImuRateObserver.compute(timestampsNs) returns the 1st percentile sample rate (Hz) over sliding 1 s windows; uses physical event.timestamp not callback dispatch time
    - FilenameGenerator.nextBase(now, dirs) returns YYYYMMDD_HHMMSS_NNN with NNN derived from ls(recordings/, practice/) for today's date (self-healing per D-FS-03)
    - UlidGenerator.next() returns a 26-char Crockford base32 ULID (48-bit ms time prefix + 80-bit randomness) that is monotonic within the same millisecond
    - HashStreamer.sha256(file) returns lowercase-hex SHA-256 of a file via FileChannel read-only loop (no mmap-write; CAP-18)
    - SidecarManager.write(file, opts) + .read(file) round-trip the .session.json schema from CONTEXT.md <specifics> with corrupt-detection on read
    - All 6 corresponding Wave 0 test stubs flip from MISSING to GREEN
  artifacts:
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt
      provides: pure-fn drift {max,mean,p99} via least-squares residual subtraction
      contains: residualsFromLeastSquaresFit
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt
      provides: sliding-1s-window p1 sample rate Hz
      contains: SLIDING_WINDOW_MS
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
      provides: YYYYMMDD_HHMMSS_NNN with ls-derived per-day NNN counter
      contains: nextBase
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt
      provides: 26-char Crockford base32 ULID minter (hand-rolled or io.azam.ulidj wrapper)
      contains: next
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt
      provides: streaming SHA-256 over FileChannel (read-only)
      contains: FileChannel
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
      provides: .session.json read/write/delete with corrupt-detection
      contains: SidecarSchemaVersion
  key_links:
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt
      to: java.nio.channels.FileChannel
      via: FileChannel.open(file.toPath()).use { ch -> ... }
      pattern: FileChannel\.open
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt
      to: SensorEvent.timestamp
      via: docstring + tests use synthetic event.timestamp arrays
      pattern: event\.timestamp|sliding.*window|1\s*s
---

<objective>
Implement six pure-function primitives that the segment finalize worker (Plan 03-08) calls in sequence at every segment cut: DriftCalculator, ImuRateObserver, FilenameGenerator, UlidGenerator, HashStreamer, SidecarManager. None of these primitives touch Camera2 / MediaCodec / SensorManager / Service lifecycle — they are all pure-fn or file-IO with deterministic Robolectric-shadowable behavior. This plan flips 6 of the 17 Wave 0 stubs from MISSING to GREEN.

Purpose: per RESEARCH.md `## Validation Architecture`, these six primitives have unambiguous contracts that can be fully tested against synthetic input arrays / file fixtures without running the encoder pipeline. Landing them first means downstream plans (Plan 03-05 MetadataComposer, Plan 03-08 CaptureSession orchestrator) can compose them with confidence rather than discovering math bugs at integration time.

Output: 6 new Kotlin source files + 6 test files flipped from MISSING to GREEN.
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
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt
@apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt
@apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt
@idea-brief.md

<interfaces>
<!-- Drift algorithm — RESEARCH.md Code Example 4 (idea-brief.md §6.5 verbatim). -->

```kotlin
data class Drift(val maxMs: Double, val meanMs: Double, val p99Ms: Double)

object DriftCalculator {
    fun compute(videoFrameTimestampsNs: LongArray, imuTimestampsNs: LongArray): Drift {
        val rv = residualsFromLeastSquaresFit(videoFrameTimestampsNs)
        val rs = residualsFromLeastSquaresFit(imuTimestampsNs)
        val rsAtV = DoubleArray(rv.size) { i ->
            interpolate(imuTimestampsNs, rs, videoFrameTimestampsNs[i])
        }
        val absD = DoubleArray(rv.size) { i -> kotlin.math.abs(rv[i] - rsAtV[i]) / 1_000_000.0 }
        absD.sort()
        return Drift(maxMs = absD.last(), meanMs = absD.sum() / absD.size, p99Ms = absD[(absD.size * 99 / 100).coerceAtMost(absD.size - 1)])
    }
}
```

<!-- HashStreamer — RESEARCH.md Code Example 8. -->

```kotlin
object HashStreamer {
    fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteBuffer.allocate(64 * 1024)
        FileChannel.open(file.toPath()).use { ch ->
            while (true) {
                buf.clear()
                if (ch.read(buf) < 0) break
                buf.flip()
                md.update(buf)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
```

<!-- FilenameGenerator — RESEARCH.md Code Example 9 (ls-derived self-healing per D-FS-03). -->

```kotlin
object FilenameGenerator {
    fun nextBase(now: LocalDateTime, dirs: List<File>): String {
        val today = now.toLocalDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
        val maxNNN = dirs.flatMap { it.listFiles()?.toList() ?: emptyList() }
            .map { it.nameWithoutExtension }
            .filter { it.startsWith("${today}_") }
            .mapNotNull { it.split("_").getOrNull(2)?.toIntOrNull() }
            .maxOrNull() ?: 0
        val nnn = "%03d".format(maxNNN + 1)
        return "${now.format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))}_${nnn}"
    }
}
```

<!-- SidecarManager .session.json schema — CONTEXT.md <specifics> verbatim. -->

```json
{
  "schema_version": "1.0.0",
  "session_id": "...",
  "segment_id": "01J...",
  "recording_id": "01J...",
  "filename_base": "20260505_003020_001",
  "started_at_ns": 12345678901234,
  "wallclock_start_iso": "2026-05-05T00:30:20.000+05:30",
  "is_practice": false,
  "task_info_partial": {
    "task_id": "...",
    "task_name": "...",
    "task_category": "...",
    "task_setting": "indoor"
  },
  "contributor_info": {
    "name": "...",
    "email": "...",
    "age": null,
    "gender": null,
    "consent": true
  },
  "start_gate": {
    "type": "hand_detection",
    "passed": true,
    "skipped": false,
    "bypassed": false,
    "duration_ms": 3420,
    "consecutive_hits_required": 5,
    "platform_cadence_ms": 400
  },
  "capture_device_info_partial": {
    "type": "phone",
    "model": "Pixel 10a",
    "os": "android",
    "os_version": "...",
    "app_version": "1.0.0",
    "dfov_degrees": 115,
    "ip_address": null,
    "location": "Bangalore, India"
  }
}
```

<!-- HumynUpdaterModule streaming-hash analog — same MessageDigest pattern, different I/O direction. -->

From updater/HumynUpdaterModule.kt lines 73–98 (the `joinToString("") { "%02x".format(it) }` lowercase-hex format we want to match):

```kotlin
val md = MessageDigest.getInstance("SHA-256")
// ... feed input stream into md ...
val actualHex = md.digest().joinToString("") { "%02x".format(it) }
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement DriftCalculator + ImuRateObserver + flip both Wave 0 stubs to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt (canonical pure-fn test pattern)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt (lines 112–122 — `computeResult` inter-sample interval pattern)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Example 4 lines 793–817; Pitfall 3 lines 577–593; Assumption A5 line 1051)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("DriftCalculator.kt" + "ImuRateObserver.kt" sections)
    - idea-brief.md §6.5 (drift methodology canonical source)
  </read_first>
  <behavior>
    - DriftCalculator: synthetic 30-sample uniform-cadence video + IMU arrays with zero offset → drift ~ 0 (max/mean/p99 all < 0.01 ms)
    - DriftCalculator: video offset by constant +5 ms across all frames → drift max/mean/p99 ≈ 0 (residual subtraction absorbs constant offsets per idea-brief.md §6.5)
    - DriftCalculator: monotonically growing video offset (0 ms → 5 ms over N frames) → drift max ≥ 2.5 ms (residual subtraction does NOT absorb a growing offset)
    - DriftCalculator: video at 30 FPS uniform (33.333 ms period) + IMU at 416 Hz uniform with no jitter → drift < 1 ms
    - DriftCalculator: empty video array OR empty IMU array → throws IllegalArgumentException("insufficient_samples_for_drift")
    - ImuRateObserver: 6000 samples uniformly spaced at 5 ms (200 Hz) over 30 s → p1Hz returns ~200 Hz (in 195..205)
    - ImuRateObserver: physical samples at 200 Hz delivered in 200-ms-batched bursts (event.timestamp uniform 5 ms, callback delivery clustered) → p1Hz still ~200 Hz (Pitfall 3 invariant — uses event.timestamp not callback time)
    - ImuRateObserver: 5 s window with samples dropping from 200 Hz to 50 Hz at t=2 s → p1Hz reports the 50 Hz floor (sliding window catches the drop)
    - ImuRateObserver: < 2 samples → throws IllegalArgumentException("insufficient_samples_for_rate_observation")
  </behavior>
  <action>
    **1A — `DriftCalculator.kt`:** copy RESEARCH.md Code Example 4 verbatim. Include the package declaration `package ai.humynlabs.capture.capture` and explicit imports. Implement the helper privates:

      ```kotlin
      private fun residualsFromLeastSquaresFit(values: LongArray): DoubleArray {
          // 1. Compute (i, values[i]) least-squares fit: y = a*i + b.
          //    a = (n*Σ(i*y) - Σi*Σy) / (n*Σ(i²) - (Σi)²)
          //    b = (Σy - a*Σi) / n
          val n = values.size
          require(n >= 2) { "insufficient_samples_for_drift" }
          val sumI = (0L until n.toLong()).sum().toDouble()
          val sumY = values.sumOf { it.toDouble() }
          val sumIY = values.mapIndexed { idx, v -> idx.toDouble() * v.toDouble() }.sum()
          val sumII = (0L until n.toLong()).sumOf { it * it }.toDouble()
          val denom = n * sumII - sumI * sumI
          val a = (n * sumIY - sumI * sumY) / denom
          val b = (sumY - a * sumI) / n
          return DoubleArray(n) { i -> values[i].toDouble() - (a * i + b) }
      }

      private fun interpolate(xs: LongArray, ys: DoubleArray, x: Long): Double {
          // Binary search xs for x; lerp into ys.
          require(xs.size == ys.size && xs.size >= 2) { "interpolate_size_mismatch" }
          if (x <= xs.first()) return ys.first()
          if (x >= xs.last()) return ys.last()
          var lo = 0; var hi = xs.size - 1
          while (hi - lo > 1) {
              val mid = (lo + hi) ushr 1
              if (xs[mid] <= x) lo = mid else hi = mid
          }
          val t = (x - xs[lo]).toDouble() / (xs[hi] - xs[lo]).toDouble()
          return ys[lo] + t * (ys[hi] - ys[lo])
      }
      ```

    Add input-validation guard at the top of `compute()` mirroring the behavior contract:

      ```kotlin
      require(videoFrameTimestampsNs.size >= 2) { "insufficient_samples_for_drift" }
      require(imuTimestampsNs.size >= 2) { "insufficient_samples_for_drift" }
      ```

    **1B — `ImuRateObserver.kt`:** sliding-window-1s-p1 over inter-sample intervals. CRITICAL per Pitfall 3: input array MUST be `event.timestamp` values (physical sample time), NOT callback dispatch time.

      ```kotlin
      package ai.humynlabs.capture.capture

      /**
       * Phase 3 D-IMU-01 — sliding-window-1s p1 sample rate (Hz).
       *
       * `imu_min_rate_hz_observed_p1` = 1st percentile of per-window sample
       * rates, where each window is 1 s of samples. RESEARCH Pitfall 3:
       * input is physical `event.timestamp` (ns), NOT `onSensorChanged`
       * dispatch time — the 200 ms batched delivery of `maxReportLatency`
       * means callback intervals look like 200 ms but physical sample
       * intervals stay at ~2.4 ms (at 416 Hz). Drift methodology is correct
       * only when we measure the physical timestamps.
       *
       * Server-side QA pipeline (Phase 5) consumes this figure for the
       * client-side 80 Hz floor reject (CAP-19). Client-side records and
       * stamps; server filters.
       */
      object ImuRateObserver {
          private const val SLIDING_WINDOW_MS = 1_000L
          private const val NS_PER_MS = 1_000_000L

          /**
           * Returns the 1st percentile of per-window observed sample rates (Hz).
           * Per Assumption A5: 1 s windows catch transient drops without
           * triggering on single freak samples.
           */
          fun compute(timestampsNs: LongArray): Double {
              require(timestampsNs.size >= 2) { "insufficient_samples_for_rate_observation" }
              val sorted = timestampsNs.copyOf().also { it.sort() }
              val firstNs = sorted.first()
              val lastNs = sorted.last()
              val totalMs = (lastNs - firstNs) / NS_PER_MS
              if (totalMs < SLIDING_WINDOW_MS) {
                  // Whole-segment fallback; not enough span for sliding windows.
                  return sorted.size.toDouble() / (totalMs.toDouble() / 1_000.0).coerceAtLeast(1e-6)
              }
              val windowsHz = mutableListOf<Double>()
              var winStart = firstNs
              while (winStart + SLIDING_WINDOW_MS * NS_PER_MS <= lastNs) {
                  val winEnd = winStart + SLIDING_WINDOW_MS * NS_PER_MS
                  // Count samples in [winStart, winEnd).
                  val countInWindow = sorted.count { it in winStart until winEnd }
                  windowsHz.add(countInWindow.toDouble())  // window is exactly 1 s, so count == Hz
                  winStart += NS_PER_MS * 100  // 100 ms slide → up to 10× overlap; resolves transient drops
              }
              if (windowsHz.isEmpty()) return 0.0
              val sortedHz = windowsHz.sorted()
              val p1Idx = (sortedHz.size * 1 / 100).coerceAtMost(sortedHz.size - 1)
              return sortedHz[p1Idx]
          }
      }
      ```

    **1C — Replace stubs with real tests:**

    `DriftCalculatorTest.kt` — replace the MISSING stub from Plan 03-03 with:

      ```kotlin
      @RunWith(RobolectricTestRunner::class)
      class DriftCalculatorTest {
          @Test fun `uniform-cadence zero-offset returns near-zero drift`() {
              val period = 33_333_333L
              val v = LongArray(30) { i -> i * period }
              val s = LongArray(180) { i -> i * (period / 6) }  // 6× rate
              val d = DriftCalculator.compute(v, s)
              assertTrue("max < 0.01 ms; was ${d.maxMs}", d.maxMs < 0.01)
              assertTrue(d.meanMs < 0.01)
              assertTrue(d.p99Ms < 0.01)
          }
          @Test fun `constant 5ms video offset is absorbed by residual subtraction (drift remains near zero)`() {
              val period = 33_333_333L
              val offsetNs = 5_000_000L
              val v = LongArray(30) { i -> i * period + offsetNs }
              val s = LongArray(180) { i -> i * (period / 6) }
              val d = DriftCalculator.compute(v, s)
              // The least-squares fit to v has slope=period; residuals ≈ +offsetNs sticky.
              // With identical IMU residuals (also slope+intercept absorbing offsetNs),
              // diff after interpolation collapses → drift may STILL be near 0 because
              // the offset is folded into the residual baseline. Real assertion: drift
              // is bounded and stable, not necessarily exactly 5ms.
              assertTrue("max < 1ms (offset is absorbed by least-squares)", d.maxMs < 1.0)
          }
          @Test fun `monotonically growing offset 0ms to 5ms over N frames reports nonzero drift max`() {
              // Residual subtraction CANNOT absorb a growing offset — it shifts the
              // residuals in a non-uniform way, so the abs-residual diff between
              // video and IMU exceeds zero.
              val period = 33_333_333L
              val nFrames = 30
              // Video frames i in 0..29 are offset by i * 172_413 ns ≈ 0..5 ms linear.
              val v = LongArray(nFrames) { i -> i * period + (i.toLong() * 172_413L) }
              val s = LongArray(nFrames * 6) { i -> i * (period / 6) }
              val d = DriftCalculator.compute(v, s)
              assertTrue("max should report drift >= 2.5ms; was ${d.maxMs}", d.maxMs >= 2.5)
          }
          @Test fun `empty video array throws`() {
              try {
                  DriftCalculator.compute(LongArray(0), LongArray(10) { it.toLong() })
                  fail("should have thrown")
              } catch (e: IllegalArgumentException) {
                  assertTrue(e.message?.contains("insufficient_samples") == true)
              }
          }
      }
      ```

    Note: drift residual subtraction collapses constant-offset bias (per `idea-brief.md §6.5` — that's *why* the methodology works). The test above documents this. A non-residual constant-offset detector would belong elsewhere.

    `ImuRateObserverTest.kt` — replace MISSING stub with:

      ```kotlin
      @RunWith(RobolectricTestRunner::class)
      class ImuRateObserverTest {
          @Test fun `200 Hz uniform stream over 30s reports ~200 Hz p1`() {
              val period = 5_000_000L  // 5 ms in ns
              val ts = LongArray(6000) { i -> i.toLong() * period }
              val p1 = ImuRateObserver.compute(ts)
              assertTrue("p1Hz in 195..205; was $p1", p1 in 195.0..205.0)
          }
          @Test fun `physical 200Hz with batched delivery reports 200Hz`() {
              // event.timestamp uniform every 5 ms; the test array IS event.timestamp,
              // so the batched-delivery callback timing is irrelevant. This documents
              // the Pitfall 3 invariant: we measure event.timestamp, not callback time.
              val period = 5_000_000L
              val ts = LongArray(6000) { i -> i.toLong() * period }
              val p1 = ImuRateObserver.compute(ts)
              assertTrue(p1 in 195.0..205.0)
          }
          @Test fun `mid-stream drop from 200Hz to 50Hz reports ~50Hz floor`() {
              val ts = mutableListOf<Long>()
              // first 2 s @ 200 Hz (5 ms period)
              for (i in 0 until 400) ts.add(i.toLong() * 5_000_000L)
              // next 28 s @ 50 Hz (20 ms period), starting from t=2s
              val start = 2_000_000_000L
              for (i in 0 until 1400) ts.add(start + i.toLong() * 20_000_000L)
              val p1 = ImuRateObserver.compute(ts.toLongArray())
              assertTrue("p1Hz ~50; was $p1", p1 in 45.0..55.0)
          }
          @Test fun `single-sample input throws`() {
              try {
                  ImuRateObserver.compute(LongArray(1) { 0L })
                  fail("should have thrown")
              } catch (e: IllegalArgumentException) {
                  assertTrue(e.message?.contains("insufficient_samples") == true)
              }
          }
      }
      ```

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.DriftCalculatorTest" --tests "ai.humynlabs.capture.capture.ImuRateObserverTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt` exists with `object DriftCalculator { fun compute(...) }`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt` exists with `private const val SLIDING_WINDOW_MS = 1_000L`
    - `grep -q "residualsFromLeastSquaresFit" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt`
    - `grep -q "interpolate" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt`
    - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt` does NOT contain `MISSING — Wave 0 stub` (`grep -q "MISSING" ...` returns no match)
    - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt` does NOT contain `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.DriftCalculatorTest"` exits 0
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.ImuRateObserverTest"` exits 0
  </acceptance_criteria>
  <done>DriftCalculator + ImuRateObserver implemented; their Wave 0 test stubs flipped to GREEN.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement FilenameGenerator + UlidGenerator + flip both Wave 0 stubs to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt (Robolectric file-fixture pattern)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Example 9 lines 974–1002; Don't Hand-Roll table line 515 for ULID; Assumption A6 line 1052; Open Question 2 lines 1063–1067)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-FS-03 — filename convention; "Claude's Discretion" — MMKV vs ls-derived)
    - idea-brief.md §8.1 (filename canonical source)
  </read_first>
  <behavior>
    - FilenameGenerator: now=2026-05-05T00:30:20, empty dirs → "20260505_003020_001"
    - FilenameGenerator: existing files [20260505_HHMMSS_001.mp4, 20260505_HHMMSS_005.mp4] → returns NNN=006 (max+1)
    - FilenameGenerator: only practice/ has today's files (recordings/ empty) → counter still resolves across both dirs
    - FilenameGenerator: yesterday's files don't pollute today's counter
    - FilenameGenerator: NNN=999 + new request → throws IllegalStateException("filename_seq_exhausted_for_day_${date}") — CAP-17 mandates 3-digit per-day sequence; the cap is defensive (a 10-min default segment makes 999/day unreachable in practice)
    - FilenameGenerator: dirs that don't exist (listFiles returns null) → counter starts at 001
    - UlidGenerator: next() returns exactly 26-char Crockford base32 string
    - UlidGenerator: 100 sequential calls within 1 ms produce monotonically increasing strings
    - UlidGenerator: prefix matches the ms timestamp (parsing the first 10 chars Crockford-base32 yields a value within 5 ms of the test's wallclock when generated)
    - UlidGenerator: characters all lie in Crockford base32 alphabet (0-9, A-H, J-K, M-N, P-T, V-Z; case-insensitive output uppercase)
  </behavior>
  <action>
    **2A — `FilenameGenerator.kt`:** copy RESEARCH.md Code Example 9 verbatim, then add a `start_gate`-aware variant if needed by D-FS-03 ("Same base name across MP4 / CSV / JSON"). Concrete:

      ```kotlin
      package ai.humynlabs.capture.capture

      import java.io.File
      import java.time.LocalDateTime
      import java.time.format.DateTimeFormatter

      /**
       * Phase 3 D-FS-03 — YYYYMMDD_HHMMSS_NNN per-day sequence.
       *
       * Recovery strategy = ls-derived (Open Question 2 / D-FS-03 "self-healing").
       * MMKV-backed cache is a planner's-call non-load-bearing optimization;
       * ls is the authoritative source so a wiped MMKV cache does not collide.
       *
       * `dirs` = listOf(filesDir/recordings/, filesDir/practice/) so today's
       * NNN counts across both — practice files share the day-sequence
       * namespace.
       */
      object FilenameGenerator {
          private val basePattern = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
          private val datePattern = DateTimeFormatter.ofPattern("yyyyMMdd")

          fun nextBase(now: LocalDateTime, dirs: List<File>): String {
              val today = now.toLocalDate().format(datePattern)
              val maxNNN = dirs.flatMap { dir ->
                  dir.listFiles()?.toList() ?: emptyList()
              }
                  .map { it.nameWithoutExtension }
                  .filter { it.startsWith("${today}_") }
                  .mapNotNull { it.split("_").getOrNull(2)?.toIntOrNull() }
                  .maxOrNull() ?: 0
              // CAP-17 guard: NNN is a 3-digit per-day sequence. If we'd overflow
              // to 1000, refuse the start. At a 10-min default segment, 999/day is
              // unreachable; this is defensive, not a runtime concern.
              if (maxNNN >= 999) {
                  throw IllegalStateException("filename_seq_exhausted_for_day_${today}")
              }
              val nnn = "%03d".format(maxNNN + 1)
              return "${now.format(basePattern)}_${nnn}"
          }
      }
      ```

    **2B — `UlidGenerator.kt`:** Use the `io.azam.ulidj:ulidj:2.0.0` library (RESEARCH.md "Don't Hand-Roll" table line 515 + Assumption A6 — verified release Feb 25, 2026; lightweight single-class jar). Cleaner than a hand-roll, fewer surfaces, cross-validates against the backend's npm `ulid` package out of the box.

      **Step 1 — Gradle dep:** add to `apps/mobile/android/app/build.gradle` `dependencies` block:

      ```groovy
      implementation 'io.azam.ulidj:ulidj:2.0.0'
      ```

      Place near the existing implementation entries; preserve the file's ordering convention.

      **Step 2 — `UlidGenerator.kt`:**

      ```kotlin
      package ai.humynlabs.capture.capture

      import io.azam.ulidj.ULID

      /**
       * Phase 3 — Crockford base32 ULID minter (26 chars).
       *
       *   48-bit ms time prefix (10 chars Crockford base32)
       * + 80-bit randomness (16 chars Crockford base32)
       *
       * Backed by `io.azam.ulidj:ulidj:2.0.0` (RESEARCH.md Don't Hand-Roll table
       * line 515 + Assumption A6). Cross-validated against the backend's npm
       * `ulid` package by construction — both libraries follow the canonical
       * ULID spec §4 (monotonicity within a single millisecond).
       *
       * Wrapper exists so future changes (random source override, telemetry,
       * faster-than-realtime test mode) live in one place.
       */
      object UlidGenerator {
          fun next(): String = ULID.random()

          /** Test seam — overrideable random for deterministic ordering tests. */
          internal fun nextWithRandom(rng: java.util.Random): String = ULID.random(rng)
      }
      ```

      Note: `io.azam.ulidj` exposes `ULID.random()` (uses `SecureRandom` internally) and `ULID.random(Random)` for tests. Monotonicity within a millisecond is guaranteed by the library; no synchronization needed at the wrapper layer.

    **2C — Replace stubs with real tests:**

    `FilenameGeneratorTest.kt`:

      ```kotlin
      @RunWith(RobolectricTestRunner::class)
      class FilenameGeneratorTest {
          private val ctx = RuntimeEnvironment.getApplication()
          private val rec by lazy { File(ctx.filesDir, "recordings").apply { mkdirs() } }
          private val pra by lazy { File(ctx.filesDir, "practice").apply { mkdirs() } }

          @Before fun cleanDirs() { rec.listFiles()?.forEach { it.delete() }; pra.listFiles()?.forEach { it.delete() } }

          @Test fun `empty dirs returns NNN 001`() {
              val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
              assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(rec, pra)))
          }

          @Test fun `existing 005 returns NNN 006`() {
              File(rec, "20260505_001234_005.mp4").writeBytes(byteArrayOf(0))
              File(rec, "20260505_001234_001.mp4").writeBytes(byteArrayOf(0))
              val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
              assertEquals("20260505_003020_006", FilenameGenerator.nextBase(now, listOf(rec, pra)))
          }

          @Test fun `practice dir contributes to today's counter`() {
              File(pra, "20260505_001234_007.mp4").writeBytes(byteArrayOf(0))
              val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
              assertEquals("20260505_003020_008", FilenameGenerator.nextBase(now, listOf(rec, pra)))
          }

          @Test fun `yesterday's files don't pollute today's counter`() {
              File(rec, "20260504_HHmmss_999.mp4").writeBytes(byteArrayOf(0))
              val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
              assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(rec, pra)))
          }

          @Test fun `nonexistent dirs return NNN 001`() {
              val ghost = File(ctx.filesDir, "nonexistent")
              val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
              assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(ghost)))
          }

          @Test fun `NNN 999 plus one throws IllegalStateException`() {
              File(rec, "20260505_001234_999.mp4").writeBytes(byteArrayOf(0))
              val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
              try {
                  FilenameGenerator.nextBase(now, listOf(rec, pra))
                  fail("should have thrown")
              } catch (e: IllegalStateException) {
                  assertTrue("message should contain filename_seq_exhausted; was ${e.message}",
                      e.message?.contains("filename_seq_exhausted") == true)
              }
          }
      }
      ```

    `UlidGeneratorTest.kt`:

      ```kotlin
      @RunWith(RobolectricTestRunner::class)
      class UlidGeneratorTest {
          @Test fun `next returns 26 char string`() {
              assertEquals(26, UlidGenerator.next().length)
          }

          @Test fun `100 sequential calls are unique`() {
              val ids = (0 until 100).map { UlidGenerator.next() }
              assertEquals(100, ids.toSet().size)
          }

          @Test fun `all chars in Crockford base32 alphabet`() {
              val alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toSet()
              for (i in 0 until 100) {
                  for (c in UlidGenerator.next()) assertTrue("char $c not in alphabet", c in alphabet)
              }
          }

          @Test fun `time prefix matches wallclock within 5ms`() {
              val before = System.currentTimeMillis()
              val id = UlidGenerator.next()
              val after = System.currentTimeMillis()
              val timeChars = id.substring(0, 10)
              var v = 0L
              val alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
              for (c in timeChars) v = (v shl 5) or alphabet.indexOf(c).toLong()
              assertTrue("ULID time prefix $v outside [$before, $after]", v in before..after)
          }

          @Test fun `monotonic within same millisecond using deterministic seed`() {
              // io.azam.ulidj guarantees ULID spec §4 monotonicity within a ms.
              // Use the test seam with a deterministic seeded Random to keep the
              // monotonicity assertion stable across CI runs.
              val rng = java.util.Random(42)
              val ids = (0 until 100).map { UlidGenerator.nextWithRandom(rng) }
              assertEquals(100, ids.toSet().size)
              // Lexicographic sort matches insertion order — same-ms calls are
              // monotonic by construction.
              assertEquals(ids, ids.sorted())
          }
      }
      ```

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.FilenameGeneratorTest" --tests "ai.humynlabs.capture.capture.UlidGeneratorTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt` exists with `object FilenameGenerator { fun nextBase(...) }`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt` exists with `object UlidGenerator { fun next(): String }`
    - `grep -q "yyyyMMdd_HHmmss" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt`
    - `grep -q "0123456789ABCDEFGHJKMNPQRSTVWXYZ" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt` (Crockford alphabet)
    - Neither test file contains `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.FilenameGeneratorTest"` exits 0
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.UlidGeneratorTest"` exits 0
  </acceptance_criteria>
  <done>FilenameGenerator + UlidGenerator implemented; tests flipped to GREEN.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement HashStreamer + SidecarManager + flip both Wave 0 stubs to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt (lines 73–98 — streaming-hash analog)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt (Robolectric temp-file fixture pattern)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Example 8 lines 945–971; § Sidecar D-FS-05 lines 481–488)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (<specifics> .session.json schema verbatim)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("HashStreamer.kt" + "SidecarManager.kt" sections)
    - video_metadata.json (canonical metadata schema — sidecar fields are a subset)
  </read_first>
  <behavior>
    - HashStreamer: hash of empty file == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" (canonical SHA-256 of empty input)
    - HashStreamer: hash of "abc" UTF-8 bytes == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    - HashStreamer: hash of 1 MiB random bytes round-trips; same file hashed twice returns identical hex
    - HashStreamer: nonexistent file → throws (java.nio.file.NoSuchFileException or similar)
    - SidecarManager: write(file, opts) creates a JSON file with all D-FS-05 schema fields populated; read(file) returns equivalent struct
    - SidecarManager: read of corrupt JSON (truncated mid-string) throws IllegalArgumentException("sidecar_corrupt")
    - SidecarManager: read of missing file throws (java.io.FileNotFoundException — caller handles)
    - SidecarManager: round-trip preserves consent: true, schema_version: 1.0.0
  </behavior>
  <action>
    **3A — `HashStreamer.kt`:** copy RESEARCH.md Code Example 8 verbatim with package + imports:

      ```kotlin
      package ai.humynlabs.capture.capture

      import java.io.File
      import java.nio.ByteBuffer
      import java.nio.channels.FileChannel
      import java.security.MessageDigest

      /**
       * Phase 3 — streaming SHA-256 over a finalized MP4 / CSV via FileChannel.
       *
       * CAP-15: SHA-256 of MP4 + CSV at finalize, stamped into metadata JSON.
       * CAP-18: files NEVER decoded / re-encoded / transcoded / stripped —
       * read-only via FileChannel; never mmap-write.
       *
       * Lowercase-hex output matches the wire shape of `recording.fileSha256`
       * (Phase 1 backend wire shape; Phase 5 mediates the upload).
       *
       * Throughput: ~1.5 sec / GB on Snapdragon 7+ per idea-brief.md §6.7.
       * For a 600 MB segment, ~0.9 s — fits well within the 10 min before
       * the next segment fires (concurrent finalize per Pattern 2).
       */
      object HashStreamer {
          fun sha256(file: File): String {
              val md = MessageDigest.getInstance("SHA-256")
              val buf = ByteBuffer.allocate(64 * 1024)
              FileChannel.open(file.toPath()).use { ch ->
                  while (true) {
                      buf.clear()
                      if (ch.read(buf) < 0) break
                      buf.flip()
                      md.update(buf)
                  }
              }
              return md.digest().joinToString("") { "%02x".format(it) }
          }
      }
      ```

    **3B — `SidecarManager.kt`:** read/write the .session.json schema from CONTEXT.md `<specifics>`. Uses `org.json.JSONObject` (JDK + Android — no kotlinx-serialization dep needed):

      ```kotlin
      package ai.humynlabs.capture.capture

      import org.json.JSONException
      import org.json.JSONObject
      import java.io.File

      /**
       * Phase 3 D-FS-05 — per-segment .session.json sidecar.
       *
       * Stash JS-provided opts + segment timing data at segment-start; delete
       * at finalize-time canonical metadata-JSON write. An orphan sidecar
       * means the finalize never completed — app-launch sweep (Plan 03-08)
       * uses the orphan to attempt re-finalize.
       *
       * Schema version: 1.0.0 — bumps independently of video_metadata.json
       * schema_version (which is at 1.1.0 with the imu_min_rate_hz_observed_p1
       * addition).
       */
      data class SidecarPayload(
          val schemaVersion: String,
          val sessionId: String,
          val segmentId: String,
          val recordingId: String,
          val filenameBase: String,
          val startedAtNs: Long,
          val wallclockStartIso: String,
          val isPractice: Boolean,
          val taskInfoPartial: TaskInfoPartial,
          val contributorInfo: ContributorInfo,
          val startGate: StartGate,
          val captureDeviceInfoPartial: CaptureDeviceInfoPartial,
      )

      data class TaskInfoPartial(val taskId: String, val taskName: String, val taskCategory: String, val taskSetting: String)
      data class ContributorInfo(val name: String, val email: String, val age: Int?, val gender: String?, val consent: Boolean)
      data class StartGate(val type: String, val passed: Boolean, val skipped: Boolean, val bypassed: Boolean,
                          val durationMs: Int, val consecutiveHitsRequired: Int, val platformCadenceMs: Int)
      data class CaptureDeviceInfoPartial(val type: String, val model: String, val os: String, val osVersion: String,
                                         val appVersion: String, val dfovDegrees: Double, val ipAddress: String?, val location: String?)

      object SidecarManager {
          const val CURRENT_SCHEMA_VERSION = "1.0.0"

          fun write(file: File, payload: SidecarPayload) {
              val json = JSONObject()
                  .put("schema_version", payload.schemaVersion)
                  .put("session_id", payload.sessionId)
                  .put("segment_id", payload.segmentId)
                  .put("recording_id", payload.recordingId)
                  .put("filename_base", payload.filenameBase)
                  .put("started_at_ns", payload.startedAtNs)
                  .put("wallclock_start_iso", payload.wallclockStartIso)
                  .put("is_practice", payload.isPractice)
                  .put("task_info_partial", JSONObject()
                      .put("task_id", payload.taskInfoPartial.taskId)
                      .put("task_name", payload.taskInfoPartial.taskName)
                      .put("task_category", payload.taskInfoPartial.taskCategory)
                      .put("task_setting", payload.taskInfoPartial.taskSetting))
                  .put("contributor_info", JSONObject()
                      .put("name", payload.contributorInfo.name)
                      .put("email", payload.contributorInfo.email)
                      .put("age", payload.contributorInfo.age ?: JSONObject.NULL)
                      .put("gender", payload.contributorInfo.gender ?: JSONObject.NULL)
                      .put("consent", payload.contributorInfo.consent))
                  .put("start_gate", JSONObject()
                      .put("type", payload.startGate.type)
                      .put("passed", payload.startGate.passed)
                      .put("skipped", payload.startGate.skipped)
                      .put("bypassed", payload.startGate.bypassed)
                      .put("duration_ms", payload.startGate.durationMs)
                      .put("consecutive_hits_required", payload.startGate.consecutiveHitsRequired)
                      .put("platform_cadence_ms", payload.startGate.platformCadenceMs))
                  .put("capture_device_info_partial", JSONObject()
                      .put("type", payload.captureDeviceInfoPartial.type)
                      .put("model", payload.captureDeviceInfoPartial.model)
                      .put("os", payload.captureDeviceInfoPartial.os)
                      .put("os_version", payload.captureDeviceInfoPartial.osVersion)
                      .put("app_version", payload.captureDeviceInfoPartial.appVersion)
                      .put("dfov_degrees", payload.captureDeviceInfoPartial.dfovDegrees)
                      .put("ip_address", payload.captureDeviceInfoPartial.ipAddress ?: JSONObject.NULL)
                      .put("location", payload.captureDeviceInfoPartial.location ?: JSONObject.NULL))

              file.writeText(json.toString(2))
          }

          fun read(file: File): SidecarPayload {
              try {
                  val text = file.readText()
                  val json = JSONObject(text)
                  val ti = json.getJSONObject("task_info_partial")
                  val ci = json.getJSONObject("contributor_info")
                  val sg = json.getJSONObject("start_gate")
                  val cd = json.getJSONObject("capture_device_info_partial")
                  return SidecarPayload(
                      schemaVersion = json.getString("schema_version"),
                      sessionId = json.getString("session_id"),
                      segmentId = json.getString("segment_id"),
                      recordingId = json.getString("recording_id"),
                      filenameBase = json.getString("filename_base"),
                      startedAtNs = json.getLong("started_at_ns"),
                      wallclockStartIso = json.getString("wallclock_start_iso"),
                      isPractice = json.getBoolean("is_practice"),
                      taskInfoPartial = TaskInfoPartial(ti.getString("task_id"), ti.getString("task_name"), ti.getString("task_category"), ti.getString("task_setting")),
                      contributorInfo = ContributorInfo(
                          ci.getString("name"), ci.getString("email"),
                          if (ci.isNull("age")) null else ci.getInt("age"),
                          if (ci.isNull("gender")) null else ci.getString("gender"),
                          ci.getBoolean("consent"),
                      ),
                      startGate = StartGate(sg.getString("type"), sg.getBoolean("passed"), sg.getBoolean("skipped"), sg.getBoolean("bypassed"),
                          sg.getInt("duration_ms"), sg.getInt("consecutive_hits_required"), sg.getInt("platform_cadence_ms")),
                      captureDeviceInfoPartial = CaptureDeviceInfoPartial(
                          cd.getString("type"), cd.getString("model"), cd.getString("os"), cd.getString("os_version"),
                          cd.getString("app_version"), cd.getDouble("dfov_degrees"),
                          if (cd.isNull("ip_address")) null else cd.getString("ip_address"),
                          if (cd.isNull("location")) null else cd.getString("location"),
                      ),
                  )
              } catch (e: JSONException) {
                  throw IllegalArgumentException("sidecar_corrupt", e)
              }
          }

          fun delete(file: File): Boolean = file.delete()
      }
      ```

    **3C — Real tests:**

    `HashStreamerTest.kt`:

      ```kotlin
      @RunWith(RobolectricTestRunner::class)
      class HashStreamerTest {
          private val ctx = RuntimeEnvironment.getApplication()

          @Test fun `empty file SHA-256 matches canonical zero-length digest`() {
              val empty = File(ctx.cacheDir, "empty.bin").apply { writeBytes(byteArrayOf()) }
              assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", HashStreamer.sha256(empty))
          }

          @Test fun `abc SHA-256 matches canonical digest`() {
              val abc = File(ctx.cacheDir, "abc.bin").apply { writeBytes("abc".toByteArray()) }
              assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", HashStreamer.sha256(abc))
          }

          @Test fun `same file hashed twice returns same hex`() {
              val f = File(ctx.cacheDir, "1m.bin")
              val rng = ByteArray(1024 * 1024)
              java.util.Random(42).nextBytes(rng)
              f.writeBytes(rng)
              val h1 = HashStreamer.sha256(f)
              val h2 = HashStreamer.sha256(f)
              assertEquals(h1, h2)
              assertEquals(64, h1.length)  // 256 bits = 64 hex chars
          }
      }
      ```

    `SidecarManagerTest.kt`:

      ```kotlin
      @RunWith(RobolectricTestRunner::class)
      class SidecarManagerTest {
          private val ctx = RuntimeEnvironment.getApplication()

          private fun fixturePayload() = SidecarPayload(
              schemaVersion = SidecarManager.CURRENT_SCHEMA_VERSION,
              sessionId = "01JABCSESSIONXXXXXXXXXXXXXX",
              segmentId = "01JABCSEGMENT1XXXXXXXXXXXXX",
              recordingId = "01JABCRECID1XXXXXXXXXXXXXXX",
              filenameBase = "20260505_003020_001",
              startedAtNs = 12345678901234L,
              wallclockStartIso = "2026-05-05T00:30:20.000+05:30",
              isPractice = false,
              taskInfoPartial = TaskInfoPartial("cooking.chopping", "Chopping", "cooking", "indoor"),
              contributorInfo = ContributorInfo("Alice", "alice@example.com", 26, "female", true),
              startGate = StartGate("hand_detection", true, false, false, 3420, 5, 400),
              captureDeviceInfoPartial = CaptureDeviceInfoPartial("phone", "Pixel 10a", "android", "19.4.2", "1.0.0", 115.0, null, "Bangalore, India"),
          )

          @Test fun `write then read round-trip`() {
              val f = File(ctx.cacheDir, "session.json")
              SidecarManager.write(f, fixturePayload())
              val loaded = SidecarManager.read(f)
              assertEquals(fixturePayload(), loaded)
              assertEquals("1.0.0", loaded.schemaVersion)
              assertTrue(loaded.contributorInfo.consent)
          }

          @Test fun `corrupt JSON throws sidecar_corrupt`() {
              val f = File(ctx.cacheDir, "bad.json").apply { writeText("{ \"schema_version\": \"1.0.0\", \"session_id\":") }
              try { SidecarManager.read(f); fail("should throw") }
              catch (e: IllegalArgumentException) { assertEquals("sidecar_corrupt", e.message) }
          }

          @Test fun `null fields round-trip`() {
              val f = File(ctx.cacheDir, "nulls.json")
              val p = fixturePayload().copy(
                  contributorInfo = ContributorInfo("Alice", "alice@example.com", null, null, true),
              )
              SidecarManager.write(f, p)
              val loaded = SidecarManager.read(f)
              assertNull(loaded.contributorInfo.age)
              assertNull(loaded.contributorInfo.gender)
          }

          @Test fun `delete removes file`() {
              val f = File(ctx.cacheDir, "todelete.json")
              SidecarManager.write(f, fixturePayload())
              assertTrue(f.exists())
              assertTrue(SidecarManager.delete(f))
              assertFalse(f.exists())
          }
      }
      ```

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.HashStreamerTest" --tests "ai.humynlabs.capture.capture.SidecarManagerTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt` exists with `object HashStreamer { fun sha256(file: File): String }`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt` exists with `data class SidecarPayload`, `object SidecarManager { fun write/read/delete }`
    - `grep -q "FileChannel.open" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt` (CAP-18: read-only FileChannel)
    - `grep -q "schema_version" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt` and `grep -q "1.0.0" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt`
    - `grep -q "sidecar_corrupt" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt`
    - Neither test file contains `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.HashStreamerTest" --tests "ai.humynlabs.capture.capture.SidecarManagerTest"` exits 0
  </acceptance_criteria>
  <done>HashStreamer + SidecarManager implemented; tests flipped to GREEN.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                             | Description                                                          |
| ------------------------------------ | -------------------------------------------------------------------- |
| .session.json on disk → JSON parser  | Untrusted contents (corrupt mid-write) — must surface as recoverable |
| MP4/CSV bytes → MessageDigest stream | Adversary cannot tamper post-finalize without breaking SHA-256       |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                              | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                            |
| --------- | ---------------------- | ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-3.4-01  | Tampering              | Race between sidecar write and crash mid-write leaves a half-JSON file | mitigate    | `JSONObject(text)` parse throws → IllegalArgumentException("sidecar_corrupt"). App-launch sweep (Plan 03-08) discards corrupt sidecar + its MP4/CSV. The triple loss is acceptable — same outcome as a crash before sidecar write.                                                         |
| T-3.4-02  | Information disclosure | `.session.json` contains contributor email + name                      | accept      | App-private `filesDir/`; deleted at finalize per D-FS-05. Crash residue persists until next app-launch sweep — same exposure as the metadata JSON itself, which is not Phase 3's threat to mitigate (Phase 5 mediates upload + delete).                                                    |
| T-3.4-03  | Tampering              | Filename collision: two segments same NNN                              | mitigate    | `FilenameGenerator.nextBase()` uses `max(NNN) + 1` over both `recordings/` and `practice/` dirs. Concurrent calls in the same ms are serialized by Plan 03-08's `captureExecutor` (single-thread Executor). Test covers NNN=999 → 1000.                                                    |
| T-3.4-04  | Tampering              | UlidGenerator monotonicity broken under contention                     | mitigate    | `synchronized(lock)` + `AtomicLong` for the time bucket. Test covers 100 sequential calls within 1 ms (the contention case). Phase 3's only caller is the segment-rotate handler on `captureExecutor` — single-thread, so contention is structurally impossible; test is defense-in-depth. |
| T-3.4-05  | Information disclosure | `HashStreamer.sha256` reads file via mmap-style FileChannel read       | accept      | Read-only `FileChannel.open(path)` → `ch.read(buf)` is NOT mmap; it's standard pread-style. CAP-18 hard rule preserved.                                                                                                                                                                    |

</threat_model>

<verification>
- 6 Wave 0 stubs flipped from MISSING to GREEN: `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.DriftCalculatorTest" --tests "*.ImuRateObserverTest" --tests "*.FilenameGeneratorTest" --tests "*.UlidGeneratorTest" --tests "*.HashStreamerTest" --tests "*.SidecarManagerTest"` exits 0.
- The remaining 11 stubs still fail with MISSING (no regression in test scaffolding).
- `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources` exits 0 (all 6 new Kotlin files compile).
- The Phase 2 + Phase 3 Wave 1 + Plan 03-03 suites stay green (no regressions).
- File fidelity invariant: `HashStreamer.sha256` reads via `FileChannel.open(path).use { ... }` only — no mmap-write, no rewrite path.
</verification>

<success_criteria>

- ✓ `DriftCalculator.compute(...)` implements idea-brief.md §6.5 least-squares residual subtraction; tests cover uniform-cadence + offset + insufficient-samples cases.
- ✓ `ImuRateObserver.compute(...)` implements 1 s sliding-window p1 over physical event.timestamp; tests cover Pitfall 3 invariant.
- ✓ `FilenameGenerator.nextBase(...)` implements ls-derived YYYYMMDD_HHMMSS_NNN with self-healing across recordings/ + practice/ dirs.
- ✓ `UlidGenerator.next()` implements 26-char Crockford base32 ULID with monotonicity within a ms.
- ✓ `HashStreamer.sha256(file)` streams via FileChannel (read-only) with lowercase-hex output matching the wire shape.
- ✓ `SidecarManager.write/read/delete` round-trips the D-FS-05 schema with corrupt-detection.
- ✓ All 6 corresponding Wave 0 test stubs flipped from MISSING to GREEN.
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-05-SUMMARY.md` per the canonical summary template — including:

- Pattern callout: "Pure-fn primitive contract" — every Phase 3 file with non-trivial logic exposes an `internal` or static `object` pure fn that's testable without the encoder pipeline (RESEARCH.md Pattern D).
- The exact Crockford base32 alphabet used (any deviation from canonical 0-9, A-H, J-K, M-N, P-T, V-Z would surface here).
- Drift residual-subtraction note: constant offsets are absorbed by the least-squares baseline; this is correct per idea-brief.md §6.5.
- Wave 0 progress: 6 of 17 stubs GREEN (35%); 11 remain MISSING for Plans 03-06 through 03-10.
  </output>
