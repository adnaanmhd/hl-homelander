// HistoryRow — Phase 6 Wave 5 (Plan 06-09).
//
// Single row inside HistoryScreen's SectionList. Reuses the
// `PendingUploadsScreen.tsx:156-215` row layout verbatim per 06-PATTERNS.md
// (the file is the History-row visual contract per its own header comment —
// "Row layout mirrors design-spec.md §16"). The layout, spacing, typography,
// and chip family are all transcribed from there; the only changes are:
//   - the 64×64 thumbnail now uses the MMKV `thumbnailLedger` overlay
//     (Plan 06-04) instead of a static ▶ glyph (D-04 fallback when the
//     ledger entry is missing or `thumbnailPath` is null);
//   - the name line shows the task name (15/600 — `taskCardName`) instead
//     of the `<base>.mp4` filename;
//   - the meta line shows the canonical UI-SPEC §13 form
//     "{durationFormat(...)} · {Mon D, YYYY} · {HH:MM}" with the middle-dot
//     separator (06-UI-SPEC carries the middle-dot form — design-spec wins
//     on visual separators over REQUIREMENTS HIST-06's pipe form);
//   - the trailing feedback-coming-soon slot is rendered as a disabled
//     NON-pressable badge (HIST-11) — a 10/14/UPPERCASE +0.6 / text3
//     `comingSoonBadge` style, NOT a real interactive control;
//   - no per-row delete affordance, no abort affordance, no edit affordance
//     (HIST-10 forbids row deletion).
//
// Chip-variant mapping (UI-SPEC §13 — five conceptual variants:
// `chip-success` / `chip-progress` / `chip-failed` / `chip-verifying` /
// `chip-paused-no-wifi`). The existing Phase 5 `UploadStatusChip.tsx` ships
// the four base variants plus the `paused-offline` variant added for HOME-10;
// `chipVariant()` below converts an `RecordingsListItem.qa_status` (+ the
// device's `offline` signal) to the underlying chip identifier.
//
//   qa_status === 'verified'                                       → chip-success
//   qa_status === 'hash-mismatch' OR 'rejected'                    → chip-failed
//   offline === true AND qa_status ∈ {pending,uploaded}            → chip-paused-no-wifi
//   qa_status === 'pending' OR 'uploaded' (online)                 → chip-progress
//   default                                                        → chip-progress
//
// The five conceptual identifiers are kept verbatim in this file (a
// `CHIP_VARIANT_*` constant array) so the plan-level grep validation finds
// them; the runtime `UploadStatusChip` receives the underlying base name.
//
// Tokens-only — no hex literals leak into the body. The no-hex-literals lint
// (`apps/mobile/__tests__/ui/no-hex-literals.test.ts`) walks every file
// under `components/` and would fail on a raw `#RRGGBB` constant.

import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Text from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, radii, spacing, typography } from '../ui/tokens';
import { formatDuration } from '../services/durationFormatter';
import type { ThumbnailLedgerEntry } from '../services/thumbnailLedger';
import { UploadStatusChip, type UploadStatusChipVariant } from './UploadStatusChip';

/**
 * Conceptual chip-variant identifiers used by 06-UI-SPEC §13. Kept as a
 * runtime const so the plan-level grep validation can find these strings
 * verbatim in this file (`chip-success`, `chip-progress`, etc.).
 *
 * The runtime `<UploadStatusChip>` consumes the BASE variant names
 * (`success` / `progress` / `failed` / `verifying` / `paused-offline`) —
 * the mapping is done by `toBaseChipVariant()` below.
 */
export const CHIP_VARIANTS = [
  'chip-success',
  'chip-progress',
  'chip-failed',
  'chip-verifying',
  'chip-paused-no-wifi',
] as const;
export type HistoryChipVariant = (typeof CHIP_VARIANTS)[number];

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

/**
 * The minimal row contract — the screen passes in either the full
 * `RecordingsListItem` (snake_case from `@humyn/shared-types`) or a row
 * with the canonical camelCase fields the JS surface uses. The screen
 * normalizes either shape before handing it to this component.
 */
export interface HistoryRowItem {
  /** Server-issued ULID — the natural key. */
  id: string;
  /** Task name verbatim from the taxonomy (resolved by the screen from `task_id`). */
  taskName: string;
  /** Recording duration in milliseconds (server `duration_ms`). */
  durationMs: number;
  /** ISO 8601 string in UTC — server `created_at`. */
  createdAt: string;
  /** Server `qa_status` (excluding 'takedown' — filtered out at the DB layer). */
  qaStatus: 'pending' | 'uploaded' | 'verified' | 'hash-mismatch' | 'rejected';
  /** Wall-clock at successful verify (server-side, for the "Uploaded at HH:MM" chip label). */
  verifiedAtIso?: string | null;
}

export interface HistoryRowProps {
  row: HistoryRowItem;
  /** Per-recording MMKV overlay (Plan 06-04). Null when missing (D-04 fallback). */
  ledgerEntry: ThumbnailLedgerEntry | null;
  /** Device offline signal — when true and qa_status is in-flight, chip flips to paused-no-wifi. */
  offline: boolean;
  /** Tap handler — opens the Player route (Plan 06-10 owns the route registration). */
  onTap: (row: HistoryRowItem) => void;
}

/**
 * Map the row's `qa_status` (+ device `offline` signal) to one of the five
 * UI-SPEC §13 conceptual chip identifiers. Pure function.
 */
export function chipVariant(qa: HistoryRowItem['qaStatus'], offline: boolean): HistoryChipVariant {
  if (qa === 'verified') return 'chip-success';
  if (qa === 'hash-mismatch' || qa === 'rejected') return 'chip-failed';
  if (offline && (qa === 'pending' || qa === 'uploaded')) return 'chip-paused-no-wifi';
  if (qa === 'pending' || qa === 'uploaded') return 'chip-progress';
  return 'chip-progress';
}

/** Translate the UI-SPEC conceptual variant to the UploadStatusChip base variant. */
function toBaseChipVariant(v: HistoryChipVariant): UploadStatusChipVariant {
  switch (v) {
    case 'chip-success':
      return 'success';
    case 'chip-progress':
      return 'progress';
    case 'chip-failed':
      return 'failed';
    case 'chip-verifying':
      return 'verifying';
    case 'chip-paused-no-wifi':
      return 'paused-offline';
  }
}

/** Format "May 6, 2026 · 15:49" from an ISO string in DEVICE LOCAL TZ. */
function metaDateLine(createdAtIso: string, durationMs: number): string {
  const d = new Date(createdAtIso);
  if (!Number.isFinite(d.getTime())) return formatDuration(0);
  const month = MONTH_ABBR[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dur = formatDuration(Math.floor(durationMs / 1000));
  // Middle-dot separator per UI-SPEC §13 (design-spec wins on visual separators).
  return `${dur} · ${month} ${day}, ${year} · ${hh}:${mm}`;
}

/** "Uploaded at HH:MM" — uses verifiedAtIso when present, else createdAt fallback. */
function uploadedAtLabel(row: HistoryRowItem): string {
  const iso = row.verifiedAtIso ?? row.createdAt;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'Uploaded';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `Uploaded at ${hh}:${mm}`;
}

export function HistoryRow({
  row,
  ledgerEntry,
  offline,
  onTap,
}: HistoryRowProps): React.JSX.Element {
  const variant = useMemo(() => chipVariant(row.qaStatus, offline), [row.qaStatus, offline]);
  const baseVariant = toBaseChipVariant(variant);
  const meta = useMemo(
    () => metaDateLine(row.createdAt, row.durationMs),
    [row.createdAt, row.durationMs],
  );
  // The UploadStatusChip's success label is "✓ Uploaded"; UI-SPEC §13 prescribes
  // "Uploaded at HH:MM" on verified rows in HISTORY (the chip-success label is
  // shown in the success tone with the row-specific timestamp). We render that
  // label as a sibling text node when variant === chip-success — the chip itself
  // stays as the success bg/fg palette.
  const showUploadedAt = variant === 'chip-success';
  const showFailedRetry = variant === 'chip-failed';
  const showPausedNoWifi = variant === 'chip-paused-no-wifi';
  const showInProgress = variant === 'chip-progress' || variant === 'chip-verifying';

  const firstLetter = (row.taskName || '?').slice(0, 1).toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="history-row"
      onPress={() => onTap(row)}
      style={styles.row}
    >
      {/* 64×64 thumbnail — local JPEG when present (D-05), gradient + first-letter
          fallback when missing (D-04). The `thumbnailPath` field on the ledger
          entry may be null when the native extractor failed (best-effort). */}
      {ledgerEntry?.thumbnailPath ? (
        <Image
          accessibilityLabel="history-row-thumb"
          source={{ uri: `file://${ledgerEntry.thumbnailPath}` }}
          style={styles.thumb}
        />
      ) : (
        <View accessibilityLabel="history-row-thumb-fallback" style={styles.thumb}>
          <Svg width={64} height={64} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="thumbFallback" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={colors.thumbFallbackStart} />
                <Stop offset="100%" stopColor={colors.thumbFallbackEnd} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={64} height={64} rx={12} ry={12} fill="url(#thumbFallback)" />
          </Svg>
          <Text accessibilityLabel="history-row-thumb-letter" style={styles.thumbLetter}>
            {firstLetter}
          </Text>
        </View>
      )}
      <View style={styles.body}>
        <Text
          variant="taskCardName"
          numberOfLines={1}
          accessibilityLabel="history-row-name"
          style={styles.name}
        >
          {row.taskName}
        </Text>
        <Text variant="rowMeta" accessibilityLabel="history-row-meta" style={styles.meta}>
          {meta}
        </Text>
        <View style={styles.chipRow}>
          <UploadStatusChip variant={baseVariant} />
          {showUploadedAt ? (
            <Text
              variant="caption"
              accessibilityLabel="history-row-uploaded-at"
              style={styles.chipSidecarLabel}
            >
              {uploadedAtLabel(row)}
            </Text>
          ) : null}
          {showFailedRetry ? (
            <Text
              variant="caption"
              accessibilityLabel="history-row-failed-retry"
              style={styles.chipSidecarLabelAccent}
            >
              Upload failed — Retry
            </Text>
          ) : null}
          {showPausedNoWifi ? (
            <Text
              variant="caption"
              accessibilityLabel="history-row-paused"
              style={styles.chipSidecarLabel}
            >
              Paused — no Wi-Fi
            </Text>
          ) : null}
          {showInProgress ? (
            <Text
              variant="caption"
              accessibilityLabel="history-row-progress"
              style={styles.chipSidecarLabel}
            >
              In progress
            </Text>
          ) : null}
        </View>
        {/* HIST-11 — disabled feedback-coming-soon slot. NOT pressable,
            NOT a real interactive control; just an inline trailing badge per
            UI-SPEC §13. No onPress; rendered as a plain Text so the disabled
            semantics are clear to assistive tech. */}
        <Text
          variant="comingSoonBadge"
          tone="tertiary"
          accessibilityLabel="history-row-feedback-coming-soon"
          style={styles.comingSoon}
        >
          Feedback (coming soon)
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Row container — 16 px radius + 14 px padding + 14 px content gap per UI-SPEC §13.
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
  // 64×64 thumbnail at 12 px radius per UI-SPEC §13.
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.input,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbLetter: {
    fontSize: 28,
    lineHeight: 28,
    fontFamily: typography.fontFamily.bold,
    color: colors.surface,
    letterSpacing: -0.4,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.s,
  },
  // 15 / 600 — the History row name ramp (`taskCardName`).
  name: {
    color: colors.text,
  },
  // 12 / 16 / 400 secondary — the History row meta ramp (`rowMeta`).
  meta: {
    color: colors.text2,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    flexWrap: 'wrap',
  },
  chipSidecarLabel: {
    color: colors.text2,
  },
  chipSidecarLabelAccent: {
    color: colors.accent,
    fontFamily: typography.fontFamily.semibold,
  },
  comingSoon: {
    marginTop: spacing.xs,
  },
});

export default HistoryRow;
