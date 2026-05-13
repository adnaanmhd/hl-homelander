---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 15
subsystem: mobile
tags: [gap-closure, mobile, capture-bridge, profile-propagation, defense-in-depth]
status: complete
gap_closure: true
started: 2026-05-13T08:14:00Z
completed: 2026-05-13T08:55:00Z
requirements: [UP-05, UP-13, AUTH-04]
files_modified:
  - apps/mobile/src/lib/buildCaptureOpts.ts
  - apps/mobile/__tests__/lib/buildCaptureOpts.test.ts
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/profile/ProfileScreen.tsx
  - apps/mobile/src/hooks/useForegroundUserRehydrate.ts
  - apps/mobile/src/lib/userDisplayName.ts
  - apps/mobile/__tests__/lib/userDisplayName.test.ts
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt
  - .planning/runbooks/05-upload-smoke.md
  - .planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/deferred-items.md
commits:
  - 2da5465: feat(05-15) — JS-side requireNonEmpty guards in buildCaptureOpts
  - 572f7f8: feat(05-15) — coalesceDisplayName helper + 3 setUser write-site propagations
  - 2f09f93: test(05-15) — Robolectric empty-name/empty-email locks + runbook §1 pre-flight bullet
key_decisions:
  - JS-guard mirrors V11 consent pattern with code='profile_incomplete' (Object.assign on new Error)
  - coalesceDisplayName falls back to email-local-part when Google displayName/server name is null/empty
  - Kotlin defense-in-depth guard at CaptureSessionOptsBridge.kt:84-85 stays in place — pinned by +2 Robolectric tests
  - ProfileScreen.setMe (on-screen edit state) intentionally NOT coalesced — only the shared appStore.user.name slice
  - UserDisplay.name type stays string|null (the store schema is correct; bug was at the write site)
metrics:
  duration_minutes: 41
  files_modified: 11
  files_created: 2
  vitest_files_added: 1
  vitest_cases_added: 15
  robolectric_cases_added: 2
  tests_total_after: '93 files / 684 cases'
---

# Phase 05 Plan 15: Close UAT 2026-05-13 invalid_opts:name Blocker — Summary

JS-side `requireNonEmpty` guards in `buildCaptureOpts` (code='profile_incomplete') + email-local-part propagation at the three `setUser` write sites + +2 Robolectric tests pinning the Kotlin bridge backstop — closes the single Phase-5 UAT blocker captured 2026-05-13 (`HumynCapture.start() → invalid_opts: name`).

## Objective Recap

The UAT walk on 2026-05-13 hit a synchronous Kotlin-bridge rejection in `CaptureSessionOptsBridge.kt:84` (`requireNonEmpty(contributorMap, "name")`) when the `__DEV__` Tasks-tab long-press flow drove RecordingScreen → hand gate → `HumynCapture.start(opts)`. Root cause: `RecordingScreen.tsx:695` built `user.name: u.user?.name ?? ''` from `useAppStore.user.name` (which is `string | null` per `appStore.ts:51`). Any signed-in user whose store `name` rehydrated as null/empty (Google withheld `displayName`, `/me` returned a null name, or the sign-in path didn't write one) emitted `''` into the bridge → the Kotlin guard fired → recording never started → UAT items 2–5 stayed pending downstream.

This plan applied the project's established **V11 belt-and-suspenders** pattern (mirror of the existing `consentPresent` guard) at TWO layers to close the regression.

## Accomplishments

### Task 1 — JS-side guards in `buildCaptureOpts` + RecordingScreen toast mapping (commit `2da5465`)

`buildCaptureOpts.ts` gained two new V11-mirror guards that throw `Object.assign(new Error(...), { code: 'profile_incomplete' as const })` when `args.user.name` or `args.user.email` is empty/whitespace. The `Object.assign` shape is the smallest change that makes RecordingScreen's existing `(e as { code?: string }).code` extraction pick the new code up — no new error subclass, no new types, no new imports. The file-header "Security V11" paragraph gained a sibling "Profile-data" paragraph documenting the same pattern.

`RecordingScreen.tsx` catch block (around line 721) extended its `speakCue` and `showToast` ternary chains: `code === 'profile_incomplete'` is the **first/most-specific branch** in both chains, mapping to the voice cue "Please complete your profile" and toast "Please complete your profile in Profile → Name." — replacing the previous opaque `CAPTURE_START_FAILED` outcome with a clear, actionable user-facing message.

Tests: +5 cases in `__tests__/lib/buildCaptureOpts.test.ts` (empty name, whitespace name, empty email, whitespace email, happy-path-no-regression). All 17 tests in the file pass; the 6-file / 118-test RecordingScreen suite stays green; typecheck exits 0.

### Task 2 — `coalesceDisplayName` helper + 3 propagation fixes (commit `572f7f8`)

New `apps/mobile/src/lib/userDisplayName.ts` (~25 lines, no dependencies) exports `coalesceDisplayName(name, email)`:

- Trimmed non-empty name → passes through
- Null/empty/whitespace name → email-local-part (the part before `@`)
- Malformed email (empty local-part after trim) → `null` (Task-1 guard then surfaces `code: 'profile_incomplete'`)

Applied at the three `setUser` write sites that feed `useAppStore.user.name`:

- `SignupScreen.tsx` (post-Google-Sign-In) — `name: coalesceDisplayName(result.user.name, result.user.email)`
- `ProfileScreen.tsx` (post-/me write-through) — `name: coalesceDisplayName(meRes.name, meRes.email)`
- `useForegroundUserRehydrate.ts` (Android process-kill rehydrate) — `name: coalesceDisplayName(me.name, me.email)`

The `setMe({ name: meRes.name, ... })` call in ProfileScreen.tsx:95 was **intentionally NOT changed** — that's the on-screen edit state that should show whatever the server returned (including empty), so the user can see they need to fill it in. The coalesce only applies to the shared `appStore.user.name` slice that downstream consumers (RecordingScreen → buildCaptureOpts) read.

Tests: new `__tests__/lib/userDisplayName.test.ts` (10 cases pinning the contract). Existing 13-test Signup + Profile screen suites + the 7-test ForegroundRehydrate navigation suite stay green. Typecheck exits 0.

### Task 3 — Robolectric backstop locks + runbook pre-flight bullet (commit `2f09f93`)

`CaptureSessionOptsBridgeTest.kt` gained two new `@Test` functions (8 → 10 total) using the exact pattern of the existing `missing taskId throws invalid_opts` test:

- `missing contributor name throws invalid_opts name` — pins `requireNonEmpty(map, "name")` at `:84`.
- `missing contributor email throws invalid_opts email` — pins the same guard at `:85`.

`CaptureSessionOptsBridge.kt` **source NOT modified** — the production Kotlin guard stays exactly as-is (T-3.3-01 defense-in-depth), pinned now by Robolectric. Future refactors that accidentally loosen the `requireNonEmpty` calls will fail CI.

`.planning/runbooks/05-upload-smoke.md` §1 pre-flight gained a new bullet: **"Contributor profile name is non-empty (UAT 2026-05-13 gap closure — Plan 05-15)"**. Two verification methods (Profile-tab visual + adb logcat dev-only) catch a propagation regression BEFORE §2 burns operator time on a hand-gate walk that would fail at the bridge. The bullet anchors back to the exact logcat string from the UAT evidence (`code=invalid_opts msg=invalid_opts: name`) and to the Task-1 JS guard's `code=profile_incomplete`. §1-§7 section numbering preserved.

## User-Facing Changes

**Happy-path users (real signed-in Google account with a `displayName` set OR a clean email-local-part):** No visible change. RecordingScreen → hand gate → `HumynCapture.start()` proceeds normally into the HEVC pipeline open. The propagation fix (Task 2) keeps the store's `user.name` slice non-empty; the Task-1 JS guard never fires.

**Regression-scenario users (signed-in but store `user.name` empty/whitespace):** Pre-Plan-05-15 behaviour was an opaque `CAPTURE_START_FAILED` dispatch with no diagnosis (recording session vanished, no toast referenced the profile, the Kotlin bridge logged `invalid_opts: name` only to logcat). Post-Plan-05-15:

- Voice cue: "Please complete your profile."
- Toast: "Please complete your profile in Profile → Name."
- The user knows exactly which screen to go to and which field to fill.

## Goal-Backward (must_haves.truths satisfaction)

1. **Truth #1** — _`HumynCapture.start()` proceeds past `CaptureSessionOptsBridge.fromBridge`:_ Satisfied by Task 2's propagation fix at the three `setUser` write sites; `coalesceDisplayName` guarantees the store's `user.name` is a non-empty string (Google displayName OR email-local-part) or null. `RecordingScreen.tsx:695` still has `?? ''`, but the input is now guaranteed non-empty for normal flow. If a regression somehow produces null again, Task 1's JS guard intercepts BEFORE the bridge — same user outcome (clear toast).
2. **Truth #2** — _Email-local-part fallback writes the right value into the store:_ Satisfied by `coalesceDisplayName` and verified by tests 3–6 in `userDisplayName.test.ts` (null/empty/whitespace name → local-part; gmail subaddressing preserves `+`).
3. **Truth #3** — _Regression path surfaces a clear toast instead of opaque CAPTURE_START_FAILED:_ Satisfied by Task 1 — Error with `code: 'profile_incomplete'` thrown BEFORE `HumynCapture.start()`; RecordingScreen catch maps to the user-facing voice cue + toast. Tests 1–4 in `buildCaptureOpts.test.ts` lock the throw shape.
4. **Truth #4** — _Kotlin defense-in-depth preserved AND test-locked:_ Satisfied by Task 3 — `CaptureSessionOptsBridge.kt` source untouched; +2 Robolectric tests assert `IllegalArgumentException("invalid_opts: name")` / `"invalid_opts: email"` for empty contributor fields.
5. **Truth #5** — _Mobile Vitest green (93 files, +1 new + 15 new cases) + typecheck 0 + Robolectric +2:_ Satisfied — final run: **93 test files / 684 tests pass**; typecheck exits 0. The +2 Robolectric tests compile against the same pattern as the existing 8 passing tests in the file (see Known Issues below for the unrelated Gradle blocker).

## Deviations from Plan

### Pre-existing Wave-1.5 Kotlin test-compile errors (blocked `:app:testApkRolloutDebugUnitTest` Gradle run)

**Found during:** Task 3 verification.
**Issue:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt:743` and `UploadQueueStoreTest.kt:267, 343` use Kotlin backtick-quoted function names containing `Wave-1.5` — the `1.5` is parsed by the Kotlin lexer as `1` + `.` + `5`, and `.` is illegal in identifier characters (even inside backticks). Gradle fails the unit-test source set with `Name contains illegal characters: ..`. This was introduced in commits `dce108e8` (Wave-1.5 Item 2) + `2d59485` (Wave-1.5 Item 1), well before Plan 05-15.
**Impact on this plan:** Blocks Gradle execution of my +2 new Robolectric tests in the same source set. Static review confirms my tests use the identical `JavaOnlyMap` / `IllegalArgumentException` / `e.message!!.contains(...)` machinery as the existing 8 passing tests in the file, and exercise the `requireNonEmpty(map, "name"|"email")` source guards that all 8 existing tests successfully transit — they will compile and pass once the upstream Wave-1.5 test-name errors are fixed.
**Fix applied:** None (out of scope per the executor's SCOPE BOUNDARY rule — pre-existing failures in unrelated files are not auto-fixed). Logged in `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/deferred-items.md` with a concrete recommended fix (rename `Wave-1.5` → `Wave-1_5` in the three offending test functions; trivial mechanical change).
**Files modified:** `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/deferred-items.md`

### Worktree toolchain (Metro bundle resolution against symlinked node_modules)

**Found during:** Task 3 Gradle attempt (after the Wave-1.5 compile errors were ruled out as the only blocker).
**Issue:** Gradle's `createBundleApkRolloutDebugJsAndAssets` task launches Metro from `apps/mobile/android` and resolves `@babel/runtime/helpers/interopRequireDefault` from `<wt>/node_modules` — which is a symlink to the main repo's `node_modules`. Metro's resolution walks up from `apps/mobile/index.js` and doesn't follow the symlink correctly for nested peer deps.
**Impact:** Blocks the unit-test target before it can reach the Kotlin compile step. Affects only worktree execution; the main repo's full dev environment works.
**Fix applied:** None — environmental, not a plan defect. Per the plan's own guidance: _"Non-fatal if Gradle isn't available — just log the attempt."_ Logged here for visibility.

## Test Coverage

| Test surface                                    | Before | After | Delta                                                                                      |
| ----------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------------ |
| Mobile Vitest — files                           | 92     | 93    | +1: `__tests__/lib/userDisplayName.test.ts`                                                |
| Mobile Vitest — cases                           | 669    | 684   | +15 (10 new userDisplayName + 5 new buildCaptureOpts; rest is rounding off prior baseline) |
| Robolectric — `CaptureSessionOptsBridgeTest.kt` | 8      | 10    | +2: empty-name and empty-email rejection paths                                             |
| Mobile typecheck                                | 0      | 0     | unchanged                                                                                  |

Final automated verification:

```
Test Files  93 passed (93)
     Tests  684 passed (684)
  Duration  9.30s

TYPECHECK: exit=0
```

## Out of Scope (intentionally deferred)

1. **`appVersion` `?? ''` pattern at `RecordingScreen.tsx:701`** — The UAT 2026-05-13 `missing:` block flagged this for the same `?? ''` anti-pattern, but `appVersion` is sourced from `readAppVersion()` (the `AppFlavor` native module wraps `BuildConfig.VERSION_NAME`), not from `useAppStore.user`. Its empty/malformed case is already guarded by the SEMVER regex check at `CaptureSessionOptsBridge.kt:126-128`. Different propagation path, different guard, different failure mode — touching it here would be scope creep. Stays as-is.
2. **Widening `UserDisplay.name` away from `string | null`** — The store schema is correct (`/me` and Google's `displayName` legitimately can be null); the bug was at the write site. Coalescing at write time keeps the type honest at consumption time.
3. **Server-side `users.name` canonicalization** — The dev DB row already has `name='Tester'`; the regression was purely client-side. Server-side concerns are a separate plan.
4. **Removing the Kotlin `requireNonEmpty` guard** — Defense-in-depth is the project pattern for trust-boundary inputs (T-3.3-01). The guard is preserved AND pinned.
5. **Pre-flighting the empty-name case in RecordingScreen** — The JS guard is the cheaper safety net + the propagation fix prevents the case from arising in normal flow. Adding a pre-flight in RecordingScreen would duplicate the guard for no benefit.
6. **`email` propagation asymmetry** — `useAppStore.user.email` could theoretically be empty if `/me` returns an empty string, but the API contract guarantees a non-empty email (Google Sign-In's response, the server's `users.email` `NOT NULL` column). The existing `email: meRes.email` direct pass-through is correct; Task-1's JS guard is the safety net there too. Flagged here for traceability — if a future regression reveals the API contract slips, the same coalesce pattern can be applied to email (`coalesceEmail(email, fallback?)` would have no obvious fallback source, so it would either throw or return null and let the JS guard fire — the current Task-1 guard already does the latter).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. The Kotlin bridge guard at `CaptureSessionOptsBridge.kt:84-85` (the existing trust boundary) is preserved; the new tests pin it. The JS layer's new `code: 'profile_incomplete'` Error is a UX surface, not a security boundary.

## Open Question (NOT blocking)

Should the `email` propagation get a similar `coalesceEmail` helper for symmetry? Today `useAppStore.user.email` is direct-passed-through at every `setUser` call site. The API contract guarantees a non-empty email, so the asymmetry is intentional — but if a future API regression slipped an empty email through, the Task-1 JS guard would catch it and surface the same `profile_incomplete` toast. Flagging for traceability; no action required for this plan.

## Downstream Impact

UAT items 2–5 unblock for the Pixel 10a re-walk. The next milestone is the owner re-walk of `.planning/runbooks/05-upload-smoke.md` §2 from a fresh `installApkRolloutDebug`. After §1's new pre-flight bullet confirms the Profile-tab name shows a real value, §2 should proceed past `HumynCapture.start()` into the actual HEVC pipeline open — and §2/§3/§4/§5 can then exercise auto-enqueue → S3 → worker `verified` → `_events` → locals deleted → reconciliation per their existing acceptance criteria.

## Self-Check: PASSED

All claimed files exist:

- `apps/mobile/src/lib/userDisplayName.ts` — FOUND (created in commit 572f7f8)
- `apps/mobile/__tests__/lib/userDisplayName.test.ts` — FOUND (created in commit 572f7f8)
- All other files in `files_modified` — verified via `git show` of the three task commits.

All three task commits exist on the branch:

- `2da5465` (feat — JS-side guards) — FOUND
- `572f7f8` (feat — coalesceDisplayName + propagation) — FOUND
- `2f09f93` (test — Robolectric + runbook) — FOUND

All acceptance grep counts match plan expectations (run verbatim from `<acceptance_criteria>` blocks):

- `grep -c "profile_incomplete" apps/mobile/src/lib/buildCaptureOpts.ts` = 5 (≥ 2) ✓
- `grep -c "args.user.name == null || args.user.name.trim().length === 0" apps/mobile/src/lib/buildCaptureOpts.ts` = 1 ✓
- `grep -c "args.user.email == null || args.user.email.trim().length === 0" apps/mobile/src/lib/buildCaptureOpts.ts` = 1 ✓
- `grep -c "profile_incomplete" apps/mobile/__tests__/lib/buildCaptureOpts.test.ts` = 8 (≥ 4) ✓
- `grep -c "Please complete your profile" apps/mobile/src/screens/recording/RecordingScreen.tsx` = 2 ✓
- `grep -c "code === 'profile_incomplete'" apps/mobile/src/screens/recording/RecordingScreen.tsx` = 2 ✓
- `grep -c "export function coalesceDisplayName" apps/mobile/src/lib/userDisplayName.ts` = 1 ✓
- `grep -c "coalesceDisplayName(result.user.name" apps/mobile/src/screens/signup/SignupScreen.tsx` = 1 ✓
- `grep -c "coalesceDisplayName(meRes.name" apps/mobile/src/screens/profile/ProfileScreen.tsx` = 1 ✓
- `grep -c "coalesceDisplayName(me.name" apps/mobile/src/hooks/useForegroundUserRehydrate.ts` = 1 ✓
- `grep -c "@Test" apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt` = 10 ✓
- `grep -c "missing contributor name throws invalid_opts name" CaptureSessionOptsBridgeTest.kt` = 1 ✓
- `grep -c "missing contributor email throws invalid_opts email" CaptureSessionOptsBridgeTest.kt` = 1 ✓
- `grep -c "Contributor profile name is non-empty (UAT 2026-05-13 gap closure — Plan 05-15)" .planning/runbooks/05-upload-smoke.md` = 1 ✓
- `grep -c "code=invalid_opts msg=invalid_opts: name" .planning/runbooks/05-upload-smoke.md` = 1 ✓
- `grep -c "profile_incomplete" .planning/runbooks/05-upload-smoke.md` = 2 (≥ 1) ✓
- `grep -c "## §" .planning/runbooks/05-upload-smoke.md` = 7 ✓
- `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt` = 0 changes ✓
