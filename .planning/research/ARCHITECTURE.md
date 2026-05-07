# Architecture Research

**Domain:** Android-first React Native + native-modules data-collection app (egocentric video + IMU + audio capture, S3 multipart upload, Fastify backend) with iOS analogues
**Researched:** 2026-05-07
**Confidence:** HIGH on shape (every layer is anchored to the locked spec); MEDIUM on the few seams the spec leaves open (Android 15 dataSync cap, hash-verify worker placement, secrets manager choice)

This file is the architecture half of the project research bundle. It maps the spec into component boundaries, draws the end-to-end recording-and-upload data flow, and surfaces the build-order implications and risk callouts the roadmap needs to consume.

## Standard Architecture

### System overview (three planes: device → backend → infra)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         MOBILE (apps/mobile/) — RN + Hermes + native modules           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────────────┐     │
│  │  JS LAYER (Hermes / new architecture)                                          │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │     │
│  │  │ Navigation  │ │ Screens     │ │ recState    │ │ Upload-queue│ │ TTS /    │ │     │
│  │  │ (React Nav) │ │ (Home/Tasks │ │ machine     │ │ JS controller│ │ haptics  │ │     │
│  │  │             │ │  /History/  │ │ (XState/    │ │ (orchestrator│ │ wrappers │ │     │
│  │  │             │ │  Recording) │ │  Zustand)   │ │  only)       │ │          │ │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └──────┬──────┘ └──────────┘ │     │
│  │                                                          │                    │     │
│  │     ┌─── Zustand stores (auth, tasks cache, contrib, recording, uploads) ───┐ │     │
│  │     └─── persist middleware → react-native-mmkv (instance per concern) ────┘ │     │
│  └─────────────────────────────────────┬─────────────────────────────────────────┘     │
│                                        │ JSI (TurboModules — synchronous calls)        │
│  ┌─────────────────────────────────────┴─────────────────────────────────────────┐     │
│  │  NATIVE LAYER (Kotlin on Android, Swift on iOS)                                │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │     │
│  │  │ HumynCapture │ │ HumynHand-   │ │ HumynUpload  │ │ HumynIntegrity       │ │     │
│  │  │ Camera2 +    │ │ Detector     │ │ JobScheduler │ │ Play Integrity (And) │ │     │
│  │  │ MediaCodec + │ │ MediaPipe    │ │ /UIDT job    │ │ DeviceCheck (iOS)    │ │     │
│  │  │ AudioRecord +│ │ Tasks Vision │ │ (Android) /  │ │                      │ │     │
│  │  │ SensorMgr    │ │ IMAGE mode   │ │ URLSession   │ ├──────────────────────┤ │     │
│  │  │ ─ MP4 muxer  │ │ numHands=2   │ │ background   │ │ HumynDiagnostic      │ │     │
│  │  │ ─ IMU CSV    │ │ confs=0.5    │ │ (iOS)        │ │ harness (long-press) │ │     │
│  │  │ ─ SHA-256    │ │ CPU delegate │ │ — fg service │ │                      │ │     │
│  │  │ ─ drift calc │ │ (Android)/   │ │   wraps it   │ │                      │ │     │
│  │  │ ─ metadata   │ │ AVCapture-   │ │   on Android │ │                      │ │     │
│  │  │   JSON       │ │ Session +    │ │              │ │                      │ │     │
│  │  │ (iOS: AV-    │ │ AVAssetWriter│ │              │ │                      │ │     │
│  │  │  CaptureSes- │ │ on iOS)      │ │              │ │                      │ │     │
│  │  │  sion +      │ │              │ │              │ │                      │ │     │
│  │  │  AVAsset-    │ │              │ │              │ │                      │ │     │
│  │  │  Writer +    │ │              │ │              │ │                      │ │     │
│  │  │  CMMotion-   │ │              │ │              │ │                      │ │     │
│  │  │  Manager)    │ │              │ │              │ │                      │ │     │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────────────────────┘ │     │
│  └────────┬┴───────────────┬┴───────────────┬┴────────────────────────────────────┘     │
│           │ writes         │ reads          │ reads                                     │
│  ┌────────┴────────────────┴────────────────┴────────────────────────────────────┐     │
│  │  DEVICE STORAGE                                                                │     │
│  │  app-sandbox/recordings/{ulid}/   .mp4   .csv   .json                          │     │
│  │  Keychain (iOS) / Android Keystore   →   auth.token, refresh.token             │     │
│  │  MMKV instance: app                  →   user, tasks cache, contrib, prefs     │     │
│  │  MMKV instance: recordings           →   queue rows, recState last snapshot    │     │
│  │  MMKV instance: uploads              →   chunk progress, upload IDs, retry ct  │     │
│  └────────────────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                  HTTPS (TLS 1.3)             S3 multipart (TLS 1.3,
                                          │                    presigned chunk PUTs)
                                          ▼                              │
┌────────────────────────────────────────────────────────────────────────┴────────────────┐
│                        BACKEND (apps/api/) — Fastify + Postgres + S3                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────┐    ┌──────────────────────────────────┐           │
│  │ Fastify HTTP API (1+ instances)  │    │ Hash-verify Worker (BullMQ)      │           │
│  │ ─ /auth/google                   │    │ ─ consumes upload-completed jobs │           │
│  │ ─ /me, /me/restore               │    │ ─ streams object from S3,        │           │
│  │ ─ /tasks (semantic + lexical)    │    │   re-hashes MP4 + CSV            │           │
│  │ ─ /task-requests                 │    │ ─ compares to manifest hashes    │           │
│  │ ─ /recordings (multipart init,   │    │ ─ writes recordings.qa_status    │           │
│  │   patch, list, complete)         │    │ ─ enqueues client-event push     │           │
│  │ ─ /contributions{,/timeseries}   │    │   (long-poll on next /me hit,    │           │
│  │ ─ /events (telemetry batches)    │    │   no FCM/APNs at MVP)            │           │
│  │ ─ /app/version                   │    │                                  │           │
│  │ ─ idempotency-key middleware     │    │ Same TS/Fastify codebase,        │           │
│  │ ─ RFC 7807 error shape           │    │ deployed as a separate ECS task  │           │
│  │ ─ structured pino logs           │    │ scaled on queue depth            │           │
│  └────────────┬─────────────────────┘    └──────────────────┬───────────────┘           │
│               │ Postgres (RDS) — same DB, shared models                                 │
│               ▼                                              │                          │
│  ┌─────────────────────────────────────────┐                 │                          │
│  │ Postgres (RDS, single AZ MVP)            │                 │                          │
│  │  users, sessions, tasks (pgvector +     │                 │                          │
│  │  ts_vector), task_requests, recordings, │                 │                          │
│  │  recording_chunks, upload_events,       │                 │                          │
│  │  consent_log, app_versions, idempotency │                 │                          │
│  └─────────────────────────────────────────┘                 │                          │
│                                                              │                          │
│  ┌──────────────────────────────────────────┐                │                          │
│  │ Redis (ElastiCache) — BullMQ broker,     │◄───────────────┘                          │
│  │ short-lived idempotency-key cache        │                                           │
│  └──────────────────────────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │                          │
                                S3 EventBridge → SQS → enqueue   GET signed playback URL
                                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            INFRA (infra/terraform/) — AWS                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────────────────┐    │
│  │ S3 bucket            │  │ CloudFront           │  │ VPC + ECS/Fargate           │    │
│  │ ─ /raw/{ulid}/*      │  │ ─ signed cookies/URLs│  │ ─ humyn-api task            │    │
│  │ ─ versioning ON      │  │ ─ origin = S3        │  │ ─ humyn-worker task         │    │
│  │ ─ lifecycle:         │  │ ─ in-app player only;│  │ ─ ALB in front of API       │    │
│  │   abort incomplete   │  │   short TTL (5 min)  │  │ ─ ECR for images            │    │
│  │   multipart > 24 h   │  │                      │  │                             │    │
│  │ ─ EventBridge on     │  │                      │  │ RDS Postgres (pgvector)    │    │
│  │   s3:ObjectCreated   │  │                      │  │ ElastiCache Redis           │    │
│  └──────────────────────┘  └──────────────────────┘  │ Secrets Manager (rotation) │    │
│                                                       └─────────────────────────────┘    │
│                                                                                          │
│  envs:  dev (LocalStack on docker-compose) / staging / prod  — same modules, env vars   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component responsibilities

| Component | Owns | Implementation |
|-----------|------|----------------|
| `apps/mobile` JS layer | All screens, navigation, the `recState` UI side, the upload-queue *orchestrator* (queue DB rows, retry policy, bookkeeping) | React Native 0.75+ on Hermes new architecture; React Navigation; Zustand stores; `react-native-mmkv` for persistence; XState only for `recState` (others are simple `useReducer`-shaped Zustand slices) |
| `HumynCapture` native module | Camera2/AVCaptureSession lifecycle, MediaCodec/AVAssetWriter encoder, AudioRecord/AVAudioRecorder, SensorManager/CMMotionManager, MP4 mux, IMU CSV writer, SHA-256, drift compute, metadata JSON serialiser | Kotlin (Android) + Swift (iOS) TurboModule. Pure native — RN never touches a frame buffer. Surfaces only commands (start/stop/state) and events (segment-finalised, drift-summary) over JSI |
| `HumynHandDetector` native module | One-shot bitmap → hand-count via MediaPipe HandLandmarker (`hand_landmarker.task`, IMAGE mode, `numHands=2`, all confidences 0.5, CPU delegate) | Kotlin (Android) + Swift (iOS). RN calls `Camera.takePhoto()`, hands the file path to `HandDetector.detectHands(path) → number`. Bundle ships the 7.8 MB task asset once for both platforms. Model is hand-rolled — explicitly no third-party RN wrapper per spec |
| `HumynUpload` native module | Owns the actual transfer pipeline that has to survive backgrounding: chunk-PUT, progress callbacks, retry/backoff, queue persistence | Android: a `JobService` registered as a **user-initiated data transfer (UIDT)** job (Android 14+) wrapped by a foreground service of type `dataSync` for the duration the user is in-app, with a WorkManager fallback for expedited resumes after kill. iOS: `URLSession` `.background(withIdentifier:)` config with `sessionSendsLaunchEvents = true` and `isDiscretionary = false`. RN holds only the queue model; the daemon owns active transfers |
| `HumynIntegrity` native module | Play Integrity attestation (Android) / DeviceCheck + App Attest (iOS) | Wraps each platform's official client; called once at sign-in, response posted to `/auth/google` for the backend to verify with Google's API |
| `HumynDiagnostic` (debug-only) | The long-press-logo harness from testing-guide §A.9: live IMU rate, encoder queue, thermal graph, last-100 events, "dump queue to share-sheet" | Same module on both platforms; gated behind `BuildConfig.DEBUG` / `#if DEBUG` |
| Fastify HTTP API | All synchronous client requests, presigned-URL minting, hybrid task search, idempotency, error shape | Fastify + TS, `@fastify/jwt` (HS256 over Postgres-stored secret) for sessions, `@fastify/multipart` for sample-video uploads, Zod for request validation, pino for logs. Single binary; multiple ECS replicas behind ALB |
| Hash-verify worker | Re-hashes objects after S3 reports complete; flips `recordings.qa_status`; emits client-visible `verified` / `re-upload` event the app picks up on next API call | Same TS codebase as the API; `BullMQ` consumer; Redis broker; deployed as a separate ECS task scaled on queue depth. **Not** Lambda at MVP — see "Hash-verify worker placement" risk callout |
| Postgres (RDS) | All durable backend state: users, sessions, tasks (with `tsvector` + `vector` columns), recordings (one row per uploaded segment), upload events, consent log, app versions, idempotency-key cache | Postgres 16 with pgvector ≥ 0.7 and built-in `tsvector`. Single-AZ at MVP, multi-AZ before Play 100 % |
| Redis (ElastiCache) | BullMQ message broker; short-lived idempotency-key cache | Redis 7+. Single replica at MVP |
| S3 | The only home of MP4 + CSV + JSON. Bytes are never re-encoded en route | Single bucket per env (`humyn-raw-{env}`). Lifecycle rule: abort incomplete multipart uploads after 24 h. Versioning on (paranoia, cheap) |
| CloudFront | Signed playback URL distribution for in-app player only (≤ 5 min TTL) | Origin = S3, signed cookies / URLs via key-pair in Secrets Manager |
| Terraform (infra/) | Reproducible env stand-up: VPC, subnets, ALB, ECS task defs, RDS, ElastiCache, S3, CloudFront, IAM, Secrets Manager | Modules under `infra/terraform/modules/`; envs under `infra/terraform/envs/{dev,staging,prod}/` (dev points everything at LocalStack via env vars) |
| LocalStack (dev) | Fakes S3 + presigned URLs + EventBridge + SQS + IAM/STS for `docker-compose up` | Pinned LocalStack version; only the AWS subset the API actually uses (S3 + EventBridge + SQS for the worker hand-off, plus IAM/STS for STS-AssumeRole-style local creds). RDS and Redis run as their own real containers, not via LocalStack |

## Recommended project structure

```
hl-homelander/
├── apps/
│   ├── mobile/                              # React Native app
│   │   ├── android/                         # Kotlin TurboModules + foreground services live here
│   │   │   ├── app/
│   │   │   │   └── src/
│   │   │   │       ├── apkRollout/         # build flavor: APK sideload
│   │   │   │       ├── playStore/          # build flavor: Play Store
│   │   │   │       └── main/
│   │   │   │           ├── java/ai/humynlabs/
│   │   │   │           │   ├── capture/    # HumynCapture (Camera2 + MediaCodec + sensors)
│   │   │   │           │   ├── handgate/   # HumynHandDetector (MediaPipe wrapper)
│   │   │   │           │   ├── upload/     # HumynUpload (UIDT job + fg service)
│   │   │   │           │   ├── integrity/  # HumynIntegrity (Play Integrity)
│   │   │   │           │   └── diagnostic/ # debug-only harness
│   │   │   │           └── res/
│   │   │   └── build.gradle                # productFlavors { apkRollout {} playStore {} }
│   │   ├── ios/
│   │   │   ├── HumynCapture/               # Swift module (AVCaptureSession + AVAssetWriter)
│   │   │   ├── HumynHandDetector/          # Swift module (MediaPipe iOS)
│   │   │   ├── HumynUpload/                # Swift module (URLSession bg config)
│   │   │   ├── HumynIntegrity/             # DeviceCheck + App Attest
│   │   │   ├── ConfigStaging.xcconfig      # iOS equivalent of apkRollout flavor
│   │   │   ├── ConfigProd.xcconfig         # iOS equivalent of playStore flavor
│   │   │   └── HumynLabs.xcodeproj/
│   │   ├── shared-native/                   # The shared `hand_landmarker.task` asset (7.8 MB)
│   │   │   └── hand_landmarker.task
│   │   ├── src/
│   │   │   ├── app/                        # navigation, app shell, deep-link router
│   │   │   ├── screens/                    # Splash, SignUp, Permissions, Compat, Tutorial, Home, Tasks, History, Recording, Profile, Help, ForceUpgrade
│   │   │   ├── components/                 # primitives + Card.* + Pill + Sheet + Modal + UniversalRules.Block + TaskIcon
│   │   │   ├── design-system/              # tokens, typography, motion specs (mirror of /design-system/)
│   │   │   ├── state/
│   │   │   │   ├── stores/                 # Zustand: authStore, tasksStore, recordingsStore, uploadsStore, contribStore
│   │   │   │   ├── machines/               # XState: recState (the only state machine that earns its keep)
│   │   │   │   └── persist.ts              # MMKV adapter for Zustand persist middleware
│   │   │   ├── native/                     # TS .d.ts shims + JSI module wrappers (one file per native module)
│   │   │   ├── api/                        # generated client from OpenAPI/Zod schemas in shared/
│   │   │   ├── upload/                     # JS-side queue controller (delegates active transfers to native)
│   │   │   ├── lib/                        # drift formatting, duration formatter, filename gen, validators
│   │   │   └── telemetry/                  # Firebase Analytics wrapper, event constants, throttling
│   │   ├── e2e/                            # Detox specs
│   │   └── package.json
│   └── api/                                # Fastify backend
│       ├── src/
│       │   ├── server.ts                   # entrypoint
│       │   ├── plugins/
│       │   │   ├── auth.ts                 # /auth/google + JWT minting
│       │   │   ├── error.ts                # RFC 7807 problem+json
│       │   │   ├── idempotency.ts          # idempotency-key middleware
│       │   │   └── observability.ts        # pino + request IDs + CloudWatch shipper
│       │   ├── routes/
│       │   │   ├── auth/
│       │   │   ├── me/
│       │   │   ├── tasks/
│       │   │   ├── task-requests/
│       │   │   ├── recordings/             # init, patch, list, complete (multipart)
│       │   │   ├── contributions/
│       │   │   ├── events/
│       │   │   └── app/                    # /app/version
│       │   ├── services/
│       │   │   ├── s3.ts                   # presigned URL minting, multipart init/complete
│       │   │   ├── search.ts               # hybrid pgvector + tsvector search
│       │   │   └── integrity.ts            # Play Integrity / DeviceCheck verifier
│       │   ├── db/
│       │   │   ├── schema.sql              # source of truth for migrations
│       │   │   ├── migrations/             # ordered .sql files
│       │   │   └── client.ts               # postgres-js or pg-typed wrapper
│       │   └── workers/
│       │       └── hash-verify.ts          # BullMQ worker entrypoint (separate ECS task)
│       ├── test/
│       │   ├── unit/                       # Vitest
│       │   ├── integration/                # Vitest against ephemeral Postgres + LocalStack
│       │   └── load/                       # k6 scripts (testing-guide §B.6)
│       └── package.json
├── shared/
│   ├── types/                              # Zod schemas mirrored to TS types (single source of truth for API contracts)
│   ├── constants/                          # event names, error codes, capture-spec constants
│   └── drift/                              # drift compute + formatter (used by mobile JS unit tests AND the Kotlin/Swift natives — same fixtures)
├── infra/
│   └── terraform/
│       ├── modules/
│       │   ├── network/                    # VPC, subnets, security groups
│       │   ├── compute/                    # ECS cluster, task defs (api + worker)
│       │   ├── data/                       # RDS Postgres + ElastiCache Redis
│       │   ├── storage/                    # S3 + CloudFront + EventBridge → SQS
│       │   └── secrets/                    # Secrets Manager + IAM roles
│       └── envs/
│           ├── dev/                        # LocalStack-targeted (URL overrides per service)
│           ├── staging/
│           └── prod/
├── docker-compose.yml                      # postgres + redis + localstack for dev
├── design-system/                          # already exists — task icons, fonts, brand book PDF
├── .planning/                              # GSD state (already exists)
└── package.json                            # pnpm workspaces root
```

### Structure rationale

- **Monorepo with pnpm workspaces:** `shared/types/` is genuinely shared between mobile JS and the Fastify backend (Zod schemas → TS types on both sides → no contract drift). Native modules don't import from `shared/`, but the Kotlin/Swift code does receive JSON shaped by those schemas, so the mobile JS layer is the contract enforcer.
- **`apps/mobile/android/` is opened directly in Android Studio**, not the RN root — testing-guide §A.3 calls this out as a common first-run failure if you point Studio at `apps/mobile/`.
- **Native modules are folder-per-module under each platform's source root**, not lumped into one `react-native-bridge` dir. Each module has a clean Kotlin/Swift namespace, owns its own resources, and can be unit-tested with JUnit/Robolectric or XCTest in isolation. `HumynCapture` is the heaviest by an order of magnitude — splitting it from `HumynUpload` lets you debug encoder issues without dragging the upload daemon into the picture.
- **`shared/drift/` lives in TS even though Kotlin and Swift implementations exist** — the JS lib is the canonical reference and ships the synthetic-fixture suite. Native code mirrors it and the Vitest suite asserts both produce identical outputs on identical fixtures (hash-equality check — see PITFALLS).
- **Workers live in `apps/api/src/workers/` not `apps/worker/`** because they share the entire Fastify codebase — DB models, S3 client, types. Different ECS task definition, same Docker image, different entrypoint (`node dist/workers/hash-verify.js` vs `node dist/server.js`).
- **`infra/terraform/envs/dev/` doesn't deploy to AWS** — it generates the env vars and Terraform outputs the API and worker need to talk to LocalStack. This keeps "what AWS resources do we need?" answerable in one place even when dev is fake.

## Architectural patterns

### Pattern 1: JS-as-orchestrator, native-as-pipeline

**What:** The JS layer never touches a frame buffer, an audio sample, an IMU reading, or a TCP socket carrying chunk bytes. It only sends commands ("start recording task X", "pause uploads", "delete file Y") and receives high-level events ("segment finalised, here's the metadata path", "upload chunk 3/47 done", "verified by backend"). All hot paths run in Kotlin/Swift.

**When to use:** Any RN app where the perf-critical work is bounded and well-typed (capture, encode, transfer). The boundary is the spec of the events, not the boundary of the language.

**Trade-offs:**
- Pro: native owns the only places where Hermes can't keep up (16-ms UI thread budget vs 33-ms frame deadline at 30 fps). The JS GC pause that kills a frame is impossible because no frame ever crosses JSI.
- Pro: testing native logic doesn't need RN — JUnit + XCTest on the modules in isolation.
- Con: every native event is a serialisation cost. Keep the event vocabulary tight (e.g. `progress(percent)` not `progress(uploaded_bytes, total_bytes, last_chunk_etag, ...)`) and emit at human-perceivable rates (≥ 100 ms between progress events) — Reanimated worklets handle smoothing on the UI thread.
- Con: any feature that needs both JS and native to know the same domain object (e.g. a `Recording`) requires keeping its shape in sync. Codegen from the Zod schema in `shared/types/Recording.ts` to a Kotlin data class and a Swift struct is the cleanest answer.

**Example boundary contract:**

```typescript
// apps/mobile/src/native/HumynCapture.d.ts — single source of truth for the bridge
export type CaptureCommand =
  | { type: 'start'; taskId: string; isPractice: boolean; segmentMs: number }
  | { type: 'stop' }
  | { type: 'pause' }      // (if we ever need it; spec doesn't today)
  | { type: 'resume' };

export type CaptureEvent =
  | { type: 'preview-ready' }
  | { type: 'recording-armed'; armedAt: number }
  | { type: 'segment-finalised'; recordingId: string; mp4Path: string; csvPath: string;
      jsonPath: string; durationS: number; drift: { max: number; mean: number; p99: number } }
  | { type: 'fatal'; code: 'ENCODER_INIT' | 'CAMERA_OPEN' | 'STORAGE_FULL' | 'THERMAL_KILL';
      message: string };
```

The native side never invents a new event shape; the JS side never tries to read encoder state mid-frame.

### Pattern 2: Capture pipeline as a single native graph (no JS in the hot path)

**What:** Inside `HumynCapture`, the Camera2 → MediaCodec → muxer → CSV writer graph is wired native-side and run on a dedicated thread (Android: `HandlerThread "humyn-capture"` priority `THREAD_PRIORITY_URGENT_AUDIO`; iOS: a `dispatch_queue_t` of QoS `.userInteractive` plus the `AVAssetWriter` input queues). The JS layer kicks it off and is *informed* when a segment finalises — it doesn't see a single frame.

**When to use:** Any workload where missing a beat costs data (here, frame drops or IMU samples). React Native's bridge — even with TurboModules and JSI — is not safe for 30-fps frame delivery.

**Trade-offs:**
- Pro: the spec's hard guarantees (REALTIME timestamp source, ±1 ms drift, KEY_LATENCY=1) live in code that Hermes can't perturb.
- Pro: 10-min auto-segmentation is purely native — close encoder, 0.5 s fixed gap, open encoder, IMU flush; no JS round-trip.
- Con: any product change to capture (e.g. add a frame-processor for live framing guides — explicitly out of scope, but a likely v2 ask) is a Kotlin/Swift change, not a JS change.

**Example state graph (native side):**

```
[idle] --start--> [opening-camera] --first-frame--> [armed]
   ^                    |                              |
   |                    +--error--> [fatal]            v
   |                                                  [recording] --10-min--> [segment-cut] --> [recording]
   |                                                       |                                          |
   |                                                       +--stop----------------------------+      |
   |                                                                                          |      |
   +<-----------[finalising]<-----[encoder-flush + csv-close + sha-256 + json-write]<--------+      |
                                                                                                     |
                                  +<-----[thermal-event]<------------------------------------------+
                                  |
                                  v
                              [thermal-kill] --> [finalising]
```

### Pattern 3: Two-clock upload — JS owns the queue model, native owns the live transfer

**What:** The MMKV-persisted `uploads` table (in `apps/mobile/src/state/stores/uploadsStore.ts`) is the system-of-record for "what files exist that we should be uploading". The native `HumynUpload` module is told "transfer file F starting at byte B with key K" and reports back chunk progress + completion. If the OS kills the process, the native daemon (UIDT job on Android, background URLSession on iOS) keeps going; on next launch, JS reads the queue, reconciles with whatever native still has in flight, and resumes.

**When to use:** Long-running transfers where the app is expected to be killed mid-transfer regularly (Android OEM battery optimisation, iOS user swipe-kill).

**Trade-offs:**
- Pro: a bug in JS upload logic doesn't lose bytes — the native daemon is the resilient half.
- Pro: clear blame in incidents. Crashlytics native vs JS error split says "did the daemon die or did the orchestrator?"
- Con: state-reconciliation logic on app cold-boot is non-trivial (see PITFALLS — orphan chunks, incomplete multipart UploadIds).

**Example reconciliation on cold start:**

```typescript
// apps/mobile/src/upload/reconcile.ts
async function reconcileOnLaunch() {
  const queueRows = uploadsStore.getState().rows;             // MMKV
  const inFlight = await HumynUpload.listInFlight();          // native asks the daemon
  const inFlightById = new Map(inFlight.map((r) => [r.recordingId, r]));

  for (const row of queueRows) {
    const live = inFlightById.get(row.recordingId);
    if (live) {
      // native still has it — adopt its progress as the truth
      uploadsStore.getState().setProgress(row.recordingId, live.bytesUploaded);
    } else if (row.status === 'uploading') {
      // we thought it was running but daemon doesn't have it → resume
      await HumynUpload.resume(row.recordingId, row.localPaths, row.uploadId, row.lastEtag);
    }
    // 'pending', 'failed', 'verified' rows need no reconciliation
  }
}
```

### Pattern 4: Single Postgres for hybrid task search (pgvector + ts_vector on the same row)

**What:** The `tasks` table carries both a `tsvector` column (for lexical/fuzzy fallback) and a `vector(384)` column (for semantic) populated from the task name + description. The `/tasks?q=` route runs both queries, blends scores, and returns the union ranked by a weighted sum.

**When to use:** Search workloads where the input is short (a query word or phrase) and the corpus is small (65 rows here, low hundreds even at v2). This is the canonical case for pgvector — no Pinecone, no Weaviate, no second store.

**Trade-offs:**
- Pro: one DB, one query plan, one set of migrations, one connection pool. The task corpus is small enough that the vector index fits in memory and recall is essentially perfect.
- Pro: idempotency-key cache, sessions, recordings, and search all live in the same Postgres — single backup, single restore drill.
- Con: embedding generation (server-side, on task seed) needs an embedding provider. OpenAI's `text-embedding-3-small` is the obvious default; a local `sentence-transformers/all-MiniLM-L6-v2` deploy is the cheaper alternative if the OpenAI dependency is undesirable. **Decision deferred to roadmap.**

**Example query:**

```sql
WITH semantic AS (
  SELECT id, 1 - (embedding <=> $1) AS score
  FROM tasks
  ORDER BY embedding <=> $1
  LIMIT 20
),
lexical AS (
  SELECT id, ts_rank(tsv, plainto_tsquery('english', $2)) AS score
  FROM tasks
  WHERE tsv @@ plainto_tsquery('english', $2)
  ORDER BY score DESC
  LIMIT 20
)
SELECT t.*, COALESCE(s.score, 0) * 0.7 + COALESCE(l.score, 0) * 0.3 AS blended
FROM tasks t
LEFT JOIN semantic s ON s.id = t.id
LEFT JOIN lexical  l ON l.id = t.id
WHERE s.id IS NOT NULL OR l.id IS NOT NULL
ORDER BY blended DESC
LIMIT 12;
```

### Pattern 5: API process and worker process share code, not lifecycle

**What:** `apps/api/` is one TS codebase, one Docker image, two ECS task definitions. The task that runs `node dist/server.js` is the Fastify HTTP API; the task that runs `node dist/workers/hash-verify.js` is the BullMQ consumer. They share DB models, the S3 client, types, and validation — but scale, deploy, and fail independently.

**When to use:** Any Fastify backend with non-trivial async work (here: re-hashing S3 objects after multipart completion). Splitting at the *deploy* boundary (different replicas, different scaling rules) without splitting at the *code* boundary (one repo, one CI, one type system).

**Trade-offs:**
- Pro: the worker is built and tested in lockstep with the API — type changes propagate at compile time.
- Pro: Worker can be scaled on queue depth (BullMQ provides queue-length metrics) independently of HTTP request volume.
- Con: a bad deploy that breaks one process likely breaks both (shared image). Mitigation is the standard ECS rolling-deploy + healthcheck flow.

### Pattern 6: Idempotency keys via short-lived Redis cache fronting a Postgres ledger

**What:** `POST /recordings` and `POST /task-requests` accept an `Idempotency-Key` header. The first hit caches the response in Redis (TTL 24 h) and persists `(method, route, body_hash, response_id)` in `idempotency` Postgres table (TTL 7 d). Subsequent hits with the same key return the cached response — even after Redis evicts, the Postgres row is the system of record.

**When to use:** Any non-GET endpoint that creates server-side state and could be retried by a client (network flake, cellular hand-off mid-request — both common on the target geos and devices).

**Trade-offs:**
- Pro: client retry is safe; the device doesn't need to know whether the first POST landed.
- Con: requires `body_hash` to detect the "same key, different body" abuse case (returns 422 with RFC 7807 detail).

## Data flow

### End-to-end: a single recording from tap-record to verified-and-deleted

```
1. User on Recording screen taps record button.
   ↓
2. JS recState: ready → pre-flight.
   recState fires:
     - HumynCapture.checkThermal()  → if THROTTLING+, abort, toast.
     - uploadsStore.pauseAll()      → tells native HumynUpload to pause in-flight.
   ↓
3. recState: pre-flight → gate.
   JS polls every 400 ms (Android) / 600 ms (iOS):
     a. Camera.takePhoto()  → file path
     b. HumynHandDetector.detectHands(path)  → number
     c. JS counts consecutive hits===2; on 5/3 → gate.confirmed, on miss → reset to 0
     d. Skip / native-unavailable → also gate.confirmed (with metadata flags)
   ↓
4. recState: gate.confirmed → active.
   JS calls HumynCapture.start({ taskId, isPractice, segmentMs }).
   JS drops brightness to 5%; if pass (not skip/bypass), TTS "Recording started" + 80 ms haptic.
   ↓
5. NATIVE (Android):
   a. CameraDevice.createCaptureSession(...) → 1080p30 ultrawide preview + encoder surfaces
   b. MediaCodec(video/hevc) configured: HEVCMain / 8 Mbps CBR / GOP 30 / no B / KEY_LATENCY=1
   c. AudioRecord (48 kHz mono) wired into MediaCodec(audio/aac) at 128 kbps
   d. SensorManager.registerListener(GYRO + ACCEL, SENSOR_DELAY_FASTEST, maxReportLatency=64ms)
   e. MediaMuxer (MP4_FRAGMENTED) opens; moov flushed every 30 s
   f. CSV writer opens; one row per IMU sample
   g. All three streams timestamped with SystemClock.elapsedRealtimeNanos
   h. Foreground service of type `camera | microphone | dataSync` started; persistent notif.
   ↓
6. (For 10 minutes — auto-segment cut at the 10:00 mark, configurable via Remote Config.)
   At cut: encoder.signalEndOfInputStream(); muxer.stop(); csv.close();
            SHA-256 of MP4 + CSV; drift compute (residual-subtraction methodology);
            metadata JSON written with all hashes + drift + start_gate; 0.5 s fixed gap;
            new file triple opened; encoder reconfigured (no preview teardown).
   No JS round-trip; no gate re-run; no TTS.
   Native fires JSI event: { type: 'segment-finalised', recordingId, mp4Path, csvPath, jsonPath, ... }.
   ↓
7. JS upon segment-finalised:
   a. recordingsStore.add({ recordingId, taskId, status: 'pending-upload', ... }) — MMKV persists
   b. uploadsStore.enqueue(recordingId)
   c. HumynUpload.enqueue(recordingId, { mp4Path, csvPath, jsonPath, hashes })
   ↓
8. JS calls POST /recordings (with Idempotency-Key = recordingId):
     body: { recordingId, taskId, fileSizes, hashes, durationS, capturedAt, ... }
   Backend:
     a. Authenticates session JWT
     b. Checks idempotency cache → first time, mints S3 multipart UploadId
     c. Computes parts (8 MB chunks); for each part, presigns a PUT URL valid 6 h
     d. Inserts recordings row (qa_status='pending', sha256_manifest=client-supplied)
     e. Returns { uploadId, parts: [{ partNumber, presignedUrl }, ...], completionUrl }
   ↓
9. NATIVE HumynUpload (Android UIDT job; iOS URLSession bg config):
   For each of 3 files (per spec — but spec also says "2 files in parallel" — see below):
     For each chunk concurrently × 3:
       a. PUT chunk to presigned URL
       b. Capture ETag from response
       c. On 5xx / network: exponential backoff 2/4/8/16/32/64 → DLQ
       d. Persist (recordingId, partNumber, etag) to MMKV after each success
   When file's chunks all PUT'd:
     POST completionUrl with { partNumber, etag } list
   ↓
10. S3 emits ObjectCreated → EventBridge → SQS hash-verify queue → BullMQ.
    Hash-verify worker:
      a. Streams MP4 from S3, computes SHA-256
      b. Streams CSV from S3, computes SHA-256
      c. Compares to recordings.sha256_manifest
      d. Match → recordings.qa_status='verified'; insert upload_events row (kind='verified')
      e. Mismatch → qa_status='hash-mismatch'; insert upload_events row (kind='re-upload')
   ↓
11. JS app, on next /me hit (or on a poll triggered by HumynUpload.completeAll for that recording):
    GET /recordings/{id} returns { ..., qa_status: 'verified' }.
    JS: HumynUpload.deleteLocal(recordingId) → native deletes mp4 + csv + json from sandbox.
    recordingsStore updates: status='verified', localPaths=null, thumbnail kept.
   ↓
12. uploadsStore.resumeAll() (already happened on stop) — anything new enqueued continues.
```

**Per spec §7.1 — 3 chunks in parallel per file × 2 files in parallel.** The native upload daemon must enforce this limit; pure URLSession config doesn't cap concurrency the way you'd want, so iOS needs an explicit `OperationQueue` with `maxConcurrentOperationCount = 6` feeding the background session. Android's UIDT job is a single `JobService` instance — concurrency is enforced inside the job's executor.

### Auth flow (Google ID token → Humyn session JWT)

```
1. App: Google Sign-In → Google ID token (JWT signed by Google).
2. App: HumynIntegrity.attest() → Play Integrity token (Android) / DeviceCheck or App Attest token (iOS).
3. App: POST /auth/google { googleIdToken, integrityToken, deviceModel, osVersion, appVersion, flavor: 'apkRollout' | 'playStore' | 'appStore' }
4. Backend:
   a. Verifies googleIdToken with Google's public keys (audience must match our OAuth client ID).
   b. Verifies integrityToken with Google's Play Integrity API (or Apple's DeviceCheck endpoint).
   c. Enforces verdict policy:
      - apkRollout flavor:  rooted ✗ | emulator ✗ | install-source unchecked
      - playStore flavor:   rooted ✗ | emulator ✗ | install-source must be PLAY_RECOGNIZED
      - appStore flavor:    DeviceCheck pass + (optionally) App Attest assertion
   d. Upserts users row by google.sub; reads/writes consent_log with terms version.
   e. Mints HS256 JWT signed with secret from AWS Secrets Manager:
      payload: { sub: userId, sid: sessionId, exp: now + 30d, flavor }
   f. Returns { accessToken, refreshToken, user }.
5. App: stores both in Keychain (iOS) / Android Keystore-backed EncryptedSharedPreferences.
   Sets api client default header `Authorization: Bearer <accessToken>`.
```

The session JWT is **HMAC-signed (HS256) over a secret in Secrets Manager**, not RS256. Reason: the API and the worker both need to verify; sharing one symmetric secret across two ECS tasks reading the same Secrets Manager entry is simpler than maintaining a JWKS endpoint at MVP. Revisit at v2 if client-side JWT verification ever becomes a thing (it shouldn't — the server is always the verifier).

### Forced-upgrade `/app/version`

**Stored in Postgres** in an `app_versions` table:

```sql
CREATE TABLE app_versions (
  platform        text PRIMARY KEY,             -- 'android' | 'ios'
  min_supported   text NOT NULL,                -- semver
  latest          text NOT NULL,
  force_upgrade   boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text                          -- who pushed this
);
```

**Why Postgres, not Firebase Remote Config:** the app already has a backend; an extra Firebase dependency for two values per platform is a worse hand-off than a 5-line route + an admin script. Firebase Remote Config is reserved for things that genuinely benefit from Google's CDN distribution (segment length, hand-gate `targetHits`/`cadenceMs`, MediaPipe confidences) per `engineering-handoff.md` §19. Forced upgrade gates blocking new app versions is a backend-emergency lever — keep the lever close.

**Cache:** the response is cached for 6 h client-side per spec.

## State management — the long-lived `recState` machine

The spec's `recState` (engineering-handoff §4.3) has 7+ states with non-trivial transitions, side-effects on every state entry (TTS, brightness, haptics, native calls), and must survive the gate substate's loading/waiting/confirmed branches. Two real options:

| Option | Verdict | Reason |
|--------|---------|--------|
| **XState (recommended)** | Use for `recState` | The state graph is a chart, not a flat enum. XState gives you typed transitions, entry/exit actions, parallel substates (e.g. `gate` parallel to `alerts`), guards (thermal, battery, gate count), and a visualizable diagram. The state shape from §4.3 is essentially an XState definition already. Pull `xstate` (no React-specific peer needed for the core machine; `@xstate/react` for the hook). |
| **Reanimated worklets** | Don't use for state | Reanimated worklets run on the UI thread and are designed for animation values that must update at 60 fps without crossing the JS bridge. State that changes on TTS callbacks, native events, and 400-ms hand-gate polls doesn't belong on the UI thread; it belongs in JS. Use Reanimated *for the UI* — the gate's progress ring stroke-dashoffset, the press-scale on the record button, brightness fade — but read the state from Zustand/XState in the JS layer. |
| Zustand | Use for everything else | The other stores (`auth`, `tasks`, `recordings`, `uploads`, `contrib`, `prefs`) are all flat key-value-ish — no state graphs. Zustand + `react-native-mmkv` persist middleware is the canonical 2025 RN stack for this. |
| Redux Toolkit | Don't pull in | Spec gives no requirement (no Redux DevTools workflow stipulated, no time-travel debugging, no middleware ecosystem need). Adding it for one state machine is overkill; XState covers the state-machine half better and Zustand covers the flat-store half lighter. |
| MMKV | Use for persistence under all stores | 30× faster than AsyncStorage; synchronous; battle-tested at WeChat scale. Use *separate MMKV instances* per concern (`app`, `recordings`, `uploads`) so a corrupt instance doesn't take down auth. |

### Persistence map (engineering-handoff §7.2 + locked spec)

| Surface | Storage | Why |
|---------|---------|-----|
| `auth.accessToken`, `auth.refreshToken` | iOS Keychain / Android Keystore (via `react-native-keychain`) | Tokens are sensitive; Keystore-backed encryption is the spec's locked answer |
| `user.profile`, `tasks.cache`, `contrib.cache`, `prefs` | MMKV instance `app` | Fast, frequent reads on render |
| `recordings.queue` (segment metadata, thumbnails refs, status) | MMKV instance `recordings` | Survives kills; small (≤ 1 KB / row) |
| `uploads` (per-recording UploadId, parts list with ETags, byte offsets, retry counts) | MMKV instance `uploads` | Survives kills; native HumynUpload reads/writes the same instance through a thin Kotlin/Swift MMKV binding (see PITFALLS — bidirectional MMKV access) |
| **IMU CSVs, MP4s, metadata JSONs** | App sandbox filesystem under `recordings/{ulid}/` (NOT MMKV — these can be GBs) | Locked by spec — files are byte-for-byte and never in MMKV |
| `consent.terms` (accepted version + timestamp) | MMKV instance `app` (and mirrored to backend `consent_log`) | Compliance trail must be local + remote |

**EncryptedSharedPreferences was floated in the question** — Android has it but it's slower than MMKV-with-encryption-key and the spec explicitly *rejects* extra client-side file encryption beyond Android FBE (PROJECT.md key decisions). Tokens go through Keystore via `react-native-keychain`; everything else uses plain MMKV. Android FBE (file-based encryption) handles disk-at-rest for the sandbox files transparently.

## Foreground service architecture (the most under-spec'd risk in the brief)

### Android 14+ — required types

The spec says `camera | microphone | dataSync`. That's the right combination *during recording*. **But the spec uses the same type for upload** — and that's where Android 14/15 changes break it.

| Phase | Service type | Constraints |
|-------|--------------|-------------|
| **During recording (foreground)** | `camera | microphone | dataSync` | Must be started while app is in foreground (or via UIDT-equivalent). Camera and microphone types have **while-in-use** restrictions — the service must be started while the app has CAMERA/RECORD_AUDIO foreground access |
| **Upload while app is active** | Same `dataSync` foreground service can carry the upload queue too | Allowed |
| **Upload after app is backgrounded** | **`dataSync` is capped at 6 h / 24 h on Android 15+** | Hits the cap and the OS calls `Service.onTimeout()` and stops the service |
| **Upload after app is killed** (the hardest case) | Must use a **user-initiated data transfer (UIDT) JobService** registered with `setUserInitiated(true)` | UIDT is the modern Android answer (introduced in Android 14, API 34). Survives process death. Requires user-visible notification |

**Implication:** `HumynUpload` is **two services in a trench coat**:

1. A `dataSync` foreground service that fronts the upload queue while the app is in the foreground (so it shares the same notification with the camera service during a recording-then-immediate-upload flow).
2. A `JobService` declared as a UIDT with `RUN_USER_INITIATED_JOBS` permission, which is what actually owns the chunk PUT loop. The foreground service starts/stops the UIDT job.

For Android 13 and below, fall back to a long-running foreground service of type `dataSync` only (no UIDT API exists). This is the "WorkManager + foreground service" pattern Android Devs document.

**Why the spec's "request battery-optimization exemption at first upload" still matters:** OEM modifications (Xiaomi MIUI, OnePlus OxygenOS) can override AOSP behavior even with UIDT. The exemption is a belt-and-suspenders.

### iOS — URLSession background config

The iOS analogue is conceptually simpler:

```swift
let config = URLSessionConfiguration.background(withIdentifier: "ai.humynlabs.upload")
config.sessionSendsLaunchEvents = true           // wake the app when transfers complete
config.isDiscretionary = false                   // don't let the OS defer based on power/network
config.allowsCellularAccess = true               // cellular allowed by default per spec
config.allowsConstrainedNetworkAccess = true
config.allowsExpensiveNetworkAccess = true
let session = URLSession(configuration: config, delegate: HumynUploadDelegate(), delegateQueue: nil)
```

Behavior summary:
- **App backgrounded:** `nsurlsessiond` daemon continues transfers; app is woken via `application(_:handleEventsForBackgroundURLSession:completionHandler:)` when transfers finish.
- **App killed by OS (memory pressure):** transfers continue; app re-launched with the same identifier can reattach.
- **App killed by user swipe-up:** **all background transfers are terminated.** This is the iOS equivalent of the Android force-quit case; the spec already calls it out ("On user swipe-kill on iOS: limited; uploads paused, resumed on next launch. Communicate this in onboarding.").
- **Uploads must reference a file**, not in-memory data. URLSession background tasks require a `URL` to a file, which fits perfectly with the spec (chunks are slices of the on-disk MP4; iOS implementation streams chunk subranges to temp files or uses byte-range subresources via custom delegate).

**Multipart caveat (per AWS Amplify iOS issue #3173):** `URLSession.uploadTask(with:fromFile:)` for an S3 multipart *complete-multipart-upload* call (the final XML POST) can fail to wake the app if the call is the last thing pending. Mitigation: ensure the `completionUrl` POST is a regular `dataTask` (not a background uploadTask), made from inside `urlSessionDidFinishEvents(forBackgroundURLSession:)`.

### iOS background equivalents per platform-line

| Android | iOS |
|---------|-----|
| `FOREGROUND_SERVICE_TYPE_CAMERA` | `AVAudioSession.setCategory(.record, mode: .videoRecording)` + UIBackgroundTaskIdentifier for short tail-end work |
| `FOREGROUND_SERVICE_TYPE_MICROPHONE` | (same — bundled into the AVAudioSession config) |
| `FOREGROUND_SERVICE_TYPE_DATA_SYNC` | `URLSession.background(...)` |
| UIDT JobService | (no direct equivalent; URLSession bg + iOS's automatic relaunch covers most cases) |

## Scaling considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| **0 → APK rollout (early users, ≤ 1000 / day)** | Single ECS task each for API and worker; single-AZ RDS; single-replica Redis. LocalStack-equivalent dev still works. CloudFront on day 1 because signed-URL playback needs it anyway |
| **Play Store launch — day 0 (≥ 500–1000 hr/day, 200–300 simultaneous uploads)** | API: 3+ ECS replicas behind ALB (ALB sticky sessions OFF — JWT means stateless). Worker: 2+ replicas. RDS Postgres `db.r7g.large` with read replica for `/tasks` search; primary serves writes. ElastiCache Redis multi-AZ. S3 Transfer Acceleration on the bucket (worth measuring on India/Brazil cellular) |
| **Scaling toward 1M hours** | API horizontally scales fine (stateless). Worker scales on queue depth — BullMQ exposes queue length as a metric, set ECS service auto-scaling on that. **First bottleneck is hash-verify throughput** (re-hashing GBs of video from S3 is I/O-bound, not CPU-bound, but you need bandwidth into Fargate). Mitigations: (a) move worker into the same AZ as the bucket; (b) at sufficient scale, switch hash-verify to a Lambda triggered by S3 EventBridge directly (Lambda has 15-min wall, fine for ≤ 6 GB videos at 1.5 sec/GB read). **Second bottleneck is RDS** — the recordings insert rate at 1M hr/day across ~10-min segments is ~110/sec, comfortable for `r7g.large` but worth a partition strategy (monthly partitioning on `recordings.captured_at`) before peak |

### Scaling priorities

1. **First bottleneck: hash-verify worker compute + bandwidth.** At ≥ 500 hr/day, that's ~3000 segments to re-hash daily, each averaging ~500 MB. Fargate at ~1 Gbps × 1 worker can keep up; at 1M hr/day, you need multiple workers or to switch to S3-EventBridge → Lambda.
2. **Second bottleneck: cellular upload completion latency.** Not architectural — fix with S3 Transfer Acceleration + CloudFront for ingestion (S3 supports POST with TA endpoint) on the India/Brazil routes.
3. **Third bottleneck: `/tasks` search at scale.** Even at 100k DAU on a 65-row corpus, this is a non-issue. If task corpus grows past ~10k rows in v2, add an HNSW index on the vector column.

## Anti-patterns

### Anti-pattern 1: Putting the upload daemon in JS

**What people do:** Let JS open `fetch()` / `XMLHttpRequest` / `axios` against presigned URLs and chunk in JS. "It's so much easier."
**Why it's wrong:** RN's HTTP layer doesn't survive process kill. Hermes GC pauses cause chunk-stall bugs that show up only in production. OEM battery optimisation kills the JS thread silently; you only learn from analytics weeks later.
**Do this instead:** native daemon owns transfers; JS owns the queue model. Pattern 3 above.

### Anti-pattern 2: Transcoding "for compatibility"

**What people do:** "Let's just re-encode to baseline H.264 server-side so older browsers can play it back." Or: "Let's strip the metadata the encoder put there because it's noisy."
**Why it's wrong:** training pipeline expects exact encoder bytes — every metadata box, every timestamp tag, every nuance of the bitstream. Re-encoding loses what makes egocentric data *good* training data. PROJECT.md locks "Files never re-encoded" for this reason.
**Do this instead:** server treats the MP4 as opaque. Hash-verify reads bytes, compares hashes, never decodes. Player playback uses the original file.

### Anti-pattern 3: One MMKV instance for everything

**What people do:** `MMKV.getInstance()` everywhere; all keys in one store.
**Why it's wrong:** MMKV instances are atomic per-instance; one corrupted write can wedge the whole store. If `auth` and `uploads` share a store, a logout race can knock out a in-flight upload's bookkeeping.
**Do this instead:** separate MMKV IDs (`app`, `recordings`, `uploads`). Each is a separate file; corruption is isolated.

### Anti-pattern 4: Hand-gate state in Reanimated worklets

**What people do:** "The ring is a Reanimated component, so put `consecutiveHits` in a `useSharedValue` and update it from the worklet."
**Why it's wrong:** the gate's logic is JS (calls `Camera.takePhoto()` then a native module — neither is safe in a worklet). The shared value would be set from JS, defeating the worklet's purpose. And on Skip / silent-bypass, you'd be juggling state across two threads for no perf gain.
**Do this instead:** state lives in JS (XState slot or Zustand). Reanimated reads it via `useDerivedValue`. The ring's animation parameters are derived; the *truth* is in JS.

### Anti-pattern 5: Single Postgres connection pool shared between API and worker

**What people do:** `pg.Pool({ max: 30 })` constructed in shared code, imported by both API and worker.
**Why it's wrong:** API connection demand is bursty (many short transactions); worker demand is steady (long-running re-hash transactions hold connections). They contend for the same pool ceiling.
**Do this instead:** each process constructs its own pool with appropriate sizing — API ~20, worker ~5. Same code module, different config.

### Anti-pattern 6: Trying to play back MP4s after local delete via the backend

**What people do:** Build a streaming endpoint or signed-URL flow for "view your old recording from server."
**Why it's wrong:** PROJECT.md explicitly takes this out of scope ("Streaming uploaded recordings back from the server after local copy is cleared — playback only while local exists"). Building it on a hunch wastes a phase.
**Do this instead:** History row's tap-thumbnail shows the "securely uploaded, local copy cleared" message after the local delete. CloudFront signed URLs are still needed for the practice-during-onboarding playback case, **but only while local copy exists** — keep the surface tiny.

### Anti-pattern 7: Allowing hash-verify mismatch to silently re-upload

**What people do:** "Hash mismatch → tell the app to re-upload" — done.
**Why it's wrong:** hash mismatches at scale signal something real (a buggy device firmware, a corruption-prone OEM file system, an MMKV race). Losing them in a generic "re-upload" event removes the signal.
**Do this instead:** record `qa_status='hash-mismatch'` in `recordings`, log a structured event with device model + OS version + segment ID, and *then* tell the app to re-upload. After two re-uploads with persistent mismatch on the same device, route to a soft-flag bucket for triage.

## Integration points

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| Google Sign-In | Standard OAuth2 ID token; passed to backend, verified against Google's JWKS | iOS uses GoogleSignIn-iOS SDK; Android uses Credential Manager (modern) or Google ID Services |
| Play Integrity API | `PlayIntegrityClient.requestIntegrityToken(...)` on Android; nonce minted by backend, returned token verified by backend with Google's API | Per-flavor verdict policy — APK rollout doesn't enforce `PLAY_RECOGNIZED` |
| DeviceCheck + App Attest (iOS) | DCDevice for v1; App Attest if/when fraud volume justifies adding key attestation | DeviceCheck is sufficient for "is this a real device with my app installed" — App Attest is heavier and deferred |
| Firebase Crashlytics | Native + JVM crash + ANR (Android), Mach + ObjC + Swift (iOS) | Symbolicate flow on iOS: dSYM upload during build via `pod_install` post-script + Fastlane (or manual upload) — dSYMs are produced by Xcode for Release builds and stored in `~/Library/Developer/Xcode/Archives/...`; Crashlytics-CLI uploads them. Add a CI step `firebase crashlytics:symbols:upload` |
| Firebase Analytics | Standard SDK (Android + iOS); event names from engineering-handoff §11 | Throttling via the JS telemetry wrapper; `tasks_search` debounced 400 ms; query content stripped (only length logged) |
| Firebase Remote Config | Hand-gate `targetHits` / `cadenceMs` / confidences; segment length; APK-flavor install-source bypass scope | Optional in v1 — could ship with hardcoded values from the spec and add Remote Config in a later phase |
| MediaPipe Tasks Vision | Maven (`com.google.mediapipe:tasks-vision`) on Android; CocoaPod (`MediaPipeTasksVision`) on iOS | Single shared `hand_landmarker.task` (~7.8 MB) — wired into both platforms via `shared-native/` |
| AWS S3 | Multipart upload with presigned PUT URLs per chunk + presigned multipart-complete URL | Bucket is the only storage; lifecycle rule `AbortIncompleteMultipartUpload` after 24 h prevents orphan-chunk billing |
| AWS Secrets Manager | JWT signing secret, CloudFront signing key pair, S3 bucket-policy-credentials, RDS password (rotation enabled) | Parameter Store would also work but Secrets Manager has rotation primitives that beat rolling our own |
| AWS CloudWatch | Default destination for ECS task logs (pino → stdout → awslogs driver) | "Observability is intentionally thin per idea-brief §12" — see PITFALLS for whether that holds at 1M-hour scale |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| JS layer ↔ HumynCapture | JSI synchronous calls + JSI events | Commands: start/stop/pause/resume; Events: preview-ready, segment-finalised, fatal |
| JS layer ↔ HumynUpload | JSI synchronous calls + JSI events | Commands: enqueue/pauseAll/resumeAll/deleteLocal/listInFlight; Events: progress, file-complete, all-complete, fatal |
| HumynCapture ↔ HumynUpload | **No direct call**; mediated by JS | When capture finalises a segment, JS receives the event and explicitly hands the file paths to upload. Keeps native modules decoupled |
| API ↔ Worker | BullMQ job + Postgres row | Worker reads `recordings.id` from job payload, hits S3, updates `recordings.qa_status`. API reads back on next client request |
| API ↔ S3 | Presigned URLs (mint outbound; never proxy bytes) | API never touches MP4 bytes. Worker is the only backend code that streams from S3 |
| Mobile JS ↔ Backend | REST + JSON (Zod-validated on both sides via shared schemas) | RFC 7807 problem+json on errors; Idempotency-Key on creates |
| Mobile native ↔ Backend | **None directly.** All API calls go through JS | Single point of network observability and auth-header injection |

## Build-order implications (for the roadmap)

The dependencies between components dictate a critical path. The roadmap should respect these blockers:

```
[Phase 0: Monorepo + tooling] —— blocks everything else
       │
       ├─► [Phase 1a: Backend skeleton — API + Postgres + LocalStack S3 + JWT auth + /tasks]
       │         │
       │         └─► [Phase 1b: Hash-verify worker stub (runs locally; no S3 events yet)]
       │
       ├─► [Phase 2a: Mobile shell — RN + nav + design tokens + screens up to Compat]
       │         │
       │         └─► [Phase 2b: Mobile auth flow + Google Sign-In + Play Integrity]
       │
       ├─► [Phase 3: HumynCapture native module — Camera2 + MediaCodec + IMU + audio + drift compute]
       │         (the slowest, riskiest phase; can parallelize with phase 2 if a second engineer)
       │
       ├─► [Phase 4: HumynHandDetector native module] — depends on Phase 3 only insofar as
       │         it needs the camera-preview surface; can be built mostly in isolation against
       │         a static image fixture
       │
       ├─► [Phase 5: HumynUpload native module + foreground service / UIDT job + URLSession bg]
       │         depends on: Phase 1 backend (presigned URL endpoints) + Phase 3 (so there's
       │         a real recording to test against — synthetic files work fine for early dev though)
       │
       ├─► [Phase 6: Hash-verify wired end-to-end] — depends on Phase 1b + Phase 5 + S3 EventBridge
       │
       ├─► [Phase 7: Polish + iOS analogues for everything Android — AVCaptureSession,
       │         CMMotionManager, MediaPipe iOS, URLSession bg]
       │
       └─► [Phase 8: Distribution — Play Internal Track + Test Flight + APK signing pipeline]
```

### Dependency cliffs

These are the points where one component genuinely blocks another, not just inconveniences it:

1. **Backend `/recordings` (presigned URL minting) blocks any real upload testing.** Stub with LocalStack + a mock; ship the real route in phase 1.
2. **HumynCapture's metadata JSON output blocks `POST /recordings` body shape.** The schema in `video_metadata.json` has to be locked before the backend writes the route handler. Both depend on `shared/types/Recording.ts`, so write the Zod schema first.
3. **HumynCapture must produce a real MP4 + CSV before HumynUpload can be tested end-to-end** (synthetic files work for unit tests, but you can't validate "did the device hash match the server hash" without real bytes coming out of the encoder).
4. **Phase 6 (hash-verify wired end-to-end) requires Phase 5 plus S3 EventBridge plus the worker plus the client `verified` event read** — this is the longest critical-path edge in the graph and the most likely place to see a 2-week slip.
5. **iOS analogues block App Store submission, not Play Store.** iOS work can lag Android by a phase as long as the hand-off is anticipated. PROJECT.md locks ≤ 2 weeks after Play Store, so iOS phase starts during Android phase 7-equivalent.
6. **APK build flavor + Play-Store install-source-bypass-via-Remote-Config has to exist before APK rollout.** This is a tiny piece of work but easy to forget — it's a build-system concern, not a feature concern.

### What can be parallelized

- **Mobile shell (Phase 2a/2b)** can run alongside **HumynCapture (Phase 3)** if you have two devs — the shell uses stub native modules from Phase 0.
- **HumynHandDetector (Phase 4)** can run alongside **HumynUpload (Phase 5)** — they don't share native code.
- **Backend `/tasks` semantic search (pgvector seeding + embedding pipeline)** can run alongside everything from Phase 2 onward — it's only consumed when the Tasks screen is built.
- **iOS work** can run as a parallel track from Phase 3 if a second engineer is dedicated; otherwise it's a tail-end phase.

## Risk callouts (where the locked spec implies an architecture choice that's harder than it looks)

### Risk 1: Android 15 `dataSync` 6-hour cap forces UIDT jobs

**What:** Spec says foreground service of type `dataSync` for upload. Android 15 (which Pixel 10a will run by app-launch time, and 50%+ of the target population by year-end) caps `dataSync` foreground services at 6 hours per 24-hour window. At target scale (a clan member running back-to-back recording-and-upload sessions for a half-day), the upload service will hit the cap.

**Mitigation:** Use a UIDT JobService for the upload (introduced Android 14, stable in 15). Foreground service is the umbrella while in-app; UIDT carries the load while killed. Spec doesn't call this out — roadmap should.

**Detection:** `Service.onTimeout()` will be called; surfaces in `recording_alert` analytics if not handled.

### Risk 2: Hash-verify worker placement (BullMQ vs Lambda) is a deferred decision

**What:** The spec says "hash-verify pipeline" without specifying compute. Two valid options: BullMQ + ECS (recommended above) or Lambda triggered by S3 EventBridge.

**Recommendation:** **BullMQ + ECS at MVP**, switch to Lambda at scale.

**Why:**
- ECS keeps the worker in the same TS codebase — type sharing, single deploy story, easy local dev (just `node dist/workers/hash-verify.js`).
- BullMQ gives retry, DLQ, job inspection (Bull-Board) for free.
- Lambda has cold-start latency and a 15-min wall (fine for ≤ 6 GB videos but you have to think about it).
- At 1M hr/day, switch the trigger to S3 EventBridge → Lambda directly (skip BullMQ) for fan-out parallelism. The Lambda has the same code; same DB writes. This is a configuration switch, not a rewrite.

**Confidence:** MEDIUM — both work; this is a sequencing choice.

### Risk 3: Observability is "intentionally thin" — confirm appropriate at 1M-hour scale

**What:** Spec defers Sentry / Datadog / structured logging beyond CloudWatch defaults to v2.

**Assessment:** Appropriate at MVP through Play Store launch. **Will not hold past first 50k DAU** because:
- Hash-mismatch incidents will need cohorting by device model / OS version — Crashlytics doesn't show structured logs alongside crashes.
- Upload failure clustering by network type / time-of-day needs a warehouse (CloudWatch Insights queries are too slow for ad hoc clustering at scale).
- The worker's queue depth + per-job latency need a dashboard the team can act on; Bull-Board is fine for ops triage but not for SLO tracking.

**Recommendation for roadmap:** Plan to add structured logs aggregation (Loki, Grafana Cloud, or CloudWatch Logs Insights with a dashboard) and a queue-metrics dashboard before Play Store 100% rollout. Sentry can wait until iOS App Store crash data starts coming in.

**Confidence:** MEDIUM — spec is right that this isn't day-1 critical, but the roadmap should explicitly mark "observability uplift" as a phase before scale-out, not as a v2 wish.

### Risk 4: `HumynUpload` reading the same MMKV instance as JS

**What:** The native upload daemon needs to read the queue (paths, hashes) and write progress (chunk ETags, retry counts). JS also reads/writes the same data. Two readers/writers across language boundaries on the same MMKV instance means concurrent-write races.

**Mitigation:** MMKV is process-safe (it's mmap-backed with file locks under the hood). Use it for *checkpointing* — JS writes the queue rows, native reads them on `enqueue` and writes per-chunk progress. **Never have JS and native write the same key concurrently.** Specifically, JS owns `queue.row.{id}` writes (status, paths); native owns `queue.row.{id}.chunks.{partNumber}` writes (etag, status). Different key prefixes, no collision.

**Detection:** Add a `chunks_dump` event in the diagnostic harness that prints the entire `uploads` MMKV instance — eyeball test catches missing keys.

**Confidence:** HIGH that the pattern works; MEDIUM that the locked spec accounts for this — the roadmap should set the key-prefix rules explicitly.

### Risk 5: Hand-gate `takePhoto()` cadence vs frame-processor

**What:** Engineering-handoff §19 lists this as an open question. Locked at `takePhoto` for v1. iOS shutter latency on certain models (iPhone 13 Pro, the perf-min) can blow past the 600 ms cadence.

**Mitigation:** Empirically validate on iPhone 13 Pro before App Store rollout. If shutter latency dominates, switch to a `VisionCamera`-style frame-processor plugin on iOS only — a one-call C++/Swift hook into the AVCaptureSession output, no full takePhoto ceremony. The Android side stays on `takePhoto()` (Camera2 has an equivalent low-latency capture path; doesn't need the change).

**Confidence:** HIGH that the issue is real; MEDIUM that the takePhoto path will hold across the iOS device matrix.

### Risk 6: First-segment upload latency on 1080p × 10-min files is high on India/Brazil cellular

**What:** A 10-minute 8 Mbps CBR HEVC segment is ~600 MB. At 3 chunks × 8 MB × 1 file (most cellular only does ~1 file in parallel cleanly), plus a typical India 4G upstream of ~3 Mbps, you're at ~26 minutes of wall time per segment. Two parallel files = doubled if the user records back-to-back.

**Mitigation:**
1. S3 Transfer Acceleration on the bucket (requires a different presigned URL host, ~5-line code change).
2. CloudFront PUT-through ingestion is also possible (CloudFront → S3) — measure first.
3. Reduce parallel files to 1 on cellular; allow 2 only on Wi-Fi (network-type detection in HumynUpload).

**Confidence:** HIGH that this matters in production; the testing-guide §B.3.6 already calls out testing under "Edge" / "3G" / "Lossy WiFi" but doesn't prescribe TA.

### Risk 7: Build flavors must encode the install-source-bypass scope correctly

**What:** Spec: "APK build flavor bypasses install-source check via Remote Config (Play Store builds cannot opt into the bypass). Bypass is scoped to that flavor's app ID."

**Implication:** Three things must be true simultaneously:
1. The `apkRollout` flavor has a different `applicationId` (e.g. `ai.humynlabs.capture.apk`) than the `playStore` flavor (`ai.humynlabs.capture`) — Android co-installation requires this.
2. Remote Config has a parameter `enforce_install_source` keyed by `applicationId` — defaults to `true`, overridden to `false` only for the apk flavor's app ID.
3. The backend's `/auth/google` flavor field must match the build flavor; the backend is the verifier. Mismatch → reject.

**Confidence:** HIGH that this works; MEDIUM that all three are in the roadmap as one phase rather than spread across three.

## Sources

- [Android Foreground service types | Android Developers](https://developer.android.com/develop/background-work/services/fgs/service-types) — verified the `camera | microphone | dataSync` permission model
- [Foreground service types are required | Android 14 Developers](https://developer.android.com/about/versions/14/changes/fgs-types-required) — Android 14 requirement to declare types
- [Foreground service timeouts | Android Developers](https://developer.android.com/develop/background-work/services/fgs/timeout) — the 6-hour `dataSync` cap on Android 15
- [User-initiated data transfer | Android Developers](https://developer.android.com/develop/background-work/background-tasks/uidt) — UIDT JobService API for long-running uploads
- [Data transfer background task options | Android Developers](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options) — choosing between WorkManager, UIDT, foreground service
- [URLSession: Common pitfalls with background download & upload tasks](https://www.avanderlee.com/swift/urlsession-common-pitfalls-with-background-download-upload-tasks/) — `sessionSendsLaunchEvents`, swipe-kill behavior, multipart caveats
- [Background uploads with NSURLSession | Apple Developer Forums](https://developer.apple.com/forums/thread/10239) — confirming app-killed-by-system relaunch via the same identifier
- [AWS Amplify iOS issue #3173 — Multipart Uploads not completing when app is terminated](https://github.com/aws-amplify/aws-sdk-ios/issues/3173) — the multipart-complete-from-bg-task gotcha
- [React Native TurboModules introduction](https://reactnative.dev/docs/turbo-native-modules-introduction) — JSI synchronous-call pattern for native modules
- [react-native-mmkv WRAPPER_ZUSTAND_PERSIST_MIDDLEWARE](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_ZUSTAND_PERSIST_MIDDLEWARE.md) — official Zustand+MMKV adapter pattern
- [Reanimated Worklets documentation](https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets/) — worklet boundary; why state machines don't belong on the UI thread
- [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) — multipart spec, ETag returns, completion API
- [Uploading objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) — presigned URL signing for PUT chunks
- [BullMQ documentation](https://docs.bullmq.io/) — Redis-backed queue semantics, worker lifecycle, retry, DLQ
- [Configure build variants | Android Studio | Android Developers](https://developer.android.com/build/build-variants) — productFlavors + applicationIdSuffix for the APK-vs-Play case
- Locked-spec inputs (Homelander project): `idea-brief.md`, `engineering-handoff.md`, `testing-guide.md`, `video_metadata.json`, `figure-app-hands.md`, `task-taxonomy.md`, `PROJECT.md`

---
*Architecture research for: Android-first React Native + native-modules data-collection app (Homelander / Humyn Labs Capture)*
*Researched: 2026-05-07*
