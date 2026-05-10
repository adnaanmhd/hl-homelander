package io.humyn.app

import ai.humynlabs.capture.BuildConfig
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
 * `setCloudProjectNumber(...)` is REQUIRED for the Classic Play Integrity API
 * when the app's package is NOT registered in a Play Console app linked to a
 * GCP project. The apkRollout flavor (`ai.humynlabs.capture.apk`, D-FLAV-01 /
 * D-DIST-01) is intentionally never in Play Console — it is the sideload
 * distribution flavor that ships before Play Store. Without an explicit project
 * number the Integrity API has no project to attribute the request to and
 * fails with `-16 CLOUD_PROJECT_NUMBER_IS_INVALID`. The playStore flavor would
 * eventually be auto-attributed once published, but we set the number on every
 * flavor so the call site is uniform and Play-Console linkage state cannot
 * silently regress us. See per-flavor BuildConfig wiring in
 * `apps/mobile/android/app/build.gradle`.
 *
 * Pre-req (operator action): Play Integrity API must be ENABLED on the GCP
 * project at https://console.cloud.google.com/apis/library/playintegrity.googleapis.com .
 *
 * On success, resolves with the encrypted Play Integrity token (a string).
 * The backend decodes it via googleapis playintegrity v1 and runs
 * evaluateIntegrity() against the canonical 7-branch reject policy.
 *
 * Errors:
 * - PLAY_INTEGRITY_ERROR — IntegrityManager.requestIntegrityToken failed
 *   (e.g. emulator, integrity pre-check, network, or Play Integrity API not
 *   enabled on the configured GCP project). Message contains the underlying
 *   cause string (look for "-16" → cloud project number invalid / API not
 *   enabled; "-17" → cannot bind to service; "-15" → app not installed).
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
            val request = IntegrityTokenRequest.builder()
                .setNonce(nonce)
                .setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER)
                .build()
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
