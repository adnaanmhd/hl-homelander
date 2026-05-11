package ai.humynlabs.capture.battery

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * REC-10 / REC-11 — battery-level transitions via the
 * `Intent.ACTION_BATTERY_CHANGED` sticky broadcast.
 *
 * No permission required — `ACTION_BATTERY_CHANGED` is a protected broadcast
 * any receiver can subscribe to freely, and `registerReceiver` returns the
 * last sticky broadcast immediately, so the JS side gets a starting value as
 * soon as it calls [start].
 *
 * Emits `onBatteryChanged({level: Double 0..1, isCharging: Boolean})` via
 * `RCTDeviceEventEmitter` on every change (de-duplicated — only emits when
 * level or charging state actually moved). The JS side
 * (`useRecordingLifecycle`, plan 04-08) computes the threshold transitions
 * (≤15 % cue → ≤5 % beep + end-segment → <5 %-start-guard) plus a ~60 s
 * periodic cross-check, because some OEM ROMs deliver coarse / lagging
 * `ACTION_BATTERY_CHANGED` events (PITFALLS.md Pitfall 11).
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). `start()` registers the
 * receiver; `stop()` unregisters it; `invalidate()` unregisters it too if
 * still registered (Pitfall 5 — no receiver leak).
 */
@ReactModule(name = HumynBatteryModule.NAME)
class HumynBatteryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynBattery"
    }

    /** The active receiver, or `null` when not listening. */
    private var receiver: BroadcastReceiver? = null

    /** Last emitted level (0..1), `-1.0` when no value emitted yet — de-dup. */
    private var lastPct: Double = -1.0

    /** Last emitted charging state — de-dup. */
    private var lastCharging: Boolean = false

    override fun getName(): String = NAME

    /**
     * Read level/scale/status out of an `ACTION_BATTERY_CHANGED` intent, and
     * if it differs from the last emit, push `onBatteryChanged` and remember
     * the new state. A negative/zero scale or level → skipped (no signal).
     */
    private fun handleBatteryIntent(intent: Intent?) {
        if (intent == null) return
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        if (level < 0 || scale <= 0) return
        val pct = level.toDouble() / scale.toDouble()
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        if (pct == lastPct && isCharging == lastCharging) return
        lastPct = pct
        lastCharging = isCharging
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(
                "onBatteryChanged",
                Arguments.createMap().apply {
                    putDouble("level", pct)
                    putBoolean("isCharging", isCharging)
                },
            )
    }

    @ReactMethod
    fun start(promise: Promise) {
        try {
            if (receiver == null) {
                val rcv = object : BroadcastReceiver() {
                    override fun onReceive(context: Context?, intent: Intent?) {
                        handleBatteryIntent(intent)
                    }
                }
                receiver = rcv
                // registerReceiver returns the last sticky broadcast — synthesize
                // an initial emit from it so the JS side has a starting value.
                val sticky = reactApplicationContext.registerReceiver(
                    rcv,
                    IntentFilter(Intent.ACTION_BATTERY_CHANGED),
                )
                handleBatteryIntent(sticky)
            }
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("BATTERY_START_FAILED", t.message ?: "register battery receiver failed", t)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            receiver?.let { reactApplicationContext.unregisterReceiver(it) }
            receiver = null
            lastPct = -1.0
            lastCharging = false
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("BATTERY_STOP_FAILED", t.message ?: "unregister battery receiver failed", t)
        }
    }

    override fun invalidate() {
        // Pitfall 5 — unregister the receiver if still registered when the
        // catalyst instance goes away.
        receiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (_: Throwable) {
                // best-effort teardown
            }
        }
        receiver = null
        lastPct = -1.0
        lastCharging = false
        super.invalidate()
    }
}
