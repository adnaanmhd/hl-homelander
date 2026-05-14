// ContributionTile — Phase 6 Wave 4 (Plan 06-08).
//
// Single contribution tile (recording-duration OR tasks-recorded). Renders
// the mono numeric (`valueText`) + the dynamic time-range label
// (`rangeLabel` — e.g. `today ▾` per UI-SPEC §Tile filter labels) below it
// as a Pressable that opens the FilterSheet via `onTapChip`.
//
// Spec sources:
//   - 06-UI-SPEC.md §"Tile filter labels (§9c)" — copy verbatim ("today ▾"
//     etc.; chevron-down glyph is part of the rangeLabel string passed in
//     by HomeScreen).
//   - 06-PATTERNS.md §"ContributionTile.tsx" — single tile: numeric +
//     filter chevron + label.
//   - 06-UI-SPEC.md §Token Additions — `typography.tileNumber` (28/28
//     mono / 700 / -0.8 px) on the numeric.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii, typography } from '../ui/tokens';

export interface ContributionTileProps {
  /** 'duration' = recording-time tile, 'taskCount' = tasks-recorded tile. */
  kind: 'duration' | 'taskCount';
  /**
   * Pre-formatted numeric text (e.g. "47m" or "3"). The parent formats via
   * `durationFormat()` for duration tiles and stringifies the count for
   * taskCount tiles — kept stringly-typed so the tile is presentational.
   */
  valueText: string;
  /**
   * Pre-formatted range label string with the chevron glyph included
   * (e.g. "today ▾", "Apr 30 – May 6 ▾"). The parent computes this from
   * `homeRange` + `homeRangeCustom` via `tileLabel(...)`.
   */
  rangeLabel: string;
  /** Called when the chevron-row is tapped — opens FilterSheet at the parent. */
  onTapChip: () => void;
}

export function ContributionTile({
  kind,
  valueText,
  rangeLabel,
  onTapChip,
}: ContributionTileProps): React.JSX.Element {
  return (
    <View accessibilityLabel={`contribution-tile-${kind}`} style={styles.card}>
      <Text
        variant="tileNumber"
        accessibilityLabel={`contribution-tile-${kind}-value`}
        style={styles.numeric}
      >
        {valueText}
      </Text>
      <Pressable
        accessibilityLabel={`contribution-tile-${kind}-filter`}
        onPress={onTapChip}
        style={styles.chipRow}
      >
        <Text variant="pillLabel" style={styles.chipLabel}>
          {rangeLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, // white
    borderRadius: radii.tile, // 18 px per UI-SPEC §Spacing `ll`
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: spacing.l, // 16 px per UI-SPEC §Home tile padding
    gap: spacing.m,
    flex: 1, // pair laid out 2-col by parent
    minHeight: 96,
  },
  numeric: {
    fontFamily: typography.fontFamily.mono, // mono per UI-SPEC §Typography tileNumber
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipLabel: {
    color: colors.text2, // secondary tone per UI-SPEC §Tile filter labels
  },
});

export default ContributionTile;
