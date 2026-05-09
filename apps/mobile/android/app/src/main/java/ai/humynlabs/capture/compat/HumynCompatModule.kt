package ai.humynlabs.capture.compat

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.Executors

/**
 * D-COMPAT-02 — three-method TurboModule surface for behavioral compat probing.
 *
 * Heavy work (NAL parsing in EncoderProbe, sustained-rate IMU sampling in
 * ImuProbe, device-cap enumeration in DeviceCaps) is delegated to the four
 * helper classes in this package. This file owns:
 *   - the three [ReactMethod] entry points that JS calls
 *   - dispatching to a single-thread background executor (T-2.6-03 mitigation —
 *     probes must NEVER run on the main thread)
 *   - building the WritableMap response
 *   - wrapping helper exceptions into per-method error codes:
 *       runEncoderProbe → ENCODER_PROBE_ERROR
 *       runImuProbe     → IMU_PROBE_ERROR
 *       readDeviceCaps  → DEVICE_CAPS_ERROR
 *
 * The full per-probe implementations land in plans 02-12 / 02-13 / 02-14;
 * until then the helper.run/.read methods throw NotImplementedError and the
 * JS side observes a rejected Promise with the error code above.
 */
@ReactModule(name = HumynCompatModule.NAME)
class HumynCompatModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynCompat"
    }

    /**
     * Single-thread executor — guarantees probes are serialised (no two
     * concurrent Camera2 sessions) and never run on the main thread.
     * RESEARCH § Anti-Patterns is explicit on this.
     */
    private val bgExecutor = Executors.newSingleThreadExecutor()

    override fun getName(): String = NAME

    @ReactMethod
    fun runEncoderProbe(promise: Promise) {
        bgExecutor.execute {
            try {
                val result = EncoderProbe(reactApplicationContext).run()
                val map: WritableMap = Arguments.createMap().apply {
                    putBoolean("bFramePresent", result.bFramePresent)
                    putBoolean("oisOff", result.oisOff)
                    putBoolean("hdrSdrForced", result.hdrSdrForced)
                    putString("encoderClipPath", result.encoderClipPath)
                }
                promise.resolve(map)
            } catch (t: Throwable) {
                promise.reject("ENCODER_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)
            }
        }
    }

    @ReactMethod
    fun runImuProbe(durationMs: Double, withPreview: Boolean, promise: Promise) {
        bgExecutor.execute {
            try {
                val result = ImuProbe(reactApplicationContext).run(durationMs.toLong(), withPreview)
                val map: WritableMap = Arguments.createMap().apply {
                    putDouble("sustainedHz", result.sustainedHz.toDouble())
                    putDouble("p99IntervalMs", result.p99IntervalMs.toDouble())
                    putInt("samplesCollected", result.samplesCollected)
                }
                promise.resolve(map)
            } catch (t: Throwable) {
                promise.reject("IMU_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)
            }
        }
    }

    @ReactMethod
    fun readDeviceCaps(promise: Promise) {
        bgExecutor.execute {
            try {
                // DeviceCaps.readAll() returns a JS-bridge-ready WritableMap
                // matching DeviceCapsResult in apps/mobile/src/native/HumynCompat.ts.
                val map: WritableMap = DeviceCaps(reactApplicationContext).readAll()
                promise.resolve(map)
            } catch (t: Throwable) {
                promise.reject("DEVICE_CAPS_ERROR", "${t::class.simpleName}: ${t.message}", t)
            }
        }
    }
}
