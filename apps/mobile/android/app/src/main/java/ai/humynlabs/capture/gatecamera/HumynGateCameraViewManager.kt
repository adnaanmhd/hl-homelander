package ai.humynlabs.capture.gatecamera

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * Registers [HumynGateCameraView] with the RN view registry under the name
 * `HumynGateCameraView` — JS mounts it via `requireNativeComponent`. Legacy
 * (Paper-style) ViewManager; works on the New Architecture through RN's
 * automatic legacy-interop layer, same as the autolinked third-party
 * ViewManagers in this app.
 *
 * No props: the view publishes its SurfaceTexture to the [HumynGateCamera]
 * module the instant it's available; the JS side drives the camera lifecycle
 * via `HumynGateCamera.startGate()` / `captureFrame()` / `stopGate()`.
 */
class HumynGateCameraViewManager : SimpleViewManager<HumynGateCameraView>() {

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): HumynGateCameraView =
        HumynGateCameraView(reactContext)

    /**
     * No-op prop. The view genuinely has no settable props (its lifecycle is
     * driven entirely by the `HumynGateCamera` module — `startGate()` /
     * `captureFrame()` / `stopGate()`), but a `ViewManager` with zero
     * `@ReactProp`-annotated setters makes RN's `ViewManagersPropertyCache`
     * log `ViewManagerPropertyUpdater: Could not find generated setter for
     * class HumynGateCameraViewManager` on every `<HumynGateCameraView>`
     * mount (it looks for a codegen'd `$$PropsSetter` class, then for any
     * `@ReactProp` method, finds neither, and warns). Declaring one harmless
     * setter silences that benign warning (Phase-4 04-COSMETIC-GAPS). Keep
     * the name out of RN's reserved layout/style prop set.
     */
    @Suppress("UNUSED_PARAMETER")
    @ReactProp(name = "gateActive", defaultBoolean = false)
    fun setGateActive(view: HumynGateCameraView, active: Boolean) {
        // intentionally empty — camera lifecycle is module-driven, not prop-driven
    }

    override fun onDropViewInstance(view: HumynGateCameraView) {
        // The TextureView's onSurfaceTextureDestroyed already detaches the
        // preview surface from the camera; nothing extra to do here. (Defensive
        // belt-and-braces in case the platform drops the view without firing
        // the SurfaceTexture callback.)
        GateCameraController.onPreviewSurfaceDestroyed(null)
        super.onDropViewInstance(view)
    }

    companion object {
        const val REACT_CLASS = "HumynGateCameraView"
    }
}
