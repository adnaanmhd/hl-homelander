package ai.humynlabs.capture

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Bug 3 / D3 (2026-06-04) — precise GPS acquisition for the capture pipeline.
 *
 * **Overrides the formerly-LOCKED "no precise GPS leaves the device" constraint**
 * (owner sign-off `.planning/260604-locked-override-signoff.md` D3; the
 * consent-text + DPIA review is a SHIP gate, NOT a code gate). The JS side
 * resolves one fix at gate-pass and embeds it into `CaptureSessionOpts.location`
 * → metadata.json `capture_device_info.location` (schema 1.5.0) → the queryable
 * `recordings.location` jsonb column.
 *
 * `getCurrentFix(timeoutMs)` resolves a fix map
 * `{ lat, lng, accuracy_m, provider, captured_at, label }` (snake_case to match
 * the metadata.json + zod `LocationSchema` shape), or **null** when:
 *   - FINE ("Precise") is not granted (BUG-1 precise-only — a coarse-only
 *     "Approximate" grant resolves null here; defensive — the onboarding gate is
 *     the real guard; this never throws / never blocks capture),
 *   - `getCurrentLocation` + the last-known fallback both yield nothing,
 *   - the request times out (default 10 s).
 *
 * Single-fix only — NOT a continuous location stream. No JVM test (the
 * fused-provider path needs Google Play Services); verified by manual smoke per
 * the plan §Bug3 test matrix. Mirrors the [AppFlavorModule] RN-module pattern.
 */
@ReactModule(name = HumynLocationModule.NAME)
class HumynLocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynLocation"
        private const val DEFAULT_TIMEOUT_MS = 10_000L
        private const val MIN_TIMEOUT_MS = 1_000L
    }

    override fun getName(): String = NAME

    /**
     * Acquire a single precise fix. Resolves a fix map or `null` (never rejects
     * — an unavailable fix is a valid outcome the caller records as null).
     */
    @ReactMethod
    fun getCurrentFix(timeoutMs: Double, promise: Promise) {
        val ctx = reactApplicationContext
        if (!hasLocationPermission(ctx)) {
            // The onboarding PermissionsScreen gate is the real guard; resolve
            // null defensively so a permission edge never crashes a recording.
            promise.resolve(null)
            return
        }

        val budgetMs = timeoutMs.toLong().let {
            if (it <= 0L) DEFAULT_TIMEOUT_MS else it.coerceAtLeast(MIN_TIMEOUT_MS)
        }
        val client = LocationServices.getFusedLocationProviderClient(ctx)
        val cts = CancellationTokenSource()
        val settled = AtomicBoolean(false)
        val mainHandler = Handler(Looper.getMainLooper())

        val timeoutRunnable = Runnable {
            if (settled.compareAndSet(false, true)) {
                cts.cancel()
                promise.resolve(null)
            }
        }
        mainHandler.postDelayed(timeoutRunnable, budgetMs)

        // Resolve once with `loc` (off the main thread — the Geocoder reverse-
        // lookup can block), guarding against the timeout having already fired.
        fun finishWith(loc: Location, provider: String) {
            Thread {
                val map = buildFixMap(ctx, loc, provider)
                if (settled.compareAndSet(false, true)) {
                    mainHandler.removeCallbacks(timeoutRunnable)
                    promise.resolve(map)
                }
            }.start()
        }

        fun finishNull() {
            if (settled.compareAndSet(false, true)) {
                mainHandler.removeCallbacks(timeoutRunnable)
                promise.resolve(null)
            }
        }

        try {
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { loc ->
                    if (loc != null) {
                        finishWith(loc, "fused")
                    } else {
                        // No fresh fix — fall back to the last-known location.
                        try {
                            client.lastLocation
                                .addOnSuccessListener { last ->
                                    if (last != null) finishWith(last, "fused_last_known")
                                    else finishNull()
                                }
                                .addOnFailureListener { finishNull() }
                        } catch (_: SecurityException) {
                            finishNull()
                        }
                    }
                }
                .addOnFailureListener { finishNull() }
        } catch (_: SecurityException) {
            // Permission revoked between the check and the call — resolve null.
            finishNull()
        }
    }

    private fun hasLocationPermission(ctx: Context): Boolean {
        // BUG-1 (2026-06-09 — precise-only): require FINE ("Precise"). A coarse-only
        // ("Approximate") grant is INSUFFICIENT — getCurrentFix gates on this first,
        // so a coarse device resolves a null fix rather than embedding a coarse one.
        // (COARSE stays DECLARED in the manifest — Android 12+ needs both declared to
        // request FINE at all — it's just not accepted as a grant here.)
        val fine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED
    }

    private fun buildFixMap(ctx: Context, loc: Location, provider: String): WritableMap =
        Arguments.createMap().apply {
            putDouble("lat", loc.latitude)
            putDouble("lng", loc.longitude)
            // Horizontal accuracy radius (m). Lets the backend audit the precision
            // actually delivered by the fix (BUG-1: a coarse-only grant never
            // reaches here — hasLocationPermission gates on FINE first).
            putDouble("accuracy_m", if (loc.hasAccuracy()) loc.accuracy.toDouble() else -1.0)
            putString("provider", provider)
            putString("captured_at", isoFromEpochMs(loc.time))
            val label = reverseGeocodeLabel(ctx, loc.latitude, loc.longitude)
            if (label != null) putString("label", label) else putNull("label")
        }

    /** ISO-8601 with the device's local offset (e.g. `...+05:30`). */
    private fun isoFromEpochMs(epochMs: Long): String =
        Instant.ofEpochMilli(epochMs)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

    /**
     * Best-effort reverse-geocode to a human "City, Country" label. Returns null
     * on any failure (no Geocoder backend, offline, throttled) — the precise
     * lat/lng is the source of truth; the label is for History readability only.
     */
    private fun reverseGeocodeLabel(ctx: Context, lat: Double, lng: Double): String? {
        return try {
            if (!Geocoder.isPresent()) return null
            @Suppress("DEPRECATION")
            val addresses = Geocoder(ctx, Locale.US).getFromLocation(lat, lng, 1)
            val a = addresses?.firstOrNull() ?: return null
            val city = a.locality ?: a.subAdminArea ?: a.adminArea
            val country = a.countryName
            when {
                city != null && country != null -> "$city, $country"
                country != null -> country
                city != null -> city
                else -> null
            }
        } catch (_: Throwable) {
            null
        }
    }
}
