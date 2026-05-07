// Diagnostic-attachment uploader for POST /feedback. Targets the
// `humyn-feedback-{env}` bucket created in plan 03's localstack init script
// (extended in plan 08). Key format:
//   feedback/{userId}/{feedbackId}/diagnostic.json
//
// Bytes travel as-is — application/json content type, no transform. The
// route's parser caps file size at FEEDBACK_MAX_BYTES; this module assumes
// the buffer is already bounded.

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './s3-client.js';

export const FEEDBACK_BUCKET = (): string => {
  const b = process.env.FEEDBACK_BUCKET;
  if (!b) throw new Error('FEEDBACK_BUCKET not set');
  return b;
};

export const FEEDBACK_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const FEEDBACK_INLINE_MAX_BYTES = 100 * 1024; // 100 KB cap on diagnostic bytes stored inline in DB

export function feedbackKey(opts: { userId: string; feedbackId: string }): string {
  return `feedback/${opts.userId}/${opts.feedbackId}/diagnostic.json`;
}

export async function uploadDiagnostic(opts: {
  feedbackId: string;
  userId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const key = feedbackKey({ userId: opts.userId, feedbackId: opts.feedbackId });
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: FEEDBACK_BUCKET(),
      Key: key,
      Body: opts.bytes,
      ContentType: opts.contentType,
    }),
  );
  return key;
}
