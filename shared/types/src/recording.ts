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
  // (Enh 3 / D1, 2026-06-04: fileSha256 / imuSha256 removed — all upload hashing dropped.)
  fileSizeBytes: z.number().int().min(0),
  imuSizeBytes: z.number().int().min(0),
  imuVideoDriftMaxMs: z.number().int().nullable().optional(),
  imuVideoDriftMeanMs: z.number().int().nullable().optional(),
  imuVideoDriftP99Ms: z.number().int().nullable().optional(),
  imuMinRateHzObservedP1: z.number().int().nullable().optional(),
  // The device's MetadataComposer writes ISO 8601 with a NUMERIC OFFSET (e.g.
  // `+05:30`) — Zod's default `.datetime()` is `{ offset: false }` which only
  // accepts a trailing `Z`. Offsets are valid ISO 8601; allow them on inbound
  // client-supplied datetimes. (Debug session: init-400-capturedat-offset.)
  capturedAt: z.string().datetime({ offset: true }),
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
  // (Enh 3 / D1: verifiedAt removed — no verify step.)
  createdAt: z.string().datetime(),
  // On the RESPONSE the server returns the value it populated on /init (UP-18) —
  // a string IP (or null if it was somehow never set). The CREATE request still
  // requires `ipAddress: null` (the client never sends one).
  ipAddress: z.string().nullable(),
});
export type Recording = z.infer<typeof RecordingSchema>;

// Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — the metadata.json
// `calibration` block (schema 1.2.0): camera intrinsics + cam-IMU extrinsics
// from the device's CameraCalibrationReader. Kept lenient (jsonb tolerates
// extra keys + null params — the uncalibrated fallback common on Pixels) so a
// slightly-evolved device block still validates. Not over-constrained.
const CalibrationCameraSchema = z.object({
  model: z.string(),
  resolution: z.array(z.number()).length(2).nullable().optional(),
  params: z.record(z.string(), z.number().nullable()).nullable().optional(),
  distortion_coeffs: z.array(z.number()).nullable().optional(),
  intrinsics_source: z.string(),
});
const CalibrationExtrinsicsSchema = z.object({
  T_cam_imu: z.array(z.array(z.number())).nullable().optional(),
  T_imu_cam: z.array(z.array(z.number())).nullable().optional(),
  T_cam_imu_translation_mm: z.array(z.number()).nullable().optional(),
  timeshift_cam_imu_sec: z.number(),
  timeshift_meaning: z.string(),
  clock_sync_note: z.string(),
  extrinsics_source: z.string(),
});
export const CalibrationSchema = z.object({
  camera: CalibrationCameraSchema,
  cam_imu_extrinsics: CalibrationExtrinsicsSchema,
});
export type Calibration = z.infer<typeof CalibrationSchema>;

// Bug 3 / D3 (2026-06-04) — precise GPS location block. Mirrors the
// metadata.json `capture_device_info.location` object (schema 1.5.0) and the
// Kotlin `LocationFix` / `LocationJson` shape. Overrides the formerly-LOCKED
// coarse-only constraint (owner sign-off D3; consent-text + DPIA is a SHIP
// gate). snake_case keys match the on-device JSON so the block forwards
// verbatim from the device into `/recordings/init`.
export const LocationSchema = z.object({
  // Bounded to valid WGS84 ranges (Bug 3 / D3 follow-up). Real
  // FusedLocationProvider fixes are always in range; this keeps a malformed /
  // garbage client coordinate out of the queryable mirror. (A non-numeric lat
  // already 400s; this also 400s an out-of-range numeric one.)
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Horizontal accuracy radius in metres (audit field — lets us see the
  // precision actually delivered: a partial COARSE grant yields a larger value).
  accuracy_m: z.number(),
  // Fix provider — e.g. "fused" | "gps" | "network" | "fused_last_known".
  provider: z.string(),
  captured_at: z.string(),
  // Optional reverse-geocoded "City, Country" for human readability.
  label: z.string().nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

// Wire shapes for the multipart lifecycle endpoints (plan 01-07).
export const RecordingsInitRequestSchema = z.object({
  recordingId: z.string().length(26),
  taskId: z.string().length(26),
  practice: z.boolean(),
  partsCount: z.number().int().min(1).max(1000),
  // Capture-spec headline values — let the server log + persist immediately so
  // we can detect malformed clients (mismatch with bytes-on-disk reported at
  // finalize time). (Enh 3 / D1, 2026-06-04: fileSha256 / imuSha256 removed —
  // all upload hashing dropped; /recordings/init no longer accepts them.)
  durationMs: z.number().int().min(0),
  fileSizeBytes: z.number().int().min(0),
  imuSizeBytes: z.number().int().min(0),
  // Match RecordingCreateSchema.capturedAt — allow ISO 8601 with a numeric
  // offset (the device emits `+05:30`, etc.), not just `Z`. (Debug session:
  // init-400-capturedat-offset.)
  capturedAt: z.string().datetime({ offset: true }),
  // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — the metadata.json
  // `calibration` block (schema 1.2.0). Optional + nullable: pre-1.2.0 / older
  // clients send nothing → persisted as null. Persisted on the new-row INSERT
  // in init.ts as the queryable mirror of the metadata.json calibration.
  calibration: CalibrationSchema.nullable().optional(),
  // Bug 3 / D3 (2026-06-04) — the metadata.json `capture_device_info.location`
  // precise-GPS block (schema 1.5.0). Optional + nullable: a segment with no
  // fix (unavailable / partial grant) sends null; pre-1.5.0 clients send
  // nothing. Persisted on the new-row INSERT in init.ts as the queryable mirror
  // (recordings.location jsonb), sibling to the server-set ip_address.
  location: LocationSchema.nullable().optional(),
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

// (Enh 3 / D1, 2026-06-04: RecordingServerEventSchema, the `_events` EventsEnvelope,
// and the /recordings/:id/reupload request/response schemas were removed with the
// hash-verify flow. `uploaded` is terminal success; there are no server→client
// recording-status events and no hash-mismatch re-upload path.)

// POST /recordings/:id/parts (UP-04) — re-presign part URLs against the EXISTING
// video + IMU multipart uploads (no CreateMultipartUpload of any kind). The client
// supplies the IMU upload-id it received from the original /init (the server stores
// only the video upload-id on the row). Used by the upload coordinator on a re-drain
// after a process-kill / presigned-TTL expiry — keeps the already-uploaded VIDEO
// *and* IMU parts' ETags valid (preferred over re-/init, which restarts the IMU stream).
export const RecordingRePresignRequestSchema = z.object({
  partsCount: z.number().int().min(1).max(1000),
  imuUploadId: z.string().min(1),
});
export type RecordingRePresignRequest = z.infer<typeof RecordingRePresignRequestSchema>;

// The re-presign response is the same shape as /recordings/init's — /init's
// idempotent re-presign path and /parts both return it.
export const RecordingRePresignResponseSchema = RecordingsInitResponseSchema;
export type RecordingRePresignResponse = z.infer<typeof RecordingRePresignResponseSchema>;

// (Enh 3 / D1, 2026-06-04: GET /recordings/verified-ids + its query/response
// schemas were removed with the hash-verify flow — there is no verified-ids
// reconciliation sweep; the device deletes local files on /finalize 200.)

// GET /recordings — paginated list shape (API-08). Promoted from the
// backend's apps/api/src/routes/recordings/schemas.ts so the mobile
// `services/recordingsApi.ts` wrapper (Phase 6 Plan 06-05) can consume the
// canonical wire types via @humyn/shared-types instead of duplicating them.
// Phase 6 Plan 06-03 extends the query schema with explicit `start` + `end`
// ISO-date windows (D-03) and an Accept-Timezone header (D-03b) — see the
// backend list route for the full server-side surface.
export const RecordingsListQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  cursor: z.string().length(26).optional(), // opaque cursor = recording_id
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

// Output — `qa_status` excludes 'takedown' (filtered out at the DB layer).
export const RecordingsListItemSchema = z.object({
  recording_id: z.string().length(26),
  task_id: z.string().length(26),
  qa_status: z.enum(['pending', 'uploaded', 'verified', 'hash-mismatch', 'rejected']),
  duration_ms: z.number().int(),
  created_at: z.string().datetime(),
  // Bug 6 / D5 (2026-06-04) — short-TTL signed URL for the server-generated poster
  // JPEG; null when the row has no server thumbnail. The client prefers its local
  // MMKV ledger thumb and falls back to this, then to the gradient placeholder.
  thumbnail_url: z.string().url().nullable(),
});
export type RecordingsListItem = z.infer<typeof RecordingsListItemSchema>;

export const RecordingsListResponseSchema = z.object({
  items: z.array(RecordingsListItemSchema),
  next_cursor: z.string().length(26).nullable(),
  // (Enh 3 / D1 — no `_events` envelope anymore.)
});
export type RecordingsListResponse = z.infer<typeof RecordingsListResponseSchema>;

// D-08 (Phase 6 plan 06-03) — archive state envelope for
// GET /recordings/:id/stream-url. The player consumes this discriminated
// envelope to decide between live playback, the "still uploading" message,
// and the "archived" disabled state.
//   'available'    — qa_status ∈ {uploaded, verified, hash-mismatch} AND age ≤ 90d
//                    (presignedUrl is a non-null CloudFront-signed URL)
//   'unavailable'  — qa_status = 'pending' (no S3 object yet; presignedUrl is null)
//   'deep-archive' — age > 90d (Phase 1 S3 lifecycle parity; presignedUrl is null)
// (takedown / rejected / cross-user → 404 problem-detail; T-1.7-10 no existence leak.)
export const ArchiveStateSchema = z.enum(['available', 'unavailable', 'deep-archive']);
export type ArchiveState = z.infer<typeof ArchiveStateSchema>;

export const RecordingsStreamUrlParamsSchema = z.object({ id: z.string().length(26) });
export type RecordingsStreamUrlParams = z.infer<typeof RecordingsStreamUrlParamsSchema>;

export const RecordingsStreamUrlResponseSchema = z.object({
  presignedUrl: z.string().url().nullable(),
  expiresAt: z.string().datetime(),
  archiveState: ArchiveStateSchema,
  // (Enh 3 / D1 — no `_events` envelope anymore.)
});
export type RecordingsStreamUrlResponse = z.infer<typeof RecordingsStreamUrlResponseSchema>;
