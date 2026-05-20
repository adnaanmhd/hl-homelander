import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  StyleSheet,
  View,
} from 'react-native';
import { Pressable } from '../../../ui/primitives/Pressable';
import { Text } from '../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../ui/tokens';
import type { FeaturedQuest } from '../types';
import { FeaturedSkeleton } from './QuestSkeleton';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.92;
const BANNER_H = 170;
const SIDE_OFFSET = (SCREEN_W - CARD_W) / 2.8;
const SNAP_INTERVAL = CARD_W + 12;

interface Props {
  quests: FeaturedQuest[];
  loading: boolean;
  onPress: (slug: string) => void;
}

export default function FeaturedCarousel({ quests, loading, onPress }: Props) {
  const flatRef = useRef<FlatList<FeaturedQuest>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dotWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (quests.length < 2) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % quests.length;
        flatRef.current?.scrollToOffset({ offset: next * SNAP_INTERVAL, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [quests.length]);

  useEffect(() => {
    dotWidth.setValue(0);
    Animated.timing(dotWidth, {
      toValue: 22,
      duration: 5000,
      useNativeDriver: false,
    }).start();
  }, [activeIndex, dotWidth]);

  const onMomentumEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveIndex(idx);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<FeaturedQuest>) => (
      <FeaturedCard item={item} index={index} onPress={onPress} />
    ),
    [onPress],
  );

  const dots = useMemo(
    () =>
      quests.map((_, i) =>
        i === activeIndex ? (
          <View key={i} style={styles.dotActive}>
            <Animated.View style={[styles.dotFill, { width: dotWidth }]} />
          </View>
        ) : (
          <View key={i} style={styles.dot} />
        ),
      ),
    [quests, activeIndex, dotWidth],
  );

  if (loading) return <FeaturedSkeleton />;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatRef}
        data={quests}
        horizontal
        bounces={false}
        decelerationRate={0}
        snapToInterval={SNAP_INTERVAL}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: SIDE_OFFSET }}
        onMomentumScrollEnd={onMomentumEnd}
      />
      {quests.length > 1 && <View style={styles.dots}>{dots}</View>}
    </View>
  );
}

interface CardProps {
  item: FeaturedQuest;
  index: number;
  onPress: (slug: string) => void;
}

function FeaturedCard({ item, onPress }: CardProps) {
  const ctaLabel = item.isMiniGames ? 'PLAY NOW' : item.isCampaign ? 'VIEW CAMPAIGN' : 'VIEW QUEST';

  return (
    <Pressable
      accessibilityLabel={`Featured quest: ${item.quest_title}`}
      style={styles.card}
      onPress={() => onPress(item.quest_slug)}
    >
      <View style={styles.featuredBadge}>
        <Text variant="eyebrow" style={{ color: colors.text2 }}>
          FEATURED
        </Text>
      </View>

      <Image source={{ uri: item.questUploadFile }} style={styles.banner} resizeMode="cover" />

      <View style={styles.cropLeft} />
      <View style={styles.cropRight} />

      <View style={styles.content}>
        <Text variant="compatTitle" numberOfLines={1} style={{ color: colors.accent }}>
          {item.quest_title}
        </Text>
        <Text
          variant="taskCardDesc"
          numberOfLines={2}
          tone="secondary"
          style={{ lineHeight: 18, marginTop: spacing.s }}
        >
          {item.quest_description}
        </Text>
        <View style={styles.cta}>
          <Text variant="eyebrow" style={{ color: colors.accent }}>
            {ctaLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_W,
    marginHorizontal: 6,
    marginTop: spacing.xl,
    borderRadius: radii.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  featuredBadge: {
    position: 'absolute',
    top: spacing.ms,
    left: spacing.xl + spacing.ms,
    zIndex: 10,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.s,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  banner: { width: '100%', height: BANNER_H },
  cropLeft: {
    backgroundColor: colors.surface,
    height: 20,
    width: 50,
    position: 'absolute',
    left: -15,
    top: BANNER_H - 10,
    transform: [{ rotate: '45deg' }],
  },
  cropRight: {
    backgroundColor: colors.surface,
    height: 20,
    width: 50,
    position: 'absolute',
    right: -15,
    top: BANNER_H - 10,
    transform: [{ rotate: '-45deg' }],
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.l,
    flex: 1,
  },
  cta: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.s,
    alignSelf: 'flex-start',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 2,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.line,
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 2,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  dotFill: {
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
