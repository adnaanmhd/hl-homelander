package ai.humynlabs.capture.capture

import com.google.firebase.remoteconfig.FirebaseRemoteConfig

/**
 * Phase 3 D-SEG-01 — read `capture.segment_minutes` from Firebase Remote Config.
 *
 * Default 10L (idea-brief.md §6: 10-min auto-segment). On any error
 * (no Firebase init, no network, fetch timeout, or zero/negative value)
 * returns the default.
 *
 * Phase 2 already wired `@react-native-firebase/remote-config@24.0.0` in
 * `apps/mobile/package.json`; the Kotlin SDK reads from the same instance.
 *
 * `MainApplication.onCreate` calls `setDefaultsAsync(mapOf(KEY to DEFAULT_MINUTES))`
 * before the JS side ever invokes `start()`, so even before the first
 * Remote Config fetch completes, `getLong(KEY)` returns 10L.
 */
object SegmentDurationConfig {
    const val KEY = "capture.segment_minutes"
    const val DEFAULT_MINUTES = 10L

    fun load(): Long = try {
        val rc = FirebaseRemoteConfig.getInstance()
        val raw: Long = rc.getLong(KEY)
        if (raw > 0L) raw else DEFAULT_MINUTES
    } catch (_: Throwable) {
        DEFAULT_MINUTES
    }
}
