package ai.humynlabs.capture.livepreview

import android.util.Log
import android.view.Surface

/**
 * Singleton Surface slot for the live-cam preview (Phase 7 plan 07-07; D-25).
 *
 * Published by [HumynLivePreviewView.onSurfaceTextureAvailable] and read by
 * `CaptureSession.kt::openCaptureSession` at session-config time. Camera2's
 * second output target during the 15-s initial preview window AND the 10-s
 * tap-revealed window (Option B: two-Surface CaptureSession per 07-RESEARCH §
 * "Surface-Source A/B"); the encoder's `inputSurface` is ALWAYS the first
 * target — drift telemetry (`imu_video_drift_{max,mean,p99}_ms` per CLAUDE.md
 * "±1 ms drift gate relaxed" banner) and the post-encode capture-quality
 * cancel gates (`fps_dropped` / `resolution_dropped` / `insufficient_frames`
 * per CLAUDE.md "Capture-quality cancel gate added" banner; REC-LIVE-07
 * invariant) MUST NOT regress.
 *
 * Lifetime: a Surface is alive only while the RN view is mounted. When
 * RecordingScreen unmounts (or transitions out of the
 * 'initial-preview'/'tap-revealed' brightness substates), the SurfaceTexture
 * is destroyed and we clear the slot. CaptureSession.kt MUST defend against
 * a null `currentSurface()` (treat the absence as "preview disabled —
 * encoder-only", which collapses behaviour to the pre-Phase-7 single-target
 * session).
 *
 * NOT a camera client: unlike [ai.humynlabs.capture.gatecamera.GateCameraController]
 * (which opens its own Camera2 device), this registry only holds the Surface
 * that the existing `HumynCapture` Camera2 session writes into. Per D-25,
 * `<HumynLivePreviewView>` is single-purpose: it publishes its TextureView's
 * SurfaceTexture and nothing else. No `CameraManager.openCamera`, no second
 * Camera2 client, no contention for the one back-camera slot.
 *
 * Threading: writes happen on the RN UI thread (TextureView callbacks); the
 * read happens on the CaptureSession's `cameraCbHandler` thread at session
 * config + on the JS-driven `onAddTarget`/`onRemoveTarget` callbacks. `slot`
 * is `@Volatile` for cross-thread visibility (no lock needed because the slot
 * is a single reference — the write either lands or it doesn't, no
 * partially-published Surface).
 *
 * Defense-in-depth (T-07-07-04): [onSurfaceDestroyed] checks `slot === s`
 * before clearing to avoid clearing a NEWER slot if a fresh view re-mounted
 * between the old view's `onDropViewInstance` ViewManager callback and its
 * delayed `onSurfaceTextureDestroyed` TextureView callback.
 */
object LivePreviewSurfaceRegistry {
    private const val TAG = "LivePreviewSurfaceRegistry"

    @Volatile private var slot: Surface? = null

    /**
     * Callbacks invoked by JS-side bridging when the RecordingScreen brightness
     * state machine transitions into a state where the preview SHOULD render
     * (`onAddTarget`) or AWAY from such a state (`onRemoveTarget`). Wired by
     * `CaptureSession.openCaptureSession` so the running `CaptureRequest` can
     * attach/detach the preview Surface without a full session reconfigure
     * (Option B; mid-record reconfigure is Option C — REJECTED per plan A/B).
     *
     * `@Volatile` because the CaptureSession sets these from its `onConfigured`
     * thread and JS bridge-side calls (post-Phase-7 plan) may invoke them from
     * another. Best-effort — null when no listener attached or after session
     * close.
     */
    @Volatile var onAddTarget: (() -> Unit)? = null
    @Volatile var onRemoveTarget: (() -> Unit)? = null

    /** Publish the new preview Surface. Called from TextureView.onSurfaceTextureAvailable. */
    fun onSurfaceAvailable(s: Surface) {
        // Phase 7 plan 07-10 (G-11 debug) — instrument the Surface lifecycle so
        // the operator's logcat capture can disambiguate H1 (race-on-config —
        // CaptureSession opened BEFORE this fired so the slot was null at
        // session-config time) from H2 (this never fires — TextureView listener
        // not installed or view hidden) from H3 (lifetime mismatch — fires
        // shortly followed by onSurfaceDestroyed mid-recording). See
        // .planning/debug/07-live-preview-broken-pipe.md.
        Log.i(
            TAG,
            "onSurfaceAvailable surface=${System.identityHashCode(s)} prevSlot=${slot?.let { System.identityHashCode(it) }}",
        )
        slot = s
    }

    /**
     * Clear the slot iff `s` matches the currently-published Surface (or `s`
     * is null, the "force-clear" path used by `HumynLivePreviewViewManager.
     * onDropViewInstance` as a defensive belt-and-braces in case the platform
     * drops the view without firing the SurfaceTexture callback).
     */
    fun onSurfaceDestroyed(s: Surface?) {
        // Phase 7 plan 07-10 instrumentation (see onSurfaceAvailable). If the
        // logcat shows onSurfaceDestroyed firing seconds after onSurfaceAvailable
        // mid-recording, that is H3 (lifetime mismatch — `Broken pipe(-32)`
        // explained).
        Log.i(
            TAG,
            "onSurfaceDestroyed s=${s?.let { System.identityHashCode(it) }} slot=${slot?.let { System.identityHashCode(it) }}",
        )
        if (s == null || slot === s) {
            slot = null
        }
    }

    /**
     * The currently-published Surface, or null when no `<HumynLivePreviewView>`
     * is mounted. CaptureSession reads this once at session-config time and
     * uses the result to decide between the single-target (encoder-only) and
     * two-target (encoder + preview) `createCaptureSession` paths.
     */
    fun currentSurface(): Surface? {
        // Phase 7 plan 07-10 instrumentation — only log when the slot is
        // non-null (this is called frequently by CaptureSession's config /
        // rebuild paths; gating on `cur != null` keeps the noise floor low
        // while still surfacing the "slot WAS available at this read" case
        // we care about). If the operator's logcat shows zero
        // `currentSurface (returning non-null)` lines while a recording is
        // running, that confirms H1 (CaptureSession.openCaptureSession read
        // a null slot — Option-B branch never fired this session).
        val cur = slot
        if (cur != null) {
            Log.i(TAG, "currentSurface (returning non-null) surface=${System.identityHashCode(cur)}")
        }
        return cur
    }
}
