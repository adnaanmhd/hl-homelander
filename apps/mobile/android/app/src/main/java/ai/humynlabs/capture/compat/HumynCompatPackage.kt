package ai.humynlabs.capture.compat

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynCompatModule with the React Native bridge. Added to the
 * package list in MainApplication.getPackages() so JS sees
 * `NativeModules.HumynCompat` at runtime.
 *
 * Mirrors the structure of AppFlavorPackage / PlayIntegrityPackage to keep
 * the registration story consistent across Phase 1 and Phase 2 modules.
 */
class HumynCompatPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynCompatModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
