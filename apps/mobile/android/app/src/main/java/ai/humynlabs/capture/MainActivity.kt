package ai.humynlabs.capture

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * RN 0.83 / Hermes / New Architecture Activity entry point.
 * The JS bundle's main component name MUST match the value passed to
 * `AppRegistry.registerComponent(...)` in apps/mobile/index.js.
 */
class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "HumynLabsCapture"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
