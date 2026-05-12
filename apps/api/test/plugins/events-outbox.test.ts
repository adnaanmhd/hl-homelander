// events-outbox onSend hook (VERIFY-05) — drains recording_events_outbox for
// the authenticated user onto every authenticated JSON object response under a
// `_events` key, marks the rows delivered, and leaves unauthenticated /
// non-object responses untouched. Pattern 22: the strict-schema route
// (`GET /recordings`) still serializes with the optional `_events` key present.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { recordingKeys } from '../../src/lib/s3-client.js';
import { buildApp } from '../../src/app.js';

const USER_A = '01HVTEVTOUTBOXUSERA000000A';
const USER_B = '01HVTEVTOUTBOXUSERB000000B';
const TASK_ID = '01HVTEVTOUTBOXTASK000000TK';

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
  qaStatus: 'verified' | 'uploaded' = 'uploaded',
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
    ...(qaStatus === 'verified' ? { verifiedAt: new Date() } : {}),
  });
  return id;
}

let app: FastifyInstance;

async function cleanup(): Promise<void> {
  for (const id of [USER_A, USER_B]) {
    await db
      .delete(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.userId, id));
    await db.delete(schema.recordings).where(eq(schema.recordings.userId, id));
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
        email: `${id.slice(-8)}@evt.test`,
        name: 'Evt',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      })
      .onConflictDoNothing();
  }
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'evt-outbox-test', 'Evt Outbox Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.users).where(eq(schema.users.id, USER_A));
  await db.delete(schema.users).where(eq(schema.users.id, USER_B));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TASK_ID));
  await app.close();
});

describe('events-outbox onSend hook', () => {
  it('drains undelivered rows onto an authenticated response and marks them delivered', async () => {
    const recVerified = await mkRecording(USER_A, 'verified');
    const recReupload = await mkRecording(USER_A, 'uploaded');
    await db.insert(schema.recordingEventsOutbox).values([
      { id: ulid(), userId: USER_A, recordingId: recVerified, eventType: 'verified' },
      { id: ulid(), userId: USER_A, recordingId: recReupload, eventType: 're-upload' },
    ]);

    const r1 = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(r1.statusCode).toBe(200);
    const body1 = r1.json();
    expect(Array.isArray(body1._events)).toBe(true);
    expect(body1._events).toEqual(
      expect.arrayContaining([
        { recording_id: recVerified, event_type: 'verified' },
        { recording_id: recReupload, event_type: 're-upload' },
      ]),
    );
    expect(body1._events).toHaveLength(2);

    // Rows are now delivered_at IS NOT NULL.
    const undelivered = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(
        and(
          eq(schema.recordingEventsOutbox.userId, USER_A),
          isNull(schema.recordingEventsOutbox.deliveredAt),
        ),
      );
    expect(undelivered).toHaveLength(0);

    // A second authenticated request → no _events (already delivered).
    const r2 = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()._events).toBeUndefined();
  });

  it('never leaks another user’s events', async () => {
    const recForB = await mkRecording(USER_B, 'verified');
    await db.insert(schema.recordingEventsOutbox).values({
      id: ulid(),
      userId: USER_B,
      recordingId: recForB,
      eventType: 'verified',
    });
    const rA = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(rA.statusCode).toBe(200);
    // USER_A has no undelivered rows → no _events; certainly not USER_B's row.
    expect(rA.json()._events).toBeUndefined();
    // USER_B drains its own.
    const rB = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok(USER_B)}` },
    });
    expect(rB.json()._events).toEqual([{ recording_id: recForB, event_type: 'verified' }]);
  });

  it('leaves unauthenticated responses untouched', async () => {
    // Seed a row for USER_A so the hook *would* fire if it ran.
    const rec = await mkRecording(USER_A, 'verified');
    await db.insert(schema.recordingEventsOutbox).values({
      id: ulid(),
      userId: USER_A,
      recordingId: rec,
      eventType: 'verified',
    });
    const r = await app.inject({ method: 'GET', url: '/healthz' });
    expect(r.statusCode).toBe(200);
    expect(r.json()._events).toBeUndefined();
    // The seeded row is still undelivered (the hook didn't touch it).
    const undelivered = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(
        and(
          eq(schema.recordingEventsOutbox.userId, USER_A),
          isNull(schema.recordingEventsOutbox.deliveredAt),
        ),
      );
    expect(undelivered.length).toBeGreaterThanOrEqual(1);
  });

  it('the strict-schema route (GET /recordings) still serializes with the optional _events key', async () => {
    // USER_A has at least one undelivered row from the previous test → the hook
    // will add _events to the strict RecordingsListResponseSchema response.
    const r = await app.inject({
      method: 'GET',
      url: '/recordings',
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect('next_cursor' in body).toBe(true);
    // The _events key is present (carried by the strict schema, not stripped).
    expect(Array.isArray(body._events)).toBe(true);
  });
});
