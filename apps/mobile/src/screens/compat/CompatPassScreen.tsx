/**
 * CompatPassScreen — design-spec §4c.
 *
 * "You're in." / "All checks passed." + 40 ms haptic on mount + Next CTA →
 * RigTutorial. When `freeStorageGB.warningOnly` is true (free storage < 5 GB),
 * a soft warning banner appears above the CTA per COMPAT-03.
 *
 * Phase 2 plan 02-15 Task 4. NO hex literals — every color comes from
 * `colors.*` tokens (design-spec §0.1).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HapticFeedback from 'react-native-haptic-feedback';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing, radii } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';

interface NavigationLike {
  replace(route: string): void;
}

export default function CompatPassScreen() {
  const navigation = useNavigation<NavigationLike>();
  const compat = useAppStore((s) => s.compatLastResult);

  useEffect(() => {
    // 40 ms haptic on mount per design-spec §4c. react-native-haptic-feedback
    // is the chosen library (planner discretion). Best-effort: silently
    // no-ops if the native module isn't registered (the import default is a
    // typed function reference; if missing, the trigger call no-ops).
    try {
      HapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {
      /* haptic best-effort */
    }
  }, []);

  const showStorageWarning = compat?.checks.freeStorageGB.warningOnly === true;

  return (
    <ScreenContainer accessibilityLabel="CompatPass screen" padding={spacing.h}>
      <Text variant="title28" style={styles.title}>
        You&apos;re in.
      </Text>
      <Text variant="body" tone="secondary" style={styles.sub}>
        All checks passed.
      </Text>
      {showStorageWarning ? (
        <View style={styles.warningBanner} accessibilityLabel="compat-storage-warning">
          <Text variant="caption" style={styles.warningText}>
            Free up space to avoid recording loss.{' '}
            {compat!.checks.freeStorageGB.measuredGB.toFixed(1)} GB free.
          </Text>
        </View>
      ) : null}
      <View style={styles.cta}>
        <Button
          variant="primary"
          accessibilityLabel="compat-pass-next"
          onPress={() => navigation.replace('RigTutorial')}
          label="Next"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xxxxl },
  sub: { marginTop: spacing.m },
  warningBanner: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.bannerWarnBg,
    padding: spacing.mdl,
    borderRadius: radii.input,
  },
  warningText: { color: colors.bannerWarnText },
  cta: { marginTop: 'auto' },
});
