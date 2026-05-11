package ai.humynlabs.capture.screenbrightness

import android.app.Activity
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * REC-08 — per-window `screenBrightness` override + restore.
 *
 * [set] takes a `value`:
 *   - `value ∈ [0, 1]` → sets the foreground activity window's brightness
 *     override (clamped to that range).
 *   - `value < 0` (the `-1` sentinel) → `WindowManager.LayoutParams
 *     .BRIGHTNESS_OVERRIDE_NONE`, i.e. restore the system default.
 *
 * **Per-window only — NOT the OS-wide system brightness setting** (writing
 * the global setting would need the write-settings permission and persists
 * device-wide). The window override auto-resets when the activity is
 * destroyed, but RecordingScreen
 * also calls `set(-1)` explicitly on stop AND on unmount (Pitfall 6 — a
 * force-navigation within the same activity won't auto-reset).
 *
 * Reuses `HumynCaptureModule.applyKeepScreenOn`'s UI-thread idiom:
 * `reactApplicationContext.currentActivity ?: return` (RN 0.83 deprecated the
 * protected `currentActivity` accessor — the reactApplicationContext getter
 * is the replacement) + `activity.runOnUiThread { ... }` because window
 * attributes must be mutated from the main thread.
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`).
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
        val activity: Activity = reactApplicationContext.currentActivity
            ?: run {
                promise.reject("NO_ACTIVITY", "no current activity to apply screen brightness")
                return
            }
        activity.runOnUiThread {
            try {
                val window = activity.window
                    ?: run {
                        promise.reject("NO_WINDOW", "current activity has no window")
                        return@runOnUiThread
                    }
                val lp = window.attributes
                lp.screenBrightness = if (value < 0) {
                    WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                } else {
                    value.toFloat().coerceIn(0f, 1f)
                }
                window.attributes = lp
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("BRIGHTNESS_FAILED", e.message ?: "failed to set screen brightness", e)
            }
        }
    }
}
