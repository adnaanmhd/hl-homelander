// HomeScreen — Phase 6 Wave 4 (Plan 06-08).
//
// Replaces `HomeSkeletonScreen.tsx`. Closes HOME-01..HOME-06 + HOME-09 + HOME-10:
//   - HOME-01 first-time empty hero: lifetime.recordingCount === 0 → HomeHero
//     'empty' variant + empty-tip line + Pending Uploads section hidden.
//   - HOME-02 returning hero: lifetime.recordingCount > 0 → HomeHero
//     'returning' variant with lifetime numeric (mono) + "Across N tasks".
//   - HOME-03/04 recording-duration tile + tasks-recorded tile: two
//     ContributionTiles consuming the homeRange Zustand slice; the
//     chevron-down filter trigger opens FilterSheet.
//   - HOME-05 Pending Uploads gated by `pendingRows.length > 0`.
//   - HOME-06 numerics via canonical `formatDuration()` from
//     services/durationFormatter.
//   - HOME-09 pull-to-refresh fires fetchLifetime + fetchContributionsAggregate.
//   - HOME-10 inline offline banner inside Pending Uploads section header.
//
// PRESERVED VERBATIM from HomeSkeletonScreen (Phase 5 D-10 + Wave-1.5 +
// Wave-2):
//   - pendingRows + progressById subscriptions (HumynUpload.onUploadQueueChanged
//     + onUploadProgress).
//   - drainPendingUploadToast() + useFocusEffect 30s reconcileOnce poll.
//   - The Pending Uploads tile row layout (filename, duration, chip,
//     progress fill).
//   - The Wave-1.5 Item 6 tile tap → navigate('MainTabs',
//     { screen: 'History' }) + drainNowSafe kick.
//
// MainTabs swap is owned by Plan 06-09 (the atomic 3-tab swap). Until 06-09
// lands, the Home tab still renders HomeSkeletonScreen; this HomeScreen
// file is the destination for the swap.
//
// Offline signal (planner — D-09b §source):
//   The Phase 5 `NetworkMonitor.kt` already exists but does not surface a
//   JS-side event. The 06-CONTEXT plan suggests either extending
//   `onUploadQueueChanged` with `offline: boolean` OR adding a new
//   `onConnectivityChanged` event. Neither has landed; this plan ships
//   the JS surface (a local `offline` state defaulting to `false`) so the
//   render path is verified by tests, with the native event landing as a
//   follow-on. The `setOffline` setter is exposed via test-only state
//   manipulation; a future Wave will wire the native subscription
//   (HumynUpload.onConnectivityChanged) to flip this state without
//   changing the OfflineBanner / Pending Uploads section render logic.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { SoftUpgradeBanner } from '../../components/SoftUpgradeBanner';
import { UploadStatusChip, type UploadStatusChipVariant } from '../../components/UploadStatusChip';
import { HomeHero } from '../../components/HomeHero';
import { ContributionTile } from '../../components/ContributionTile';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FilterSheet } from '../shared/FilterSheet';
import { useAppStore } from '../../state/appStore';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { colors, radii, spacing, typography } from '../../ui/tokens';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { formatDuration } from '../../services/durationFormatter';
import { fetchContributionsAggregate, fetchLifetime } from '../../services/contributionsApi';
import { computeRange, type NamedRange } from '../../services/timeRange';
import {
  HumynUpload,
  onConnectivityChanged,
  onUploadProgress,
  onUploadQueueChanged,
  type UploadProgressEvent,
  type UploadQueueRow,
} from '../../native/HumynUpload';
import { drainPendingUploadToast } from '../../state/uploadToastBus';
import { showToast } from '../../components/Toast';
import { reconcileOnce } from '../../services/uploadReconcile';
import { logEvent } from '../../util/analytics';

const HOME_RECONCILE_POLL_MS = 30_000;

interface LifetimeSlim {
  durationMs: number;
  recordingCount: number;
  taskCount: number;
  // Strict count of `practice = false AND qa_status = 'verified'` recordings —
  // the trigger for the HomeHero "Hi {first_name}." greeting (Plan 06-12
  // follow-on, owner directive 2026-05-14). Read from /contributions; defaults
  // to 0 for old payloads / cold-mount empty state.
  verifiedNonPracticeCount: number;
}

interface AggregateSlim {
  durationMs: number;
  taskCount: number;
  recordingCount: number;
}

const LIFETIME_ZERO: LifetimeSlim = {
  durationMs: 0,
  recordingCount: 0,
  taskCount: 0,
  verifiedNonPracticeCount: 0,
};
const AGGREGATE_ZERO: AggregateSlim = { durationMs: 0, taskCount: 0, recordingCount: 0 };

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

function fileName(p: string): string {
  if (!p) return 'recording.mp4';
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

function rowMeta(row: UploadQueueRow): string {
  const d = row.durationSeconds;
  if (typeof d === 'number' && Number.isFinite(d) && d > 0) return formatDuration(d);
  return 'Recording';
}

function chipVariantFor(row: UploadQueueRow): UploadStatusChipVariant {
  switch (row.state) {
    case 'awaiting-verify':
      return 'verifying';
    case 'dead-letter':
      return 'failed';
    case 'verified':
      return 'success';
    default:
      return 'progress';
  }
}

/** Build the lowercase chevron-down label per UI-SPEC §Tile filter labels (§9c). */
function tileLabel(named: NamedRange, custom: { start: string; end: string } | null): string {
  switch (named) {
    case 'today':
      return 'today ▾';
    case 'yesterday':
      return 'yesterday ▾';
    case 'this-week':
      return 'this week ▾';
    case 'this-month':
      return 'this month ▾';
    case 'all':
      return 'all time ▾';
    case 'custom': {
      if (custom == null) return 'custom range ▾';
      // "Apr 30 – May 6 ▾" — en-dash + space padding per UI-SPEC.
      const start = new Date(`${custom.start}T00:00:00`);
      const end = new Date(`${custom.end}T00:00:00`);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        return 'custom range ▾';
      }
      const startLbl = `${MONTH_ABBR[start.getMonth()]} ${start.getDate()}`;
      const endLbl = `${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`;
      return `${startLbl} – ${endLbl} ▾`;
    }
  }
}

/** Resolve the device IANA timezone (D-03b) — best-effort via Intl; falls back to UTC. */
function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function HomeScreen(): React.JSX.Element {
  const topBarProps = useTabTopBarProps();
  const navigation = useNavigation<{
    navigate: (route: string, params?: Record<string, unknown>) => void;
  }>();
  const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
  const jwt = useAppStore((s) => s.jwt);
  const user = useAppStore((s) => s.user);
  const homeRange = useAppStore((s) => s.homeRange);
  const homeRangeCustom = useAppStore((s) => s.homeRangeCustom);
  const setHomeRange = useAppStore((s) => s.setHomeRange);
  const setHomeRangeCustom = useAppStore((s) => s.setHomeRangeCustom);
  const currentSub = useMemo(() => decodeGoogleSubFromJwt(jwt), [jwt]);

  // Plan 06-12 follow-on — first name extracted from the coalesced
  // `useAppStore.user.name` (Google displayName → email-local-part fallback per
  // `lib/userDisplayName.ts`). We take the leading whitespace-delimited token,
  // which gives "Adnaan" from "Adnaan Mohammed" and "smoke-walk" from a bare
  // email-local-part. If the result is empty / null, HomeHero falls back to
  // "Hi there." (owner directive 2026-05-14, Finding 15 fallback option).
  const firstName = useMemo<string | null>(() => {
    const raw = (user?.name ?? '').trim();
    if (raw.length === 0) return null;
    const head = raw.split(/\s+/)[0]?.trim() ?? '';
    return head.length > 0 ? head : null;
  }, [user?.name]);

  const [pendingRows, setPendingRows] = useState<UploadQueueRow[]>([]);
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  // HOME-01..04 — lifetime + aggregate snapshots.
  const [lifetime, setLifetime] = useState<LifetimeSlim>(LIFETIME_ZERO);
  const [aggregate, setAggregate] = useState<AggregateSlim>(AGGREGATE_ZERO);

  // HOME-09 pull-to-refresh state.
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // HOME-10 offline signal — Plan 06-12 follow-on (Finding 6, owner directive
  // 2026-05-14) wires this to the native NetworkMonitor's connectivity event.
  // The OfflineBanner now flips on airplane-mode toggle. Initial value seeded
  // from `getConnectivitySafe()` to avoid a one-paint flicker before the
  // subscription's first replay.
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

  // FilterSheet visibility.
  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  const mine = useCallback(
    (all: UploadQueueRow[]) => all.filter((r) => r.ownerUserId === currentSub),
    [currentSub],
  );

  // ---------------------------------------------------------------------
  // Pending Uploads subscriptions — PRESERVED VERBATIM from HomeSkeletonScreen.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    HumynUpload.getQueueSafe()
      .then((all) => {
        if (mounted) setPendingRows(mine(all));
      })
      .catch(() => undefined);
    const sub = onUploadQueueChanged((all) => {
      if (mounted) setPendingRows(mine(all));
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
  }, [mine]);

  // Drain post-recording contribution toast (Phase-5 Item 5).
  useEffect(() => {
    const pending = drainPendingUploadToast();
    if (pending != null) {
      showToast(pending.text, pending.durationMs);
    }
  }, []);

  // Wave-2 #6 — verified-event auto-poll while Home is focused.
  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        void reconcileOnce().catch(() => undefined);
      };
      const id = setInterval(tick, HOME_RECONCILE_POLL_MS);
      return () => {
        clearInterval(id);
      };
    }, []),
  );

  // ---------------------------------------------------------------------
  // HOME-01..04 / HOME-09 — lifetime + aggregate fetches.
  //
  // Lifetime is range-independent → refetch on focus only.
  // Aggregate depends on homeRange → refetch on focus AND on range change.
  // ---------------------------------------------------------------------
  const reloadLifetime = useCallback(async (): Promise<void> => {
    try {
      const lt = await fetchLifetime();
      setLifetime({
        durationMs: lt.durationMs,
        recordingCount: lt.recordingCount,
        taskCount: lt.taskCount,
        verifiedNonPracticeCount: lt.verifiedNonPracticeCount ?? 0,
      });
    } catch {
      // HOME-09 contract — silently retain previous numbers on error; the
      // pull-to-refresh handler emits the toast.
    }
  }, []);

  const reloadAggregate = useCallback(async (): Promise<void> => {
    try {
      const { start, end } =
        homeRange === 'custom'
          ? { start: homeRangeCustom?.start, end: homeRangeCustom?.end }
          : computeRange(homeRange);
      const tz = deviceTz();
      const args: Parameters<typeof fetchContributionsAggregate>[0] = { tz };
      if (start) args.start = start;
      if (end) args.end = end;
      const res = await fetchContributionsAggregate(args);
      const bucket = res.buckets[0];
      setAggregate(
        bucket != null
          ? {
              durationMs: bucket.durationMs,
              taskCount: bucket.taskCount,
              recordingCount: bucket.recordingCount,
            }
          : AGGREGATE_ZERO,
      );
    } catch {
      /* HOME-09 — retain previous numbers on error */
    }
  }, [homeRange, homeRangeCustom]);

  useFocusEffect(
    useCallback(() => {
      logEvent('home_view', {
        state: lifetime.recordingCount === 0 ? 'first-time' : 'returning',
      });
      void reloadLifetime();
      void reloadAggregate();
      // No cleanup needed — the fetches are fire-and-forget; state setters
      // are no-op'd via the mounted flag in the queue subscription's cleanup.
      return undefined;
      // Note: lifetime.recordingCount is intentionally not in the dep list —
      // it's only read for the analytics event payload; including it would
      // re-trigger fetches on every count change. The fetches themselves
      // are idempotent.
    }, [reloadLifetime, reloadAggregate]),
  );

  // Re-fetch aggregate when homeRange / homeRangeCustom changes (not when
  // the screen is focused — useFocusEffect above handles cold-mount).
  useEffect(() => {
    void reloadAggregate();
  }, [reloadAggregate]);

  const onPullRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await Promise.allSettled([reloadLifetime(), reloadAggregate()]);
    } finally {
      setRefreshing(false);
    }
  }, [reloadLifetime, reloadAggregate]);

  const openFilterSheet = useCallback(() => setFilterOpen(true), []);
  const closeFilterSheet = useCallback(() => setFilterOpen(false), []);
  const handleNamedChange = useCallback(
    (named: NamedRange) => {
      logEvent('home_tile_filter_changed', { tile: 'time', value: named });
      setHomeRange(named);
    },
    [setHomeRange],
  );
  const handleCustomChange = useCallback(
    (start: string, end: string) => {
      logEvent('home_tile_filter_changed', { tile: 'time', value: 'custom' });
      setHomeRangeCustom(start, end);
    },
    [setHomeRangeCustom],
  );

  const startRecording = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Tasks' });
  }, [navigation]);

  const rangeChip = tileLabel(homeRange, homeRangeCustom);
  const tileDurationText = formatDuration(Math.floor(aggregate.durationMs / 1000));
  // Plan 06-12 Finding 14 — the duration tile self-discloses its unit
  // ("0s" / "47m" / "1h 12m" from formatDuration); the task-count tile
  // used to render as a bare integer with no unit, leaving "0 what?"
  // ambiguous. Suffix it with a pluralized "task"/"tasks" so the unit
  // is visible inside the tile itself.
  const tileTaskCountText = aggregate.taskCount === 1 ? '1 task' : `${aggregate.taskCount} tasks`;

  return (
    <ScreenContainer accessibilityLabel="Home screen" padding={0}>
      <TopBar {...topBarProps} />
      {softUpgradeAvailable ? (
        <View
          accessibilityLabel="soft-upgrade-banner-slot"
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}
        >
          <SoftUpgradeBanner />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl }}
        accessibilityLabel="home-body"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <HomeHero
          variant={lifetime.recordingCount === 0 ? 'empty' : 'returning'}
          lifetimeMs={lifetime.durationMs}
          taskCount={lifetime.taskCount}
          firstName={firstName}
          showGreeting={lifetime.verifiedNonPracticeCount > 0}
          onStartRecording={startRecording}
        />

        <Text
          variant="eyebrow"
          tone="secondary"
          accessibilityLabel="your-contribution-section-header"
          style={styles.sectionHeader}
        >
          YOUR CONTRIBUTION
        </Text>
        <View style={styles.tilePair}>
          <ContributionTile
            kind="duration"
            valueText={tileDurationText}
            rangeLabel={rangeChip}
            onTapChip={openFilterSheet}
          />
          <ContributionTile
            kind="taskCount"
            valueText={tileTaskCountText}
            rangeLabel={rangeChip}
            onTapChip={openFilterSheet}
          />
        </View>
        {lifetime.recordingCount === 0 ? (
          <Text
            variant="caption"
            tone="secondary"
            accessibilityLabel="home-empty-tip"
            style={styles.emptyTip}
          >
            Your hours and tasks will track here as you record.
          </Text>
        ) : null}

        {pendingRows.length > 0 ? (
          <>
            <Text
              variant="eyebrow"
              tone="secondary"
              accessibilityLabel="pending-uploads-section-header"
              style={styles.sectionHeader}
            >
              PENDING UPLOADS
            </Text>
            {offline ? <OfflineBanner /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="pending-uploads-tile"
              onPress={() => {
                // Multi-purpose tap (owner directive 2026-05-16):
                //   1) Revive any DEAD_LETTER rows via the SAFE primitive —
                //      `drainNow()` skips dead-letter rows
                //      (UploadCoordinator.kt:206-213), so a tap without this
                //      is a no-op for the rows that need help.
                //      `reviveDeadLetterSafe` is the safe primitive (NOT
                //      `reupload`, which has a FULL-RESET footgun — see
                //      `.planning/debug/resolved/uploads-stuck-multi-segment.md`).
                //   2) Kick the drain.
                //   3) Navigate to the History tab, which now merges in-flight
                //      device-queue rows alongside server rows and renders
                //      progress bars on actively-uploading entries.
                void (async () => {
                  for (const r of pendingRows) {
                    if (r.state === 'dead-letter') {
                      await HumynUpload.reviveDeadLetterSafe(r.recordingId);
                    }
                  }
                  await HumynUpload.drainNowSafe().catch(() => undefined);
                })();
                navigation.navigate('MainTabs', { screen: 'History' });
              }}
              style={styles.card}
            >
              {pendingRows.slice(0, 3).map((row) => {
                const isActive = row.state === 'uploading';
                const pct = isActive ? progressById[row.recordingId] : undefined;
                return (
                  <View
                    key={row.recordingId}
                    accessibilityLabel="pending-uploads-tile-row"
                    style={styles.cardRowWrap}
                  >
                    <View style={styles.cardRow}>
                      <View accessibilityLabel="pending-uploads-tile-thumb" style={styles.thumb}>
                        <Text style={styles.thumbGlyph}>▶</Text>
                      </View>
                      <View style={styles.cardRowBody}>
                        <Text numberOfLines={1} style={styles.cardRowName}>
                          {fileName(row.mp4Path)}
                        </Text>
                        <Text style={styles.cardRowMeta}>{rowMeta(row)}</Text>
                      </View>
                      <UploadStatusChip
                        variant={chipVariantFor(row)}
                        {...(pct != null ? { percent: pct } : {})}
                      />
                    </View>
                    {isActive && pct != null ? (
                      <View
                        accessibilityLabel="pending-uploads-tile-progress-track"
                        style={styles.progressTrack}
                      >
                        <View
                          accessibilityLabel="pending-uploads-tile-progress-fill"
                          style={[
                            styles.progressFill,
                            { width: `${Math.max(0, Math.min(100, Math.round(pct)))}%` },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {pendingRows.length > 3 ? (
                <Text variant="caption" tone="secondary" style={styles.viewAll}>
                  +{pendingRows.length - 3} more — tap to view all
                </Text>
              ) : null}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <FilterSheet
        visible={filterOpen}
        value={homeRange}
        valueCustom={homeRangeCustom}
        onDismiss={closeFilterSheet}
        onChange={handleNamedChange}
        onCustomChange={handleCustomChange}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: spacing.h,
    marginBottom: spacing.m,
  },
  tilePair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyTip: {
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.tile,
    padding: spacing.mdl,
    gap: spacing.md,
  },
  cardRowWrap: {
    gap: spacing.s,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.chipProgressText,
    borderRadius: 999,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: radii.input,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlyph: {
    color: colors.text3,
    fontSize: 14,
  },
  cardRowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardRowName: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  cardRowMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.mono,
    color: colors.text2,
  },
  viewAll: {
    marginTop: spacing.xs,
  },
});
