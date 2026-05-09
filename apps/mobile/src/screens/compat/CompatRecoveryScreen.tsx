/**
 * CompatRecoveryScreen — COMPAT-08 (non-brick "what now" page).
 *
 * NO proceed CTA — the user must use a different qualifying device or contact
 * support. COMPAT-06 enforced (cannot continue beyond compat fail). The
 * hardware back arrow returns to CompatFailScreen; no forward path.
 *
 * The mailto target is the same `[EMAIL_ADDRESS]` placeholder that gates
 * HELP-03 — the final email is an Open Question (RESEARCH § Open Questions
 * item 4); 02-19 wires the same placeholder for HelpCenter and 02-21 manual-
 * smoke flags both to remind the operator at the phase gate.
 *
 * Phase 2 plan 02-15 Task 5. NO hex literals — all colors from `colors.*`
 * tokens (design-spec §0.1).
 */
import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { spacing } from '../../ui/tokens';

const SUPPORT_EMAIL_PLACEHOLDER = '[EMAIL_ADDRESS]';

export default function CompatRecoveryScreen() {
  return (
    <ScreenContainer accessibilityLabel="CompatRecovery screen" padding={spacing.h}>
      <Text variant="sheetTitle" style={styles.title}>
        What now
      </Text>
      <Text variant="body" tone="secondary" style={styles.body}>
        This phone doesn&apos;t meet the recording requirements. Try a different qualifying device,
        or reach out to support — share your phone model and roughly when this happened.
      </Text>

      <View style={styles.bullets}>
        <Text
          variant="body"
          style={styles.bullet}
          accessibilityLabel="recovery-bullet-different-device"
        >
          {'• '}Try a different phone with a 1080p ultrawide rear camera (≥110° dFOV) and a
          gyroscope + accelerometer.
        </Text>
        <Text variant="body" style={styles.bullet} accessibilityLabel="recovery-bullet-not-rooted">
          {'• '}Make sure the device is not rooted and was installed from a trusted source.
        </Text>
        <Text variant="body" style={styles.bullet} accessibilityLabel="recovery-bullet-rerun">
          {'• '}If you&apos;ve changed phones recently, the check will re-run automatically the next
          time you sign in.
        </Text>
      </View>

      <View style={styles.cta}>
        <Button
          variant="primary"
          accessibilityLabel="compat-recovery-contact-support"
          label="Contact Support"
          onPress={() => {
            const subject = encodeURIComponent('Compatibility check — need help');
            const body = encodeURIComponent(
              'Phone model:\nWhat I was trying to do:\nWhen it happened:\n',
            );
            Linking.openURL(`mailto:${SUPPORT_EMAIL_PLACEHOLDER}?subject=${subject}&body=${body}`);
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xxxxl, marginBottom: spacing.md },
  body: { marginBottom: spacing.ll },
  bullets: { marginBottom: spacing.xxxl },
  bullet: { marginBottom: spacing.ms },
  cta: { marginTop: 'auto' },
});
