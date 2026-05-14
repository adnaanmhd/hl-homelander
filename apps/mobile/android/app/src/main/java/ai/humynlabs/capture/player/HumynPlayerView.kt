package ai.humynlabs.capture.player

import android.content.Context
import android.graphics.SurfaceTexture
import android.view.Surface
import android.view.TextureView

/**
 * The video surface for [PlayerController] (Plan 06-06 / Phase 6 D-07). A
 * [TextureView] whose [SurfaceTexture] is published to the controller's
 * ExoPlayer the moment it becomes available.
 *
 * Why TextureView (not SurfaceView): composes inside RN's view tree so RN
 * overlays (transport controls, captions, gradients, the design-spec §14
 * player chrome) sit cleanly on top of the video with normal alpha + z-order
 * (SurfaceView would hole-punch the parent and the chrome would have to live
 * in a separate window to mix correctly). The cost is a single GPU copy per
 * frame — acceptable for 1080p/30fps HEVC playback.
 *
 * Lifecycle (Pitfall 5 — TextureView Surface Loss on Background):
 *  - [onSurfaceTextureAvailable] → [PlayerController.onSurfaceAvailable] binds
 *    the Surface as the player's video output.
 *  - [onSurfaceTextureDestroyed] → [PlayerController.onSurfaceDestroyed]
 *    clears the surface but does NOT release the player (so backgrounding /
 *    rotating doesn't tear down the codec).
 */
class HumynPlayerView(context: Context) :
    TextureView(context),
    TextureView.SurfaceTextureListener {

    private var surface: Surface? = null

    init {
        surfaceTextureListener = this
        // If the SurfaceTexture is already available (view re-attached), bind now.
        if (isAvailable) {
            surfaceTexture?.let { onSurfaceTextureAvailable(it, width, height) }
        }
    }

    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
        val s = Surface(st)
        surface = s
        PlayerController.onSurfaceAvailable(s)
    }

    override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, width: Int, height: Int) {
        // No transform — the player applies its own aspect-ratio handling. Caller
        // (PlayerScreen) sizes this view via `resizeMode`-equivalent styling
        // (object-fit applied at the RN-style layer, design-spec §14).
    }

    override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
        // Clear from the player FIRST so it stops drawing into the now-stale
        // Surface before we release it.
        PlayerController.onSurfaceDestroyed()
        surface?.release()
        surface = null
        // Returning true ⇒ we (and ExoPlayer) are done with the SurfaceTexture;
        // the platform may release it.
        return true
    }

    override fun onSurfaceTextureUpdated(st: SurfaceTexture) {
        // Frame rendered — nothing to do.
    }
}
