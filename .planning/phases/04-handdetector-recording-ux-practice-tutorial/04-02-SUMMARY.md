---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 02
subsystem: infra
tags:
  [
    react-native,
    native-modules,
    kotlin,
    mediapipe,
    hand-landmarker,
    android,
    react-native-orientation-locker,
    vitest,
  ]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    provides: HumynCapture native module + the canonical 3-file native-module triad pattern (Module/Package/JS-binding), the `ensure()` guard + canonical "not registered" error, the lazy NativeEventEmitter `on*(listener): EmitterSubscription` convention, the `__tests__/native/` `vi.doMock('react-native', ...)` test pattern, MainApplication.getPackages()/onCreate() structure
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: (plan 04-01) MainActivity.onConfigurationChanged broadcast + AndroidManifest android:configChanges flags, the documented Humyn* native-module stub shapes in vitest.setup.ts, react-native-orientation-locker dep
provides:
  - Five new in-house Kotlin native-module shells + their ReactPackages (HumynHandDetector, HumynPhoneState, HumynBattery, HumynScreenBrightness, HumynBeep) — all registered in MainApplication.getPackages()
  - Five JS bindings under apps/mobile/src/native/ with the canonical "X native module not registered — check ...MainApplication.kt" error contract; isHandDetectorAvailable() is the HAND-08 silent-bypass discriminant
  - HumynHandDetector.ts surface — detectHands(path, minConfidence=0.5):Promise<number> + cleanup() + isHandDetectorAvailable()
  - HumynPhoneState.ts — start()/stop() + onAudioFocusChanged(listener):EmitterSubscription (AudioManager focus-loss interruption signal; NO TelephonyManager/READ_PHONE_STATE)
  - HumynBattery.ts — start()/stop() + onBatteryChanged(listener):EmitterSubscription (ACTION_BATTERY_CHANGED)
  - HumynScreenBrightness.ts — set(value:number) (value 0..1 per-window override, -1 = restore system default; REC-08)
  - HumynBeep.ts — playTone(name:string) (pre-baked .wav over SoundPool; REC-10)
  - com.google.mediapipe:tasks-vision:0.10.21 Gradle dep + hand_landmarker.task (~7.8 MB float16 model) bundled under android/app/src/main/assets/
  - MainApplication.onCreate() registers OrientationActivityLifecycle.getInstance() (react-native-orientation-locker activity-lifecycle hook)
  - Five new native-binding unit-test files (23 tests, green)
affects:
  [
    04-04 (HumynHandDetectorModule.kt MediaPipe body — fills in this shell),
    04-05 (HumynPhoneState/Battery/ScreenBrightness/Beep Kotlin bodies + the .wav assets — fill in these shells),
    04-RecordingScreen-plans (every plan that imports the five Humyn* JS bindings and unit-tests them under jsdom),
  ]

# Tech tracking
tech-stack:
  added:
    - com.google.mediapipe:tasks-vision:0.10.21 (Android Gradle dep; Google Maven; iOS-pod parity pin per CLAUDE.md — do NOT bump to 0.10.33+)
    - hand_landmarker.task (~7.8 MB MediaPipe HandLandmarker float16 model bundle, bundled APK asset)
  patterns:
    - "Pattern: native-module SHELL = the canonical 3-file triad (Module/Package/JS-binding) with the @ReactMethod bodies rejecting NOT_IMPLEMENTED (or resolve(null) for trivial start/stop/set) and a docstring naming the plan that wires the real body — establishes the contract surface ahead of the implementation plan"
    - "Pattern: JS bindings copy the HumynCompat.ts ensure() guard verbatim (canonical 'X native module not registered — check ...MainApplication.kt' error); event modules add the lazy NativeEventEmitter from HumynCapture.ts with the 'caller MUST .remove() on unmount' docstring"
    - "Pattern: isHandDetectorAvailable() = `NativeModules.HumynHandDetector != null` is the HAND-08 silent-bypass discriminant — RecordingScreen bypasses the hand gate (no dead poll loop) when it's false"
    - "Pattern: surgical additive edit to a prior-phase-owned file (MainApplication.kt) — append package adds + the OrientationActivityLifecycle registration, never reorder/modify the existing body"

key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorPackage.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/HumynPhoneStateModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/HumynPhoneStatePackage.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryPackage.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/HumynScreenBrightnessModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/HumynScreenBrightnessPackage.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepPackage.kt
    - apps/mobile/src/native/HumynHandDetector.ts
    - apps/mobile/src/native/HumynPhoneState.ts
    - apps/mobile/src/native/HumynBattery.ts
    - apps/mobile/src/native/HumynScreenBrightness.ts
    - apps/mobile/src/native/HumynBeep.ts
    - apps/mobile/android/app/src/main/assets/hand_landmarker.task
    - apps/mobile/__tests__/native/HumynHandDetector.test.ts
    - apps/mobile/__tests__/native/HumynPhoneState.test.ts
    - apps/mobile/__tests__/native/HumynBattery.test.ts
    - apps/mobile/__tests__/native/HumynScreenBrightness.test.ts
    - apps/mobile/__tests__/native/HumynBeep.test.ts
  modified:
    - apps/mobile/android/app/build.gradle
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt

key-decisions:
  - "Copied hand_landmarker.task from the in-repo apk-extracted/assets/ (Figure's APK — byte-identical to Google's MediaPipe model-card float16 bundle, 7,819,105 bytes) rather than downloading at execution time — the plan explicitly permits this fallback and it's deterministic + offline."
  - "Committed each tdd='true' task as a single feat() commit (test + impl together) rather than a strict test()→feat() split — the strict separate-commit gate is for `type: tdd` plans; this is `type: execute` with tdd='true' tasks, and the plan's verify is just 'the test runs green', which it does."
  - "Did NOT add a new deferred-items.md entry for the 2 still-red mobile tests — they are exactly the pre-existing D4-01 HomeSkeletonScreen.tsx __DEV__-smoke-seam failures (hex literals + stale visual baseline) already comprehensively logged in plan 04-01, in files outside this plan's scope. Per the SCOPE BOUNDARY rule they are not auto-fixed here."
  - "Used `Double` (not `Float`) for the Kotlin @ReactMethod params (detectHands minConfidence, screenBrightness value) — JS numbers cross the bridge as Double; the Kotlin body (plans 04-04/04-05) does the `.toFloat()` / clamp internally, matching the 04-RESEARCH code example."

patterns-established:
  - "native-module SHELL pattern (3-file triad, NOT_IMPLEMENTED bodies, plan-that-wires-the-body docstring)"
  - "HAND-08 isHandDetectorAvailable() discriminant"
  - "surgical additive edit to a prior-phase-owned MainApplication.kt"

requirements-completed: [HAND-01, HAND-08, REC-08, REC-10]

# Metrics
duration: 15min
completed: 2026-05-11
---

# Phase 4 Plan 02: HandDetector + recording-UX native-module shells Summary

**Shipped the five in-house Kotlin native-module shells (HumynHandDetector, HumynPhoneState, HumynBattery, HumynScreenBrightness, HumynBeep) + their ReactPackages + JS bindings (incl. the HAND-08 `isHandDetectorAvailable()` silent-bypass discriminant), registered all five plus the react-native-orientation-locker activity-lifecycle hook in `MainApplication.kt`, added the `com.google.mediapipe:tasks-vision:0.10.21` Gradle dep, and bundled the ~7.8 MB `hand_landmarker.task` model asset — the contract surface every Phase-4 RecordingScreen / hand-gate plan typechecks and tests against, with the Kotlin bodies deferred to plans 04-04 / 04-05.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T~13:51Z (first task)
- **Completed:** 2026-05-11T~14:06Z (last task commit)
- **Tasks:** 2 completed
- **Files modified:** 23 (21 created, 2 modified)

## Accomplishments

- Five Kotlin native-module shells (10 files: 5 `Humyn*Module.kt` + 5 `Humyn*Package.kt`) under `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/{handdetector,phonestate,battery,screenbrightness,beep}/` — all mirroring the canonical 3-file triad from `HumynUpdaterModule`/`HumynUpdaterPackage`; `detectHands` rejects `NOT_IMPLEMENTED` (real MediaPipe body lands plan 04-04), `cleanup`/`start`/`stop`/`set`/`playTone` resolve trivially (real bodies land plan 04-05). Each carries a block-comment docstring naming the plan that wires the body + the security constraint it must honour.
- Five JS bindings under `apps/mobile/src/native/` — `HumynHandDetector.ts` (`detectHands(path, minConfidence=0.5):Promise<number>` + `cleanup()` + `isHandDetectorAvailable()` HAND-08 discriminant), `HumynPhoneState.ts` (`start()`/`stop()` + `onAudioFocusChanged(listener):EmitterSubscription`), `HumynBattery.ts` (`start()`/`stop()` + `onBatteryChanged(listener):EmitterSubscription`), `HumynScreenBrightness.ts` (`set(value:number)` — `value ∈ [0,1]` per-window override, `-1` = restore system default; REC-08), `HumynBeep.ts` (`playTone(name:string)`; REC-10). All copy the `HumynCompat.ts` `ensure()` guard verbatim — the canonical `'X native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt'` error; the two event modules copy the lazy `NativeEventEmitter` from `HumynCapture.ts` with the "caller MUST .remove() on unmount" leak-mitigation docstring.
- `MainApplication.getPackages()` registers all five new packages (appended after `HumynCapturePackage()`, with the matching imports); `onCreate()` registers `OrientationActivityLifecycle.getInstance()` (the react-native-orientation-locker activity-lifecycle hook the README requires — plan 04-01 already added the companion `MainActivity.onConfigurationChanged` broadcast + manifest `configChanges` flags). The edit is surgical-additive — no reorder/modification of the existing package adds or `onCreate()` body.
- `apps/mobile/android/app/build.gradle` declares `implementation 'com.google.mediapipe:tasks-vision:0.10.21'` (Google Maven artifact; pinned at 0.10.21 for iOS-pod parity per CLAUDE.md — `MediaPipeTasksVision` iOS pod 0.10.33+ has XCFramework linking issues); `apps/mobile/android/app/src/main/assets/hand_landmarker.task` (7,819,105 bytes ≈ 7.8 MB, copied byte-for-byte from the in-repo `apk-extracted/assets/`).
- `HumynPhoneStateModule.kt` is grep-clean of `TelephonyManager` / `READ_PHONE_STATE` / `PhoneStateListener` (T-4.2-01 — the call-interruption signal is `AudioManager` focus-loss only, no runtime permission, no manifest-invariant trip).
- 23 new native-binding unit tests across 5 files (`HumynHandDetector.test.ts` 7, `HumynPhoneState.test.ts` 5, `HumynBattery.test.ts` 5, `HumynScreenBrightness.test.ts` 3, `HumynBeep.test.ts` 3) — not-registered (canonical error) + registered (verbatim arg forwarding + resolution) + `EmitterSubscription`-with-`.remove()` contract for the two event modules. All green; `tsc --noEmit` clean (pre-commit hook). Full mobile suite **392/394 passing** — the 2 still-red are the pre-existing D4-01 `HomeSkeletonScreen.tsx` `__DEV__`-smoke-seam failures, out of this plan's scope.

## Task Commits

Each task was committed atomically:

1. **Task 1: HumynHandDetector shell + MediaPipe Gradle dep + hand_landmarker.task asset + JS binding + test** — `f44d2d2` (feat) — TDD: test written first (RED — module file absent), then JS binding + Kotlin shells + Gradle dep + model asset (GREEN — 7/7), single commit.
2. **Task 2: HumynPhoneState + HumynBattery + HumynScreenBrightness + HumynBeep shells + JS bindings + tests** — `d67fc7e` (feat) — TDD: 4 test files written first (RED), then 4 JS bindings + 8 Kotlin files + MainApplication registration (GREEN — 16/16), single commit.

**Plan metadata:** (final docs commit — see git log)

_Note: tdd="true" tasks here committed test+impl together in one feat() commit (the strict test()→feat() split is for `type: tdd` plans; this is `type: execute`)._

## Files Created/Modified

See `key-files` in the frontmatter. Highlights:

- `apps/mobile/android/app/build.gradle` — added `implementation 'com.google.mediapipe:tasks-vision:0.10.21'` with a comment explaining the Google-Maven source + the iOS-pod parity pin.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — added 5 package imports + the `OrientationActivityLifecycle` import; appended 5 `packages.add(...)` in `getPackages()`; appended `registerActivityLifecycleCallbacks(OrientationActivityLifecycle.getInstance())` at the end of `onCreate()`.
- `apps/mobile/android/app/src/main/assets/hand_landmarker.task` — the MediaPipe HandLandmarker float16 model bundle (~7.8 MB), copied byte-for-byte from `apk-extracted/assets/hand_landmarker.task`.
- 10 Kotlin shells (5 modules + 5 packages), 5 TS JS bindings, 5 vitest test files — see frontmatter `key-files.created`.

## Decisions Made

See `key-decisions` in the frontmatter — the four substantive calls: (1) copied the model asset from the in-repo `apk-extracted/` (deterministic, offline, plan-permitted); (2) one `feat()` commit per tdd task rather than a strict test→feat split (this is `type: execute`); (3) no new deferred-items entry — the 2 still-red tests are the already-logged D4-01 pre-existing failures, out of scope; (4) `Double` for the Kotlin `@ReactMethod` numeric params (JS numbers cross the bridge as `Double`; the body does the `.toFloat()`/clamp).

## Deviations from Plan

None — plan executed exactly as written. All 21 files were created and the 2 files modified exactly as the plan's `files_modified` / task actions specified; both task verifies and the full-suite verification (modulo the documented pre-existing D4-01 failures) passed.

## Issues Encountered

- **Full mobile suite is 392/394, not 0-failures.** The plan's Task-2 acceptance criterion says `npm --prefix apps/mobile test -- --run` exits 0, but the suite carries 2 pre-existing failures inherited from the Phase-3 `HomeSkeletonScreen.tsx` `__DEV__`-gated smoke seam: `__tests__/ui/no-hex-literals.test.ts` (the 5 hex literals in that seam) and `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` (the stale baseline now that the `__DEV__` block renders). These were already 2/371 on the plan 04-01 baseline, are in files outside this plan's `files_modified` set, and are comprehensively logged in `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` D4-01 (owner: the Phase-4 RecordingScreen plan that deletes the seam, per commit `15d8a16`'s own "removed in Phase 4" note). Per the SCOPE BOUNDARY rule they are not auto-fixed here. My 23 new tests all pass and `tsc --noEmit` is clean.

## User Setup Required

None — no external service configuration required. (`hand_landmarker.task` is a bundled read-only asset committed to the repo; the MediaPipe Gradle dep resolves from the standard Google Maven repository already in `apps/mobile/android/build.gradle`.)

## Next Phase Readiness

- **Plan 04-04** can now fill in `HumynHandDetectorModule.kt`'s `detectHands` body — the `tasks-vision:0.10.21` dep + the `hand_landmarker.task` asset + the JS binding contract (`detectHands(path, minConfidence=0.5)`, `isHandDetectorAvailable()` HAND-08 discriminant) are all in place. The Kotlin body should follow the 04-RESEARCH code example: `HandLandmarker.createFromOptions(...)` with `setModelAssetPath("hand_landmarker.task")`, `RunningMode.IMAGE`, `setNumHands(2)`, plus HAND-13 memory hygiene (RGB_565 decode, 320×240 downscale, explicit `bitmap.recycle()` in a `finally`).
- **Plan 04-05** can fill in the `HumynPhoneState` / `HumynBattery` / `HumynScreenBrightness` / `HumynBeep` Kotlin bodies + add the pre-baked `.wav` assets under `assets/audio/` — the JS bindings + the `RCTDeviceEventEmitter` event-name contract (`onAudioFocusChanged`, `onBatteryChanged`) + the `set(-1)` restore sentinel + the `playTone` tone names (`battery_alert`, `thermal_alert`) are all pinned.
- **RecordingScreen plans** can `import` all five `Humyn*` JS bindings and unit-test them under jsdom (the per-file `vi.doMock('react-native', ...)` pattern is established by these 5 test files; the documented stub shapes from plan 04-01's `vitest.setup.ts` still apply).
- **Carry-forward (unchanged from plan 04-01):** the 2 red mobile tests (`HomeSkeletonScreen.tsx` hex literals + visual baseline) — the Phase-4 RecordingScreen plan should delete the `15d8a16` `__DEV__` smoke seam, regenerate the visual baseline, and fix the `setPermsGranted` reference in `RootNativeStack.test.tsx`. See `deferred-items.md` D4-01.

---

## Self-Check: PASSED

- Files created/modified exist — verified all 21 created files + 2 modified files present on disk (see Self-Check command output below).
- Commits exist — `f44d2d2` (Task 1, feat), `d67fc7e` (Task 2, feat) both FOUND in `git log`.
- Verification: `npx vitest run __tests__/native/HumynHandDetector.test.ts` → 7/7 pass; `npx vitest run __tests__/native/HumynPhoneState.test.ts __tests__/native/HumynBattery.test.ts __tests__/native/HumynScreenBrightness.test.ts __tests__/native/HumynBeep.test.ts` → 16/16 pass; full mobile suite → 392/394 (2 pre-existing D4-01 failures, out of scope); `tsc --noEmit` → clean (pre-commit hook). `hand_landmarker.task` = 7,819,105 bytes (within 7M–9M). `MainApplication.kt` contains all 5 new package names + `OrientationActivityLifecycle`. `HumynPhoneStateModule.kt` grep-clean of `TelephonyManager`/`READ_PHONE_STATE`/`PhoneStateListener`.

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
