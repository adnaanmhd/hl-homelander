---
phase: 01-foundation-backend-distribution-recon
plan: 04
subsystem: backend
tags: [fastify, plugins, idempotency, rate-limit, jwt, problem-detail, healthz, readyz, vitest]

# Dependency graph
requires:
  - phase: 01
    plan: 01
    provides: apps/api package with fastify@5.8.5, @fastify/jwt@10.0.0, @fastify/rate-limit@10.3.0, pino@10.3.1, zod@4.4.3 pinned
  - phase: 01
    plan: 02
    provides: schema.idempotencyKeys table (composite PK on user_id, key + expiresAt index) for the idempotency-store backing
  - phase: 01
    plan: 03
    provides: live Postgres at postgres://humyn:humyn@localhost:5432/humyn_dev for /readyz checks + the idempotency test fixture
provides:
  - Fastify 5.8.5 buildApp() factory with deterministic plugin registration order — request-id → zod → error-handler → rate-limit → auth → idempotency
  - RFC 7807 problem+json everywhere — every error path emits application/problem+json with type URI under https://humyn-app.io/problems/<slug>; canonical 14-slug catalog reserved for plans 05-12
  - Idempotency-Key plugin enforcing UUIDv4 on every POST/PATCH (skippable via route config { idempotency: false }); 24h TTL replay, request-hash conflict detection (409)
  - Per-IP anonymous-tier rate limit (30/min) with x-ratelimit-* + retry-after headers; per-user authenticated tier consumed by routes via config.rateLimit + `user:<sub>` keyGenerator (DISJOINT bucket storage)
  - Auth plugin — @fastify/jwt HS256 verifier with requireAuth decorator; CURRENT_TOKEN_VERSION cluster-wide kill-switch (D-AUTH-05); JwtPayload module-augmented onto FastifyJWT
  - /healthz (liveness) + /readyz (DB ping w/ 1s timeout, 503 on failure)
  - Pino logger config redacts authorization, x-idempotency-key, set-cookie at logger level; pino-pretty in dev, JSON in prod
  - 12 vitest tests across 5 files covering all four cross-cutting invariants (problem+json shape, idempotency replay/conflict, rate-limit anon-tier bucket, request-id echo) + healthz/readyz against live Postgres
affects:
  [
    01-05 (auth — registers /auth/google with config.idempotency=false; uses requireAuth decorator),
    01-06 (tasks routes — register on top of buildApp(); use ZodTypeProvider for body/response schemas),
    01-07 (recordings routes — RecordingCreateSchema validation via fastify-type-provider-zod),
    01-08 (uploads — Idempotency-Key required on every POST; ratelimit config.rateLimit at route),
    01-11 (DSR routes — DELETE /me,
    POST /me/restore,
    PATCH /me; consume same plugins),
    01-12 (integration tests — buildApp() is the same factory the test substrate uses),
    05 (Phase 5 — hash-verify worker reads/writes via plugins inherited here),
  ]

# Tech tracking
tech-stack:
  added:
    - fastify-plugin@5.0.1 (required by every fp(plugin, ...) call; was missing from plan 01's pin list)
    - fastify-type-provider-zod@6.1.0 (NOT 4.0.2 from plan body — see deviation 1; 6.1.0 is the only published version with zod@4 peer support)
    - nanoid@5.0.9 (request-id minting)
    - jsonwebtoken@9.0.2 + @types/jsonwebtoken@9.0.7 (devDeps — idempotency test signs HS256 tokens; in prod the api signs via @fastify/jwt)
  patterns:
    - 'buildApp() factory pattern (Pattern 11): apps/api/src/app.ts exports an async factory that registers plugins + routes; apps/api/src/server.ts is a thin entry that builds + listens. Tests inject() into the factory output without binding a port. Plans 05-12 add their routes inside buildApp(), not next to server.ts.'
    - "Plugin registration order is load-bearing (Pattern 12): request-id → zod → error-handler → rate-limit → auth → idempotency. request-id mints req.id before anything logs; error-handler must wrap routes; rate-limit fires before auth so anonymous IPs are throttled; auth populates req.user before idempotency hashes the request; idempotency declares dependencies: ['auth'] but ALSO calls req.jwtVerify() itself because the global preHandler runs BEFORE route-level requireAuth (see deviation 4)."
    - 'Problem-detail wire contract (Pattern 13): every error response is application/problem+json. The slug catalog in src/lib/problem-detail.ts is APPEND-ONLY — once shipped, slugs cannot be renamed (clients switch on the URI). New error types are added to PROBLEM_SLUGS, never substituted in place.'
    - "Plugin-thrown problem-detail short-circuit (Pattern 14): when a plugin (e.g. @fastify/rate-limit) throws an Error with `.problemDetail` attached, error-handler.ts emits the body verbatim instead of remapping by slug. This preserves wire-side extensions like `tier: 'anonymous'` and `retryAfterSeconds`."
    - "FastifyJWT module augmentation (Pattern 15): the JWT payload type lives in src/plugins/auth.ts as JwtPayload, then `declare module '@fastify/jwt' { interface FastifyJWT { payload: JwtPayload; user: JwtPayload; } }` makes req.user typed across the codebase. Plans 05+ that read req.user.sub get the typed shape for free."
    - 'Disjoint rate-limit bucket keyspaces (Pattern 16): anonymous tier keyed `ip:<ip>`, authenticated tier keyed `user:<sub>`. The two never collide. Plans 05-08 register authenticated routes with config.rateLimit + a user-keyed keyGenerator; plain GET/POST without auth runs through the anonymous tier only.'

key-files:
  created:
    - apps/api/src/lib/problem-detail.ts (RFC 7807 builder + 14-slug catalog reserved for plans 05-12)
    - apps/api/src/lib/idempotency-store.ts (UUID_V4_REGEX + sha256 request hashing + Drizzle (user_id, key) lookup + 24h TTL persist)
    - apps/api/src/plugins/error-handler.ts (setErrorHandler — Pattern 14 short-circuit + Zod validation branch + statusCode mapping + 500 catch-all with scrubbed detail)
    - apps/api/src/plugins/zod.ts (validatorCompiler + serializerCompiler from fastify-type-provider-zod 6.1.0; ZodTypeProvider re-exported as type)
    - apps/api/src/plugins/request-id.ts (trusts client X-Request-Id ≤64 chars OR mints 21-char nanoid; echoes in response header)
    - apps/api/src/plugins/logger.ts (pino options w/ redact paths; pino-pretty in dev, JSON in prod)
    - apps/api/src/plugins/idempotency.ts (preHandler enforces UUIDv4 on POST/PATCH, replay/conflict logic, onSend persists 2xx/4xx; calls req.jwtVerify() itself to populate userId before route-level requireAuth runs)
    - apps/api/src/plugins/rate-limit.ts (anonymous-tier global registration; authenticated-tier per-route docs)
    - apps/api/src/plugins/auth.ts (requireAuth decorator + CURRENT_TOKEN_VERSION kill-switch + FastifyJWT module augmentation)
    - apps/api/src/routes/healthz.ts (liveness)
    - apps/api/src/routes/readyz.ts (readiness w/ 1s SELECT 1 race + 503 on db_timeout)
    - apps/api/src/app.ts (buildApp factory — Pattern 11)
    - apps/api/src/server.ts (Fastify boot, port/host from env)
    - apps/api/test/routes/health.test.ts
    - apps/api/test/plugins/request-id.test.ts
    - apps/api/test/plugins/error-handler.test.ts
    - apps/api/test/plugins/idempotency.test.ts
    - apps/api/test/plugins/rate-limit.test.ts
  modified:
    - apps/api/src/index.ts (placeholder log replaced with `import './server.js'`)
    - apps/api/package.json (+fastify-plugin@5.0.1, +fastify-type-provider-zod@6.1.0 [bumped from 4.0.2 — see deviation 1], +nanoid@5.0.9, +jsonwebtoken@9.0.2 dev, +@types/jsonwebtoken@9.0.7 dev)
    - apps/api/vitest.config.ts (added `test/**/*.test.ts` to include glob; plan layout uses test/, not tests/)
    - pnpm-lock.yaml (deterministic resolution for the four new deps + bump)

key-decisions:
  - "Bumped fastify-type-provider-zod from the plan-specified 4.0.2 to 6.1.0. Version 4.x declares peer zod@^3.14.2; we pin zod@4.4.3 (locked in plan 01-01). At runtime, the 4.x package crashed with `Cannot read properties of undefined (reading 'map')` inside createValidationError — the internal shape of zod 4 issues differs. Version 6.1.0 (npm view confirms peerDeps zod >= 4.1.5) is the only published version with first-class zod@4 support and is API-compatible at the surfaces we use (validatorCompiler, serializerCompiler, ZodTypeProvider type, no @fastify/swagger consumption yet). Recorded as deviation 1 below."
  - "Added fastify-plugin@5.0.1 explicitly to apps/api dependencies. Every plugin under src/plugins/ wraps its export in `fp(plugin, { name, dependencies })`. fastify-plugin was a transitive dep of @fastify/* packages from plan 01 but never an explicit dependency, so referencing it directly in src/plugins/ would have been a hidden hoist. Pinning it to 5.0.1 makes the workspace's plugin contract reproducible."
  - "Idempotency plugin's global preHandler calls req.jwtVerify() itself (best-effort, swallow failures) rather than relying on req.user from a route-level requireAuth. Fastify runs hooks added via app.addHook BEFORE route-level preHandlers, so the original plan code (`const userId = req.user?.sub`) always observed undefined and the persistence path never fired. The fix decodes the bearer token in the global hook on a best-effort basis; if the token is missing/invalid, the plugin falls through and the route's requireAuth handles the 401 normally. The (user_id, key) lookup pattern (D-AUTH-05) is preserved end-to-end."
  - 'Pino redact paths in src/plugins/logger.ts are defense-in-depth. The serializer in loggerOptions only emits {id, method, url, remoteAddress} for req objects — Authorization and Idempotency-Key headers never reach the log line in the first place. The redact paths protect against any future code path (e.g., debug-level dumps) that logs the full req object.'
  - "@fastify/rate-limit's errorResponseBuilder returns an Error subclass with `.statusCode = 429` and `.problemDetail = <pre-built body>`. The plugin THROWS the result, which Fastify routes through setErrorHandler. The error-handler's branch 0 (Pattern 14) detects the `problemDetail` field and emits it verbatim, preserving the `tier: 'anonymous'` and `retryAfterSeconds` extensions. Without this, the rate-limit response would lose its problem-detail body and fall through the catch-all 500 branch."

patterns-established:
  - 'Pattern 11 (buildApp factory): apps/api/src/app.ts is the test seam. Tests import buildApp() and call app.inject() — no real port binding. Plans 05-12 add their routes inside buildApp(), then their tests reuse the same factory.'
  - 'Pattern 12 (Plugin registration order): request-id → zod → error-handler → rate-limit → auth → idempotency. New plugins are inserted at the explicit position that respects their semantic dependencies, not at the end. Future plans MUST not reorder this list without re-deriving the rationale.'
  - 'Pattern 13 (Problem-detail slug catalog is wire contract): src/lib/problem-detail.ts PROBLEM_SLUGS is APPEND-ONLY. New error types add a slug; existing slugs cannot be renamed.'
  - 'Pattern 14 (Plugin-thrown problem-detail short-circuit): when a plugin throws an Error with `.problemDetail` attached, error-handler.ts emits the body verbatim. Used by rate-limit; future plugins that need to surface their own slug + extensions follow the same shape.'
  - "Pattern 15 (FastifyJWT module augmentation): JwtPayload lives next to the auth plugin. `declare module '@fastify/jwt' { interface FastifyJWT { payload: JwtPayload; user: JwtPayload } }` types req.user across every route handler in the workspace."
  - 'Pattern 16 (Disjoint rate-limit buckets): anonymous tier `ip:<ip>`, authenticated tier `user:<sub>`. Plans 05-08 use config.rateLimit with a user-keyed keyGenerator on every authed route; bucket keyspaces never overlap.'

requirements-completed: [API-02, API-03, API-04, API-17]

# Metrics
duration: 9min
completed: 2026-05-07
---

# Phase 01 Plan 04: Fastify App Skeleton + Cross-Cutting Plugins Summary

**Fastify 5.8.5 buildApp() factory with the seven cross-cutting plugins every Phase 1 route depends on (problem+json error handler, zod type provider, pino redact logger, request-id echo, per-IP anonymous-tier rate limit, JWT auth with token_version kill-switch, idempotency-key with 24h replay/conflict semantics) — verified end-to-end against a live Postgres + JWT-signed test tokens via 12 vitest tests, plus a smoke-running server that returns 200 on /healthz and /readyz with x-request-id headers.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-07T13:15:24Z
- **Completed:** 2026-05-07T13:24:27Z
- **Tasks:** 3 / 3
- **Files created:** 18
- **Files modified:** 4 (apps/api/package.json, apps/api/src/index.ts, apps/api/vitest.config.ts, pnpm-lock.yaml)

## Accomplishments

- **buildApp() factory** in `apps/api/src/app.ts` registers six plugins in the deterministic order (request-id → zod → error-handler → rate-limit → auth → idempotency) and the two health routes. `apps/api/src/server.ts` is a thin entry point that calls `buildApp()` and listens on `PORT` (default 8080). Tests use `app.inject()` against the same factory — no port binding.
- **RFC 7807 wire contract** is now framework-level: `src/lib/problem-detail.ts` exports `buildProblemDetail()` + a 14-slug catalog (`validation`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `rate-limited`, `idempotency-key-{invalid,conflict}`, `internal`, `integrity-{rooted,emulator,install-source,nonce,stale}`). The error-handler emits `application/problem+json` for every failure path: Zod validation errors → 400 with `errors[]` extension; Fastify-thrown errors → mapped slug; pre-built problem-detail attached to the error (rate-limit Pattern 14) → emitted verbatim; everything else → 500 with `An unexpected error occurred` (no stack leaks to client). 4xx logs at WARN, 5xx at ERROR.
- **Idempotency-Key plugin** enforces UUIDv4 (`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) on every POST/PATCH; routes opt out via `config: { idempotency: false }`. Lookup is keyed by `(user_id, key)` against `schema.idempotencyKeys` (24h TTL); replay returns the original status + body byte-for-byte; same key + different request hash → 409 `idempotency-key-conflict`. `onSend` persists 2xx/4xx responses (skips 5xx so transient failures don't memoize).
- **Per-user + per-IP rate limit** with separate buckets per D-HOST-04. Anonymous tier (per-IP, 30/min) is registered globally via `@fastify/rate-limit` with `keyGenerator: (req) => 'ip:' + req.ip`; on 429, builds a problem-detail with `tier: 'anonymous'` + `retryAfterSeconds` extension and throws it as an Error subclass with `.problemDetail` attached. The error-handler's Pattern 14 branch emits it verbatim — preserving extensions. Authenticated tier consumed at route-config level by plans 05-08 via `config.rateLimit` + `user:<sub>` keyGenerator (disjoint bucket storage).
- **Auth plugin** is a thin `@fastify/jwt` wrapper. `app.requireAuth` decorator validates the bearer token (HS256, `JWT_SIGNING_SECRET` from env), checks `payload.token_version >= CURRENT_TOKEN_VERSION` (the cluster-wide kill-switch from D-AUTH-05), and populates `req.user` typed as `JwtPayload`. The `JwtPayload` shape (`{sub, iat, exp, flavor, applicationId, integrity_verdict, token_version}`) is module-augmented onto `@fastify/jwt`'s `FastifyJWT` interface so every route handler that reads `req.user.sub` gets the correct type for free.
- **Pino redact paths** at the logger level (`req.headers.authorization`, `req.headers["x-idempotency-key"]`, `res.headers["set-cookie"]`) are defense-in-depth — the request serializer only emits `{id, method, url, remoteAddress}`, so secrets never reach the log line in the first place. Pino-pretty in dev, JSON in prod (`NODE_ENV` switch).
- **Request-id plugin** trusts client-supplied `X-Request-Id` (≤64 chars, helps cross-system tracing) or mints a 21-char nanoid; echoes back as the `x-request-id` response header on every request.
- **/healthz** returns `200 {status:"ok"}` unconditionally (liveness — ALB never marks unhealthy unless the process is crashed). **/readyz** returns `200 {status:"ready"}` if `SELECT 1` against Postgres completes within 1s, else `503 application/problem+json` (DB unreachable). Used by ALB target-group readiness in Phase 5.
- **12 vitest tests across 5 files** all pass against the running Postgres dev DB:
  - `test/routes/health.test.ts` (2): /healthz + /readyz both 200.
  - `test/plugins/request-id.test.ts` (2): client-supplied id echoed; nanoid minted when absent.
  - `test/plugins/error-handler.test.ts` (3): zod validation → 400 with `errors[]`; statusCode error → mapped slug; unhandled error → 500 with scrubbed detail.
  - `test/plugins/idempotency.test.ts` (4): missing key → 400; malformed key → 400; same key + same body → replay 200; same key + different body → 409 conflict.
  - `test/plugins/rate-limit.test.ts` (1): 35 rapid GET /healthz from same IP → some return 429 + retry-after + tier:'anonymous'.

## Live Smoke Verification (executed against running server)

Booted the compiled api with `node dist/server.js` (port 8080, NODE_ENV=production) against the live Postgres + LocalStack stack from plans 01-02 / 01-03:

1. **`curl http://localhost:8080/healthz`** → `200 {"status":"ok"}` with `x-request-id: <nanoid>`, `x-ratelimit-limit: 30`, `x-ratelimit-remaining: 29`, `x-ratelimit-reset: 60`. PASS.
2. **`curl http://localhost:8080/readyz`** → `200 {"status":"ready"}`. DB ping succeeded. PASS.
3. **`curl -X POST http://localhost:8080/some-path`** (no Idempotency-Key) → `400 application/problem+json`:
   ```json
   {
     "type": "https://humyn-app.io/problems/idempotency-key-invalid",
     "title": "Idempotency-Key required",
     "status": 400,
     "detail": "POST/PATCH requests must include an Idempotency-Key header (UUIDv4)",
     "instance": "<request-id>"
   }
   ```
   PASS.
4. **35 rapid /healthz from same IP** → 28×200 + 7×429. Sample 429 body:
   ```json
   {
     "type": "https://humyn-app.io/problems/rate-limited",
     "title": "Rate limit exceeded",
     "status": 429,
     "detail": "Anonymous (per-IP) rate limit hit. Retry after 1 minute.",
     "instance": "<request-id>",
     "tier": "anonymous",
     "retryAfterSeconds": "1 minute"
   }
   ```
   plus headers: `retry-after: 60`, `x-ratelimit-remaining: 0`. PASS.
5. **Pino redact** check: sent `Authorization: Bearer SECRET_TOKEN_DO_NOT_LEAK` + `Idempotency-Key: <uuidv4>` to /healthz; grep'd JSON logs for `SECRET_TOKEN_DO_NOT_LEAK` / `authorization` / `x-idempotency-key` — no matches. PASS.

The server is currently up and exercising the full plugin stack against the live Postgres dev DB. Plans 05-08 can register their routes inside `buildApp()` immediately.

## Task Commits

Each task was committed atomically on `main` (pre-commit hook ran `lint-staged` then `pnpm typecheck` for every commit; all green):

1. **Task 1: Problem-detail builder + error handler + zod / request-id / logger plugins** — `c69be84` (feat)
2. **Task 2: Idempotency / rate-limit / auth plugins, healthz/readyz routes, buildApp factory, server entry** — `1516fca` (feat)
3. **Task 3: 5 vitest plugin/route test files + idempotency hook-ordering fix + fastify-type-provider-zod 4.0.2 → 6.1.0 bump** — `824bd2c` (test)

**Plan metadata commit:** appended below post-summary.

## Files Created / Modified

**Created (18):**

- `apps/api/src/lib/problem-detail.ts` — RFC 7807 builder + 14-slug catalog.
- `apps/api/src/lib/idempotency-store.ts` — UUID_V4_REGEX + sha256 request hashing + Drizzle (user_id, key) lookup/persist/gcExpired.
- `apps/api/src/plugins/error-handler.ts` — setErrorHandler with Pattern 14 short-circuit + Zod branch + statusCode mapping + 500 catch-all.
- `apps/api/src/plugins/zod.ts` — validatorCompiler + serializerCompiler from fastify-type-provider-zod 6.1.0.
- `apps/api/src/plugins/request-id.ts` — client-trusted or nanoid.
- `apps/api/src/plugins/logger.ts` — pino options w/ redact + pino-pretty in dev.
- `apps/api/src/plugins/idempotency.ts` — preHandler + onSend; calls req.jwtVerify() in the global hook to populate userId.
- `apps/api/src/plugins/rate-limit.ts` — anon-tier global; auth-tier per-route docs.
- `apps/api/src/plugins/auth.ts` — requireAuth + CURRENT_TOKEN_VERSION + FastifyJWT augmentation.
- `apps/api/src/routes/healthz.ts` — liveness 200 status:ok.
- `apps/api/src/routes/readyz.ts` — readiness w/ 1s SELECT 1 race + 503 problem+json on db_timeout.
- `apps/api/src/app.ts` — buildApp() factory.
- `apps/api/src/server.ts` — listens on PORT/HOST.
- `apps/api/test/routes/health.test.ts` — /healthz + /readyz.
- `apps/api/test/plugins/request-id.test.ts` — echo + mint.
- `apps/api/test/plugins/error-handler.test.ts` — zod + statusCode + unhandled.
- `apps/api/test/plugins/idempotency.test.ts` — missing/malformed/replay/conflict.
- `apps/api/test/plugins/rate-limit.test.ts` — 35-burst → 429 + tier:'anonymous'.

**Modified (4):**

- `apps/api/src/index.ts` — placeholder log replaced with `import './server.js'`.
- `apps/api/package.json` — added fastify-plugin@5.0.1, fastify-type-provider-zod@6.1.0 (NOT 4.0.2), nanoid@5.0.9; devDeps added jsonwebtoken@9.0.2 + @types/jsonwebtoken@9.0.7.
- `apps/api/vitest.config.ts` — added `test/**/*.test.ts` to include glob (plan layout uses test/, not tests/).
- `pnpm-lock.yaml` — deterministic resolution for the new deps + bump.

## Decisions Made

- **fastify-type-provider-zod 4.0.2 → 6.1.0** — see deviation 1.
- **fastify-plugin@5.0.1 added explicitly to apps/api dependencies** — every plugin uses `fp(plugin, ...)` and the package was a hidden transitive dep before this plan.
- **Idempotency global preHandler calls `req.jwtVerify()` itself** rather than depending on a route-level `requireAuth` to populate `req.user`. Global preHandlers run BEFORE route-level preHandlers, so the original code path always observed `req.user === undefined` and never persisted anything. The fix decodes the bearer token best-effort in the global hook; missing/invalid tokens fall through to the route's `requireAuth` for the standard 401.
- **Rate-limit `errorResponseBuilder` returns `Error & { statusCode, problemDetail }`** — `@fastify/rate-limit` THROWS the return value through `setErrorHandler`. Returning a plain object would fall through the catch-all 500 branch (no `statusCode` or `problemDetail` to recognize). Wrapping in an Error subclass with the pre-built problem-detail attached is the cleanest way to preserve the wire-side `tier` and `retryAfterSeconds` extensions through the error pipeline.
- **Pino `redact.paths` is defense-in-depth.** The `req` serializer only includes `{id, method, url, remoteAddress}` so secrets never reach the log line in the first place. The redact paths exist for any future code path that does `req.log.info({ req }, ...)` with a bare req — which IS what `@fastify/rate-limit` does internally on its rate-limit-exceeded log emit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fastify-type-provider-zod 4.0.2 is incompatible with zod@4.4.3 (locked from plan 01-01)**

- **Found during:** Task 3 (running vitest after Task 2).
- **Issue:** Plan body specified `fastify-type-provider-zod@4.0.2`. At runtime the package crashed inside `createValidationError` with `Cannot read properties of undefined (reading 'map')` — version 4.x declares peer `zod@^3.14.2` and inspects internal zod 3.x issue shapes that don't exist in zod 4. Plan 01-01 already locked `zod@4.4.3` (RESEARCH §Standard Stack), so version 4.x is structurally incompatible with the workspace's zod pin.
- **Fix:** Bumped `fastify-type-provider-zod` from `4.0.2` → `6.1.0` in `apps/api/package.json`. `npm view fastify-type-provider-zod@6.1.0 peerDependencies` confirms `zod: '>=4.1.5'` — first version with first-class zod@4 support. API surface used (`validatorCompiler`, `serializerCompiler`, `ZodTypeProvider` type) is unchanged between 4.0.2 and 6.1.0. After the bump, all vitest validation tests pass (Zod errors arrive at `setErrorHandler` cleanly, the `errors[]` extension is populated correctly, content-type is `application/problem+json`).
- **Files modified:** `apps/api/package.json`, `pnpm-lock.yaml`.
- **Committed in:** `824bd2c` (Task 3 commit).

**2. [Rule 3 - Blocking] fastify-plugin not in apps/api dependencies**

- **Found during:** Task 1 (plugin files reference `import fp from 'fastify-plugin'`; `pnpm install` then `pnpm typecheck` would have failed if the package wasn't already a transitive dep).
- **Issue:** Plan body assumes `fastify-plugin` is available but never lists it as an explicit dependency. It's a transitive dep of `@fastify/jwt` and `@fastify/rate-limit`, but pnpm's strict mode would not hoist it to a position where `import fp from 'fastify-plugin'` resolves (and even if it did, hidden hoists are fragile across major-version bumps).
- **Fix:** Added `fastify-plugin@5.0.1` (matches the version `@fastify/jwt@10` resolves to) to `apps/api/package.json` dependencies.
- **Files modified:** `apps/api/package.json`, `pnpm-lock.yaml`.
- **Committed in:** `c69be84` (Task 1 commit).

**3. [Rule 1 - Bug] zod plugin had ESLint-flagged empty FastifyInstance interface augmentation + isolatedModules type-export issue**

- **Found during:** Task 1 (first commit attempt failed pre-commit lint).
- **Issue (a):** Plan body had `declare module 'fastify' { interface FastifyInstance {} }` — typescript-eslint flags `no-empty-object-type` for empty interface declarations. The empty augmentation was a no-op anyway.
- **Issue (b):** Plan body had `export { ZodTypeProvider }` — under `isolatedModules: true` (from `tsconfig.base.json`), TypeScript requires `export type { ZodTypeProvider }` for type-only re-exports.
- **Fix:** Removed the empty `FastifyInstance` augmentation (it served no purpose); changed `import { ..., ZodTypeProvider }` → `import { ..., type ZodTypeProvider }` and `export { ZodTypeProvider }` → `export type { ZodTypeProvider }`.
- **Files modified:** `apps/api/src/plugins/zod.ts`.
- **Committed in:** `c69be84` (Task 1 commit).

**4. [Rule 1 - Bug] Auth plugin's `declare module 'fastify' { interface FastifyRequest { user?: JwtPayload } }` collided with @fastify/jwt's own augmentation**

- **Found during:** Task 2 typecheck.
- **Issue:** `@fastify/jwt` declares `FastifyRequest.user: fastifyJwt.UserType` on the same interface. Adding our own `user?: JwtPayload` triggered `TS2687: All declarations of 'user' must have identical modifiers` and `TS2717: Subsequent property declarations must have the same type`.
- **Fix:** Replaced our augmentation with the canonical `@fastify/jwt` extension pattern: `declare module '@fastify/jwt' { interface FastifyJWT { payload: JwtPayload; user: JwtPayload; } }`. This makes `req.user` typed as `JwtPayload` across the entire codebase via @fastify/jwt's own type plumbing — Pattern 15.
- **Files modified:** `apps/api/src/plugins/auth.ts`.
- **Committed in:** `1516fca` (Task 2 commit).

**5. [Rule 1 - Bug] Idempotency global preHandler observed req.user as undefined → persistence path never fired**

- **Found during:** Task 3 vitest run (idempotency conflict test failed: same key + different body returned 200 instead of 409).
- **Issue:** Plan body had the idempotency global preHandler read `(req.user as { sub?: string } | undefined)?.sub` and bail out if undefined, expecting auth to populate it. But Fastify's hook ordering runs `app.addHook('preHandler', ...)` (global) BEFORE route-level preHandlers (where `requireAuth` lives). At the global hook's runtime, `req.user` is always undefined for any request — even authed ones — because the route's `requireAuth` hasn't fired yet. Persistence and conflict detection never ran.
- **Fix:** The idempotency plugin now calls `await req.jwtVerify()` itself (best-effort, swallow failures), which populates `req.user` synchronously on the request. If the token is missing/invalid, the catch swallows it and the plugin falls through; the route's `requireAuth` then fires the standard 401. The (user_id, key) lookup now correctly populates from the JWT subject.
- **Verification:** All 4 idempotency tests pass: missing-key 400, malformed-key 400, replay 200, conflict 409.
- **Files modified:** `apps/api/src/plugins/idempotency.ts`.
- **Committed in:** `824bd2c` (Task 3 commit).

**6. [Rule 1 - Bug] Rate-limit's errorResponseBuilder returning a plain object fell through the catch-all 500 branch**

- **Found during:** Task 2 smoke test (35-burst from same IP returned `500 Internal Server Error` instead of `429 rate-limited`).
- **Issue:** `@fastify/rate-limit` THROWS the return value of `errorResponseBuilder`. Returning a plain `ProblemDetail` object meant the throw landed in `setErrorHandler` as a non-Error value with no `statusCode` and no recognizable shape — the catch-all branch fired (500 internal). The rate-limit problem-detail body was lost.
- **Fix:** `errorResponseBuilder` now returns an `Error` subclass with `.statusCode = 429` and `.problemDetail = <pre-built body>`. The error-handler grew a Pattern 14 short-circuit branch (branch 0, before Zod): if the thrown error has a `problemDetail` field with a `type` URI and a `status` integer, emit it verbatim with that status code. This preserves the `tier: 'anonymous'` + `retryAfterSeconds` extensions on the wire and is reusable by any future plugin that needs to surface a custom problem-detail through the error pipeline.
- **Verification:** Smoke test of 35-burst now returns 7×429 + 28×200, with full problem+json body (correct slug, tier, retryAfterSeconds) and `retry-after: 60` header.
- **Files modified:** `apps/api/src/plugins/rate-limit.ts`, `apps/api/src/plugins/error-handler.ts`.
- **Committed in:** `1516fca` (Task 2 commit, with the smoke fix).

**7. [Rule 3 - Blocking] vitest.config.ts include glob didn't match the plan's test/ directory layout**

- **Found during:** Task 3 (first vitest run found 0 tests).
- **Issue:** vitest.config.ts from plan 01-01 had `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']`. The plan body for 01-04 places test files under `apps/api/test/` (singular, not plural). Vitest didn't pick them up.
- **Fix:** Added `test/**/*.test.ts` to the include array (kept the plural `tests/` path for forward compatibility).
- **Files modified:** `apps/api/vitest.config.ts`.
- **Committed in:** `824bd2c` (Task 3 commit).

### Out-of-scope discovery (deferred-items)

- **`CLAUDE.md` is dirty in `git status`** with the same one-line modification carried over from before plans 01-01 / 01-02 / 01-03 started (already noted in those plans' SUMMARYs). Not in plan 01-04's scope; left untouched. The next plan that explicitly touches CLAUDE.md will pick it up. No `deferred-items.md` entry needed.

## Authentication Gates

None — fully automated. The dev `JWT_SIGNING_SECRET` from plan 01-03's `.env.example` is used for both runtime (server boot) and test (jsonwebtoken signing). No real Google / Play Integrity flow exercised in this plan; that lands in plan 01-05.

## Stub Tracking

- **`CURRENT_TOKEN_VERSION = 1`** is a constant at MVP per `<truths>` in the plan. The cluster-wide kill-switch (D-AUTH-05) becomes config / DB later; bumping it invalidates every outstanding token. Documented in `src/plugins/auth.ts` with the rationale; this is intentional, not a stub.
- **`/auth/google` route + idempotency opt-out** documented in `src/plugins/idempotency.ts` comments — the actual route lands in plan 01-05 with `config: { idempotency: false }`. The plugin already supports the opt-out hook.
- **Authenticated-tier rate-limit** at the per-route level is documented in `src/plugins/rate-limit.ts` comments; routes register it via `config.rateLimit` in plans 05-08. The plugin's anonymous-tier registration is live.

No misleading "coming soon" copy or hardcoded empty data flowing to surfaces. The plugin contract is the contract; routes that consume it land in subsequent plans.

## Threat Flags

No new threat surfaces beyond those enumerated in `<threat_model>` (T-1.4-01..08). All eight threats are mitigated:

- **T-1.4-01 (Authorization header leak)**: `loggerOptions.redact.paths` includes `req.headers.authorization` + `req.headers["x-idempotency-key"]` + `res.headers["set-cookie"]`. Smoke test confirmed: sending `Authorization: Bearer SECRET_TOKEN_DO_NOT_LEAK` produces zero log lines containing `SECRET_TOKEN_DO_NOT_LEAK`. Defense-in-depth: the request serializer doesn't include headers in the log line at all.
- **T-1.4-02 (Idempotency-Key replay with different body)**: `lookup()` compares stored `requestHash` with `hashRequest()` of the new request; mismatch → 409 `idempotency-key-conflict`. Verified by Task 3 test.
- **T-1.4-03 (Forged JWT)**: `@fastify/jwt` HS256 with `JWT_SIGNING_SECRET` from env (Secrets Manager in prod). `requireAuth` rejects unsigned/expired/wrong-algorithm tokens; `token_version >= CURRENT_TOKEN_VERSION` enforces the kill-switch.
- **T-1.4-04 (Per-IP DoS)**: `@fastify/rate-limit` anonymous tier — 30 req/min per IP. 429 + Retry-After. In-process memory at MVP per D-HOST-04 — single replica only. Multi-replica scale-up requires Redis (deferred to Phase 5).
- **T-1.4-05 (Authenticated user saturating anonymous bucket)**: Buckets are SEPARATE — anonymous tier keyed `ip:<ip>`, authenticated tier keyed `user:<sub>` and consumed only on routes that opt in via `config.rateLimit`. Disjoint storage. Verified by inspection of `src/plugins/rate-limit.ts` (Pattern 16); end-to-end test lands with the first authed route in plan 05.
- **T-1.4-06 (Repudiation w/o request id)**: `request-id` plugin mints a 21-char nanoid on every request, echoes back as `x-request-id`, and threads through pino logs. Always present in problem-detail `instance` field.
- **T-1.4-07 (Persisting 5xx responses)**: `if (reply.statusCode >= 500) return payload;` in onSend skips persistence for server errors. Only 2xx/4xx are memoized.
- **T-1.4-08 (Stack trace leak)**: Catch-all branch returns static `detail: 'An unexpected error occurred'`. The actual `err` is logged at ERROR level via `req.log.error({ err })` but never serialized into the response body.

## Issues Encountered

- **fastify-type-provider-zod 4.x ↔ zod@4 incompatibility**: documented as deviation 1. Resolved by bump to 6.1.0.
- **fastify-plugin missing as explicit dep**: documented as deviation 2. Resolved by pinning 5.0.1.
- **Idempotency hook ordering vs requireAuth**: documented as deviation 5. Resolved by best-effort `req.jwtVerify()` in the global preHandler.
- **Rate-limit error-builder return type**: documented as deviation 6. Resolved by returning an Error subclass with `problemDetail` field; error-handler short-circuits.
- **Vitest test/ vs tests/ glob**: documented as deviation 7. Resolved by adding `test/**/*.test.ts` to the include array.
- **No host-side `psql`**: verification of idempotency_keys table state used `docker compose exec -T postgres psql ...` (same DB, different invocation path). Same constraint as plans 01-02 and 01-03.

## User Setup Required

None. Server boots from `JWT_SIGNING_SECRET` + `DATABASE_URL` already in `.env.example` from plan 01-03. Subsequent plans (01-05 onward) consume the same buildApp() factory.

## Next Phase Readiness

- **Ready for plan 01-05** (auth — `/auth/google`) — `app.requireAuth` decorator + `JwtPayload` type + `CURRENT_TOKEN_VERSION` kill-switch in place. The `/auth/google` route registers with `config: { idempotency: false }` (already supported by the idempotency plugin's opt-out hook). Plan 05 also writes the actual JWT-issuance helper that signs with `app.jwt.sign()`.
- **Ready for plan 01-06** (tasks — `/tasks` + `/task-requests`) — `app.withTypeProvider<ZodTypeProvider>()` is wired; routes can declare `schema: { body, response }` and the validator/serializer fires automatically. Problem+json validation errors are pre-formatted.
- **Ready for plan 01-07 / 08** (recordings + uploads) — Idempotency-Key enforcement on POST/PATCH is live; `RecordingCreateSchema` + `RecordingSchema` from plan 01-02 are ready to mount.
- **Ready for plan 01-11** (DSR routes — DELETE /me, POST /me/restore, PATCH /me) — same plugin contract; routes that need auth use `preHandler: [app.requireAuth]`.
- **Ready for plan 01-12** (integration tests) — `buildApp()` is the canonical test seam. Plan 12 reuses the same factory; per-test BEGIN/ROLLBACK isolation works directly against the live DB.
- **No blockers** for any subsequent Phase 1 plan.

## Self-Check: PASSED

All claims verified before writing the SUMMARY.

**Created files exist (verified via `test -f`):**

- `apps/api/src/lib/problem-detail.ts` — FOUND
- `apps/api/src/lib/idempotency-store.ts` — FOUND
- `apps/api/src/plugins/error-handler.ts` — FOUND
- `apps/api/src/plugins/zod.ts` — FOUND
- `apps/api/src/plugins/request-id.ts` — FOUND
- `apps/api/src/plugins/logger.ts` — FOUND
- `apps/api/src/plugins/idempotency.ts` — FOUND
- `apps/api/src/plugins/rate-limit.ts` — FOUND
- `apps/api/src/plugins/auth.ts` — FOUND
- `apps/api/src/routes/healthz.ts` — FOUND
- `apps/api/src/routes/readyz.ts` — FOUND
- `apps/api/src/app.ts` — FOUND
- `apps/api/src/server.ts` — FOUND
- `apps/api/test/routes/health.test.ts` — FOUND
- `apps/api/test/plugins/request-id.test.ts` — FOUND
- `apps/api/test/plugins/error-handler.test.ts` — FOUND
- `apps/api/test/plugins/idempotency.test.ts` — FOUND
- `apps/api/test/plugins/rate-limit.test.ts` — FOUND

**Commits exist (verified via `git log --oneline`):**

- `c69be84` — Task 1 (feat: problem-detail + error handler + zod/request-id/logger plugins)
- `1516fca` — Task 2 (feat: idempotency/rate-limit/auth plugins, health routes, buildApp factory)
- `824bd2c` — Task 3 (test: vitest plugin/route tests + idempotency hook ordering fix)

**Live verification:**

- `pnpm typecheck` exits 0 across the workspace.
- `pnpm build` (`tsc -b`) exits 0 in apps/api.
- `pnpm test` exits 0 in apps/api: 5 test files, 12 tests, all green against live Postgres.
- Smoke against running server: `/healthz` 200 + `x-request-id` header; `/readyz` 200 with status:ready; POST without Idempotency-Key → 400 problem+json with idempotency-key-invalid slug; 35-burst from same IP → 7×429 with retry-after + tier:'anonymous'; pino redact prevents Authorization/Idempotency-Key leak into JSON logs.

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
