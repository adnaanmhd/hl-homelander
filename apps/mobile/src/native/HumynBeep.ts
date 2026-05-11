/**
 * REC-10 — typed JS bridge for the HumynBeep native module.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/
 * HumynBeepModule.kt. Shape parity with the Phase-2 HumynCompat.ts pattern —
 * same `ensure()` guard, same canonical "not registered" error.
 *
 * **Pre-baked .wav over SoundPool — NOT react-native-sound /
 * react-native-track-player** (CLAUDE.md "Do NOT Use"). The Kotlin body (plan
 * 04-05) loads a small pre-generated `.wav` from `assets/audio/` into a
 * `SoundPool` and plays it; pre-baking avoids the AudioContext / tone-
 * generator latency variance that would make the cue feel laggy on ₹30K
 * phones (engineering-handoff §6.1).
 *
 * Tone names: `'battery_alert'` (520 Hz / 200 ms), `'thermal_alert'`
 * (descending 440→560→680 Hz). RecordingScreen plays `'battery_alert'` on the
 * low-battery threshold and `'thermal_alert'` on `onThermalAbort`.
 *
 * Until plan 04-05 (`HumynBeepModule.kt` body + the `.wav` assets) lands, the
 * native side's `playTone()` resolves trivially (the shell); the JS bridge
 * surface is contractually final from this plan onward.
 */
import { NativeModules } from 'react-native';

interface HumynBeepNativeModule {
  /** Play the pre-baked tone named `name` ('battery_alert' | 'thermal_alert'). */
  playTone(name: string): Promise<void>;
}

function ensure(): HumynBeepNativeModule {
  const native = NativeModules.HumynBeep as HumynBeepNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynBeep native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Play the pre-baked alert tone named `name`. Known names: `'battery_alert'`,
 * `'thermal_alert'`. Implementation: plan 04-05.
 */
export async function playTone(name: string): Promise<void> {
  return ensure().playTone(name);
}
