package ai.humynlabs.capture.screenbrightness

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynScreenBrightnessModule with the React Native bridge. Added to
 * the package list in MainApplication.getPackages() unconditionally. Mirrors
 * the structure of HumynUpdaterPackage / HumynCapturePackage.
 */
class HumynScreenBrightnessPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynScreenBrightnessModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
