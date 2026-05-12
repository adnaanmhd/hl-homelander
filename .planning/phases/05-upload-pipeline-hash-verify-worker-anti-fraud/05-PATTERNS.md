# Phase 5: Upload Pipeline & Hash-Verify Worker - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** ~26 new/modified files
**Analogs found:** 22 with a strong analog / 4 with no close analog (greenfield — use RESEARCH.md sketches)

> Source of the file list: `05-CONTEXT.md` (D-03..D-10 + Discretion) and `05-RESEARCH.md` § "Recommended Project Structure". Anti-fraud files are descoped (D-04) — no `rate-cap`/`fraud-dashboard` files exist in this phase.

---

## File Classification

### Backend (`apps/api/`)

| New/Modified File                                                                                                                | Role                                  | Data Flow                            | Closest Analog                                                                                                   | Match Quality                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/workers/hash-verify.ts`                                                                                                     | worker (BullMQ entrypoint)            | event-driven (queue consumer)        | `src/cron/dsr-hard-delete.ts` (timer-driven background loop) + `src/server.ts` (process entrypoint)              | partial — no existing BullMQ worker; role-match is the cron loop |
| `src/lib/queue.ts`                                                                                                               | utility (Redis/queue singleton)       | —                                    | `src/lib/s3-client.ts` (lazy memoized client singleton)                                                          | role-match (lazy-singleton pattern)                              |
| `src/lib/sha256-stream.ts`                                                                                                       | utility (S3 streaming hash)           | streaming / file-I/O (read-only)     | `src/lib/feedback-uploader.ts` (S3 helper) + `src/lib/s3-client.ts` (`recordingKeys`, `RECORDINGS_BUCKET`)       | role-match                                                       |
| `src/lib/verify-recording.ts`                                                                                                    | service (verify one recording)        | CRUD + transform                     | `src/routes/recordings/finalize.ts` (the `db.transaction` that flips `qa_status` + inserts `recordingsToVerify`) | role-match (same transaction shape, no HTTP)                     |
| `src/lib/recording-events.ts`                                                                                                    | utility (outbox append/drain)         | CRUD                                 | `src/lib/idempotency-store.ts` (`lookup`/`persist` helpers over a table)                                         | role-match                                                       |
| `src/plugins/events-outbox.ts`                                                                                                   | plugin (Fastify `onSend` hook)        | request-response (envelope mutation) | `src/plugins/idempotency.ts` (`onSend` hook, `fp(...)` wrapper, `dependencies: ['auth']`)                        | **exact**                                                        |
| `src/routes/recordings/verified-ids.ts`                                                                                          | route (GET, reconciliation sweep)     | request-response (paginated read)    | `src/routes/recordings/list.ts` (cursor pagination on `(created_at DESC, id DESC)`)                              | **exact**                                                        |
| `src/routes/recordings/reupload.ts` (NEW or extend `init.ts`)                                                                    | route (POST, re-issue presigned URLs) | request-response                     | `src/routes/recordings/init.ts` (presigned-URL minting + `qa_status` guard)                                      | **exact**                                                        |
| `src/db/schema.ts` — add `recordingEventsOutbox` table + `recordingEventType` enum                                               | model (table def)                     | —                                    | `recordingsToVerify` table + `events` table + `qaStatusEnum` (existing in `schema.ts`)                           | **exact**                                                        |
| `src/db/migrations/00XX_recording_events_outbox.sql`                                                                             | migration                             | —                                    | existing `migrations/000X_*.sql` (e.g. the migration that added `recordings_to_verify`)                          | role-match                                                       |
| `src/cron/verify-sweep.ts` (NEW — re-queue stale `recordings_to_verify`)                                                         | cron (re-enqueue stale rows)          | batch                                | `src/cron/dsr-hard-delete.ts`                                                                                    | **exact**                                                        |
| `src/app.ts` — register `events-outbox` plugin + `verified-ids`/`reupload` routes + start `verify-sweep` cron                    | config (composition root)             | —                                    | `src/app.ts` itself (existing registration order)                                                                | **exact**                                                        |
| `apps/api/.env.example` / root `.env.example` — add `REDIS_URL`, SQS queue URL                                                   | config                                | —                                    | existing `.env.example` (the `AWS_*` / `RECORDINGS_BUCKET` block)                                                | **exact**                                                        |
| `docker-compose.yml` — add `redis:7-alpine` service                                                                              | config (dev infra)                    | —                                    | `docker-compose.yml` itself (the `postgres` / `localstack` service blocks)                                       | **exact**                                                        |
| `infra/terraform/` — ElastiCache Redis + EventBridge rule + SQS queue + 2nd ECS task def                                         | config (infra)                        | —                                    | existing `infra/terraform/` modules                                                                              | role-match (not read this pass — point planner at the dir)       |
| `infra/localstack/init/*.sh` — create the dev SQS queue (if doing the LocalStack EventBridge path)                               | config (dev infra)                    | —                                    | existing `infra/localstack/init/` bucket-create scripts                                                          | role-match                                                       |
| `shared/types/src/recording.ts` — extend with re-upload request/response + `_events` envelope; new `verified-ids` query/response | model (zod contracts)                 | —                                    | `RecordingsInitRequestSchema` / `RecordingFinalizeSchema` family in the same file                                | **exact**                                                        |
| `shared/types/src/events.ts` (or `recording.ts`) — `RecordingServerEventSchema` (`{recording_id, event_type}`)                   | model (zod contract)                  | —                                    | `EventCreateSchema` in `shared/types/src/events.ts`                                                              | role-match                                                       |

### Mobile — Android native (`apps/mobile/android/.../capture/upload/`)

| New/Modified File                                                                                                                        | Role                                                                             | Data Flow                       | Closest Analog                                                                                                                                                                                                                         | Match Quality                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `upload/HumynUploadModule.kt`                                                                                                            | native module (RN bridge: enqueue/pause/resume/getQueue + queue-state events)    | event-driven + request-response | `battery/HumynBatteryModule.kt` (the canonical 3-file triad: `start`/`stop`, `@ReactMethod`, `RCTDeviceEventEmitter.emit`, `invalidate()` teardown) + `updater/HumynUpdaterModule.kt` (background-executor + Promise + SHA-256 + HTTP) | role-match (compose the two)                                                                |
| `upload/HumynUploadPackage.kt`                                                                                                           | native package registration                                                      | —                               | `battery/HumynBatteryPackage.kt` (verbatim shape — `createNativeModules` returns `listOf(...)`, `createViewManagers` returns `emptyList()`)                                                                                            | **exact**                                                                                   |
| `upload/UploadQueueStore.kt`                                                                                                             | utility (MMKV-backed queue rows + per-file part state)                           | file-I/O / persistence          | (no Kotlin MMKV usage today) + the JS analog `apps/mobile/src/services/telemetryRing.ts` (read/write a JSON blob, FIFO trim)                                                                                                           | partial — JS analog is the model; Kotlin side is greenfield                                 |
| `upload/ChunkUploader.kt`                                                                                                                | utility (OkHttp PUT per part, ETag capture, retry/backoff, no-progress watchdog) | streaming / file-I/O            | `updater/HumynUpdaterModule.kt#downloadAndVerifyApk` (streaming `HttpURLConnection` over 64 KB buffers, background executor, hash-as-you-go) — but use OkHttp `RequestBody` per RESEARCH § "streaming chunk PUT"                       | partial — analog is HTTP-stream-over-file; transport differs (OkHttp not HttpURLConnection) |
| `upload/UploadCoordinator.kt`                                                                                                            | service (drains the queue, 3∥×2∥ semaphore, `/init`→PUT→`/finalize`)             | event-driven / batch            | `capture/CaptureSession.kt` (long-lived coordinator owning threads/executors — not read this pass) + `updater/HumynUpdaterModule.kt`'s single-thread executor pattern                                                                  | partial                                                                                     |
| `upload/UploadJobService.kt`                                                                                                             | service (UIDT `JobService` for true-background past the 6 h `dataSync` cap)      | event-driven                    | (no `JobService` today) — RESEARCH § "UIDT JobService skeleton" is the template                                                                                                                                                        | none — greenfield                                                                           |
| `upload/BatteryOptimizationHelper.kt`                                                                                                    | utility (AOSP exemption request + best-effort OEM deep-links)                    | —                               | `updater/HumynUpdaterModule.kt#launchInstaller` (the `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` deep-link + `addFlags(FLAG_ACTIVITY_NEW_TASK)` + try/catch pattern)                                                                  | role-match                                                                                  |
| `fgs/HumynForegroundService.kt` — EXTEND (`onTimeout`, `startForeground`-with-`DATA_SYNC`-only path, wire `ACTION_SET_UPLOAD_ACTIVE`)    | service (existing)                                                               | event-driven                    | `fgs/HumynForegroundService.kt` itself (the existing `startForeground` + `ACTION_SET_UPLOAD_ACTIVE` seam)                                                                                                                              | **exact**                                                                                   |
| `MainApplication.kt` — register `HumynUploadPackage()`                                                                                   | config (composition root)                                                        | —                               | `MainApplication.kt#getPackages` (the `packages.add(HumynBatteryPackage())` line family)                                                                                                                                               | **exact**                                                                                   |
| `AndroidManifest.xml` — add `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` + `RUN_USER_INITIATED_JOBS` perms; `<service>` for `UploadJobService` | config (manifest)                                                                | —                               | existing manifest `<uses-permission>` / `<service android:foregroundServiceType=...>` block                                                                                                                                            | role-match                                                                                  |

### Mobile — RN/JS (`apps/mobile/src/`)

| New/Modified File                                                                                        | Role                                            | Data Flow                             | Closest Analog                                                                                                                                                                                                                                                                                                            | Match Quality                                                             |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `native/HumynUpload.ts`                                                                                  | native bridge typings + event subscriptions     | —                                     | `native/HumynBattery.ts` (`ensure()` guard, canonical "not registered" error, lazy `NativeEventEmitter`, `on*(listener): EmitterSubscription`)                                                                                                                                                                            | **exact**                                                                 |
| `screens/uploads/PendingUploadsScreen.tsx`                                                               | screen/component                                | request-response (renders queue rows) | History row layout from `design-spec.md §16` (64×64 thumb / name 15·600 / meta 12px / status chip) — no live History screen exists (it's a Phase-6 placeholder), so the design-spec is the analog; `HomeSkeletonScreen.tsx` / `HistoryPlaceholderScreen.tsx` for the `ScreenContainer`/`TopBar`/`useTabTopBarProps` shell | partial — design-spec is the layout source; screen shell pattern is exact |
| `screens/onboarding/BatteryOptimizationScreen.tsx` (or a modal)                                          | screen/component                                | —                                     | `screens/force-upgrade/ForceUpgradeScreen.tsx` (a procedural, native-module-driven onboarding-style screen) + `screens/permissions/PermissionsScreen.tsx`                                                                                                                                                                 | role-match                                                                |
| `services/uploadReconcile.ts`                                                                            | service (VERIFY-06 cold-start/foreground sweep) | request-response + file-I/O           | `hooks/useForegroundUserRehydrate.ts` (mount + AppState→`active` re-fire, swallowed errors, MMKV-guarded) + `boot/bootRecoveryListener.ts` (one-shot boot wiring, try/catch around native calls)                                                                                                                          | role-match                                                                |
| `boot/bootRecoveryListener.ts` — EDIT (Wave 1: `RECOVERY_TOAST_MS` 15_000 → 5_000 + annotation per D-07) | boot/glue (existing)                            | —                                     | `boot/bootRecoveryListener.ts` itself                                                                                                                                                                                                                                                                                     | **exact** (one-line constant + comment)                                   |
| `state/keys.ts` — add the `uploads` MMKV key(s)                                                          | config                                          | —                                     | `state/keys.ts` itself (`KEYS.TELEMETRY_RING` etc.)                                                                                                                                                                                                                                                                       | **exact**                                                                 |
| App boot (`App.tsx`) — install `uploadReconcile` sweep                                                   | config (composition root)                       | —                                     | `App.tsx`'s existing `installBootRecoveryListener()` call site                                                                                                                                                                                                                                                            | **exact**                                                                 |

### Wave 1 — cosmetic / cleanup pass (D-03..D-09)

| New/Modified File                                                                                                                                                                                                                             | Role                      | Data Flow    | Closest Analog                                                                                                                                                                                                                               | Match Quality               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `capture/CaptureLaunchSweep.kt` — D-03: discard ALL crash-truncated fragments (delete the re-finalize path, or downgrade it so the post-30 s fragment is deleted not re-finalized)                                                            | utility (existing)        | file-I/O     | `capture/CaptureLaunchSweep.kt` itself (the `tryReFinalize`/`mp4LooksPlayable` block being removed/neutered; the `mp4.delete(); csv.delete(); sidecarFile.delete()` cleanup it already does for unrecoverable stubs is the target end-state) | **exact**                   |
| `screens/recording/RecordingScreen.tsx` (+ `useRecordingLifecycle.ts` / `recState.ts`) — D-05: device-distress mid-record stop navigates to Home, not RecordingScreen-`'ready'`                                                               | screen/state (existing)   | event-driven | `screens/recording/RecordingScreen.tsx` + `useRecordingLifecycle.ts` (the existing post-stop nav reset)                                                                                                                                      | **exact**                   |
| `boot/bootRecoveryListener.ts` — D-07 (same row as above) + reconcile with D-03 (the recovery toast may be dead code once nothing upload-able is recovered)                                                                                   | boot/glue (existing)      | —            | itself                                                                                                                                                                                                                                       | **exact**                   |
| Docs only — `04-MANUAL-SMOKE.md` §2/§3 step text refresh; `design-spec.md §6` / `04-UI-SPEC.md § Copywriting` owner-deviation reflections; eyeball `RotatePrompt.tsx` glyph; re-check `HumynBeep.playTone` tones on hardware (D-06/D-08/D-09) | docs / smoke verification | —            | the existing `.planning/runbooks/` + `*-COSMETIC-GAPS.md` conventions                                                                                                                                                                        | n/a (no code analog needed) |

---

## Pattern Assignments

### `apps/api/src/plugins/events-outbox.ts` (plugin, request-response)

**Analog:** `apps/api/src/plugins/idempotency.ts` — **exact match**. This API already has an `onSend` hook that mutates/inspects the serialized payload; copy its structure 1:1.

**`fp(...)` wrapper + auth dependency** (`idempotency.ts` line 104):

```ts
export default fp(idempotencyPlugin, { name: 'idempotency', dependencies: ['auth'] });
```

→ for the new plugin: `export default fp(eventsOutboxPlugin, { name: 'events-outbox', dependencies: ['auth'] });`

**`onSend` hook that reads `reply.statusCode` and parses/re-serializes the payload** (`idempotency.ts` lines 82-101):

```ts
app.addHook('onSend', async (req, reply, payload) => {
  if (!req.idempotency) return payload;
  if (reply.statusCode >= 500) return payload; // don't memoize server errors
  let bodyForStorage: unknown;
  try {
    bodyForStorage = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    bodyForStorage = payload;
  }
  await persist({ ... });
  return payload;
});
```

→ the new hook: read `req.user?.sub` (best-effort — see below), skip if no `sub` or non-object payload, drain the outbox for that user, set `body._events = [...]`, mark rows `deliveredAt`, `return JSON.stringify(body)`. Full sketch in `05-RESEARCH.md` § "API: `onSend` hook draining the outbox".

**Best-effort JWT decode in a pre-auth hook** — note `idempotency.ts` runs as a _global preHandler_ before route `requireAuth`, so it does `await req.jwtVerify()` in a try/catch (lines 51-59). The `events-outbox` `onSend` hook runs _after_ the route preHandler, so `req.user` _is_ populated for authenticated routes — but for unauthenticated routes (`/healthz`, `/auth/google`) `req.user` is undefined; just skip those (`if (!sub) return payload`). No `jwtVerify()` needed in the `onSend` hook.

**Pattern 22 caveat (STATE.md):** routes with a strict `response.200` zod schema (`GET /recordings` has `RecordingsListResponseSchema`) will reject the extra `_events` key. Either add `_events: z.array(RecordingServerEventSchema).optional()` to `RecordingsListResponseSchema` (and `/me`'s schema) in `shared/types/`, OR have the hook only attach to "carrier" endpoints without strict response schemas (`GET /me`, the new `GET /recordings/verified-ids`). Planner's call — adding to the list schema is simpler if you're touching it anyway.

---

### `apps/api/src/routes/recordings/verified-ids.ts` (route, request-response, paginated read)

**Analog:** `apps/api/src/routes/recordings/list.ts` — **exact match** for the cursor-pagination shape.

**Imports + `withTypeProvider` + cursor-pagination route shape** (`list.ts` lines 1-30):

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { RecordingsListQuerySchema, RecordingsListResponseSchema } from './schemas.js';
// ...
app.withTypeProvider<ZodTypeProvider>().get('/recordings', {
  schema: { querystring: ..., response: { 200: ... } },
  preHandler: [app.requireAuth],
}, async (req) => { ... });
```

**Resolve a cursor recording_id to its `(created_at, id)` tuple, then compare** (`list.ts` lines 53-72) — for `verified-ids` order by `verified_at DESC, id DESC` instead:

```ts
const c = await db.select({ createdAt: ..., id: ... }).from(schema.recordings)
  .where(eq(schema.recordings.id, cursor)).limit(1);
if (c.length > 0) {
  where.push(sql`(${schema.recordings.createdAt}, ${schema.recordings.id}) < (${created.toISOString()}::timestamptz, ${cursor})`);
}
```

**`limit + 1` hasMore + `next_cursor`** (`list.ts` lines 73-92):

```ts
.limit(limit + 1);
const hasMore = rows.length > limit;
const items = (hasMore ? rows.slice(0, limit) : rows).map(...);
return { items, next_cursor: hasMore ? items[items.length - 1]!.recording_id : null };
```

→ for `verified-ids`: `WHERE user_id = req.user.sub AND qa_status = 'verified'`, select `id` only, order `verified_at DESC, id DESC`, return `{ ids: [...], next_cursor }`. Endpoint can also be a `_events` carrier (no strict response schema if you keep Pattern 22 in mind, or add `_events` to its response schema).

**Per-user rate-limit `keyGenerator`** — if this becomes a write/expensive endpoint, copy the `keyGenerator` from `init.ts` lines 46-55 / `events/post.ts` lines 39-49 (best-effort `req.jwtVerify()` → `user:${sub}` → `ip:${req.ip}`).

---

### `apps/api/src/routes/recordings/reupload.ts` (route, request-response)

**Analog:** `apps/api/src/routes/recordings/init.ts` — **exact**, plus the `qa_status`-guard pattern from `finalize.ts`.

**Presigned-URL minting block to copy** (`init.ts` lines 81-148): `recordingKeys()` → `CreateMultipartUploadCommand` for video + IMU → `getSignedUrl(s3, new UploadPartCommand(...), { expiresIn: PRESIGNED_TTL_SECONDS })` for each part → single `PutObjectCommand` presign for `metadata.json`. The re-upload path differs only in: the `recordings` row already exists, so `UPDATE` the `s3UploadId`/`partsCount` instead of `INSERT`; and guard on `qa_status === 'hash-mismatch'` (Pitfall 9 — a fresh `/init` would 409 because the row is no longer `pending`).

**State-machine guard + problem-detail returns** (`finalize.ts` lines 76-117):

```ts
if (rows.length === 0) {
  /* 404 not-found problem-detail */
}
if (rec.userId !== userId) {
  /* 403 forbidden */
}
if (!canTransition(rec.qaStatus, 'uploaded')) {
  /* 409 conflict */
}
```

→ for re-upload, the allowed source state is `hash-mismatch`. Note `recording-state.ts` currently has `'hash-mismatch': ['takedown']` — **planner must add a transition** `'hash-mismatch' → 'pending'` (or `→ 'uploaded'`) so a re-upload can move the row back into the upload lifecycle. Update `ALLOWED` in `recording-state.ts`.

**Pattern 22:** omit the `response` schema on this route (it returns problem-detail 4xx too) — see the comment in `init.ts` lines 33-36 and `finalize.ts` lines 67-70.

---

### `apps/api/src/lib/verify-recording.ts` (service, CRUD + transform)

**Analog:** `apps/api/src/routes/recordings/finalize.ts` — the `db.transaction` block (lines 153-168) that flips `qa_status` and touches `recordingsToVerify` is the exact shape to mirror, minus the HTTP wrapper.

**Transaction: flip status + outbox write + clear queue row** (model on `finalize.ts` lines 153-168):

```ts
const updated = await db.transaction(async (tx) => {
  await tx
    .update(schema.recordings)
    .set({ qaStatus: 'uploaded', uploadCompletedAt: new Date() })
    .where(eq(schema.recordings.id, rec.id));
  await tx.insert(schema.recordingsToVerify).values({ recordingId: rec.id }).onConflictDoNothing();
  // ...
});
```

→ `verify-recording.ts`: on match → `set({ qaStatus: 'verified', verifiedAt: new Date() })` + `appendOutboxEvent(tx, {userId, recordingId, eventType: 'verified'})`; on mismatch → `set({ qaStatus: 'hash-mismatch' })` + `appendOutboxEvent(tx, ..., 're-upload')`; both → `tx.delete(schema.recordingsToVerify).where(eq(..., recordingId))`. Idempotency guard: `if (rec.qaStatus !== 'uploaded') return;` (already-verified/rejected/takedown is a no-op — a redelivered SQS message must not re-run the flip). Use `canTransition(rec.qaStatus, 'verified')` from `recording-state.ts` as the gate. Full sketch: `05-RESEARCH.md` § "Worker: verify one recording".

**Server reads bytes here — and ONLY here** (CLAUDE.md file-fidelity rule): `verify-recording.ts` calls `sha256OfS3Object(keys.video)` / `(keys.imu)` — read-only `GetObject` streamed into a hash. The Fastify API never reads bytes; the worker is the one carve-out. Keep the boundary explicit in the file header comment.

---

### `apps/api/src/lib/sha256-stream.ts` (utility, streaming file-I/O)

**Analog:** `apps/api/src/lib/feedback-uploader.ts` (S3 helper module shape) + `apps/api/src/lib/s3-client.ts` (the `recordingKeys()` / `RECORDINGS_BUCKET()` / `getS3Client()` exports it consumes).

**Module shape — small helper around `getS3Client()`** (mirror `feedback-uploader.ts` lines 1-43): a header comment stating the byte-fidelity invariant, then `import { getS3Client, RECORDINGS_BUCKET } from './s3-client.js';` and a single exported async fn.

**Streaming hash (never buffer a 4 GB object)** — RESEARCH § "Worker: streaming SHA-256":

```ts
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand } from '@aws-sdk/client-s3';
const out = await getS3Client().send(
  new GetObjectCommand({ Bucket: RECORDINGS_BUCKET(), Key: key }),
);
const hash = createHash('sha256');
await pipeline(out.Body as NodeJS.ReadableStream, hash);
return hash.digest('hex');
```

**`requestChecksumCalculation: 'WHEN_REQUIRED'` already set** in `s3-client.ts` (lines 23-24) — the worker inherits it; don't override (LocalStack compat + S3 checksums aren't a reliable signal here anyway — Pitfall 10).

---

### `apps/api/src/lib/queue.ts` (utility, lazy singleton)

**Analog:** `apps/api/src/lib/s3-client.ts` — the `let _client; export function getS3Client() { if (_client) return _client; ... }` lazy-memoized-singleton pattern (lines 8-28), env-driven config (`process.env.AWS_ENDPOINT_URL` → dev vs prod branch).

**Lazy-singleton pattern to copy** (`s3-client.ts` lines 8-28):

```ts
let _client: S3Client | undefined;
export function getS3Client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.AWS_ENDPOINT_URL; // set in dev; unset in prod
  _client = new S3Client({ region: process.env.AWS_REGION ?? 'ap-south-1', ... });
  return _client;
}
```

→ `queue.ts`: `getRedisConnection()` returns a memoized `ioredis` instance built from `process.env.REDIS_URL ?? 'redis://localhost:6379'`; `getQueue()` returns a memoized BullMQ `Queue('verify', { connection: getRedisConnection() })`. Shared by `/finalize` (dev: `queue.add('verify', { recordingId })`) and `workers/hash-verify.ts`. Also export the bucket-name guard pattern from `s3-client.ts` lines 30-34 (`RECORDINGS_BUCKET = () => { const b = process.env.X; if (!b) throw ...; return b; }`) for `REDIS_URL` if you want it strict.

---

### `apps/api/src/lib/recording-events.ts` (utility, CRUD over a table)

**Analog:** `apps/api/src/lib/idempotency-store.ts` — a small module exporting `lookup`/`persist` table helpers (it's referenced by `idempotency.ts`). Mirror the "thin functions over one table" shape.

**Functions to export:** `appendOutboxEvent(tx, { userId, recordingId, eventType })` — `tx.insert(schema.recordingEventsOutbox).values({ id: ulid(), userId, recordingId, eventType })` (use `ulid()` like `events/post.ts` line 81); `drainOutbox(userId)` — `SELECT ... WHERE user_id = $1 AND delivered_at IS NULL ORDER BY created_at LIMIT 50`; `markDelivered(ids[])` — `UPDATE ... SET delivered_at = now() WHERE id IN (...)`. The `onSend` hook (`events-outbox.ts`) calls `drainOutbox` + `markDelivered`; `verify-recording.ts` calls `appendOutboxEvent` inside its transaction.

---

### `apps/api/src/workers/hash-verify.ts` (worker, event-driven — BullMQ entrypoint)

**Analog:** `apps/api/src/cron/dsr-hard-delete.ts` (role-match: a self-contained background loop with `start*`/`stop*` exports and a try/catch'd tick) + `apps/api/src/server.ts` (process entrypoint conventions). No existing BullMQ worker — RESEARCH § "Worker shape" is the template:

```ts
import { Worker } from 'bullmq';
import { getRedisConnection } from '../lib/queue.js';
import { verifyRecording } from '../lib/verify-recording.js';
const worker = new Worker(
  'verify',
  async (job) => {
    await verifyRecording(job.data.recordingId);
  },
  { connection: getRedisConnection(), concurrency: 4 },
);
worker.on('failed', (job, err) => {
  /* pino log; BullMQ retries per queue config */
});
```

**Logger pattern** — reuse `loggerOptions` / `app.log`-style pino from `plugins/logger.ts`; the cron module's `CronLogger` interface (`dsr-hard-delete.ts`) shows the minimal logger shape if you want to keep the worker decoupled from Fastify.

**Same Docker image, different entrypoint** — `node dist/workers/hash-verify.js` vs `node dist/server.js`. Don't import `buildApp()`; just the DB, S3 client, queue, and `verify-recording.ts`. Two ECS task defs, one image.

---

### `apps/api/src/cron/verify-sweep.ts` (cron, batch)

**Analog:** `apps/api/src/cron/dsr-hard-delete.ts` — **exact**. Copy verbatim:

```ts
let _timer: NodeJS.Timeout | undefined;
export async function findHardDeleteCandidates(): Promise<string[]> { /* the query, exported for tests */ }
export function startDsrCron(logger: CronLogger): void {
  if (_timer) return;
  const tick = async () => { try { ... logger.info(...) } catch (err) { logger.info({ err }, '...') } };
  void tick();                                  // run once at boot
  _timer = setInterval(() => { void tick(); }, ONE_DAY_MS);
  _timer.unref?.();
}
export function stopDsrCron(): void { if (_timer) { clearInterval(_timer); _timer = undefined; } }
```

→ `verify-sweep.ts`: the query selects `recordingsToVerify` rows older than N minutes with `attempts < max`; the tick re-`queue.add('verify', { recordingId })`s each + bumps `attempts`. Interval is minutes, not a day. Wire into `app.ts` next to `startDsrCron` (skip in tests like `dsr-hard-delete` does — `NODE_ENV !== 'test'`).

---

### `apps/api/src/db/schema.ts` — `recordingEventsOutbox` table + `recordingEventType` enum

**Analog:** the `recordingsToVerify` table (lines 320-326) + the `events` table (lines 216-233) + `qaStatusEnum` (lines 44-51), all in this file.

**Enum** (mirror `qaStatusEnum` line 44):

```ts
export const recordingEventTypeEnum = pgEnum('recording_event_type', ['verified', 're-upload']);
```

(or a `varchar(20)` column — RESEARCH's SQL sketch uses varchar; a `pgEnum` is more consistent with the rest of `schema.ts`.)

**Table** (mirror `recordingsToVerify` lines 320-326 + the partial-index pattern):

```ts
export const recordingEventsOutbox = pgTable(
  'recording_events_outbox',
  {
    id: varchar('id', { length: 26 }).primaryKey(), // ULID
    userId: varchar('user_id', { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recordingId: varchar('recording_id', { length: 26 })
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),
    eventType: recordingEventTypeEnum('event_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => ({
    userUndeliveredIdx: index('recording_events_outbox_user_undelivered_idx').on(t.userId), // partial WHERE delivered_at IS NULL → expressed in the migration SQL
  }),
);
```

Drizzle 0.45 partial indexes go in the raw migration SQL (`.where(...)` on the index isn't always emitted) — see how `0001_init.sql` etc. carry the GENERATED-column and partial-index DDL that the schema can't express.

---

### `apps/api/src/db/migrations/00XX_recording_events_outbox.sql` (migration)

**Analog:** the existing numbered migration that added `recordings_to_verify` (and the multipart columns — "migration 0003" per `init.ts` line 189). Match its `CREATE TABLE` + `CREATE INDEX` + enum-create style. RESEARCH § "Table" has the literal DDL:

```sql
CREATE TABLE recording_events_outbox (
  id varchar(26) PRIMARY KEY, user_id varchar(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id varchar(26) NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  event_type varchar(20) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE INDEX recording_events_outbox_user_undelivered_idx ON recording_events_outbox (user_id) WHERE delivered_at IS NULL;
```

(Use `drizzle-kit generate` to produce it if that's the established flow — check whether the repo commits hand-written or generated migration SQL.)

---

### `shared/types/src/recording.ts` — re-upload contracts + `_events` envelope + verified-ids contract

**Analog:** `RecordingsInitRequestSchema` / `RecordingsInitResponseSchema` / `RecordingFinalizeSchema` family in the same file (lines 56-150) — **exact**.

**Schema-extension idiom** (`recording.ts` line 44 + `finalize.ts` line 24):

```ts
export const RecordingSchema = RecordingCreateSchema.extend({ id: ..., userId: ..., ... });
// and inline in finalize.ts:
const FinalizeBodyExtended = RecordingFinalizeSchema.extend({ imuUploadId: z.string().min(1) });
```

→ add: `RecordingServerEventSchema = z.object({ recording_id: z.string().length(26), event_type: z.enum(['verified','re-upload']) })`; `EventsEnvelopeSchema = z.object({ _events: z.array(RecordingServerEventSchema).optional() })` (or just the `.optional()` key to add onto `RecordingsListResponseSchema` / `MeResponseSchema`); `RecordingReuploadRequestSchema` (likely just `{ partsCount }` — the row already exists) and `RecordingReuploadResponseSchema` (reuse the shape of `RecordingsInitResponseSchema`); `VerifiedIdsQuerySchema = z.object({ since: z.string().length(26).optional() })` + `VerifiedIdsResponseSchema = z.object({ ids: z.array(z.string().length(26)), next_cursor: z.string().length(26).nullable() })`. Re-export from `shared/types/src/index.ts`.

---

### `apps/mobile/.../upload/HumynUploadModule.kt` (native module, RN bridge)

**Analog:** `apps/mobile/android/.../battery/HumynBatteryModule.kt` (the canonical 3-file native-module triad — emit-events shape) + `apps/mobile/android/.../updater/HumynUpdaterModule.kt` (background-executor + Promise + HTTP-over-file shape). Compose both.

**`@ReactModule` annotation + `companion object { const val NAME }` + `getName()`** (`HumynBatteryModule.kt` lines 38-55):

```kotlin
@ReactModule(name = HumynBatteryModule.NAME)
class HumynBatteryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object { const val NAME = "HumynBattery" }
    override fun getName(): String = NAME
```

→ `@ReactModule(name = HumynUploadModule.NAME)` / `const val NAME = "HumynUpload"`.

**`@ReactMethod` with `Promise` + try/catch → `promise.reject(CODE, msg, t)`** (`HumynBatteryModule.kt` lines 85-107):

```kotlin
@ReactMethod
fun start(promise: Promise) {
  try { ...; promise.resolve(null) }
  catch (t: Throwable) { promise.reject("BATTERY_START_FAILED", t.message ?: "...", t) }
}
```

→ `enqueue(recordingId, mp4Path, csvPath, jsonPath, promise)`, `pause(promise)`, `resume(promise)`, `getQueue(promise)` (resolves a `WritableArray` of queue rows — build with `Arguments.createArray()` / `Arguments.createMap()`).

**Emit queue-state events via `RCTDeviceEventEmitter`** (`HumynBatteryModule.kt` lines 74-83):

```kotlin
reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
  .emit("onBatteryChanged", Arguments.createMap().apply { putDouble("level", pct); putBoolean("isCharging", isCharging) })
```

→ `.emit("onUploadQueueChanged", <WritableArray of rows>)` and/or `.emit("onUploadProgress", <{recordingId, bytesUploaded, bytesTotal}>)`.

**`invalidate()` teardown** (`HumynBatteryModule.kt` lines 170-184) — unregister/stop anything still running when the catalyst instance goes away (Pitfall 5 — no leak).

**Background work off the JS thread** (`HumynUpdaterModule.kt` lines 56-62, 67-110): a `private val bgExecutor = Executors.newSingleThreadExecutor()`; every method does `bgExecutor.execute { ... }`. The actual transfer work belongs in `UploadCoordinator` running on the FGS thread, not here — `HumynUploadModule` is the thin bridge.

**Deep-link / `startActivity` from a module** (`HumynUpdaterModule.kt` lines 115-124, for `BatteryOptimizationHelper`):

```kotlin
val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + reactApplicationContext.packageName))
  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
reactApplicationContext.startActivity(intent)
```

→ in `BatteryOptimizationHelper.kt`: `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (always try this) → on failure `Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` → best-effort OEM `ComponentName` deep-links each gated on `intent.resolveActivity(packageManager) != null`. Full list + the AOSP-fallback-first ordering: `05-RESEARCH.md` § "Android: battery-optimization request".

---

### `apps/mobile/.../upload/HumynUploadPackage.kt` (native package registration)

**Analog:** `apps/mobile/android/.../battery/HumynBatteryPackage.kt` — **verbatim**:

```kotlin
class HumynUploadPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynUploadModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
```

**Register in `MainApplication.kt`** — add `packages.add(HumynUploadPackage())  // Plan 05-XX — Phase 5 background upload pipeline` to `getPackages()` alongside the `packages.add(HumynBatteryPackage())` line family (`MainApplication.kt` lines 41-51).

---

### `apps/mobile/.../fgs/HumynForegroundService.kt` — EXTEND (type-downgrade lifecycle)

**Analog:** `HumynForegroundService.kt` itself — the seam is _already there_. Phase 5 wires it.

**Existing `ACTION_SET_UPLOAD_ACTIVE` intent seam** (lines 60-72, 113-123):

```kotlin
if (intent.action == ACTION_SET_UPLOAD_ACTIVE) {
  uploadActive.set(intent.getBooleanExtra(EXTRA_UPLOAD_ACTIVE, false))
  // Do NOT call startForeground here; this is a config-only intent...
  return START_NOT_STICKY
}
```

→ Phase 5: when `uploadActive` flips and recording is stopped, call `ServiceCompat.startForeground(this, NOTIF_ID, notif2, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)` — a _second_ `startForeground` with the narrower bitmask is the documented downgrade (Pitfall 4 — not an in-place bit-clear). The notification text changes to "Uploading recordings…" (extend `HumynForegroundNotification.build`).

**Existing `FGS_TYPE_RECORDING` bitmask + strict-mode invariant** (lines 98-111) — don't touch the `camera|microphone|dataSync` manifest string or the OR'd constant; add a separate `FGS_TYPE_UPLOADING = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC` constant. The two-sided lock (`manifests.test.ts` + `HumynForegroundServiceTest`) still asserts the recording bitmask.

**Add `onTimeout(startId, fgsType)`** (Android 15 6-hour `dataSync` cap, UP-07): `stopSelf()` within a few seconds + schedule the UIDT `JobService` (`UploadJobService.scheduleUidt(this)`) so the queue keeps draining. Skeleton: `05-RESEARCH.md` § "Android: UIDT JobService skeleton".

**Stop-after-idle:** queue empty > 5 min → `ServiceCompat.stopForeground(...)` + `stopSelf()`.

---

### `apps/mobile/src/native/HumynUpload.ts` (JS bridge typings + event subscriptions)

**Analog:** `apps/mobile/src/native/HumynBattery.ts` — **exact**. Copy its structure 1:1.

**`ensure()` guard + canonical "not registered" error** (`HumynBattery.ts` lines 31-39):

```ts
function ensure(): HumynBatteryNativeModule {
  const native = NativeModules.HumynBattery as HumynBatteryNativeModule | undefined;
  if (!native)
    throw new Error(
      'HumynBattery native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  return native;
}
```

→ `HumynUpload` / "check ... MainApplication.kt". Wrap calls that boot-time code makes (the reconcile sweep) in try/catch so a build without the module / JSDOM tests don't crash — see `HumynBattery.getCurrentLevel()` lines 61-67 returning a safe default.

**Lazy `NativeEventEmitter`** (`HumynBattery.ts` lines 72-78):

```ts
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) _emitter = new NativeEventEmitter(NativeModules.HumynBattery);
  return _emitter;
}
```

**`on*(listener): EmitterSubscription` + the leak-warning comment** (`HumynBattery.ts` lines 86-92):

```ts
export function onBatteryChanged(listener: (e: BatteryChangedEvent) => void): EmitterSubscription {
  return emitter().addListener('onBatteryChanged', listener);
}
```

→ `onUploadQueueChanged(listener: (rows: UploadQueueRow[]) => void)`, `onUploadProgress(...)`. Caller MUST `.remove()` on unmount.

**Typed interface for the native methods** (`HumynBattery.ts` lines 22-29) — declare `enqueue`/`pause`/`resume`/`getQueue` return types; export the `UploadQueueRow` shape (mirror the MMKV row schema in `05-RESEARCH.md` § Pattern 5: `recordingId`, `state`, `videoParts[]`, etc.).

---

### `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` (screen/component)

**Analog:** the History row layout from `design-spec.md §16` (the layout source — there is no live History screen, only `HistoryPlaceholderScreen.tsx`'s Phase-6 stub) + `HomeSkeletonScreen.tsx` / `HistoryPlaceholderScreen.tsx` for the screen _shell_ convention.

**Screen shell convention to copy** (`HistoryPlaceholderScreen.tsx` lines 17-37):

```tsx
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
export default function ...() {
  const topBarProps = useTabTopBarProps();
  return (<ScreenContainer accessibilityLabel="..." padding={0}><TopBar {...topBarProps} /> ... </ScreenContainer>);
}
```

**Row layout (D-10):** 64×64 thumbnail + name (15px / weight 600) + meta line (12px secondary) + status chip — verbatim from `design-spec.md §16`. **Chip variants:** reuse `chip-progress` ("Uploading…"), `chip-failed` ("Upload failed" + retry), `chip-success` ("✓ Uploaded"); **add ONE new variant in the identical style** for "Paused — no Wi-Fi" (D-10 — find the existing chip component first; `RecordingScreen` / `AlertPill` area or a shared `ui/` chip). No new tokens, no new animation curves (D-10a).

**Duration formatter for the meta line** — `apps/mobile/src/services/durationFormatter.ts` (`design-spec.md §20` — mono-font rule).

**Data source:** `HumynUpload.getQueue()` once + `HumynUpload.onUploadQueueChanged(...)` subscription (the `EmitterSubscription` pattern from `HumynBattery.ts`). Tile on Home wires to the same data; the `count > 0` visibility + pull-to-refresh + offline banner are explicitly **Phase 6**, not Phase 5 (D-10).

---

### `apps/mobile/src/services/uploadReconcile.ts` (service, request-response + file-I/O)

**Analog:** `apps/mobile/src/hooks/useForegroundUserRehydrate.ts` (mount + AppState→`active` re-fire, swallowed errors, MMKV-guarded short-circuit) + `apps/mobile/src/boot/bootRecoveryListener.ts` (one-shot boot wiring, try/catch around native calls).

**Mount + AppState re-fire pattern** (`useForegroundUserRehydrate.ts` lines 31-69):

```ts
useEffect(() => {
  const rehydrate = async () => { const { user, jwt } = useAppStore.getState(); if (user == null && jwt != null) { try { ... } catch (e) { logEvent('...', {...}); } } };
  void rehydrate();
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void rehydrate(); });
  return () => sub.remove();
}, []);
```

→ on mount + each `active`: `GET /recordings/verified-ids?since=<stored cursor>` → for each id, if the MMKV `uploads` queue still has a row with local files → unlink the triple (`react-native-fs` `unlink`), drop the row, mark processed; store `next_cursor`. Swallow errors (next launch retries — like the rehydrate hook + `bootRecoveryListener`'s `.catch(() => undefined)`).

**Boot install pattern** (`bootRecoveryListener.ts` lines 62-98) — `export function installUploadReconcile(): () => void { ... }` and call it once from `App.tsx` next to `installBootRecoveryListener()`. Wrap native-module calls in try/catch (a build without `HumynUpload` / JSDOM must not crash boot — `bootRecoveryListener.ts` lines 86-92 is the template).

**Use the API client** — `apps/mobile/src/services/api.ts` for the authenticated `GET`. The `_events` envelope handling (Pattern 3 — on `verified` unlink, on `re-upload` re-enter the upload path) is a separate, smaller piece of glue that lives wherever API responses are processed; keep a `processedEvents` set in the `uploads` MMKV keyed `${recording_id}:${event_type}` for idempotency.

---

### `apps/mobile/.../upload/UploadQueueStore.kt` (utility, MMKV-backed persistence)

**Analog (model only):** `apps/mobile/src/services/telemetryRing.ts` — the "read a JSON blob from MMKV, mutate, write it back" shape (`read()` / `write()` / append-with-trim). No Kotlin-side MMKV usage exists today; the Kotlin side is greenfield (MMKV's Kotlin/Nitro API or a plain `SharedPreferences`-style store — planner picks; `react-native-mmkv` is JS-side, so the native module likely uses its own small JSON-on-disk store or MMKV via the C++ core).

**Row schema** — `05-RESEARCH.md` § Pattern 5 (the `{ recordingId, ownerUserId, paths, state, uploadId, partsCount, videoParts[], imuParts[], metadataPut, enqueuedAt, lastProgressAt, deadLetterReason }` shape). `ownerUserId` is the UP-13 cross-account guard — on bootstrap, only resume rows where `ownerUserId == currentSignedInSub`.

**Atomic-write hygiene** — `CaptureLaunchSweep.kt` Pass 4 sweeps `.partial` residue from atomic writes; if `UploadQueueStore` writes a JSON file, use the same write-to-`.partial`-then-rename idiom (see `MetadataComposer.writeAtomic` referenced in `CaptureLaunchSweep.kt`).

---

### `apps/mobile/.../upload/ChunkUploader.kt` (utility, streaming PUT)

**Analog (partial):** `apps/mobile/android/.../updater/HumynUpdaterModule.kt#downloadAndVerifyApk` — streaming an HTTP body in/out over a 64 KB buffer on a background executor (lines 67-110). Transport differs (it uses `HttpURLConnection`; ChunkUploader should use OkHttp `RequestBody` so a 4 GB MP4 isn't loaded into memory). Template: `05-RESEARCH.md` § "Android: streaming chunk PUT + ETag capture":

```kotlin
val body = object : RequestBody() {
  override fun contentLength(): Long = length
  override fun writeTo(sink: BufferedSink) { RandomAccessFile(file, "r").use { raf -> raf.seek(offset); /* 64 KB loop */ } }
}
val req = Request.Builder().url(presignedUrl).put(body).build()
client.newCall(req).execute().use { resp -> if (!resp.isSuccessful) throw IOException(...); return resp.header("ETag") ?: throw ... }
```

Wrap each `putPart` in: retry 2/4/8/16/32/64 s → dead-letter on the 7th failure; a 30 s no-progress watchdog that cancels the `Call` and retries on a fresh socket (UP-19, Pitfall 7 — literal `TCP_MAXSEG=1280` is barely reachable from a JVM socket, so the watchdog is the real mitigation); a semaphore of 6 (3 video ∥ + 3 IMU ∥). Persist `{etag, status}` into the queue row after each success — never restart a `done` part (UP-04).

**SHA-256 streaming-over-file precedent** — `HumynUpdaterModule.kt` lines 76-93 (`MessageDigest.getInstance("SHA-256")` + `md.update(buf, 0, n)` in the read loop) — but the upload module does NOT re-hash (the SHAs are already in `metadata.json` from capture-time `HashStreamer.kt`); it just streams the bytes. Anti-pattern: re-hashing at upload time.

---

### Wave 1 — `apps/mobile/android/.../capture/CaptureLaunchSweep.kt` — D-03 discard change

**Analog:** `CaptureLaunchSweep.kt` itself. The change: in `sweepRecordings()` Pass 1, the `if (sidecar != null) { if (tryReFinalize(...)) { recovered.add(base) } else { ...delete... } }` branch (lines 92-100) becomes: **always delete the triple** (`mp4.delete(); csv.delete(); sidecarFile.delete()`) — the same cleanup the `else` branch already does. `tryReFinalize` / `mp4LooksPlayable` / `adaptSidecar` become dead code (delete them, or keep them behind a comment if the planner wants belt-and-suspenders). `run()` then always returns `emptyList()` (the `recovered` list) — which makes `bootRecoveryListener.ts`'s toast effectively dead (D-03b / D-07 reconciliation: keep the toast wiring + the 5 s duration + the annotation, but expect it never to fire).

**Monotonic-timing rule** (checker issue #10 / STATE.md): if the D-03 change touches any timing, use `SystemClock.elapsedRealtimeNanos` exclusively — but the discard path doesn't time anything, so this is just a guard.

### Wave 1 — `apps/mobile/src/screens/recording/RecordingScreen.tsx` — D-05 device-distress → Home

**Analog:** `RecordingScreen.tsx` + `useRecordingLifecycle.ts` + `recState.ts` (not read this pass — `useRecordingLifecycle.ts` is referenced as plan 04-08, owns the battery-threshold transitions per `HumynBatteryModule.kt`'s comment lines 22-31). The change: the post-stop nav for a _device-distress_ stop (REC-11 battery ≤5%, or thermal abort via `ThermalGate.kt`) navigates to Home instead of resetting to RecordingScreen-`'ready'`. Normal sub-60 s discard keeps current behavior. Edge: a _practice_ recording mid-onboarding that hits distress — Home may not exist yet; pick the sane destination (resume onboarding vs Home). Find the existing nav-reset call in `useRecordingLifecycle.ts`'s stop handler.

### Wave 1 — `apps/mobile/src/boot/bootRecoveryListener.ts` — D-07

**Analog:** itself. One change + one annotation:

```ts
const RECOVERY_TOAST_MS = 15_000; // → 5_000
```

Add a comment: "5 s is intentional (D-07) — do NOT re-bump; the toast fires during splash bootstrap and may fade before Home. The 'stash + trigger from Home mount' refactor is rejected for MVP. With D-03, `CaptureLaunchSweep.run()` no longer produces an upload-able recovered segment, so this toast is effectively dead code — left wired in case a future recovery path produces one." Keep the existing dual-channel (`getPendingRecovery()` + `onCrashRecovery` event) + `isStringArray` validation + `.catch()` swallow.

---

## Shared Patterns

### Server byte-fidelity boundary

**Source:** CLAUDE.md ("Files never re-encoded. MP4, IMU CSV, metadata JSON travel byte-for-byte device → S3") + `s3-client.ts` header comment + `init.ts`/`finalize.ts` header comments.
**Apply to:** all backend files. The Fastify API orchestrates multipart state only — it never `GetObject`s recording bytes. The **hash-verify worker** (`verify-recording.ts` via `sha256-stream.ts`) is the _one_ component allowed to read recording bytes, read-only, streamed (never `Buffer`-collected). State this in every new worker-side file's header.

```ts
// (mirror s3-client.ts lines 1-4 / feedback-uploader.ts lines 1-8 — a header comment naming the invariant)
```

### Pattern 22 (STATE.md) — no strict `response` schema on routes that also return problem-detail

**Source:** `init.ts` lines 33-36, `finalize.ts` lines 67-70, `events/post.ts` lines 21-25.
**Apply to:** every new Phase-5 endpoint (`reupload.ts`; `verified-ids.ts` if it returns 4xx). Declaring `response.201`/`response.200` narrows `reply.code()` so the problem-detail returns trip the type checker. Validate the happy-path shape inline via a typed return value; keep the response zod schema in `shared/types/` for documentation only (`void ResponseSchema;` like `events/post.ts` line 25). **Counter-case:** `list.ts` _does_ have `response: { 200: RecordingsListResponseSchema }` because it never returns 4xx — that's why the `events-outbox` hook needs `_events` added to that schema (or must skip the route).

### Per-user rate-limit keying

**Source:** `init.ts` lines 46-55, `events/post.ts` lines 39-49.
**Apply to:** any new write/expensive endpoint (`reupload.ts`). `@fastify/rate-limit` fires before route preHandlers, so the `keyGenerator` does its own best-effort `req.jwtVerify()` → `user:${sub}`, falling through to `ip:${req.ip}`.

```ts
config: { rateLimit: { max: N, timeWindow: '1 minute', keyGenerator: async (req) => {
  try { await req.jwtVerify(); const sub = (req.user as { sub?: string } | undefined)?.sub; if (sub) return `user:${sub}`; } catch {}
  return `ip:${req.ip}`;
} } }
```

### Problem-detail returns

**Source:** `apps/api/src/lib/problem-detail.ts` (`buildProblemDetail`, `PROBLEM_SLUGS`) + the 404/403/409 returns in `finalize.ts` lines 81-117.
**Apply to:** all new backend routes. `const PROBLEM_CT = 'application/problem+json'; ... return reply.status(409).type(PROBLEM_CT).send(buildProblemDetail({ slug: PROBLEM_SLUGS.conflict, title: '...', status: 409, instance: req.id as string }))`. Reuse existing slugs (`notFound`, `forbidden`, `conflict`, `validation`) — don't add new ones unless a genuinely new wire-side error type appears.

### Cron loop shape

**Source:** `apps/api/src/cron/dsr-hard-delete.ts` — **exact**.
**Apply to:** `verify-sweep.ts`. Module-level `let _timer`; `export async function find...(): Promise<string[]>` (the query, exported for tests); `export function start...(logger)` { `if (_timer) return; const tick = async () => { try {...} catch (err) { logger.info({err}, '...') } }; void tick(); _timer = setInterval(..., MS); _timer.unref?.(); }`; `export function stop...()`. Wire into `app.ts` next to `startDsrCron`, skipped when `NODE_ENV === 'test'`.

### Lazy memoized singletons (clients/connections)

**Source:** `apps/api/src/lib/s3-client.ts` lines 8-28.
**Apply to:** `queue.ts` (`getRedisConnection()`, `getQueue()`). `let _x; export function getX() { if (_x) return _x; _x = new X(envDrivenConfig); return _x; }`. Env-driven dev/prod branch (`process.env.REDIS_URL`, like `process.env.AWS_ENDPOINT_URL`).

### Canonical Android native-module triad

**Source:** `battery/HumynBatteryModule.kt` + `HumynBatteryPackage.kt` + `apps/mobile/src/native/HumynBattery.ts` (this comment chain explicitly calls itself "the canonical 3-file native-module triad" — `HumynBatteryModule.kt` line 34, `updater/HumynUpdaterModule.kt`).
**Apply to:** `HumynUploadModule.kt` / `HumynUploadPackage.kt` / `native/HumynUpload.ts`. `@ReactModule(name = ...NAME)`; `companion object { const val NAME }`; `@ReactMethod fun ...(promise: Promise)` with try/catch → `promise.reject(CODE, msg, t)`; `RCTDeviceEventEmitter.emit(name, Arguments.createMap()...)` for events; `invalidate()` teardown; JS side: `ensure()` guard + canonical "not registered — check ...MainApplication.kt" error + lazy `NativeEventEmitter` + `on*(listener): EmitterSubscription`. Register in `MainApplication.getPackages()`.

### Background work off the JS/main thread (Android)

**Source:** `updater/HumynUpdaterModule.kt` lines 56-62 (`private val bgExecutor = Executors.newSingleThreadExecutor()`; every `@ReactMethod` does `bgExecutor.execute { ... }`).
**Apply to:** `HumynUploadModule.kt` (the bridge), `UploadCoordinator.kt`, `ChunkUploader.kt` — never hash/upload on the JS thread or the main thread; the FGS thread owns the transfers. The MMKV queue write happens on that thread too.

### Boot wiring with native-call guards (RN/JS)

**Source:** `apps/mobile/src/boot/bootRecoveryListener.ts` (try/catch around `HumynCapture.*` calls, `.catch(() => undefined)`, "best-effort; never crash boot") + `apps/mobile/src/hooks/useForegroundUserRehydrate.ts` (mount + AppState→`active`, swallowed errors, `logEvent` on permanent failure).
**Apply to:** `services/uploadReconcile.ts`, the `HumynUpload.ts` boot-time callers. Anything that runs at app boot and touches a native module wraps it so a build without the module / JSDOM tests / a permanently-failing network never crashes startup.

### MMKV singleton discipline

**Source:** `apps/mobile/src/state/mmkv.ts` (D-STATE-01: "NEVER create a second MMKV instance — import this singleton") + `apps/mobile/src/state/keys.ts` + `apps/mobile/src/services/telemetryRing.ts` (read/write a JSON blob keyed off `KEYS.*`).
**Apply to:** the JS side of the upload queue. **Note:** RESEARCH § Pattern 5 proposes `new MMKV({ id: 'uploads' })` — a _dedicated_ instance — which is in tension with the `state/mmkv.ts` "single shared instance" rule. **Planner: resolve this** — either add `uploads.*` keys to the shared `secureMmkv` instance + `KEYS`, OR document a deliberate carve-out (the native module owns its own queue store and the JS side just reads it via the bridge, not via MMKV at all — which is the cleaner story given the queue is written from Kotlin). Don't silently create a second `createMMKV(...)` without addressing D-STATE-01.

### CLAUDE.md Redis carve-out (Discretion item)

**Source:** CLAUDE.md "Do NOT Use → Redis at MVP — Postgres-only; queue lives on device".
**Apply to:** the planner adds a one-line carve-out to CLAUDE.md (the "Do NOT Use" entry or Conventions) — the _upload_ queue is the on-device MMKV one (the line is correct for that); the _hash-verify worker_ queue is BullMQ-on-Redis-on-ECS per VERIFY-01/07 + the ROADMAP. Also add the Redis pin (`bullmq@5.76.8`, `ioredis@5.10.1`, Redis 7.x) to `research/STACK.md` / the CLAUDE.md backend pins if missing.

---

## No Analog Found

Files with no close existing match — planner should use the `05-RESEARCH.md` code sketches:

| File                                                                             | Role                             | Data Flow            | Reason                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mobile/.../upload/UploadJobService.kt`                                     | service (UIDT JobService)        | event-driven         | No `JobService` exists in the codebase. Template: RESEARCH § "Android: UIDT JobService skeleton". New `<service>` entry + `RUN_USER_INITIATED_JOBS` perm in the manifest.                                                                                                                                                                                                |
| `apps/api/src/workers/hash-verify.ts`                                            | worker entrypoint (BullMQ)       | event-driven         | No BullMQ worker / no `apps/api/src/workers/` dir. Closest _role_ analog is the cron loop; template is RESEARCH § "Worker shape". New `package.json` script `worker:hash-verify` → `node dist/workers/hash-verify.js` + a 2nd ECS task def.                                                                                                                              |
| `apps/mobile/.../upload/UploadCoordinator.kt`                                    | service (queue drainer)          | batch / event-driven | No long-lived "drain a persistent queue with bounded concurrency" component today (`CaptureSession.kt` is the nearest long-lived coordinator but a different shape). Compose: `Executors`/semaphore pattern from `HumynUpdaterModule.kt` + the `/init`→PUT→`/finalize` flow from RESEARCH § Pattern 1.                                                                   |
| `apps/mobile/.../upload/UploadQueueStore.kt`                                     | utility (persistent queue store) | persistence          | No Kotlin-side persistent-store code. Model after `telemetryRing.ts` (read/mutate/write a JSON blob); use the `.partial`-then-rename atomic-write idiom from `MetadataComposer.writeAtomic` (referenced in `CaptureLaunchSweep.kt`).                                                                                                                                     |
| `infra/terraform/` ElastiCache + EventBridge rule + SQS queue + 2nd ECS task def | infra config                     | —                    | Not inspected this pass — point the planner at `infra/terraform/` to match the existing module conventions; the EventBridge→SQS rule filters S3 "Object Created" by key suffix (`.mp4`/`.csv`/`metadata.json`). Dev: a LocalStack SQS-create init script + a `/finalize`-direct `queue.add()` shim (LocalStack's S3-notification→EventBridge path is flaky — Pitfall 6). |

---

## Metadata

**Analog search scope:** `apps/api/src/{routes,lib,plugins,cron,db,workers}`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/**`, `apps/mobile/src/{native,screens,services,hooks,boot,state}`, `shared/types/src/`, `docker-compose.yml`, `.env.example`, `infra/`.
**Files scanned (read in full or in targeted ranges):** `init.ts`, `finalize.ts`, `list.ts`, `recordings/index.ts`, `s3-client.ts`, `feedback-uploader.ts`, `recording-state.ts`, `problem-detail.ts` (head), `idempotency.ts`, `events/post.ts`, `cron/dsr-hard-delete.ts`, `db/schema.ts` (enums + recordings + events + recordingsToVerify + adjacent), `app.ts`; `HumynForegroundService.kt`, `HumynBatteryModule.kt`, `HumynBatteryPackage.kt`, `HumynUpdaterModule.kt`, `CaptureLaunchSweep.kt`, `MainApplication.kt` (getPackages); `HumynBattery.ts`, `bootRecoveryListener.ts`, `useForegroundUserRehydrate.ts`, `state/mmkv.ts`, `telemetryRing.ts`, `HomeSkeletonScreen.tsx`, `HistoryPlaceholderScreen.tsx`; `shared/types/src/recording.ts`; `docker-compose.yml`, `.env.example`; `05-CONTEXT.md`, `05-RESEARCH.md` (file-by-file structure + code-examples sections).
**Pattern extraction date:** 2026-05-12
