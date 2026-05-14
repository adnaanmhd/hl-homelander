// TaskCard — Phase 6 Plan 06-07 Task 1 (TASK-01 / TASK-04 / TASK-10 grid item).
//
// Renders a single 2-column task tile per design-spec §10 / 06-UI-SPEC:
//   - Container: surface bg, 18px radius (radii.tile), 16px padding, aspect
//     1:1.05, 1.5px line border. Scale-to-pressScale on press (universal
//     Pressable primitive — design-spec §0.4 motion.pressScale).
//   - 28px <TaskIcon> in colors.accent stroke 1.75 (design-spec §10).
//   - Category eyebrow (typography.formLabel, UPPERCASE, secondary tone).
//   - Task name (typography.taskCardName — 15/19/600, primary tone).
//   - Description (typography.taskCardDesc — 12/16/400, secondary tone),
//     truncated to 2 lines via numberOfLines={2}.
//
// NO hex literals — every color/spacing/radius/typography token comes from
// `../ui/tokens` (D-UI-01 token-discipline gate, the
// __tests__/ui/no-hex-literals.test.ts walker).
import React from 'react';
import { View, StyleSheet } from 'react-native';
// Metro's platform-specific module resolution picks `TaskIcon.native.tsx` over
// the web `TaskIcon.tsx` for the React Native bundle (06-RESEARCH Q-2). The web
// variant stays alive for §v2 ARCH-V2-02 (web/desktop review-only client). tsc
// follows the barrel and surfaces a pre-existing `lucide-react` resolution
// error that landed with 06-05; it pre-dates this plan and is logged in the
// SUMMARY as a deferred issue rather than worked around here.
import { TaskIcon } from '../../../../design-system/task-icons';
import { Text } from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii } from '../ui/tokens';

export interface TaskCardProps {
  /** Task slug (id or display name). Forwarded to `<TaskIcon task=…>`. */
  slug: string;
  /** Task display name, verbatim from `task-taxonomy.md`. */
  name: string;
  /** Category eyebrow text — rendered UPPERCASE via typography.formLabel. */
  category: string;
  /** 1-2 line task description, verbatim from `task-taxonomy.md`. */
  description: string;
  /** Tap handler — opens the Task details sheet. */
  onPress?: () => void;
}

export function TaskCard({
  slug,
  name,
  category,
  description,
  onPress,
}: TaskCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`task-card-${slug}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.iconRow}>
        <TaskIcon task={slug} size={28} strokeWidth={1.75} color={colors.accent} />
      </View>
      <Text
        variant="formLabel"
        tone="secondary"
        accessibilityLabel={`task-card-${slug}-category`}
        style={styles.eyebrow}
      >
        {category.toUpperCase()}
      </Text>
      <Text
        variant="taskCardName"
        tone="primary"
        accessibilityLabel={`task-card-${slug}-name`}
        style={styles.name}
        numberOfLines={2}
      >
        {name}
      </Text>
      <Text
        variant="taskCardDesc"
        tone="secondary"
        accessibilityLabel={`task-card-${slug}-desc`}
        style={styles.desc}
        numberOfLines={2}
      >
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // aspect 1:1.05 — design-spec §10. RN supports `aspectRatio` in StyleSheet;
  // FlatList numColumns owners drive the width.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: spacing.l,
    aspectRatio: 1 / 1.05,
    justifyContent: 'flex-start',
  },
  iconRow: {
    marginBottom: spacing.m,
  },
  eyebrow: {
    marginBottom: spacing.xs,
  },
  name: {
    marginBottom: spacing.xs,
  },
  desc: {
    // typography.taskCardDesc + secondary tone already applied via Text
    // variant + tone — nothing extra needed.
  },
});

export default TaskCard;
