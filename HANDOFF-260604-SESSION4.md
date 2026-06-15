# Handoff — Session 4 (2026-06-04) — Bug 8 ✅ + Bug 3 ✅ done; Bug 4 mid-edit (API RED)

Resume doc for the **fifth** execution session of `IMPLEMENTATION-PLAN-260604.md`.
Read the prior handoffs for full context — this doc records **what Session 4
finished, the in-flight Bug 4 state, and the exact next edits**:

1. `HANDOFF-260604-SESSION3.md` — session-3 doc (Bug 8 design — now DONE).
2. `HANDOFF-260604-SESSION2.md` / `HANDOFF-260604.md` — env, /tmp scripts, decisions.
3. `IMPLEMENTATION-PLAN-260604.md` — source-of-truth plan (11 bugs + 3 enh, D1–D8, §6, §7).
4. `.planning/260604-locked-override-signoff.md` — owner sign-off (D1/D2/D3/D6 APPROVED).
5. `.planning/260604-bug3-precise-location-consent-dpia.md` — **Bug 3 consent/DPIA SHIP GATE** (NEW).
6. `CLAUDE.md` — project constraints.

> **GSD is bypassed.** Owner authorized editing the repo directly. Do NOT invoke GSD.
> **Working branch:** `fix/bugs-enhancements-260604`. **Nothing committed.** Commit/push
> ONLY when the owner asks.

---

## 0. ⚠ TREE IS NOT FULLY GREEN — Bug 4 backend is mid-edit

- **Bug 8 + Bug 3 = ✅ green** (were fully verified before Bug 4 started).
- **Bug 4 backend SOURCE is written but the API suite is RED** because:
  - `shared/types` is **NOT rebuilt** after the `auth.ts` edit → `apps/api` **tsc fails**
    (`body.installationId` unresolved against the stale dist).
  - **Migration `0014` is NOT applied.**
  - **~20 API test `tok()` helpers + user seeds lack `installationId` /
    `currentInstallationId`** → every authed test now 401s.
  - **Client side (auth.ts body + 401-eviction UX) NOT started.**
- **DO §3 FIRST to get back to green** before touching anything else.

### Verify loop (unchanged)

| What             | Command                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile typecheck | `cd apps/mobile && npx tsc --noEmit`                                                                                                                                                        |
| Mobile tests     | `cd apps/mobile && node_modules/.bin/vitest run [path]`                                                                                                                                     |
| API typecheck    | `cd apps/api && npx tsc --noEmit`                                                                                                                                                           |
| API tests        | `zsh /tmp/runapi.sh [path]`                                                                                                                                                                 |
| Kotlin tests     | `zsh /tmp/runkt.sh` (whole `:app:testApkRolloutDebugUnitTest`)                                                                                                                              |
| Kotlin compile   | `cd apps/mobile/android && ANDROID_HOME="$HOME/Library/Android/sdk" JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" ./gradlew :app:compileApkRolloutDebugKotlin` |
| Apply migrations | `cd apps/api && DATABASE_URL='postgres://humyn:humyn@localhost:5432/humyn_dev' AWS_REGION='ap-south-1' npx tsx scripts/migrate.ts`                                                          |

`/tmp/runapi.sh` + `/tmp/runkt.sh` exist (contents in `HANDOFF-260604.md` §6). Docker up
(postgres/redis/localstack healthy; redis unused). **Rebuild `shared/types`
(`cd shared/types && npm run build`) after ANY edit there** — the Bug 4 `auth.ts`
edit is currently UN-rebuilt.

### Gotchas (carried + new)

- **`shared/types` build uses `nodenext`** → relative imports need a `.js` extension
  (`from './recording.js'`, not `'./recording'`). Cost a build failure this session.
- **`; echo "EXIT=$?"` masks the real bg exit code** — run gradle/vitest WITHOUT a trailing
  echo, or grep the log for `BUILD SUCCESSFUL` / `Tests N failed`.
- **Stale `idempotency_keys`** 409s — `docker exec humyn-postgres psql -U humyn -d humyn_dev -c "TRUNCATE idempotency_keys;"`.
- **zsh `grep --include=*.kt` fails** — use `grep -rn PATTERN dir | grep '\.kt:'`.
- **Edit tool needs a fresh `Read`** after a `sed`/`bash` edit of a file.
- **`cd apps/api` then a "mobile" command runs in the WRONG dir** — cwd persists between Bash calls. Always `cd` to the right app.
- **ffmpeg IS installed** (`/opt/homebrew/bin/ffmpeg`) for the Bug 6 thumbnail e2e test.
- **API tests mint JWTs inline per-file** (no shared helper) — each `tok()` builds the
  claim object directly + seeds its user inline. Bug 4 makes both need `installationId`.

---

## 1. Status — all 14 items

| #   | Item                              | Phase | Status                                                      |
| --- | --------------------------------- | ----- | ----------------------------------------------------------- |
| 1   | Bug 1 delete-415                  | 0     | ✅ done (S1)                                                |
| 2   | Bug 2 preview                     | 0     | ✅ done (S1)                                                |
| 3   | Bug 9 task mislabel               | 0     | ✅ done (S1)                                                |
| 4   | Enh 2 dev task                    | 0     | ✅ done (S1)                                                |
| 5   | Enh 3 remove verify+hashing (D1)  | 1     | ✅ done (S3)                                                |
| 6   | Bug 6 thumbnails (D5)             | 2     | ✅ done (S3)                                                |
| 7   | **Bug 8 + Enh 1** 3-min gate (D6) | 3     | ✅ **done (S4) — all green**                                |
| 8   | **Bug 3** location (D3/D4) 🔴     | 3     | ✅ **code done (S4) — green; consent/DPIA ship-gate doc'd** |
| 9   | **Bug 4** multi-device (D2) 🔴    | 4     | 🟡 **backend source done — API RED; §3**                    |
| 10  | Bug 5 practice-done (D7)          | 4     | ⬜ not started                                              |
| 11  | Bug 7 History live                | 5     | ⬜ not started                                              |
| 12  | Bug 11 stats auto-update          | 5     | ⬜ not started                                              |
| 13  | Bug 10 Profile slow               | 5     | ⬜ not started                                              |
| 14  | Spec/doc updates (plan §8)        | —     | ⬜ deferred non-code (now incl. D2 + D3 consent gate)       |

**Green baselines (Bug 8 + Bug 3, end-of-work before Bug 4):** Kotlin BUILD SUCCESSFUL ·
API 36 files / 177 tests · Mobile 145 files / 1026 tests · all tsc clean. **Bug 4's
backend edits have since broken the API suite — see §0/§3.**

---

## 2. What Session 4 finished

### Bug 8 + Enh 1 — 3-min minimum (D6) ✅

Per plan §Bug8. Native `FinalizeWorker.kt`: `MIN_SEGMENT_MS=180_000.0` const +
`CancelReason.TooShort` (`code="too_short"`) + `decideCancelReason` gained
`durationMs: Double = Double.MAX_VALUE, isPractice: Boolean = false` params (defaults keep
the orthogonal fps/res tests green) with the gate `if (!isPractice && durationMs < MIN_SEGMENT_MS) return TooShort`
ordered **after InsufficientFrames, before FpsDropped**; call site computes `gateDurationMs`

- threads `seg.sidecar.isPractice`; `emitCanceled` TooShort branch (null meanFps/width/height).
  +7 gate tests (H–M + bridge-code). TS: `'too_short'` in `SegmentCancelReason` /
  `HistoryRow.cancel.reason` / `thumbnailLedger.cancel.reason`; `cancelReasonLabel` →
  "Canceled — recording too short"; `RecordingScreen` post-stop routing `60_000 → 180_000`
- stale `≥60s`/`<60s` comments swept to `3min`; `StopConfirmModal` "under 1 minute" →
  "under 3 minutes" (owner-deviation note). i18n `recording.toasts.tooShort` already
  "Recording too short — discarded." (threshold-agnostic — NO change). RN tests: new
  2-min-band discard test, bumped the ≥-threshold test to 200_000, HistoryRow Test C2,
  HumynCapture too_short payload test.

### Bug 3 — precise location (D3/D4) ✅ code-complete (ship-gated)

Metadata schema **1.4.0 → 1.5.0**; `capture_device_info.location` string → object
`{lat,lng,accuracy_m,provider,captured_at,label}` (or null). Files: NEW
`capture/LocationFix.kt` (shared `LocationFix` + `LocationJson`, mirrors CameraCalibration);
`CaptureSessionOptsBridge.kt` (field + `parseLocation`); `SidecarManager.kt`,
`MetadataComposer.kt` (schema bump + nested-object emit), `CaptureSession.kt`/`FinalizeWorker.kt`
pass-through; `UploadCoordinator.postInit` reads `capture_device_info.location` → `/init` body.
NEW `HumynLocationModule.kt` + `HumynLocationPackage.kt` (FusedLocationProvider
`getCurrentLocation(PRIORITY_HIGH_ACCURACY)` + Geocoder label) + `MainApplication` reg +
`build.gradle` `play-services-location:21.3.0`. NEW `src/native/HumynLocation.ts`;
`RecordingScreen` resolves at mount (non-practice) → `locationFixRef` → `buildCaptureOpts`.
`PermissionsScreen` gains FINE in the gate (D4, COARSE-fallback for "Approximate"); `PermsState.location`

- `initialRoute` gate + analytics events. Manifest FINE declared + `verify-merged-manifests.sh`
  ban lifted + manifest tests inverted. Backend: `recordings.location jsonb` (**migration 0013 —
  APPLIED**) + `LocationSchema` on `/init` + persisted. Deleted dead `services/locationPermission.ts`
- test. Conformance test → `video_metadata_v1_5_0_template.json` + null/label-null tests.

> **Bug 3 SHIP GATE:** the app captures precise GPS but the consent string still says
> "approximate". Per sign-off D3 + the `TermsOfUseModal` "DO NOT EDIT without bumping the
> consent version" guardrail, the consent text was **NOT silently edited** — the drafted
> change + apply-together checklist (incl. backend consent-version bump + DPIA) live in
> `.planning/260604-bug3-precise-location-consent-dpia.md`. **Precise location must not SHIP
> until that review lands.**

---

## 3. NEXT: finish Bug 4 — multi-device newest-wins (D2) ← DO THIS FIRST

**Backend SOURCE is done** (files below). The remaining work is: rebuild types, apply
migration, fix the test fixtures, add the eviction test, then the client. Order matters —
do 3a→3b→3c→3d.

### Bug 4 design (LOCKED this session — match it)

- Account binds to the most-recent device. `/auth/google` writes `body.installationId` onto
  `users.current_installation_id` (last-writer-wins) on BOTH insert + update, invalidates the
  LRU cache, and mints a JWT carrying `installationId`.
- `requireAuth` (after the token_version check) calls `getCurrentInstallationId(sub)`
  (LRU-cached, 60 s TTL, `installation-binding.ts`) and **401s with slug `device-evicted`
  unless the JWT's `installationId` is present AND equals the row's binding.**
- **Transition = STRICT:** a legacy (pre-Bug-4) JWT lacks the claim → 401 → one-time
  re-sign-in. No gap where a legacy session escapes newest-wins. (Document in the D2 decision
  record — plan §8.)

### 3a. Backend source — ✅ ALREADY WRITTEN (verify, don't rewrite)

- `shared/types/src/auth.ts` — `installationId: z.string().min(1).max(128)` on `AuthGoogleRequestSchema`.
- `apps/api/src/auth/jwt-mint.ts` — `MintJwtOpts.installationId` + signed into the claim.
- `apps/api/src/db/schema.ts` — `users.currentInstallationId: text('current_installation_id')` (nullable).
- `apps/api/src/db/migrations/0014_add_user_installation.sql` — NEW (NOT applied yet).
- `apps/api/src/lib/problem-detail.ts` — `deviceEvicted: 'device-evicted'` slug.
- `apps/api/src/auth/installation-binding.ts` — NEW: LRU `installationCache` +
  `getCurrentInstallationId(sub)` (caches `''` for missing/NULL) + `invalidateInstallation(sub)`
  - `_clearInstallationCache()` (test-only).
- `apps/api/src/plugins/auth.ts` — `JwtPayload.installationId?` + the requireAuth 401 check.
- `apps/api/src/routes/auth/google.ts` — `currentInstallationId: body.installationId` on
  insert+update; `invalidateInstallation(userRecord.user.id)`; `installationId` → `mintJwt`.

### 3b. Make the backend GREEN (the actual remaining work)

1. **Rebuild types:** `cd shared/types && npm run build`.
2. **Apply migration:** `cd apps/api && DATABASE_URL='postgres://humyn:humyn@localhost:5432/humyn_dev' AWS_REGION='ap-south-1' npx tsx scripts/migrate.ts` (expect `0014 applied`).
3. **Fix ~20 API test files** — each has an inline `tok()` (mints the JWT claim) + an inline
   `db.insert(schema.users).values({...})`. For EACH file:
   - add `installationId: '<TEST_INSTALL>'` to the `tok()` claim object (next to `token_version: 1`),
   - add `currentInstallationId: '<TEST_INSTALL>'` to the user seed `.values({...})`,
   - **same string both places**, e.g. `'inst-test'`. (Per-file user/sub differ; the value just
     has to match within a file.)
     Files (from this session's grep of `token_version: 1` + `db.insert(schema.users)`):
     `test/plugins/idempotency.test.ts`, `test/e2e/helpers/seed-fixtures.ts`,
     `test/routes/recordings-reject.test.ts`, `test/routes/contributions.test.ts`,
     `test/routes/events.test.ts`, `test/routes/tasks-create-request.test.ts`,
     `test/routes/recordings-init.test.ts`, `test/routes/recordings-thumbnail.test.ts`,
     `test/routes/recordings-finalize.test.ts`, `test/routes/me-get-patch.test.ts`,
     `test/routes/recordings-stream-url.test.ts`, `test/routes/feedback.test.ts`,
     `test/routes/contributions-timeseries.test.ts`, `test/routes/recordings-list.test.ts`,
     `test/routes/me-delete-restore.test.ts`, `test/routes/recordings-complete-part.test.ts`,
     `test/routes/recordings-get.test.ts`, `test/routes/recordings/parts.test.ts`,
     `test/routes/recordings/init.test.ts`, plus any e2e (`test/e2e/*`) that seed a user + mint a token.
   - ⚠ The LRU cache is a module singleton; vitest isolates files in workers so per-file it's
     fine. If ANY single test re-binds a user mid-file, call `_clearInstallationCache()` in its
     `beforeEach`. The existing tests use one stable binding per file → no clearing needed.
4. **Update `test/routes/auth/google.test.ts`** — add `installationId` to every request body;
   assert the minted JWT carries it + `users.current_installation_id` is set. **Add the D2
   eviction test:** device A signs in (installationId A) → device B signs in (installationId B,
   same googleSub) → an authed call with A's JWT returns **401 + slug `device-evicted`**; B's
   JWT works. (Use a real authed route like `GET /me` for the post-eviction call. `BYPASS_AUTH`
   mocks the google+integrity tokens — see how google.test.ts already drives sign-in.)
5. Verify: `cd apps/api && npx tsc --noEmit && zsh /tmp/runapi.sh` until green.

### 3c. Client (mobile)

6. `apps/mobile/src/services/auth.ts` — `import { getInstallationId } from './installationId';`
   and add `installationId: await getInstallationId(),` to the `/auth/google` POST body
   (the object at `apiClient.post('/auth/google', {...})`, ~L139).
7. **401-eviction UX (D2 default):** when an authed response is 401 with problem slug
   `device-evicted`, clear the JWT (the existing `signOut()` / `appStore.jwt = null` path) and
   surface a "Signed out — your account was used on another device" message on the Signup
   screen. Find the 401-handling seam in `services/api.ts` (look for existing 401 → signOut
   logic; the app already routes to Signup when `jwt` flips null). Plumb the eviction reason to
   the Signup copy (a one-shot store flag, or reuse an existing toast/message channel).
8. Mobile tests: client sends `installationId`; a `device-evicted` 401 → signOut + Signup msg.
9. Verify: `cd apps/mobile && npx tsc --noEmit && node_modules/.bin/vitest run`.

### 3d. Decision record

Add the D2 decision record (overrides LOCKED `D-AUTH-03`) — note the STRICT transition
(legacy JWTs forced to re-sign-in once). Track under plan §8 / `deferred-decisions.md` +
a `CLAUDE.md` auth-constraint banner. (Non-code; can batch with Task #14.)

---

## 4. Then: remaining phases (IMPLEMENTATION-PLAN §7 order)

- **Phase 4 cont. — Bug 5 (practice-done, D7):** `users.practice_completed_at` + migration +
  `POST /me/practice-complete` (idempotent) + `/me` field + `PracticeCompleteScreen` write +
  local seed so `computeInitialRoute` skips the tutorial on fresh install/new device. (Compat
  gate still re-runs.) Files in plan §Bug5.
- **Phase 5 — Bug 7 / Bug 11 / Bug 10:** single app-lifetime upload-queue store slice in
  `appStore` (+ one boot subscription) feeding History/Home/PendingUploads selectors +
  `contributionsVersion` counter; Profile `Promise.allSettled` + render-off-`/me` + loading
  deadline + focus refetch + `api.ts` AbortController; backend `recordings_user_qa_idx` covering
  index + pg pool `connectionTimeoutMillis`/`statement_timeout` + concurrent `/contributions`
  queries. Full detail plan §Bug7/§Bug11/§Bug10.
- **Task #14 — spec/doc sweep (plan §8):** D1 (UPLOAD-PIPELINE/DATA-MODEL/CLAUDE/REQUIREMENTS/
  ROADMAP), D2 (D-AUTH-03 record + CLAUDE + deferred-decisions), D3 (the consent/DPIA gate doc's
  checklist — owner/legal driven), D6 (StopConfirmModal/design-spec/engineering-handoff/
  REQUIREMENTS/CLAUDE banner).

---

## 5. LOCKED decisions to keep consistent

- **Metadata schema = 1.5.0** (Bug 3, current). **Migration high-water: 0014** (0013 applied;
  0014 NOT yet applied).
- **Bug 4:** strict newest-wins; `device-evicted` 401 slug; LRU-cached `sub →
current_installation_id` (60 s TTL, the KEPT `lru-cache@11` dep, `LRUCache` named import);
  invalidate on sign-in; legacy JWTs forced to re-sign-in.
- **Bug 3 consent/DPIA** = SHIP GATE — do NOT edit the consent strings without the
  consent-version bump (see the gate doc).
- **Bug 8/D6:** 3-min per-segment floor; non-practice only; drop the trailing <3-min segment.
- `uploaded` = terminal success (Enh 3). KEEP `lru-cache` (now USED by Bug 4) +
  `AppFlavorModule.sha256First16Hex`.

---

## 6. Files changed this session (git, branch `fix/bugs-enhancements-260604`, nothing committed)

NEW (untracked): `apps/api/src/auth/installation-binding.ts`,
`apps/api/src/db/migrations/0013_*.sql` + `0014_*.sql`,
`apps/mobile/.../capture/{HumynLocationModule,HumynLocationPackage,capture/LocationFix}.kt`,
`apps/mobile/.../test/resources/video_metadata_v1_5_0_template.json`,
`apps/mobile/src/native/HumynLocation.ts`, `.planning/260604-bug3-precise-location-consent-dpia.md`.
DELETED: `apps/mobile/src/services/locationPermission.ts` + its test.
MODIFIED: see `git status` — ~50 files across Bug 8 (FinalizeWorker + RN), Bug 3 (Kotlin
capture chain + TS + backend init/schema + manifest/CI), Bug 4 (auth chain: shared/types
auth, jwt-mint, schema, problem-detail, plugins/auth, routes/auth/google).
