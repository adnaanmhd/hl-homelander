---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: 'Phase 2 wave 5 — plan 02-22 complete (CI gates finalized; 02-21 manual-smoke runbook outstanding)'
last_updated: '2026-05-09T15:54:36Z'
last_activity: 2026-05-09
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 35
  completed_plans: 34
  percent: 97
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** On-device capture quality is non-negotiable — every uploaded segment must hit the locked spec (1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms timestamp alignment) or the bytes are worthless for training.
**Current focus:** Phase 02 — mobile-shell-onboarding-permissions-compat-profile

## Current Position

Phase: 02 (mobile-shell-onboarding-permissions-compat-profile) — EXECUTING
Plan: 22 of 22 complete (CI gates finalized); 21 (manual-smoke runbook) outstanding
Status: Ready to execute (next: 02-21)
Last activity: 2026-05-09

Progress: [█████████▉] 97%

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

- Total plans completed: 26
- Average duration: ~10.1 min
- Total execution time: ~2.10 hours

**By Phase:**

| Phase    | Plans  | Total  | Avg/Plan  |
| -------- | ------ | ------ | --------- |
| Phase 01 | 9 / 13 | 94 min | ~10.4 min |
| 1        | 13     | -      | -         |

**Recent Trend:**

- Last 10 plans: 01-01 (7 min, 3 tasks, 22 files), 01-03 (5 min, 3 tasks, 7 files), 01-02 (6 min, 3 tasks + checkpoint, 11 files), 01-04 (9 min, 3 tasks, 18 files), 01-05 (13 min, 4 tasks, 25 files), 01-06 (18 min, 3 tasks, 17 files), 01-07 (12 min, 4 tasks, 17 files), 01-08 (17 min, 3 tasks, 28 files), 01-09 (7 min, 3 tasks, 19 files), 02-17 (12 min, 3 tasks, 8 files), 02-18 (12 min, 4 tasks, 14 files), 02-19 (7 min, 3 tasks, 9 files), 02-20 (8 min, 3 tasks, 12 files), 02-22 (5 min, 4 tasks, 5 files).
- Trend: 02-22 lands at 5 min on 4 tasks — fastest plan in wave 5; 3 deviations auto-fixed (3 Rule 1 — source-of-truth route name `Compat` not plan body's `CompatRunning`, scan-scope widening to include OnboardingStack, JSDoc `*/` comment-close typo). 54 new plan-level vitest cases green (11 permissions + 16 route-registry + 27 no-hex-literals); full mobile suite now 285/285. Phase 2 complete (22/22 plans + 02-21 manual-smoke runbook outstanding for operator).

_Updated after each plan completion_
| Phase 01 P08 | 17 min | 3 tasks | 28 files |
| Phase 1 P9 | 7min | 3 tasks | 19 files |
| Phase 01 P12 | 28min | 3 tasks | 14 files |
| Phase 02 P16 | 25min | - tasks | - files |
| Phase 02 P17 | 12min | 3 tasks | 8 files |
| Phase 02 P18 | 12min | 4 tasks | 14 files |
| Phase 02 P19 | 7min | 3 tasks | 9 files |
| Phase 02 P20 | 8min | 3 tasks | 12 files |
| Phase 02 P22 | 5min | 4 tasks | 5 files |

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
- [Phase ?]: [Phase 2]: Plan 02-16: Vite ?raw import + ambient \*?raw .d.ts pattern for source-grep tests under mobile tsconfig (types:[] + moduleResolution:Bundler) — avoids @types/node bloat just for one structural test. Idiomatic Vitest 4 mechanism.
- [Phase ?]: [Phase 2]: Plan 02-16: TopBar stays prop-driven (onAvatarPress callback) instead of consuming useAppStore.user — appStore has no user field at Phase 2 (lands with /me hookup in plan 02-19); call sites pass () => navigation.navigate('Profile') explicitly so HOME-07 entry path is grep-able at every tab body.
- [Phase ?]: [Phase 2]: Plan 02-16: HOME-07/08 satisfaction is two-tiered — structural (02-05 navigator graph) + gated (02-16 source-grep test reading MainTabs.tsx via Vite ?raw and asserting EXACTLY 3 Tab.Screen elements). T-2.16-01 mitigation: a future fourth-tab violation cannot land silently.
- [Phase ?]: [Phase 2]: Plan 02-17: Idempotency-Key on PATCH /me minted via `react-native-uuid` v4 (NOT `ulid` — the plan body's import is unavailable in the dep tree; UUIDv4 satisfies Phase 1 plan 04's opaque-key contract identically). Reference impl at apps/mobile/src/services/profileService.ts; future PATCH endpoints (Phase 5 /recordings status, etc.) follow the same `uuid.v4() as string` template.
- [Phase ?]: [Phase 2]: Plan 02-17: profileService converts wire-side `durationMs` → consumer-side `totalSeconds` at the service boundary so HOME-06 `formatDuration(seconds)` is the single canonical formatter across Profile + Phase 6 Home tiles. Pattern reusable for any wire ↔ render unit mismatch.
- [Phase ?]: [Phase 2]: Plan 02-17: apiClient extended with `patch<T>` mirroring `post()` (JSON body + AbortController timeout) plus a `get<T>` one-line alias of `getJson<T>` for natural verb-name call sites. Lower-cases extra header names on the wire (matches the existing post() convention).
- [Phase ?]: [Phase 2]: Plan 02-17: When the plan body listed `RootNativeStack.tsx` in `files_modified`, the actual edit was a no-op — plan 02-05 already registered Profile as a RootNativeStack sibling, and the existing `import ProfileScreen` resolves to the new body's default export. Pattern: treat `files_modified` as a permission set, not a mandatory edit list, when the plan acceptance criteria already pass against the unchanged file.
- [Phase ?]: [Phase 2]: Plan 02-17: Manual `cleanup()` in `afterEach` for testing-library/react under vitest `globals: false`. Auto-cleanup hook only fires under `globals: true`; without explicit cleanup, multi-render screen tests hit "Found multiple elements" because the previous render's DOM tree stays mounted. Pattern shared with SignupScreen.test.tsx + RootNativeStack.test.tsx.
- [Phase 2]: Plan 02-18: Build-time markdown→JSON bake (D-HELP-01) — apps/mobile/scripts/build-help-content.mjs parses help-center-content.md into apps/mobile/src/screens/help/content.json with the HELP-01 ordering invariant asserted in main(). Wired via `npm run prebuild` so install/start re-emits the JSON deterministically. Pattern: any future content-as-code surface (e.g., legal copy, onboarding scripts) follows the same MD→JSON build-step shape — no runtime markdown dependency, JSON committed for PR review.
- [Phase 2]: Plan 02-18: Same react-native-uuid (NOT ulid) idempotency pattern as 02-17 reused for POST /feedback Idempotency-Key. The mobile bundle stays single-key-library; Phase 1 plan 01-08 stores idempotency keys raw so the shape is opaque to the backend (UUIDv4 satisfies uniqueness identically). Reference impl at apps/mobile/src/services/feedbackService.ts; this is now the canonical pattern for any mobile-side idempotent POST/PATCH.
- [Phase 2]: Plan 02-18: apiClient.postMultipart added — the multipart-form-data sibling of post/patch. Critical: does NOT set Content-Type. fetch derives the boundary from the FormData instance; manually setting content-type would strip the boundary parameter and @fastify/multipart would reject the body. Idempotency-Key forwarded per-request; future endpoints shipping file blobs (consent receipts, DSR exports, support attachments) reuse this wrapper.
- [Phase 2]: Plan 02-18: HelpCenterScreen exports BOTH named and default — RootNativeStack imports the default. Replacing the stub with a named-only export would force a navigator edit that plan 02-19 also touches; dual-export keeps the merge surface clean. Pattern reusable when a screen swaps its body inside a phase that another plan in the same phase also touches the navigator.
- [Phase 2]: Plan 02-18: Diagnostic-snapshot pattern (D-HELP-02) — buildDiagnosticSnapshot() composes `{ appVersion, buildIdentifier, osVersion, deviceModel, telemetryRing }` from AppFlavor native module + telemetryRing.snapshot(). Reusable for any future "report a problem" surface (Phase 5 upload-failure reports, Phase 7 iOS App Store crash dialogs). Per RESEARCH § Security pattern row 8: telemetryRing entries pre-filtered at append time (engineering-handoff §11) — no PII reaches the snapshot.
- [Phase 2]: Plan 02-19: Device-bound vs user-bound MMKV-key contract (Pattern 48) — auth.signOut clears auth.jwt.v1 + onboarding.\* (consent / permsGranted / compatPassed / tutorialDone) but explicitly preserves compat.lastResult.v1 + installation_id.v1 + telemetry.ring.v1 + appVersion.cache.v1. Rationale: compat signature embeds installation_id (device-bound); same-device re-login should NOT have to re-run the 30-second compat probe. Future onboarding/auth keys must declare which side of this contract they fall on; the inline doc-comment in auth.ts is the canonical source.
- [Phase 2]: Plan 02-19: vi.hoisted spy binding pattern (Pattern 47) — vi.mock factories are hoisted above all imports; closures over `const fn = vi.fn()` declarations race the hoist and crash with TDZ. Wrapping spies in `vi.hoisted({ ... })` puts them in the same hoist-scope as the factory body. Used by LogoutModal.test.tsx and DeleteAccountModal.test.tsx; reusable for any future component test that mocks @react-navigation/native + a service module + react-native at once. (Older tests in **tests**/components/ that did NOT need this pattern: Modal-less components whose factories don't reference test-file-scope spies.)
- [Phase 2]: Plan 02-19: apiClient.delete added as third HTTP-verb wrapper alongside `patch` and `postMultipart` — same lower-cased-on-the-wire header forwarding, same AbortController timeout, same RFC 7807 error-message synthesis, same try-parse-then-undefined-fallback for empty responses. Reusable for any future client-issued DELETE (Phase 5 cancel-recording, Phase 6 dismiss-feedback, etc.).
- [Phase 2]: Plan 02-19: presentation: 'transparentModal' (NOT 'modal') for both Logout/Delete modals so the underlying Profile screen stays visible behind the 50% scrim, matching design-spec §18 modal-card pattern. ForceUpgrade keeps presentation: 'modal' because it's a full-screen takeover; logout/delete are dismissible confirmations. New rule for Phase 2/5+ confirmations: use transparentModal when the user can dismiss + return to the underlying screen; use modal when the takeover blocks the underlying surface entirely.
- [Phase 2]: Plan 02-19: AUTH-10 typing-gate uses defense-in-depth — Confirm button rendered `disabled` when typed !== 'DELETE' AND the onPress handler short-circuits via the same equality check + Alert. Backend Phase 1 plan 01-08's MeDeleteQuerySchema is the authoritative gate. Pattern: any client-side input gate that protects a destructive action MUST have both layers (UI rendering + handler short-circuit) AND the backend authoritative check; the client gate is UX, the backend is binding (per RESEARCH § Security threat row 5).
- [Phase 2]: Plan 02-20: Pattern 49 — discriminated-union dispatch in service-level upgrade flows. `upgradeFlow.startUpgrade(payload)` narrows on `payload.flavor` (apkRollout / playStore / iosAppStore) and routes to the matching install path inside ONE function, so both ForceUpgradeScreen AND SoftUpgradeBanner reuse identical per-flavor logic without duplicating the dispatch table. Future per-flavor service surfaces (Phase 7 iOS App Store opens, Phase 5 OEM-specific battery deep-links) follow the same shape.
- [Phase 2]: Plan 02-20: Pattern 50 — catastrophic-event defense-in-depth via try/catch + structural gate. The Kotlin-side SHA-256 verification (plan 02-07) is authoritative; the JS upgradeFlow MUST never call launchInstaller after a hash-mismatch rejection. The structural gate is the function shape: try-block awaits downloadAndVerifyApk; on success captures `path`; calls launchInstaller(path) AFTER the try-block. There is no syntactic path through which a mismatched APK reaches PackageInstaller (T-2.20-01 mitigation). Catastrophic Analytics events emit DISTINCTLY from generic-failure events for triage granularity.
- [Phase 2]: Plan 02-20: Pattern 51 — per-keying-field dismiss key auto-resets when the keying field advances. SoftUpgradeBanner's MMKV key `appVersion.softBannerDismissed.{latest}` (via `softBannerDismissKey()` helper from Phase 1 state/keys.ts) means dismissals at latest=0.2.0 stick across cold-starts on the same `latest` but evaporate when versionService observes a new `latest` (T-2.20-04 mitigation; SoftUpgradeBanner.test.tsx covers the latest-bump → re-render path explicitly). Reusable for any future per-release nag-banner.
- [Phase 2]: Plan 02-20: Pattern 52 — vitest 'react-native' per-test mock that replicates host-component shapes inline. `vi.importActual('react-native')` trips on `import typeof * as ReactNativePublicAPI from "...flow"` in the real react-native index.js (Vite's esbuild transform can't parse Flow's `import typeof`). Per-test mocks that need host components AND module-level spies (Alert, BackHandler, etc.) must replicate the host-component shapes inline rather than spreading the actual module. Documented in ForceUpgradeScreen.test.tsx — copy-paste reusable for any future screen test that depends on RN system modules.
- [Phase 2]: Plan 02-20: Plan body's `upgrade/` path swap rejected — kept the existing `apps/mobile/src/screens/force-upgrade/` path from the 02-08 stub because RootNativeStack already imports from there and changing the path would have forced a navigator edit unrelated to UPG-03/UPG-04 closure. accessibilityLabel updated from PascalCase 'ForceUpgrade screen' to kebab-case 'force-upgrade-screen' to match the screen-test naming pattern (HelpCenter / Compat / Permissions / Profile all use kebab-case). Pattern: when a plan body lists a path that doesn't match the existing scaffold, prefer the scaffold and treat the plan-body path as a soft suggestion — the navigator is the structural source of truth.
- [Phase 2]: Plan 02-22: Pattern 53 — defense-in-depth manifest gates. Static vitest grep (apps/mobile/**tests**/manifests/permissions.test.ts) runs in <300 ms on every PR via the existing lint-typecheck-test job; dynamic Gradle merged-manifest shell script (apps/mobile/scripts/verify-merged-manifests.sh) runs in the android-build job after assembleApkRolloutDebug. Both must agree; the static gate fails fast on source-manifest deletions, the dynamic gate catches manifest-merger artifacts (per-flavor overlays, sdk-injection, library-aar permissions). Reusable for any future manifest-level invariant.
- [Phase 2]: Plan 02-22: Pattern 54 — navigator route-registry invariant via union-grep across the locked navigator pair (RootNativeStack.tsx + OnboardingStack.tsx). Single source of truth for D-NAV-02 'every navigate() target must be registered'. Future phases adding a screen MUST update REQUIRED_PHASE_2_ROUTES (or the Phase 4/6 successor list); the phase-3+ early-warning guard prevents an accidental commit ahead of its plan. Used registered name `Compat` (not the screen-module `CompatRunningScreen`) — navigator route names are the source of truth.
- [Phase 2]: Plan 02-22: Pattern 55 — phase-wide token-discipline gate (apps/mobile/**tests**/ui/no-hex-literals.test.ts). Generated as a per-file matrix of vitest cases (one `it()` per .ts/.tsx file under src/screens + src/components) so a regression PR gets file-named output. Excludes ui/primitives/_ + ui/tokens.ts + _.test.\* by construction. Matches the 02-02 primitives-only gate at the phase level (D-UI-01 / D-UI-02). Reusable in Phase 4/6 by extending the SCREENS_DIR / COMPONENTS_DIR scope.
- [Phase 2]: Plan 02-22: Crashlytics gate framing — `assert_crashlytics_not_disabled()` checks for explicit `android:value="false"` on firebase_crashlytics_collection_enabled meta-data; default-true and explicit-true both pass. Firebase SDK defaults the meta-data to true when absent, so the check only fails on an accidental opt-out commit. T-2.22-03 (build-flavor + signing-key gated; accept-disposition) is partially mitigated by the static check.

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

Last session: 2026-05-09T15:54:36Z
Stopped at: Phase 2 wave 5 — plan 02-22 complete (CI gates finalized; 02-21 manual-smoke runbook outstanding)

- 01-10 (terraform apply): Tasks 1+2+3 complete + committed (430e17a, 9e52db8, ad93d17). Operator runs `terraform fmt -check` + `terraform validate` + `terraform plan` + `terraform apply` against real AWS staging.
- 01-11 (counsel engagement): code-ready-counsel-deferred. Three commits ship the canonical consent text + boot-time hash guard, takedown SOP runbook, dsr-export CLI, and counsel-engagement checklist. Real attorney review queued for legal-ops backlog.
- 01-13 (mobile sign-in scaffold): code-ready-smoke-deferred. Five commits (d56abda, 25bca88, 9ed7da1, e42312d, 561314e) ship the RN scaffold + PlayIntegrity module + auth orchestration + SignIn screen + vitest tests + manual-smoke runbook. Operator runs the on-device smoke from `13-MANUAL-SMOKE.md` on a real Pixel 7a-class device with both flavors built and installed.
  Plan-counter intentionally NOT advanced (still 9/13) — orchestrator will advance after each respective "approved" gate.
  Resume files:

- .planning/phases/01-foundation-backend-distribution-recon/01-10-SUMMARY.md (terraform apply gate)
- .planning/phases/01-foundation-backend-distribution-recon/01-11-SUMMARY.md (counsel gate)
- .planning/phases/01-foundation-backend-distribution-recon/01-13-SUMMARY.md + 13-MANUAL-SMOKE.md (on-device smoke gate)
