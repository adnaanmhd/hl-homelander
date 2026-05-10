package ai.humynlabs.capture.capture

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers [HumynCaptureModule] with the React Native bridge. Added to the
 * package list in `MainApplication.getPackages()` so JS sees
 * `NativeModules.HumynCapture` at runtime.
 *
 * Mirrors the structure of `HumynCompatPackage` (Phase 2) verbatim — the
 * registration story is identical across Phase 2 and Phase 3 modules.
 */
class HumynCapturePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynCaptureModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
