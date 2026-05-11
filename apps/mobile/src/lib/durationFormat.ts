// durationFormat — REC-04 / HOME-06 contribution-duration formatter.
//
// `formatContributionDuration(ms)` formats an active-recording / lifetime
// duration in MILLISECONDS per the HOME-06 wording (the same rule the Profile
// "lifetime contribution" caption uses):
//
//   < 1 min  → 'Xs'         (e.g. 45_000 → '45s')
//   < 1 hr   → 'Xm'         (e.g. 90_000 → '1m'  — floored to the previous minute)
//   ≥ 1 hr   → 'Xh Ym'      (e.g. 3_930_000 → '1h 5m' — floored to the previous minute)
//
// Same rule as HOME-06; delegates to `services/durationFormatter.formatDuration`
// (which takes SECONDS) so the formatting is byte-identical to every other
// "duration" surface in the app. RecordingScreen (plan 04-09) uses this to
// build the §7h post-stop toast ("{Hh Mm} added to your contribution.").

import { formatDuration } from '../services/durationFormatter';

/**
 * Formats a non-negative duration (in milliseconds) per REC-04 / HOME-06.
 * Floors to the previous second, then to the previous minute for the m/h
 * buckets. Non-finite or negative input → '0s' (defensive — `formatDuration`
 * already guards this).
 *
 * @param ms - Duration in milliseconds.
 * @returns Formatted string: 'Xs' / 'Xm' / 'Xh Ym'.
 */
export function formatContributionDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return formatDuration(0);
  return formatDuration(Math.floor(ms / 1000));
}
