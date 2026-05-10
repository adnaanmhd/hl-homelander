package ai.humynlabs.capture.fgs

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

/**
 * Phase 3 — minimal ongoing FGS notification.
 *
 * **Project hard rule clarification.** PROJECT.md "no notifications channel"
 * applies to USER-facing channels (FCM/APNs alerts, marketing, retention
 * pings) — not to the OS-mandated foreground-service notification, which is
 * system chrome the OS forces every FGS to display while the user-initiated
 * capture is running. The channel here is `IMPORTANCE_LOW` + `setSilent(true)`
 * so it never makes a sound, never vibrates, never shows a badge.
 *
 * **Why no notification icon resource (yet).** This phase ships the channel
 * + builder; the brand FGS icon resource (`@drawable/ic_fgs_recording`) is
 * a downstream Plan 03-09 task — until then we use the framework
 * `android.R.drawable.ic_media_play` so the notification renders without a
 * resource lookup failure.
 */
object HumynForegroundNotification {
    /** Channel id is stable across builds — drift would create a duplicate channel. */
    const val CHANNEL_ID = "humyn_capture_fgs"

    /** Channel display name in system settings. */
    private const val CHANNEL_NAME = "Recording"

    /** Title shown in the notification shade. */
    private const val NOTIFICATION_TITLE = "Humyn Labs Capture"

    /**
     * Idempotent — `NotificationManager.createNotificationChannel` no-ops
     * for an existing channel-id with the same params. Safe to call from
     * `Service.onCreate` on every start.
     */
    fun ensureChannel(ctx: Context) {
        val mgr = ctx.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        mgr.createNotificationChannel(channel)
    }

    /**
     * Builds the ongoing FGS notification. `setOngoing(true)` makes it
     * non-dismissible by user swipe — system policy for foreground services.
     */
    fun build(ctx: Context, text: String): Notification =
        NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play) // TODO Plan 03-09 — brand `@drawable/ic_fgs_recording`.
            .setContentTitle(NOTIFICATION_TITLE)
            .setContentText(text)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()
}
