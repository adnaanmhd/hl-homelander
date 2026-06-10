package ai.humynlabs.capture.upload

import android.app.Activity
import android.app.Application
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Plan 05-07 Task 2 — `BatteryOptimizationHelper` (the UP-09 AOSP exemption
 * request + the package-installed + `resolveActivity`-gated OEM autostart
 * deep-links).
 *
 * Covers (T-5-07-01):
 *  - `oemAutostartAvailable` / `openOemAutostartIfAvailable` are `false` / a
 *    no-op (no `startActivity`, no crash) on a stock device where none of the
 *    vendor security-center packages are installed;
 *  - once a fake MIUI `securitycenter` activity is registered (which also makes
 *    its package "installed"), `oemAutostartAvailable` is `true` and
 *    `openOemAutostartIfAvailable` launches that exact `ComponentName` with
 *    `FLAG_ACTIVITY_NEW_TASK` and returns `true`;
 *  - `requestExempt` never crashes;
 *  - `isExempt` returns a boolean (Robolectric defaults to not-exempt).
 *
 * The two-gate design (vendor package installed AND the explicit component
 * resolves) sidesteps Robolectric's habit of fabricating a `ResolveInfo` for an
 * explicit-`ComponentName` intent whose package isn't installed — and is the
 * more ROM-honest production behaviour anyway (a non-Xiaomi phone has no
 * `com.miui.securitycenter` at all).
 *
 * `application = Application::class` — bypasses `MainApplication.onCreate`
 * `SoLoader.init` NPE under Robolectric (canonical Phase 3/4 pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class BatteryOptimizationHelperTest {

    private fun app(): Application = RuntimeEnvironment.getApplication()

    private val miuiAutostart = ComponentName(
        "com.miui.securitycenter",
        "com.miui.permcenter.autostart.AutoStartManagementActivity",
    )

    @Test
    fun `oemAutostartAvailable is false on a stock device (no vendor security-center package)`() {
        assertFalse(BatteryOptimizationHelper.oemAutostartAvailable(app()))
    }

    @Test
    fun `openOemAutostartIfAvailable returns false and does NOT startActivity when nothing is reachable`() {
        val ctx = app()
        val started = BatteryOptimizationHelper.openOemAutostartIfAvailable(ctx)
        assertFalse("no reachable OEM activity → false (no crash)", started)
        assertNull("nothing was launched", shadowOf(ctx).nextStartedActivity)
    }

    @Test
    fun `openOemAutostartIfAvailable launches the resolved OEM activity and returns true`() {
        val ctx = app()
        // Register a fake MIUI autostart activity — this also makes
        // com.miui.securitycenter "installed" in the shadow PackageManager.
        shadowOf(ctx.packageManager).addActivityIfNotPresent(miuiAutostart)

        assertTrue("a registered OEM activity → available", BatteryOptimizationHelper.oemAutostartAvailable(ctx))

        val started = BatteryOptimizationHelper.openOemAutostartIfAvailable(ctx)
        assertTrue("launched → true", started)

        val launched: Intent? = shadowOf(ctx).nextStartedActivity
        assertEquals(
            "must have launched the MIUI AutoStartManagementActivity component",
            miuiAutostart,
            launched?.component,
        )
        // Started from a non-Activity context → must carry FLAG_ACTIVITY_NEW_TASK.
        assertEquals(
            Intent.FLAG_ACTIVITY_NEW_TASK,
            (launched?.flags ?: 0) and Intent.FLAG_ACTIVITY_NEW_TASK,
        )
    }

    @Test
    fun `requestExempt never throws`() {
        // The direct ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS / the settings
        // fallback may or may not be handled by Robolectric's shadow PM; either
        // way the helper try/catches both — reaching here without an exception
        // is the assertion.
        BatteryOptimizationHelper.requestExempt(app())
    }

    @Test
    fun `requestExempt prefers the Activity context with NO NEW_TASK flag (Phase 5, Bug 5)`() {
        // Launching from the app context with FLAG_ACTIVITY_NEW_TASK puts the
        // system dialog in its own task on some OEMs — dismissing it then lands
        // on the launcher ("the app exited"). With an Activity the intent must
        // launch from that Activity WITHOUT the flag so dismissal returns to us.
        val activity = Robolectric.buildActivity(Activity::class.java).create().get()
        BatteryOptimizationHelper.requestExempt(app(), activity)

        val launched: Intent? = shadowOf(activity).nextStartedActivity
        assertEquals(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, launched?.action)
        assertEquals(
            "Activity-context launch must NOT carry FLAG_ACTIVITY_NEW_TASK",
            0,
            (launched?.flags ?: 0) and Intent.FLAG_ACTIVITY_NEW_TASK,
        )
    }

    @Test
    fun `requestExempt without an Activity falls back to appContext plus NEW_TASK`() {
        val ctx = app()
        BatteryOptimizationHelper.requestExempt(ctx)

        val launched: Intent? = shadowOf(ctx).nextStartedActivity
        assertEquals(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, launched?.action)
        assertEquals(
            "non-Activity context requires FLAG_ACTIVITY_NEW_TASK",
            Intent.FLAG_ACTIVITY_NEW_TASK,
            (launched?.flags ?: 0) and Intent.FLAG_ACTIVITY_NEW_TASK,
        )
    }

    @Test
    fun `isExempt does not crash and returns a boolean`() {
        // Robolectric's ShadowPowerManager.isIgnoringBatteryOptimizations defaults
        // to false; the helper just must not throw.
        assertFalse(BatteryOptimizationHelper.isExempt(app()))
    }
}
