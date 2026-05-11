# Phase 4: HandDetector, Recording UX & Practice Tutorial - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** ~26 new + 6 modified
**Analogs found:** 22 / 26 new (4 genuinely net-new patterns flagged below)

> Spine for the file list = `04-RESEARCH.md` § "Recommended Project Structure (Phase 4 deltas only)" (lines 444–479), cross-checked against `04-CONTEXT.md` `<domain>` + `<decisions>` + `<specifics>`. Phases 1–3 are fully implemented — almost every new file has a real codebase analog. Where an analog exists, the planner should copy its **structure + docstring conventions + error-code ergonomics + test shape**, not improvise.

---

## File Classification

### New Kotlin native modules (4 modules × 2 files each)

| New file                                                       | Role                        | Data flow                                                | Closest analog                                                                                                                                                                                                                                                                | Match quality                                                                                                                                                              |
| -------------------------------------------------------------- | --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `android/.../handdetector/HumynHandDetectorModule.kt`          | native module (Promise)     | transform (bitmap → Int)                                 | `android/.../updater/HumynUpdaterModule.kt` (bgExecutor + Promise + per-method error codes) + `android/.../capture/HumynCaptureModule.kt` (`@ReactModule`, `Executors.newSingleThreadExecutor()`, `errorCodeFor`)                                                             | exact (role + bg-executor pattern) — body content is net-new (MediaPipe), see `04-RESEARCH.md` § "HumynHandDetector — Kotlin module" lines 616–678 for the verbatim recipe |
| `android/.../handdetector/HumynHandDetectorPackage.kt`         | native package registration | n/a                                                      | `android/.../updater/HumynUpdaterPackage.kt`                                                                                                                                                                                                                                  | exact                                                                                                                                                                      |
| `android/.../phonestate/HumynPhoneStateModule.kt`              | native module (events)      | event-driven (audio-focus → `RCTDeviceEventEmitter`)     | `android/.../capture/HumynCaptureModule.kt` `emitEvent()` (lines 263–267 — `getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload)`) + `HumynUpdaterModule` for module shell                                                             | role-match (emit pattern exists; `AudioManager.OnAudioFocusChangeListener` body net-new)                                                                                   |
| `android/.../phonestate/HumynPhoneStatePackage.kt`             | native package registration | n/a                                                      | `android/.../updater/HumynUpdaterPackage.kt`                                                                                                                                                                                                                                  | exact                                                                                                                                                                      |
| `android/.../battery/HumynBatteryModule.kt`                    | native module (events)      | event-driven (`ACTION_BATTERY_CHANGED` broadcast → emit) | same as `HumynPhoneStateModule.kt` — `HumynCaptureModule.emitEvent()` is the emit template; `WindowManager`/`BroadcastReceiver` mechanics are net-new                                                                                                                         | role-match                                                                                                                                                                 |
| `android/.../battery/HumynBatteryPackage.kt`                   | native package registration | n/a                                                      | `android/.../updater/HumynUpdaterPackage.kt`                                                                                                                                                                                                                                  | exact                                                                                                                                                                      |
| `android/.../screenbrightness/HumynScreenBrightnessModule.kt`  | native module (Promise)     | request-response (`set(value)` → window attr write)      | `android/.../capture/HumynCaptureModule.kt` `applyKeepScreenOn()` (lines 196–211 — `reactApplicationContext.currentActivity ?: return; activity.runOnUiThread { activity.window?... }`) — **this is the exact UI-thread-window-mutation pattern HumynScreenBrightness needs** | exact (the window-mutation-on-UI-thread idiom already exists verbatim)                                                                                                     |
| `android/.../screenbrightness/HumynScreenBrightnessPackage.kt` | native package registration | n/a                                                      | `android/.../updater/HumynUpdaterPackage.kt`                                                                                                                                                                                                                                  | exact                                                                                                                                                                      |

### New JS native bindings (`apps/mobile/src/native/`)

| New file                              | Role                     | Data flow        | Closest analog                                                                                                                              | Match quality |
| ------------------------------------- | ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/native/HumynHandDetector.ts`     | native binding (Promise) | transform        | `src/native/HumynCompat.ts` (`ensure()` guard + `NativeModules.X` cast + async wrapper)                                                     | exact         |
| `src/native/HumynPhoneState.ts`       | native binding (events)  | event-driven     | `src/native/HumynCapture.ts` (lazy `NativeEventEmitter`, `on*(listener): EmitterSubscription`, leak-warning docstring — lines 91–146)       | exact         |
| `src/native/HumynBattery.ts`          | native binding (events)  | event-driven     | `src/native/HumynCapture.ts` (same as above)                                                                                                | exact         |
| `src/native/HumynScreenBrightness.ts` | native binding (Promise) | request-response | `src/native/HumynCompat.ts` `ensure()` + single async method; `src/native/HumynCapture.ts` for the `not registered` error string convention | exact         |

### Modified Kotlin / manifest files

| Modified file                                      | Role                   | Change                                                                                                                                                                                           | Closest analog for the change                                                                                                                                                          |
| -------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `android/.../MainApplication.kt`                   | app entry              | register 4 new `ReactPackage`s in `getPackages()`; add `onCrashRecovery` relay after `CaptureLaunchSweep(filesDir).run()`; register `OrientationActivityLifecycle.getInstance()` in `onCreate()` | the file itself — lines 33–39 already list `packages.add(HumynCapturePackage())` etc.; lines 67 `CaptureLaunchSweep(filesDir).run()` is exactly where the recovery-event emit hooks in |
| `android/.../MainActivity.kt`                      | activity               | `override onConfigurationChanged()` for orientation-locker; add `android:configChanges`                                                                                                          | net-new override; trivial                                                                                                                                                              |
| `android/app/src/main/AndroidManifest.xml`         | manifest               | add `android:configChanges="orientation\|screenSize"` on MainActivity                                                                                                                            | `__tests__/manifests/manifests.test.ts` is the invariant guard precedent                                                                                                               |
| `android/app/build.gradle`                         | build                  | add `implementation "com.google.mediapipe:tasks-vision:0.10.21"`                                                                                                                                 | net-new dep line                                                                                                                                                                       |
| `android/app/src/main/assets/hand_landmarker.task` | binary asset (~7.8 MB) | new bundled file                                                                                                                                                                                 | net-new (Google model card download)                                                                                                                                                   |

### New JS screens / hooks / reducer / lib / boot

| New file                                                | Role                                                     | Data flow                                                                | Closest analog                                                                                                                                                                                                                                                                                                                                                            | Match quality                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/screens/recording/RecordingScreen.tsx`             | screen (stateful, owns reducer + VC mount + transition)  | event-driven + state machine                                             | `src/screens/compat/CompatRunningScreen.tsx` (`useEffect` lifecycle, `cancelled` ref, `setInterval` cleanup, `navigation.replace` routing, ScreenContainer + tokens) — closest _behavioral_ analog; no existing screen owns a `<Camera>` or a reducer                                                                                                                     | role-match (lifecycle/cleanup pattern; VC mount + reducer net-new)                           |
| `src/screens/recording/recState.ts`                     | reducer + types (state machine)                          | n/a (pure)                                                               | **NO direct analog** — Phase 2/3 used Zustand for global state; no `useReducer` discriminated-state-machine module exists. `src/state/initialRoute.ts` is the closest "pure decision function" precedent (no side effects, returns a discriminated union)                                                                                                                 | NET-NEW (shape verbatim from `engineering-handoff.md §4.3` / `04-RESEARCH.md` lines 318–347) |
| `src/screens/recording/useRecordingLifecycle.ts`        | hook (multi-subscription policy table)                   | event-driven (AppState/orientation/audio-focus/battery/storage → policy) | `src/hooks/useForegroundUserRehydrate.ts` (`useEffect` + `AppState.addEventListener('change', …)` + `return () => sub.remove()` + swallow-with-telemetry pattern — lines 31–63) — exact for the AppState-subscription idiom; multi-source fan-in is net-new                                                                                                               | role-match                                                                                   |
| `src/screens/recording/useHandGate.ts` (optional split) | hook (poll loop)                                         | request-response loop                                                    | `CompatRunningScreen.tsx` `imuTickRef` `setInterval` + `stopImuTick()` cleanup (lines 154–199) — same recursive-timer + ref-cleanup discipline                                                                                                                                                                                                                            | role-match                                                                                   |
| `src/screens/recording/components/GateRing.tsx`         | component (SVG progress ring)                            | n/a (presentational)                                                     | `src/components/CompatRing.tsx` (130×130 SVG, `Animated.createAnimatedComponent(Circle)`, `strokeDasharray`/`strokeDashoffset`, `useNativeDriver: false`) — **near-identical technique**; design-spec §5.8 says "built from scratch — no reuse of the compat-check ring", so make a fresh component with the same technique                                               | exact (technique)                                                                            |
| `src/screens/recording/components/VoiceCuePill.tsx`     | component (overlay pill, auto-dismiss)                   | n/a                                                                      | `src/components/SoftUpgradeBanner.tsx` (transient banner) — partial; auto-fade timer is the new bit                                                                                                                                                                                                                                                                       | partial                                                                                      |
| `src/screens/recording/components/StopConfirmModal.tsx` | component (confirm modal)                                | n/a                                                                      | `src/components/LogoutModal.tsx` (`<Modal transparent visible animationType="fade">`, scrim `rgba(0,0,0,0.5)`, two `<Button>` actions, Pattern-66 re-entrancy ref — lines 27–115)                                                                                                                                                                                         | exact                                                                                        |
| `src/screens/recording/components/AlertPill.tsx`        | component (battery/thermal alert pill)                   | n/a                                                                      | `src/components/SoftUpgradeBanner.tsx`                                                                                                                                                                                                                                                                                                                                    | partial                                                                                      |
| `src/screens/recording/components/RotatePrompt.tsx`     | component (rotate-prompt substate body + `__DEV__` pill) | n/a                                                                      | `src/screens/permissions/PermissionsScreen.tsx` / any icon+title+body screen                                                                                                                                                                                                                                                                                              | role-match                                                                                   |
| `src/screens/tutorial/PracticeIntroScreen.tsx`          | screen (static, light)                                   | n/a                                                                      | `src/screens/tutorial/RigTutorialScreen.tsx` (illustration + heading + body + muted link + bottom CTA; `logEvent` on mount; `navigation.getParent()?.replace(...)` to jump out of OnboardingStack — lines 91–206) — **near-perfect template**                                                                                                                             | exact                                                                                        |
| `src/screens/tutorial/PracticeCompleteScreen.tsx`       | screen (terminal, light, confetti + haptic)              | n/a                                                                      | `src/screens/compat/CompatPassScreen.tsx` (transient success screen, auto-advance) for the flow; `RigTutorialScreen.tsx` for layout + `decodeGoogleSubFromJwt` (which **must be reused, not re-implemented** — lines 55–81) + the MMKV-write-then-`navigation.reset` pattern (`appStore.setTutorialDone(googleSub)` writes the existing `onboarding.tutorialDone.v1` key) | role-match (confetti/scale-pop net-new)                                                      |
| `src/lib/ttsVoice.ts` (or `src/util/ttsVoice.ts`)       | utility (voice fallback chain)                           | transform                                                                | **NO analog** — no existing `react-native-tts` usage anywhere (`grep` confirms only `HumynCapture.types.ts` mentions "Tts" in a comment). `src/util/semver.ts` / `src/util/analytics.ts` are the closest "pure util module" precedents for file shape                                                                                                                     | NET-NEW (chain logic from `04-RESEARCH.md` lines 414–418 / Pattern 4)                        |
| `src/boot/bootRecoveryListener.ts`                      | boot helper (one-shot event listener → toast)            | event-driven                                                             | `src/hooks/useForegroundUserRehydrate.ts` for the "subscribe-once at boot, swallow errors" shape; **but there is NO existing toast primitive** — `grep -ri toast apps/mobile/src` returns nothing. A toast component/host is itself net-new for Phase 4                                                                                                                   | NET-NEW (toast host) + role-match (listener shape)                                           |

### Modified JS files

| Modified file                                  | Role             | Change                                                                                                                                                                                                                                                                                                    | Closest analog for the change                                                                                                          |
| ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/tutorial/RigTutorialScreen.tsx`   | screen           | change `handleNext` target from `'MainTabs'` to `'PracticeIntro'` (the OnboardingStack route) — the file's own comment at lines 105–108 already flags "Phase 4 will splice the Practice screen between this Next handler and MainTabs"                                                                    | self — surgical 1-line change to `handleNext` (lines 102–116)                                                                          |
| `src/screens/tasks/TasksPlaceholderScreen.tsx` | screen           | add `__DEV__`-gated long-press affordance on heading → `navigation.push('Recording', {…hardcoded task…})`                                                                                                                                                                                                 | the file itself (35 lines, minimal); `RigTutorialScreen` for the `useNavigation` + push idiom                                          |
| `src/navigation/RootNativeStack.tsx`           | navigator        | add `<Root.Screen name="Recording" component={RecordingScreen} options={{ gestureEnabled: false, headerShown: false, animation: 'fade' }} />` as a MainTabs sibling                                                                                                                                       | the file itself — lines 63–89 are the template (`ForceUpgrade` shows `gestureEnabled: false`; `LogoutModal` shows `animation: 'fade'`) |
| `src/navigation/OnboardingStack.tsx`           | navigator        | add `<Stack.Screen name="PracticeIntro" .../>` + `<Stack.Screen name="PracticeComplete" .../>` after `RigTutorial`                                                                                                                                                                                        | the file itself — lines 26–38 are the template                                                                                         |
| `src/state/initialRoute.ts`                    | pure decision fn | extend the `tutorialDone` gate (step 5, lines 71–73) to also check the per-account MMKV flag, OR keep using `s.tutorialDone` (which is already per-Google-sub-persisted via `setTutorialDone(googleSub)`) and just confirm the existing semantics suffice — see "Pattern Assignments" note                | the file itself + `04-RESEARCH.md` lines 712–723 pseudo-code                                                                           |
| `src/state/keys.ts`                            | constants        | add `ONBOARDING_PRACTICE_DONE` key OR a `practiceDoneKey(sub)` helper (mirrors `softBannerDismissKey(latest)` at lines 24–26) — note: the locked CONTEXT key shape is `tutorial.practice_done.{accountId}.v1` which is a _parameterised_ key, so the `softBannerDismissKey`-style helper is the precedent | self — `softBannerDismissKey()` at lines 24–26                                                                                         |
| `App.tsx`                                      | root             | mount `bootRecoveryListener` after `hydrate()` (or inside RootNativeStack like `useForegroundUserRehydrate`)                                                                                                                                                                                              | `App.tsx` lines 24–25 (`hydrate()` call site); `RootNativeStack.tsx` line 59 (`useForegroundUserRehydrate()` mount site)               |

### New tests (mirror existing test families)

| New test                                                                                                                                              | Analog test                                                                                                                                                                                                                               | Match quality                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `__tests__/native/HumynHandDetector.test.ts`                                                                                                          | `__tests__/native/HumynCapture.test.ts` (`vi.resetModules()` beforeEach, `vi.doMock('react-native', ...)` to inject `NativeModules.X`, not-registered-rejects describe block, registered-forwards-verbatim describe block — lines 26–293) | exact                                                          |
| `__tests__/native/HumynPhoneState.test.ts` / `HumynBattery.test.ts`                                                                                   | `__tests__/native/HumynCapture.test.ts` § "event subscriptions" describe (the `setupEmitterMock()` "constructor spy" pattern — lines 134–230)                                                                                             | exact                                                          |
| `__tests__/native/HumynScreenBrightness.test.ts`                                                                                                      | `__tests__/native/HumynCompat.test.ts` (simple Promise-forward)                                                                                                                                                                           | exact                                                          |
| `__tests__/screens/recording/recState.test.ts` (reducer policy table)                                                                                 | `__tests__/state/initialRoute.test.ts` (pure-function-over-state, one assertion per branch, `baseState(overrides)` helper — lines 13–102) — **the policy-table test should follow this exact "table of (event, expected-action)" shape**  | exact (the §10 policy table is a perfect fit for this pattern) |
| `__tests__/screens/recording/useRecordingLifecycle.test.tsx`                                                                                          | `__tests__/navigation/ForegroundRehydrate.test.tsx` (hook-with-AppState test) + fake-timer pattern from `CompatRunningScreen` tests                                                                                                       | role-match                                                     |
| `__tests__/screens/RecordingScreen.test.tsx` + `PracticeIntroScreen.test.tsx` + `PracticeCompleteScreen.test.tsx`                                     | `__tests__/screens/RigTutorialScreen.test.tsx`, `__tests__/screens/CompatRunningScreen.test.tsx`                                                                                                                                          | exact                                                          |
| `__tests__/visual/RecordingScreen.visual.test.tsx` (×~8 baselines) + `PracticeIntroScreen.visual.test.tsx` + `PracticeCompleteScreen.visual.test.tsx` | `__tests__/visual/RigTutorialScreen.visual.test.tsx` (lines 1–43 — `vi.mock('../../src/state/appStore', ...)`, `render()`, `renderToImage(container)`, `expect(png).toMatchImageSnapshot()`) + `_utils/renderToImage.ts`                  | exact                                                          |
| `__tests__/navigation/route-registry.test.ts` (UPDATE, not new)                                                                                       | itself — move `'Recording'` out of the `phase3Plus` "must be absent" list (line 125) into `REQUIRED_PHASE_2_ROUTES`; add `'PracticeIntro'` + `'PracticeComplete'`; this is the locked Pattern-54 invariant                                | exact                                                          |

---

## Pattern Assignments

### `android/.../handdetector/HumynHandDetectorModule.kt` (native module, transform)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` (shell) + `…/capture/HumynCaptureModule.kt` (single-thread executor + typed error dispatch).

**Module-shell pattern (copy from HumynUpdaterModule.kt lines 53–67):**

```kotlin
@ReactModule(name = HumynUpdaterModule.NAME)
class HumynUpdaterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    companion object { const val NAME = "HumynUpdater" }
    private val bgExecutor = Executors.newSingleThreadExecutor()
    override fun getName(): String = NAME

    @ReactMethod
    fun downloadAndVerifyApk(url: String, expectedSha256: String, promise: Promise) {
        bgExecutor.execute {
            try { /* ... */ promise.resolve(map) }
            catch (t: Throwable) { promise.reject("DOWNLOAD_FAILED", "${t::class.simpleName}: ${t.message}", t) }
        }
    }
}
```

→ For `HumynHandDetector`: `NAME = "HumynHandDetector"`, one `@ReactMethod fun detectHands(path: String, promise: Promise)` on `bgExecutor` returning the `Int` landmark count, plus a `cleanup()` method. **Body content (MediaPipe `HandLandmarker` lazy-init, `BitmapFactory.decodeFile` with `RGB_565`, `createScaledBitmap(.,320,240,.)`, `BitmapImageBuilder(bmp).build()`, `landmarker.detect(mpImage)`, `bmp.recycle()` in `finally`) is NET-NEW — copy verbatim from `04-RESEARCH.md` § "HumynHandDetector — Kotlin module" lines 616–678.** HAND-13 memory hygiene is the critical part.

---

### `android/.../screenbrightness/HumynScreenBrightnessModule.kt` (native module, request-response)

**Analog:** `…/capture/HumynCaptureModule.kt` `applyKeepScreenOn()` — **the exact UI-thread-window-mutation idiom already exists in-repo**:

```kotlin
private fun applyKeepScreenOn(enabled: Boolean) {
    val activity: Activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
        if (enabled) activity.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}
```

→ For `HumynScreenBrightness.set(value: Double, promise: Promise)`: same `currentActivity ?: return (resolve null)` null-safety, same `runOnUiThread`, but mutate `activity.window?.attributes` with `attrs.screenBrightness = value.toFloat()` (or `WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE` = `-1f` to restore) then re-assign `activity.window?.attributes = attrs`. Note RN 0.83 deprecated the protected `currentActivity` accessor — use `reactApplicationContext.currentActivity` exactly as HumynCaptureModule does (see its comment lines 197–202).

---

### `android/.../{phonestate,battery}/Humyn*Module.kt` (native modules, event-driven)

**Analog:** `…/capture/HumynCaptureModule.kt` `emitEvent()` (lines 263–267) — the canonical `RCTDeviceEventEmitter` emit:

```kotlin
internal fun emitEvent(name: String, payload: WritableMap) {
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, payload)
}
```

→ `HumynPhoneState`: register an `AudioFocusRequest`+`OnAudioFocusChangeListener` (API 26+), `emit("onAudioFocusChanged", Arguments.createMap().apply { putString("focus", "...") })`. Add `start()`/`stop()` `@ReactMethod`s; unregister the listener in `invalidate()`/`onCatalystInstanceDestroy`. **NO `TelephonyManager`, NO `READ_PHONE_STATE`** (CLAUDE.md forbidden — see `04-RESEARCH.md` Pitfall 2 lines 534–540).
→ `HumynBattery`: register a `BroadcastReceiver` for `Intent.ACTION_BATTERY_CHANGED`, compute `level/scale` as `0..1` float, read `BatteryManager.EXTRA_STATUS` for `isCharging`, `emit("onBatteryChanged", {level, isCharging})` on change. `WritableMap` composition mirrors what `MetadataComposer.kt` / `CaptureSession.kt` do for segment events.

**Package files** (`Humyn*Package.kt`) — copy `HumynUpdaterPackage.kt` verbatim, swap the class names:

```kotlin
class HumynUpdaterPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynUpdaterModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
```

---

### `android/.../MainApplication.kt` (modify — register packages + recovery relay)

**Analog:** the file itself. Registration block (lines 32–40):

```kotlin
override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages.toMutableList()
    packages.add(AppFlavorPackage())
    packages.add(PlayIntegrityPackage())
    packages.add(HumynCompatPackage())
    packages.add(HumynUpdaterPackage())
    packages.add(HumynCapturePackage())
    return packages
}
```

→ append `packages.add(HumynHandDetectorPackage())`, `HumynPhoneStatePackage()`, `HumynBatteryPackage()`, `HumynScreenBrightnessPackage()`.

`onCrashRecovery` relay: the sweep call site is line 67 `CaptureLaunchSweep(filesDir).run()`. **⚠ This is a surgical edit to a Phase-3-owned module** — keep minimal, add a unit test (`04-RESEARCH.md` Pattern 6 / Pitfall, lines 424–426). The event payload shape is planner-discretion (`{recovered: string[]}` sketched). Confirm whether the relay belongs in `MainApplication.onCreate()` or inside `HumynCapturePackage`/`CaptureLaunchSweep` itself.

---

### `src/native/HumynHandDetector.ts` + `HumynScreenBrightness.ts` (JS bindings, Promise)

**Analog:** `src/native/HumynCompat.ts` — the `ensure()` guard pattern:

```typescript
import { NativeModules } from 'react-native';
interface HumynCompatNativeModule {
  runEncoderProbe(): Promise<EncoderProbeResult> /* ... */;
}
function ensure(): HumynCompatNativeModule {
  const native = NativeModules.HumynCompat as HumynCompatNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynCompat native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}
export async function runEncoderProbe(): Promise<EncoderProbeResult> {
  return ensure().runEncoderProbe();
}
```

→ `HumynHandDetector.ts`: `interface HumynHandDetectorNativeModule { detectHands(path: string): Promise<number>; cleanup(): Promise<void>; }`, `ensure()` with the canonical `'HumynHandDetector native module not registered — check …MainApplication.kt'` string, `export async function detectHands(path)` / `cleanup()`.
→ `HumynScreenBrightness.ts`: `interface { set(value: number): Promise<void>; }`, `export async function set(value: number)` (value 0..1, or -1 to restore). The docstring should follow the `HumynCompat.ts` block-comment convention (purpose, mirrors-which-Kotlin-file, error codes).

---

### `src/native/HumynPhoneState.ts` + `HumynBattery.ts` (JS bindings, events)

**Analog:** `src/native/HumynCapture.ts` lines 91–146 — lazy `NativeEventEmitter` + `on*(listener): EmitterSubscription` + leak-warning docstring:

```typescript
import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) {
    _emitter = new NativeEventEmitter(NativeModules.HumynCapture);
  }
  return _emitter;
}
/** Subscribe to `onSegmentStart` events. Caller MUST `.remove()` the
 * returned subscription on unmount (T-3.3-04 leak mitigation). */
export function onSegmentStart(listener: (e: SegmentStartEvent) => void): EmitterSubscription {
  return emitter().addListener('onSegmentStart', listener);
}
```

→ `HumynPhoneState.ts`: `start()`/`stop()` Promise methods + `onAudioFocusChanged(listener: (e: { focus: 'gain'|'loss'|'transient_loss'|'transient_loss_can_duck' }) => void): EmitterSubscription`. **Keep the "caller MUST `.remove()` on unmount" docstring verbatim** — `useRecordingLifecycle` will use the standard `useEffect` cleanup.
→ `HumynBattery.ts`: `start()`/`stop()` + `onBatteryChanged(listener: (e: { level: number; isCharging: boolean }) => void): EmitterSubscription`.

---

### `src/screens/recording/recState.ts` (NET-NEW — reducer + state machine)

**No direct analog.** Closest precedent for "pure module returning a discriminated union with no side effects" is `src/state/initialRoute.ts` (`InitialRoute` union + `computeInitialRoute(s, sig)`). Use that as the _file-shape_ template (top docstring listing the decision tree; exported types; pure function). The `RecState` shape itself is **verbatim from `engineering-handoff.md §4.3`** — reproduced in `04-RESEARCH.md` lines 318–347 (`taskId`, `taskName`, `isPractice`, `startedAt`, `durationMs`, `cap: 60_000|1_200_000`, plus the `gate` sub-object `{ phase, consecutiveHits, targetHits, cadenceMs, skipped, bypassed, confirmedAt, startedAt }`). Substate enum: `'rotate-prompt' | 'ready' | 'pre-flight' | 'gate' | 'active' | 'stop-confirm' | 'stopped'` (`gate.phase` is a sub-discriminant; `thermal-alert`/`battery-alert` are overlay flags on `alerts`, not substates). CONTEXT D-CONTEXT leaves Zustand-slice-vs-`useReducer` to discretion — RESEARCH recommends `useReducer` screen-local (anti-pattern: "Sharing `recState` globally via Zustand 'just in case'").

---

### `src/screens/recording/useRecordingLifecycle.ts` (hook, event-driven)

**Analog:** `src/hooks/useForegroundUserRehydrate.ts` — the `useEffect` + `AppState.addEventListener` + cleanup + swallow-with-telemetry idiom:

```typescript
export function useForegroundUserRehydrate(): void {
  useEffect(() => {
    const rehydrate = async () => { /* ... */ try { /* ... */ } catch (e) { logEvent('rehydrate_user_failed', { reason: ... }); } };
    void rehydrate();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void rehydrate(); });
    return () => sub.remove();
  }, []);
}
```

→ `useRecordingLifecycle` adds fan-in from: `AppState`, `Linking` (RN built-ins), `Orientation.addOrientationListener` + `addDeviceOrientationListener` (`react-native-orientation-locker`), `HumynPhoneState.onAudioFocusChanged`, `HumynBattery.onBatteryChanged`, `react-native-fs.getFSInfo()` (storage poll), plus the `HumynCapture` `onError`/`onThermalAbort` events. **Every subscription returns something with `.remove()` — collect them all and `.remove()` each in the single `useEffect` cleanup** (RESEARCH Pitfall 5, lines 555–560). The §10 policy table (`04-RESEARCH.md` Pattern 3 lines 380–412; CONTEXT `<specifics>` lines 682–700) maps each event to `stop()` | `continue()` | `alert+continue()` | `refuse-new()`. The "answered vs declined" timing heuristic (~6–8 s timer on `AUDIOFOCUS_LOSS_TRANSIENT`) is documented at RESEARCH lines 412.

---

### `src/screens/recording/RecordingScreen.tsx` (screen, owns reducer + VC + transition)

**Analog:** `src/screens/compat/CompatRunningScreen.tsx` — the behavioral pattern (no existing screen owns a `<Camera>`):

```typescript
const cancelled = useRef(false);
const imuTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
useEffect(() => {
  cancelled.current = false;
  const stopImuTick = () => { if (imuTickRef.current !== null) { clearInterval(imuTickRef.current); imuTickRef.current = null; } };
  /* ... runCompatCheck(handleProgress).then(result => { ... navigation.replace(...); }) ... */
  return () => { cancelled.current = true; stopImuTick(); };
}, [navigation, ...]);
```

→ RecordingScreen: `useReducer(recReducer, initialRecState(routeParams))`, mounts `useRecordingLifecycle(...)` and (optionally) `useHandGate(...)`, on mount calls `Orientation.lockToLandscape()` + reads `compat.lastResult.v1.checks.ultrawideDfov.{cameraId,measuredDeg}` from MMKV + reads Remote Config gate keys. The VC `<Camera ref device={ultrawide} photo={true} photoQualityBalance="speed" isActive={substate === 'gate'} onInitialized={...} />` is net-new (no precedent). The gate-pass → active transition sequence (vibrate 80 ms → `Tts.speak` → `HumynScreenBrightness.set(0.05)` → `setCameraActive(false)` → settle → `HumynCapture.start(opts)` → dispatch CAPTURE_STARTED, with the reject path → `set(-1)` + ready) is verbatim from `04-RESEARCH.md` Pattern 2 / `<specifics>` lines 724–739. **Building `CaptureSessionOpts` is richer than it looks** — it needs `taskCategory`, `taskSetting`, full `contributor` object, `location`, `appVersion`, `dfovDegrees`, structured `startGate` — see `shared/types/src/CaptureSessionOpts.ts` and the `VALID_OPTS` fixture in `__tests__/native/HumynCapture.test.ts` lines 29–54 for the exact shape. On unmount/exit: `HumynScreenBrightness.set(-1)` + `Orientation.unlockAllOrientations()`.

---

### `src/screens/recording/components/GateRing.tsx` (component, SVG)

**Analog:** `src/components/CompatRing.tsx` — the exact SVG-progress-ring technique (design-spec §5.8 requires a _fresh_ component, same technique):

```typescript
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 130; const STROKE = 8; const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// ...
<AnimatedCircle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={colors.accent} strokeWidth={STROKE}
  fill="none" strokeLinecap="round" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
  strokeDashoffset={offset as unknown as number} transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`} />
// Animated.timing(offset, { toValue: CIRCUMFERENCE * (1 - clamped/100), duration: ..., useNativeDriver: false })
```

→ GateRing: 130×130, **6 px stroke** (per UI-SPEC — CompatRing uses 8 px), track color `rgba(255,255,255,.18)` (UI-SPEC dark surface), fill `colors.accent`. Note: any non-2-hand result snaps the ring to 0 _instantly_ (no animation) per UI-SPEC, so the snap-to-0 case should bypass the `Animated.timing` and set the value directly. CompatRing also shows the precedent for the centered `%` text overlay (`styles.percentWrap` absolute).

---

### `src/screens/recording/components/StopConfirmModal.tsx` (component, confirm modal)

**Analog:** `src/components/LogoutModal.tsx` — verbatim two-action confirm-modal template:

```typescript
const inFlightRef = useRef(false);
const confirm = () => { if (inFlightRef.current) return; inFlightRef.current = true; /* ... */ };
return (
  <Modal transparent visible animationType="fade" onRequestClose={cancel}>
    <View style={styles.scrim}>{/* backgroundColor: 'rgba(0,0,0,0.5)' */}
      <View style={styles.card} accessibilityLabel="logout-modal">
        <Text variant="sheetTitle" style={styles.title}>Log out?</Text>
        <Text variant="body" tone="secondary" style={styles.body}>You'll need to sign in again...</Text>
        <View style={styles.actions}>
          <Button variant="outline" label="Cancel" onPress={cancel} />
          <Button variant="primary" label="Log out" onPress={confirm} />
        </View>
```

→ StopConfirmModal: title `"Stop recording?"` `[confirm w/ PM]`, body `"Recordings under 1 minute are discarded."` (LOCKED), actions `"Keep recording"` (`btn-outline`) + `"Stop"` (`btn-coral` — the destructive variant). **Keep the Pattern-66 `inFlightRef` re-entrancy guard.** Note `LogoutModal` uses `'rgba(0,0,0,0.5)'` for the scrim — the one sanctioned non-token rgba per `engineering-handoff §1.5`; UI-SPEC's recording modals will need their own dark-theme values.

---

### `src/screens/tutorial/PracticeIntroScreen.tsx` (screen, static light)

**Analog:** `src/screens/tutorial/RigTutorialScreen.tsx` — near-perfect template:

```typescript
export default function RigTutorialScreen() {
  const navigation = useNavigation() as unknown as LocalNav;
  useEffect(() => { logEvent('rig_tutorial_shown'); }, []);
  const handleNext = () => {
    /* ... */
    const parent = navigation.getParent?.();
    if (parent && typeof parent.replace === 'function') { parent.replace('MainTabs'); }
    else { navigation.replace('MainTabs'); }
  };
  return (
    <ScreenContainer accessibilityLabel="RigTutorial screen" style={styles.screen}>
      <View style={styles.center}>
        <Image source={RIG_ILLUSTRATION} style={styles.illustration} accessibilityLabel="rig illustration" />
        <Text variant="tutorialHeading" tone="primary" style={styles.heading}>You'll need a head rig</Text>
        <Text variant="tutBody" tone="secondary" style={styles.body}>Mount your phone...</Text>
      </View>
      <Button variant="primary" label="Next" onPress={handleNext} accessibilityLabel="Next" />
```

→ PracticeIntro: heading `"One quick try"` (`tutorialHeading` 30/36 700), body `"We'll walk you through one short recording — 60 seconds, just to get the feel."` (`tutBody` 17/25), muted line `"This is a practice task — it does not count towards your contribution."` (`bodyMuted` 14/20), CTA `"Start practice"` (`btn-accent` — note: `--accent #FF6A2D` is reserved for exactly this "go-do-the-recording" CTA per UI-SPEC; `RigTutorial`'s "Next" is `btn-primary`). CTA action: `navigation.replace('Recording', { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true })` — the same "jump out of OnboardingStack" move RigTutorial's `getParent()?.replace()` does, but to `Recording` (a RootNativeStack sibling). `logEvent` on mount (register the new event name in `src/util/analytics.ts`).

---

### `src/screens/tutorial/PracticeCompleteScreen.tsx` (screen, terminal light + confetti)

**Analog:** `src/screens/compat/CompatPassScreen.tsx` (transient success screen → auto-advance) for the _flow_; `RigTutorialScreen.tsx` for the layout + the JWT-sub-derivation + MMKV-write-then-reset pattern.

**MUST REUSE, not re-implement** — `RigTutorialScreen.decodeGoogleSubFromJwt(jwt)` (lines 55–81): atob/Buffer base64url decode of the `payload.sub` claim, returns `''` on any malformed input (no soft-lock). Extract it to a shared util if it isn't already, or import it. The Continue CTA: `const sub = decodeGoogleSubFromJwt(useAppStore.getState().jwt)` → write the practice-done flag to MMKV (`tutorial.practice_done.{sub}.v1`, using the new `practiceDoneKey(sub)` helper) → `navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })`. Compare to `LogoutModal.confirm()` (lines 41–53) for the `nav.reset` idiom and to `appStore.setTutorialDone(googleSub)` (appStore.ts lines 150–154) for the existing per-sub-persisted flag pattern. Confetti (18 particles, 800–1200 ms rise, "random hues from accent palette") + 96×96 `colors.success` badge + scale-pop 500 ms + `Vibration.vibrate([0, 40, 80, 40])` on enter are NET-NEW (Reanimated 3.16.x; no existing confetti component).

---

### `src/lib/ttsVoice.ts` (NET-NEW utility)

**No analog** — zero existing `react-native-tts` usage. File shape: follow `src/util/semver.ts` (pure functions, top docstring). Exports `pickAndSetEnInVoice(): Promise<void>` — `await Tts.getInitStatus()`, `Tts.voices()`, filter `notInstalled`, then the chain: (1) `language === 'en-IN'` + name/id female-ish → (2) any `language === 'en-IN'` → (3) `language === 'en-US'` female-ish → (4) first `language?.startsWith('en')`; `Tts.setDefaultVoice(id)`. Also `Tts.setDefaultRate(1.0, true)` (raw passthrough on Android — `idea-brief.md §13`'s "rate 1.0" is the Android raw value) + `Tts.setDefaultPitch(0.95)`; volume via `androidParams: { KEY_PARAM_VOLUME: 0.85 }` per `speak()` call (no `setDefaultVolume`). See `04-RESEARCH.md` Pattern 4 lines 414–418 (note the **rate-scale correction** there — `setDefaultRate` normally expects 0.01–0.99).

---

### `src/boot/bootRecoveryListener.ts` (NET-NEW — one-shot listener; toast host also net-new)

**Listener-shape analog:** `src/hooks/useForegroundUserRehydrate.ts` ("subscribe once at boot, swallow errors"). **Toast: NO existing primitive** (`grep -ri toast apps/mobile/src` → nothing). Phase 4 needs a toast host/component too — closest precedent for a transient-notification surface is `src/components/SoftUpgradeBanner.tsx` (a dismissible banner). The boot listener: `const sub = HumynCapture.onCrashRecovery(({ recovered }) => { if (recovered?.length) showHomeToast('Recording recovered after force-quit — uploading.'); sub.remove(); });` — mount it the way `useForegroundUserRehydrate()` is mounted (inside `RootNativeStack` at line 59) or right after `hydrate()` in `App.tsx`. Note: `HumynCapture.onCrashRecovery` does not exist yet — it's the Phase-3-module surgical extension (see MainApplication.kt section above), so the JS binding in `HumynCapture.ts` gets a new `onCrashRecovery(listener): EmitterSubscription` export (copy the existing `onSegmentStart` etc. shape).

---

### `__tests__/native/HumynHandDetector.test.ts` + `Humyn{PhoneState,Battery,ScreenBrightness}.test.ts`

**Analog:** `__tests__/native/HumynCapture.test.ts` — exact template:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
describe('HumynCapture (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  it('start rejects when native module missing', async () => {
    const { start } = await import('../../src/native/HumynCapture');
    await expect(start(VALID_OPTS)).rejects.toThrow(/HumynCapture native module not registered/);
  });
});
describe('HumynCapture (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('react-native');
  });
  it('start forwards opts verbatim ...', async () => {
    const native = {
      start: vi.fn().mockResolvedValue(resolved),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    /* ... */
  });
});
```

Event-binding tests reuse the `setupEmitterMock()` "constructor spy" pattern (lines 152–174) — `const emitterCtor = vi.fn(function (this) { this.addListener = addListener; })`.

---

### `__tests__/screens/recording/recState.test.ts` (reducer policy table)

**Analog:** `__tests__/state/initialRoute.test.ts` — the "pure function over state, one assertion per branch, `baseState(overrides)` helper" pattern:

```typescript
function baseState(overrides = {}): RecState { return { /* defaults */, ...overrides }; }
describe('recReducer', () => {
  it('GATE_HIT at hits=4, target=5 → gate.confirmed (passed)', () => {
    expect(recReducer(baseState({ substate: 'gate', gate: {...} }), { type: 'GATE_HIT' })).toMatchObject({ ... });
  });
});
```

The §10 policy table is a natural fit for the same "table of (event, expected-action)" shape — drive `useRecordingLifecycle`'s policy resolver this way too.

---

### `__tests__/visual/RecordingScreen.visual.test.tsx` (×~8) + `Practice*.visual.test.tsx`

**Analog:** `__tests__/visual/RigTutorialScreen.visual.test.tsx` — exact template:

```typescript
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
vi.mock('../../src/state/appStore', () => { /* stub useAppStore + getState */ });
import RigTutorialScreen from '../../src/screens/tutorial/RigTutorialScreen';
import { renderToImage } from './_utils/renderToImage';
describe('RigTutorialScreen visual', () => {
  afterEach(() => cleanup());
  it('matches baseline (...)', () => {
    const { container } = render(<RigTutorialScreen />);
    expect(renderToImage(container)).toMatchImageSnapshot();
  });
});
```

The ~10 baselines (CONTEXT D-WAVE-03 / UI-SPEC notes / `<specifics>` lines 740–751): `practice-intro.png`, `practice-complete-static.png` (pre-confetti), `recording-rotate-prompt.png` (mocked-orientation portrait), `recording-ready.png` (mocked-camera-off), `recording-gate-ring-0/50/100.png` (mocked HandDetector returns), `recording-active-t10s.png` + `recording-active-t05m32s.png` (mocked timers), `recording-stop-confirm-modal.png`. Skip live-camera/brightness/confetti/alert-pill (non-deterministic / not exercisable in jsdom). `renderToImage` is a structural wireframe PNG, not a rasterizer — `vitest.setup.ts` already mocks `react-native-svg`, `react-native-reanimated`, etc.; Phase 4 must add `vi.mock` stubs for `react-native-vision-camera`, `react-native-tts`, `react-native-fs`, `react-native-orientation-locker`, and the 4 new `NativeModules.Humyn*` in `vitest.setup.ts`.

---

### `__tests__/navigation/route-registry.test.ts` (UPDATE — locked Pattern 54)

The file at line 125 currently asserts `Recording` is **absent** (`const phase3Plus = ['Recording', 'Player'];`). Phase 4 must: move `'Recording'` out of that list, add `'Recording'` + `'PracticeIntro'` + `'PracticeComplete'` into `REQUIRED_PHASE_2_ROUTES` (or a new `REQUIRED_PHASE_4_ROUTES` block in the same file). Its removal from the navigators would then fail CI — that's the D-NAV-01 invariant.

---

## Shared Patterns

### Native module + package + JS binding triad

**Source:** `…/updater/HumynUpdaterModule.kt` + `…/updater/HumynUpdaterPackage.kt` + `src/native/HumynCompat.ts` (the canonical 3-file shape), with `MainApplication.getPackages()` registration.
**Apply to:** all four new Kotlin modules.

- Kotlin: `@ReactModule(name = X.NAME)`, `companion object { const val NAME = "X" }`, `private val bgExecutor = Executors.newSingleThreadExecutor()` (never block JS/main thread), per-method/per-type error codes via `promise.reject("CODE", "${t::class.simpleName}: ${t.message}", t)`.
- Package: `class XPackage : ReactPackage { createNativeModules → listOf(XModule(reactContext)); createViewManagers → emptyList() }`.
- JS: `ensure()` guard → `throw new Error('X native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt')`; block-comment docstring (purpose / mirrors-which-Kotlin-file / error codes).

### `RCTDeviceEventEmitter` emit + `NativeEventEmitter` subscribe + leak discipline

**Source (Kotlin emit):** `HumynCaptureModule.emitEvent()` lines 263–267. **Source (JS subscribe):** `HumynCapture.ts` lines 91–146 — lazy `_emitter`, `on*(listener): EmitterSubscription`, "caller MUST `.remove()` on unmount (T-3.3-04)" docstring.
**Apply to:** `HumynPhoneState`, `HumynBattery`, the new `HumynCapture.onCrashRecovery`; and `useRecordingLifecycle` collects every `EmitterSubscription` + `AppState`/`Orientation` sub and `.remove()`s each in one `useEffect` cleanup (RESEARCH Pitfall 5).

### `useEffect`-lifecycle screen with ref-tracked timers + cancellation

**Source:** `CompatRunningScreen.tsx` (`cancelled` ref, `imuTickRef` + `stopImuTick()`, cleanup `return () => { cancelled.current = true; stopImuTick(); }`).
**Apply to:** `RecordingScreen` (the hand-gate poll loop, the transition sequence, the practice 60-s hard cap) and `useHandGate`.

### MMKV key versioning (`.v1`) + parameterised-key helper

**Source:** `src/state/keys.ts` — `KEYS` const for fixed keys + `softBannerDismissKey(latest)` helper (lines 24–26) for parameterised keys; `src/state/appStore.ts` `setTutorialDone(googleSub)` (lines 150–154) for write-through.
**Apply to:** the `tutorial.practice_done.{accountId}.v1` key (parameterised by Google `sub` → use the `softBannerDismissKey`-style helper, e.g. `practiceDoneKey(sub)`); and `computeInitialRoute` reading it (mirror `s.tutorialDone` step 5 in `initialRoute.ts`). JWT `sub` derivation: **reuse `RigTutorialScreen.decodeGoogleSubFromJwt`** (lines 55–81), don't re-implement base64url decode.

### Confirm-modal (two-action, re-entrancy-guarded)

**Source:** `src/components/LogoutModal.tsx` (Pattern 66 — `inFlightRef`; `<Modal transparent visible animationType="fade">`; scrim `rgba(0,0,0,0.5)`; `Button variant="outline"|"primary"` actions; tokens-only styling).
**Apply to:** `StopConfirmModal` (destructive action → `btn-coral`); the dark-theme scrim/card values come from UI-SPEC.

### Tokens-only styling / no hex literals

**Source:** `src/ui/tokens.ts` (`colors`, `spacing`, `radii`, `motion`, `typography`); enforced by `__tests__/ui/no-hex-literals.test.ts`. `colors.recBg = '#0A0A0A'` already exists for the recording surface; UI-SPEC may require new dark-theme tokens (overlay-tip `rgba(0,0,0,.6)`, toast `rgba(26,26,26,.94)`, voice-cue white@96%, ring track `rgba(255,255,255,.18)`, `colors.amber` for alert pill — already a token).
**Apply to:** every new component/screen.

### Visual snapshot baseline (structural wireframe)

**Source:** `__tests__/visual/RigTutorialScreen.visual.test.tsx` + `_utils/renderToImage.ts` + `vitest.setup.ts` `expect.extend({ toMatchImageSnapshot })`.
**Apply to:** all ~10 Phase 4 baselines; add new library `vi.mock`s to `vitest.setup.ts`.

### `__DEV__` / flavor-scoped affordance

**Source:** `src/native/HumynUpdater.ts` `ensureApkRolloutFlavor()` (flavor guard) + `src/native/AppFlavor.ts` `getFlavorContext()`. CONTEXT D-NAV-02 / `<specifics>` line 701–707: long-press (>800 ms) on TasksPlaceholder heading, guarded by `__DEV__` (build-type, not flavor — production `apkRollout`/`playStore` builds strip it).
**Apply to:** the non-practice debug push in `TasksPlaceholderScreen`.

---

## No Analog Found

Files genuinely net-new — the planner cannot lean on an in-repo template (must use `04-RESEARCH.md` recipes / `engineering-handoff.md` shapes / library docs):

| File                                                                                                                                     | Role                                           | Data flow    | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/recording/recState.ts`                                                                                                      | reducer / state machine                        | pure         | No `useReducer` discriminated-state-machine module exists; only Zustand global stores + `initialRoute.ts`'s pure decision-fn precedent (use for _file shape_ only). Shape verbatim from `engineering-handoff.md §4.3`.                                                                                                                                                                                                                                          |
| `src/lib/ttsVoice.ts`                                                                                                                    | utility (TTS voice fallback)                   | transform    | Zero existing `react-native-tts` usage anywhere in the repo. Chain logic from `04-RESEARCH.md` Pattern 4.                                                                                                                                                                                                                                                                                                                                                       |
| `src/boot/bootRecoveryListener.ts` + toast host                                                                                          | boot listener + transient-notification surface | event-driven | No toast/snackbar primitive exists (`grep -ri toast apps/mobile/src` → nothing). Listener-shape borrows `useForegroundUserRehydrate`; the toast component is new (closest precedent: `SoftUpgradeBanner`). Also depends on the not-yet-existing `HumynCapture.onCrashRecovery` event (Phase-3-module surgical extension).                                                                                                                                       |
| `android/app/src/main/assets/hand_landmarker.task`                                                                                       | binary asset                                   | n/a          | ~7.8 MB model bundle downloaded from Google's MediaPipe HandLandmarker model card; not generated from code.                                                                                                                                                                                                                                                                                                                                                     |
| Bodies of `HumynHandDetectorModule.kt` (MediaPipe) / `HumynPhoneStateModule.kt` (AudioFocus) / `HumynBatteryModule.kt` (BatteryReceiver) | —                                              | —            | Module _shells_ have exact analogs (above); the _implementation bodies_ (MediaPipe `HandLandmarker`, `AudioManager.OnAudioFocusChangeListener`, `ACTION_BATTERY_CHANGED` receiver) are net-new — copy from `04-RESEARCH.md` § "Code Examples" (lines 612–880) and the `.planning/research/STACK.md` recipes. (`HumynScreenBrightnessModule.kt`'s body IS analogous — `HumynCaptureModule.applyKeepScreenOn()` is the verbatim UI-thread-window-mutation idiom.) |

---

## Metadata

**Analog search scope:** `apps/mobile/src/native/`, `apps/mobile/src/screens/`, `apps/mobile/src/navigation/`, `apps/mobile/src/state/`, `apps/mobile/src/hooks/`, `apps/mobile/src/components/`, `apps/mobile/src/ui/`, `apps/mobile/src/util/`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` (all subpkgs), `apps/mobile/__tests__/` (all subdirs), `shared/types/src/`.
**Files scanned:** ~40 (native modules ×6 Kotlin + ×5 JS bindings, screens ×8, navigators ×3, state ×5, hooks ×2, components ×8, tests ×12 sampled, `MainApplication.kt`, `AppFlavorModule.kt`, `App.tsx`, `vitest.setup.ts`, `renderToImage.ts`, `tokens.ts`).
**Pattern extraction date:** 2026-05-11
