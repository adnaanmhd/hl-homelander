/**
 * @doc SplashScreen — design-spec §1 + RESEARCH § Architecture +
 * CONTEXT.md § "Splash version-check timing".
 *
 * Plan 02-08 splash-time bootstrap chain:
 *   1. Eagerly mint installation_id (so the compat-signature builder later
 *      can compute its signature without a bridge round-trip).
 *   2. Run a 2.4 s minimum splash visual + a 5 s-bounded version-check in
 *      parallel via Promise.all. Splash NEVER blocks longer than 2.4 s on
 *      a slow network — the version-check resolves on its own clock and
 *      the gate-decision dispatches whichever direction it points.
 *   3. Force-upgrade verdict → setForceUpgradeBlocked(true) +
 *      navigation.replace('ForceUpgrade', { hardBlock: true }). The
 *      ForceUpgradeScreen is a RootNativeStack sibling (HOME-08 structural).
 *   4. Soft-banner verdict → setSoftUpgradeAvailable({ latest }) so the
 *      Home (plan 02-17) renders the dismissible banner.
 *   5. Otherwise dispatch the gate-decision tree result. From inside
 *      OnboardingStack/Splash:
 *        - OnboardingStack/{Signup|Permissions|Compat|RigTutorial} →
 *          navigation.replace(screen) (same-stack replace).
 *        - MainTabs → navigation.getParent()?.replace('MainTabs') (the
 *          parent RootNativeStack).
 *
 * The brand mark is rendered as a typographic wordmark stub today (plan
 * 02-15 will land the real SVG). Tagline is verbatim per design-spec §1
 * with the second half ("Real Intelligence.") accent-colored.
 *
 * Threat-model anchors:
 *   - T-2.8-03 (DoS via slow /app/version) mitigated by the
 *     versionService 5 s AbortController + Promise.all 2.4 s minimum.
 *   - T-2.8-02 (spoofed /app/version → malicious APK) is the
 *     versionService's wire-shape validation; second layer hashes the
 *     APK in HumynUpdater (plan 02-07).
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { colors, spacing } from '../../ui/tokens';

import { useAppStore } from '../../state/appStore';
import { computeInitialRoute } from '../../state/initialRoute';
import { fetchAppVersion, computeUpgradeAction } from '../../services/versionService';
import { getInstallationId } from '../../services/installationId';
import { getFlavorContext } from '../../native/AppFlavor';
import { logEvent } from '../../util/analytics';

/**
 * Splash minimum visual presence per design-spec §1 (2400 ms with scalePop
 * logo at 700 ms + tagline fade at 400 ms — the animations are tracked
 * separately; this constant is the gate that ensures the brand is on
 * screen for at least this long).
 */
export const SPLASH_MIN_MS = 2400;

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface NavigationLike {
  replace: (name: string, params?: Record<string, unknown>) => void;
  getParent?: () => NavigationLike | undefined;
}

export default function SplashScreen() {
  const navigation = useNavigation() as unknown as NavigationLike;

  useEffect(() => {
    let cancelled = false;
    logEvent('splash_shown');

    async function bootstrap(): Promise<void> {
      // Mint installation_id eagerly — the compat-signature builder (plan
      // 02-16) will read it sync once we hit the Compat gate. Failing this
      // call should NOT block splash; the signature call will retry there.
      try {
        await getInstallationId();
      } catch {
        // Native module unavailable in degenerate environments. Splash
        // continues; downstream services degrade gracefully.
      }

      // Run splash-min-time and version-check in parallel. Promise.all
      // resolves only after BOTH complete, so the splash is on screen for
      // at least SPLASH_MIN_MS regardless of how fast the network is, AND
      // the version-check has either resolved or hit its 5 s timeout.
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
          logEvent('upg_soft_banner_shown', { latest: action.latest });
        }
      }

      // Plan 02-16 wires the real currentCompatSignature; null today
      // (offline-boot caveat in initialRoute.ts trusts the persisted
      // compatPassed when null).
      const initial = computeInitialRoute(store, null);

      if (initial.stack === 'ForceUpgrade') {
        // Should be unreachable on this code path (force-upgrade dispatches
        // above), but kept for defensive completeness.
        navigation.replace('ForceUpgrade', initial.params);
        return;
      }
      if (initial.stack === 'OnboardingStack') {
        // We're already inside OnboardingStack; replace within the stack
        // to the right step.
        navigation.replace(initial.screen);
        return;
      }
      if (initial.stack === 'MainTabs') {
        // MainTabs is a RootNativeStack sibling — bubble up to the parent.
        navigation.getParent?.()?.replace('MainTabs');
        return;
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <ScreenContainer
      style={{ alignItems: 'center', justifyContent: 'center' }}
      backgroundColor={colors.bg}
      accessibilityLabel="Splash screen"
    >
      <View style={styles.center}>
        <View accessibilityLabel="Humyn Labs logo">
          {/* Wordmark stub per the same TopBar pattern — plan 02-15 swaps
              in the real SVG mark from design-system/. */}
          <Text variant="displayHero" tone="primary">
            Humyn
          </Text>
        </View>
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
