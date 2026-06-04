# Implementation Plan — Bug Fixes + Enhancements (2026-06-04)

> **Status:** Draft for owner review → route execution through GSD (`/gsd-execute-phase` per phase, `/gsd-quick` for the isolated fixes).
> **Author:** Engineering (post-codebase audit + owner Q&A).
> **Scope:** 11 reported bugs + 3 enhancements across `apps/mobile` (RN 0.83 + Kotlin native) and `apps/api` (Fastify + Postgres/Drizzle + S3).
> **Method:** Each item below has a verified root cause (with `file:line`), the chosen fix (per the owner decisions in §1), the exact files to touch, risk, and tests. §7 gives a dependency-ordered phase plan.

---

## 0. How to read this document

- **§1 — Decisions & authorized spec overrides.** Read first. Three of these override LOCKED constraints and need a written owner sign-off + spec-doc edits (tracked in §8).
- **§2–§5 — Per-item specs**, grouped: Quick fixes, Capture pipeline, Auth/Account, Read-path/Reactivity, Removals.
- **§6 — Schema & migration summary** (single source of truth for DB changes).
- **§7 — Phased rollout** with the dependency graph.
- **§8 — Spec/doc updates required.**
- **§9 — Risk register.** **§10 — Test & verification plan.**

Legend: 🟢 isolated/low-risk · 🟡 moderate, touches shared state · 🔴 high blast-radius / overrides a LOCKED constraint.

---

## 1. Decisions & authorized spec overrides (from owner Q&A)

| # | Topic | Decision | Consequence |
|---|---|---|---|
| D1 | **Hashing (Enh 3)** | **Remove ALL hashing** — server verification *and* the device-side SHA-256 of video+IMU. `metadata.json` drops `file_sha256`/`imu_sha256`; `/recordings/init` no longer accepts them. | Native `HashStreamer` deleted; metadata schema bump. ⚠ The compat-signature `AppFlavorModule.sha256First16Hex` is **unrelated** (device fingerprint) — **KEEP it.** |
| D2 | **Multi-device (Bug 4)** 🔴 | **Newest-login-wins.** Account binds to the most recent device; the prior device is force-logged-out on its next request. | **Overrides LOCKED `D-AUTH-03`** (stateless 30-day JWT, no denylist). Auth becomes stateful (one cached user lookup per request). |
| D3 | **Location format (Bug 3)** 🔴 | **Precise lat/lng coordinates.** | **Overrides LOCKED coarse-only constraint** ("no precise GPS leaves the device"). Requires `ACCESS_FINE_LOCATION` in the manifest, removing the CI gate that forbids it, a metadata schema change, **and a consent-text update** (`idea-brief.md §5.2`). |
| D4 | **Location permission (Bug 3)** | **Gate in onboarding `PermissionsScreen` alongside Camera + Mic. If denied, user cannot proceed** (identical UX to camera/mic). | Permission moves out of "before first recording" into onboarding; recording is impossible without it, so capture always has a fix to embed. |
| D5 | **Thumbnails (Bug 6)** | **Backend generates a poster JPEG at finalize**, stored in S3, served as a signed URL. Client falls back to it when no local thumbnail exists. | Since the verify worker is being removed (D1/Enh 3), generate **synchronously in the `/recordings/finalize` handler** (or a tiny inline job). Adds an `s3_key_thumbnail` column + ffmpeg dependency on the API. |
| D6 | **Min duration (Bug 8 + Enh 1)** | **3-minute minimum.** Mirror today's sub-1-min UX: **drop any segment < 3 min** (never uploads), and when a recording is < 3 min show **"Recording too short — discarded."** No progress-bar rescale. | Threshold `60_000 → 180_000`. Adds a real enforcement gate (none exists today — that's Bug 8). |
| D7 | **Practice (Bug 5)** | **Marked done server-side on flow completion** (reaching `PracticeComplete`). Skipped on all future devices/reinstalls forever. | Adds `users.practice_completed_at` + `/me` field + a write call. Doesn't depend on the practice clip uploading. |
| D8 | **Dev task (Enh 2)** | **Remove the task AND the `__DEV__` long-press shortcut entirely.** | Guarded migration purges the row; client affordance deleted. |

**Default decisions I made for under-specified details (call out if you disagree):**
- **D2 eviction UX:** evicted device gets a friendly "Signed out — your account was used on another device" message on the Signup screen (not a silent 401).
- **D3 partial grant:** on Android 12+ the user can grant "Approximate" instead of "Precise." We request FINE; if only COARSE is granted we still record (coarser fix) rather than block — only a *full* denial blocks (matches D4 camera/mic parity). We embed whatever accuracy we get plus an `accuracy_m` field. *(Flag if you want to hard-require precise.)*
- **D3 schema shape:** `location` becomes an object `{ lat, lng, accuracy_m, provider, captured_at, label }` where `label` is the optional reverse-geocoded "City, Country" for human readability. Metadata schema `1.3.0 → 1.4.0`.
- **D5 thumbnail privacy:** the poster is a derived frame of egocentric footage → it inherits the recording's lifecycle (takedown/archive). Stored under `recordings/{userId}/{recordingId}/thumb.jpg`.
- **D6 trailing-segment drop:** a ≥3-min recording that auto-segments (10-min cap) and produces a trailing segment < 3 min will **drop that trailing segment** per "drop segments < 3 min." This discards tail data — *confirm acceptable*; alternative is "min applies to the whole recording, not each segment."
- **Bug 7 granularity:** History shows a row once a segment is **finalized/enqueued** (the artifact exists), live through every upload state + canceled rows — not while the camera is still rolling.
- **Bug 11 counting moment:** contribution time/task count reflect a recording as soon as its row exists server-side (at `/recordings/init`), refreshed live in the UI.
- **Enh 3 legacy data:** `uploaded` becomes the terminal-success state; any pre-existing `verified` rows are treated as a success synonym in read paths (no destructive backfill required).

---

## 2. Quick fixes (isolated, low-risk) — 🟢

### Bug 1 — Delete account returns HTTP 415
**Root cause.** `apiClient.delete()` (`apps/mobile/src/services/api.ts:305-346`) deliberately sends **no `Content-Type` and no body** (see the comment at `:308`). React Native's Android native networking layer (OkHttp) then attaches a *default* `Content-Type` for which Fastify has **no registered parser** (the API registers zero `addContentTypeParser` — `apps/api/src/app.ts`), so content-type negotiation throws `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415) **before** the (correct) `DELETE /me` handler at `apps/api/src/routes/me/delete-restore.ts:25-75` ever runs. This is the same class of bug already fixed once for `postNoBody` (`api.ts:205-220`, commit `d69bb05`); `delete()` was added later and never got the treatment. Tests miss it because `app.inject()` and the mobile `whatwg-fetch` polyfill never exercise the real native transport.

**Fix (client, primary).** In `apiClient.delete()` set an explicit parseable content type so the native default can't leak through:
- Set header `'content-type': 'text/plain'` (verified: `text/plain` with/without body → 200 on a route with no body schema). **Do not** copy `postNoBody`'s `application/json` + empty body — an *empty* JSON body yields 400.

**Fix (server, hardening — recommended in addition).** Register a permissive parser so no future bodiless verb can 415 from a native default:
```ts
// apps/api/src/app.ts
app.addContentTypeParser('*', (_req, _payload, done) => done(null, undefined));
```

**Files.** `apps/mobile/src/services/api.ts` (`delete`); `apps/api/src/app.ts` (optional); add a transport-level test that asserts the header.
**Tests.** New mobile test asserting `delete()` sends `content-type: text/plain`; keep `apps/api/test/routes/me-delete-restore.test.ts` green.

---

### Bug 2 — "Keep recording" makes the camera preview disappear
**Root cause.** `<HumynLivePreviewView>` is mounted **only while `state.substate === 'active'`** (`apps/mobile/src/screens/recording/RecordingScreen.tsx:977-984`). Pressing (x) dispatches `X_PRESSED` → substate `'stop-confirm'` (`recState.ts:292-295`), which **unmounts** the preview; "Keep recording" dispatches `STOP_CONFIRM_CANCEL` → back to `'active'` (`recState.ts:298-299`), remounting a *fresh* `SurfaceTexture` that fails to re-attach to the still-running Camera2 session (`IllegalArgumentException: Surface was abandoned` — documented in the screen's own comment at `:957-976`). The team already solved the analogous brightness-dim case by toggling **opacity instead of unmounting**, but never widened the gate for the stop-confirm substate. Note `useRecordingLifecycle.ts:224` *already* treats `'stop-confirm'` as part of `monitoring` for the same "don't tear down on modal churn" reason.

**Fix.** Keep the preview mounted across both substates — change the gate at `RecordingScreen.tsx:977`:
```tsx
{(state.substate === 'active' || state.substate === 'stop-confirm') && isLivePreviewAvailable() ? (
```
The native session keeps recording through `'stop-confirm'`; the preview Surface stays attached the whole time (visible behind the modal scrim — correct, "recording is still running"). Consider the same widening for the tap-reveal `Pressable` (`:994-995`) and bottom indicators (`:1009`, `:1029`) for consistency.
**Files.** `apps/mobile/src/screens/recording/RecordingScreen.tsx`.
**Tests.** RTL test: enter `active` → dispatch `X_PRESSED` → `STOP_CONFIRM_CANCEL`, assert the preview view remains mounted throughout.

---

### Bug 9 — Second recording uploads under the *previous* task's name
**Root cause.** The server's `recordings.task_id` (which drives the displayed name everywhere via `HistoryScreen.tsx:159`) is sourced from a **stale JS closure** over `route.params.taskId`, **not** from the per-session-correct native `metadata.json`. The enqueue at `RecordingScreen.tsx:793` passes the closure `taskId` (captured by the `useEffect` deps at `:846`) into `HumynUpload.enqueue(...)` → `queue.json` → `/recordings/init`. Critically, `UploadCoordinator.postInit` (`UploadCoordinator.kt:931-952`) reads SHAs/sizes/duration/calibration from metadata but **never the task** — so the closure value *is* the label. Production enters via `TasksScreen.tsx:191` `navigation.navigate('Recording', …)` (not `push`), so on a re-entry React Navigation **reuses** the route and updates params **without remounting**: the `useReducer` initial state (`:188-191`) stays on the old task while a late/re-subscribed `onSegmentComplete` enqueues under it. (The practice path uses `replace`, the dev path uses `push` — only the real-task path uses `navigate`.)

**Fix (two layers).**
1. **Authoritative source = the session.** Add `taskId` to the native `onSegmentComplete` event (`HumynCapture.types.ts:34` `SegmentCompleteEvent`; emit it in `FinalizeWorker.kt:224-241` from `seg.sidecar.taskInfoPartial.taskId` — the pattern already exists for `SegmentCanceledEvent`, `HumynCapture.types.ts:77`, `FinalizeWorker.kt:400`). Enqueue from `e.taskId`, not the render closure.
2. **Belt-and-braces:** change `TasksScreen.tsx:191` `navigate` → `push('Recording', …)` so each recording remounts fresh (reducer + params stay in lockstep). Optionally pin `taskId` into a ref at `CAPTURE_STARTED` (alongside `segMetaRef`, `:728`).

**Files.** `apps/mobile/src/native/HumynCapture.types.ts`, `apps/mobile/android/.../capture/FinalizeWorker.kt`, `apps/mobile/src/screens/recording/RecordingScreen.tsx`, `apps/mobile/src/screens/tasks/TasksScreen.tsx`.
**Tests.** Native: `FinalizeWorker` emits `taskId`. RN: two consecutive `navigate('Recording')` entries with different tasks each enqueue with the correct id.

---

### Enhancement 2 — Remove the dev-affordance task + `__DEV__` shortcut (D8)
**Inventory.** Task ULID `01HVDEVSEEDTASK00000000000`, slug `dev-seed-chop-vegetables`, name "Dev — Chop vegetables". Seeded by `apps/api/scripts/seed-dev-task.ts` (`DEV_TASK_ID` `:35`, idempotent INSERT `:45-68`). Re-seed hooks: `apps/api/package.json` `seed:dev-task` (`:24`) and `posttest` (`:16`). Client refs: `apps/mobile/src/screens/tasks/TasksScreen.tsx:60-61` (`DEBUG_TEST_TASK`) + the `__DEV__` long-press at `:246` (`:243-244` dead-code-eliminates in release); the dead `TasksPlaceholderScreen.tsx:53-54`; debug script `apps/api/scripts/repro-init-400.ts:14`; tests `apps/mobile/__tests__/screens/recording/devAffordance.test.tsx:96` and Kotlin `UploadQueueStoreTest.kt:288,361,399` (fixture strings). FK: `recordings.task_id → tasks.id ON DELETE RESTRICT` (`schema.ts:163-165`).

**Fix.**
1. Remove the re-seed: delete `seed:dev-task` (`package.json:24`) and strip `&& pnpm seed:dev-task` from `posttest` (`:16`).
2. Delete `apps/api/scripts/seed-dev-task.ts`.
3. Remove `DEBUG_TEST_TASK` + the `__DEV__` long-press from `TasksScreen.tsx`; delete the dead `TasksPlaceholderScreen.tsx`.
4. New guarded migration: `DELETE FROM recordings WHERE task_id = '01HVDEVSEEDTASK…'; DELETE FROM tasks WHERE id = '01HVDEVSEEDTASK…';` (delete dependent dev recordings first because of `ON DELETE RESTRICT`; idempotent).
5. Delete `devAffordance.test.tsx`; swap the ULID fixtures in `UploadQueueStoreTest.kt` for any valid 26-char ULID; remove/repoint `repro-init-400.ts`.

**Risk.** The `__DEV__` long-press is the QA shortcut into RecordingScreen without onboarding — devs lose it. Confirm an alternate dev path (real task selection) is acceptable. Already never shipped to release.

---

## 3. Capture pipeline — 🟡 / 🔴

### Bug 8 + Enhancement 1 — Enforce a 3-minute minimum (D6)
**Root cause (Bug 8).** **No minimum-duration gate exists anywhere.** The only `60_000` check (`RecordingScreen.tsx:422`) governs *post-stop navigation/toast routing only* — it does not gate upload. `FinalizeWorker.decideCancelReason` (`apps/mobile/android/.../capture/FinalizeWorker.kt:270-292`) cancels only on `insufficient_frames`/`fps_dropped`/`resolution_dropped` — no duration branch. `UploadQueueStore.enqueue` (`UploadQueueStore.kt:152-181`) and `/recordings/init` (`durationMs: z.number().int().min(0)`, `shared/types/recording.ts:100`) accept any length. Duration *is* measured (`metadata.json.duration_seconds`, `onSegmentComplete.durationMs`), so a gate has all it needs.

**Fix.** Add the gate at the native finalize layer (the existing cancel-path home), mirroring the fps/resolution cancels:
1. New `CancelReason.TooShort` in `FinalizeWorker.kt` (`CancelReason` sealed class + `decideCancelReason`: `if (durationMs < MIN_SEGMENT_MS) → TooShort`, `MIN_SEGMENT_MS = 180_000`). Routes through the existing `onSegmentCanceled → handleSegmentCanceled.ts` flow: never enqueued, files deleted from cacheDir, non-retryable History row. **Scope the gate to non-practice** (practice has its own 60s hard-cap and never uploads).
2. Add `'too_short'` to the `SegmentCancelReason` union (`HumynCapture.types.ts`) + reason copy in `handleSegmentCanceled.ts` / `HistoryRow` ("Canceled — recording too short").
3. Update the screen routing/toast: `RecordingScreen.tsx:422` `60_000 → 180_000`, and ensure the whole-recording-too-short case surfaces **"Recording too short — discarded"** (toast) consistent with the new History cancel row. Reuse the existing `recording.toasts.tooShort` i18n string (`en.json` + all 7 locale siblings) — review wording so it implies the 3-min floor.
4. **Do not rescale** the minute progress bar (`RecordingScreen.tsx:893`) per D6.

**Files.** `FinalizeWorker.kt`, `HumynCapture.types.ts`, `apps/mobile/src/screens/recording/lib/handleSegmentCanceled.ts`, `RecordingScreen.tsx`, `HistoryRow.tsx`, i18n locales. *(StopConfirmModal.tsx:58 copy says "under 1 minute" and is annotated "(LOCKED)" — update to "3 minutes" with an owner deviation note.)*
**Tests.** Native: a 120s segment → `TooShort`, not enqueued, files deleted. RN: a < 3-min stop shows the discard toast + a non-retryable History row; a ≥ 3-min recording uploads normally.

---

### Bug 3 — Capture location (precise) + permission gate (D3, D4) 🔴
**Root cause.** The full device→sidecar→`metadata.json` chain for `location` is **already plumbed end-to-end** but the value is **hardwired `null`** at `apps/mobile/src/lib/buildCaptureOpts.ts:117`. The permission is **never requested** (`PermissionsScreen.tsx:22-23` prompts only Camera+Mic; `locationPermission.ts` is dead code — zero call sites). There is **no geolocation library** in `apps/mobile/package.json` and no native `LocationManager`/`FusedLocationProvider` usage. The backend **does not accept or persist** location (`shared/types/recording.ts:92-120` init schema has no location; `recordings` table `schema.ts:156-210` has no column).

**Fix (precise-coords path per D3/D4).**
1. **Manifest + CI:** add `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>` to `apps/mobile/android/app/src/main/AndroidManifest.xml`, and **update/remove** the CI gate `apps/mobile/scripts/verify-merged-manifests.sh` that currently *fails the build if FINE is present* (and the manifest comments at `:11,:68` forbidding it).
2. **Permission gate (D4):** add Location to `PermissionsScreen.tsx` alongside Camera+Mic using the existing `requestCoarseLocation()` helper (rename/extend to request FINE). Block "continue" until granted — identical to camera/mic. Wire `react-native-permissions` for `ACCESS_FINE_LOCATION`.
3. **Acquisition:** add a geolocation source. Preferred: a small native method on a `HumynLocation` (or extend `HumynCapture`) using `FusedLocationProviderClient.getCurrentLocation(PRIORITY_HIGH_ACCURACY)` returning `{lat,lng,accuracy_m,provider,captured_at}`. *(Add `play-services-location` to `app/build.gradle`.)* Optional native `Geocoder.getFromLocation()` → coarse `label` for human display.
4. **Inject:** replace `buildCaptureOpts.ts:117` `location: null` with the resolved object; thread `location` through `BuildCaptureOptsArgs` (`:48-66`) and the `RecordingScreen.tsx:688` call site. Update `CaptureSessionOpts.ts:44` from `string|null` to the object shape, and the Kotlin bridge (`CaptureSessionOptsBridge.kt:44,129,144`), `CaptureSession.kt:378`, `SidecarManager.kt:103,161,266`, `FinalizeWorker.kt:478`, `MetadataComposer.kt:263` accordingly. Bump `CURRENT_SCHEMA_VERSION` (`MetadataComposer.kt:57`) `1.3.0 → 1.4.0`.
5. **Backend persistence:** add `recordings.location jsonb` (nullable) (`schema.ts` + migration); add `location` to `RecordingsInitRequestSchema` (`shared/types/recording.ts`) with a zod object validator; persist it in `apps/api/src/routes/recordings/init.ts:337-372` (sibling to the server-set `ip_address`).
6. **Consent + docs:** update the signed consent text (`idea-brief.md §5.2`) from "approximate location" to precise, and `DATA-MODEL.md:153`, REQUIREMENTS `PERM-03`, CLAUDE.md coarse-only line.

**Files.** Manifest, `verify-merged-manifests.sh`, `PermissionsScreen.tsx`, `locationPermission.ts`, new `HumynLocation` native module + `app/build.gradle`, `buildCaptureOpts.ts`, `CaptureSessionOpts.ts`, `CaptureSessionOptsBridge.kt`, `CaptureSession.kt`, `SidecarManager.kt`, `FinalizeWorker.kt`, `MetadataComposer.kt`, `shared/types/recording.ts`, `apps/api/src/routes/recordings/init.ts`, `apps/api/src/db/schema.ts` + migration, consent/docs.
**Tests.** JVM: metadata schema conformance for the new `location` object (incl. null-when-unavailable). API: `/init` accepts + persists `location`; rejects malformed. Manual smoke on a real Pixel: permission gate blocks at onboarding; coordinates land in `metadata.json` + the `recordings.location` column.
**Risk 🔴.** This is the largest single deviation from LOCKED spec (precise GPS leaving the device). It carries privacy/legal weight — the consent-text + DPIA review must land before shipping. The `accuracy_m`/`provider` fields let you audit precision.

---

## 4. Auth & Account (shared `users`/`/me` changes) — 🔴 / 🟡

### Bug 4 — Single-device enforcement, newest-login-wins (D2) 🔴
**Root cause.** No device binding exists, by design (`D-AUTH-03`). The JWT (`apps/api/src/auth/jwt-mint.ts:16-25`) carries `{sub,iat,exp,flavor,applicationId,integrity_verdict,token_version}` — **no installation/session id**. `users` (`schema.ts:75-101`) has no device column; there is no `sessions` table. `requireAuth` (`apps/api/src/plugins/auth.ts:49-73`) validates only signature + `token_version`. The client *has* a stable `getInstallationId()` (`installationId.ts:23-29`) but **never sends it** (`auth.ts:139-145`; `AuthGoogleRequestSchema` `shared/types/auth.ts:10-17` lacks it).

**Fix (newest-wins).**
1. **Client:** send `installationId` on sign-in (`apps/mobile/src/services/auth.ts` `signInWithGoogle` — it already has `getInstallationId()`).
2. **Contract:** add `installationId` to `AuthGoogleRequestSchema` (`shared/types/auth.ts`) and to the minted-JWT claim type (`apps/api/src/plugins/auth.ts`).
3. **DB:** add `users.current_installation_id text` (`schema.ts` + migration).
4. **Mint:** embed `installationId` in the JWT (`jwt-mint.ts`).
5. **Sign-in handler:** on each `/auth/google` (`apps/api/src/routes/auth/google.ts:195-272`), write the new `installationId` onto the user row inside the existing transaction (last-writer-wins).
6. **Verify gate:** in `requireAuth`, after signature check, load the user row and **401 if `jwt.installationId !== users.current_installation_id`**. Cache the `(sub → current_installation_id)` lookup (in-process LRU/short TTL) to keep the per-request cost negligible.
7. **Client UX:** on a 401 with the eviction reason, clear the JWT and route to Signup with a "signed out — used on another device" message (D2 default).

**Files.** `apps/mobile/src/services/auth.ts`, `shared/types/src/auth.ts`, `apps/api/src/db/schema.ts` + migration, `apps/api/src/auth/jwt-mint.ts`, `apps/api/src/routes/auth/google.ts`, `apps/api/src/plugins/auth.ts`, Signup screen copy.
**Tests.** API: device A signs in, device B signs in → A's next authed call → 401; B works. Cache invalidation on re-login. Mobile: 401-eviction → Signup with message.
**Risk 🔴.** Overrides `D-AUTH-03`; makes auth stateful (mitigated by cache). A reinstall on the *same* phone rotates the installation id (SharedPreferences wiped on uninstall) → counts as a new device and evicts the prior session — acceptable under newest-wins. Document the decision record.

---

### Bug 5 — Persist "practice done" server-side (D7) 🟡
**Root cause.** The flag lives **only in local MMKV** (`tutorial.practice_done.{sub}.v1`, `keys.ts:50-52`), explicitly "Reinstall wipes MMKV → re-run" (`initialRoute.ts:100`). No server field exists (`/me`, `MeResponseSchema` `shared/types/me.ts:10-26`, `users` table all lack it). Reinstall/clear-data re-triggers the tutorial; the gate is `computeInitialRoute` (`initialRoute.ts:103-107`).

**Fix.**
1. **DB:** add `users.practice_completed_at timestamptz` (nullable) (`schema.ts` + migration).
2. **Read:** expose `practice_completed_at` (or a derived bool) on `GET /me` (`apps/api/src/routes/me/get-patch.ts` `rowToMe`; `shared/types/me.ts`).
3. **Write:** new `POST /me/practice-complete` (idempotent; sets the timestamp if null), called from `PracticeCompleteScreen.tsx:95-107` **alongside** the existing MMKV write.
4. **Gate seeding:** after sign-in / first `/me` fetch, if the server says completed, write the local `practiceDoneKey(sub)=true` so `computeInitialRoute` (`initialRoute.ts`) skips the tutorial on a fresh install/new device. Hydrate via `apps/mobile/src/state/hydrate.ts` / `services/profileService.ts`.

**Files.** `apps/api/src/db/schema.ts` + migration, `apps/api/src/routes/me/get-patch.ts`, new `apps/api/src/routes/me/practice-complete.ts` (+ register in `me/index.ts`), `shared/types/src/me.ts`, `apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx`, `apps/mobile/src/state/initialRoute.ts`, `apps/mobile/src/state/hydrate.ts`, `apps/mobile/src/services/profileService.ts`.
**Tests.** API: practice-complete sets the timestamp; `/me` returns it. Mobile: fresh install with server `practice_completed_at` set → `computeInitialRoute` skips tutorial → MainTabs. Note: the **Compat** hardware gate still re-runs on a new device (`initialRoute.ts:88-93`), so only the walkthrough is skipped — the rig check isn't lost.

---

## 5. Read-path, reactivity & performance — 🟡

> These all interact with the recording **status model**, which Enhancement 3 (§6) changes to make `uploaded` the terminal-success state. **Do §6 first** so this cluster targets the final model (and the History success chip / Home greeting key on `uploaded`, not `verified`).

### Bug 7 — History doesn't show in-progress uploads live
**Root cause.** The History tab is **lazy-mounted and frozen when blurred** (`MainTabs.tsx:35-50`, default bottom-tabs lazy/`freezeOnBlur`), while recording + enqueue happen on `RecordingScreen` (a root-stack sibling, `RootNativeStack.tsx:83-95`). The native `emitQueueChanged()` (`HumynUploadModule.kt:161,572-577`) is a fire-and-forget event with **no buffering**, so History — whose listener (`HistoryScreen.tsx:202-222`) doesn't exist until first focus — misses it. Home updates because it's the initial tab (always mounted, `:263-283`, + a 30s `reconcileOnce` poll); PendingUploads re-reads `getQueueSafe()` on mount. History only re-reads on focus/pull-refresh (its header comment `:36-40` even states it relies on the next `GET /recordings`). Secondary: the `ownerUserId === currentSub` filter (`:206,:210`) can drop a freshly-enqueued row during a null-`currentSub` window.

**Fix.** Make upload-queue state a **single app-lifetime reactive source** instead of three per-screen subscriptions:
1. Add an `uploadQueue` (+ `progressById`) slice to `apps/mobile/src/state/appStore.ts`, fed by **one** `onUploadQueueChanged`/`onUploadProgress` subscription installed at boot (next to `installUploadReconcile()` in `App.tsx`), seeded once with `getQueueSafe()`. Living outside the navigator, it survives tab lazy-mount/freeze.
2. `HistoryScreen` reads `deviceRows`/`progressById` from a store selector (re-renders on change) instead of its own effect. Home + PendingUploads refactor to the same selector (removes the duplicated "keep in sync" subscriptions).
3. Refetch the server list when History focuses or when a queue event marks a row terminal; fix the `currentSub`-null race.

**Files.** `apps/mobile/src/state/appStore.ts`, `apps/mobile/src/native/HumynUpload.ts`, `App.tsx` (new boot installer), `HistoryScreen.tsx`, `HomeScreen.tsx`, `PendingUploadsScreen.tsx`.
**Tests.** Enqueue while History is unmounted → focus History → row present immediately. Enqueue while History focused → appears without refresh.

---

### Bug 11 — Contribution time + task count don't auto-update
**Root cause.** Stats are fetched at lifecycle events only; **no event fires after upload to trigger a refetch.** Profile fetches once at mount (`ProfileScreen.tsx:110-141`, deps `[setUser]` — no focus/AppState/upload subscription). Home refetches on `useFocusEffect` + pull-refresh (`HomeScreen.tsx:353-368,376-383`) but its `onUploadQueueChanged` handler (`:270-272`) only updates `pendingRows`, never calls `reloadLifetime`/`reloadAggregate`; the `verified`-event path only deletes files. Backend counts a recording the instant its row exists (`/recordings/init` INSERT, `contributions/list.ts:65` `WHERE qa_status NOT IN ('takedown','rejected')` + the `0004` trigger) — so **server numbers are immediately correct**; the staleness is 100% client refetch timing.

**Fix.** One "contributions changed" invalidation:
1. Home: call (debounced ~1–2s) `reloadLifetime()`/`reloadAggregate()` from the `onUploadQueueChanged` handler. *(After §6, the same handler already exists for Bug 7's store — emit a `contributionsVersion` bump from it.)*
2. Profile: refetch lifetime on `useFocusEffect` + AppState-active (mirror Home), and/or subscribe to the shared signal — today it's mount-only.
3. Cleanest: a `contributionsVersion` counter in `appStore` bumped by the upload-queue subscription; Home + Profile effects key on it.

**Files.** `apps/mobile/src/screens/home/HomeScreen.tsx`, `apps/mobile/src/screens/profile/ProfileScreen.tsx`, `apps/mobile/src/state/appStore.ts` (shared signal).
**Tests.** Mock an upload-complete event → Home tiles + Profile lifetime refetch without manual action.

---

### Bug 10 — Profile stuck / very slow loading
**Root cause (two, both contribute).**
- *Client:* `ProfileScreen.tsx:110-141` does an **all-or-nothing `Promise.all([fetchMe(), fetchLifetimeContribution()])`** with **no loading timeout** and only two terminal states (`:181-202`). A slow `/contributions` keeps "Loading…" until it resolves or the 30s transport abort (`api.ts:221-263`) fires; no retry affordance.
- *Backend:* `/contributions` runs **two sequential per-user scan+aggregate queries** (`contributions/list.ts:57-66,76-87`) with **no `(user_id, qa_status)` covering index** (only `(user_id, captured_at)` exists, `schema.ts:205-209`) → full per-user heap scans for heavy contributors. The pg pool (`db/index.ts:11-16`) has **no `connectionTimeoutMillis` and no `statement_timeout`**, so an exhausted pool makes requests wait indefinitely (past the client's 30s abort). Every authed response also runs the outbox drain (`events-outbox.ts:38-62`).

**Fix.**
- *Client:* use `Promise.allSettled`; render off `/me` immediately (fast PK read) and lazy-load the lifetime block with a small spinner; add a loading-deadline (12–15s) → error+Retry; refetch on `useFocusEffect` so transients self-heal. *(Also add an AbortController to `api.ts` `post`/`postNoBody` for parity — latent unbounded hang, `:186-220`.)*
- *Backend:* add `CREATE INDEX recordings_user_qa_idx ON recordings (user_id, qa_status) INCLUDE (duration_ms, task_id);`; add pool `connectionTimeoutMillis` (~5s) + `statement_timeout` (~10–15s) so contention fails fast (5xx → client shows error) instead of hanging. Run the two queries concurrently. *(Optional: serve from the denormalized `profiles.lifetimeContributionMs`/`taskCount` if a writer keeps them current — see open question.)*

**Files.** `apps/mobile/src/screens/profile/ProfileScreen.tsx`, `apps/mobile/src/services/api.ts`, `apps/api/src/routes/contributions/list.ts`, `apps/api/src/db/schema.ts` + migration (index), `apps/api/src/db/index.ts`.
**Tests.** Client: simulate a slow/hanging `/contributions` → Profile shows `/me` content + a retry, never an infinite spinner. API: `EXPLAIN` confirms index-only/range scan; a statement past timeout returns a 5xx.
**Open Q.** Is `profiles.lifetimeContributionMs`/`taskCount` meant to be the cheap source of truth (and is anything keeping it current)? It exists but `/contributions` ignores it.

---

### Bug 6 — Thumbnails for cross-device videos (D5) 🟡
**Root cause.** Thumbnails are generated **only on the recording device** from the local MP4 (`ThumbnailExtractor.kt:57-83`, `FinalizeWorker` step 7.5) and stored **only in device-local MMKV** (`thumbnailLedger.ts:138-140`, keyed by `recordingId`). `HistoryRow.tsx:376-397` renders **only** from `ledgerEntry?.thumbnailPath` (a local `file://`), with no remote branch. The backend stores **no** thumbnail (`recordings` has no column; `list.ts:132-152` / `get.ts:97-105` return none). A second device (or a reinstall) has an empty ledger → gradient+letter fallback.

**Fix (backend-at-finalize per D5).**
1. **DB:** add `recordings.s3_key_thumbnail text` (nullable) (`schema.ts` + migration).
2. **Generate:** in `apps/api/src/routes/recordings/finalize.ts`, after the MP4 is assembled in S3, extract a poster JPEG (ffmpeg seek to ~1s) and PUT to `recordings/{userId}/{recordingId}/thumb.jpg`; set `s3_key_thumbnail`. Since the verify worker is removed (§6), do this **inline** in the finalize handler (or a tiny fire-and-forget job) — add `ffmpeg` to the API runtime image. *(Source MP4/IMU/metadata untouched — the "files never re-encoded" rule is about the captured bytes; the poster is a new derived object.)*
3. **Serve:** return a short-TTL signed `thumbnail_url` in `GET /recordings` (`list.ts`) and `GET /recordings/:id` (`get.ts`); add to the shared list-item type.
4. **Client:** `HistoryRow.tsx` prefers the local ledger fast-path, falls back to `row.thumbnail_url` when absent; plumb the field via `HistoryScreen.tsx:156-165` `toRowItem`.

**Files.** `apps/api/src/db/schema.ts` + migration, `apps/api/src/routes/recordings/finalize.ts`, `list.ts`, `get.ts`, API runtime image (ffmpeg), `shared/types/src/recording.ts`, `apps/mobile/src/components/HistoryRow.tsx`, `apps/mobile/src/screens/history/HistoryScreen.tsx`.
**Tests.** API: finalize produces `s3_key_thumbnail`; list/get return a signed URL. Client: a row with no local ledger entry but a `thumbnail_url` renders the remote image. Canceled/local-only rows (bundle deleted) keep the gradient fallback — acceptable.
**Note.** Depends on the §6 finalize refactor (both touch `finalize.ts`) — sequence after/with it.

---

## 6. Enhancement 3 — Remove the verification flow (+ all hashing, D1) — 🔴

> **Highest blast-radius change. Do this early** so the read-path cluster (§5) targets the final status model. The recording state machine collapses to `uploaded` = terminal success.

### State machine: before → after
```
BEFORE:  pending --/finalize--> uploaded --worker hash match--> verified (terminal ✓)
                                   \--hash mismatch--> hash-mismatch --/reupload--> pending
AFTER:   pending --/finalize--> uploaded (TERMINAL ✓)
         isTerminal = uploaded | rejected | takedown
         ALLOWED = { pending:['uploaded','rejected','takedown'], uploaded:['takedown'], rejected:['takedown'], takedown:[] }
```

### 6.1 Backend — delete entirely
`apps/api/src/`: `workers/hash-verify.ts`, `workers/hash-verify-run.ts`, `workers/sqs-poller.ts`, `lib/queue.ts` (only BullMQ/ioredis consumer), `lib/verify-recording.ts`, `lib/sha256-stream.ts` (only server byte-read), `lib/recording-events.ts`, `cron/verify-sweep.ts`, `plugins/events-outbox.ts`, `routes/recordings/verified-ids.ts`. **`routes/recordings/reupload.ts`** — drop (only reachable from `hash-mismatch`); see open Q.

### 6.2 Backend — edit
- `lib/recording-state.ts:20,32` — make `uploaded` terminal; rewrite `ALLOWED`/`isTerminal`.
- `routes/recordings/finalize.ts:23,211-244` — remove `enqueueVerify` import + the `recordings_to_verify` insert; set terminal state; (this is also where thumbnail generation lands, §Bug 6).
- `app.ts:10,22,39,61-66` — unregister `eventsOutboxPlugin` + `startVerifySweep`.
- `routes/recordings/index.ts:11-12,26-27` — unregister verified-ids (+ reupload).
- `routes/recordings/get.ts:78`, `stream-url.ts:140-145`, `list.ts:83,149` — drop dead `verified`/`hash-mismatch` references; `uploaded` is success.
- `routes/recordings/schemas.ts:16,41,50` — remove `RecordingServerEvent`/`_events`.
- `routes/contributions/list.ts:62` — **`qa_status = 'verified'` → `'uploaded'`** (this drives the Home hero greeting; otherwise the greeting never shows). `timeseries.ts:127` — verify the status set.
- `apps/api/package.json` — remove `worker:*` scripts + the `dev` worker spawn; drop `bullmq`, `ioredis`, `@aws-sdk/client-sqs`.

### 6.3 DB / migrations
New migration (append-only; don't edit historical files): drop `recordings_to_verify`, `recording_events_outbox`, the `recording_event_type` enum; drop `recordings.verified_at`; **drop `recordings.file_sha256` + `imu_sha256`** (per D1). Leave the `qa_status` enum values `verified`/`hash-mismatch` in place (Postgres can't cheaply drop enum values) but stop writing them; pre-existing `verified` rows are read as success. Update `schema.ts` to match (`qaStatusEnum`, remove `recordingEventTypeEnum`, `recordingsToVerify`, `recordingEventsOutbox`, `verifiedAt`, the two sha columns).

### 6.4 shared/types
`recording.ts`: trim `QaStatusSchema` usage to `pending|uploaded|rejected|takedown` (keep enum tolerant of legacy values on read); remove `verifiedAt`, `fileSha256`/`imuSha256` (from `RecordingCreateSchema` + `RecordingsInitRequestSchema`), `RecordingServerEventSchema`, `EventsEnvelopeSchema`, `RecordingReupload*`, `VerifiedIds*`, `_events` on list/stream responses. `contributions.ts:21` — keep `verifiedNonPracticeCount` (now fed by `uploaded`).

### 6.5 Mobile (TS)
- **Delete `services/recordingEvents.ts`** and remove `interceptEvents` from `services/api.ts:31,173-183` (and every verb call).
- **`services/uploadReconcile.ts`** — re-point the local-file-deletion trigger. ⚠ **Highest risk:** today the **only** deletion triggers are the `verified` `_events` event and the `/recordings/verified-ids` reconcile. After removal, **on `/finalize` 200 the device must delete the local mp4/csv/json (+thumb)** — otherwise bundles accumulate forever and queue rows sit in `AWAITING_VERIFY`.
- **`native/HumynUpload.ts:59-66,157,165`** — drop `awaiting-verify`/`verified` from the state union; rename `clearVerified` → a generic local-delete on terminal success; remove `reupload` (or keep as generic re-mint, open Q).
- **Chips:** `HistoryRow.tsx:78,154,206-232` — success chip keys on `uploaded` (today `verified`), drop `chip-verifying`/`awaiting-verify`. `UploadStatusChip.tsx:40,47,55` — drop the "verifying" variant. `HistoryScreen.tsx:84-87,396,402` and `HomeScreen.tsx:82-99,132-143,293,442` — map terminal success to `uploaded`; drop the verified-event auto-poll. *(This is the same chip surface Bug 7 touches — do §6 before §5.)*

### 6.6 Mobile native (Kotlin)
`upload/UploadModels.kt:75-76` (drop `AWAITING_VERIFY`/`VERIFIED`), `upload/UploadCoordinator.kt:446-459,587-595,755-756` (terminal = uploaded; delete local on finalize 200), `upload/HumynUploadModule.kt:260-270,282-320` (clearVerified→local-delete; reupload), **delete `capture/HashStreamer.kt`** (per D1), `capture/MetadataComposer.kt:296,299` (remove `file_sha256`/`imu_sha256`; schema bump), `capture/FinalizeWorker.kt` (drop hash step). ⚠ **KEEP `AppFlavorModule.sha256First16Hex`** — it's the compat-signature device fingerprint (`compatSignature.ts`), unrelated to upload verification.

### 6.7 Infra (dead after removal)
`docker-compose.yml:39-48` (`redis` service), `.env.example` (`REDIS_URL`), `infra/terraform/modules/verify-queue/` + `modules/redis/` (entire modules), `infra/terraform/envs/prod/main.tf:87-95,98-115` (`module "redis"`, `module "verify_queue"`). `buildspec.yml` — no change (APK-only). *Recommend: land code first; reap infra in a fast follow.*

### 6.8 Tests
Delete: `apps/api/test/{lib/queue,lib/sha256-stream,workers/verify-recording,workers/sqs-poller,plugins/events-outbox,routes/recordings/verified-ids,routes/recordings/reupload}.test.ts`, `apps/mobile/__tests__/services/recordingEvents.test.ts`. Edit (drop `verified`/`_events`/chip-verifying, reseed `uploaded`): `recording-state.test.ts`, `recordings-finalize.test.ts`, `contributions*.test.ts`, `recordings-list/get/stream-url.test.ts`, `uploadReconcile.test.ts`, `HistoryRow/HistoryScreen/HomeScreen/PendingUploadsScreen/UploadStatusChip` tests, native `UploadCoordinatorTest.kt`, `HashStreamerTest.kt` (delete), `FileFidelityTest.kt`.

**Open questions (Enh 3).** (a) Keep `reupload` as a generic dead-letter re-mint, or remove (client dead-letter "Retry" at `HistoryRow.tsx:520` calls `HumynUpload.reupload`)? (b) Drop the unused `qa_status` enum values via a full enum rewrite, or leave as legacy? (c) Tear infra now or follow-up?

---

## 7. Phased rollout (dependency-ordered)

```
Phase 0  Quick fixes (independent, ship anytime)
         Bug 1 (delete 415) · Bug 2 (preview) · Bug 9 (task mislabel) · Enh 2 (dev task)

Phase 1  Verification + hashing removal (Enh 3 / D1)        ← reshapes status model + finalize.ts
         └─ blocks Phase 2 (thumbnails share finalize.ts) and Phase 5 (chips/stats key on `uploaded`)

Phase 2  Bug 6 thumbnails (D5)                               ← builds on Phase 1 finalize refactor

Phase 3  Capture pipeline
         Bug 8 + Enh 1 (3-min gate / D6) · Bug 3 (location / D3,D4)   ← independent of 1/2

Phase 4  Auth & account (shared users/me + migrations)
         Bug 4 (multi-device / D2) · Bug 5 (practice / D7)

Phase 5  Read-path reactivity & perf  (AFTER Phase 1)
         Bug 7 (History live) · Bug 11 (stats) · Bug 10 (profile stuck)
```

**Why this order:** Phase 1 changes the recording status model (`verified` → `uploaded` terminal) and the local-file-deletion trigger; Bug 6 (Phase 2), and the History chip / Home greeting / stats work (Phase 5) all read that model, so doing Phase 1 first avoids reworking them twice. Phase 0 is fully isolated. Phases 3 and 4 are independent of 1/2/5 and can run in parallel by different owners. Each phase is one GSD execution unit (multiple PRs where noted).

---

## 8. Spec/doc updates required (overrides need owner sign-off)

| Decision | Docs to update |
|---|---|
| D3 precise location | `idea-brief.md §2.1` (coarse-only), `§5.2` (consent text → precise), `DATA-MODEL.md:153`, `CLAUDE.md` (coarse-only line + a new banner), `.planning/REQUIREMENTS.md` PERM-03, AndroidManifest comments, `verify-merged-manifests.sh`. **Legal/DPIA review.** |
| D2 multi-device | Decision record overriding `D-AUTH-03`; `CLAUDE.md` Auth constraint; `deferred-decisions.md`. |
| D6 3-min minimum | `StopConfirmModal.tsx` "(LOCKED)" copy, `design-spec.md` / `engineering-handoff.md` §6.3, `.planning/REQUIREMENTS.md`, `CLAUDE.md` capture-quality banner. |
| D1 remove hashing | `UPLOAD-PIPELINE.md`, `DATA-MODEL.md` (drop sha fields), `CLAUDE.md` ("byte-for-byte" note — fidelity proof removed), `.planning/REQUIREMENTS.md` VERIFY-*, `ROADMAP.md` Phase 5. |
| D5 thumbnails | `DATA-MODEL.md` (`s3_key_thumbnail`), `UPLOAD-PIPELINE.md`. |
| D7 practice | `DATA-MODEL.md` (`users.practice_completed_at`), `.planning/REQUIREMENTS.md`. |

---

## 9. Risk register

| Risk | Sev | Mitigation |
|---|---|---|
| **Enh 3:** local bundles never deleted after removing the `verified` trigger | 🔴 | Re-point deletion to `/finalize` 200 (§6.5/6.6); add a reconcile backstop keyed on server `qa_status='uploaded'`. Test explicitly. |
| **Enh 3:** History success chip / Home greeting silently break (keyed on `verified`) | 🔴 | Switch to `uploaded` in the same PR (`contributions/list.ts:62`, `HistoryRow`, `HomeScreen`); covered by Phase ordering. |
| **D3:** precise GPS leaves device — privacy/legal | 🔴 | Consent-text + DPIA sign-off before ship; `accuracy_m`/`provider` audit fields; FINE-permission gate. |
| **D2:** stateful auth adds per-request DB read | 🟡 | In-process LRU cache of `sub→current_installation_id`; short TTL. |
| **D2:** reinstall on same phone evicts session | 🟡 | Documented as expected under newest-wins. |
| **D6:** trailing <3-min segment of a long recording is dropped (tail data lost) | 🟡 | Confirm with owner; alternative = whole-recording minimum. |
| **Enh 3:** cross-package type breaks (`shared/types`) ripple to both apps | 🟡 | Remove exports last; keep enum read-tolerant of legacy values. |
| **Bug 10:** pool `statement_timeout` could fail legitimately-slow queries | 🟢 | Generous bound (10–15s) + the new covering index makes them fast. |

---

## 10. Test & verification plan

**Automated (per item above).** Unit/integration tests added or updated alongside each fix; native JVM tests for FinalizeWorker gates + metadata schema; API tests for `/init`, `/finalize`, `/contributions`, auth eviction, practice-complete.

**Manual smoke (real Pixel hardware — several depend on device behavior):**
1. **Bug 1:** Delete account → type DELETE → succeeds (no 415).
2. **Bug 2:** Record → (x) → "Keep recording" → preview stays live.
3. **Bug 3:** Onboarding blocks at Location until granted; `metadata.json` + `recordings.location` carry lat/lng/accuracy.
4. **Bug 4:** Sign in on device A, then B → A's next action signs it out with the message.
5. **Bug 5:** Complete practice → reinstall / sign in on a new phone → no practice prompt (Compat still runs).
6. **Bug 6:** A recording made on device A shows a thumbnail in History on device B.
7. **Bug 7:** Start an upload, immediately open History (cold) → row visible, progresses live.
8. **Bug 8 / Enh 1:** A 2-min recording → "Recording too short — discarded", never uploads; a 4-min recording uploads.
9. **Bug 9:** Record Dicing then Peeling back-to-back → each uploads under its own task.
10. **Bug 10:** Profile loads `/me` instantly; lifetime block fills or shows retry — never an infinite spinner.
11. **Bug 11:** Finish a recording → Home + Profile contribution time/task count update without manual refresh.
12. **Enh 2:** Dev task absent from the catalog; no `__DEV__` long-press.
13. **Enh 3:** Upload completes → row shows "Uploaded" (terminal), local files deleted, no verify/Redis/SQS activity.

---

## 11. Execution note

Per repo policy (`CLAUDE.md` → GSD Workflow Enforcement), route each phase through GSD: `/gsd-execute-phase` for Phases 1–5, `/gsd-quick` for the Phase 0 isolated fixes, `/gsd-debug` if a fix needs deeper repro first. This plan is the planning artifact; the GSD commands keep execution context in sync. The three LOCKED-spec overrides (D1, D2, D3) should get their written owner sign-off recorded in `.planning/` before their phases start.
