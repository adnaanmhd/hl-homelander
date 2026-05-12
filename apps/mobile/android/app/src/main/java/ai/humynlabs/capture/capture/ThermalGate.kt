package ai.humynlabs.capture.capture

import android.content.Context
import android.os.PowerManager

/**
 * Phase 3 D-THERM-01 — pre-flight + mid-record thermal gating.
 *
 * **Threshold mapping (project semantics → AOSP constants).** CONTEXT.md /
 * RESEARCH.md / the plan use the labels `THROTTLING` and `THROTTLING_SEVERE`
 * as project semantics. AOSP `PowerManager` ships these tiers:
 * `NONE (0) → LIGHT (1) → MODERATE (2) → SEVERE (3) → CRITICAL (4) →
 * EMERGENCY (5) → SHUTDOWN (6)`. There is NO `THERMAL_STATUS_THROTTLING`
 * constant. Mapping (Plan 03-07 deviation Rule 1 — Bug):
 *   - `THROTTLING` (pre-flight refuse threshold) → `THERMAL_STATUS_MODERATE`
 *     (the first tier where the OS reports moderate-to-active throttling).
 *   - `THROTTLING_SEVERE` (mid-record graceful-stop threshold) →
 *     `THERMAL_STATUS_SEVERE`.
 * This preserves the plan's "pre-flight is one tier more conservative than
 * mid-record" intent on real Android devices.
 *
 * **Pre-flight (CAP-11).** `HumynCaptureModule.start()` calls `preFlight()`
 * before configuring camera/audio/IMU. When the OS reports
 * `getCurrentThermalStatus() ≥ MODERATE`, the gate refuses with
 * `ThermalRefuseException(currentStatus)`. Plan 03-09's bridge maps this to
 * a Promise reject `{code: 'thermal_throttling', recoverable: true,
 * currentStatus}` — the JS layer surfaces a "device too hot — let it cool
 * down and try again" toast and stays on the recording screen.
 *
 * **Mid-record (CAP-12).** `subscribeMidRecord(onSevere)` registers a
 * `PowerManager.OnThermalStatusChangedListener`. When the OS escalates
 * thermal pressure to `≥ SEVERE`, the supplied callback fires once with
 * the current status. Plan 03-10's `CaptureSession` schedules a 2.5 s
 * graceful stop on the callback (so the in-flight segment closes cleanly
 * with valid moov/mvhd boxes) and emits `onThermalAbort` on the JS bridge.
 *
 * **Listener leak protection.** `subscribeMidRecord` returns an
 * `AutoCloseable` whose `close()` removes the listener and shuts down the
 * single-thread executor. `CaptureSession.stop()` MUST call `close()` in
 * its `finally` block — captured by T-3.6-03 in the plan threat register.
 *
 * **Pixel 7a/8a/10a target devices** honor `PowerManager` cleanly per
 * RESEARCH.md. Wider OEM matrix (Samsung's One UI thermal-tier
 * non-conformance, MIUI early-throttle behaviors) is Phase 4 thermal-walk
 * concern.
 */
class ThermalGate(ctx: Context) {

    private val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager

    /**
     * @return `Result.success(Unit)` if the OS thermal status is below
     *   `MODERATE` (NONE / LIGHT).
     * @return `Result.failure(ThermalRefuseException(status))` at MODERATE
     *   and above (MODERATE / SEVERE / CRITICAL / EMERGENCY / SHUTDOWN).
     *   The exception carries the read-time status so the JS bridge can
     *   surface it.
     */
    fun preFlight(): Result<Unit> {
        val status = pm.currentThermalStatus
        return if (status >= PowerManager.THERMAL_STATUS_MODERATE) {
            Result.failure(ThermalRefuseException(status))
        } else {
            Result.success(Unit)
        }
    }

    /**
     * Synchronous read of `PowerManager.getCurrentThermalStatus()` — the same
     * source [preFlight] uses (and the same one `cmd thermalservice
     * override-status N` reliably moves on every Android build). The Phase-4
     * mid-record polling fallback in [CaptureSession] calls this every 5 s
     * because the `OnThermalStatusChangedListener` callback does NOT fire for
     * the `override-status` test path on this Android-16 build (and may lag
     * on a real HAL escalation on some OEM ROMs).
     */
    fun currentStatus(): Int = pm.currentThermalStatus

    /**
     * Subscribe to mid-record thermal escalation. The callback fires on
     * the default Android binder thread that the OS uses to dispatch
     * `OnThermalStatusChangedListener` callbacks (the system's main
     * thread when the app process is the binder server). DO NOT block
     * inside the callback — Plan 03-10's `CaptureSession` posts the
     * 2.5 s graceful-stop work to its recording-thread Handler.
     *
     * **Single-arg overload (Plan 03-07 Rule-1 deviation).** The
     * two-arg `addThermalStatusListener(Executor, Listener)` overload is
     * used in RESEARCH.md Code Example 6 but is not shadowed by
     * Robolectric `ShadowPowerManager` (4.16.1 only shadows the single-arg
     * overload — verified by inspecting `shadows-framework-4.16.1.jar`).
     * On a real device the single-arg form delivers callbacks on the
     * binder dispatch thread, which is fine for our short-lived check
     * (`if (status >= SEVERE) onSevere(status)`). If the caller needs an
     * Executor-bounded dispatch, that's a Plan 03-10 layering concern,
     * not a `ThermalGate` concern.
     *
     * @param onSevere fired ONCE per escalation when status `≥ SEVERE`,
     *   carrying the new status. Status changes below SEVERE are ignored.
     * @return an `AutoCloseable` whose `close()` unregisters the
     *   listener — MUST be called from `CaptureSession.stop()`'s
     *   `finally` block to satisfy T-3.6-03 (no listener leak).
     */
    fun subscribeMidRecord(onSevere: (Int) -> Unit): AutoCloseable {
        val listener = PowerManager.OnThermalStatusChangedListener { status ->
            if (status >= PowerManager.THERMAL_STATUS_SEVERE) onSevere(status)
        }
        pm.addThermalStatusListener(listener)
        return AutoCloseable {
            pm.removeThermalStatusListener(listener)
        }
    }
}

/**
 * Pre-flight refusal. Carries the current thermal status so the JS bridge
 * can surface it in the `{code: 'thermal_throttling', currentStatus}`
 * Promise reject (Plan 03-09 mapping).
 *
 * `message` is the bridge code string ("thermal_throttling") — the JS layer
 * dispatches on this string, so it is part of the public contract and must
 * not change without coordinating with Plan 03-09.
 */
class ThermalRefuseException(val currentStatus: Int) : RuntimeException("thermal_throttling")
