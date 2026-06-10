// POST /feedback (multipart) — API-12. Asserts the multipart happy path with
// a diagnostic JSON file lands an S3 key, the content-type allowlist (T-1.8-04)
// rejects text/plain, and the category enum rejects unknown values.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';
import { isPgContentError } from '../../src/routes/feedback/post.js';
import FormData from 'form-data';

const TEST_USER_ID = '01HVTFB0000000000000000000';
// Second user for the Phase 6 (Bug 6) tests — the /feedback auth-tier rate
// limit is 5/min keyed per-sub and the original suite already spends user 1's
// whole budget; a fresh sub gets a disjoint bucket.
const TEST_USER_ID_2 = '01HVTFB2222222222222222222';

function tokFor(sub: string, installationId: string): string {
  return jwt.sign(
    {
      sub,
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      integrity_verdict: 'passed',
      token_version: 1,
      installationId,
    },
    process.env.JWT_SIGNING_SECRET!,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}
function tok(): string {
  return tokFor(TEST_USER_ID, 'inst-test');
}
function tok2(): string {
  return tokFor(TEST_USER_ID_2, 'inst-test-2');
}

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  for (const uid of [TEST_USER_ID, TEST_USER_ID_2]) {
    await db.delete(schema.feedback).where(eq(schema.feedback.userId, uid));
    await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, uid));
  }
  await db
    .insert(schema.users)
    .values([
      {
        id: TEST_USER_ID,
        googleSub: 'g-feedback',
        email: 'fb@e.com',
        name: 'F',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        currentInstallationId: 'inst-test',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      },
      {
        id: TEST_USER_ID_2,
        googleSub: 'g-feedback-2',
        email: 'fb2@e.com',
        name: 'F2',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        currentInstallationId: 'inst-test-2',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      },
    ])
    .onConflictDoNothing();
});
afterAll(async () => {
  for (const uid of [TEST_USER_ID, TEST_USER_ID_2]) {
    await db.delete(schema.feedback).where(eq(schema.feedback.userId, uid));
    await db.delete(schema.users).where(eq(schema.users.id, uid));
  }
  await app.close();
});

describe('POST /feedback (multipart)', () => {
  it('happy path with diagnostic JSON file → 201 + S3 key', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'It crashed when I tapped record');
    form.append(
      'diagnostic',
      Buffer.from(JSON.stringify({ os: 'Android 14', model: 'Pixel 7a' })),
      {
        filename: 'diag.json',
        contentType: 'application/json',
      },
    );
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc1',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(201);
    expect(typeof r.json().id).toBe('string');
    expect(typeof r.json().diagnosticS3Key).toBe('string');
    expect(r.json().diagnosticS3Key).toMatch(/^feedback\//);
  });

  it('S3 diagnostic upload failure → still 201 + null key, feedback NOT lost', async () => {
    // Simulate a misconfigured / unreachable feedback bucket: PutObject to a
    // non-existent bucket throws NoSuchBucket. The report must still land (the
    // category + message + inline diagnostic are the real signal). Regression
    // for the "report a problem → 500" bug.
    const originalBucket = process.env.FEEDBACK_BUCKET;
    process.env.FEEDBACK_BUCKET = 'humyn-feedback-does-not-exist-regression';
    try {
      const form = new FormData();
      form.append('category', 'app-crashed');
      form.append('message', 'crash report while the feedback bucket is down');
      form.append(
        'diagnostic',
        Buffer.from(JSON.stringify({ os: 'Android 14', model: 'Pixel 7a' })),
        {
          filename: 'diag.json',
          contentType: 'application/json',
        },
      );
      const r = await app.inject({
        method: 'POST',
        url: '/feedback',
        headers: {
          authorization: `Bearer ${tok()}`,
          'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc5',
          ...form.getHeaders(),
        },
        payload: form.getBuffer(),
      });
      expect(r.statusCode).toBe(201);
      expect(r.json().diagnosticS3Key).toBeNull();
      // The feedback row persisted with the inline diagnostic and a null S3 key.
      const rows = await db
        .select()
        .from(schema.feedback)
        .where(eq(schema.feedback.id, r.json().id as string));
      expect(rows).toHaveLength(1);
      const diag = rows[0]!.diagnostic as Record<string, unknown>;
      expect(diag.os).toBe('Android 14');
      expect(diag._s3_key).toBeNull();
    } finally {
      process.env.FEEDBACK_BUCKET = originalBucket;
    }
  });

  it('strips a NUL byte (U+0000) from the diagnostic + message → 201, no 500 (BUG-7)', async () => {
    // A control char in a telemetry / device-model string (analytics.ts doesn't
    // redact them) used to 500 the UNGUARDED jsonb insert: Postgres rejects a NUL
    // in a jsonb value (SQLSTATE 22P05) AND in a text value. The device sends
    // VALID JSON with the NUL escaped (\u0000); the server's JSON.parse turns it
    // back into a real NUL char before the insert — exactly the repro. Build the
    // NUL at runtime so the .ts source carries no literal NUL byte.
    const NUL = String.fromCharCode(0);
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', `crash with a NUL${NUL} in the message`);
    form.append(
      'diagnostic',
      Buffer.from(
        JSON.stringify({
          os: 'Android 14',
          model: `Pixel${NUL} 7a`,
          nested: { telemetry: `x${NUL}y` },
        }),
      ),
      { filename: 'diag.json', contentType: 'application/json' },
    );
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc7',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    // The whole point: a 201, NOT a 500.
    expect(r.statusCode).toBe(201);
    // The row persisted with the NUL stripped from the diagnostic + the message.
    const rows = await db
      .select()
      .from(schema.feedback)
      .where(eq(schema.feedback.id, r.json().id as string));
    expect(rows).toHaveLength(1);
    const diag = rows[0]!.diagnostic as Record<string, unknown>;
    expect(diag.model).toBe('Pixel 7a');
    expect((diag.nested as Record<string, unknown>).telemetry).toBe('xy');
    expect(rows[0]!.message).toBe('crash with a NUL in the message');
  });

  it('rejects non-application/json diagnostic (text/plain) → 400 (T-1.8-04)', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'msg');
    form.append('diagnostic', Buffer.from('hi'), {
      filename: 'd.txt',
      contentType: 'text/plain',
    });
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc2',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(400);
  });

  it('rejects bad category → 400', async () => {
    const form = new FormData();
    form.append('category', 'arbitrary-category');
    form.append('message', 'msg');
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc3',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(400);
  });

  it('rejects unauthenticated → 401', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'msg');
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc4',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(401);
  });

  it('truncated multipart body (busboy "Unexpected end of form") → 400, not 500 (Phase 6 item 3)', async () => {
    // A dropped connection / malformed client body makes busboy throw an error
    // WITHOUT a statusCode mid-parts-loop; pre-fix that bubbled into the 500
    // handler. Chop the closing boundary off a valid form to reproduce.
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'truncated mid-flight');
    form.append('diagnostic', Buffer.from(JSON.stringify({ os: 'Android 14' })), {
      filename: 'diag.json',
      contentType: 'application/json',
    });
    const whole = form.getBuffer();
    const truncated = whole.subarray(0, whole.length - 30);
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok2()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc8',
        ...form.getHeaders(),
      },
      payload: truncated,
    });
    expect(r.statusCode).toBe(400);
    expect(r.headers['content-type']).toContain('application/problem+json');
    expect(r.json().title).toBe('malformed multipart');
  });

  it('lone-surrogate diagnostic → sanitized to U+FFFD, diagnostic SURVIVES the first insert → 201 (Phase 6 + review fix V13)', async () => {
    // A lone UTF-16 surrogate survives JSON.parse and the NUL strip (it is not
    // a NUL); pre-V13 Postgres rejected the jsonb text (`\ud800` escape) with a
    // 22xxx content error on the FIRST insert and the retry ladder "recovered"
    // by DROPPING the entire inline diagnostic. The sanitizer now replaces
    // lone surrogates with U+FFFD at strip time, so the first insert succeeds
    // with the diagnostic intact. The raw JSON text carries the 6-char escape
    // sequence, exactly as a device would ship it.
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'poison diagnostic');
    form.append('diagnostic', Buffer.from('{"poison":"\\ud800"}'), {
      filename: 'diag.json',
      contentType: 'application/json',
    });
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok2()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc9',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.feedback)
      .where(eq(schema.feedback.id, r.json().id as string));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message).toBe('poison diagnostic');
    const diag = rows[0]!.diagnostic as Record<string, unknown>;
    // The diagnostic was NOT dropped — the poison char was neutralized in place.
    expect(diag._inline_dropped).toBeUndefined();
    expect(diag.poison).toBe('�');
  });
});

describe('isPgContentError (Phase 6 item 3)', () => {
  it('classifies 22xxx/23xxx as content errors, infra codes and code-less errors as not', () => {
    expect(isPgContentError({ code: '22P05' })).toBe(true); // unsupported unicode escape
    expect(isPgContentError({ code: '23505' })).toBe(true); // unique violation
    // drizzle wraps the pg error — the SQLSTATE may live on .cause
    expect(isPgContentError({ cause: { code: '22021' } })).toBe(true);
    expect(isPgContentError({ code: '57P01' })).toBe(false); // admin shutdown = infra
    expect(isPgContentError(new Error('no code'))).toBe(false);
    expect(isPgContentError(null)).toBe(false);
    expect(isPgContentError('22P05')).toBe(false); // bare string is not an error object
  });
});
