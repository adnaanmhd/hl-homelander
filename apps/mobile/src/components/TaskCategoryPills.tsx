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
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii } from '../ui/tokens';

/** The fixed pill order — 'all' sentinel + 10 taxonomy categories (UI-SPEC §10).
 *
 * The const STAYS as the canonical English enum (it's the state value
 * forwarded to the server via /tasks/list category param). The display label
 * is resolved at render time via `pillLabel(value, t)` against the
 * `tasks.category.*` i18n keys — see G-17 closure, Plan 07-16. */
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

/** Map pill value → i18n key. KEEP IN SYNC with `taskI18n.ts localizeTaskCategory`. */
const PILL_LABEL_KEY: Record<TaskCategoryPill, string> = {
  all: 'tasks.category.all',
  Cooking: 'tasks.category.cooking',
  Dishwashing: 'tasks.category.dishwashing',
  Kitchen: 'tasks.category.kitchen',
  Cleaning: 'tasks.category.cleaning',
  Tidying: 'tasks.category.tidying',
  Laundry: 'tasks.category.laundry',
  Gardening: 'tasks.category.gardening',
  'Pet Care': 'tasks.category.petCare',
  'Home Maintenance': 'tasks.category.homeMaintenance',
  Hobby: 'tasks.category.hobby',
};

/** Label resolver — routes through the active locale's `tasks.category.*` key. */
function pillLabel(value: TaskCategoryPill, t: (key: string) => string): string {
  const key = PILL_LABEL_KEY[value];
  return t(key);
}

export function TaskCategoryPills({
  selected,
  onSelect,
}: TaskCategoryPillsProps): React.JSX.Element {
  const { t } = useTranslation();
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
              {/* G-17 (Plan 07-17): overflow guards on the pill Text. Hindi
                  bold-active glyphs (`घर का रखरखाव` etc.) clipped against the
                  pill's fixed width; auto-shrink to 75% rescues. */}
              <Text
                variant="pillLabel"
                style={active ? styles.labelActive : styles.label}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {pillLabel(value, t)}
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
    // G-17 (Plan 07-17): extra right padding so the rightmost pill
    // (e.g. `बागवानी` on hi-IN) doesn't clip at the screen edge during
    // scroll (operator 2026-05-26 7.png evidence).
    paddingRight: spacing.xl + spacing.m,
    gap: spacing.m,
    flexDirection: 'row',
  },
  pill: {
    paddingVertical: 9,
    // G-17 (Plan 07-17): reduced from spacing.l → spacing.m (~10% more
    // horizontal slack inside the pill) so the active-bold variant's wider
    // glyphs don't push the label past the pill width.
    paddingHorizontal: spacing.m,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
  pillActive: {
    paddingVertical: 9,
    paddingHorizontal: spacing.m, // G-17 (Plan 07-17) — see `pill` above
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
    // Plan 07-17 re-walk 2026-05-27 — shrunk 40 → 28 + lowered opacity 0.6
    // → 0.3 so the rightmost pill's Devanagari glyphs stay legible
    // through the UI-SPEC §10 right-edge fade hint (operator 2026-05-27
    // "text truncated in category pills" — the rightmost pill's text was
    // washed out under the prior 40px / 0.6-opacity overlay).
    width: 28,
    backgroundColor: colors.bg,
    opacity: 0.3,
  },
});

export default TaskCategoryPills;
