---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 2 context gathered
last_updated: '2026-05-09T11:46:02.885Z'
last_activity: 2026-05-09 -- Phase 02 execution started
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 35
  completed_plans: 24
  percent: 69
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** On-device capture quality is non-negotiable — every uploaded segment must hit the locked spec (1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms timestamp alignment) or the bytes are worthless for training.
**Current focus:** Phase 02 — mobile-shell-onboarding-permissions-compat-profile

## Current Position

Phase: 02 (mobile-shell-onboarding-permissions-compat-profile) — EXECUTING
Plan: 1 of 22
Status: Executing Phase 02
Last activity: 2026-05-09 -- Phase 02 execution started

Progress: [█████████░] 91%

## Resume Path (set before pause)

To resume Phase 1:

1. Install JDK 17: `brew install --cask temurin17`
2. Install Android SDK + adb: `brew install --cask android-platform-tools` (for adb) + Android Studio or `cmdline-tools` for `compileSdk=35` + `ANDROID_HOME` exported
3. Bootstrap Gradle wrapper in `apps/mobile/android/`: open in Android Studio once, OR run `gradle wrapper --gradle-version 8.11.1` from that dir
4. Firebase Console → create project → register apps `ai.humynlabs.capture.apk` (apkRollout) + `ai.humynlabs.capture` (playStore) → copy Web client ID into BOTH `apps/mobile/.env.apkRollout` and `apps/mobile/.env.playStore`
5. Start the dev API: `pnpm --filter @humyn/api dev` (binds :8080)
6. Expose backend to phone: either `API_BASE_URL=http://<your-mac-LAN-ip>:8080` (same WiFi) OR ngrok tunnel to :8080 — update both `.env.*` files
7. Plug in Pixel-class device with USB debugging on, accept the RSA prompt; verify with `adb devices`
8. Walk through `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` step-by-step — fill checkboxes, commit when done
9. `/gsd:execute-phase 1` — orchestrator picks up at 01-12 (Wave 4 E2E + GitHub Actions CI)

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: ~10.4 min
- Total execution time: ~1.57 hours

**By Phase:**

| Phase    | Plans  | Total  | Avg/Plan  |
| -------- | ------ | ------ | --------- |
| Phase 01 | 9 / 13 | 94 min | ~10.4 min |
| 1        | 13     | -      | -         |

**Recent Trend:**

- Last 9 plans: 01-01 (7 min, 3 tasks, 22 files), 01-03 (5 min, 3 tasks, 7 files), 01-02 (6 min, 3 tasks + checkpoint, 11 files), 01-04 (9 min, 3 tasks, 18 files), 01-05 (13 min, 4 tasks, 25 files), 01-06 (18 min, 3 tasks, 17 files), 01-07 (12 min, 4 tasks, 17 files), 01-08 (17 min, 3 tasks, 28 files), 01-09 (7 min, 3 tasks, 19 files)
- Trend: 01-09 the lightest of the phase — pure mobile-side scaffolding (no backend wiring, no DB migrations, no live-server smoke), 5 deviations all auto-fixed in-task, lands cleanly under the 11-min phase average. Phase 1 mobile scaffold is now ready for plan 01-13's Sign-In screen.

_Updated after each plan completion_
| Phase 01 P08 | 17 min | 3 tasks | 28 files |
| Phase 1 P9 | 7min | 3 tasks | 19 files |
| Phase 01 P12 | 28min | 3 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Codename "Homelander"; product brand "Humyn Labs Capture"
- Init: Backend included in MVP scope (Fastify + Postgres + S3) — hash-verify and presigned URLs are core to upload reliability
- Init: Designs LOCKED to `prototype.html` + `design-spec.md` + `engineering-handoff.md` — no new design work
- Init: Hand-detection gate (one-shot pre-record) moved into MVP, supersedes deferred entry
- Init: Server-side IMU liveness fraud check **promoted from v2 to MVP** backend scope (Phase 5) — capture spec already collects the data; on-device hand-gate alone is trivially defeated by TV-replay
- Roadmap: Horizontal-layer phase structure (7 phases) compressed from research's 12-phase suggestion per granularity=standard
- [Phase 1]: Plan 01-01: ESLint 9.16.0 forced flat-config migration; created eslint.config.mjs at root, deleted .eslintrc.json, added @eslint/js + typescript-eslint umbrella
- [Phase 1]: Plan 01-01: @aws-sdk/cloudfront-signer pinned at 3.1036.0 (not 3.1044.0); cloudfront-signer is on a slower release cadence than other AWS SDK v3 modules
- [Phase 1]: Plan 01-01: bootstrap pnpm via corepack (corepack prepare pnpm@9.15.0 --activate); matches package.json packageManager pin and is reproducible across machines
- [Phase 1]: Plan 01-03: pgvector image ships 0.8.2 (vs locked 0.8.0 floor); same major.minor, bugfix-only, HNSW API identical — accept the image default rather than pinning a specific image SHA
- [Phase 1]: Plan 01-03: localstack image pinned at major.minor `localstack/localstack:4.0` (runtime resolves to 4.0.3) so patch fixes flow without docker-compose churn
- [Phase 1]: Plan 01-03: LocalStack readiness gating lives in scripts/dev-up.sh (not docker-compose `depends_on`), keeping compose declarative and concentrating dev ergonomics in one shell script
- [Phase 1]: Plan 01-03: lifecycle JSON in infra/localstack/init/01-create-buckets.sh is the single source of truth — plan 01-10 Terraform will use byte-identical JSON for prod parity (LEGAL-05)
- [Phase 1]: Plan 01-02: Renamed drizzle-kit auto-generated migration filename `0000_overconfident_major_mapleleaf.sql` → `0001_init.sql` (and `meta/_journal.json` tag accordingly); auto-name's random third-word component is non-deterministic across machines, deterministic naming makes the migration committable
- [Phase 1]: Plan 01-02: 0001_init.sql is a hybrid file — drizzle-kit auto-generated DDL bookended by hand-written CREATE EXTENSION (top) and DROP/ADD generated tsvector + HNSW + GIN (bottom). Future migrations needing pg-only features follow the same pattern (Pattern 9)
- [Phase 1]: Plan 01-02: schema declares `nameSearch` as a regular tsvector column in Drizzle (Drizzle 0.45 has no GENERATED ALWAYS DSL); migration replaces it with the generated variant. INSERT/UPDATE statements against tasks must NOT include name_search in the column list (Postgres rejects writes to GENERATED ALWAYS columns) — plan 01-06 task seeding inherits this rule
- [Phase 1]: Plan 01-04: fastify-type-provider-zod 4.x is incompatible with zod@4 (locked in plan 01-01) — bumped to 6.1.0 (first version with peer zod >= 4.1.5); the API surface used (validatorCompiler, serializerCompiler, ZodTypeProvider) is unchanged
- [Phase 1]: Plan 01-04: Idempotency global preHandler MUST decode the JWT itself via best-effort `req.jwtVerify()` — Fastify runs `app.addHook('preHandler', ...)` BEFORE route-level requireAuth, so the original `req.user.sub` lookup always observed undefined and persistence never fired. Failed token decodes fall through to route-level requireAuth for the standard 401.
- [Phase 1]: Plan 01-04: @fastify/rate-limit's errorResponseBuilder THROWS its return value through setErrorHandler; returning a plain object falls through the catch-all 500 branch. Builder now returns Error subclass with `.problemDetail` field; error-handler short-circuits on that (Pattern 14) — preserves wire-side extensions like `tier: 'anonymous'` and `retryAfterSeconds`.
- [Phase 1]: Plan 01-04: req.user typing across the codebase comes from augmenting `@fastify/jwt`'s FastifyJWT interface (`payload: JwtPayload; user: JwtPayload`), not the Fastify-side FastifyRequest interface (which collides with @fastify/jwt's own augmentation) — Pattern 15.
- [Phase 1]: Plan 01-05: Idempotent migration runner with schema_migrations bookkeeping table — plan 02's runner hard-coded 0001_init.sql; backfilled the bookkeeping table by hand once at this transition (Pattern 23)
- [Phase 1]: Plan 01-05: JwtPayload.iat/exp relaxed to optional in apps/api/src/plugins/auth.ts — exactOptionalPropertyTypes broke app.jwt.sign at the sign site; jsonwebtoken auto-fills both at sign-time and asserts at verify-time so runtime guarantee preserved
- [Phase 1]: Plan 01-05: Response schema intentionally omitted from /auth/google ZodTypeProvider config — declaring response: { 200: ... } narrows reply.code() to 200, breaking non-200 problem-detail returns. Body schema still validated; happy-path response shape enforced manually in the return statement (Pattern 22)
- [Phase 1]: Plan 01-05: Status code split 401 vs 403 for integrity rejects — nonce + stale = 401 (auth gate); device-integrity + flavor + package + allowlist mismatches = 403 (policy gate). RFC 7235-correct semantics; refines plan body's universal-403 (Pattern 21)
- [Phase 1]: Plan 01-05: PENDING_LEGAL_TEXT_HASH placeholder in /auth/google — plan 11 owns the consent text + sha256; consent_log rows still written (D-LEGAL-03 audit trail). Plan 11 swaps the constant + can backfill historical rows if counsel requires
- [Phase 1]: Plan 01-05: Three-gate install-source bypass — (1) STATIC_BYPASS_ALLOWED hard-codes playStore=false; (2) flavor-allowlist cross-check; (3) Remote Config key keyed by applicationId. ALL three must pass; playStore APK structurally cannot read the apkRollout RC key (Pattern 17)
- [Phase 1]: Plan 01-05: W6 Phase-1 iOS gate via gatePhase1Flavor() throwing UnsupportedFlavorError — /auth/google emits 501 + integrity-flavor-not-supported. Phase 7 swaps the gate body for App Attest verification; the route handler is unchanged (Pattern 18)
- [Phase 1]: Plan 01-06: Markdown-table parser for task-taxonomy.md (Pattern 27) — taxonomy is a single | Category | Task | Setting | Description | Instructions | table; slugs come from mapping.json (joined by name with normalizeName collapsing parenthetical suffixes). Plan body's per-section parser was wrong format.
- [Phase 1]: Plan 01-06: Embedder pooling=mean and normalize=true bound inside embed() (Pattern 25) — same configuration at seed and query time; drift collapses HNSW recall (T-1.6-06). Bypassing embed() is forbidden.
- [Phase 1]: Plan 01-06: Async keyGenerator for authenticated-tier rate-limit (Pattern 26) — @fastify/rate-limit fires before route preHandlers, so keyGenerator must do its own best-effort jwtVerify() and fall back to per-IP. Same shape as plan 04 idempotency hook-ordering fix.
- [Phase 1]: Plan 01-06: Vitest pool: 'forks' + singleFork: true (Pattern 24) — multiple test files race on shared Postgres state via blanket db.delete in beforeEach; serialized execution is the bridge until plan 12 BEGIN/ROLLBACK isolation lands.
- [Phase 1]: Plan 01-06: /tasks/search must register BEFORE /tasks/:id (Pattern 28) — Fastify radix-tree precedence; literal beats wildcard when sequential.
- [Phase ?]: [Phase 1]: Plan 01-08: Per-applicationId rate-limit bucket on DELETE /me — 5/min keyed by 'delete-me:${applicationId}' caps account-deletion DoS even with rotating JWTs from the same build flavor (Pattern 29).
- [Phase ?]: [Phase 1]: Plan 01-08: Migration 0004 trigger AUTO-DELETES empty contribution buckets when v_count=0 — keeps the contributions table sparse and matches /contributions/timeseries oldest-first iteration semantics (Pattern 30).
- [Phase ?]: [Phase 1]: Plan 01-08: AppVersionResponseSchema = z.discriminatedUnion('flavor') — three concrete shapes (apkRollout, playStore, iosAppStore) per D-APK-02; clients narrow on flavor for type-safe upgrade-URL access (Pattern 33).
- [Phase ?]: [Phase 1]: Plan 01-08: /feedback registers @fastify/multipart INSIDE the route plugin (not globally) — global idempotency hook keeps its standard JSON-body hash path; multipart hash falls back to (method, path, undefined-body) which is acceptable since UUIDv4 reuse with different multipart body is a client error (Pattern 31).
- [Phase ?]: [Phase 1]: Plan 01-08: Test-side idempotency_keys cleanup — deterministic UUIDs in vitest files would replay stale responses across runs; beforeAll/beforeEach deletes idempotency_keys for the test user (Pattern 32). Plan 12 BEGIN/ROLLBACK isolation will retire this.
- [Phase ?]: [Phase 1]: Plan 01-08: NODE_ENV=test gate on startDsrCron — singleFork test pool would accumulate setInterval handles + log noise across test files; production server.ts boot path always runs it (Pattern 34).
- [Phase ?]: [Phase 1]: Plan 01-08: GET /app/version intentionally NO requireAuth — pre-sign-in clients need force_upgrade BEFORE they can sign in; Cache-Control public, max-age=21600 (6h) lets CDN edges serve copies, eating most of the load.
- [Phase ?]: [Phase 1]: Plan 01-08: feedback diagnostic stored BOTH in S3 (full 5 MB) AND inline on row (first 100 KB after JSON.parse + truncate) — support reads inline without an S3 hop, investigators read full file from S3; inline always wraps with {\_s3_key} so each row is self-describing.
- [Phase ?]: [Phase 1]: Plan 01-08: EVENT_NAMES is a hard-coded const (14 names) — adding a new telemetry event requires shipping shared/types release; type-level schema-creep guard against one-off telemetry calls (T-1.8-05).
- [Phase ?]: [Phase 1]: Plan 01-09: Locked Android applicationIds per D-FLAV-01 — apkRollout=ai.humynlabs.capture.apk, playStore=ai.humynlabs.capture. Resolves the STATE.md blocker entry. Sources cited inline in 01-09-SUMMARY.md (PLAN.md frontmatter + CONTEXT.md D-FLAV-01 + apps/api/test/routes/auth-google-iosAppStore.test.ts fixture + plan 05's flavor-allowlist.ts).
- [Phase ?]: [Phase 1]: Plan 01-09: Per-flavor manifest source-set gating for REQUEST_INSTALL_PACKAGES — base android/app/src/main/AndroidManifest.xml never declares the install-source permission; flavor-only android/app/src/apkRollout/AndroidManifest.xml adds it. CI gate apps/mobile/scripts/verify-merged-manifests.sh asserts the merge outcome at every PR (T-1.9-01 mitigation, Pattern 35).
- [Phase ?]: [Phase 1]: Plan 01-09: Custom Kotlin AppFlavor TurboModule overrides RESEARCH §4.7 react-native-config recommendation per prompt directive. BuildConfig.FLAVOR_NAME + BuildConfig.APPLICATION_ID surfaced via getConstants() so JS reads NativeModules.AppFlavor.flavor sync without another bundler dep (Pattern 37).
- [Phase ?]: [Phase 1]: Plan 01-09: react-native types deferred to plan 01-13 via minimal NativeModules ambient shim at apps/mobile/src/types/react-native.d.ts. Real react-native@0.83.x install lands in plan 13 (deletes the shim); plan 09 keeps the dep tree small for a scaffold whose only TS surface is one NativeModules access.
- [Phase ?]: [Phase 1]: Plan 01-09: Refined root .gitignore from blanket 'apps/mobile/android/keystores/' to 'apps/mobile/android/keystores/\*' + '!apps/mobile/android/keystores/.gitignore' so the directory marker is tracked while every keystore file remains ignored. Defense-in-depth alongside the in-dir .gitignore (Pattern 36).
- [Phase 1]: Plan 01-13: RN testing under vitest+JSDOM via host-component shim (Pattern 39) — vitest.setup.ts mocks `react-native` so View/Text/Pressable map to plain DOM elements forwarding accessibilityLabel→aria-label and onPress→onClick. Auth service is fully mocked via vi.mock so MMKV/GoogleSignin/Keychain transitively never load. Phase 2+ tests can swap to jest + @testing-library/react-native if needed.
- [Phase 1]: Plan 01-13: PlayIntegrity Kotlin module package separation (Pattern 40) — module lives under `io.humyn.app` while App resides under `ai.humynlabs.capture`. Two-package layout isolates third-party-SDK adapters from the app bundle namespace.
- [Phase 1]: Plan 01-13: Belt-and-suspenders JWT post-flight validation (Pattern 41) — auth.ts decodes the JWT and asserts payload.flavor + applicationId match the build-time AppFlavor identity. Server-side allowlist (plan 05) is the authoritative gate; client-side check catches a misconfigured backend.
- [Phase 1]: Plan 01-13: tsconfig override module=ESNext + moduleResolution=Bundler for apps/mobile (Pattern 42) — RN ecosystem (mmkv 4.x Nitro, google-signin v16) doesn't ship NodeNext-conformant exports maps; Bundler mirrors Metro runtime resolution.
- [Phase 1]: Plan 01-13: react-native@0.83.0 + react@19.2.0 installed (deletes the apps/mobile/src/types/react-native.d.ts ambient shim from plan 09) — fulfills plan 09 SUMMARY's "Next Phase Readiness" promise.
- [Phase ?]: [Phase 1]: Plan 01-12: Two-config vitest split (Pattern 43) — vitest.config.ts excludes test/e2e/** so unit suite runs in 17s; vitest.e2e.config.ts targets test/e2e/** with 120s timeouts for embedder cold-start + multipart upload.
- [Phase ?]: [Phase 1]: Plan 01-12: globalSetup env loader (Pattern 44) — test/e2e/global-setup.ts loads apps/api/.env in the parent vitest process before any worker fork; workers inherit env via Node's standard fork() contract. CI workflows export env via the workflow env: block, making the loader a no-op there.
- [Phase ?]: [Phase 1]: Plan 01-12: awslocal CLI shim for GitHub Actions (Pattern 46) — 1-line wrapper that maps 'awslocal' to 'aws --endpoint-url=http://localhost:4566' lets the same infra/localstack/init/\*.sh scripts that auto-run in dev docker-compose also bootstrap CI without forking the script.

### Pending Todos

None yet.

### Blockers/Concerns

Decisions to resolve during phase planning (per research SUMMARY.md):

- ~~Phase 1: APK build flavor `applicationId` choice (`ai.humynlabs.capture.apk` vs `ai.humynlabs.capture`) — locked before flavor structure built~~ — **RESOLVED in plan 01-09:** apkRollout=`ai.humynlabs.capture.apk`, playStore=`ai.humynlabs.capture` per D-FLAV-01.
- Phase 1: Embedding provider for `/tasks` semantic search (OpenAI `text-embedding-3-small` vs local sentence-transformers)
- Phase 1: DPDP / LGPD counsel engagement is an operational track that gates Play Store launch (Phase 7)
- Phase 2: Final Help Center support email (`[EMAIL_ADDRESS]` placeholder); compat-fail "what now" recovery copy needs final wording
- Phase 5: Hash-verify worker placement migration trigger (BullMQ + ECS at MVP → Lambda at 1M-hour scale)
- Phase 6: Published payouts-window date (replaces "Payments coming soon" copy)
- Project-wide: Real-device test-matrix procurement (Pixel 7a / 8a / Helio-class / Snapdragon-7 / Exynos 1280-1380) — current testing-guide six-device matrix is heavy on flagships

## Deferred Items

| Category                   | Item | Status | Deferred At |
| -------------------------- | ---- | ------ | ----------- |
| _(none — first milestone)_ |      |        |             |

## Session Continuity

Last session: 2026-05-08T10:49:04.583Z
Stopped at: Phase 2 context gathered

- 01-10 (terraform apply): Tasks 1+2+3 complete + committed (430e17a, 9e52db8, ad93d17). Operator runs `terraform fmt -check` + `terraform validate` + `terraform plan` + `terraform apply` against real AWS staging.
- 01-11 (counsel engagement): code-ready-counsel-deferred. Three commits ship the canonical consent text + boot-time hash guard, takedown SOP runbook, dsr-export CLI, and counsel-engagement checklist. Real attorney review queued for legal-ops backlog.
- 01-13 (mobile sign-in scaffold): code-ready-smoke-deferred. Five commits (d56abda, 25bca88, 9ed7da1, e42312d, 561314e) ship the RN scaffold + PlayIntegrity module + auth orchestration + SignIn screen + vitest tests + manual-smoke runbook. Operator runs the on-device smoke from `13-MANUAL-SMOKE.md` on a real Pixel 7a-class device with both flavors built and installed.
  Plan-counter intentionally NOT advanced (still 9/13) — orchestrator will advance after each respective "approved" gate.
  Resume files:

- .planning/phases/01-foundation-backend-distribution-recon/01-10-SUMMARY.md (terraform apply gate)
- .planning/phases/01-foundation-backend-distribution-recon/01-11-SUMMARY.md (counsel gate)
- .planning/phases/01-foundation-backend-distribution-recon/01-13-SUMMARY.md + 13-MANUAL-SMOKE.md (on-device smoke gate)
