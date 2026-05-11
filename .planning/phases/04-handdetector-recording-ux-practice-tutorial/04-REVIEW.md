---
phase: 04-handdetector-recording-ux-practice-tutorial
reviewed: 2026-05-11T10:36:09Z
depth: standard
files_reviewed: 53
files_reviewed_list:
  - apps/mobile/App.tsx
  - apps/mobile/src/boot/bootRecoveryListener.ts
  - apps/mobile/src/components/Toast.tsx
  - apps/mobile/src/lib/buildCaptureOpts.ts
  - apps/mobile/src/lib/durationFormat.ts
  - apps/mobile/src/lib/jwtSub.ts
  - apps/mobile/src/lib/remoteConfigGate.ts
  - apps/mobile/src/lib/ttsVoice.ts
  - apps/mobile/src/native/HumynBattery.ts
  - apps/mobile/src/native/HumynBeep.ts
  - apps/mobile/src/native/HumynCapture.ts
  - apps/mobile/src/native/HumynCapture.types.ts
  - apps/mobile/src/native/HumynHandDetector.ts
  - apps/mobile/src/native/HumynPhoneState.ts
  - apps/mobile/src/native/HumynScreenBrightness.ts
  - apps/mobile/src/navigation/OnboardingStack.tsx
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/recording/components/AlertPill.tsx
  - apps/mobile/src/screens/recording/components/GateRing.tsx
  - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
  - apps/mobile/src/screens/recording/components/StopConfirmModal.tsx
  - apps/mobile/src/screens/recording/components/VoiceCuePill.tsx
  - apps/mobile/src/screens/recording/recState.ts
  - apps/mobile/src/screens/recording/useHandGate.ts
  - apps/mobile/src/screens/recording/useRecordingLifecycle.ts
  - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
  - apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx
  - apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
  - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
  - apps/mobile/src/screens/tutorial/components/Confetti.tsx
  - apps/mobile/src/state/appStore.ts
  - apps/mobile/src/state/initialRoute.ts
  - apps/mobile/src/state/keys.ts
  - apps/mobile/src/ui/tokens.ts
  - apps/mobile/src/util/analytics.ts
  - apps/mobile/vitest.setup.ts
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainActivity.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/HumynPhoneStateModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/HumynPhoneStatePackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/HumynScreenBrightnessModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/HumynScreenBrightnessPackage.kt
findings:
  critical: 1
  warning: 7
  info: 9
  total: 17
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-11T10:36:09Z
**Depth:** standard
**Files Reviewed:** 53
**Status:** issues_found

## Summary

Reviewed the Phase 4 source: the recording-surface state machine + lifecycle hook, the MediaPipe hand-gate poll loop, the practice/tutorial screens, the global toast + crash-recovery boot listener, and the five new Kotlin native modules (HandDetector / PhoneState / Battery / ScreenBrightness / Beep) plus the touched HumynCapture module.

The token discipline, the consent-never-defaulted guard in `buildCaptureOpts`, the AudioFocus-only PhoneState module (no telephony API), the bitmap memory hygiene in HandDetector, the leak teardown in most native modules, and the reducer's purity all hold up. But there is one ship-stopping defect and a cluster of real reliability gaps in the recording surface:

- **BLOCKER**: the `rotate-prompt` substate has no exit path in a release build — `LANDSCAPE_DETECTED` is dispatched only from a `__DEV__`-gated button, and no orientation listener dispatches it. Every recording session starts at `rotate-prompt`, so the recording surface, the practice tutorial, and therefore the entire onboarding flow are unusable in any non-`__DEV__` build. The 572-green test suite never catches this because the tests inject `__test_initialState` and skip the substate.
- The recording surface has several interruption / teardown gaps (orphaned capture session + FGS if the user X-es out during the gate→record handoff; HandDetector `close()` racing an in-flight `detect()`; SoundPool first-play silent; the unvalidated `SETTLE_MS=80`; the practice-cap-overrun via the stop-confirm modal).
- HAND-11's RemoteConfig retuning of `cadence_ms` / `consecutive_hits_required` is dead — those values never reach the reducer.

No injection / secret / crypto issues found in scope. The "no telephony API", "no notifications", "coarse-location-only", "no VisionCamera HEVC pipeline" guard-rails are all respected.

## Critical Issues

### CR-01: `rotate-prompt` substate is a dead-end in release builds — recording / practice / onboarding unusable

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:600-601`, `apps/mobile/src/screens/recording/components/RotatePrompt.tsx:33-43`, `apps/mobile/src/screens/recording/useRecordingLifecycle.ts:209-217`

**Issue:** `initialRecState()` always starts the recording machine at `substate: 'rotate-prompt'`. The only thing in the entire codebase that dispatches `{ type: 'LANDSCAPE_DETECTED' }` (the action that advances `rotate-prompt → ready`) is `RotatePrompt`'s `onPretendRotated` prop, and `RotatePrompt` renders the Pressable that fires it only under `{__DEV__ ? ... : null}`. `useRecordingLifecycle`'s device-orientation listener handles `PORTRAIT` / `PORTRAIT-UPSIDEDOWN` (→ `onStop('orientation')`) but never `LANDSCAPE-LEFT` / `LANDSCAPE-RIGHT`, and there is no `onLandscapeDetected` callback. So in a release build (`__DEV__ === false`) the `rotate-prompt` body renders only a static icon + caption — no actionable element — and nothing dispatches `LANDSCAPE_DETECTED`. The user can X out of the screen but can never start a recording. Since PracticeIntro → Recording is part of onboarding and `computeInitialRoute` keeps routing to `RigTutorial` until the per-account practice flag is written by PracticeComplete, a release build never lets a new user reach `MainTabs`.

**Fix:** Wire a real orientation→dispatch path. Add an `onDeviceOrientation` branch in `useRecordingLifecycle` (or a dedicated effect in `RecordingScreen`) that dispatches `LANDSCAPE_DETECTED` when the device reports `LANDSCAPE-LEFT` / `LANDSCAPE-RIGHT` while `substate === 'rotate-prompt'`, e.g.:

```ts
// in RecordingScreen, alongside the other gate effects:
useEffect(() => {
  if (state.substate !== 'rotate-prompt') return;
  const onOrient = (o: OrientationType) => {
    if (o === 'LANDSCAPE-LEFT' || o === 'LANDSCAPE-RIGHT') dispatch({ type: 'LANDSCAPE_DETECTED' });
  };
  Orientation.getDeviceOrientation((o) => onOrient(o as OrientationType)); // fire on current
  Orientation.addDeviceOrientationListener(onOrient);
  return () => Orientation.removeDeviceOrientationListener(onOrient);
}, [state.substate]);
```

Also add a render test that mounts `RecordingScreen` with the _default_ `initialRecState` (no `__test_initialState`) and asserts the surface can leave `rotate-prompt`.

## Warnings

### WR-01: HAND-11 RemoteConfig `cadence_ms` / `consecutive_hits_required` never reach the reducer

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:166-169, 222-231, 388-397, 441`

**Issue:** `useReducer(recReducer, ... initialRecState({ taskId, taskName, isPractice }))` is called _without_ the optional `gateConfig` argument, so `state.gate.targetHits` / `state.gate.cadenceMs` are permanently the hardcoded `DEFAULT_TARGET_HITS = 5` / `DEFAULT_CADENCE_MS = 400` from `recState.ts`. `readGateConfig()` resolves into `gateCfg`, but only `gateCfg.minHandDetectionConfidence` is forwarded (to `useHandGate`); there is no `useEffect` re-dispatching the resolved `targetHits` / `cadenceMs` into the reducer. Consequences: the poll loop runs at the hardcoded 400 ms (`state.gate.cadenceMs`), the GateRing target is the hardcoded 5 (`state.gate.targetHits`), and `buildCaptureOpts` records `consecutiveHitsRequired: 5, platformCadenceMs: 400` into the per-segment metadata regardless of RemoteConfig. HAND-11's stated purpose — retune the gate without an app release — is therefore only ~⅓ delivered (`min_hand_detection_confidence` works; the two cadence/target keys are inert).

**Fix:** Dispatch the resolved config into the reducer, e.g. add a `SET_GATE_CONFIG` action and fire it from the `readGateConfig()` `.then()` (only while still in a pre-gate substate so it doesn't perturb an in-progress gate), or pass `initialRecState(params, { targetHits, cadenceMs })` once `gateCfg` is known (requires lazy reducer init or a re-key). Verify `buildCaptureOpts` then receives the live values.

### WR-02: orphaned capture session + foreground service if the user exits during the gate→record handoff

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:402-489, 530-539, 247-252`

**Issue:** In the `gate.confirmed → active` handoff `run()`, `HumynCapture.start(opts)` is awaited; on success it dispatches `CAPTURE_STARTED` (→ `active`). If the user taps the X button (`handleClose`) or backgrounds the app _after_ `HumynCapture.start()` has begun/succeeded but before `state.substate` becomes `active`, nothing stops the native session: `handleClose` for a non-`active` substate just does `set(-1)` / `unlockAllOrientations()` / `navigation.goBack()` (no `HumynCapture.stop()`), the mount-effect cleanup does `cleanupHandDetector()` / `set(-1)` (no `HumynCapture.stop()`), and `useRecordingLifecycle`'s AppState / orientation / error / thermal handlers all gate on `isActive()` which is `false` while `substate === 'gate'`. The `run()` closure's `cancelled` flag only suppresses the JS `dispatch` — it cannot recall the camera, encoders, IMU, or FGS that `HumynCapture.start()` already brought up. Net: an orphaned recording continues with a stuck foreground notification until the OS evicts the process. The race window is the full `SETTLE_MS + HumynCapture.start()` duration (~hundreds of ms), and the X button is rendered and tappable throughout the `gate` substate.

**Fix:** On any unmount/exit while a capture might be in flight, call `HumynCapture.stop().catch(() => undefined)`. Simplest: in the mount-effect cleanup, unconditionally `HumynCapture.stop().catch(() => undefined)` (it rejects `no_active_session` harmlessly when nothing is running). Also: after `HumynCapture.start()` resolves but `cancelled` is true, call `HumynCapture.stop()` before returning.

### WR-03: `HumynHandDetectorModule.cleanup()` can race an in-flight `detect()` → native MediaPipe crash

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt:102-119, 121-159, 161-168`

**Issue:** `detectHands` runs `getOrCreate(mc).detect(...)` on `bgExecutor`; the `synchronized(this)` in `getOrCreate` guards only the _construction_ of the `HandLandmarker`, not the `.detect()` call. `cleanup()` is a `@ReactMethod` that runs on the bridge thread and does `synchronized(this) { landmarker?.close(); landmarker = null }`. So thread A (bgExecutor) can be mid-`landmarker.detect(...)` while thread B (bridge) calls `landmarker.close()` on the same instance — undefined behaviour in native MediaPipe, with a real chance of a native crash. RecordingScreen calls `cleanupHandDetector()` in its mount-effect cleanup (i.e. on every unmount — X button, post-stop nav, etc.), and the gate poll fires every ~400 ms during `gate.waiting`, so unmounting during an active poll triggers the race.

**Fix:** Serialise `cleanup()` with detections — run the `close()` on the same `bgExecutor`:

```kotlin
@ReactMethod
fun cleanup(promise: Promise) {
  bgExecutor.execute {
    synchronized(this) { landmarker?.close(); landmarker = null }
    promise.resolve(null)
  }
}
```

(Same pattern applies to `invalidate()` if it ever closes the landmarker.)

### WR-04: `HumynBeep` first `playTone()` is likely silent — SoundPool `load()` then immediate `play()`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt:67-110`

**Issue:** `ensurePool()` is lazy — built on the first `playTone()` call — and `SoundPool.load()` decodes asynchronously; the returned sample id is not playable until decode completes (a few ms later). `playTone()` calls `ensurePool()` then immediately `pool.play(id, ...)`. On the first call (which is the first low-battery or thermal alert during a recording) the decode almost certainly hasn't finished, so `play()` returns `0` (failure) and no tone is heard — the very alert the cue exists for. Subsequent calls work. The return value of `play()` is also not checked, so the failure is silent.

**Fix:** Either pre-load at module construction (so the clips are decoded by the time any recording starts), or register `pool.setOnLoadCompleteListener(...)` and queue the first `play()` until the matching sample id reports loaded.

### WR-05: `SETTLE_MS = 80` on the gate→record camera handoff is unvalidated and sits on the ±1 ms-critical path

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:98-103, 422-461`

**Issue:** After `setCameraActive(false)` (which unmounts the VisionCamera `<Camera>` and triggers its native Camera2 teardown), the handoff awaits exactly `new Promise(r => setTimeout(r, 80))` then calls `HumynCapture.start()`. The 80 ms is a hardcoded guess — the code itself tags it `[TUNABLE — re-measure the ±1ms video↔IMU drift on the gate→record camera handoff in plan 04-10's smoke runbook (the [BLOCKING] gate)]`. React's unmount + VisionCamera's native session release can take longer than 80 ms on a ₹30K-class device; if Camera2 hasn't released when `HumynCapture.start()` tries to open it, `start()` stalls or fails, which is exactly the scenario the project's non-negotiable capture-quality invariant ("±1 ms video↔IMU timestamp alignment", "if capture quality slips, the project fails") forbids regressing. This value must be proven on-hardware before this ships, not merged as a guess.

**Fix:** Treat the `[BLOCKING]` on-hardware re-measure as a release gate. Better still, make `HumynCapture.start()` poll for Camera2 availability (or accept a "wait for camera released" callback from the JS side) instead of relying on a fixed sleep, so the value isn't device-dependent.

### WR-06: `useRecordingLifecycle`'s `loggedOut` arg is never passed — the §10 "logout while recording" policy is inert

**File:** `apps/mobile/src/screens/recording/useRecordingLifecycle.ts:120-129, 350-356`, `apps/mobile/src/screens/recording/RecordingScreen.tsx:312-327`

**Issue:** The hook documents and implements the §10 edge "logout (`loggedOut` flag flips true) while active → onStop('logout')", but RecordingScreen calls `useRecordingLifecycle({ substate, isPractice, durationMs, callbacks })` without `loggedOut`, so it is always `undefined` and the logout effect (`if (loggedOut && substate === 'active')`) never fires. Today there is no UI path to log out from the recording surface, so this is latent — but it's a documented lifecycle policy that is silently not wired, and any future surface that allows logout-while-recording will inherit the gap.

**Fix:** Pass `loggedOut={useAppStore((s) => s.jwt) === null}` (or whatever the logout signal is) from RecordingScreen, or remove the `loggedOut` arg + effect from the hook and the §10 comment so the contract matches the wiring.

### WR-07: practice 60 s hard cap can be overrun via the stop-confirm modal; §10 protections disabled while it's open

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:510-517`, `apps/mobile/src/screens/recording/useRecordingLifecycle.ts:186-189, 336-348`

**Issue:** During `active`, tapping X opens the `stop-confirm` modal. While `substate === 'stop-confirm'`: (a) the active-duration TICK effect early-returns (`if (state.substate !== 'active') return`), so `state.durationMs` — and therefore `durationMsRef.current` in the hook — freezes; (b) `monitoring = substate === 'gate' || substate === 'active'` becomes false, so `useRecordingLifecycle`'s effect cleanup runs and tears down the AppState / orientation / audio-focus / battery / onError / onThermalAbort subscriptions while the recording is still running; (c) the practice-cap effect (`if (!isPractice || substate !== 'active') return`) clears its timer. On "Keep recording" → back to `active`, the cap effect re-arms with `remaining = max(0, 60_000 - durationMsRef.current)` off the _stale frozen_ duration, so the cut fires late and the practice clip exceeds 60 s by however long the modal was open. Practice clips are supposed to be exactly 60 s (ONB-05), and a recording with all §10 safety stops disabled (battery_critical, orientation, phone_call, storage_full) is running underneath an indefinitely-open modal.

**Fix:** Either keep `monitoring` true during `stop-confirm` (treat it as a substate of "recording") and keep the TICK running, or recompute `remaining` against `nowMs() - startedAt` when the cap effect re-arms rather than against the frozen `durationMs`. For a practice recording, consider not offering the X→stop-confirm path at all (the direct stop button already exists).

## Info

### IN-01: dead `timers` array in `useRecordingLifecycle`

**File:** `apps/mobile/src/screens/recording/useRecordingLifecycle.ts:192, 329`

**Issue:** `const timers: Array<ReturnType<typeof setTimeout>> = []` is declared and iterated in cleanup (`for (const t of timers) clearTimeout(t)`) but nothing is ever pushed to it (the audio-focus and periodic-guard timers use their own dedicated `let` variables). Dead code.

**Fix:** Remove `timers` and its cleanup loop.

### IN-02: raw `borderRadius: 999` magic numbers instead of `radii.pill`

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:754, 786`

**Issue:** The `overlayTip` and `toast` styles hardcode `borderRadius: 999`; the rest of the codebase (e.g. `AlertPill`, `RotatePrompt`, `VoiceCuePill`) uses `radii.pill`. RecordingScreen imports only `{ colors, spacing }` from `../../ui/tokens`.

**Fix:** Import `radii` and use `radii.pill`.

### IN-03: capture metadata `contributor.age` / `gender` are always `null`

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:452-458`, `apps/mobile/src/state/appStore.ts:48-53`, `apps/mobile/src/lib/buildCaptureOpts.ts:41-98`

**Issue:** `buildCaptureOpts` accepts `user.age` / `user.gender`, but RecordingScreen always passes `age: null, gender: null` because `appStore.UserDisplay` only carries `{ id, email, name, avatarUrl }` — there is no source for age/gender in the store. So every per-segment metadata JSON records `contributor.age: null, gender: null`, and the training pipeline gets no contributor demographics even when the user provided them at sign-up / `/me`.

**Fix:** If demographics are meant to flow into capture metadata, extend `UserDisplay` (and the `/me` hydrate) with `age` / `gender` and pass them through; otherwise drop the unused fields from `buildCaptureOpts`'s signature.

### IN-04: native-module executors never `shutdown()`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt:101, 109`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt:84`

**Issue:** `HumynCaptureModule.captureExecutor` / `finalizeExecutor` and `HumynHandDetectorModule.bgExecutor` are `Executors.newSingleThreadExecutor()` that are never `shutdown()` in `invalidate()`. On catalyst-instance recreation (dev reload, RN instance restart) the threads leak. Small, but the other Phase-4 modules (Battery, PhoneState, Beep) do tear down their resources in `invalidate()`.

**Fix:** Override `invalidate()` to `shutdownNow()` the executors (and `super.invalidate()`).

### IN-05: `RootNativeStack.rootInitialRouteName()` recomputed (with MMKV reads) on every render

**File:** `apps/mobile/src/navigation/RootNativeStack.tsx:43-65`

**Issue:** `const initial = rootInitialRouteName();` runs on every render of the navigator root; it calls `computeCompatSignatureSync()` and `computeInitialRoute()` (which reads MMKV via `secureMmkv.getBoolean(practiceDoneKey(...))` and decodes the JWT). Only the value computed on first mount is used by `<Root.Navigator initialRouteName>`. Wasteful (re-renders fire from `useForegroundUserRehydrate` etc.).

**Fix:** Wrap in `useMemo(() => rootInitialRouteName(), [])` (or compute once in a `useRef`).

### IN-06: gate effects read `state.gate.*` fields not in their dep arrays

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:353-370 (deps `[state.substate]`), 403-489 (deps `[state.substate, state.gate.phase]`)`

**Issue:** The `gate enter` effect reads `state.gate.phase`; the `gate.confirmed → active` effect reads `state.gate.skipped`, `.bypassed`, `.confirmedAt`, `.startedAt`, `.targetHits`, `.cadenceMs` — none in their dependency arrays. It works today only because those fields are written atomically with the phase transition that _is_ in the deps, plus the `gateEnteredRef` / `transitionStartedRef` guards. It will silently break if anyone reorders the reducer transitions, and it trips `react-hooks/exhaustive-deps`.

**Fix:** Add the read fields to the deps (the ref guards already make re-runs idempotent) or read them via refs.

### IN-07: `SegmentStartEvent` doc still says "first frame is written"

**File:** `apps/mobile/src/native/HumynCapture.types.ts:12-13`

**Issue:** The `SegmentStartEvent` comment says "Emitted when a new segment's encoder is up + the first frame is written", but the `start()` JSdoc in `HumynCapture.ts` was corrected (WR-12) to say the first `muxer.writeSampleData` is only in-flight, not done, when the event fires. Minor doc drift.

**Fix:** Align the `SegmentStartEvent` comment with the corrected `start()` wording.

### IN-08: `HumynCaptureModule` adds a lifecycle listener with no matching removal in `invalidate()`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt:78-84, 316-318`

**Issue:** `init { reactContext.addLifecycleEventListener(this) }` but `invalidate()` is not overridden to `removeLifecycleEventListener(this)` (it overrides `onHostDestroy()` as a no-op). The context clears listeners on its own teardown, so this is benign in practice, but it's inconsistent with the explicit teardown the sibling modules do.

**Fix:** Override `invalidate()` to call `reactApplicationContext.removeLifecycleEventListener(this)` then `super.invalidate()`.

### IN-09: `handleStop` swallows `HumynCapture.stop()` rejections and still reports success

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:285-300`

**Issue:** `await HumynCapture.stop().catch(() => undefined)` discards finalize-time errors (`storage_full` at writeAtomic, `no_active_session`, etc.); the success branch then unconditionally shows `"{Hh Mm} added to your contribution."` and navigates Home, telling the user the recording was saved even if the segment finalize failed. `HumynCapture.onError` would normally surface `storage_full`, but the re-entrant `onStop` it triggers hits `handleStop`'s `handlingStopRef`/`ended` guard and is dropped, so the error toast never shows.

**Fix:** Inspect the `stop()` rejection (or wait for `onSessionStop` vs `onError`) before deciding the post-stop toast/route; at minimum don't claim "added to your contribution" on a finalize failure.

---

_Reviewed: 2026-05-11T10:36:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
