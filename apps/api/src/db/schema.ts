import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  customType,
  primaryKey,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// pgvector custom type (Drizzle 0.45 has no helper)
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 384})`;
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string) {
    return JSON.parse(value);
  },
});

// tsvector custom type — Postgres maintains the column via GENERATED ALWAYS in 0001_init.sql
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

// === Enums ===

export const qaStatusEnum = pgEnum('qa_status', [
  'pending',
  'uploaded',
  'verified',
  'hash-mismatch',
  'rejected',
  'takedown',
]);

export const flavorEnum = pgEnum('build_flavor', ['apkRollout', 'playStore', 'iosAppStore']);

export const integrityVerdictEnum = pgEnum('integrity_verdict', ['passed', 'bypassed_apk']);

export const settingEnum = pgEnum('task_setting', ['indoor', 'outdoor', 'either']);

export const taskRequestStatusEnum = pgEnum('task_request_status', [
  'pending',
  'reviewed',
  'rejected',
  'accepted',
]);

// (Enh 3 / D1, 2026-06-04: the `recording_event_type` enum + recording_events_outbox
// + recordings_to_verify were removed with the hash-verify flow. The qa_status enum
// keeps its legacy 'verified' / 'hash-mismatch' values — Postgres can't cheaply drop
// enum values — but nothing writes them anymore; they're read as success synonyms.)

// === Tables ===

// users — Phase 1 root entity
export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 26 }).primaryKey(), // ULID
    googleSub: text('google_sub').notNull().unique(), // Google account ID
    email: text('email').notNull(),
    name: text('name').notNull(),
    age: integer('age'), // nullable per AUTH-04
    gender: text('gender'), // nullable
    avatarUrl: text('avatar_url'),
    // Denormalized consent — D-LEGAL-03
    consentVersion: text('consent_version').notNull(),
    consentAcceptedAt: timestamp('consent_accepted_at', { withTimezone: true }).notNull(),
    // DSR — erasure only at MVP (D-LEGAL-02)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deleteGraceUntil: timestamp('delete_grace_until', { withTimezone: true }),
    // Tracking
    flavor: flavorEnum('flavor').notNull(),
    applicationId: text('application_id').notNull(),
    // Bug 4 / D2 (2026-06-04) — single-device newest-login-wins. The most-recent
    // sign-in's installationId; requireAuth 401s any JWT whose installationId
    // diverges. Nullable: pre-Bug-4 rows carry NULL until the next sign-in
    // (their legacy JWTs lack the claim and are forced to re-sign-in). Overrides
    // LOCKED D-AUTH-03 (stateless 30-day JWT, no denylist).
    currentInstallationId: text('current_installation_id'),
    // Bug 5 / D7 (2026-06-04) — practice-tutorial completion, server-side. Set
    // once (idempotent) when the user reaches PracticeComplete; surfaced on
    // GET /me so a fresh install / new device skips the tutorial forever
    // (the client seeds its local ONB-08 flag from this). Nullable: pre-Bug-5
    // rows + users who haven't finished practice carry NULL.
    practiceCompletedAt: timestamp('practice_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    googleSubIdx: uniqueIndex('users_google_sub_uniq').on(t.googleSub),
    deletedIdx: index('users_deleted_idx').on(t.deletedAt),
  }),
);

// profiles — extra fields not on User (joined date is users.createdAt; profile has support diagnostics + counters)
export const profiles = pgTable('profiles', {
  userId: varchar('user_id', { length: 26 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  lifetimeContributionMs: bigint('lifetime_contribution_ms', { mode: 'number' })
    .notNull()
    .default(0),
  taskCount: integer('task_count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// tasks — RESEARCH §1.1 verbatim
export const tasks = pgTable(
  'tasks',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    setting: settingEnum('setting').notNull(),
    iconKey: text('icon_key').notNull(),
    instructions: jsonb('instructions').notNull().$type<string[]>(), // max 3, validated at write
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    // GENERATED ALWAYS column — written by 0001_init.sql; Drizzle treats as opaque
    nameSearch: tsvector('name_search').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('tasks_slug_uniq').on(t.slug),
    categoryIdx: index('tasks_category_idx').on(t.category),
    // GIN + HNSW indexes are added in 0001_init.sql by hand
  }),
);

// task_requests — user-submitted task ideas (API-05)
export const taskRequests = pgTable('task_requests', {
  id: varchar('id', { length: 26 }).primaryKey(),
  userId: varchar('user_id', { length: 26 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(), // 3-80 chars
  description: text('description').notNull(), // 10-240 chars
  category: varchar('category', { length: 40 }).notNull(), // taxonomy or 'Other'
  setting: settingEnum('setting').notNull(),
  sampleVideoS3Key: text('sample_video_s3_key'), // optional
  status: taskRequestStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// recordings — mirrors video_metadata.json shape; Phase 5 hash-verify reads back
export const recordings = pgTable(
  'recordings',
  {
    id: varchar('id', { length: 26 }).primaryKey(), // ULID, equals device-side recording_id
    userId: varchar('user_id', { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    taskId: varchar('task_id', { length: 26 })
      .notNull()
      .references(() => tasks.id, { onDelete: 'restrict' }),
    practice: boolean('practice').notNull().default(false),
    qaStatus: qaStatusEnum('qa_status').notNull().default('pending'),
    // Capture spec — verbatim from video_metadata.json
    durationMs: integer('duration_ms').notNull(),
    // (Enh 3 / D1, 2026-06-04: file_sha256 / imu_sha256 removed — upload
    // verification + all hashing dropped; migration 0011 drops the columns.)
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    imuSizeBytes: bigint('imu_size_bytes', { mode: 'number' }).notNull(),
    // Drift figures (drift_metrics memory)
    imuVideoDriftMaxMs: integer('imu_video_drift_max_ms'),
    imuVideoDriftMeanMs: integer('imu_video_drift_mean_ms'),
    imuVideoDriftP99Ms: integer('imu_video_drift_p99_ms'),
    imuMinRateHzObservedP1: integer('imu_min_rate_hz_observed_p1'),
    // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — the whole
    // metadata.json `calibration` block (camera intrinsics + cam-IMU
    // extrinsics) mirrored as queryable jsonb. Nullable: older clients /
    // pre-1.2.0 segments send nothing. Non-indexed telemetry — not
    // authorization-bearing (T-elm-02).
    calibration: jsonb('calibration'),
    // Bug 3 / D3 (2026-06-04) — precise GPS block { lat, lng, accuracy_m,
    // provider, captured_at, label } mirrored from metadata.json's
    // `capture_device_info.location` (schema 1.5.0) as queryable jsonb.
    // Nullable: a segment with no fix, or a pre-1.5.0 client, sends null.
    // Overrides the formerly-LOCKED coarse-only constraint (sign-off D3;
    // consent + DPIA is a ship gate). Non-indexed; sibling to ip_address.
    location: jsonb('location'),
    // Storage references
    s3KeyVideo: text('s3_key_video').notNull(),
    s3KeyImu: text('s3_key_imu').notNull(),
    s3KeyMetadata: text('s3_key_metadata').notNull(),
    // Bug 6 / D5 (2026-06-04) — server-generated poster JPEG for cross-device
    // History thumbnails (recordings/{userId}/{recordingId}/thumb.jpg). Nullable +
    // best-effort: NULL when ffmpeg generation failed at /finalize or for legacy
    // rows; the client then falls back to its local ledger thumb / gradient.
    s3KeyThumbnail: text('s3_key_thumbnail'),
    // Liveness — populated in Phase 5; nullable here
    livenessScore: integer('liveness_score'), // stored as 0..100 integer (display as /100)
    // Timestamps
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    uploadStartedAt: timestamp('upload_started_at', { withTimezone: true }),
    uploadCompletedAt: timestamp('upload_completed_at', { withTimezone: true }),
    // (Enh 3 / D1: verified_at removed — no verify step; migration 0011 drops it.)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // For ip_address null-from-client + server-populated (UP-18)
    ipAddress: text('ip_address'),
    // Build flavor of the producing client (for fraud/cohort analysis)
    flavor: flavorEnum('flavor').notNull(),
    // Multipart upload tracking (added in plan 01-07 / migration 0003)
    s3UploadId: text('s3_upload_id'), // AWS multipart upload ID — null until /init creates it
    partsCount: integer('parts_count'), // Number of parts the client will upload (1..1000)
  },
  (t) => ({
    userCapturedIdx: index('recordings_user_captured_idx').on(t.userId, t.capturedAt),
    qaStatusIdx: index('recordings_qa_status_idx').on(t.qaStatus),
    taskIdx: index('recordings_task_idx').on(t.taskId),
    // Bug 10 (2026-06-04) — covering index for the two /contributions per-user
    // scans (WHERE user_id = ? AND qa_status …, aggregating duration_ms + task_id).
    // The INCLUDE (duration_ms, task_id) payload is expressed in migration 0016
    // only — drizzle-orm 0.45 has no `.include()` builder — so this declaration
    // is the (user_id, qa_status) prefix; the migration is the source of truth.
    userQaIdx: index('recordings_user_qa_idx').on(t.userId, t.qaStatus),
  }),
);

// contributions — denormalized aggregate per user per day for /contributions/timeseries
export const contributions = pgTable(
  'contributions',
  {
    userId: varchar('user_id', { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bucketDate: text('bucket_date').notNull(), // 'YYYY-MM-DD' in UTC
    durationMs: bigint('duration_ms', { mode: 'number' }).notNull().default(0),
    recordingCount: integer('recording_count').notNull().default(0),
    taskCount: integer('task_count').notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.bucketDate] }) }),
);

// events — telemetry passthrough (per CONTEXT discretion: keep real table at Phase 1, drop is harder later)
export const events = pgTable(
  'events',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    userId: varchar('user_id', { length: 26 }).references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 80 }).notNull(),
    properties: jsonb('properties')
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    flavor: flavorEnum('flavor'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userOccurredIdx: index('events_user_occurred_idx').on(t.userId, t.occurredAt),
    nameIdx: index('events_name_idx').on(t.name),
  }),
);

// feedback — diagnostic snapshot from Help Center (HELP-05 / API-12)
export const feedback = pgTable('feedback', {
  id: varchar('id', { length: 26 }).primaryKey(),
  userId: varchar('user_id', { length: 26 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 40 }).notNull(),
  message: text('message').notNull(),
  diagnostic: jsonb('diagnostic').notNull(), // app version / build / OS / device model / last 100 telemetry events
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// app_versions — drives GET /app/version (API-13)
export const appVersions = pgTable(
  'app_versions',
  {
    flavor: flavorEnum('flavor').notNull(),
    minSupported: text('min_supported').notNull(), // semver string
    latest: text('latest').notNull(),
    forceUpgrade: boolean('force_upgrade').notNull().default(false),
    apkUrl: text('apk_url'), // populated for apkRollout only
    apkSha256: varchar('apk_sha256', { length: 64 }), // populated for apkRollout only
    playStoreUrl: text('play_store_url'), // populated for playStore only
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.flavor] }) }),
);

// consent_log — append-only per D-LEGAL-03
export const consentLog = pgTable(
  'consent_log',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    userId: varchar('user_id', { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consentVersion: text('consent_version').notNull(),
    consentTextHash: varchar('consent_text_hash', { length: 64 }).notNull(), // sha256 hex
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    buildFlavor: flavorEnum('build_flavor').notNull(),
  },
  (t) => ({
    userAcceptedIdx: index('consent_log_user_accepted_idx').on(t.userId, t.acceptedAt),
  }),
);

// idempotency_keys — backs the @fastify-style Idempotency-Key plugin (plan 04)
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: varchar('user_id', { length: 26 }).notNull(),
    key: varchar('key', { length: 64 }).notNull(), // UUIDv4 enforced by plugin
    method: varchar('method', { length: 10 }).notNull(),
    path: text('path').notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    statusCode: integer('status_code').notNull(),
    responseBody: jsonb('response_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.key] }),
    expiresIdx: index('idempotency_expires_idx').on(t.expiresAt),
  }),
);

// auth_nonces — backs POST /auth/nonce + /auth/google nonce verification per RESEARCH §2.6
export const authNonces = pgTable(
  'auth_nonces',
  {
    id: varchar('id', { length: 26 }).primaryKey(), // ULID — `nonceId`
    nonceSha256: varchar('nonce_sha256', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    expiresIdx: index('auth_nonces_expires_idx').on(t.expiresAt),
  }),
);

// (Enh 3 / D1, 2026-06-04: `recordings_to_verify` and `recording_events_outbox`
// were removed with the hash-verify flow — migration 0011 drops both tables +
// the recording_event_type enum. `uploaded` is now terminal success.)

// takedown_log — append-only audit row per processed ANPD/DPB takedown request
// (D-LEGAL-04). Migration 0005 creates this table; Phase 1 enforces append-only
// by code convention (no UPDATE/DELETE handlers wired). Phase 5+ may add a
// row-level Postgres trigger to refuse mutation. Counsel relies on this for
// regulator response-window evidence.
export const takedownLog = pgTable(
  'takedown_log',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    requestReceivedAt: timestamp('request_received_at', { withTimezone: true }).notNull(),
    requestAuthority: varchar('request_authority', { length: 80 }).notNull(),
    affectedUserId: varchar('affected_user_id', { length: 26 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    affectedRecordingIds: jsonb('affected_recording_ids').notNull().$type<string[]>(),
    actionTaken: text('action_taken').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    counselReviewer: varchar('counsel_reviewer', { length: 120 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestReceivedIdx: index('takedown_log_received_idx').on(t.requestReceivedAt),
    affectedUserIdx: index('takedown_log_user_idx').on(t.affectedUserId),
  }),
);

// dsr_log — append-only audit row per DSR access/portability fulfillment via
// the mailto + ops CLI flow (D-LEGAL-02). Ops writes one row each time they
// hand the user an export ZIP link. Append-only by code convention (same
// pattern as consent_log + takedown_log; T-1.11-04 mitigation).
export const dsrLog = pgTable(
  'dsr_log',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    userId: varchar('user_id', { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    requestType: varchar('request_type', { length: 32 }).notNull(), // 'access' | 'portability'
    requestReceivedAt: timestamp('request_received_at', { withTimezone: true }).notNull(),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    opsEngineer: varchar('ops_engineer', { length: 120 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('dsr_log_user_idx').on(t.userId),
  }),
);
