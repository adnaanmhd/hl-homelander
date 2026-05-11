/**
 * AlertPill — small amber overlay pill anchored top-right during active
 * recording (design-spec §7e / §19.3). Recording continues — this is an
 * overlay, not a substate change (the `recState.alerts` flags).
 *
 * Battery: "Battery 15%"   ·   Thermal: "Phone too hot"
 *
 * 38 px from top / 14 px from right, `colors.amber` bg, white 12/600 text
 * (04-UI-SPEC § Spacing / § Typography). NO hex literals.
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
    position: 'absolute',
    top: 38,
    right: 14,
    backgroundColor: colors.amber,
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.md,
  },
  text: { color: colors.recTextPrimary },
});

export default AlertPill;
