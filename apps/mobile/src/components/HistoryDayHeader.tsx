// HistoryDayHeader — Phase 6 Wave 5 (Plan 06-09).
//
// Day-group section header for HistoryScreen's SectionList. Title is one of
// the canonical UI-SPEC §History day-group strings — "Today", "Yesterday",
// "This week", "This month", or a "{MonthName YYYY}" prior-month label (the
// `historyGrouping.groupByDay` service emits these verbatim — Plan 06-05).
//
// Geometry per UI-SPEC §History (§13):
//   - 12px / 16 / UPPERCASE +0.8 secondary (the `eyebrow` typography variant)
//   - 12px top padding, 8px bottom padding inside a SectionList section header
//   - aligned to the screen's 20px outer gutter via padding on the parent (the
//     SectionList renderSectionHeader doesn't get the gutter for free)
//
// `stickySectionHeadersEnabled={false}` on the SectionList per Pitfall 1 +
// 06-RESEARCH §Pattern 6 (sticky headers regressed Android scroll perf in
// Wave 0 spike).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '../ui/primitives/Text';
import { colors, spacing } from '../ui/tokens';

export interface HistoryDayHeaderProps {
  /** Verbatim eyebrow text — e.g. "Today" / "Yesterday" / "This week" / "April 2026". */
  title: string;
}

export function HistoryDayHeader({ title }: HistoryDayHeaderProps): React.JSX.Element {
  return (
    <View accessibilityLabel="history-day-header" style={styles.wrap}>
      <Text
        variant="eyebrow"
        tone="secondary"
        accessibilityLabel="history-day-header-title"
        style={styles.label}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 12 px top / 8 px bottom per UI-SPEC §13. Outer 20 px horizontal gutter is
  // owned by the SectionList contentContainerStyle (HistoryScreen).
  wrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.m,
  },
  label: {
    color: colors.text2,
  },
});

export default HistoryDayHeader;
