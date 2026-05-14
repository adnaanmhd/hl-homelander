// Phase 6 Wave 3 — `/recordings` + `/recordings/:id/stream-url` wrappers
// (HIST-01..06 + Player consumption surface).
//
// `fetchRecordings` covers the cursor-paginated history list (Plan 06-03
// extended /recordings with explicit ISO `start` + `end` ranges and the
// Accept-Timezone header — D-03 / D-03b). When the caller supplies `tz`,
// the wrapper forwards it as `Accept-Timezone: ${tz}` so the server
// interprets each YYYY-MM-DD wall-clock midnight against the device's IANA
// timezone (e.g. Asia/Kolkata, America/Sao_Paulo).
//
// `getRecordingStreamUrl` returns the discriminated `archiveState` envelope
// (Plan 06-03 D-08): one of 'available' (presigned URL set) /
// 'unavailable' (still uploading) / 'deep-archive' (>90d). 404s (cross-user,
// takedown, rejected) surface as a thrown Error via apiClient — the Player
// catches and renders the no-existence-leak error state.

import type { RecordingsListResponse, RecordingsStreamUrlResponse } from '@humyn/shared-types';
import { apiClient } from './api';

export interface FetchRecordingsArgs {
  /** Named range — server default is '30d'. Overridden by explicit start+end. */
  range?: '7d' | '30d' | '90d' | 'all';
  /** Inclusive local-tz midnight (YYYY-MM-DD). Takes precedence over `range`. */
  start?: string;
  /** Exclusive local-tz midnight (YYYY-MM-DD). Pair with `start`. */
  end?: string;
  /** Opaque pagination cursor = last seen recording_id. */
  cursor?: string;
  /** Server default 20; capped at 100. */
  limit?: number;
  /** Device IANA timezone (e.g. 'Asia/Kolkata'). Forwarded as Accept-Timezone. */
  tz?: string;
}

/**
 * GET /recordings — paginated, range-filtered list of the authenticated
 * user's recordings. `qa_status === 'takedown'` rows are filtered out at
 * the DB layer (T-1.7-08).
 *
 * When `tz` is supplied, the server interprets the `start` / `end` YYYY-MM-DD
 * wall-clock midnights AS IF in `tz` and returns rows whose UTC `created_at`
 * timestamp falls in `[start_tz, end_tz)`. Unknown IANA names → 400 problem-
 * detail with `Unknown IANA timezone: ${tz}`.
 */
export async function fetchRecordings(
  args: FetchRecordingsArgs = {},
): Promise<RecordingsListResponse> {
  const query: Record<string, string> = {};
  if (args.range) query.range = args.range;
  if (args.start) query.start = args.start;
  if (args.end) query.end = args.end;
  if (args.cursor) query.cursor = args.cursor;
  if (args.limit !== undefined) query.limit = String(args.limit);
  const headers: Record<string, string> = {};
  if (args.tz) headers['Accept-Timezone'] = args.tz;
  return apiClient.getJson<RecordingsListResponse>('/recordings', { query, headers });
}

/**
 * GET /recordings/:id/stream-url — short-lived signed-URL envelope used by
 * the in-app Player (Plan 06-06).
 *
 *   archiveState = 'available'    → presignedUrl points at the CloudFront
 *                                   signed URL (TTL ≈ 5 min).
 *   archiveState = 'unavailable'  → 'Still uploading — try again in a moment.'
 *                                   presignedUrl is null.
 *   archiveState = 'deep-archive' → 'Archived — restore via support.'
 *                                   presignedUrl is null.
 *
 * 404s (cross-user / takedown / rejected) surface as a thrown Error.
 */
export async function getRecordingStreamUrl(id: string): Promise<RecordingsStreamUrlResponse> {
  return apiClient.getJson<RecordingsStreamUrlResponse>(`/recordings/${id}/stream-url`);
}
