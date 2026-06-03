# Local Dev Setup — Humyn Labs Capture (Android)

React Native 0.83 / Hermes, Android-only. Two build flavors: **apkRollout** (direct-to-users APK) and **playStore** (Play Store track).

---

## Prerequisites

| Tool                       | Version                  |
| -------------------------- | ------------------------ |
| Node                       | 22 LTS                   |
| JDK                        | 17 (Zulu)                |
| Android SDK                | compileSdk 35, minSdk 26 |
| AGP / Gradle / Kotlin      | 8.7+ / 8.11+ / 2.0.21+   |
| Android emulator or device | Pixel 7a-class or higher |

> The mobile package uses `npm`, not `pnpm`. Run all commands from `apps/mobile/`.

---

## 1. Install dependencies

```sh
cd apps/mobile
npm ci
```

---

## 2. Configure environment

Edit `.env.apkRollout` (or `.env.playStore` for the Play Store variant):

```
GOOGLE_WEB_CLIENT_ID=<Web OAuth client ID from Firebase Console>
API_BASE_URL=http://10.0.2.2:8080   # emulator → host; use LAN IP for a physical device
```

Create `android/app/google-services.json` with the dev stub below (the file is gitignored so every dev needs to create it manually):

```json
{
  "project_info": {
    "project_number": "130483521533",
    "project_id": "humyn-dev",
    "storage_bucket": "humyn-dev.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:130483521533:android:000000000000000000000a",
        "android_client_info": {
          "package_name": "ai.humynlabs.capture.apk"
        }
      },
      "oauth_client": [
        {
          "client_id": "130483521533-rgtkna3144hod4hdvnkn32r8f6b0i414.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [{ "current_key": "dev-stub-not-real" }],
      "services": { "appinvite_service": { "other_platform_oauth_client": [] } }
    }
  ],
  "configuration_version": "1"
}
```

> This stub is enough to build and run locally. Firebase features (Google Sign-In, Crashlytics, Analytics) require the real file from Firebase Console → project `humyn-dev` → Project settings → Your apps → Android → Download `google-services.json`.

---

## 3. Start Metro

In a dedicated terminal:

```sh
cd apps/mobile
npx react-native start
```

Leave this running for all subsequent steps.

---

## 4. Build and install

### Check emulator disk space first

The debug APK is ~265 MB. The emulator needs at least 1.5 GB free on `/data`.

```sh
adb shell df /data
```

If `/data` is above ~80% usage, free space before installing:

```sh
adb shell "rm -rf /data/local/tmp/*"
adb shell pm trim-caches 999999999
```

If still tight, wipe the emulator (Android Studio AVD Manager → Wipe Data, or `emulator -avd <name> -wipe-data`) and reboot it.

### Install (apkRollout — most common for local dev)

```sh
cd apps/mobile/android
./gradlew app:installApkRolloutDebug -PreactNativeDevServerPort=8081
```

Gradle builds, pushes, and installs the APK. The app launches automatically and connects to Metro.

### Install (playStore variant)

```sh
./gradlew app:installPlayStoreDebug -PreactNativeDevServerPort=8081
```

### Launch manually (if the app doesn't open on its own)

```sh
# apkRollout
adb shell monkey -p ai.humynlabs.capture.apk -c android.intent.category.LAUNCHER 1

# playStore
adb shell monkey -p ai.humynlabs.capture -c android.intent.category.LAUNCHER 1
```

---

## 5. Iterating

Metro hot-reloads JS/TS changes automatically. Re-run the Gradle install only when you change native Kotlin code or add/remove dependencies.

---

## Other useful commands

```sh
npm run typecheck        # tsc --noEmit
npm run test             # Vitest unit tests
npm run verify-manifests # AndroidManifest merge CI gate
```

---

## Build flavors

| Flavor       | Application ID             | Notes                                                                   |
| ------------ | -------------------------- | ----------------------------------------------------------------------- |
| `apkRollout` | `ai.humynlabs.capture.apk` | Direct-to-users APK; Play Integrity bypassed on debug via Remote Config |
| `playStore`  | `ai.humynlabs.capture`     | Play Store track; strict Play Integrity path                            |

---

## Key native modules

All camera / IMU / hand-detection work is in hand-rolled Kotlin TurboModules under `android/app/src/main/java/ai/humynlabs/capture/`:

- **HumynCapture** — Camera2 + MediaCodec HEVC on the back ultrawide sub-camera, SensorManager IMU at ≥100 Hz
- **HumynGateCamera** — Camera2 live preview for the pre-record hand gate
- **HumynHandDetector** — MediaPipe HandLandmarker (IMAGE mode, hand-count only)
- **HumynCompat** — pre-flight device/encoder/IMU probe; rejects incompatible hardware

CameraX and `react-native-vision-camera` are explicitly excluded — see `CLAUDE.md` for the full "do not use" list.
