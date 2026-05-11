package ai.humynlabs.capture.beep

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynBeepModule with the React Native bridge. Added to the package
 * list in MainApplication.getPackages() unconditionally. Mirrors the structure
 * of HumynUpdaterPackage / HumynCapturePackage.
 */
class HumynBeepPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynBeepModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
