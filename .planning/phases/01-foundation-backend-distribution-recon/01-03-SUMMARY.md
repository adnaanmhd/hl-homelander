---
phase: 01-foundation-backend-distribution-recon
plan: 03
subsystem: infra
tags: [docker, docker-compose, postgres, pgvector, localstack, s3, secretsmanager, lifecycle, pgadmin]

# Dependency graph
requires:
  - phase: 01
    plan: 01
    provides: monorepo workspace skeleton with apps/api/.env.example destination + scripts/ ready to receive dev-up tooling
provides:
  - One-command dev environment bring-up via scripts/dev-up.sh (Postgres 17 + pgvector + LocalStack 4.x + pgAdmin)
  - LocalStack S3 with humyn-recordings-dev (versioned, day-zero lifecycle GLACIER_IR @ +7d → DEEP_ARCHIVE @ +90d, AbortIncompleteMultipartUpload @ +1d, permissive dev CORS) and humyn-apk-dev (public-access blocked) buckets
  - LocalStack Secrets Manager with humyn/jwt/signing-secret, humyn/gcp/play-integrity-sa-key, humyn/cloudfront/signing-key, humyn/cloudfront/key-pair-id seeded
  - Documented env contract at .env.example (root) and apps/api/.env.example (mirror) for DATABASE_URL, AWS_*, JWT_SIGNING_SECRET, GOOGLE_WEB_CLIENT_ID, RECORDINGS_BUCKET, APK_BUCKET, CLOUDFRONT_*
  - README.md with the dev-up flow, workspace layout, pinned tooling versions, and GSD entry points
affects: [01-02 (uses Postgres+pgvector for [BLOCKING] schema-push), 01-04..01-08 (use LocalStack S3 for presigned URLs and Secrets Manager for JWT signing key), 01-12 (integration tests against the same LocalStack/Postgres substrate)]

# Tech tracking
tech-stack:
  added:
    - pgvector/pgvector:pg17 (Postgres 17 + pgvector ~0.8.x; image actually ships 0.8.2 — same major.minor as the locked 0.8.0 floor)
    - localstack/localstack:4.0 (Community edition; S3 + Secrets Manager only; verified at 4.0.3 at runtime)
    - dpage/pgadmin4:8.13 (server-mode disabled, master-password not required for dev convenience)
  patterns:
    - "Single-replica dev parity (D-HOST-04): one Postgres container, one LocalStack container — mirrors prod's single-AZ Phase 1 architecture so dev observability matches prod failure modes"
    - "Day-zero lifecycle as code (LEGAL-05): the lifecycle JSON in 01-create-buckets.sh is byte-identical to RESEARCH §3.6 / Plan 10 Terraform; LocalStack accepts the same schema, giving us one source of truth for the policy shape"
    - "LocalStack init via /etc/localstack/init/ready.d/: bucket creation, lifecycle, CORS, public-access block, versioning, and Secrets Manager seeding all run automatically after the SERVICES come ready — no manual setup, idempotent across docker-compose restarts"
    - "Idempotent dev secrets seeding (create-secret || put-secret-value): re-running the init scripts (e.g., after `docker compose down && up`) doesn't fail on the existing-secret path"
    - "Dev-only CloudFront keypair regenerated on each dev-up: openssl genrsa 2048 inside the LocalStack container produces a fresh RSA private key + a synthetic key-pair-id; exercises the @aws-sdk/cloudfront-signer code path in plan 07 without committing a real PEM"
    - "Env contract documented twice (root + apps/api): root .env.example is the source of truth; apps/api/.env.example mirrors it so package-local `pnpm dev` works without `cd ..`"

key-files:
  created:
    - docker-compose.yml (services: postgres, localstack, pgadmin; named volumes: humyn-postgres-data, humyn-localstack-data; healthchecks on Postgres + LocalStack)
    - .env.example (root env contract: DATABASE_URL, AWS_*, JWT_SIGNING_SECRET, GOOGLE_WEB_CLIENT_ID, PLAY_INTEGRITY_SA_KEY_JSON, RECORDINGS_BUCKET, APK_BUCKET, CLOUDFRONT_*, LOG_LEVEL, NODE_ENV)
    - apps/api/.env.example (package-local mirror of the env contract)
    - infra/localstack/init/01-create-buckets.sh (creates 2 buckets; versioning + public-access-block + lifecycle + CORS on humyn-recordings-dev; mode 0755)
    - infra/localstack/init/02-seed-secrets.sh (seeds 2 base secrets + 2 CloudFront secrets via openssl genrsa; mode 0755)
    - scripts/dev-up.sh (idempotent stack bring-up; waits for Postgres health, LocalStack health, bucket presence; mode 0755)
    - README.md (project landing page; ## Dev Environment, ## Workspace Layout, ## Tooling Versions, ## GSD Workflow)
  modified: []

key-decisions:
  - "pgvector image ships 0.8.2 not 0.8.0: the pinned floor is 0.8.0; pgvector/pgvector:pg17 currently builds 0.8.2 inside the same minor series. Accepting the 0.8.2 default rather than pinning a specific image SHA — version bumps inside 0.8.x are bugfix-only and the API surface used by plan 01-02's HNSW indexes is identical."
  - "LocalStack 4.0 image tag (not 4.0.3): docker-compose pins the major.minor `localstack/localstack:4.0`; runtime resolves to 4.0.3 from the registry. Matches RESEARCH §Infrastructure (LocalStack Community 4.x) and lets us pick up patch-level fixes without docker-compose churn."
  - "Skipped depends_on health-gating for LocalStack: pgAdmin depends on Postgres health, but no service depends on LocalStack health. The dev-up.sh script does the LocalStack health-wait at the host level instead — cleaner separation between docker-compose (declarative topology) and dev-up.sh (developer ergonomics)."
  - "Verified pgvector via CREATE EXTENSION as part of dev-up smoke check: this leaves the `vector` extension created in the dev DB. Plan 01-02's schema migration runs `CREATE EXTENSION IF NOT EXISTS vector` so this is a no-op for it; no cleanup required and no impact on plan 01-02's `[BLOCKING]` schema-push."

patterns-established:
  - "Pattern 6 (Dev infra): docker-compose at repo root + LocalStack init scripts under infra/localstack/init/ + scripts/dev-up.sh as the single ergonomic entry point. Future infra (Redis, etc.) extends this same triad."
  - "Pattern 7 (Env contract documented twice): root .env.example is the canonical contract; per-package mirrors (apps/api/.env.example) restate it. New env vars MUST be added to both files in the same commit."
  - "Pattern 8 (LocalStack lifecycle = real-prod lifecycle): the JSON in 01-create-buckets.sh is the same JSON that lands in plan 10's Terraform aws_s3_bucket_lifecycle_configuration. No drift between dev policy semantics and prod policy semantics."

requirements-completed: [LEGAL-05]

# Metrics
duration: 5min
completed: 2026-05-07
---

# Phase 01 Plan 03: LocalStack + Dev Infra Summary

**One-command Postgres 17 + pgvector + LocalStack 4.x + pgAdmin bring-up via `scripts/dev-up.sh`, with the LEGAL-05 day-zero lifecycle (GLACIER_IR @ +7d, Deep Archive @ +90d) baked into LocalStack init so plan 01-02's `[BLOCKING]` schema-push and plans 01-04..01-08's S3 work all light up against a realistic dev substrate.**

## Performance

- **Duration:** ~5 min (mostly Docker image pulls — pgvector/pg17 + localstack/localstack:4.0 + pgadmin4:8.13)
- **Started:** 2026-05-07T12:43:24Z
- **Completed:** 2026-05-07T12:48:40Z
- **Tasks:** 3 / 3
- **Files created:** 7

## Accomplishments

- **`docker-compose.yml`** wires three dev services with health-gating, named volumes for state persistence, and a host-mounted init directory at `/etc/localstack/init/ready.d/` for LocalStack:
  - Postgres 17 + pgvector (`pgvector/pgvector:pg17`) — `humyn / humyn / humyn_dev` on `:5432`, `pg_isready` healthcheck.
  - LocalStack Community 4.x (`localstack/localstack:4.0`, runtime 4.0.3) — `s3,secretsmanager` services only, region `ap-south-1`, healthcheck against `/_localstack/health`.
  - pgAdmin (`dpage/pgadmin4:8.13`) — server-mode off, master-password disabled for one-click dev access; `depends_on: postgres: service_healthy`.
- **LocalStack init runs automatically** after `SERVICES` come ready:
  - `01-create-buckets.sh` creates `humyn-recordings-dev` (versioned, public-access blocked, day-zero lifecycle: GLACIER_IR @ +7d → DEEP_ARCHIVE @ +90d → AbortIncompleteMultipartUpload @ +1d, permissive dev CORS for presigned PUT/GET) and `humyn-apk-dev` (public-access blocked).
  - `02-seed-secrets.sh` seeds `humyn/jwt/signing-secret`, `humyn/gcp/play-integrity-sa-key`, `humyn/cloudfront/signing-key`, and `humyn/cloudfront/key-pair-id`. The CloudFront keypair is generated fresh on every dev-up via `openssl genrsa 2048` inside the LocalStack container.
- **`scripts/dev-up.sh`** is the single ergonomic entry point — idempotent, waits for Postgres health, LocalStack health, and bucket presence with bounded retry loops (60 s, 60 s, 30 s respectively). Prints a clear "next steps" block on completion.
- **Env contract documented at `.env.example` (root) and `apps/api/.env.example` (mirror)** — every variable the api package and dev scripts read is enumerated with a comment explaining the prod equivalent. The dev `JWT_SIGNING_SECRET` placeholder is the same literal seeded into Secrets Manager so dev-time decoding via the secret still verifies.
- **`README.md`** is the project landing page — covers the dev workflow (`./scripts/dev-up.sh` → `cp .env.example .env` → `pnpm db:migrate` → `pnpm dev`), workspace layout, pinned tooling versions, and the GSD entry points users hit before edits.

## Live Verification (executed end-to-end on this machine)

Plan 01-02 needs the substrate this plan provides. Verified all four readiness axes after running `./scripts/dev-up.sh`:

1. **Buckets exist:** `docker compose exec localstack awslocal s3 ls` →
   ```
   humyn-recordings-dev
   humyn-apk-dev
   ```
2. **Lifecycle is correct:** `awslocal s3api get-bucket-lifecycle-configuration --bucket humyn-recordings-dev` returns the two transitions (Days=7→GLACIER_IR, Days=90→DEEP_ARCHIVE) plus AbortIncompleteMultipartUpload @ Days=1.
3. **Secrets are seeded:** `awslocal secretsmanager list-secrets --query 'SecretList[].Name'` →
   ```
   humyn/jwt/signing-secret
   humyn/gcp/play-integrity-sa-key
   humyn/cloudfront/signing-key
   humyn/cloudfront/key-pair-id
   ```
4. **Postgres + pgvector reachable from the host (the path plan 01-02 will use):**

   - `pg` Node client connecting to `postgres://humyn:humyn@localhost:5432/humyn_dev` returns `{ host_reach: 1 }`.
   - `pg_available_extensions WHERE name='vector'` returns `vector | 0.8.2`.
   - `CREATE EXTENSION IF NOT EXISTS vector;` succeeds; `pg_extension` shows `vector | 0.8.2`.

5. **LocalStack reachable from the host:** `curl http://localhost:4566/_localstack/health` returns LocalStack 4.0.3 Community with `s3: running` and `secretsmanager: running`.

The stack is currently up. Plan 01-02 can run its `[BLOCKING]` schema-push against `localhost:5432` immediately.

## Task Commits

Each task was committed atomically on `main` (pre-commit hook ran `lint-staged` then `pnpm typecheck` for every commit; all clean):

1. **Task 1: docker-compose.yml + .env.example + apps/api/.env.example** — `88ddf57` (chore)
2. **Task 2: LocalStack init scripts (buckets + secrets)** — `670e4a0` (chore)
3. **Task 3: scripts/dev-up.sh + README dev workflow** — `76805ee` (chore; pre-commit prettier formatted README mid-commit and the commit landed cleanly)

**Plan metadata commit:** appended below post-summary.

## Files Created / Modified

- `docker-compose.yml` — three services + two named volumes + healthchecks; LocalStack init mount at `/etc/localstack/init/ready.d`.
- `.env.example` — root env contract (DATABASE*URL, AWS*_, JWT*SIGNING_SECRET, GOOGLE_WEB_CLIENT_ID, PLAY_INTEGRITY_SA_KEY_JSON, RECORDINGS_BUCKET, APK_BUCKET, CLOUDFRONT*_, LOG_LEVEL, NODE_ENV).
- `apps/api/.env.example` — package-local mirror of the same env contract; comment block points back to `/.env.example`.
- `infra/localstack/init/01-create-buckets.sh` — bucket creation, versioning on recordings, public-access block on both, day-zero lifecycle on recordings, dev CORS on recordings; mode 0755.
- `infra/localstack/init/02-seed-secrets.sh` — seeds JWT signing secret, Play Integrity GCP key stub, and a fresh dev CloudFront RSA keypair on every dev-up; mode 0755.
- `scripts/dev-up.sh` — idempotent bring-up; waits Postgres → LocalStack → bucket presence; mode 0755.
- `README.md` — landing page with dev workflow, workspace layout, pinned tooling, and GSD entry points.

## Decisions Made

- **Adopt the `pgvector/pgvector:pg17` image as-is** rather than pinning a specific image SHA. The image ships pgvector 0.8.2 (the locked floor in PROJECT/RESEARCH was 0.8.0). 0.8.x is bugfix-series; the HNSW + index syntax used in plan 01-02 is identical between 0.8.0 and 0.8.2. Reproducibility comes from the major.minor tag plus the image's own digest at the time of pull.
- **Use the `localstack/localstack:4.0` major.minor tag** rather than `:4.0.3`. Patch-level pickups land for free without docker-compose churn; runtime introspection at startup confirms what we got.
- **Do not gate other services on LocalStack health in compose** — instead, the host-side `dev-up.sh` does the LocalStack readiness wait and the bucket-presence wait. Keeps `docker-compose.yml` declarative-only and concentrates "developer feedback loop" in `dev-up.sh`.
- **Run pgvector smoke check (`CREATE EXTENSION vector`) as part of plan-level verification.** The extension is now present in the dev DB; plan 01-02's `CREATE EXTENSION IF NOT EXISTS vector` is a no-op for it, so no cleanup or coordination needed.
- **Do NOT add `localhost:` binding restrictions to docker-compose ports.** RESEARCH §threat-model T-1.3-05 is the canonical mitigation: documented as a dev-only concern, no real secrets in LocalStack, README is the place to call it out for shared-network situations. Avoids per-environment compose-file forks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docker daemon not running at start of Task 3 verification**

- **Found during:** Plan-level verification of `./scripts/dev-up.sh` (after Task 3 was written, before commit).
- **Issue:** Docker Desktop's daemon was not running on the dev machine; `docker compose up -d` failed with `dial unix /Users/adnaan/.docker/run/docker.sock: connect: no such file or directory`.
- **Fix:** Launched Docker Desktop via `open -a "Docker"`, polled `docker info` until ready, then re-ran `./scripts/dev-up.sh`.
- **Files modified:** None — this was an environmental gate, not a code defect. The plan's scripts and compose file are correct.
- **Verification:** Stack came up cleanly; all four plan-level verification axes pass (see Live Verification above).
- **Commit:** Plan-level verification only; no code commit attached.

### Out-of-scope items deferred

None. All work was within plan scope.

### Out-of-scope discovery (deferred-items)

- **`CLAUDE.md` is dirty in `git status`** with a one-line modification carried over from before this plan started. This file is not in plan 01-03's scope (Plan 01-01 last touched it). Did not stage or commit; the next plan that explicitly touches CLAUDE.md will pick it up. No `deferred-items.md` entry needed — this is a known drift, not a discovery.

## Authentication Gates

None — fully automated, no manual auth needed for dev infra.

## Stub Tracking

- **CloudFront `humyn/cloudfront/signing-key` and `humyn/cloudfront/key-pair-id`** are dev stubs (RSA keypair regenerated per dev-up; key-pair-id is a synthetic `K-DEV-LOCALSTACK-{epoch}`). LocalStack does not implement CloudFront URL verification, so signed URLs minted in dev won't actually verify against LocalStack S3 — but the `@aws-sdk/cloudfront-signer` code path is exercised. **This is intentional, not a bug.** Plan 10 (Terraform) provisions real CloudFront keys out-of-band into prod Secrets Manager; the secret comment block (`02-seed-secrets.sh`) points at this.
- **`humyn/gcp/play-integrity-sa-key`** is a synthetic dev stub JSON (`{"type":"service_account","project_id":"dev-stub",...}`). Auth code in plan 01-08 will skip Play Integrity decoding when `GOOGLE_WEB_CLIENT_ID` is empty (the dev default), so the stub is never deserialized as a real GCP key in dev. Real prod value is operator-provisioned (per RESEARCH §3.4).
- **`JWT_SIGNING_SECRET=dev-only-do-not-use-in-prod-...`** is a fixed literal in both `.env.example` and the seeded Secrets Manager entry — same value on both sides so the api can verify either way in dev. Prod swaps in a real 32-byte secret via Secrets Manager (per RESEARCH §3.5).

All three are explicitly documented as dev-only stubs in their secret descriptions.

## Threat Flags

No new threat surfaces beyond those already enumerated in `<threat_model>` (T-1.3-01..06). Specifically:

- No new network endpoints introduced (LocalStack is dev-only, never exposed to prod surface).
- No new auth paths (Secrets Manager entries are seeded, not authenticated against).
- No new file access patterns (init scripts run inside the LocalStack container, not on the host filesystem).
- No new schema changes (Postgres comes up empty; plan 01-02 owns the schema).

## Issues Encountered

- **Docker Desktop not running.** Surfaced as a `connect: no such file or directory` socket error from `docker compose up`. Resolution was environmental (start Docker Desktop), not code. The error message is clear and recoverable; no code change needed.
- **Pre-commit hook reformatted `README.md` mid-commit.** Prettier ran on the staged file and the resulting commit included the reformatted version. This is the husky+lint-staged contract working correctly (Pattern 5 from plan 01-01). Documented for future plans that touch markdown.
- **No host-side `psql` available.** Verification of host-to-Postgres reachability used the `pg` Node client (already pinned in `apps/api/package.json` from plan 01-01) instead of `psql`. Stronger evidence anyway since this is the actual library plan 01-02's `db:push` will use.

## User Setup Required

**One-time per dev machine:** Docker Desktop must be running before `./scripts/dev-up.sh` is invoked. Future plan 01-09 (CI) will document the equivalent for GitHub Actions runners.

No external service signup, no API keys, no manual configuration. The stack is fully self-contained.

## Next Phase Readiness

- **Ready for plan 01-02 (`[BLOCKING]` schema push):** Postgres 17 + pgvector reachable on `localhost:5432` with the `vector` extension already created. `apps/api/package.json` from plan 01-01 has `drizzle-orm 0.45.2` + `drizzle-kit 0.28.1` + `pg 8.20.0` pinned; plan 01-02's `db:push` step will succeed against this substrate.
- **Ready for plans 01-04..01-08 (Fastify scaffold + auth + recordings + tasks + uploads):** LocalStack S3 + Secrets Manager reachable on `localhost:4566` with both buckets, the lifecycle policy, and all four secrets in place. The api can mint presigned URLs against `humyn-recordings-dev`, fetch the JWT signing key from Secrets Manager, and exercise the CloudFront signer code path against the dev keypair.
- **Ready for plan 01-12 (integration tests):** Same LocalStack substrate is the test fixture. `BEGIN; ROLLBACK;` per-test isolation works against the dev DB without touching the lifecycle config (T-1.3-03 mitigation).
- **No blockers** for any subsequent Phase 1 plan.

## Self-Check: PASSED

All claims verified before proceeding to state updates.

**Created files exist:**

- `docker-compose.yml` — FOUND
- `.env.example` — FOUND
- `apps/api/.env.example` — FOUND
- `infra/localstack/init/01-create-buckets.sh` — FOUND (mode 0755 verified)
- `infra/localstack/init/02-seed-secrets.sh` — FOUND (mode 0755 verified)
- `scripts/dev-up.sh` — FOUND (mode 0755 verified)
- `README.md` — FOUND

**Commits exist (verified via `git log --oneline`):**

- `88ddf57` — FOUND (Task 1)
- `670e4a0` — FOUND (Task 2)
- `76805ee` — FOUND (Task 3)

**Live infra verification (verified end-to-end against the running stack):**

- Postgres reachable from host on `localhost:5432`: PASS
- pgvector 0.8.2 installed and `CREATE EXTENSION` succeeds: PASS
- LocalStack reachable from host on `localhost:4566` (s3: running, secretsmanager: running): PASS
- Both buckets present (`humyn-recordings-dev`, `humyn-apk-dev`): PASS
- Lifecycle on recordings bucket has both transitions (GLACIER_IR @ +7d, DEEP_ARCHIVE @ +90d) and AbortIncompleteMultipartUpload @ +1d: PASS
- All four Secrets Manager entries seeded: PASS

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
