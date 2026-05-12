// GET /recordings/verified-ids (VERIFY-06) — returns the authenticated user's
// verified recording ids, ordered verified_at DESC, cursor-paginated. No
// external services needed (DB-only) — runs unconditionally.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../../src/db/index.js';
import { recordingKeys } from '../../../src/lib/s3-client.js';
import { buildApp } from '../../../src/app.js';

const USER_A = '01HVTVERIDSUSERA000000000A';
const USER_B = '01HVTVERIDSUSERB000000000B';
const TASK_ID = '01HVTVERIDSTASK0000000000T';

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
  qaStatus: 'verified' | 'uploaded',
  verifiedAt: Date | null,
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
    ...(verifiedAt ? { verifiedAt } : {}),
  });
  return id;
}

let app: FastifyInstance;

async function cleanup(): Promise<void> {
  for (const id of [USER_A, USER_B]) {
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
        email: `${id.slice(-8)}@vids.test`,
        name: 'Vids',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      })
      .onConflictDoNothing();
  }
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'vids-test', 'Vids Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
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

describe('GET /recordings/verified-ids', () => {
  it('returns only the caller’s verified ids, ordered verified_at DESC', async () => {
    const now = Date.now();
    // A's three verified rows at distinct times (oldest → newest).
    const aOld = await mkRecording(USER_A, 'verified', new Date(now - 3000));
    const aMid = await mkRecording(USER_A, 'verified', new Date(now - 2000));
    const aNew = await mkRecording(USER_A, 'verified', new Date(now - 1000));
    // A non-verified row for A (must be excluded).
    await mkRecording(USER_A, 'uploaded', null);
    // A verified row for B (must be excluded — different user).
    await mkRecording(USER_B, 'verified', new Date(now - 500));

    const res = await app.inject({
      method: 'GET',
      url: '/recordings/verified-ids',
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ids).toEqual([aNew, aMid, aOld]);
    expect(body.next_cursor).toBeNull();
  });

  it('?since=<cursor> returns only the rows after the cursor', async () => {
    // Re-derive A's ids by querying (the previous test seeded them).
    const rows = await db
      .select({ id: schema.recordings.id })
      .from(schema.recordings)
      .where(eq(schema.recordings.userId, USER_A))
      .orderBy(
        sql`${schema.recordings.verifiedAt} DESC NULLS LAST`,
        sql`${schema.recordings.id} DESC`,
      );
    const verifiedIds = rows.map((r) => r.id);
    // verifiedIds[0] is the newest verified id; using it as the cursor should
    // return only the ones strictly after it.
    const cursor = verifiedIds[0]!;
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/verified-ids?since=${cursor}`,
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ids).not.toContain(cursor);
    // All returned ids should be from A's verified set (excludes the uploaded one).
    expect(body.ids.length).toBe(2);
  });

  it('next_cursor is set when there are more rows than the page limit — small set → null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/recordings/verified-ids',
      headers: { authorization: `Bearer ${tok(USER_B)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ids).toHaveLength(1);
    expect(body.next_cursor).toBeNull();
  });

  it('?since=<another user’s recording id> behaves identically to ?since=<unknown id> (IN-05)', async () => {
    // USER_B has exactly one verified recording (seeded in the first test).
    const [bRow] = await db
      .select({ id: schema.recordings.id })
      .from(schema.recordings)
      .where(eq(schema.recordings.userId, USER_B))
      .limit(1);
    const otherUsersId = bRow!.id;
    const unknownId = '01HUNKNOWN0000000000000NOX'; // 26 chars, no such row

    // Baseline: USER_A's full list, no cursor.
    const noCursor = await app.inject({
      method: 'GET',
      url: '/recordings/verified-ids',
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(noCursor.statusCode).toBe(200);
    const baseline = noCursor.json();

    // ?since=<USER_B's id> — the cursor SELECT is user-gated, so it resolves
    // nothing; no (verified_at, id) < (...) predicate is added → same result.
    const sinceOther = await app.inject({
      method: 'GET',
      url: `/recordings/verified-ids?since=${otherUsersId}`,
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(sinceOther.statusCode).toBe(200);
    expect(sinceOther.json()).toEqual(baseline);

    // ?since=<unknown id> — same: resolves nothing → same result.
    const sinceUnknown = await app.inject({
      method: 'GET',
      url: `/recordings/verified-ids?since=${unknownId}`,
      headers: { authorization: `Bearer ${tok(USER_A)}` },
    });
    expect(sinceUnknown.statusCode).toBe(200);
    expect(sinceUnknown.json()).toEqual(baseline);
  });

  it('unauthenticated → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/recordings/verified-ids' });
    expect(res.statusCode).toBe(401);
  });
});
