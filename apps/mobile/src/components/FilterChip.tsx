// FilterChip — Phase 6 Wave 5 (Plan 06-09).
//
// Pill-shaped filter trigger used by HistoryScreen's header row. The chip
// reads its label from the consumer (e.g. "All time ▾" / "today ▾" / "Apr 30
// – May 6 ▾") and exposes a single `onPress` callback that opens the shared
// FilterSheet (apps/mobile/src/screens/shared/FilterSheet.tsx — Plan 06-08).
//
// Geometry per UI-SPEC §History (§13):
//   - 8 / 14 padding (`spacing.m` vertical, `spacing.mdl` horizontal)
//   - 999 px radius (`radii.pill`)
//   - 1 px `--line` border, `--surface` bg
//   - 14 / 500 label fill = `--text` (the `pillLabel` typography variant)
//   - trailing lucide `ChevronDown` 16 px in `--text2`
//
// Press transform: the canonical `motion.pressScale` from the shared
// Pressable primitive (scale-to-0.98 on press, per design-spec §0.4).
//
// Tokens-only. No hex literals — the no-hex-literals gate
// (`apps/mobile/__tests__/ui/no-hex-literals.test.ts`) walks every file
// under `components/` and rejects raw `#RRGGBB` constants.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Text from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, radii, spacing, typography } from '../ui/tokens';

export interface FilterChipProps {
  /** Visible label, e.g. "All time ▾" — the chevron glyph is rendered separately. */
  label: string;
  /** Fires when the chip is tapped. Caller opens FilterSheet here. */
  onPress: () => void;
}

export function FilterChip({ label, onPress }: FilterChipProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="history-filter-chip"
      onPress={onPress}
      style={styles.chip}
    >
      <View accessibilityLabel="history-filter-chip-inner" style={styles.inner}>
        <Text
          variant="pillLabel"
          accessibilityLabel="history-filter-chip-label"
          style={styles.label}
        >
          {label}
        </Text>
        <ChevronDown size={16} color={colors.text2} strokeWidth={1.75} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 8 / 14 padding + 999 px radius + 1 px line border + surface bg per UI-SPEC §13.
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.mdl,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamily.medium,
  },
});

export default FilterChip;
