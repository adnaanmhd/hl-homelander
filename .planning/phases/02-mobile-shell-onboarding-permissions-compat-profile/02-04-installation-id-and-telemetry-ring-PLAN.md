---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 04
id: 02-04-installation-id-and-telemetry-ring
name: AppFlavor extension (installation_id + versionName/Code/deviceModel) + telemetry ring + analytics wrapper
type: execute
wave: 1
depends_on: [02-03-state-store-and-hydration]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt
  - apps/mobile/src/native/AppFlavor.ts
  - apps/mobile/src/services/installationId.ts
  - apps/mobile/src/services/telemetryRing.ts
  - apps/mobile/src/util/analytics.ts
  - apps/mobile/__tests__/services/installationId.test.ts
  - apps/mobile/__tests__/services/telemetryRing.test.ts
  - apps/mobile/__tests__/util/analytics.test.ts
autonomous: true
requirements: [HELP-05, PROF-05]
must_haves:
  truths:
    - 'AppFlavor Kotlin module exposes versionName, versionCode, deviceModel as sync constants and getOrMintInstallationId() as an async method'
    - 'JS-side installationId service mints/persists a UUID via Kotlin (no JS UUID lib dependency)'
    - 'telemetryRing FIFO-trims to last 100 entries on every append'
    - 'analytics.ts wraps Firebase Analytics calls AND mirrors every event into telemetryRing'
    - 'PROF-05 footer can read versionName + versionCode + flavor from AppFlavor.getConstants()'
    - 'HELP-05 diagnostic snapshot can read telemetryRing.snapshot() to attach last 100 events'
  artifacts:
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt'
      provides: 'Extended Kotlin module with versionName, versionCode, deviceModel, getOrMintInstallationId'
      contains: 'VERSION_NAME'
    - path: 'apps/mobile/src/native/AppFlavor.ts'
      provides: 'Typed JS surface for the extended Kotlin module'
      contains: 'getOrMintInstallationId'
    - path: 'apps/mobile/src/services/installationId.ts'
      provides: 'Mint-or-read UUID helper persisted in MMKV'
      contains: 'INSTALLATION_ID'
    - path: 'apps/mobile/src/services/telemetryRing.ts'
      provides: 'FIFO 100-entry ring buffer service'
      contains: 'RING_CAP'
    - path: 'apps/mobile/src/util/analytics.ts'
      provides: 'Firebase Analytics wrapper that mirrors events to telemetryRing'
      contains: 'logEvent'
  key_links:
    - from: 'apps/mobile/src/services/telemetryRing.ts'
      to: 'apps/mobile/src/state/mmkv.ts'
      via: 'import secureMmkv'
      pattern: "from '\\.\\./state/mmkv'"
    - from: 'apps/mobile/src/util/analytics.ts'
      to: 'apps/mobile/src/services/telemetryRing.ts'
      via: 'telemetryRing.append'
      pattern: "telemetryRing\\.append"
    - from: 'apps/mobile/src/services/installationId.ts'
      to: 'apps/mobile/src/native/AppFlavor.ts'
      via: 'getOrMintInstallationId() native call'
      pattern: 'getOrMintInstallationId'
---

<objective>
Mint and persist the per-install UUID (`installation_id.v1`), build the FIFO telemetry ring buffer, and the analytics wrapper that fans every Firebase Analytics event into the ring buffer for HELP-05's diagnostic snapshot.

Purpose: D-COMPAT-03 (compat signature includes installation_id) needs the UUID minted before the first compat run. D-HELP-02 (diagnostic-snapshot ring buffer) needs the ring + the analytics fan-out. PROF-05 (app version + build identifier in Profile footer) needs the AppFlavor extension to expose `versionName`/`versionCode`.
Output: services consumable by every subsequent plan that fires telemetry, surfaces a diagnostic snapshot, or computes the compat signature.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt
@apps/mobile/src/native/AppFlavor.ts
@apps/mobile/src/services/auth.ts
@apps/mobile/src/state/mmkv.ts
@apps/mobile/src/state/keys.ts
@engineering-handoff.md

<interfaces>
<!-- Existing AppFlavor Kotlin getConstants pattern (02-PATTERNS.md lines 477-487) -->
override fun getConstants(): MutableMap<String, Any> {
    return hashMapOf(
        "flavor" to BuildConfig.FLAVOR_NAME,
        "applicationId" to BuildConfig.APPLICATION_ID,
        // Phase 2 additions:
        "versionName" to BuildConfig.VERSION_NAME,
        "versionCode" to BuildConfig.VERSION_CODE,
        "deviceModel" to Build.MODEL,
    )
}

<!-- engineering-handoff.md §11 telemetry event funnel (Phase 2 events) -->

signup_started, signup_consent_checked, signup_terms_opened, signup_google_started, signup_google_completed, signup_google_failed
permission_camera_requested, permission_camera_granted, permission_camera_denied, permission_mic_requested, permission_mic_granted, permission_mic_denied
compat_started, compat_check_passed, compat_check_failed, compat_completed
profile_viewed, profile_edited, profile_logout, profile_delete_requested, profile_delete_confirmed
help_opened, help_accordion_expanded, help_contact_support_tapped, help_report_problem_submitted
upg_check_started, upg_force_upgrade_shown, upg_force_upgrade_apk_downloaded, upg_force_upgrade_apk_hash_mismatch, upg_soft_banner_shown, upg_soft_banner_dismissed, upg_soft_banner_tapped
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                                 | Description                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| Kotlin → SharedPreferences (installation_id persistence) | local store; same trust as MMKV                                     |
| Telemetry ring → diagnostic snapshot → POST /feedback    | exfiltrates last 100 events to backend; events MUST NOT contain PII |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                      | Disposition | Mitigation Plan                                                                                                                                                                                                             |
| --------- | ---------------------- | -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.4-01  | Information Disclosure | telemetryRing event payload includes user-identifying data     | mitigate    | Per RESEARCH § Security Domain row 8: events MUST NOT include name, email, task name, query content, or recording filenames — only IDs, durations, sizes, network type. Plan-checker enforces via grep on event call sites. |
| T-2.4-02  | Tampering              | installation_id forged by user via MMKV/SharedPreferences edit | accept      | Worst case: skips one compat re-run on a real new device; capture-spec runtime gate is the binding integrity check (Phase 3).                                                                                               |
| T-2.4-03  | Denial of Service      | telemetry ring grows unboundedly                               | mitigate    | RING_CAP = 100 with FIFO `splice(0, arr.length - 100)` on every append; stored as JSON in single MMKV string.                                                                                                               |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Extend AppFlavor Kotlin module with versionName/versionCode/deviceModel + getOrMintInstallationId</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt, apps/mobile/src/native/AppFlavor.ts</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt (current Kotlin shape — Pattern 37 from Phase 1 plan 01-09)
    - apps/mobile/src/native/AppFlavor.ts (current TS shape)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "AppFlavorModule.kt (modify — extend with new constants + methods)" lines 471-490
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Open Questions" item 3 (recommended: extend AppFlavor with getOrMintInstallationId, avoid adding a JS UUID lib)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § specifics (installation_id is the only client-minted identifier)
  </read_first>
  <action>
    1. Extend `AppFlavorModule.kt`:
       - Update `getConstants()` to include `versionName`, `versionCode`, `deviceModel`:
         ```kotlin
         override fun getConstants(): MutableMap<String, Any> {
             return hashMapOf(
                 "flavor" to BuildConfig.FLAVOR_NAME,
                 "applicationId" to BuildConfig.APPLICATION_ID,
                 "versionName" to BuildConfig.VERSION_NAME,
                 "versionCode" to BuildConfig.VERSION_CODE,
                 "deviceModel" to Build.MODEL,
             )
         }
         ```
         (`Build.MODEL` requires `import android.os.Build`.)
       - Add `getOrMintInstallationId(promise: Promise)` ReactMethod. Persist to a small Kotlin SharedPreferences (NOT MMKV — keep this independent of the JS layer's MMKV instance so a wiped JS-side state can't lose it):
         ```kotlin
         @ReactMethod
         fun getOrMintInstallationId(promise: Promise) {
             try {
                 val prefs = reactApplicationContext.getSharedPreferences("humyn_install", Context.MODE_PRIVATE)
                 val existing = prefs.getString("installation_id", null)
                 if (existing != null) {
                     promise.resolve(existing)
                     return
                 }
                 val minted = java.util.UUID.randomUUID().toString()
                 prefs.edit().putString("installation_id", minted).apply()
                 promise.resolve(minted)
             } catch (t: Throwable) {
                 promise.reject("INSTALL_ID_ERROR", "${t::class.simpleName}: ${t.message}", t)
             }
         }
         ```
       - Confirm `import android.content.Context` and `import com.facebook.react.bridge.Promise` are present.

    2. Extend `apps/mobile/src/native/AppFlavor.ts`:
       ```ts
       interface AppFlavorNativeModule {
         flavor: 'apkRollout' | 'playStore';
         applicationId: 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk';
         versionName: string;
         versionCode: number;
         deviceModel: string;
         get(): Promise<{ flavor: string; applicationId: string }>;
         getOrMintInstallationId(): Promise<string>;
       }

       const native = NativeModules.AppFlavor as AppFlavorNativeModule | undefined;

       export interface FlavorContext {
         flavor: 'apkRollout' | 'playStore';
         applicationId: string;
         versionName: string;
         versionCode: number;
         deviceModel: string;
       }

       export function getFlavorContext(): FlavorContext {
         if (!native) throw new Error('AppFlavor native module not registered');
         return {
           flavor: native.flavor,
           applicationId: native.applicationId,
           versionName: native.versionName,
           versionCode: native.versionCode,
           deviceModel: native.deviceModel,
         };
       }

       export async function getOrMintInstallationId(): Promise<string> {
         if (!native) throw new Error('AppFlavor native module not registered');
         return native.getOrMintInstallationId();
       }
       ```

    3. Update the existing test (or add `apps/mobile/__tests__/native/AppFlavor.test.ts` if missing): mock `NativeModules.AppFlavor` with all fields populated and confirm `getFlavorContext()` returns the expected shape.

  </action>
  <acceptance_criteria>
    - `grep -q "BuildConfig.VERSION_NAME" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` succeeds.
    - `grep -q "Build.MODEL" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` succeeds.
    - `grep -q "getOrMintInstallationId" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` succeeds.
    - `grep -q "humyn_install" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` succeeds.
    - `grep -q "versionName: string" apps/mobile/src/native/AppFlavor.ts && grep -q "versionCode: number" apps/mobile/src/native/AppFlavor.ts && grep -q "getOrMintInstallationId" apps/mobile/src/native/AppFlavor.ts` succeeds.
    - `cd apps/mobile && npm run typecheck` exits 0.
    - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0 (Kotlin compile passes).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && grep -q "getOrMintInstallationId" src/native/AppFlavor.ts && grep -q "getOrMintInstallationId" android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt && cd android && ./gradlew :app:assembleApkRolloutDebug -q</automated>
  </verify>
  <done>AppFlavor exposes versionName/versionCode/deviceModel sync + getOrMintInstallationId async; Kotlin compiles; typecheck clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: installationId service + telemetryRing service + analytics wrapper</name>
  <files>apps/mobile/src/services/installationId.ts (NEW), apps/mobile/src/services/telemetryRing.ts (NEW), apps/mobile/src/util/analytics.ts (NEW), apps/mobile/__tests__/services/installationId.test.ts (NEW), apps/mobile/__tests__/services/telemetryRing.test.ts (NEW), apps/mobile/__tests__/util/analytics.test.ts (NEW)</files>
  <read_first>
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "installationId.ts" lines 247-269 + "telemetryRing.ts" lines 272-298
    - apps/mobile/src/state/mmkv.ts (Task 02-03)
    - apps/mobile/src/state/keys.ts (Task 02-03)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-HELP-02 (telemetry ring contract)
    - engineering-handoff.md §11 (event funnel — Phase 2 events list above in `<interfaces>`)
  </read_first>
  <behavior>
    Test 1 (installationId.test.ts): First call to `getInstallationId()` on a fresh install:
      - mocks `NativeModules.AppFlavor.getOrMintInstallationId` to resolve with 'uuid-fake-001'
      - mocks MMKV to return `undefined` for `installation_id.v1`
      - asserts result is 'uuid-fake-001' AND MMKV was called with `set('installation_id.v1', 'uuid-fake-001')`
    Test 2 (installationId.test.ts): Second call returns the cached value without calling Kotlin:
      - mocks MMKV to return 'uuid-fake-001' for `installation_id.v1`
      - asserts result is 'uuid-fake-001' AND `getOrMintInstallationId` was NOT called.
    Test 3 (telemetryRing.test.ts): Empty buffer → `snapshot()` returns `[]`.
    Test 4 (telemetryRing.test.ts): Append 5 events → `snapshot()` returns those 5 in insertion order.
    Test 5 (telemetryRing.test.ts): Append 105 events → `snapshot()` returns the LAST 100 (FIFO trim).
    Test 6 (telemetryRing.test.ts): `clear()` empties the buffer.
    Test 7 (analytics.test.ts): `logEvent('signup_started', { foo: 'bar' })`:
      - calls `firebaseAnalytics.logEvent` once with `('signup_started', { foo: 'bar' })`
      - calls `telemetryRing.append` once with `{ name: 'signup_started', ts: <Date.now>, props: { foo: 'bar' } }`.
    Test 8 (analytics.test.ts): A blocked event name (event name not in EVENT_NAMES allowlist, e.g. `bogus_event`) throws or is silently dropped (planner picks; recommend silent drop with `__DEV__` warn).
  </behavior>
  <action>
    1. Create `apps/mobile/src/services/installationId.ts`:
       ```ts
       import { secureMmkv } from '../state/mmkv';
       import { KEYS } from '../state/keys';
       import { getOrMintInstallationId as nativeMintOrFetch } from '../native/AppFlavor';

       /**
        * Mint-or-read the installation UUID. The authoritative store is Kotlin
        * SharedPreferences (humyn_install / installation_id) so JS-side MMKV
        * wipes don't lose it. We mirror to MMKV at `installation_id.v1` for
        * fast sync access from compat-signature computation.
        *
        * Phase 2 D-COMPAT-03; Open Question 3 resolution.
        */
       export async function getInstallationId(): Promise<string> {
         const cached = secureMmkv.getString(KEYS.INSTALLATION_ID);
         if (cached) return cached;
         const minted = await nativeMintOrFetch();
         secureMmkv.set(KEYS.INSTALLATION_ID, minted);
         return minted;
       }

       /** Sync read; returns null if not yet hydrated (use only AFTER hydrate()). */
       export function getInstallationIdSync(): string | null {
         return secureMmkv.getString(KEYS.INSTALLATION_ID) ?? null;
       }
       ```

    2. Create `apps/mobile/src/services/telemetryRing.ts`:
       ```ts
       import { secureMmkv } from '../state/mmkv';
       import { KEYS } from '../state/keys';

       export interface TelemetryEvent {
         name: string;
         ts: number;            // epoch ms
         props: Record<string, string | number | boolean>;
       }

       const RING_CAP = 100;

       function read(): TelemetryEvent[] {
         const raw = secureMmkv.getString(KEYS.TELEMETRY_RING);
         if (!raw) return [];
         try {
           const parsed = JSON.parse(raw);
           if (Array.isArray(parsed)) return parsed as TelemetryEvent[];
         } catch (_e) { /* fallthrough */ }
         return [];
       }

       function write(arr: TelemetryEvent[]): void {
         secureMmkv.set(KEYS.TELEMETRY_RING, JSON.stringify(arr));
       }

       export const telemetryRing = {
         append(event: TelemetryEvent): void {
           const arr = read();
           arr.push(event);
           if (arr.length > RING_CAP) arr.splice(0, arr.length - RING_CAP);
           write(arr);
         },
         snapshot(): TelemetryEvent[] {
           return read();
         },
         clear(): void {
           secureMmkv.delete(KEYS.TELEMETRY_RING);
         },
       };
       ```

    3. Create `apps/mobile/src/util/analytics.ts`:
       ```ts
       import { telemetryRing } from '../services/telemetryRing';

       /**
        * Frozen allowlist of every Phase 2 event we fire. Adding a new event
        * requires a code review pass; runtime offenders are dropped with a dev
        * warning. Source: engineering-handoff.md §11 + D-HELP-02 telemetry ring.
        *
        * Type-level schema-creep guard (matches Phase 1 EVENT_NAMES discipline).
        */
       export const EVENT_NAMES = [
         // Splash + version
         'splash_shown', 'upg_check_started', 'upg_force_upgrade_shown',
         'upg_force_upgrade_apk_downloaded', 'upg_force_upgrade_apk_hash_mismatch',
         'upg_soft_banner_shown', 'upg_soft_banner_dismissed', 'upg_soft_banner_tapped',
         // Sign-up
         'signup_started', 'signup_consent_checked', 'signup_terms_opened',
         'signup_google_started', 'signup_google_completed', 'signup_google_failed',
         // Permissions
         'permission_camera_requested', 'permission_camera_granted', 'permission_camera_denied',
         'permission_mic_requested', 'permission_mic_granted', 'permission_mic_denied',
         // Compat
         'compat_started', 'compat_check_passed', 'compat_check_failed', 'compat_completed',
         // Onboarding
         'rig_tutorial_shown', 'rig_no_rig_link_tapped',
         // Profile
         'profile_viewed', 'profile_edited', 'profile_logout', 'profile_delete_requested', 'profile_delete_confirmed',
         // Help
         'help_opened', 'help_accordion_expanded', 'help_contact_support_tapped', 'help_report_problem_submitted',
       ] as const;
       export type EventName = typeof EVENT_NAMES[number];

       const eventSet = new Set<string>(EVENT_NAMES);

       /**
        * Log an analytics event. Mirrors to telemetryRing for HELP-05 diagnostic snapshot.
        * Phase 2 stub: the firebase call lands in plan 02-09 / 02-19 wiring; we keep
        * the surface stable so call sites don't change.
        */
       export function logEvent(
         name: EventName,
         props: Record<string, string | number | boolean> = {},
       ): void {
         if (!eventSet.has(name)) {
           if (__DEV__) console.warn(`[analytics] event '${name}' not in EVENT_NAMES allowlist; dropped`);
           return;
         }
         try {
           // Mirror to ring for HELP-05 diagnostic-snapshot. PII guard:
           // do NOT add fields like email, name, taskName, queryContent, recordingFilename.
           telemetryRing.append({ name, ts: Date.now(), props });
           // Firebase Analytics handoff is wired in plan 02-09's signup screen:
           //   import analytics from '@react-native-firebase/analytics';
           //   await analytics().logEvent(name, props);
           // Stubbed here so call sites compile without Firebase wiring.
         } catch (e) {
           if (__DEV__) console.warn('[analytics] logEvent failed', e);
         }
       }
       ```

    4. Create the three test files. Use the `<behavior>` block for the test plan. Mock `secureMmkv` via the `vi.mock('react-native-mmkv', ...)` in `vitest.setup.ts`. For `installationId.test.ts`, also mock `../native/AppFlavor` via `vi.mock`.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/services/installationId.ts && grep -q "getOrMintInstallationId" apps/mobile/src/services/installationId.ts` succeeds.
    - `test -f apps/mobile/src/services/telemetryRing.ts && grep -q "RING_CAP = 100" apps/mobile/src/services/telemetryRing.ts && grep -q "splice(0," apps/mobile/src/services/telemetryRing.ts` succeeds.
    - `test -f apps/mobile/src/util/analytics.ts && grep -q "EVENT_NAMES" apps/mobile/src/util/analytics.ts && grep -q "telemetryRing.append" apps/mobile/src/util/analytics.ts` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/services/installationId.test.ts __tests__/services/telemetryRing.test.ts __tests__/util/analytics.test.ts` passes (8 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/services/installationId.test.ts __tests__/services/telemetryRing.test.ts __tests__/util/analytics.test.ts</automated>
  </verify>
  <done>installationId, telemetryRing, analytics services exist; 8 unit tests cover mint/cache/append/trim/clear/log/dropped-event paths; typecheck clean.</done>
</task>

</tasks>

<verification>
- Kotlin AppFlavor extension compiles (Gradle assembleApkRolloutDebug).
- TS typecheck clean.
- 8 service tests + state tests + Phase 1 tests all green.
- PROF-05 + HELP-05 prerequisite services in place.
</verification>

<success_criteria>

- AppFlavor exposes versionName/versionCode/deviceModel/getOrMintInstallationId.
- installationId service mints + persists UUID via Kotlin (no JS UUID dep added).
- telemetryRing FIFO-trims to last 100.
- analytics.ts wraps Firebase Analytics with PII allowlist guard + ring mirroring.
- HELP-05 + PROF-05 + AUTH-11 (compat signature) prerequisites complete.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-04-SUMMARY.md` documenting the EVENT_NAMES allowlist, the Kotlin SharedPreferences key (`humyn_install` / `installation_id`), and the PII guard rules for telemetry props.
</output>
