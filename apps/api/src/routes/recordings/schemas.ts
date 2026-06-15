// Wire schemas for the /recordings list (API-08) + /recordings/:id (API-09)
// surface. Inputs use snake_case JSON wire convention to match the iOS/Android
// client expectations documented in REQUIREMENTS.md.
//
// NOTE: Phase 6 Plan 06-05 promoted the `RecordingsList{Query,Item,Response}`
// schemas to `@humyn/shared-types` so the mobile `services/recordingsApi.ts`
// wrapper consumes the canonical wire types. The shapes here MUST stay in
// sync with `shared/types/src/recording.ts`'s `RecordingsList*` exports —
// they're duplicated rather than imported because the backend route already
// runs against the local definitions (typed-route-provider tooling + existing
// test coverage), and an in-flight rewire would expand this plan's blast
// radius. Future work: collapse to a single source via a re-export from
// shared/types.

import { z } from 'zod';

// API-08 input
export const RecordingsListQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  cursor: z.string().length(26).optional(), // opaque cursor = recording_id
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // D-03 (Phase 6 plan 06-03) — explicit ISO dates take precedence over `range`
  // when both are present. Sent by the client as 'YYYY-MM-DD' at local midnight;
  // converted to timestamptz server-side via the Accept-Timezone header (D-03b).
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type RecordingsListQuery = z.infer<typeof RecordingsListQuerySchema>;

// API-08 output — note `qa_status` excludes 'takedown' (filtered out at DB layer)
export const RecordingsListItemSchema = z.object({
  recording_id: z.string().length(26),
  task_id: z.string().length(26),
  qa_status: z.enum(['pending', 'uploaded', 'verified', 'hash-mismatch', 'rejected']),
  duration_ms: z.number().int(),
  created_at: z.string().datetime(),
  // Bug 6 / D5 — short-TTL signed URL for the server poster JPEG; null when the
  // row has no server thumbnail (the client falls back to its local ledger thumb).
  thumbnail_url: z.string().url().nullable(),
});
export const RecordingsListResponseSchema = z.object({
  items: z.array(RecordingsListItemSchema),
  next_cursor: z.string().length(26).nullable(),
  // (Enh 3 / D1 — the `_events` envelope + events-outbox onSend hook were removed.)
});
export type RecordingsListResponse = z.infer<typeof RecordingsListResponseSchema>;

// API-09 input + output
export const RecordingsGetParamsSchema = z.object({ id: z.string().length(26) });
export const RecordingsGetResponseSchema = z.object({
  recording_id: z.string().length(26),
  task_id: z.string().length(26),
  qa_status: z.enum(['uploaded']), // 200 only ever returns 'uploaded' state
  duration_ms: z.number().int(),
  created_at: z.string().datetime(),
  playback_url: z.string().url(),
  playback_url_expires_at: z.string().datetime(),
  // Bug 6 / D5 — short-TTL signed URL for the server poster JPEG; null when absent.
  thumbnail_url: z.string().url().nullable(),
});
