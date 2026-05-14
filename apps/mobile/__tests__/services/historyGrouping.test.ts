// historyGrouping — HIST-02 contract verification.
//
// `groupByDay(rows, now)` returns SectionList-shaped sections per the
// 06-UI-SPEC §History day-group header rules:
//
//   Today                  — rows whose createdAt calendar day === today
//   Yesterday              — same for yesterday
//   This week              — rows in last 7d EXCLUDING Today + Yesterday
//   This month             — rows >7d ago AND within current calendar month
//   {MonthName YYYY}       — one section per prior calendar month
//
// Sections are sorted newest-first; within each section, input order is
// preserved (the server returns DESC created_at, so this honours that).
//
// `now` pinned to Thursday 2026-05-14 10:30 local (mirrors timeRange.test.ts
// so the test fixtures align under cross-test inspection).

import { describe, it, expect } from 'vitest';
import { groupByDay, type GroupableRow } from '../../src/services/historyGrouping';

const NOW = new Date(2026, 4, 14, 10, 30);

// Helper: produce a row with `createdAt` set to a precise local-tz instant
// (avoids the new Date(year, month, day) → string ambiguity from .toISOString()
// crossing UTC midnight on the day boundary, which would push the test row
// into the wrong bucket on a runner whose tz is east of UTC).
function rowAt(d: Date, id: string): GroupableRow & { id: string } {
  return { id, createdAt: d.toISOString() };
}

describe('groupByDay (HIST-02)', () => {
  it('empty input returns []', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });

  it('groups Today / Yesterday / This week / {MonthName YYYY} for prior month', () => {
    // Build 4 rows mapped to the 4 expected sections.
    const today = rowAt(new Date(2026, 4, 14, 9, 0), 'today-row');
    const yesterday = rowAt(new Date(2026, 4, 13, 9, 0), 'yesterday-row');
    const fourDaysAgo = rowAt(new Date(2026, 4, 10, 9, 0), 'thisweek-row'); // Sunday 2026-05-10
    const lastApril = rowAt(new Date(2026, 3, 20, 9, 0), 'april-row'); // 2026-04-20

    const out = groupByDay([today, yesterday, fourDaysAgo, lastApril], NOW);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({ title: 'Today', data: [today] });
    expect(out[1]).toEqual({ title: 'Yesterday', data: [yesterday] });
    expect(out[2]).toEqual({ title: 'This week', data: [fourDaysAgo] });
    expect(out[3]).toEqual({ title: 'April 2026', data: [lastApril] });
  });

  it('groups multiple rows in the same bucket together (preserves input order)', () => {
    const t1 = rowAt(new Date(2026, 4, 14, 14, 0), 't1');
    const t2 = rowAt(new Date(2026, 4, 14, 10, 0), 't2');
    const y1 = rowAt(new Date(2026, 4, 13, 14, 0), 'y1');
    const out = groupByDay([t1, t2, y1], NOW);
    expect(out).toEqual([
      { title: 'Today', data: [t1, t2] },
      { title: 'Yesterday', data: [y1] },
    ]);
  });

  it('older months get individual {MonthName YYYY} headers', () => {
    const apr = rowAt(new Date(2026, 3, 5, 12, 0), 'apr');
    const mar = rowAt(new Date(2026, 2, 28, 12, 0), 'mar');
    const dec2025 = rowAt(new Date(2025, 11, 15, 12, 0), 'dec2025');
    const out = groupByDay([apr, mar, dec2025], NOW);
    expect(out).toEqual([
      { title: 'April 2026', data: [apr] },
      { title: 'March 2026', data: [mar] },
      { title: 'December 2025', data: [dec2025] },
    ]);
  });

  it('section order is newest-first (input arrives newest-first)', () => {
    // Reverse-order input → group should re-bucket but each section uses
    // input-order. The first section header is therefore Today (because
    // today's row is still present in input), but the section data is
    // whatever input order was.
    const today = rowAt(new Date(2026, 4, 14, 9, 0), 'today');
    const lastApril = rowAt(new Date(2026, 3, 20, 9, 0), 'april');
    const yesterday = rowAt(new Date(2026, 4, 13, 9, 0), 'yesterday');
    const out = groupByDay([today, lastApril, yesterday], NOW);
    // first-hit order of sections = [Today, April 2026, Yesterday].
    expect(out.map((s) => s.title)).toEqual(['Today', 'April 2026', 'Yesterday']);
  });

  it("rows >7d ago AND in current calendar month land in 'This month'", () => {
    // 2026-05-01 is 13 days before 2026-05-14 (>7d) AND in May (current
    // month) → "This month".
    const monthStart = rowAt(new Date(2026, 4, 1, 12, 0), 'month-start');
    const out = groupByDay([monthStart], NOW);
    expect(out).toEqual([{ title: 'This month', data: [monthStart] }]);
  });

  it("rows from 7+ days ago that are STILL within 'this week' bucket land there", () => {
    // 'This week' covers the last 7 days excluding Today + Yesterday — i.e.
    // 7 days back from Today (exclusive lower bound). 2026-05-08 is 6 days
    // before 2026-05-14 → still in 'This week'.
    const sixDaysAgo = rowAt(new Date(2026, 4, 8, 12, 0), 'six-days');
    const out = groupByDay([sixDaysAgo], NOW);
    expect(out).toEqual([{ title: 'This week', data: [sixDaysAgo] }]);
  });
});
