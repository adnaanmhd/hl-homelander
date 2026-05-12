// sha256-stream.ts — streamed SHA-256 of an S3 object (LocalStack-backed).
// Gated on AWS_ENDPOINT_URL so it skips cleanly in CI without LocalStack.
import { describe, it, expect, beforeAll } from 'vitest';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { sha256OfS3Object } from '../../src/lib/sha256-stream.js';
import {
  STUB_VIDEO_BYTES,
  STUB_VIDEO_SHA256,
  STUB_IMU_CSV_BYTES,
  STUB_IMU_SHA256,
} from '../fixtures/stub-bundle.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const describeIf = HAS_LOCALSTACK ? describe : describe.skip;
const BUCKET = process.env.RECORDINGS_BUCKET ?? 'humyn-recordings-dev';

describeIf('lib/sha256-stream (LocalStack)', () => {
  let s3: S3Client;

  beforeAll(() => {
    s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      endpoint: process.env.AWS_ENDPOINT_URL,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  });

  it('hashes a stored video blob to the precomputed hex SHA-256', async () => {
    const key = 'recordings/__sha256_stream_test__/v1/video.mp4';
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: STUB_VIDEO_BYTES }));
    const hex = await sha256OfS3Object(key);
    expect(hex).toBe(STUB_VIDEO_SHA256);
  });

  it('hashes a stored IMU CSV blob to the precomputed hex SHA-256', async () => {
    const key = 'recordings/__sha256_stream_test__/v1/imu.csv';
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: STUB_IMU_CSV_BYTES }));
    const hex = await sha256OfS3Object(key);
    expect(hex).toBe(STUB_IMU_SHA256);
  });
});
