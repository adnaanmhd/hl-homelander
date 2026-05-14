// Phase 6 Wave 3 — pure-function time-range helpers consumed by HomeScreen
// tiles + HistoryScreen filter chip + the Filter sheet (Plans 06-08 / 06-09).
//
// The six named windows match design-spec §16 + 06-UI-SPEC §16a:
//   today        — local-midnight today → local-midnight tomorrow
//   yesterday    — local-midnight yesterday → local-midnight today
//   this-week    — Monday-start of current week → local-midnight tomorrow
//                  (Monday-start matches Indian / Brazilian convention per
//                  06-RESEARCH Pattern 2 / Assumption A6)
//   this-month   — first day of current month → local-midnight tomorrow
//   all          — no bounds (server interprets the absence of start/end as
//                  unbounded; the recordings list route's `range` default of
//                  '30d' is overridden by the client when sending
//                  `range=all` explicitly)
//   custom       — caller supplies start+end explicitly (throws if called
//                  with no override — guards against forgetting to read the
//                  RangeCustom blob from appStore before computing)
//
// All ISO dates are 'YYYY-MM-DD' in LOCAL timezone (D-03b). The server's
// Accept-Timezone header (Plan 06-03) converts local-midnight wall-clock to
// timestamptz on receive, so the client MUST send the device's IANA tz with
// every authed list call.

export type NamedRange = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'all' | 'custom';

/**
 * Format a `Date` as 'YYYY-MM-DD' in LOCAL timezone (NOT UTC). Used as the
 * `start` / `end` query-string values sent to /recordings and
 * /contributions/timeseries. The companion server-side parser interprets
 * each date as a wall-clock midnight in the IANA timezone supplied via the
 * `Accept-Timezone` header (Plan 06-03 D-03b).
 */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Compute the `{start, end}` ISO-date pair for a named window relative to
 * `now` (defaults to `new Date()`). `end` is exclusive (= the day AFTER the
 * last-included day), matching the server's `created_at < end` predicate.
 *
 * Throws when called with `'custom'`: callers must read the explicit pair
 * from `appStore.homeRangeCustom` / `appStore.historyRangeCustom` instead.
 *
 * NOTE on `'all'`: returns `{}` rather than `{ start: undefined, end:
 * undefined }`. This keeps the spread pattern at the call site clean:
 * `apiClient.get('/recordings', { query: { range: 'all', ...computeRange('all') } })`.
 */
export function computeRange(
  named: NamedRange,
  now: Date = new Date(),
): { start?: string; end?: string } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  switch (named) {
    case 'today':
      return { start: toIsoDate(startOfToday), end: toIsoDate(endOfToday) };
    case 'yesterday': {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfToday.getDate() - 1);
      return { start: toIsoDate(startOfYesterday), end: toIsoDate(startOfToday) };
    }
    case 'this-week': {
      // Monday-start week — design-spec doesn't specify; researcher picks
      // Monday to match Indian / Brazilian conventions (06-RESEARCH A6).
      // JS `getDay()` returns 0=Sun..6=Sat; shift so 0=Mon..6=Sun.
      const dayOfWeek = (startOfToday.getDay() + 6) % 7;
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);
      return { start: toIsoDate(startOfWeek), end: toIsoDate(endOfToday) };
    }
    case 'this-month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toIsoDate(startOfMonth), end: toIsoDate(endOfToday) };
    }
    case 'all':
      return {};
    case 'custom':
      throw new Error(
        "computeRange('custom') — caller must supply explicit start+end (read from appStore.{home,history}RangeCustom).",
      );
  }
}
