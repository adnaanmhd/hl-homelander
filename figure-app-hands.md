# Hand detection in Figure's "Minutes" app (`com.figure.d8a` v0.16.0)

Reverse-engineered from `0.16.0.apk` (68 MB, Hermes-bundled React Native).

## Stack

| Layer      | Component                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App        | `com.figure.d8a` — Figure's data-collection app branded **Minutes**                                                                                                                                          |
| Framework  | React Native (New Architecture) running on Hermes bytecode v96                                                                                                                                               |
| Camera     | `react-native-vision-camera` (+ `react-native-worklets-core`, `@shopify/react-native-skia` for overlays, `react-native-reanimated`)                                                                          |
| ML runtime | Google **MediaPipe Tasks Vision** — `lib/arm64-v8a/libmediapipe_tasks_vision_jni.so`                                                                                                                         |
| Model      | `assets/hand_landmarker.task` (≈7.8 MB) — standard MediaPipe HandLandmarker bundle: `hand_detector.tflite` (2.3 MB palm detector) + `hand_landmarks_detector.tflite` (5.5 MB landmark net), dated 2023-04-26 |
| Bridge     | Custom Kotlin RN module `HandDetectorModule` registered via `HandDetectorPackage`                                                                                                                            |

## Wiring (the surprising part)

It is **not** a per-frame VisionCamera frame-processor plugin. There is no `FrameProcessorPlugin` subclass in `com.figure.d8a`. Instead, hand detection is a **one-shot still-image check** exposed as a single `@ReactMethod`:

```kotlin
// com/figure/d8a/HandDetectorModule.java (decompiled)
@ReactMethod
fun detectHands(imagePath: String, promise: Promise) {
    executor.execute {
        val bmp = BitmapFactory.decodeFile(imagePath)
        val res = getOrCreateHandLandmarker()
            .detect(BitmapImageBuilder(bmp).build())
        promise.resolve(res.landmarks().size)   // returns hand COUNT only
    }
}

@ReactMethod
fun cleanup() { handLandmarker?.close(); handLandmarker = null }
```

### HandLandmarker configuration

```kotlin
HandLandmarker.createFromOptions(reactContext,
  HandLandmarkerOptions.builder()
    .setBaseOptions(BaseOptions.builder()
        .setModelAssetPath("hand_landmarker.task").build())  // CPU delegate (default)
    .setRunningMode(RunningMode.IMAGE)                       // blocking, single frame
    .setNumHands(2)
    .setMinHandDetectionConfidence(0.5f)
    .setMinHandPresenceConfidence(0.5f)
    .setMinTrackingConfidence(0.5f)
    .build())
```

Notable choices:

- **`RunningMode.IMAGE`**, not `LIVE_STREAM` — processes a single decoded bitmap at a time on a `Executors.newSingleThreadExecutor()`. Not a live tracker.
- **CPU delegate** — no `setDelegate(GPU)` call.
- **Returns hand count only** (`landmarks().size()`) — the 21-point landmarks, world coordinates, and handedness that MediaPipe computes are discarded. So this is a 0/1/2-hands present? gate, not a tracker.
- Model loaded lazily on first call and reused; `cleanup()` closes it.

## How the JS layer uses it

The Hermes bundle is bytecode (so call sites aren't readable as JS), but recoverable string symbols tell the story:

- `@d8a/handDetectionEnabled` — AsyncStorage feature flag, toggleable in settings (matching `setHandDetectionEnabled` setter symbol).
- `"HandDetector not available"` — JS gracefully degrades when the native module is absent.
- React component names in the bundle:
  - `HandPlacementGuide` — the framing/coaching overlay shown to the user.
  - `HandDetectionGate` — the gate that blocks or advances flow based on the result.

Inferred flow:

1. VisionCamera captures a still snapshot to a file.
2. JS calls `NativeModules.HandDetector.detectHands(filePath)` → resolves with `0 | 1 | 2`.
3. If count ≥ 1 → `HandDetectionGate` advances; else `HandPlacementGuide` keeps prompting the user to reposition.

## What this means in practice

- It is the **off-the-shelf MediaPipe HandLandmarker** with Google's public TFLite weights — no proprietary model, no fine-tuning.
- It runs occasionally on captured photos (likely during onboarding / pre-recording checks), **not continuously on the camera preview** — so no real-time tracking, no on-screen finger landmarks, minimal battery cost.
- All confidence thresholds are MediaPipe defaults (0.5 / 0.5 / 0.5).
- The integration is shallow: ~95 lines of Kotlin + the public `hand_landmarker.task` bundle.

## Reproducing the integration

If building something equivalent in another RN app:

1. `yarn add react-native-vision-camera react-native-worklets-core`
2. Add `com.google.mediapipe:tasks-vision` to `android/app/build.gradle`.
3. Drop `hand_landmarker.task` from [Google's MediaPipe model card](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) into `android/app/src/main/assets/`.
4. Implement a `ReactContextBaseJavaModule` mirroring `HandDetectorModule` above.
5. From JS, snap a still via VisionCamera's `takePhoto()`, then call `NativeModules.HandDetector.detectHands(photo.path)`.

## Source artifacts

- Decompiled module: `jadx-out/sources/com/figure/d8a/HandDetectorModule.java`
- Decompiled package registration: `jadx-out/sources/com/figure/d8a/HandDetectorPackage.java`
- Native MediaPipe lib: `apk-extracted/lib/arm64-v8a/libmediapipe_tasks_vision_jni.so`
- Model bundle: `apk-extracted/assets/hand_landmarker.task`
- Hermes JS bundle: `apk-extracted/assets/index.android.bundle`
