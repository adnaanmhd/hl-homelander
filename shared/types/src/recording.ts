import { z } from 'zod';

export const QaStatusSchema = z.enum([
  'pending',
  'uploaded',
  'verified',
  'hash-mismatch',
  'rejected',
  'takedown',
]);
export type QaStatus = z.infer<typeof QaStatusSchema>;

// POST /recordings request body — submitted by client when finalizing a recording.
// Mirrors video_metadata.json.
export const RecordingCreateSchema = z.object({
  recordingId: z.string().length(26), // ULID minted client-side
  taskId: z.string().length(26),
  practice: z.boolean(),
  durationMs: z.number().int().min(0),
  fileSha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
  imuSha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
  fileSizeBytes: z.number().int().min(0),
  imuSizeBytes: z.number().int().min(0),
  imuVideoDriftMaxMs: z.number().int().nullable().optional(),
  imuVideoDriftMeanMs: z.number().int().nullable().optional(),
  imuVideoDriftP99Ms: z.number().int().nullable().optional(),
  imuMinRateHzObservedP1: z.number().int().nullable().optional(),
  capturedAt: z.string().datetime(),
  // ip_address is null from client per UP-18; server populates
  ipAddress: z.null(),
});
export type RecordingCreate = z.infer<typeof RecordingCreateSchema>;

// Recording row response
export const RecordingSchema = RecordingCreateSchema.extend({
  id: z.string().length(26),
  userId: z.string().length(26),
  qaStatus: QaStatusSchema,
  s3KeyVideo: z.string(),
  s3KeyImu: z.string(),
  s3KeyMetadata: z.string(),
  livenessScore: z.number().int().min(0).max(100).nullable(),
  uploadStartedAt: z.string().datetime().nullable(),
  uploadCompletedAt: z.string().datetime().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  // On the RESPONSE the server returns the value it populated on /init (UP-18) —
  // a string IP (or null if it was somehow never set). The CREATE request still
  // requires `ipAddress: null` (the client never sends one).
  ipAddress: z.string().nullable(),
});
export type Recording = z.infer<typeof RecordingSchema>;

// Wire shapes for the multipart lifecycle endpoints (plan 01-07).
export const RecordingsInitRequestSchema = z.object({
  recordingId: z.string().length(26),
  taskId: z.string().length(26),
  practice: z.boolean(),
  partsCount: z.number().int().min(1).max(1000),
  // Capture-spec headline values — let the server log + persist immediately so
  // we can detect malformed clients (mismatch with bytes-on-disk reported at
  // finalize time).
  durationMs: z.number().int().min(0),
  fileSha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
  imuSha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
  fileSizeBytes: z.number().int().min(0),
  imuSizeBytes: z.number().int().min(0),
  capturedAt: z.string().datetime(),
});
export type RecordingsInitRequest = z.infer<typeof RecordingsInitRequestSchema>;

const PartUrlSchema = z.object({
  partNumber: z.number().int().min(1),
  url: z.string().url(),
});

export const RecordingsInitResponseSchema = z.object({
  recordingId: z.string().length(26),
  uploadId: z.string(),
  partsCount: z.number().int(),
  partUrls: z.array(PartUrlSchema),
  imuUploadId: z.string(),
  imuPartUrls: z.array(PartUrlSchema),
  metadataUrl: z.string().url(), // single PUT; metadata.json < 10 KB
  expiresAt: z.string().datetime(),
});
export type RecordingsInitResponse = z.infer<typeof RecordingsInitResponseSchema>;

export const RecordingPartCompleteSchema = z.object({
  etag: z.string().min(1),
  channel: z.enum(['video', 'imu']),
});
export type RecordingPartComplete = z.infer<typeof RecordingPartCompleteSchema>;

const FinalizePartSchema = z.object({
  partNumber: z.number().int().min(1),
  etag: z.string().min(1),
});

export const RecordingFinalizeSchema = z.object({
  videoParts: z.array(FinalizePartSchema),
  imuParts: z.array(FinalizePartSchema),
});
export type RecordingFinalize = z.infer<typeof RecordingFinalizeSchema>;

// Server→client recording-status event (Plan 05-03). The hash-verify worker
// emits one of these per recording: 'verified' (hashes matched) or 're-upload'
// (hash-mismatch). Delivered via the `events-outbox` onSend hook (Plan 05-05) —
// the `_events` envelope key + the /reupload + /verified-ids request/response
// schemas are added there; this is the wire shape the worker side needs.
// The client de-dups on (recording_id, event_type).
export const RecordingServerEventSchema = z.object({
  recording_id: z.string().length(26),
  event_type: z.enum(['verified', 're-upload']),
});
export type RecordingServerEvent = z.infer<typeof RecordingServerEventSchema>;

// The `_events` envelope (Plan 05-05). The `events-outbox` onSend hook adds this
// optional key to every authenticated JSON object response. Strict response
// schemas on authed carrier routes must `.extend(EventsEnvelopeSchema.shape)`
// (Pattern 22) so the serializer accepts the key.
export const EventsEnvelopeSchema = z.object({
  _events: z.array(RecordingServerEventSchema).optional(),
});
export type EventsEnvelope = z.infer<typeof EventsEnvelopeSchema>;

// POST /recordings/:id/reupload (UP-16) — re-issue presigned multipart URLs for
// a hash-mismatch row. Body mirrors the relevant slice of RecordingsInitRequest
// (the row + the deterministic keys already exist; only partsCount can change).
export const RecordingReuploadRequestSchema = z.object({
  partsCount: z.number().int().min(1).max(1000),
});
export type RecordingReuploadRequest = z.infer<typeof RecordingReuploadRequestSchema>;

// The re-upload response is the same shape as /recordings/init's — fresh
// uploadIds + per-part presigned URLs + the metadata PUT.
export const RecordingReuploadResponseSchema = RecordingsInitResponseSchema;
export type RecordingReuploadResponse = z.infer<typeof RecordingReuploadResponseSchema>;

// GET /recordings/verified-ids?since=<cursor> (VERIFY-06) — the app-launch
// reconciliation sweep surface. `since` is an opaque cursor = the last-seen
// recording_id (its (verified_at, id) tuple is resolved server-side).
export const VerifiedIdsQuerySchema = z.object({
  since: z.string().length(26).optional(),
});
export type VerifiedIdsQuery = z.infer<typeof VerifiedIdsQuerySchema>;

export const VerifiedIdsResponseSchema = z
  .object({
    ids: z.array(z.string().length(26)),
    next_cursor: z.string().length(26).nullable(),
  })
  .extend(EventsEnvelopeSchema.shape); // also an `_events` carrier
export type VerifiedIdsResponse = z.infer<typeof VerifiedIdsResponseSchema>;
