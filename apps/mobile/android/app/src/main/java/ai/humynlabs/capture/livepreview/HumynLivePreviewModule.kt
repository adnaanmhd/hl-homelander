package ai.humynlabs.capture.livepreview

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Minimal native module backing `<HumynLivePreviewView>` (Phase 7 plan 07-07;
 * D-25). Per the plan's "minimal per D-25" directive, this module does NOT
 * open a camera, does NOT manage a Camera2 session, does NOT mediate frames
 * — those responsibilities belong to the existing HumynCapture pipeline,
 * which writes into the Surface that [LivePreviewSurfaceRegistry] publishes.
 *
 * The only JS-visible method is [isAvailable], a discriminant the JS bridge
 * uses to decide whether the native package is registered AND whether a
 * Surface is currently published. Useful for the RecordingScreen "no preview"
 * silent bypass (mirror of HAND-08 — when the live-preview is unavailable
 * for any reason, the recording proceeds dimmed-only with no crash).
 */
@ReactModule(name = HumynLivePreviewModule.NAME)
class HumynLivePreviewModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynLivePreview"
    }

    override fun getName(): String = NAME

    /**
     * JS discriminant — resolves `true` iff a Surface is currently published
     * to [LivePreviewSurfaceRegistry] by an attached `<HumynLivePreviewView>`.
     * Note this is a stricter check than "is the module registered" (the
     * latter is `NativeModules.HumynLivePreview != null` on the JS side); a
     * `true` resolution implies the view is mounted AND its SurfaceTexture
     * has fired its `available` callback.
     */
    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(LivePreviewSurfaceRegistry.currentSurface() != null)
    }
}
