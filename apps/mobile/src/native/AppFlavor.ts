import { NativeModules } from 'react-native';

/**
 * Native module contract for `NativeModules.AppFlavor`. The Kotlin module
 * (apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt)
 * exposes flavor + applicationId + versionName + versionCode + deviceModel as
 * compile-time constants via getConstants() so JS can read them synchronously
 * without a bridge round-trip; getOrMintInstallationId() is async because it
 * reaches into Kotlin SharedPreferences.
 *
 * Two flavors only — apkRollout, playStore. The third recon flavor is
 * rescinded per CONTEXT.md D-DIST-01; iOS flavor wiring is deferred to
 * Phase 7.
 */
interface AppFlavorNativeModule {
  flavor: 'apkRollout' | 'playStore';
  applicationId: 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk';
  versionName: string;
  versionCode: number;
  deviceModel: string;
  get(): Promise<{ flavor: string; applicationId: string }>;
  getOrMintInstallationId(): Promise<string>;
}

const native = NativeModules.AppFlavor as AppFlavorNativeModule | undefined;

export type Flavor = 'apkRollout' | 'playStore';
export type AppApplicationId = 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk';

export interface FlavorContext {
  flavor: Flavor;
  applicationId: AppApplicationId;
  versionName: string;
  versionCode: number;
  deviceModel: string;
}

/**
 * Returns the compile-time flavor + applicationId + versionName + versionCode
 * + deviceModel of the running APK. Throws if the native module is not
 * registered (e.g. running on web or in a unit test that hasn't mocked
 * NativeModules.AppFlavor).
 *
 * Used by:
 *   - `apps/mobile/src/services/auth.ts` for the JWT flavor/applicationId
 *     defense-in-depth check
 *   - `apps/mobile/src/screens/Profile.tsx` (plan 02-19) for the PROF-05 footer
 *   - the compat-signature builder in plan 02-06 for D-COMPAT-03
 */
export function getFlavorContext(): FlavorContext {
  if (!native) {
    throw new Error(
      'AppFlavor native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return {
    flavor: native.flavor,
    applicationId: native.applicationId,
    versionName: native.versionName,
    versionCode: native.versionCode,
    deviceModel: native.deviceModel,
  };
}

/**
 * Mint-or-read the per-install UUID. Persisted in Kotlin SharedPreferences
 * (`humyn_install` / `installation_id`) so JS-side MMKV wipes don't lose it.
 *
 * Prefer `getInstallationId()` from `../services/installationId` over calling
 * this directly — the service caches the value in MMKV at `installation_id.v1`
 * for sync reads.
 */
export async function getOrMintInstallationId(): Promise<string> {
  if (!native) {
    throw new Error(
      'AppFlavor native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native.getOrMintInstallationId();
}
