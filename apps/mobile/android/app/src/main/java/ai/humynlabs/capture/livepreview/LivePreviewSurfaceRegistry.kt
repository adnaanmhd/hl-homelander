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

    /**
     * Publish the new preview Surface. Called from TextureView.onSurfaceTextureAvailable.
     *
     * Phase 7 plan 07-10 (H1 close): also invoke [onAddTarget] AFTER publishing
     * so the active CaptureSession can attach this Surface to its current
     * deferred OutputConfiguration + reissue the repeating request. This was
     * the missing piece — plan 07-07 wired the callback slot but no one ever
     * fired it (operator's logcat showed `onAddTarget fired` zero times on
     * §7 walks because nothing called the lambda; H1 race-on-config explained:
     * the slot read at config-time was null, so the lambda was never even
     * installed — see CaptureSession.openCaptureSession comments). The fix
     * registers the callback unconditionally at config time and drives it
     * from here.
     */
    fun onSurfaceAvailable(s: Surface) {
        Log.i(
            TAG,
            "onSurfaceAvailable surface=${System.identityHashCode(s)} prevSlot=${slot?.let { System.identityHashCode(it) }}",
        )
        slot = s
        // Phase 7 plan 07-10 — invoke the add-target callback so the
        // CaptureSession can attach the new Surface to its always-two-Surface
        // deferred OutputConfiguration. The callback closure on CaptureSession's
        // side reads currentSurface() (not a snapshot) so this invocation just
        // needs to happen AFTER the slot is set.
        try {
            onAddTarget?.invoke()
        } catch (t: Throwable) {
            // Best-effort — a failed attach here means the preview misses a
            // frame stream, but the encoder Surface (always target 1) is
            // unaffected. The recording continues; the visual affordance is a
            // preview view that doesn't paint until the next mount cycle.
            Log.w(TAG, "onAddTarget invocation threw — preview attach skipped", t)
        }
    }

    /**
     * Clear the slot iff `s` matches the currently-published Surface (or `s`
     * is null, the "force-clear" path used by `HumynLivePreviewViewManager.
     * onDropViewInstance` as a defensive belt-and-braces in case the platform
     * drops the view without firing the SurfaceTexture callback).
     *
     * Phase 7 plan 07-10: invoke [onRemoveTarget] BEFORE clearing the slot so
     * the CaptureSession can detach the Surface from its repeating request
     * before the consumer-side Surface is released by the TextureView. This
     * eliminates the `Broken pipe(-32)` HAL warning by ensuring the camera
     * driver stops writing to the Surface before the SurfaceTexture is gone.
     */
    fun onSurfaceDestroyed(s: Surface?) {
        Log.i(
            TAG,
            "onSurfaceDestroyed s=${s?.let { System.identityHashCode(it) }} slot=${slot?.let { System.identityHashCode(it) }}",
        )
        // The two callers of this method fire it in close succession during a
        // single brightness-state transition (per the §7 walk's logcat):
        //   1. TextureView's `onSurfaceTextureDestroyed(s)` — the real teardown.
        //   2. ViewManager's `onDropViewInstance` defensive force-clear with
        //      s=null — fires ~1 ms after (1) and finds the slot already null.
        // Without the `slot == null` guard, (2) would invoke `onRemoveTarget`
        // a second time after (1) already detached the Surface and reissued
        // the encoder-only repeating request. That second invocation would
        // do a redundant `removeSurface` of an already-null
        // `attachedPreviewSurface` + another encoder-only setRepeatingRequest
        // — wasted work, but more importantly a second
        // `updateOutputConfiguration` on a config whose surface set is
        // already empty (and the request is already addressing it correctly)
        // is the kind of redundant Camera2 traffic that has burned us before.
        // Guard: only fire the callback when there's something to detach.
        if ((s == null || slot === s) && slot != null) {
            // Invoke onRemoveTarget BEFORE clearing the slot so the
            // CaptureSession reissues a repeating request without this Surface
            // as a target while the camera driver still considers it
            // attached — that avoids the producer-vs-consumer race that
            // generates `Camera3-PreviewFrameSpacer queueBufferToClientLocked:
            // Failed to queue buffer to client: Broken pipe(-32)`.
            try {
                onRemoveTarget?.invoke()
            } catch (t: Throwable) {
                Log.w(TAG, "onRemoveTarget invocation threw — preview detach skipped", t)
            }
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
