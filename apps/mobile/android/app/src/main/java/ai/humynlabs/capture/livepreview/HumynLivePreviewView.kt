package ai.humynlabs.capture.livepreview

import android.content.Context
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.os.Build
import android.util.Log
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.view.WindowManager
import kotlin.math.max

/**
 * The live-cam preview surface during recording (Phase 7 plan 07-07; D-25).
 *
 * A [TextureView] whose [SurfaceTexture] is published to
 * [LivePreviewSurfaceRegistry] the moment it becomes available — `CaptureSession.kt`
 * reads the slot at session-config time and includes the Surface as the second
 * output target of `createCaptureSession` (Option B; the encoder's
 * `inputSurface` is the first target). NO Camera2 client of its own — unlike
 * `HumynGateCameraView` which opens a back-camera session for the pre-record
 * hand gate, this view ONLY exposes a Surface that the existing HumynCapture
 * Camera2 session renders into. One back-camera client at a time; the gate
 * camera is fully closed before HumynCapture.start (`stopGate()` + SETTLE_MS
 * dance, T-4.9-06), and during 'active' the live preview rides the recording
 * session's Surface — no separate `openCamera` call.
 *
 * Why a TextureView (not SurfaceView, not OpenGL):
 *   - composes inside RN's view tree so the corner "Live preview" label / Eye
 *     icon / Stop button RN views overlay it cleanly (no hole-punch),
 *   - lets us apply a [Matrix] transform — the camera writes preview frames
 *     in the sensor's native orientation (back camera SENSOR_ORIENTATION =
 *     90 on Pixel), so without a transform the feed shows up rotated 90° and
 *     stretched (verbatim transform copied from [HumynGateCameraView]
 *     because both surfaces draw the same ultrawide stream at the same
 *     landscape lock).
 *
 * Pinned preview-buffer size = 1280×720 (verbatim from HumynGateCameraView):
 * a SurfaceTexture output size virtually every back camera supports. The
 * recording stream itself is 1920×1080 HEVC on the encoder Surface — the
 * preview just needs to be big enough to look right on the screen.
 *
 * Lifetime: one preview alive at a time. RecordingScreen mounts a single
 * instance during the 'initial-preview' (15 s) AND 'tap-revealed' (rolling
 * 10 s) brightness substates of the 'active' recording state; unmounts
 * during 'dimmed'. So the registry slot toggles non-null ↔ null in lockstep
 * with the brightness state machine — Camera2 owns the cross-toggle via the
 * existing `setRepeatingRequest` rebuild driven by
 * [LivePreviewSurfaceRegistry.onAddTarget] / `onRemoveTarget`.
 */
class HumynLivePreviewView(context: Context) : TextureView(context), TextureView.SurfaceTextureListener {

    private var surface: Surface? = null

    /**
     * The size we pin the preview SurfaceTexture buffer to. 1280×720 is a
     * SurfaceTexture output size virtually every back camera supports; exact
     * preview resolution doesn't matter (the encoder Surface produces the
     * recorded 1920×1080 stream — REC-LIVE-07 invariant verified by
     * MetadataComposer's MediaExtractor track-header read at finalize).
     */
    private val previewSize = Size(1280, 720)

    init {
        // Phase 7 plan 07-10 (G-11 debug) — instrument the TextureView lifecycle.
        // System.identityHashCode lets us disambiguate two simultaneous mounts
        // (e.g. a stale view that hasn't fully dropped before a new one
        // re-mounts during a brightness-state-machine transition).
        Log.i(TAG, "<init> view=${System.identityHashCode(this)}")
        surfaceTextureListener = this
        // If the SurfaceTexture is already available (view re-attached), bind now.
        if (isAvailable) {
            surfaceTexture?.let { onSurfaceTextureAvailable(it, width, height) }
        }
    }

    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
        Log.i(
            TAG,
            "onSurfaceTextureAvailable view=${System.identityHashCode(this)} width=$width height=$height",
        )
        st.setDefaultBufferSize(previewSize.width, previewSize.height)
        configureTransform(width, height)
        val s = Surface(st)
        surface = s
        LivePreviewSurfaceRegistry.onSurfaceAvailable(s)
    }

    override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, width: Int, height: Int) {
        Log.i(
            TAG,
            "onSurfaceTextureSizeChanged view=${System.identityHashCode(this)} w=$width h=$height",
        )
        configureTransform(width, height)
    }

    override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
        // Phase 7 plan 07-10 — H3 (lifetime mismatch) prime evidence. If this
        // fires DURING an active recording (rather than at view unmount), the
        // consumer-side closed mid-stream and the `Broken pipe(-32)` HAL log
        // is explained.
        Log.i(
            TAG,
            "onSurfaceTextureDestroyed view=${System.identityHashCode(this)} surface=${surface?.let { System.identityHashCode(it) }}",
        )
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(surface)
        surface?.release()
        surface = null
        // Returning true ⇒ we (and Camera2) are done with the SurfaceTexture;
        // the platform may release it.
        return true
    }

    override fun onSurfaceTextureUpdated(st: SurfaceTexture) {
        // Frame rendered — nothing to do.
    }

    /**
     * Rotate the camera buffer to upright and center-crop-fill the view.
     * Verbatim copy of [HumynGateCameraView.configureTransform] — both
     * surfaces draw the same ultrawide stream at the same landscape lock, so
     * the transform is identical. Standard Camera2/TextureView transform
     * (assumes back-camera SENSOR_ORIENTATION = 90, which all phone back
     * cameras here have): when the display is rotated 90°/270° (the only
     * orientations a landscape-locked app sees) the buffer is sideways
     * relative to the view, so we map a width/height-swapped buffer rect onto
     * the view rect, scale it up to cover, and rotate by 90·(rotation−2).
     */
    private fun configureTransform(viewWidth: Int, viewHeight: Int) {
        Log.i(
            TAG,
            "configureTransform view=${System.identityHashCode(this)} viewWidth=$viewWidth viewHeight=$viewHeight",
        )
        if (viewWidth == 0 || viewHeight == 0) return
        val rotation = displayRotation()
        val matrix = Matrix()
        val viewRect = RectF(0f, 0f, viewWidth.toFloat(), viewHeight.toFloat())
        // Buffer rect in the orientation it lands in the SurfaceTexture (the
        // preview size, width/height swapped because the sensor is 90° rotated).
        val bufferRect = RectF(0f, 0f, previewSize.height.toFloat(), previewSize.width.toFloat())
        val cx = viewRect.centerX()
        val cy = viewRect.centerY()
        if (rotation == Surface.ROTATION_90 || rotation == Surface.ROTATION_270) {
            bufferRect.offset(cx - bufferRect.centerX(), cy - bufferRect.centerY())
            matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)
            val scale = max(
                viewHeight.toFloat() / previewSize.height,
                viewWidth.toFloat() / previewSize.width,
            )
            matrix.postScale(scale, scale, cx, cy)
            matrix.postRotate((90 * (rotation - 2)).toFloat(), cx, cy)
        } else if (rotation == Surface.ROTATION_180) {
            matrix.postRotate(180f, cx, cy)
        }
        setTransform(matrix)
    }

    private fun displayRotation(): Int = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation
        }
    } catch (_: Throwable) {
        Surface.ROTATION_0
    }

    companion object {
        // Phase 7 plan 07-10 — instrumentation tag. Filter on this in `adb
        // logcat -s HumynLivePreviewView:I` to isolate the TextureView lifecycle.
        private const val TAG = "HumynLivePreviewView"
    }
}
