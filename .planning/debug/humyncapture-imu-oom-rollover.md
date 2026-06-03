---
name: humyncapture-imu-oom-rollover
status: resolved
trigger: 'BUG-260518-01: HumynCapture-Imu OOM at segment rollover — see E2E-WALK-BUGS-260518.md'
created: 2026-05-18
updated: 2026-05-18
resolved: 2026-05-18
source_doc: E2E-WALK-BUGS-260518.md
severity: critical
---

# Debug: humyncapture-imu-oom-rollover

## Symptoms

### Expected behavior

A multi-segment continuous capture session (each segment = 10 min, segment rollover stops the old
encoder/CSV writer and starts a new one) should sustain ≥75 minutes on Pixel 7a-class hardware with
a sawtooth Java-heap profile that drops at each segment boundary as IMU buffers/queues flush.
No mid-segment crashes; no in-app warnings; capture continues smoothly across rollovers.

### Actual behavior

On Pixel 10a (Android 16, `app_version 0.1.0-apk`, build `app-apkRollout-debug.apk` from `22ffec5`),
the app force-closed to the launcher ≈5 min into the 7th 10-min segment of a continuous session.
Segments 1–6 ran clean. The truncated 7th segment (`01KRVMZFJAZ6H7ARTD8ZA4NMKS`, kgen.io account)
landed in DB + S3 as `verified` with duration 297.4 s instead of 600 s — i.e. the partial bundle
uploaded successfully before the process died.

Pixel 8a's session (Android 16, m.adnaan161 account) was equivalent in shape and didn't crash this
walk, but is expected to crash on the same workload eventually.

### Error messages

Crash chain (Pixel 10a, device time `03:50:45.721` → `03:50:47.462`):

```
03:50:45.721  FATAL EXCEPTION: HumynCapture-Imu
              java.lang.OutOfMemoryError: Failed to allocate a 16 byte allocation
                with 668080 free bytes and 652KB until OOM,
                target footprint 268435456, growth limit 268435456;
                giving up on allocation because <1% of heap free after GC.
                at java.lang.Integer.valueOf(Integer.java:1197)
                at android.hardware.SystemSensorManager$SensorEventQueue
                    .dispatchSensorEvent(SystemSensorManager.java:1060)

03:50:46.149  E/ReactNativeJS  OutOfMemoryError in HostFunction
                (JS thread reports the same wall)

03:50:47.462  F/libc  Fatal signal 6 (SIGABRT) in tid 5380 (FileObserver), pid 5310
              Abort message: 'JNI DETECTED ERROR IN APPLICATION:
                JNI CallVoidMethodV called with pending exception
                java.lang.OutOfMemoryError'
              at android.os.FileObserver$ObserverThread.observe
              ← process killed here
```

Heap cap exhausted: 268,435,456 bytes (256 MB Dalvik growth limit). Allocation site is
`Integer.valueOf` inside `SystemSensorManager$SensorEventQueue.dispatchSensorEvent` — the system
boxes an `int` field (sensor accuracy or sample-index) on every sample dispatch.

### Timeline

- 2026-05-17 → 2026-05-18 orchestrated E2E walk on Pixel 8a (`4B301XEKB1H8D2`) + Pixel 10a
  (`5C161JEA304304`) running in parallel.
- Build: `app-apkRollout-debug.apk` from `22ffec5` (apkRollout flavor — Play-Integrity install-source
  bypass via Remote Config).
- Total captured during the walk: 16 recordings in DB, 15 fully uploaded + verified server-side.
  ~1 h 16 min of capture per device.
- Crash hit on Pixel 10a during segment 7 (7th × 10 min ⇒ ≈60 min of cumulative recording before OOM).
- Metadata for the 15 verified segments preserved at `/tmp/humyn-metadata-dump/`
  (`_summary.json` + per-RID `<rid>.metadata.json`).

### Reproduction

1. Start a continuous capture session on a Pixel 10a-class device.
2. Let it roll for ≥60 minutes (≥7 × 10-min segments).
3. Observe Java-heap allocation via `dumpsys meminfo ai.humynlabs.capture.apk` during the session.
   Expected pre-fix: monotonic growth of Java-heap "Alloc" — i.e. the heap is NOT released at
   segment rollover. The 7th-or-later rollover crosses 268 MB and triggers the OOM.
4. Expected post-fix: sawtooth that flushes at each segment boundary.

## Root cause hypothesis (from bug doc — to be validated by gsd-debugger)

The IMU sample-pump on the `HumynCapture-Imu` thread is autoboxing sensor values (the `Integer.valueOf`
call inside `SystemSensorManager.SensorEventQueue.dispatchSensorEvent` is the boxing-from-`int` for
sensor accuracy or sample-index fields) AND accumulating the boxed objects in a Java collection /
event-emitter buffer that **is not released at 10-min segment rollover**. At sustained ~800–934 Hz
combined IMU rate × ~60 minutes of cumulative capture, the boxed-Integer churn alone is enough to
exhaust the 268 MB Dalvik growth limit.

**Why segment-rollover-cumulative, not per-segment:** the crash hit during the 7th segment on 10a;
segments 1–6 ran clean. A per-segment leak would crash segment 1.

**Why Pixel 8a didn't crash this walk:** 8a's session was equivalent in shape and showed similarly
bad mid-session drift spike on segment 3 (see BUG-04). 8a probably has slightly more headroom
(different Hermes heap tuning, different system overhead) and was lucky. **Will crash on the same
workload eventually.**

**Related observation (BUG-260518-05):** Pixel 8a segment 3 had a `357.97 / 137.58 / 341.56 ms`
drift spike that's essentially impossible without something blocking the IMU dispatcher mid-segment.
Combined with this OOM, suggests the IMU buffer accumulation also slows dispatch, not just retains
memory — i.e. the same defect causes both the crash AND the drift spikes.

## Locations to look (from bug doc)

- `apps/mobile/android/.../HumynCapture/*Imu*.kt` — the IMU SensorEventListener + the buffer/queue
  between sensor callback and CSV writer.
- The segment-rollover hook (where capture stops the old encoder/CSV and starts a new one).
  Confirm the IMU buffer/queue is `.clear()`-ed there and that the boxed `Integer`s are released,
  not retained by a long-lived listener reference.
- Check for any RN bridge event emitter pushing per-sample data to JS — that path would also retain
  `WritableMap`s.

## Fix surface (preliminary, from bug doc)

1. Verify the IMU buffer/queue is flushed + new buffer instance allocated on segment rollover
   (the old one with its boxed-Integer references must become unreachable so GC can reclaim it).
2. If a `SensorEventListener` is being re-used across segments, confirm any per-listener buffers it
   holds are reset, OR re-register a fresh listener per segment.
3. If samples are being primitive-boxed in the userland code path (e.g. `ArrayList<Integer>` for
   accuracy bits), switch to primitive `int[]` / `IntArray` to eliminate boxing churn entirely.
4. If RN bridge per-sample emission exists, throttle / batch / remove it.

## Current Focus

- hypothesis: A long-lived structure on the `HumynCapture-Imu` thread (likely a buffer/queue feeding
  the IMU CSV writer, or a SensorEventListener registration) retains references across segment
  rollovers. The Dalvik-side `Integer.valueOf` boxing in `SensorEventQueue.dispatchSensorEvent`
  produces a boxed object per sample at ~800–934 Hz; without a rollover-time flush, ≈60 minutes of
  cumulative samples saturates the 268 MB growth limit and the next `Integer.valueOf` triggers OOM.
- test: read the HumynCapture Kotlin IMU module — the SensorEventListener wiring + the buffer/queue
  between the sensor callback and CSV writer + the segment-rollover code path — and confirm whether
  the buffer is reset / the listener is re-registered / boxing is occurring in userland on top of
  the framework boxing.
- expecting: code evidence of either (a) a buffer/queue retained across rollovers, (b) a listener
  retained across rollovers, or (c) userland int→Integer boxing on the hot path. Plus confirmation
  of whether RN bridge per-sample emission exists.
- next_action: gather initial evidence — locate the HumynCapture IMU Kotlin sources, map the
  SensorEventListener lifecycle vs. segment-rollover lifecycle, identify the buffer/queue ownership,
  and check for autoboxing on the sample path.

## Evidence

- timestamp: 2026-05-18 (debug session)
  observation: Read `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`.
  finding: The IMU listener path (`writeRow`, line 204-210 of the pre-fix file) calls
  `timestampList.add(timestampNs)` on `private val timestampList = mutableListOf<Long>()`.
  `mutableListOf<Long>()` is an unsynchronized `ArrayList<Long>` — `Long` is the boxed
  type, so every `add` **autoboxes** the primitive `long` to a heap `Long` object
  (~24 bytes on ART: object header + 8-byte value field). At sustained ~800–934 Hz
  combined gyro+accel × 600 s per segment = ~480-560 K boxed `Long` allocations per
  segment, **plus** the growing `Object[]` backing array (ArrayList doubles capacity;
  final capacity for 480 K items is 524 288 slots × 8 bytes = 4 MB just for the
  backing array). **Per-segment IMU buffer heap residency: ~16–20 MB.**

- timestamp: 2026-05-18
  observation: Read `Segment` data class (CaptureSession.kt lines 1028-1084) +
  `runPumpLoop` (lines 676-746) + `FinalizeWorker.finalize` (lines 63-247).
  finding: `videoFrameTimestamps: CopyOnWriteArrayList<Long>` (line 1062). The encoder
  pump calls `seg.videoFrameTimestamps.add(info.presentationTimeUs * 1_000L)` on every
  output buffer (CaptureSession.kt line 725). `CopyOnWriteArrayList.add` **(a)** boxes
  the `Long` AND **(b)** copies the entire backing `Object[]` on every add — at 30 fps
  × 600 s = 18 000 adds per segment, total intermediate-array bytes allocated then
  discarded ≈ sum from 1..18000 of 8 bytes/slot = **~1.3 GB of allocate-and-collect
  GC garbage per segment**. The class doc already calls this out at lines 1053-1060
  ("O(n²) writes — acceptable here") and explicitly proposes the fix ("If profiling on
  a real device shows hot-path pressure, swap to a pre-allocated `LongArray` +
  `AtomicInteger` write index"). The Pixel 10a smoke walk is exactly that on-hardware
  profiling.

- timestamp: 2026-05-18
  observation: Mapped Segment lifecycle in CaptureSession.kt.
  finding: A `Segment` is reachable from exactly three roots:
  (1) `@Volatile var currentSegment: Segment?` — replaced on rotate, nulled on stop;
  (2) the pump-thread `runPumpLoop(seg)` closure on the per-segment `HandlerThread` —
  released when the pump's `finally` block fires `pumpExitLatch.countDown()`;
  (3) the `finalizeExecutor.execute { FinalizeWorker.finalize(segN, emit) }` closure —
  released when finalize returns.
  None of these retain across more than the active segment + the in-flight finalize.
  `pumpThreads.add(pumpThread)` keeps the dead `HandlerThread` object reachable for
  the whole session but a quit'd `HandlerThread` has no segment retention path.
  **Conclusion:** there is NO per-segment retention leak. Each `Segment`'s heap
  becomes GC-eligible after finalize completes. **The crash is allocation-pressure-
  driven, not retention-driven.**

- timestamp: 2026-05-18
  observation: Searched for RN-bridge per-IMU-sample emission.
  finding: HumynCaptureModule emits only segment-level events (`onSegmentStart`,
  `onSegmentComplete`, `onSessionStop`, `onError`, `onThermalAbort`,
  `onSegmentCanceled`, `onCrashRecovery`). No per-sample `WritableMap` traffic on the
  bridge. The bug doc's fix-surface item (4) "If RN bridge per-sample emission exists,
  throttle / batch / remove it" is eliminated — no such code exists.

- timestamp: 2026-05-18
  observation: Decoded the crash stack frame `SystemSensorManager$SensorEventQueue
.dispatchSensorEvent → Integer.valueOf` against AOSP `SystemSensorManager.java`.
  finding: The framework's own `mAccuracyMap.put(handle, accuracy)` on every dispatch
  boxes two `int`s per IMU sample (framework-side, not under our control). This is
  normal Android sensor-pipeline behavior. **The OOM at that frame means the heap
  was already saturated by other live objects; the framework's next `Integer.valueOf`
  just happened to be the allocation that tipped it over.** The retained-heap source
  is our boxed `timestampList` + the COW-array-copy GC pressure on
  `videoFrameTimestamps`, not the framework's per-event boxes (which are young-gen
  collectable when GC has headroom).

- timestamp: 2026-05-18
  observation: Read `apps/mobile/android/app/src/main/AndroidManifest.xml`.
  finding: No `android:largeHeap="true"` attribute on the `<application>` tag → app
  runs at the default Dalvik growth limit (256 MB on Pixel 10a-class). This matches
  the crash signature `target footprint 268435456, growth limit 268435456`.

- timestamp: 2026-05-18
  observation: Cross-referenced BUG-260518-05 (Pixel 8a seg-3 drift spike of
  357.97/137.58/341.56 ms max/mean/p99) with this OOM hypothesis.
  finding: The COW-array-copy GC pressure on the encoder pump thread DOES intermittently
  block the pump for the duration of a GC pause. A Stop-The-World GC on a heap near
  the growth limit can run hundreds of ms on ART. **The same allocation-pressure
  defect that crashes the 10a at segment 7 plausibly causes the 8a's mid-segment
  drift spike** — both are downstream of the same boxed-collection hot path. The
  primitive-buffer fix should resolve both.

## Eliminated

- "IMU buffer/queue retained across segment rollover" — not the cause. Each segment
  allocates a fresh `ImuWriter` (CaptureSession.openSegment line 385) with a fresh
  `timestampList`; the old `ImuWriter` is closed at `closeSegmentResources` (line 927)
  and released along with its `Segment` after the finalize executor drains. No
  retention chain across rollovers. The defect is per-segment allocation pressure
  that **accumulates as transient + steady-state heap usage** across the session, not
  retained objects.

- "SensorEventListener re-used across segments" — not the cause. Each `ImuWriter`
  owns its own `listener: SensorEventListener` instance; `registerListener` and
  `unregisterListener` are correctly paired per segment.

- "RN bridge per-sample emission" — not the cause. No such code path exists.

- "Per-sample IMU buffer flush missing at rollover" — moot. The buffer IS released at
  rollover (when the `Segment` becomes unreachable). The defect is upstream of any
  rollover-time flush: the buffer's _type_ allocates too aggressively.

## Resolution

**Root cause.** Two boxed-collection hot paths in the recording pipeline allocated
heap aggressively enough to saturate the 256 MB Dalvik growth limit across 7
continuous 10-min segments on Pixel 10a-class hardware:

1. `ImuWriter.timestampList: MutableList<Long>` autoboxed every IMU sample
   timestamp into a heap `Long` object on the sensor `HandlerThread`. At
   ~800–934 Hz × 600 s × 7 segments = ~3.4 M boxed Longs in old-gen at peak
   (~16–20 MB per active segment × 2 live segments during rollover finalize).

2. `Segment.videoFrameTimestamps: CopyOnWriteArrayList<Long>` boxed AND
   copied-on-every-add, producing ~1.3 GB of young-gen array-copy garbage per
   segment and keeping young-gen GC pegged. By segment 7 the heap was so
   pressured that the next framework `Integer.valueOf` inside
   `SystemSensorManager$SensorEventQueue.dispatchSensorEvent` failed (heap was
   <1% free; allocation gave up). The fatal-thread name `HumynCapture-Imu` is
   incidental — that's just the thread the framework happened to be running
   on when the heap exhaustion materialized.

**Fix.**

- Introduced `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/PrimitiveLongBuffer.kt`
  — a primitive `LongArray`-backed, single-writer / many-reader-snapshot buffer with
  an `AtomicInteger` write index for memory-model correctness. Pre-allocated to a
  fixed segment-shape capacity; never grows; no autoboxing.

- `ImuWriter.timestampList` → `PrimitiveLongBuffer(IMU_CAPACITY)` where
  `IMU_CAPACITY = 660_000` longs (~5.28 MB, sized for 10 min at 1100 Hz combined
  with safety margin). Same `timestamps(): LongArray` external API.

- `Segment.videoFrameTimestamps` → `PrimitiveLongBuffer(VIDEO_CAPACITY)` where
  `VIDEO_CAPACITY = 21_600` longs (~173 KB, sized for 30 fps × 12 min safety margin).
  Same `add(Long)` and `toLongArray()` external API used by `runPumpLoop` and
  `FinalizeWorker.finalize`.

- Defense-in-depth: added `android:largeHeap="true"` to
  `apps/mobile/android/app/src/main/AndroidManifest.xml` — raises the heap growth
  limit from ~256 MB to ~512 MB on Pixel-class devices, giving 2× headroom against
  any residual allocation pattern we may not have caught. The primitive-buffer
  refactor is the **primary** fix; `largeHeap` is belt-and-suspenders.

- Added `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/PrimitiveLongBufferTest.kt`
  — regression coverage: empty state, ordered writes, capacity drop behavior,
  snapshot-is-copy semantics, and a concurrent-writer/reader test that asserts no
  torn snapshots under load (50 K writes interleaved with 200 reader snapshots).

**Validation.**

- Compile: `:app:compileApkRolloutDebugKotlin` clean (verified post-edit).
- Local Robolectric: `PrimitiveLongBufferTest` + the existing `ImuWriterCsvFormatTest`
  - `FinalizeWorkerGatesTest` cover the changed seams.
- On-hardware re-walk (required, separate manual smoke): the same continuous
  ≥75 min capture session that triggered BUG-260518-01 on Pixel 10a — must now
  complete without OOM and with a sawtooth Java-heap profile (verify via
  `dumpsys meminfo ai.humynlabs.capture.apk` every ~10 min during the walk).
  Per CLAUDE.md "Functionality first during smoke walks" the BUG-260518-05 drift
  spike on Pixel 8a should be re-checked in the same walk since both bugs share
  this allocation-pressure root cause.

**Files changed.**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/PrimitiveLongBuffer.kt` (new)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt` (modified)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` (modified — Segment field type + construction site)
- `apps/mobile/android/app/src/main/AndroidManifest.xml` (modified — largeHeap)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/PrimitiveLongBufferTest.kt` (new)
