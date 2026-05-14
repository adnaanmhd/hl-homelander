// Phase 6 Wave 3 — `/contributions` + `/contributions/timeseries` wrappers
// (HOME-03 / HOME-04 / HOME-06 / PROF-03).
//
// `fetchLifetime` proxies GET /contributions for the all-time aggregate
// numbers the Profile screen + the Home "all-time" tile-pair read.
//
// `fetchContributionsAggregate` is the Phase 6 D-03a single-bucket variant
// of /contributions/timeseries — instead of the daily buckets the heatmap
// consumes, it returns ONE aggregated bucket (SUM(duration_ms) +
// COUNT(*) + COUNT(DISTINCT task_id)) over the supplied window. The Home
// tile pair (today / week / month) calls this with the matching ISO date
// pair from `services/timeRange.computeRange()` and the `Accept-Timezone`
// header so the count's day boundary matches the user's wall clock
// (D-03b).
//
// Distinct task-count cannot be summed across daily buckets without
// double-counting, hence the dedicated aggregate=true path — the daily
// variant is still useful for the heatmap (one bucket per day) where
// double-counting isn't an issue.

import type { ContributionsLifetime, ContributionsTimeseries } from '@humyn/shared-types';
import { apiClient } from './api';

/**
 * GET /contributions — lifetime aggregate (duration_ms, recording_count,
 * task_count, top-10 perTask breakdown). Cached server-side; the Profile
 * screen reads on mount + on AppState→active.
 */
export async function fetchLifetime(): Promise<ContributionsLifetime> {
  return apiClient.getJson<ContributionsLifetime>('/contributions');
}

export interface FetchContributionsAggregateArgs {
  /** Inclusive local-tz midnight (YYYY-MM-DD). */
  start?: string;
  /** Exclusive local-tz midnight (YYYY-MM-DD). */
  end?: string;
  /** Named range — server default '30d'. Overridden by explicit start+end. */
  range?: '7d' | '30d' | '90d';
  /** Device IANA timezone — forwarded as `Accept-Timezone: ${tz}`. */
  tz?: string;
}

/**
 * GET /contributions/timeseries?aggregate=true — single-bucket aggregate
 * over the supplied window. Returns a `buckets` array whose single entry
 * carries the SUM(duration_ms) + COUNT(*) + COUNT(DISTINCT task_id) for
 * the window.
 *
 * When `tz` is supplied, the server interprets the YYYY-MM-DD bounds as
 * wall-clock midnights in `tz`. Unknown IANA names → 400 problem-detail.
 */
export async function fetchContributionsAggregate(
  args: FetchContributionsAggregateArgs = {},
): Promise<ContributionsTimeseries> {
  const query: Record<string, string> = { aggregate: 'true' };
  if (args.start) query.start = args.start;
  if (args.end) query.end = args.end;
  if (args.range) query.range = args.range;
  const headers: Record<string, string> = {};
  if (args.tz) headers['Accept-Timezone'] = args.tz;
  return apiClient.getJson<ContributionsTimeseries>('/contributions/timeseries', {
    query,
    headers,
  });
}
