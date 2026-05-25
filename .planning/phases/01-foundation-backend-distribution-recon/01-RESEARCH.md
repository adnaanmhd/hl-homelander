# Phase 1: Foundation, Backend & Distribution Recon — Research

**Researched:** 2026-05-07
**Domain:** Fastify backend skeleton + APK direct distribution + RN flavor scaffold
**Confidence:** HIGH (all 5 sections derive from locked CONTEXT.md / STACK.md / CLAUDE.md decisions)

## Summary

Phase 1 establishes the patterns Phase 2-7 inherit. Five high-leverage areas remain to be researched after CONTEXT.md locked 30+ decisions: (1) the canonical hybrid `/tasks` search SQL because Phase 6 will inherit this verbatim; (2) the Play Integrity Standard server flow because the apkRollout install-source bypass must be cross-checked server-side; (3) the ECS Fargate + Secrets Manager + RDS Terraform topology because Phase 1 stands up the entire AWS footprint; (4) Android product-flavor manifest source-set merging because the `REQUEST_INSTALL_PACKAGES` permission must appear in apkRollout APKs only and never leak into the Play Store APK; (5) the Validation Architecture map across all 30 Phase 1 REQ-IDs.

**Primary recommendation:** Lock the hybrid-search SQL (§1) and Terraform module layout (§3) as repository conventions during Phase 1's first wave — Phase 2-7 will copy from these without re-deriving.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Distribution:** Direct-to-users APK first → Play Store → iOS App Store. No fleet recon, no chief intermediary. (D-DIST-01)
- **Compat gating deferred to Phase 2** behavioral check on real users post-APK-share. (D-DIST-02)
- **Android applicationIds:** `playStore = ai.humynlabs.capture` (canonical, permanent), `apkRollout = ai.humynlabs.capture.apk` (suffix). iOS bundle ID = `ai.humynlabs.capture`. (D-FLAV-01)
- **Identical branding** across all flavors — display name `"Humyn Labs Capture"` and same launcher icon. (D-FLAV-03)
- **Auth contract:** Client sends `{flavor, applicationId}` to `POST /auth/google` with Google ID token + Play Integrity attestation. Backend cross-checks `(flavor, applicationId)` against a server-side allowlist. Mismatch = 403 problem+json. (D-AUTH-01)
- **Install-source bypass** is enforced server-side for `apkRollout` only; verdicts {DEVICE_INTEGRITY, APP_RECOGNITION} still required, only `PLAY_RECOGNIZED` waived. (D-AUTH-02)
- **JWT:** HS256, 30-day TTL, no refresh token, no server-side denylist. Single 256-bit secret in AWS Secrets Manager (`humyn/jwt/signing-secret`); ECS injects via task definition `secrets` field. (D-AUTH-03, D-AUTH-04)
- **JWT payload:** `{sub: ULID, iat, exp, flavor, applicationId, integrity_verdict, token_version: 1}`. (D-AUTH-05)
- **Embeddings:** self-hosted `all-MiniLM-L6-v2` (ONNX, 384-dim) via `@xenova/transformers` in-process inside Fastify. Computed at seed time only via `pnpm seed:tasks`. Embedded text = `${name}. ${description}. Category: ${category}.`. (D-EMB-01..04)
- **Hosting:** AWS ap-south-1 (Mumbai) single region + CloudFront edge. RDS PostgreSQL 17 single-AZ. ECS Fargate behind ALB. Single Fargate task at MVP. ElastiCache Redis deferred to Phase 5. (D-HOST-01..04)
- **APK distribution:** S3 + CloudFront public at `https://apk.humyn.ai/humyn-labs-capture-v{version}.apk`. `GET /app/version` returns `{min_supported, latest, force_upgrade, apk_url, apk_sha256}` for `apkRollout`. apkRollout flavor declares `REQUEST_INSTALL_PACKAGES`; Play Store flavor does NOT. (D-APK-01..02)
- **Signing keys:** separate apkRollout self-managed keystore + separate Play Store upload keystore, both in CI encrypted secrets. (D-APK-03)
- **Phase 1 mobile scope:** Buildable scaffold + sign-in screen exercising `/auth/google` end-to-end. No tasks, no recording, no profile. (D-APK-04)
- **DPDP/LGPD:** parallel ops track, NOT a hard gate. Counsel deliverables ship asynchronously. (D-LEGAL-01)
- **DSR API surface at MVP = erasure only:** `DELETE /me`, `POST /me/restore`, `PATCH /me`. Access/portability via Help Center mailto. No `GET /me/export`. (D-LEGAL-02)
- **Consent log:** append-only `consent_log` table with `(id, user_id, consent_version, consent_text_hash, accepted_at, ip, user_agent, build_flavor)` + denormalized `users.consent_version` and `users.consent_accepted_at`. (D-LEGAL-03)
- **Takedown SOP:** ops runbook + manual DB script. No admin endpoint, no admin UI at MVP. (D-LEGAL-04)
- **S3 lifecycle:** Glacier IR at +7d, Deep Archive at +90d. Applied via Terraform to staging + prod buckets. (LEGAL-05)
- **Stack pins (carried forward):** fastify@5.8.5, drizzle-orm@0.45.2, pg@8.20.0, pgvector@0.8.0, @aws-sdk/client-s3@3.1044.0, google-auth-library@10.6.2, pino@10.3.1, zod@4.4.3, vitest@4.1.5, Postgres 17, Node 22 LTS. RN 0.83.x, react@19.2.x, Hermes V1, New Architecture, @react-native-google-signin/google-signin@16.1.2 (Credential Manager), @react-native-firebase/{app,auth,remote-config}@24.0.0, react-native-keychain@10.0.0, react-native-mmkv@4.3.1, react-native-config@1.6.1.

### Claude's Discretion

- versionCode strategy across flavors (recommended in §4 below: shared monotonically-increasing sequence from CI build number)
- CI provider (GitHub Actions assumed default)
- Idempotency-key store implementation (in-process LRU; Postgres-backed for restart durability — planner picks)
- HNSW parameters (defaults are fine at 65 tasks; recommended below)
- Pre-commit hooks, lint/format, monorepo build cache (Turborepo vs pnpm-only)
- Drizzle migration timing (CI step vs boot-time check)
- /events backend ingest scope (real table vs stub endpoint)
- Per-flavor Remote Config keys (server-side allowlist is canonical; Remote Config is redundant — recommend omit)

### Deferred Ideas (OUT OF SCOPE)

- Stale-narrative cleanup of PROJECT.md / REQUIREMENTS.md / ROADMAP.md / SUMMARY.md / PITFALLS.md to remove clan-chief / KGeN / chief-network references.
- Multi-region deployment (sa-east-1 for Brazil) — until India-only proves unacceptable.
- ElastiCache Redis stand-up — Phase 5.
- Self-serve `GET /me/export` endpoint — v1.1 or v2.
- Admin HTTP endpoint or admin dashboard — v2.
- Per-upload Play Integrity attestation (FRAUD-V2-01) — v2.
- APK SHA-256 fingerprint disclosure UX — Phase 2 surface decision.
- APK distribution discovery mechanism (where users find URL) — operational/PM.

## Phase Requirements

| ID       | Description                                                | Research Support                                                 |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| AUTH-06  | APK build flavor bypasses install-source check             | §2 (Play Integrity flow + apkRollout bypass), §4 (flavor wiring) |
| API-01   | `POST /auth/google` token exchange                         | §2 (Google ID token + Play Integrity verification)               |
| API-02   | `GET /me` / `PATCH /me`                                    | §1 schema-pattern reuse, §5 validation map                       |
| API-03   | `DELETE /me` / `POST /me/restore` (DSR erasure)            | §5 validation map                                                |
| API-04   | `GET /tasks` listing + filters                             | §1 (Drizzle schema for tasks)                                    |
| API-05   | `POST /task-requests` + `GET /task-requests`               | §1 schema-pattern reuse, §5 validation map                       |
| API-06   | `POST /recordings` mints presigned URLs                    | §3 (S3 IAM scope)                                                |
| API-07   | `PATCH /recordings/{id}` with idempotency                  | §5 validation map                                                |
| API-08   | `GET /recordings?range=`                                   | §5 validation map                                                |
| API-09   | `GET /recordings/{id}` with CloudFront-signed playback URL | §3 (CloudFront module), §5 validation map                        |
| API-10   | `GET /contributions` + timeseries                          | §5 validation map                                                |
| API-11   | `POST /events` telemetry ingest                            | §5 validation map                                                |
| API-12   | `POST /feedback`                                           | §5 validation map                                                |
| API-13   | `GET /app/version`                                         | §5 validation map (returns apk_url + apk_sha256 for apkRollout)  |
| API-14   | RFC 7807 error shape                                       | §5 validation map (response Content-Type)                        |
| API-15   | Idempotency-Key header support on POST/PATCH               | §5 validation map                                                |
| API-16   | `/tasks` semantic search via RRF k=60                      | §1 (full SQL)                                                    |
| API-17   | Per-user / per-IP rate limits                              | §5 validation map (in-process @fastify/rate-limit per D-HOST-04) |
| DIST-01  | apkRollout flavor exists                                   | §4 (flavor block, source set)                                    |
| DIST-02  | Play Store flavor exists                                   | §4 (flavor block)                                                |
| DIST-03  | iOS App Store flavor exists                                | §4 (Xcode scheme target — out of Android Gradle scope)           |
| DIST-04  | Distinct signing keys per flavor                           | §4 (signingConfigs block, CI keystore wiring)                    |
| DIST-07  | RESCINDED — see CONTEXT D-DIST-01                          | §5 (single rescinded row)                                        |
| FRAUD-01 | Play Integrity at sign-in                                  | §2 (full Standard flow)                                          |
| FRAUD-02 | Server-side allowlist (flavor↔applicationId)              | §2 (allowlist constant)                                          |
| LEGAL-01 | DPDP counsel engagement                                    | §5 (operational, doc-presence check)                             |
| LEGAL-02 | LGPD counsel engagement                                    | §5 (operational, doc-presence check)                             |
| LEGAL-03 | consent_log write on /auth/google                          | §5 (integration test)                                            |
| LEGAL-04 | DSR API surface (DELETE /me, POST /me/restore, PATCH /me)  | §5                                                               |
| LEGAL-05 | S3 lifecycle policy at +7d / +90d                          | §3 (Terraform module), §5 (terraform plan diff)                  |

## Project Constraints (from CLAUDE.md)

- **Tech stack — designs and capture spec LOCKED.** Phase 1 mobile scope uses `logo.js` and the simplest sign-in screen possible — no design-system rendering yet (deferred to Phase 2).
- **Capture pipeline:** Camera2 + MediaCodec / AVCaptureSession + AVAssetWriter. CameraX rejected. (Phase 1 doesn't touch capture; flagged for Phase 3 inheritance.)
- **Hand gate:** MediaPipe HandLandmarker pinned at 0.10.21 both sides. (Phase 4 territory.)
- **App framework:** React Native (Hermes new architecture). Confirmed for Phase 1 scaffold.
- **Backend:** Fastify + Postgres + S3 (LocalStack in dev), Vitest. Phase 1 stands all of this up.
- **Auth:** Google Sign-In + Play Integrity at sign-in only. APK build flavor bypasses install-source check. Phase 1 implements end-to-end.
- **No notifications channel** at MVP. No FCM/APNs.
- **Privacy:** consent text in `idea-brief.md` §5.2 is canonical; consent timestamps logged server-side with version (Phase 1 implements `consent_log`).
- **Files never re-encoded.** Phase 1 must ensure S3 lifecycle policy does NOT transcode (verified — Glacier IR / Deep Archive transitions are storage-class only, no transformation).
- **GSD workflow enforcement:** All Phase 1 file edits flow through `/gsd-execute-phase`.

## Architectural Responsibility Map

| Capability                                   | Primary Tier                    | Secondary Tier | Rationale                                                                                |
| -------------------------------------------- | ------------------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Google ID token verification                 | API / Backend                   | —              | google-auth-library validates audience + signature; client cannot self-attest            |
| Play Integrity decoding                      | API / Backend                   | —              | Google-managed decryption; backend calls `decodeIntegrityToken`; client never holds keys |
| Flavor↔applicationId allowlist              | API / Backend                   | —              | Server-side only per D-AUTH-01; client cannot toggle bypass                              |
| JWT issuance + signing                       | API / Backend                   | —              | HS256 secret in Secrets Manager; backend-only access                                     |
| Hybrid `/tasks` search (RRF k=60)            | Database / Storage              | API / Backend  | RRF SQL runs in Postgres; backend embeds query and orchestrates                          |
| Embedding generation (ONNX MiniLM)           | API / Backend                   | —              | In-process per D-EMB-02; no external API call                                            |
| Tasks seed (mapping.json + taxonomy → DB)    | Database / Storage              | API / Backend  | One-shot via `pnpm seed:tasks` script                                                    |
| consent_log + denorm (users.consent_version) | Database / Storage              | API / Backend  | Drizzle transaction at first sign-in and re-accept                                       |
| Multipart presigned URL minting              | API / Backend                   | —              | @aws-sdk/s3-request-presigner; backend signs with task-role IAM                          |
| S3 lifecycle policy enforcement              | CDN / Static (S3)               | —              | Day-zero Terraform-applied bucket lifecycle config                                       |
| Recording playback URL (CloudFront-signed)   | CDN / Static                    | API / Backend  | CloudFront key pair for 5-min signed URLs; private origin                                |
| APK distribution                             | CDN / Static                    | —              | S3 + CloudFront public; versioned filenames                                              |
| Sign-in scaffold (mobile)                    | Frontend Server (RN)            | Browser/Client | Single screen exercising the auth pipeline                                               |
| Per-flavor manifest merge                    | Frontend Server (Android build) | —              | Gradle source-set merger at build time                                                   |
| Per-flavor signing                           | Frontend Server (Android build) | —              | Gradle signingConfigs + CI secrets injection                                             |

## Standard Stack

### Core (Phase 1 specific — versions confirmed against CONTEXT.md / STACK.md)

| Library                           | Version    | Purpose                                                        | Why Standard                        |
| --------------------------------- | ---------- | -------------------------------------------------------------- | ----------------------------------- |
| `fastify`                         | 5.8.5      | HTTP framework                                                 | Locked                              |
| `@fastify/cors`                   | 11.2.0     | CORS for mobile client                                         | Pairs with Fastify 5                |
| `@fastify/jwt`                    | 10.0.0     | HS256 JWT signing/verification                                 | Pairs with Fastify 5                |
| `@fastify/rate-limit`             | 10.3.0     | Per-IP / per-user throttling (in-process at MVP per D-HOST-04) | Standard hardening                  |
| `pino`                            | 10.3.1     | Structured logging (CloudWatch)                                | Built-in to Fastify                 |
| `pg`                              | 8.20.0     | Postgres node driver                                           | Locked                              |
| `drizzle-orm`                     | 0.45.2     | Type-safe SQL builder + migrations                             | Locked; SQL-first for hybrid search |
| `drizzle-kit`                     | latest 0.x | Migration generator                                            | Companion to drizzle-orm            |
| `google-auth-library`             | 10.6.2     | Google ID token verification                                   | Locked                              |
| `@aws-sdk/client-s3`              | 3.1044.0   | S3 multipart minting + bucket admin                            | Locked                              |
| `@aws-sdk/s3-request-presigner`   | 3.1044.0   | Presigned URL minting                                          | Companion                           |
| `@aws-sdk/client-secrets-manager` | 3.1044.0   | JWT secret retrieval (or via ECS env injection)                | Same minor as client-s3             |
| `@xenova/transformers`            | latest 2.x | ONNX MiniLM in-process inference                               | D-EMB-02                            |
| `zod`                             | 4.4.3      | Request/response schemas (shared/types/)                       | Locked                              |
| `ulid`                            | latest 2.x | ULID generation for `users.id`, `recordings.id`, etc.          | Sortable, time-prefixed             |
| `vitest`                          | 4.1.5      | Tests                                                          | Locked                              |

### Mobile (Phase 1 scaffold-only — versions per CONTEXT.md)

| Library                                     | Version | Purpose                                                |
| ------------------------------------------- | ------- | ------------------------------------------------------ |
| `react-native`                              | 0.83.x  | App framework                                          |
| `react`                                     | 19.2.x  | UI runtime                                             |
| `@react-native-google-signin/google-signin` | 16.1.2  | Credential Manager API on Android                      |
| `@react-native-firebase/app`                | 24.0.0  | Firebase base                                          |
| `@react-native-firebase/auth`               | 24.0.0  | Firebase token exchange                                |
| `@react-native-firebase/remote-config`      | 24.0.0  | Remote Config (per-flavor knobs if planner chooses)    |
| `react-native-keychain`                     | 10.0.0  | JWT storage (AUTH-07 in Phase 2; pre-wired in Phase 1) |
| `react-native-mmkv`                         | 4.3.1   | Encrypted KV (FLAVOR_NAME, applicationId at runtime)   |
| `react-native-config`                       | 1.6.1   | `.env.${flavor}` plumbing                              |

### Infrastructure

| Tool                 | Version      | Purpose                                                           |
| -------------------- | ------------ | ----------------------------------------------------------------- |
| Terraform            | 1.10+        | IaC under `infra/terraform/`                                      |
| LocalStack Community | 4.x          | Local S3 + Secrets Manager mock for dev                           |
| docker-compose       | latest       | Postgres 17 (`pgvector/pgvector:pg17`) + LocalStack + Fastify dev |
| pnpm                 | 9+           | Workspace root                                                    |
| Node                 | 22 LTS (Jod) | Runtime                                                           |

**Verification status:** All versions are inherited from CONTEXT.md "Locked from upstream" + STACK.md. No new package introductions in this phase. `[VERIFIED: CONTEXT.md + STACK.md npm registry queries 2026-05-07]`

## Section 1 — Hybrid `/tasks` search SQL (CRITICAL — Phase 1 establishes the precedent)

This is the canonical SQL Phase 6 inherits. Implementation lives at `apps/api/src/db/schema.ts` (Drizzle schema) + `apps/api/src/db/migrations/0001_init.sql` (extension + indexes) + `apps/api/src/routes/tasks/search.ts` (RRF query).

### 1.1 Drizzle schema — `apps/api/src/db/schema.ts`

```typescript
import { pgTable, text, varchar, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// pgvector custom type — Drizzle 0.45 has no first-class vector helper,
// so we declare it via customType. 384 dims for all-MiniLM-L6-v2.
const vector = customType<{
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
    // Postgres returns "[0.1,0.2,...]"
    return JSON.parse(value);
  },
});

// generated tsvector column — generated always as stored
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return `tsvector`;
  },
});

export const tasks = pgTable(
  'tasks',
  {
    // ULID primary key — sortable + time-prefixed
    id: varchar('id', { length: 26 }).primaryKey(),
    // Slug used in `/tasks/{id}` route (URL-safe, kebab-case from taxonomy)
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    setting: varchar('setting', { length: 16 }).notNull(), // 'indoor' | 'outdoor' | 'either'
    // Lucide icon name from design-system/task-icons/mapping.json
    iconKey: text('icon_key').notNull(),
    // Per-task instructions (max 3) — JSON array stored as text or jsonb
    instructions: text('instructions').notNull(), // JSON.stringify([...])
    // Embedding of `${name}. ${description}. Category: ${category}.`
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    // Generated tsvector — Postgres maintains automatically
    nameSearch: tsvector('name_search').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Lexical FTS index
    nameSearchGin: index('tasks_name_search_gin').using('gin', table.nameSearch),
    // Vector similarity index (created via raw SQL migration; see 1.3)
    // HNSW with vector_cosine_ops — see migration below
  }),
);
```

### 1.2 Migration — extension + generated column + indexes (`apps/api/src/db/migrations/0001_init.sql`)

```sql
-- Required extension. IF NOT EXISTS makes the migration idempotent;
-- pg_extension entries are not transactional — wrap in BEGIN if Drizzle
-- runs migrations transactionally.
CREATE EXTENSION IF NOT EXISTS vector;

-- Drizzle generates the base CREATE TABLE; this migration tops up:
--   1. The generated tsvector column (Drizzle 0.45 has no DSL for GENERATED ALWAYS)
--   2. The HNSW vector index
--   3. The GIN tsvector index (Drizzle's index DSL for `using('gin')` works,
--      but writing it explicitly here for clarity — use whichever path)

-- 1. Generated tsvector — Postgres maintains automatically on insert/update.
ALTER TABLE tasks
  DROP COLUMN IF EXISTS name_search;

ALTER TABLE tasks
  ADD COLUMN name_search tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(description, '')
    )
  ) STORED;

-- 2. HNSW vector index for cosine similarity.
-- Parameters chosen for ~65 → few-thousand rows:
--   m = 16            (graph fan-out; default — fine at this scale)
--   ef_construction = 64  (build-time exploration; default)
-- Query-time `ef_search` is set per-session via SET LOCAL hnsw.ef_search.
-- pgvector 0.8.0 supports iterative scans (hnsw.iterative_scan) — useful
-- if recall drops at scale; default is 'off' which is fine for 65 rows.
CREATE INDEX IF NOT EXISTS tasks_embedding_hnsw_idx
  ON tasks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. GIN index on the generated tsvector.
CREATE INDEX IF NOT EXISTS tasks_name_search_gin
  ON tasks
  USING gin (name_search);
```

**Rationale on parameters:**

- `m = 16`, `ef_construction = 64` are pgvector defaults. At 65 rows the index isn't really doing work — sequential scan would suffice — but the index lets us scale cleanly to thousands without re-tuning.
- `ef_search` (per-session) defaults to 40 in pgvector 0.8.0; we don't override unless recall testing shows a problem (Claude's Discretion per CONTEXT).
- Reference: pgvector README + 0.8.0 release notes. `[VERIFIED: STACK.md sources — pgvector 0.8.0 release announcement, pgvector GitHub README]`

### 1.3 Reciprocal Rank Fusion query — `apps/api/src/routes/tasks/search.ts`

The canonical RRF formula at k=60: for each candidate row, rank in the vector list and rank in the lexical list, then `score = SUM(1.0 / (60 + rank))` across the two lists. Unranked-in-a-list contributes 0 for that list.

```typescript
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

interface SearchTasksOptions {
  queryText: string;
  queryEmbedding: number[]; // 384-dim, from MiniLM
  category?: string;
  setting?: string;
  limit?: number;
}

export async function searchTasks(db: PostgresJsDatabase, opts: SearchTasksOptions) {
  const limit = opts.limit ?? 50;
  const k = 60; // RRF constant — locked at 60 per CONTEXT

  // Embed-side query is parameterised as a vector literal.
  // Drizzle's `sql` template handles parameterisation via $1, $2, ...
  // We pass the embedding as a JSON array string '[0.1,0.2,...]' and
  // cast to vector(384) inside the query.
  const embeddingLiteral = `[${opts.queryEmbedding.join(',')}]`;

  return db.execute<{
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    setting: string;
    icon_key: string;
    instructions: string;
    rrf_score: number;
  }>(sql`
    WITH
      vector_ranks AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY embedding <=> ${embeddingLiteral}::vector(384)) AS rnk
        FROM tasks
        WHERE
          (${opts.category}::text IS NULL OR category = ${opts.category}::text)
          AND (${opts.setting}::text IS NULL OR setting = ${opts.setting}::text OR setting = 'either')
        ORDER BY embedding <=> ${embeddingLiteral}::vector(384)
        LIMIT 200
      ),
      lexical_ranks AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY ts_rank(name_search, plainto_tsquery('english', ${opts.queryText})) DESC
          ) AS rnk
        FROM tasks
        WHERE
          name_search @@ plainto_tsquery('english', ${opts.queryText})
          AND (${opts.category}::text IS NULL OR category = ${opts.category}::text)
          AND (${opts.setting}::text IS NULL OR setting = ${opts.setting}::text OR setting = 'either')
        ORDER BY ts_rank(name_search, plainto_tsquery('english', ${opts.queryText})) DESC
        LIMIT 200
      ),
      fused AS (
        SELECT
          COALESCE(v.id, l.id) AS id,
          (
            COALESCE(1.0 / (${k}::numeric + v.rnk), 0)
            +
            COALESCE(1.0 / (${k}::numeric + l.rnk), 0)
          ) AS rrf_score
        FROM vector_ranks v
        FULL OUTER JOIN lexical_ranks l ON v.id = l.id
      )
    SELECT
      t.id,
      t.slug,
      t.name,
      t.description,
      t.category,
      t.setting,
      t.icon_key,
      t.instructions,
      f.rrf_score
    FROM fused f
    JOIN tasks t ON t.id = f.id
    ORDER BY f.rrf_score DESC
    LIMIT ${limit};
  `);
}
```

**Notes on the query:**

- Uses `<=>` (cosine distance) operator — the pgvector standard companion to `vector_cosine_ops` index. The HNSW index is consulted automatically.
- `plainto_tsquery` is more forgiving than `to_tsquery` for user input (handles whitespace, no operator parsing).
- `FULL OUTER JOIN` ensures rows that match only one of the two lists still get scored. This is essential — without it, a perfectly lexical match with a poor embedding would be lost.
- `LIMIT 200` per sub-list is the standard RRF cutoff — reduces fusion cost while preserving long-tail recall. At 65 rows this is moot; future-proofs the pattern.
- The two filter clauses (`category`, `setting`) are repeated in both CTEs so the index can prune before fusion. `setting = 'either'` is the universal escape hatch — tasks tagged "either" pass any setting filter.
- Drizzle's `sql` template interpolates `opts.category` / `opts.setting` / `opts.queryText` as parameters (no SQL injection); the embedding literal is built as a string but contains only numerics so it's safe.

### 1.4 Seed pipeline — `apps/api/scripts/seed-tasks.ts`

Runs once via `pnpm seed:tasks` (and via CI when `task-taxonomy.md` or `mapping.json` change):

```typescript
import { pipeline } from '@xenova/transformers';

// Load model once at script start
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// Read task-taxonomy.md → parse 65 rows
// Read design-system/task-icons/mapping.json → iconKey per slug
// For each task:
const text = `${task.name}. ${task.description}. Category: ${task.category}.`;
const output = await embedder(text, { pooling: 'mean', normalize: true });
const embedding = Array.from(output.data); // 384 floats

// INSERT ... ON CONFLICT (slug) DO UPDATE — idempotent re-seed
```

The `Xenova/all-MiniLM-L6-v2` model checksum should be pinned in `apps/api/package.json` (or a `models/` checked-in artifact) to prevent embedding drift across Node-modules updates.

`[VERIFIED: D-EMB-01..04 in CONTEXT.md; @xenova/transformers API per its README]`

## Section 2 — Play Integrity Standard request server-side flow

Phase 1 implements `POST /auth/google` end-to-end. The request body, exact Google API call, and reject logic are all covered here.

### 2.1 Client request body — `POST /auth/google`

```typescript
// shared/types/Auth.ts (Zod schema)
import { z } from 'zod';

export const AuthGoogleRequest = z.object({
  // From @react-native-google-signin/google-signin (Credential Manager API)
  googleIdToken: z.string().min(1),
  // From Play Integrity (Android) or App Attest (iOS, deferred — see note)
  // Standard request returns a single token string ~2KB JWE
  integrityToken: z.string().min(1),
  // Backend cross-checks this pair against the allowlist
  flavor: z.enum(['apkRollout', 'playStore', 'iosAppStore']),
  applicationId: z.string().min(1),
  // Backend-minted nonce that the client requested before this call
  // (see 2.5 — nonce flow). Echoed back so we can verify the integrity
  // token committed to the same nonce.
  nonceId: z.string().min(1),
});
```

**iOS note:** App Attest is deferred to Phase 8 (IOS-04). Phase 1's `iosAppStore` flavor sends `integrityToken: ''` and Phase 1 backend treats `iosAppStore` as a degenerate path that skips Play Integrity decoding (still validates Google ID token + allowlist). This is acceptable because Phase 1 mobile deliverable per D-APK-04 is buildable scaffold + auth check; iOS parity proper lands in Phase 8.

### 2.2 Google ID token verification — `apps/api/src/auth/verify-id-token.ts`

```typescript
import { OAuth2Client } from 'google-auth-library';

// WEB_CLIENT_ID is the Firebase project's WEB OAuth client ID (NOT the
// Android one). This is critical — @react-native-google-signin/google-signin
// 16.x via Credential Manager returns ID tokens whose `aud` claim is the
// Web client ID, not the Android client ID. This trips up nearly every
// integration. Reference: react-native-google-signin v13+ migration notes.
const WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID!;

const client = new OAuth2Client(WEB_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: WEB_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('id_token_no_payload');
  // payload.sub = stable Google account ID
  // payload.email, payload.name, payload.picture
  // payload.email_verified === true (reject if false)
  // payload.aud === WEB_CLIENT_ID (already enforced by audience check)
  // payload.iss === 'https://accounts.google.com' or 'accounts.google.com'
  return payload;
}
```

### 2.3 Play Integrity decode — `apps/api/src/auth/verify-play-integrity.ts`

The **Standard request** path (NOT Classic). Standard requests return a token that the client uploads to backend; backend POSTs to `playintegrity.googleapis.com/v1/{packageName}:decodeIntegrityToken`. Google decrypts server-side under our Google Cloud project (Google-Managed decryption — no keys held by us).

```typescript
import { google } from 'googleapis';

// IAM: a Google Cloud service account with role
//   roles/playintegrity.tokenDecoder
// is created in the same GCP project as the Play Integrity API binding.
// The JSON keyfile is mounted into the Fargate task via Secrets Manager
// at /var/run/secrets/play-integrity-sa.json (or as an env var with the
// JSON inline).
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.PLAY_INTEGRITY_SA_KEYFILE,
  scopes: ['https://www.googleapis.com/auth/playintegrity'],
});

const playintegrity = google.playintegrity({ version: 'v1', auth });

export async function decodeIntegrityToken(opts: {
  packageName: string; // 'ai.humynlabs.capture' or 'ai.humynlabs.capture.apk'
  integrityToken: string;
}) {
  const res = await playintegrity.v1.decodeIntegrityToken({
    packageName: opts.packageName,
    requestBody: {
      integrityToken: opts.integrityToken,
    },
  });
  // res.data.tokenPayloadExternal is the decoded payload
  return res.data.tokenPayloadExternal!;
}
```

**HTTP shape (what `googleapis` produces under the hood):**

```
POST https://playintegrity.googleapis.com/v1/ai.humynlabs.capture:decodeIntegrityToken
Authorization: Bearer <gcp-access-token>
Content-Type: application/json

{
  "integrityToken": "<JWE token from client>"
}
```

The package name in the URL path **must** match the `applicationId` of the APK that produced the token. This is the third defense (after audience + signature) against cross-flavor token replay: a token minted by `ai.humynlabs.capture.apk` will fail decode under URL `ai.humynlabs.capture`.

### 2.4 Decoded `tokenPayloadExternal` structure & reject logic

```typescript
// Per https://developer.android.com/google/play/integrity/verdicts
interface TokenPayloadExternal {
  requestDetails: {
    requestPackageName: string; // must equal expected applicationId
    timestampMillis: string; // string of int millis; reject if older than ~10 min
    nonce: string; // must equal backend-issued nonce
  };
  appIntegrity: {
    appRecognitionVerdict:
      | 'PLAY_RECOGNIZED' // Play-installed, unmodified
      | 'UNRECOGNIZED_VERSION' // installed-but-not-from-Play, or modified
      | 'UNEVALUATED'; // verdict unavailable
    packageName: string; // sanity check
    certificateSha256Digest: string[];
    versionCode: string;
  };
  deviceIntegrity: {
    deviceRecognitionVerdict: Array<
      | 'MEETS_DEVICE_INTEGRITY' // genuine device with unlocked or locked state
      | 'MEETS_BASIC_INTEGRITY' // weaker — older Android or some emulators
      | 'MEETS_STRONG_INTEGRITY' // hardware-backed key attestation
      | 'MEETS_VIRTUAL_INTEGRITY' // emulator with Google Play services (REJECT)
    >;
  };
  accountDetails: {
    appLicensingVerdict:
      | 'LICENSED' // Play account holds entitlement
      | 'UNLICENSED' // sideloaded or no Play account
      | 'UNEVALUATED';
  };
}
```

**Reject logic — `apps/api/src/auth/integrity-policy.ts`:**

```typescript
import { isFlavorAllowed } from './flavor-allowlist';

export interface IntegrityCheckResult {
  pass: boolean;
  verdict: 'passed' | 'bypassed_apk';
  reason?: string;
}

export function evaluateIntegrity(opts: {
  flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
  applicationId: string;
  payload: TokenPayloadExternal;
  expectedNonce: string;
}): IntegrityCheckResult {
  const { flavor, applicationId, payload, expectedNonce } = opts;

  // 0. Allowlist cross-check (D-AUTH-01)
  if (!isFlavorAllowed(flavor, applicationId)) {
    return { pass: false, verdict: 'passed', reason: 'flavor_app_id_mismatch' };
  }

  // 1. Nonce match (replay protection)
  if (payload.requestDetails.nonce !== expectedNonce) {
    return { pass: false, verdict: 'passed', reason: 'nonce_mismatch' };
  }

  // 2. Token freshness — reject tokens older than 10 minutes
  const ageMs = Date.now() - Number(payload.requestDetails.timestampMillis);
  if (ageMs < 0 || ageMs > 10 * 60 * 1000) {
    return { pass: false, verdict: 'passed', reason: 'token_stale' };
  }

  // 3. Package name in payload must match the URL we called decode under
  if (payload.requestDetails.requestPackageName !== applicationId) {
    return { pass: false, verdict: 'passed', reason: 'package_name_mismatch' };
  }
  if (payload.appIntegrity.packageName !== applicationId) {
    return { pass: false, verdict: 'passed', reason: 'app_integrity_package_mismatch' };
  }

  // 4. Device integrity — never accept emulator
  const dvr = payload.deviceIntegrity.deviceRecognitionVerdict;
  if (dvr.includes('MEETS_VIRTUAL_INTEGRITY')) {
    return { pass: false, verdict: 'passed', reason: 'emulator_detected' };
  }
  // Require at least basic integrity (covers older Android too)
  if (
    !dvr.includes('MEETS_DEVICE_INTEGRITY') &&
    !dvr.includes('MEETS_BASIC_INTEGRITY') &&
    !dvr.includes('MEETS_STRONG_INTEGRITY')
  ) {
    return { pass: false, verdict: 'passed', reason: 'device_integrity_failed' };
  }

  // 5. App integrity — installed-from-Play OR allowlisted apkRollout bypass
  if (payload.appIntegrity.appRecognitionVerdict === 'PLAY_RECOGNIZED') {
    return { pass: true, verdict: 'passed' };
  }
  if (
    payload.appIntegrity.appRecognitionVerdict === 'UNRECOGNIZED_VERSION' &&
    flavor === 'apkRollout' &&
    applicationId === 'ai.humynlabs.capture.apk'
  ) {
    // Install-source bypass per D-AUTH-02. Only valid when allowlist
    // confirms (flavor='apkRollout', applicationId='ai.humynlabs.capture.apk').
    // The client cannot toggle this; both fields are decoded server-side
    // (one from JWT-in-progress allowlist, one from Play Integrity payload itself).
    return { pass: true, verdict: 'bypassed_apk' };
  }

  return { pass: false, verdict: 'passed', reason: 'app_integrity_failed' };
}
```

### 2.5 Server-side allowlist — `apps/api/src/auth/flavor-allowlist.ts`

Hard-coded constant per D-AUTH-01. Source-of-truth.

```typescript
// Permanent contract. Changing requires code review + deploy.
// DO NOT move to DB or Remote Config — see CONTEXT.md "Specifics".
const ALLOWLIST: ReadonlyArray<{
  flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
  applicationId: string;
}> = [
  { flavor: 'apkRollout', applicationId: 'ai.humynlabs.capture.apk' },
  { flavor: 'playStore', applicationId: 'ai.humynlabs.capture' },
  { flavor: 'iosAppStore', applicationId: 'ai.humynlabs.capture' },
] as const;

export function isFlavorAllowed(flavor: string, applicationId: string): boolean {
  return ALLOWLIST.some((e) => e.flavor === flavor && e.applicationId === applicationId);
}
```

### 2.6 Nonce flow — backend mints, client includes, backend verifies

Play Integrity Standard requests require a nonce that binds the attestation to a specific request. The client cannot mint nonces because then a replay attack is trivial; the backend mints, returns to client, client includes in the integrity request, and backend verifies the round-trip.

**Pattern:**

```
1. Client: POST /auth/nonce → returns { nonceId: ULID, nonce: base64url(32 random bytes) }
   Backend stores (nonceId, nonce, expires_at = now+5min) in in-process LRU
   (D-HOST-04: in-process at MVP, Redis at Phase 5).

2. Client: integrity request via Play Integrity Standard with that nonce string.
   Returns integrityToken.

3. Client: POST /auth/google with { googleIdToken, integrityToken, flavor,
   applicationId, nonceId }.

4. Backend:
   a. Look up nonce by nonceId in LRU. If absent or expired → 401.
   b. Verify Google ID token (audience = WEB_CLIENT_ID).
   c. Decode Play Integrity token under packageName = applicationId.
   d. Run evaluateIntegrity({ flavor, applicationId, payload, expectedNonce: nonce }).
   e. Delete the nonce from LRU (single-use).
   f. Find-or-create user in Postgres (in same transaction as consent_log insert
      per LEGAL-03).
   g. Mint JWT with payload per D-AUTH-05.
   h. Return JWT + user record.
```

The base64url-encoded 32-byte random nonce is what Play Integrity expects per Google docs (it accepts any URL-safe string; 32 bytes of `crypto.randomBytes` keeps it well above the entropy floor).

### 2.7 IAM / service-account configuration

- **GCP service account:** `play-integrity-decoder@<project>.iam.gserviceaccount.com` with role `roles/playintegrity.tokenDecoder`. Created in the same GCP project that owns the Play Integrity API binding for `ai.humynlabs.capture` and `ai.humynlabs.capture.apk` (both package names registered in Play Console).
- **Key delivery to Fargate:** JSON keyfile stored in AWS Secrets Manager (`humyn/gcp/play-integrity-sa-key`); ECS task definition `secrets` field references the ARN; container env var `PLAY_INTEGRITY_SA_KEYFILE` points at the file path mounted by ECS, OR the env var contains the JSON inline (preferred — fewer file-mount edge cases). `googleapis` accepts a `credentials` object in lieu of `keyFile`.
- **AWS-side IAM:** The ECS execution role needs `secretsmanager:GetSecretValue` on both `humyn/jwt/signing-secret` and `humyn/gcp/play-integrity-sa-key` ARNs. The ECS task role does NOT need GCP IAM; cross-cloud IAM bridging is handled by the keyfile alone.

### 2.8 Decision summary — Standard vs Classic, Google-Managed vs Self-Managed

Both decisions are **locked in CONTEXT.md "Locked from upstream"** and reaffirmed here:

- **Standard requests** (NOT Classic) — modern path, lower latency, handles caching and warm-up server-side. Classic is the deprecated path with manual nonce generation and per-request high latency.
- **Google-Managed decryption** (default) — Google holds the decryption keys; we just call `decodeIntegrityToken`. Self-managed adds key rotation surface and a JWE library dependency for no security benefit at our threat model.

`[VERIFIED: STACK.md §"Configuration Recipes" 5; developer.android.com/google/play/integrity/standard; developer.android.com/google/play/integrity/verdicts]`

## Section 3 — ECS Fargate + Secrets Manager + RDS Terraform topology

Phase 1 stands up the entire AWS footprint in `infra/terraform/`. Single-AZ at MVP per D-HOST-02; module breakdown chosen so multi-AZ + Phase-5 Redis are clean additive changes later.

### 3.1 Layout

```
infra/terraform/
├── modules/
│   ├── network/         # VPC, public + private subnets (one AZ each at MVP), IGW, single NAT GW, SGs
│   ├── rds/             # RDS PostgreSQL 17 single-AZ with custom parameter group + KMS-encrypted storage
│   ├── ecs/             # Fargate cluster, ALB, target group, task def, IAM execution + task roles
│   ├── s3/              # Recordings bucket + APK bucket; both with day-zero lifecycle policy
│   ├── secrets/         # Secrets Manager entries (JWT signing secret, GCP service-account JSON)
│   └── cloudfront/      # APK public distribution + recordings private distribution + ACM cert (us-east-1)
├── envs/
│   ├── staging/         # main.tf consumes modules, sets vars (region=ap-south-1, env=staging)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── backend.tf   # S3 backend for state (separate state bucket per env)
│   │   └── terraform.tfvars
│   └── prod/            # mirrors staging structure; different vars
└── .terraform-version   # pin to 1.10+
```

State is stored in S3 (`humyn-tf-state-{staging,prod}` buckets in ap-south-1) with DynamoDB lock table (`humyn-tf-locks`). State bucket and lock table are bootstrapped manually once per env.

### 3.2 `modules/network/` — VPC

```hcl
# 10.0.0.0/16 — single AZ at MVP (ap-south-1a). When we go multi-AZ in
# Phase 5, add 10.0.16.0/20 + 10.0.32.0/20 in ap-south-1b/c with no
# downtime — RDS multi-AZ failover, ALB multi-AZ targets.

resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }

# Public subnet hosts ALB + NAT GW
resource "aws_subnet" "public_a" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.0.0/20"
  availability_zone = "${var.region}a"
  map_public_ip_on_launch = true
}

# Private subnet hosts Fargate tasks + RDS
resource "aws_subnet" "private_a" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.16.0/20"
  availability_zone = "${var.region}a"
}

# Security groups (referenced by modules/ecs and modules/rds):
#   sg_alb       — 443 from 0.0.0.0/0 (ALB ingress)
#   sg_fargate   — 8080 from sg_alb only (task ingress)
#   sg_rds       — 5432 from sg_fargate only (db ingress)
```

### 3.3 `modules/rds/` — Postgres 17 + pgvector

```hcl
resource "aws_db_parameter_group" "pg17_pgvector" {
  family = "postgres17"
  name   = "humyn-pg17-pgvector-${var.env}"
  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
    apply_method = "pending-reboot"
  }
  # Tuned for the t4g.medium / t4g.large class at MVP
  parameter { name = "log_min_duration_statement" value = "500" }
  parameter { name = "log_connections"            value = "1" }
}

resource "aws_db_instance" "main" {
  identifier             = "humyn-${var.env}"
  engine                 = "postgres"
  engine_version         = "17.2"            # pin to a specific minor
  instance_class         = "db.t4g.medium"   # MVP class; bump in prod
  allocated_storage      = 50
  storage_type           = "gp3"
  storage_encrypted      = true              # KMS at-rest, default key
  kms_key_id             = null              # use AWS-managed default
  multi_az               = false             # D-HOST-02: single-AZ at MVP
  publicly_accessible    = false
  vpc_security_group_ids = [var.sg_rds_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.pg17_pgvector.name
  backup_retention_period = 7
  deletion_protection     = var.env == "prod"
  skip_final_snapshot     = var.env != "prod"
  apply_immediately       = false
  username                = "humyn_admin"
  manage_master_user_password = true         # Secrets Manager-managed
}
```

`shared_preload_libraries = vector` plus `CREATE EXTENSION vector` in the migration is the canonical pgvector activation pattern. Drizzle migrations create the extension idempotently.

### 3.4 `modules/secrets/` — Secrets Manager entries

```hcl
resource "aws_secretsmanager_secret" "jwt_signing" {
  name = "humyn/jwt/signing-secret"
  description = "HS256 256-bit signing secret per D-AUTH-04"
  recovery_window_in_days = 7
}

# Initial value seeded out-of-band via AWS CLI:
#   openssl rand -base64 32 | aws secretsmanager put-secret-value ...
# Rotation: manual at MVP; Lambda rotation later.

resource "aws_secretsmanager_secret" "gcp_play_integrity_sa" {
  name = "humyn/gcp/play-integrity-sa-key"
  description = "GCP service account JSON for Play Integrity decodeIntegrityToken"
  recovery_window_in_days = 7
}

# Outputs:
output "jwt_secret_arn" { value = aws_secretsmanager_secret.jwt_signing.arn }
output "gcp_sa_secret_arn" { value = aws_secretsmanager_secret.gcp_play_integrity_sa.arn }
```

### 3.5 `modules/ecs/` — Fargate cluster + task + ALB

The Fargate task definition `secrets` field is the ECS-native way to inject Secrets Manager values as env vars at task start (no app-side AWS SDK call needed for retrieval — though we keep `client-secrets-manager` for rotation hot-reload later if we want).

```hcl
resource "aws_ecs_cluster" "main" {
  name = "humyn-${var.env}"
}

# Task execution role — pulls images, fetches secrets, writes logs
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect = "Allow"
    principals { type = "Service" identifiers = ["ecs-tasks.amazonaws.com"] }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "humyn-${var.env}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom inline policy: getSecretValue on the two secret ARNs
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.jwt_secret_arn, var.gcp_sa_secret_arn]
    }]
  })
}

# Task role — what the running container is allowed to do at runtime
resource "aws_iam_role" "ecs_task" {
  name               = "humyn-${var.env}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
        Resource = "${var.recordings_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = var.recordings_bucket_arn
      },
      # APK bucket is read-only at runtime (uploads happen via CI, not app)
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "${var.apk_bucket_arn}/*"
      },
    ]
  })
}

resource "aws_ecs_task_definition" "api" {
  family                   = "humyn-${var.env}-api"
  cpu                      = "1024"
  memory                   = "2048"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "api"
    image = "${var.ecr_repo_url}:${var.image_tag}"
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]

    # Env vars (non-secret)
    environment = [
      { name = "NODE_ENV",            value = var.env },
      { name = "AWS_REGION",          value = var.region },
      { name = "GOOGLE_WEB_CLIENT_ID", value = var.google_web_client_id },
      { name = "RECORDINGS_BUCKET",   value = var.recordings_bucket_name },
      { name = "APK_BUCKET",          value = var.apk_bucket_name },
    ]

    # Secrets — ECS injects these as env vars at task start
    # by calling secretsmanager:GetSecretValue under ecs_execution role.
    # Exact JSON shape ECS expects (this is the canonical AWS schema):
    secrets = [
      {
        name      = "JWT_SIGNING_SECRET"
        valueFrom = var.jwt_secret_arn
      },
      {
        name      = "PLAY_INTEGRITY_SA_KEY_JSON"
        valueFrom = var.gcp_sa_secret_arn
      },
      {
        name      = "DATABASE_URL"
        valueFrom = "${var.rds_master_secret_arn}:url::"  # JSON-key extraction
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

# Single Fargate task at MVP — D-HOST-03
resource "aws_ecs_service" "api" {
  name            = "humyn-${var.env}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  network_configuration {
    subnets         = [var.private_subnet_id]
    security_groups = [var.sg_fargate_id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
}

# ALB — public-facing TLS
resource "aws_lb" "api" {
  name               = "humyn-${var.env}-api"
  load_balancer_type = "application"
  security_groups    = [var.sg_alb_id]
  subnets            = [var.public_subnet_id]
}

resource "aws_lb_target_group" "api" {
  name        = "humyn-${var.env}-api"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.acm_cert_arn   # ap-south-1 cert for api.humyn.ai
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
```

### 3.6 `modules/s3/` — recordings + APK buckets with day-zero lifecycle

```hcl
resource "aws_s3_bucket" "recordings" {
  bucket = "humyn-recordings-${var.env}"
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}

# LEGAL-05 day-zero lifecycle: Glacier IR @ +7d, Deep Archive @ +90d
# IMPORTANT: storage-class transitions only — no transcoding. Files travel
# byte-for-byte from device to S3 to Glacier (CLAUDE.md file-fidelity rule).
resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  rule {
    id     = "tier-down"
    status = "Enabled"
    transition {
      days          = 7
      storage_class = "GLACIER_IR"
    }
    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }
    # Multipart upload abort safety
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# APK bucket — public via CloudFront only (block direct S3 public access)
resource "aws_s3_bucket" "apk" {
  bucket = "humyn-apk-${var.env}"
}

resource "aws_s3_bucket_public_access_block" "apk" {
  bucket = aws_s3_bucket.apk.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront OAC reads via signed identity — see modules/cloudfront
```

### 3.7 `modules/cloudfront/` — APK distribution + ACM cert in us-east-1

CloudFront ACM certs **must** be in `us-east-1` regardless of the rest of the deployment. This is a hard CloudFront constraint. The Terraform provider for the cert is aliased to us-east-1.

```hcl
# In envs/staging/main.tf:
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# In modules/cloudfront/main.tf:
resource "aws_acm_certificate" "apk" {
  provider          = aws.us_east_1   # CloudFront constraint
  domain_name       = "apk.humyn.ai"
  validation_method = "DNS"
}

# OAC for private S3 read
resource "aws_cloudfront_origin_access_control" "apk" {
  name                              = "humyn-apk-${var.env}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "apk" {
  enabled = true
  aliases = ["apk.humyn.ai"]
  default_cache_behavior {
    target_origin_id       = "apk-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values { query_string = false  cookies { forward = "none" } }
  }
  origin {
    origin_id                = "apk-s3"
    domain_name              = aws_s3_bucket.apk.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.apk.id
  }
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.apk.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  restrictions { geo_restriction { restriction_type = "none" } }
}

# Recordings playback distribution — private, signed-URL only.
# CloudFront key pair stored in Secrets Manager; backend signs 5-min URLs
# for API-09 (`GET /recordings/{id}` playback URL).
resource "aws_cloudfront_public_key" "recordings_signer" {
  name        = "humyn-recordings-signer-${var.env}"
  encoded_key = var.recordings_signer_public_key_pem
}

resource "aws_cloudfront_key_group" "recordings" {
  name  = "humyn-recordings-kg-${var.env}"
  items = [aws_cloudfront_public_key.recordings_signer.id]
}
```

### 3.8 IAM scope summary

| Identity                                       | Permission                                                                                  | Resource                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| ECS execution role                             | `secretsmanager:GetSecretValue`                                                             | `humyn/jwt/signing-secret` ARN        |
| ECS execution role                             | `secretsmanager:GetSecretValue`                                                             | `humyn/gcp/play-integrity-sa-key` ARN |
| ECS execution role                             | `secretsmanager:GetSecretValue`                                                             | RDS-managed master credential ARN     |
| ECS execution role                             | AWS-managed `AmazonECSTaskExecutionRolePolicy`                                              | (ECR pull, CloudWatch logs)           |
| ECS task role                                  | `s3:PutObject` / `s3:GetObject` / `s3:AbortMultipartUpload` / `s3:ListMultipartUploadParts` | `humyn-recordings-${env}/*`           |
| ECS task role                                  | `s3:GetObject`                                                                              | `humyn-apk-${env}/*`                  |
| GCP service account `play-integrity-decoder@…` | `roles/playintegrity.tokenDecoder`                                                          | (cross-cloud — not in AWS IAM)        |
| CloudFront OAC                                 | `s3:GetObject` (via bucket policy)                                                          | `humyn-apk-${env}/*`                  |

**Region split:**

- All compute + storage: `ap-south-1` (Mumbai) per D-HOST-01.
- CloudFront ACM certificate: `us-east-1` (CloudFront-only constraint).
- Brazilian users: TLS terminates at the nearest CloudFront POP (São Paulo) and proxies to Mumbai. Multi-region deferred per CONTEXT.md "Deferred Ideas".

`[VERIFIED: CONTEXT.md D-HOST-01..04, D-AUTH-04, LEGAL-05; AWS docs for ECS task definition `secrets` field; CloudFront us-east-1 cert constraint per AWS official docs]`

## Section 4 — Android product-flavor source-set merging for REQUEST_INSTALL_PACKAGES

The hard requirement: `apkRollout` APKs must declare `REQUEST_INSTALL_PACKAGES` (so the in-app PackageInstaller can launch the OS install dialog for the next APK version per D-APK-02). Play Store APKs must NOT declare this permission — Google Play disallows it for our app category and the policy review is automated; one slip and the listing is blocked.

The Gradle source-set merger handles this cleanly: per-flavor `AndroidManifest.xml` files at `android/app/src/${flavor}/AndroidManifest.xml` are merged with the main manifest at build time. Permissions declared in a flavor's manifest appear only in that flavor's APK.

### 4.1 `android/app/build.gradle` — flavor block

```gradle
android {
    compileSdk 35
    namespace "ai.humynlabs.capture"

    defaultConfig {
        applicationId "ai.humynlabs.capture"  // overridden per flavor below
        minSdk 26
        targetSdk 35
        // versionCode + versionName come from CI — see 4.4
        versionCode (project.hasProperty('humynVersionCode')
                     ? project.humynVersionCode.toInteger() : 1)
        versionName (project.hasProperty('humynVersionName')
                     ? project.humynVersionName : '0.1.0')
    }

    flavorDimensions += "channel"

    productFlavors {
        playStore {
            dimension "channel"
            applicationId "ai.humynlabs.capture"
            // Identical branding per D-FLAV-03 — no resValue / manifestPlaceholders
            // override of app_name or icon. Same launcher icon, same display name.
            buildConfigField "String", "FLAVOR_NAME", "\"playStore\""
            // versionCode shared across flavors — see 4.4
        }

        apkRollout {
            dimension "channel"
            applicationId "ai.humynlabs.capture.apk"  // .apk suffix per D-FLAV-01
            buildConfigField "String", "FLAVOR_NAME", "\"apkRollout\""
        }

        // Note: iOS is an Xcode scheme target, NOT an Android product flavor.
        // The mobile RN repo has its own iOS scaffold under apps/mobile/ios/
        // with build configurations Debug.iosAppStore + Release.iosAppStore.
        // Do not declare an `iosAppStore` Android product flavor.
    }

    signingConfigs {
        playStoreRelease {
            storeFile file(System.getenv("PLAY_STORE_KEYSTORE_PATH")
                           ?: "${rootDir}/keystores/playstore.keystore")
            storePassword System.getenv("PLAY_STORE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("PLAY_STORE_KEY_ALIAS")
            keyPassword System.getenv("PLAY_STORE_KEY_PASSWORD")
        }
        apkRolloutRelease {
            storeFile file(System.getenv("APK_ROLLOUT_KEYSTORE_PATH")
                           ?: "${rootDir}/keystores/apkrollout.keystore")
            storePassword System.getenv("APK_ROLLOUT_KEYSTORE_PASSWORD")
            keyAlias System.getenv("APK_ROLLOUT_KEY_ALIAS")
            keyPassword System.getenv("APK_ROLLOUT_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                          'proguard-rules.pro'
            // Per-flavor signing — see 4.5
            productFlavors.playStore.signingConfig signingConfigs.playStoreRelease
            productFlavors.apkRollout.signingConfig signingConfigs.apkRolloutRelease
        }
        debug {
            // Both flavors use the standard Android debug keystore in dev
        }
    }

    buildFeatures {
        buildConfig true
    }
}
```

### 4.2 `android/app/src/main/AndroidManifest.xml` — base manifest

The base manifest carries permissions common to all flavors:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Common permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- (Phase 2+ adds CAMERA, RECORD_AUDIO, etc.) -->

    <application
        android:label="Humyn Labs Capture"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:theme="@style/AppTheme">
        <activity android:name=".MainActivity"
                  android:exported="true"
                  android:configChanges="..."
                  android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 4.3 `android/app/src/apkRollout/AndroidManifest.xml` — flavor-only manifest

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- ONLY in apkRollout — required for in-app PackageInstaller per D-APK-02 -->
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
</manifest>
```

`android/app/src/playStore/AndroidManifest.xml` does **not exist** (or exists as an empty `<manifest>` with no permissions). Either form is fine; an absent flavor manifest is the cleanest signal that no overrides are needed.

The Gradle manifest merger merges `main` + `${flavorName}` + `${buildType}` manifests in priority order (high to low: buildType > flavor > main). Permissions are **set-merged** — declared in any input → present in output. This means apkRollout's manifest adds the permission to its output APK, while playStore's APK never sees the permission because no input manifest contains it.

### 4.4 versionCode strategy across flavors — recommended

**Recommended:** Shared, monotonically-increasing sequence read from the CI build number. Both flavors use the same versionCode for any given commit.

**Why:**

- Simplest to reason about in support: "What versionCode are you on?" → one answer per release.
- The Play Store APK lives under one applicationId (`ai.humynlabs.capture`). The apkRollout APK lives under a separate applicationId (`ai.humynlabs.capture.apk`). Play Store rejects `versionCode` regressions only within a single applicationId — there is no cross-applicationId conflict, so we can freely share the sequence.
- Forced-upgrade flow per D-APK-02 needs `latest` and `min_supported` to compare cleanly to the device's installed `versionCode`. Same number across flavors keeps `GET /app/version` simple.

**Implementation in CI:**

```bash
# .github/workflows/release.yml (assuming GitHub Actions per CONTEXT discretion)
- name: Compute versionCode
  run: |
    # Use GITHUB_RUN_NUMBER as the monotonically-increasing source.
    # GitHub Actions guarantees this is monotonic per repo per workflow.
    echo "HUMYN_VERSION_CODE=${{ github.run_number }}" >> $GITHUB_ENV
    # versionName is the human tag from the git tag (e.g., 1.6.2)
    echo "HUMYN_VERSION_NAME=${{ github.ref_name }}" >> $GITHUB_ENV

- name: Build all flavors
  run: |
    cd android && ./gradlew \
      -PhumynVersionCode=$HUMYN_VERSION_CODE \
      -PhumynVersionName=$HUMYN_VERSION_NAME \
      :app:assemblePlayStoreRelease \
      :app:assembleApkRolloutRelease
```

Alternative (rejected): flavor-prefixed `versionCode` (e.g., apkRollout uses `2_xxxxxx`, playStore uses `1_xxxxxx`). Adds code complexity for no operational gain at our scale.

### 4.5 Per-flavor signing — keystores out of repo

The keystores **must not** be committed. Layout:

```
android/keystores/
├── .gitignore     # contents: *
├── playstore.keystore       (decrypted at CI runtime)
└── apkrollout.keystore      (decrypted at CI runtime)
```

`.gitignore` ensures everything in `android/keystores/` is ignored. CI decrypts encrypted keystore files into this directory just before build:

```yaml
- name: Decrypt keystores
  env:
    KEYSTORE_DECRYPT_KEY: ${{ secrets.KEYSTORE_DECRYPT_KEY }}
  run: |
    mkdir -p android/keystores
    echo "$KEYSTORE_DECRYPT_KEY" | base64 -d > /tmp/decrypt.key
    openssl enc -aes-256-cbc -d -pbkdf2 \
      -in encrypted/playstore.keystore.enc \
      -out android/keystores/playstore.keystore \
      -pass file:/tmp/decrypt.key
    openssl enc -aes-256-cbc -d -pbkdf2 \
      -in encrypted/apkrollout.keystore.enc \
      -out android/keystores/apkrollout.keystore \
      -pass file:/tmp/decrypt.key

- name: Set keystore env vars
  run: |
    echo "PLAY_STORE_KEYSTORE_PATH=android/keystores/playstore.keystore" >> $GITHUB_ENV
    echo "PLAY_STORE_KEYSTORE_PASSWORD=${{ secrets.PLAY_STORE_KEYSTORE_PASSWORD }}" >> $GITHUB_ENV
    echo "PLAY_STORE_KEY_ALIAS=${{ secrets.PLAY_STORE_KEY_ALIAS }}" >> $GITHUB_ENV
    echo "PLAY_STORE_KEY_PASSWORD=${{ secrets.PLAY_STORE_KEY_PASSWORD }}" >> $GITHUB_ENV
    echo "APK_ROLLOUT_KEYSTORE_PATH=android/keystores/apkrollout.keystore" >> $GITHUB_ENV
    echo "APK_ROLLOUT_KEYSTORE_PASSWORD=${{ secrets.APK_ROLLOUT_KEYSTORE_PASSWORD }}" >> $GITHUB_ENV
    echo "APK_ROLLOUT_KEY_ALIAS=${{ secrets.APK_ROLLOUT_KEY_ALIAS }}" >> $GITHUB_ENV
    echo "APK_ROLLOUT_KEY_PASSWORD=${{ secrets.APK_ROLLOUT_KEY_PASSWORD }}" >> $GITHUB_ENV
```

**Critical:** Per CONTEXT.md "Specifics" — apkRollout keystore is permanent. Lose it = lose update path for all current apkRollout users. Off-site cold backup of both keystores + passwords (e.g., 1Password vault, AWS Secrets Manager, hardware key) in addition to CI secrets.

### 4.6 Verifying the manifest merger output

The verification command — run as a CI step and as a local sanity check:

```bash
# Build the merged manifest only (no full APK)
./gradlew :app:processApkRolloutReleaseManifest
./gradlew :app:processPlayStoreReleaseManifest

# Inspect the merged output. The merged manifest lives at:
#   app/build/intermediates/merged_manifest/${flavor}${BuildType}/AndroidManifest.xml
# Newer AGP versions may use:
#   app/build/intermediates/merged_manifests/${flavor}${BuildType}/processManifest/AndroidManifest.xml
# Verify whichever path AGP 8.7 emits for the project.

# Pass condition: REQUEST_INSTALL_PACKAGES present in apkRollout, absent in playStore
grep -c "REQUEST_INSTALL_PACKAGES" \
  app/build/intermediates/merged_manifest/apkRolloutRelease/AndroidManifest.xml
# expect: 1

grep -c "REQUEST_INSTALL_PACKAGES" \
  app/build/intermediates/merged_manifest/playStoreRelease/AndroidManifest.xml
# expect: 0
```

Bake those two greps into a CI step that exits non-zero on the wrong count. This is the canonical guard against accidentally leaking `REQUEST_INSTALL_PACKAGES` into the Play Store APK on a future merge or refactor.

### 4.7 Flavor wiring at runtime — JS reads BuildConfig.FLAVOR

**Recommended:** `react-native-config@1.6.1` with per-flavor `.env.${flavor}` files. Simpler than a custom TurboModule and zero native code.

```
apps/mobile/.env.playStore
  FLAVOR_NAME=playStore
  APPLICATION_ID=ai.humynlabs.capture
  API_BASE_URL=https://api.humyn.ai
  GOOGLE_WEB_CLIENT_ID=<firebase web oauth client id>

apps/mobile/.env.apkRollout
  FLAVOR_NAME=apkRollout
  APPLICATION_ID=ai.humynlabs.capture.apk
  API_BASE_URL=https://api.humyn.ai
  GOOGLE_WEB_CLIENT_ID=<firebase web oauth client id>

apps/mobile/.env.iosAppStore
  FLAVOR_NAME=iosAppStore
  APPLICATION_ID=ai.humynlabs.capture
  API_BASE_URL=https://api.humyn.ai
  GOOGLE_WEB_CLIENT_ID=<firebase web oauth client id>
```

Wire `react-native-config` to pick the right `.env` per flavor in `android/app/build.gradle`:

```gradle
// In productFlavors block, set ENVFILE for each flavor
productFlavors {
    playStore {
        // ... applicationId etc.
        project.ext.envConfigFiles = [playStoreRelease: ".env.playStore",
                                       playStoreDebug: ".env.playStore"]
    }
    apkRollout {
        project.ext.envConfigFiles = [apkRolloutRelease: ".env.apkRollout",
                                       apkRolloutDebug: ".env.apkRollout"]
    }
}

// At top of file, after android { }:
apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
```

JS-side consumption:

```typescript
import Config from 'react-native-config';

export interface FlavorContext {
  flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
  applicationId: string;
}

export function getFlavorContext(): FlavorContext {
  return {
    flavor: Config.FLAVOR_NAME as FlavorContext['flavor'],
    applicationId: Config.APPLICATION_ID!,
  };
}

// In sign-in screen:
const { flavor, applicationId } = getFlavorContext();
await fetch(`${Config.API_BASE_URL}/auth/google`, {
  method: 'POST',
  body: JSON.stringify({
    googleIdToken,
    integrityToken,
    flavor,
    applicationId,
    nonceId,
  }),
  // ...
});
```

The TurboModule alternative — direct `BuildConfig.FLAVOR` access via a custom `NativeFlavorInfo` module — is more code for no operational benefit at this scope. Defer.

`[VERIFIED: D-FLAV-01..03, D-APK-02..03 in CONTEXT.md; Android Gradle Plugin manifest-merger reference at developer.android.com/build/manage-manifests]`
