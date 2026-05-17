/**
 * D-COMPAT-02 — typed JS bridge for the HumynCompat native module.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/
 * HumynCompatModule.kt. Three async methods that wrap Camera2 + MediaCodec
 * (encoder probe, plan 02-12), SensorManager + optional Camera2 preview
 * (IMU probe, plan 02-13), and CameraCharacteristics + AudioRecord + StatFs
 * (device caps, plan 02-14).
 *
 * Until those plans land, the native side throws NotImplementedError and
 * each function below resolves with a rejected Promise carrying one of the
 * three error codes:
 *
 *   ENCODER_PROBE_ERROR   — runEncoderProbe failure
 *   IMU_PROBE_ERROR       — runImuProbe failure
 *   DEVICE_CAPS_ERROR     — readDeviceCaps failure
 *
 * If the native module is not registered (e.g. running in a JSDOM unit test
 * that didn't mock NativeModules), every function throws an error
 * containing the string "HumynCompat native module not registered" so the
 * caller can disambiguate "missing wiring" from "probe failed".
 */
import { NativeModules } from 'react-native';

export interface EncoderProbeResult {
  /**
   * True if the encoder bitstream contained at least one HEVC B-slice.
   * Plan 02-12 fills in the NAL parser; the shell always reports false.
   */
  bFramePresent: boolean;
  /** TotalCaptureResult readback confirms LENS_OPTICAL_STABILIZATION_MODE_OFF. */
  oisOff: boolean;
  /** DynamicRangeProfile readback (API 33+) confirms STANDARD; auto-true on API <33. */
  hdrSdrForced: boolean;
  /** Absolute path to the cacheDir probe clip (already deleted by finally — diagnostic only). */
  encoderClipPath: string;
  /**
   * Quick task 260517-p5g CAPTURE-QA-02 — `true` iff the encoder's
   * `INFO_OUTPUT_FORMAT_CHANGED` fired during the 5s probe AND its
   * `outputFormat` snapshot reported `KEY_WIDTH=1920` /
   * `KEY_HEIGHT=1080`. Distinct from `DeviceCapsResult.resolutionMax`
   * which only proves the codec exists at 1080p in the abstract — a
   * device whose codec exists but whose encoder pipeline silently falls
   * back to 720p (logical-multi-camera fusion path, thermal throttle,
   * OEM weirdness) now fails compat closed-loop. Optional (defaults
   * to `undefined`) so a stale native build that pre-dates this field
   * doesn't crash the JS bridge — compatService rolls `=== true` into
   * the resolution check (any other value is treated as a failure).
   */
  resolutionDeliverable?: boolean;
}

export interface ImuProbeResult {
  /** Sustained samples-per-second after the 5 s warm-up window. */
  sustainedHz: number;
  /** 99th percentile of inter-sample intervals in milliseconds. */
  p99IntervalMs: number;
  /** Total samples observed including the warm-up. */
  samplesCollected: number;
}

export interface DeviceCapsResult {
  /** Long-edge maximum resolution from the back ultrawide camera. */
  resolutionMax: { w: number; h: number };
  /** Maximum sustained frames-per-second the back ultrawide reports. */
  fpsMax: number;
  /** Diagonal field-of-view of the back ultrawide camera, degrees. */
  ultrawideDfovDeg: number;
  /** 48000 if the mic supports 48 kHz mono PCM-16, else 0. */
  micSampleRateMax: number;
  /** SENSOR_INFO_TIMESTAMP_SOURCE == REALTIME on the back ultrawide. */
  realtimeTimestampSource: boolean;
  /**
   * Both gyroscope AND accelerometer present on the device.
   * `<uses-feature required="true">` already filters out devices without these
   * at install-time; this field is a redundant runtime-side check.
   */
  motionSensorsPresent: boolean;
  /** Best-effort root verdict; Play Integrity (Phase 1) is authoritative. */
  rooted: boolean;
  /** Free space on the internal data partition in gigabytes. */
  freeStorageGB: number;
}

interface HumynCompatNativeModule {
  runEncoderProbe(): Promise<EncoderProbeResult>;
  runImuProbe(durationMs: number, withPreview: boolean): Promise<ImuProbeResult>;
  readDeviceCaps(): Promise<DeviceCapsResult>;
}

function ensure(): HumynCompatNativeModule {
  const native = NativeModules.HumynCompat as HumynCompatNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynCompat native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Run the 5-second behavioral encoder probe (COMPAT-07). Returns
 * `{bFramePresent, oisOff, hdrSdrForced, encoderClipPath}`. Implementation:
 * plan 02-12.
 */
export async function runEncoderProbe(): Promise<EncoderProbeResult> {
  return ensure().runEncoderProbe();
}

/**
 * Run the IMU sustained-rate probe (COMPAT-02). Samples gyroscope at
 * SENSOR_DELAY_FASTEST for `durationMs` with a 5 s warm-up skip; if
 * `withPreview` is true, runs a concurrent 1080p Camera2 preview to load
 * the SoC. Implementation: plan 02-13.
 */
export async function runImuProbe(
  durationMs: number,
  withPreview: boolean,
): Promise<ImuProbeResult> {
  return ensure().runImuProbe(durationMs, withPreview);
}

/**
 * Read static device capabilities (COMPAT-01/03/07). Implementation: plan
 * 02-14.
 */
export async function readDeviceCaps(): Promise<DeviceCapsResult> {
  return ensure().readDeviceCaps();
}
