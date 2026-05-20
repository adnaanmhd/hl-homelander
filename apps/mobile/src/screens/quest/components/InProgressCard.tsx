import React, { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/primitives/Pressable';
import { Text } from '../../../ui/primitives/Text';
import { colors, spacing } from '../../../ui/tokens';
import type { Quest } from '../types';
import TimerComponent from './TimerComponent';

interface Props {
  data: Quest;
  onPress: (slug: string) => void;
}

function extractYouTubeId(link: string): string | null {
  const m = link.match(/embed\/([a-zA-Z0-9_-]+)/i);
  return m && m[1] ? m[1] : null;
}

function InProgressCard({ data, onPress }: Props) {
  const progress = Math.min(Math.max(data.userQuestProgress ?? 0, 0), 100);
  const fillPct = `${progress}%`;

  const ytId = extractYouTubeId(data.youtubeLink ?? '');
  const thumbnailUri =
    data.questUploadFile ||
    (ytId
      ? `https://img.youtube.com/vi/${ytId}/0.jpg`
      : 'https://picsum.photos/seed/quest/400/200');

  const handlePress = useCallback(() => onPress(data.quest_slug), [onPress, data.quest_slug]);

  return (
    <Pressable
      accessibilityLabel={`In progress quest: ${data.quest_title}`}
      onPress={handlePress}
      style={styles.container}
    >
      <View style={styles.row}>
        <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} resizeMode="cover" />
        <View style={styles.content}>
          <Text
            variant="taskCardName"
            numberOfLines={1}
            style={{ color: colors.text, textTransform: 'capitalize' }}
          >
            {data.quest_title}
          </Text>
          <View style={styles.timerRow}>
            <Text variant="taskCardDesc" tone="tertiary">
              ENDS{' '}
            </Text>
            <TimerComponent targetTimeString={data.end_live} />
          </View>
        </View>
      </View>

      {/* Progress track */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: fillPct as unknown as number }]} />
      </View>
    </Pressable>
  );
}

export default React.memo(InProgressCard);

const styles = StyleSheet.create({
  container: {
    width: 185,
    height: 62,
    backgroundColor: colors.surface,
    borderRadius: spacing.s,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', flex: 1 },
  thumbnail: {
    width: 54,
    height: 56,
    borderTopLeftRadius: spacing.s,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.ms,
    paddingTop: spacing.ms,
    justifyContent: 'center',
  },
  timerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.line,
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 4,
    backgroundColor: colors.accent,
  },
});
