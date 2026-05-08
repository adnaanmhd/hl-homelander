# Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 turns the Phase 1 sign-in-only mobile scaffold into the entire **non-recording** client surface for Android. Concretely:

- **Onboarding flow** — Splash → Sign-up (full layout per design-spec §2 with consent + Terms-of-Use modal) → Permissions (Camera + Microphone; coarse Location is deferred to first recording) → Compatibility check (behavioral, COMPAT-07) → Tutorial chrome (Rig screen + "Don't have a rig" off-ramp). The 60-second practice recording itself is **NOT** in Phase 2 — it requires HumynCapture (Phase 3) and HumynHandDetector (Phase 4). Phase 2 lands the Rig screen and stops there; Phase 4 picks up at "Practice intro".
- **Authentication & session lifecycle** — full Sign-up screen consuming Phase 1's `/auth/google` round-trip (already shipped). JWT persists in MMKV `humyn.secure` (already wired). Account-delete with `DELETE`-typing gate hits `DELETE /me` (Phase 1 endpoint). AUTH-11 forces a full compat re-run when the same Google account lands on a new device.
- **Behavioral compatibility check (COMPAT-07)** — slim Kotlin `HumynCompat` native module, separate from Phase 3's `HumynCapture`. Performs NAL-unit B-frame parse on a 5-second test clip, OIS readback, HDR→SDR force, IMU sustained ≥100 Hz over 30 s with 1080p preview running, root verdict, ultrawide dFOV, microphone 48 kHz, REALTIME timestamp source, free-storage check. Result is a structured `CompatResult` Zod object stored in MMKV; the failedKeys list drives the COMPAT-06 fail screen.
- **Bottom navigation chrome** — 3-tab `MainTabs` (Home / Tasks / History). Profile is a stack-pushed screen reached via the avatar in the top-right of `MainTabs`. HOME-08 suppression is satisfied structurally because tabs only exist inside `MainTabs`; onboarding stack, recording surface (Phase 4), player (Phase 6), and force-upgrade modal all sit on a sibling `RootStack` level. Phase 2 ships the navigator skeleton and Home **only** to the degree HOME-07/08 require (3-tab bar + suppression on the right screens). Full Home dynamic tiles + filters + first-time vs returning hero are Phase 6.
- **Profile** — full surface per PROF-01..05: Google avatar (read-only), editable name + nullable age + nullable gender (PATCH /me), non-editable Joined date, lifetime contribution numeric (44 px mono) + "Across N tasks", "Coming soon" Payments card, app version + build identifier in the footer, Help Center entry, Logout (clears JWT + cancels in-flight upload — but no uploads exist yet at Phase 2; this is a placeholder hook), Delete account flow (30-day soft-delete; DELETE-typing gate).
- **Help Center** — 3 accordions (Instructions Guide / FAQs / Troubleshooting) sourced verbatim from `help-center-content.md`, Contact Support mailto entry, in-app "Report a problem" form posting diagnostic snapshots to `POST /feedback` (Phase 1 endpoint).
- **Forced Upgrade gate** — `GET /app/version` (Phase 1 endpoint) called at splash with 6 h MMKV cache; flavor-aware `ForceUpgradeScreen`: apkRollout downloads APK from `apk_url`, SHA-256 verifies against `apk_sha256`, launches `PackageInstaller.Session`; Play Store flavor opens `market://` deep-link. Soft-upgrade banner mounts at top of Home with per-`latest` dismiss persistence in MMKV.
- **Foundation work that lands here once and is reused everywhere** — React Navigation v7 navigator skeleton, MMKV-backed onboarding state (Zustand), `apps/mobile/src/ui/tokens.ts` + 8 minimal primitives, brand fonts wired via `react-native-asset`, `lucide-react-native` for general icons (existing `<TaskIcon>` keeps task-card icons).
- **Critical-path infra: pnpm → npm migration for `apps/mobile/`** — first plan in Phase 2. Removes `apps/mobile` from `pnpm-workspace.yaml`, switches mobile to `npm` with `file:` link to `shared/types/`, fixes the recurring Gradle build failures (RN autolinking + pnpm symlinks). Backend + shared stay on pnpm.

**Explicitly OUT of Phase 2 scope:**

- Practice recording (Phase 4 — needs HumynCapture + HumynHandDetector)
- Recording surface, hand-gate UX, lifecycle edges (Phase 4)
- Full Home dynamic tiles + time-range filters (Phase 6 — only HOME-07/08 nav-shape requirements ship in Phase 2)
- Tasks browsing / search / details / Send Request (Phase 6)
- History list / player (Phase 6)
- Upload pipeline (Phase 5)
- iOS analogues — Phase 7. Phase 2 is **Android-only**.

</domain>

<decisions>
## Implementation Decisions

### Navigation architecture

- **D-NAV-01:** **React Navigation v7** (`@react-navigation/native` + `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`). New Architecture (Hermes) compatible. Native-stack uses platform `UINavigationController`/`Fragment` for true platform feel.
- **D-NAV-02:** Navigator graph shape:
  ```
  RootNativeStack
    ├── OnboardingStack (Splash → Signup → Permissions → Compat → RigTutorial)
    ├── MainTabs (bottom-tabs: Home / Tasks / History)  ← Profile is pushed onto Root, not a tab
    ├── Recording (full-bleed, Phase 4)
    ├── Player (full-bleed, Phase 6)
    └── ForceUpgrade (modal presentation)
  ```
  HOME-08 suppression is automatic — the bottom tab bar is mounted only inside `MainTabs`. Onboarding completion does `navigation.replace('MainTabs')`, satisfying the "no back to splash/sign-up" rule from engineering-handoff §3.3.
- **D-NAV-03:** Deep-link surface ships per engineering-handoff §3.4: `humyn://signup`, `humyn://home`, `humyn://tasks?cat=...`, `humyn://tasks/{id}`, `humyn://record/{taskId}`, `humyn://history?range=...`, `humyn://history/{id}`, `humyn://profile`, `humyn://help`. Phase 2 wires the linking config + the routes that exist by Phase 2 (signup, home, profile, help). Tasks/history/record routes resolve to placeholder/stub navigation handlers until Phase 4/6 lights them up.
- **D-NAV-04:** Hardware back behavior matches engineering-handoff §3.3 — Sign-up exits app; Permissions/Compat/Tutorial have no back; Tasks/History/Profile/Help back to Home; ForceUpgrade modal blocks back when `hardBlock=true`.

### Onboarding state & resume

- **D-STATE-01:** Single MMKV instance `humyn.secure` (already wired in `apps/mobile/src/services/auth.ts`) holds canonical onboarding flags. Keys (versioned for forward-compat):
  - `auth.jwt.v1` (already exists)
  - `onboarding.consent.v1` — `{ acceptedAt, consentVersion }`
  - `onboarding.permsGranted.v1` — `{ camera: bool, mic: bool, grantedAt }`
  - `onboarding.compatPassed.v1` — `{ signature, runAt, passed: true }` (full result lives at `compat.lastResult.v1`)
  - `onboarding.tutorialDone.v1` — `{ doneAt, googleSub }` (per PROF-01 + ONB-08: once per install per Google account)
  - `installation_id.v1` — UUID minted at first launch; survives app updates, resets on uninstall (input to compat signature)
- **D-STATE-02:** **Zustand** is the in-memory store. Hydrates from MMKV on app boot. Single store at `apps/mobile/src/state/appStore.ts`. The navigator's initial route is computed from hydrated state inside `App.tsx`. No Redux, no Context-only.
- **D-STATE-03:** **Resume behavior:** cold start re-computes initial route from MMKV every time. Background → foreground re-checks: (a) JWT expiry, (b) OS-level permission status (so a user returning from Settings with the grant lands on the right screen). Transient screens (Compat-running, future hand-gate) restart their own work — their state is not persisted mid-flight.
- **D-STATE-04:** **AUTH-11 ("same Google account, new device, re-run compat")** is detected client-side via `compatSignature` containing `installation_id`. New install on a new device → fresh UUID → signature mismatch → forced compat re-run. No backend round-trip required.

### Compat-check execution path (COMPAT-07)

- **D-COMPAT-01:** Slim **`HumynCompat`** Kotlin native module at `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt`. Separate from Phase 3's `HumynCapture`. Two modules, focused; no shared library extraction at MVP.
- **D-COMPAT-02:** Three method surface:
  - `runEncoderProbe(): Promise<{bFramePresent, oisOff, hdrSdrForced, encoderClipPath}>` — 5-second 1080p HEVC test recording → NAL-unit parse to detect B-frames → OIS readback via `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` → HDR-mode SDR force via `DynamicRangeProfile.STANDARD`. Test clip writes to `context.cacheDir/compat-probe-{epochMs}.mp4`, deleted in `finally`.
  - `runImuProbe(durationMs: 30000, withPreview: true): Promise<{sustainedHz, p99IntervalMs, samplesCollected}>` — 30 s IMU sampling at `SENSOR_DELAY_FASTEST` with `maxReportLatency=0` while a 1080p Camera2 preview runs, computes sustained Hz + inter-sample p99.
  - `readDeviceCaps(): Promise<{resolutionMax, fpsMax, ultrawideDfovDeg, micSampleRateMax, realtimeTimestampSource: bool, rooted: bool, freeStorageGB}>` — non-recording capability enumeration.
- **D-COMPAT-03:** **`compatSignature`** = hash (SHA-256, hex, first 16 chars) of `${appVersionCode}|${Build.FINGERPRINT}|${installation_id}`. Stored in MMKV at `compat.lastResult.v1.signature`. COMPAT-04 re-run trigger = current signature != stored signature.
- **D-COMPAT-04:** **Test-clip lifecycle:** writes to `context.cacheDir/compat-probe-{epochMs}.mp4` (~5 MB at 1080p HEVC 8 Mbps × 5 s). Deleted in a Kotlin `finally` block immediately after NAL parse + OIS + HDR readbacks return. App-launch sweep runs in `MainApplication.onCreate` to unlink any orphan `compat-probe-*.mp4` left by a crashed probe. Never enters upload queue (cacheDir is segregated from any future recordings dir).
- **D-COMPAT-05:** **`CompatResult` schema** lives at `shared/types/CompatResult.ts` (Zod). Shape:
  ```ts
  z.object({
    signature: z.string(),
    runAt: z.string().datetime(),
    checks: z.object({
      resolution: z.boolean(),
      fps: z.boolean(),
      ultrawideDfov: z.object({ pass: z.boolean(), measuredDeg: z.number() }),
      imuSustained100Hz: z.object({ pass: z.boolean(), measuredHz: z.number() }),
      imuP99Ms: z.object({ pass: z.boolean(), measuredMs: z.number() }),
      micSampleRate: z.boolean(),
      realtimeTimestamp: z.boolean(),
      root: z.object({ pass: z.boolean(), verdict: z.string() }),
      freeStorageGB: z.object({
        pass: z.boolean(),
        warningOnly: z.boolean(),
        measuredGB: z.number(),
      }),
      encoderNoBFrames: z.boolean(),
      oisOff: z.boolean(),
      hdrSdrForced: z.boolean(),
    }),
    passed: z.boolean(),
    failedKeys: z.array(z.string()),
  });
  ```
  Stored in MMKV at `compat.lastResult.v1`. `failedKeys` drives the COMPAT-06 fail screen; the `measured*` fields drive the prototype-style "yours: 44 Hz" copy on the failed-IMU branch.

### Design tokens & primitive components

- **D-UI-01:** **Tokens via typed-constants** at `apps/mobile/src/ui/tokens.ts`. Exports `colors`, `typography`, `spacing`, `radii`, `motion` as deeply-typed objects sourced verbatim from engineering-handoff §1 + design-spec §0. No theme provider at MVP (light-only per PROJECT.md constraint; the recording surface is the one dark surface and is Phase 4 territory). No runtime theming dep added.
- **D-UI-02:** **Minimal primitive set** at `apps/mobile/src/ui/`: `Text`, `Button`, `Pressable`, `ScreenContainer`, `Sheet`, `Modal`, `Field`, `Icon`. Each consumes tokens via `StyleSheet.create`. Naming + variant API match design-spec §0.5 universal components. Domain components (TaskCard, Tile, Accordion, ProgressRing, Toast, Confetti) ship per-screen as needed and graduate to primitives only if reused across phases.
- **D-UI-03:** **Fonts** wired via `react-native-asset`. Brand fonts copied from `design-system/` into `apps/mobile/assets/fonts/`. `react-native.config.js` lists `assets: ['./assets/fonts/']`. `npx react-native-asset` links into Android `app/src/main/assets/fonts/` + iOS `Info.plist UIAppFonts` (iOS wiring exists for Phase 7 — iOS bundle is Android-only-buildable in Phase 2 but font registration is symmetric). `tokens.typography.*.fontFamily` references the registered family names.
- **D-UI-04:** **Icons** — `lucide-react-native` for general iconography (e.g., `front_hand`, `videocam`, `lightbulb`, `apps`, `SearchX`, profile-related icons). Existing `<TaskIcon task={slug}>` from `design-system/task-icons/TaskIcon.tsx` continues to render task-card icons via the `LucideIconName` taxonomy locked at compile-time. Both render the same Lucide set; the split keeps the task taxonomy constraint intact.
- **D-UI-05:** **Light-only** at MVP — explicitly no dark-mode tokens, no theme provider. Recording surface (Phase 4) is the lone dark surface and ships its own scoped style overrides; it doesn't consume the global tokens for backgrounds.

### Forced-upgrade flow (per-flavor)

- **D-UPG-01:** **Flavor-aware single `ForceUpgradeScreen`** component reads `flavor` from `getFlavorContext()` (already wired in `apps/mobile/src/native/AppFlavor.ts`).
  - **apkRollout:** download APK via `fetch(apk_url)` to `cacheDir/update-{epochMs}.apk` with progress UI → SHA-256 verify against `apk_sha256` from `/app/version` response → on match, call `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` to grant per-app install consent if needed → launch `PackageInstaller.Session` → system installer takes over.
  - **playStore:** open `market://details?id=ai.humynlabs.capture` (fall back to `https://play.google.com/store/apps/details?id=...` if Play Store app missing).
- **D-UPG-02:** **Hash-mismatch handling:** if SHA-256 ≠ `apk_sha256`, delete the downloaded file, show "Update failed (integrity check). Try again or contact support", emit `force_upgrade_apk_hash_mismatch` Firebase Analytics event with `{apk_url, expectedHash, actualHash, downloadedSize}`. NEVER pass a hash-mismatched APK to `PackageInstaller`.
- **D-UPG-03:** **`REQUEST_INSTALL_PACKAGES`** is declared only in `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` (Phase 1's flavor-scoped manifest pattern, D-APK-02). Play Store flavor's manifest does NOT declare it (Play policy compliance).
- **D-UPG-04:** **Version-check timing:** fires on Splash (cold start) before any other navigation. MMKV cache key `appVersion.cache.v1` = `{response, fetchedAt}`. Cache is consulted first; if missing or `now - fetchedAt > 6h`, call `/app/version` with a 5 s timeout. Network failure → proceed without gating (don't punish offline users); next foreground re-checks. After resolving, evaluate:
  - `installedVersion < min_supported` → `navigation.replace('ForceUpgrade', { hardBlock: true })`
  - `< latest && force_upgrade=false` → set `softUpgradeAvailable: true` in Zustand store (Home reads it)
  - else proceed
- **D-UPG-05:** **Soft-upgrade banner** mounts at the top of Home only. Tap dismiss → MMKV key `appVersion.softBannerDismissed.{latest}` = `true`. When `latest` changes (next response from `/app/version`), the per-version key resets and the banner re-shows. Banner does NOT mount on Tasks/History/Profile/sub-screens. Copy + CTA per design-spec §9 (Phase 6 will refine when the rest of Home lands; Phase 2 ships the banner shell + dismiss logic). The "Update" CTA reuses the same per-flavor logic as `ForceUpgradeScreen`.
- **D-UPG-06:** **`installedVersion`** comparison source = Android `versionName` from `BuildConfig.VERSION_NAME` (semver string, e.g., `"0.1.0"`). Comparison via a tiny semver helper (no full library — handful of dot-separated integer comparisons).
- **D-UPG-07:** **Backend `/app/version` response shape** is per-flavor (Phase 1 already shipped the endpoint; Phase 2 validates it returns the right per-flavor fields):
  - apkRollout: `{ min_supported, latest, force_upgrade, apk_url, apk_sha256 }`
  - playStore: `{ min_supported, latest, force_upgrade, play_store_url }`
  - The flavor passed via the request (or detected from JWT post-auth, if relevant) decides which payload variant returns. Phase 2 plan's first task confirms the Phase 1 implementation matches; if it doesn't, file a Phase 1 fix-forward plan.

### Mobile package-manager migration (lands FIRST in Phase 2)

- **D-PKG-01:** **Isolate `apps/mobile/` from the pnpm workspace.** Backend (`apps/api`) + shared (`shared/types`) stay on pnpm at the root. Mobile gets its own `package-lock.json` via npm.
- **D-PKG-02:** **Mobile uses npm.** Flat `node_modules/`, no symlinks, satisfies RN autolinking + Gradle relative-path assumptions. `apps/mobile/package.json` adds `"@humyn/types": "file:../../shared/types"`. Re-running `npm install` after editing shared/types re-copies (we'll add a small wrapper script to `npm run dev` if cross-edit refresh becomes painful in practice).
- **D-PKG-03:** **Workspace surgery:** remove `apps/mobile` from `pnpm-workspace.yaml` (only `apps/api` + `shared/*` remain). Root `pnpm typecheck/lint/test` continue to operate over the remaining workspace members. Mobile gets its own `npm run typecheck/lint/test` invoked from its own dir.
- **D-PKG-04:** **CI workflow update** (`.github/workflows/ci.yml`): existing pnpm jobs unchanged; add a separate "Mobile build" job that runs `cd apps/mobile && npm ci && npm run typecheck && npm run lint && npm run test && cd android && ./gradlew assembleApkRolloutDebug` on a clean checkout. Caches keyed on `apps/mobile/package-lock.json`.
- **D-PKG-05:** **Lint-staged + Husky** updated so `apps/mobile/**/*` globs use the mobile package's tooling, not the root pnpm setup. Other globs continue with the root tools.
- **D-PKG-06:** **Phase 1 historical docs** (planning docs, SUMMARY files referencing `pnpm --filter @humyn/mobile ...`) are NOT rewritten. They describe the state at Phase 1's timestamp, which is accurate. Phase 2's CONTEXT/PLAN documents the migration; future readers find the reason here.
- **D-PKG-07:** **Plan layout:** migration is plan **02-01** (atomic, dedicated). Tasks: (1) remove apps/mobile from pnpm-workspace; (2) add apps/mobile/package-lock.json via `npm install`; (3) verify `apps/mobile/android/settings.gradle`'s `../../../node_modules/...` relative path still resolves under flat npm node_modules; (4) update root scripts + CI; (5) smoke `cd apps/mobile && ./gradlew assembleApkRolloutDebug` on a clean checkout (manual on developer machine; CI runs the same command). Until 02-01 is green, no further Phase 2 plans land.

### Profile, Help Center, and remaining surfaces (planner-level details to confirm in plan)

- **D-PROF-01:** Profile editable fields (PROF-01) use **inline Field-edit pattern**: tap a Field → Field becomes editable inline → blur or "Save" tap fires `PATCH /me` → optimistic UI with revert-on-error. No modal-edit screen. Error toast on PATCH failure with revert. Locked at this level; planner picks the exact UX details from design-spec §15.
- **D-HELP-01:** Help-Center content (HELP-02 verbatim from `help-center-content.md`) is **parsed at build-time**: a small build script reads the markdown, emits `apps/mobile/src/screens/help/content.json`, and the Help screen renders accordions from the JSON. JSON is committed (deterministic, reviewable). Editing `help-center-content.md` re-runs the script.
- **D-HELP-02:** **Diagnostic-snapshot ring buffer (HELP-05)** — last-100-events buffer lives in MMKV under `telemetry.ring.v1` as a JSON array, capped at 100 entries via FIFO trim. Every Firebase Analytics event we fire also writes to this ring. "Report a problem" form's `POST /feedback` body includes `{ appVersion, buildIdentifier, osVersion, deviceModel, telemetryRing: [...] }`. No PII beyond what's already in events.
- **D-DEL-01:** **Account-delete (AUTH-09/10):** typing-gate modal → tap Delete → call `DELETE /me` → on 200, clear all MMKV keys under the `humyn.secure` instance, navigate to `OnboardingStack/Signup` via `navigation.reset()`. No upload queue exists yet at Phase 2; in Phase 5 the same flow will additionally cancel in-flight uploads. Restore window is server-side (Phase 1 already ships `POST /me/restore`); the user has no in-app surface to trigger restore — they re-sign-in within 30 days and the server transparently un-soft-deletes (Phase 1 contract).

### Locked from upstream (carried forward, not re-discussed)

These are LOCKED in PROJECT.md / .planning/research/STACK.md / engineering-handoff.md / design-spec.md / Phase 1 CONTEXT (`.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md`) and unconditionally apply:

- **Designs LOCKED** to `prototype.html` + `design-spec.md` + `engineering-handoff.md`. Every screen, state, copy string, animation curve, and token comes verbatim from those files. No new design work in Phase 2.
- **Stack pins (mobile):** `react-native@0.83.x`, `react@19.2.x`, Hermes V1, New Architecture, `@react-native-google-signin/google-signin@16.1.2` (Credential Manager API), `@react-native-firebase/{app,auth,remote-config}@24.0.0`, `react-native-keychain@10.0.0`, `react-native-mmkv@4.3.1`, `react-native-config@1.6.1`. New deps added in Phase 2: `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`, `zustand`, `lucide-react-native`, `react-native-asset` (devDep). All RN-0.83 + new-arch compatible; researcher confirms exact versions during phase-research.
- **Auth contract** (Phase 1 D-AUTH-01..05) — `/auth/google` exchanges `{googleIdToken, integrityToken, flavor, applicationId, nonceId}` for a 30-day HS256 JWT with `{sub, iat, exp, flavor, applicationId, integrity_verdict, token_version}` claims. JWT TTL = 30 days, no refresh token. Logout = client deletes token from MMKV.
- **Build flavors** (Phase 1 D-FLAV-01..03) — apkRollout = `ai.humynlabs.capture.apk` + `REQUEST_INSTALL_PACKAGES` declared; playStore = `ai.humynlabs.capture` + no install-packages permission. Identical branding across flavors.
- **17 backend endpoints** (Phase 1 API-01..17) all shipped: `POST /auth/google`, `POST /auth/nonce`, `GET/PATCH/DELETE /me`, `POST /me/restore`, `GET /tasks` + `/tasks/{id}`, `POST/GET /task-requests`, `POST /recordings`, `PATCH /recordings/{id}`, `GET /recordings`, `GET /recordings/{id}`, `GET /contributions`, `GET /contributions/timeseries`, `POST /events`, `POST /feedback`, `GET /app/version`. Phase 2 consumes a strict subset: `/auth/google`, `/auth/nonce`, `GET /me`, `PATCH /me`, `DELETE /me`, `POST /me/restore`, `POST /feedback`, `GET /app/version`, `GET /contributions` (for PROF-03 lifetime-contribution numeric).
- **RFC 7807 `application/problem+json`** for all error responses (Phase 1 API-14). Mobile error UI surfaces the `title` + maps `type` URI to user-readable copy.
- **Idempotency-Key** header on `POST`/`PATCH` writes (Phase 1 API-15). Mobile generates ULIDs.
- **Firebase Analytics** is the primary telemetry sink. Backend `/events` exists for diagnostic snapshot relay (HELP-05). No FCM/APNs at MVP.
- **No notifications channel** — no `POST_NOTIFICATIONS`, no FCM/APNs (PROJECT.md constraint).
- **English only** at MVP (PROJECT.md).
- **Light theme only**, except recording surface (Phase 4) which is the one dark surface (PROJECT.md / design-spec §0).
- **No clan-chief / KGeN narrative** (Phase 1 D-DIST-01; memory `feedback_no_clan_chief_constructs.md`).
- **No precise-location capture; coarse only** (PROJECT.md). Permissions screen prompts only Camera + Mic in Phase 2; coarse Location is delayed to first-recording in Phase 4.
- **No success metrics gating phase completion** (PROJECT.md). Phase 2 ships by-vibe.

### Claude's Discretion

Areas where the user did not specify and the planner has flexibility:

- **Motion/animation library** — `Animated` (built-in) vs `react-native-reanimated@3` for the design-spec §0.4 motion (4.9 s compat ring stroke-dashoffset, scalePop logo on Splash, 130×130 hand-gate ring [Phase 4], confetti on Practice-complete [Phase 4]). Reanimated is the de-facto choice for any non-trivial animation in modern RN; planner confirms RN 0.83 + new-arch compatibility during research. Default expectation: Reanimated 3.
- **Haptics library** — `react-native-haptic-feedback` vs hand-rolled native module. Phase 2 needs only the 20 ms permission-grant haptic and the 40 ms compat-pass-step haptic; trivial. Planner picks.
- **Toast implementation** — hand-rolled component using existing `Sheet` primitive, vs a library (`react-native-toast-message`). Recording-stop toast (REC-04) is Phase 4; Phase 2's only toast is on PATCH error. Planner picks.
- **Inline-edit Field UX micro-details** — keyboard avoidance, focus management, error display position. Locked at "inline-edit pattern with optimistic UI" per D-PROF-01; details fall to planner.
- **Help-Center markdown parsing tool** — small Node script using `marked` / `unified` / regex. Planner picks.
- **Semver comparison helper for `installedVersion`** — hand-rolled vs `semver` package. Planner picks; hand-rolled is fine for the constrained `M.m.p` shape.
- **Splash duration / animation** — design-spec §1 calls for ~2.4 s splash. Whether the version check awaits a minimum splash time (so the user sees the brand) or transitions immediately on resolve — planner picks.
- **Deep-link routes for Phase-4/6 surfaces** — wire as placeholder navigation handlers in Phase 2 vs throw `notImplementedYet` until the surface lands. Either is fine; default is placeholder handlers that resolve to "Coming soon" copy.
- **`react-native-permissions` vs platform-direct** — Phase 2 needs Camera + Mic runtime prompts; `react-native-permissions` gives a unified API. Planner picks; default is `react-native-permissions`.
- **Profile Joined-date source** — `users.created_at` from `GET /me`; format is design-spec §15 territory. Locked field, formatting is planner.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope, requirements, and success criteria

- `.planning/ROADMAP.md` — Phase 2 entry (success criteria #1–5; depends-on Phase 1; UI hint: yes).
- `.planning/REQUIREMENTS.md` — 41 v1 requirements mapped to Phase 2: AUTH-01..05, AUTH-07..11; PERM-01..04; COMPAT-01..08; ONB-01..02; HOME-07..08; PROF-01..05; HELP-01..05; UPG-01..05.
- `.planning/PROJECT.md` — locked constraints (designs locked, light theme, English only, no notifications, no precise location). **NOTE:** still references stale clan-chief / KGeN narrative; treat that as superseded per Phase 1 D-DIST-01 + memory `feedback_no_clan_chief_constructs.md`. Cleanup deferred.
- `.planning/STATE.md` — current position; resume notes carry the Phase 1 → Phase 2 handoff.

### Locked design source-of-truth (mandatory reads for Phase 2)

- `prototype.html` — click-through reference for every Phase 2 screen. Source of truth for layout, transitions, and pixel positioning.
- `design-spec.md` — screen-by-screen design with full state enumeration. Phase 2 hot-spots: §0 (foundations: tokens), §0.5 (universal components), §1 (Splash), §2 (Sign-up), §3 (Permissions — §3a Camera & Mic; §3b Location is variant-only and unreachable in main flow per spec), §4 (Compatibility check — §4a–§4d states), §5 (Tutorial Rig screen), §15 (Profile), §16 (Filter sheet — Phase 6 mostly but base sheet primitive lands here).
- `engineering-handoff.md` — engineering contract. Phase 2 hot-spots: §1 (design tokens — colors, typography, spacing, radii, elevation, motion), §1.7 (iconography), §2 (component inventory), §3 (navigation graph + routing semantics + deep-link surface), §4.1 (Permissions state machine), §4.2 (Compat-run state machine), §5 (Native APIs — including the Compat-check implementation notes table), §7 (data model — User entity is consumed by Phase 2 Profile via `/me`).
- `idea-brief.md` §5.2 — verbatim Terms-of-Use / consent text (rendered in Sign-up modal AUTH-03). §14 (privacy/consent context).
- `help-center-content.md` — verbatim Help Center copy (HELP-02 source of truth). 3 accordions: Instructions Guide, FAQs, Troubleshooting.
- `design-system/` — Humyn Labs Brand Book PDF, fonts, logos. Phase 2 wires fonts via `react-native-asset`. Brand colors / mark consumed by Splash + Sign-up.
- `design-system/task-icons/{mapping.json, mapping.ts, TaskIcon.tsx, index.ts}` — `<TaskIcon>` component (used in Phase 6, but the `LucideIconName` taxonomy continues to constrain the icon namespace).

### Phase 1 outputs (consume directly)

- `.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md` — Phase 1 implementation decisions; D-AUTH-01..05 and D-FLAV-01..03 and D-APK-01..04 carry forward unmodified into Phase 2.
- `.planning/phases/01-foundation-backend-distribution-recon/01-RESEARCH.md` — research synthesis from Phase 1.
- `apps/mobile/src/services/auth.ts` — full sign-in orchestration including MMKV `humyn.secure` instance, JWT key conventions (`auth.jwt.v1`), Keychain refresh-token slot reservation. Phase 2's onboarding state keys live alongside.
- `apps/mobile/src/services/api.ts` — `apiClient` HTTP wrapper. Phase 2 surfaces consume it for `/me`, `/feedback`, `/app/version`, `/contributions`.
- `apps/mobile/src/native/AppFlavor.ts` — `getFlavorContext()` returns `{flavor, applicationId}`. ForceUpgradeScreen consumes this for per-flavor routing.
- `apps/mobile/src/native/PlayIntegrity.ts` — Play Integrity native module surface. Sign-up screen reuses this; no changes in Phase 2.
- `apps/mobile/src/screens/SignIn.tsx` — Phase 1 minimal sign-in screen. **DELETED** in Phase 2 (replaced by full Sign-up screen per design-spec §2). Welcome view's `useState` pattern carries forward as a hint for Profile's inline-edit pattern.
- `apps/mobile/App.tsx` — Phase 1 root component (renders `<SignIn>` unconditionally). **REPLACED** in Phase 2 by `<NavigationContainer>` + `<RootNativeStack>` setup.
- `apps/mobile/android/app/build.gradle` — flavor configuration (apkRollout + playStore + signingConfigs + buildConfigField wiring). Phase 2 only adds the `REQUEST_INSTALL_PACKAGES` flavor-scoped manifest reference if not already present.
- `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` — flavor-scoped manifest. Phase 2 verifies (or adds) the `REQUEST_INSTALL_PACKAGES` permission per D-UPG-03.
- `apps/api/src/routes/app-version/` — Phase 1 backend implementation of `GET /app/version`. Phase 2 verifies the per-flavor response shape (D-UPG-07).

### Research synthesis (background; some references are stale)

- `.planning/research/SUMMARY.md` — research synthesis. Phase 2 hot-spots: P1 gaps (HOME-09 pull-to-refresh, HOME-10 offline banner, COMPAT-07 behavioral checks, COMPAT-08 recovery page, ONB-02 rig off-ramp, PROF-05 app-version footer, HELP-05 report-a-problem form). **NOTE:** still references the chief-recon narrative; treat that as superseded.
- `.planning/research/STACK.md` — version pins, configuration recipes. Phase 2 reads the React Navigation + Reanimated + react-native-screens compatibility recipe; the MMKV recipe; the lucide-react-native pattern.
- `.planning/research/ARCHITECTURE.md` — system architecture (3-plane device → backend → infra). Phase 2 lives entirely in the device plane; backend plane is consumed via the API surface.
- `.planning/research/PITFALLS.md` — pitfall catalog. Phase 2 hot-spots: Pitfall 1 (Camera2 + MediaCodec gotchas — relevant to HumynCompat encoder probe), Pitfall 14 (DPDP/LGPD bystander consent — Phase 4 territory but Sign-up's Terms text touches), Pitfall 15 (RN 0.83 + new-arch + native-modules wiring — informs the HumynCompat module shape).

### Operational / future (referenced but not Phase 2 scope)

- `imu-liveness-check.md` — Phase 5 territory.
- `strategic-suggestions.md` — PM-level v2 concerns.
- `deferred-decisions.md` — technical v2 deferrals.
- `figure-app-hands.md` — Phase 4 reference (hand-gate).
- `testing-guide.md` — Pixel 10a runbook + monorepo dev environment guide. Phase 2's npm-migration plan updates the mobile-side commands; this guide will need a touch-up commit when 02-01 lands.

### Active memories (apply unconditionally)

- `feedback_no_clan_chief_constructs.md` — no clan-chief / clan-aware constructs anywhere in Phase 2 surfaces.
- `project_distribution_apk_then_play.md` — distribution = APK first → Play Store → iOS, direct to users.
- `project_drift_metrics.md` — drift figures `{max, mean, p99}` are Phase 3+ territory; no Phase 2 surface displays them.
- `project_figure_minutes_app.md` — `0.16.0.apk` is Figure's app, not ours; Phase 2 does NOT consume it.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets (from Phase 1 + design-system/)

- **`apps/mobile/src/services/auth.ts`** — full sign-in orchestration including the `signInWithGoogle` function. Phase 2's full Sign-up screen wraps this. The MMKV `humyn.secure` instance is the canonical secure-storage handle for the entire onboarding-flag set (D-STATE-01).
- **`apps/mobile/src/services/api.ts`** — `apiClient` HTTP wrapper. Phase 2 surfaces (Profile, Help, ForceUpgrade) reuse it.
- **`apps/mobile/src/native/AppFlavor.ts`** — `getFlavorContext()` returns `{flavor, applicationId}`. ForceUpgradeScreen + analytics tagging consume this.
- **`apps/mobile/src/native/PlayIntegrity.ts`** — Play Integrity wrapper. Sign-up reuses; no changes.
- **`design-system/task-icons/{mapping.json, TaskIcon.tsx, index.ts}`** — `<TaskIcon>` component. Phase 2 doesn't render task cards (Phase 6) but the `LucideIconName` union from `mapping.ts` constrains the global icon namespace.
- **`logo.js`** — Humyn logo SVG component. Splash screen (design-spec §1) consumes the brand mark from this file.
- **`apps/mobile/android/app/build.gradle`** — flavor configuration scaffolding. Phase 2 doesn't add new flavors but adds dependencies (React Navigation, Reanimated, lucide-react-native, MediaPipe — wait, no, MediaPipe is Phase 4) and the `REQUEST_INSTALL_PACKAGES` flavor-manifest entry if missing.
- **`apps/mobile/android/app/src/apkRollout/AndroidManifest.xml`** — flavor-scoped manifest. Phase 2 verifies/adds `REQUEST_INSTALL_PACKAGES` per D-UPG-03.

### Established Patterns (from Phase 1)

- **Native-module shape:** Kotlin module under `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` with a registered `ReactPackage`. JS surface at `apps/mobile/src/native/{Module}.ts` exposes a typed contract via `NativeModules.{Name}`. Phase 2's `HumynCompat` follows this pattern; `apps/mobile/src/native/HumynCompat.ts` exposes the three methods.
- **Flavor-scoped manifests:** per-flavor source sets at `android/app/src/{playStore,apkRollout}/AndroidManifest.xml` for permission scoping. Phase 2 reuses this for `REQUEST_INSTALL_PACKAGES`.
- **`shared/types/`** Zod schemas: Phase 1 established `shared/types/Recording.ts`. Phase 2 adds `shared/types/CompatResult.ts` (D-COMPAT-05).
- **MMKV key versioning:** `auth.jwt.v1` pattern. Phase 2 follows the same `.v1` suffix convention for every onboarding-state key.
- **Test infra (Vitest + jsdom):** `apps/mobile/vitest.config.ts` + `vitest.setup.ts` already wired. Phase 2 unit tests against `NativeModules` mocks for HumynCompat / AppFlavor / PlayIntegrity surfaces. **NOTE:** Phase 2 unit tests run inside the new npm-managed `apps/mobile/` package (post-02-01 migration).
- **Phase 1 manual smoke document** at `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` — Phase 2 should append a 02-MANUAL-SMOKE entry at phase-end for the apkRollout sign-up + permissions + compat + ForceUpgrade walkthrough on a real Pixel device.

### Integration Points

- **Mobile → Backend:** `/auth/google`, `/auth/nonce`, `GET/PATCH/DELETE /me`, `POST /me/restore`, `POST /feedback`, `GET /app/version`, `GET /contributions`. All implemented in Phase 1.
- **Mobile → Native modules:** `AppFlavor`, `PlayIntegrity` (existing), `HumynCompat` (new in Phase 2).
- **Mobile → Filesystem:** `cacheDir` for compat-probe clips + APK download files. App-launch sweep cleans both orphan dirs.
- **Mobile → Firebase:** Analytics primary sink; Crashlytics for native + JVM crashes. Phase 2 wires the Phase 2 event funnel from engineering-handoff §11 (signup*\*, permission*_, compat\__, profile*\*, help*_, upg\__).
- **Mobile → CI:** the new "Mobile build" job in `.github/workflows/ci.yml` exercises `npm ci` + `gradlew assembleApkRolloutDebug` on every PR after 02-01 lands.

### Creative options the architecture enables

- The slim `HumynCompat` module pattern means Phase 3's `HumynCapture` can ship without back-pressure from Phase 2's compat probes — they're independent native modules.
- The `RootStack > {OnboardingStack, MainTabs, Recording, Player, ForceUpgrade}` shape means Phase 4's Recording surface and Phase 6's Player slot in as siblings without restructuring the navigator.
- The npm-isolation of `apps/mobile/` means Phase 4's MediaPipe + Phase 5's BullMQ-adjacent native modules don't fight pnpm symlinks during their respective Gradle build cycles.

</code_context>

<specifics>
## Specific Ideas

- **`installation_id.v1` in MMKV** — UUID minted at first launch via `react-native-uuid` (or a tiny native call to `java.util.UUID.randomUUID().toString()` if we want zero new JS deps). Survives app updates; resets on uninstall. This is the _only_ identifier we mint client-side; it goes into the compat signature and into `POST /feedback` diagnostic snapshots, never into auth or per-recording metadata (recordings use server-minted ULIDs).
- **Compat-result MMKV layout:** `compat.lastResult.v1` = full `CompatResult` (signature, runAt, all checks, passed, failedKeys); `onboarding.compatPassed.v1` = boolean shortcut `{ signature, runAt, passed: true }` for fast navigator gating without parsing the full result every cold start.
- **`force_upgrade_apk_hash_mismatch` analytics event** — emit even on first occurrence (not throttled). These are catastrophic events; we want every single one.
- **Soft-banner dismiss key** — `appVersion.softBannerDismissed.{latest}` (e.g., `appVersion.softBannerDismissed.1.6.2`). Per-version key auto-resets when `latest` advances.
- **Splash version-check timing** — the version check should NOT block splash forever. Splash already has a ~2.4 s minimum visual presence per design-spec §1; `/app/version` runs in parallel with the splash animation. If the call hasn't returned by 2.4 s, we proceed to Sign-up (or wherever onboarding state points) and let the call resolve in the background. Force-block decisions only fire after the call resolves; users hit "Update required" 200–500 ms after Sign-up briefly mounts, in the worst case.
- **Sign-up screen reuses `signInWithGoogle`** — the full design-spec §2 layout (animated scalePop logo, tagline, pitch, consent row, Terms-of-Use modal) wraps the same orchestration. The Welcome state from Phase 1 disappears — Phase 2 navigates directly to the next onboarding step on success.
- **Profile lifetime contribution (PROF-03)** — calls `GET /contributions?range=all` and renders the duration formatter from HOME-06 (which is a Phase 6 helper, but the same formatter applies — Phase 2 can ship the helper at `apps/mobile/src/util/durationFormatter.ts` for Phase 6 to consume).
- **App-version footer (PROF-05)** — `${BuildConfig.VERSION_NAME}-${BuildConfig.FLAVOR_NAME} (${BuildConfig.VERSION_CODE})` displayed at the bottom of Profile. Long-press to copy to clipboard for support diagnostics (nice-to-have; planner-level).
- **HumynCompat NAL-unit B-frame parser** — straightforward NAL parser walks the H.265 byte stream looking for slice-segment headers; B-frames are detected via `slice_type == B`. The parser lives in `HumynCompatModule.kt` as a small private function; no library needed. Reference impl in `figure-app-hands.md` analogue is video-frame work for hand detection (different concern), so the implementation is fresh.
- **OIS readback** — `CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` returns an array; if it contains values other than `LENS_OPTICAL_STABILIZATION_MODE_OFF`, OIS is _available_ — and we then need to verify a request override actually disables it. The probe writes a frame with `CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE = OFF` and verifies the result metadata's `LENS_OPTICAL_STABILIZATION_MODE` reads back as `OFF`.
- **HDR→SDR force** — `CaptureRequest.DYNAMIC_RANGE_PROFILE = STANDARD` + verify result metadata. Devices that don't expose `DynamicRangeProfile` (older Camera2 implementations) implicitly pass.
- **Help-Center build script** — `apps/mobile/scripts/build-help-content.mjs` parses `help-center-content.md` with `marked` (or simple regex), emits `apps/mobile/src/screens/help/content.json`. Run as a `prebuild` script in `package.json` so it can't fall out of sync.
- **Telemetry ring buffer FIFO trim** — every Firebase Analytics event call ALSO calls `appendToRing(event)`. `appendToRing` reads MMKV, splices to last 100 entries, writes back. The cost is one MMKV read/write per event — fine for our volume.

</specifics>

<deferred>
## Deferred Ideas

### Belongs in other phases or future cleanup

- **PROJECT.md / REQUIREMENTS.md / ROADMAP.md cleanup of stale clan-chief / KGeN narrative** — already deferred in Phase 1 CONTEXT; remains deferred. Out-of-scope for any single phase; needs a `/gsd:cleanup` pass or a manual edit pass with user approval.
- **Practice recording, hand-gate UX, recording surface** — Phase 4 (depends on Phase 3's HumynCapture).
- **Tasks browsing, Task details sheet, Send Request form, History list, Player** — Phase 6.
- **Upload pipeline + diagnostic-snapshot delivery via piggy-backing** — Phase 5. Phase 2's `POST /feedback` body is sized assuming roughly 100 telemetry events × ~200 bytes each ≈ 20 KB; well within HTTP limits.
- **iOS analogues** — Phase 7. `HumynCompat` Swift analogue, fonts wired into iOS, etc.
- **Reanimated motion tuning, fancy transitions** — planner-level details inside each Phase 2 plan.
- **Profile name validation** (length limits, profanity filtering, etc.) — planner-level; backend already enforces (PATCH /me Zod schema in Phase 1).
- **Coarse Location permission prompt** — Phase 4 (delayed to first recording).
- **Help-Center markdown live-reload during dev** — nice-to-have; not Phase 2 scope.
- **In-app restore-account UX** (vs the implicit re-sign-in restore) — v2 if support volume justifies.
- **APK download progress UI polish** — Phase 2 ships a basic linear progress bar; refinement is planner-level.
- **Soft-banner copy A/B testing** — v2.
- **Compat-tightening propagation flow** (COMPAT-05: existing devices that newly fail when bar is raised) — Phase 2 ships the _gate_ (compatSignature triggers re-run on app/OS update; if a stricter check fails, recording is blocked) but the _bar-raising mechanism_ (Remote Config knob lowering thresholds) is planner-level inside Phase 2 if researcher confirms scope, else slips to Phase 4 alongside other Remote Config wiring.
- **Profile name field length limits + max-character feedback** — planner-level.
- **Playstore/apkRollout APK SHA-256 fingerprint disclosure UX** — Phase 2 surface decision (deferred from Phase 1); could land here in Profile footer or in Help Center FAQ. Planner picks.

### Reviewed Todos (not folded)

None — `gsd-tools list-todos` returned 0 entries.

</deferred>

---

_Phase: 2-Mobile Shell, Onboarding, Permissions, Compat & Profile_
_Context gathered: 2026-05-08_
