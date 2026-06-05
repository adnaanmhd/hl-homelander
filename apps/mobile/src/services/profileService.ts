// Profile service — wraps the Phase 1 /me + /contributions endpoints for the
// Phase 2 ProfileScreen (PROF-01..05).
//
// Endpoint surface:
//   - GET  /me                — current user record (PROF-01 read).
//   - PATCH /me {name?,age?,gender?}  — partial update (D-PROF-01 inline-edit).
//   - GET  /contributions     — lifetime aggregate (PROF-03 numeric).
//
// Idempotency (Phase 1 API-15): every PATCH mints a fresh idempotency key
// header per call. The plan body suggested `ulid()`; the mobile dep tree ships
// `react-native-uuid` (UUIDv4) which Phase 1 plan 04's idempotency hook stores
// raw (the key shape is opaque to the backend) — so a UUIDv4 satisfies the
// uniqueness contract without bringing a second key-generation library.
//
// Wire-shape adapter (server-side returns durationMs, the HOME-06 formatter
// consumes seconds): `fetchLifetimeContribution` exposes `totalSeconds` to its
// caller and converts on the wire boundary so PROF-03's call site reads the
// same numeric units that Phase 6 Home tiles will.

import uuid from 'react-native-uuid';
import { apiClient } from './api';
import { secureMmkv } from '../state/mmkv';
import { KEYS, practiceDoneKey } from '../state/keys';
import { decodeGoogleSubFromJwt } from '../lib/jwtSub';

/** Server-side /me response shape — see shared/types/src/me.ts MeResponseSchema. */
export interface MeResponse {
  id: string;
  email: string;
  name: string;
  age: number | null;
  gender: string | null;
  avatarUrl: string | null;
  consentVersion: string;
  flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
  applicationId: string;
  deletedAt: string | null;
  deleteGraceUntil: string | null;
  createdAt: string;
  // Bug 5 / D7 — practice-tutorial completion timestamp (or null). Seeds the
  // local ONB-08 flag so the tutorial is skipped on a fresh install / new device.
  practiceCompletedAt: string | null;
}

/** PATCH /me body — only the editable subset per UserPatchSchema. */
export interface PatchMeUpdates {
  name?: string;
  age?: number | null;
  gender?: string | null;
}

/**
 * Lifetime contribution aggregates (PROF-03). The wire shape from the server
 * is `{ durationMs, recordingCount, taskCount, perTask }` — this service
 * converts `durationMs → totalSeconds` (floor) so callers feed the HOME-06
 * `formatDuration(seconds)` formatter directly.
 */
export interface ContributionAggregates {
  totalSeconds: number;
  taskCount: number;
}

interface ServerContributionsLifetime {
  durationMs: number;
  recordingCount: number;
  taskCount: number;
  perTask: Array<{
    taskId: string;
    taskName: string;
    recordingCount: number;
    durationMs: number;
  }>;
}

/** GET /me — read the current user record. */
export async function fetchMe(): Promise<MeResponse> {
  const me = await apiClient.get<MeResponse>('/me');
  // Bug 5 / D7 — seed the local ONB-08 practice-done flag from the server so
  // computeInitialRoute skips the tutorial on a fresh install / new device once
  // the account has completed practice. Best-effort; a seed failure must never
  // break the /me read.
  try {
    if (me.practiceCompletedAt) {
      const sub = decodeGoogleSubFromJwt(secureMmkv.getString(KEYS.AUTH_JWT) ?? null);
      secureMmkv.set(practiceDoneKey(sub), true);
    }
  } catch {
    /* best-effort seed */
  }
  return me;
}

/**
 * POST /me/practice-complete — Bug 5 / D7. Idempotent server-side (set-if-NULL):
 * persists practice-tutorial completion so the tutorial is skipped on all future
 * devices/reinstalls. Called by PracticeCompleteScreen alongside the local
 * ONB-08 MMKV flag. The route opts out of idempotency-key enforcement, so no
 * Idempotency-Key header is needed.
 */
export async function postPracticeComplete(): Promise<{ practiceCompletedAt: string }> {
  return apiClient.post<{ practiceCompletedAt: string }>('/me/practice-complete', {});
}

/**
 * PATCH /me — partial update of name + age + gender. Mints a fresh
 * Idempotency-Key per call (Phase 1 API-15) so client-side retries
 * deduplicate at the backend.
 */
export async function patchMe(updates: PatchMeUpdates): Promise<MeResponse> {
  const idempotencyKey = uuid.v4() as string;
  return apiClient.patch<MeResponse>('/me', updates, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

/**
 * GET /contributions — lifetime aggregate. The PROF-03 lifetime numeric
 * needs `{ totalSeconds, taskCount }`; the server returns `durationMs`, so
 * this wrapper performs the ms → s conversion at the boundary. The plan
 * body's `?range=all` query parameter is forwarded as a forward-compatibility
 * marker — the current backend ignores it and always returns lifetime.
 */
export async function fetchLifetimeContribution(): Promise<ContributionAggregates> {
  const r = await apiClient.get<ServerContributionsLifetime>('/contributions', {
    query: { range: 'all' },
  });
  return {
    totalSeconds: Math.floor((r.durationMs ?? 0) / 1000),
    taskCount: r.taskCount ?? 0,
  };
}

/**
 * DELETE /me?confirm=DELETE — AUTH-09 soft-delete (30-day grace) + AUTH-10
 * defense-in-depth typing gate.
 *
 * Backend Phase 1 plan 01-08 sets `users.deletedAt = now()` and
 * `deleteGraceUntil = now() + 30 days`; the user can re-sign-in within that
 * window to restore. After 30 days a server-side cron permanently deletes
 * the record. The query-param gate (?confirm=DELETE) is enforced by
 * `MeDeleteQuerySchema` server-side; the client-side DELETE-typing gate in
 * DeleteAccountModal is UX defense-in-depth (T-2.19-01 mitigation).
 *
 * Idempotency-Key (Phase 1 API-15) — every call mints a fresh UUIDv4 so a
 * client-side retry de-dupes at the backend's idempotency store. Per the
 * 02-17 / 02-18 deviation, the mobile bundle uses `react-native-uuid` (NOT
 * `ulid`) for this; UUIDv4 satisfies the opaque-key contract identically.
 *
 * The Phase 1 backend also enforces a 5-call/min rate-limit per applicationId
 * keyed by `delete-me:${applicationId}` (T-2.19-02 mitigation). The client
 * does NOT need to throttle here — the backend will return 429 if exceeded.
 */
export async function deleteMe(): Promise<void> {
  const idempotencyKey = uuid.v4() as string;
  await apiClient.delete<void>('/me', {
    query: { confirm: 'DELETE' },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
