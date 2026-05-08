// Per-test seed/cleanup helpers for the e2e suite.
//
//   - truncateTestTables() — clears every per-test table in the right order
//     (FK-respecting). Called in `beforeEach` of every e2e test. The `tasks`
//     table is INTENTIONALLY preserved; setup.ts seeds it once per worker.
//
//   - signInTestUser() — bypasses /auth/google + nonce + Play Integrity
//     verification by directly creating a users + profiles row and signing a
//     JWT with the same shape mintJwt() produces. Use this when the test is
//     NOT exercising the auth flow itself (it short-circuits the entire
//     /auth/google handler chain). Tests that ARE exercising the auth flow
//     should mint a real nonce + call /auth/google with mocked verdicts via
//     the helpers/mock-play-integrity.ts module.
import { ulid } from 'ulid';
import jwt from 'jsonwebtoken';
import { db, schema } from '../../../src/db/index.js';

export async function truncateTestTables(): Promise<void> {
  // Order matters — child tables before parents. recordings_to_verify FKs
  // recordings; recordings/consentLog/profiles FK users; idempotency_keys FKs
  // users; events/feedback FK users.
  await db.delete(schema.recordingsToVerify);
  await db.delete(schema.recordings);
  await db.delete(schema.consentLog);
  await db.delete(schema.events);
  await db.delete(schema.feedback);
  await db.delete(schema.idempotencyKeys);
  await db.delete(schema.authNonces);
  await db.delete(schema.profiles);
  await db.delete(schema.users);
  await db.delete(schema.taskRequests);
}

export interface SignInResult {
  userId: string;
  token: string;
}

export async function signInTestUser(
  opts: { flavor?: 'apkRollout' | 'playStore'; applicationId?: string } = {},
): Promise<SignInResult> {
  const flavor = opts.flavor ?? 'playStore';
  const applicationId =
    opts.applicationId ??
    (flavor === 'apkRollout' ? 'ai.humynlabs.capture.apk' : 'ai.humynlabs.capture');
  const userId = ulid();
  await db.insert(schema.users).values({
    id: userId,
    googleSub: `g-${userId.slice(-8)}`,
    email: `${userId.slice(-8)}@e2e.test`,
    name: 'E2E Test',
    consentVersion: '1.0.0',
    consentAcceptedAt: new Date(),
    flavor,
    applicationId,
  });
  await db.insert(schema.profiles).values({ userId });
  const secret = process.env.JWT_SIGNING_SECRET;
  if (!secret) throw new Error('JWT_SIGNING_SECRET not set');
  const token = jwt.sign(
    {
      sub: userId,
      flavor,
      applicationId,
      // The apkRollout test users default to 'bypassed_apk' to mirror the
      // common dev path; playStore defaults to 'passed'. mintJwt() in
      // production sets one or the other based on evaluateIntegrity()'s verdict.
      integrity_verdict: flavor === 'apkRollout' ? 'bypassed_apk' : 'passed',
      token_version: 1,
    },
    secret,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
  return { userId, token };
}
