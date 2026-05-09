---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 19
subsystem: auth
tags: [react-native, react-navigation, auth, soft-delete, idempotency-key, mmkv, vitest]

requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 02-09 auth.signOut scaffold + signOut helper exported from services/auth.ts
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 02-17 ProfileScreen rows that navigate to LogoutModal / DeleteAccountModal route names + profileService.ts surface
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 02-05 RootNativeStack sibling-route navigator graph (HOME-08 structural)
  - phase: 01-foundation-backend-distribution-recon
    provides: 01-08 DELETE /me?confirm=DELETE backend route with MeDeleteQuerySchema validation, /me/restore endpoint, per-applicationId rate-limit (5/min)
provides:
  - LogoutModal component (design-spec §18.3 verbatim, transparent-modal route)
  - DeleteAccountModal component (design-spec §18.4 two-step typing gate)
  - auth.signOut extended to clear onboarding flags while preserving device-bound state
  - profileService.deleteMe wires DELETE /me?confirm=DELETE with Idempotency-Key
  - apiClient.delete (DELETE verb sibling of patch / postMultipart)
affects:
  - Phase 02 plan 02-21 (manual smoke gate — exercise both modals end-to-end on a real device)
  - Phase 5 (upload pipeline) — auth.signOut documented seam for cancelInFlightUpload + preserveQueue

tech-stack:
  added: []
  patterns:
    - "transparent-modal route registration in RootNativeStack (presentation: 'transparentModal', gestureEnabled: false, animation: 'fade')"
    - "two-step confirm modal with typed-confirmation gate, modeled on §18.4 case-sensitive 'DELETE' literal"
    - 'vi.hoisted spy pattern for vi.mock factories that close over per-test fns'
    - 'per-file react-native shim with Alert.alert spy for components that call Alert'
    - 'device-bound vs user-bound MMKV-key distinction documented inline in auth.signOut'

key-files:
  created:
    - apps/mobile/src/components/LogoutModal.tsx
    - apps/mobile/src/components/DeleteAccountModal.tsx
    - apps/mobile/__tests__/components/LogoutModal.test.tsx
    - apps/mobile/__tests__/components/DeleteAccountModal.test.tsx
    - apps/mobile/__tests__/services/auth.signOut.test.ts
    - apps/mobile/__tests__/services/profileService.deleteMe.test.ts
  modified:
    - apps/mobile/src/services/auth.ts (signOut now clears onboarding.* keys, preserves device-bound)
    - apps/mobile/src/services/profileService.ts (added deleteMe)
    - apps/mobile/src/services/api.ts (added DELETE verb to ApiClient interface + impl)
    - apps/mobile/src/navigation/RootNativeStack.tsx (registered LogoutModal + DeleteAccountModal as transparent-modal siblings)

key-decisions:
  - 'auth.signOut clears auth.jwt.v1 + onboarding.* keys but PRESERVES compat.lastResult.v1, installation_id.v1, telemetry.ring.v1, appVersion.cache.v1 — those are device-bound, not user-bound; same-device re-login should not have to re-run the 30-second compat probe (CONTEXT decisions).'
  - 'apiClient.delete added as the third-pillar HTTP verb wrapper alongside patch and postMultipart; mirrors their Idempotency-Key header forwarding semantics. Reusable for any future client-issued DELETE (e.g., cancel-recording, dismiss-feedback).'
  - "DeleteAccountModal performs an additional defensive equality check inside the onPress handler (typed === 'DELETE') in addition to the disabled-button rendering — defends against automation tools that bypass the disabled state."
  - "Defense-in-depth on AUTH-10 typing gate: client-side gate is UX-level (typed === 'DELETE'); backend Phase 1 plan 01-08 is binding (?confirm=DELETE enforced by MeDeleteQuerySchema)."
  - "RootNativeStack uses presentation: 'transparentModal' (not 'modal') for both Logout/Delete modals so the underlying Profile screen stays visible behind the 50% scrim — matches design-spec §18 modal-style."

patterns-established:
  - "Pattern 47: vi.hoisted spy binding for vi.mock factories — vi.mock factories are hoisted above all imports, so closures over const declarations race the hoist and throw 'Cannot access X before initialization'. Wrap the spy fns in vi.hoisted({ ... }) so they live in the same hoist-scope as the factory body. Used by LogoutModal.test.tsx and DeleteAccountModal.test.tsx; reusable for any future component test that mocks @react-navigation/native + a service module + react-native at once."
  - 'Pattern 48: device-bound vs user-bound MMKV-key contract — auth.ts signOut documents inline which keys are user-bound (cleared on logout) vs device-bound (preserved). Future onboarding/auth keys must declare which side of this contract they fall on; the inline comment is the canonical source until a separate KEYS_USER_BOUND vs KEYS_DEVICE_BOUND const is introduced.'

requirements-completed: [AUTH-08, AUTH-09, AUTH-10]

duration: 7min
completed: 2026-05-09
---

# Phase 2 Plan 19: LogoutModal + DeleteAccountModal (DELETE-typing gate) Summary

**Two transparent-modal Profile actions: §18.3 LogoutModal calls auth.signOut() (preserves device-bound compat result) and §18.4 DeleteAccountModal two-step typing gate calls profileService.deleteMe() (DELETE /me?confirm=DELETE with UUIDv4 idempotency-key); both reset navigation to Signup so the user must re-authenticate.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-09T13:35:55Z
- **Completed:** 2026-05-09T13:43:23Z
- **Tasks:** 3
- **Files modified:** 9 (4 created components + 4 created tests + 4 modified services/nav, with 1 file overlap)

## Accomplishments

- AUTH-08 closed: `auth.signOut()` clears JWT + every onboarding.\* MMKV key while explicitly preserving `compat.lastResult.v1`, `installation_id.v1`, `telemetry.ring.v1`, `appVersion.cache.v1` (device-bound vs user-bound contract documented inline).
- AUTH-09 closed: `profileService.deleteMe()` ships the 30-day soft-delete wire — DELETE /me?confirm=DELETE with a fresh UUIDv4 Idempotency-Key (Phase 1 API-15). Backend Phase 1 plan 01-08's `/me/restore` endpoint is the restore path; this plan ships only the client surface.
- AUTH-10 closed: DeleteAccountModal renders a two-step gate where Step 2 input must equal the literal string `DELETE` (case-sensitive); both the disabled-button rendering AND the onPress handler short-circuit if the equality fails.
- `apiClient.delete<T>(path, { query, headers, timeoutMs })` added as the third HTTP-verb wrapper alongside `patch` and `postMultipart` — same lower-cased-on-the-wire header forwarding, same AbortController timeout, same RFC 7807 error-message synthesis.
- Both modals registered in RootNativeStack as `presentation: 'transparentModal'` siblings of MainTabs, so the bottom tab bar is hidden while the confirm is open and the Profile screen stays visible behind the scrim.
- 23 plan-level vitest cases cover the contract end-to-end (6 auth.signOut + 4 deleteMe + 4 LogoutModal + 6 DeleteAccountModal + 3 RootNativeStack regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: auth.signOut + profileService.deleteMe + tests** - `e27d542` (feat)
2. **Task 2: LogoutModal — design-spec §18.3 + nav reset** - `78ca48e` (feat)
3. **Task 3: DeleteAccountModal — two-step DELETE-typing gate** - `23ac95c` (feat)

**Plan metadata:** _(filed in the next commit alongside SUMMARY + STATE updates)_

## Files Created/Modified

### Created

- `apps/mobile/src/components/LogoutModal.tsx` — design-spec §18.3 LogoutModal: verbatim "Log out?" / "You'll need to sign in again to keep contributing." copy, [Cancel | Log out] actions, signOut() + nav.reset to Signup on confirm.
- `apps/mobile/src/components/DeleteAccountModal.tsx` — design-spec §18.4 two-step delete with Step 2 typing gate (case-sensitive `DELETE` literal, AUTH-10).
- `apps/mobile/__tests__/components/LogoutModal.test.tsx` — 4 vitest cases (verbatim copy, modal label, cancel-no-signOut, log-out signOut+reset).
- `apps/mobile/__tests__/components/DeleteAccountModal.test.tsx` — 6 vitest cases (verbatim §18.4 step 1 + 2 advance + lowercase reject + happy path + cancel + rejection-keeps-modal).
- `apps/mobile/__tests__/services/auth.signOut.test.ts` — 6 vitest cases (cleared keys, preserved keys, store side-effect).
- `apps/mobile/__tests__/services/profileService.deleteMe.test.ts` — 4 vitest cases (path, query, idempotency-key, error propagation).

### Modified

- `apps/mobile/src/services/auth.ts` — extended `signOut()` to also clear ONBOARDING_CONSENT, ONBOARDING_PERMS_GRANTED, ONBOARDING_COMPAT_PASSED, ONBOARDING_TUTORIAL_DONE; documented every preserved device-bound key.
- `apps/mobile/src/services/profileService.ts` — added `deleteMe()` per AUTH-09 / AUTH-10 contract.
- `apps/mobile/src/services/api.ts` — added `DeleteOptions` type + `apiClient.delete<T>` impl.
- `apps/mobile/src/navigation/RootNativeStack.tsx` — registered `LogoutModal` and `DeleteAccountModal` as `presentation: 'transparentModal'` siblings; updated header doc-comment to reflect the new sibling list.

## Decisions Made

- **`compat.lastResult.v1` preserved on logout (CONTEXT decisions):** the compat signature embeds the device's `installation_id`, not the user's identity. A user logging out and re-signing-in on the same device should NOT have to re-run the 30-second compat probe; the next gate-decision-tree boot will trust the persisted compat-pass record. Documented inline with the same rationale in `auth.ts`.
- **`apiClient.delete` returns `T = void` for the deleteMe call site (DELETE /me returns 200 with empty body per Phase 1 MeDeleteResponseSchema).** The wrapper try-parses any response text and returns `undefined` for empty responses, which surfaces correctly as `Promise<void>` to the caller.
- **`presentation: 'transparentModal'` (not 'modal') for both new modals** — keeps the Profile screen visible behind the scrim and matches the design-spec §18 modal-card pattern. ForceUpgrade uses `presentation: 'modal'` because it's a full-screen takeover; logout/delete are dismissible confirmations.
- **`vi.hoisted` for spy binding in component tests** — vi.mock factories hoist above the import-section, so the previous `const fn = vi.fn(); vi.mock(..., () => ({ x: fn }))` pattern from older test files races the hoist and crashes with `Cannot access fn before initialization`. The hoist wrapper resolves it without losing the per-test reset semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `apiClient.delete` did not exist; plan body assumed it**

- **Found during:** Task 1 (profileService.deleteMe authoring)
- **Issue:** The plan body's deleteMe implementation calls `apiClient.delete('/me', { query, headers })`, but the existing ApiClient interface in `apps/mobile/src/services/api.ts` only exposed `post / postNoBody / get / getJson / patch / postMultipart` — no DELETE verb wrapper. Without adding it, `tsc --noEmit` would fail and the runtime call would throw "apiClient.delete is not a function".
- **Fix:** Added `DeleteOptions` interface + `apiClient.delete<T>` implementation that mirrors `patch`'s lower-cased-on-the-wire header forwarding and AbortController timeout, plus the response-parsing try/empty-fallback semantics from `postMultipart` (DELETE /me returns 200 with empty body so `T = void` resolves to `undefined`).
- **Files modified:** apps/mobile/src/services/api.ts
- **Verification:** Both `auth.signOut` and `profileService.deleteMe` test suites pass; `pnpm typecheck` clean.
- **Committed in:** e27d542 (Task 1 commit)

**2. [Rule 1 - Bug] Plan body's `signOut` example used `mmkv.delete(...)` but the singleton exposes `mmkv.remove(...)`**

- **Found during:** Task 1 (auth.signOut extension)
- **Issue:** The plan body's snippet calls `mmkv.delete('auth.jwt.v1')`. The `secureMmkv` singleton in `apps/mobile/src/state/mmkv.ts` is built on `react-native-mmkv` v4 (Nitro), whose `MMKV` interface exposes `remove(key)` / `set(key,val)` / `getString(key)` etc. — there is no `.delete(...)` method (and the canonical vitest mock in vitest.setup.ts also exposes `remove`). Using `.delete` would have crashed at runtime + failed the test suite.
- **Fix:** Used `mmkv.remove(KEYS.AUTH_JWT)` etc., consistent with the existing `clearStoredJwt()` helper in the same file (the function this signOut intentionally subsumes).
- **Files modified:** apps/mobile/src/services/auth.ts
- **Verification:** `auth.signOut.test.ts` 6/6 pass; existing `appStore.test.ts` Test-3 (signOut clears JWT) still green.
- **Committed in:** e27d542 (Task 1 commit)

**3. [Rule 1 - Bug] Plan body's deleteMe example used `ulid()` but mobile dep tree ships `react-native-uuid` only**

- **Found during:** Task 1 (profileService.deleteMe authoring)
- **Issue:** The plan body imports `ulid` from `'ulid'`. That dependency is not in `apps/mobile/package.json` and was deliberately excluded in plan 02-17 — the mobile bundle was kept single-key-library on `react-native-uuid` (UUIDv4) since Phase 1's idempotency contract treats the key as opaque. Importing ulid would fail Metro bundling + tsc.
- **Fix:** Used `uuid.v4() as string` — same pattern as the already-present `patchMe` and `submitFeedback` (Phase 2 plans 02-17 and 02-18). The fixed-uuid mock in `profileService.deleteMe.test.ts` mirrors the existing `profileService.test.ts` and `feedbackService.test.ts` mocks.
- **Files modified:** apps/mobile/src/services/profileService.ts
- **Verification:** `profileService.deleteMe.test.ts` 4/4 pass; existing `profileService.test.ts` (5 cases) still green.
- **Committed in:** e27d542 (Task 1 commit)

**4. [Rule 3 - Blocking] `vi.mock` hoist conflict in LogoutModal.test.tsx**

- **Found during:** Task 2 (LogoutModal.test.tsx authoring)
- **Issue:** The plan body's test snippet declares `const goBackFn = vi.fn()` then closes over it inside `vi.mock(...)` factory body. vi.mock factories are hoisted above all imports, so the closure resolves to a TDZ reference and the test file fails to load with `Cannot access 'signOutFn' before initialization`. (Reproduced verbatim on first run.)
- **Fix:** Wrapped the spies in `vi.hoisted({ goBackFn, resetFn, signOutFn })` so they live in the same hoist-scope as the factory bodies. Same pattern is used in `ReportProblemSheet.test.tsx`.
- **Files modified:** apps/mobile/**tests**/components/LogoutModal.test.tsx
- **Verification:** LogoutModal 4/4 pass after the fix.
- **Committed in:** 78ca48e (Task 2 commit)

**5. [Rule 1 - Bug] Plan body's snippet used `Text variant="btnLabel"` for modal title sizing**

- **Found during:** Task 2 (LogoutModal authoring) and Task 3 (DeleteAccountModal authoring)
- **Issue:** The plan body's snippets use `<Text variant="btnLabel" style={styles.title}>` for the modal title. The `btnLabel` typography variant is sized for in-button labels (16px / 700 weight) per design-spec §0.2 — modal titles per design-spec §0.2 are `sheetTitle` (24px / 700 weight). Using btnLabel would visually under-size the modal title.
- **Fix:** Switched both modals to `<Text variant="sheetTitle">` for the title line, matching design-spec §0.2 modal-card title typography. Body text stays at `variant="body"`.
- **Files modified:** apps/mobile/src/components/LogoutModal.tsx, apps/mobile/src/components/DeleteAccountModal.tsx
- **Verification:** Tests still pass (the assertion is on text content, not typography); no hex literals introduced.
- **Committed in:** 78ca48e (Task 2) and 23ac95c (Task 3)

---

**Total deviations:** 5 auto-fixed (3 Rule 1 — bug fixes for plan-snippet API mismatches + design-token mis-pick; 2 Rule 3 — blocking dependencies: missing apiClient.delete + vi.mock hoist conflict)
**Impact on plan:** All five auto-fixes were necessary for correctness or to compile the snippets the plan body demanded. None changed the AUTH-08 / AUTH-09 / AUTH-10 contract surface; in fact, they hardened it (apiClient.delete is now reusable, modal titles match the design spec). No scope creep.

## Issues Encountered

None — execution was linear: Task 1 (services) → Task 2 (LogoutModal + nav) → Task 3 (DeleteAccountModal + nav). Pre-commit lint-staged + tsc --noEmit ran clean on every commit. Full mobile vitest suite finishes 203/203 green.

## User Setup Required

None — this plan is fully on-device + mocked. The real DELETE /me round-trip is exercised against the Phase 1 backend by plan 02-21 (manual smoke gate) on a real device.

## Next Phase Readiness

- All AUTH-08 / AUTH-09 / AUTH-10 client surfaces complete and unit-tested.
- Phase 02 wave 4 has one plan remaining (02-21 manual-smoke gate). The smoke runbook should exercise: sign in → Profile → Logout → land on Sign-up; sign in again → Profile → Delete → step 1 → Continue → type lowercase 'delete' (Confirm rejected) → type 'DELETE' (Confirm fires DELETE /me) → land on Sign-up; cold-start app, sign in within 30 days → restore behavior comes through (Phase 1 plan 01-08 server-side).
- Phase 5 (upload pipeline) inherits a documented seam in `auth.signOut`: the `// TODO Phase 5: cancelInFlightUpload(); preserveQueueForResumeOnReLogin();` comment is the explicit boundary handoff per CONTEXT.md "Phase Boundary — Logout placeholder hook".
- `apiClient.delete` is now available as a reusable third-pillar HTTP-verb wrapper for any future plan needing client-issued DELETE (e.g., cancel-recording, dismiss-feedback in Phase 5+).

## Self-Check: PASSED

Verification steps run after writing this SUMMARY:

- `[ -f apps/mobile/src/components/LogoutModal.tsx ]` → FOUND
- `[ -f apps/mobile/src/components/DeleteAccountModal.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/components/LogoutModal.test.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/components/DeleteAccountModal.test.tsx ]` → FOUND
- `[ -f apps/mobile/__tests__/services/auth.signOut.test.ts ]` → FOUND
- `[ -f apps/mobile/__tests__/services/profileService.deleteMe.test.ts ]` → FOUND
- `git log --oneline | grep -q 'e27d542'` → FOUND (Task 1)
- `git log --oneline | grep -q '78ca48e'` → FOUND (Task 2)
- `git log --oneline | grep -q '23ac95c'` → FOUND (Task 3)
- `cd apps/mobile && npx vitest run LogoutModal DeleteAccountModal auth.signOut profileService.deleteMe RootNativeStack` → 23/23 pass
- `cd apps/mobile && npx vitest run` → 203/203 pass
- `grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/LogoutModal.tsx` → 0 matches (no hex literals)
- `grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/DeleteAccountModal.tsx` → 0 matches (no hex literals)

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
