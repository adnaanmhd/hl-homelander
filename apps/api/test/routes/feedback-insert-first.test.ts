// POST /feedback — Phase 6 item 4 (2026-06-10, Bug 6): INSERT-FIRST ordering.
//
// Proves the feedback row is persisted (with `_s3_key: null`) BEFORE the S3
// diagnostic upload runs, and that a successful upload stamps the key onto the
// already-inserted row via jsonb_set. The proof lives INSIDE the mocked
// uploadDiagnostic: it queries the feedback table for the row at upload time —
// if the route still uploaded-then-inserted, the row would not exist yet and
// the probe would record false.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import FormData from 'form-data';

const probe = vi.hoisted(() => ({
  rowExistedAtUploadTime: null as boolean | null,
  diagnosticAtUploadTime: null as Record<string, unknown> | null,
  key: null as string | null,
}));

vi.mock('../../src/lib/feedback-uploader.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/lib/feedback-uploader.js')>();
  return {
    ...orig,
    uploadDiagnostic: async (opts: { feedbackId: string; userId: string }) => {
      // Dynamic imports — the factory is hoisted above the test file's own
      // imports, so top-level bindings are unsafe to close over here.
      const { db, schema } = await import('../../src/db/index.js');
      const { eq: eqOp } = await import('drizzle-orm');
      const rows = await db
        .select()
        .from(schema.feedback)
        .where(eqOp(schema.feedback.id, opts.feedbackId));
      probe.rowExistedAtUploadTime = rows.length === 1;
      probe.diagnosticAtUploadTime = (rows[0]?.diagnostic ?? null) as Record<
        string,
        unknown
      > | null;
      probe.key = `feedback/insert-first-proof/${opts.feedbackId}/diagnostic.json`;
      return probe.key;
    },
  };
});

import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTFB1111111111111111111';

function tok(): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID,
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      integrity_verdict: 'passed',
      token_version: 1,
      installationId: 'inst-if-test',
    },
    process.env.JWT_SIGNING_SECRET!,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await db.delete(schema.feedback).where(eq(schema.feedback.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-feedback-insert-first',
      email: 'fb-if@e.com',
      name: 'FIF',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-if-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  await db.delete(schema.feedback).where(eq(schema.feedback.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('POST /feedback insert-first ordering (Phase 6 item 4)', () => {
  it('row exists with _s3_key:null when S3 runs; success stamps the key via jsonb_set', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'insert-first ordering proof');
    form.append('diagnostic', Buffer.from(JSON.stringify({ os: 'Android 14' })), {
      filename: 'diag.json',
      contentType: 'application/json',
    });
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dd1',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(201);

    // The probe ran inside the (mocked) S3 upload: the row was ALREADY there,
    // carrying the inline diagnostic and the pre-stamp null _s3_key.
    expect(probe.rowExistedAtUploadTime).toBe(true);
    expect(probe.diagnosticAtUploadTime?._s3_key).toBeNull();
    expect(probe.diagnosticAtUploadTime?.os).toBe('Android 14');

    // The 201 carries the mocked key, and the row was stamped post-upload.
    expect(r.json().diagnosticS3Key).toBe(probe.key);
    const rows = await db
      .select()
      .from(schema.feedback)
      .where(eq(schema.feedback.id, r.json().id as string));
    expect(rows).toHaveLength(1);
    const diag = rows[0]!.diagnostic as Record<string, unknown>;
    expect(diag._s3_key).toBe(probe.key);
    expect(diag.os).toBe('Android 14'); // inline diagnostic survived the stamp
  });
});
