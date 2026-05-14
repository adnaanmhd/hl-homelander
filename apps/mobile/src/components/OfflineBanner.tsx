// OfflineBanner — Phase 6 Wave 4 (Plan 06-08, HOME-10).
//
// Inline neutral-palette banner shown INSIDE the Pending Uploads section
// header strip when the device is offline. Per UI-SPEC §"Offline banner
// (HOME-10)":
//   - Background: `colors.line` (#E8E5E0) — neutral, NOT amber/coral.
//   - Icon: lucide `WifiOff` 14 px in `colors.text2`.
//   - Label: 13/18/`text2`: "Offline — uploads will resume when network is back."
//   - No tap. No dismiss. Auto-hides via the parent's render gate
//     (HomeScreen owns the `offline` boolean).
//
// Purely presentational — the parent decides when to mount it.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import Text from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';

export function OfflineBanner(): React.JSX.Element {
  return (
    <View accessibilityLabel="offline-banner" style={styles.strip}>
      <WifiOff size={14} color={colors.text2} strokeWidth={1.75} />
      <Text variant="caption" style={styles.label}>
        Offline — uploads will resume when network is back.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.line, // neutral palette per UI-SPEC §Offline banner
    paddingVertical: spacing.ms, // 10
    paddingHorizontal: spacing.md, // 12
    borderRadius: radii.input, // 12
  },
  label: {
    color: colors.text2, // 13/18 text2 per UI-SPEC
    flexShrink: 1,
  },
});

export default OfflineBanner;
