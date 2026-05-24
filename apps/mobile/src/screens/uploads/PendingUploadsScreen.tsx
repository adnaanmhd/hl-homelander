// PendingUploadsScreen — the upload-queue surface (UP-11 / UP-12 / UP-13).
//
// Reached from the Home "Pending uploads" tile (D-10). Renders the current
// signed-in user's upload queue as per-file rows reusing the History row
// layout (`design-spec.md §16`): a 64×64 thumbnail + name (15 / 600) + a meta
// line (recording duration via `services/durationFormatter.ts`, 12px secondary,
// mono — falls back to a neutral label when the native row doesn't yet carry a
// duration; surfacing `durationSeconds` from the bundle's metadata.json is a
// Phase-6 follow-on, tracked in the SUMMARY's Known Stubs) + a status chip
// (`<UploadStatusChip>`) mapped from `row.state`:
//
//   uploading / finalizing  → progress    ("Uploading…" / "Uploading… 47%")
//   awaiting-verify         → verifying   ("Uploaded — verifying…")  ← distinct
//                              label so the user isn't told it's still
//                              transferring while it's in the verify queue
//   dead-letter             → failed      ("Upload failed") + a "Retry" Pressable
//                              → HumynUpload.reupload(recordingId)
//   pending / verified      → progress / success (success is transient — the
//                              row is dropped the moment the bundle is verified,
//                              D-10 discretion — so `success` only flashes)
//   (coordinator offline)   → paused-offline ("Paused — no Wi-Fi") — the one new
//                              chip variant; the LIVE offline signal is a Phase-6
//                              item (deferred alongside the Home tile's offline
//                              banner — success criterion #3), so at MVP this is
//                              only surfaced via the `__test_offlineOverride`
//                              hatch / a future parent-fed flag.
//
// No abort/stop affordance anywhere — uploads are not user-abortable (UP-11).
// The only interactive element is the per-row "Retry" on a dead-letter row.
//
// Data: `HumynUpload.getQueueSafe()` once on mount + an `onUploadQueueChanged`
// subscription + an `onUploadProgress` subscription — all `.remove()`'d on
// unmount (the bridge's "caller MUST .remove()" contract). Rows are filtered to
// `ownerUserId === currentSub` (UP-13 owner-pin / T-5-08-03 — never show another
// user's rows on a shared phone). `currentSub` is decoded from the in-memory JWT
// (`decodeGoogleSubFromJwt` — never used for an authz decision, only a local
// filter).
//
// Screen-shell convention mirrors `HistoryPlaceholderScreen.tsx`:
// `<ScreenContainer><TopBar {...useTabTopBarProps()} /> ...`.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { colors, radii, spacing, typography } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { formatDuration } from '../../services/durationFormatter';
import {
  HumynUpload,
  onUploadProgress,
  onUploadQueueChanged,
  type UploadProgressEvent,
  type UploadQueueRow,
} from '../../native/HumynUpload';
import { UploadStatusChip, type UploadStatusChipVariant } from '../../components/UploadStatusChip';

/** Pull the `{base}.mp4` filename from an absolute path (POSIX or platform-agnostic). */
function fileName(p: string): string {
  if (!p) return 'recording.mp4';
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

/** The recording row may carry `durationSeconds` on a future native build; render it when present. */
function metaLine(row: UploadQueueRow): string {
  const d = row.durationSeconds;
  if (typeof d === 'number' && Number.isFinite(d) && d > 0) return formatDuration(d);
  return 'Recording';
}

/** Map a queue-row `state` (plus the coordinator offline flag) to a chip variant. */
function chipVariantFor(row: UploadQueueRow, offline: boolean): UploadStatusChipVariant {
  if (
    offline &&
    (row.state === 'pending' || row.state === 'uploading' || row.state === 'finalizing')
  )
    return 'paused-offline';
  switch (row.state) {
    case 'uploading':
    case 'finalizing':
    case 'pending':
      return 'progress';
    case 'awaiting-verify':
      return 'verifying';
    case 'dead-letter':
    case 'needs-attention':
      // Debug session `.planning/debug/upload-queue-hol-finalizing.md`
      // (Fix C item 4) — both terminal-blocking states render the same
      // chip-failed visual; the retry handler dispatches different native
      // methods (reupload vs retryNeedsAttention) per `onRetry`.
      return 'failed';
    case 'verified':
      return 'success';
    default:
      return 'progress';
  }
}

export interface PendingUploadsScreenProps {
  /** Test/Phase-6 hatch — forces the "Paused — no Wi-Fi" chip on in-flight rows. */
  __test_offlineOverride?: boolean;
  /** Test hatch — seed the row list synchronously (skips the getQueueSafe await). */
  __test_rows?: UploadQueueRow[];
}

export default function PendingUploadsScreen({
  __test_offlineOverride,
  __test_rows,
}: PendingUploadsScreenProps = {}) {
  const topBarProps = useTabTopBarProps();
  const jwt = useAppStore((s) => s.jwt);
  const currentSub = useMemo(() => decodeGoogleSubFromJwt(jwt), [jwt]);
  const offline = __test_offlineOverride === true;
  const { t } = useTranslation();

  // Quick task 260517-p5g CAPTURE-QA-05 — defensive filter: skip any row
  // whose `cancelReason` is set. This should never happen at runtime
  // (UploadQueueStore.enqueue refuses canceled rows + RecordingScreen
  // is the primary gate that never calls HumynUpload.enqueue for them),
  // but a future native-side regression that ever lets one through is
  // belt-and-braces caught here so Pending Uploads NEVER renders a
  // canceled segment as in-flight.
  const mine = useCallback(
    (all: UploadQueueRow[]) =>
      all.filter((r) => r.ownerUserId === currentSub && r.cancelReason == null),
    [currentSub],
  );

  const [rows, setRows] = useState<UploadQueueRow[]>(() =>
    __test_rows
      ? __test_rows.filter((r) => r.ownerUserId === currentSub && r.cancelReason == null)
      : [],
  );
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    // The test/Phase-6 hatch seeds rows synchronously; don't let the initial
    // getQueueSafe() clobber them.
    if (__test_rows == null) {
      HumynUpload.getQueueSafe()
        .then((all) => {
          if (mounted) setRows(mine(all));
        })
        .catch(() => undefined);
    }
    const s1 = onUploadQueueChanged((all) => {
      if (mounted) setRows(mine(all));
    });
    const s2 = onUploadProgress((e: UploadProgressEvent) => {
      if (!mounted) return;
      const pct = e.bytesTotal > 0 ? (e.bytesUploaded / e.bytesTotal) * 100 : 0;
      setProgressById((prev) => ({ ...prev, [e.recordingId]: pct }));
    });
    return () => {
      mounted = false;
      s1.remove();
      s2.remove();
    };
  }, [mine, __test_rows]);

  const onRetry = useCallback((recordingId: string, deviceState: UploadQueueRow['state']) => {
    // Dispatch by current device state:
    //   - 'needs-attention' (debug session
    //     `.planning/debug/upload-queue-hol-finalizing.md` Fix C item 4):
    //     reset attemptCount + transition to UPLOADING/PENDING via
    //     HumynUpload.retryNeedsAttention. The coordinator's automatic
    //     drain loop picks the row up again.
    //   - 'dead-letter' OR anything else: UP-16 — flip the row's re-upload
    //     state natively; the coordinator re-PUTs from the still-present
    //     local copy via POST /recordings/:id/reupload.
    if (deviceState === 'needs-attention') {
      void HumynUpload.retryNeedsAttentionSafe(recordingId);
      return;
    }
    HumynUpload.reupload(recordingId).catch(() => undefined);
  }, []);

  const renderRow = useCallback(
    (item: UploadQueueRow) => {
      const variant = chipVariantFor(item, offline);
      const isActive = item.state === 'uploading';
      const pct = isActive ? progressById[item.recordingId] : undefined;
      return (
        <View key={item.recordingId} accessibilityLabel="pending-upload-row" style={styles.row}>
          {/* 64×64 thumbnail — the bundle's first frame isn't materialised on
              device, so we use the prototype's gradient-style placeholder block
              (a flat neutral surface keyed by the file glyph). */}
          <View accessibilityLabel="pending-upload-thumb" style={styles.thumb}>
            <Text style={styles.thumbGlyph}>▶</Text>
          </View>
          <View style={styles.body}>
            <Text numberOfLines={1} style={styles.name} accessibilityLabel="pending-upload-name">
              {fileName(item.mp4Path)}
            </Text>
            <Text style={styles.meta} accessibilityLabel="pending-upload-meta">
              {metaLine(item)}
            </Text>
            <View style={styles.chipRow}>
              <UploadStatusChip variant={variant} {...(pct != null ? { percent: pct } : {})} />
              {variant === 'failed' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="pending-upload-retry"
                  onPress={() => onRetry(item.recordingId, item.state)}
                  style={styles.retry}
                >
                  <Text style={styles.retryLabel}>{t('pendingUploads.retry')}</Text>
                </Pressable>
              ) : null}
            </View>
            {isActive && pct != null ? (
              // Wave-1.5 Item 4 — sibling determinate progress bar. Token-aligned
              // (`colors.line` track + `colors.chipProgressText` fill — no new
              // design tokens, D-10/D-10a). Only renders for an `uploading`
              // row with a recorded progress event (the native 5s-debounced
              // onUploadProgress; UploadCoordinator.kt maybeEmitProgress).
              <View accessibilityLabel="pending-upload-progress-track" style={styles.progressTrack}>
                <View
                  accessibilityLabel="pending-upload-progress-fill"
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(0, Math.min(100, Math.round(pct)))}%` },
                  ]}
                />
              </View>
            ) : null}
            {item.deadLetterReason ? (
              <Text style={styles.deadReason} accessibilityLabel="pending-upload-deadletter-reason">
                {item.deadLetterReason}
              </Text>
            ) : item.state === 'needs-attention' && item.lastFailureReason ? (
              // Debug session `.planning/debug/upload-queue-hol-finalizing.md`
              // (Fix C item 4) — surface the failure reason on NEEDS_ATTENTION
              // rows, mirroring the dead-letter reason copy. Reuses the same
              // muted styling so layout stays identical between the two.
              <Text
                style={styles.deadReason}
                accessibilityLabel="pending-upload-needs-attention-reason"
              >
                {item.lastFailureReason}
              </Text>
            ) : null}
          </View>
        </View>
      );
    },
    [offline, onRetry, progressById],
  );

  return (
    <ScreenContainer accessibilityLabel="Pending uploads screen" padding={0}>
      <TopBar {...topBarProps} title={t('pendingUploads.title')} />
      {rows.length === 0 ? (
        <Text
          variant="body"
          tone="secondary"
          accessibilityLabel="pending-uploads-empty"
          style={styles.empty}
        >
          {t('pendingUploads.empty')}
        </Text>
      ) : (
        <ScrollView accessibilityLabel="pending-uploads-list" contentContainerStyle={styles.list}>
          {rows.map(renderRow)}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.l,
    paddingBottom: spacing.xxxl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.mdl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.tile,
    padding: spacing.mdl,
    marginBottom: spacing.mdl,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.input,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlyph: {
    color: colors.text3,
    fontSize: 20,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.s,
  },
  // 15px / 600 — the History row name ramp (design-spec §16).
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  // 12px secondary, mono — the History row meta ramp (design-spec §16 / §20).
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.mono,
    color: colors.text2,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  retry: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.line,
  },
  retryLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.semibold,
    color: colors.accent,
  },
  // Wave-1.5 Item 4 — sibling determinate progress bar. Tokens reused, no new
  // design tokens introduced (D-10/D-10a): `colors.line` is the track (the
  // existing neutral row-border color); `colors.chipProgressText` is the fill
  // (the same fill the chip-percent text uses, so the bar reads as the chip's
  // visual extension).
  progressTrack: {
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 999,
    marginTop: spacing.s,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.chipProgressText,
    borderRadius: 999,
  },
  deadReason: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.text3,
  },
});
