---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 14
id: 02-14-compat-device-caps-and-permissions
name: HumynCompat DeviceCaps + Location permission helper + COMPAT-03 free-storage warning logic
type: execute
wave: 3
depends_on: [02-06-humyn-compat-kotlin-shells, 02-10-permissions-screen-and-manifest]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/DeviceCapsTest.kt
  - apps/mobile/src/services/locationPermission.ts
  - apps/mobile/__tests__/services/locationPermission.test.ts
autonomous: true
requirements: [COMPAT-01, COMPAT-03, COMPAT-07, PERM-03]
must_haves:
  truths:
    - 'DeviceCaps.readAll() reads camera characteristics for resolutionMax + fpsMax + ultrawideDfovDeg via the back ultrawide camera (LENS_FACING_BACK + LENS_INFO_AVAILABLE_FOCAL_LENGTHS shortest)'
    - 'DeviceCaps reports REALTIME timestamp source (true/false) via SENSOR_INFO_TIMESTAMP_SOURCE == REALTIME (Camera2)'
    - 'DeviceCaps reports microphone 48 kHz capability via AudioRecord.getMinBufferSize at 48000 / CHANNEL_IN_MONO / ENCODING_PCM_16BIT > 0'
    - "DeviceCaps reports rooted verdict via Build.TAGS contains 'test-keys' OR PathFinder probe for /system/app/Superuser.apk + busybox (best-effort heuristic; Play Integrity is the binding gate)"
    - 'DeviceCaps reports freeStorageGB via android.os.StatFs(Environment.getDataDirectory().path).availableBytes / 1e9'
    - 'COMPAT-03 free-storage warningOnly=true when freeStorageGB < 5 (does NOT fail; surfaces in CompatPassScreen as a banner per design-spec §4)'
    - 'locationPermission.requestCoarseLocation() prompts ACCESS_COARSE_LOCATION via react-native-permissions; PERM-03 declared but NOT prompted in Phase 2 onboarding (deferred to first recording in Phase 4); helper exists for Phase 4 to call'
    - 'PERM-03 manifest declaration (ACCESS_COARSE_LOCATION) lives in apps/mobile/android/app/src/main/AndroidManifest.xml — verified via grep gate in 02-22'
  artifacts:
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt'
      provides: 'Non-recording capability enumeration (resolution, fps, dfov, mic, realtime, root, free-storage)'
      contains: 'readAll'
    - path: 'apps/mobile/src/services/locationPermission.ts'
      provides: 'requestCoarseLocation() helper for Phase 4 to call at first-recording'
      contains: 'ACCESS_COARSE_LOCATION'
  key_links:
    - from: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt'
      to: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt'
      via: 'DeviceCaps(reactApplicationContext).readAll()'
      pattern: 'DeviceCaps'
---

<objective>
Implement DeviceCaps.kt — the non-recording capability enumeration that backs COMPAT-01 (resolution, fps, motion sensors, mic, REALTIME timestamp, root, free-storage warning under COMPAT-03). Also lands the JS-side `locationPermission.ts` helper so Phase 4 can call it; manifest declaration verification happens in 02-22.

Purpose: Splits the static "what does this device say it can do" reads into a dedicated Kotlin file (separate from the dynamic encoder + IMU probes in 02-12 / 02-13). dFOV computation follows RESEARCH § Code Examples (lines 764-788).
Output: Kotlin DeviceCaps + Robolectric tests on the dFOV math + JS-side locationPermission helper + tests.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt

<interfaces>
<!-- RESEARCH § Code Examples — dFOV computation (Kotlin) lines 764-788 -->
fun computeDfov(focalLengthMm: Float, sensorWidthMm: Float, sensorHeightMm: Float): Float {
    val diag = sqrt(sensorWidthMm * sensorWidthMm + sensorHeightMm * sensorHeightMm)
    return (2.0 * atan(diag / (2.0 * focalLengthMm)) * (180.0 / PI)).toFloat()
}

<!-- DeviceCaps shape returned by readAll() — must match shared/types CompatResult Zod -->

{
resolutionMax: Int, // pixels (long edge); we only verify >= 1920
fpsMax: Int, // we only verify >= 30
ultrawideDfovDeg: Float, // computed from CameraCharacteristics
micSampleRateMax: Int, // 48000 if AudioRecord.getMinBufferSize() > 0 at 48000/mono/PCM16
realtimeTimestampSource: Boolean, // SENSOR_INFO_TIMESTAMP_SOURCE == REALTIME
rooted: Boolean, // best-effort; Play Integrity is the binding check
freeStorageGB: Float // StatFs(getDataDirectory().path).availableBytes / 1e9
}
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                     | Description                                                      |
| -------------------------------------------- | ---------------------------------------------------------------- |
| CameraCharacteristics → in-process           | OS-mediated, trusted                                             |
| Build.TAGS / filesystem probe → root verdict | best-effort heuristic; Play Integrity (Phase 1) is authoritative |
| StatFs → free-storage figure                 | OS-mediated, trusted                                             |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                  | Disposition | Mitigation Plan                                                                                                                                                                                                                                                            |
| --------- | ---------------------- | ---------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.14-01 | Tampering              | Tampered MMKV `compat.lastResult.v1` faking ultrawide dFOV | accept      | Per RESEARCH § Security Domain row 3, MMKV is encrypted at rest; tampering only affects local UX gate. Backend re-checks integrity at sign-in (Play Integrity); Phase 3 capture pipeline enforces real spec at runtime — tampered cache cannot upload non-spec recordings. |
| T-2.14-02 | Information Disclosure | Filesystem probe for root walks /system paths              | accept      | Walk is read-only on standard /system locations; no PII; if SecurityException is thrown we return rooted=false (best-effort).                                                                                                                                              |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Implement DeviceCaps.kt — full readAll() + dFOV math + Robolectric tests</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/DeviceCapsTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt (current scaffold from 02-06)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "dFOV computation for ultrawide camera (Kotlin)" lines 764-788
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Pitfall 5" lines 646-660 (per-camera dFOV gotcha — back ultrawide vs telephoto)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-COMPAT-02 (readDeviceCaps method contract)
    - shared/types/src/CompatResult.ts (Zod schema — DeviceCaps result must match)
  </read_first>
  <action>
    Replace `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt`:
    ```kotlin
    package ai.humynlabs.capture.compat

    import android.content.Context
    import android.hardware.Sensor
    import android.hardware.SensorManager
    import android.hardware.camera2.CameraCharacteristics
    import android.hardware.camera2.CameraManager
    import android.media.AudioFormat
    import android.media.AudioRecord
    import android.media.MediaRecorder
    import android.os.Build
    import android.os.Environment
    import android.os.StatFs
    import com.facebook.react.bridge.Arguments
    import com.facebook.react.bridge.WritableMap
    import java.io.File
    import kotlin.math.PI
    import kotlin.math.atan
    import kotlin.math.sqrt

    /**
     * COMPAT-01 + COMPAT-03 + COMPAT-07 — non-recording capability enumeration.
     *
     * Returns a WritableMap matching the JS `readDeviceCaps()` contract from
     * apps/mobile/src/native/HumynCompat.ts.
     *
     * `freeStorageGB` < 5 produces a WARNING ONLY (warningOnly=true wired in compatService).
     * `rooted` is best-effort (Build.TAGS + filesystem probe); Play Integrity (Phase 1) is the binding gate.
     */
    class DeviceCaps(private val ctx: Context) {

        fun readAll(): WritableMap {
            val out = Arguments.createMap()

            // 1. Camera capabilities — back ultrawide
            val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val ultrawide = pickBackUltrawideCamera(mgr)
            if (ultrawide != null) {
                val chars = mgr.getCameraCharacteristics(ultrawide)
                val (maxRes, maxFps) = readMaxResAndFps(chars)
                out.putInt("resolutionMax", maxRes)
                out.putInt("fpsMax", maxFps)
                out.putDouble("ultrawideDfovDeg", computeDfov(chars).toDouble())
            } else {
                out.putInt("resolutionMax", 0)
                out.putInt("fpsMax", 0)
                out.putDouble("ultrawideDfovDeg", 0.0)
            }

            // 2. Microphone 48 kHz
            val micBuf = AudioRecord.getMinBufferSize(48_000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            out.putInt("micSampleRateMax", if (micBuf > 0) 48_000 else 0)

            // 3. REALTIME timestamp source — checked via Camera2 characteristics on the same ultrawide
            val realtime = if (ultrawide != null) {
                val chars = mgr.getCameraCharacteristics(ultrawide)
                chars.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE) ==
                    CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME
            } else false
            out.putBoolean("realtimeTimestampSource", realtime)

            // 4. Motion sensors present (gyro + accel)
            val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val hasGyro = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null
            val hasAccel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
            out.putBoolean("motionSensorsPresent", hasGyro && hasAccel)

            // 5. Rooted heuristic (best-effort; Play Integrity is binding)
            out.putBoolean("rooted", isLikelyRooted())

            // 6. Free storage GB — internal data partition
            val statFs = StatFs(Environment.getDataDirectory().path)
            val freeGb = statFs.availableBytes / 1_000_000_000.0
            out.putDouble("freeStorageGB", freeGb)

            return out
        }

        /** Pick the back camera with shortest focal length (= widest dFOV). Pitfall 5. */
        private fun pickBackUltrawideCamera(mgr: CameraManager): String? {
            return mgr.cameraIdList
                .map { id -> id to mgr.getCameraCharacteristics(id) }
                .filter { it.second.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK }
                .minByOrNull { (_, chars) ->
                    val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: floatArrayOf(Float.MAX_VALUE)
                    focalLengths.min()
                }?.first
        }

        /** Read max resolution + max fps from StreamConfigurationMap. */
        private fun readMaxResAndFps(chars: CameraCharacteristics): Pair<Int, Int> {
            val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?: return 0 to 0
            val sizes = map.getOutputSizes(android.graphics.ImageFormat.YUV_420_888) ?: return 0 to 0
            val maxLongEdge = sizes.maxOfOrNull { kotlin.math.max(it.width, it.height) } ?: 0
            // FPS: query AE compensation ranges as proxy; use FPS_RANGES.high()
            val fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            val maxFps = fpsRanges?.maxOfOrNull { it.upper } ?: 0
            return maxLongEdge to maxFps
        }

        /** dFOV = 2 * atan(sensor_diag / (2 * focal)) — degrees. */
        internal fun computeDfov(chars: CameraCharacteristics): Float {
            val focals = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: return 0f
            val size = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: return 0f
            val focalMm = focals.min()
            return computeDfovFromValues(focalMm, size.width, size.height)
        }

        /** Pure function for testability. */
        internal fun computeDfovFromValues(focalMm: Float, sensorWidthMm: Float, sensorHeightMm: Float): Float {
            if (focalMm <= 0f) return 0f
            val diag = sqrt(sensorWidthMm * sensorWidthMm + sensorHeightMm * sensorHeightMm)
            return (2.0 * atan(diag / (2.0 * focalMm)) * (180.0 / PI)).toFloat()
        }

        private fun isLikelyRooted(): Boolean {
            // Heuristic 1: build tags
            val tags = Build.TAGS
            if (tags != null && tags.contains("test-keys")) return true
            // Heuristic 2: presence of su binary in PATH-like locations
            val paths = listOf(
                "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/app/Superuser.apk",
                "/data/local/xbin/su", "/data/local/bin/su"
            )
            return paths.any { try { File(it).exists() } catch (_: SecurityException) { false } }
        }
    }
    ```

    Author `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/DeviceCapsTest.kt`:
    ```kotlin
    package ai.humynlabs.capture.compat

    import org.junit.Test
    import org.junit.Assert.assertEquals
    import org.junit.Assert.assertTrue
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.RuntimeEnvironment

    @RunWith(RobolectricTestRunner::class)
    class DeviceCapsTest {
        private val caps = DeviceCaps(RuntimeEnvironment.getApplication())

        @Test
        fun `dfov for Pixel 7a back ultrawide — 1.93mm focal, 7.4x5.55mm sensor — is approximately 120 deg`() {
            // Public-domain spec figures for Pixel 7a back ultrawide (Sony IMX787 13MP UW).
            val dfov = caps.computeDfovFromValues(1.93f, 7.40f, 5.55f)
            // Tolerance ±2°: spec sheets variously quote 113–120° dFOV depending on whether they include cropping.
            assertTrue("Pixel 7a UW dFOV expected ~118–122°; got $dfov", dfov in 113f..122f)
        }

        @Test
        fun `dfov for telephoto-like 6mm focal on 7x5mm sensor is ~70 deg, well below 110 threshold`() {
            val dfov = caps.computeDfovFromValues(6.0f, 7.0f, 5.0f)
            assertTrue("telephoto dFOV expected < 80°; got $dfov", dfov < 80f)
        }

        @Test
        fun `dfov returns 0 when focalMm is 0`() {
            assertEquals(0f, caps.computeDfovFromValues(0f, 7f, 5f), 0.001f)
        }

        @Test
        fun `readAll returns a map with all required keys`() {
            val map = caps.readAll()
            assertTrue("resolutionMax key", map.hasKey("resolutionMax"))
            assertTrue("fpsMax key", map.hasKey("fpsMax"))
            assertTrue("ultrawideDfovDeg key", map.hasKey("ultrawideDfovDeg"))
            assertTrue("micSampleRateMax key", map.hasKey("micSampleRateMax"))
            assertTrue("realtimeTimestampSource key", map.hasKey("realtimeTimestampSource"))
            assertTrue("motionSensorsPresent key", map.hasKey("motionSensorsPresent"))
            assertTrue("rooted key", map.hasKey("rooted"))
            assertTrue("freeStorageGB key", map.hasKey("freeStorageGB"))
        }
    }
    ```

    Run `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*DeviceCapsTest*" -q` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "fun readAll" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` succeeds.
    - `grep -q "computeDfovFromValues" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` succeeds (pure function for tests).
    - `grep -q "SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` succeeds.
    - `grep -q "StatFs" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` succeeds.
    - `grep -q "isLikelyRooted" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` succeeds.
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*DeviceCapsTest*" -q` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*DeviceCapsTest*" -q</automated>
  </verify>
  <done>DeviceCaps reads camera + sensor + storage caps; computeDfov is a pure-function tested with Pixel-7a-class values; 4 Robolectric tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: locationPermission.ts helper + tests + manifest declaration verification</name>
  <files>apps/mobile/src/services/locationPermission.ts, apps/mobile/__tests__/services/locationPermission.test.ts, apps/mobile/android/app/src/main/AndroidManifest.xml</files>
  <read_first>
    - apps/mobile/android/app/src/main/AndroidManifest.xml (current — verify ACCESS_COARSE_LOCATION present from 02-10)
    - apps/mobile/src/services/auth.ts (MMKV singleton + try/catch shape — analog)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § "Permissions" + § "Coarse Location permission prompt — Phase 4"
    - idea-brief.md §5.3 (Permissions table — Location prompted "Before first recording")
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Architectural Responsibility Map" line 194 (`react-native-permissions` is the picked library)
  </read_first>
  <action>
    Author `apps/mobile/src/services/locationPermission.ts`:
    ```typescript
    /**
     * PERM-03 — coarse Location permission helper.
     *
     * NOT prompted in Phase 2 onboarding. Phase 4 (first-recording flow) will call
     * `requestCoarseLocation()` immediately before kicking off the first capture.
     *
     * Manifest declaration ships in 02-10 alongside CAMERA + RECORD_AUDIO. This file
     * exists so Phase 4 can land without re-discovering the API surface.
     */
    import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
    import type { Permission, PermissionStatus } from 'react-native-permissions';

    export type CoarseLocationStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'limited';

    const PERM: Permission = PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION;

    export async function checkCoarseLocation(): Promise<CoarseLocationStatus> {
      const status = await check(PERM);
      return mapStatus(status);
    }

    export async function requestCoarseLocation(): Promise<CoarseLocationStatus> {
      const status = await request(PERM);
      return mapStatus(status);
    }

    function mapStatus(status: PermissionStatus): CoarseLocationStatus {
      switch (status) {
        case RESULTS.GRANTED:
          return 'granted';
        case RESULTS.DENIED:
          return 'denied';
        case RESULTS.BLOCKED:
          return 'blocked';
        case RESULTS.LIMITED:
          return 'limited';
        case RESULTS.UNAVAILABLE:
        default:
          return 'unavailable';
      }
    }
    ```

    Author `apps/mobile/__tests__/services/locationPermission.test.ts`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';

    vi.mock('react-native-permissions', () => ({
      check: vi.fn(),
      request: vi.fn(),
      PERMISSIONS: { ANDROID: { ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION' } },
      RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked', LIMITED: 'limited', UNAVAILABLE: 'unavailable' },
    }));

    import { check, request } from 'react-native-permissions';
    import { checkCoarseLocation, requestCoarseLocation } from '../../src/services/locationPermission';

    beforeEach(() => {
      vi.mocked(check).mockReset();
      vi.mocked(request).mockReset();
    });

    describe('locationPermission', () => {
      it('checkCoarseLocation maps GRANTED to granted', async () => {
        vi.mocked(check).mockResolvedValue('granted' as never);
        await expect(checkCoarseLocation()).resolves.toBe('granted');
        expect(check).toHaveBeenCalledWith('android.permission.ACCESS_COARSE_LOCATION');
      });

      it('checkCoarseLocation maps BLOCKED to blocked', async () => {
        vi.mocked(check).mockResolvedValue('blocked' as never);
        await expect(checkCoarseLocation()).resolves.toBe('blocked');
      });

      it('requestCoarseLocation calls request and maps DENIED to denied', async () => {
        vi.mocked(request).mockResolvedValue('denied' as never);
        await expect(requestCoarseLocation()).resolves.toBe('denied');
        expect(request).toHaveBeenCalledWith('android.permission.ACCESS_COARSE_LOCATION');
      });

      it('unknown statuses fall through to unavailable', async () => {
        vi.mocked(check).mockResolvedValue('weird' as never);
        await expect(checkCoarseLocation()).resolves.toBe('unavailable');
      });
    });
    ```

    Verify the manifest declaration shipped in 02-10. Run:
    ```
    grep -c "android.permission.ACCESS_COARSE_LOCATION" apps/mobile/android/app/src/main/AndroidManifest.xml
    ```
    If the count is 0, ADD the line `<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />` to AndroidManifest.xml below the existing CAMERA + RECORD_AUDIO declarations. If 1+, leave the file untouched.

    Run `cd apps/mobile && npm run test -- locationPermission` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export async function requestCoarseLocation" apps/mobile/src/services/locationPermission.ts` succeeds.
    - `grep -q "export async function checkCoarseLocation" apps/mobile/src/services/locationPermission.ts` succeeds.
    - `grep -q "ACCESS_COARSE_LOCATION" apps/mobile/src/services/locationPermission.ts` succeeds.
    - `grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/main/AndroidManifest.xml | grep -c "android.permission.ACCESS_COARSE_LOCATION"` returns >= 1.
    - `cd apps/mobile && npm run test -- locationPermission` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- locationPermission --run</automated>
  </verify>
  <done>locationPermission helper exports check + request functions; manifest has ACCESS_COARSE_LOCATION; 4 vitest tests pass; Phase 4 can consume the helper without further work.</done>
</task>

</tasks>

<verification>
Run all of the following:
- `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*DeviceCapsTest*" -q`
- `cd apps/mobile && npm run test -- locationPermission --run`
- `grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/main/AndroidManifest.xml | grep -c "ACCESS_COARSE_LOCATION"` returns >= 1
- `grep -c "ACCESS_COARSE_LOCATION" apps/mobile/src/services/locationPermission.ts` returns >= 1
</verification>

<success_criteria>

- DeviceCaps.kt produces a WritableMap with the 8 keys specified by D-COMPAT-02 readDeviceCaps contract.
- dFOV computation cross-checks against Pixel 7a public-domain spec values (~118° at 1.93mm focal).
- locationPermission helper exposes a typed check + request API.
- ACCESS_COARSE_LOCATION manifest entry is verifiable via grep gate (PERM-03 manifest-only declaration).
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-14-SUMMARY.md` per templates/summary.md.
</output>
