// S3 client + key derivation + presigned-URL constants. LocalStack-aware via
// AWS_ENDPOINT_URL env (set in dev, unset in prod so the SDK uses the real
// AWS endpoint). Plan 12 e2e relies on the recordingKeys() format byte-for-byte;
// Phase 5 hash-verify worker reads from these same keys.

import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | undefined;

export function getS3Client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.AWS_ENDPOINT_URL; // set in dev (LocalStack); unset in prod
  _client = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-south-1',
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
  return _client;
}

export const RECORDINGS_BUCKET = (): string => {
  const b = process.env.RECORDINGS_BUCKET;
  if (!b) throw new Error('RECORDINGS_BUCKET not set');
  return b;
};

// Key derivation — LOCKED. Plan 12 e2e + Phase 5 hash-verify rely on this exact format.
// recordings/{userId}/{recordingId}/{video.mp4|imu.csv|metadata.json}
export function recordingKeys(opts: { userId: string; recordingId: string }): {
  video: string;
  imu: string;
  metadata: string;
  prefix: string;
} {
  const base = `recordings/${opts.userId}/${opts.recordingId}`;
  return {
    video: `${base}/video.mp4`,
    imu: `${base}/imu.csv`,
    metadata: `${base}/metadata.json`,
    prefix: `${base}/`,
  };
}

export const PRESIGNED_TTL_SECONDS = 15 * 60; // 15 minutes — planner-locked
export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_PARTS_PER_UPLOAD = 1000; // planner cap below AWS's 10000 ceiling
