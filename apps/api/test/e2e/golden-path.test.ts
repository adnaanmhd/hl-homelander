// E2E golden-path test — exercises every Phase 1 endpoint in sequence:
//   1. POST /auth/nonce          (mint nonce)
//   2. POST /auth/google         (sign in with mocked happy verdict)
//   3. GET  /tasks/search        (RRF-ranked semantic + lexical search)
//   4. POST /recordings/init     (presigned multipart URLs)
//   4a. UploadPart x 2 (video + IMU) against LocalStack S3
//   4b. POST /recordings/:id/finalize (CompleteMultipartUpload server-side)
//   5. GET  /contributions       (lifetime aggregate reflects new recording)
//   6. POST /events              (telemetry passthrough)
//   7. POST /feedback            (multipart with diagnostic JSON)
//   8. GET  /app/version         (per-flavor discriminated union)
//   9. GET  /recordings          (list — new row visible)
//  10. GET  /recordings/:id      (CloudFront-signed playback URL with ~5min TTL)
//
// Note on DSR export: D-LEGAL-02 mandates mailto + ops CLI ONLY at MVP — there
// is intentionally no HTTP export endpoint. The DSR export CLI
// (apps/api/scripts/dsr-export.ts) is exercised manually by ops, not by this
// golden-path e2e.
//
// All external service calls are mocked at the module level (verifyGoogleIdToken,
// decodeIntegrityToken). LocalStack S3 is real — UploadPart hits it directly
// against the dev bucket, and the route's CompleteMultipartUploadCommand
// reassembles the parts.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import FormData from 'form-data';
import { ulid } from 'ulid';
import { truncateTestTables } from './helpers/seed-fixtures.js';
import { setupAuthMocks, happyPlayStorePayload } from './helpers/mock-play-integrity.js';

// vi.mock declarations MUST run before any import that transitively imports
// the mocked module — setupAuthMocks does the vi.mock() calls; vitest hoists
// them above the subsequent imports of buildApp/decodeIntegrityToken.
setupAuthMocks();
import { buildApp } from '../../src/app.js';
import { decodeIntegrityToken } from '../../src/auth/verify-play-integrity.js';

let app: FastifyInstance;
let s3: S3Client;

// CloudFront playback URL minting requires three env vars. The dev seed-secrets
// init script (infra/localstack/init/02-seed-secrets.sh) generates a fresh keypair
// at LocalStack boot. If those env vars haven't been wired yet — in CI they're
// stubbed via the workflow env block — the golden path's GET /recordings/:id
// step throws. Provide deterministic dummies for the e2e test so that step works
// without depending on the host's secret-load step. The signed URL is NOT
// verified end-to-end (LocalStack doesn't implement CloudFront URL validation);
// we just assert the body shape + TTL.
const TEST_CLOUDFRONT_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAv7SdRyIz/8Zrz3v1G47wFOJ29eq3R8bW4OFbS3sp3FvJWKvI
EtIKa2xjBKbRvOKWMeI9xAhUygfZ2jEC93kIkmVR0yZdi6bPzYeS7L4EdmaPmf5h
yLRIw2jROxNXrPIvFzM8TC2CQYj4YBC6Z3EgfSfQ7R5dCmdJsXAPg9XuhhW8VQ74
AmbjGN3hvshM3tdlEKp1tNpbmjjUjHhd0nNvDRWoVHrqNMHqnAA5j/sn/+s17OvE
sMK5nXrJKf3gpCDk5l4YPfJxZ5oTrXJHEQqr57FZVrk2QjUJFJyrlhe3F5j/6c+f
ynbqhQpXfWkZFFsRIgJP67CiDQjHgVrJqWQVtwIDAQABAoIBAGs6eJPoKBqK+/1q
e2exNFy8HscX0J5TxCBBTLHl5Eu0OlRr/RyvzL09xb8Q5fdHpx4IgIBoVgMWm1HM
0dymmXZ4YGpgRzMK3+q4tPhDRRD4q+s+WjPMa9F4JXKhGlrhqfA/eYkFkeRNVHhq
0/ZFAvMJjGFqYpJF94d6SCHH9c2aZoxabAA/nIsFyyKGgNRBfwIP/p7zZIY6T/kr
tT8xBwkpHbVMHLO9BFVbA2sYtylN8+oG5kuP2ETl0w8/gdBe8oYbB3a/K6q21Qcg
CPoeRdF4rTFAg4CEQBN0Z+JxqJCE3zT0PFwJiJsMP0n/gOoQHUYRIVNLmDFmZXTV
S5JKNoECgYEA5h4LspiJ0BHUmr6Al8qj0VCUeuPRr73KCKj1w7qE0gtnYvrEjeOY
uDbBs/vEf0ce3sKxq7g+kfsvRSCBKGTsyFFRl6i+W8dSfuLrPx3y0Z6nDbF0WgEB
nGtlc5lFiSPJ5PfVUMMxIDlDXpC2j77zYgUaO5zJzXpv6aCO4/0LU60CgYEA1aTg
VpbBI6TtFn2HnYXtsOlhq1XMCOqBz6P9tJA1TRgbmxytsRtLmvkU3HUd3ksSxC0g
nRnPX3+JdOl10Pn1ASpVCsq4ekpOyo67FbmyAhIflbm3VDNd9C1vyk+hy85ddtV0
hJQMSHWAWkKFmmuFTcJ7XEFxANhOI7ZvX3zr05MCgYAOOK/kXMNB35PfqFNkUjov
i7G4KGKa8Y5ATmRhYjpeNtQLKaR5x1AOVYEZAPAv3mDkZiNCOZVgOOCG8ON8vGZh
Vd1sx4DS4jxz3Fnsxly0fWoCi+xWj0X7kOSYXvkwhk2zS0lqq5n1QU68VDeYf66f
fAUpaSWCMBjtXwm9WbIySQKBgB1jWS7nxw9o8XQxv8eIVsj4GqfDnCdfQLnzxoTV
FH5FjF4pkGD9TyPTHlySeQBsqXuxptpMzepHAgi2sTl77Klf3IEXxN9GMD6RP08x
TdKIDfu+xXn3bXDDmS5xx2tXz98DONPfKJXjwUCXUogz1XcnYrCJTymvYzGtBabO
G4mxAoGBAMaPyJ3QbCfNxfVrxsqbLnkF7UXBkfn/mHrMW4WX7L4ORWUW39tTkHeU
1tD9b2MJIPZWnqzN2afvIGPQ0xmkjZdqKzNQIA5TSUXg9NkhKRTSqTvITiAJUIKa
7LP5aB3+s3lwYbAo3IqEkzHZxAH7wYyEGGEYtxa+0zwiEJjVXJpb
-----END RSA PRIVATE KEY-----`;

beforeAll(async () => {
  if (!process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY)
    process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY = TEST_CLOUDFRONT_PRIVATE_KEY;
  if (!process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID)
    process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID = 'E2ETESTKEYPAIRID';
  if (!process.env.CLOUDFRONT_RECORDINGS_BASE_URL)
    process.env.CLOUDFRONT_RECORDINGS_BASE_URL = 'https://e2e-test.cloudfront.net';

  app = await buildApp();
  s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-south-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateTestTables();
  // Reset the default mock so individual tests can override per call.
  vi.mocked(decodeIntegrityToken).mockReset();
  vi.mocked(decodeIntegrityToken).mockImplementation(async () => happyPlayStorePayload('default'));
});

describe('Golden path — every Phase 1 endpoint in sequence', () => {
  it('mint nonce → /auth/google → /tasks/search → /recordings init+upload+finalize → /contributions → /events → /feedback → /app/version → /recordings list+get(playback)', async () => {
    // 1. POST /auth/nonce — anonymous mint of single-use nonce
    const nonceRes = await app.inject({ method: 'POST', url: '/auth/nonce' });
    expect(nonceRes.statusCode).toBe(200);
    const { nonceId, nonce } = nonceRes.json() as { nonceId: string; nonce: string };
    expect(typeof nonceId).toBe('string');
    expect(typeof nonce).toBe('string');

    // 2. POST /auth/google — happy verdict, playStore flavor.
    vi.mocked(decodeIntegrityToken).mockResolvedValueOnce(
      happyPlayStorePayload(nonce, 'ai.humynlabs.capture'),
    );
    const authRes = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'fake-id-token',
        integrityToken: 'fake-integrity-token',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
      },
    });
    expect(authRes.statusCode).toBe(200);
    const authBody = authRes.json() as { jwt: string; user: { id: string; email: string } };
    expect(typeof authBody.jwt).toBe('string');
    const token = authBody.jwt;
    const userId = authBody.user.id;

    // 3. GET /tasks/search — RRF over the 4-row fixture seeded in setup.ts
    const searchRes = await app.inject({ method: 'GET', url: '/tasks/search?q=make+tea&limit=5' });
    expect(searchRes.statusCode).toBe(200);
    const items = (searchRes.json() as { items: Array<{ id: string; slug: string }> }).items;
    expect(items[0]!.slug).toBe('make-tea');
    const taskId = items[0]!.id;

    // 4. POST /recordings/init — presigned multipart URLs
    const recordingId = ulid();
    const initRes = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d10',
      },
      payload: {
        recordingId,
        taskId,
        practice: false,
        partsCount: 1,
        durationMs: 60000,
        fileSha256: 'a'.repeat(64),
        imuSha256: 'b'.repeat(64),
        fileSizeBytes: 5 * 1024 * 1024,
        imuSizeBytes: 1024,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(initRes.statusCode).toBe(201);
    const initBody = initRes.json() as { uploadId: string; imuUploadId: string };
    const { uploadId, imuUploadId } = initBody;
    const bucket = process.env.RECORDINGS_BUCKET as string;

    // 4a. Upload one real part of each stream against the LocalStack URLs
    //     (we ignore the presigned URLs and use the SDK directly — same effect,
    //     simpler than chasing presigned-URL signing for an inject() flow).
    const fakeVideo = Buffer.alloc(5 * 1024 * 1024, 'x');
    const v1 = await s3.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: `recordings/${userId}/${recordingId}/video.mp4`,
        UploadId: uploadId,
        PartNumber: 1,
        Body: fakeVideo,
      }),
    );
    const i1 = await s3.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: `recordings/${userId}/${recordingId}/imu.csv`,
        UploadId: imuUploadId,
        PartNumber: 1,
        Body: Buffer.alloc(1024, 'y'),
      }),
    );

    // 4b. POST /recordings/:id/finalize — CompleteMultipartUpload server-side
    const finRes = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d11',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: v1.ETag! }],
        imuParts: [{ partNumber: 1, etag: i1.ETag! }],
        imuUploadId,
      },
    });
    expect(finRes.statusCode).toBe(200);
    expect((finRes.json() as { qaStatus: string }).qaStatus).toBe('uploaded');

    // 5. GET /contributions — the trigger should have populated the bucket
    const cRes = await app.inject({
      method: 'GET',
      url: '/contributions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cRes.statusCode).toBe(200);
    expect((cRes.json() as { recordingCount: number }).recordingCount).toBe(1);

    // 6. POST /events — telemetry ingest
    const evRes = await app.inject({
      method: 'POST',
      url: '/events',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d12',
      },
      payload: {
        name: 'recording_completed',
        properties: { taskId },
        occurredAt: new Date().toISOString(),
      },
    });
    expect(evRes.statusCode).toBe(201);

    // 7. POST /feedback (multipart) — diagnostic JSON file
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'Test feedback message from e2e suite');
    form.append(
      'diagnostic',
      Buffer.from(JSON.stringify({ os: 'Android 14', model: 'Pixel 7a' })),
      {
        filename: 'diag.json',
        contentType: 'application/json',
      },
    );
    const fbRes = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d13',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(fbRes.statusCode).toBe(201);

    // 8. GET /app/version — per-flavor discriminated union (no auth required)
    const vApk = await app.inject({ method: 'GET', url: '/app/version?flavor=apkRollout' });
    expect(vApk.statusCode).toBe(200);
    expect((vApk.json() as { apkUrl: string }).apkUrl).toMatch(/^https/);
    const vPs = await app.inject({ method: 'GET', url: '/app/version?flavor=playStore' });
    expect(vPs.statusCode).toBe(200);
    expect((vPs.json() as { playStoreUrl: string }).playStoreUrl).toMatch(/^https/);

    // 9. GET /recordings — the new row should be visible (excludes takedown
    //    is covered in test/e2e/recordings-list-negatives.test.ts).
    const listRes = await app.inject({
      method: 'GET',
      url: '/recordings?limit=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { items: Array<{ recording_id: string }> };
    expect(listBody.items.length).toBeGreaterThanOrEqual(1);
    expect(listBody.items[0]!.recording_id).toBe(recordingId);

    // 10. GET /recordings/:id — single recording returns a CloudFront-signed
    //     playback URL with ~5min TTL (API-09).
    const getRes = await app.inject({
      method: 'GET',
      url: `/recordings/${recordingId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json() as {
      playback_url: string;
      playback_url_expires_at: string;
    };
    expect(typeof getBody.playback_url).toBe('string');
    expect(getBody.playback_url).toContain('e2e-test.cloudfront.net');
    const ttlMs = new Date(getBody.playback_url_expires_at).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(4 * 60 * 1000); // > 4 min
    expect(ttlMs).toBeLessThan(6 * 60 * 1000); // < 6 min
  }, 120_000);
});
