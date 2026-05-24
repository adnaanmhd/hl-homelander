// TaskDetailsSheet — Phase 6 Plan 06-07 Task 2 (TASK-04 / TASK-05 / TASK-06 /
// TASK-07; design-spec §11 / 06-UI-SPEC §Task details sheet).
//
// Bottom sheet that opens on Task-card tap. Layout, per spec:
//   1. 40×4 grab handle
//   2. 64px accentSoft rounded square (radii.tile) housing a 40px <TaskIcon>
//   3. Category chip (UPPERCASE, accentSoft bg + accent text) + optional
//      "Outdoor" chip (neutral) when task.setting === 'outdoor'
//   4. Task name (sheetTitle: 24/28/700 / -0.3)
//   5. Task description (body, secondary tone)
//   6. <UniversalRulesBlock /> — 4 hardcoded rows from task-taxonomy.md
//   7. "FOR THIS TASK" eyebrow + up to 3 instructions verbatim (Check glyph
//      in accent + 15/22/400 taskBullet)
//   8. Sticky "Start Recording" primary button — fires onStartRecording then
//      closes the sheet with a 200ms delay (caller owns navigation).
//
// TASK-07: the per-task instructions max-3 / no-universal-duplicates rule is
// enforced at Phase 1 seed time via `task-taxonomy.md`. This sheet renders
// verbatim what the server returns — no client-side guard.
//
// NO hex literals — every value bound to `../../ui/tokens`.
import React, { useMemo } from 'react';
import { PanResponder, View, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { Task } from '@humyn/shared-types';

import { Sheet } from '../../ui/primitives/Sheet';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { TaskIcon } from '../../../../../design-system/task-icons';
import { UniversalRulesBlock } from '../../components/UniversalRulesBlock';
import { colors, spacing, radii } from '../../ui/tokens';

export interface TaskDetailsSheetProps {
  /** Sheet visibility. */
  visible: boolean;
  /** Selected task — null when the sheet is hidden (caller may pass null). */
  task: Task | null;
  /** Dismiss handler — fires on scrim tap / back-press / cancel. */
  onDismiss: () => void;
  /**
   * Start Recording handler — called when the user taps the sticky CTA. The
   * caller is responsible for dismissing AND navigating; this component
   * doesn't know about navigation.
   */
  onStartRecording: (task: Task) => void;
}

export function TaskDetailsSheet({
  visible,
  task,
  onDismiss,
  onStartRecording,
}: TaskDetailsSheetProps): React.JSX.Element | null {
  const { t } = useTranslation();
  // Plan 06-12 follow-on (Finding 2, owner directive 2026-05-14;
  // re-fixed after the first attempt didn't actually claim the touch on-
  // device) — the backdrop tap + X close already dismissed the sheet;
  // this PanResponder adds a pan-down-on-the-grab-handle gesture for
  // parity with iOS sheets.
  //
  // V1 used `onStartShouldSetPanResponder: false` + a move-time predicate,
  // but the parent Sheet `<RNPressable>` was claiming the touch first and
  // never releasing it (Pressable installs as the responder on touch-down
  // even when its press semantics never fire). V2 claims on START with
  // capture so the grab-handle's responder beats the Pressable's. Tap
  // (release with dy~0) still no-ops because the dismiss is only fired
  // when `dy > 60` OR velocity-down >= 0.5 px/ms.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => undefined,
        onPanResponderMove: () => undefined,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 60 || g.vy > 0.5) onDismiss();
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => undefined,
      }),
    [onDismiss],
  );

  if (!task) return null;

  const isOutdoor = task.setting === 'outdoor';
  const instructions = (task.instructions ?? []).slice(0, 3); // TASK-07 — max 3

  return (
    <Sheet visible={visible} onDismiss={onDismiss} accessibilityLabel="task-details-sheet">
      {/* 40×4 grab handle (design-spec §11) — also the hit-target for the
          pan-down dismiss gesture (Plan 06-12 Finding 2). */}
      <View
        accessibilityLabel="task-details-grab-handle"
        style={styles.grabHandleWrap}
        {...panResponder.panHandlers}
      >
        <View style={styles.grabHandle} />
      </View>

      <ScrollView
        accessibilityLabel="task-details-scroll"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 64px accentSoft well + 40px TaskIcon */}
        <View style={styles.iconWell}>
          <TaskIcon task={task.slug} size={40} strokeWidth={1.75} color={colors.accent} />
        </View>

        {/* Chips: Category (always) + Outdoor (conditional) */}
        <View style={styles.chipRow}>
          <View accessibilityLabel="task-details-category-chip" style={styles.categoryChip}>
            <Text variant="formLabel" style={styles.categoryChipLabel}>
              {task.category.toUpperCase()}
            </Text>
          </View>
          {isOutdoor ? (
            <View accessibilityLabel="task-details-outdoor-chip" style={styles.outdoorChip}>
              <Text variant="formLabel" style={styles.outdoorChipLabel}>
                {t('taskDetails.outdoorChip')}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          variant="sheetTitle"
          tone="primary"
          accessibilityLabel="task-details-name"
          style={styles.name}
        >
          {task.name}
        </Text>
        <Text
          variant="body"
          tone="secondary"
          accessibilityLabel="task-details-description"
          style={styles.description}
        >
          {task.description}
        </Text>

        <View style={styles.rulesBlock}>
          <UniversalRulesBlock />
        </View>

        {instructions.length > 0 ? (
          <View accessibilityLabel="task-details-instructions">
            <Text variant="formLabel" tone="secondary" style={styles.instructionsHeader}>
              {t('taskDetails.forThisTask')}
            </Text>
            <View style={styles.bulletList}>
              {instructions.map((line, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletGlyph}>
                    <Check size={16} strokeWidth={1.75} color={colors.accent} />
                  </View>
                  <Text variant="taskBullet" tone="primary" style={styles.bulletText}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          variant="primary"
          label={t('taskDetails.startRecording')}
          accessibilityLabel="task-details-start-recording"
          onPress={() => onStartRecording(task)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grabHandleWrap: {
    alignItems: 'center',
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
  },
  grabHandle: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radii.tile, // 18 — square with 18 radius per design-spec §11
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.l,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.m,
    marginBottom: spacing.md,
  },
  categoryChip: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.md,
    borderRadius: radii.chip,
    backgroundColor: colors.accentSoft,
  },
  categoryChipLabel: {
    color: colors.accent,
  },
  outdoorChip: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.md,
    borderRadius: radii.chip,
    backgroundColor: colors.line,
  },
  outdoorChipLabel: {
    color: colors.text2,
  },
  name: {
    marginBottom: spacing.m,
  },
  description: {
    marginBottom: spacing.xl,
  },
  rulesBlock: {
    marginBottom: spacing.xl,
  },
  instructionsHeader: {
    marginBottom: spacing.md,
  },
  bulletList: {
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bulletGlyph: {
    width: 16,
    height: 22, // align to first line of taskBullet (15/22)
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
  },
  footer: {
    paddingTop: spacing.l,
  },
});

export default TaskDetailsSheet;
