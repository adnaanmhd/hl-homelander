// Wire schemas for the /recordings list (API-08) + /recordings/:id (API-09)
// surface. Inputs use snake_case JSON wire convention to match the iOS/Android
// client expectations documented in REQUIREMENTS.md.

import { z } from 'zod';
import { RecordingServerEventSchema } from '@humyn/shared-types';

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
});
export const RecordingsListResponseSchema = z.object({
  items: z.array(RecordingsListItemSchema),
  next_cursor: z.string().length(26).nullable(),
  // Pattern 22 — the `events-outbox` onSend hook (Plan 05-05) may add this key
  // to this authenticated response; the strict serializer must accept it.
  _events: z.array(RecordingServerEventSchema).optional(),
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
});
