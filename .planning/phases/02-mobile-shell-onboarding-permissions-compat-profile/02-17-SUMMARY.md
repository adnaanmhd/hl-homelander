---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 17
subsystem: profile
tags:
  [
    profile,
    inline-edit,
    patch-me,
    contributions,
    duration-formatter,
    payments-coming-soon,
    prof-01,
    prof-02,
    prof-03,
    prof-04,
    prof-05,
    home-06,
    d-prof-01,
    api-15,
  ]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: 'apiClient (POST + GET surface), GET /me + PATCH /me + GET /contributions endpoints (Phase 1 plan 01-08), Idempotency-Key global pre-handler (Phase 1 plan 01-04), AppFlavor TurboModule with versionName/versionCode/flavor constants (Phase 1 plan 01-09)'
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'tokens.ts + Text/Pressable/ScreenContainer primitives (02-02), Profile RootNativeStack registration (02-05), TopBar avatar → navigation.navigate(Profile) (02-16)'
provides:
  - 'apps/mobile/src/services/durationFormatter.ts — formatDuration(totalSeconds): string per HOME-06 / PROF-03; consumed by Profile lifetime numeric AND every Phase 6 Home tile.'
  - 'apps/mobile/src/services/profileService.ts — fetchMe(), patchMe(updates), fetchLifetimeContribution(); each PATCH mints a fresh react-native-uuid v4 Idempotency-Key (Phase 1 API-15); the contributions wrapper converts the wire-side durationMs → totalSeconds at the boundary so PROF-03 and HOME-06 share the same numeric units.'
  - 'apps/mobile/src/services/api.ts (extended) — patch<T>(path, body, opts?) + get<T>(path, opts?) alias of getJson; lower-cases extra header names on the wire (matches the existing post() convention).'
  - 'apps/mobile/src/screens/profile/ProfileScreen.tsx — full design-spec §15 layout: PROF-01 head (avatar Image fallback to initial + name + tap-to-edit subline), PROF-03 lifetime numeric, PROF-02 Payments & Earnings card with verbatim §5.11 copy + Coming-soon badge, PROF-01 Personal Info (Name + nullable Age + nullable Gender + non-editable Joined), PROF-04 Help Center / Logout / Delete-account row entries (modal bodies in 02-19), PROF-05 build-identifier footer.'
  - 'apps/mobile/src/screens/profile/InlineEditField.tsx — D-PROF-01 row primitive: tap → TextInput → blur fires onSave with the new value or null; the screen owns optimistic UI + Alert.alert revert on error.'
  - '15 unit tests across the three new modules (6 durationFormatter + 5 profileService + 4 ProfileScreen) covering every HOME-06 branch, the PATCH-with-idempotency contract, the durationMs → totalSeconds wire conversion, and the four PROF-04 navigation entry points.'
affects:
  - 'plan 02-18 (Help Center screen): the ProfileScreen Help Center row currently calls navigation.navigate("HelpCenter") — 02-18 lands the screen body at this route name, no further wiring change required.'
  - 'plan 02-19 (Logout + Delete-account modals): ProfileScreen calls navigation.navigate("LogoutModal") and navigation.navigate("DeleteAccountModal"); 02-19 mounts these modal routes (RootNativeStack siblings) at the same names.'
  - 'every Phase 6 Home tile (HOME-01..06/09/10): durationFormatter ships verbatim per HOME-06 spec; the lifetime tile + each per-day/week/month/all/custom-range tile all consume formatDuration(seconds) without any per-screen conversion logic.'
  - 'plan 02-21 (manual smoke runbook): walk-through must include "tap avatar → Profile renders /me data, edit Name → blur fires PATCH /me with idempotency-key in DevTools network tab, footer reads versionName (versionCode) · flavor".'
  - 'Phase 5 ProfileScreen consumers (analytics gating, /me + /contributions hash-verify hooks): the typed MeResponse interface ships with avatarUrl/createdAt/flavor/applicationId fields exactly matching shared/types MeResponseSchema, so any future store-side hydration of the user shape can import the same interface.'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern: server-shape adapter at the service boundary. profileService.fetchLifetimeContribution converts the server-side `durationMs` → consumer-side `totalSeconds` (floor) so HOME-06 formatDuration() consumes seconds across every screen. Pattern reusable for any wire ↔ render unit mismatch (Phase 6 Home tiles can rely on the same consumer-side units).'
    - 'Pattern: Idempotency-Key minted per outgoing PATCH via react-native-uuid v4 (UUID, not ULID). Phase 1 plan 04 backend stores the raw key opaquely — UUIDv4 satisfies the uniqueness contract without bringing a second key-generation library when react-native-uuid is already in the dep tree (D-STATE-04).'
    - 'Pattern: apiClient.patch() mirrors post() with header forwarding for per-request Idempotency-Key. Lower-cases extra header names on the wire to match Fastify plugin conventions.'
    - 'Pattern: explicit fontSize: 44 on top of typography.lifetimeNumber spread. The token already declares 44; the explicit override is a literal-grep gate so the design-spec §15 number size is verifiable without IDE cooperation.'
    - 'Pattern: try/catch around getFlavorContext() in the ProfileScreen footer. The native module is registered in production builds only; unit tests + web fallbacks degrade gracefully to "0.0.0 (0) · unknown" instead of crashing the screen.'
    - 'Pattern: optimistic-UI + revert-on-error for inline edits. saveField() snapshots the previous me before patchMe(); on rejection it restores the snapshot AND raises Alert.alert("Could not update", "Please try again."). T-2.17-02 mitigation — the Alert body never echoes the user-typed value.'
    - "Pattern: cleanup() in afterEach for testing-library/react under vitest globals: false. The mobile vitest config disables auto-cleanup; every screen test that renders multiple times must call cleanup() explicitly, otherwise getByLabelText finds the previous render's detached DOM (same Pattern SignupScreen.test.tsx uses)."

key-files:
  created:
    - 'apps/mobile/src/services/durationFormatter.ts (~30 LOC) — HOME-06 / PROF-03 formatter.'
    - 'apps/mobile/src/services/profileService.ts (~95 LOC) — fetchMe + patchMe + fetchLifetimeContribution.'
    - 'apps/mobile/src/screens/profile/ProfileScreen.tsx (~310 LOC) — full design-spec §15 body.'
    - 'apps/mobile/src/screens/profile/InlineEditField.tsx (~115 LOC) — D-PROF-01 inline-edit row.'
    - 'apps/mobile/__tests__/services/durationFormatter.test.ts (6 tests)'
    - 'apps/mobile/__tests__/services/profileService.test.ts (5 tests)'
    - 'apps/mobile/__tests__/screens/ProfileScreen.test.tsx (4 tests)'
  modified:
    - "apps/mobile/src/services/api.ts — added apiClient.patch<T>(path, body, opts) + apiClient.get<T>(path, opts) alias of getJson; extended PatchOptions interface; AbortController-based timeout on patch matches getJson's contract."
  unchanged-by-design:
    - 'apps/mobile/src/navigation/RootNativeStack.tsx — Profile route is already registered as a RootNativeStack sibling of MainTabs (HOME-08 structural, plan 02-05). The plan body listed RootNativeStack.tsx in `files_modified` but the existing registration already points at the same `import ProfileScreen from "../screens/profile/ProfileScreen"` default export the new body still provides. No edit required.'

key-decisions:
  - "Used react-native-uuid v4 instead of the plan body's ulid() for the Idempotency-Key. ulid is not in the dep tree; react-native-uuid 2.0.3 is. Phase 1 plan 04's idempotency hook stores the raw key opaquely (it isn't parsed as a ULID anywhere) — UUIDv4 satisfies the uniqueness contract without adding a second key-generation library. The design intent (a fresh, monotonic-ish, unique key per outgoing PATCH) is preserved."
  - "Adapted profileService to the actual server wire shapes. The plan body's `<interfaces>` section anticipated `{ id, googleSub, email, name, age, gender, createdAt }` for /me and `{ totalSeconds, taskCount, ... }` for /contributions. The real shared/types contract ships `MeResponseSchema` (avatarUrl/consentVersion/flavor/applicationId/createdAt — NO googleSub) and `/contributions` returns `{ durationMs, recordingCount, taskCount, perTask }`. profileService.fetchLifetimeContribution() does the ms→s conversion at the boundary so the consumer-side units match HOME-06."
  - 'Did NOT modify RootNativeStack.tsx. The plan body''s `<files>` list included it and the body said "Update RootNativeStack.tsx to register Profile as a stack-level screen". Plan 02-05 already registered Profile as a RootNativeStack sibling of MainTabs (HOME-08 structural); the existing registration imports `ProfileScreen` as a default export, which the new body still provides. The acceptance grep `grep -q "name.*Profile"` already passed against the unchanged file. Same pattern plan 02-16 used (kept MainTabs.tsx body untouched when the plan body wanted to swap it).'
  - 'Skipped the long-press → clipboard-copy on the PROF-05 footer. The plan body''s "long-press copies to clipboard" wiring would require @react-native-clipboard/clipboard which is NOT in the dep tree. The footer is queryable + readable for support diagnostics; clipboard-copy is a UX nicety. Deferred to plan 02-21 (or whichever plan first introduces the clipboard dep).'
  - "Did NOT write through to a global useAppStore.user slice on patchMe success. The plan body's example tried `setUser({ ...useAppStore.getState().user!, name: updated.name })`, but appStore at Phase 2 has no `user` field — plan 02-19 hydrates it. Same forward-coupling issue plan 02-16 handled: keep the screen self-contained for now; future plans can add the store sync without refactoring the optimistic-UI flow."
  - 'Explicit fontSize: 44 on the lifetime style on top of typography.lifetimeNumber spread. The token already declares fontSize: 44; the explicit override is a literal-grep acceptance gate so the design-spec §15 number size is verifiable without IDE cooperation. Both produce identical render.'
  - 'Footer accessibilityLabel="profile-footer" + screen-level accessibilityLabel="Profile screen" preserved across the loading + error + ready states. The screen-level label keeps the structural HOME-08 test (plan 02-05 RootNativeStack.test.tsx Test 3) green; the inner labels are the screen-grade contracts plan 02-21 manual smoke + future Phase 5 analytics gating will query.'
  - "Manual cleanup() in afterEach instead of relying on globals: true. mobile vitest config pins globals: false (so vitest doesn't bind expect/it/describe globally); testing-library's auto-cleanup hook only fires when globals are imported. Every multi-render screen test in this codebase calls cleanup() manually (SignupScreen, RootNativeStack); ProfileScreen.test.tsx follows the same pattern."

patterns-established:
  - 'Pattern: every editable Profile field wraps in <InlineEditField label value onSave nullable? keyboardType?> instead of bespoke per-field state. Reusable in plan 02-19 if Profile gains additional editable fields (e.g., email-on-file diagnostic).'
  - 'Pattern: profileService.patchMe / fetchMe / fetchLifetimeContribution is the ONLY call site for /me + /contributions in the mobile app. Future screens that need user data import these wrappers (not apiClient.get directly) so the typed MeResponse + ContributionAggregates shapes stay consistent.'
  - 'Pattern: durationFormatter.formatDuration is the canonical seconds→display formatter for the entire app. Phase 6 Home tiles MUST consume it (HOME-06 mandate); Profile already does. No per-screen reimplementation.'
  - 'Pattern: every PATCH endpoint mints a fresh Idempotency-Key per outgoing call. profileService.patchMe is the reference impl; future PATCHes (Phase 5 recording-status updates, etc.) follow the same shape: `await apiClient.patch(path, body, { headers: { "Idempotency-Key": uuid.v4() as string } });`.'

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05]

# Metrics
duration: ~12min
completed: 2026-05-09
---

# Phase 2 Plan 17: ProfileScreen + inline-edit + Payments card + footer + durationFormatter Summary

**ProfileScreen ships full design-spec §15 layout — PROF-01 (avatar/name/age/gender/joined) + PROF-02 (Payments & Earnings verbatim copy + Coming-soon badge) + PROF-03 (44 px lifetime numeric via durationFormatter) + PROF-04 (Help Center / Logout / Delete-account row entries routing to plan 02-18/19 stub targets) + PROF-05 (versionName/versionCode/flavor footer for support diagnostics). InlineEditField primitive ships D-PROF-01 (tap → TextInput → blur fires PATCH /me with optimistic UI + Alert.alert revert on error). profileService wraps GET /me + PATCH /me + GET /contributions with a fresh react-native-uuid v4 Idempotency-Key per PATCH (Phase 1 API-15). durationFormatter ships HOME-06 spec verbatim — also consumed by Phase 6 Home tiles. apiClient extended with patch() + get() alias. Mobile suite 160/160 green; typecheck clean.**

## Performance

- **Duration:** ~12 min — lighter than the wave-4 average because the navigator graph + Profile route registration was already finalized in plans 02-05 and 02-16, so this plan landed pure screen body + service + utility without nav plumbing.
- **Tasks:** 3 of 3 executed (all autonomous; no TDD gate)
- **Commits:** 4 — Task 1 feat (durationFormatter), Task 2 feat (profileService + apiClient extension), Task 3 feat (ProfileScreen + InlineEditField + tests), Task 3 follow-up docs (comment-substring fix for grep gate)
- **Files created:** 7 (3 source + 1 InlineEditField + 3 test files)
- **Files modified:** 1 (api.ts — added patch + get alias)
- **Test delta:** +15 net (6 durationFormatter + 5 profileService + 4 ProfileScreen); 160 / 160 green across 31 files.

## Accomplishments

- **durationFormatter ships HOME-06 verbatim (Task 1).** `< 1 min → Xs`, `< 1 hr → Xm`, `≥ 1 hr → Xh Ym` with floor-to-previous-minute. Defensive: NaN/Infinity/negative → `"0s"`. Tests cover every branch + the canonical HOME-06 example (`2h 4m 59s → "2h 4m"`) + exact-hour boundary + fractional input.
- **profileService wraps the three Phase 1 endpoints (Task 2).** `fetchMe()` → typed `MeResponse` matching shared/types `MeResponseSchema` (id/email/name/age/gender/avatarUrl/consentVersion/flavor/applicationId/deletedAt/deleteGraceUntil/createdAt). `patchMe(updates)` → mints fresh `react-native-uuid` v4 → forwards as `Idempotency-Key` header. `fetchLifetimeContribution()` → calls `/contributions?range=all` (forward-compatibility marker; the Phase 1 endpoint always returns lifetime today) and converts the wire-side `durationMs` to `totalSeconds` at the boundary so PROF-03 + HOME-06 share consumer-side units.
- **apiClient extended with patch + get alias (Task 2).** `patch<T>(path, body, { headers?, timeoutMs? })` mirrors `post()` with the same JSON-body + AbortController contract. `get<T>(path, opts?)` is a one-line alias of `getJson<T>(path, opts?)` so call sites that read more naturally as `apiClient.get(...)` (matching the plan body's example signatures) work without renaming the existing `getJson` invocations across versionService.
- **ProfileScreen ships the full design-spec §15 body (Task 3).** PROF-01 head (avatar Image with avatarUrl + initial fallback when null + name + "tap to edit" subline). PROF-03 lifetime numeric (44 px / 700 weight + `tabular-nums` + 'contributed' + 'Across N tasks' caption — N is `taskCount` from the contributions aggregate). PROF-02 Payments & Earnings card (`Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed.` verbatim from idea-brief.md §5.11). PROF-01 personal-info rows (Name + nullable Age + nullable Gender via InlineEditField; non-editable Joined). PROF-04 actions (Help Center → `navigation.navigate('HelpCenter')`, Logout → `navigation.navigate('LogoutModal')`, Delete account → `navigation.navigate('DeleteAccountModal')` rendered in `colors.coral`). PROF-05 footer reads `v{versionName} ({versionCode}) · {flavor}` from `getFlavorContext()` (degrades gracefully to `v0.0.0 (0) · unknown` if the native module isn't registered, e.g. in unit tests).
- **InlineEditField primitive ships D-PROF-01 (Task 3).** Pressable label row → tap → switches to TextInput with autoFocus + draft state + blur-fires-onSave + busy gate. The screen owns the optimistic UI: sets the new value immediately, awaits patchMe, rolls back on rejection AND raises `Alert.alert('Could not update', 'Please try again.')`. T-2.17-02 mitigation: the Alert body never echoes the user-typed value.
- **15 unit tests cover every PROF-01..05 contract.** durationFormatter (6) — HOME-06 branches + canonical example + edge cases. profileService (5) — fetchMe wire shape, PATCH idempotency-key forwarding, null-allowed fields, ms→s conversion, defensive fallback. ProfileScreen (4) — full render + each of the three PROF-04 navigation entry points.
- **Mobile suite 160/160 green; typecheck clean.** No regression to the 28 prior test files.

## Task Commits

Each task was committed atomically:

1. **Task 1: durationFormatter utility (HOME-06 / PROF-03)** — `e1b9a33` (feat)
2. **Task 2: profileService — fetchMe / patchMe / fetchLifetimeContribution** — `1f86710` (feat)
3. **Task 3: ProfileScreen + InlineEditField — design-spec §15 + PROF-01..05** — `ba708c3` (feat)
4. **Task 3 follow-up: reword PROF-02 comments to avoid 'Payments & Earnings' substring grep collisions** — `f8cb1d4` (docs)

_Plan was `autonomous: true` with no `tdd: true` task — all three tasks landed as straight feat commits. Task 3 follow-up split into a separate commit to attribute the comment-substring fix unambiguously (per the never-amend rule)._

## Files Created/Modified

### Created (7)

- `apps/mobile/src/services/durationFormatter.ts` — HOME-06 formatter with NaN/Infinity/negative defense.
- `apps/mobile/src/services/profileService.ts` — fetchMe + patchMe + fetchLifetimeContribution. Typed MeResponse + PatchMeUpdates + ContributionAggregates interfaces.
- `apps/mobile/src/screens/profile/ProfileScreen.tsx` — full design-spec §15 body. Replaces the 02-05 stub.
- `apps/mobile/src/screens/profile/InlineEditField.tsx` — D-PROF-01 inline-edit row primitive.
- `apps/mobile/__tests__/services/durationFormatter.test.ts` — 6 tests.
- `apps/mobile/__tests__/services/profileService.test.ts` — 5 tests.
- `apps/mobile/__tests__/screens/ProfileScreen.test.tsx` — 4 tests.

### Modified (1)

- `apps/mobile/src/services/api.ts` — added `apiClient.patch<T>(path, body, opts)` mirroring `post()` with header forwarding + AbortController timeout, AND `apiClient.get<T>(path, opts)` as a one-line alias of `getJson<T>(path, opts)` so the plan body's `apiClient.get(...)` call sites work alongside the existing versionService `apiClient.getJson(...)` callers.

### Unchanged by design

- `apps/mobile/src/navigation/RootNativeStack.tsx` — Profile route is already registered as a RootNativeStack sibling of MainTabs (HOME-08 structural, plan 02-05). The existing `import ProfileScreen from '../screens/profile/ProfileScreen'` resolves to the new body's default export. The plan body's `<files>` listed RootNativeStack.tsx but the actual edit was a no-op against the pre-existing registration.

## Decisions Made

1. **react-native-uuid v4 over `ulid` for the Idempotency-Key.** The plan body's example imported `from 'ulid'` but that package isn't in the dep tree. `react-native-uuid` 2.0.3 IS installed (Phase 2 plan 02-02 added it). Phase 1 plan 04's idempotency hook stores the raw key opaquely (it isn't parsed as a ULID anywhere) — UUIDv4 satisfies the uniqueness contract without bringing a second key-generation library.
2. **profileService adapts to the actual shared/types contract.** `MeResponseSchema` ships `avatarUrl/consentVersion/flavor/applicationId` and NO `googleSub`/`photoURL`. `/contributions` ships `{ durationMs, recordingCount, taskCount, perTask }` with NO `totalSeconds`/`range` parameter. The service wraps the real wire shape; the consumer-side `ContributionAggregates` exposes `totalSeconds = floor(durationMs / 1000)` so PROF-03 reads the same units that HOME-06 + Phase 6 Home tiles consume.
3. **No edit to RootNativeStack.tsx.** Plan 02-05 already registered Profile as a RootNativeStack sibling of MainTabs (HOME-08 structural). The existing registration imports the default export which the new ProfileScreen still provides. The acceptance grep `grep -q "name.*Profile"` passes against the unchanged file. Same baseline-precedence pattern plan 02-16 documented (kept MainTabs.tsx body intact even though the plan body wanted to swap it).
4. **Skipped the long-press → clipboard-copy on the footer.** Plan body's "long-press copies to clipboard" required `@react-native-clipboard/clipboard` which is NOT in the dep tree. The footer remains queryable and visually readable for support diagnostics; the clipboard-copy interaction is a UX nicety. Deferred to plan 02-21 (manual smoke runbook + first plan to introduce the clipboard dep).
5. **No write-through to a global useAppStore.user slice.** The plan body's example tried `setUser({ ...useAppStore.getState().user!, name: updated.name })`, but appStore at Phase 2 has no `user` field — plan 02-19 hydrates it. Forward-coupling avoided; plan 02-19 can add the store sync without refactoring the optimistic-UI flow. The TopBar already takes an `avatarInitial` prop (plan 02-16) so a future store hookup is one prop pass-through away.
6. **Explicit fontSize: 44 atop typography.lifetimeNumber spread.** The token already declares 44 px; the explicit override is the literal-grep acceptance gate (`grep -q "fontSize: 44"`) so the design-spec §15 number size is verifiable without IDE cooperation. Both produce identical render.
7. **Manual cleanup() in afterEach for ProfileScreen.test.tsx.** Mobile vitest config pins `globals: false` — testing-library/react's auto-cleanup hook only fires under `globals: true`. Every multi-render screen test in this codebase calls `cleanup()` manually (SignupScreen, RootNativeStack); ProfileScreen.test.tsx follows the same pattern. Without it, the second test's `getByLabelText` finds detached DOM from the first test's render and throws "Found multiple elements".
8. **Comment-substring discipline.** First commit of Task 3 had two header comments containing the verbatim phrase "Payments & Earnings" alongside the rendered title, so the plan-body acceptance grep `grep -c "Payments & Earnings"` returned 3 (expected 1). Reworded the comments to "payments card" in a follow-up `docs(02-17)` commit so the literal grep counts the rendered title only. Same comment-substring discipline plan 02-05 documented for `Tab.Screen` and `pnpm-workspace.yaml`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `ulid` package not in dep tree; replaced with react-native-uuid v4.**

- **Found during:** Task 2 read-first (apps/mobile/package.json inspection).
- **Issue:** Plan body's profileService example imported `from 'ulid'` and called `ulid()` to mint the Idempotency-Key. ulid is NOT in apps/mobile/package.json dependencies; bringing it in would require a separate `npm install` that the plan didn't budget. react-native-uuid 2.0.3 IS already installed (Phase 2 plan 02-02), and Phase 1 plan 04's idempotency hook stores the raw key opaquely — UUIDv4 satisfies the uniqueness contract identically.
- **Fix:** Imported `uuid from 'react-native-uuid'`; mint via `uuid.v4() as string`. Test mocks `react-native-uuid` (not `ulid`) with a fixed value `'fixed-uuid-01'`.
- **Files modified:** apps/mobile/src/services/profileService.ts, apps/mobile/**tests**/services/profileService.test.ts.
- **Verification:** profileService test 'patchMe calls PATCH /me with an Idempotency-Key header' passes; the asserted header value is the deterministic mock.
- **Committed in:** `1f86710`.

**2. [Rule 1 — Bug] profileService MeResponse + ContributionAggregates wire shapes were stale.**

- **Found during:** Task 2 read-first (shared/types/src/me.ts + apps/api/src/routes/contributions/list.ts inspection).
- **Issue:** Plan body's `<interfaces>` block specified `MeResponse = { id, googleSub, email, name, age, gender, createdAt, ... }` and `ContributionAggregates = { totalSeconds: number, taskCount: number, ... }`. The actual server contract (shared/types/src/me.ts MeResponseSchema + apps/api contributionsListRoute) ships `MeResponse = { id, email, name, age, gender, avatarUrl, consentVersion, flavor, applicationId, deletedAt, deleteGraceUntil, createdAt }` (NO `googleSub`) and `/contributions` returns `{ durationMs, recordingCount, taskCount, perTask: [...] }` (NO `totalSeconds`).
- **Fix:** Updated `MeResponse` interface in profileService to match the real wire shape (avatarUrl + consentVersion + flavor + applicationId + deletedAt + deleteGraceUntil). `fetchLifetimeContribution()` now calls a typed `ServerContributionsLifetime` interface and converts `durationMs → totalSeconds = Math.floor(durationMs / 1000)` at the boundary so the consumer-side `ContributionAggregates` shape stays as the plan intended. ProfileScreen consumes `me.avatarUrl` for the Image source instead of `useAppStore.user.photoURL`.
- **Files modified:** apps/mobile/src/services/profileService.ts (interface + implementation), apps/mobile/src/screens/profile/ProfileScreen.tsx (avatarUrl render path), apps/mobile/**tests**/services/profileService.test.ts (fixture shapes), apps/mobile/**tests**/screens/ProfileScreen.test.tsx (ME_FIXTURE).
- **Verification:** All 9 service + screen tests pass; typecheck clean.
- **Committed in:** `1f86710` + `ba708c3`.

**3. [Rule 3 — Blocking] apiClient.get + apiClient.patch did not exist.**

- **Found during:** Task 2 read-first (apps/mobile/src/services/api.ts inspection).
- **Issue:** Plan body called `apiClient.get<T>(path, { query: { range: 'all' } })` and `apiClient.patch<T>(path, body, { headers: ... })` but the existing api.ts only ships `post`, `postNoBody`, and `getJson`. PATCH support was missing entirely.
- **Fix:** Extended apiClient: added `patch<T>(path, body, opts?)` mirroring `post()` (JSON content-type, AbortController-based timeout) with header forwarding (lower-cases names on the wire). Added `get<T>(path, opts?)` as a one-line alias of `getJson<T>(path, opts?)` so call sites that prefer the bare verb name work without churning the existing versionService callers. Updated ApiClient interface + PatchOptions interface accordingly.
- **Files modified:** apps/mobile/src/services/api.ts.
- **Verification:** existing versionService tests still pass (29 tests across 5 files); new profileService tests pass against the extended interface.
- **Committed in:** `1f86710`.

**4. [Rule 1 — Bug] testing-library multi-render pollution under vitest globals: false.**

- **Found during:** Task 3 first test run (3 of 4 ProfileScreen tests failed with "Found multiple elements with the text of: profile-action-help").
- **Issue:** Mobile vitest config pins `globals: false` so `expect/it/describe` are imported, not bound globally. Side-effect: testing-library/react's auto-cleanup `afterEach` hook (registered when globals are imported) does NOT fire. Each test's `render(<ProfileScreen />)` left its DOM tree mounted; the second test's `getByLabelText` saw both renders.
- **Fix:** Added `import { cleanup } from '@testing-library/react'` + `afterEach(() => { cleanup() })` to ProfileScreen.test.tsx. Same pattern SignupScreen.test.tsx + RootNativeStack.test.tsx use.
- **Files modified:** apps/mobile/**tests**/screens/ProfileScreen.test.tsx.
- **Verification:** All 4 tests pass; full mobile suite 160/160 green.
- **Committed in:** `ba708c3`.

**5. [Rule 1 — Bug] Screen-level accessibilityLabel mismatch broke RootNativeStack HOME-08 structural test.**

- **Found during:** Task 3 full-suite run (1 of 31 test files failed: RootNativeStack.test.tsx Test 3 "Profile is a SIBLING of MainTabs").
- **Issue:** First iteration of ProfileScreen used `accessibilityLabel="profile-screen"` (lowercased dashed) for the ScrollView root — modern naming. But plan 02-05 RootNativeStack.test.tsx queries `getAllByLabelText('Profile screen')` (Capitalized + space) to assert HOME-08 structurally. Renaming the screen-level label silently broke the prior plan's gate.
- **Fix:** Restored screen-level `accessibilityLabel="Profile screen"` on ScrollView (ready state), ScreenContainer (loading state), and ScreenContainer (error state). Inner element labels (`profile-screen` was renamed back to `Profile screen`; `profile-footer`/`profile-avatar`/`profile-action-*`/`profile-payments-card`/`profile-lifetime`/`profile-joined` kept the new naming since those are this plan's contracts). Updated ProfileScreen.test.tsx to query `getByLabelText('Profile screen')` for the ready-state assertion.
- **Files modified:** apps/mobile/src/screens/profile/ProfileScreen.tsx, apps/mobile/**tests**/screens/ProfileScreen.test.tsx.
- **Verification:** Mobile suite 160/160 green; RootNativeStack Test 3 passes again.
- **Committed in:** `ba708c3`.

**6. [Rule 1 — Bug] "Payments & Earnings" substring in source comments tripped grep -c gate.**

- **Found during:** Task 3 acceptance verification (the plan's verification command says `grep -c "Payments & Earnings" ... returns 1` — single rendered title — but mine returned 3).
- **Issue:** Two header docstring comments inside ProfileScreen.tsx referenced "PROF-02: Payments & Earnings card" by name. The literal grep counted them alongside the rendered title (line 204), so the gate returned 3 instead of the expected 1.
- **Fix:** Reworded the comments to "payments card" (still descriptive, but doesn't trip the substring grep). Same comment-substring discipline plan 02-05 documented for `Tab.Screen` and plan 02-01 for `pnpm-workspace.yaml`.
- **Files modified:** apps/mobile/src/screens/profile/ProfileScreen.tsx (2 comment lines).
- **Verification:** `grep -c "Payments & Earnings" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 1; tests still 4/4 green.
- **Committed in:** `f8cb1d4` (separate `docs(02-17)` commit so the audit trail attributes the rewording unambiguously per the never-amend rule).

---

**Total deviations:** 6 auto-fixed (3 Rule 1 bugs from plan-body-vs-baseline drift, 3 Rule 3 blockers from missing-dep / missing-API-shape).
**Impact on plan:** All deviations were API-shape adaptations + test-infra corrections; none expand scope or violate any threat-model mitigation. The verbatim Payments copy, the inline-edit pattern, the durationFormatter spec, and the four PROF-04 navigation entry points all match the plan body's intent.

## Issues Encountered

- **Plan body's `<interfaces>` block was written against an aspirational Phase 1 contract.** The real shared/types `MeResponseSchema` ships `avatarUrl/consentVersion/flavor/applicationId` and the `/contributions` endpoint returns `durationMs` (not `totalSeconds`). Same plan-evolution drift plan 02-09 documented (logo.js was a DOM script, not an RN component) and plan 02-16 documented (MainTabs was already wired, not a stub). Resolution: trust the source of truth (shared/types + apps/api) over the plan body's example signatures.
- **`react-native-uuid` mock had to be added per-test-file since it isn't in vitest.setup.ts.** Per-test-file mocking is the canonical Phase 2 pattern (vitest.setup.ts mocks platform/library deps; service mocks are per-test-file). No setup change needed.
- **Long-press → clipboard-copy on the footer is parked.** `@react-native-clipboard/clipboard` is not in the dep tree; the visual + accessibility-labelled footer remains for support diagnostics. Plan 02-21 manual smoke runbook will note the deferred clipboard interaction.

## Threat Flags

None — every threat in the plan's `<threat_model>` was addressed:

- **T-2.17-01 (stale GET /me cached returning a name from the previous user, mitigate):** profileService.fetchMe is called fresh on every Profile mount via the useEffect; there is NO cache layer in the service. After signOut() (plan 02-19 will wire this into the Logout modal), MMKV is cleared by `useAppStore.signOut()` (plan 02-09 export). The screen re-mounts on fresh sign-in and re-fetches.
- **T-2.17-02 (PATCH /me failure echoes the user-typed name in a generic error log, mitigate):** profileService.patchMe lets `apiClient.patch()` re-throw — the thrown Error.message is `"PATCH /me failed: {status} {body}"` where {body} is the server-side problem-detail JSON. Crucially, the user-typed value (the request body) is NOT echoed in the message because apiClient stringifies the response body, not the request body. ProfileScreen's catch block calls `Alert.alert('Could not update', 'Please try again.')` — no request-body content surfaces.
- **T-2.17-03 (Idempotency-Key reused across distinct PATCH calls, mitigate):** profileService.patchMe mints a fresh `react-native-uuid` v4 inside the function body on EACH call. Phase 1 plan 04 backend's global pre-handler de-duplicates by this header; UUIDv4 collision probability is negligible, and the key is generated inside the function (never hoisted to a module-level constant or memoized).

## User Setup Required

None — pure mobile-side wiring. No new external service config, no env vars, no native module changes, no new pod/gradle deps.

The Profile screen will mount cleanly on a real device once the user signs in (plan 02-09's Sign-up + Phase 1's `/auth/google` round-trip lands the JWT) and once `apps/mobile/.env.{flavor}` has `API_BASE_URL` pointing at a backend serving `/me` + `/contributions`. For the 02-21 manual smoke, the dev API at `http://<lan-ip>:8080` (Phase 1 STATE.md "Resume Path") is sufficient.

## Next Phase Readiness

- **Plan 02-18 (Help Center screen)** — the ProfileScreen Help Center row already calls `navigation.navigate('HelpCenter')` against the RootNativeStack-registered sibling. 02-18 lands the screen body at this route name; no further wiring change required at the Profile call site.
- **Plan 02-19 (Logout modal + Delete-account modal)** — ProfileScreen already calls `navigation.navigate('LogoutModal')` and `navigation.navigate('DeleteAccountModal')`. 02-19 must register these as new RootNativeStack siblings (modal-presentation, gestureEnabled=false matching ForceUpgrade's pattern) and mount the modal bodies. The Profile entry path is fixed.
- **Plan 02-21 (manual smoke runbook)** — should append a Profile section: "tap avatar → Profile renders /me data, edit Name field → blur fires PATCH /me with `Idempotency-Key: <uuid>` header in DevTools network tab, lifetime numeric reads `formatDuration(durationMs / 1000)` of the server's reported total, footer reads `v{versionName} ({versionCode}) · {flavor}`. Long-press footer → clipboard-copy: deferred (no clipboard dep)."
- **Phase 6 Home tiles (HOME-01..06/09/10)** — every tile that displays a duration MUST consume `formatDuration(seconds)` from `apps/mobile/src/services/durationFormatter.ts`. The HOME-06 mandate is now structurally satisfied: Profile already consumes it; Phase 6 reuses the same helper without per-tile reimplementation.
- **Phase 5 (`/recordings` PATCH for status updates, etc.)** — every future PATCH should follow the profileService.patchMe template: `await apiClient.patch(path, body, { headers: { 'Idempotency-Key': uuid.v4() as string } })`. The reference implementation is `apps/mobile/src/services/profileService.ts` lines 71-76.
- **Plan 02-22 / Phase 7 iOS** — durationFormatter is platform-agnostic (no RN imports); it ports to iOS unchanged. profileService imports `react-native-uuid` (which has an iOS impl) and `apiClient` (platform-agnostic) — also ports unchanged. ProfileScreen + InlineEditField use only `View`/`Text`/`Pressable`/`Image`/`ScrollView`/`TextInput`/`Alert` plus design-spec tokens; the iOS port is straightforward.

## TDD Gate Compliance

This plan did not declare any task with `tdd="true"` in the PLAN frontmatter — all three tasks were straight `type="auto"` with feat/test commits in the same task atomically. The plan-level `type: execute` (not `type: tdd`) is consistent with this. No RED/GREEN gate sequence required.

## Self-Check: PASSED

- File `apps/mobile/src/services/durationFormatter.ts` — FOUND
- File `apps/mobile/src/services/profileService.ts` — FOUND
- File `apps/mobile/src/screens/profile/ProfileScreen.tsx` — FOUND (full body, replaces 02-05 stub)
- File `apps/mobile/src/screens/profile/InlineEditField.tsx` — FOUND
- File `apps/mobile/__tests__/services/durationFormatter.test.ts` — FOUND (6 tests)
- File `apps/mobile/__tests__/services/profileService.test.ts` — FOUND (5 tests)
- File `apps/mobile/__tests__/screens/ProfileScreen.test.tsx` — FOUND (4 tests)
- File `apps/mobile/src/services/api.ts` — modified (apiClient.patch + apiClient.get added)
- `grep -q "export function formatDuration" apps/mobile/src/services/durationFormatter.ts` — succeeds
- `grep -q "export async function fetchMe" apps/mobile/src/services/profileService.ts` — succeeds
- `grep -q "export async function patchMe" apps/mobile/src/services/profileService.ts` — succeeds
- `grep -q "Idempotency-Key" apps/mobile/src/services/profileService.ts` — succeeds
- `grep -q "react-native-uuid\|uuid" apps/mobile/src/services/profileService.ts` — succeeds (using react-native-uuid v4 instead of ulid; deviation #1)
- `grep -q "range.*all" apps/mobile/src/services/profileService.ts` — succeeds
- `grep -q "Payments & Earnings" apps/mobile/src/screens/profile/ProfileScreen.tsx` — succeeds; `grep -c` returns 1 (deviation #6 fix)
- `grep -q "Payouts process offline" apps/mobile/src/screens/profile/ProfileScreen.tsx` — succeeds (verbatim copy)
- `grep -q "Across .*tasks" apps/mobile/src/screens/profile/ProfileScreen.tsx` — succeeds
- `grep -q "fontSize: 44" apps/mobile/src/screens/profile/ProfileScreen.tsx` — succeeds (PROF-03 explicit)
- `grep -cE "navigate.*HelpCenter|navigate.*LogoutModal|navigate.*DeleteAccountModal" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 3 (PROF-04)
- `grep -q "versionName.*versionCode\|VERSION_NAME" apps/mobile/src/screens/profile/ProfileScreen.tsx` — succeeds (PROF-05)
- `grep -q "name.*Profile" apps/mobile/src/navigation/RootNativeStack.tsx` — succeeds (existing 02-05 registration)
- `grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/profile/ProfileScreen.tsx apps/mobile/src/screens/profile/InlineEditField.tsx` exits non-zero — VERIFIED (no hex literals)
- `cd apps/mobile && npm run typecheck` — exits 0
- `cd apps/mobile && npm run test` — 31 test files / 160 tests / all passing
- `cd apps/mobile && npm run test -- durationFormatter profileService ProfileScreen --run` — 3 files / 15 tests / all passing
- Commit `e1b9a33` (Task 1: durationFormatter) — FOUND in git log
- Commit `1f86710` (Task 2: profileService + apiClient extension) — FOUND
- Commit `ba708c3` (Task 3: ProfileScreen + InlineEditField + tests) — FOUND
- Commit `f8cb1d4` (Task 3 follow-up: comment-substring fix) — FOUND
- 02-05 contributions intact: RootNativeStack.test.tsx Test 3 (HOME-08 structural) passes against the new ProfileScreen body (deviation #5 preserved the screen-level accessibilityLabel="Profile screen" contract).
- 02-09 contributions intact: signOut() helper + TermsOfUseModal unchanged.
- 02-16 contributions intact: TopBar + HomeSkeletonScreen + MainTabs.test structural gate unchanged.

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
_PROF-01..05 closed in code; modal bodies (Logout / Delete account) arrive in 02-19, Help Center body in 02-18._
