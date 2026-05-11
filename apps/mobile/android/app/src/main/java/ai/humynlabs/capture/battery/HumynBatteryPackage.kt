package ai.humynlabs.capture.battery

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynBatteryModule with the React Native bridge. Added to the
 * package list in MainApplication.getPackages() unconditionally. Mirrors the
 * structure of HumynUpdaterPackage / HumynCapturePackage.
 */
class HumynBatteryPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynBatteryModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
