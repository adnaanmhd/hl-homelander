---
phase: 03-humyn-capture-native-module
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 71
files_reviewed_list:
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/main/AndroidManifest.xml
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/AacEncoder.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentTimer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/common/BackUltrawidePicker.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ClockAlignmentTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/EventEmissionTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FileFidelityTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapperTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/RealtimeGateTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/StartGateCarryoverTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/common/BackUltrawidePickerTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
  - apps/mobile/package.json
  - apps/mobile/src/components/BottomNav.tsx
  - apps/mobile/src/components/TopBar.tsx
  - apps/mobile/src/hooks/useForegroundUserRehydrate.ts
  - apps/mobile/src/hooks/useTabTopBarProps.ts
  - apps/mobile/src/native/HumynCapture.ts
  - apps/mobile/src/native/HumynCapture.types.ts
  - apps/mobile/src/navigation/OnboardingStack.tsx
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/screens/compat/CompatFailScreen.tsx
  - apps/mobile/src/screens/compat/CompatPassScreen.tsx
  - apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx
  - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/splash/SplashScreen.tsx
  - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
  - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
  - apps/mobile/src/ui/primitives/Text.tsx
  - apps/mobile/vitest.setup.ts
  - shared/types/src/CaptureSessionOpts.ts
  - shared/types/src/index.ts
findings:
  blocker: 7
  warning: 14
  total: 21
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

## Summary

Phase 3 ships the HumynCapture native Android module (Camera2 + MediaCodec + IMU + fragmented MP4 muxer + foreground service + JS bridge) plus Wave 1 cosmetic UI fixes. Implementation is well-documented and the test surface is broad. However, the orchestration layer (`CaptureSession.kt`) has several concurrency defects that could corrupt drift metrics or strand the session in undefined state under realistic failure modes. The foreground service uses the wrong `START_STICKY` return value, which causes the OS to relaunch a "Recording in progress" notification with no actual capture happening after a process kill — a privacy/UX hazard for the very long sessions this code is designed to support.

**Top concerns (BLOCKERS):**

1. `seg.videoFrameTimestamps` is an unsynchronized `ArrayList` written from the pump HandlerThread and read from the finalize executor — the source of truth for the CAP-08 drift methodology. Concurrent access can throw `ConcurrentModificationException` or yield silently truncated timestamp arrays. Drift figures embedded in `video_metadata.json` would be unreliable.
2. `HumynForegroundService.onStartCommand` returns `START_STICKY`, which lets the OS relaunch the FGS independently of the capture session lifecycle. After a process kill, the user sees a "Recording in progress" notification while nothing is actually being captured. This is also a privacy-sensitive misrepresentation given the FGS type bitmask includes `camera|microphone`.
3. `CaptureSession.rotateSegment` has no try/catch around `BackUltrawidePicker.pick` / `openSegment` / `scheduleNext`. Any throw inside `Handler.post { rotateSegment() }` is swallowed at the runnable boundary; the session is left with `currentSegment = null` and no scheduled timer — recording is silently dead, no `onError` event is emitted, and `stop()` later has nothing to close.
4. Pump-loop `currentSegment === seg` continuation predicate races with `closeSegmentResources` ordering. In `rotateSegment`, `currentSegment = null` is set _after_ `closeSegmentResources` returns; in `stop`, it is set _before_. The asymmetry means in the rotate path, the pump continues running while `muxer.close()` is in progress. The catch blocks rely on `IllegalStateException` from a closed encoder/muxer, but `Surface.release()` mid-frame on the encoder Surface can also surface `RuntimeException` or even crash the encoder native layer; nothing guarantees a clean exit.
5. `cleanupAfterPreFlightFailure` has an ordering bug: `currentSegment?.let { closeSegmentResources(it) }` calls `seg.imuWriter.stop()` and `seg.imuWriter.close()` — but `imuWriter` is started inside `openSegment`'s try block and may already have been released by `openSegment`'s own catch. Worse, `pumpThreads` is iterated and quit via `quitSafely`, but the pump Runnable already running on that thread holds references to encoder/muxer that may be already-released, with the pump still trying to dequeue. Order-dependent.
6. `HumynCaptureModule.errorCodeFor` has dead branch `if (t.message == "session_already_active")` — that exception is never thrown. The double-start guard rejects via `promise.reject` directly without throwing. The message-match-string convention is also fragile: a future contributor who changes the literal string in `IllegalStateException("no_active_session")` would silently demote the error to `internal_error`.
7. `MetadataComposer.writeAtomic` rename-fallback (`file.writeText(partial.readText())`) introduces a non-atomic re-write that defeats T-3.5-02. The fallback path reads the entire `.partial` content into memory then writes byte-for-byte to the destination — there is no atomicity guarantee on this second write. A power loss during the fallback writes a partial canonical file, the `.partial` cleanup also runs, and the next launch sees a corrupt finalized JSON with no recovery signal.

The Wave 1 cosmetic surface is largely clean. Notable issues there are around `useForegroundUserRehydrate`'s race with the Zustand subscription pattern (the closure captures `setUser` from initial getState() but ignores subsequent setUser identity changes — minor, pure-fn nature of zustand setters mitigates this) and the missing dependency-array entries in some hooks.

## Critical Issues

### CR-01: Concurrent unsynchronized access to `Segment.videoFrameTimestamps` corrupts drift methodology — BLOCKER

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:496` (write) and `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt:72` (read)
**Issue:** `seg.videoFrameTimestamps` is declared as `mutableListOf<Long>()` — a non-thread-safe `ArrayList`. The encoder pump thread (`HumynCapture-Pump-<segmentId>`) writes to it on every frame via `seg.videoFrameTimestamps.add(info.presentationTimeUs * 1_000L)`. The finalize executor reads it via `seg.videoFrameTimestamps.toLongArray()`. There is no synchronization, no `volatile` reference, no `Collections.synchronizedList`, and no happens-before edge enforced between the pump's last write and the finalize's read.

The 50 ms `Thread.sleep` in `closeSegmentResources` is not a memory barrier. The pump exits its loop on `currentSegment !== seg`, but that read of `currentSegment` is `@Volatile`, which only orders writes/reads on `currentSegment` itself — not on the unrelated ArrayList contents.

Concrete failure modes on a real Pixel-class device under realistic load:

- `ConcurrentModificationException` thrown inside `toLongArray()` if the pump adds a frame mid-snapshot.
- Silently truncated array if the pump's `size++` and array-element-store are reordered or partially visible to the finalize thread.
- Stale array contents from CPU cache — finalize sees an array that's missing the last several frames.

CAP-08 drift `{max, mean, p99}` is the project's load-bearing data-quality figure. If the ArrayList is corrupt, drift is computed against a wrong window, the metadata-JSON ships incorrect figures, and Phase 5's server-side QA (which reads `imu_video_drift_max_ms`) accepts segments that should fail.

**Fix:**

```kotlin
// In Segment data class:
val videoFrameTimestamps: java.util.concurrent.CopyOnWriteArrayList<Long>,
// Or: a synchronizedList wrapper, or a LongAdder-style append-only structure.
```

Or add explicit synchronization at the boundaries:

```kotlin
// Pump-side write:
synchronized(seg.videoFrameTimestamps) {
    seg.videoFrameTimestamps.add(info.presentationTimeUs * 1_000L)
}

// Finalize-side read (after closeSegmentResources):
val videoTimestamps = synchronized(seg.videoFrameTimestamps) {
    seg.videoFrameTimestamps.toLongArray()
}
```

Even simpler: replace the list with a primitive long array buffer (`LongArray`) sized for `max_frames_per_segment` (10 min × 30 fps × 1.2 safety = 21 600 entries). Pre-allocate in `openSegment` and use an `AtomicInteger` write index. This eliminates allocation churn on the per-frame hot path AND gives memory-model-correct concurrent access.

---

### CR-02: `HumynForegroundService` returns `START_STICKY`, leaving zombie capture notifications after process kill — BLOCKER

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt:51`
**Issue:** `onStartCommand` returns `START_STICKY`. After a low-memory kill (likely on Pixel-class devices during long sessions per the 25-min thermal soak target), the OS will reschedule the service with a null intent. `onStartCommand(null, ...)` then runs:

```kotlin
val notif = HumynForegroundNotification.build(this, "Recording in progress")
ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
return START_STICKY
```

This restarts the FGS — with the `camera|microphone|dataSync` foreground service type and a "Recording in progress" notification — _while the JS bridge / CaptureSession / Camera2 / encoder are all dead_. The user sees a recording indicator and the privacy-sensitive Camera/Mic FGS-type indicator with no capture actually running. Any partial files in `recordings/` are never finalized (their sidecars are still present but no Kotlin code is running to process them).

This is also a hazard for Phase 5: the upload service downstream would observe the FGS active but no `onSegmentComplete` events firing.

**Fix:**

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) {
        // OS-relaunch after process kill — there is no live CaptureSession to host.
        // Stop ourselves so the FGS state matches reality.
        stopSelf()
        return START_NOT_STICKY
    }
    val notif = HumynForegroundNotification.build(this, "Recording in progress")
    ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
    return START_NOT_STICKY  // JS bridge owns the lifecycle; never auto-restart.
}
```

`START_NOT_STICKY` is the correct value for a service whose lifecycle is owned by the JS bridge. The user-initiated `start()` re-creates the FGS on next launch via `HumynCaptureModule.start()`.

---

### CR-03: `rotateSegment` swallows exceptions at the Handler.post boundary; session silently dies — BLOCKER

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:518-547`
**Issue:** `rotateSegment()` is invoked via `sessionHandler.post { rotateSegment() }` inside the SegmentTimer callback (line 169 + 545). There is no try/catch around the body. The function calls:

- `BackUltrawidePicker.pick(mgr) ?: throw IllegalStateException("no_back_ultrawide")` (line 538)
- `openSegment(newRecordingId, pick)` — which can throw if Camera2 hot-disconnects mid-rotate, MediaCodec init fails, IMU sensor goes away, AudioRecord fails to allocate, etc.
- `segmentTimer.scheduleNext(...)` — which can throw if the timer thread has been quitSafely'd by an interleaving stop.

If any of these throw, the exception propagates up through the Runnable to `Handler.dispatchMessage`, which logs and discards. State after the throw:

- `currentSegment = null` (was nulled at line 522)
- `segmentTimer` either has no pending callback or has the _previous_ (already-fired) callback
- `stopping = false`
- `pumpThreads` may have a stale entry if `openSegment` got far enough to add one
- The user's recording is dead. No `onError` event was emitted (rotateSegment never gets that far). No `onSessionStop` event. Phase 4's RecordingScreen sees neither.

The user has no way to know the session is dead until they tap "Stop" — at which point `stop()` runs with `segN = null`, segmentsCompleted is wrong, and no finalize fires for the lost frames.

**Fix:** Wrap the body and emit a structured error:

```kotlin
private fun rotateSegment() {
    if (stopping) return
    val segN = currentSegment ?: return
    try {
        closeSegmentResources(segN)
        currentSegment = null
        try { Thread.sleep(SEGMENT_ROTATE_GAP_MS) } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            return
        }
        finalizeExecutor.execute { FinalizeWorker.finalize(segN, emit) }
        segmentsCompleted++

        val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val pick = BackUltrawidePicker.pick(mgr)
            ?: throw IllegalStateException("no_back_ultrawide")
        val newRecordingId = UlidGenerator.next()
        val segNPlus1 = openSegment(newRecordingId, pick)
        currentSegment = segNPlus1
        emitSegmentStart(segNPlus1)
        segmentTimer.scheduleNext(segmentDurationMs) {
            sessionHandler.post { rotateSegment() }
        }
    } catch (t: Throwable) {
        // Surface to JS so RecordingScreen can show the error and offer a re-start.
        val payload = Arguments.createMap().apply {
            putString("code", "rotate_failed")
            putString("message", t.message ?: "")
            putBoolean("recoverable", false)
            putString("segmentId", segN.segmentId)
        }
        emit("onError", payload)
        // Ensure stop() can still run cleanly.
        stopping = true
        try { segmentTimer.cancel() } catch (_: Throwable) {}
    }
}
```

---

### CR-04: Pump-loop continuation race with `closeSegmentResources` ordering inconsistency — BLOCKER

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:518-522, 558-564`
**Issue:** Two paths close a segment:

`rotateSegment`:

```kotlin
val segN = currentSegment ?: return
closeSegmentResources(segN)        // <- close first
currentSegment = null               // <- null second
```

`stop`:

```kotlin
val segN = currentSegment
currentSegment = null               // <- null first
if (segN != null) {
    closeSegmentResources(segN)     // <- close second
```

The pump-loop checks `currentSegment === seg` to decide whether to keep dequeuing (line 458). In `rotate`, the pump keeps running for the entire duration of `closeSegmentResources` — which includes `seg.captureSession.stopRepeating()`, `seg.captureSession.close()`, `seg.hevc.signalEndOfInputStream()`, a 50 ms sleep, then `seg.hevc.stop()`, `seg.hevc.release()`, `seg.inputSurface.release()`, and `seg.muxer.close()`.

During those steps, the pump is concurrently calling `seg.hevc.dequeueOutputBuffer`, `seg.hevc.getOutputBuffer`, `seg.muxer.writeSampleData`, `seg.hevc.releaseOutputBuffer`. The catch blocks handle `IllegalStateException` from a stopped encoder, but:

- `Surface.release()` mid-frame on the encoder input Surface can crash the native encoder layer — `IllegalStateException` is not the only possible exception, and on some Pixel firmware the crash is in native code (SIGSEGV).
- `muxer.close()` chains to `FileOutputStream.close()`. A concurrent `writeSampleData` can race with file-channel close and produce partially-written samples (the muxer's last fragment header may be inconsistent).
- The `Thread.sleep(50)` is ad-hoc — it presumes the encoder will drain in 50 ms, which is not a contract Android guarantees.

**Fix:** Set `currentSegment = null` BEFORE calling `closeSegmentResources` in both paths, then either:
(a) `pumpThread.quitSafely()` and `pumpThread.join()` BEFORE touching the encoder/muxer/surface, OR
(b) Use a per-segment volatile `pumpRunning` flag that the pump observes; the close path sets `pumpRunning = false` and joins on a `CountDownLatch` the pump signals when it exits.

```kotlin
private fun closeSegmentResources(seg: Segment) {
    // 1. Signal the pump to exit and WAIT for it before tearing down anything.
    seg.pumpExitLatch.await(2, TimeUnit.SECONDS)  // pump signals when its loop returns
    seg.pumpThread.quitSafely()
    // 2. NOW it's safe to close the encoder, surface, muxer.
    try { seg.captureSession.stopRepeating() } catch (_: Throwable) {}
    try { seg.captureSession.close() } catch (_: Throwable) {}
    try { seg.hevc.signalEndOfInputStream() } catch (_: Throwable) {}
    try { seg.hevc.stop() } catch (_: Throwable) {}
    try { seg.hevc.release() } catch (_: Throwable) {}
    try { seg.inputSurface.release() } catch (_: Throwable) {}
    // ...
}
```

---

### CR-05: `cleanupAfterPreFlightFailure` calls `closeSegmentResources` against a partially-allocated or already-released segment — BLOCKER

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:181-194`
**Issue:** `cleanupAfterPreFlightFailure` runs when `preFlightAndStartFirstSegment` throws. The throw can come from any step 1–7. The cleanup calls:

```kotlin
currentSegment?.let { closeSegmentResources(it) }
```

But `currentSegment` is only set in step 5 (`currentSegment = openSegment(...)` line 161). Inside `openSegment`, the try/catch at line 286–317 catches allocation failures and tears down everything it allocated locally — but it does NOT set `currentSegment`, so by the time `openSegment` re-throws, `currentSegment` is still null. So this branch is structurally dead for openSegment failures.

But `openSegment` returns a _fully-allocated Segment_ before `currentSegment = openSegment(...)` is assigned. If steps 6 or 7 throw (for example, `segmentTimer.scheduleNext` throws because the timer thread was quitSafely-d), `currentSegment` is set, the segment is fully open, but cleanup runs `closeSegmentResources(currentSegment)`. That's correct.

The actual bug is that `cleanupAfterPreFlightFailure` does:

```kotlin
for (t in pumpThreads) try { t.quitSafely() } catch (_: Throwable) { }
```

This quitSafely's threads owned by Segments that may have already had their pumps complete via `closeSegmentResources` (which DOESN'T quit the pump thread — see CR-04, the pump exit relies on `currentSegment !== seg`). After `closeSegmentResources`, the pump may still be running (looping on `currentSegment === seg`, which now reads `null !== seg` = true) waiting for `dequeueOutputBuffer` to throw `IllegalStateException`. `quitSafely` interrupts the looper but the pump runnable isn't handled by the looper after `Handler(pumpThread.looper).post`, it's already running synchronously. quitSafely does not stop the running runnable.

Result: a pump thread can leak past `cleanupAfterPreFlightFailure`. The thread is non-daemon (HandlerThread default) and prevents JVM shutdown — though that doesn't matter on Android, the thread does hold references to the (now-released) MediaCodec and Muxer.

**Fix:** Make `closeSegmentResources` synchronously join the pump thread (per CR-04 fix). Then `cleanupAfterPreFlightFailure` doesn't need its own loop over `pumpThreads`. Clear separation of concerns.

---

### CR-06: `MetadataComposer.writeAtomic` cross-mount fallback is non-atomic and can corrupt finalized JSON — BLOCKER

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt:243-253`
**Issue:**

```kotlin
partial.writeText(json.toString(2))
if (!partial.renameTo(file)) {
    // Fallback: copy + delete (some FS reject rename across mount points).
    file.writeText(partial.readText())
    partial.delete()
}
```

The fallback `file.writeText(partial.readText())` is NOT atomic. `file.writeText` opens `file`, truncates, writes bytes, closes. If the device crashes / battery dies / process is killed mid-write, the canonical `file` is now partially written — and the orphan-sidecar contract relies on the canonical JSON being either fully present or absent. A partially-written canonical JSON gets parsed as malformed by Phase 5's upload preparation, but the sidecar (which signals "finalize incomplete") was already deleted by `SidecarManager.delete(seg.sidecarFile)` _before_ the write fallback ran.

Wait — re-reading FinalizeWorker.finalize order: `MetadataComposer.writeAtomic(seg.jsonFile, json)` runs FIRST (line 125), THEN `SidecarManager.delete(seg.sidecarFile)` (line 129). So if writeAtomic throws (the catch in writeAtomic deletes `.partial` and re-throws), FinalizeWorker's outer catch fires `onError code=finalize_failed` — sidecar is preserved, app-launch sweep sees the orphan and Phase 4 can re-finalize. That part is fine.

The danger is the fallback non-atomic write that succeeds _partially_. Process dies after `file.writeText` started writing but before it completed. `partial.delete()` doesn't run because the process is dead. Next launch:

- `recordings/[base].mp4` exists.
- `recordings/[base].csv` exists.
- `recordings/[base].json` exists but is corrupt/truncated.
- `recordings/[base].session.json` exists (sidecar).
- `recordings/[base].json.partial` exists.

CaptureLaunchSweep: it scans for `*.mp4` orphans (no matching `.json`). The corrupt `.json` exists, so the mp4 is NOT considered orphan — sweep leaves it alone. Phase 5 later tries to parse the corrupt JSON, fails, segment is unrecoverable. Worse, `.partial` is leaked forever since CaptureLaunchSweep doesn't sweep `.partial`.

**Fix:** Either (a) treat rename failure as fatal (don't ship the fallback at all, since Android `filesDir` is always single-mount), or (b) implement true atomic write via `java.nio.file.Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)` which is atomic across compatible filesystems and throws clearly if not.

```kotlin
fun writeAtomic(file: File, json: JSONObject) {
    val parent = file.parentFile
        ?: throw IllegalArgumentException("writeAtomic: file has no parent: ${file.path}")
    val partial = File(parent, "${file.name}.partial")
    try {
        partial.writeText(json.toString(2))
        try {
            java.nio.file.Files.move(
                partial.toPath(),
                file.toPath(),
                java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                java.nio.file.StandardCopyOption.REPLACE_EXISTING,
            )
        } catch (e: java.nio.file.AtomicMoveNotSupportedException) {
            // filesDir is single-mount on Android; this should not happen.
            // If it does, surface as IOException so FinalizeWorker emits onError.
            throw java.io.IOException("atomic_move_unsupported", e)
        }
    } catch (e: Throwable) {
        partial.delete()
        throw e
    }
}
```

Also: `CaptureLaunchSweep` should sweep `*.json.partial` at boot — currently it doesn't.

---

### CR-07: `HumynCaptureModule.errorCodeFor` has dead branch and fragile message-string matching — BLOCKER (correctness; defines the JS error contract)

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt:178-196`
**Issue:** Two problems:

(1) Dead code branch:

```kotlin
} else if (t.message == "session_already_active") {
    "session_already_active"
}
```

The `start()` method handles double-start via `promise.reject("session_already_active", ...)` directly at line 115 and returns from the executor — it does NOT throw an `IllegalStateException` with that message anywhere. This branch is unreachable.

(2) Fragile string-equality message matching for error code dispatch:

```kotlin
is IllegalStateException -> if (t.message == "no_active_session") {
    "no_active_session"
} else if (...) {
```

A future contributor renaming the literal in `IllegalStateException("no_active_session")` (line 158) to "session_inactive" or wrapping the throw silently demotes the public bridge contract `no_active_session` to `internal_error` — without compile-time signal. The JS layer dispatches behavior on these error codes; a silent demotion breaks Phase 4's stop() error handling.

Same fragility applies to `IllegalArgumentException` with `"consent_invalid"` — fine for now because the throw site uses `require(consent) { "consent_invalid" }`, but a copy-paste edit renaming the message (e.g., "consent_required") demotes to `invalid_opts`.

**Fix:** Replace string-message-matching with typed exceptions:

```kotlin
class NoActiveSessionException : IllegalStateException("no_active_session")
class SessionAlreadyActiveException : IllegalStateException("session_already_active")
class ConsentInvalidException : IllegalArgumentException("consent_invalid")
class InvalidOptsException(field: String) : IllegalArgumentException("invalid_opts: $field")

// Throw sites:
val s = session ?: throw NoActiveSessionException()
require(consent) { throw ConsentInvalidException() }  // and so on

// errorCodeFor:
private fun errorCodeFor(t: Throwable): String = when (t) {
    is ThermalRefuseException -> "thermal_throttling"
    is RealtimeClockUnavailableException -> "realtime_clock_unavailable"
    is NoActiveSessionException -> "no_active_session"
    is SessionAlreadyActiveException -> "session_already_active"
    is ConsentInvalidException -> "consent_invalid"
    is InvalidOptsException -> "invalid_opts"
    is SecurityException -> "permission_revoked"
    is java.io.IOException -> "storage_full"
    else -> "internal_error"
}
```

This makes the contract refactor-safe and removes the dead branch.

## Warnings

### WR-01: `HumynForegroundService.setUploadActive` is unreachable from outside the Service

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt:58-63`
**Issue:** `setUploadActive(boolean)` is an instance method documented as the "Phase 5 seam." However:

- `onBind` returns `null`, so external callers cannot get a `Binder` reference to the service instance.
- There is no `Intent` extra parsing in `onStartCommand` to set the flag via `startService(Intent)`.
- No companion `start/stopUpload` static helpers.

The seam exists but cannot be invoked. Phase 5 will need to re-architect either the binding or the intent surface; the current shape promises an API it cannot deliver. The unit test (`HumynForegroundServiceTest.setUploadActive toggles flag without throwing`) only proves the method can be called when you already have a direct reference to the Service instance — which Phase 5 won't.

**Fix:** Either add `Intent` extra dispatch in `onStartCommand`:

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_SET_UPLOAD_ACTIVE) {
        uploadActive.set(intent.getBooleanExtra(EXTRA_UPLOAD_ACTIVE, false))
        return START_NOT_STICKY
    }
    // ... normal start path
}
companion object {
    const val ACTION_SET_UPLOAD_ACTIVE = "ai.humynlabs.capture.fgs.SET_UPLOAD_ACTIVE"
    const val EXTRA_UPLOAD_ACTIVE = "uploadActive"
}
```

Or remove the seam entirely and add it in Phase 5 when the actual lifecycle requirement is concrete.

### WR-02: `CaptureSession.preFlightAndStartFirstSegment` registers thermal listener BEFORE the first segment opens; mid-record callback can fire before `currentSegment` is set

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:151-161`
**Issue:** `thermalSubscription = thermalGate.subscribeMidRecord { status -> ... }` is registered at step 4. Step 5 (`openSegment`) takes time — on a real device, Camera2 open + capture-session config + encoder configure + AudioRecord allocate + IMU start can run several hundred milliseconds. If thermal status escalates to SEVERE during that window, the callback fires:

```kotlin
val payload = Arguments.createMap().apply {
    putString("segmentId", currentSegment?.segmentId ?: "")  // ← empty string!
    putInt("currentStatus", status)
}
emit("onThermalAbort", payload)
sessionHandler.postDelayed({ if (!stopping) stop() }, THERMAL_GRACEFUL_STOP_MS)
```

Phase 4's `onThermalAbort` listener receives an event with empty `segmentId`, which it cannot correlate to a recording. The 2.5 s graceful stop posts to `sessionHandler` while `preFlightAndStartFirstSegment` is still allocating — `stop()` runs concurrently with the in-flight `openSegment`, leaving Camera2 / encoders / muxer in undefined state.

**Fix:** Defer thermal subscription until AFTER the first segment is fully open:

```kotlin
// Step 5: first segment.
currentSegment = openSegment(recordingId = UlidGenerator.next(), pick = pick)
// Step 4 (moved): subscribe mid-record AFTER first segment is open.
thermalSubscription = thermalGate.subscribeMidRecord { status -> /* ... */ }
// Step 6: schedule next cut.
```

### WR-03: `MainApplication.onCreate` dispatches Firebase Remote Config defaults synchronously without awaiting; `SegmentDurationConfig.load()` race with first start()

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt:72-78`
**Issue:** The comment says "default suffices on failure" — but `setDefaultsAsync` is awaitable and the result is discarded. If the user taps "start recording" within milliseconds of cold launch (unlikely but possible — recovered from Recents, app is warm), `SegmentDurationConfig.load()` runs `rc.getLong(KEY)` which returns `0L` if no defaults registered yet. `if (raw > 0L) raw else DEFAULT_MINUTES` then returns `10L` — so the default is preserved by the secondary guard.

That's fine for `0L`. But the real issue is the silent `try/catch` swallows any Firebase init failure entirely. If Firebase is mis-configured (no `google-services.json` for the active flavor), the catch is hit on every cold launch and there's no log visibility. A debug build would happily run with the default and never tell the developer the Remote Config wiring is broken.

**Fix:** Add a structured log on the catch path:

```kotlin
try {
    com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance().setDefaultsAsync(
        mapOf(SegmentDurationConfig.KEY to SegmentDurationConfig.DEFAULT_MINUTES),
    )
} catch (t: Throwable) {
    android.util.Log.w("MainApplication", "remote_config_defaults_failed", t)
}
```

### WR-04: `HevcEncoder.buildMediaFormat` sets `KEY_PROFILE` without `KEY_LEVEL`; encoder may pick incompatible level for 8 Mbps CBR

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt:52`
**Issue:** `setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain)` is set but `MediaFormat.KEY_LEVEL` is not. Without an explicit level, the encoder may select HEVC Main Profile Level 3 (max 1280×720, 6 Mbps), failing to honor the 1080p / 8 Mbps requirement on some OEM codecs (Samsung Exynos, MediaTek Helio). The HEVC spec requires `Main@L4` for 1080p30 / 8 Mbps.

CAP-01 requires the encoder configuration to be deterministic across the OEM matrix. A missing level lock invites silent regressions on devices we haven't tested.

**Fix:**

```kotlin
setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain)
setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.HEVCMainTierLevel4)
```

Add a config-audit assertion in `HevcEncoderConfigTest.kt`.

### WR-05: `ImuRateObserver.compute` sliding-window scan complexity scales poorly past expected sample counts

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt:65-70, 82-90`
**Issue:** The sliding window iterates `winStart` from `firstNs` to `lastNs - SLIDING_WINDOW_NS` in 100 ms increments. For a 10-min segment that's 6000 windows. Each window calls `countInRange(sorted, winStart, winEnd)` which does a linear scan over the full sorted array (~250 K samples at 416 Hz × 600 s).

Total work: 6000 × 250 000 = 1.5 billion comparisons. At 100 ns per comparison (optimistic), that's 150 seconds of CPU per finalize. On a Pixel 7a, this would block the finalize executor for minutes per segment, violating the "concurrent finalize during next segment" pattern.

The scan does early-exit on `if (ts >= end) break`, which means the average case is closer to ~window-size samples per scan (1 s × 416 Hz = 416 samples per window). That's 6000 × 416 = 2.5 M comparisons — fast. But the early exit only works because the array IS sorted; no `if (ts < start) continue` pre-filter does the lower-bound binary search.

For sorted data, this is dominated by the small `if (ts < start) continue` pre-skip per window — but since each window starts AFTER the previous one and the loop restarts from index 0, you still scan ~start-position samples that are before the window. Total = 6000 windows × ~average start-position-distance.

This is technically out of scope for v1 (performance). But the comment at line 78–80 ("≤ ~250 K samples ... finalize-time off the IMU hot path") underestimates the practical bound. Mark for v2 review.

**Fix (v2):** Two-pointer sliding window.

```kotlin
var leftIdx = 0
var rightIdx = 0
while (winStart + SLIDING_WINDOW_NS <= lastNs) {
    val winEnd = winStart + SLIDING_WINDOW_NS
    while (leftIdx < sorted.size && sorted[leftIdx] < winStart) leftIdx++
    while (rightIdx < sorted.size && sorted[rightIdx] < winEnd) rightIdx++
    windowsHz.add((rightIdx - leftIdx).toDouble())
    winStart += SLIDE_STEP_NS
}
```

### WR-06: `DriftCalculator.compute` interpolation clamping silently masks drift outside the IMU coverage window

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt:114-128`
**Issue:** The interpolation clamps out-of-range video timestamps to first/last IMU residual:

```kotlin
if (x <= xs.first()) return ys.first()
if (x >= xs.last()) return ys.last()
```

The docstring says this is "same semantics the canonical idea-brief.md §6.5 algorithm assumes." But the practical effect: if the IMU starts late or stops early relative to video (which happens — IMU registration takes time, and `closeSegmentResources` stops the IMU writer in step 7 after the muxer), video frames at the segment edges have drift-residual artificially set to the boundary residual, which is typically close to 0. The {max, mean, p99} drift figures under-report real edge drift.

For 10-min segments with even 100 ms of IMU underrun at each end, that's ~6 frames at the start + ~6 at the end (12 frames out of 18000 = 0.067%) where drift is computed against a clamped value rather than a true residual. p99 is unaffected (well below the 1% threshold). max may be affected if the underrun period happens to contain the worst drift. The current behavior is conservative-toward-pass — segments report less drift than reality.

Not a blocker, but worth flagging in a comment: drift figures are slight UNDER-reports at segment edges due to interpolation clamping. The training pipeline should not over-trust drift figures < 0.5 ms.

**Fix:** Either (a) explicitly drop edge frames whose timestamps fall outside the IMU coverage window from the drift array (so the array reports what we measured, not what we extrapolated), or (b) document the clamping as a known under-report and ensure the training pipeline understands.

### WR-07: `ImuWriter` BufferedWriter has no explicit flush on stop; data loss on SIGKILL between stop() and close()

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt:104-121`
**Issue:** `stop()` unregisters listeners and returns the timestamp array. It does NOT flush the BufferedWriter. The BufferedWriter has 8 KiB buffer (line 68) so up to 8 KiB of IMU rows may be in memory after `stop()` returns.

`close()` flushes and closes — but between `stop()` and `close()` (called in two separate `try` blocks at line 622–624), if the process is killed (low-memory, ANR, segfault from Camera2), the in-buffer rows are lost. CSV file is short by up to a few hundred rows (8 KiB / ~32 bytes per row ≈ 256 rows, ~0.6 s of IMU at 416 Hz).

The drift methodology uses physical timestamps from `event.timestamp`, which are also lost — but the in-memory `timestampList` snapshot (`timestamps()`) is taken from the Kotlin side and survives a writer-buffer loss. So the metadata JSON's drift figure is computed against a 250 K-entry timestamp array of which the last ~256 entries don't appear in the CSV.

The CSV SHA mismatches what the in-memory timestamp count suggests. Phase 5 server QA may flag this as an integrity error.

**Fix:** Flush in stop():

```kotlin
fun stop(): LongArray {
    sm?.unregisterListener(listener)
    try { csv.flush() } catch (_: Throwable) { /* best-effort */ }
    return timestampList.toLongArray()
}
```

### WR-08: `ImuWriter.writeRow` accesses `csv` and `timestampList` from sensor thread without synchronization vs. `stop()`/`close()` race

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt:146-150`
**Issue:** `writeRow` is invoked on the sensor HandlerThread. `stop()` (called from the session HandlerThread inside `closeSegmentResources`) calls `sm?.unregisterListener(listener)`. `unregisterListener` is asynchronous on some Android versions — pending events may already be dispatched and queued on the sensor HandlerThread.

If `writeRow` runs concurrently with `close()`:

- `close()` sets `closed = true`.
- `writeRow` reads `closed` (no `@Volatile` annotation — `closed` is `@Volatile` at line 83, OK).
- But `writeRow` then calls `csv.write(...)` and `timestampList.add(...)`. If `close()` is racing with `writeRow`'s `csv.flush()/csv.close()`, the BufferedWriter call site could be interleaved.

Actually, looking again, `closed` is `@Volatile` and `writeRow` does check it at line 147. The race window is tight — between the volatile read and the `csv.write()` call. `close()` sets `closed = true` then flushes and closes. If a sensor event squeezes through between the volatile read returning `false` and the actual `csv.write` execution, the write hits a closed BufferedWriter → IOException.

The catch at the call site is in the SensorEventListener path which is a no-op `override fun onSensorChanged` — no try/catch. The IOException propagates up the sensor framework and could be logged-and-swallowed by `SensorManager` infrastructure (varies by Android version).

**Fix:** Either synchronize `csv` access:

```kotlin
private val csvLock = Any()
private fun writeRow(...) {
    synchronized(csvLock) {
        if (closed) return
        csv.write(formatRow(...))
        timestampList.add(timestampNs)
    }
}
fun close() {
    synchronized(csvLock) {
        if (closed) return
        closed = true
        try { csv.flush(); csv.close() } catch (_: Throwable) {}
    }
    handlerThread.quitSafely()
}
```

Or wait for the sensor HandlerThread to drain after unregister:

```kotlin
fun stop(): LongArray {
    sm?.unregisterListener(listener)
    // Drain any queued sensor events on the HandlerThread before returning.
    val drainLatch = CountDownLatch(1)
    handler.post { drainLatch.countDown() }
    drainLatch.await(500, TimeUnit.MILLISECONDS)
    return timestampList.toLongArray()
}
```

### WR-09: `FragmentedMuxerWrapper` close idempotency leak — second `muxer.close()` may throw on some media3 versions

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FragmentedMuxerWrapper.kt:120-132`
**Issue:** `close()` is called from `stop()`, `release()`, AND directly. The docstring says it's idempotent. The implementation:

```kotlin
fun close() {
    try {
        muxer.close()
    } finally {
        try { output.close() } catch (_: Throwable) { }
    }
}
```

`muxer.close()` is NOT documented as idempotent in media3 1.10.0. A second `close()` call throws `IllegalStateException` per the upstream `Muxer` interface contract. The wrapper does NOT guard against double-close.

In CaptureSession.closeSegmentResources line 619:

```kotlin
try { seg.muxer.close() } catch (_: Throwable) {}
```

The catch silently absorbs the throw, so the bug doesn't manifest as a user-visible crash. But the comment "Idempotent: calling stop() then release() (or vice versa) is safe" misrepresents the wrapper's actual safety property — it's safe ONLY because the caller wraps it in try/catch.

**Fix:** Add an explicit closed guard:

```kotlin
@Volatile private var closed = false
fun close() {
    if (closed) return
    closed = true
    try {
        muxer.close()
    } finally {
        try { output.close() } catch (_: Throwable) { }
    }
}
```

### WR-10: `useForegroundUserRehydrate` captures `setUser` from initial `getState()` but ignores subsequent identity changes

**File:** `apps/mobile/src/hooks/useForegroundUserRehydrate.ts:31-53`
**Issue:** The closure `rehydrate` reads `useAppStore.getState()` on each invocation (good — gets current `setUser`). But the `useEffect` has `[]` (empty deps), so the AppState listener is registered once at mount with a closure that captures the initial `getState` reference. The implementation is actually correct because `useAppStore.getState` is stable across re-renders and reads fresh state on each call.

However, the swallowed `catch` at line 43 is silent. If the network is permanently down (airplane mode) or the JWT is invalid (server side revoked), the user is never repopulated and the avatar stays as 'U' indefinitely. No retry, no telemetry.

For a session that the user kept open in Recents for hours/days, the JWT may have expired server-side; `fetchMe` throws 401, swallowed, user slice stays null — the user sees 'U' forever.

**Fix:** Add at least telemetry on the catch:

```typescript
} catch (e) {
  logEvent('rehydrate_user_failed', { reason: e instanceof Error ? e.name : 'unknown' });
}
```

### WR-11: `SidecarManager.write` does not use atomic-write pattern, mid-write crash leaves corrupt sidecar

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt:139`
**Issue:** `file.writeText(json.toString(2))` is not atomic. If the process is killed mid-write (during `openSegment`'s segment-open path, which writes the sidecar at line 271), the sidecar file is partially written. CaptureLaunchSweep.sweepRecordings at next launch reads it via `SidecarManager.read(sidecar)` which throws `IllegalArgumentException("sidecar_corrupt")`, which is caught at CaptureLaunchSweep line 53 and the triple is deleted — including the in-progress MP4 and CSV.

This is the documented T-3.4-01 mitigation per the docstring. So the corrupt-sidecar → delete-triple path IS intentional. But the parallel canonical metadata write uses the atomic `.partial → renameTo` pattern. The sidecar should follow the same pattern for consistency, since a sidecar crash could leave a half-formatted JSON object that the JSONObject parser parses without throwing (e.g., truncated string value mid-key) but with garbage values.

**Fix:** Use the same `.partial → renameTo` pattern as `MetadataComposer.writeAtomic`:

```kotlin
fun write(file: File, payload: SidecarPayload) {
    // ... build json ...
    val parent = file.parentFile ?: throw IllegalArgumentException("...")
    val partial = File(parent, "${file.name}.partial")
    try {
        partial.writeText(json.toString(2))
        if (!partial.renameTo(file)) {
            throw java.io.IOException("sidecar_rename_failed")
        }
    } catch (e: Throwable) {
        partial.delete()
        throw e
    }
}
```

### WR-12: `CaptureSession.toStartResponse()` claims "encoder up + first frame written" but is called before any frame

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:642-655` and `apps/mobile/src/native/HumynCapture.ts:55-58`
**Issue:** The JS docstring at HumynCapture.ts:55-58 says start "Resolves with `{sessionId, segmentId, recordingId, filenameBase}` once the encoder is up and the first frame is written." But CaptureSession.start (which the bridge invokes) returns immediately after `preFlightAndStartFirstSegment` — which spawns the pump-loop runnable but does not wait for any actual frame.

`toStartResponse()` reads `currentSegment` (just set) and returns a payload. No frame has been encoded yet at this point. The Camera2 capture session has only just been configured; the encoder Surface is connected but the first frame is in-flight.

If the first frame fails (encoder timeout, format renegotiation), `start()` already resolved successfully with a `segmentId`. The error surfaces later as an `onError` event. Phase 4's RecordingScreen sees the resolved Promise and starts the timer/UI; then `onError` fires asynchronously and Phase 4 needs a separate cancellation path.

**Fix:** Either (a) fix the JS docstring to "once the encoder pipeline is configured" (truthful), or (b) have CaptureSession.start await the first dequeued frame from the pump before returning. (a) is simpler and accurate.

### WR-13: `CaptureLaunchSweep` doesn't sweep `*.partial` residue from interrupted MetadataComposer writes

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt:43-78`
**Issue:** `MetadataComposer.writeAtomic` writes `{file}.partial`, then renames to `{file}`. If the process is killed between `partial.writeText` and the rename, `.partial` remains on disk indefinitely. CaptureLaunchSweep.sweepRecordings filters for `.mp4` orphans and `.json` orphans (excluding `.session.json`) but never touches `.json.partial` or `.session.json.partial`.

Over many crashes, `recordings/` accumulates `*.partial` cruft. Eventually they pollute the FilenameGenerator scan (which filters by `nameWithoutExtension` then `.startsWith("${today}_")` — `20260510_001234_005.json.partial` has `nameWithoutExtension` = `20260510_001234_005.json` which still starts with today's date, so it WOULD be counted in the per-day NNN scan, INCREMENTING the next NNN by 1. Sequence pollution.

**Fix:** Add a third sweep pass:

```kotlin
private fun sweepRecordings() {
    // ... existing passes ...
    // Pass 3: orphan .partial residue from MetadataComposer / SidecarManager writeAtomic.
    val partials = recordingsDir.listFiles { f -> f.name.endsWith(".partial") } ?: emptyArray()
    for (p in partials) {
        Log.w(TAG, "orphan_partial=${p.name} — deleting")
        p.delete()
    }
}
```

### WR-14: `BottomNav` accessibility — focused tab indicator relies solely on color/strokeWidth, no shape or text-decoration cue

**File:** `apps/mobile/src/components/BottomNav.tsx:106-109`
**Issue:** The focused/unfocused distinction is encoded ONLY in icon color + strokeWidth + label color. WCAG 2.1 AA (1.4.1) requires that color is not the only visual means of conveying information. For users with color-vision deficiency, the only differentiator between an active tab and inactive is the slightly-thicker stroke (2.25 vs 1.75) — which is at the threshold of perceptibility on a small icon.

`accessibilityState={{ selected: focused }}` is set, which is correct for screen readers. But the visual presentation alone could fail the WCAG check on a real-device a11y audit.

**Fix:** Add a non-color cue — typically a small line/dot indicator above the active tab, or bold weight on the label:

```tsx
<Text
  variant="tabLabel"
  style={{
    color: tint,
    marginTop: 2,
    ...typography.tabLabel,
    fontWeight: focused ? '700' : '400', // weight cue
  }}
>
  {tab.label}
</Text>
```

This is a minor a11y polish item — not a launch blocker, but worth tracking.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
