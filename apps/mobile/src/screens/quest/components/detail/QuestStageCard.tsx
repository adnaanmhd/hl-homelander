import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { Text } from '../../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../../ui/tokens';
import type { QuestDetail, QuestStageStatus, QuestStatusDetails, Stage } from '../../types';
import { QUEST_STAGE_STATUS } from '../../types';

interface Props {
  stage: Stage;
  quest: QuestDetail;
  questStatus: QuestStatusDetails | null;
  loginDetailsDisabled: boolean;
  onSubmit: (stageNum: number, reward: number, needsProof: boolean) => void;
}

function stageStatusFor(stageNum: number, statuses: QuestStageStatus[] | undefined): string {
  return statuses?.find((s) => Number(s.stage) === stageNum)?.status?.toUpperCase() ?? '';
}

export default function QuestStageCard({
  stage,
  quest,
  questStatus,
  loginDetailsDisabled,
  onSubmit,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { basic_details, earnings } = stage;
  const earning = earnings?.gamer_earnings?.[0];
  const earningType = earning?.earningType ?? '';
  const amount = Math.round(earning?.earningAmount ?? 0);
  const status = stageStatusFor(stage.stage, questStatus?.stages);
  const questUserStatus = questStatus?.quest?.toLowerCase() ?? '';

  const canSubmit = useMemo(() => {
    if (quest.quest_state === 'Ended') return false;
    if (questUserStatus === 'not started' || questUserStatus === 'not_started') return false;
    if (!loginDetailsDisabled && quest.loginDetailsStage) return false;
    const terminal: string[] = [
      QUEST_STAGE_STATUS.EARNING_CREDITED,
      QUEST_STAGE_STATUS.VALIDATED_PROOF,
      QUEST_STAGE_STATUS.NOEARNINGS_PROOF,
    ];
    if (terminal.includes(status)) {
      return false;
    }
    return true;
  }, [quest, questUserStatus, loginDetailsDisabled, status]);

  const statusChip = useMemo(() => {
    switch (status) {
      case QUEST_STAGE_STATUS.VALIDATING_PROOF:
        return { label: 'UNDER REVIEW', bg: colors.chipProgressBg, fg: colors.amber };
      case QUEST_STAGE_STATUS.VALIDATED_PROOF:
      case QUEST_STAGE_STATUS.EARNING_CREDITED:
        return { label: 'VALIDATED', bg: colors.chipSuccessBg, fg: colors.success };
      case QUEST_STAGE_STATUS.INVALID_PROOF:
      case QUEST_STAGE_STATUS.DUPLICATE_PROOF:
        return { label: 'INVALID', bg: colors.chipFailedBg, fg: colors.coral };
      default:
        return null;
    }
  }, [status]);

  const resubmitStatuses: string[] = [
    QUEST_STAGE_STATUS.VALIDATING_PROOF,
    QUEST_STAGE_STATUS.INVALID_PROOF,
    QUEST_STAGE_STATUS.DUPLICATE_PROOF,
  ];
  const isResubmit = resubmitStatuses.includes(status);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`Stage ${stage.stage}`}
        onPress={() => setExpanded((e) => !e)}
        style={styles.header}
      >
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" tone="tertiary">
            STAGE {stage.stage}
          </Text>
          <Text variant="taskCardName" style={{ color: colors.text, marginTop: spacing.xs }}>
            {basic_details?.stage_title}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {statusChip && (
            <View style={[styles.statusChip, { backgroundColor: statusChip.bg }]}>
              <Text variant="taskCardDesc" style={{ color: statusChip.fg }}>
                {statusChip.label}
              </Text>
            </View>
          )}
          {expanded ? (
            <ChevronUp size={18} color={colors.text2} />
          ) : (
            <ChevronDown size={18} color={colors.text2} />
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          {stage.steps?.map((step, i) => (
            <Text
              key={`${stage.stage}-step-${i}`}
              variant="body"
              tone="secondary"
              style={{ marginBottom: spacing.s }}
            >
              {step.text}
            </Text>
          ))}
          {amount > 0 && (
            <Text variant="taskCardDesc" style={{ color: colors.accent, marginBottom: spacing.m }}>
              Reward: {earningType === 'INR' ? '₹' : ''}
              {amount}
            </Text>
          )}
          {canSubmit && (
            <Pressable
              accessibilityLabel={isResubmit ? 'Resubmit proof' : 'Submit proof'}
              onPress={() => onSubmit(stage.stage, amount, Boolean(basic_details?.proof))}
              style={styles.submitBtn}
            >
              <Text variant="pillLabel" style={{ color: colors.surface }}>
                {isResubmit ? 'RESUBMIT' : 'SUBMIT'}
              </Text>
            </Pressable>
          )}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  statusChip: {
    paddingHorizontal: spacing.s,
    paddingVertical: 3,
    borderRadius: radii.chip,
  },
  content: { paddingHorizontal: spacing.l, paddingBottom: spacing.l },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.chip,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
});
