// Wire DTOs for POST /events — telemetry passthrough (API-11).
//
// The event-name allowlist is the one quality gate at ingest. Adding a new
// event name requires shipping a new release of @humyn/shared-types — this is
// intentional: schema-creep from one-off telemetry calls is a known anti-pattern
// in greenfield analytics, and the cost of churning this constant is small
// compared to the cost of garbage data downstream.

import { z } from 'zod';

export const EVENT_NAMES = [
  'app_started',
  'sign_in_attempted',
  'sign_in_succeeded',
  'sign_in_failed',
  'task_browsed',
  'task_searched',
  'recording_started',
  'recording_completed',
  'recording_uploaded',
  'task_request_submitted',
  'feedback_opened',
  'feedback_submitted',
  'app_backgrounded',
  'app_foregrounded',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export const EventNameSchema = z.enum(EVENT_NAMES);

export const EventCreateSchema = z.object({
  name: EventNameSchema,
  // Properties bag — capped at 32 keys, each value < 256 chars.
  // Total bytes also capped at the route handler (4 KB). Schema-creep guard.
  properties: z.record(z.string(), z.string().max(256)).default({}),
  // ISO 8601 with optional numeric offset — match `RecordingsInitRequestSchema.capturedAt`
  // so a device emitting local-time-with-offset (e.g. `+05:30`) isn't 400'd by
  // Zod's default `Z`-only datetime gate. (Debug session: init-400-capturedat-offset.)
  occurredAt: z.string().datetime({ offset: true }),
});
export type EventCreate = z.infer<typeof EventCreateSchema>;
