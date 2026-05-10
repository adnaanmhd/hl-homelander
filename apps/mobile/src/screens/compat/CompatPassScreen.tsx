/**
 * CompatPassScreen — design-spec §4c (post Plan 03-03 auto-advance).
 *
 * Per 02-COSMETIC-GAPS.md § Compat-pass screen: the success state is now a
 * transient confirmation, not a gate. When all checks pass:
 *   1. Mount renders "You're in. All checks passed." + 40 ms haptic.
 *   2. After ~1.5 s the screen auto-routes to RigTutorial via
 *      `navigation.replace('RigTutorial')` — no manual tap needed.
 *   3. Hardware-back during the window unmounts the screen and
 *      `clearTimeout(t)` cancels the pending route call (T-3.2-05
 *      mitigation — same behavior as the pre-merge "didn't tap Continue"
 *      path).
 *
 * Storage warning banner (COMPAT-03) still renders inline when
 * freeStorageGB.warningOnly === true; it co-exists with the auto-advance
 * timer (the user sees the banner during the 1.5 s window before the
 * RigTutorial transition).
 *
 * Phase 2 plan 02-15 Task 4 lineage. NO hex literals — every color comes
 * from `colors.*` tokens (design-spec §0.1).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HapticFeedback from 'react-native-haptic-feedback';
import { Text } from '../../ui/primitives/Text';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing, radii } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';

interface NavigationLike {
  replace(route: string): void;
}

// Auto-advance window per 02-COSMETIC-GAPS.md § Compat-pass screen ("≤1.5 s
// with the existing 40 ms haptic"). Long enough for the user to register
// the success state; short enough that it doesn't feel like a gate.
const AUTO_ADVANCE_MS = 1500;

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

  useEffect(() => {
    // Auto-advance to RigTutorial — Plan 03-03 (02-COSMETIC-GAPS.md
    // § Compat-pass screen). Cleanup cancels the pending route call if the
    // user hardware-backs out before the timer fires (T-3.2-05 mitigation).
    const t = setTimeout(() => navigation.replace('RigTutorial'), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [navigation]);

  const showStorageWarning = compat?.checks.freeStorageGB.warningOnly === true;

  return (
    <ScreenContainer accessibilityLabel="CompatPass screen" padding={spacing.h}>
      <View style={styles.body}>
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
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Center the success body vertically — auto-advance fires before any CTA
  // would render, so the screen is a transient confirmation, not a gate.
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { textAlign: 'center' },
  sub: { marginTop: spacing.m, textAlign: 'center' },
  warningBanner: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.bannerWarnBg,
    padding: spacing.mdl,
    borderRadius: radii.input,
  },
  warningText: { color: colors.bannerWarnText },
});
