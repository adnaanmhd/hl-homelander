package ai.humynlabs.capture.livepreview

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * Registers [HumynLivePreviewView] with the RN view registry under the name
 * `HumynLivePreviewView` — JS mounts it via `requireNativeComponent`. Legacy
 * (Paper-style) ViewManager; works on the New Architecture through RN's
 * automatic legacy-interop layer, same as the existing
 * [ai.humynlabs.capture.gatecamera.HumynGateCameraViewManager] and the
 * autolinked third-party ViewManagers in this app.
 *
 * No real props: the view publishes its SurfaceTexture to
 * [LivePreviewSurfaceRegistry] the instant it's available; the JS side drives
 * the RecordingScreen brightness state machine which mounts / unmounts the
 * view as the 'initial-preview' / 'tap-revealed' / 'dimmed' states transition
 * (Phase 7 plan 07-07; D-25).
 */
class HumynLivePreviewViewManager : SimpleViewManager<HumynLivePreviewView>() {

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): HumynLivePreviewView =
        HumynLivePreviewView(reactContext)

    /**
     * No-op prop. The view genuinely has no settable props (its lifecycle is
     * driven entirely by JS-side mount/unmount), but a `ViewManager` with
     * zero `@ReactProp`-annotated setters makes RN's `ViewManagersPropertyCache`
     * log `ViewManagerPropertyUpdater: Could not find generated setter for
     * class HumynLivePreviewViewManager` on every `<HumynLivePreviewView>`
     * mount (it looks for a codegen'd `$$PropsSetter` class, then for any
     * `@ReactProp` method, finds neither, and warns). Declaring one harmless
     * setter silences that benign warning (Phase-4 04-COSMETIC-GAPS — same
     * fix applied to HumynGateCameraViewManager). Keep the name out of RN's
     * reserved layout/style prop set.
     */
    @Suppress("UNUSED_PARAMETER")
    @ReactProp(name = "previewActive", defaultBoolean = false)
    fun setPreviewActive(view: HumynLivePreviewView, active: Boolean) {
        // intentionally empty — lifecycle is JS-driven via mount/unmount, not prop-driven
    }

    override fun onDropViewInstance(view: HumynLivePreviewView) {
        // The TextureView's onSurfaceTextureDestroyed already clears the
        // registry slot (with the `slot === s` guard); this is defensive
        // belt-and-braces in case the platform drops the view without
        // firing the SurfaceTexture callback. Passing `null` forces the
        // clear, matching the gate-camera pattern.
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)
        super.onDropViewInstance(view)
    }

    companion object {
        const val REACT_CLASS = "HumynLivePreviewView"
    }
}
