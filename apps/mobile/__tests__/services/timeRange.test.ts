// timeRange — HOME-04 / HIST-03 contract verification.
//
// `computeRange(named, now)` returns the `{start, end}` ISO-date pair the
// recordings/contributions API calls send to the server (D-03 + D-03b). Each
// test pins `now` to a deterministic local-tz Thursday 2026-05-14 10:30 so
// the week / month boundaries are reproducible. End-of-window is EXCLUSIVE
// (= day AFTER the last-included day) so the server's `created_at < end`
// predicate matches the design-spec §16 verbatim copy.
//
// Monday-start week (06-RESEARCH Pattern 2 / A6): for Thursday 2026-05-14 the
// week starts on Monday 2026-05-11.

import { describe, it, expect } from 'vitest';
import { computeRange, toIsoDate, type NamedRange } from '../../src/services/timeRange';

// Thursday 2026-05-14 10:30 local. Phase 6 plans live in May 2026 — the date
// is deliberately mid-month + mid-week so every named-window branch lands on
// a non-boundary day.
const NOW = new Date(2026, 4, 14, 10, 30); // month is 0-indexed → 4 = May

describe('toIsoDate', () => {
  it('formats a Date as YYYY-MM-DD in LOCAL timezone (NOT UTC)', () => {
    // 2026-05-14 in any tz that has 14 as the local day-of-month.
    expect(toIsoDate(new Date(2026, 4, 14))).toBe('2026-05-14');
    // Pad month + day to two digits.
    expect(toIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('computeRange (HOME-04 / HIST-03)', () => {
  it("'today' → today → tomorrow (exclusive)", () => {
    expect(computeRange('today', NOW)).toEqual({
      start: '2026-05-14',
      end: '2026-05-15',
    });
  });

  it("'yesterday' → yesterday → today (exclusive)", () => {
    expect(computeRange('yesterday', NOW)).toEqual({
      start: '2026-05-13',
      end: '2026-05-14',
    });
  });

  it("'this-week' → Monday-of-current-week → tomorrow (exclusive)", () => {
    // 2026-05-14 is a Thursday → Monday is 2026-05-11.
    expect(computeRange('this-week', NOW)).toEqual({
      start: '2026-05-11',
      end: '2026-05-15',
    });
  });

  it("'this-month' → first-day-of-month → tomorrow (exclusive)", () => {
    expect(computeRange('this-month', NOW)).toEqual({
      start: '2026-05-01',
      end: '2026-05-15',
    });
  });

  it("'all' returns {} (server interprets absence as unbounded)", () => {
    expect(computeRange('all', NOW)).toEqual({});
  });

  it("'custom' throws — caller must supply start+end explicitly", () => {
    expect(() => computeRange('custom' as NamedRange, NOW)).toThrow(/custom/i);
  });

  it("'this-week' falls back correctly when 'now' lands on a Monday", () => {
    // Monday 2026-05-11 10:00 → Monday-start === the same day; end = tomorrow.
    const monday = new Date(2026, 4, 11, 10, 0);
    expect(computeRange('this-week', monday)).toEqual({
      start: '2026-05-11',
      end: '2026-05-12',
    });
  });

  it("'this-week' falls back correctly when 'now' lands on a Sunday", () => {
    // Sunday 2026-05-17 → Monday-start === 2026-05-11; end = next Monday 2026-05-18.
    const sunday = new Date(2026, 4, 17, 10, 0);
    expect(computeRange('this-week', sunday)).toEqual({
      start: '2026-05-11',
      end: '2026-05-18',
    });
  });
});
