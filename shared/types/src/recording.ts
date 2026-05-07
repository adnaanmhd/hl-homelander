import { z } from 'zod';

export const QaStatusSchema = z.enum([
  'pending',
  'uploaded',
  'verified',
  'hash-mismatch',
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
