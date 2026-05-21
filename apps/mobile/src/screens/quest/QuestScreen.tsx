import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/rootTypes';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Pressable } from '../../ui/primitives/Pressable';
import { Text } from '../../ui/primitives/Text';
import { colors, spacing, radii } from '../../ui/tokens';
import { useQuestStore } from './questStore';
import { useQuestProfileStore } from './questProfileStore';
import { useQuestSelectionStore } from './questSelectionStore';
import type { CategoryType, FilterType, Quest } from './types';
import { redirectToAiTrainingQuest } from './utils/redirectToAiTrainingQuest';
import FeaturedCarousel from './components/FeaturedCarousel';
import FilterTabs from './components/FilterTabs';
import InProgressCard from './components/InProgressCard';
import QuestCard from './components/QuestCard';
import { InProgressSkeleton, QuestGridSkeleton } from './components/QuestSkeleton';

const CATEGORIES: { label: string; value: CategoryType }[] = [
  { label: 'AI Training', value: 'AI' },
  { label: 'Gaming', value: 'GAMING' },
];

export default function QuestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    featured,
    isFeaturedLoading,
    inProgress,
    isInProgressLoading,
    recommended,
    isRecommendedLoading,
    isLoadingMore,
    hasMore,
    page,
    fetchFeatured,
    fetchInProgress,
    fetchRecommended,
    clearRecommended,
  } = useQuestStore();

  const [category, setCategory] = useState<CategoryType>('GAMING');
  const [filter, setFilter] = useState<FilterType>('Live');
  const [refreshing, setRefreshing] = useState(false);
  const isInitialized = useRef(false);
  const fetchQuestProfile = useQuestProfileStore((s) => s.fetchProfile);

  useEffect(() => {
    void fetchQuestProfile();
  }, [fetchQuestProfile]);

  const loadAll = useCallback(
    (cat: CategoryType, fil: FilterType, pg: number) => {
      fetchFeatured(cat);
      fetchInProgress(cat);
      fetchRecommended({ category: cat, filter: fil, page: pg });
    },
    [fetchFeatured, fetchInProgress, fetchRecommended],
  );

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadAll(category, filter, 1);
    }
  }, [category, filter, loadAll]);

  const onCategoryChange = useCallback(
    (cat: CategoryType) => {
      setCategory(cat);
      setFilter('Live');
      clearRecommended();
      loadAll(cat, 'Live', 1);
    },
    [clearRecommended, loadAll],
  );

  const onFilterChange = useCallback(
    (fil: FilterType) => {
      setFilter(fil);
      clearRecommended();
      fetchRecommended({ category, filter: fil, page: 1 });
    },
    [category, clearRecommended, fetchRecommended],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearRecommended();
    await Promise.allSettled([
      fetchFeatured(category),
      fetchInProgress(category),
      fetchRecommended({ category, filter, page: 1 }),
    ]);
    setRefreshing(false);
  }, [category, filter, clearRecommended, fetchFeatured, fetchInProgress, fetchRecommended]);

  const onEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore || isRecommendedLoading) return;
    fetchRecommended({ category, filter, page });
  }, [category, filter, page, hasMore, isLoadingMore, isRecommendedLoading, fetchRecommended]);

  const questBySlug = useMemo(() => {
    const map = new Map<string, Quest>();
    for (const q of [...featured, ...recommended]) {
      map.set(q.quest_slug, q);
    }
    return map;
  }, [featured, recommended]);

  const setQuestPreview = useQuestSelectionStore((s) => s.setPreview);

  const onQuestPress = useCallback(
    (slug: string) => {
      const item = questBySlug.get(slug);
      if (item?.enableModalUploadValidation) {
        redirectToAiTrainingQuest(item.questId);
        return;
      }
      setQuestPreview(item ?? null);
      navigation.navigate('QuestDetails', { questSlug: slug });
    },
    [navigation, questBySlug, setQuestPreview],
  );

  const noopQuestPress = useCallback((_slug: string) => {}, []);

  // ─── Sub-renders ────────────────────────────────────────────────────────

  const CategoryTabs = useMemo(
    () => (
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => {
          const active = c.value === category;
          return (
            <Pressable
              key={c.value}
              accessibilityLabel={`Category: ${c.label}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onCategoryChange(c.value)}
              style={[styles.categoryTab, active && styles.categoryTabActive]}
            >
              <Text variant="pillLabel" style={{ color: active ? colors.surface : colors.text2 }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [category, onCategoryChange],
  );

  const InProgressSection = useMemo(() => {
    if (!isInProgressLoading && inProgress.length === 0) return null;
    return (
      <View style={styles.inProgressSection}>
        <View style={styles.sectionHeader}>
          <Text variant="eyebrow" tone="tertiary">
            IN PROGRESS
          </Text>
          {isInProgressLoading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        {isInProgressLoading ? (
          <InProgressSkeleton />
        ) : (
          <FlatList
            data={inProgress}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.questId}
            contentContainerStyle={styles.inProgressList}
            ItemSeparatorComponent={() => <View style={{ width: spacing.ms }} />}
            renderItem={({ item }: ListRenderItemInfo<Quest>) => (
              <InProgressCard data={item} onPress={noopQuestPress} />
            )}
          />
        )}
      </View>
    );
  }, [inProgress, isInProgressLoading, noopQuestPress]);

  const RecommendedHeader = useMemo(
    () => (
      <View style={styles.recommendedHeader}>
        <Text variant="eyebrow" tone="tertiary">
          {`QUESTS — ${category === 'AI' ? 'AI TRAINING' : 'GAMING'}`}
        </Text>
        <FilterTabs selected={filter} onChange={onFilterChange} disabled={isRecommendedLoading} />
      </View>
    ),
    [category, filter, onFilterChange, isRecommendedLoading],
  );

  const ListHeader = useCallback(
    () => (
      <>
        {CategoryTabs}
        <FeaturedCarousel quests={featured} loading={isFeaturedLoading} onPress={onQuestPress} />
        {InProgressSection}
        {RecommendedHeader}
      </>
    ),
    [CategoryTabs, featured, isFeaturedLoading, onQuestPress, InProgressSection, RecommendedHeader],
  );

  const ListEmpty = useCallback(
    () =>
      isRecommendedLoading ? (
        <View style={styles.skeletonWrapper}>
          <QuestGridSkeleton />
        </View>
      ) : (
        <View style={styles.emptyWrapper}>
          <View style={styles.emptyBox}>
            <Text variant="taskCardName" style={{ color: colors.text }}>
              No quests match this filter.
            </Text>
            <Text variant="taskCardDesc" tone="secondary" style={{ marginTop: spacing.xs }}>
              Try a different category or filter.
            </Text>
          </View>
        </View>
      ),
    [isRecommendedLoading],
  );

  const ListFooter = useCallback(
    () => (
      <View style={styles.footer}>
        {isLoadingMore && <ActivityIndicator color={colors.accent} size="small" />}
      </View>
    ),
    [isLoadingMore],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Quest>) => (
      <QuestCard
        data={item}
        onPress={onQuestPress}
        style={{
          marginLeft: index % 2 === 0 ? spacing.l : spacing.s,
          marginRight: index % 2 !== 0 ? spacing.l : spacing.s,
        }}
      />
    ),
    [onQuestPress],
  );

  return (
    <ScreenContainer padding={0}>
      {/* Screen header */}
      <View style={styles.header}>
        <Text variant="sheetTitle" style={{ color: colors.text }}>
          Quests
        </Text>
      </View>

      <FlatList
        data={recommended}
        numColumns={2}
        keyExtractor={(item) => item.questId}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },

  // Category tabs
  categoryRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.l,
    marginTop: spacing.md,
    borderRadius: radii.chip,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: spacing.ms,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  categoryTabActive: {
    backgroundColor: colors.accent,
  },

  // In-progress
  inProgressSection: {
    marginTop: spacing.h,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  inProgressList: {
    paddingHorizontal: spacing.l,
  },

  // Recommended
  recommendedHeader: {
    marginHorizontal: spacing.l,
    marginTop: spacing.xl + spacing.xs,
    marginBottom: spacing.xs,
  },

  // Empty state
  skeletonWrapper: { paddingHorizontal: spacing.xs },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.l,
  },
  emptyBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.l,
  },

  // Footer
  footer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
