package ai.humynlabs.capture.player

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Hand-rolled wrapper around a single [ExoPlayer] instance (Plan 06-06 / Phase 6
 * D-07). Drives prepare / play / pause / seekTo / release off the
 * [HumynPlayerView] TextureView surface and emits 4 events
 * (`onProgress` / `onBuffer` / `onEnd` / `onError`) to JS via
 * RCTDeviceEventEmitter.
 *
 * Singleton (`object`): there is exactly one player at a time. PlayerScreen
 * (Plan 06-10) mounts one [HumynPlayerView] and calls [HumynPlayerModule]
 * methods; the next mount reuses the same player after [release].
 *
 * Lifecycle / Pitfall 5 (TextureView Surface Loss on Background):
 *  - [onSurfaceAvailable] / [onSurfaceDestroyed] swap the player's video
 *    surface on TextureView lifecycle. We do NOT release the player on
 *    SurfaceTextureDestroyed (the user may just be backgrounding the activity
 *    or rotating); the JS module's [HumynPlayerModule.invalidate] (called on
 *    React-Native catalyst teardown) is the final release gate.
 *
 * Security / T-6.6-01 (URI scheme sandboxing):
 *  - [validateUriScheme] rejects any `file://` URI not under
 *    `ctx.filesDir` and any non-`file://` / non-`https://` scheme.
 *  - `https://` URIs pass the scheme gate; the trust anchor for `https://` is
 *    the server-side CloudFront-signed URL mint (Plan 06-03).
 */
object PlayerController {
    private const val TAG = "HumynPlayer"

    /** The single ExoPlayer instance. Null when not initialised / released. */
    private var player: ExoPlayer? = null

    /** Cached for event emission. Set in [attach]. */
    private var rctx: ReactApplicationContext? = null

    /** Current video surface (owned by the live [HumynPlayerView] TextureView). */
    private var surface: Surface? = null

    /** Progress ticker — main-thread Handler posts a Runnable every 250 ms. */
    private val progressHandler = Handler(Looper.getMainLooper())
    private var progressTicker: Runnable? = null

    /** Wire the React context once at module construction so events can dispatch. */
    fun attach(reactContext: ReactApplicationContext) {
        rctx = reactContext
    }

    /**
     * Build the [ExoPlayer] (lazy — first prepare creates it), validate the URI,
     * attach the listener, and queue the MediaItem. The cb is invoked with
     * [Result.failure] on validation failure or [Result.success] once
     * `ExoPlayer.prepare()` is dispatched (the actual buffer / state changes
     * arrive via [playerListener]).
     */
    fun prepare(ctx: Context, uri: String, cb: (Result<Unit>) -> Unit) {
        try {
            validateUriScheme(ctx, uri)
            val ep = player ?: ExoPlayer.Builder(ctx)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build(),
                    /* handleAudioFocus = */ true,
                )
                .setHandleAudioBecomingNoisy(true)
                .build()
                .also {
                    player = it
                    surface?.let { s -> it.setVideoSurface(s) }
                    it.addListener(playerListener)
                }
            ep.setMediaItem(MediaItem.fromUri(uri))
            ep.prepare()
            cb(Result.success(Unit))
        } catch (t: Throwable) {
            cb(Result.failure(t))
        }
    }

    fun play() {
        player?.let {
            it.play()
            startProgressTicker()
        }
    }

    fun pause() {
        player?.pause()
        stopProgressTicker()
    }

    fun seekTo(ms: Long) {
        player?.seekTo(ms)
    }

    /** Idempotent — safe to call when no player exists or after a previous release. */
    fun release() {
        stopProgressTicker()
        player?.release()
        player = null
        surface?.release()
        surface = null
    }

    /** TextureView lifecycle hook — bind the surface to the (lazy) player. */
    fun onSurfaceAvailable(s: Surface) {
        surface = s
        player?.setVideoSurface(s)
    }

    /**
     * TextureView lifecycle hook — clear the surface but keep the player alive
     * (Pitfall 5: on backgrounding the OS destroys the SurfaceTexture; releasing
     * the player here would tear down the codec on every rotation).
     */
    fun onSurfaceDestroyed() {
        player?.clearVideoSurface()
        surface?.release()
        surface = null
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            emit(
                "onBuffer",
                Arguments.createMap().apply {
                    putBoolean("buffering", state == Player.STATE_BUFFERING)
                },
            )
            if (state == Player.STATE_ENDED) {
                stopProgressTicker()
                emit("onEnd", Arguments.createMap())
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            Log.w(TAG, "playback error code=${error.errorCode}", error)
            emit(
                "onError",
                Arguments.createMap().apply {
                    putInt("code", error.errorCode)
                    putString("msg", error.message ?: "playback error")
                },
            )
        }
    }

    private fun startProgressTicker() {
        stopProgressTicker()
        progressTicker = object : Runnable {
            override fun run() {
                val ep = player ?: return
                emit(
                    "onProgress",
                    Arguments.createMap().apply {
                        putDouble("positionMs", ep.currentPosition.toDouble())
                        putDouble("bufferedMs", ep.bufferedPosition.toDouble())
                        putDouble("durationMs", ep.duration.toDouble())
                    },
                )
                progressHandler.postDelayed(this, 250L)
            }
        }
        progressHandler.postDelayed(progressTicker!!, 250L)
    }

    private fun stopProgressTicker() {
        progressTicker?.let { progressHandler.removeCallbacks(it) }
        progressTicker = null
    }

    private fun emit(name: String, map: WritableMap) {
        rctx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(name, map)
    }

    /**
     * T-6.6-01 (URI scheme sandboxing).
     *
     *  - `file://`-under-filesDir accepted — recorded MP4s live there.
     *  - `https://`-any-host accepted — the trust anchor is the server-side
     *    CloudFront-signed URL minted by Plan 06-03 (5 min TTL); any `https`
     *    host without a valid signature returns 403 from CloudFront.
     *  - Everything else (`file:` outside filesDir, `ftp:`, `content:`,
     *    `data:`, etc.) is rejected with [IllegalArgumentException].
     *
     * Note: the KDoc deliberately avoids the literal sequence `[slash][slash][star]`
     * — Kotlin's lexer permits nested block comments, so a stray `/[star]`
     * inside a KDoc opens a nested comment that never closes.
     */
    private fun validateUriScheme(ctx: Context, uri: String) {
        if (uri.startsWith("file://")) {
            val filesDir = ctx.filesDir.absolutePath
            if (!uri.startsWith("file://$filesDir")) {
                throw IllegalArgumentException(
                    "Player rejects file:// URI outside filesDir: $uri",
                )
            }
        } else if (uri.startsWith("https://")) {
            // Accept any https:// — CloudFront-signed-URL mint is the gate.
        } else {
            throw IllegalArgumentException(
                "Player rejects URI scheme: $uri (expected file:// or https://)",
            )
        }
    }
}
