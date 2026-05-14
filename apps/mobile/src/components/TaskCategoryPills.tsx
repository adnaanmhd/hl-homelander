// TaskCategoryPills — Phase 6 Plan 06-07 Task 1 (TASK-02 / 06-UI-SPEC §10).
//
// 11-pill horizontal scrollable row per design-spec §10. Pills, in fixed order:
//   All · Cooking · Dishwashing · Kitchen · Cleaning · Tidying · Laundry ·
//   Gardening · Pet Care · Home Maintenance · Hobby
// (taxonomy 10 + a leading 'All' pill). 999px radius, 1.5px line border,
// transparent fill; active pill: text fill + white label, no border. 8px
// inter-pill gap (spacing.m); 9/16 padding (9 vertical, 16 horizontal). A
// right-edge fade hint (40px overlay) signals overflow.
//
// 'All' is the canonical sentinel (string-literal type 'all') — caller maps
// 'all' to "no category filter" when calling fetchTasks().
//
// NO hex literals — every value bound to `../ui/tokens`.
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii } from '../ui/tokens';

/** The fixed pill order — 'all' sentinel + 10 taxonomy categories (UI-SPEC §10). */
export const TASK_CATEGORY_PILLS = [
  'all',
  'Cooking',
  'Dishwashing',
  'Kitchen',
  'Cleaning',
  'Tidying',
  'Laundry',
  'Gardening',
  'Pet Care',
  'Home Maintenance',
  'Hobby',
] as const;
export type TaskCategoryPill = (typeof TASK_CATEGORY_PILLS)[number];

export interface TaskCategoryPillsProps {
  /** Currently-selected pill value. */
  selected: TaskCategoryPill;
  /** Selection handler — fires on pill tap. */
  onSelect: (value: TaskCategoryPill) => void;
}

/** Label resolver — 'all' renders as 'All', everything else verbatim. */
function pillLabel(value: TaskCategoryPill): string {
  return value === 'all' ? 'All' : value;
}

export function TaskCategoryPills({
  selected,
  onSelect,
}: TaskCategoryPillsProps): React.JSX.Element {
  return (
    <View accessibilityLabel="task-category-pills" style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {TASK_CATEGORY_PILLS.map((value) => {
          const active = selected === value;
          return (
            <Pressable
              key={value}
              accessibilityLabel={`pill-${value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(value)}
              style={active ? styles.pillActive : styles.pill}
            >
              <Text variant="pillLabel" style={active ? styles.labelActive : styles.label}>
                {pillLabel(value)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* 40px right-edge fade overlay (UI-SPEC §10 overflow hint). pointerEvents
          none so taps fall through to underlying pills. The gradient is faked
          as a tinted overlay so we don't take a new SVG/LinearGradient dep —
          design-spec §10 calls it a hint, not a hard gradient. */}
      <View pointerEvents="none" style={styles.fadeOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.m,
    flexDirection: 'row',
  },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: spacing.l,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
  pillActive: {
    paddingVertical: 9,
    paddingHorizontal: spacing.l,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  label: {
    color: colors.text,
  },
  labelActive: {
    color: colors.surface,
  },
  fadeOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    // Use the canonical bg color as the fade target — keeps the no-hex gate
    // happy and reads as a soft fade against the screen surface.
    backgroundColor: colors.bg,
    opacity: 0.6,
  },
});

export default TaskCategoryPills;
