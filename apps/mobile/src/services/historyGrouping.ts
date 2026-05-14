// Phase 6 Wave 3 — HistoryScreen SectionList grouper (HIST-02).
//
// Buckets a flat newest-first list of rows into day-group sections per the
// 06-UI-SPEC §History day-group header rules:
//
//   Today                  — rows whose createdAt calendar day === today
//   Yesterday              — same for yesterday
//   This week              — rows in last 7d EXCLUDING Today + Yesterday
//   This month             — rows >7d ago AND within current calendar month
//   {MonthName YYYY}       — one section per prior calendar month
//
// All boundaries respect the device's LOCAL timezone (D-03b — the same
// IANA tz the recordings list call carries via Accept-Timezone). The
// grouper is a pure function; the SectionList's renderItem / renderSection
// is owned by the screen (Plan 06-09).
//
// Sections are emitted in input order (the server returns DESC created_at,
// so the first-hit order of sections is newest-first by construction).
// Rows within a section preserve input order.

/**
 * The minimal contract `groupByDay` needs from a row: a `createdAt` ISO-8601
 * string the grouper can parse. The screen passes in the full
 * `RecordingsListItem` (Plan 06-03); the grouper's generic preserves all
 * other fields so the consuming SectionList sees the full row.
 */
export interface GroupableRow {
  createdAt: string;
  [k: string]: unknown;
}

export interface DaySection<T extends GroupableRow> {
  title: string;
  data: T[];
}

// Full English month names per 06-UI-SPEC §History day-group header
// ("{MonthName YYYY}" — e.g. "April 2026"). Kept here rather than relying on
// `Intl.DateTimeFormat` so the section titles are stable across locales
// (MVP is English-only per CLAUDE.md "Geos / locale: India + Brazil at MVP,
// English only. Localization deferred.").
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Group a list of rows into day-group sections per HIST-02. `now` defaults
 * to `new Date()`; pinning it makes the function deterministic for tests
 * + for the snapshot baselines (06-UI-SPEC §Visual Snapshot Baselines).
 *
 * Time complexity O(n) — single pass, hash-keyed buckets.
 *
 * @param rows  newest-first list of rows (server returns DESC created_at)
 * @param now   reference instant for the bucket boundaries (defaults to wall clock)
 */
export function groupByDay<T extends GroupableRow>(
  rows: T[],
  now: Date = new Date(),
): DaySection<T>[] {
  if (rows.length === 0) return [];

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  // 'This week' covers the last 7-day window — 7 days back from Today
  // (exclusive lower bound). The "exclude Today + Yesterday" cut is enforced
  // by the if-chain order below: a row that falls into both 'Yesterday' and
  // the 7-day window is bucketed into 'Yesterday' first.
  const startOfWeekCutoff = new Date(startOfToday);
  startOfWeekCutoff.setDate(startOfToday.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets: Record<string, T[]> = {};
  const order: string[] = [];
  function push(title: string, row: T): void {
    if (!buckets[title]) {
      buckets[title] = [];
      order.push(title);
    }
    buckets[title]!.push(row);
  }

  for (const r of rows) {
    const d = new Date(r.createdAt);
    if (d >= startOfToday) {
      push('Today', r);
    } else if (d >= startOfYesterday) {
      push('Yesterday', r);
    } else if (d >= startOfWeekCutoff) {
      push('This week', r);
    } else if (d >= startOfMonth) {
      push('This month', r);
    } else {
      push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, r);
    }
  }

  // First-hit order matches the input's newest-first ordering (the server
  // returns DESC created_at), so the section sequence is correct by
  // construction — no explicit sort needed.
  return order.map((title) => ({ title, data: buckets[title]! }));
}
