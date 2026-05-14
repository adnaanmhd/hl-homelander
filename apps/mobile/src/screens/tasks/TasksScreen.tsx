// TasksScreen — Phase 6 Plan 06-07 Task 2 (TASK-01..04 + TASK-08..10).
//
// Replaces TasksPlaceholderScreen. The full Tasks-tab surface:
//   - TopBar (shared via useTabTopBarProps — Pattern 71)
//   - SearchInput (200ms debounce → useTaskSearch; 400ms analytics PII-safe)
//   - TaskCategoryPills (11 pills — All + 10 taxonomy categories, TASK-02)
//   - 2-col TaskCard grid (FlatList numColumns={2}, 12px gap)
//   - TASK-10 no-results empty state (SearchX + "send a request" link)
//   - Footer "Can't find a task? Send request →" link
//   - TaskDetailsSheet + SendRequestSheet wired
//   - __DEV__ long-press affordance preserved verbatim from TasksPlaceholderScreen
//     (Phase 4 D-NAV-02 — keeps the non-practice debug entry to Recording).
//
// Data sources (already shipped — Phase 1 backend + Phase 6 Wave 3 service
// wrappers):
//   - empty-query default: `fetchTasks({ category? })` (paginated; first page
//     ships 50 of 65 tasks — second page is opportunistic).
//   - non-empty query: `useTaskSearch(q)` (lexical-only, 200ms debounce).
//
// Wire-shape:
//   - Tap card → open TaskDetailsSheet (state lifted here for both sheets)
//   - Tap footer link / empty-state link → open SendRequestSheet
//   - Start Recording (from sheet) → navigation.navigate('Recording', {...})
//
// MainTabs.tsx swap is owned by Plan 06-09 (atomically swaps all 3 tabs to
// avoid same-wave file conflicts) — until then the new TasksScreen is an
// unreferenced export. This is intentional per the plan.
//
// NO hex literals — every value bound to `../../ui/tokens`.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, type ListRenderItem } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SearchX } from 'lucide-react-native';

import ScreenContainer from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Pressable } from '../../ui/primitives/Pressable';
import { TopBar } from '../../components/TopBar';
import { TaskCard } from '../../components/TaskCard';
import {
  TaskCategoryPills,
  type TaskCategoryPill,
} from '../../components/TaskCategoryPills';
import { SearchInput } from '../../components/SearchInput';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { fetchTasks, useTaskSearch } from '../../services/tasksApi';
import type { Task } from '@humyn/shared-types';
import { colors, spacing } from '../../ui/tokens';

import { TaskDetailsSheet } from './TaskDetailsSheet';
import { SendRequestSheet } from './SendRequestSheet';

// Hardcoded canonical dev-seed task — keep in lockstep with DEV_TASK_ID in
// `apps/api/scripts/seed-dev-task.ts`. Lives behind a __DEV__ long-press on
// the TopBar (Phase 4 D-NAV-02 — non-practice debug entry to RecordingScreen).
// Production builds Metro-dead-code-eliminate the entire affordance.
const DEBUG_TEST_TASK = {
  taskId: '01HVDEVSEEDTASK00000000000',
  taskName: 'Dev — Chop vegetables',
  isPractice: false,
  taskCategory: 'cooking',
  taskSetting: 'indoor',
} as const;

type RecordingNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
  push: (route: string, params?: Record<string, unknown>) => void;
};

export function TasksScreen(): React.JSX.Element {
  const topBarProps = useTabTopBarProps();
  const navigation = useNavigation() as unknown as RecordingNav;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategoryPill>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Phase-6 design-spec §10 — server-side lexical search hook fires 200ms
  // after the last keystroke. `results: null` ⇒ default browse view; `[]` ⇒
  // TASK-10 empty state.
  const search = useTaskSearch(debouncedQuery);

  // Default (no search) — fetch the paginated list filtered by category.
  // Lifted out of useEffect so the pull-to-refresh handler can re-fire it.
  const loadList = useCallback(async (): Promise<void> => {
    setLoadingList(true);
    setListError(null);
    const args = categoryFilter === 'all' ? {} : { category: categoryFilter };
    try {
      const res = await fetchTasks(args);
      setTasks(res.items);
    } catch (e) {
      setListError(e as Error);
    } finally {
      setLoadingList(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setListError(null);
    const args = categoryFilter === 'all' ? {} : { category: categoryFilter };
    fetchTasks(args)
      .then((res) => {
        if (!cancelled) setTasks(res.items);
      })
      .catch((e) => {
        if (!cancelled) setListError(e as Error);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryFilter]);

  // Plan 06-12 Task 1 — pull-to-refresh on TasksScreen FlatList. Mirrors
  // Plan 06-09's HistoryScreen / HomeScreen RefreshControl pattern.
  const onPullRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await loadList();
    } finally {
      setRefreshing(false);
    }
  }, [loadList]);

  // The grid data: search results when a non-empty query is active; otherwise
  // the (category-filtered) full list.
  const gridData: Task[] = useMemo(() => {
    if (debouncedQuery.trim().length > 0 && search.results) {
      return search.results;
    }
    return tasks;
  }, [debouncedQuery, search.results, tasks]);

  const isSearching = debouncedQuery.trim().length > 0;
  const showEmptyState =
    isSearching && search.loading === false && search.results !== null && search.results.length === 0;

  // Sheet visibility — both sheets live at this screen so a sheet-driven
  // request can dismiss into the other (TASK-10 "send a request" link).
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [requestOpen, setRequestOpen] = useState<boolean>(false);

  const openTaskDetails = useCallback((task: Task): void => {
    setSelectedTask(task);
    setDetailsOpen(true);
    // emit task_sheet_opened({ task_id }) — analytics is wired post-Wave 4
    // (Plan 06-10 owns the Firebase Analytics adapter); the event call site
    // lives here so the swap is a one-liner.
  }, []);
  const closeTaskDetails = useCallback((): void => {
    setDetailsOpen(false);
  }, []);
  const openSendRequest = useCallback((): void => {
    setRequestOpen(true);
    // emit task_request_opened()
  }, []);
  const closeSendRequest = useCallback((): void => {
    setRequestOpen(false);
  }, []);

  const handleStartRecording = useCallback(
    (task: Task): void => {
      // design-spec §11 footer — close the sheet, then 200ms later navigate.
      setDetailsOpen(false);
      setTimeout(() => {
        navigation.navigate('Recording', {
          taskId: task.id,
          taskName: task.name,
          taskCategory: task.category,
          taskSetting: task.setting,
          isPractice: false,
        });
      }, 200);
    },
    [navigation],
  );

  // Debounced search wiring — `onChangeDebounced` updates the query that
  // feeds `useTaskSearch`; `onAnalyticsDebounced` would emit `tasks_search`
  // with `{ query_length }` ONLY (T-6.7-04 — never the string).
  const handleSearchDebounced = useCallback((next: string): void => {
    setDebouncedQuery(next);
  }, []);
  const handleSearchAnalytics = useCallback((_next: string): void => {
    // emit tasks_search({ query_length: _next.length })
    // Owned by Plan 06-10 (Firebase Analytics adapter).
  }, []);

  const renderCard: ListRenderItem<Task> = useCallback(
    ({ item }) => (
      <View style={styles.cardWrap}>
        <TaskCard
          slug={item.slug}
          name={item.name}
          category={item.category}
          description={item.description}
          onPress={() => openTaskDetails(item)}
        />
      </View>
    ),
    [openTaskDetails],
  );

  // __DEV__ long-press affordance — preserved verbatim from
  // TasksPlaceholderScreen.tsx (Phase 4 D-NAV-02). Lives behind the entire
  // `__DEV__` guard so Metro dead-code-eliminates it in release builds.
  const onDebugLongPress = __DEV__
    ? () => {
        navigation.push('Recording', { ...DEBUG_TEST_TASK });
      }
    : undefined;

  // emit tasks_view (on mount only)
  useEffect(() => {
    // analytics adapter — Plan 06-10
  }, []);

  return (
    <ScreenContainer accessibilityLabel="Tasks screen" padding={0}>
      {__DEV__ ? (
        <Pressable
          onLongPress={onDebugLongPress}
          delayLongPress={800}
          accessibilityLabel="tasks-debug-hitbox"
        >
          <TopBar {...topBarProps} />
        </Pressable>
      ) : (
        <TopBar {...topBarProps} />
      )}

      <View style={styles.searchWrap}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search tasks…"
          debounceMs={200}
          onChangeDebounced={handleSearchDebounced}
          analyticsDebounceMs={400}
          onAnalyticsDebounced={handleSearchAnalytics}
        />
      </View>

      <TaskCategoryPills
        selected={categoryFilter}
        onSelect={(next) => {
          setCategoryFilter(next);
          // emit tasks_pill_changed({ value: next })
        }}
      />

      {showEmptyState ? (
        <View accessibilityLabel="tasks-empty-state" style={styles.emptyWrap}>
          <SearchX size={48} strokeWidth={1.75} color={colors.text3} />
          <Text variant="body" tone="secondary" style={styles.emptyBody}>
            No tasks match. Try clearing filters or{' '}
            <Text
              variant="body"
              style={styles.emptyLink}
              accessibilityLabel="tasks-empty-send-request"
              onPress={openSendRequest}
            >
              send a request
            </Text>
            .
          </Text>
        </View>
      ) : (
        <FlatList
          accessibilityLabel="tasks-grid"
          data={gridData}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={colors.accent}
            />
          }
          ListFooterComponent={
            <View accessibilityLabel="tasks-footer" style={styles.footerWrap}>
              <Text variant="caption" tone="secondary" style={styles.footerLine}>
                Can&apos;t find a task?{' '}
                <Text
                  variant="caption"
                  style={styles.footerLink}
                  accessibilityLabel="tasks-footer-send-request"
                  onPress={openSendRequest}
                >
                  Send request →
                </Text>
              </Text>
            </View>
          }
        />
      )}

      <TaskDetailsSheet
        visible={detailsOpen}
        task={selectedTask}
        onDismiss={closeTaskDetails}
        onStartRecording={handleStartRecording}
      />
      <SendRequestSheet visible={requestOpen} onDismiss={closeSendRequest} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  gridContent: {
    paddingTop: spacing.m,
    paddingBottom: spacing.xxxxl,
    gap: spacing.md, // 12px row-to-row gap
  },
  cardWrap: {
    flex: 1,
    maxWidth: '48%',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxxl,
  },
  emptyBody: {
    marginTop: spacing.l,
    textAlign: 'center',
  },
  emptyLink: {
    color: colors.accent,
  },
  footerWrap: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  footerLine: {
    textAlign: 'center',
  },
  footerLink: {
    color: colors.accent,
  },
});

export default TasksScreen;
