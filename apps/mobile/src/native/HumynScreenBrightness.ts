/**
 * REC-08 — typed JS bridge for the HumynScreenBrightness native module.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/
 * HumynScreenBrightnessModule.kt. Shape parity with the Phase-2 HumynCompat.ts
 * pattern — same `ensure()` guard, same canonical "not registered" error.
 *
 * **Per-window brightness only.** The Kotlin body (plan 04-05) sets
 * `currentActivity.window.attributes.screenBrightness` — NOT
 * `Settings.System.SCREEN_BRIGHTNESS` (that would need the `WRITE_SETTINGS`
 * permission and changes the device-wide setting). Per-window brightness is
 * scoped to this app's window and is automatically released when the activity
 * goes away — but RecordingScreen still calls `set(-1)` explicitly on stop AND
 * on unmount so the screen doesn't stay dim if the user backgrounds mid-record
 * (REC-08).
 *
 * Until plan 04-05 (`HumynScreenBrightnessModule.kt` body) lands, the native
 * side's `set()` resolves trivially (the shell); the JS bridge surface is
 * contractually final from this plan onward.
 */
import { NativeModules } from 'react-native';

interface HumynScreenBrightnessNativeModule {
  /**
   * Set the per-window brightness. `value ∈ [0, 1]` overrides the window's
   * brightness; `value === -1` (`WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE`)
   * restores the system default. The Kotlin body clamps out-of-range values.
   */
  set(value: number): Promise<void>;
}

function ensure(): HumynScreenBrightnessNativeModule {
  const native = NativeModules.HumynScreenBrightness as
    | HumynScreenBrightnessNativeModule
    | undefined;
  if (!native) {
    throw new Error(
      'HumynScreenBrightness native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Set the per-window brightness. Pass a fraction in `[0, 1]` to dim/brighten
 * the app window, or `-1` to restore the system default. RecordingScreen uses
 * `set(0.05)` at gate exit (so the bright preview doesn't blast the user mid-
 * record) and `set(-1)` on stop AND on unmount (REC-08). Implementation: plan
 * 04-05.
 */
export async function set(value: number): Promise<void> {
  return ensure().set(value);
}
