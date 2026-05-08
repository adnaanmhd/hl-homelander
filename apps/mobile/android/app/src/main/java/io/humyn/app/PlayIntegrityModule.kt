package io.humyn.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest

/**
 * Wraps Google Play IntegrityManager.requestIntegrityToken (Standard request,
 * per RESEARCH §2.3). The nonce is server-minted via /auth/nonce and passed in
 * from JS so this module never decides freshness or single-use semantics —
 * those live in the backend (apps/api/src/auth/nonce-store.ts).
 *
 * On success, resolves with the encrypted Play Integrity token (a string).
 * The backend decodes it via googleapis playintegrity v1 and runs
 * evaluateIntegrity() against the canonical 7-branch reject policy.
 *
 * Errors:
 * - PLAY_INTEGRITY_ERROR — IntegrityManager.requestIntegrityToken failed
 *   (e.g. emulator, integrity pre-check, network). Message contains the
 *   underlying cause string.
 * - PLAY_INTEGRITY_EXCEPTION — synchronous throw from IntegrityManagerFactory
 *   or IntegrityTokenRequest.builder() (rare; misconfigured app).
 */
@ReactModule(name = PlayIntegrityModule.NAME)
class PlayIntegrityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PlayIntegrity"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun requestIntegrityToken(nonce: String, promise: Promise) {
        try {
            val manager = IntegrityManagerFactory.create(reactApplicationContext)
            val request = IntegrityTokenRequest.builder().setNonce(nonce).build()
            manager.requestIntegrityToken(request)
                .addOnSuccessListener { response -> promise.resolve(response.token()) }
                .addOnFailureListener { e ->
                    promise.reject("PLAY_INTEGRITY_ERROR", e.message ?: "unknown", e)
                }
        } catch (e: Exception) {
            promise.reject("PLAY_INTEGRITY_EXCEPTION", e.message ?: "unknown", e)
        }
    }
}
