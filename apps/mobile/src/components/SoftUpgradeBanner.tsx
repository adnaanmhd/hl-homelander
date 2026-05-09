// SoftUpgradeBanner — UPG-04 + D-UPG-05 (plan 02-20).
//
// Dismissible banner mounted ONLY at the top of HomeSkeletonScreen (NOT on
// Tasks/History/Profile — by structural placement, not a feature flag). The
// banner renders when:
//   - useAppStore.softUpgradeAvailable is non-null (versionService set this
//     when installedVersion < latest at boot), AND
//   - the user has not dismissed THIS specific latest version.
//
// Per-version dismiss key (`appVersion.softBannerDismissed.{latest}`) is the
// T-2.20-04 mitigation: dismissals stick across cold-starts on the same
// `latest`, but auto-reset when `latest` advances (the next /app/version
// response with a different `latest` produces a fresh key, so the banner
// re-appears on the next launch).
//
// Tap "Update" → upgradeFlow.startUpgrade(payload) (same per-flavor logic as
// ForceUpgradeScreen via the shared service). On error we swallow + emit
// telemetry (`upg_soft_banner_tapped` already fired); the soft-banner is
// best-effort by design — ForceUpgradeScreen handles the catastrophic UX.
//
// Tokens come from ../ui/tokens — NO hex literals. The banner uses the
// design-spec §19.4 warn-banner palette (bannerWarnBg/bannerWarnText).

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii } from '../ui/tokens';
import { startUpgrade } from '../services/upgradeFlow';
import { useAppStore } from '../state/appStore';
import { secureMmkv } from '../state/mmkv';
import { softBannerDismissKey } from '../state/keys';
import { logEvent } from '../util/analytics';
import type { AppVersionResponse } from '@humyn/shared-types';

export function SoftUpgradeBanner(): React.JSX.Element | null {
  // Trigger flag from versionService (set when installed < latest). When
  // null the banner doesn't render at all — Home reserves no layout space.
  const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
  // The full per-flavor payload — needed for startUpgrade to dispatch the
  // correct install path (apkRollout vs playStore).
  const payload = useAppStore((s) =>
    s.appVersionCache ? (s.appVersionCache.response as AppVersionResponse) : null,
  );

  // Initialize from MMKV: if the user already dismissed THIS latest, render
  // null on first paint (no layout flash). Read once on mount; we don't need
  // to subscribe because the dismiss action is local to this component.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    const latest = softUpgradeAvailable?.latest ?? payload?.latest;
    if (!latest) return true;
    return secureMmkv.getString(softBannerDismissKey(latest)) === 'true';
  });

  const dismiss = useCallback(() => {
    const latest = softUpgradeAvailable?.latest ?? payload?.latest;
    if (latest) {
      secureMmkv.set(softBannerDismissKey(latest), 'true');
    }
    setDismissed(true);
    logEvent('upg_soft_banner_dismissed', { latest: latest ?? 'unknown' });
  }, [softUpgradeAvailable?.latest, payload?.latest]);

  const onUpdate = useCallback(async () => {
    if (!payload) return;
    logEvent('upg_soft_banner_tapped', { flavor: payload.flavor, latest: payload.latest });
    try {
      await startUpgrade(payload);
    } catch {
      // Soft-banner is best-effort — startUpgrade already emitted telemetry
      // on the catastrophic paths; we don't surface an Alert here because
      // the user chose this from a non-blocking affordance.
    }
  }, [payload]);

  // Render guards: no soft-upgrade flag, no payload, or already dismissed →
  // mount nothing (HomeSkeletonScreen also wraps this in an `if
  // (softUpgradeAvailable)` guard, but the explicit return null here keeps
  // the component self-protecting).
  if (!softUpgradeAvailable || !payload || dismissed) return null;

  return (
    <View style={styles.banner} accessibilityLabel="soft-upgrade-banner">
      <View style={styles.copy}>
        <Text variant="caption" style={styles.title}>
          A new version is available
        </Text>
        <Text variant="caption" style={styles.body}>
          Update to v{payload.latest} for the latest improvements.
        </Text>
      </View>
      <Pressable onPress={onUpdate} accessibilityLabel="soft-upgrade-update" style={styles.btn}>
        <Text variant="caption" style={styles.btnText}>
          Update
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        accessibilityLabel="soft-upgrade-dismiss"
        hitSlop={8}
        style={styles.dismissBtn}
      >
        <Text variant="bodyLg" style={styles.dismiss}>
          ×
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bannerWarnBg,
    padding: spacing.md,
    borderRadius: radii.input,
    marginVertical: spacing.m,
  },
  copy: { flex: 1 },
  title: { color: colors.text },
  body: { color: colors.bannerWarnText },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.m,
    borderRadius: radii.chip,
    backgroundColor: colors.text,
    marginHorizontal: spacing.m,
  },
  btnText: { color: colors.surface },
  dismissBtn: { paddingHorizontal: spacing.xs },
  dismiss: { color: colors.bannerWarnText },
});

export default SoftUpgradeBanner;
