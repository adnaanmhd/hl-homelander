// Streaming SHA-256 of an S3 object — the byte-fidelity carve-out (CLAUDE.md).
//
// The hash-verify worker is the ONLY component allowed to read recording bytes,
// and it does so read-only, streamed: GetObject().Body (a Node Readable) piped
// through crypto.createHash('sha256') via stream/promises.pipeline. It never
// buffer-collects a multi-GB object into memory, and it never writes anything
// back. The Fastify API never reads recording bytes at all (it lets AWS
// reassemble the multipart upload — see routes/recordings/finalize.ts).
//
// Don't rely on an S3-stored checksum: s3-client.ts runs requestChecksumCalculation:
// 'WHEN_REQUIRED' for LocalStack compat, so uploads didn't store x-amz-checksum-sha256
// and GetObject won't return one. We re-hash the full bytes ourselves (idea-brief.md §7.3).
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, RECORDINGS_BUCKET } from './s3-client.js';

export async function sha256OfS3Object(key: string): Promise<string> {
  const out = await getS3Client().send(
    new GetObjectCommand({ Bucket: RECORDINGS_BUCKET(), Key: key }),
  );
  const hash = createHash('sha256');
  // out.Body is a Node Readable stream in the Node runtime — memory-bounded; never collect into a Buffer.
  await pipeline(out.Body as NodeJS.ReadableStream, hash);
  return hash.digest('hex');
}
