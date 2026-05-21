import React, { useMemo } from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { Text } from '../../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../../ui/tokens';
import type { QuestDetail, QuestStatusDetails } from '../../types';
import TimerComponent from '../TimerComponent';

interface Props {
  quest: QuestDetail;
  questStatus: QuestStatusDetails | null;
  bannerUri: string | null;
  totalRemainingSlots: number;
  onStartQuest: () => void;
  isStarting: boolean;
}

function formatReward(earningType: string, amount: number): string {
  const prefix = earningType === 'INR' ? '₹' : '';
  return `${prefix}${Math.round(amount)}`;
}

export default function QuestDetailHero({
  quest,
  questStatus,
  bannerUri,
  totalRemainingSlots,
  onStartQuest,
  isStarting,
}: Props) {
  const earningType = quest.stages[0]?.earnings?.gamer_earnings?.[0]?.earningType ?? '';
  const reward = quest.questAndLeaderboardFirstPositionReward ?? quest.total_reward ?? 0;
  const questUserStatus = questStatus?.quest?.toLowerCase() ?? 'not started';
  const isLive = quest.quest_state === 'Live';
  const showStart = isLive && !['validating', 'completed'].includes(questUserStatus) && reward > 0;

  const statusLabel = useMemo(() => {
    if (quest.quest_state === 'Ended') return 'ENDED';
    if (quest.quest_state === 'Published') return 'UPCOMING';
    if (questUserStatus === 'validating') return 'IN PROGRESS';
    if (questUserStatus === 'completed') return 'COMPLETED';
    return 'LIVE';
  }, [quest.quest_state, questUserStatus]);

  const statusColor =
    quest.quest_state === 'Ended'
      ? colors.text3
      : quest.quest_state === 'Published'
        ? colors.text2
        : colors.success;

  const heroImage =
    bannerUri || quest.questUploadFile || 'https://picsum.photos/seed/quest-detail/800/400';

  return (
    <View style={styles.wrap}>
      <ImageBackground source={{ uri: heroImage }} style={styles.banner} resizeMode="cover">
        <View style={styles.bannerOverlay} />
        <View style={[styles.chip, { backgroundColor: statusColor }]}>
          <Text variant="eyebrow" style={{ color: colors.surface }}>
            {statusLabel}
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.body}>
        <Text variant="sheetTitle" style={{ color: colors.text }}>
          {quest.quest_title}
        </Text>
        <Text variant="body" tone="secondary" style={{ marginTop: spacing.s }}>
          {quest.quest_description}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text variant="eyebrow" tone="tertiary">
              EARN UP TO
            </Text>
            <Text variant="taskCardName" style={{ color: colors.accent, marginTop: spacing.xs }}>
              {formatReward(earningType, reward)}
            </Text>
          </View>
          {isLive && (
            <View style={styles.metaBlock}>
              <Text variant="eyebrow" tone="tertiary">
                TIME LEFT
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <TimerComponent targetTimeString={quest.end_live} color={colors.accent} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Text variant="taskCardDesc" tone="tertiary" style={{ textTransform: 'capitalize' }}>
            {quest.sponsor_genre}
          </Text>
          <Text variant="taskCardDesc" tone="tertiary">
            {totalRemainingSlots} slots left
          </Text>
        </View>

        {showStart && (
          <Pressable
            accessibilityLabel="Start quest"
            onPress={onStartQuest}
            disabled={isStarting || totalRemainingSlots <= 0}
            style={[
              styles.startBtn,
              (isStarting || totalRemainingSlots <= 0) && styles.startBtnDisabled,
            ]}
          >
            {isStarting ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text variant="pillLabel" style={{ color: colors.surface }}>
                {totalRemainingSlots <= 0 ? 'SLOTS FULL' : 'START QUEST'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
    marginHorizontal: spacing.l,
    marginBottom: spacing.md,
  },
  banner: { height: 160, justifyContent: 'flex-end' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,26,0.25)',
  },
  chip: {
    alignSelf: 'flex-start',
    margin: spacing.m,
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderRadius: radii.chip,
  },
  body: { padding: spacing.l },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  metaBlock: { flex: 1 },
  startBtn: {
    marginTop: spacing.l,
    backgroundColor: colors.accent,
    borderRadius: radii.chip,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
  startBtnDisabled: { opacity: 0.5 },
});
