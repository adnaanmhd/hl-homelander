---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 07
id: 02-07-humyn-updater-kotlin-shell
name: HumynUpdater Kotlin module (APK download + SHA-256 verify + PackageInstaller) + JS bridge
type: execute
wave: 1
depends_on: [02-02-test-scaffolding-and-deps]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/src/native/HumynUpdater.ts
  - apps/mobile/__tests__/native/HumynUpdater.test.ts
autonomous: true
requirements: [UPG-03]
must_haves:
  truths:
    - 'HumynUpdaterModule.kt streams APK to cacheDir while computing SHA-256, fails-and-deletes on hash mismatch'
    - 'launchInstaller checks canRequestPackageInstalls(); deep-links to ACTION_MANAGE_UNKNOWN_APP_SOURCES if not granted (RESEARCH § Pitfall 8)'
    - 'Mismatch path NEVER passes the hash-mismatched APK to PackageInstaller (D-UPG-02)'
    - "JS bridge defensively guards on `getFlavorContext().flavor !== 'apkRollout'` before calling either method (RESEARCH § Pattern 3)"
  artifacts:
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt'
      provides: 'downloadAndVerifyApk + launchInstaller TurboModule'
      contains: 'MessageDigest'
    - path: 'apps/mobile/src/native/HumynUpdater.ts'
      provides: 'Typed JS bridge with apkRollout-flavor guard'
      contains: 'downloadAndVerifyApk'
  key_links:
    - from: 'apps/mobile/src/native/HumynUpdater.ts'
      to: 'apps/mobile/src/native/AppFlavor.ts'
      via: "getFlavorContext().flavor !== 'apkRollout' guard"
      pattern: 'apkRollout'
---

<objective>
Author the Kotlin native module that the apkRollout flavor uses to download an APK from `apk_url` (per `/app/version` response), stream-and-hash it to verify against `apk_sha256`, then hand off to `PackageInstaller.Session` (with the per-app "Install unknown apps" deep-link if needed).

Purpose: D-UPG-01..03. Hashing 30+ MB on the JS thread blocks UI (RESEARCH § Anti-Patterns); this MUST be Kotlin-side. PackageInstaller.Session is Kotlin-only by definition (JS cannot drive it).
Output: a fully-implemented Kotlin module (download + hash + installer launch with unknown-apps deep-link guard) + a typed JS bridge with a defensive `apkRollout` flavor guard. Plan 02-20 wires this into the ForceUpgradeScreen.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/android/app/src/apkRollout/AndroidManifest.xml
@apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt
@apps/mobile/src/native/AppFlavor.ts

<interfaces>
<!-- Full Kotlin reference impl (RESEARCH § Code Examples lines 862-920) -->
@ReactMethod
fun downloadAndVerifyApk(url: String, expectedSha256: String, promise: Promise) { ... }

@ReactMethod
fun launchInstaller(apkPath: String, promise: Promise) {
if (!pkg.canRequestPackageInstalls()) {
val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + reactApplicationContext.packageName))
.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
reactApplicationContext.startActivity(intent)
promise.reject("INSTALL_NOT_ALLOWED", "...")
return
}
val installer = pkg.packageInstaller
val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
val sessionId = installer.createSession(params)
installer.openSession(sessionId).use { session ->
FileInputStream(apkPath).use { input ->
session.openWrite("base.apk", 0, input.available().toLong()).use { out -> input.copyTo(out); session.fsync(out) }
}
val pi = PendingIntent.getBroadcast(...)
session.commit(pi.intentSender)
}
promise.resolve(true)
}
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                               | Description                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| backend `/app/version` → mobile (apk_url, apk_sha256)  | URL + hash come over TLS from authenticated backend              |
| HTTPS download → cacheDir                              | bytes verified by SHA-256 hash; mismatch → delete, never install |
| user-granted "Install unknown apps" → PackageInstaller | OS-level consent gate; we cannot bypass                          |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                                     | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                   |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.7-01  | Tampering              | MITM-modified APK on download                                                                                 | mitigate    | TLS + per-bytes SHA-256 verification (D-UPG-02). Hash mismatch deletes file, emits `force_upgrade_apk_hash_mismatch` analytics event (wired in 02-20), NEVER calls PackageInstaller.                                                                                              |
| T-2.7-02  | Elevation of Privilege | Attacker tricks user into installing arbitrary APK via `REQUEST_INSTALL_PACKAGES`                             | mitigate    | Three-layer defense: (a) URL is signed by our backend (CloudFront-signed, https-only); (b) SHA-256 verification gates the install; (c) Android requires per-app "Install unknown apps" toggle — user-consented at OS level (RESEARCH § Pitfall 8). All three must be compromised. |
| T-2.7-03  | Tampering              | apkRollout-flavor manifest opt-in `REQUEST_INSTALL_PACKAGES` accidentally added to base or playStore manifest | mitigate    | Phase 1's `verify-merged-manifests.sh` CI gate enforces flavor scoping; plan 02-22 extends the gate. JS bridge also defensively rejects on `flavor !== 'apkRollout'`.                                                                                                             |
| T-2.7-04  | Information Disclosure | apk_url logged in clear via Crashlytics native crash                                                          | accept      | URLs are CloudFront-signed and TTL-bounded (5 min); leakage of an expired URL is harmless.                                                                                                                                                                                        |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author HumynUpdater Kotlin module + Package + register in MainApplication</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt (NEW), HumynUpdaterPackage.kt (NEW), apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt</files>
  <read_first>
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Force-upgrade APK download + SHA-256 verify (Kotlin)" lines 862-920 (full reference impl)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Pitfall 8: PackageInstaller requires the calling app to be the installer..." lines 686-689
    - apps/mobile/android/app/src/apkRollout/AndroidManifest.xml (verify REQUEST_INSTALL_PACKAGES already declared per Phase 1 D-APK-02)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt (Package shape — copy)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (current getPackages())
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "HumynUpdaterModule.kt"
  </read_first>
  <action>
    1. Confirm `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` declares `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" tools:targetApi="34" />` (Phase 1 plan 01-09 already shipped this; verify only).

    2. Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` verbatim from RESEARCH § Code Examples lines 862-920, adapted for our package:
       ```kotlin
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
       import com.facebook.react.module.annotations.ReactModule
       import java.io.File
       import java.io.FileInputStream
       import java.io.FileOutputStream
       import java.net.HttpURLConnection
       import java.net.URL
       import java.security.MessageDigest
       import java.util.concurrent.Executors

       @ReactModule(name = HumynUpdaterModule.NAME)
       class HumynUpdaterModule(reactContext: ReactApplicationContext) :
           ReactContextBaseJavaModule(reactContext) {

           companion object {
               const val NAME = "HumynUpdater"
           }

           private val bgExecutor = Executors.newSingleThreadExecutor()

           override fun getName() = NAME

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
                           // Defense: enforce HTTPS — the backend always returns https URLs but defensively reject http.
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
                               "expected=$expectedSha256 actual=$actualHex size=$size"
                           )
                           return@execute
                       }
                       promise.resolve(Arguments.makeNativeMap(mapOf(
                           "path" to cacheFile.absolutePath,
                           "sha256" to actualHex,
                       )))
                   } catch (t: Throwable) {
                       cacheFile?.delete()
                       promise.reject("DOWNLOAD_FAILED", "${t::class.simpleName}: ${t.message}", t)
                   }
               }
           }

           @ReactMethod
           fun launchInstaller(apkPath: String, promise: Promise) {
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
                           "user must enable install-unknown-apps for this app"
                       )
                       return
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
       ```

    3. Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterPackage.kt`:
       ```kotlin
       package ai.humynlabs.capture.updater

       import com.facebook.react.ReactPackage
       import com.facebook.react.bridge.NativeModule
       import com.facebook.react.bridge.ReactApplicationContext
       import com.facebook.react.uimanager.ViewManager

       class HumynUpdaterPackage : ReactPackage {
           override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
               listOf(HumynUpdaterModule(reactContext))

           override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
               emptyList()
       }
       ```

    4. Edit `MainApplication.kt`:
       - Import `ai.humynlabs.capture.updater.HumynUpdaterPackage`.
       - In `getPackages()`, add `packages.add(HumynUpdaterPackage())` after `HumynCompatPackage()`.

    5. Run `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` — must compile clean. ALSO run `./gradlew :app:assemblePlayStoreDebug` — must also compile (HumynUpdater module ships in base source set; runtime guard on JS side prevents calls in playStore flavor).

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` succeeds.
    - `grep -q "MessageDigest.getInstance(\"SHA-256\")" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` succeeds.
    - `grep -q "ACTION_MANAGE_UNKNOWN_APP_SOURCES" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` succeeds.
    - `grep -q "HASH_MISMATCH" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt && grep -q "cacheFile.delete()" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` succeeds (delete on mismatch).
    - `grep -q "this.url.protocol != \"https\"" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` succeeds (HTTPS-only enforcement).
    - `grep -q "HumynUpdaterPackage" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` succeeds.
    - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0.
    - `cd apps/mobile/android && ./gradlew :app:assemblePlayStoreDebug` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug -q && ./gradlew :app:assemblePlayStoreDebug -q && grep -q "MessageDigest" app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt && grep -q "HumynUpdaterPackage" app/src/main/java/ai/humynlabs/capture/MainApplication.kt</automated>
  </verify>
  <done>HumynUpdater Kotlin module ships full impl + Package + MainApplication registration; both apkRollout and playStore flavors compile.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: HumynUpdater.ts JS bridge with apkRollout flavor guard</name>
  <files>apps/mobile/src/native/HumynUpdater.ts (NEW), apps/mobile/__tests__/native/HumynUpdater.test.ts (NEW)</files>
  <read_first>
    - apps/mobile/src/native/HumynCompat.ts (Task 02-06 — analog typed bridge)
    - apps/mobile/src/native/AppFlavor.ts (Task 02-04 — getFlavorContext)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Pattern 3: Per-flavor manifest scoping" + "HumynUpdater.ts" guard requirement (lines 391-397)
  </read_first>
  <behavior>
    Test 1: When `getFlavorContext().flavor === 'playStore'` → `downloadAndVerifyApk(...)` rejects with an error matching /apkRollout/ (refusal — defensive guard).
    Test 2: When flavor is apkRollout AND NativeModules.HumynUpdater is undefined → rejects with "HumynUpdater native module not registered".
    Test 3: When flavor is apkRollout AND module is mocked → forwards the call, returns the resolved result.
    Test 4: `launchInstaller(...)` rejects with `INSTALL_NOT_ALLOWED` when native rejects with that code (verifies error code passthrough).
  </behavior>
  <action>
    Create `apps/mobile/src/native/HumynUpdater.ts`:
    ```ts
    import { NativeModules } from 'react-native';
    import { getFlavorContext } from './AppFlavor';

    export interface DownloadResult { path: string; sha256: string; }

    interface HumynUpdaterNativeModule {
      downloadAndVerifyApk(url: string, expectedSha256: string): Promise<DownloadResult>;
      launchInstaller(apkPath: string): Promise<boolean>;
    }

    const native = NativeModules.HumynUpdater as HumynUpdaterNativeModule | undefined;

    function ensureApkRolloutFlavor(): void {
      const ctx = getFlavorContext();
      if (ctx.flavor !== 'apkRollout') {
        throw new Error(
          `HumynUpdater is only valid on the apkRollout flavor; current flavor=${ctx.flavor}. Use the market:// fallback for playStore.`,
        );
      }
    }

    function ensure(): HumynUpdaterNativeModule {
      ensureApkRolloutFlavor();
      if (!native) {
        throw new Error(
          'HumynUpdater native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
        );
      }
      return native;
    }

    export async function downloadAndVerifyApk(url: string, expectedSha256: string): Promise<DownloadResult> {
      return ensure().downloadAndVerifyApk(url, expectedSha256);
    }

    export async function launchInstaller(apkPath: string): Promise<boolean> {
      return ensure().launchInstaller(apkPath);
    }
    ```

    Create the test file with the four behaviors above. Mock `./AppFlavor` to control `getFlavorContext()` per test; mock `NativeModules.HumynUpdater` directly for the success/failure paths.

  </action>
  <acceptance_criteria>
    - `grep -q "ensureApkRolloutFlavor" apps/mobile/src/native/HumynUpdater.ts` succeeds.
    - `grep -q "HumynUpdater is only valid on the apkRollout flavor" apps/mobile/src/native/HumynUpdater.ts` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/native/HumynUpdater.test.ts` passes (4 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/native/HumynUpdater.test.ts</automated>
  </verify>
  <done>HumynUpdater.ts bridge with apkRollout flavor guard + 4 unit tests pass.</done>
</task>

</tasks>

<verification>
- HumynUpdater Kotlin module compiles for both flavors.
- SHA-256 mismatch deletes the local file before rejecting.
- HTTPS-only enforcement at the URL parse level.
- JS bridge defensively rejects on playStore flavor.
- `INSTALL_NOT_ALLOWED` deep-links to ACTION_MANAGE_UNKNOWN_APP_SOURCES.
</verification>

<success_criteria>

- D-UPG-01..03 Kotlin layer complete.
- Plan 02-20 wires this into ForceUpgradeScreen for the apkRollout track.
- T-2.7-01/02/03 mitigations present in code.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-07-SUMMARY.md` documenting the three-layer install defense (URL signing + SHA-256 + OS consent) and the deep-link path for unknown-apps consent.
</output>
