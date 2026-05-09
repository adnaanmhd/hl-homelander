---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 10
subsystem: permissions
tags:
  [
    permissions,
    react-native-permissions,
    perm-01,
    perm-02,
    perm-04,
    perm-03-deferred,
    foreground-service-types,
    manifest-ci,
    t-2.10-01,
    t-2.10-02,
    t-2.10-03,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'OnboardingStack with `Permissions` and `Compat` routes (02-05); UI primitives + tokens (02-02); useAppStore.setPermsGranted (02-03); analytics util + EVENT_NAMES allowlist (02-04); base + apkRollout AndroidManifest.xml + Phase 1 verify-merged-manifests.sh (01-09)'
provides:
  - 'apps/mobile/android/app/src/main/AndroidManifest.xml — Phase 2 base permissions (PERM-04): CAMERA, RECORD_AUDIO, WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_DATA_SYNC. Plus three required <uses-feature> filters (camera.any, gyroscope, accelerometer) so Play Store filters incompatible devices.'
  - 'apps/mobile/scripts/verify-merged-manifests.sh — extended CI gate. Phase 1 enforced REQUEST_INSTALL_PACKAGES flavor scoping; Phase 2 adds REQUIRED_BASE_PERMS (must appear on both flavors after merge) and FORBIDDEN_BASE_PERMS (POST_NOTIFICATIONS, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION must NOT appear in either flavor). Mitigates T-2.10-01..03.'
  - 'apps/mobile/src/screens/permissions/PermissionsScreen.tsx — Camera+Mic sequential request screen with §3a idle copy + §4.1.1 denied-recovery state. Wires setPermsGranted persistence + navigation.replace("Compat") on full grant; calls openSettings() in recovery state; logs analytics events at every fork.'
  - 'apps/mobile/__tests__/screens/PermissionsScreen.test.tsx — 6 behavior tests covering initial mount, happy path, camera-denied recovery, mic-denied partial, BLOCKED-as-DENIED parity, analytics event shape.'
  - 'apps/mobile/vitest.setup.ts — lucide-react-native mock allowlist gains `Ban` for the §4.1.1 denied-state icon.'
affects:
  - 'plan 02-11 (Compat service): the `Compat` route is now reached from PermissionsScreen on success — Compat re-checks runtime perms before any device probe, so this transition is the only entry point during fresh onboarding.'
  - 'plan 02-12 (CompatPass / CompatFail / CompatRecovery): the recovery flow may surface a "Permissions" recheck if the user revoked Camera/Mic post-onboarding; that flow re-enters PermissionsScreen at the recovery state copy.'
  - 'Phase 3 (HumynCapture native module): the foreground-service-type bitmask declared here is what HumynCapture binds against at startForeground(); Camera2 + MediaCodec stack also binds against the runtime CAMERA + RECORD_AUDIO grants persisted by setPermsGranted.'
  - 'Phase 4 (HumynUpload): FOREGROUND_SERVICE_DATA_SYNC declared here is the surface UploadService binds against. Wake-lock declaration also lands here; long-running uploads will acquire one.'
  - 'Phase 4 plan (coarse Location, deferred PERM-03): the FORBIDDEN_BASE_PERMS gate explicitly ASSERTS ABSENCE today, so a Phase 4 owner who legitimately wants ACCESS_COARSE_LOCATION must (a) explicitly remove it from the forbidden list and (b) explain in their plan why coarse-only is sufficient.'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: Camera + Mic permissions are requested SEQUENTIALLY (not via requestMultiple). The OS prompt is modal; Android's request dialog can only show one permission at a time. Calling request(CAMERA) → await → request(RECORD_AUDIO) → await keeps the UX predictable. Test 2's mockResolvedValueOnce ordering is the contract."
    - "Pattern: §4.1.1 recovery state shares the same screen as §3a idle. Recovery is NOT a separate route; it's a state machine on PermissionsScreen ('idle' | 'requesting' | 'denied' | 'partial'). The CTA's accessibilityLabel switches between 'Allow access' and 'Open Settings' so testing-library + accessibility tooling both find the right node by label. The icon flips Camera → Ban."
    - "Pattern: Partial state ('camera granted, mic denied' or vice versa) names the SPECIFIC missing permission in the body copy ('Microphone access is required. Open Settings to enable.'). The user needs to know which Settings toggle to flip. Generic 'Camera & Mic are required' would force them to flip both."
    - "Pattern: BLOCKED is treated identically to DENIED. The Android distinction (DENIED = first-time deny, can re-prompt; BLOCKED = 'Don't ask again' was checked, can't re-prompt) is not surfaced because the user-facing recovery is the same in both cases — Open Settings."
    - "Pattern: Tests query the title and body via aria-label + textContent (NOT getByText). testing-library's default text matcher normalizes whitespace, which would collapse the embedded \\n in 'Camera & Mic\\nPermissions' to a space — masking a regression that breaks the design-spec line break. textContent on the addressable node preserves the verbatim string."
    - "Pattern: CI gate's REQUIRED_BASE_PERMS list is asserted on BOTH apkRollout AND playStore merged manifests. Per-flavor source sets can OVERRIDE merge behavior; if a future plan accidentally REMOVED a required permission via a flavor manifest's `tools:node='remove'`, this catches it."
    - "Pattern: CI gate's FORBIDDEN_BASE_PERMS list deliberately EXCLUDES REQUEST_INSTALL_PACKAGES (which is permitted on apkRollout via Phase 1's flavor source-set). Phase 1's REQUEST_INSTALL_PACKAGES check still runs upstream of the Phase 2 list. A blanket 'forbidden everywhere' list would have flagged the legitimate apkRollout scoping and broken the apk-distribution channel."
    - 'Pattern: <uses-feature android:name="...camera.any" required="true"/> filters Play Store install eligibility. Phones without ANY camera (rare but exists) cannot install — better than crashing on first record. Same logic for gyro + accelerometer (the IMU spec is unviable without them).'

key-files:
  created:
    - 'apps/mobile/__tests__/screens/PermissionsScreen.test.tsx (216 LOC) — 6 behavior tests with module-level vi.mock for navigation.replace, useAppStore.setPermsGranted, and logEvent. react-native-permissions request/openSettings come from vitest.setup.ts global mock; per-test vi.mocked(...).mockResolvedValueOnce(...) drives branch coverage.'
  modified:
    - 'apps/mobile/android/app/src/main/AndroidManifest.xml — added 7 <uses-permission> entries (CAMERA, RECORD_AUDIO, WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_DATA_SYNC) + 3 <uses-feature> entries (camera.any, gyroscope, accelerometer). EXPLICITLY-DO-NOT-ADD comment block enumerates POST_NOTIFICATIONS / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION / REQUEST_INSTALL_PACKAGES with their owning hard rules.'
    - 'apps/mobile/scripts/verify-merged-manifests.sh — added REQUIRED_BASE_PERMS (9 entries) + FORBIDDEN_BASE_PERMS (3 entries — POST_NOTIFICATIONS / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION; REQUEST_INSTALL_PACKAGES handled by upstream Phase 1 checks). assert_required_perms + assert_forbidden_perms helpers grep on actual <uses-permission ...> tokens (not bare permission strings) so prose comments mentioning a permission name for documentation do not trip the gate.'
    - 'apps/mobile/src/screens/permissions/PermissionsScreen.tsx — replaces 02-05 stub. 208 LOC. State machine + Platform.OS-conditional permission constants + sequential request flow + recovery-state CTA + analytics call sites at every fork.'
    - "apps/mobile/vitest.setup.ts — lucide-react-native mock ICONS allowlist gains 'Ban' so the denied-state icon resolves under JSDOM."
  deleted: []

key-decisions:
  - decision: 'PERM-03 (coarse Location) is intentionally NOT prompted in Phase 2'
    rationale: 'CONTEXT.md decision; Phase 4 territory (capture lifecycle / mid-record edges may need coarse location for certain task categories — to be re-evaluated). Today there is zero use of geolocation anywhere in the Phase 2/3 capture surface.'
    outcome: 'Manifest does NOT declare ACCESS_COARSE_LOCATION; CI gate FORBIDDEN_BASE_PERMS explicitly enforces absence. Phase 4 owner who needs it must remove the entry from the gate and document why.'
  - decision: 'Sequential request (Camera then Mic), NOT requestMultiple'
    rationale: "Android's OS prompt is modal — only one permission dialog at a time. requestMultiple silently sequentializes anyway; explicit await keeps the test contract obvious and lets us interleave per-permission analytics events."
    outcome: 'Test 2 asserts the call ordering. requestMultiple is NOT used.'
  - decision: 'BLOCKED treated as DENIED (same recovery path)'
    rationale: 'Both states require the user to flip the toggle in Settings. Surfacing the distinction in copy would force the user to understand Android internals.'
    outcome: 'Test 5 pins this. result === RESULTS.GRANTED is the only branch where we proceed; everything else routes to recovery.'
  - decision: "CI gate scope: assert on BOTH flavors's merged manifests"
    rationale: 'Per-flavor source sets can OVERRIDE base manifest entries via tools:node="remove"/"replace". A future plan accidentally adding such an override on the playStore flavor would silently strip a required permission — only by asserting the merged output on each flavor do we catch it.'
    outcome: 'verify-merged-manifests.sh greps the Gradle-emitted merged manifest (not the source manifest) on both flavors.'
  - decision: 'Tests query by aria-label + textContent, not getByText'
    rationale: 'testing-library normalizes whitespace, collapsing the design-spec''s embedded \\n in "Camera & Mic\\nPermissions" to a space. textContent on the addressable Text node preserves the verbatim string. The plan body''s draft used getByText — which would have masked a regression where the line break is dropped. Refined during GREEN.'
    outcome: 'All 6 tests pass. Future screen tests that assert verbatim multi-line copy should follow this pattern.'
  - decision: 'Lift the §4.1.1 recovery icon to Lucide `Ban` (Material `block` analogue)'
    rationale: 'Design-spec §4.1.1 specifies "block" as the Material icon name. Lucide does not have a literal `Block` export; `Ban` is the canonical equivalent (red prohibition circle). The 02-05 plan body also nominated Ban.'
    outcome: 'vitest.setup.ts allowlist extended; PermissionsScreen.tsx imports Ban from lucide-react-native.'

# Phase metrics
metrics:
  start_time: '2026-05-09T16:05:00Z'
  end_time: '2026-05-09T16:18:30Z'
  duration_minutes: ~14
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  commits: 4 # see Commit History below for the multi-agent contention narrative
  completed_date: '2026-05-09'
---

# Phase 2 Plan 10: PermissionsScreen + Manifest Permissions + CI Gate Summary

Camera + Mic runtime permissions screen with sequential request flow and §4.1.1 recovery state, alongside the Phase 2 base AndroidManifest entries (PERM-04) and the verify-merged-manifests.sh CI gate that asserts the required + forbidden permission lists across both build flavors.

## What Shipped

### Task 1 — Manifest + CI gate (commit `bc08e43`)

`apps/mobile/android/app/src/main/AndroidManifest.xml` gains the seven Phase 2 base permissions (CAMERA, RECORD_AUDIO, WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_DATA_SYNC) and the three `<uses-feature required="true"/>` filters (camera.any, gyroscope, accelerometer). An EXPLICITLY-DO-NOT-ADD comment block lists POST_NOTIFICATIONS / FINE_LOCATION / COARSE_LOCATION / REQUEST_INSTALL_PACKAGES with each one's owning hard rule, so a future contributor coming back to add a perm sees the ban-list inline.

`apps/mobile/scripts/verify-merged-manifests.sh` is extended with `REQUIRED_BASE_PERMS` (9 entries asserted present on BOTH apkRollout + playStore merged outputs) and `FORBIDDEN_BASE_PERMS` (3 entries asserted absent on both — POST_NOTIFICATIONS, FINE_LOCATION, COARSE_LOCATION). REQUEST_INSTALL_PACKAGES is intentionally omitted from the forbidden list because Phase 1's upstream check already enforces "absent on playStore, present on apkRollout" — duplicating it would have flagged the legitimate apkRollout scoping. The greps target the actual `<uses-permission .../>` line shape so prose comments mentioning a permission name for documentation do not trip the gate.

### Task 2 — PermissionsScreen + 6 tests (commits `e91b6b1` RED + `bd8f4df` GREEN-via-misnamed-commit)

`apps/mobile/src/screens/permissions/PermissionsScreen.tsx` (208 LOC) replaces the 02-05 stub. State machine: `idle → (tap) requesting → granted → navigation.replace('Compat')` on the happy path; `idle → requesting → denied|partial → (tap) openSettings()` on the recovery path. Copy is verbatim from design-spec §3a (idle) and §4.1.1 (recovery). The icon flips Camera → Ban on recovery. Analytics events fire at every fork (`permission_camera_requested|granted|denied`, same for mic). PERM-03 (coarse Location) is intentionally NOT prompted — Phase 4 territory.

Six unit tests in `apps/mobile/__tests__/screens/PermissionsScreen.test.tsx` exercise the full matrix:

1. **Initial mount** — renders the verbatim §3a title (newline preserved), body, and "Allow access" CTA.
2. **Happy path** — sequential `request(CAMERA)` → `request(RECORD_AUDIO)`, both granted → `setPermsGranted({camera: true, mic: true, grantedAt: <ISO>})` + `navigation.replace('Compat')`.
3. **Camera denied** — recovery state surfaces verbatim §4.1.1 copy + "Open Settings" CTA fires `openSettings()`; navigation.replace NOT called.
4. **Camera granted, mic denied** — partial state names "Microphone" specifically.
5. **BLOCKED on both** — treated identically to DENIED (Open Settings is the only recovery).
6. **Analytics shape** — granted path fires `*_granted` events; denial fires `*_denied`.

Tests query by `aria-label` + `textContent` instead of `getByText` because testing-library normalizes whitespace and would collapse the embedded `\n` in `"Camera & Mic\nPermissions"`.

`apps/mobile/vitest.setup.ts` lucide-react-native mock allowlist gains `Ban` so the denied-state icon resolves under JSDOM.

## Verification

- `apps/mobile/android/app/src/main/AndroidManifest.xml` declares all 7 required permissions; `! grep -q POST_NOTIFICATIONS|FINE_LOCATION|COARSE_LOCATION|REQUEST_INSTALL_PACKAGES <uses-permission ...>` succeeds against the source. CI gate runs the assertion against the merged manifest on each flavor.
- `cd apps/mobile && npm run test -- __tests__/screens/PermissionsScreen.test.tsx` → **6/6 pass**.
- `cd apps/mobile && npm run typecheck` → exits 0.
- The plan-body acceptance grep set (`grep -q "android.permission.CAMERA"`, `grep -q "FOREGROUND_SERVICE_CAMERA"`, `grep -q "Camera & Mic"`, `grep -q "PERMISSIONS.ANDROID.CAMERA"`, `grep -q "PERMISSIONS.ANDROID.RECORD_AUDIO"`, `grep -q "navigation.replace('Compat')"`) all succeed.

The full `apps/mobile && npm run test` run also exposes 3 pre-existing failures in `RootNativeStack.test.tsx` and 6 in `RigTutorialScreen.test.tsx` — both are out of scope for plan 02-10 (they trace to plan 02-05's `appStore` mock that another plan altered, and to plan 02-11's RED-still-pending state). They are tracked in `phases/02-mobile-shell-onboarding-permissions-compat-profile/deferred-items.md`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] Plan body's draft Button used children, not the `label` prop**

- **Found during:** Task 2 GREEN.
- **Issue:** The plan body's PermissionsScreen draft passed `<Button ...>{loading ? 'Requesting…' : buttonLabel}</Button>` — but the Phase 2 Button primitive (`apps/mobile/src/ui/primitives/Button.tsx`) takes a required `label: string` prop, not children. Trying the plan-body code as-is would have failed typecheck.
- **Fix:** Implementation uses `<Button label={buttonLabel} accessibilityLabel={buttonLabel} disabled={isRequesting} />`. Loading is signaled via `disabled`; the label itself flips between 'Allow access' / 'Open Settings'.
- **Files:** `apps/mobile/src/screens/permissions/PermissionsScreen.tsx`.
- **Commits:** `bd8f4df` (the misnamed-but-correct GREEN commit; see Commit History narrative).

**2. [Rule 3 — Blocking issue] vitest lucide-react-native mock missing `Ban`**

- **Found during:** Task 2 GREEN, first test run.
- **Issue:** PermissionsScreen imports `Ban` from `lucide-react-native` for the §4.1.1 denied-state icon. The vitest.setup.ts mock pre-populates a fixed allowlist of icons that map to `<span data-icon={name} />` stubs; icons not in the allowlist resolve to `undefined`, which crashes the JSDOM render. `Ban` was not in the list (Phase 2 plan 02-05 only seeded the icons that screen needed at the time).
- **Fix:** Added `'Ban'` to the ICONS allowlist in `apps/mobile/vitest.setup.ts` with an inline comment pointing at plan 02-10.
- **Files:** `apps/mobile/vitest.setup.ts`.
- **Commits:** `bd8f4df`.

**3. [Rule 1 — Test bug] testing-library text matcher normalizes whitespace**

- **Found during:** Task 2 GREEN, first test run.
- **Issue:** The plan body's draft tests used `getByText('Camera & Mic\nPermissions')` and `findByText(/Camera & Mic are required/i)`. testing-library's default text matcher (a) normalizes whitespace (collapsing `\n` to a single space) — masking a regression where the design-spec line break is dropped — and (b) over-matched the regex on Test 3 / Test 5 because both the title (`"Camera & Mic\nare required"`) and the body (`"Camera & Mic are required. Open Settings to enable."`) contained the substring.
- **Fix:** Tests now query the addressable Text node by its `accessibilityLabel` (`"permissions title"` / `"permissions body"`) and assert against `textContent`, which preserves the embedded `\n` and is exact (not substring). All 4 affected tests (1, 3, 4, 5) refined.
- **Files:** `apps/mobile/__tests__/screens/PermissionsScreen.test.tsx`.
- **Commits:** `bd8f4df`.

### Auth gates encountered

None.

### Out-of-scope discoveries (logged, NOT fixed)

- `__tests__/navigation/RootNativeStack.test.tsx` — 3 failing navigation tests because `vi.mock('../../src/state/appStore', ...)` factory in the test returns an object literal that the real RootNativeStack uses as a callable hook. Authored at plan 02-05; broken by a later mock-factory change. Logged in `deferred-items.md` for plan 02-05's owner.
- `__tests__/screens/RigTutorialScreen.test.tsx` — 6 failing tests because plan 02-11's GREEN body lives unstaged in the worktree but was never committed by 02-11's executor agent. Logged in `deferred-items.md` for plan 02-11's owner.

## Multi-agent worktree contention narrative — Commit History

This section documents an unusual git-history situation that an unrelated reviewer should be aware of when reading the wave's PR.

The single git worktree at `/Users/adnaan/Documents/hl-homelander/.claude/worktrees/agent-abadb4606602655c3` was used CONCURRENTLY by at least four GSD executor agents executing plans 02-08, 02-09, 02-10, and 02-11. The commit messages in the worktree do not always match the actual file content of the commits, because:

1. Plan 02-10 Task 1 committed cleanly at `bc08e43` (manifest + CI gate). 100% of `bc08e43`'s diff is plan 02-10's manifest + CI script.
2. Plan 02-10 Task 2 RED test committed cleanly at `e91b6b1` (the 6 failing tests + the test file's first eslint+prettier pass). 100% of `e91b6b1`'s diff is the test file.
3. Plan 02-10 Task 2 GREEN was attempted at `9fdf290` with the message `feat(02-10): implement PermissionsScreen — Camera+Mic sequential prompt + denied recovery (GREEN)`, but its actual file content is `versionService.ts` + `semver.ts` (which are plan 02-08 artifacts). The lint-staged pre-commit hook auto-stages untracked TS files matching `*.{ts,tsx}` after running prettier; another agent's uncommitted untracked files in the same worktree got hoovered up by my hook run and replaced the staged tree.
4. Subsequently another agent's commit `bd8f4df` (`test(02-09): add 9 failing SignupScreen tests (RED)`) ended up bundling plan 02-10's actual GREEN content (PermissionsScreen.tsx 208 LOC, the test refinements, the `Ban` icon mock) along with the plan 02-09 SignupScreen RED test. Same lint-staged behaviour, this time in the other direction.

Per `<destructive_git_prohibition>` no history rewrite (`git update-ref` / amend / rebase) was attempted. The end-state tree of HEAD is correct — all 6 plan 02-10 PermissionsScreen tests pass, typecheck is clean, the manifest + CI gate from Task 1 are present and unaltered. The commit messages should be read with this caveat.

The lint-staged behaviour that caused this is reproducible and worth filing as a worktree-isolation gap to fix at the orchestrator layer (every executor should get its own worktree, NOT share one).

## Self-Check: PASSED

- `apps/mobile/src/screens/permissions/PermissionsScreen.tsx` — FOUND in HEAD (208 LOC, my full implementation).
- `apps/mobile/__tests__/screens/PermissionsScreen.test.tsx` — FOUND in HEAD (216 LOC, 12 references to `findByLabelText` / `textContent`).
- `apps/mobile/vitest.setup.ts` — FOUND in HEAD with `'Ban'` entry in lucide-react-native ICONS allowlist.
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — FOUND in HEAD with all 7 Phase 2 permissions + 3 uses-feature filters.
- `apps/mobile/scripts/verify-merged-manifests.sh` — FOUND in HEAD with REQUIRED_BASE_PERMS + FORBIDDEN_BASE_PERMS lists.
- Commit `bc08e43` (Task 1) — FOUND in `git log --all`.
- Commit `e91b6b1` (Task 2 RED) — FOUND in `git log --all`.
- Commit `bd8f4df` (Task 2 GREEN, mis-labeled) — FOUND in `git log --all`.
- All 6 PermissionsScreen tests pass against HEAD.
- `npm run typecheck` exits 0.
