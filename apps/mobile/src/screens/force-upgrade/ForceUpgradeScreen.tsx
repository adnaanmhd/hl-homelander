// ForceUpgradeScreen — UPG-03 + D-UPG-01..04 (plan 02-20).
//
// Non-dismissible block screen rendered when installedVersion < minSupported
// (the splash-time version-service decision lives in versionService.ts +
// computeUpgradeAction). The screen pulls the AppVersionResponse out of the
// Zustand store (appVersionCache.response — written there by versionService),
// so the per-flavor install path is selected from the same payload that
// gated the navigation in the first place.
//
// hardBlock=true (default) means:
//   - hardware back is intercepted (BackHandler returns true) per D-NAV-04;
//   - no Cancel CTA renders;
//   - the only escape is a successful upgrade.
//
// Tapping Update calls upgradeFlow.startUpgrade(payload). Three error-path
// surfaces:
//   - apk_hash_mismatch        → "Update failed (integrity check)"
//                                 + "Try again or contact support"
//                                 (D-UPG-02 catastrophic copy).
//   - apk_download_failed       → "Update failed" + the Kotlin error message
//                                 (typically a network/disk issue the user
//                                 can retry from after a connectivity fix).
//   - other                     → generic "Update failed" + raw message.
//
// The screen does NOT mount the SoftUpgradeBanner — they are mutually
// exclusive (force-upgrade is a full-screen takeover; soft-banner is a
// dismissible Home affordance).

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, BackHandler, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import Button from '../../ui/primitives/Button';
import { spacing } from '../../ui/tokens';
import { startUpgrade } from '../../services/upgradeFlow';
import { useAppStore } from '../../state/appStore';
import { logEvent } from '../../util/analytics';
import type { AppVersionResponse } from '@humyn/shared-types';

interface RouteParams {
  hardBlock?: boolean;
}

export default function ForceUpgradeScreen(): React.JSX.Element {
  const route = useRoute<{ key: string; name: string; params?: RouteParams }>();
  const params: RouteParams = route?.params ?? { hardBlock: true };
  const hardBlock = params.hardBlock ?? true;
  // versionService writes the entry; we narrow to .response (the wire DTO).
  const payload = useAppStore((s) =>
    s.appVersionCache ? (s.appVersionCache.response as AppVersionResponse) : null,
  );
  const [busy, setBusy] = useState(false);

  // D-NAV-04 — hardware back is blocked while hardBlock is true. RN's
  // BackHandler.addEventListener returns a subscription; the cleanup MUST
  // call .remove() on unmount or back navigation resumes for unrelated
  // screens.
  useEffect(() => {
    if (!hardBlock) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [hardBlock]);

  // Surface the screen view event once on mount so ops can track UPG-03
  // arrival rate.
  useEffect(() => {
    logEvent('upg_force_upgrade_shown', { flavor: payload?.flavor ?? 'unknown' });
  }, [payload?.flavor]);

  const onUpdate = useCallback(async () => {
    if (!payload) {
      Alert.alert('Update info unavailable', 'Try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      await startUpgrade(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Try again later.';
      if (msg === 'apk_hash_mismatch') {
        // D-UPG-02 catastrophic copy — never pass a mismatched APK to
        // PackageInstaller. The catastrophic Analytics event already fired
        // inside startUpgrade.
        Alert.alert('Update failed (integrity check)', 'Try again or contact support.');
      } else if (msg === 'apk_download_failed') {
        Alert.alert('Update failed', 'Check your connection and try again.');
      } else {
        Alert.alert('Update failed', msg);
      }
    } finally {
      setBusy(false);
    }
  }, [payload]);

  return (
    <ScreenContainer accessibilityLabel="force-upgrade-screen" padding={spacing.h}>
      <View style={styles.center}>
        <Text variant="sheetTitle" style={styles.title}>
          Update to continue.
        </Text>
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
