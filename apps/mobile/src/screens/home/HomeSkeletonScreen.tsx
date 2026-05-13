// HomeSkeletonScreen — Phase 2 Home shell (plan 02-16), extended in Plan 05-08
// with the real-data "Pending uploads" section.
//
// What ships here:
//   - TopBar (Humyn Labs wordmark + avatar → Profile)
//   - SoftUpgradeBanner mount point (plan 02-20)
//   - Skeleton body copy explaining the Phase-6 deferral
//   - Plan 05-08 (UP-12 / D-10): a "Pending uploads" section rendering the
//     REAL pending rows (filename / duration / status) from
//     HumynUpload.getQueueSafe() + the onUploadQueueChanged subscription.
//     Tapping the card navigates to the History tab — the natural home for
//     the upload/contribution timeline (Wave-1.5 Item 6). The standalone
//     `PendingUploads` route stays registered (RootNativeStack.tsx:95) for
//     deep-link use, but the Home-tile entry no longer routes there (it
//     strands the user — no back nav, no tab bar).
//     // Phase 6 (success criterion #3): the count>0 visibility logic +
//     // pull-to-refresh + the offline banner. Phase 5 renders the real rows
//     // + the tap-through to History.
//
// What does NOT ship here (Phase 6 — HOME-01..06/09/10):
//   - First-time vs returning hero (greeting / lifetime number)
//   - Recording duration / Tasks recorded tiles
//   - Time-range filters (today/yesterday/week/month/all/custom)
//   - Pull-to-refresh
//   - Offline banner inside the Pending Uploads card
//
// HOME-07 / HOME-08 satisfaction is structural (see MainTabs.tsx +
// RootNativeStack.tsx); this screen plays its part by routing the avatar
// tap to the RootNativeStack-level Profile route.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { SoftUpgradeBanner } from '../../components/SoftUpgradeBanner';
import { UploadStatusChip, type UploadStatusChipVariant } from '../../components/UploadStatusChip';
import { useAppStore } from '../../state/appStore';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { colors, radii, spacing, typography } from '../../ui/tokens';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { formatDuration } from '../../services/durationFormatter';
import {
  HumynUpload,
  onUploadProgress,
  onUploadQueueChanged,
  type UploadProgressEvent,
  type UploadQueueRow,
} from '../../native/HumynUpload';
import { drainPendingUploadToast } from '../../state/uploadToastBus';
import { showToast } from '../../components/Toast';
import { reconcileOnce } from '../../services/uploadReconcile';

// Wave-2 #6 — foreground poll cadence on Home for the verified-event outbox
// drain. The MVP delivery path is the `_events` envelope piggy-backed on
// authed JSON responses (services/api.ts interceptor) + the cold-start /
// AppState→active reconcile sweep (services/uploadReconcile.ts). Neither
// fires while the user lingers on Home post-recording on a fast dev-stack
// upload, so the Pending-Uploads row sits at `awaiting-verify` indefinitely
// from the user's perspective. A 30-s focused poll closes that gap.
const HOME_RECONCILE_POLL_MS = 30_000;

// (Phase 3 smoke seam removed in Phase 4 — the real RecordingScreen now wires
//  the HumynCapture start path; trail: deferred-items.md D4-01 + commit 15d8a16.)

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

export default function HomeSkeletonScreen() {
  const topBarProps = useTabTopBarProps();
  const navigation = useNavigation<{
    navigate: (route: string, params?: Record<string, unknown>) => void;
  }>();
  const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
  const jwt = useAppStore((s) => s.jwt);
  const currentSub = useMemo(() => decodeGoogleSubFromJwt(jwt), [jwt]);

  const [pendingRows, setPendingRows] = useState<UploadQueueRow[]>([]);
  // Wave-1.5 Item 4 — per-row upload progress, populated by the native
  // onUploadProgress event (UploadCoordinator.kt maybeEmitProgress; debounced
  // to ≤ once/5s natively). Mirrors PendingUploadsScreen's pattern.
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  const mine = useCallback(
    (all: UploadQueueRow[]) => all.filter((r) => r.ownerUserId === currentSub),
    [currentSub],
  );

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

  // Wave-1.5 Item 5 — drain the post-recording contribution toast on Home
  // mount, mirroring `bootRecoveryListener.ts`'s deliver-on-Home pattern.
  // RecordingScreen sets the message via `setPendingUploadToast(...)` BEFORE
  // `navigateToHome(navigation)`; this effect fires the global ToastHost
  // (App.tsx:78 sibling of NavigationContainer) so the toast survives the
  // screen transition for the full configured duration (5 s).
  useEffect(() => {
    const pending = drainPendingUploadToast();
    if (pending != null) {
      showToast(pending.text, pending.durationMs);
    }
  }, []);

  // Wave-2 #6 — verified-event auto-poll while Home is focused. The
  // `_events`-envelope onSend hook only drains when the app issues an
  // authed request; a user lingering on Home post-record never triggers
  // one. `reconcileOnce()` calls /recordings/verified-ids → for any id
  // present in both the server's verified set AND the local queue,
  // `HumynUpload.clearVerified()` unlinks the triple + drops the row,
  // and the same response's `_events` envelope drains any other pending
  // verified / re-upload events through the api interceptor. Wrapped in a
  // `useFocusEffect` so the timer is set up on Home focus and torn down
  // on blur/unmount — no orphan polls when the user navigates elsewhere.
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

  return (
    <ScreenContainer accessibilityLabel="Home screen" padding={0}>
      <TopBar {...topBarProps} />
      {softUpgradeAvailable ? (
        <View
          accessibilityLabel="soft-upgrade-banner-slot"
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}
        >
          {/* Plan 02-20 — UPG-04 / D-UPG-05. The banner self-protects
              against null payloads / per-version dismissal; the outer
              softUpgradeAvailable guard short-circuits the layout entirely
              when versionService hasn't flagged a soft upgrade. */}
          <SoftUpgradeBanner />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl }}
        accessibilityLabel="home-skeleton-body"
      >
        <Text variant="bodyLg" tone="primary" style={{ marginBottom: spacing.md }}>
          Home
        </Text>
        <Text variant="body" tone="secondary">
          Home tiles arrive in Phase 6. For now this is the structural shell that locks in HOME-07
          (3 tabs) and HOME-08 (tab bar suppression).
        </Text>

        {/* Plan 05-08 (UP-12 / D-10) — the real-data "Pending uploads" section.
            // Phase 6 (success criterion #3): the count>0 visibility logic +
            // pull-to-refresh + the offline banner. Phase 5 renders the real
            // rows + the tap-through. */}
        <Text
          variant="eyebrow"
          tone="secondary"
          accessibilityLabel="pending-uploads-section-header"
          style={styles.sectionHeader}
        >
          PENDING UPLOADS
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="pending-uploads-tile"
          // Wave-1.5 Item 6 — route to the History tab (the natural home for
          // the upload/contribution timeline) via React Navigation's nested-
          // navigator API. The standalone `PendingUploads` route stays
          // registered in `RootNativeStack.tsx` for deep-link use only
          // (`humyn://pending-uploads` if/when added) — the Home tile no
          // longer routes there because it strands the user (no back nav,
          // no tab bar).
          //
          // Wave-2 #5 — also kick the drainer (no unpause; drainNowSafe
          // never throws) before navigating, so a stuck row on Home — a
          // post-transient that hasn't had an external trigger since (cold
          // start, JWT change, FGS heartbeat, UIDT JobService, RecordingScreen
          // resume) — gets a fresh drain attempt as the natural operator
          // gesture. The drainer's `drainLock.tryLock()` no-ops when one is
          // already running, and `isPaused()` / `hasNetwork()` short-circuits
          // are unchanged — so this never starves the navigation.
          onPress={() => {
            void HumynUpload.drainNowSafe().catch(() => undefined);
            navigation.navigate('MainTabs', { screen: 'History' });
          }}
          style={styles.card}
        >
          {pendingRows.length === 0 ? (
            <Text
              variant="caption"
              tone="secondary"
              accessibilityLabel="pending-uploads-tile-empty"
            >
              No uploads pending.
            </Text>
          ) : (
            pendingRows.slice(0, 3).map((row) => {
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
                    // Wave-1.5 Item 4 — sibling determinate progress bar. Token-aligned
                    // (`colors.line` track + `colors.chipProgressText` fill, no new design
                    // tokens — D-10/D-10a). Mirrors PendingUploadsScreen.
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
            })
          )}
          {pendingRows.length > 3 ? (
            <Text variant="caption" tone="secondary" style={styles.viewAll}>
              +{pendingRows.length - 3} more — tap to view all
            </Text>
          ) : null}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: spacing.h,
    marginBottom: spacing.m,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.tile,
    padding: spacing.mdl,
    gap: spacing.md,
  },
  // Wave-1.5 Item 4 — the per-row wrapper holds the chipRow + the sibling
  // progress bar below it (when the row is uploading + has a progress event).
  cardRowWrap: {
    gap: spacing.s,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Wave-1.5 Item 4 — token-aligned progress bar (no new design tokens):
  // `colors.line` track (the existing neutral row separator color) +
  // `colors.chipProgressText` fill (matches the chip-percent text color).
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
