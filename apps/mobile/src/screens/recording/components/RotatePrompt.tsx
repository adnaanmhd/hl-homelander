/**
 * RotatePrompt — the `rotate-prompt` substate body (design-spec §7a,
 * engineering-handoff §4.3). Shown until the device reports landscape +
 * mounted on the rig.
 *
 * Centered: a phone-rotate icon + the verbatim label
 *   "Rotate to landscape and mount on rig"
 * and — ONLY when `__DEV__` (so production builds dead-code-eliminate it,
 * threat T-4.7-04) — an accent "Pretend I rotated →" debug pill that
 * force-advances the surface (the screen dispatches LANDSCAPE_DETECTED).
 *
 * The PRODUCTION rotate-prompt → ready exit is NOT this pill — it is the
 * `RecordingScreen` device-orientation effect (CR-01 fix): a physical rotation
 * to landscape (or the device already being in landscape on mount) dispatches
 * LANDSCAPE_DETECTED. The `__DEV__` pill below is a *supplementary* dev
 * shortcut, not the only exit.
 *
 * NO hex literals — colors from `colors.*`.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../ui/primitives/Text';
import { Icon } from '../../../ui/primitives/Icon';
import { Pressable } from '../../../ui/primitives/Pressable';
import { colors, radii, spacing } from '../../../ui/tokens';

export interface RotatePromptProps {
  /** dev-only escape hatch — wired to dispatch LANDSCAPE_DETECTED. */
  onPretendRotated?(): void;
}

export function RotatePrompt({ onPretendRotated }: RotatePromptProps): React.JSX.Element {
  return (
    <View style={styles.wrap} accessibilityLabel="rotate-prompt">
      <Icon name="RotateCw" size={48} color={colors.recTextPrimary} />
      <Text variant="caption" style={styles.body}>
        Rotate to landscape and mount on rig
      </Text>
      {__DEV__ ? (
        <Pressable
          accessibilityLabel="rotate-prompt-pretend"
          onPress={onPretendRotated}
          style={styles.devPill}
        >
          <Text variant="pillLabel" style={styles.devPillLabel}>
            Pretend I rotated →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.l },
  body: { color: colors.recTextCaption, textAlign: 'center' },
  devPill: {
    marginTop: spacing.l,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
  },
  devPillLabel: { color: colors.recTextPrimary },
});

export default RotatePrompt;
