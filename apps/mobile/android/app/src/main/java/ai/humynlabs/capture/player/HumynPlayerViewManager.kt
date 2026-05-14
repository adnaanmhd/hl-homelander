package ai.humynlabs.capture.player

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * Registers [HumynPlayerView] with the RN view registry under the name
 * `HumynPlayerView` — JS mounts it via `requireNativeComponent` (Plan 06-06 /
 * Phase 6 D-07). Legacy (Paper-style) ViewManager; works on the New
 * Architecture through RN's automatic legacy-interop layer, same as the
 * sibling [ai.humynlabs.capture.gatecamera.HumynGateCameraViewManager].
 *
 * No real props: the view's lifecycle is driven entirely by the
 * [HumynPlayerModule] (`prepare()` / `play()` / `pause()` / `seekTo()` /
 * `release()`). The single no-op `@ReactProp` setter silences the benign
 * `ViewManagerPropertyUpdater: Could not find generated setter for class
 * HumynPlayerViewManager` log line that RN emits when a ViewManager has zero
 * `@ReactProp`-annotated methods (mirrors HumynGateCameraViewManager).
 */
class HumynPlayerViewManager : SimpleViewManager<HumynPlayerView>() {

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): HumynPlayerView =
        HumynPlayerView(reactContext)

    /**
     * No-op prop — exists solely to silence the
     * `ViewManagerPropertyUpdater: Could not find generated setter` warning.
     * Keep the name out of RN's reserved layout / style prop set.
     */
    @Suppress("UNUSED_PARAMETER")
    @ReactProp(name = "noOpPlaceholder", defaultBoolean = false)
    fun setNoOpPlaceholder(view: HumynPlayerView, value: Boolean) {
        // intentionally empty — player lifecycle is module-driven, not prop-driven
    }

    override fun onDropViewInstance(view: HumynPlayerView) {
        // The TextureView's onSurfaceTextureDestroyed already clears the player
        // surface; this is a defensive belt-and-braces in case the platform
        // drops the view without firing the SurfaceTexture callback.
        PlayerController.onSurfaceDestroyed()
        super.onDropViewInstance(view)
    }

    companion object {
        const val REACT_CLASS = "HumynPlayerView"
    }
}
