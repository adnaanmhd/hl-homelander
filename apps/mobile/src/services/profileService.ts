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
  return apiClient.get<MeResponse>('/me');
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
