# Humyn Labs Capture — Tech Stack & Scale Notes

_Snapshot: 2026-05-14. Source of truth for pins is `CLAUDE.md` + each app's `package.json`._

---

## Part 1 — Tech Stack (granular)

### Monorepo & toolchain

- **pnpm 9.15.0** workspaces (`apps/api`, `apps/mobile`, `shared/types`)
- **Node 22 LTS** (`engines.node >=22`)
- **TypeScript 5.6.3** (NOT TS 6)
- **ESLint 9.16** + **typescript-eslint 8.18** + **Prettier 3.3.3** + **husky 9.1.7** + **lint-staged 15.2.10**

### Mobile — React Native core

- **react-native 0.83.0** + **react 19.2.0** + **Hermes** (bundled, V1, New Architecture only)
- **@react-native/babel-preset 0.83**, **@react-native/metro-config 0.83**, **@react-native-community/cli 14**
- **react-native-nitro-modules ^0.35.6**

### Mobile — Navigation / UI / state

- **@react-navigation/native 7.2.2**, **/native-stack 7.3.7**, **/bottom-tabs 7.3.5**
- **react-native-screens ^4.24**, **react-native-safe-area-context ^5.7**
- **react-native-svg 15.15.4** (GateRing, RotatePrompt glyph)
- **react-native-reanimated ~4.3.1** + **react-native-worklets ~0.8.3** (Babel plugin: `react-native-worklets/plugin`)
- **lucide-react-native 1.14.0**
- **zustand 5.0.2** (state)
- **zod 4.4.3** (schemas, shared with API)

### Mobile — Capture pipeline (hand-rolled native)

- **HumynCapture (Kotlin)** — Camera2 + MediaCodec HEVC; ultrawide via `CONTROL_ZOOM_RATIO`
- **HumynGateCamera (Kotlin)** — pre-record gate Camera2 + TextureView preview
- **HandDetector (Kotlin)** — MediaPipe HandLandmarker IMAGE mode, ~95 LOC
- **`com.google.mediapipe:tasks-vision 0.10.21`** (Android) + **`MediaPipeTasksVision 0.10.21`** pod (iOS, locked — do NOT upgrade past 0.10.33)
- **SensorManager** (Android) / **CMMotionManager** (iOS) — IMU, in-module, no RN lib
- iOS analogue: **AVCaptureSession + AVAssetWriter** (Swift, deferred to follow-on milestone)
- _(Vision Camera removed 2026-05-12; CameraX rejected by spec.)_

### Mobile — Device glue

- **react-native-permissions ^5.5.1**
- **react-native-fs 2.20.0**, **react-native-mmkv 4.3.1** (on-device upload queue, non-secrets), **react-native-keychain 10.0.0** (secrets)
- **react-native-tts 4.1.1** (en-US female voice — owner deviation from en-IN spec)
- **react-native-haptic-feedback 2.3.3**
- **react-native-orientation-locker 1.7.0**
- **react-native-config 1.6.1**, **react-native-uuid 2.0.3**

### Mobile — Auth / integrity / Firebase

- **@react-native-google-signin/google-signin 16.1.2** (Credential Manager API; Web OAuth client ID)
- **@react-native-firebase/{app,auth,crashlytics,analytics,remote-config} 24.0.0** (all unified)
- **Play Integrity** Standard requests + Google-Managed decryption (Kotlin native module — `PlayIntegrityModule.kt`)
- **DeviceCheck / App Attest** (iOS — deferred)
- **FOREGROUND_SERVICE** types `camera|microphone|dataSync` (capture) + `dataSync` (upload)

### Mobile — Build

- **Android:** AGP 8.7+, Gradle 8.11+, Kotlin 2.0.21+, compileSdk/targetSdk **35**, minSdk **26**, JDK 17 (Zulu)
- **iOS:** Xcode 16.0+, deployment target **15.1**, CocoaPods 1.16+, Ruby 3.2+

### Mobile — Tests

- **vitest 4.1.5**, **@testing-library/react-native 12.7.2**, **react-test-renderer 19.2.0**, **jest-image-snapshot ^6.5.2**, **jsdom 25.0.1**

### Backend — Fastify API

- **fastify 5.8.5** + **fastify-plugin 5.0.1** + **fastify-type-provider-zod 6.1.0**
- **@fastify/cors 11.2.0**, **@fastify/jwt 10.0.0**, **@fastify/rate-limit 10.3.0**, **@fastify/multipart 9.0.3**
- **pino 10.3.1** + **pino-pretty 13.0.0** (dev)
- **zod 4.4.3** (validation)
- **nanoid 5.0.9**, **ulid 2.3.0**, **lru-cache 11.0.2**

### Backend — Database

- **PostgreSQL 17.x** (or 16.x), **pgvector 0.8.0+** (HNSW), built-in `ts_vector` + GIN, hybrid via RRF k=60
- **pg 8.20.0** + **drizzle-orm 0.45.2** + **drizzle-kit 0.28.1**

### Backend — Queue & workers

- **bullmq 5.76.8** + **ioredis 5.10.1** on **Redis 7.x** (ElastiCache prod, `redis:7-alpine` dev) — the ONE Redis carve-out, only for the `verify` queue
- **@aws-sdk/client-sqs 3.1044.0** (EventBridge → SQS → BullMQ poller)
- Workers: `hash-verify` (concurrency 4) + `sqs-poller`, separate ECS task defs from the API

### Backend — AWS SDK v3 (all 3.1044.0 minor, except cloudfront-signer)

- **@aws-sdk/client-s3 3.1044.0** + **@aws-sdk/s3-request-presigner 3.1044.0**
- **@aws-sdk/client-sqs 3.1044.0**
- **@aws-sdk/client-secrets-manager 3.1044.0**
- **@aws-sdk/cloudfront-signer 3.1036.0**

### Backend — Auth / 3rd-party

- **google-auth-library 10.6.2**, **googleapis 144.0.0** _(CLAUDE.md mentions 171.4.0; actual pin is 144)_
- **jsonwebtoken 9.0.2** (dev only)

### Backend — ML embeddings

- **@xenova/transformers 2.17.2** (in-process embedder for pgvector path — built but client-descoped at MVP)

### Backend — Runtime / tests

- **vitest 4.1.5**, **tsx 4.19.2** (dev runner)

### Infrastructure

- **AWS ECS** — separate task defs for API + hash-verify + sqs-poller (modules in `infra/terraform/modules/ecs`)
- **RDS** Postgres, **ElastiCache** Redis, **S3**, **CloudFront** (signed URLs), **Secrets Manager**, **VPC/network**, **SQS + EventBridge** (`verify-queue` module), **IAM**
- **Terraform 1.10+** — modules: `network`, `rds`, `redis`, `s3`, `cloudfront`, `ecs`, `iam`, `secrets`, `verify-queue`
- **LocalStack Community 4.x** + **docker-compose** for dev
- **k6** for load tests

### Observability

- **Firebase Crashlytics** + **Firebase Analytics** (mobile, MVP)
- **Pino** structured JSON logs (backend)
- _(NO Sentry / Datadog / Bugsnag at MVP)_

### Explicitly banned (audit trail)

`react-native-vision-camera`, CameraX, `MediaPipeTasksVision ≥0.10.33`, `expo-camera`, `react-native-camera`, JSC, AsyncStorage (for tokens/queue), AWS SDK v2, Prisma, Redis for the on-device queue, `react-native-background-fetch`, Sentry/Datadog/Bugsnag.

---

## Part 2 — Scale & Concurrency

How load is distributed across the system, layer by layer.

### 1. The phone does most of the work

Capture, hand-gate, HEVC encode, IMU collection, and the **upload queue itself** all live on-device (MMKV-backed, native-module-owned). The server never sees raw uploads — files go phone → S3 directly via presigned multipart URLs. Files are never re-encoded. Traffic to the API is just small JSON (sessions, recordings rows, task fetches) — not bytes of video.

### 2. API is a stateless Fastify cluster

- Stateless ECS containers behind a load balancer — scale horizontally on CPU
- **Two rate-limit tiers** (`apps/api/src/plugins/rate-limit.ts`):
  - per-IP — `30/min`, anonymous, applied before auth
  - per-user — `120/min`, authenticated, keyed on `user:<sub>`
  - Separate buckets so abuse on one doesn't starve the other
- **Idempotency** (`apps/api/src/plugins/idempotency.ts`): every POST/PATCH requires a UUIDv4 `Idempotency-Key` header
  - Replays return the cached response
  - Same key + different body → 409
  - Lets the mobile client retry safely on flaky networks

### 3. Uploads → verify pipeline (the big concurrency engine)

The one place the server actually does heavy work — re-hashing the S3 object to confirm the device-claimed SHA-256.

```
phone → S3 (multipart) → EventBridge → SQS → sqs-poller → BullMQ (Redis) → hash-verify worker → DB
```

- **SQS poller** (`apps/api/src/workers/sqs-poller.ts`): long-polls (`WaitTimeSeconds: 20`), pulls up to 10 messages per batch, parses the S3 key, enqueues a BullMQ job. Garbage messages get deleted; unparseable ones fall through to the DLQ.
- **`jobId = recordingId`** (`apps/api/src/lib/queue.ts:45`) — the 3 events per bundle (`video.mp4` + `imu.csv` + `metadata.json`) and any SQS redelivery + cron-sweep duplicates **collapse to one job**. Idempotent enqueue.
- **BullMQ worker** (`apps/api/src/workers/hash-verify.ts`): `concurrency: 4` per container, `attempts: 5` with exponential backoff (5s base), `removeOnComplete: 1000`, `removeOnFail: 5000`.
- Worker is a **separate ECS task definition** (same Docker image, different entrypoint) — **scales independently on queue depth** (VERIFY-07). API latency is not coupled to verify throughput.
- A **`verify-sweep` cron** is the durable backstop: if SQS ever drops an event, the cron walks `recordings_to_verify` and re-enqueues.
- The `/reupload` handler explicitly removes the prior job before its response, since `jobId = recordingId` would otherwise no-op a second verify.

### 4. Postgres absorbs read load via indexed search

- Task search at MVP: `ts_vector` + GIN lexical
- pgvector + HNSW + RRF (k=60) hybrid layer is built but client-descoped — HNSW is preferred over IVFFlat for low-latency vector reads at scale
- Drizzle ORM chosen over Prisma for hybrid-search SQL ergonomics

### 5. The one Redis carve-out

- The on-device upload queue is **not** Redis — explicitly forbidden in `CLAUDE.md`
- Redis exists _only_ for the BullMQ verify queue
- Singleton lazy connection (`apps/api/src/lib/queue.ts:23`) — importing `queue.ts` doesn't open a socket at boot, keeps unit tests quiet, lets the Fastify API import `enqueueVerify` without a live Redis at boot

### TL;DR

Phones do the heavy lifting; S3 absorbs the bytes; the API is a stateless cluster with per-tier rate limits and idempotent writes; the verify pipeline fans out through SQS → BullMQ with idempotent job IDs, retries, a cron backstop, and an independently-autoscaled worker fleet.
