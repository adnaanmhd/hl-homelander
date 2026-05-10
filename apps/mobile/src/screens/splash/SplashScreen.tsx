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
 *   5. Otherwise dispatch the gate-decision tree result.
 *
 * Visuals (design-spec §1 + prototype.html):
 *   - Centered orange Humyn Labs wordmark — `scalePop` 700 ms cubic-bezier
 *     (.2,.8,.2,1): scale 0.6/op 0 → scale 1.06 (60%) → scale 1/op 1.
 *   - Tagline fades in 400 ms with a 600 ms delay; "Real Humyns." in
 *     `--text` and "Real Intelligence." in `--accent`.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ORANGE_LOGO = require('../../assets/logos/orange_logo.png');

import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { colors, spacing } from '../../ui/tokens';

import { useAppStore } from '../../state/appStore';
import { computeInitialRoute } from '../../state/initialRoute';
import { fetchAppVersion, computeUpgradeAction } from '../../services/versionService';
import { getInstallationId } from '../../services/installationId';
import { getFlavorContext } from '../../native/AppFlavor';
import { logEvent } from '../../util/analytics';

export const SPLASH_MIN_MS = 2400;
const BOOTSTRAP_HARD_TIMEOUT_MS = 8000;

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface NavigationLike {
  replace: (name: string, params?: Record<string, unknown>) => void;
  getParent?: () => NavigationLike | undefined;
}

export default function SplashScreen() {
  const navigation = useNavigation() as unknown as NavigationLike;

  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        delay: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale, taglineOpacity]);

  useEffect(() => {
    let cancelled = false;
    logEvent('splash_shown');
    console.log('[splash] bootstrap_start');

    async function bootstrap(): Promise<void> {
      try {
        await Promise.race([getInstallationId(), delay(BOOTSTRAP_HARD_TIMEOUT_MS)]);
        console.log('[splash] installation_id_done');
      } catch (e) {
        console.warn('[splash] installation_id_failed', e);
      }

      const versionResponse = await Promise.race([
        Promise.all([
          fetchAppVersion().catch((e) => {
            console.warn('[splash] fetchAppVersion_failed', e);
            return null;
          }),
          delay(SPLASH_MIN_MS),
        ]).then(([v]) => v),
        delay(BOOTSTRAP_HARD_TIMEOUT_MS).then(() => {
          console.warn('[splash] bootstrap_hard_timeout');
          return null;
        }),
      ]);
      if (cancelled) return;

      const store = useAppStore.getState();
      let flavorCtx;
      try {
        flavorCtx = getFlavorContext();
      } catch (e) {
        console.warn('[splash] flavor_ctx_failed', e);
        flavorCtx = { versionName: '0.1.0' };
      }
      console.log('[splash] versionResponse=', versionResponse, 'flavor=', flavorCtx);

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

      const initial = computeInitialRoute(store, null);
      console.log('[splash] initial_route=', initial);

      if (initial.stack === 'ForceUpgrade') {
        navigation.replace('ForceUpgrade', initial.params);
        return;
      }
      if (initial.stack === 'OnboardingStack') {
        navigation.replace(initial.screen);
        return;
      }
      if (initial.stack === 'MainTabs') {
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
        <Animated.View
          accessibilityLabel="Humyn Labs logo"
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          {/* Plan 03-02 — drop the cover-crop + magic-number sizing.
              Plan 03-01 pre-cropped the source PNG to a tight wordmark
              bounding box and exported @1x/@2x/@3x density buckets
              (320×73 / 640×146 / 960×220). RN Metro auto-picks the
              right bucket per device density; the asset's intrinsic
              dimensions are the rendered dimensions, so no `style`
              width/height is needed. */}
          <Image
            source={ORANGE_LOGO}
            accessibilityLabel="Humyn Labs Capture wordmark"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
        <View style={{ height: spacing.l }} />
        <Animated.View style={{ opacity: taglineOpacity }}>
          <Text variant="caption" tone="primary" accessibilityLabel="splash tagline">
            Real Humyns.{' '}
            <Text variant="caption" style={{ color: colors.accent }}>
              Real Intelligence.
            </Text>
          </Text>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // Plan 03-02 — `logo` style removed; the @1x/@2x/@3x density-bucketed
  // PNG (Plan 03-01) carries its intrinsic dimensions and Metro
  // auto-picks per device density.
});
