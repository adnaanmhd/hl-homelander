package ai.humynlabs.capture

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import io.humyn.app.PlayIntegrityPackage
import org.wonday.orientation.OrientationActivityLifecycle
import ai.humynlabs.capture.battery.HumynBatteryPackage
import ai.humynlabs.capture.beep.HumynBeepPackage
import ai.humynlabs.capture.capture.CaptureLaunchSweep
import ai.humynlabs.capture.capture.HumynCapturePackage
import ai.humynlabs.capture.capture.SegmentDurationConfig
import ai.humynlabs.capture.compat.HumynCompatPackage
import ai.humynlabs.capture.fgs.HumynForegroundNotification
import ai.humynlabs.capture.gatecamera.HumynGateCameraPackage
import ai.humynlabs.capture.handdetector.HumynHandDetectorPackage
import ai.humynlabs.capture.phonestate.HumynPhoneStatePackage
import ai.humynlabs.capture.player.HumynPlayerPackage
import ai.humynlabs.capture.screenbrightness.HumynScreenBrightnessPackage
import ai.humynlabs.capture.updater.HumynUpdaterPackage
import ai.humynlabs.capture.upload.HumynUploadPackage

/**
 * RN 0.83 / Hermes / New Architecture Application entry point.
 * Auto-linked packages come from PackageList(this); the custom AppFlavorPackage
 * (plan 09) and PlayIntegrityPackage (plan 13) are appended so
 * NativeModules.AppFlavor and NativeModules.PlayIntegrity are reachable from JS.
 */
class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {
                val packages = PackageList(this).packages.toMutableList()
                packages.add(AppFlavorPackage())
                packages.add(PlayIntegrityPackage())  // Plan 13 — Phase 1 mobile sign-in scaffold
                packages.add(HumynCompatPackage())    // Plan 02-06 — Phase 2 compat probe shell
                packages.add(HumynUpdaterPackage())   // Plan 02-07 — Phase 2 force-upgrade APK installer (apkRollout flavor)
                packages.add(HumynCapturePackage())   // Plan 03-09 — Phase 3 capture pipeline entry
                packages.add(HumynGateCameraPackage())       // debug handgate-never-passes — native Camera2 pre-record-gate camera + preview (replaces VisionCamera)
                packages.add(HumynHandDetectorPackage())     // Plan 04-02 — HAND-01 pre-record hand gate (MediaPipe; body in 04-04)
                packages.add(HumynPhoneStatePackage())       // Plan 04-02 — AudioManager focus-loss interruption signal (body in 04-05)
                packages.add(HumynBatteryPackage())          // Plan 04-02 — battery level/charging signal (body in 04-05)
                packages.add(HumynScreenBrightnessPackage()) // Plan 04-02 — REC-08 per-window brightness (body in 04-05)
                packages.add(HumynBeepPackage())             // Plan 04-02 — REC-10 pre-baked alert tones (body in 04-05)
                packages.add(HumynUploadPackage())           // Plan 05-04 — Phase 5 background upload pipeline
                packages.add(HumynPlayerPackage())           // Plan 06-06 — Phase 6 D-07 — in-app HEVC player (media3 ExoPlayer)
                return packages
            }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = true

            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)
        // Initialise the new-architecture entry point.
        load()
        // D-COMPAT-04 / T-2.6-02: sweep orphan compat-probe-*.mp4 files left in
        // cacheDir if a previous EncoderProbe (plan 02-12) crashed before its
        // finally-block deletion ran. Best-effort — listFiles can return null.
        cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
            ?.forEach { it.delete() }

        // Phase 3 D-FS-04 — orphan recordings + practice cleanup. Best-effort;
        // missing dirs are skipped. See CaptureLaunchSweep.kt for sweep semantics.
        // Phase 4 D-LIFE-04 (plan 04-10) — stash the orphan-with-valid-sidecar
        // bases the sweep found; HumynCaptureModule drains this on first
        // onHostResume (after the JS bundle + installBootRecoveryListener are up)
        // and emits the one-shot onCrashRecovery event for the Home toast.
        CaptureLaunchSweep.pendingRecovery = CaptureLaunchSweep(filesDir).run()

        // Phase 3 — set capture.segment_minutes default (read by SegmentDurationConfig.load()).
        // Defaults are best-effort: if Firebase init hasn't completed (test/no-network), the
        // SegmentDurationConfig.load() catch-block falls back to DEFAULT_MINUTES anyway.
        try {
            com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance().setDefaultsAsync(
                mapOf(SegmentDurationConfig.KEY to SegmentDurationConfig.DEFAULT_MINUTES),
            )
        } catch (t: Throwable) {
            // WR-03 fix — surface the failure on the catch path so a
            // mis-configured Firebase wiring (e.g. missing google-services.json
            // for the active flavor) is visible in logcat. Previously this
            // was silently swallowed and a debug build would happily run
            // with the default, never telling the developer the Remote Config
            // wiring is broken.
            android.util.Log.w("MainApplication", "remote_config_defaults_failed", t)
        }

        // Phase 3 — ensure FGS notification channel exists for the next start().
        // Plan 03-07 ships the helper; channel creation is idempotent.
        HumynForegroundNotification.ensureChannel(this)

        // Plan 04-02 — react-native-orientation-locker activity-lifecycle hook
        // (per the library README). lockToLandscape() on the (only)
        // landscape-locked RecordingScreen needs this registered so the
        // OrientationActivityLifecycle singleton sees the activity lifecycle;
        // plan 04-01 already added MainActivity.onConfigurationChanged + the
        // AndroidManifest android:configChanges orientation|screenSize flags.
        registerActivityLifecycleCallbacks(OrientationActivityLifecycle.getInstance())
    }
}
