// HomeSkeletonScreen — Phase 2 Home shell (plan 02-16), extended in Plan 05-08
// with the real-data "Pending uploads" section.
//
// What ships here:
//   - TopBar (Humyn Labs wordmark + avatar → Profile)
//   - SoftUpgradeBanner mount point (plan 02-20)
//   - Skeleton body copy explaining the Phase-6 deferral
//   - Plan 05-08 (UP-12 / D-10): a "Pending uploads" section rendering the
//     REAL pending rows (filename / duration / status) from
//     HumynUpload.getQueueSafe() + the onUploadQueueChanged subscription;
//     tapping the card navigates to PendingUploadsScreen ('PendingUploads').
//     // Phase 6 (success criterion #3): the count>0 visibility logic +
//     // pull-to-refresh + the offline banner. Phase 5 just renders the real
//     // rows + the tap-through (D-10).
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
import { useNavigation } from '@react-navigation/native';
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
import { HumynUpload, onUploadQueueChanged, type UploadQueueRow } from '../../native/HumynUpload';

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
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
  const jwt = useAppStore((s) => s.jwt);
  const currentSub = useMemo(() => decodeGoogleSubFromJwt(jwt), [jwt]);

  const [pendingRows, setPendingRows] = useState<UploadQueueRow[]>([]);

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
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [mine]);

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
          onPress={() => navigation.navigate('PendingUploads')}
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
            pendingRows.slice(0, 3).map((row) => (
              <View
                key={row.recordingId}
                accessibilityLabel="pending-uploads-tile-row"
                style={styles.cardRow}
              >
                <View accessibilityLabel="pending-uploads-tile-thumb" style={styles.thumb}>
                  <Text style={styles.thumbGlyph}>▶</Text>
                </View>
                <View style={styles.cardRowBody}>
                  <Text numberOfLines={1} style={styles.cardRowName}>
                    {fileName(row.mp4Path)}
                  </Text>
                  <Text style={styles.cardRowMeta}>{rowMeta(row)}</Text>
                </View>
                <UploadStatusChip variant={chipVariantFor(row)} />
              </View>
            ))
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
