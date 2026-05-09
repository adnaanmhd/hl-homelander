package ai.humynlabs.capture.updater

import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * D-UPG-01..03 — TurboModule surface for the apkRollout-flavor force-upgrade
 * flow. Two methods:
 *
 *   1. [downloadAndVerifyApk] — streams `apk_url` (per `/app/version` response)
 *      to cacheDir while computing SHA-256, deletes-and-fails on mismatch
 *      (T-2.7-01 mitigation), only resolves with `{path, sha256}` on a clean
 *      hash match.
 *
 *   2. [launchInstaller] — checks `canRequestPackageInstalls()`. If denied,
 *      deep-links to `ACTION_MANAGE_UNKNOWN_APP_SOURCES` for THIS app
 *      (RESEARCH § Pitfall 8) and rejects with `INSTALL_NOT_ALLOWED`. If
 *      granted, opens a `PackageInstaller.Session` (MODE_FULL_INSTALL),
 *      streams the verified APK in, and commits with a PendingIntent
 *      broadcast.
 *
 * Both methods dispatch to a single-thread background executor (T-2.7-04
 * adjacent — never block the JS thread; hashing 30 MB on JS would freeze
 * the UI). Per-method error codes:
 *
 *   downloadAndVerifyApk → DOWNLOAD_FAILED, HASH_MISMATCH
 *   launchInstaller      → INSTALL_NOT_ALLOWED, INSTALL_FAILED
 *
 * Plan 02-20 wires this into ForceUpgradeScreen (apkRollout track).
 *
 * Three-layer defense (T-2.7-02 mitigation):
 *   - URL signing       (CloudFront-signed https URL from authenticated backend)
 *   - SHA-256 verify    (this module — gates the install)
 *   - OS consent        (Android per-app "Install unknown apps" toggle)
 */
@ReactModule(name = HumynUpdaterModule.NAME)
class HumynUpdaterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynUpdater"
    }

    /**
     * Single-thread executor — guarantees one download / install at a time and
     * never on the main thread. Hashing 30+ MB on JS or main would block UI.
     */
    private val bgExecutor = Executors.newSingleThreadExecutor()

    override fun getName(): String = NAME

    @ReactMethod
    fun downloadAndVerifyApk(url: String, expectedSha256: String, promise: Promise) {
        bgExecutor.execute {
            var cacheFile: File? = null
            try {
                cacheFile = File(reactApplicationContext.cacheDir, "update-${System.currentTimeMillis()}.apk")
                val md = MessageDigest.getInstance("SHA-256")
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 30_000
                    readTimeout = 60_000
                    // Defense: enforce HTTPS at the URL parse level. Backend
                    // always emits https URLs; reject anything else before
                    // streaming the body (defense-in-depth against a
                    // misconfigured /app/version response).
                    if (this.url.protocol != "https") {
                        throw SecurityException("APK URL must be https; got ${this.url.protocol}")
                    }
                }
                conn.inputStream.use { input ->
                    FileOutputStream(cacheFile).use { out ->
                        val buf = ByteArray(64 * 1024)
                        var n = input.read(buf)
                        while (n != -1) {
                            md.update(buf, 0, n)
                            out.write(buf, 0, n)
                            n = input.read(buf)
                        }
                    }
                }
                val actualHex = md.digest().joinToString("") { "%02x".format(it) }
                if (actualHex != expectedSha256.lowercase()) {
                    val size = cacheFile.length()
                    cacheFile.delete()
                    promise.reject(
                        "HASH_MISMATCH",
                        "expected=$expectedSha256 actual=$actualHex size=$size",
                    )
                    return@execute
                }
                val map: WritableMap = Arguments.createMap().apply {
                    putString("path", cacheFile.absolutePath)
                    putString("sha256", actualHex)
                }
                promise.resolve(map)
            } catch (t: Throwable) {
                cacheFile?.delete()
                promise.reject("DOWNLOAD_FAILED", "${t::class.simpleName}: ${t.message}", t)
            }
        }
    }

    @ReactMethod
    fun launchInstaller(apkPath: String, promise: Promise) {
        bgExecutor.execute {
            try {
                val pkg = reactApplicationContext.packageManager
                if (!pkg.canRequestPackageInstalls()) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + reactApplicationContext.packageName),
                    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(intent)
                    promise.reject(
                        "INSTALL_NOT_ALLOWED",
                        "user must enable install-unknown-apps for this app",
                    )
                    return@execute
                }
                val installer = pkg.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                val sessionId = installer.createSession(params)
                installer.openSession(sessionId).use { session ->
                    FileInputStream(apkPath).use { input ->
                        val len = File(apkPath).length()
                        session.openWrite("base.apk", 0, len).use { out ->
                            input.copyTo(out)
                            session.fsync(out)
                        }
                    }
                    val pi = PendingIntent.getBroadcast(
                        reactApplicationContext,
                        0,
                        Intent("ai.humynlabs.capture.INSTALL_COMPLETE"),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                    )
                    session.commit(pi.intentSender)
                }
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("INSTALL_FAILED", "${t::class.simpleName}: ${t.message}", t)
            }
        }
    }
}
