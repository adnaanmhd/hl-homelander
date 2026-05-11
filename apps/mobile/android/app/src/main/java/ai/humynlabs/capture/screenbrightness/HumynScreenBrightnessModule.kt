package ai.humynlabs.capture.screenbrightness

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * REC-08 — TurboModule entry point for `NativeModules.HumynScreenBrightness`.
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). One `@ReactMethod`:
 * [set] — set the per-window brightness; `value ∈ [0, 1]` overrides, `value
 * == -1` (`WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE`) restores the
 * system default.
 *
 * **SHELL.** This plan (04-02) ships the contract surface only. Plan 04-05
 * wires the real body: `reactApplicationContext.currentActivity ?: return` +
 * `activity.runOnUiThread { activity.window?.let { w -> val lp =
 * w.attributes; lp.screenBrightness = clamp(value); w.attributes = lp } }` —
 * the same null-safe + UI-thread window-mutation idiom
 * `HumynCaptureModule.applyKeepScreenOn` uses (window flags must be touched
 * from the main thread).
 *
 * **Per-window brightness only — NOT `Settings.System.SCREEN_BRIGHTNESS`**
 * (which would need the `WRITE_SETTINGS` permission and changes the
 * device-wide setting). Per-window brightness is scoped to this app's window;
 * RecordingScreen still calls `set(-1)` on stop AND on unmount so a
 * backgrounded mid-record doesn't leave the screen dim (REC-08).
 */
@ReactModule(name = HumynScreenBrightnessModule.NAME)
class HumynScreenBrightnessModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynScreenBrightness"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun set(value: Double, promise: Promise) {
        promise.resolve(null)
    }
}
