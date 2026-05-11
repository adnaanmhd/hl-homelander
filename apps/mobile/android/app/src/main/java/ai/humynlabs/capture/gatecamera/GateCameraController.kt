package ai.humynlabs.capture.gatecamera

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureFailure
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.util.Size
import android.view.Surface
import ai.humynlabs.capture.capture.common.BackUltrawidePicker
import java.io.File

/**
 * The Camera2 engine behind the pre-record hand gate (debug session
 * handgate-never-passes, 2026-05-11). One process-wide singleton; RecordingScreen
 * drives it through [HumynGateCameraModule] (`startGate` / `captureFrame` /
 * `stopGate`) and renders [HumynGateCameraView] for the live preview.
 *
 * Why it exists / what it fixes (vs the old VisionCamera `<Camera>` gate):
 *   - **Ultrawide lens.** On a logical-multi-camera device the back ultrawide
 *     is a physical sub-camera not in the public `cameraIdList` (Pixel 10a: id
 *     "3"); VisionCamera can't open it, and `physicalDevices:[…]` is a no-op on
 *     Android. Here we open the back LOGICAL camera and drive
 *     `CONTROL_ZOOM_RATIO` down to `CONTROL_ZOOM_RATIO_RANGE`'s lower bound
 *     (0.556 on the Pixel 10a — verified via `dumpsys media.camera`), which the
 *     framework routes through the ultrawide. Same FOV the HumynCapture HEVC
 *     recording captures (CaptureSession.kt does the same zoom-ratio set).
 *   - **No AF hunting.** `CONTROL_AF_MODE_OFF` + fixed `LENS_FOCUS_DISTANCE`
 *     (0 dpt = infinity / hyperfocal-far; harmless no-op on a fixed-focus lens):
 *     a head-mounted egocentric rig must not refocus mid-frame, and the wide-lens
 *     AF-hunt was blurring gate frames so `detect()` flickered 0/1/2 and the
 *     5-consecutive-2-hand streak never completed.
 *
 * Threading: a single private `HandlerThread` owns ALL camera/session state, so
 * no locks are needed — every public entry point posts onto it. RN `Promise`
 * resolution from that thread is fine.
 *
 * Lifecycle invariant (one back-camera client at a time): RecordingScreen's
 * gate→record handoff `await`s [stop] (closes this session + device) BEFORE
 * `HumynCapture.start()` opens Camera2 for the HEVC pipeline — the same
 * SETTLE_MS dance the VisionCamera path used.
 */
object GateCameraController {

    private const val TAG = "GateCamera"

    /** Pick the gate-grab JPEG resolution from this band (downscaled to 320×240 by the detector). */
    private const val MIN_GRAB_W = 480
    private const val MAX_GRAB_W = 1600
    private val FALLBACK_GRAB_SIZE = Size(640, 480)

    private const val START_TIMEOUT_MS = 3000L
    private const val CAPTURE_TIMEOUT_MS = 2500L

    private enum class State { IDLE, STARTING, RUNNING, STOPPING }

    private val bgThread = HandlerThread("GateCamera-bg").apply { start() }
    private val bg = Handler(bgThread.looper)

    // --- all of the below is touched ONLY on `bg` --------------------------
    private var state: State = State.IDLE
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var previewSurface: Surface? = null

    private var pendingStart: ((Result<Unit>) -> Unit)? = null
    private var startTimeout: Runnable? = null
    private var pendingCapture: Pair<File, (Result<Unit>) -> Unit>? = null
    private var captureTimeout: Runnable? = null

    /** Ultrawide zoom ratio (CONTROL_ZOOM_RATIO_RANGE lower bound) when < 1.0 and API ≥ 30; else null. */
    private var zoomRatio: Float? = null
    /** SENSOR_ORIENTATION of the openable camera — stamped into the grab JPEG's EXIF. */
    private var sensorOrientation: Int = 0
    /** True iff the lens supports manual focus (minFocusDistance > 0) — then we pin LENS_FOCUS_DISTANCE. */
    private var supportsManualFocus: Boolean = false

    // === preview surface plumbing (called from the TextureView, on the UI thread) ===

    fun onPreviewSurfaceAvailable(surface: Surface) {
        bg.post {
            previewSurface = surface
            if (state == State.STARTING) maybeCreateSession()
        }
    }

    fun onPreviewSurfaceDestroyed(surface: Surface?) {
        bg.post {
            if (surface == null || previewSurface === surface) previewSurface = null
            // Don't tear the camera down here — `stop()` owns that. A repeating
            // request targeting a just-released surface errors harmlessly into
            // the session callback; `stop()` follows within a frame.
        }
    }

    // === public engine API (delegated to by HumynGateCameraModule) ===

    fun start(context: Context, callback: (Result<Unit>) -> Unit) {
        val appCtx = context.applicationContext
        bg.post {
            if (state != State.IDLE) {
                callback(Result.failure(IllegalStateException("gate_camera_busy")))
                return@post
            }
            state = State.STARTING
            pendingStart = callback
            try {
                val mgr = appCtx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val pick = BackUltrawidePicker.pick(mgr)
                    ?: throw IllegalStateException("no_back_ultrawide")
                val chars = pick.openableChars

                sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 0
                supportsManualFocus =
                    (chars.get(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE) ?: 0f) > 0f
                zoomRatio = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val range = chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                    val lower = range?.lower
                    if (lower != null && lower < 1.0f) lower else null
                } else {
                    null // CONTROL_ZOOM_RATIO is API 30+; older devices fall back to the wide lens (degraded).
                }
                if (zoomRatio == null) {
                    Log.w(TAG, "no sub-1.0 CONTROL_ZOOM_RATIO on ${pick.openableId}; gate runs on the default (wide) lens")
                }

                imageReader = ImageReader
                    .newInstance(grabW(chars), grabH(chars), ImageFormat.JPEG, 2)
                    .apply { setOnImageAvailableListener({ reader -> onGrabImage(reader) }, bg) }

                openCamera(mgr, pick.openableId)
            } catch (t: Throwable) {
                failStart(t)
            }
            // Watchdog: if nothing has driven us to RUNNING in time, bail.
            startTimeout = Runnable {
                if (state == State.STARTING) failStart(IllegalStateException("gate_start_timeout"))
            }.also { bg.postDelayed(it, START_TIMEOUT_MS) }
        }
    }

    fun captureFrame(outPath: String, callback: (Result<Unit>) -> Unit) {
        bg.post {
            if (state != State.RUNNING) {
                callback(Result.failure(IllegalStateException("gate_camera_not_running")))
                return@post
            }
            if (pendingCapture != null) {
                callback(Result.failure(IllegalStateException("gate_capture_in_flight")))
                return@post
            }
            val session = captureSession
            val reader = imageReader
            if (session == null || reader == null) {
                callback(Result.failure(IllegalStateException("gate_camera_not_ready")))
                return@post
            }
            pendingCapture = File(outPath) to callback
            try {
                val cam = cameraDevice ?: throw IllegalStateException("gate_camera_closed")
                val req = cam.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                    addTarget(reader.surface)
                    applyLensControls()
                    set(CaptureRequest.JPEG_ORIENTATION, sensorOrientation)
                    set(CaptureRequest.JPEG_QUALITY, 90.toByte())
                }
                session.capture(req.build(), object : CameraCaptureSession.CaptureCallback() {
                    override fun onCaptureFailed(s: CameraCaptureSession, r: CaptureRequest, f: CaptureFailure) {
                        finishCapture(Result.failure(IllegalStateException("gate_capture_failed:${f.reason}")))
                    }
                }, bg)
                captureTimeout = Runnable {
                    finishCapture(Result.failure(IllegalStateException("gate_capture_timeout")))
                }.also { bg.postDelayed(it, CAPTURE_TIMEOUT_MS) }
            } catch (t: Throwable) {
                finishCapture(Result.failure(t))
            }
        }
    }

    fun stop(callback: (Result<Unit>) -> Unit) {
        bg.post {
            // Idempotent — RecordingScreen calls stopGate() on the gate→record
            // handoff AND again on unmount.
            startTimeout?.let { bg.removeCallbacks(it) }; startTimeout = null
            captureTimeout?.let { bg.removeCallbacks(it) }; captureTimeout = null
            pendingStart?.invoke(Result.failure(IllegalStateException("gate_camera_stopped"))); pendingStart = null
            pendingCapture?.second?.invoke(Result.failure(IllegalStateException("gate_camera_stopped"))); pendingCapture = null
            try { captureSession?.close() } catch (_: Throwable) {}
            try { cameraDevice?.close() } catch (_: Throwable) {}
            try { imageReader?.close() } catch (_: Throwable) {}
            captureSession = null
            cameraDevice = null
            imageReader = null
            // previewSurface is owned by the TextureView — don't release it here.
            state = State.IDLE
            callback(Result.success(Unit))
        }
    }

    // === internals (all on `bg`) ===

    private fun openCamera(mgr: CameraManager, cameraId: String) {
        try {
            mgr.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    if (state == State.STARTING) maybeCreateSession() else { try { camera.close() } catch (_: Throwable) {} }
                }
                override fun onDisconnected(camera: CameraDevice) {
                    try { camera.close() } catch (_: Throwable) {}
                    if (cameraDevice === camera) cameraDevice = null
                    if (state == State.STARTING) failStart(IllegalStateException("gate_camera_disconnected"))
                }
                override fun onError(camera: CameraDevice, error: Int) {
                    try { camera.close() } catch (_: Throwable) {}
                    if (cameraDevice === camera) cameraDevice = null
                    if (state == State.STARTING) failStart(IllegalStateException("gate_camera_open_error:$error"))
                }
            }, bg)
        } catch (e: CameraAccessException) {
            failStart(e)
        } catch (e: SecurityException) {
            failStart(e) // CAMERA runtime permission missing — RecordingScreen ensures it, this is defense in depth.
        }
    }

    private fun maybeCreateSession() {
        val cam = cameraDevice ?: return
        val reader = imageReader ?: return
        val preview = previewSurface ?: return // wait for the TextureView; the start watchdog bails if it never comes.
        if (state != State.STARTING) return
        val targets = listOf(preview, reader.surface)
        try {
            @Suppress("DEPRECATION")
            cam.createCaptureSession(targets, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    try {
                        val req = cam.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                            addTarget(preview)
                            applyLensControls()
                        }
                        session.setRepeatingRequest(req.build(), null, bg)
                        state = State.RUNNING
                        startTimeout?.let { bg.removeCallbacks(it) }; startTimeout = null
                        pendingStart?.invoke(Result.success(Unit)); pendingStart = null
                    } catch (t: Throwable) {
                        failStart(t)
                    }
                }
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    failStart(IllegalStateException("gate_session_configure_failed"))
                }
            }, bg)
        } catch (t: Throwable) {
            failStart(t)
        }
    }

    /** AF off + fixed focus + ultrawide zoom + OIS off — shared by the preview & still requests. */
    private fun CaptureRequest.Builder.applyLensControls() {
        set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
        if (supportsManualFocus) set(CaptureRequest.LENS_FOCUS_DISTANCE, 0.0f) // 0 dpt = infinity / hyperfocal far.
        set(CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE, CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            zoomRatio?.let { set(CaptureRequest.CONTROL_ZOOM_RATIO, it) }
        }
    }

    private fun onGrabImage(reader: ImageReader) {
        val pending = pendingCapture
        var img: android.media.Image? = null
        try {
            img = reader.acquireLatestImage()
            if (img == null) return // spurious — wait for the real one (or the timeout).
            if (pending == null) return // not ours / already finished — just drain.
            val buf = img.planes[0].buffer
            val bytes = ByteArray(buf.remaining()).also { buf.get(it) }
            pending.first.parentFile?.mkdirs()
            pending.first.writeBytes(bytes)
            finishCapture(Result.success(Unit))
        } catch (t: Throwable) {
            finishCapture(Result.failure(t))
        } finally {
            try { img?.close() } catch (_: Throwable) {}
        }
    }

    private fun finishCapture(result: Result<Unit>) {
        captureTimeout?.let { bg.removeCallbacks(it) }; captureTimeout = null
        val cb = pendingCapture?.second
        pendingCapture = null
        cb?.invoke(result)
    }

    private fun failStart(t: Throwable) {
        startTimeout?.let { bg.removeCallbacks(it) }; startTimeout = null
        Log.w(TAG, "gate camera start failed", t)
        try { captureSession?.close() } catch (_: Throwable) {}
        try { cameraDevice?.close() } catch (_: Throwable) {}
        try { imageReader?.close() } catch (_: Throwable) {}
        captureSession = null
        cameraDevice = null
        imageReader = null
        state = State.IDLE
        pendingStart?.invoke(Result.failure(t)); pendingStart = null
    }

    private fun grabW(chars: CameraCharacteristics): Int = grabSize(chars).width
    private fun grabH(chars: CameraCharacteristics): Int = grabSize(chars).height

    private var cachedGrabSize: Size? = null
    private fun grabSize(chars: CameraCharacteristics): Size {
        cachedGrabSize?.let { return it }
        val sizes = try {
            chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?.getOutputSizes(ImageFormat.JPEG)
        } catch (_: Throwable) { null }
        val picked = sizes
            ?.filter { it.width in MIN_GRAB_W..MAX_GRAB_W }
            ?.minByOrNull { it.width.toLong() * it.height }
            ?: sizes?.minByOrNull { it.width.toLong() * it.height }
            ?: FALLBACK_GRAB_SIZE
        cachedGrabSize = picked
        return picked
    }
}
