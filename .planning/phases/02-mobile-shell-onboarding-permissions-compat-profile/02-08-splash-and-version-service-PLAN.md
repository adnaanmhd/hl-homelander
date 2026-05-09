---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 08
id: 02-08-splash-and-version-service
name: Splash screen + versionService (GET /app/version + 6h cache + force-upgrade decision)
type: execute
wave: 2
depends_on:
  [
    02-03-state-store-and-hydration,
    02-04-installation-id-and-telemetry-ring,
    02-05-navigation-skeleton,
  ]
files_modified:
  - apps/mobile/src/services/api.ts
  - apps/mobile/src/util/semver.ts
  - apps/mobile/src/services/versionService.ts
  - apps/mobile/src/screens/splash/SplashScreen.tsx
  - apps/mobile/__tests__/util/semver.test.ts
  - apps/mobile/__tests__/services/versionService.test.ts
  - apps/mobile/__tests__/screens/SplashScreen.test.tsx
autonomous: true
requirements: [AUTH-07, UPG-01, UPG-02, UPG-05]
must_haves:
  truths:
    - 'versionService.fetch() calls GET /app/version?flavor={flavor} with a 5 s timeout and consults the 6 h MMKV cache first'
    - 'Response is validated against shared/types AppVersionResponseSchema (camelCase wire shape per RESEARCH § Open Questions item 7)'
    - 'Splash mounts → 2.4 s minimum visual presence + parallel /app/version fetch → routes to ForceUpgrade if installedVersion < minSupported, else dispatches initial-route gate'
    - 'Network failure on /app/version → proceed without gating (offline users not punished); next foreground re-checks'
    - 'Soft-upgrade banner availability written to Zustand for Home (plan 02-17) to render'
    - 'semver helper compares M.m.p strings; returns -1 / 0 / 1'
  artifacts:
    - path: 'apps/mobile/src/services/versionService.ts'
      provides: 'fetchAppVersion() + computeUpgradeAction() + 6h cache logic'
      contains: 'MAX_CACHE_AGE_MS'
    - path: 'apps/mobile/src/util/semver.ts'
      provides: 'compareSemver(a, b): -1 | 0 | 1 + parseSemver'
      contains: 'compareSemver'
    - path: 'apps/mobile/src/screens/splash/SplashScreen.tsx'
      provides: '2.4s minimum splash + version-check + initial-route dispatch'
      contains: 'Promise.race'
  key_links:
    - from: 'apps/mobile/src/services/versionService.ts'
      to: 'apps/mobile/src/services/api.ts'
      via: "apiClient.get('/app/version')"
      pattern: '/app/version'
    - from: 'apps/mobile/src/screens/splash/SplashScreen.tsx'
      to: 'apps/mobile/src/services/versionService.ts'
      via: 'fetchAppVersion + computeUpgradeAction'
      pattern: 'computeUpgradeAction'
---

<objective>
Build the splash-time bootstrap chain: a tiny semver helper, the versionService that wraps `GET /app/version` with a 6 h cache and force-upgrade decision logic, and the SplashScreen that runs it in parallel with the 2.4 s splash animation per design-spec §1 + RESEARCH § Architecture.

Purpose: D-UPG-01..07 are all triggered from Splash. AUTH-07 (session persists) is observed here — the gate-decision tree from plan 02-03 reads JWT from Zustand (already hydrated by App.tsx) and dispatches accordingly.
Output: working splash → version-check → routed-to-correct-onboarding-step pipeline. ForceUpgradeScreen body is a stub from plan 02-05; plan 02-20 fills it in.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/api.ts
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/state/keys.ts
@apps/mobile/src/native/AppFlavor.ts
@shared/types/src/app-version.ts
@apps/api/src/routes/app-version/get.ts
@design-spec.md

<interfaces>
<!-- shared/types AppVersionResponseSchema (from Phase 1 — discriminated union) -->
export const AppVersionResponseSchema = z.discriminatedUnion('flavor', [
  z.object({ flavor: z.literal('apkRollout'), minSupported: z.string(), latest: z.string(), forceUpgrade: z.boolean(), apkUrl: z.string().url(), apkSha256: z.string().length(64), playStoreUrl: z.null() }),
  z.object({ flavor: z.literal('playStore'), minSupported: z.string(), latest: z.string(), forceUpgrade: z.boolean(), playStoreUrl: z.string().url(), apkUrl: z.null(), apkSha256: z.null() }),
  z.object({ flavor: z.literal('iosAppStore'), ... }),
]);
export type AppVersionResponse = z.infer<typeof AppVersionResponseSchema>;

<!-- AppFlavor exposes versionName (Task 02-04) -->

getFlavorContext().versionName // e.g., '0.1.0'
getFlavorContext().flavor // 'apkRollout' | 'playStore'
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                             | Description                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| backend `/app/version` JSON → mobile | TLS; backend is authenticated for non-public endpoints; `/app/version` is intentionally pre-auth (Phase 1 D-API-13) |
| MMKV cache → versionService          | local store; tampering pre-mitigated (T-2.3-01 family)                                                              |

## STRIDE Threat Register

| Threat ID | Category          | Component                                                     | Disposition | Mitigation Plan                                                                                                                                           |
| --------- | ----------------- | ------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.8-01  | Tampering         | MMKV `appVersion.cache.v1` forged to claim user is up-to-date | accept      | Worst case: skip a soft-upgrade banner. Force-upgrade is gated by the live response when cache is stale; freshly-fetched response overrides the cache.    |
| T-2.8-02  | Spoofing          | Spoofed `/app/version` redirects user to a malicious APK URL  | mitigate    | Response validated against AppVersionResponseSchema (typed wire shape). APK URL also hashed-and-verified by HumynUpdater (plan 02-07). Two-layer defense. |
| T-2.8-03  | Denial of Service | `/app/version` is slow → splash hangs forever                 | mitigate    | 5 s `AbortController` timeout in versionService.fetchAppVersion + Promise.race against the 2.4 s splash duration. Splash never blocks > 2.4 s.            |

</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: semver helper + extend api.ts with getJson + versionService</name>
  <files>apps/mobile/src/util/semver.ts (NEW), apps/mobile/src/services/api.ts, apps/mobile/src/services/versionService.ts (NEW), apps/mobile/__tests__/util/semver.test.ts (NEW), apps/mobile/__tests__/services/versionService.test.ts (NEW)</files>
  <read_first>
    - apps/mobile/src/services/api.ts (current Phase 1 apiClient — confirm shape, GET method)
    - shared/types/src/app-version.ts (schema)
    - apps/api/src/routes/app-version/get.ts (verify wire shape — RESEARCH § Open Questions item 7 confirms camelCase)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "versionService.ts" lines 301-325
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UPG-04..07
  </read_first>
  <behavior>
    semver tests:
    Test 1: compareSemver('1.0.0', '1.0.0') === 0
    Test 2: compareSemver('1.0.0', '1.0.1') === -1
    Test 3: compareSemver('2.0.0', '1.99.99') === 1
    Test 4: compareSemver('0.1.0', '0.10.0') === -1 (numeric compare, NOT string)
    Test 5: compareSemver('0.1', '0.1.0') === 0 (missing patch defaults to 0)
    Test 6: parseSemver('not.semver') throws or returns null
    versionService tests:
    Test 7: fetchAppVersion() returns cached response if `now - fetchedAt < 6h`.
    Test 8: fetchAppVersion() calls apiClient.getJson('/app/version', {query: {flavor: 'apkRollout'}, timeoutMs: 5000}) when cache is stale; writes new response to MMKV.
    Test 9: On network failure, fetchAppVersion() returns the stale cache if any, else null.
    Test 10: computeUpgradeAction(installedVersion='0.5.0', response={minSupported: '1.0.0', latest: '1.5.0', forceUpgrade: false}) returns {action: 'force-upgrade', reason: 'below-min-supported'}.
    Test 11: computeUpgradeAction(installedVersion='1.2.0', response={minSupported: '1.0.0', latest: '1.5.0', forceUpgrade: false}) returns {action: 'soft-banner', latest: '1.5.0'}.
    Test 12: computeUpgradeAction(installedVersion='1.5.0', response={minSupported: '1.0.0', latest: '1.5.0', forceUpgrade: false}) returns {action: 'none'}.
    Test 13: computeUpgradeAction respects forceUpgrade=true even when installedVersion >= latest (rare ops escape hatch) → returns {action: 'force-upgrade', reason: 'flag-set'}.
  </behavior>
  <action>
    1. Create `apps/mobile/src/util/semver.ts`:
       ```ts
       /** Tiny M.m.p comparator — RESEARCH § Don't Hand-Roll permits hand-roll for the constrained shape. */
       export function parseSemver(s: string): [number, number, number] {
         const m = s.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
         if (!m) throw new Error(`invalid semver: ${s}`);
         return [Number(m[1]), Number(m[2]), Number(m[3] ?? '0')];
       }
       export function compareSemver(a: string, b: string): -1 | 0 | 1 {
         const [a1, a2, a3] = parseSemver(a);
         const [b1, b2, b3] = parseSemver(b);
         if (a1 !== b1) return a1 < b1 ? -1 : 1;
         if (a2 !== b2) return a2 < b2 ? -1 : 1;
         if (a3 !== b3) return a3 < b3 ? -1 : 1;
         return 0;
       }
       ```

    2. Edit `apps/mobile/src/services/api.ts` to add a `getJson<T>(path, { query?, timeoutMs? })` helper if not already present. Should:
       - Build URL with query string from `query` object.
       - Use `AbortController` with `setTimeout(controller.abort, timeoutMs ?? 30000)`.
       - Throw on non-2xx with the parsed RFC 7807 problem-detail body.
       - Return parsed JSON.

    3. Create `apps/mobile/src/services/versionService.ts`:
       ```ts
       import { AppVersionResponseSchema, type AppVersionResponse } from '@humyn/shared-types';
       import { apiClient } from './api';
       import { secureMmkv } from '../state/mmkv';
       import { KEYS } from '../state/keys';
       import { useAppStore } from '../state/appStore';
       import { getFlavorContext } from '../native/AppFlavor';
       import { compareSemver } from '../util/semver';
       import { logEvent } from '../util/analytics';

       const MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours per UPG-05
       const FETCH_TIMEOUT_MS = 5000;

       interface CacheEntry { response: AppVersionResponse; fetchedAt: number; }

       export type UpgradeAction =
         | { action: 'none' }
         | { action: 'soft-banner'; latest: string }
         | { action: 'force-upgrade'; reason: 'below-min-supported' | 'flag-set' };

       export async function fetchAppVersion(force = false): Promise<AppVersionResponse | null> {
         const cached = readCache();
         if (!force && cached && Date.now() - cached.fetchedAt < MAX_CACHE_AGE_MS) {
           useAppStore.getState().setAppVersionCache(cached);
           return cached.response;
         }
         const { flavor } = getFlavorContext();
         logEvent('upg_check_started', { flavor });
         try {
           const raw = await apiClient.getJson<unknown>('/app/version', {
             query: { flavor },
             timeoutMs: FETCH_TIMEOUT_MS,
           });
           const parsed = AppVersionResponseSchema.safeParse(raw);
           if (!parsed.success) {
             // Schema mismatch: prefer stale cache over invalid data
             return cached?.response ?? null;
           }
           const entry: CacheEntry = { response: parsed.data, fetchedAt: Date.now() };
           secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(entry));
           useAppStore.getState().setAppVersionCache(entry);
           return parsed.data;
         } catch (_e) {
           // Network failure: don't punish offline users — proceed with cache (or null)
           return cached?.response ?? null;
         }
       }

       function readCache(): CacheEntry | null {
         const raw = secureMmkv.getString(KEYS.APP_VERSION_CACHE);
         if (!raw) return null;
         try {
           const parsed = JSON.parse(raw) as CacheEntry;
           if (parsed && typeof parsed.fetchedAt === 'number' && parsed.response) return parsed;
         } catch (_e) { /* corrupt cache */ }
         return null;
       }

       export function computeUpgradeAction(
         installedVersion: string,
         response: AppVersionResponse,
       ): UpgradeAction {
         const cmpMin = compareSemver(installedVersion, response.minSupported);
         if (cmpMin < 0) return { action: 'force-upgrade', reason: 'below-min-supported' };
         if (response.forceUpgrade) return { action: 'force-upgrade', reason: 'flag-set' };
         const cmpLatest = compareSemver(installedVersion, response.latest);
         if (cmpLatest < 0) return { action: 'soft-banner', latest: response.latest };
         return { action: 'none' };
       }
       ```

    4. Author the test files for the 13 behaviors above. Use the standard `vi.mock` setup; mock `apiClient.getJson` and `getFlavorContext`.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/util/semver.ts && grep -q "compareSemver" apps/mobile/src/util/semver.ts` succeeds.
    - `test -f apps/mobile/src/services/versionService.ts && grep -q "MAX_CACHE_AGE_MS" apps/mobile/src/services/versionService.ts && grep -q "FETCH_TIMEOUT_MS" apps/mobile/src/services/versionService.ts && grep -q "AppVersionResponseSchema.safeParse" apps/mobile/src/services/versionService.ts` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/util/semver.test.ts __tests__/services/versionService.test.ts` passes (13 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/util/semver.test.ts __tests__/services/versionService.test.ts</automated>
  </verify>
  <done>semver helper + versionService + 13 unit tests cover cache hit/miss/timeout/network-failure/upgrade-action paths.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SplashScreen — 2.4 s splash + parallel version-check + dispatch</name>
  <files>apps/mobile/src/screens/splash/SplashScreen.tsx, apps/mobile/__tests__/screens/SplashScreen.test.tsx (NEW)</files>
  <read_first>
    - design-spec.md §1 (Splash — 2400 ms auto-advance, scalePop logo 700 ms, tagline fade in at 400 ms)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § specifics ("Splash version-check timing")
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § Architecture lines 343-355 (gate-decision tree)
    - apps/mobile/src/state/initialRoute.ts (Task 02-03)
    - apps/mobile/src/services/versionService.ts (Task 1 above)
    - apps/mobile/src/services/installationId.ts (Task 02-04)
    - apps/mobile/src/screens/splash/SplashScreen.tsx (current stub from 02-05)
    - logo.js (brand mark for the splash)
  </read_first>
  <behavior>
    Test 1: SplashScreen renders the brand logo + the tagline "Real Humyns. Real Intelligence." (the latter with accent color on "Real Intelligence.").
    Test 2: After mount, fetchAppVersion is called; setForceUpgradeBlocked(true) is dispatched if computeUpgradeAction returns 'force-upgrade'; setSoftUpgradeAvailable is dispatched if 'soft-banner'.
    Test 3: After max(2400 ms minimum, version-check) completes, navigation.replace is called with the result of computeInitialRoute(state, currentSignature).
    Test 4: When versionService rejects/times out, splash STILL advances after 2400 ms — does not hang.
  </behavior>
  <action>
    Replace the body of `apps/mobile/src/screens/splash/SplashScreen.tsx`:
    ```tsx
    import React, { useEffect } from 'react';
    import { View, StyleSheet, Animated } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import Logo from '../../../../logo';
    import { Text } from '../../ui/primitives/Text';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { colors, spacing, motion } from '../../ui/tokens';
    import { useAppStore } from '../../state/appStore';
    import { computeInitialRoute } from '../../state/initialRoute';
    import { fetchAppVersion, computeUpgradeAction } from '../../services/versionService';
    import { getFlavorContext } from '../../native/AppFlavor';
    import { getInstallationId } from '../../services/installationId';
    import { logEvent } from '../../util/analytics';

    const SPLASH_MIN_MS = 2400;

    async function delay(ms: number) {
      return new Promise<void>((r) => setTimeout(r, ms));
    }

    export default function SplashScreen() {
      const navigation = useNavigation<any>();

      useEffect(() => {
        let cancelled = false;
        logEvent('splash_shown');

        async function bootstrap() {
          // Mint installation_id eagerly so compat-signature can compute later
          await getInstallationId();
          // Run splash-min-time and version-check in parallel
          const [versionResponse] = await Promise.all([
            fetchAppVersion().catch(() => null),
            delay(SPLASH_MIN_MS),
          ]);
          if (cancelled) return;
          const store = useAppStore.getState();
          const flavorCtx = getFlavorContext();
          if (versionResponse) {
            const action = computeUpgradeAction(flavorCtx.versionName, versionResponse);
            if (action.action === 'force-upgrade') {
              store.setForceUpgradeBlocked(true);
              logEvent('upg_force_upgrade_shown', { reason: action.reason });
              navigation.replace('ForceUpgrade', { hardBlock: true });
              return;
            }
            if (action.action === 'soft-banner') {
              store.setSoftUpgradeAvailable({ latest: action.latest });
            }
          }
          const initial = computeInitialRoute(store, null /* signature wired in 02-16 */);
          // Map gate-decision result to a navigator.replace target
          if (initial.stack === 'OnboardingStack') {
            // We're already inside OnboardingStack (Splash is its first screen);
            // replace within the stack to the right step.
            navigation.replace(initial.screen);
          } else if (initial.stack === 'MainTabs') {
            navigation.getParent()?.replace('MainTabs');
          }
          // ForceUpgrade case handled above.
        }
        void bootstrap();
        return () => { cancelled = true; };
      }, [navigation]);

      return (
        <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <View style={styles.center}>
            <Logo width={120} height={40} accessibilityLabel="Humyn Labs logo" />
            <View style={{ height: spacing.l }} />
            <Text variant="caption" tone="primary" accessibilityLabel="splash tagline">
              Real Humyns.{' '}
              <Text variant="caption" style={{ color: colors.accent }}>
                Real Intelligence.
              </Text>
            </Text>
          </View>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      center: { alignItems: 'center', justifyContent: 'center' },
    });
    ```

    Author `__tests__/screens/SplashScreen.test.tsx` covering the 4 behaviors. Use `vi.mock('../src/services/versionService', () => ({ fetchAppVersion: vi.fn(), computeUpgradeAction: vi.fn() }))`, `vi.mock('../src/services/installationId', ...)`, etc. Use `vi.useFakeTimers()` to control the SPLASH_MIN_MS delay. Verify `navigation.replace` calls.

  </action>
  <acceptance_criteria>
    - `grep -q "Real Humyns" apps/mobile/src/screens/splash/SplashScreen.tsx && grep -q "Real Intelligence" apps/mobile/src/screens/splash/SplashScreen.tsx` succeeds.
    - `grep -q "SPLASH_MIN_MS = 2400" apps/mobile/src/screens/splash/SplashScreen.tsx` succeeds.
    - `grep -q "Promise.all" apps/mobile/src/screens/splash/SplashScreen.tsx` succeeds (parallel splash + version-check).
    - `grep -q "fetchAppVersion" apps/mobile/src/screens/splash/SplashScreen.tsx && grep -q "computeUpgradeAction" apps/mobile/src/screens/splash/SplashScreen.tsx` succeeds.
    - `grep -q "navigation.replace" apps/mobile/src/screens/splash/SplashScreen.tsx` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/screens/SplashScreen.test.tsx` passes (4 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/screens/SplashScreen.test.tsx</automated>
  </verify>
  <done>SplashScreen runs splash + version-check in parallel, never hangs > 2400 ms, dispatches gate-decision-tree result; 4 unit tests pass.</done>
</task>

</tasks>

<verification>
- semver helper + versionService unit-tested.
- SplashScreen renders verbatim copy + dispatches initial-route gate.
- Network-failure path doesn't punish offline users.
- 5 s timeout protects against slow `/app/version`.
- 17 unit tests across this plan.
</verification>

<success_criteria>

- UPG-01, UPG-02, UPG-05 implemented at the service layer.
- AUTH-07 (session persists) is observable: a JWT in MMKV at boot causes `computeInitialRoute` to skip Splash → Sign-up.
- D-UPG-04 + D-UPG-06 implemented.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-08-SUMMARY.md` documenting the splash+version-check parallelism, the cache-hit semantics, and the failure-mode behaviors.
</output>
