package ai.humynlabs.capture

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Exposes the compile-time flavor identity (BuildConfig.FLAVOR_NAME +
 * BuildConfig.APPLICATION_ID) to JavaScript so the RN side knows whether it's
 * running inside the apkRollout or playStore APK. Wire-side identity used by
 * /auth/google's server-side allowlist (plan 05).
 *
 * The values are exposed as constants via getConstants() — sync access on the
 * JS side without a Promise round-trip; .get() also exists for future async
 * consumers.
 */
@ReactModule(name = AppFlavorModule.NAME)
class AppFlavorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AppFlavor"
    }

    override fun getName(): String = NAME

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "flavor" to BuildConfig.FLAVOR_NAME,
            "applicationId" to BuildConfig.APPLICATION_ID,
        )
    }

    @ReactMethod
    fun get(promise: Promise) {
        promise.resolve(
            hashMapOf(
                "flavor" to BuildConfig.FLAVOR_NAME,
                "applicationId" to BuildConfig.APPLICATION_ID,
            ),
        )
    }
}
