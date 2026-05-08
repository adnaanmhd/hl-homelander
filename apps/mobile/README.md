# @humyn/mobile

Phase-1 mobile scaffold — Sign in with Google → POST /auth/google → Welcome view.

## Two flavors

- **apkRollout** (`applicationId=ai.humynlabs.capture.apk`) — direct-to-users APK; install-source bypass eligible per D-AUTH-02.
- **playStore** (`applicationId=ai.humynlabs.capture`) — Play Store track; strict integrity path.

iOS is Phase 7 — not built here. The backend (`/auth/google`) Phase-1 gates `flavor='iosAppStore'` to 501 (W6).

## Prerequisites

- Node 22 + pnpm 9 (root workspace)
- JDK 17, Android SDK with `compileSdk=35`, AGP 8.7+, Gradle 8.11+
- Pixel 7a-class device (or higher; emulator fails Play Integrity by design)

## .env per flavor

Edit `apps/mobile/.env.apkRollout` and `apps/mobile/.env.playStore`:

- `GOOGLE_WEB_CLIENT_ID` — from Firebase Console (Project Settings → General → Your apps → Web)
- `API_BASE_URL` — dev: `http://10.0.2.2:8080` (Android emulator) or your machine's LAN IP. Prod: `https://api.humyn.ai`.

`react-native-config` reads the matching .env at compile time per the active flavor.

## Build commands

```sh
# Install
pnpm install

# Lint + typecheck + unit tests
pnpm --filter @humyn/mobile run typecheck
pnpm --filter @humyn/mobile run test

# Android — apkRolloutDebug variant
cd apps/mobile/android
./gradlew :app:assembleApkRolloutDebug

# Android — playStoreDebug variant
./gradlew :app:assemblePlayStoreDebug

# Manifest-merger CI gate (plan 09)
pnpm --filter @humyn/mobile run verify-manifests
```

## Install + run on device

```sh
adb install -r app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
adb shell am start -n ai.humynlabs.capture.apk/.MainActivity
```

(Substitute `playStore` + `ai.humynlabs.capture` for the playStore variant.)

## Native modules

- **AppFlavor** (plan 09): `NativeModules.AppFlavor.flavor` returns `'apkRollout'` or `'playStore'` at runtime.
- **PlayIntegrity** (this plan): `NativeModules.PlayIntegrity.requestIntegrityToken(nonce)` calls `IntegrityManager.requestIntegrityToken`.

Both registered in `android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`.

## Auth flow

`apps/mobile/src/services/auth.ts → signInWithGoogle()` runs:

1. `GoogleSignin.signIn()` → google ID token
2. `POST /auth/nonce` → `{ nonceId, nonce }`
3. `requestIntegrityToken(nonce)` (native call) → integrity token
4. `POST /auth/google { googleIdToken, integrityToken, flavor, applicationId, nonceId }` → `{ jwt, user }`
5. Validate `jwt.flavor === flavor && jwt.applicationId === applicationId`
6. Store JWT in MMKV (`auth.jwt.v1`)

## Manual smoke test

See `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md`.
