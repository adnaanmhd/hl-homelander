import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { Text } from '../../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../../ui/tokens';
import type { QuestDetail, QuestStatusDetails } from '../../types';

interface Props {
  quest: QuestDetail;
  questStatus: QuestStatusDetails | null;
  disabled: boolean;
  submittedId?: string;
  onOpenLoginModal: () => void;
}

export default function QuestLoginDetailsSection({
  quest,
  questStatus,
  disabled,
  submittedId,
  onOpenLoginModal,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const loginStage = quest.loginDetailsStage;
  if (!loginStage?.title) return null;

  const questNotStarted =
    (questStatus?.quest?.toLowerCase() ?? '') === 'not started' ||
    (questStatus?.quest?.toLowerCase() ?? '') === 'not_started';
  const isEnded = quest.quest_state === 'Ended';
  const canSubmit = !questNotStarted && !disabled && !isEnded;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel="Toggle login details"
        onPress={() => setExpanded((e) => !e)}
        style={styles.header}
      >
        <Text variant="taskCardName" style={{ color: colors.text, flex: 1 }}>
          {loginStage.title}
        </Text>
        {expanded ? (
          <ChevronUp size={18} color={colors.text2} />
        ) : (
          <ChevronDown size={18} color={colors.text2} />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          {loginStage.steps?.map((step) => (
            <Text
              key={step.step}
              variant="body"
              tone="secondary"
              style={{ marginBottom: spacing.s }}
            >
              {step.text}
            </Text>
          ))}
          {submittedId ? (
            <Text variant="taskCardDesc" style={{ color: colors.success, marginTop: spacing.s }}>
              Submitted: {submittedId}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel="Submit login details"
            onPress={onOpenLoginModal}
            disabled={!canSubmit}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            <Text variant="pillLabel" style={{ color: colors.surface }}>
              {disabled ? 'SUBMITTED' : 'SUBMIT LOGIN'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.l,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.l,
  },
  content: { paddingHorizontal: spacing.l, paddingBottom: spacing.l },
  submitBtn: {
    marginTop: spacing.m,
    backgroundColor: colors.accent,
    borderRadius: radii.chip,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
});
