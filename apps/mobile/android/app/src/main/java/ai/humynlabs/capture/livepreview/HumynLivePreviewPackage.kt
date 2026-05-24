package ai.humynlabs.capture.livepreview

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the live-cam preview native module (Phase 7 plan 07-07; D-25):
 * the [HumynLivePreviewModule] (an `isAvailable()` discriminant only) plus
 * the [HumynLivePreviewViewManager] that owns the `<HumynLivePreviewView>`
 * TextureView. Added to `MainApplication.getPackages()` unconditionally.
 *
 * The view here is single-purpose (D-25 — mirrors the
 * HumynPlayer / HumynGateCamera / HumynCapture pattern of one native view
 * per responsibility): publish a Surface for `HumynCapture`'s Camera2 session
 * to draw into, nothing more. Unlike the gate-camera package, this one does
 * NOT open a camera — it carries no camera-lifecycle responsibility.
 */
class HumynLivePreviewPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynLivePreviewModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(HumynLivePreviewViewManager())
}
