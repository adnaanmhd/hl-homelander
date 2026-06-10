package ai.humynlabs.capture.upload

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * Phase 5 / Plan 05-07 — battery-optimization exemption (UP-09) + best-effort
 * OEM autostart deep-links.
 *
 * The upload pipeline survives backgrounding via the FGS + the UIDT JobService,
 * but aggressive OEM "battery savers" (MIUI/HyperOS, ColorOS, FunTouch, OneUI,
 * EMUI, …) still kill background apps that aren't whitelisted. The first-upload
 * walkthrough ([ai.humynlabs.capture.upload via the BatteryOptimizationScreen])
 * surfaces:
 *  1. [requestExempt] — the STABLE AOSP path: `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
 *     (the system "allow unrestricted" prompt), falling back to the general
 *     `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` list, both try/caught.
 *     ALWAYS tried first — it works on every Android.
 *  2. [openOemAutostartIfAvailable] — a best-effort jump to the vendor's
 *     "autostart" screen IF one of the known [OEM_AUTOSTART] `ComponentName`s
 *     resolves on this device. These are community-maintained and stale on newer
 *     ROMs, so EVERY one is `resolveActivity`-gated AND wrapped in try/catch — a
 *     wrong/dead component is a silent no-op, never a crash (T-5-07-01). The
 *     walkthrough copy stands alone ("Settings → Apps → Homelander → Battery →
 *     Unrestricted, and turn on Autostart if your phone has it") so a missing
 *     deep-link doesn't strand the user.
 *
 * Pitfall 1 — OEM deep-links dead/renamed: hence the resolveActivity gate, the
 * AOSP fallback, the standalone copy, and the re-show-on-update gate (MIUI may
 * revert the exemption on an app update — that's [shouldShowBatteryOptimizationPrompt]
 * on the JS side, not here).
 */
object BatteryOptimizationHelper {

    private const val TAG = "HumynBattOpt"

    /** `true` iff the app is already whitelisted from battery optimizations. */
    fun isExempt(ctx: Context): Boolean {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return runCatching { pm.isIgnoringBatteryOptimizations(ctx.packageName) }.getOrDefault(false)
    }

    /**
     * Open the AOSP battery-optimization exemption prompt. ALWAYS tries the
     * stable `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` first (the direct
     * "allow unrestricted for Homelander" dialog — requires the
     * `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` manifest perm, declared in Plan 05-04);
     * if that's somehow unhandled, falls back to the general
     * `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` list. Both try/caught — never crashes.
     *
     * Phase 5 (2026-06-10, Bug 5) — prefer the current [Activity] (NO
     * `FLAG_ACTIVITY_NEW_TASK`): launching from the app context with NEW_TASK
     * puts the system dialog in its OWN task on some OEMs, so dismissing it
     * lands on the LAUNCHER instead of the app — exactly the "app exited
     * during the battery ask" presentation. With an Activity context the
     * dialog stays in the app's task and accept/deny/dismiss all return to
     * the app. Falls back to the old appContext+NEW_TASK path when no
     * Activity is available (e.g. a background JS call).
     */
    fun requestExempt(ctx: Context, activity: Activity? = null) {
        val launch: (Intent) -> Unit = if (activity != null) {
            { intent -> activity.startActivity(intent) }
        } else {
            { intent -> ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
        val direct = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${ctx.packageName}"),
        )
        try {
            launch(direct)
            return
        } catch (e: Exception) {
            Log.w(TAG, "ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS unhandled — falling back to the list", e)
        }
        try {
            launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        } catch (e: Exception) {
            Log.w(TAG, "ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS unhandled — user must navigate Settings manually", e)
        }
    }

    /**
     * Best-effort OEM "autostart" / background-permission activities. Community-
     * maintained (e.g. dontkillmyapp.com) and STALE on newer ROMs — every one is
     * `resolveActivity`-gated before launch, so a renamed/removed component is a
     * silent no-op. Order is "most common first" but irrelevant since at most one
     * resolves on a given device.
     */
    private val OEM_AUTOSTART: List<ComponentName> = listOf(
        // Xiaomi — MIUI / HyperOS.
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
        // Oppo — ColorOS (two known activity names across versions).
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
        // Older Oppo.
        ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
        // Vivo — FunTouch.
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        // Samsung — OneUI device-care battery screen.
        ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),
        // Huawei — EMUI protected-apps.
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
        // Letv / LeEco.
        ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"),
    )

    /** `true` if the named package is installed on this device. */
    private fun packageInstalled(pm: PackageManager, packageName: String): Boolean =
        runCatching {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(packageName, 0)
            true
        }.getOrDefault(false)

    /**
     * `true` if a candidate OEM autostart activity is reachable on this device.
     * Two gates, both required: the vendor's security-center package is
     * installed AND the explicit `ComponentName` resolves to an activity. The
     * package check is the cheap, ROM-honest first filter (a non-Xiaomi phone
     * doesn't have `com.miui.securitycenter` at all); the `resolveActivity` gate
     * then guards against the activity having been renamed/removed within an
     * installed vendor app.
     */
    fun oemAutostartAvailable(ctx: Context): Boolean {
        val pm = ctx.packageManager
        return OEM_AUTOSTART.any { cn ->
            runCatching {
                packageInstalled(pm, cn.packageName) &&
                    Intent().setComponent(cn).resolveActivity(pm) != null
            }.getOrDefault(false)
        }
    }

    /**
     * Launch the FIRST reachable OEM autostart activity (package installed AND
     * the `ComponentName` resolves). Returns `true` if one was launched, `false`
     * (no crash) if NONE is reachable — the walkthrough copy stands alone in
     * that case. Each `startActivity` is try/caught (a component that resolves
     * but throws on launch is also a no-op).
     */
    fun openOemAutostartIfAvailable(ctx: Context): Boolean {
        val pm = ctx.packageManager
        for (cn in OEM_AUTOSTART) {
            val reachable = runCatching {
                packageInstalled(pm, cn.packageName) &&
                    Intent().setComponent(cn).resolveActivity(pm) != null
            }.getOrDefault(false)
            if (!reachable) continue
            val intent = Intent().setComponent(cn).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                ctx.startActivity(intent)
                return true
            } catch (e: Exception) {
                Log.w(TAG, "OEM autostart activity $cn reachable but failed to launch", e)
            }
        }
        return false
    }
}
