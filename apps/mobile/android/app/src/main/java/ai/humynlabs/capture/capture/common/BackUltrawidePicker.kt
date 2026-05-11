package ai.humynlabs.capture.capture.common

import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build

/**
 * Phase 3 — extracted from `compat/DeviceCaps.kt::pickBackUltrawide`
 * per CONTEXT.md "Claude's Discretion" option (a). Phase 3's
 * `CaptureSession` (Plan 03-10) calls `BackUltrawidePicker.pick(mgr)`
 * to choose the same lens that Phase 2's compat probe verified.
 *
 * `compat/DeviceCaps.kt` keeps a thin delegate so the existing
 * `compat/DeviceCapsTest.kt` suite stays green unmodified — the
 * extraction is structural, no behavior change.
 *
 * Pitfall 5 + logical multi-camera handling:
 *   Modern multi-lens phones expose a single `LOGICAL_MULTI_CAMERA`
 *   per facing direction in `cameraIdList`; the individual physical
 *   lenses (main / ultrawide / telephoto) live behind
 *   `LOGICAL_MULTI_CAMERA.physicalIds`. Iterating only the public ID
 *   list reads the logical camera's DEFAULT physical (usually the
 *   main wide), missing the ultrawide entirely. The fix: flatten
 *   public IDs ∪ physical sub-IDs, then pick min-focal across the
 *   flattened set. Resolution, FPS and timestamp source must still
 *   come from the LOGICAL parent (the openable camera) since
 *   physical sub-cameras don't expose their own session config.
 */

/**
 * Result of ultrawide camera selection: the logical (openable) camera
 * ID for resolution / fps / timestamp queries, plus the
 * characteristics for the physical sub-camera whose intrinsics define
 * the ultrawide dFOV. On non-logical-multi-camera devices, both ID and
 * characteristics refer to the same camera.
 *
 * [physicalUltrawideId] is the Camera2 id STRING of that physical
 * sub-camera when the ultrawide lives inside a `LOGICAL_MULTI_CAMERA`
 * (e.g. Pixel 10a: openableId="0" / physicalUltrawideId="3"); it is
 * `null` when the openable camera IS the ultrawide (a non-logical
 * device, or a logical camera whose own default characteristics already
 * have the shortest focal). Callers that need to actually STREAM the
 * ultrawide (not just read its intrinsics) must, when this is non-null,
 * build their session via
 * `OutputConfiguration(surface).apply { setPhysicalCameraId(physicalUltrawideId) }`
 * + `CameraDevice.createCaptureSessionByOutputConfigurations(...)` — a
 * plain `createCaptureSession` on the openable id streams its DEFAULT
 * physical (usually the main wide), and on Pixel logical-back `minZoom`
 * is 1.0 so there is no sub-1.0 zoom that switches to the ultrawide.
 */
data class UltrawidePick(
    val openableId: String,
    val openableChars: CameraCharacteristics,
    val ultrawideChars: CameraCharacteristics,
    val physicalUltrawideId: String?,
)

object BackUltrawidePicker {

    /**
     * Pick the back ultrawide. Returns the openable (logical or sole)
     * camera ID paired with the characteristics of the specific
     * physical sub-camera that owns the shortest focal length — the
     * ultrawide. Pitfall 5 + logical multi-camera handling.
     *
     * Behavior is identical to the prior
     * `DeviceCaps.pickBackUltrawide` implementation (verbatim extract);
     * the existing compat test suite is the regression safety net.
     */
    fun pick(mgr: CameraManager): UltrawidePick? {
        // 1. Enumerate all back-facing top-level cameras (logical or sole).
        val backTopLevel = try {
            mgr.cameraIdList.mapNotNull { id ->
                val chars = try {
                    mgr.getCameraCharacteristics(id)
                } catch (_: Throwable) {
                    null
                }
                if (chars != null &&
                    chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
                ) {
                    id to chars
                } else {
                    null
                }
            }
        } catch (_: Throwable) {
            return null
        }
        if (backTopLevel.isEmpty()) return null

        // 2. For each top-level back camera, build the candidate set:
        //      candidate = (this top-level camera, its own characteristics)
        //    plus, if it's a LOGICAL_MULTI_CAMERA on API 28+, expand into
        //      (top-level camera, each physical sub-camera's characteristics).
        //    The top-level ID stays the OPENABLE handle; the per-physical
        //    chars drive the dFOV pick.
        data class Candidate(
            val openableId: String,
            val openableChars: CameraCharacteristics,
            val ultrawideChars: CameraCharacteristics,
            // null ⇒ the openable camera itself is the ultrawide candidate;
            // non-null ⇒ the ultrawide is this physical sub-camera of the
            // logical `openableId` parent, and STREAMING from it requires
            // `OutputConfiguration.setPhysicalCameraId(physicalUltrawideId)`.
            val physicalUltrawideId: String?,
            val minFocalMm: Float,
        )

        val candidates = mutableListOf<Candidate>()
        for ((topId, topChars) in backTopLevel) {
            // Always include the top-level itself as a fallback candidate.
            candidates += Candidate(
                openableId = topId,
                openableChars = topChars,
                ultrawideChars = topChars,
                physicalUltrawideId = null,
                minFocalMm = minFocal(topChars),
            )
            // Expand physical sub-cameras when supported (API 28+ + capability).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val physicalIds: Set<String> = try {
                    topChars.physicalCameraIds
                } catch (_: Throwable) {
                    emptySet()
                }
                for (physId in physicalIds) {
                    val physChars = try {
                        mgr.getCameraCharacteristics(physId)
                    } catch (_: Throwable) {
                        null
                    } ?: continue
                    candidates += Candidate(
                        openableId = topId, // open the LOGICAL parent, not the physical
                        openableChars = topChars,
                        ultrawideChars = physChars,
                        physicalUltrawideId = physId,
                        minFocalMm = minFocal(physChars),
                    )
                }
            }
        }

        // 3. Pick min-focal across the flattened candidate set.
        val best = candidates.minByOrNull { it.minFocalMm } ?: return null
        return UltrawidePick(
            openableId = best.openableId,
            openableChars = best.openableChars,
            ultrawideChars = best.ultrawideChars,
            physicalUltrawideId = best.physicalUltrawideId,
        )
    }

    /** Smallest focal length advertised by a camera, or Float.MAX_VALUE if unknown. */
    private fun minFocal(chars: CameraCharacteristics): Float {
        val focals = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
        return if (focals == null || focals.isEmpty()) Float.MAX_VALUE else focals.min()
    }
}
