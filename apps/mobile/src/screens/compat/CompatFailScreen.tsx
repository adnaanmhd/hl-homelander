/**
 * CompatFailScreen — design-spec §4d + COMPAT-08.
 *
 * "This phone can't record yet" + per-failed-key diagnostic copy with
 * measured values inline ("Stable motion sensors at 100 Hz+ required (yours:
 * 44 Hz)") + "What now" CTA → CompatRecoveryScreen.
 *
 * NO proceed CTA — COMPAT-06 enforced (user cannot continue past compat fail).
 *
 * Phase 2 plan 02-15 Task 4. NO hex literals — all colors from `colors.*`
 * tokens (design-spec §0.1).
 */
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import type { CompatResult } from '@humyn/shared-types';

interface NavigationLike {
  navigate(route: string): void;
}

export default function CompatFailScreen() {
  const navigation = useNavigation<NavigationLike>();
  const compat = useAppStore((s) => s.compatLastResult);

  const lines = compat ? failureLines(compat) : [];

  return (
    <ScreenContainer accessibilityLabel="CompatFail screen" padding={spacing.h}>
      <Text variant="sheetTitle" style={styles.title}>
        This phone can&apos;t record yet
      </Text>
      <ScrollView style={styles.list}>
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
      </ScrollView>
      <View style={styles.cta}>
        <Button
          variant="primary"
          accessibilityLabel="compat-fail-what-now"
          onPress={() => navigation.navigate('CompatRecovery')}
          label="What now"
        />
      </View>
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
  title: { marginTop: spacing.xxxxl, marginBottom: spacing.md },
  list: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.m },
  cross: { color: colors.coral, marginRight: spacing.ms },
  lineText: { flex: 1 },
  cta: { marginTop: spacing.l },
});
