# Phase 1: Foundation, Backend & Distribution Recon - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 ships the backend skeleton, monorepo, and direct-to-users APK distribution stack. Concretely:

- **Fastify backend** with all 17 REST endpoints in the spec (`/auth/google`, `/me` CRUD + restore, `/tasks` + `/task-requests`, `/recordings` lifecycle, `/contributions` + timeseries, `/events`, `/feedback`, `/app/version`) running against LocalStack S3 + Postgres 17 + pgvector locally and against RDS + S3 + ECS in staging.
- **Auth + Play Integrity** at sign-in: `/auth/google` exchanges Google ID token + Play Integrity attestation + `{flavor, applicationId}` pair for a Humyn JWT; rejects rooted/emulator/non-Play-Store; apkRollout install-source bypass via server-side allowlist.
- **Three signed Android product flavors** (`apkRollout`, `playStore`, `iosAppStore`) coexist with distinct `applicationId`s, identical branding, CI-signed via encrypted secrets.
- **`/tasks` hybrid search** infrastructure (Drizzle schema + pgvector HNSW index + tsvector GIN index + Reciprocal Rank Fusion SQL at k=60) seeded from `design-system/task-icons/mapping.json`; embeddings via self-hosted `all-MiniLM-L6-v2` ONNX in-process.
- **S3 day-zero lifecycle policy** (Glacier IR at +7d, Deep Archive at +90d) and Terraform infra-as-code for staging + prod environments in AWS ap-south-1.
- **DPDP/LGPD parallel ops track** engaged (counsel firm, consent versioning, takedown SOP, data-subject-rights surface) — not a hard gate on distribution.
- **Phase 1 mobile deliverable:** RN 0.83 scaffolded with all three flavors. Each flavor builds, signs, and runs a single 'Sign in with Google' screen that exercises `/auth/google` end-to-end. No tasks, no recording, no profile — that's Phase 2.

**Explicitly OUT of Phase 1 scope (rescinded mid-discussion):**
- DIST-07 (compatRecon APK to ~50 KGeN clan chiefs) — rescinded.
- ROADMAP.md Phase 1 success criterion #3 (chief recon harvest go/no-go) — rescinded.
- All clan-chief / KGeN-acquisition narrative — superseded; cleanup pending.
- Any fleet-recon construct that pre-validates device addressability before users hit the app.

</domain>

<decisions>
## Implementation Decisions

### Distribution model (supersedes prior PROJECT.md narrative)

- **D-DIST-01:** No clan-chief / KGeN-acquisition narrative. Distribution = direct-to-users signed APK first → Play Store → iOS App Store. No fleet recon. No chief intermediary. (User correction during this discussion; saved to memory as `feedback_no_clan_chief_constructs.md` + `project_distribution_apk_then_play.md`.)
- **D-DIST-02:** Device-fleet viability is gated by Phase 2's in-app behavioral compat check (COMPAT-01..08) running on real users post-APK-share. No pre-rollout signal. User explicitly accepts this risk.

### Build flavors & app identity (Android)

- **D-FLAV-01:** Android `applicationId`s — `playStore` = `ai.humynlabs.capture` (canonical, permanent — once on Play Store, never changes); `apkRollout` = `ai.humynlabs.capture.apk` (`.apk` suffix). iOS `iosAppStore` bundle ID = `ai.humynlabs.capture` (mirrors playStore canonical; iOS doesn't co-install).
- **D-FLAV-02:** Any future sub-flavor that ships sequentially to the apkRollout audience (e.g., a forced-update-vehicle build) shares `applicationId` with apkRollout. Same signing key. Later builds cleanly overwrite older.
- **D-FLAV-03:** Identical branding — display name `"Humyn Labs Capture"` and same launcher icon across all three flavors. Channel signal lives in app behavior, not branding.

### Backend auth contract

- **D-AUTH-01:** Client sends `{flavor: 'apkRollout' | 'playStore' | 'iosAppStore', applicationId: string}` to `POST /auth/google` alongside the Google ID token + Play Integrity attestation token. Backend cross-checks `(flavor, applicationId)` against a server-side allowlist (`apkRollout ↔ ai.humynlabs.capture.apk`; `playStore/iosAppStore ↔ ai.humynlabs.capture`). Mismatch = `403 problem+json`.
- **D-AUTH-02:** Install-source bypass for `apkRollout` is enforced server-side via the same allowlist. The client cannot toggle this. Play Integrity verdicts {DEVICE_INTEGRITY, APP_RECOGNITION} are still required and validated; only the `PLAY_RECOGNIZED` requirement is waived for `apkRollout`.
- **D-AUTH-03:** JWT TTL = **30 days, long-lived, no refresh token, no server-side denylist**. Logout = client deletes token from Keychain (iOS) / Keystore (Android) per AUTH-07 + cancels in-flight upload per UP-13. Token-leak blast radius capped at 30-day expiry. After 30 days, user re-runs full Google Sign-In + Play Integrity.
- **D-AUTH-04:** JWT signed with **HS256**. Single 256-bit signing secret stored in **AWS Secrets Manager** (`humyn/jwt/signing-secret`). Fargate task definition references the secret ARN; ECS injects as env var at task start. Rotation via Secrets Manager + rolling Fargate task restart.
- **D-AUTH-05:** JWT payload (rich claims): `{ sub: ULID, iat, exp, flavor, applicationId, integrity_verdict: 'passed' | 'bypassed_apk', token_version: 1 }`. Backend reads `flavor` + `integrity_verdict` from token directly — no per-request DB lookup. `token_version` reserved as cluster-wide kill-switch (bumping invalidates all outstanding tokens).

### `/tasks` hybrid search

- **D-EMB-01:** Embedding provider = **self-hosted `all-MiniLM-L6-v2`** (ONNX, 384-dim). No external API key, no rate limit, no per-call cost.
- **D-EMB-02:** Inference runs **in-process inside Fastify** via `@xenova/transformers` (or `onnxruntime-node`). Single deployable. Cold-start adds ~1–3s on first request (model load); steady-state ~50–200ms per query embedding on CPU-only ECS Fargate.
- **D-EMB-03:** Embeddings computed at **seed time only** via `pnpm seed:tasks`. CI guards re-seed when `task-taxonomy.md` or `design-system/task-icons/mapping.json` change. No background refresh job, no lazy-on-first-read fill. Drift only happens if someone forgets to re-seed; CI catches it.
- **D-EMB-04:** Embedded text per task = `${name}. ${description}. Category: ${category}.` Excludes `instructions` (formulaic boilerplate dilutes signal), `setting` (filter axis not search axis), `warning` (rarely populated).

### Backend hosting

- **D-HOST-01:** AWS region = **ap-south-1 (Mumbai)** single region + CloudFront for global edge. Brazil traffic terminates TLS at S3 / Rio CloudFront POPs and proxies back to Mumbai. Data residency in India (DPDP-aligned; LGPD allows cross-border with consent per `idea-brief.md` §5.2).
- **D-HOST-02:** Postgres = **RDS PostgreSQL 17, single-AZ at MVP**. Hosts pgvector 0.8.0 + tsvector + everything else (users, recordings, tasks, task_requests, consent_log, app_version, events). Multi-AZ when load justifies.
- **D-HOST-03:** Compute = **ECS Fargate behind ALB**. Single Fargate task at MVP. Embedding ONNX model loads at task start. Auto-scale on CPU/memory/request count when traffic justifies.
- **D-HOST-04:** **ElastiCache Redis deferred to Phase 5** (BullMQ hash-verify worker). Phase 1 uses **in-process LRU** for idempotency-key store + **in-process @fastify/rate-limit** (default memory store). Single-replica architecture only at Phase 1; multi-replica scale-up requires Redis stand-up first.

### APK distribution (direct-to-users)

- **D-APK-01:** APK hosting = **S3 + CloudFront public**. URL pattern: `https://apk.humyn.ai/humyn-labs-capture-v{version}.apk`. Versioned filenames so multiple versions coexist. Latest pointer = JSON manifest queried via `GET /app/version`.
- **D-APK-02:** Forced-upgrade flow for apkRollout = **in-app PackageInstaller**. `GET /app/version` returns `{ min_supported, latest, force_upgrade, apk_url, apk_sha256 }` for `apkRollout` flavor responses (Play Store flavor returns `play_store_url` instead). Phase 2 wires the in-app HTTP GET → SHA-256 verify → PackageInstaller call. apkRollout flavor declares `REQUEST_INSTALL_PACKAGES` via flavor-scoped manifest (`android/app/src/apkRollout/AndroidManifest.xml`); Play Store flavor does NOT declare it.
- **D-APK-03:** Signing keys: separate **apkRollout self-managed keystore** + separate **Play Store upload keystore**. Both stored in CI provider's encrypted secrets. CI signs every release build. Play App Signing handles Google's re-signing on the Play side. Two keys, both on day 0; lose either = lose update path on that channel.
- **D-APK-04:** Phase 1 mobile deliverable scope: **buildable scaffold + auth check**. RN 0.83 scaffolded with three product flavors (`apkRollout`, `playStore`, `iosAppStore`); each builds, signs, runs. Single 'Sign in with Google' screen → POST `/auth/google` with `{flavor, applicationId}` → shows `Welcome, {name}` on success. No tasks, no recording, no profile, no permissions UI, no compat check — those are Phase 2. Phase 1 proves the auth + flavor + JWT pipeline end-to-end.

### Legal & data-rights

- **D-LEGAL-01:** DPDP (India) + LGPD (Brazil) counsel review is a **parallel ops track, NOT a hard gate** on APK or Play Store distribution. Counsel deliverables (consent text, takedown SOP, data-subject-rights API surface, ANPD/DPB registrations) ship asynchronously as ready. User explicitly accepts the legal-exposure tradeoff.
- **D-LEGAL-02:** DSR API surface at MVP = **erasure only**. Endpoints: `DELETE /me` (soft-delete + 30-day grace), `POST /me/restore`, `PATCH /me` (in-app correction for name/age/gender). Access/portability requests handled via Help Center mailto → ops manually builds a ZIP archive (profile + recordings list + metadata; recordings referenced by S3-signed URLs in the manifest) and emails a download link within the documented SLA. **No `GET /me/export` endpoint at MVP.**
- **D-LEGAL-03:** Consent log = **append-only `consent_log` table** with columns `(id, user_id, consent_version, consent_text_hash, accepted_at, ip, user_agent, build_flavor)` + denormalized `users.consent_version` and `users.consent_accepted_at` for fast reads. Every initial accept and every re-accept on text bump writes a new row. Denormalized cache updated atomically with the insert. Counsel can verify any historical state from `consent_log` alone.
- **D-LEGAL-04:** Takedown SOP = **ops runbook + manual DB script**. SOP doc lives in repo (or Notion if the team prefers). Execution = ops engineer runs a script against RDS that flips `recordings.qa_status = 'takedown'` + transitions S3 lifecycle for those object keys to immediate-deletion + sets `users.deleted_at` if user-level takedown. **No admin HTTP endpoint, no admin UI at MVP.** Eng's responsibility ends at making the schema queryable via Drizzle.

### Locked from upstream (carried forward, not re-discussed)

These are LOCKED in PROJECT.md / .planning/research/STACK.md / engineering-handoff.md and unconditionally apply:

- Stack pins: `fastify@5.8.5`, `drizzle-orm@0.45.2`, `pg@8.20.0`, `pgvector@0.8.0`, `@aws-sdk/client-s3@3.1044.0` + `s3-request-presigner@3.1044.0`, `google-auth-library@10.6.2`, `pino@10.3.1`, `zod@4.4.3`, `vitest@4.1.5`, Postgres 17, Node 22 LTS.
- Stack pins (mobile, used in Phase 1's scaffold): `react-native@0.83.x`, `react@19.2.x`, Hermes V1, New Architecture, `@react-native-google-signin/google-signin@16.1.2` (Credential Manager API on Android), `@react-native-firebase/{app,auth,remote-config}@24.0.0`, `react-native-keychain@10.0.0`, `react-native-mmkv@4.3.1`, `react-native-config@1.6.1`.
- Auth flow: Google Sign-In via Credential Manager API (Android 14+ mandatory), `webClientId` from Firebase. Play Integrity **Standard** requests (NOT Classic). **Google-Managed decryption** (default) — backend never holds Play Integrity keys.
- S3 day-zero lifecycle (LEGAL-05): Glacier IR at +7 days, Deep Archive at +90 days. Applied to both staging and prod buckets via Terraform.
- 17 backend API endpoints (API-01..17) with RFC 7807 `application/problem+json` error shape and `Idempotency-Key` header support on all `POST`/`PATCH` endpoints.
- `/tasks` semantic search: **Reciprocal Rank Fusion at k=60** of (pgvector cosine via HNSW `vector_cosine_ops`) + (tsvector lexical via GIN on generated `to_tsvector('english', name || ' ' || description)`).
- Recording entity schema sourced from `video_metadata.json` (canonical metadata format); Task seeded from `design-system/task-icons/mapping.json` + `task-taxonomy.md`.
- Repo layout: `apps/mobile/`, `apps/api/`, `shared/`, `infra/terraform/envs/{staging,prod}/`. Tooling: pnpm workspaces, Vitest, Zod schemas in `shared/types/`, Drizzle migrations.
- File-fidelity rule: MP4 + IMU CSV + metadata JSON travel byte-for-byte from device to S3. Backend NEVER decodes / re-encodes / strips. (Phase 5 territory; flagged here because S3 lifecycle policy must not transcode.)

### Claude's Discretion

Areas where the user did not specify and the planner has flexibility:

- **versionCode strategy across flavors** (shared sequence vs flavor-prefixed). Lock during planning.
- **CI provider choice** (GitHub Actions vs GitLab CI vs CircleCI). The "Self-key in CI secrets" answer implies whichever the team uses; planner picks based on existing repo / org tooling. GitHub Actions is the default expected.
- **Idempotency-key store implementation**: in-process LRU cache size + TTL; whether to back it with Postgres for persistence across Fargate task restarts. Planner-level.
- **HNSW index parameters** (`m`, `ef_construction`, `ef_search`). At 65 tasks the defaults are fine; revisit only if recall is poor.
- **RRF `k` constant**. Locked at 60 by stack research; planner can tune if testing shows otherwise.
- **Pre-commit hooks** (husky vs lefthook vs none), lint/format (ESLint+Prettier vs Biome), monorepo build cache (pnpm only vs Turborepo). Planner-level.
- **Search-query embedding cache** (whether to LRU-cache embeddings of common search queries). Planner-level optimization.
- **Drizzle migration timing** (CI step vs boot-time check). Planner-level.
- **/events backend ingest scope** at Phase 1 (real Postgres `events` table with indexed schema vs stub endpoint that 200's and drops payload). Firebase Analytics is the primary telemetry sink (OBS-02); backend `/events` exists as a complement. Planner picks based on whether Phase 1 needs the data for go/no-go visibility.
- **Per-flavor Remote Config keys** (`enforce_install_source.${applicationId}` vs single `apkRollout_bypass` boolean vs server-side-only allowlist). The auth contract is server-side-cross-checked per D-AUTH-01 / D-AUTH-02; Remote Config is a redundant client-side knob that the planner can include or omit.
- **APK SHA-256 fingerprint disclosure UX** (publish on humyn.ai marketing site vs in-app About screen vs neither). Phase 2+ surface.
- **Marketing-side discovery mechanism** for the apkRollout APK URL (email blast / marketing site / social). Operational/PM concern; not Phase 1 engineering scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / process docs

- `.planning/PROJECT.md` — project overview, locked constraints, key decisions table. **NOTE:** still references stale clan-chief / KGeN narrative; treat that as superseded per `D-DIST-01`. Cleanup deferred.
- `.planning/REQUIREMENTS.md` — 199 v1 requirements with phase mapping. **NOTE:** DIST-07 is rescinded per `D-DIST-01`; do not plan for it.
- `.planning/ROADMAP.md` — 7-phase roadmap, success criteria, depends-on graph. **NOTE:** Phase 1 success criterion #3 (chief recon harvest go/no-go) is rescinded per `D-DIST-01`.
- `.planning/STATE.md` — current position, blockers/concerns, deferred items.

### Locked spec source-of-truth (Phase 1 inputs)

- `idea-brief.md` — canonical product spec. Phase 1 hot spots: §2.1 (capture spec — for the Recording schema), §5.2 (verbatim consent text — feeds `consent_log.consent_text_hash`), §10 (lifecycle table — relevant from Phase 4 but referenced in metadata schema), §13 (anti-fraud), §14 (privacy/consent), §15 (rollout sequence).
- `engineering-handoff.md` §7 — data model entities (User, Task, Recording, Contribution, TaskRequest); §8 — REST API surface (the 17 endpoints); §9 — validation rules.
- `task-taxonomy.md` — 65 tasks across 10 categories with universal rules + per-task instructions; seed source for the `tasks` table.
- `video_metadata.json` — canonical metadata schema for uploaded segments; basis for `shared/types/Recording.ts`. Phase 1 stores this verbatim from the device upload (Phase 5 hash-verify reads it back).
- `design-system/task-icons/mapping.json` (and `mapping.ts`) — task seed source + lucide icon name union (`LucideIconName`); `tasks.iconKey` is constrained to this union at compile time on the client; backend treats `iconKey` as a string.
- `help-center-content.md` — verbatim Help Center copy (Phase 2 surface).
- `prototype.html` + `design-spec.md` — locked design references (Phase 2+ relevance; Phase 1 mobile is sign-in-only).

### Research synthesis (treat as background; some references are stale)

- `.planning/research/SUMMARY.md` — research synthesis. **NOTE:** still references chief-recon construct; treat that as superseded per `D-DIST-01`. Tech-stack pins and architecture sections remain valid.
- `.planning/research/STACK.md` — tech-stack version pins, configuration recipes (HEVC encoder, MediaPipe wiring, foreground service manifest, Drizzle schema with pgvector + tsvector RRF SQL — directly applicable to Phase 1's `tasks` table design), what NOT to use.
- `.planning/research/ARCHITECTURE.md` — system architecture (3-plane device → backend → infra), build-flavor + Remote Config bypass pattern. **NOTE:** the chief-recon-APK design called out here is rescinded; the rest of the architecture (Fastify monolith + RDS + S3 + lifecycle policy + ALB + Fargate) applies.
- `.planning/research/PITFALLS.md` — pitfall catalog. Phase 1 hot spots: Pitfall 14 (DPDP/LGPD bystander consent — informs the `consent_log` table design), Pitfall 16 (S3 lifecycle policy from day 0 — locked as LEGAL-05). **NOTE:** Pitfall 2's "ship a *standalone compat-only APK* to 50 chiefs" recommendation is rescinded per `D-DIST-01`.
- `.planning/research/FEATURES.md` — competitor landscape, feature dependency graph (background; informs no Phase 1 decisions directly).

### Operational / future (referenced but not Phase 1 scope)

- `imu-liveness-check.md` — server-side fraud-detection design (Phase 5 territory).
- `strategic-suggestions.md` — PM-level concerns parked for v2.
- `deferred-decisions.md` — technical decisions parked for v2 (note: `hands-in-frame` entry is partially superseded — clean up post-init).
- `testing-guide.md` — Pixel 10a runbook + monorepo dev environment guide. Phase 1 implements the layout this guide assumes (`apps/mobile/`, `apps/api/`, `shared/`, `infra/terraform/`); the testing-guide forward-references a now-missing `implementation-plan.md` — discard that reference.

### Active memories (apply unconditionally)

- `feedback_no_clan_chief_constructs.md` — no clan-chief / clan-aware constructs; chief-network narrative in PROJECT.md/REQUIREMENTS.md/ROADMAP.md/research/* is stale.
- `project_distribution_apk_then_play.md` — distribution = APK first then Play Store, direct to users. DIST-07 rescinded.
- `project_drift_metrics.md` — per-segment metadata records `{max, mean, p99}` drift figures (Phase 3 territory; relevant only for Phase 1's Recording schema definition).

</canonical_refs>

<code_context>
## Existing Code Insights

The repo is **fresh greenfield** at Phase 1 entry. No source code exists; the only buildable artifacts in the repo today are documentation (`.md`), the design-system assets, the Figure reference APK (`0.16.0.apk` + decompiled tree — NOT our app code), and reference media (`landscape_enforcement.mp4`, `home_screen_reference.png`, `logo.js`).

### Reusable Assets

- **`design-system/task-icons/mapping.json`** + **`mapping.ts`** — drives `tasks` seed. The `LucideIconName` union in `mapping.ts` is the compile-time constraint for `Task.iconKey`. Phase 1's seed script reads this file directly and INSERTs one `tasks` row per entry.
- **`design-system/task-icons/TaskIcon.tsx`** + **`index.ts`** — RN component for rendering task icons. Not used in Phase 1's sign-in-only mobile scaffold but stays in `apps/mobile/` for Phase 2+.
- **`video_metadata.json`** — canonical metadata schema. Phase 1 transcribes this into `shared/types/Recording.ts` (Zod schema) for use by both client (validation pre-upload) and backend (validation on `POST /recordings`).
- **`task-taxonomy.md`** — 65-task taxonomy. Phase 1's seed pipeline parses the markdown into structured rows (one per task) and merges with `mapping.json` for `iconKey`.
- **`logo.js`** — RN component exporting the Humyn logo SVG. Used in the sign-in scaffold's hero placeholder.

### Established Patterns

None — Phase 1 establishes them. Phase 1 sets the precedents that Phase 2-7 inherit:
- Drizzle migration file naming + folder layout under `apps/api/db/migrations/`
- Zod schema sharing pattern under `shared/types/`
- pnpm workspace topology
- CI pipeline shape (lint → typecheck → unit → integration-against-LocalStack)
- Terraform module layout under `infra/terraform/{modules,envs}/`

### Integration Points

None yet. Phase 1 builds:
- Backend → S3 (presigned URL minting via `@aws-sdk/s3-request-presigner`)
- Backend → Postgres (Drizzle ORM)
- Backend → AWS Secrets Manager (JWT signing secret retrieval)
- Backend → Google OAuth (`google-auth-library` for ID token verification)
- Backend → Google Play Integrity API (Standard request decryption — Google-managed)
- Mobile → Backend (`/auth/google` for the sign-in scaffold)
- CI → AWS (deploy via Terraform; sign APK via encrypted keystore secrets)

</code_context>

<specifics>
## Specific Ideas

- **Per-flavor manifest scoping** for `REQUEST_INSTALL_PACKAGES`. Android flavor source sets at `android/app/src/{apkRollout,playStore,iosAppStore}/AndroidManifest.xml`. Only the apkRollout source set declares the in-app-installer permission. Manifest merging produces three distinct AndroidManifest.xmls at build time.
- **APK signing-key fingerprint** is the publisher identity that users see in the Android "Install unknown apps" sideload prompt. Generate the apkRollout keystore once; preserve it forever (lose the key = lose update path for all current apkRollout users — they'd need to uninstall and re-install with a fresh key, breaking session continuity). Store an offline backup of the keystore + password in addition to CI secrets.
- **Server-side allowlist** for the `(flavor, applicationId)` cross-check belongs in code, not in DB or Remote Config. It's a permanent contract; changing it requires a code review + deploy. Hard-coded constant in `apps/api/src/auth/flavor-allowlist.ts`.
- **`token_version` kill-switch** (D-AUTH-05) is a single integer in DB / config. Backend validates `token.token_version >= server.current_token_version` on every authed request; mismatch = 401 → forces client re-sign-in. Bumping is an ops action, not an API call. Use case: post-breach response, post-keypair rotation, post-policy-change.
- **Embedding seed reproducibility:** `pnpm seed:tasks` must be deterministic — same model + same input text = same vector. The MiniLM ONNX model has a fixed random init; pinning the model checksum in `apps/api/package.json` (or via a `models/` checked-in artifact) avoids "embeddings drift after a Node-modules update." Vectors stored in Postgres, not regenerated per request.
- **`consent_log` ↔ `users` denorm coherence:** every insert to `consent_log` must atomically update `users.consent_version` and `users.consent_accepted_at` (transaction). Drizzle's transaction API. Backfill: at first sign-in, the User row is created and the first `consent_log` row inserted in the same transaction.
- **Direct-to-users APK URL** likely lives under a hostname the user controls (e.g., `https://apk.humyn.ai/...` or `https://capture.humyn.ai/download/...`). Phase 1 sets up the S3 bucket + CloudFront distribution + Route 53 record; the actual marketing URL string is a planner-level detail.
- **Phase 1 mobile sign-in success screen** can be the simplest possible UI: one Image (Humyn logo from `logo.js`), one button ("Sign in with Google"), one Text node ("Welcome, {name}" after success). No design tokens, no theming, no navigation library. The point is to exercise the auth + flavor pipeline, not to ship UX.

</specifics>

<deferred>
## Deferred Ideas

### Belongs in other phases or future cleanup

- **PROJECT.md / REQUIREMENTS.md / ROADMAP.md / .planning/research/SUMMARY.md / .planning/research/PITFALLS.md cleanup** to remove stale clan-chief / KGeN / chief-network narrative. Out-of-scope for `/gsd:discuss-phase`; needs its own command (likely a `/gsd:cleanup` pass or manual edits with user approval). DIST-07 needs to be removed from REQUIREMENTS.md and the phase-1 mapping; ROADMAP.md Phase 1 success criterion #3 needs to be rephrased or dropped; PROJECT.md "Active" requirements list needs the chief-acquisition narrative removed.
- **Multi-region deployment (sa-east-1 for Brazil)** — defer until India-only proves latency to Brazil users is unacceptable.
- **ElastiCache Redis stand-up** — Phase 5, when BullMQ hash-verify worker lands.
- **Self-serve `GET /me/export` endpoint** — v1.1 or v2, if DSR ticket volume justifies investment.
- **Admin HTTP endpoint or admin dashboard** — v2.
- **Per-upload Play Integrity attestation** (`FRAUD-V2-01`) — v2.
- **APK SHA-256 fingerprint disclosure UX** in-app or marketing — Phase 2 surface decision.
- **APK distribution discovery mechanism** (where users find the URL — email, marketing site, social) — operational/PM, not Phase 1 engineering.
- **versionCode sequencing across flavors** — planner-level for Phase 1.
- **HNSW index tuning** (`m`, `ef_construction`, `ef_search`) — planner-level; revisit when search-quality testing shows recall is poor.
- **Search-query embedding cache** — planner-level optimization.
- **Pre-commit hooks / lint/format choice / monorepo build cache (pnpm-only vs Turborepo)** — planner-level.
- **CI provider choice** (GitHub Actions assumed default) — planner-level.
- **/events backend ingest scope** (real ingest table vs stub) — planner picks given Firebase Analytics is the primary telemetry sink.

</deferred>

---

*Phase: 1-Foundation, Backend & Distribution Recon*
*Context gathered: 2026-05-07*
