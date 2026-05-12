package ai.humynlabs.capture.upload

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log

/**
 * Phase 5 / Plan 05-06 — connectivity classification + the event-driven
 * resume trigger for the upload pipeline.
 *
 *  - [isCellular] → `true` when the active network has `TRANSPORT_CELLULAR` and
 *    NOT `TRANSPORT_WIFI`. The ONLY thing this changes is the S3 part size
 *    (5 MiB cellular vs 8 MiB Wi-Fi — see [chunkBytesForNetwork]) plus the
 *    30 s watchdog / MSS-clamp posture in `ChunkUploader`. **There is NO
 *    Wi-Fi-only toggle anywhere — cellular uploads always proceed (UP-17).**
 *
 *  - [register] installs a `registerDefaultNetworkCallback` — when connectivity
 *    is regained after a loss, [onConnectivityRegained] fires so a paused /
 *    stalled drain wakes up. This is EVENT-DRIVEN — there is intentionally NO
 *    timer poll (a `Handler.postDelayed` connectivity poll is an anti-pattern;
 *    it wastes wakeups and adds latency).
 */
class NetworkMonitor(
    context: Context,
    private val onConnectivityRegained: () -> Unit,
) {
    private val cm = context.applicationContext
        .getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    /**
     * `true` iff the active network is cellular (mobile data) and not Wi-Fi.
     * Used only to pick the S3 part size — uploads proceed on cellular regardless
     * (UP-17 — no Wi-Fi-only gate).
     */
    fun isCellular(): Boolean {
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) &&
            !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }

    /** `true` if there's any active network with internet capability. */
    fun hasNetwork(): Boolean {
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            // Connectivity regained — wake any paused/stalled drain.
            runCatching { onConnectivityRegained() }
        }
    }

    private var registered = false

    /** Start listening for the default-network coming back. Idempotent. */
    fun register() {
        if (registered) return
        try {
            cm.registerDefaultNetworkCallback(callback)
            registered = true
        } catch (t: Throwable) {
            Log.w(TAG, "registerDefaultNetworkCallback failed", t)
        }
    }

    /** Stop listening. Idempotent / exception-tolerant. */
    fun unregister() {
        if (!registered) return
        try {
            cm.unregisterNetworkCallback(callback)
        } catch (_: Throwable) {
            // Already-unregistered → fine.
        } finally {
            registered = false
        }
    }

    companion object {
        private const val TAG = "HumynNetworkMonitor"
    }
}
