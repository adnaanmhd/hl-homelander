package ai.humynlabs.capture.gatecamera

import android.content.Context
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.os.Build
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.view.WindowManager
import kotlin.math.max

/**
 * The live gate-camera preview surface (debug session handgate-never-passes,
 * 2026-05-11). A [TextureView] whose [SurfaceTexture] is published to
 * [GateCameraController] the moment it becomes available — the controller uses
 * it as the repeating-preview target of its Camera2 session.
 *
 * Why native + Camera2 (not VisionCamera): VisionCamera 4.7.3's `<Camera>` (a)
 * has no autofocus-mode control, so on a head-mounted rig it AF-hunts the wide
 * lens (intermittent blur → the 5-consecutive-2-hand gate streak can't
 * complete) and (b) cannot reach the back ultrawide on a logical-multi-camera
 * device (Pixel 10a: the ultrawide is physical sub-camera id "3", not in the
 * public `cameraIdList`). The Camera2 path fixes both — open the back logical
 * camera with `CONTROL_AF_MODE_OFF` + a fixed focus distance and drive
 * `CONTROL_ZOOM_RATIO` down to `CONTROL_ZOOM_RATIO_RANGE`'s lower bound (0.556
 * on the Pixel 10a), which routes the logical camera through the ultrawide.
 *
 * TextureView (not SurfaceView): composes inside RN's view tree so the
 * GateRing / prompt / Skip link RN views overlay it cleanly (no hole-punch),
 * AND lets us apply a [Matrix] transform — the camera writes preview frames in
 * the sensor's native orientation (back camera SENSOR_ORIENTATION = 90 on
 * Pixel), so without a transform the feed shows up rotated 90° and stretched.
 * [configureTransform] does the standard Camera2 "rotate to upright +
 * center-crop fill" matrix (Camera2Basic pattern), keyed off the display
 * rotation, with the preview buffer pinned to a fixed landscape size via
 * [SurfaceTexture.setDefaultBufferSize].
 *
 * There is at most ONE gate preview alive at a time (RecordingScreen mounts a
 * single instance only during the `gate` substate), so [GateCameraController]
 * keeps a single nullable preview-surface slot rather than a tag map.
 */
class HumynGateCameraView(context: Context) : TextureView(context), TextureView.SurfaceTextureListener {

    private var surface: Surface? = null

    /**
     * The size we pin the preview SurfaceTexture buffer to. 1280×720 is a
     * SurfaceTexture output size virtually every back camera supports; exact
     * preview resolution doesn't matter (the operator only needs it to aim —
     * the hand-detection grab is a separate higher-res ImageReader JPEG).
     */
    private val previewSize = Size(1280, 720)

    init {
        surfaceTextureListener = this
        // If the SurfaceTexture is already available (view re-attached), bind now.
        if (isAvailable) {
            surfaceTexture?.let { onSurfaceTextureAvailable(it, width, height) }
        }
    }

    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
        st.setDefaultBufferSize(previewSize.width, previewSize.height)
        configureTransform(width, height)
        val s = Surface(st)
        surface = s
        GateCameraController.onPreviewSurfaceAvailable(s)
    }

    override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, width: Int, height: Int) {
        configureTransform(width, height)
    }

    override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
        GateCameraController.onPreviewSurfaceDestroyed(surface)
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
     * Standard Camera2/TextureView transform (assumes back-camera
     * SENSOR_ORIENTATION = 90, which all phone back cameras here have): when the
     * display is rotated 90°/270° (the only orientations a landscape-locked app
     * sees) the buffer is sideways relative to the view, so we map a
     * width/height-swapped buffer rect onto the view rect, scale it up to cover,
     * and rotate by 90·(rotation−2).
     */
    private fun configureTransform(viewWidth: Int, viewHeight: Int) {
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
}
