/**
 * AlertPill — small amber pill that surfaces battery / thermal alerts while
 * recording is active. Recording continues — this is an overlay/indicator,
 * not a substate change (driven by the `recState.alerts` flags).
 *
 * Battery: "Battery 15%"   ·   Thermal: "Phone too hot"
 *
 * Plan 06-12 follow-on (Finding 3, owner directive 2026-05-14):
 * Previously this rendered as a `position: 'absolute'` top-right overlay
 * (38 px from top, 14 px from right per design-spec §7e). The owner wants
 * it pinned at the bottom of the recording screen, **below the Stop
 * Recording button**, where it's more readable while wearing the rig. The
 * pill now renders as an in-flow element; the caller (`RecordingScreen`)
 * places it directly after the Stop button inside the center stack.
 *
 * `colors.amber` bg, white 12/600 text (04-UI-SPEC § Typography). NO hex
 * literals.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../ui/tokens';

export interface AlertPillProps {
  label: string;
  visible: boolean;
}

export function AlertPill({ label, visible }: AlertPillProps): React.JSX.Element | null {
  if (!visible || label === '') return null;
  return (
    <View style={styles.pill} accessibilityLabel="alert-pill">
      <Text variant="recAlertPill" style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    backgroundColor: colors.amber,
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.md,
    marginTop: spacing.l,
  },
  text: { color: colors.recTextPrimary },
});

export default AlertPill;
