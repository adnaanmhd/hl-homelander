---
slug: auth-nonce-mismatch
status: resolved
resolved_at: 2026-05-10
resolved_by_commit: 8b13d23
trigger: 'Phase 2 manual smoke walk Section 2.3 — round 3 attempt — newly blocked by a server-side Play Integrity nonce round-trip mismatch. After tapping Continue with Google → selecting test account → returning to app, an error overlay renders with: POST /auth/google failed: 401 {type: integrity-nonce, title: Nonce verification failed, detail: Nonce check: mismatch}'
created: 2026-05-10
updated: 2026-05-10
phase: 02-mobile-shell-onboarding-permissions-compat-profile
goal: find_and_fix
tdd_mode: false
prior_resolved_sessions: [playintegrity-invalid-project]
---

# Debug session: auth-nonce-mismatch

## Symptoms

### Expected behavior

After the user taps "Continue with Google" → picks a test account → returns to app:

1. POST /auth/nonce returns `{ nonceId, nonce }` (nonce = 43-char URL-safe-base64).
2. PlayIntegrity Classic API mints an integrity token with that nonce embedded.
3. POST /auth/google submits `{ googleIdToken, integrityToken, flavor, applicationId, nonceId }`.
4. Backend decodes the integrity token via googleapis playintegrity v1.
5. Backend extracts `payload.requestDetails.nonce` and compares its SHA-256 to the row stored at /auth/nonce time.
6. Hashes match → consumeNonce returns `{ ok: true }`.
7. Backend issues JWT, app navigates to Permissions screen.

### Actual behavior

On-device error overlay (Sign-up screen) on the third sign-in re-attempt at ~09:06 wall-clock 2026-05-10:

```
POST /auth/google failed: 401 {"type":"https://humyn-app.io/problems/integrity-nonce","title":"Nonce verification failed","status":401,"detail":"Nonce check: mismatch","instance":"_EfXfF5jJeWbsvrv6EbAG"}
```

Backend got past Play Integrity decode (the SA key is valid, API enabled, project number correct — all proven by the fact that the request reached `consumeNonce`). The nonce hash comparison failed.

### Error messages

- On-device: see Actual behavior.
- Backend log /tmp/humyn-api.log shows the request pair but NO structured WARN line for the mismatch (problem detail is built and returned without a logger call). Only the request lines + 401 response code:
  - 03:35:56 POST /auth/nonce → 200 (33ms) `req-3`
  - 03:35:58 POST /auth/google → 401 (831ms — Google playintegrity SA decode round-trip) `req-4`
  - (Note: log timestamps are 5h30m off wall-clock — host clock is UTC, IST = UTC+5:30, so 03:35 log = 09:05 wall-clock.)

### Timeline

- 2026-05-10 ~08:30 — first observation of any sign-in attempt past the Google sheet (prior blocker: PlayIntegrity -16 / cloud project number).
- 2026-05-10 ~08:47 — second attempt: cloud-project-number fix landed (commit 77e981f), PlayIntegrity now mints; new failure: backend decode fails because PLAY_INTEGRITY_SA_KEY_JSON not set.
- 2026-05-10 ~09:01 — operator created service account `humyn-play-integrity-decode@homelander-24045.iam.gserviceaccount.com`, downloaded JSON key, gitignored.
- 2026-05-10 ~09:05 — env var inlined into apps/api/.env, dev API restarted (PIDs killed: 85044/85045; new tsx watch spawned).
- 2026-05-10 ~09:06 — third attempt: decode now succeeds; new failure: nonce mismatch.
- This is the FIRST time any sign-in has reached the nonce-comparison code path on real hardware (Phase 1 plan 01-13's smoke was deferred; only unit-test coverage of the orchestrator existed).

### Reproduction steps

1. Backend running with PLAY_INTEGRITY_SA_KEY_JSON populated: `curl http://localhost:8080/healthz` → `{"status":"ok"}`.
2. Pixel 10a connected: `adb devices` → `5C161JEA304304 device`.
3. `adb reverse tcp:8080 tcp:8080` active.
4. apkRollout debug APK built post-fix (commit 77e981f) installed.
5. Force-stop + relaunch app: `adb shell am force-stop ai.humynlabs.capture.apk && adb shell am start -n ai.humynlabs.capture.apk/ai.humynlabs.capture.MainActivity`.
6. Check consent box on Sign-up screen.
7. Tap "Continue with Google".
8. Pick test account.
9. Observe error overlay on return.

## What I've already verified (orchestrator's preliminary read — please re-verify before relying on)

1. **Mobile orchestrator (apps/mobile/src/services/auth.ts:105-132) appears correct:**
   - `const nonceRes = await apiClient.postNoBody<NonceResponse>('/auth/nonce')` (L120)
   - `const integrityToken = await requestIntegrityToken(nonceRes.nonce)` (L123) — passes raw `nonce` (not nonceId)
   - `apiClient.post(... { ..., nonceId: nonceRes.nonceId })` (L126-132) — passes nonceId field
   - No string mutation observed in this function.
2. **Mobile native wrapper (apps/mobile/src/native/PlayIntegrity.ts) is a thin pass-through** — bridges to NativeModules.PlayIntegrity.requestIntegrityToken(nonce).
3. **Kotlin module (apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt:38-66, post-fix) calls IntegrityTokenRequest.builder().setNonce(nonce).setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER).build()** — Classic Play Integrity API (NOT Standard).
4. **Backend nonce store (apps/api/src/auth/nonce-store.ts:17-27)** mints `randomBytes(32).toString('base64url')` (43 URL-safe-base64 chars, no padding) — within Play Integrity Classic API's 16-500 char restriction.
5. **Backend decode (apps/api/src/auth/verify-play-integrity.ts:25-37)** uses googleapis playintegrity v1's decodeIntegrityToken (Classic decode endpoint, matches the mobile-side Classic API).
6. **PLAY_INTEGRITY_SA_KEY_JSON** is set in apps/api/.env (single-quoted, single-line, valid JSON for service account `humyn-play-integrity-decode@homelander-24045.iam.gserviceaccount.com`, project_id `homelander-24045`).
7. **Decode IS succeeding** — the backend got past the decode catch block (apps/api/src/routes/auth/google.ts:117-126) and reached consumeNonce (line 140). The 401 came from nonce mismatch (line 142-149), not decode failure (which would have surfaced as `Play Integrity decode failed` at line 121).

## Hypotheses to test (ranked by likelihood — orchestrator's first guess)

1. **Play Integrity Classic API is mutating the nonce in transit.** Forum reports exist of Google URL-decoding the nonce inside the response payload. Our nonce uses URL-safe-base64 (A-Z, a-z, 0-9, -, \_) which should be a URL-decode no-op, but maybe something else is happening (e.g. the `+` / `=` legacy normalization). Easy to confirm/refute empirically by comparing the minted nonce to the decoded one byte-for-byte.
2. **Backend nonce.ts route emits a different `nonce` string than what's stored as nonceSha256.** A subtle JSON serialization quirk or transformation between mint and DB write. Less likely but worth checking — compare the response body's nonce to the candHash input at /auth/google.
3. **Mobile-side string mutation in apiClient between /auth/nonce response and /auth/google request body.** Less likely (apiClient is a thin fetch wrapper) but possible if something normalizes Unicode or trims.
4. **Hash function/encoding mismatch in nonce-store.ts.** Both sides go through `sha256Hex(s)` with `createHash('sha256').update(s).digest('hex')`. So this is unlikely unless the input strings differ (which is what we're trying to prove).
5. **Subtle race/flow bug** — concurrent /auth/nonce calls, mobile uses nonceId from call A with nonce from call B. Mobile orchestrator awaits sequentially per auth.ts:105-132, but possible on a multi-tap.

## Recommended first step (orchestrator's plan)

Add temporary uncommitted log lines (TO BE REVERTED before declaring done — production must NEVER log nonce material; defeats the integrity-protection purpose):

- **apps/api/src/routes/auth/nonce.ts** — log `{ nonceId, mintedNonce: nonce, len: nonce.length }` immediately before the 200 response.
- **apps/api/src/routes/auth/google.ts** at line ~140 (immediately before `consumeNonce`) — log `{ nonceIdFromBody: body.nonceId, decodedNonce: candidateNonce, decodedLen: candidateNonce.length, payloadSnippet: JSON.stringify(payload.requestDetails) }`.

tsx watch hot-reloads (process is running as `node tsx watch src/index.ts` — confirmed at /tmp/humyn-api.log header). User taps Continue with Google. Backend log shows both lines. Compare:

- nonceId field — should match
- nonce string — exact match collapses hypotheses 1 and 2; differing nonce confirms transit mutation
- length — Play Integrity might pad/strip
- payloadSnippet — reveals what `requestDetails` actually contains (timestampMillis, requestPackageName, etc.)

After diagnosis, REVERT the diagnostic logs (do NOT commit them), then propose + apply the real fix through this same debug session.

## Constraints (carried from prior session, MUST NOT violate)

- **Anti-pattern: cosmetic chasing during smoke.** Per saved memory `feedback_functionality_first_during_smoke.md`, do NOT touch the two uncommitted cosmetic-attempt edits in working tree (`apps/mobile/src/screens/signup/SignupScreen.tsx`, `apps/mobile/src/ui/primitives/Text.tsx`). They're Phase 3 Wave 1 cosmetic backlog.
- **Stack pin:** Play Integrity → custom Kotlin module (no third-party RN wrapper). Don't introduce a new npm package. Don't switch to the Standard API path (different SDK class — `StandardIntegrityTokenRequest` — would be a phase-level architecture change).
- **Module package separation (Pattern 40):** PlayIntegrityModule lives under `io.humyn.app.*`; app body lives under `ai.humynlabs.capture.*`. Preserve.
- **Diagnostic logs MUST be reverted before declaring done.** Production must NEVER log nonce material — defeats the integrity-protection purpose of the nonce. Confirm with `git diff apps/api/src/routes/auth/` shows clean before commit.

## Context references

- Plan 01-04 (Phase 1, /auth/nonce + nonce-store): summary at `.planning/phases/01-foundation-backend-distribution-recon/01-04-SUMMARY.md`.
- Plan 01-05 (Phase 1, /auth/google + integrity policy): summary at `.planning/phases/01-foundation-backend-distribution-recon/01-05-SUMMARY.md`.
- Plan 01-13 (Phase 1, mobile sign-in scaffold): summary at `.planning/phases/01-foundation-backend-distribution-recon/01-13-SUMMARY.md`. Code-ready-smoke-deferred — this is the first end-to-end exercise.
- Prior debug session (resolved): `.planning/debug/resolved/playintegrity-invalid-project.md` — same session sequence, prior cycle's root cause.
- Phase 2 manual smoke runbook: `apps/mobile/02-MANUAL-SMOKE.md` (Section 2.3 = blocked checkbox).
- Existing logcat tail (background Bash `bed95v2uz`) at `/private/tmp/claude-501/-Users-adnaan-Documents-hl-homelander/158e8bd1-4d98-4ced-93ab-9815637d0547/tasks/bed95v2uz.output` (filters PlayIntegrity, /auth/google, signInWithGoogle, integrity_verdict, GoogleSignIn, SIGN_IN, DEVELOPER_ERROR, ApiException, ReactNativeJS).

## Live test environment (verified up at orchestrator-spawn time)

- Backend: localhost:8080 ✓ (tsx watch with PLAY_INTEGRITY_SA_KEY_JSON populated; log file /tmp/humyn-api.log)
- Device: Pixel 10a `5C161JEA304304` ✓
- `adb reverse tcp:8080 tcp:8080` active ✓
- App is currently on the Sign-up screen showing the nonce-mismatch error overlay
- After diagnosis & fix lands, the orchestrator (back in main session) will:
  1. Verify diagnostic logs are reverted (`git diff apps/api/src/routes/auth/`)
  2. Have the operator re-attempt §2.3
  3. Watch /tmp/humyn-api.log + logcat for the success path (PlayIntegrity token mint → /auth/google 200 → integrity_verdict: bypassed_apk)

## Current Focus

hypothesis: Play Integrity Classic API is returning a nonce in `payload.requestDetails.nonce` that is NOT byte-identical to the nonce that was passed to setNonce(). Most likely a URL-encoding or padding-related normalization on the Google side. Less likely but possible: a backend-side transformation between mint and store (e.g. response body sends a different string than what was hashed).
test: Add temporary log lines at /auth/nonce (mintedNonce + len + nonceId) and /auth/google before consumeNonce (decodedNonce + len + nonceIdFromBody + payloadSnippet). Have user re-attempt sign-in. Read /tmp/humyn-api.log. Compare the two nonce strings byte-for-byte and length-for-length.
expecting: Either (a) the strings differ in a structured way (encoding diff: URL-decoded, trimmed, etc.) → hypothesis 1 confirmed → fix is to apply the same transformation server-side in consumeNonce before hashing, OR (b) the strings are identical → mismatch is somewhere else (DB write/read, hash function, race) → broaden hypothesis search.
next_action: 1) Read apps/api/src/routes/auth/nonce.ts and apps/api/src/routes/auth/google.ts to confirm exact insertion points. 2) Apply temp log lines via Edit tool. 3) Verify tsx watch hot-reload picks them up (look for "rebuilding" or "ready" lines in /tmp/humyn-api.log; if it doesn't, restart the dev API by killing the tsx watch + child PIDs and respawning). 4) Surface the user a checkpoint asking to re-attempt §2.3 on the device. 5) Read the new log lines, decide root cause from the diff. 6) Revert the diagnostic logs. 7) Propose + apply the real fix (committed atomically as fix(02-21)) with a Pattern 5x reference if a new pattern emerges.

## Evidence

- timestamp: 2026-05-10 03:54 (host clock UTC, ≈09:24 wall-clock IST) — diagnostic logs from `apps/api/src/routes/auth/nonce.ts` and `apps/api/src/routes/auth/google.ts` (uncommitted, sentinel-tagged DEBUG_REVERT_BEFORE_COMMIT) captured the side-by-side nonce values:
  - **mintedNonce** (43 chars, from `randomBytes(32).toString('base64url')`): `0P8isRswLt9BL5wfLPTn8k4BjeOvWapiFXLO9AG1z8E`
  - **decodedNonce** (44 chars, from `payload.requestDetails.nonce` returned by googleapis playintegrity v1 decode): `0P8isRswLt9BL5wfLPTn8k4BjeOvWapiFXLO9AG1z8E=`
  - **Diff:** Google added a single trailing `=` (standard base64 padding). Same `nonceId`. Same payload structure. The strings differ ONLY by the padding.
- timestamp: 2026-05-10 — diagnostic logs reverted before commit (`git diff apps/api/src/routes/auth/` clean before the fix landed). Production must NEVER log nonce material — defeats integrity-protection.

## Eliminated hypotheses

- hypothesis: Backend nonce.ts route emits a different `nonce` string than what's stored as nonceSha256 — ELIMINATED by evidence (mintedNonce in the response matches the value the SHA-256 was taken over at mint time; both are 43 chars no padding).
- hypothesis: Mobile-side string mutation in apiClient between /auth/nonce response and /auth/google request body — ELIMINATED (decodedNonce string contains the verbatim minted value plus only Google's added padding, proving the nonce travels through the mobile pipeline + Play Integrity round-trip without any other mutation).
- hypothesis: Hash function/encoding mismatch in nonce-store.ts — ELIMINATED (sha256Hex is single-source; both inputs go through it identically; the only divergence is the padding).
- hypothesis: Race / multi-tap concurrent /auth/nonce calls — ELIMINATED (nonceId matched between mint and consume; only one mint preceded the consume).

## Resolution

**Root cause.** Play Integrity Classic API re-pads URL-safe-base64 nonces to standard-base64 length before embedding them in `tokenPayloadExternal.requestDetails.nonce`. The backend mints `randomBytes(32).toString('base64url')` (43 chars, no padding) but the decoded payload comes back with the standard `=` padding restored (44 chars). `sha256(<unpadded>) !== sha256(<padded>)` → every legitimate sign-in 401s with `Nonce check: mismatch`. This is hypothesis 1 from the Current Focus, confirmed empirically.

**Fix.** `apps/api/src/auth/nonce-store.ts:36` — strip trailing `=` from the candidate nonce before hashing in `consumeNonce`:

```ts
const candHash = sha256Hex(opts.candidateNonce.replace(/=+$/, ''));
```

Documented as **Pattern 58** with full rationale in the kdoc above the function. Safe because base64 padding carries no information — 32 bytes always encode to exactly 43 base64url chars or 44 base64 chars with one `=`. An attacker cannot manufacture a different preimage that hashes to the same value by adding/removing padding.

**Commit.** `8b13d23 fix(02-21): normalize Play Integrity nonce padding before SHA-256 compare` — atomic, single-file backend change + .gitignore SA-key safety patterns. Pre-commit lint-staged + typecheck both passed.

**Verification (live, 2026-05-10).** After fix landed and dev API restarted, the next sign-in attempt on Pixel 10a returned `/auth/google` 200 in 667ms with `integrity_verdict: bypassed_apk` (apkRollout three-gate bypass per plan 01-05 Pattern 17). App advanced to Permissions screen — first successful sign-in past plan 01-13's `code-ready-smoke-deferred` gate.

**Files changed.**

- `apps/api/src/auth/nonce-store.ts` — Pattern 58 normalization (committed in 8b13d23)
- `.gitignore` — added Google Cloud SA-key JSON patterns (`*-iam.gserviceaccount.com.json`, `*-<12-hex>.json`) (committed in 8b13d23)

**Diagnostic logs reverted before commit** — `apps/api/src/routes/auth/nonce.ts` + `apps/api/src/routes/auth/google.ts` returned to their pre-debug shape; `git diff apps/api/src/routes/auth/` was clean before the commit landed.

**Sequence of subsequent blockers** (this debug session unblocked the auth-decode wall but several more layers surfaced — all cleared the same day):

1. After this fix: backend SA decode failed because `PLAY_INTEGRITY_SA_KEY_JSON` was empty → operator created service account `humyn-play-integrity-decode@homelander-24045.iam.gserviceaccount.com` + JSON key inlined into `apps/api/.env`.
2. After SA key: `/auth/google` 403 with `integrity-install-source` because `REMOTE_CONFIG_JSON` was empty → operator added the apkRollout bypass JSON (commit `8f4dc57` documents the env recipe).
3. After REMOTE_CONFIG_JSON: sign-in fully passed → app advanced to Permissions → Compat → IMU probe SecurityException (separate bug, fixed in commit `cc867b7`).
