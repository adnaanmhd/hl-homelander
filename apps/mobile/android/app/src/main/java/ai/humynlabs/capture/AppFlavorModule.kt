package ai.humynlabs.capture

import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.security.MessageDigest

/**
 * Exposes the compile-time flavor identity (BuildConfig.FLAVOR_NAME +
 * BuildConfig.APPLICATION_ID + BuildConfig.VERSION_NAME + BuildConfig.VERSION_CODE
 * + Build.MODEL) to JavaScript so the RN side knows whether it's running inside
 * the apkRollout or playStore APK and can render the version footer (PROF-05)
 * + compute the compat signature (D-COMPAT-03) without an extra bridge round-trip.
 *
 * Also mints + persists the per-install UUID (`installation_id`) in a small
 * Kotlin SharedPreferences (`humyn_install`) so a JS-side MMKV wipe doesn't
 * lose the canonical identifier — see CONTEXT.md D-COMPAT-03 + RESEARCH Open
 * Question 3 resolution. The MMKV-side mirror at `installation_id.v1` is purely
 * a sync-read cache for compat-signature computation.
 *
 * The constants are exposed via getConstants() — sync access on the JS side
 * without a Promise round-trip; .get() also exists for future async consumers,
 * and getOrMintInstallationId() returns the per-install UUID via a Promise.
 */
@ReactModule(name = AppFlavorModule.NAME)
class AppFlavorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AppFlavor"
        // SharedPreferences-side store for the per-install UUID. Independent of
        // the JS-side MMKV instance so a wiped JS-side state can't lose it.
        private const val PREFS_NAME = "humyn_install"
        private const val PREF_INSTALLATION_ID = "installation_id"
    }

    override fun getName(): String = NAME

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "flavor" to BuildConfig.FLAVOR_NAME,
            "applicationId" to BuildConfig.APPLICATION_ID,
            // Phase 2 additions — feed PROF-05 footer + D-COMPAT-03 signature.
            "versionName" to BuildConfig.VERSION_NAME,
            "versionCode" to BuildConfig.VERSION_CODE,
            "deviceModel" to Build.MODEL,
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

    /**
     * Mint-or-read the per-install UUID. Persists to SharedPreferences
     * `humyn_install` so subsequent calls return the same value across JS-side
     * MMKV resets. UUID v4 (java.util.UUID.randomUUID()) — 122 random bits;
     * collision probability is negligible at our scale.
     *
     * D-COMPAT-03 requires this to be available BEFORE the first compat run
     * because the compat signature includes it.
     */
    @ReactMethod
    fun getOrMintInstallationId(promise: Promise) {
        try {
            val prefs = reactApplicationContext
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existing = prefs.getString(PREF_INSTALLATION_ID, null)
            if (existing != null) {
                promise.resolve(existing)
                return
            }
            val minted = java.util.UUID.randomUUID().toString()
            prefs.edit().putString(PREF_INSTALLATION_ID, minted).apply()
            promise.resolve(minted)
        } catch (t: Throwable) {
            promise.reject("INSTALL_ID_ERROR", "${t::class.simpleName}: ${t.message}", t)
        }
    }

    /**
     * Synchronous SHA-256 of `input`, returning the first 16 hex characters
     * (8 bytes / 64 bits) lowercase. Backs `compatService.computeSignature`
     * (D-COMPAT-03) — the compat signature is sha256(versionCode | deviceModel
     * | installationId)[:16] and must be computable synchronously inside the
     * gate-decision tree at boot, so it cannot go through a Promise.
     *
     * Uses `isBlockingSynchronousMethod = true` so the JS side reads the
     * value as a plain function call (`NativeModules.AppFlavor.sha256First16Hex(s)`)
     * with no bridge round-trip. The hash itself is on a hot path (boot →
     * computeInitialRoute) but bounded to a small input string (~64 chars),
     * so the synchronous block is negligible.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun sha256First16Hex(input: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val digest = md.digest(input.toByteArray(Charsets.UTF_8))
        val sb = StringBuilder(16)
        for (i in 0 until 8) {
            sb.append(String.format("%02x", digest[i]))
        }
        return sb.toString()
    }
}
