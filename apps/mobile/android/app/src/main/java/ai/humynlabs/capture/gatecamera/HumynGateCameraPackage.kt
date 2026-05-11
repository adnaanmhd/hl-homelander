package ai.humynlabs.capture.gatecamera

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the native Camera2 gate camera (debug session handgate-never-passes,
 * 2026-05-11): the `HumynGateCamera` module ([HumynGateCameraModule]) plus the
 * `HumynGateCameraView` ViewManager ([HumynGateCameraViewManager]) for the live
 * preview. Added to `MainApplication.getPackages()` unconditionally. Unlike the
 * other capture-side packages this one DOES return a ViewManager — the gate's
 * live preview is a native TextureView.
 */
class HumynGateCameraPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynGateCameraModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(HumynGateCameraViewManager())
}
