// UploadStatusChip — the per-row status pill for the Pending Uploads queue
// (UP-12, design-spec §16 / §21.7). Reuses the History row chip family
// (`chip-progress` / `chip-failed` / `chip-success` from `design-spec.md §16`,
// tokens in `src/ui/tokens.ts` lines 28-34) and adds ONE new variant —
// `paused-offline` ("Paused — no Wi-Fi") — in the IDENTICAL chip style
// (same radius `radii.chip`, same 12-px / 600 type ramp, same horizontal/vertical
// padding). The new variant uses the EXISTING neutral palette — `colors.line`
// surface + `colors.text2` text — so no new colour token or animation curve is
// introduced (D-10 / D-10a). §21.7's "Pending uploads" TBD is resolved by this
// mapping (the design-spec note documents it).
//
//   variant            label                    surface / text token pair
//   ------------------ ------------------------ ----------------------------------
//   progress           "Uploading…"             chipProgressBg / chipProgressText
//   failed             "Upload failed"          chipFailedBg   / chipFailedText
//   success            "✓ Uploaded"             chipSuccessBg  / chipSuccessText
//                       — transient: the row is dropped the moment the upload
//                         finalizes (Enh 3 / D1 — no verify step), so this only
//                         flashes
//   (Enh 3 / D1, 2026-06-04: the `verifying` variant was removed — there is no
//    verify queue anymore; /finalize 200 is terminal success.)
//   paused-offline     "Paused — no Wi-Fi"      line           / text2 (NEW — the
//                       only new visual element; no new tokens/curves)
//
// No animation. No press affordance (the Retry button on a `failed` row is a
// SEPARATE sibling in PendingUploadsScreen — UP-11: nothing here is interactive).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/primitives/Text';
import { colors, radii, spacing, typography } from '../ui/tokens';

export type UploadStatusChipVariant = 'progress' | 'failed' | 'success' | 'paused-offline';

// 07-11 G-09 closure — variant labels are now i18n keys under `uploadChip.*`.
// The variant identifiers themselves stay as the existing canonical strings
// (`progress` / `failed` / `success` / `paused-offline`); only
// the user-facing display text is translated.
const LABEL_KEYS: Record<UploadStatusChipVariant, string> = {
  progress: 'uploadChip.uploading',
  failed: 'uploadChip.failed',
  success: 'uploadChip.success',
  'paused-offline': 'uploadChip.pausedOffline',
};

const TOKENS: Record<UploadStatusChipVariant, { bg: string; fg: string }> = {
  progress: { bg: colors.chipProgressBg, fg: colors.chipProgressText },
  failed: { bg: colors.chipFailedBg, fg: colors.chipFailedText },
  success: { bg: colors.chipSuccessBg, fg: colors.chipSuccessText },
  // The ONE new variant — the existing neutral pair, identical chip geometry.
  'paused-offline': { bg: colors.line, fg: colors.text2 },
};

export interface UploadStatusChipProps {
  variant: UploadStatusChipVariant;
  /** Optional "47%" suffix appended to the `progress` label for the active row. */
  percent?: number;
}

export function UploadStatusChip({ variant, percent }: UploadStatusChipProps) {
  const { t } = useTranslation();
  const { bg, fg } = TOKENS[variant];
  const baseLabel = t(LABEL_KEYS[variant]);
  const label =
    variant === 'progress' && typeof percent === 'number' && Number.isFinite(percent)
      ? `${baseLabel} ${Math.max(0, Math.min(100, Math.round(percent)))}%`
      : baseLabel;
  return (
    <View
      accessibilityLabel={`upload-status-chip-${variant}`}
      style={[styles.chip, { backgroundColor: bg }]}
    >
      <Text style={[styles.label, { color: fg }]} accessibilityLabel="upload-status-chip-label">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radii.chip,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  // 12px / 600 — the History chip type ramp (design-spec §16). No new token.
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.semibold,
  },
});

export default UploadStatusChip;
