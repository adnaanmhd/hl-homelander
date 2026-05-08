package ai.humynlabs.capture

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import io.humyn.app.PlayIntegrityPackage

/**
 * RN 0.83 / Hermes / New Architecture Application entry point.
 * Auto-linked packages come from PackageList(this); the custom AppFlavorPackage
 * (plan 09) and PlayIntegrityPackage (plan 13) are appended so
 * NativeModules.AppFlavor and NativeModules.PlayIntegrity are reachable from JS.
 */
class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {
                val packages = PackageList(this).packages.toMutableList()
                packages.add(AppFlavorPackage())
                packages.add(PlayIntegrityPackage())  // Plan 13 — Phase 1 mobile sign-in scaffold
                return packages
            }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = true

            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)
        // Initialise the new-architecture entry point.
        load()
    }
}
