---
phase: 04-handdetector-recording-ux-practice-tutorial
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/recording/recState.ts
  - apps/mobile/src/screens/recording/useRecordingLifecycle.ts
  - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
  - apps/mobile/src/util/analytics.ts
  - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
  - apps/mobile/__tests__/screens/recording/recState.test.ts
  - apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 4: Code Review Report — Gap-Closure Wave (plans 04-11 / 04-12)

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Scope is the source/test delta from gap-closure plans **04-11** (recording-surface
release-build reachability — the CR-01 production rotate-prompt → ready effect,
the `SET_GATE_CONFIG` RemoteConfig wiring, the `loggedOut`/`startedAt` props into
`useRecordingLifecycle`, the WR-02 unmount `HumynCapture.stop()` chokepoint, the
IN-09 stop-failure telemetry) and **04-12** (MediaPipe `close()`/`detect()`
serialization onto `bgExecutor`, SoundPool load-gating before `play()`).

The TS-side changes are sound: the reducer's `SET_GATE_CONFIG` is correctly
guarded to pre-gate substates and clamps its inputs; the CR-01 device-orientation
effect is correctly torn down on substate change with a harmless late-fire
contract; the practice-cap effect now re-arms off wall-clock `startedAt` instead
of the frozen `durationMs` (WR-07) and that math checks out, including the
`stop-confirm → active` re-entry; the `useRecordingLifecycle` timer-array dead
code was removed cleanly. The `HumynHandDetectorModule` WR-03 fix is genuinely
correct — running `close()` on the single-thread `bgExecutor` serialises it
behind any in-flight `detect()`, and the unit test exercises the new path.

The remaining issues are all in `HumynBeepModule` (the SoundPool load-gating
change introduced a couple of new sharp edges and left one documented-but-
unimplemented defensive path) plus one pre-existing native-handle leak in the
hand detector that the module's own doc comment calls out but doesn't implement,
and one minor test-mock inconsistency. No blockers.

## Warnings

### WR-01: `HumynBeepModule.init` can crash module construction on a missing audio asset

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt:79-86,95-126`
**Issue:** `init { ensurePool() }` calls `ensurePool()` with no surrounding
try/catch. `ensurePool()` sets `soundPool = pool` and _then_ loops
`assets.openFd(path).use { ... pool.load(afd, 1) }` over `TONE_ASSETS`. If
`openFd` throws (asset stripped from the APK, packaging bug, bad path), the
exception propagates out of `ensurePool()` → out of `init` → the
`ReactContextBaseJavaModule` constructor throws, which can take down JS-bundle
load / leave the module unregistered. It also leaves `soundPool` set but
`soundIds` partially populated. The KDoc explicitly promises graceful
degradation ("Built eagerly in [init]; `null` only if the build/`openFd`
failed") — the `playTone` path honours that with its `try { ... } catch
(t: Throwable)`, but `init` does not.
**Fix:**

```kotlin
init {
    // WR-04 — eager decode; failures degrade to a null pool (playTone reports
    // BEEP_FAILED), never a crashed module constructor.
    try {
        ensurePool()
    } catch (t: Throwable) {
        soundPool?.release()
        soundPool = null
        soundIds.clear()
    }
}
```

### WR-02: `AssetFileDescriptor` closed synchronously after the async `SoundPool.load()`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt:118-126`
**Issue:** `assets.openFd(path).use { afd -> soundIds[name] = pool.load(afd, 1) }`
— the `.use { }` closes the `AssetFileDescriptor` the instant `load()` returns,
but the WR-04 comment (and the `OnLoadCompleteListener` design) correctly notes
the decode is _asynchronous_. On several Android versions the SoundPool decoder
reads from the supplied descriptor during the deferred decode, not synchronously
inside `load()`; closing the FD first can fail the decode → `status != 0` in
`setOnLoadCompleteListener` → the sample id is never added to `loadedSampleIds`
→ that tone is silently never audible, and any `playTone` for it sits in
`pendingPlays` forever (the listener path that would fire it requires
`status == 0`). This regresses exactly the inaudible-beep failure WR-04 was
meant to eliminate.
**Fix:** Don't close the AFD until the load completes — hold the
`AssetFileDescriptor` references in a field and close them in the
`OnLoadCompleteListener` (or in `invalidate()`):

```kotlin
private val toneAfds = mutableMapOf<Int, AssetFileDescriptor>()
// in ensurePool():
val afd = reactApplicationContext.assets.openFd(path)
val sampleId = pool.load(afd, 1)
soundIds[name] = sampleId
toneAfds[sampleId] = afd          // close in OnLoadCompleteListener / invalidate()
```

### WR-03: TOCTOU in `playTone` between the `loadedSampleIds` check and `pendingPlays.add`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt:146-163` (+ listener at `:109-116`)
**Issue:** `playTone` does `if (loadedSampleIds.contains(id)) { play... } else {
pendingPlays.add(id) }`. `loadedSampleIds` / `pendingPlays` are
`Collections.synchronizedSet`, so individual ops are atomic, but the
check-then-act is not. If the `OnLoadCompleteListener` for `id` fires between
`loadedSampleIds.contains(id)` returning `false` and `pendingPlays.add(id)`, the
listener runs `loadedSampleIds.add(sampleId); if (pendingPlays.remove(sampleId))
sp.play(...)` — `pendingPlays` doesn't yet contain `id`, so `remove` returns
`false` and nothing plays. Then `playTone` adds `id` to `pendingPlays`, where it
lingers permanently while `promise.resolve(null)` has already returned. Net: one
dropped best-effort beep. Low severity (the JS side `.catch(() => undefined)`s
and the `init`-time eager decode usually wins the race), but it's a real lost-cue
window.
**Fix:** Take a single lock spanning the decision, e.g.:

```kotlin
synchronized(loadedSampleIds) {
    if (loadedSampleIds.contains(id)) {
        val streamId = pool.play(id, 1f, 1f, 1, 0, 1f)
        if (streamId == 0) { promise.reject("BEEP_FAILED", "...$name"); return }
    } else {
        pendingPlays.add(id)
    }
}
```

and have the `OnLoadCompleteListener` enter the same monitor before its
`loadedSampleIds.add` + `pendingPlays.remove`.

### WR-04: `HumynHandDetectorModule` has no `invalidate()` — the ~7.8 MB MediaPipe handle leaks if the JS `cleanup()` never runs

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt:65-71,100-101,177-195`
**Issue:** The lazily-constructed `HandLandmarker` is closed only by the JS-driven
`cleanup()` `@ReactMethod` (RecordingScreen unmount). There is no
`override fun invalidate()`. If the React context is torn down without
RecordingScreen having unmounted cleanly (process about to be killed while the
recording surface is up; a JS crash before the unmount effect fires; a context
recreate path), the native MediaPipe handle backing the ~7.8 MB
`hand_landmarker.task` bundle is never released. The module's own KDoc
(lines 65-71) spells out the exact requirement — "If an `override fun
invalidate()` is ever added that closes the landmarker, it MUST wrap the
`close()` in `bgExecutor.execute { }`" — but no such override exists, so the
guidance is dormant and the handle simply leaks.
**Fix:**

```kotlin
override fun invalidate() {
    // WR-03 parity — close on bgExecutor so it serialises behind any in-flight
    // detect() on the same single-thread executor; never close from under an
    // active MediaPipe detection.
    bgExecutor.execute {
        synchronized(this) {
            landmarker?.close()
            landmarker = null
        }
    }
    super.invalidate()
}
```

## Info

### IN-01: `RecordingScreen.test.tsx` `appStore` mock omits `jwt`

**File:** `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx:174-184`
**Issue:** The new screen code reads `useAppStore((s) => s.jwt == null)` for the
`loggedOut` lifecycle wiring, but the mocked `appStore` `state` in this file has
no `jwt` key, so the selector evaluates `undefined == null` → `true` and
`loggedOut` is permanently `true` in these tests. It's inert here only because
`useRecordingLifecycle` is fully mocked in this file — but
`RecordingScreen.visual.test.tsx`'s mock _does_ set `jwt: 'test-jwt'`, so the two
test mocks now diverge on the same production shape, and if someone un-mocks
`useRecordingLifecycle` here later the logout-stop would fire spuriously.
**Fix:** Add `jwt: 'test-jwt'` to the mocked `state` object to match the
production shape and the visual test's mock.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
