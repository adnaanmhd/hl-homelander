// durationFormatter — HOME-06 / PROF-03 contract verification.
//
// Tests every branch of the formatter spec (< 1 min / < 1 hr / ≥ 1 hr) plus
// the canonical HOME-06 example (2h 4m 59s → "2h 4m") plus defensive
// boundaries (exact 1 hr, fractional input, NaN/Infinity, negative). Phase 6
// Home tiles will rely on this exact behaviour.

import { describe, it, expect } from 'vitest';
import { formatDuration } from '../../src/services/durationFormatter';

describe('formatDuration (HOME-06)', () => {
  it('< 1 min returns Xs', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(43)).toBe('43s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('< 1 hr returns Xm', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(1800)).toBe('30m');
    expect(formatDuration(3599)).toBe('59m');
  });

  it('≥ 1 hr returns Xh Ym floored to previous minute (HOME-06 example)', () => {
    // 2h 4m 59s → "2h 4m"  (floor — the trailing 59s is dropped)
    expect(formatDuration(2 * 3600 + 4 * 60 + 59)).toBe('2h 4m');
  });

  it('exactly 1 hr returns 1h 0m', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('handles fractional input by flooring', () => {
    expect(formatDuration(43.9)).toBe('43s');
  });

  it('non-finite or negative returns 0s', () => {
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(-1)).toBe('0s');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});
