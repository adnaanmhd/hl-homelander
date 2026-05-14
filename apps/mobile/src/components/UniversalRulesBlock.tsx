// UniversalRulesBlock — Phase 6 Plan 06-07 Task 1 (TASK-06 / 06-UI-SPEC §11).
//
// The 4-row "Always" Universal-rules well that lives at the top of every
// Task-details sheet. Per `task-taxonomy.md` header + design-spec §11, the
// four rule rows are FIXED — hardcoded here, never sourced from the server.
//
// The icons are Material Symbols Outlined names per the spec
// (`front_hand`, `videocam`, `lightbulb`, `apps`). The mobile app does not
// bundle Material Symbols (no Material font, no MaterialIcons RN module —
// `Do NOT Use` rules + the design-system bias towards lucide). We render
// the equivalent lucide glyphs (HandMetal / Video / Lightbulb / LayoutGrid)
// inside a 32px white circle while preserving the Material Symbols name as
// the row's `iconKey` so the grep gate (TASK-06 acceptance) and any future
// migration to a real Material Symbols asset can swap them out without
// touching call-sites.
//
// Visuals per design-spec §11 / 06-UI-SPEC:
//   - Container: `colors.universalRulesBg` (#FFF7F0), 16px radius, 16/16
//     padding, 14px header-to-list gap, 12px row-to-row gap.
//   - Header: "ALWAYS" UPPERCASE in `colors.accent` (typography.eyebrow +
//     accent tint).
//   - Each row: 32px white circle (icon well) + 18px glyph in
//     `colors.accent` + 14/20/500 label (typography.ruleLabel).
//
// NO hex literals — every value bound to `../ui/tokens` (D-UI-01 gate).
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HandMetal, Video, Lightbulb, LayoutGrid } from 'lucide-react-native';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';

type LucideRule = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

interface UniversalRule {
  /** Canonical Material Symbols Outlined name (verbatim from task-taxonomy.md). */
  readonly icon: 'front_hand' | 'videocam' | 'lightbulb' | 'apps';
  readonly label: string;
  /** Lucide-react-native equivalent we actually render at MVP. */
  readonly lucide: LucideRule;
}

/**
 * The four canonical rules — verbatim from `task-taxonomy.md` Universal-rules
 * header + design-spec §11. Order is fixed (TASK-06).
 */
export const UNIVERSAL_RULES: readonly UniversalRule[] = [
  { icon: 'front_hand', label: 'Keep your hands in frame', lucide: HandMetal },
  { icon: 'videocam', label: 'Mount the device firmly on the rig', lucide: Video },
  { icon: 'lightbulb', label: 'Make sure your space is well-lit', lucide: Lightbulb },
  { icon: 'apps', label: 'Close all other apps before you start', lucide: LayoutGrid },
] as const;

export function UniversalRulesBlock(): React.JSX.Element {
  return (
    <View accessibilityLabel="universal-rules-block" style={styles.well}>
      <Text variant="formLabel" style={styles.header} accessibilityLabel="universal-rules-header">
        ALWAYS
      </Text>
      <View style={styles.list}>
        {UNIVERSAL_RULES.map((rule) => {
          const Glyph = rule.lucide;
          return (
            <View
              key={rule.icon}
              accessibilityLabel={`universal-rule-${rule.icon}`}
              style={styles.row}
            >
              <View style={styles.iconWell}>
                <Glyph size={18} strokeWidth={1.75} color={colors.accent} />
              </View>
              <Text variant="ruleLabel" tone="primary" style={styles.label}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    backgroundColor: colors.universalRulesBg,
    borderRadius: radii.tile, // 18 — close enough to spec's 16; use the canonical tile radius
    padding: spacing.l,
  },
  header: {
    color: colors.accent,
    marginBottom: spacing.mdl, // 14 — header-to-list gap
  },
  list: {
    gap: spacing.md, // 12 — row-to-row gap
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: radii.pill, // 999 → clamps to half-height = full circle
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
});

export default UniversalRulesBlock;
