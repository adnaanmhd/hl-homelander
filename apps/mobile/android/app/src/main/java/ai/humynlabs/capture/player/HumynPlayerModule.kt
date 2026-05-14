package ai.humynlabs.capture.player

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * `NativeModules.HumynPlayer` — the JS bridge to [PlayerController], the
 * hand-rolled ExoPlayer wrapper (Plan 06-06 / Phase 6 D-07). Mirrors
 * [ai.humynlabs.capture.gatecamera.HumynGateCameraModule] shape (5 promise
 * methods + the `addListener`/`removeListeners` event-emitter stubs).
 *
 * PlayerScreen (Plan 06-10) usage:
 *  - mount `<HumynPlayerView style={absoluteFill}>`,
 *  - `await prepare(uri)` (either `file://<filesDir>/recording.mp4` for local
 *    or the signed `https://recordings.humyn.ai/...` for streamed),
 *  - `await play()` / `pause()` / `seekTo(ms)`,
 *  - subscribe to `onProgress` / `onBuffer` / `onEnd` / `onError` via the
 *    JS-side `NativeEventEmitter(NativeModules.HumynPlayer)`,
 *  - on unmount / route-leave: `await release()`.
 */
@ReactModule(name = HumynPlayerModule.NAME)
class HumynPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynPlayer"
    }

    init {
        PlayerController.attach(reactContext)
    }

    override fun getName(): String = NAME

    /** Validate URI + initialise (or reuse) the ExoPlayer and queue the MediaItem. */
    @ReactMethod
    fun prepare(uri: String, promise: Promise) {
        PlayerController.prepare(reactApplicationContext, uri) { result ->
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { promise.reject("PLAYER_PREPARE_FAILED", it.message, it) },
            )
        }
    }

    @ReactMethod
    fun play(promise: Promise) {
        PlayerController.play()
        promise.resolve(null)
    }

    @ReactMethod
    fun pause(promise: Promise) {
        PlayerController.pause()
        promise.resolve(null)
    }

    @ReactMethod
    fun seekTo(positionMs: Double, promise: Promise) {
        PlayerController.seekTo(positionMs.toLong())
        promise.resolve(null)
    }

    @ReactMethod
    fun release(promise: Promise) {
        PlayerController.release()
        promise.resolve(null)
    }

    /**
     * Pitfall 5 cleanup — release the ExoPlayer on JS module / catalyst
     * teardown so a hot-reload or activity destroy doesn't leak the codec.
     */
    override fun invalidate() {
        PlayerController.release()
        super.invalidate()
    }

    /**
     * RN ≥ 0.65 NativeEventEmitter contract — silences the
     * `EventEmitter.removeListener` warning that fires when the JS side adds
     * subscribers without these stubs on the module. Mirrors HumynBattery /
     * HumynPhoneState shape.
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // intentionally empty — RCTDeviceEventEmitter does the routing
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // intentionally empty — RCTDeviceEventEmitter does the routing
    }
}
