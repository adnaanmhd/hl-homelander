import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../../ui/tokens';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

function Bone({ w, h, style }: { w: number | string; h: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: w as number,
          height: h,
          backgroundColor: colors.line,
          borderRadius: radii.chip,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function QuestCardSkeleton() {
  return (
    <View style={styles.card}>
      <Bone
        w={CARD_W}
        h={130}
        style={{
          borderRadius: 0,
          borderTopLeftRadius: radii.chip,
          borderTopRightRadius: radii.chip,
        }}
      />
      <View style={styles.cardBody}>
        <Bone w="75%" h={12} style={{ marginBottom: spacing.m }} />
        <Bone w="55%" h={10} style={{ marginBottom: spacing.s }} />
        <Bone w="40%" h={10} style={{ marginBottom: spacing.md }} />
        <Bone w="90%" h={28} />
      </View>
    </View>
  );
}

export function QuestGridSkeleton() {
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.gridItem}>
          <QuestCardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function FeaturedSkeleton() {
  return (
    <Bone
      w={width * 0.92}
      h={260}
      style={{ alignSelf: 'center', marginTop: spacing.xl, borderRadius: radii.tile }}
    />
  );
}

export function InProgressSkeleton() {
  return (
    <View style={styles.inProgressRow}>
      {[0, 1, 2].map((i) => (
        <Bone key={i} w={180} h={62} style={{ marginRight: spacing.ms, borderRadius: spacing.s }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardBody: { padding: spacing.m },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.l,
    gap: spacing.md,
  },
  gridItem: { width: CARD_W },
  inProgressRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
  },
});
