package ai.humynlabs.capture.handdetector

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers HumynHandDetectorModule with the React Native bridge. Added to the
 * package list in MainApplication.getPackages() unconditionally. The JS-side
 * `isHandDetectorAvailable()` discriminant in
 * `apps/mobile/src/native/HumynHandDetector.ts` (HAND-08) means callers
 * silently bypass the hand gate if this package somehow isn't registered —
 * no dead poll loop. Mirrors the structure of HumynUpdaterPackage /
 * HumynCapturePackage to keep the registration story consistent.
 */
class HumynHandDetectorPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynHandDetectorModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
