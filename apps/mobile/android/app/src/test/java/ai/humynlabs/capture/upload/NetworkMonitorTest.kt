package ai.humynlabs.capture.upload

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNetworkCapabilities

/**
 * Plan 05-06 Task 2 — `NetworkMonitor` (`isCellular()` + the event-driven
 * `registerDefaultNetworkCallback` resume trigger).
 *
 * Confirms: cellular vs Wi-Fi classification via
 * `ConnectivityManager.getNetworkCapabilities(activeNetwork)`; that there is no
 * Wi-Fi-only gate (UP-17 — `isCellular()` only affects the chunk size);
 * `register`/`unregister` are exception-tolerant and don't poll; the
 * default-network callback's `onAvailable` fires the regained-connectivity hook.
 *
 * `application = Application::class` — bypasses MainApplication.onCreate
 * SoLoader.init NPE under Robolectric (canonical Phase 3/4 pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class NetworkMonitorTest {

    private fun app() = RuntimeEnvironment.getApplication() as Application
    private fun cm(): ConnectivityManager =
        app().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    /** Override the active network's capabilities with the given transports + INTERNET. */
    private fun setActiveTransports(vararg transports: Int) {
        val active = cm().activeNetwork ?: return
        val caps = ShadowNetworkCapabilities.newInstance()
        transports.forEach { shadowOf(caps).addTransportType(it) }
        shadowOf(caps).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        shadowOf(cm()).setNetworkCapabilities(active, caps)
    }

    @Test
    fun `isCellular is true for a cellular-only active network`() {
        setActiveTransports(NetworkCapabilities.TRANSPORT_CELLULAR)
        val monitor = NetworkMonitor(app()) {}
        assertTrue("cellular-only active network → isCellular()", monitor.isCellular())
        assertTrue(monitor.hasNetwork())
    }

    @Test
    fun `isCellular is false when Wi-Fi is also present`() {
        setActiveTransports(NetworkCapabilities.TRANSPORT_CELLULAR, NetworkCapabilities.TRANSPORT_WIFI)
        val monitor = NetworkMonitor(app()) {}
        assertFalse("Wi-Fi present → not 'cellular' for chunk-size purposes", monitor.isCellular())
        // ...but uploads still proceed — there is no Wi-Fi-only gate (UP-17). `isCellular()`
        // is the only network-type signal NetworkMonitor exposes and it only picks the chunk size.
    }

    @Test
    fun `isCellular is false when there is no active network`() {
        // Drop the default network → getActiveNetwork() returns null.
        shadowOf(cm()).setDefaultNetworkActive(false)
        shadowOf(cm()).clearAllNetworks()
        val monitor = NetworkMonitor(app()) {}
        assertFalse(monitor.isCellular())
        assertFalse(monitor.hasNetwork())
    }

    @Test
    fun `register and unregister are idempotent and do not throw`() {
        val monitor = NetworkMonitor(app()) {}
        monitor.register()
        monitor.register() // idempotent
        monitor.unregister()
        monitor.unregister() // idempotent
        assertTrue(true) // the point is no exception is thrown
    }

    @Test
    fun `onConnectivityRegained fires when the default-network callback reports onAvailable`() {
        var fired = false
        val monitor = NetworkMonitor(app()) { fired = true }
        monitor.register()
        // The Robolectric shadow tracks registered NetworkCallbacks; drive onAvailable on ours.
        val active = cm().activeNetwork
        shadowOf(cm()).networkCallbacks.forEach { cb ->
            if (active != null) cb.onAvailable(active)
        }
        monitor.unregister()
        assertTrue("the regained-connectivity hook should have fired", fired)
    }
}
