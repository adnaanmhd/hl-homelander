---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 20
id: 02-20-force-upgrade-and-soft-banner
name: ForceUpgradeScreen (apkRollout PackageInstaller / playStore market://) + SoftUpgradeBanner + apkRollout REQUEST_INSTALL_PACKAGES verify
type: execute
wave: 4
depends_on:
  [02-07-humyn-updater-kotlin-shell, 02-08-splash-and-version-service, 02-16-home-skeleton-and-tabs]
files_modified:
  - apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx
  - apps/mobile/src/components/SoftUpgradeBanner.tsx
  - apps/mobile/src/services/upgradeFlow.ts
  - apps/mobile/__tests__/screens/ForceUpgradeScreen.test.tsx
  - apps/mobile/__tests__/components/SoftUpgradeBanner.test.tsx
  - apps/mobile/__tests__/services/upgradeFlow.test.ts
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/android/app/src/apkRollout/AndroidManifest.xml
  - apps/mobile/scripts/verify-merged-manifests.sh
autonomous: true
requirements: [UPG-03, UPG-04]
must_haves:
  truths:
    - 'ForceUpgradeScreen reads {flavor, applicationId} from AppFlavor — apkRollout downloads + SHA-256 verifies + launches PackageInstaller via HumynUpdater (plan 02-07); playStore opens market://details?id=ai.humynlabs.capture (D-UPG-01)'
    - "Hash mismatch on apkRollout → delete downloaded file, show 'Update failed (integrity check). Try again or contact support', emit force_upgrade_apk_hash_mismatch Firebase Analytics event (D-UPG-02; never pass mismatched APK to PackageInstaller)"
    - 'REQUEST_INSTALL_PACKAGES is declared ONLY in apkRollout/AndroidManifest.xml; playStore manifest must NOT declare it; verify-merged-manifests.sh asserts both invariants on every PR (D-UPG-03; mirrors Phase 1 Pattern 35)'
    - 'ForceUpgradeScreen with hardBlock=true blocks back button (RootStack hardware back override per D-NAV-04)'
    - 'SoftUpgradeBanner mounts at top of HomeSkeletonScreen ONLY when softUpgradeAvailable is true (Zustand selector); tap dismiss writes appVersion.softBannerDismissed.{latest} to MMKV (D-UPG-05); banner does NOT mount on Tasks/History/Profile (structural — only HomeSkeletonScreen consumes it)'
    - "SoftUpgradeBanner 'Update' CTA reuses the same per-flavor logic as ForceUpgradeScreen via a shared upgradeFlow.ts service"
    - 'Per-version dismiss key auto-resets when latest changes (next /app/version response with a different latest creates a fresh key, banner re-shows)'
  artifacts:
    - path: 'apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx'
      provides: 'Force-upgrade gate per D-UPG-01..04'
      contains: 'ForceUpgradeScreen'
    - path: 'apps/mobile/src/components/SoftUpgradeBanner.tsx'
      provides: 'Dismissible soft-upgrade banner (Home only)'
      contains: 'softBannerDismissed'
    - path: 'apps/mobile/src/services/upgradeFlow.ts'
      provides: 'startUpgrade(flavor, payload) — apkRollout download+verify+install OR playStore market://'
      contains: 'startUpgrade'
  key_links:
    - from: 'apps/mobile/src/services/upgradeFlow.ts'
      to: 'apps/mobile/src/native/HumynUpdater.ts'
      via: 'downloadAndVerifyApk + launchInstaller (plan 02-07)'
      pattern: 'downloadAndVerifyApk'
    - from: 'apps/mobile/src/components/SoftUpgradeBanner.tsx'
      to: 'apps/mobile/src/services/upgradeFlow.ts'
      via: 'startUpgrade(flavor, payload)'
      pattern: 'startUpgrade'
---

<objective>
Implement the user-facing forced-upgrade and soft-upgrade flows on top of the splash-time version-check (plan 02-08) and the HumynUpdater Kotlin shell (plan 02-07). Two screens and a shared service: ForceUpgradeScreen (full-screen block when installedVersion < minSupported), SoftUpgradeBanner (dismissible Home banner when installedVersion < latest), and upgradeFlow.ts that encapsulates the per-flavor install path.

Purpose: Closes UPG-03 (force block + Play Store deep-link) + UPG-04 (dismissible soft banner). UPG-01/02/05 closed in 02-08. The apkRollout install path is the riskiest piece — D-UPG-02 demands SHA-256 verify before PackageInstaller and a logged catastrophic event on mismatch.
Output: working ForceUpgradeScreen routed from Splash gate, SoftUpgradeBanner mounted at HomeSkeletonScreen, REQUEST_INSTALL_PACKAGES verified flavor-scoped.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/versionService.ts
@apps/mobile/src/native/HumynUpdater.ts
@apps/mobile/src/native/AppFlavor.ts
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
@apps/mobile/android/app/src/apkRollout/AndroidManifest.xml
@design-spec.md
@idea-brief.md

<interfaces>
<!-- AppVersionResponse discriminated union (Phase 1 shipped) -->
type AppVersionResponse =
  | { flavor: 'apkRollout'; minSupported: string; latest: string; forceUpgrade: boolean; apkUrl: string; apkSha256: string; playStoreUrl: null }
  | { flavor: 'playStore'; minSupported: string; latest: string; forceUpgrade: boolean; playStoreUrl: string; apkUrl: null; apkSha256: null }
  | { flavor: 'iosAppStore'; ... };

<!-- D-UPG-04 / D-UPG-05 — MMKV keys -->

appVersion.cache.v1 = { response, fetchedAt } // 6 h TTL (plan 02-08)
appVersion.softBannerDismissed.{latest} = "true" // per-version dismiss

<!-- HumynUpdater contract (plan 02-07) -->

downloadAndVerifyApk(url: string, expectedSha256: string): Promise<{ path: string; sha256: string }>;
launchInstaller(apkPath: string): Promise<boolean>;

<!-- design-spec §9 + idea-brief §9 -->

Force block screen: "Update to continue." (no dismiss)
Soft banner: dismissible; Home only; Update CTA opens upgrade flow
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                 | Description                                        |
| ------------------------ | -------------------------------------------------- |
| GET /app/version → app   | TLS via OS network stack                           |
| apk_url HTTPS download   | TLS; SHA-256 client-verify before PackageInstaller |
| PackageInstaller.Session | OS install dialog requires user approval           |

## STRIDE Threat Register

| Threat ID | Category          | Component                                                                                      | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                             |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.20-01 | Tampering         | MITM on `/app/version` returning malicious apk_url                                             | mitigate    | Per RESEARCH § Security row 1: TLS + APK SHA-256 verification. ForceUpgradeScreen MUST NOT pass a hash-mismatched APK to launchInstaller — gate enforced in upgradeFlow.ts (defense-in-depth on top of Kotlin-side check from 02-07). force_upgrade_apk_hash_mismatch event logs the catastrophic occurrence.                               |
| T-2.20-02 | Elevation         | apkRollout REQUEST_INSTALL_PACKAGES abused to install a third-party APK                        | mitigate    | Three layers per RESEARCH: (1) URL signed by our backend (Phase 1 D-APK-01), (2) SHA-256 verifies bytes, (3) PackageInstaller asks the user. The flavor-scoped manifest declaration limits the permission's blast radius — playStore APK structurally cannot use it. verify-merged-manifests.sh asserts the per-flavor scoping on every PR. |
| T-2.20-03 | Tampering         | playStore flavor's manifest accidentally adds REQUEST_INSTALL_PACKAGES (Play policy violation) | mitigate    | Task 3 extends `apps/mobile/scripts/verify-merged-manifests.sh` to fail when REQUEST_INSTALL_PACKAGES appears in the playStore-merged manifest. Wired into CI by Phase 1 plan 01-09 (verify-merged-manifests.sh runs on every PR).                                                                                                          |
| T-2.20-04 | Denial of Service | Soft banner re-renders every cold start, annoying users who already dismissed                  | mitigate    | Per-version dismiss key (`appVersion.softBannerDismissed.{latest}`) auto-resets when `latest` advances; on the same latest, the banner stays dismissed across cold-starts.                                                                                                                                                                  |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: upgradeFlow service — per-flavor startUpgrade orchestration + tests</name>
  <files>apps/mobile/src/services/upgradeFlow.ts, apps/mobile/__tests__/services/upgradeFlow.test.ts</files>
  <read_first>
    - apps/mobile/src/native/HumynUpdater.ts (plan 02-07 — downloadAndVerifyApk + launchInstaller contracts)
    - apps/mobile/src/native/AppFlavor.ts (flavor + applicationId constants)
    - apps/mobile/src/services/versionService.ts (plan 02-08 — AppVersionResponse type)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UPG-01..02
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Force-upgrade APK download + SHA-256 verify (Kotlin)" lines 859-923 (Kotlin reference impl from plan 02-07 already shipped)
  </read_first>
  <action>
    Author `apps/mobile/src/services/upgradeFlow.ts`:
    ```typescript
    import { Linking, NativeModules } from 'react-native';
    import { downloadAndVerifyApk, launchInstaller } from '../native/HumynUpdater';
    import type { AppVersionResponse } from './versionService';

    /** Catastrophic event names — the hash-mismatch event MUST always be logged (D-UPG-02). */
    export const ANALYTICS_EVENTS = {
      forceUpgradeApkHashMismatch: 'force_upgrade_apk_hash_mismatch',
      forceUpgradeApkDownloadFailed: 'force_upgrade_apk_download_failed',
    } as const;

    export interface UpgradeFlowDeps {
      logEvent?: (name: string, props: Record<string, string | number>) => void;
    }

    /**
     * Per-flavor upgrade orchestration:
     *  - apkRollout → HumynUpdater.downloadAndVerifyApk(url, expectedSha256) → launchInstaller(path)
     *  - playStore  → Linking.openURL('market://details?id=ai.humynlabs.capture')
     *
     * Hash-mismatch detection: HumynUpdater.downloadAndVerifyApk Kotlin throws on mismatch
     * (plan 02-07 contract). We catch and emit the catastrophic event, then surface to caller.
     */
    export async function startUpgrade(payload: AppVersionResponse, deps: UpgradeFlowDeps = {}): Promise<void> {
      if (payload.flavor === 'apkRollout') {
        try {
          const { path } = await downloadAndVerifyApk(payload.apkUrl, payload.apkSha256);
          await launchInstaller(path);
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'unknown';
          // Distinguish hash-mismatch from generic download failure for analytics granularity.
          const isHashMismatch = /hash[_-]?mismatch|sha256_mismatch|integrity/i.test(msg);
          deps.logEvent?.(
            isHashMismatch ? ANALYTICS_EVENTS.forceUpgradeApkHashMismatch : ANALYTICS_EVENTS.forceUpgradeApkDownloadFailed,
            { apkUrl: payload.apkUrl, expectedSha256: payload.apkSha256, errorMessage: msg },
          );
          throw new Error(isHashMismatch ? 'apk_hash_mismatch' : 'apk_download_failed');
        }
      }

      if (payload.flavor === 'playStore') {
        const applicationId = (NativeModules.AppFlavor as { applicationId?: string } | undefined)?.applicationId
          ?? 'ai.humynlabs.capture';
        const marketUrl = `market://details?id=${applicationId}`;
        const fallbackUrl = `https://play.google.com/store/apps/details?id=${applicationId}`;
        try {
          await Linking.openURL(marketUrl);
        } catch {
          await Linking.openURL(fallbackUrl);
        }
        return;
      }

      // iosAppStore is Phase 7 territory; throw a typed error so the screen can render a clear message.
      throw new Error(`upgrade_flavor_not_supported_phase2:${payload.flavor}`);
    }

    /** apkRollout flavor guard — for screens that need to short-circuit before calling startUpgrade. */
    export function isApkRolloutPayload(p: AppVersionResponse): p is Extract<AppVersionResponse, { flavor: 'apkRollout' }> {
      return p.flavor === 'apkRollout';
    }
    ```

    Author `apps/mobile/__tests__/services/upgradeFlow.test.ts`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';

    const openURLMock = vi.fn();
    vi.mock('react-native', () => ({
      Linking: { openURL: openURLMock },
      NativeModules: { AppFlavor: { applicationId: 'ai.humynlabs.capture' } },
    }));

    const downloadMock = vi.fn();
    const installerMock = vi.fn();
    vi.mock('../../src/native/HumynUpdater', () => ({
      downloadAndVerifyApk: (...a: unknown[]) => downloadMock(...a),
      launchInstaller: (...a: unknown[]) => installerMock(...a),
    }));

    import { startUpgrade, ANALYTICS_EVENTS } from '../../src/services/upgradeFlow';

    beforeEach(() => { openURLMock.mockReset(); downloadMock.mockReset(); installerMock.mockReset(); });

    describe('upgradeFlow.startUpgrade', () => {
      it('apkRollout: download → installer', async () => {
        downloadMock.mockResolvedValue({ path: '/tmp/x.apk', sha256: 'abc' });
        installerMock.mockResolvedValue(true);
        await startUpgrade({ flavor: 'apkRollout', minSupported: '0.1', latest: '0.2', forceUpgrade: true, apkUrl: 'https://x/y.apk', apkSha256: 'abc'.padEnd(64, '0'), playStoreUrl: null });
        expect(downloadMock).toHaveBeenCalledWith('https://x/y.apk', 'abc'.padEnd(64, '0'));
        expect(installerMock).toHaveBeenCalledWith('/tmp/x.apk');
      });

      it('apkRollout hash-mismatch: emits force_upgrade_apk_hash_mismatch event + throws apk_hash_mismatch', async () => {
        const logEvent = vi.fn();
        downloadMock.mockRejectedValue(new Error('apk_sha256_mismatch'));
        await expect(
          startUpgrade(
            { flavor: 'apkRollout', minSupported: '0.1', latest: '0.2', forceUpgrade: true, apkUrl: 'https://x/y.apk', apkSha256: 'abc'.padEnd(64, '0'), playStoreUrl: null },
            { logEvent },
          ),
        ).rejects.toThrow('apk_hash_mismatch');
        expect(logEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.forceUpgradeApkHashMismatch, expect.objectContaining({ apkUrl: 'https://x/y.apk' }));
        expect(installerMock).not.toHaveBeenCalled();
      });

      it('apkRollout download error (non-hash): emits force_upgrade_apk_download_failed event', async () => {
        const logEvent = vi.fn();
        downloadMock.mockRejectedValue(new Error('connection_reset'));
        await expect(
          startUpgrade(
            { flavor: 'apkRollout', minSupported: '0.1', latest: '0.2', forceUpgrade: true, apkUrl: 'https://x/y.apk', apkSha256: 'abc'.padEnd(64, '0'), playStoreUrl: null },
            { logEvent },
          ),
        ).rejects.toThrow('apk_download_failed');
        expect(logEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.forceUpgradeApkDownloadFailed, expect.any(Object));
      });

      it('playStore: opens market:// with correct applicationId', async () => {
        openURLMock.mockResolvedValue(undefined);
        await startUpgrade({ flavor: 'playStore', minSupported: '0.1', latest: '0.2', forceUpgrade: true, playStoreUrl: 'https://play.google.com/store/apps/details?id=ai.humynlabs.capture', apkUrl: null, apkSha256: null });
        expect(openURLMock).toHaveBeenCalledWith('market://details?id=ai.humynlabs.capture');
      });

      it('playStore: falls back to https URL when market:// fails', async () => {
        openURLMock.mockRejectedValueOnce(new Error('no_play_store')).mockResolvedValueOnce(undefined);
        await startUpgrade({ flavor: 'playStore', minSupported: '0.1', latest: '0.2', forceUpgrade: true, playStoreUrl: 'https://play.google.com/store/apps/details?id=ai.humynlabs.capture', apkUrl: null, apkSha256: null });
        expect(openURLMock).toHaveBeenLastCalledWith('https://play.google.com/store/apps/details?id=ai.humynlabs.capture');
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- upgradeFlow --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export async function startUpgrade" apps/mobile/src/services/upgradeFlow.ts` succeeds.
    - `grep -q "force_upgrade_apk_hash_mismatch" apps/mobile/src/services/upgradeFlow.ts` succeeds.
    - `grep -q "downloadAndVerifyApk" apps/mobile/src/services/upgradeFlow.ts` succeeds.
    - `grep -q "market://details" apps/mobile/src/services/upgradeFlow.ts` succeeds.
    - `cd apps/mobile && npm run test -- upgradeFlow --run` exits 0; 5 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- upgradeFlow --run</automated>
  </verify>
  <done>upgradeFlow encapsulates per-flavor install path; hash-mismatch and download-fail emit distinct events; playStore market:// fallback is tested.</done>
</task>

<task type="auto">
  <name>Task 2: ForceUpgradeScreen + SoftUpgradeBanner + Home wiring + tests</name>
  <files>apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx, apps/mobile/src/components/SoftUpgradeBanner.tsx, apps/mobile/__tests__/screens/ForceUpgradeScreen.test.tsx, apps/mobile/__tests__/components/SoftUpgradeBanner.test.tsx, apps/mobile/src/screens/home/HomeSkeletonScreen.tsx</files>
  <read_first>
    - apps/mobile/src/services/upgradeFlow.ts (Task 1 output)
    - apps/mobile/src/services/versionService.ts (plan 02-08 — AppVersionResponse + cache reads)
    - apps/mobile/src/state/appStore.ts (softUpgradeAvailable + appVersionResponse selectors)
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (plan 02-16 — banner mount slot)
    - design-spec.md §9 / §19.4 (Banners)
    - idea-brief.md §9 (Forced Upgrade copy: "Update to continue.")
    - REQUIREMENTS.md UPG-03 + UPG-04 verbatim
  </read_first>
  <action>
    Author `apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx`. Tokens come from `../../ui/tokens` — NO hex literals (Text + Button primitives can be used here too; below uses RN primitives because the hardBlock path needs explicit BackHandler control and the Button primitive's full styling is sufficient at the screen-CTA level):
    ```tsx
    import React, { useState, useCallback, useEffect } from 'react';
    import { View, StyleSheet, BackHandler, Alert } from 'react-native';
    import { useRoute } from '@react-navigation/native';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { spacing } from '../../ui/tokens';
    import { startUpgrade } from '../../services/upgradeFlow';
    import { useAppStore } from '../../state/appStore';

    /** UPG-03 — non-dismissible block screen when installedVersion < minSupported. */
    interface RouteParams { hardBlock: boolean }

    export function ForceUpgradeScreen(): React.JSX.Element {
      const route = useRoute<any>();
      const params: RouteParams = (route?.params as RouteParams) ?? { hardBlock: true };
      const payload = useAppStore((s) => s.appVersionResponse);
      const [busy, setBusy] = useState(false);

      // Block hardware back when hardBlock=true (D-NAV-04).
      useEffect(() => {
        if (!params.hardBlock) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
      }, [params.hardBlock]);

      const onUpdate = useCallback(async () => {
        if (!payload) {
          Alert.alert('Update info unavailable', 'Try again in a moment.');
          return;
        }
        setBusy(true);
        try {
          await startUpgrade(payload);
        } catch (e) {
          if (e instanceof Error && e.message === 'apk_hash_mismatch') {
            Alert.alert('Update failed (integrity check)', 'Try again or contact support.');
          } else {
            Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again later.');
          }
        } finally {
          setBusy(false);
        }
      }, [payload]);

      return (
        <ScreenContainer accessibilityLabel="force-upgrade-screen" padding={spacing.h}>
          <View style={styles.center}>
            <Text variant="sheetTitle" style={styles.title}>Update to continue.</Text>
            <Text variant="body" tone="secondary" style={styles.body}>
              A newer version of Humyn Labs Capture is required to keep recording.
            </Text>
            <Button
              variant="primary"
              accessibilityLabel="force-upgrade-update"
              label={busy ? 'Updating…' : 'Update'}
              onPress={onUpdate}
              disabled={busy}
            />
          </View>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      center: { flex: 1, justifyContent: 'center' },
      title: { marginBottom: spacing.md },
      body: { marginBottom: spacing.xxxl },
    });
    ```

    Author `apps/mobile/src/components/SoftUpgradeBanner.tsx`. Tokens come from `../ui/tokens` — NO hex literals:
    ```tsx
    import React, { useState } from 'react';
    import { View, StyleSheet } from 'react-native';
    import { MMKV } from 'react-native-mmkv';
    import { Text } from '../ui/primitives/Text';
    import { Pressable } from '../ui/primitives/Pressable';
    import { colors, spacing, radii } from '../ui/tokens';
    import { startUpgrade } from '../services/upgradeFlow';
    import { useAppStore } from '../state/appStore';

    /** UPG-04 — dismissible soft banner; mounted at top of HomeSkeletonScreen only. */
    const mmkv = new MMKV({ id: 'humyn.secure', encryptionKey: 'humyn-mmkv-v1' });

    function dismissKey(latest: string): string {
      return `appVersion.softBannerDismissed.${latest}`;
    }

    export function SoftUpgradeBanner(): React.JSX.Element | null {
      const payload = useAppStore((s) => s.appVersionResponse);
      const [dismissed, setDismissed] = useState<boolean>(() => {
        if (!payload) return true;
        return mmkv.getString(dismissKey(payload.latest)) === 'true';
      });

      if (!payload || dismissed) return null;

      const dismiss = () => {
        mmkv.set(dismissKey(payload.latest), 'true');
        setDismissed(true);
      };

      const update = async () => {
        try { await startUpgrade(payload); } catch { /* swallow — caller surfaces error */ }
      };

      return (
        <View style={styles.banner} accessibilityLabel="soft-upgrade-banner">
          <View style={styles.copy}>
            <Text variant="caption" style={styles.title}>A new version is available</Text>
            <Text variant="caption" style={styles.body}>Update to v{payload.latest} for the latest improvements.</Text>
          </View>
          <Pressable onPress={update} accessibilityLabel="soft-upgrade-update" style={styles.btn}>
            <Text variant="caption" style={styles.btnText}>Update</Text>
          </Pressable>
          <Pressable onPress={dismiss} accessibilityLabel="soft-upgrade-dismiss" hitSlop={8}>
            <Text variant="bodyLg" style={styles.dismiss}>×</Text>
          </Pressable>
        </View>
      );
    }

    const styles = StyleSheet.create({
      banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bannerWarnBg, padding: spacing.md, borderRadius: radii.input, marginVertical: spacing.m },
      copy: { flex: 1 },
      title: { color: colors.text },
      body: { color: colors.bannerWarnText },
      btn: { paddingHorizontal: spacing.md, paddingVertical: spacing.m, borderRadius: radii.chip, backgroundColor: colors.text, marginHorizontal: spacing.m },
      btnText: { color: colors.surface },
      dismiss: { paddingHorizontal: spacing.xs, color: colors.bannerWarnText },
    });
    ```

    Update `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` to import + render `<SoftUpgradeBanner />` inside the existing `soft-upgrade-banner-slot` View (replacing the empty marker comment from plan 02-16).

    Author both test files. ForceUpgradeScreen test asserts: title 'Update to continue.' renders verbatim; tapping Update calls startUpgrade(payload); on apk_hash_mismatch error a 'Update failed (integrity check)' Alert fires. SoftUpgradeBanner test asserts: returns null when softUpgradeAvailable is false / payload null; renders title + body when payload present; dismiss button writes the per-version key + hides banner; Update button calls startUpgrade.

    Run `cd apps/mobile && npm run test -- "(ForceUpgradeScreen|SoftUpgradeBanner)" --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "Update to continue." apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx` succeeds.
    - `grep -q "BackHandler" apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx` succeeds (hardBlock).
    - `grep -q "apk_hash_mismatch" apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx` succeeds.
    - `grep -q "appVersion.softBannerDismissed" apps/mobile/src/components/SoftUpgradeBanner.tsx` succeeds.
    - `grep -q "SoftUpgradeBanner" apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` succeeds.
    - `cd apps/mobile && npm run test -- "(ForceUpgradeScreen|SoftUpgradeBanner)" --run` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- "(ForceUpgradeScreen|SoftUpgradeBanner)" --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/upgrade/ForceUpgradeScreen.tsx apps/mobile/src/components/SoftUpgradeBanner.tsx; test $? -eq 1)</automated>
  </verify>
  <done>ForceUpgradeScreen blocks back, dispatches startUpgrade, surfaces hash-mismatch copy. SoftUpgradeBanner mounts only on Home, dismisses per-latest, restarts when latest changes. NO hex literals in either file.</done>
</task>

<task type="auto">
  <name>Task 3: REQUEST_INSTALL_PACKAGES flavor-scoped manifest verification + CI gate extension</name>
  <files>apps/mobile/android/app/src/apkRollout/AndroidManifest.xml, apps/mobile/scripts/verify-merged-manifests.sh</files>
  <read_first>
    - apps/mobile/android/app/src/apkRollout/AndroidManifest.xml (Phase 1 — verify REQUEST_INSTALL_PACKAGES already declared per Phase 1 D-APK-02)
    - apps/mobile/android/app/src/main/AndroidManifest.xml (verify NO REQUEST_INSTALL_PACKAGES)
    - apps/mobile/scripts/verify-merged-manifests.sh (Phase 1 plan 01-09 output — script that asserts merged-manifest invariants on PR)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UPG-03
  </read_first>
  <action>
    Step 1: Verify the apkRollout manifest. Run:
    ```
    grep -c "android.permission.REQUEST_INSTALL_PACKAGES" apps/mobile/android/app/src/apkRollout/AndroidManifest.xml
    ```
    If the count is 0, ADD `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />` to apps/mobile/android/app/src/apkRollout/AndroidManifest.xml. Phase 1 plan 01-09 was supposed to ship this; this is a defensive add. If the count is ≥ 1, leave the file untouched.

    Step 2: Verify the base manifest does NOT declare it. Run:
    ```
    grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/main/AndroidManifest.xml | grep -c "REQUEST_INSTALL_PACKAGES"
    ```
    Must be 0. If non-zero, REMOVE the offending declaration from the base manifest.

    Step 3: Verify the playStore manifest does NOT declare it (this is the policy-critical assertion). Run:
    ```
    grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/playStore/AndroidManifest.xml 2>/dev/null | grep -c "REQUEST_INSTALL_PACKAGES" || true
    ```
    Must be 0. If ≥ 1, REMOVE — this is a Play policy violation.

    Step 4: Extend `apps/mobile/scripts/verify-merged-manifests.sh` (or create if missing). The script must, for each flavor, run `./gradlew :app:processFlavorDebugManifest` (or read the merged-manifest output under `app/build/intermediates/merged_manifests/`) and assert:

    - apkRollout merged manifest CONTAINS `android.permission.REQUEST_INSTALL_PACKAGES`
    - playStore merged manifest does NOT contain `android.permission.REQUEST_INSTALL_PACKAGES`
    - apkRollout merged manifest CONTAINS `android.permission.CAMERA` and `android.permission.RECORD_AUDIO` (Phase 2 PERM-04 declarations from plan 02-10)
    - apkRollout merged manifest CONTAINS `android.permission.ACCESS_COARSE_LOCATION` (PERM-03 from plan 02-14)

    If the Phase 1 script already exists, append the new assertions inside it. The script should `exit 1` on any violation. Add a quick local-run hook so a developer can run `bash apps/mobile/scripts/verify-merged-manifests.sh` after a Gradle merged-manifest build.

    Step 5: Author a tiny smoke fixture test (no Gradle dependency for the JS test runner). Append to `apps/mobile/__tests__/scripts/build-help-content.test.ts` OR create `apps/mobile/__tests__/manifests/manifests.test.ts`:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { readFileSync, existsSync } from 'node:fs';
    import { resolve, dirname } from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const ROOT = resolve(__dirname, '../../');

    function strip(file: string): string {
      // Strip XML comments before grep.
      return readFileSync(file, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');
    }

    describe('Phase 2 manifest invariants (D-UPG-03 / PERM-04)', () => {
      const apkRolloutPath = resolve(ROOT, 'android/app/src/apkRollout/AndroidManifest.xml');
      const basePath = resolve(ROOT, 'android/app/src/main/AndroidManifest.xml');
      const playStorePath = resolve(ROOT, 'android/app/src/playStore/AndroidManifest.xml');

      it('apkRollout/AndroidManifest.xml declares REQUEST_INSTALL_PACKAGES', () => {
        expect(existsSync(apkRolloutPath)).toBe(true);
        expect(strip(apkRolloutPath)).toMatch(/REQUEST_INSTALL_PACKAGES/);
      });

      it('main/AndroidManifest.xml does NOT declare REQUEST_INSTALL_PACKAGES', () => {
        expect(strip(basePath)).not.toMatch(/REQUEST_INSTALL_PACKAGES/);
      });

      it('playStore/AndroidManifest.xml does NOT declare REQUEST_INSTALL_PACKAGES (Play policy)', () => {
        if (!existsSync(playStorePath)) return; // permitted: no playStore overlay = no permission diff
        expect(strip(playStorePath)).not.toMatch(/REQUEST_INSTALL_PACKAGES/);
      });

      it('main manifest declares CAMERA + RECORD_AUDIO + ACCESS_COARSE_LOCATION (PERM-04 / PERM-03)', () => {
        const base = strip(basePath);
        expect(base).toMatch(/android.permission.CAMERA/);
        expect(base).toMatch(/android.permission.RECORD_AUDIO/);
        expect(base).toMatch(/android.permission.ACCESS_COARSE_LOCATION/);
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- manifests --run` — must pass.
    Run `bash apps/mobile/scripts/verify-merged-manifests.sh` (after Gradle merge if available) — must exit 0.

  </action>
  <acceptance_criteria>
    - `grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/apkRollout/AndroidManifest.xml | grep -c "REQUEST_INSTALL_PACKAGES"` returns >= 1.
    - `grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/main/AndroidManifest.xml | grep -c "REQUEST_INSTALL_PACKAGES"` returns 0.
    - `if [ -f apps/mobile/android/app/src/playStore/AndroidManifest.xml ]; then grep -v '^[[:space:]]*<!--' apps/mobile/android/app/src/playStore/AndroidManifest.xml | grep -c "REQUEST_INSTALL_PACKAGES"; else echo 0; fi` returns 0.
    - `grep -q "REQUEST_INSTALL_PACKAGES" apps/mobile/scripts/verify-merged-manifests.sh` succeeds.
    - `cd apps/mobile && npm run test -- manifests --run` exits 0; 4 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- manifests --run</automated>
  </verify>
  <done>REQUEST_INSTALL_PACKAGES is declared only in apkRollout; CI gate locked across flavors; PERM-04 / PERM-03 manifest declarations also verified.</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "(upgradeFlow|ForceUpgradeScreen|SoftUpgradeBanner|manifests)" --run` — all green.
- Manual smoke (in 02-21): on apkRollout, install older APK → bump backend min_supported → cold start → ForceUpgradeScreen renders → tap Update → SHA-256 verify → system installer dialog → install → cold start on new build. On playStore, same trigger → tap Update → Play Store opens to listing.
</verification>

<success_criteria>

- UPG-03 closed: ForceUpgradeScreen blocks back when hardBlock=true; per-flavor install path works.
- UPG-04 closed: SoftUpgradeBanner mounts only on Home, dismisses per-latest, re-shows when latest advances.
- D-UPG-02 hash-mismatch is logged distinctly from generic download failure; mismatched APKs never reach PackageInstaller.
- D-UPG-03 manifest invariant locked across all 3 flavors via vitest gate + verify-merged-manifests.sh CI gate.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-20-SUMMARY.md` per templates/summary.md.
</output>
