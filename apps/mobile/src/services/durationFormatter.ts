// HOME-06 / PROF-03 — duration formatter.
//
//   < 1 min  → Xs       (e.g. 43s)
//   < 1 hr   → Xm       (e.g. 30m)
//   ≥ 1 hr   → Xh Ym    (floor to previous minute; e.g. 2h 4m 59s → "2h 4m")
//
// Consumed by Profile (PROF-03 lifetime numeric) and Phase 6 Home tiles
// (HOME-06). The same helper backs every "duration" surface in the app so the
// formatting is byte-identical across screens.
//
// Edge cases:
//   - Non-finite or negative input → "0s" (defensive — avoids NaN bleed-through
//     when a /contributions response is missing a field).
//   - Fractional input is floored to the previous second per HOME-06.
//   - The hours/minutes split at ≥ 1 hr always shows minutes (including 0m) so
//     the "Xh Ym" cadence is preserved even at exact-hour boundaries (1h 0m).

/**
 * Formats a non-negative duration (in seconds) per HOME-06 / PROF-03.
 *
 * @param totalSeconds - Duration in seconds; non-finite or negative → "0s".
 * @returns Formatted string: "Xs" / "Xm" / "Xh Ym".
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0s';
  const total = Math.floor(totalSeconds);
  if (total < 60) return `${total}s`;
  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    return `${minutes}m`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total - hours * 3600) / 60);
  return `${hours}h ${minutes}m`;
}
