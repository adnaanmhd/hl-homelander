package ai.humynlabs.capture.player

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the hand-rolled in-app HEVC player triad (Plan 06-06 / Phase 6
 * D-07): the [HumynPlayerModule] (5 promise methods + event-emitter stubs)
 * plus the [HumynPlayerViewManager] for the `HumynPlayerView` TextureView.
 * Added to `MainApplication.getPackages()` unconditionally.
 *
 * Mirrors [ai.humynlabs.capture.gatecamera.HumynGateCameraPackage] — both
 * register a module AND a ViewManager (the player's surface is a native view).
 */
class HumynPlayerPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynPlayerModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(HumynPlayerViewManager())
}
