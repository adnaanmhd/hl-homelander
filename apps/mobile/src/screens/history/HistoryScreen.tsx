// HistoryScreen — Phase 6 Wave 5 (Plan 06-09).
//
// Replaces `HistoryPlaceholderScreen.tsx`. Closes HIST-01..HIST-06 + HIST-10 +
// HIST-11:
//   - HIST-01 successful recordings (≥60s server-side ULID-aware filter)
//     fetched from `GET /recordings` via the Phase 6 Wave 3 client
//     (`services/recordingsApi.fetchRecordings`).
//   - HIST-02 grouped by day newest-first via `services/historyGrouping.groupByDay`
//     into a SectionList with the canonical UI-SPEC §History day-group
//     headers ("Today" / "Yesterday" / "This week" / "This month" /
//     "{MonthName YYYY}").
//   - HIST-03 6-option filter chip + the shared FilterSheet (Plan 06-08)
//     — the `historyRange` + `historyRangeCustom` Zustand slices drive the
//     fetch; setting the range refetches the windowed `/recordings` call.
//   - HIST-04 first-time empty state ("Your recordings will live here." +
//     "Pick a task" inline accent link → MainTabs/Tasks) when
//     `historyRange === 'all'` AND rows are empty.
//   - HIST-05 filter-active empty state ("No recordings in this range." +
//     "Show all time" inline accent link → setHistoryRange('all'))
//     when `historyRange !== 'all'` AND rows are empty.
//   - HIST-06 each row shows duration · date · time + UploadStatusChip +
//     thumbnail (HistoryRow).
//   - HIST-10 no row deletion affordance anywhere (the row component owns
//     this — no swipe-to-delete, no menu).
//   - HIST-11 each row reserves the disabled "Feedback (coming soon)" slot.
//
// Tap on a row navigates to the in-app Player route (Plan 06-10 owns the
// route registration); we navigate to `'Player'` with `{ recordingId,
// taskName }`. The route is added to `RootNativeStack.tsx` by Plan 06-10.
//
// Offline signal (planner — same approach as HomeScreen):
//   The Phase 5 `NetworkMonitor.kt` does not yet emit a JS-side event. This
//   screen ships a local `offline` state defaulting to `false` so the
//   render path is verified by tests; a future Wave wires the native
//   subscription without changing this surface.
//
// Pull-to-refresh re-fires `fetchRecordings` with the current range. The
// `_events` outbox-drain hook continues to flow through the Phase-5
// reconcileOnce pipeline on Home; History does NOT need to subscribe to
// that — the truth source is the next `GET /recordings` re-fetch.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Inbox } from 'lucide-react-native';
import type { RecordingsListItem, Task } from '@humyn/shared-types';

import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { colors, spacing, typography } from '../../ui/tokens';
import {
  HistoryRow,
  type HistoryRowItem,
  type HistoryRowDeviceState,
} from '../../components/HistoryRow';
import { HistoryDayHeader } from '../../components/HistoryDayHeader';
import { FilterChip } from '../../components/FilterChip';
import { FilterSheet } from '../shared/FilterSheet';
import { useAppStore } from '../../state/appStore';
import { computeRange, type NamedRange } from '../../services/timeRange';
import { fetchRecordings } from '../../services/recordingsApi';
import { groupByDay, type GroupableRow } from '../../services/historyGrouping';
import {
  readEntry,
  readAllEntries,
  type ThumbnailLedgerEntry,
} from '../../services/thumbnailLedger';
import { fetchTasks } from '../../services/tasksApi';
import {
  HumynUpload,
  onConnectivityChanged,
  onUploadQueueChanged,
  onUploadProgress,
  type UploadProgressEvent,
  type UploadQueueRow,
} from '../../native/HumynUpload';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { logEvent } from '../../util/analytics';

/** Map the on-device `UploadQueueRow.state` to the HistoryRow device-state type — strip 'verified' (those rows are already cleared from the queue / fully reflected by server qaStatus). */
function toDeviceState(s: UploadQueueRow['state']): HistoryRowDeviceState | undefined {
  if (s === 'verified') return undefined;
  return s;
}

const PAGE_LIMIT = 30;

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Resolve the device IANA timezone (D-03b). Best-effort, falls back to UTC. */
function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Build the FilterChip label per UI-SPEC §13 ("All time" default + per-range labels). */
// Plan 06-12 Task 3 — the trailing `▾` glyph used to live in the label
// string AND the FilterChip component rendered its own <ChevronDown />,
// producing two chevrons (06-COSMETIC-GAPS Finding 10). Keep the icon-
// component approach and drop the inline glyph here.
function filterChipLabel(named: NamedRange, custom: { start: string; end: string } | null): string {
  switch (named) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'this-week':
      return 'This week';
    case 'this-month':
      return 'This month';
    case 'all':
      return 'All time';
    case 'custom': {
      if (custom == null) return 'Custom range';
      const start = new Date(`${custom.start}T00:00:00`);
      const end = new Date(`${custom.end}T00:00:00`);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        return 'Custom range';
      }
      const startLbl = `${MONTH_ABBR[start.getMonth()]} ${start.getDate()}`;
      const endLbl = `${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`;
      return `${startLbl} – ${endLbl}`;
    }
  }
}

/** Normalize a snake_case RecordingsListItem into the camelCase HistoryRowItem the row + grouper consume. */
function toRowItem(r: RecordingsListItem, taskNameById: Record<string, string>): HistoryRowItem {
  return {
    id: r.recording_id,
    taskName: taskNameById[r.task_id] ?? 'Recording',
    durationMs: r.duration_ms,
    createdAt: r.created_at,
    qaStatus: r.qa_status,
    verifiedAtIso: null, // server payload doesn't carry verifiedAt; fallback to createdAt at render.
  };
}

export function HistoryScreen(): React.JSX.Element {
  const topBarProps = useTabTopBarProps();
  const navigation = useNavigation<{
    navigate: (route: string, params?: Record<string, unknown>) => void;
  }>();
  const historyRange = useAppStore((s) => s.historyRange);
  const historyRangeCustom = useAppStore((s) => s.historyRangeCustom);
  const setHistoryRange = useAppStore((s) => s.setHistoryRange);
  const setHistoryRangeCustom = useAppStore((s) => s.setHistoryRangeCustom);

  // ---------------------------------------------------------------------
  // Local screen state — rows, pagination cursor, ledger overlay, refresh.
  // ---------------------------------------------------------------------
  const [rawRows, setRawRows] = useState<RecordingsListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [taskNameById, setTaskNameById] = useState<Record<string, string>>({});
  // Owner-directive 2026-05-16 — History merges in-flight device-queue rows
  // alongside server rows so the Home tile's "tap to view all" leads here and
  // the user sees uploading segments with live progress bars, not just the
  // already-verified set. `deviceRows` mirrors HumynUpload.getQueue() filtered
  // to the current user; `progressById` carries byte-progress percent for the
  // actively uploading recordingId. Same subscription pattern as HomeScreen
  // (lines 245-265) — keep them in sync.
  const jwt = useAppStore((s) => s.jwt);
  const currentSub = useMemo(() => decodeGoogleSubFromJwt(jwt), [jwt]);
  const [deviceRows, setDeviceRows] = useState<UploadQueueRow[]>([]);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  useEffect(() => {
    let mounted = true;
    HumynUpload.getQueueSafe()
      .then((all) => {
        if (mounted) setDeviceRows(all.filter((r) => r.ownerUserId === currentSub));
      })
      .catch(() => undefined);
    const sub = onUploadQueueChanged((all) => {
      if (mounted) setDeviceRows(all.filter((r) => r.ownerUserId === currentSub));
    });
    const subProgress = onUploadProgress((e: UploadProgressEvent) => {
      if (!mounted) return;
      const pct = e.bytesTotal > 0 ? (e.bytesUploaded / e.bytesTotal) * 100 : 0;
      setProgressById((prev) => ({ ...prev, [e.recordingId]: pct }));
    });
    return () => {
      mounted = false;
      sub.remove();
      subProgress.remove();
    };
  }, [currentSub]);

  // HOME/HIST-10 offline signal — Plan 06-12 follow-on (Finding 6, owner
  // directive 2026-05-14) wires to the native NetworkMonitor's connectivity
  // event so the History row's offline state flips on airplane-mode toggle.
  const [offline, setOffline] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    void HumynUpload.getConnectivitySafe().then((c) => {
      if (!cancelled) setOffline(!c.online);
    });
    const sub = onConnectivityChanged((e) => setOffline(!e.online));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // ---------------------------------------------------------------------
  // Task-name lookup — fetch the full taxonomy once on mount so each row
  // can render the task name verbatim from the taxonomy. The 65-task
  // list is < 50 KB; one bounded list call is cheaper than per-row
  // lookups. Cursor-paginated; we drain all pages.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function loadAll(): Promise<void> {
      const acc: Task[] = [];
      let cursor: string | undefined;
      try {
        // Cap to 5 pages defensively — the taxonomy is 65 tasks at 100/page.
        for (let i = 0; i < 5; i += 1) {
          const args: Parameters<typeof fetchTasks>[0] = { limit: 100 };
          if (cursor) args.cursor = cursor;
          const res = await fetchTasks(args);
          acc.push(...res.items);
          if (!res.nextCursor) break;
          cursor = res.nextCursor;
        }
      } catch {
        /* best-effort — row falls back to "Recording" placeholder */
      }
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const t of acc) {
        map[t.id] = t.name;
      }
      setTaskNameById(map);
    }
    void loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------
  // /recordings fetch — re-fires on focus AND on historyRange change.
  // First page only (cursor reset); pagination lives in fetchMore below.
  // ---------------------------------------------------------------------
  const loadFirstPage = useCallback(async (): Promise<void> => {
    try {
      const { start, end } =
        historyRange === 'custom'
          ? { start: historyRangeCustom?.start, end: historyRangeCustom?.end }
          : computeRange(historyRange);
      const tz = deviceTz();
      const args: Parameters<typeof fetchRecordings>[0] = { tz, limit: PAGE_LIMIT };
      if (start) args.start = start;
      if (end) args.end = end;
      if (historyRange === 'all') args.range = 'all';
      const res = await fetchRecordings(args);
      setRawRows(res.items);
      setNextCursor(res.next_cursor);
    } catch {
      // HIST-04/05 contract — silently retain previous rows on error; the
      // pull-to-refresh handler surfaces the toast (UI-SPEC §Validation —
      // "Couldn't load recordings. Pull to retry.").
    }
  }, [historyRange, historyRangeCustom]);

  const fetchMore = useCallback(async (): Promise<void> => {
    if (!nextCursor) return;
    try {
      const { start, end } =
        historyRange === 'custom'
          ? { start: historyRangeCustom?.start, end: historyRangeCustom?.end }
          : computeRange(historyRange);
      const tz = deviceTz();
      const args: Parameters<typeof fetchRecordings>[0] = {
        tz,
        limit: PAGE_LIMIT,
        cursor: nextCursor,
      };
      if (start) args.start = start;
      if (end) args.end = end;
      if (historyRange === 'all') args.range = 'all';
      const res = await fetchRecordings(args);
      setRawRows((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor);
    } catch {
      /* best-effort — leave existing rows in place */
    }
  }, [historyRange, historyRangeCustom, nextCursor]);

  useFocusEffect(
    useCallback(() => {
      logEvent('history_view', {});
      void loadFirstPage();
      return undefined;
    }, [loadFirstPage]),
  );

  // Re-fetch when the range slice changes (not just on focus). Note:
  // the focus effect above already calls loadFirstPage on cold mount; this
  // effect only matters when the user changes the range while the screen
  // is focused (FilterSheet apply).
  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const onPullRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } finally {
      setRefreshing(false);
    }
  }, [loadFirstPage]);

  // ---------------------------------------------------------------------
  // Ledger overlay — per-row MMKV lookup (Plan 06-04). The map keys on
  // `recording_id` (the natural key). We rebuild the map on each rows
  // change; ledger reads are MMKV-fast (sub-ms).
  // ---------------------------------------------------------------------
  const ledgerByRecordingId: Record<string, ThumbnailLedgerEntry | null> = useMemo(() => {
    const map: Record<string, ThumbnailLedgerEntry | null> = {};
    for (const r of rawRows) {
      map[r.recording_id] = readEntry(r.recording_id);
    }
    return map;
  }, [rawRows]);

  // Normalize to camelCase rows for HistoryRow + groupByDay. The
  // intersection with `GroupableRow` keeps `historyGrouping.groupByDay`'s
  // open-shape generic happy — `HistoryRowItem` carries the strict
  // fields HistoryRow consumes; the intersection adds the index
  // signature `groupByDay` requires (purely a structural-typing
  // accommodation, no runtime cost).
  type HistoryRowGroupable = HistoryRowItem & GroupableRow;
  // Merge: server rows ⊕ device-queue rows that aren't on server yet.
  //   - Server rows (`rawRows`) are authoritative on `qaStatus`.
  //   - Device-only rows (no /init yet — common while a session is paused
  //     mid-recording or just after a force-stop) are SYNTHESIZED from the
  //     `UploadQueueRow` so the user sees their in-flight uploads here, not
  //     just on the Home tile.
  //   - For rows on BOTH sides, the device's live state takes precedence on
  //     the chip variant (handled inside HistoryRow via `deviceState` prop) —
  //     the server may say `pending` for several seconds before the device
  //     marks the row `uploading` and starts emitting progress ticks.
  const deviceRowsById = useMemo(() => {
    const map: Record<string, UploadQueueRow> = {};
    for (const r of deviceRows) map[r.recordingId] = r;
    return map;
  }, [deviceRows]);
  // Quick task 260517-p5g CAPTURE-QA-05 — read every ledger entry on
  // disk so we can synthesize canceled-segment rows (which have NO
  // server row — they never reached `/init`). We refresh this on every
  // rawRows change so a freshly-canceled segment appears on the next
  // re-render. MMKV reads are sub-ms; the count is bounded by lifetime
  // recording count at MVP (Phase-6 follow-on tracks the indexed-manifest
  // swap if cardinality grows past a few hundred).
  const ledgerEntries: ThumbnailLedgerEntry[] = useMemo(() => readAllEntries(), [rawRows]);
  const rows: HistoryRowGroupable[] = useMemo(() => {
    const serverIds = new Set(rawRows.map((r) => r.recording_id));
    const deviceRowIdSet = new Set(deviceRows.map((r) => r.recordingId));
    const serverRows = rawRows.map((r) => toRowItem(r, taskNameById) as HistoryRowGroupable);
    // Synthesize a HistoryRowItem for every device-queue row that isn't on
    // the server yet AND isn't already in a `verified` end-state (those are
    // about to be cleared by the verified event; the server row covers them).
    const synthesized: HistoryRowGroupable[] = deviceRows
      .filter((r) => !serverIds.has(r.recordingId) && r.state !== 'verified')
      .map(
        (r): HistoryRowGroupable => ({
          id: r.recordingId,
          taskName: taskNameById[r.taskId] ?? 'Recording',
          durationMs: (r.durationSeconds ?? 0) * 1000,
          createdAt: new Date(r.enqueuedAt).toISOString(),
          // qaStatus is a stub for synthesized rows — the chip variant is
          // overridden by `deviceState` further down. We use 'pending' since
          // a device-queued, server-unknown row IS pre-`/init` and thus
          // logically pending.
          qaStatus: 'pending',
          verifiedAtIso: null,
        }),
      );
    // Quick task 260517-p5g CAPTURE-QA-05 — synthesize a History row for
    // every CANCELED ledger entry whose recordingId is NOT in the server
    // set AND NOT in the device-queue set (by definition — a canceled
    // segment never enters either). HistoryRow reads the `cancel` payload
    // and switches to the chip-failed visual with the reason-specific copy.
    const canceledRows: HistoryRowGroupable[] = ledgerEntries
      .filter(
        (e) =>
          e.cancel != null && !serverIds.has(e.recordingId) && !deviceRowIdSet.has(e.recordingId),
      )
      .map(
        (e): HistoryRowGroupable => ({
          id: e.recordingId,
          taskName: e.taskId != null ? (taskNameById[e.taskId] ?? 'Recording') : 'Recording',
          durationMs: e.durationMs ?? 0,
          // The ledger's createdAtMs is wall-clock; ISO it for the day grouper.
          createdAt: new Date(e.createdAtMs).toISOString(),
          // qaStatus is a placeholder — HistoryRow's chip variant is
          // overridden by `cancel` set on the row (see HistoryRow.chipVariant).
          qaStatus: 'rejected',
          verifiedAtIso: null,
          cancel: e.cancel!,
        }),
      );
    // Newest first (server already returns descending; sort merged set).
    return [...canceledRows, ...synthesized, ...serverRows].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
  }, [rawRows, deviceRows, taskNameById, ledgerEntries]);

  // HIST-02 — group into SectionList sections per UI-SPEC §History.
  const sections = useMemo(() => groupByDay<HistoryRowGroupable>(rows), [rows]);

  // ---------------------------------------------------------------------
  // FilterSheet handlers + analytics
  // ---------------------------------------------------------------------
  const openFilterSheet = useCallback(() => setFilterOpen(true), []);
  const closeFilterSheet = useCallback(() => setFilterOpen(false), []);

  const handleNamedChange = useCallback(
    (named: NamedRange) => {
      logEvent('history_filter_changed', { value: named });
      setHistoryRange(named);
    },
    [setHistoryRange],
  );

  const handleCustomChange = useCallback(
    (start: string, end: string) => {
      logEvent('history_filter_changed', { value: 'custom', from: start, to: end });
      setHistoryRangeCustom(start, end);
    },
    [setHistoryRangeCustom],
  );

  // ---------------------------------------------------------------------
  // Row tap — navigate('Player') per HIST-07. Plan 06-10 owns the route
  // registration; this screen is a passive consumer.
  // ---------------------------------------------------------------------
  const onRowTap = useCallback(
    (r: HistoryRowItem) => {
      logEvent('history_row_opened', { recording_id: r.id });
      navigation.navigate('Player', {
        recordingId: r.id,
        taskName: r.taskName,
        durationMs: r.durationMs,
      });
    },
    [navigation],
  );

  // ---------------------------------------------------------------------
  // Failed-row Retry tap — only fires for rows with qa_status ∈
  // {'hash-mismatch', 'rejected'} (the chip-failed variant). Routes through
  // HumynUpload.reupload() which the coordinator dispatches to
  // POST /recordings/:id/reupload (server accepts hash-mismatch → mints
  // fresh upload ids → device re-PUTs every part → /finalize → re-verify).
  // ---------------------------------------------------------------------
  const onRowRetry = useCallback((r: HistoryRowItem) => {
    logEvent('history_row_retry', { recording_id: r.id, qa_status: r.qaStatus });
    void HumynUpload.reupload(r.id).catch(() => undefined);
  }, []);

  // ---------------------------------------------------------------------
  // Empty-state — HIST-04 (no filter, no rows) vs HIST-05 (filter active,
  // no rows). The decision is `historyRange !== 'all'`.
  // ---------------------------------------------------------------------
  const onPickTask = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Tasks' });
  }, [navigation]);

  const onShowAllTime = useCallback(() => {
    setHistoryRange('all');
  }, [setHistoryRange]);

  const renderEmpty = (): React.JSX.Element => {
    const filterActive = historyRange !== 'all';
    return (
      <View accessibilityLabel="history-empty" style={styles.emptyWrap}>
        <Inbox size={48} strokeWidth={1.75} color={colors.text3} />
        {filterActive ? (
          <>
            <Text
              variant="sheetTitle"
              accessibilityLabel="history-empty-heading"
              style={styles.emptyHeading}
            >
              No recordings in this range.
            </Text>
            <Text
              variant="body"
              tone="secondary"
              accessibilityLabel="history-empty-body"
              style={styles.emptyBody}
            >
              No recordings in this range.{' '}
              <Text
                accessibilityRole="link"
                accessibilityLabel="history-empty-show-all-time"
                onPress={onShowAllTime}
                style={styles.emptyLink}
              >
                Show all time
              </Text>
              .
            </Text>
          </>
        ) : (
          <>
            <Text
              variant="sheetTitle"
              accessibilityLabel="history-empty-heading"
              style={styles.emptyHeading}
            >
              Your recordings will live here.
            </Text>
            <Text
              variant="body"
              tone="secondary"
              accessibilityLabel="history-empty-body"
              style={styles.emptyBody}
            >
              You haven&apos;t recorded anything yet.{'\n'}
              <Text
                accessibilityRole="link"
                accessibilityLabel="history-empty-pick-a-task"
                onPress={onPickTask}
                style={styles.emptyLink}
              >
                Pick a task
              </Text>{' '}
              and try one.
            </Text>
          </>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer accessibilityLabel="History screen" padding={0}>
      <TopBar {...topBarProps} />
      <View accessibilityLabel="history-filter-row" style={styles.filterRow}>
        <FilterChip
          label={filterChipLabel(historyRange, historyRangeCustom)}
          onPress={openFilterSheet}
        />
      </View>
      <SectionList
        accessibilityLabel="history-list"
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryRow
            row={item}
            ledgerEntry={ledgerByRecordingId[item.id] ?? null}
            offline={offline}
            onTap={onRowTap}
            onRetry={onRowRetry}
            {...(deviceRowsById[item.id]
              ? (() => {
                  const ds = toDeviceState(deviceRowsById[item.id]!.state);
                  return ds ? { deviceState: ds } : {};
                })()
              : {})}
            {...(progressById[item.id] != null ? { progressPct: progressById[item.id]! } : {})}
          />
        )}
        renderSectionHeader={({ section }) => <HistoryDayHeader title={section.title} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={renderEmpty}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
      />
      <FilterSheet
        visible={filterOpen}
        value={historyRange}
        valueCustom={historyRangeCustom}
        onDismiss={closeFilterSheet}
        onChange={handleNamedChange}
        onCustomChange={handleCustomChange}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.m,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.m,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxxl,
    gap: spacing.l,
  },
  emptyHeading: {
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.text2,
    textAlign: 'center',
  },
  emptyLink: {
    color: colors.accent,
    fontFamily: typography.fontFamily.semibold,
  },
});

export default HistoryScreen;
