package ai.humynlabs.capture.battery

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for `NativeModules.HumynBattery` — the battery
 * level/charging signal that drives the low-battery cue during a recording.
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). Two `@ReactMethod`s:
 * [start] (register the battery receiver) and [stop] (unregister it).
 *
 * **SHELL.** This plan (04-02) ships the contract surface only. Plan 04-05
 * wires the real body: a `BroadcastReceiver` for
 * `Intent.ACTION_BATTERY_CHANGED` (the sticky broadcast — also gives the
 * current state immediately on register) that emits
 * `onBatteryChanged({level: Double 0..1, isCharging: Boolean})` via
 * `RCTDeviceEventEmitter` on each change. No permission required —
 * ACTION_BATTERY_CHANGED is a protected-broadcast a receiver can subscribe to
 * freely.
 */
@ReactModule(name = HumynBatteryModule.NAME)
class HumynBatteryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynBattery"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun start(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun stop(promise: Promise) {
        promise.resolve(null)
    }
}
