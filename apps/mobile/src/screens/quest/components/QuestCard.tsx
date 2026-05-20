import React, { useMemo } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/primitives/Pressable';
import { Text } from '../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../ui/tokens';
import type { Quest, QuestState, QuestUserStatus } from '../types';
import TimerComponent from './TimerComponent';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

interface Props {
  data: Quest;
  onPress: (slug: string) => void;
  style?: object;
}

interface StatusConfig {
  label: string;
  color: string;
  chipBg: string;
}

function resolveStatus(state: QuestState, userStatus?: QuestUserStatus): StatusConfig {
  if (state === 'Ended') return { label: 'ENDED', color: colors.text3, chipBg: colors.line };
  if (state === 'Published') return { label: 'UPCOMING', color: colors.text2, chipBg: colors.line };
  switch (userStatus) {
    case 'active':
      return { label: 'IN PROGRESS', color: colors.amber, chipBg: colors.chipProgressBg };
    case 'completed':
      return { label: 'COMPLETED', color: colors.success, chipBg: colors.chipSuccessBg };
    default:
      return { label: 'GET STARTED', color: colors.accent, chipBg: colors.accentSoft };
  }
}

function extractYouTubeId(link: string): string | null {
  const m = link.match(/embed\/([a-zA-Z0-9_-]+)/i);
  return m && m[1] ? m[1] : null;
}

function QuestCard({ data, onPress, style }: Props) {
  const earningType = useMemo(
    () => data.stages[0]?.earnings?.gamer_earnings?.[0]?.earningType ?? '',
    [data.stages],
  );
  const totalReward = useMemo(() => Math.round(data.total_reward ?? 0), [data.total_reward]);
  const remainingSlots = useMemo(
    () => data.stages.reduce((sum, s) => sum + (s.basic_details?.remainingSlots ?? 0), 0),
    [data.stages],
  );
  const {
    label: statusLabel,
    color: statusColor,
    chipBg: statusChipBg,
  } = useMemo(
    () => resolveStatus(data.quest_state, data.questStatus?.status),
    [data.quest_state, data.questStatus?.status],
  );

  const isPublished = data.quest_state === 'Published';
  const isEnded = data.quest_state === 'Ended';
  const targetTime = isPublished ? data.go_live : data.end_live;

  const ytId = extractYouTubeId(data.youtubeLink ?? '');
  const thumbnailUri =
    data.questUploadFile ||
    (ytId
      ? `https://img.youtube.com/vi/${ytId}/0.jpg`
      : 'https://picsum.photos/seed/quest/400/300');

  return (
    <View style={style}>
      <Pressable
        accessibilityLabel={`Quest: ${data.quest_title}`}
        style={styles.card}
        onPress={() => onPress(data.quest_slug)}
      >
        {/* Timer badge */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            {isEnded ? (
              <Text variant="taskCardDesc" style={styles.badgeText}>
                ENDED
              </Text>
            ) : (
              <>
                <Text variant="taskCardDesc" style={styles.badgeText}>
                  {isPublished ? 'STARTS ' : 'ENDS '}
                </Text>
                <TimerComponent targetTimeString={targetTime} color={colors.surface} />
              </>
            )}
          </View>
        </View>

        {/* Thumbnail */}
        <View>
          <Image source={{ uri: thumbnailUri }} style={styles.image} resizeMode="cover" />
          <View style={styles.cropLeft} />
          <View style={styles.cropRight} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text variant="taskCardName" numberOfLines={1} style={{ color: colors.text }}>
            {data.quest_title}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.chip}>
              <Text variant="taskCardDesc" style={{ color: colors.accent }}>
                {totalReward > 0 ? `${earningType === 'INR' ? '₹' : ''}${totalReward}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.slotsRow}>
              <Text variant="taskCardDesc" tone="tertiary">
                Slots{' '}
              </Text>
              <View style={styles.chip}>
                <Text variant="taskCardDesc" style={{ color: colors.text2 }}>
                  {remainingSlots}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text
            variant="taskCardDesc"
            tone="tertiary"
            numberOfLines={1}
            style={{ textTransform: 'capitalize', marginBottom: spacing.m }}
          >
            {data.sponsor_genre}
          </Text>

          <View style={[styles.statusChip, { backgroundColor: statusChipBg }]}>
            <Text variant="eyebrow" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default React.memo(QuestCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  badgeRow: {
    position: 'absolute',
    top: spacing.s,
    left: spacing.s,
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26,26,26,0.72)',
    borderRadius: 3,
    paddingHorizontal: spacing.s,
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.surface,
    letterSpacing: 0.2,
  },
  image: {
    width: CARD_W,
    height: 130,
  },
  cropLeft: {
    backgroundColor: colors.surface,
    width: 35,
    height: 10,
    position: 'absolute',
    left: -15,
    bottom: -2,
    transform: [{ rotate: '45deg' }],
  },
  cropRight: {
    backgroundColor: colors.surface,
    width: 35,
    height: 10,
    position: 'absolute',
    right: -15,
    bottom: -2,
    transform: [{ rotate: '-45deg' }],
  },
  info: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.ms,
    paddingBottom: spacing.s,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.s,
    marginBottom: spacing.m,
  },
  chip: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.s,
    paddingVertical: 3,
    borderRadius: spacing.xs,
  },
  slotsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginBottom: spacing.m,
  },
  statusChip: {
    borderRadius: radii.chip,
    paddingVertical: spacing.s,
    alignItems: 'center',
    marginBottom: 2,
  },
});
