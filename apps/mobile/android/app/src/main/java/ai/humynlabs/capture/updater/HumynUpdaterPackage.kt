package ai.humynlabs.capture.updater

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynUpdaterModule with the React Native bridge. Added to the
 * package list in MainApplication.getPackages() unconditionally — the JS-side
 * flavor guard in `apps/mobile/src/native/HumynUpdater.ts` ensures only
 * apkRollout builds actually invoke the methods. The native code is harmless
 * to ship in playStore builds because `REQUEST_INSTALL_PACKAGES` is declared
 * only in the apkRollout source set and `canRequestPackageInstalls()` will
 * always return false on the playStore flavor.
 *
 * Mirrors the structure of HumynCompatPackage / AppFlavorPackage to keep
 * the registration story consistent across modules.
 */
class HumynUpdaterPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynUpdaterModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
