// durationFormat — REC-04 / HOME-06 contribution-duration formatter.
//
// Verifies the ms → 'Xs' / 'Xm' / 'Xh Ym' rule (floored to the previous
// minute for the m/h buckets) — the formatter RecordingScreen uses to build
// the §7h post-stop "{Hh Mm} added to your contribution." toast.

import { describe, it, expect } from 'vitest';
import { formatContributionDuration } from '../../src/lib/durationFormat';

describe('formatContributionDuration (REC-04 / HOME-06)', () => {
  it('< 1 min → Xs', () => {
    expect(formatContributionDuration(0)).toBe('0s');
    expect(formatContributionDuration(45_000)).toBe('45s');
    expect(formatContributionDuration(59_999)).toBe('59s');
  });

  it('< 1 hr → Xm, floored to the previous minute', () => {
    expect(formatContributionDuration(60_000)).toBe('1m');
    expect(formatContributionDuration(90_000)).toBe('1m'); // 1.5 min → 1m
    expect(formatContributionDuration(3_599_999)).toBe('59m');
  });

  it('≥ 1 hr → Xh Ym, floored to the previous minute', () => {
    expect(formatContributionDuration(3_600_000)).toBe('1h 0m');
    expect(formatContributionDuration(3_930_000)).toBe('1h 5m'); // 65.5 min → 1h 5m
  });

  it('non-finite / negative input → 0s (defensive)', () => {
    expect(formatContributionDuration(Number.NaN)).toBe('0s');
    expect(formatContributionDuration(-1)).toBe('0s');
    expect(formatContributionDuration(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});
