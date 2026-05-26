// historyGrouping — Plan 07-16 Task 4b G-28 part 3 (day-section names).
//
// The 4 named sections (Today / Yesterday / This week / This month) now route
// through `history.daySection.*` i18n keys per WARNING 9. Prior-month
// sections stay `{MonthName YYYY}` Latin V1.
//
// Test path under `apps/mobile/__tests__/services/` mirrors existing service
// test files like `tasksApi.test.ts`.
import { describe, it, expect, beforeEach } from 'vitest';
import { groupByDay } from '../../src/services/historyGrouping';
import i18n from '../../src/i18n';
import enJson from '../../src/i18n/locales/en.json';

describe('historyGrouping — Plan 07-16 G-28 part 3 (day-section i18n)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('en.json carries the 4 history.daySection.* keys', () => {
    expect(enJson.history.daySection.today).toBe('Today');
    expect(enJson.history.daySection.yesterday).toBe('Yesterday');
    expect(enJson.history.daySection.thisWeek).toBe('This week');
    expect(enJson.history.daySection.thisMonth).toBe('This month');
  });

  it('groupByDay emits the en-translated section titles', () => {
    // Pin `now` to 2026-05-26 12:00 IST so the buckets are deterministic.
    const now = new Date('2026-05-26T06:30:00Z'); // 12:00 IST
    const rows = [
      { createdAt: '2026-05-26T03:00:00Z' }, // Today (IST 08:30)
      { createdAt: '2026-05-25T04:00:00Z' }, // Yesterday
      { createdAt: '2026-05-22T04:00:00Z' }, // This week
      { createdAt: '2026-05-10T04:00:00Z' }, // This month
      { createdAt: '2026-04-15T04:00:00Z' }, // April 2026
    ];
    const sections = groupByDay(rows, now);
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Today');
    expect(titles).toContain('Yesterday');
    expect(titles).toContain('This week');
    expect(titles).toContain('This month');
    // Prior-month label STAYS Latin V1 (I18N-09 deferred)
    expect(titles).toContain('April 2026');
  });
});
