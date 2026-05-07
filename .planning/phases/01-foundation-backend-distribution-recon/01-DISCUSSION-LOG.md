# Phase 1: Foundation, Backend & Distribution Recon - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered and the user-driven correction mid-discussion.

**Date:** 2026-05-07
**Phase:** 1-Foundation, Backend & Distribution Recon
**Areas discussed:** App IDs & flavors, compatRecon APK (RESCINDED mid-discussion), Embeddings, Legal & data-rights, Backend hosting, APK distribution, JWT/session

---

## App IDs & flavors

### Q1 — Android applicationId for the playStore + apkRollout pair

| Option | Description | Selected |
|--------|-------------|----------|
| `capture / capture.apk` | playStore = `ai.humynlabs.capture` (canonical, permanent); apkRollout = `ai.humynlabs.capture.apk` (explicit `.apk` suffix). Matches research ARCHITECTURE.md §8. Standard Android pattern. | ✓ |
| `capture / capture.early` | playStore = `ai.humynlabs.capture`; apkRollout = `ai.humynlabs.capture.early`. Semantic suffix; reads better in process lists / analytics dashboards. | |
| `labs.capture / labs.capture.apk` | Drop `ai.humynlabs.` prefix — shorter ID. Risk: short IDs more likely to collide / squat. | |

**User's choice:** capture / capture.apk
**Notes:** Permanent identifier locked. iOS bundle ID inherits the canonical `ai.humynlabs.capture` (mirroring playStore).

### Q2 — How does compatRecon coexist with apkRollout when chiefs upgrade?

| Option | Description | Selected |
|--------|-------------|----------|
| Same ID as apkRollout | compatRecon shares applicationId `ai.humynlabs.capture.apk`; apkRollout overwrites recon as a normal upgrade. Same signing key. Single launcher icon. | ✓ |
| Distinct ID | compatRecon = `ai.humynlabs.capture.compatrecon` — coexists side-by-side. Two icons. | |
| Distinct ID + auto-uninstall | apkRollout calls system uninstall intent on first run. Requires user confirmation. | |

**User's choice:** Same ID as apkRollout
**Notes:** This pattern remains correct for any future sequential sub-flavor even though the compatRecon construct itself was rescinded later in the discussion.

### Q3 — How does the client identify its build flavor to /auth/google, and how does the backend policy map work?

| Option | Description | Selected |
|--------|-------------|----------|
| Enum + applicationId pair | Client sends `{flavor, applicationId}`. Backend cross-checks against server-side allowlist; mismatch = 403. Defense-in-depth. | ✓ |
| Enum only | Client sends `{flavor}` only; backend trusts. A malicious client could spoof. | |
| Derive from applicationId | Client sends `{applicationId}` only; backend infers flavor. Ties API contract to applicationId strings. | |

**User's choice:** Enum + applicationId pair
**Notes:** Backend's allowlist lives in code (`apps/api/src/auth/flavor-allowlist.ts`), not Remote Config or DB.

### Q4 — Do all flavors share the same launcher icon and display name 'Humyn Labs Capture'?

| Option | Description | Selected |
|--------|-------------|----------|
| Identical branding | Same name and icon across all three flavors. Channel signal in app behavior, not branding. | ✓ |
| Suffix on early channels | playStore = "Humyn Labs Capture"; apkRollout = "Humyn Labs Capture (Early)". | |
| compatRecon distinct | compatRecon different name + icon. | |

**User's choice:** Identical branding

---

## compatRecon APK (RESCINDED mid-discussion)

### Q1 — What does compatRecon actually run on the chief's device?

| Option | Description | Selected (later rescinded) |
|--------|-------------|----------|
| Full behavioral check | NAL-unit B-frame parse, OIS readback, HDR-SDR force, IMU sustained 100Hz over 30s under preview load with p99 ≤ 12ms, REALTIME clock readback, ultrawide ≥ 110°, root verdict, storage probe. ~10–15 MB APK. | ✓ (then rescinded) |
| Metadata + IMU sample | Reads advertised camera capabilities + sensor list + 30s IMU sample. ~5–7 MB APK. | |
| Behavioral, no test clip | Skip the NAL-unit B-frame parse; keep IMU/OIS/HDR/REALTIME/dFOV checks. ~7–9 MB. | |

### Q2 — What identity gate does compatRecon use?

| Option | Description | Selected (later rescinded) |
|--------|-------------|----------|
| Chief code only | 6-char alphanumeric chief code mapped server-side to KGeN identity. ~6–7 MB APK. | |
| Google Sign-In + Integrity | Full /auth/google + Play Integrity flow. Pre-rollout dress rehearsal. ~14–18 MB APK. | ✓ (then rescinded) |
| Anonymous + device ID | No auth; ephemeral device fingerprint. ~7–8 MB APK. | |

### Q3 — Where does compatRecon submit its harvest data?

| Option | Description | Selected (later rescinded) |
|--------|-------------|----------|
| Dedicated /compat-recon | New endpoint with strict Zod schema; backed by recon Postgres table. | |
| Reuse /events | POST /events with event_type='compat_recon_v1'. No new endpoint. | ✓ (then rescinded) |
| Reuse /feedback | POST /feedback with category='compat_recon'. Semantically wrong. | |

### Q4 — What's the apkRollout go/no-go threshold from the recon harvest?

| Option | Description | Selected (later rescinded) |
|--------|-------------|----------|
| Manual review | Engineering + product review the harvest as a single decision. | |
| Hard 90% all-pass | Algorithmic gate: ≥90% of devices must all-pass {REALTIME, IMU sustained-100Hz with p99 ≤12ms, no B-frame leakage, OIS-off readable, HDR-off readable, ultrawide ≥110°, root-clean}. | ✓ (then rescinded) |
| Tiered: mandatory + remediable | Mandatory checks ≥85% pass; remediable checks worked around per-device via Remote Config. | |

**User's correction (mid-discussion, immediately after Q4):**

> "you completely got it wrong. There is no fleet testing or 50 chiefs or anything like that. The idea is we build apk first. Then we rollout on play store. The apk we will share directly with users. No chiefs involved. Going forward in the future, forget about clan chief's and other similar constructs."

**Effect:**
- All four compatRecon decisions above are withdrawn.
- DIST-07 (compatRecon APK to ~50 chiefs) is rescinded from Phase 1 scope.
- ROADMAP.md Phase 1 success criterion #3 (chief recon harvest go/no-go) is rescinded.
- The chief-network acquisition narrative throughout PROJECT.md / REQUIREMENTS.md / ROADMAP.md / .planning/research/ is now stale; cleanup pass deferred (see CONTEXT.md `<deferred>`).
- Saved to memory: `feedback_no_clan_chief_constructs.md` + `project_distribution_apk_then_play.md`.
- Distribution model carries forward: signed APK first → Play Store → iOS App Store, all direct-to-users.
- Device-fleet viability now depends entirely on Phase 2's in-app behavioral compat check (COMPAT-01..08) running on real users post-APK-share.

---

## Embeddings

### Q1 — Which embedding provider produces the /tasks vectors at MVP?

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI text-embedding-3-small | Hosted API, ~$0.02 / 1M tokens, 384/512/1536-dim. External key dependency. | |
| Self-hosted all-MiniLM-L6-v2 | ~80 MB ONNX model bundled; runs in-process. Dim = 384. No per-call cost, no external API. | ✓ |
| Defer to Phase 6 | Phase 1 ships schema + index but embeddings = NULL until Phase 6. | |

**User's choice:** Self-hosted all-MiniLM-L6-v2

### Q2 — Where does the embedding model execute?

| Option | Description | Selected |
|--------|-------------|----------|
| In-process Node ONNX | Inside Fastify via `@xenova/transformers` (or `onnxruntime-node`). Single deployable. ~50–200ms per query embedding on CPU. | ✓ |
| Python sidecar | FastAPI/litserve container; HTTP-call from Fastify. Faster, GPU-capable later. Adds a service. | |
| Worker thread | Embedding runs in a Node worker_thread inside Fastify. Isolates ONNX from event loop. | |

**User's choice:** In-process Node ONNX

### Q3 — When does the backend compute and refresh task embeddings?

| Option | Description | Selected |
|--------|-------------|----------|
| At seed time | Drizzle seed script computes embeddings on first migration / on taxonomy update. CI guards re-seed. | ✓ |
| Lazy on first read | Backend computes on first /tasks request that touches a NULL row, writes back. Self-healing; first-call slow. | |
| Scheduled hourly job | BullMQ scheduled job; recomputes for changed rows. Most robust against drift; adds operational surface. | |

**User's choice:** At seed time

### Q4 — What text gets embedded for each task row?

| Option | Description | Selected |
|--------|-------------|----------|
| name + description + category | `${name}. ${description}. Category: ${category}.` Excludes instructions, setting, warning. | ✓ |
| name + description only | Cleanest signal; relies on RRF + tsvector for category-vibe queries. | |
| All searchable fields | Name + description + category + instructions + warning. Risks dilution from formulaic instructions. | |

**User's choice:** name + description + category

---

## Legal & data-rights

### Q1 — When does DPDP/LGPD counsel review actually gate distribution, and who owns the relationship?

| Option | Description | Selected |
|--------|-------------|----------|
| Before APK ships to users | Counsel review must complete before first APK distribution. Strictest reading of DPDP/LGPD. Owner: ops. | |
| Before Play Store launch | Counsel review must complete before Play Store launch but APK can ship earlier. Pragmatic reading. | |
| Parallel ops track, not a hard gate | Counsel produces deliverables that ship asynchronously. Lowest friction, highest legal exposure. | ✓ |

**User's choice:** Parallel ops track, not a hard gate
**Notes:** User explicitly accepts the legal-exposure tradeoff. Counsel deliverables (consent updates, takedown SOP, ANPD/DPB registrations) ship asynchronously as ready.

### Q2 — What data-subject-rights API surface ships in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Erasure only + ops export | DELETE /me + POST /me/restore + PATCH /me. Access via Help Center mailto → ops manual ZIP. | ✓ |
| Erasure + self-serve export | + GET /me/export with async ZIP build. Higher Phase 1 scope (job queue, email, download tokens). | |
| Full DSR endpoints | + correction-request + consent-withdrawal endpoints. Out of scope for MVP. | |

**User's choice:** Erasure only + ops export

### Q3 — How is consent-version logging structured?

| Option | Description | Selected |
|--------|-------------|----------|
| consent_log table + cache | Append-only consent_log table + denormalized users.consent_version cache. Full audit history. | ✓ |
| User row only | Just users.consent_version + users.consent_accepted_at. Each accept overwrites. No history. | |
| consent_log only | No User cache. Latest fetched via DESC LIMIT 1 per request. | |

**User's choice:** consent_log table + cache

### Q4 — How does the takedown SOP land in code/docs at MVP?

| Option | Description | Selected |
|--------|-------------|----------|
| Ops runbook + manual DB | SOP doc + manual DB script. No admin endpoint. | ✓ |
| Ops runbook + admin endpoint | + hidden POST /admin/recordings/{id}/takedown (service-account JWT). | |
| Ops runbook + admin dashboard | Full admin UI. v2 concern. | |

**User's choice:** Ops runbook + manual DB

---

## Backend hosting

### Q1 — Which AWS region(s) host the backend at MVP?

| Option | Description | Selected |
|--------|-------------|----------|
| ap-south-1 only + CloudFront | Mumbai single region; Brazil traffic via CloudFront edge. Data residency in India. | ✓ |
| Multi-region: ap-south-1 + sa-east-1 | Active-active in Mumbai + São Paulo. ~2x cost. | |
| us-east-1 + CloudFront | N. Virginia + CloudFront edge. Cheapest; weakest DPDP/LGPD posture. | |

**User's choice:** ap-south-1 only + CloudFront

### Q2 — Which Postgres service hosts pgvector + tsvector + everything else?

| Option | Description | Selected |
|--------|-------------|----------|
| RDS PostgreSQL 17 | Managed Postgres with pgvector ≥0.8.0. Single-AZ at MVP. | ✓ |
| Aurora PostgreSQL | PG-compat with better tail-latency. Overkill at MVP scale. | |
| Self-hosted on EC2 | Full control; full ops responsibility. Out of scope at MVP. | |

**User's choice:** RDS PostgreSQL 17

### Q3 — Where does the Fastify backend run?

| Option | Description | Selected |
|--------|-------------|----------|
| ECS Fargate | Serverless containers behind ALB. Single task at MVP. | ✓ |
| ECS-on-EC2 | Cheaper at sustained load; AMI patching surface. | |
| App Runner | Container-native Heroku-ish. Less VPC flexibility. | |

**User's choice:** ECS Fargate

### Q4 — Does Phase 1 provision ElastiCache Redis or defer to Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 5 | Single Fargate task with in-process LRU + in-process rate-limit. Skip ElastiCache (~$13–25/mo). | ✓ |
| Provision now | cache.t4g.micro from day 0. Pre-provisions for multi-replica. | |
| Hybrid: Redis-shim only | Redis-compatible interface backed by in-process Map at MVP. | |

**User's choice:** Defer to Phase 5

---

## APK distribution

### Q1 — Where does the apkRollout APK live for users to download?

| Option | Description | Selected |
|--------|-------------|----------|
| S3 + CloudFront public | Dedicated bucket + CloudFront. Versioned filenames. | ✓ |
| S3 signed-URL gated | APK behind backend-issued signed URL. Adds access control. | |
| GitHub Releases | Release-asset on GitHub repo. Couples ops to GitHub. | |

**User's choice:** S3 + CloudFront public

### Q2 — How do apkRollout users get upgrades pushed to them?

| Option | Description | Selected |
|--------|-------------|----------|
| Open APK URL in browser | Upgrade banner opens APK URL in system browser. OS sideload flow. | |
| In-app PackageInstaller | App downloads APK, SHA-256 verifies, calls PackageInstaller. Requires REQUEST_INSTALL_PACKAGES (apkRollout flavor only). | ✓ |
| Redirect to Play Store | apkRollout deep-links to Play Store listing. | |

**User's choice:** In-app PackageInstaller
**Notes:** Phase 1 backend ships `apk_url` + `apk_sha256` fields in /app/version response for apkRollout flavor; Phase 2 wires the in-app download + verify + install flow. apkRollout flavor declares REQUEST_INSTALL_PACKAGES via flavor-scoped manifest.

### Q3 — How are signing keys managed for the apkRollout APK?

| Option | Description | Selected |
|--------|-------------|----------|
| Self-key in CI secrets | apkRollout self-keystore + Play upload keystore both in CI provider's encrypted secrets. CI signs every release. Play App Signing for Play side. | ✓ |
| Self-key in AWS Secrets Manager | Same but keystores in Secrets Manager; CI fetches at build. | |
| Local-only signing | Keystore on dev machine; release manual. Skip. | |

**User's choice:** Self-key in CI secrets

### Q4 — What's Phase 1's mobile deliverable scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Buildable scaffold + auth check | Three flavors built + signed; single Sign-in screen exercising /auth/google + Play Integrity end-to-end. | ✓ |
| Buildable scaffold only | Three flavors buildable + signable; no backend integration. | |
| Full sign-in + profile screen | Phase 1 includes Phase 2 sign-in + permissions skeleton. Over-scope. | |

**User's choice:** Buildable scaffold + auth check

---

## JWT/session

### Q1 — Token TTL + refresh strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Long-lived JWT, no refresh | 30-day TTL JWT. Logout = client-only. No server revocation. | ✓ |
| Short JWT + refresh token | 15-min access + 30-day rotating refresh in Postgres. Server revocation possible. | |
| Session-cookie | @fastify/session + Postgres sessions. Native logout-revocation. Cookies are a web idiom. | |

**User's choice:** Long-lived JWT, no refresh

### Q2 — JWT signing algorithm and secret storage?

| Option | Description | Selected |
|--------|-------------|----------|
| HS256 + Secrets Manager | Single 256-bit secret in AWS Secrets Manager. Fargate task definition references ARN. | ✓ |
| RS256 + Secrets Manager | Asymmetric private + public; jwks.json publication. Cleaner key-rotation. Overkill at MVP. | |
| HS256 + plain env var | Hardcoded in Terraform / CI / .env. Skip. | |

**User's choice:** HS256 + Secrets Manager

### Q3 — What claims are in the JWT payload?

| Option | Description | Selected |
|--------|-------------|----------|
| Rich claims | `{ sub, iat, exp, flavor, applicationId, integrity_verdict, token_version }`. No per-request DB lookup. | ✓ |
| Minimal claims | `{ sub, iat, exp }`. Backend reads flavor / integrity from User row per request. | |
| Standard + role | Rich + `role`. Adds unused field today. | |

**User's choice:** Rich claims

---

## Claude's Discretion

The following were left as planner-level details (not asked of the user) in CONTEXT.md `<decisions>` § "Claude's Discretion":

- versionCode strategy across flavors
- CI provider choice (GitHub Actions assumed default)
- Idempotency-key store implementation specifics
- HNSW index parameters (m, ef_construction, ef_search)
- RRF k constant (locked at 60 by stack research; tunable)
- Pre-commit hooks / lint / format choice / monorepo build cache
- Search-query embedding cache
- Drizzle migration timing
- /events backend ingest scope (real ingest vs stub)
- Per-flavor Remote Config keys
- APK SHA-256 fingerprint disclosure UX
- Marketing-side discovery mechanism for the apkRollout APK URL

---

## Deferred Ideas

See CONTEXT.md `<deferred>` for the full list. Highlights:
- PROJECT.md / REQUIREMENTS.md / ROADMAP.md / research/* cleanup pass to remove stale clan-chief narrative.
- Multi-region deployment (sa-east-1).
- Self-serve `GET /me/export` endpoint (v1.1 / v2).
- Admin endpoints / dashboard (v2).
- Per-upload Play Integrity attestation (v2 — FRAUD-V2-01).
- Marketing-side discovery for apkRollout URL.
