package ai.humynlabs.capture

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Bug 3 / D3 — registers [HumynLocationModule] (precise GPS acquisition) with
 * the React Native bridge. Added to the package list in
 * MainApplication.getPackages(). Mirrors [AppFlavorPackage].
 */
class HumynLocationPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynLocationModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
