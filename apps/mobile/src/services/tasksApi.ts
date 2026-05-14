// Phase 6 Wave 3 — `/tasks` + `/tasks/search` wrappers (TASK-03 / TASK-04 /
// TASK-10). Both endpoints land in Phase 1 (plan 01-06) and were
// gut-revised to lexical-only in Phase 6 Plan 06-02 (D-01a — RRF hybrid
// descoped from MVP client; pgvector + HNSW remain in-tree for §v2
// SEARCH-V2-01 revival via git history).
//
// `fetchTasks` is a thin proxy over GET /tasks (cursor-paginated, optional
// category + setting filters). `searchTasks` proxies GET /tasks/search
// (q + optional filters + a 5s timeout — TASK-03 server-side lexical
// fan-out is sub-100ms but we keep the 5s ceiling as a network-jitter
// safety net per design-spec §10).
//
// `useTaskSearch` is the 200ms-debounced React hook the TasksScreen
// SearchInput consumes (Plan 06-07 Task 2). The 200ms cadence is verbatim
// from design-spec §10 "200 ms after last keystroke". An empty / whitespace
// query short-circuits to `results: null` (the TasksScreen renders the
// default browse view in that state). Mid-flight queries are cancelled via
// AbortController so a rapid typist never sees stale-search results
// flicker over fresh-search results (T-6.5-05 mitigation).

import { useEffect, useState } from 'react';
import type { TasksListResponse, TasksSearchResponse } from '@humyn/shared-types';
import { apiClient } from './api';

/** Setting filter accepted by the /tasks list + /tasks/search endpoints. */
export type TasksSettingFilter = 'indoor' | 'outdoor';

export interface FetchTasksArgs {
  category?: string;
  setting?: TasksSettingFilter;
  cursor?: string;
  limit?: number;
}

/**
 * GET /tasks — cursor-paginated list of the 65-task taxonomy. Returns up to
 * `limit` (default 50; server caps at 100) tasks + a `nextCursor` opaque
 * pagination token (null on the last page).
 */
export async function fetchTasks(args: FetchTasksArgs = {}): Promise<TasksListResponse> {
  const query: Record<string, string> = {};
  if (args.category) query.category = args.category;
  if (args.setting) query.setting = args.setting;
  if (args.cursor) query.cursor = args.cursor;
  if (args.limit !== undefined) query.limit = String(args.limit);
  return apiClient.getJson<TasksListResponse>('/tasks', { query });
}

export interface SearchTasksArgs {
  category?: string;
  setting?: TasksSettingFilter;
  limit?: number;
}

/**
 * GET /tasks/search — ts_vector + GIN with pg_trgm fuzzy fallback (Plan
 * 06-02). Returns up to `limit` (default 20; server caps at 50) tasks
 * ranked by `lex_score` (the Phase 6 D-01a rename from the legacy
 * `rrf_score`). A 5s timeout caps any server-side regression.
 */
export async function searchTasks(
  q: string,
  args: SearchTasksArgs = {},
): Promise<TasksSearchResponse> {
  const query: Record<string, string> = { q };
  if (args.category) query.category = args.category;
  if (args.setting) query.setting = args.setting;
  if (args.limit !== undefined) query.limit = String(args.limit);
  return apiClient.getJson<TasksSearchResponse>('/tasks/search', {
    query,
    timeoutMs: 5_000,
  });
}

export interface UseTaskSearchState {
  results: TasksSearchResponse['items'] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * 200ms-debounced lexical-search hook (TASK-03). Returns `{results,
 * loading, error}`:
 *
 *   - empty / whitespace query → `{results: null, loading: false, error: null}`
 *     (TasksScreen falls back to the default browse view).
 *   - non-empty query → fires `searchTasks(trimmed)` 200ms after the last
 *     keystroke. Mid-flight queries are aborted on the next change.
 *   - server error / network failure → `{results: null, loading: false,
 *     error: Error}`. The screen surfaces the empty-state row or the
 *     "Send a request" link per design-spec §10 State 4.
 *
 * The 200ms cadence is design-spec §10 verbatim — DO NOT tune without an
 * explicit design decision; debounce-too-fast burns rate-limit budget,
 * debounce-too-slow feels sluggish.
 */
export function useTaskSearch(query: string): UseTaskSearchState {
  const [state, setState] = useState<UseTaskSearchState>({
    results: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setState({ results: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await searchTasks(trimmed);
        if (!ctrl.signal.aborted) {
          setState({ results: data.items, loading: false, error: null });
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setState({ results: null, loading: false, error: e as Error });
        }
      }
    }, 200); // design-spec §10 — 200 ms debounce
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return state;
}
