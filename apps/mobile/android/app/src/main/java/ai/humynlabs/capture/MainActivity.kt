package ai.humynlabs.capture

import android.content.Intent
import android.content.res.Configuration
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * RN 0.83 / Hermes / New Architecture Activity entry point.
 * The JS bundle's main component name MUST match the value passed to
 * `AppRegistry.registerComponent(...)` in apps/mobile/index.js.
 *
 * Phase 4 (plan 04-01): react-native-orientation-locker requires this
 * `onConfigurationChanged` override — its `OrientationActivityLifecycle`
 * listens for the broadcast emitted below to track config-driven orientation
 * changes. The companion `OrientationActivityLifecycle.getInstance(...)`
 * registration in `MainApplication.onCreate()` is owned by plan 04-02
 * (which registers the orientation-locker autolink package alongside the
 * other native packages). The matching `android:configChanges` flags
 * (`orientation|screenSize`) are already declared in AndroidManifest.xml.
 */
class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "HumynLabsCapture"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    // react-native-orientation-locker README requirement — see class KDoc.
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val intent = Intent("onConfigurationChanged")
        intent.putExtra("newConfig", newConfig)
        this.sendBroadcast(intent)
    }
}
