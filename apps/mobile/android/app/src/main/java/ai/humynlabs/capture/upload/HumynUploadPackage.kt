package ai.humynlabs.capture.upload

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers [HumynUploadModule] with the React Native bridge. Added to the
 * package list in `MainApplication.getPackages()` unconditionally. Mirrors the
 * structure of `HumynBatteryPackage` / `HumynUpdaterPackage` / `HumynCapturePackage`.
 */
class HumynUploadPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynUploadModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
