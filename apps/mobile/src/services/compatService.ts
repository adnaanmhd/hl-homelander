// compatService — orchestrates the three native HumynCompat probes
// (encoder / IMU / device-caps), assembles a CompatResult per D-COMPAT-05,
// stamps a stable signature per D-COMPAT-03, and writes both the full
// blob and a small "passed" summary to MMKV.
//
// Phase 2 plan 02-15 Task 1.
//
// Persistence model:
//   - `compat.lastResult.v1` — full CompatResult (consumed by CompatFailScreen
//     for diagnostic copy and by hydrate() for the gate-decision tree).
//   - `onboarding.compatPassed.v1` — small {signature, runAt, passed:true}
//     summary used by the gate-decision tree's signature staleness check
//     (AUTH-11). Cleared when a probe run yields passed=false.
//
// Signature recipe (D-COMPAT-03):
//   sha256(versionCode | deviceModel | installation_id) first 16 hex chars.
//   The hash itself runs in Kotlin (AppFlavor.sha256First16Hex) so the math
//   is byte-identical between boot-time gate-decision tree (sync) and
//   compat-run-time persistence (sync inside an async orchestrator).
//
// Threat mitigations (T-2.15-02): per-probe try/catch propagates the native
// error code only (`ENCODER_PROBE_ERROR` / `IMU_PROBE_ERROR` / `DEVICE_CAPS_ERROR`),
// never the raw measured stream of timestamps.

import { NativeModules } from 'react-native';
import { CompatResultSchema, type CompatResult } from '@humyn/shared-types';
import {
  runEncoderProbe,
  runImuProbe,
  readDeviceCaps,
  type EncoderProbeResult,
  type ImuProbeResult,
  type DeviceCapsResult,
} from '../native/HumynCompat';
import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { getInstallationId, getInstallationIdSync } from './installationId';
import { getFlavorContext } from '../native/AppFlavor';

/**
 * Lifecycle event emitted around each native probe so callers (CompatRunningScreen)
 * can transition row states + the percent ring in lock-step with reality, instead
 * of running an independent cosmetic timer that drifts from the real probes.
 *
 * Order is fixed: encoder → imu → deviceCaps. Each phase emits exactly one
 * `started` followed by one `completed` (or none, if a prior probe rejected).
 */
export type CompatProgressEvent =
  | { phase: 'encoder'; status: 'started' }
  | { phase: 'encoder'; status: 'completed'; result: EncoderProbeResult }
  | { phase: 'imu'; status: 'started' }
  | { phase: 'imu'; status: 'completed'; result: ImuProbeResult }
  | { phase: 'deviceCaps'; status: 'started' }
  | { phase: 'deviceCaps'; status: 'completed'; result: DeviceCapsResult };

export type CompatProgressListener = (event: CompatProgressEvent) => void;

/**
 * Invoke a progress listener defensively — a misbehaving listener must never
 * reject runCompatCheck or surface its error to the user. Swallow silently;
 * production must not log probe payloads or stack traces.
 */
function notify(listener: CompatProgressListener | undefined, event: CompatProgressEvent): void {
  if (!listener) return;
  try {
    listener(event);
  } catch {
    // Listener is purely advisory for UI state; do not propagate.
  }
}

interface AppFlavorSyncSurface {
  sha256First16Hex?: (input: string) => string;
}

function sha256First16Hex(input: string): string {
  const native = NativeModules.AppFlavor as AppFlavorSyncSurface | undefined;
  const fn = native?.sha256First16Hex;
  if (typeof fn !== 'function') {
    throw new Error(
      'AppFlavor.sha256First16Hex not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt',
    );
  }
  return fn(input);
}

/**
 * Compute the stable per-install compat signature.
 *
 * Inputs: BuildConfig.VERSION_CODE | Build.MODEL | per-install UUID.
 * The installation_id MUST be hydrated into MMKV before this runs (the
 * compat orchestrator awaits getInstallationId() once at the top of
 * runCompatCheck). The async-then-sync split lets RootNativeStack call
 * computeSignatureSync() inline at boot once the installation_id is in
 * MMKV (plan 02-16 wiring).
 */
function computeSignatureSync(): string {
  const flavor = getFlavorContext();
  const id = getInstallationIdSync();
  if (id === null) {
    throw new Error(
      'compatService.computeSignature: installation_id not hydrated — call getInstallationId() first',
    );
  }
  return sha256First16Hex(`${flavor.versionCode}|${flavor.deviceModel}|${id}`);
}

/**
 * Run the three native probes serially, assemble the CompatResult, persist
 * it to MMKV, and return the parsed result. Caller is responsible for
 * pushing the result into Zustand (CompatRunningScreen does this via
 * useAppStore.setCompatResult so the FailScreen and gate-decision tree see
 * the new state immediately).
 *
 * Optional `onProgress` listener fires `started` / `completed` for each
 * native probe in order (encoder → imu → deviceCaps). Used by
 * CompatRunningScreen to drive its row state machine + percent ring from
 * real probe lifecycle instead of a fixed cosmetic timer. Listener errors
 * are swallowed.
 */
export async function runCompatCheck(onProgress?: CompatProgressListener): Promise<CompatResult> {
  // Hydrate installation_id first so computeSignatureSync() can read it.
  await getInstallationId();

  notify(onProgress, { phase: 'encoder', status: 'started' });
  const enc = await runEncoderProbe();
  notify(onProgress, { phase: 'encoder', status: 'completed', result: enc });

  notify(onProgress, { phase: 'imu', status: 'started' });
  const imu = await runImuProbe(30_000, true);
  notify(onProgress, { phase: 'imu', status: 'completed', result: imu });

  notify(onProgress, { phase: 'deviceCaps', status: 'started' });
  const caps = await readDeviceCaps();
  notify(onProgress, { phase: 'deviceCaps', status: 'completed', result: caps });

  // resolutionMax is {w, h}; long-edge >= 1920 means 1080p+.
  const longEdge = Math.max(caps.resolutionMax.w, caps.resolutionMax.h);

  // Quick task 260517-p5g CAPTURE-QA-02 — compat.resolution now requires
  // BOTH (a) the device-caps long-edge proving the codec exists at 1080p+
  // AND (b) the EncoderProbe surface-deliverability check proving the
  // encoder pipeline actually delivers the 1920×1080 surface (not a
  // silent 720p fallback). Strict equality with `true` so a stale native
  // build that pre-dates the field (resolutionDeliverable === undefined)
  // is treated as a failure, fail-closed.
  const longEdgeOk = longEdge >= 1920;
  const resolutionDeliverableOk = enc.resolutionDeliverable === true;

  const checks = {
    resolution: longEdgeOk && resolutionDeliverableOk,
    fps: caps.fpsMax >= 30,
    ultrawideDfov: { pass: caps.ultrawideDfovDeg >= 110, measuredDeg: caps.ultrawideDfovDeg },
    imuSustained100Hz: { pass: imu.sustainedHz >= 100, measuredHz: imu.sustainedHz },
    imuP99Ms: { pass: imu.p99IntervalMs <= 12, measuredMs: imu.p99IntervalMs },
    micSampleRate: caps.micSampleRateMax >= 48_000,
    realtimeTimestamp: caps.realtimeTimestampSource,
    root: {
      pass: !caps.rooted,
      verdict: caps.rooted ? 'rooted_heuristic_match' : 'clean',
    },
    freeStorageGB: {
      // freeStorage is a soft warning, NOT a block — pass:true regardless,
      // warningOnly true when below 5 GB so CompatPassScreen renders the banner.
      pass: true,
      warningOnly: caps.freeStorageGB < 5,
      measuredGB: caps.freeStorageGB,
    },
    encoderNoBFrames: !enc.bFramePresent,
    oisOff: enc.oisOff,
    hdrSdrForced: enc.hdrSdrForced,
  };

  const failedKeys: string[] = [];
  for (const [k, v] of Object.entries(checks)) {
    if (typeof v === 'boolean') {
      if (!v) failedKeys.push(k);
    } else if ('pass' in v && !v.pass) {
      failedKeys.push(k);
    }
  }
  const passed = failedKeys.length === 0;

  const result: CompatResult = CompatResultSchema.parse({
    signature: computeSignatureSync(),
    runAt: new Date().toISOString(),
    checks,
    passed,
    failedKeys,
  });

  secureMmkv.set(KEYS.COMPAT_LAST_RESULT, JSON.stringify(result));
  if (passed) {
    secureMmkv.set(
      KEYS.ONBOARDING_COMPAT_PASSED,
      JSON.stringify({ signature: result.signature, runAt: result.runAt, passed: true }),
    );
  } else {
    secureMmkv.remove(KEYS.ONBOARDING_COMPAT_PASSED);
  }
  return result;
}

/**
 * Read the last persisted CompatResult from MMKV, or undefined if none /
 * malformed. Used by CompatFailScreen to render diagnostic copy without
 * re-running the probes when the user taps "What now".
 */
export function getStoredCompatResult(): CompatResult | undefined {
  const raw = secureMmkv.getString(KEYS.COMPAT_LAST_RESULT);
  if (!raw) return undefined;
  try {
    return CompatResultSchema.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * Wipe the persisted compat blob + the small passed summary. Test-side
 * setup helper; not called by production code (signOut already clears
 * onboarding state through the Zustand action).
 */
export function clearStoredCompatResult(): void {
  secureMmkv.remove(KEYS.COMPAT_LAST_RESULT);
  secureMmkv.remove(KEYS.ONBOARDING_COMPAT_PASSED);
}

/**
 * COMPAT-04 / AUTH-11: returns true when the stored compat signature differs
 * from the freshly-computed signature for this build/install.
 *
 * Returns true when:
 *   - no stored result, OR
 *   - stored result was a fail (passed=false), OR
 *   - stored signature differs from computeSignatureSync() (cross-device
 *     restore: same Google account, different installation_id → fresh
 *     signature → mismatch → forced re-run).
 *
 * Caller (RootNativeStack) MUST ensure installation_id is hydrated before
 * invoking; the gate-decision tree from 02-03 already runs hydrate() at
 * boot which fetches installation_id from MMKV (plan 02-16 wires the
 * Kotlin mint-or-fetch).
 */
export function needsRerun(): boolean {
  const stored = getStoredCompatResult();
  if (!stored || !stored.passed) return true;
  try {
    return stored.signature !== computeSignatureSync();
  } catch {
    // installation_id not hydrated (offline-boot caveat from 02-03):
    // trust the stored pass per initialRoute.test.ts Test 11b.
    return false;
  }
}
