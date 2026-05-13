// POST /recordings/:id/reupload (UP-16) — re-issue presigned multipart URLs for
// a hash-mismatch row. Requires LocalStack (CreateMultipartUpload + presigns) —
// gated on AWS_ENDPOINT_URL so it skips cleanly without the dev stack.
//
// The "BullMQ dedupe bridge" pair (the last two it() blocks) additionally needs
// Redis — gated separately on REDIS_URL so the LocalStack-only path still runs.
// These tests pin the contract that the /reupload handler removes the prior
// completed BullMQ job (jobId=recordingId) so the post-/finalize
// enqueueVerify(id) no longer silently no-ops — see debug session
// `.planning/debug/enqueue-verify-jobid-dedupe.md`.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../../src/db/index.js';
import { recordingKeys } from '../../../src/lib/s3-client.js';
import { getQueue, getRedisConnection, enqueueVerify } from '../../../src/lib/queue.js';
import { buildApp } from '../../../src/app.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const HAS_REDIS = !!process.env.REDIS_URL;
const describeIf = HAS_LOCALSTACK ? describe : describe.skip;

const USER_A = '01HVTREUPLOADUSERA0000000A';
const USER_B = '01HVTREUPLOADUSERB0000000B';
const TASK_ID = '01HVTREUPLOADTASK00000000T';

function tok(sub: string): string {
  return jwt.sign(
    {
      sub,
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      integrity_verdict: 'passed',
      token_version: 1,
    },
    process.env.JWT_SIGNING_SECRET!,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}

async function mkRecording(
  userId: string,
  qaStatus: 'pending' | 'uploaded' | 'verified' | 'hash-mismatch',
): Promise<string> {
  const id = ulid();
  const keys = recordingKeys({ userId, recordingId: id });
  await db.insert(schema.recordings).values({
    id,
    userId,
    taskId: TASK_ID,
    practice: false,
    qaStatus,
    durationMs: 1000,
    fileSha256: 'a'.repeat(64),
    imuSha256: 'b'.repeat(64),
    fileSizeBytes: 1024,
    imuSizeBytes: 64,
    s3KeyVideo: keys.video,
    s3KeyImu: keys.imu,
    s3KeyMetadata: keys.metadata,
    capturedAt: new Date(),
    flavor: 'playStore',
    s3UploadId: 'stale-upload-id',
    partsCount: 1,
  });
  return id;
}

let app: FastifyInstance;
let keyCounter = 0;
function idemKey(): string {
  keyCounter += 1;
  return `4f7e8f5c-8d2a-4b7f-9c1d-${String(keyCounter).padStart(12, '0')}`;
}

async function cleanup(): Promise<void> {
  for (const id of [USER_A, USER_B]) {
    await db
      .delete(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.userId, id));
    await db.delete(schema.recordings).where(eq(schema.recordings.userId, id));
    await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, id));
  }
}

beforeAll(async () => {
  app = await buildApp();
  for (const id of [USER_A, USER_B]) {
    await db
      .insert(schema.users)
      .values({
        id,
        googleSub: `g-${id.slice(-8)}`,
        email: `${id.slice(-8)}@reup.test`,
        name: 'Reup',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      })
      .onConflictDoNothing();
  }
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'reup-test', 'Reup Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.users).where(eq(schema.users.id, USER_A));
  await db.delete(schema.users).where(eq(schema.users.id, USER_B));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TASK_ID));
  await app.close();
  try {
    await getQueue().close();
  } catch {
    /* not opened */
  }
  try {
    getRedisConnection().disconnect();
  } catch {
    /* not opened */
  }
});

describeIf('POST /recordings/:id/reupload (LocalStack)', () => {
  it('hash-mismatch row → 200 with fresh presigned URLs; row reset to pending with a new s3UploadId', async () => {
    const id = await mkRecording(USER_A, 'hash-mismatch');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 3 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recordingId).toBe(id);
    expect(body.uploadId).toBeDefined();
    expect(body.imuUploadId).toBeDefined();
    expect(body.partUrls).toHaveLength(3);
    expect(body.imuPartUrls).toHaveLength(3);
    expect(body.metadataUrl).toMatch(/^http/);
    expect(typeof body.expiresAt).toBe('string');

    const [row] = await db.select().from(schema.recordings).where(eq(schema.recordings.id, id));
    expect(row!.qaStatus).toBe('pending');
    expect(row!.s3UploadId).toBe(body.uploadId);
    expect(row!.s3UploadId).not.toBe('stale-upload-id');
    expect(row!.partsCount).toBe(3);
    expect(row!.uploadCompletedAt).toBeNull();
    expect(row!.verifiedAt).toBeNull();
  });

  it('a SECOND re-upload from a re-mismatched row → 200 again (no server-side dead-letter cap)', async () => {
    const id = await mkRecording(USER_A, 'hash-mismatch');
    const r1 = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(r1.statusCode).toBe(200);
    // Worker flips it back to hash-mismatch after a still-bad re-upload.
    await db
      .update(schema.recordings)
      .set({ qaStatus: 'hash-mismatch' })
      .where(eq(schema.recordings.id, id));
    const r2 = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(r2.statusCode).toBe(200);
  });

  it('pending row → 409', async () => {
    const id = await mkRecording(USER_A, 'pending');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(res.statusCode).toBe(409);
  });

  it('verified row → 409', async () => {
    const id = await mkRecording(USER_A, 'verified');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("another user's row → 403", async () => {
    const id = await mkRecording(USER_B, 'hash-mismatch');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('missing recording id → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${ulid()}/reupload`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('unauthenticated → 401', async () => {
    const id = await mkRecording(USER_A, 'hash-mismatch');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/reupload`,
      headers: { 'idempotency-key': idemKey() },
      payload: { partsCount: 2 },
    });
    expect(res.statusCode).toBe(401);
  });

  // BullMQ-dedupe bridge pair (debug session enqueue-verify-jobid-dedupe).
  // Both sub-tests need Redis on top of LocalStack — guarded with itIf.
  // Both pause the queue across the test body so the dev hash-verify worker
  // (if running against the same Redis) cannot consume the test's jobs
  // mid-assertion. `pause()` stops NEW jobs from moving to active; jobs
  // already active still drain — the pre-enqueue `q.pause()` is the guard
  // that matters for these tests.
  const itIf = HAS_REDIS ? it : it.skip;

  itIf(
    '/reupload removes a prior completed BullMQ job (jobId=recordingId) so the post-/finalize enqueueVerify(id) re-adds a new waiting job (re-upload boundary bridge)',
    async () => {
      const id = await mkRecording(USER_A, 'hash-mismatch');
      const q = getQueue();

      await q.pause();
      try {
        // Belt-and-braces: ensure no stale prior from another test.
        await q.remove(id).catch(() => {});

        // Simulate the prior verify completion: enqueue + manually move to
        // completed by adding then removing-from-active won't model "completed"
        // accurately. The smoking-gun behavior we care about is BullMQ's
        // `add()` no-op on duplicate jobId — which holds for ANY existing job
        // in any state. So insert the prior as a waiting job; the contract is
        // that /reupload removes it. (The production case is "completed", and
        // remove() works identically; queue.test.ts covers the add-on-duplicate
        // no-op.)
        await enqueueVerify(id);
        const prior = await q.getJob(id);
        expect(prior?.id).toBe(id);

        const res = await app.inject({
          method: 'POST',
          url: `/recordings/${id}/reupload`,
          headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
          payload: { partsCount: 1 },
        });
        expect(res.statusCode).toBe(200);

        // After /reupload, the prior job is gone — enqueueVerify(id) can now
        // add a fresh waiting job (the post-/finalize behavior in prod).
        const after = await q.getJob(id);
        expect(after).toBeUndefined();

        // Pin the contract: a fresh enqueueVerify now succeeds (no longer a no-op).
        await enqueueVerify(id);
        const reEnqueued = await q.getJob(id);
        expect(reEnqueued?.id).toBe(id);
        expect(reEnqueued?.data).toEqual({ recordingId: id });

        // Cleanup so the next test's getJob is clean.
        await q.remove(id).catch(() => {});
      } finally {
        await q.resume();
      }
    },
  );

  itIf(
    'a direct double-enqueue via enqueueVerify (no /reupload) still dedupes to one job — T-5-03-01 SQS-redelivery + sweep-cron dedupe is preserved everywhere else',
    async () => {
      const id = ulid(); // arbitrary jobId; no DB row needed for the queue-level test
      const q = getQueue();

      await q.pause();
      try {
        await q.remove(id).catch(() => {});

        await enqueueVerify(id);
        const first = await q.getJob(id);
        expect(first?.id).toBe(id);

        // Second enqueue with the same jobId silently dedupes (this is the
        // T-5-03-01 behavior we MUST preserve outside the /reupload boundary).
        await enqueueVerify(id);
        const second = await q.getJob(id);
        expect(second?.id).toBe(id);
        // Same underlying job — not a second waiting entry.
        expect(second?.timestamp).toBe(first?.timestamp);

        await q.remove(id).catch(() => {});
      } finally {
        await q.resume();
      }
    },
  );
});
