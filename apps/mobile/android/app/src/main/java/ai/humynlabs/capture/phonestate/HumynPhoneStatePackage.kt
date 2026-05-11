package ai.humynlabs.capture.phonestate

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynPhoneStateModule with the React Native bridge. Added to the
 * package list in MainApplication.getPackages() unconditionally. Mirrors the
 * structure of HumynUpdaterPackage / HumynCapturePackage.
 */
class HumynPhoneStatePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynPhoneStateModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
