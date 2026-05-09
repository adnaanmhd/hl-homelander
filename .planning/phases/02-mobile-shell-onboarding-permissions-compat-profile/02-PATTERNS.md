# Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** ~55 new + ~6 modified Phase 2 files (grouped into 11 domains)
**Analogs found:** 47 / 55 (86%)

## Overview

Phase 1 already shipped a small but high-fidelity slice of the mobile app (auth.ts, api.ts, AppFlavor + PlayIntegrity Kotlin TurboModules, vitest + JSDOM testing harness, per-flavor manifest source-sets, signed apkRollout build). Phase 2's job is to copy these conventions and replicate them across ~55 new files. **Almost every Phase 2 file has a direct analog in Phase 1.** The few exceptions (Zustand store, navigator skeleton, Robolectric Kotlin tests, build-time MD parser) are noted in the **No Analog Found** section with research-derived patterns.

---

## File Classification

### Domain: Package-manager migration (plan 02-01, lands FIRST)

| New/Modified File                                   | Role     | Data Flow        | Closest Analog                                 | Match Quality  |
| --------------------------------------------------- | -------- | ---------------- | ---------------------------------------------- | -------------- |
| `apps/mobile/package.json` (modify — npm migration) | config   | n/a              | `apps/mobile/package.json` (current pnpm form) | exact (extend) |
| `apps/mobile/package-lock.json` (NEW)               | lockfile | n/a              | `pnpm-lock.yaml` (root)                        | role-match     |
| `pnpm-workspace.yaml` (modify — remove apps/mobile) | config   | n/a              | `pnpm-workspace.yaml` (current)                | exact (edit)   |
| `.github/workflows/mobile-ci.yml` (NEW)             | ci       | request-response | `.github/workflows/api-ci.yml`                 | exact          |

### Domain: Authentication & Onboarding screens

| New/Modified File                                                  | Role      | Data Flow        | Closest Analog                                            | Match Quality |
| ------------------------------------------------------------------ | --------- | ---------------- | --------------------------------------------------------- | ------------- |
| `apps/mobile/src/screens/SignupScreen.tsx` (REPLACES `SignIn.tsx`) | screen    | request-response | `apps/mobile/src/screens/SignIn.tsx`                      | exact         |
| `apps/mobile/src/screens/SplashScreen.tsx`                         | screen    | request-response | `apps/mobile/src/screens/SignIn.tsx` (loading state)      | role-match    |
| `apps/mobile/src/screens/PermissionsScreen.tsx`                    | screen    | request-response | `apps/mobile/src/screens/SignIn.tsx`                      | role-match    |
| `apps/mobile/src/screens/RigTutorialScreen.tsx`                    | screen    | static           | `apps/mobile/src/screens/SignIn.tsx` (Welcome view)       | role-match    |
| `apps/mobile/src/components/TermsOfUseModal.tsx`                   | component | static           | `apps/mobile/src/screens/SignIn.tsx` (StyleSheet pattern) | role-match    |

### Domain: Compat-check (COMPAT-01..08)

| New/Modified File                                  | Role                    | Data Flow        | Closest Analog                                              | Match Quality |
| -------------------------------------------------- | ----------------------- | ---------------- | ----------------------------------------------------------- | ------------- |
| `apps/mobile/src/screens/CompatRunningScreen.tsx`  | screen                  | request-response | `apps/mobile/src/screens/SignIn.tsx` (handleSignIn loading) | role-match    |
| `apps/mobile/src/screens/CompatPassScreen.tsx`     | screen                  | static           | `apps/mobile/src/screens/SignIn.tsx` (Welcome)              | role-match    |
| `apps/mobile/src/screens/CompatFailScreen.tsx`     | screen                  | static           | `apps/mobile/src/screens/SignIn.tsx`                        | role-match    |
| `apps/mobile/src/screens/CompatRecoveryScreen.tsx` | screen                  | static           | `apps/mobile/src/screens/SignIn.tsx`                        | role-match    |
| `apps/mobile/src/services/compatService.ts`        | service                 | event-driven     | `apps/mobile/src/services/auth.ts`                          | exact         |
| `apps/mobile/src/native/HumynCompat.ts`            | native-bridge           | request-response | `apps/mobile/src/native/PlayIntegrity.ts`                   | exact         |
| `…/HumynCompat/HumynCompatModule.kt`               | native-module (Kotlin)  | event-driven     | `…/io/humyn/app/PlayIntegrityModule.kt`                     | exact         |
| `…/HumynCompat/HumynCompatPackage.kt`              | native-package (Kotlin) | n/a              | `…/ai/humynlabs/capture/AppFlavorPackage.kt`                | exact         |
| `…/HumynCompat/NalParser.kt`                       | utility (Kotlin)        | transform        | none (research)                                             | no-analog     |
| `…/HumynCompat/EncoderProbe.kt`                    | utility (Kotlin)        | event-driven     | none (research)                                             | no-analog     |
| `…/HumynCompat/ImuProbe.kt`                        | utility (Kotlin)        | event-driven     | none (research)                                             | no-analog     |
| `…/HumynCompat/DeviceCaps.kt`                      | utility (Kotlin)        | transform        | none (research)                                             | no-analog     |
| `shared/types/src/CompatResult.ts`                 | schema                  | n/a              | `shared/types/src/app-version.ts`                           | exact         |

### Domain: Forced upgrade (UPG-01..05)

| New/Modified File                                  | Role                   | Data Flow        | Closest Analog                                         | Match Quality |
| -------------------------------------------------- | ---------------------- | ---------------- | ------------------------------------------------------ | ------------- |
| `apps/mobile/src/screens/ForceUpgradeScreen.tsx`   | screen                 | request-response | `apps/mobile/src/screens/SignIn.tsx`                   | role-match    |
| `apps/mobile/src/components/SoftUpgradeBanner.tsx` | component              | event-driven     | `apps/mobile/src/screens/SignIn.tsx` (Pressable+state) | role-match    |
| `apps/mobile/src/services/versionService.ts`       | service                | request-response | `apps/mobile/src/services/auth.ts`                     | exact         |
| `apps/mobile/src/services/semver.ts`               | utility                | transform        | none (research, ~10 LOC)                               | no-analog     |
| `apps/mobile/src/native/HumynUpdater.ts`           | native-bridge          | request-response | `apps/mobile/src/native/PlayIntegrity.ts`              | exact         |
| `…/HumynUpdater/HumynUpdaterModule.kt`             | native-module (Kotlin) | event-driven     | `…/io/humyn/app/PlayIntegrityModule.kt`                | exact         |

### Domain: Profile, Help Center, Account-delete

| New/Modified File                                   | Role      | Data Flow                    | Closest Analog                                         | Match Quality |
| --------------------------------------------------- | --------- | ---------------------------- | ------------------------------------------------------ | ------------- |
| `apps/mobile/src/screens/ProfileScreen.tsx`         | screen    | CRUD                         | `apps/mobile/src/screens/SignIn.tsx`                   | role-match    |
| `apps/mobile/src/screens/HelpCenterScreen.tsx`      | screen    | static                       | `apps/mobile/src/screens/SignIn.tsx`                   | role-match    |
| `apps/mobile/src/components/AccordionItem.tsx`      | component | event-driven                 | `apps/mobile/src/screens/SignIn.tsx` (Pressable+state) | role-match    |
| `apps/mobile/src/components/LogoutModal.tsx`        | component | event-driven                 | `apps/mobile/src/screens/SignIn.tsx`                   | role-match    |
| `apps/mobile/src/components/DeleteAccountModal.tsx` | component | request-response             | `apps/mobile/src/screens/SignIn.tsx`                   | role-match    |
| `apps/mobile/src/components/ReportProblemSheet.tsx` | component | request-response             | `apps/mobile/src/screens/SignIn.tsx`                   | role-match    |
| `apps/mobile/src/services/feedbackService.ts`       | service   | request-response (multipart) | `apps/mobile/src/services/auth.ts`                     | role-match    |
| `apps/mobile/src/services/durationFormatter.ts`     | utility   | transform                    | none (small helper)                                    | no-analog     |

### Domain: Home / Navigation chrome

| New/Modified File                                | Role       | Data Flow    | Closest Analog                                   | Match Quality  |
| ------------------------------------------------ | ---------- | ------------ | ------------------------------------------------ | -------------- |
| `apps/mobile/src/screens/HomeSkeletonScreen.tsx` | screen     | static       | `apps/mobile/src/screens/SignIn.tsx`             | role-match     |
| `apps/mobile/src/components/TopBar.tsx`          | component  | event-driven | `apps/mobile/src/screens/SignIn.tsx` (Pressable) | role-match     |
| `apps/mobile/src/components/BottomNav.tsx`       | component  | event-driven | none (React Navigation tabs)                     | no-analog      |
| `apps/mobile/src/navigation/RootNativeStack.tsx` | navigation | n/a          | none (React Navigation v7)                       | no-analog      |
| `apps/mobile/src/navigation/OnboardingStack.tsx` | navigation | n/a          | none (React Navigation v7)                       | no-analog      |
| `apps/mobile/src/navigation/MainTabs.tsx`        | navigation | n/a          | none (React Navigation v7)                       | no-analog      |
| `apps/mobile/App.tsx` (REWRITE)                  | root       | n/a          | `apps/mobile/App.tsx` (current Phase 1)          | exact (extend) |

### Domain: State + persistence

| New/Modified File                             | Role    | Data Flow    | Closest Analog                                    | Match Quality |
| --------------------------------------------- | ------- | ------------ | ------------------------------------------------- | ------------- |
| `apps/mobile/src/state/appStore.ts` (Zustand) | store   | event-driven | none (Zustand new in Phase 2)                     | no-analog     |
| `apps/mobile/src/state/hydrate.ts`            | utility | transform    | `apps/mobile/src/services/auth.ts` (MMKV reads)   | role-match    |
| `apps/mobile/src/services/installationId.ts`  | service | CRUD         | `apps/mobile/src/services/auth.ts` (MMKV pattern) | exact         |
| `apps/mobile/src/services/telemetryRing.ts`   | service | event-driven | `apps/mobile/src/services/auth.ts` (MMKV pattern) | exact         |

### Domain: Native module extensions

| New/Modified File                                                                                                 | Role                   | Data Flow        | Closest Analog                    | Match Quality     |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------- | --------------------------------- | ----------------- |
| `…/AppFlavor/AppFlavorModule.kt` (modify — add versionName/versionCode/installationId)                            | native-module (Kotlin) | request-response | self (current AppFlavorModule.kt) | exact (extend)    |
| `apps/mobile/android/app/src/main/AndroidManifest.xml` (modify — add CAMERA, RECORD*AUDIO, FOREGROUND_SERVICE*\*) | manifest               | n/a              | self (current base manifest)      | exact (extend)    |
| `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` (verify — REQUEST_INSTALL_PACKAGES)                  | manifest               | n/a              | self (already correct)            | exact (no change) |
| `apps/mobile/android/app/build.gradle` (modify — Robolectric testImplementation)                                  | gradle                 | n/a              | self (current build.gradle)       | exact (extend)    |

### Domain: Tests (vitest + Robolectric)

| New/Modified File                                                                  | Role          | Data Flow | Closest Analog                                               | Match Quality  |
| ---------------------------------------------------------------------------------- | ------------- | --------- | ------------------------------------------------------------ | -------------- |
| `apps/mobile/__tests__/SignupScreen.test.tsx` (and ~12 sibling test files)         | test          | n/a       | `apps/mobile/__tests__/SignIn.test.tsx`                      | exact          |
| `apps/mobile/__tests__/services/*.test.ts`                                         | test          | n/a       | `apps/mobile/__tests__/SignIn.test.tsx` (vi.mock + describe) | role-match     |
| `apps/mobile/__tests__/state/*.test.ts`                                            | test          | n/a       | `apps/mobile/__tests__/SignIn.test.tsx`                      | role-match     |
| `apps/mobile/vitest.setup.ts` (modify — add NavigationContainer mock)              | test setup    | n/a       | self (current vitest.setup.ts)                               | exact (extend) |
| `apps/mobile/android/app/src/test/.../HumynCompatModuleTest.kt`                    | test (Kotlin) | n/a       | none (Robolectric new in Phase 2)                            | no-analog      |
| `apps/mobile/android/app/src/test/.../NalParserTest.kt`                            | test (Kotlin) | n/a       | none (Robolectric new in Phase 2)                            | no-analog      |
| `apps/mobile/android/app/src/test/resources/hevc-fixtures/{i-only.h265, ibp.h265}` | fixture       | n/a       | none (binary fixtures new in Phase 2)                        | no-analog      |

### Domain: Build-time content + assets

| New/Modified File                                  | Role         | Data Flow | Closest Analog                           | Match Quality     |
| -------------------------------------------------- | ------------ | --------- | ---------------------------------------- | ----------------- |
| `apps/mobile/scripts/build-help-content.mjs`       | build-script | transform | `apps/api/scripts/parse-taxonomy.ts`     | role-match        |
| `apps/mobile/help-center-content.json` (generated) | data         | static    | `apps/api/scripts/seed-tasks.ts` outputs | role-match        |
| `apps/mobile/react-native.config.js` (NEW)         | config       | n/a       | none (font-asset linker)                 | no-analog         |
| `apps/mobile/assets/fonts/*.ttf`                   | asset        | n/a       | `design-system/` brand fonts             | role-match (copy) |

---

## Pattern Assignments

### `apps/mobile/src/screens/SignupScreen.tsx` (screen, request-response) — REPLACES `SignIn.tsx`

**Analog:** `apps/mobile/src/screens/SignIn.tsx`

**Imports + state shape pattern** (lines 9-17):

```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { signInWithGoogle, type AuthSuccess } from '../services/auth';

interface State {
  user: AuthSuccess['user'] | null;
  loading: boolean;
  error: string | null;
}
```

**handleSignIn pattern** (lines 22-34) — wrap `signInWithGoogle` with try/catch + setState transitions:

```typescript
const handleSignIn = useCallback(async () => {
  setState((s) => ({ ...s, loading: true, error: null }));
  try {
    const result = await signInWithGoogle();
    setState({ user: result.user, loading: false, error: null });
  } catch (err) {
    setState({
      user: null,
      loading: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    });
  }
}, []);
```

**Accessibility pattern** (lines 47-50) — every `Pressable` carries `accessibilityRole` + `accessibilityLabel` strings; the JSDOM test shim in `vitest.setup.ts` maps these to `role` + `aria-label`:

```typescript
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Continue with Google"
  style={styles.button}
  onPress={handleSignIn}
  disabled={state.loading}
>
```

**StyleSheet pattern** (lines 69-89) — flat `StyleSheet.create({...})`; design tokens hardcoded with hex constants commented to design-spec roles. Phase 2 replaces these inlined hex with `tokens.colors.*` imports from `apps/mobile/src/ui/tokens.ts`:

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  // ...
});
```

**Phase 2 changes from SignIn:**

- Add consent checkbox + `<TermsOfUseModal />` per AUTH-02/03
- On success → `navigation.replace('Permissions')` instead of in-place Welcome render
- Animated scalePop logo + tagline + pitch per design-spec §2

---

### `apps/mobile/src/services/compatService.ts` (service, event-driven)

**Analog:** `apps/mobile/src/services/auth.ts`

**MMKV instance pattern** (lines 22-25) — single shared `humyn.secure` instance with `encryptionKey` flag, key constants at top:

```typescript
const mmkv = createMMKV({ id: 'humyn.secure', encryptionKey: 'humyn-mmkv-v1' });
const JWT_KEY = 'auth.jwt.v1';
```

For Phase 2: `compatService` reuses the SAME `humyn.secure` instance (do not create a second one) and uses `compat.lastResult.v1` + `onboarding.compatPassed.v1` keys.

**Native-module orchestration pattern** (lines 104-145) — sequence of native calls awaited inline, each one's failure surfaces a typed error with descriptive code:

```typescript
export async function signInWithGoogle(): Promise<AuthSuccess> {
  const { flavor, applicationId } = getFlavorContext();
  // 1. Google Sign-In via Credential Manager.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResponse = await GoogleSignin.signIn();
  if (signInResponse.type !== 'success') {
    throw new Error('google_sign_in_cancelled');
  }
  // ... 6 sequential steps, each with its own throw-on-error guard
}
```

For Phase 2 `runCompatCheck()`: the same pattern — call `HumynCompat.runEncoderProbe()` → `HumynCompat.runImuProbe(30000, true)` → `HumynCompat.readDeviceCaps()` → assemble `CompatResult` via Zod parse → write MMKV → return.

**Stored-value getter/setter pattern** (lines 172-178) — public sync helpers on the same MMKV instance:

```typescript
export function getStoredJwt(): string | undefined {
  return mmkv.getString(JWT_KEY);
}

export function clearStoredJwt(): void {
  mmkv.remove(JWT_KEY);
}
```

For Phase 2: `getStoredCompatResult()` / `clearStoredCompatResult()` mirror the same shape.

---

### `apps/mobile/src/services/installationId.ts` (service, CRUD)

**Analog:** `apps/mobile/src/services/auth.ts`

Mint UUID once on first cold-boot, persist to MMKV, return on subsequent calls. Reuse the auth.ts `humyn.secure` instance via a shared module (or a tiny `mmkvInstance.ts` module that exports the singleton).

**MMKV-keyed-singleton pattern** — the auth.ts JWT pattern translates 1:1:

```typescript
// Pattern, by analogy: mint-or-read
const INSTALL_ID_KEY = 'installation_id.v1';

export function getInstallationId(): string {
  const existing = mmkv.getString(INSTALL_ID_KEY);
  if (existing) return existing;
  // Per RESEARCH §Open Questions item 3, recommended path: extend AppFlavor
  // Kotlin module with getOrMintInstallationId() to avoid adding a JS UUID lib.
  const minted = NativeModules.AppFlavor.getOrMintInstallationId();
  mmkv.set(INSTALL_ID_KEY, minted);
  return minted;
}
```

---

### `apps/mobile/src/services/telemetryRing.ts` (service, event-driven)

**Analog:** `apps/mobile/src/services/auth.ts`

FIFO ring buffer of last 100 entries persisted in MMKV. Cap on every append. Reuse `humyn.secure` instance.

**Pattern:** every analytics call writes to MMKV under `telemetry.ring.v1`; reads are sync (MMKV is sync).

```typescript
const RING_KEY = 'telemetry.ring.v1';
const RING_CAP = 100;

export const telemetryRing = {
  append(event: { name: string; ts: number; props: Record<string, string> }): void {
    const raw = mmkv.getString(RING_KEY);
    const arr: (typeof event)[] = raw ? JSON.parse(raw) : [];
    arr.push(event);
    if (arr.length > RING_CAP) arr.splice(0, arr.length - RING_CAP);
    mmkv.set(RING_KEY, JSON.stringify(arr));
  },
  snapshot(): (typeof event)[] {
    const raw = mmkv.getString(RING_KEY);
    return raw ? JSON.parse(raw) : [];
  },
};
```

---

### `apps/mobile/src/services/versionService.ts` (service, request-response)

**Analog:** `apps/mobile/src/services/auth.ts`

**API call pattern** (lines 119-131) — auth.ts already shows the canonical "call apiClient → typed response → throw on error" shape:

```typescript
// 2. Mint a server-side single-use nonce.
const nonceRes = await apiClient.postNoBody<NonceResponse>('/auth/nonce');
// ...
// 4. POST /auth/google.
const authRes = await apiClient.post<AuthGoogleResponse>('/auth/google', {
  googleIdToken,
  integrityToken,
  flavor,
  applicationId,
  nonceId: nonceRes.nonceId,
});
```

For Phase 2 `versionService.fetch()`: extend `apiClient` with `getJson<T>(path, { query?, timeoutMs? })` and call `/app/version?flavor=${flavor}` — see `apps/api/src/routes/app-version/get.ts` for the verified per-flavor camelCase response shape (`AppVersionResponseSchema` discriminated union — `flavor`, `minSupported`, `latest`, `forceUpgrade`, `apkUrl`, `apkSha256`, `playStoreUrl`).

**MMKV cache pattern** — direct analog of auth.ts JWT-write — Phase 2 stores `appVersion.cache.v1` = `{response, fetchedAt}`. Cache hit when `now - fetchedAt < 6h`.

---

### `apps/mobile/src/services/feedbackService.ts` (service, request-response — multipart)

**Analog:** `apps/mobile/src/services/auth.ts` (shape) + `apps/api/src/routes/feedback/post.ts` (wire contract)

**Wire shape constants from shared/types** — Phase 1 already shipped `FeedbackFieldsSchema` and `FEEDBACK_CATEGORIES`:

```typescript
// shared/types/src/feedback.ts (Phase 1, already shipped)
export const FEEDBACK_CATEGORIES = [
  'app-crashed',
  'task-doesnt-start',
  'upload-stuck',
  'login-issue',
  'video-quality-issue',
  'imu-issue',
  'thermal-issue',
  'other',
] as const;
export const FeedbackFieldsSchema = z.object({
  category: FeedbackCategorySchema,
  message: z.string().min(1).max(4000),
});
```

**Multipart pattern (research-derived for client; backend already accepts):** `FormData` with three parts — `category`, `message`, `diagnostic` (application/json, 5 MB cap, server enforces). RESEARCH §Code Examples ships the exact client snippet (lines 928-959).

---

### `apps/mobile/src/native/HumynCompat.ts` (native-bridge, request-response)

**Analog:** `apps/mobile/src/native/PlayIntegrity.ts`

**Typed bridge pattern** (full file shown) — interface declares the Kotlin contract; module is fetched from `NativeModules.{Name}` with an undefined fallback so test environments can mock it; exported function asserts presence and forwards:

```typescript
// apps/mobile/src/native/PlayIntegrity.ts
import { NativeModules } from 'react-native';

interface PlayIntegrityNativeModule {
  requestIntegrityToken(nonce: string): Promise<string>;
}

const native = NativeModules.PlayIntegrity as PlayIntegrityNativeModule | undefined;

export async function requestIntegrityToken(nonce: string): Promise<string> {
  if (!native) {
    throw new Error(
      'PlayIntegrity native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native.requestIntegrityToken(nonce);
}
```

**For HumynCompat.ts** — apply the same shape with three methods (`runEncoderProbe`, `runImuProbe`, `readDeviceCaps`). Each method's typed Promise return shape matches the Kotlin module's `Arguments.makeNativeMap` keys verbatim. Same "module not registered" error string, same module-name path in the message.

**Sync-constants pattern** (when needed) — `apps/mobile/src/native/AppFlavor.ts` lines 13-17 show the sync-constants form (when Kotlin uses `getConstants()`):

```typescript
interface AppFlavorNativeModule {
  flavor: 'apkRollout' | 'playStore';
  applicationId: 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk';
  get(): Promise<{ flavor: string; applicationId: string }>;
}
```

For Phase 2's `AppFlavor` extension: add `versionName: string`, `versionCode: number`, `deviceModel: string` as constants (sync read from BuildConfig + `Build.MODEL`); `getOrMintInstallationId(): Promise<string>` as an async method.

---

### `apps/mobile/src/native/HumynUpdater.ts` (native-bridge, request-response)

**Analog:** `apps/mobile/src/native/PlayIntegrity.ts` (same pattern as HumynCompat.ts above)

Two methods: `downloadAndVerifyApk(url, expectedSha256): Promise<{path, sha256}>` and `launchInstaller(apkPath): Promise<boolean>`. The full Kotlin reference impl is in RESEARCH §Code Examples lines 862-920.

**Defensive flavor guard** — RESEARCH Pattern 3 mandates JS-side `if (getFlavorContext().flavor !== 'apkRollout') throw` before either call, since `REQUEST_INSTALL_PACKAGES` is apkRollout-only.

---

### `…/HumynCompat/HumynCompatModule.kt` (Kotlin native module, event-driven)

**Analog:** `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt`

**Module class skeleton** (full file shown — lines 28-52):

```kotlin
@ReactModule(name = PlayIntegrityModule.NAME)
class PlayIntegrityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PlayIntegrity"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun requestIntegrityToken(nonce: String, promise: Promise) {
        try {
            val manager = IntegrityManagerFactory.create(reactApplicationContext)
            val request = IntegrityTokenRequest.builder().setNonce(nonce).build()
            manager.requestIntegrityToken(request)
                .addOnSuccessListener { response -> promise.resolve(response.token()) }
                .addOnFailureListener { e ->
                    promise.reject("PLAY_INTEGRITY_ERROR", e.message ?: "unknown", e)
                }
        } catch (e: Exception) {
            promise.reject("PLAY_INTEGRITY_EXCEPTION", e.message ?: "unknown", e)
        }
    }
}
```

**For HumynCompat:**

- Replace `NAME = "PlayIntegrity"` with `NAME = "HumynCompat"`.
- Three `@ReactMethod` functions: `runEncoderProbe(promise)`, `runImuProbe(durationMs: Double, withPreview: Boolean, promise)`, `readDeviceCaps(promise)` — each delegates to a helper class (`EncoderProbe.kt`, `ImuProbe.kt`, `DeviceCaps.kt`) running on a background `Executor` (do NOT execute on the main thread; RESEARCH Anti-Patterns is explicit on this).
- **Promise.reject with structured wrapping** per RESEARCH Pitfall 10 — always pass `t` as the third arg + a wrapped message: `promise.reject("IMU_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)`.
- Resolve maps via `Arguments.makeNativeMap(mapOf("key" to value, ...))`.

---

### `…/HumynCompat/HumynCompatPackage.kt` (Kotlin ReactPackage)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt`

Full file (12 LOC) — copy verbatim, swap class name + module instantiated:

```kotlin
package ai.humynlabs.capture

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AppFlavorPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(AppFlavorModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

**For HumynCompat / HumynUpdater:** same shape; place each Package.kt next to its Module.kt. Then register both in `MainApplication.kt`.

---

### `…/AppFlavor/AppFlavorModule.kt` (modify — extend with new constants + methods)

**Analog:** Self (current `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt`)

**Existing getConstants pattern** (lines 29-34) — extend with versionName/versionCode/deviceModel:

```kotlin
override fun getConstants(): MutableMap<String, Any> {
    return hashMapOf(
        "flavor" to BuildConfig.FLAVOR_NAME,
        "applicationId" to BuildConfig.APPLICATION_ID,
        // Phase 2 additions:
        "versionName" to BuildConfig.VERSION_NAME,
        "versionCode" to BuildConfig.VERSION_CODE,
        "deviceModel" to Build.MODEL,
    )
}
```

**Add `getOrMintInstallationId(promise: Promise)`** — UUID v4 minted once, persisted to a small Kotlin-side SharedPreferences (or simply delegated to JS-side MMKV as in `installationId.ts`). RESEARCH §Open Questions item 3 recommends Kotlin-side mint to avoid an extra JS dep; Phase 2 planner picks.

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (modify — register packages + cacheDir sweep)

**Analog:** Self (current MainApplication.kt)

**Existing registration pattern** (lines 26-31):

```kotlin
override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages.toMutableList()
    packages.add(AppFlavorPackage())
    packages.add(PlayIntegrityPackage())  // Plan 13 — Phase 1 mobile sign-in scaffold
    return packages
}
```

**Phase 2 extension** — add `HumynCompatPackage()` and (apkRollout-only) `HumynUpdaterPackage()`. Wire HumynUpdater unconditionally; the JS-side flavor guard keeps it from being called on playStore.

**Cache-sweep pattern (NEW, no analog — research-derived)** — D-COMPAT-04 mandates an `onCreate` sweep of orphan `compat-probe-*.mp4` files in `cacheDir`:

```kotlin
override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    load()
    // Phase 2: sweep orphan compat-probe clips left by crashed probes.
    cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
        ?.forEach { it.delete() }
}
```

---

### `shared/types/src/CompatResult.ts` (Zod schema)

**Analog:** `shared/types/src/app-version.ts`

**Imports + schema-then-type pattern** (full file shown):

```typescript
// shared/types/src/app-version.ts
import { z } from 'zod';
import { FlavorSchema } from './user.js';

export const AppVersionQuerySchema = z.object({
  flavor: FlavorSchema,
});
export type AppVersionQuery = z.infer<typeof AppVersionQuerySchema>;

export const AppVersionResponseSchema = z.discriminatedUnion('flavor', [
  z.object({
    flavor: z.literal('apkRollout'),
    minSupported: z.string(),
    latest: z.string(),
    forceUpgrade: z.boolean(),
    apkUrl: z.string().url(),
    apkSha256: z.string().length(64),
    playStoreUrl: z.null(),
  }),
  // ... two more variants
]);
export type AppVersionResponse = z.infer<typeof AppVersionResponseSchema>;
```

**For CompatResult.ts** — copy header style, single Zod object, exported type, NO discriminated union (single shape per CONTEXT.md D-COMPAT-05). Shape comes verbatim from CONTEXT.md D-COMPAT-05.

**Re-export from index** — append `export * from './CompatResult.js';` to `shared/types/src/index.ts` and bump `SHARED_TYPES_VERSION` from `'0.5.0'` → `'0.6.0'`.

---

### `apps/mobile/__tests__/SignupScreen.test.tsx` (and ~12 sibling tests)

**Analog:** `apps/mobile/__tests__/SignIn.test.tsx`

**vi.mock + describe + render pattern** (full file 65 LOC — copy verbatim, swap component + assertions):

```typescript
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/services/auth', () => ({
  signInWithGoogle: vi.fn(),
  getStoredJwt: vi.fn(() => undefined),
  clearStoredJwt: vi.fn(),
}));

import SignIn from '../src/screens/SignIn';
import { signInWithGoogle } from '../src/services/auth';

describe('SignIn screen', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('renders the Continue with Google button', () => {
    const { getByLabelText } = render(<SignIn />);
    expect(getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('on button press → calls signInWithGoogle and shows Welcome on success', async () => {
    (signInWithGoogle as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      jwt: 'fake.jwt.token',
      user: {
        id: '01HVFAKE0000000000000000US',
        email: 'tester@example.com',
        name: 'Tester',
        avatarUrl: null,
      },
    });
    const { getByLabelText, findByText } = render(<SignIn />);
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(await findByText('Welcome, Tester')).toBeTruthy();
  });
});
```

**Apply to every Phase 2 screen test:** mock the corresponding service (e.g., `vi.mock('../src/services/compatService')`), import the screen, render, query via `getByLabelText`/`findByText` (matching `accessibilityLabel` strings).

**For service tests** (`compatService.test.ts`, `versionService.test.ts`, etc.) — same `vi.mock('react-native-mmkv', () => ({ createMMKV: () => ({ set: vi.fn(), getString: vi.fn(), remove: vi.fn() }) }))` pattern; mock `NativeModules` per `vitest.setup.ts`.

---

### `apps/mobile/vitest.setup.ts` (modify — add NavigationContainer + react-native-screens stubs)

**Analog:** Self (current vitest.setup.ts)

**Existing host-component-shim pattern** (lines 10-50) — copy structure for new RN-ecosystem deps:

```typescript
vi.mock('react-native', () => {
  function makeComponent(name: string) {
    return React.forwardRef<HTMLDivElement, ...>(function HostComponent(props, ref) {
      const { children, accessibilityLabel, accessibilityRole, onPress, ...rest } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      return React.createElement('div', dom, children as React.ReactNode);
    });
  }
  return { View: makeComponent('View'), Text: makeComponent('Text'), /* ... */ };
});
```

**For Phase 2:** add `vi.mock('@react-navigation/native', () => ({ NavigationContainer: ({ children }) => children, useNavigation: () => ({ replace: vi.fn(), reset: vi.fn(), navigate: vi.fn() }) }))`; add `vi.mock('react-native-screens', () => ({ enableScreens: () => null }))`; add `vi.mock('react-native-mmkv', ...)` shared across all tests.

---

### `apps/mobile/__tests__/services/feedbackService.test.ts` (representative service test)

**Analog:** `apps/mobile/__tests__/SignIn.test.tsx`

Service-test variant of the same `vi.mock` + `describe` shape — mock `apiClient.post`, mock `NativeModules.AppFlavor`, mock `telemetryRing.snapshot`, then assert the multipart body fields. Direct port from the SignIn test scaffold; just no JSX render calls.

---

### `…/test/.../HumynCompatModuleTest.kt` (Kotlin Robolectric test — NO ANALOG)

See **No Analog Found** section. Pattern: JUnit 4 + Robolectric `@Config(sdk = [33])`, shadow Camera2/SensorManager/StatFs to inject canned device-cap responses. Reference: `apps/mobile/android/app/build.gradle` `dependencies {}` block already declares `com.google.android.play:integrity:1.4.0` — Phase 2 adds `testImplementation 'org.robolectric:robolectric:4.13'` + `testImplementation 'junit:junit:4.13.2'` to the same block.

---

### `apps/mobile/scripts/build-help-content.mjs` (build-script, transform)

**Analog:** `apps/api/scripts/parse-taxonomy.ts` (sibling node script; same role: deterministic build-time content bake)

**Pattern** (research-derived; RESEARCH §Pattern 4 lines 572-583):

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const md = readFileSync('../../help-center-content.md', 'utf8');
const tokens = marked.lexer(md);
// Extract 3 H2 sections (Instructions Guide, FAQs, Troubleshooting)
// Emit { sections: [{ title, body: markdown-string }, ...] }
writeFileSync('src/screens/help/content.json', JSON.stringify(out, null, 2));
```

Wire as `prebuild` script in `package.json` so JSON cannot fall out of sync with the markdown source. Run from CI before `tsc --noEmit`.

---

### `apps/mobile/App.tsx` (REWRITE — root)

**Analog:** Self (current App.tsx)

**Existing root structure** (full file 17 LOC):

```typescript
import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import SignIn from './src/screens/SignIn';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <SignIn />
    </SafeAreaView>
  );
}
```

**Phase 2 expansion** — keep the SafeAreaView + StatusBar wrap, replace `<SignIn />` with the navigator subtree:

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { hydrate } from './src/state/hydrate';
import { useAppStore } from './src/state/appStore';
import RootNativeStack from './src/navigation/RootNativeStack';

// Sync hydrate before render — MMKV is sync, Zustand setState is sync.
hydrate();

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer linking={linkingConfig}>
        <RootNativeStack />
      </NavigationContainer>
    </SafeAreaView>
  );
}
```

The full `RootNativeStack` reference impl is in RESEARCH §Code Examples lines 830-855.

---

### `apps/mobile/android/app/src/main/AndroidManifest.xml` (modify — add Phase 2 permissions)

**Analog:** Self (current base manifest, full file shown)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!--
      Base manifest. Common permissions ONLY.
      NEVER add the in-app install-source permission here — Play Store auto-rejects
      APKs that declare it. The apkRollout flavor adds that permission via its own
      manifest source set at android/app/src/apkRollout/AndroidManifest.xml.
    -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application ...>
        <activity android:name=".MainActivity" .../>
    </application>
</manifest>
```

**Phase 2 additions** (Camera + Mic + foreground services + wake lock):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
```

**EXPLICITLY DO NOT ADD** to base manifest:

- `REQUEST_INSTALL_PACKAGES` (apkRollout-only; already correctly scoped)
- `POST_NOTIFICATIONS` (PROJECT.md hard rule — no notifications channel at MVP)
- `ACCESS_FINE_LOCATION` (PROJECT.md hard rule — coarse only; deferred to Phase 4)

The CI gate `apps/mobile/scripts/verify-merged-manifests.sh` already checks `REQUEST_INSTALL_PACKAGES` flavor scoping. Phase 2 should add a sibling check that the base manifest declares CAMERA + RECORD_AUDIO and does NOT declare POST_NOTIFICATIONS.

---

### `apps/mobile/android/app/build.gradle` (modify — Robolectric testImplementation)

**Analog:** Self (current build.gradle)

**Existing dependencies block** (lines 89-98):

```gradle
dependencies {
    implementation("com.facebook.react:react-android")
    if (hermesEnabled.toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    }
    // Plan 13 — Google Play Integrity SDK ...
    implementation 'com.google.android.play:integrity:1.4.0'
}
```

**Phase 2 additions** (Robolectric per RESEARCH §Validation Architecture):

```gradle
testImplementation 'junit:junit:4.13.2'
testImplementation 'org.robolectric:robolectric:4.13'
testImplementation 'androidx.test:core:1.6.1'
testImplementation 'androidx.test.ext:junit:1.2.1'
```

Plus a `testOptions { unitTests { includeAndroidResources = true } }` block inside `android {}` so Robolectric can resolve resources. Tests run via `./gradlew :app:testApkRolloutDebugUnitTest`.

---

### `.github/workflows/mobile-ci.yml` (NEW)

**Analog:** `.github/workflows/api-ci.yml`

**Pattern** — separate workflow file (per CONTEXT.md D-PKG-04). Extract the structure from api-ci.yml:

```yaml
name: mobile-ci

on:
  pull_request:
    paths:
      - 'apps/mobile/**'
      - 'shared/types/**'
      - '.github/workflows/mobile-ci.yml'
  push:
    branches: [main]

env:
  NODE_VERSION: '22'

jobs:
  lint-typecheck-test:
    name: Lint + Typecheck + Unit
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: apps/mobile/package-lock.json
      - run: cd apps/mobile && npm ci
      - run: cd apps/mobile && npm run typecheck
      - run: cd apps/mobile && npm run lint
      - run: cd apps/mobile && npm run test

  android-build:
    name: Android Build (apkRolloutDebug)
    runs-on: ubuntu-24.04
    needs: lint-typecheck-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: apps/mobile/package-lock.json
      - run: cd apps/mobile && npm ci
      - run: cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest
      - run: cd apps/mobile/android && ./gradlew assembleApkRolloutDebug
      - run: cd apps/mobile && bash scripts/verify-merged-manifests.sh
```

Crucially: NO pnpm in this workflow. Mobile is npm-only post-02-01.

---

## Shared Patterns

### Shared Pattern 1: MMKV singleton + versioned keys

**Source:** `apps/mobile/src/services/auth.ts` lines 22-25
**Apply to:** `compatService.ts`, `installationId.ts`, `telemetryRing.ts`, `versionService.ts`, `hydrate.ts`

```typescript
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'humyn.secure', encryptionKey: 'humyn-mmkv-v1' });
const JWT_KEY = 'auth.jwt.v1';
```

**Rules:**

- One `humyn.secure` instance across the entire app (extract to `apps/mobile/src/state/mmkv.ts` if multiple services need it).
- Every key string is a `const KEY_NAME = 'domain.subdomain.vN'` declaration at module top.
- Versioned `.v1` suffix per Phase 1 convention (auth.jwt.v1) and CONTEXT.md D-STATE-01.
- Sync API only — no async wrappers, no promise.

---

### Shared Pattern 2: Native module surface (Kotlin TurboModule + typed JS bridge)

**Source:** `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` + `apps/mobile/src/native/PlayIntegrity.ts`
**Apply to:** HumynCompat, HumynUpdater (and any future native modules)

**Kotlin side:**

1. `class XxxModule(reactCtx) : ReactContextBaseJavaModule(reactCtx)` annotated `@ReactModule(name = NAME)`.
2. `companion object { const val NAME = "Xxx" }` — drives the JS-side `NativeModules.Xxx` lookup.
3. Each method: `@ReactMethod fun foo(arg1: T1, ..., promise: Promise)`.
4. Inside method: try/catch, dispatch real work to a background `Executor` (NOT main thread), `promise.resolve(Arguments.makeNativeMap(mapOf(...)))` on success, `promise.reject(code, "${t::class.simpleName}: ${t.message}", t)` on error (RESEARCH Pitfall 10).
5. Pair with `XxxPackage : ReactPackage` in the same dir.
6. Register both packages in `MainApplication.kt`'s `getPackages()`.

**JS side:**

```typescript
import { NativeModules } from 'react-native';

interface XxxNativeModule {
  foo(arg1: T1): Promise<{ shape: typeof Kotlin's makeNativeMap }>;
}

const native = NativeModules.Xxx as XxxNativeModule | undefined;

export async function foo(arg1: T1) {
  if (!native) {
    throw new Error('Xxx native module not registered — check apps/mobile/android/app/src/main/java/.../MainApplication.kt');
  }
  return native.foo(arg1);
}
```

---

### Shared Pattern 3: Per-flavor manifest scoping

**Source:** `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml`
**Apply to:** Any apkRollout-only permission (currently just `REQUEST_INSTALL_PACKAGES`; Phase 2 introduces no new flavor-scoped permissions)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"
                     tools:targetApi="34" />
</manifest>
```

The base manifest stays clean of any Play-Store-rejected permissions. The CI gate `verify-merged-manifests.sh` enforces this on every PR.

---

### Shared Pattern 4: Vitest test scaffold (vi.mock service → render → query by accessibility)

**Source:** `apps/mobile/__tests__/SignIn.test.tsx` (full file, 65 LOC)
**Apply to:** Every Phase 2 screen test (~13 files) and every service test (~7 files)

**Recipe:**

1. `vi.mock('../src/services/{service}', () => ({ ...stubs }))` at top of file.
2. `import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'` — DOM variant, NOT `@testing-library/react-native` (per the existing comment block lines 7-13 of SignIn.test.tsx).
3. `describe(...)` with `beforeEach(() => vi.clearAllMocks())` + `afterEach(() => cleanup())`.
4. Query rendered components by `getByLabelText('...')` matching the `accessibilityLabel` prop string.
5. Trigger user interaction via `fireEvent.click(...)` (the host-component shim maps `onPress` → `onClick`).
6. Assert async results via `findByText(...)` + `waitFor(...)`.

---

### Shared Pattern 5: Zod schema in `shared/types/src/`

**Source:** `shared/types/src/app-version.ts` (50 LOC) + `shared/types/src/feedback.ts` + `shared/types/src/me.ts`
**Apply to:** `shared/types/src/CompatResult.ts` + any Phase 2 wire-shape additions

**Recipe:**

1. Header comment explaining what the schema is for + cross-references to phase decisions.
2. `import { z } from 'zod';` and (when needed) cross-imports from sibling schemas.
3. `export const FooSchema = z.object({...});` followed by `export type Foo = z.infer<typeof FooSchema>;` — schema THEN type.
4. Add `export * from './CompatResult.js';` to `shared/types/src/index.ts`.
5. Bump `SHARED_TYPES_VERSION` in `index.ts`.
6. Reuse in mobile via `@humyn/shared-types` import (via npm `file:` link post-02-01).

---

### Shared Pattern 6: Backend route inspection (verify wire shape before client work)

**Source:** `apps/api/src/routes/app-version/get.ts` + `apps/api/src/routes/me/get-patch.ts` + `apps/api/src/routes/feedback/post.ts`
**Apply to:** Every Phase 2 backend integration (versionService, profile-edit flow, feedback submit, account-delete)

**Verified facts** (read directly from source — do not re-infer):

- `/app/version` returns the camelCase discriminated-union per `AppVersionResponseSchema` (NOT snake_case as REQUEMENTS.md text suggests). `Cache-Control: public, max-age=21600` header is set server-side.
- `GET /me` requires `app.requireAuth` preHandler; returns `MeResponseSchema` — pick id, email, name, age, gender, avatarUrl, consentVersion, flavor, applicationId, deletedAt, deleteGraceUntil, createdAt.
- `PATCH /me` body schema is `UserPatchSchema` (only name/age/gender editable). Server returns the full updated `MeResponseSchema`.
- `DELETE /me?confirm=DELETE` is mandatory query param; rate-limited 5/min per applicationId. Returns `{ ok: true, deleteGraceUntil: ISO-string }` — Phase 2 client uses `deleteGraceUntil` for the "30-day restore window" copy.
- `POST /feedback` is multipart/form-data. Fields = `category` (one of `FEEDBACK_CATEGORIES`) + `message` (1-4000 chars). Optional `diagnostic` file (application/json only, 5 MB cap). Rate-limited 5/min per user.

---

## No Analog Found

Files with no close match in the existing codebase. Planner uses RESEARCH.md patterns instead:

| File                                                     | Role                     | Data Flow    | Reason / RESEARCH Reference                                                                                |
| -------------------------------------------------------- | ------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/state/appStore.ts`                      | Zustand store            | event-driven | Zustand is new in Phase 2. Pattern in RESEARCH §Pattern 1 lines 462-499.                                   |
| `apps/mobile/src/state/hydrate.ts`                       | hydration utility        | transform    | New pattern (MMKV → Zustand on boot). Recipe in RESEARCH §Pattern 1 lines 462-499 + §Architecture.         |
| `apps/mobile/src/navigation/RootNativeStack.tsx`         | navigator                | n/a          | React Navigation v7 is new in Phase 2. Reference impl in RESEARCH §Code Examples lines 830-855.            |
| `apps/mobile/src/navigation/OnboardingStack.tsx`         | navigator                | n/a          | Same — RESEARCH §Code Examples.                                                                            |
| `apps/mobile/src/navigation/MainTabs.tsx`                | navigator                | n/a          | `createBottomTabNavigator` from `@react-navigation/bottom-tabs`. RESEARCH §Standard Stack.                 |
| `apps/mobile/src/components/BottomNav.tsx`               | tab-bar customization    | n/a          | `tabBar` prop callback receives `BottomTabBarProps`. RESEARCH-derived; design-spec §0.5.                   |
| `apps/mobile/src/services/semver.ts`                     | utility                  | transform    | ~10 LOC hand-rolled M.m.p comparator. RESEARCH §Don't Hand-Roll table.                                     |
| `apps/mobile/src/services/durationFormatter.ts`          | utility                  | transform    | Trivial helper; HOME-06 logic. RESEARCH §specifics.                                                        |
| `…/HumynCompat/NalParser.kt`                             | utility (Kotlin)         | transform    | RESEARCH §Code Examples lines 712-762 has the full ~80 LOC reference.                                      |
| `…/HumynCompat/EncoderProbe.kt`                          | probe (Kotlin)           | event-driven | Camera2 + MediaCodec + NalParser composition. RESEARCH §Pitfall 1, 2, 3.                                   |
| `…/HumynCompat/ImuProbe.kt`                              | probe (Kotlin)           | event-driven | RESEARCH §Code Examples lines 793-824 has the full reference impl.                                         |
| `…/HumynCompat/DeviceCaps.kt`                            | probe (Kotlin)           | transform    | RESEARCH §Code Examples lines 766-786 (dFOV) + RESEARCH §Pitfall 5, 6, 8.                                  |
| `…/HumynUpdater/HumynUpdaterModule.kt`                   | native module (Kotlin)   | event-driven | RESEARCH §Code Examples lines 862-920 has the full reference impl.                                         |
| `…/test/.../HumynCompatModuleTest.kt`                    | Kotlin unit test         | n/a          | Robolectric is new. RESEARCH §Validation Architecture lines 1075-1077, 1099-1106.                          |
| `…/test/resources/hevc-fixtures/{i-only.h265, ibp.h265}` | binary fixture           | n/a          | Generate with `ffmpeg` — 1-frame I-only and 3-frame IBP HEVC bitstream. RESEARCH §Validation Architecture. |
| `apps/mobile/src/ui/tokens.ts`                           | design tokens            | n/a          | engineering-handoff §1 verbatim. CONTEXT.md D-UI-01.                                                       |
| `apps/mobile/src/ui/primitives/*.tsx`                    | UI primitives (8 files)  | n/a          | design-spec §0.5 verbatim. CONTEXT.md D-UI-02.                                                             |
| `apps/mobile/react-native.config.js`                     | font-asset linker config | n/a          | `assets: ['./assets/fonts/']`. CONTEXT.md D-UI-03.                                                         |

---

## Metadata

**Analog search scope:**

- `apps/mobile/` (full tree) — Phase 1 mobile scaffold
- `apps/api/src/routes/` — backend routes consumed by Phase 2 (app-version, me, feedback, contributions)
- `apps/api/src/lib/`, `apps/api/src/plugins/` — sampled for shared patterns
- `shared/types/src/` — every Zod schema file
- `apps/mobile/android/app/src/main/java/` — Kotlin native modules (AppFlavor, PlayIntegrity)
- `apps/mobile/android/app/src/{main,apkRollout}/` — manifest source-sets
- `apps/mobile/scripts/` — existing build scripts
- `.github/workflows/api-ci.yml` — CI workflow analog
- `.planning/phases/01-foundation-backend-distribution-recon/01-09-SUMMARY.md` — Phase 1 plan-09 summary for Pattern 35-38 (manifest scoping, BuildConfig exposure)

**Files scanned:** ~30 source files read in full + ~20 referenced for shape; 1212-line RESEARCH.md fully consumed; 332-line CONTEXT.md fully consumed.

**Key insight:** Phase 1 deliberately shipped a tiny mobile slice to lock in the conventions Phase 2 would scale up — every layer (MMKV, native module, manifest scoping, Vitest harness, RFC 7807 error handling, shared/types Zod schemas) has exactly one Phase 1 reference implementation that Phase 2 copies and replicates ~10× across the new file set. The few genuinely new patterns (Zustand store, React Navigation v7 graph, Robolectric Kotlin tests, HEVC NAL parser) are isolated, well-bounded, and have authoritative reference implementations in RESEARCH.md.

**Pattern extraction date:** 2026-05-08

## PATTERN MAPPING COMPLETE
