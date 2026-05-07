import { NativeModules } from 'react-native';

/**
 * Native module contract for `NativeModules.AppFlavor`. The Kotlin module
 * (apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt)
 * exposes `flavor` + `applicationId` as compile-time constants via
 * getConstants() so JS can read them synchronously without a bridge round-trip.
 *
 * Two flavors only — apkRollout, playStore. The third recon flavor is
 * rescinded per CONTEXT.md D-DIST-01; iOS flavor wiring is deferred to
 * Phase 7.
 */
interface AppFlavorNativeModule {
  flavor: 'apkRollout' | 'playStore';
  applicationId: 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk';
  get(): Promise<{ flavor: string; applicationId: string }>;
}

const native = NativeModules.AppFlavor as AppFlavorNativeModule | undefined;

export type Flavor = 'apkRollout' | 'playStore';
export type AppApplicationId = 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk';

export interface FlavorContext {
  flavor: Flavor;
  applicationId: AppApplicationId;
}

/**
 * Returns the compile-time flavor + applicationId of the running APK.
 * Throws if the native module is not registered (e.g. running on web or in a
 * unit test that hasn't mocked NativeModules.AppFlavor).
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
  };
}
