/**
 * CompatFailScreen — design-spec §4d + COMPAT-08 (post Plan 03-03 merge).
 *
 * Single screen. Failure list + recovery body + Contact Support CTA all
 * inline; the standalone CompatRecoveryScreen and its CompatRecovery route
 * are deleted in this same plan (02-COSMETIC-GAPS.md § Compat-fail screen).
 *
 * Layout (per 02-COSMETIC-GAPS.md): center-aligned both horizontally and
 * vertically; no flex spacer pushing the CTA to the bottom; the entire
 * scrollable body sits as one vertically-centered group. Contact Support
 * stacks immediately under the recovery block with content-driven width
 * (alignSelf: 'center') — same rule as Plan 03-02 Sign-up + Permissions.
 *
 * NO proceed CTA — COMPAT-06 enforced (the user cannot continue past
 * compat-fail; they must use a different qualifying device or contact
 * support).
 *
 * Plan 03-03 — OQ-1 5th and final placeholder occurrence: SUPPORT_EMAIL is
 * now `support@humynlabs.ai` (Plan 03-02 resolved 4 of 5 occurrences and
 * explicitly deferred this one to the Compat-fail merge).
 *
 * NO hex literals — all colors from `colors.*` tokens (design-spec §0.1).
 */
import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import type { CompatResult } from '@humyn/shared-types';

const SUPPORT_EMAIL = 'support@humynlabs.ai';

export default function CompatFailScreen() {
  const compat = useAppStore((s) => s.compatLastResult);

  const lines = compat ? failureLines(compat) : [];

  return (
    <ScreenContainer accessibilityLabel="CompatFail screen" padding={0}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="sheetTitle" style={styles.title}>
          This phone can&apos;t record yet
        </Text>

        <View style={styles.list}>
          {lines.map(({ key, line }) => (
            <View key={key} style={styles.row} accessibilityLabel={`compat-fail-row-${key}`}>
              <Text variant="body" style={styles.cross}>
                ✕
              </Text>
              <Text variant="body" style={styles.lineText}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        {/* Recovery body — inlined from the deleted CompatRecoveryScreen.
            Keeps the COMPAT-08 "what now" guidance one scroll away from
            the failure rows. */}
        <Text variant="body" tone="secondary" style={styles.recoveryBody}>
          This phone doesn&apos;t meet the recording requirements. Try a different qualifying
          device, or reach out to support — share your phone model and roughly when this happened.
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
          <Text
            variant="body"
            style={styles.bullet}
            accessibilityLabel="recovery-bullet-not-rooted"
          >
            {'• '}Make sure the device is not rooted and was installed from a trusted source.
          </Text>
          <Text variant="body" style={styles.bullet} accessibilityLabel="recovery-bullet-rerun">
            {'• '}If you&apos;ve changed phones recently, the check will re-run automatically the
            next time you sign in.
          </Text>
        </View>

        <View style={styles.ctaWrap}>
          <Button
            variant="primary"
            accessibilityLabel="compat-fail-contact-support"
            label="Contact Support"
            onPress={() => {
              const subject = encodeURIComponent('Compatibility check — need help');
              const body = encodeURIComponent(
                'Phone model:\nWhat I was trying to do:\nWhen it happened:\n',
              );
              void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
            }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * Map failed-check keys into the verbatim design-spec §4d copy with measured
 * values substituted. Order matches the design-spec's diagnostic list.
 */
function failureLines(r: CompatResult): { key: string; line: string }[] {
  const out: { key: string; line: string }[] = [];
  const c = r.checks;
  if (!c.ultrawideDfov.pass) {
    out.push({
      key: 'ultrawideDfov',
      line: `Ultrawide camera 110°+ required (yours: ${c.ultrawideDfov.measuredDeg.toFixed(0)}°)`,
    });
  }
  if (!c.resolution || !c.fps) {
    out.push({ key: 'resolutionFps', line: '1080p @ 30 FPS required' });
  }
  if (!c.imuSustained100Hz.pass) {
    out.push({
      key: 'imuSustained100Hz',
      line: `Stable motion sensors at 100 Hz+ required (yours: ${c.imuSustained100Hz.measuredHz.toFixed(0)} Hz)`,
    });
  }
  if (!c.imuP99Ms.pass) {
    out.push({
      key: 'imuP99Ms',
      line: `Sensor jitter ≤12 ms required (yours: ${c.imuP99Ms.measuredMs.toFixed(1)} ms p99)`,
    });
  }
  if (!c.micSampleRate) {
    out.push({ key: 'micSampleRate', line: 'Microphone 48 kHz capability required' });
  }
  if (!c.realtimeTimestamp) {
    out.push({ key: 'realtimeTimestamp', line: 'REALTIME timestamp source required' });
  }
  if (!c.root.pass) {
    out.push({ key: 'root', line: 'Device must not be rooted' });
  }
  if (!c.encoderNoBFrames) {
    out.push({
      key: 'encoderNoBFrames',
      line: 'HEVC encoder must produce I/P-only (no B-frames)',
    });
  }
  if (!c.oisOff) {
    out.push({ key: 'oisOff', line: 'Optical stabilization must be disabled at capture time' });
  }
  if (!c.hdrSdrForced) {
    out.push({ key: 'hdrSdrForced', line: 'SDR mode must be forced (no HDR)' });
  }
  return out;
}

const styles = StyleSheet.create({
  // Per 02-COSMETIC-GAPS.md: center body horizontally + vertically, no flex
  // spacer pushing the CTA to the bottom. Generous horizontal padding so the
  // title + lines don't touch the screen edges.
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.h,
    paddingVertical: spacing.xl,
  },
  title: { marginBottom: spacing.md, textAlign: 'center' },
  list: { width: '100%', marginBottom: spacing.ll },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.m },
  cross: { color: colors.coral, marginRight: spacing.ms },
  lineText: { flex: 1 },
  recoveryBody: { marginBottom: spacing.ll, textAlign: 'center' },
  bullets: { width: '100%', marginBottom: spacing.xxxl },
  bullet: { marginBottom: spacing.ms },
  // Contact Support CTA — content-driven width (alignSelf: 'center'), same
  // rule as Plan 03-02 Sign-up + Permissions ctaWrap.
  ctaWrap: { alignSelf: 'center' },
});
