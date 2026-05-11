# Phase 4 On-Hardware Runbook Walk — Session Resume Handoff

**Created:** 2026-05-11, right after unblocking the Android build chain.
**Resume from:** §2.1 "fresh install" in `04-MANUAL-SMOKE.md`, then walk §2 → §6 of that runbook with the user.

---

## TL;DR for the new session

You are resuming an in-progress **Phase-4 on-hardware smoke walk**. The Android build chain was just unblocked (reanimated 3→4 bump + Crashlytics Gradle plugin + a HandLandmarkerOptions import fix + a Metro `--reset-cache` restart) and the app now **builds, installs, and boots clean** on the connected Pixel 10a (RigTutorial renders, no red box, reanimated 4 works at runtime). The next concrete step is **§2.1 fresh install** in `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md`, then walk §2→§6 of that runbook with the user one step at a time. The user approves each step.

## Division of labor

- **Assistant drives everything scriptable:** `adb uninstall` / `cd apps/mobile/android && ./gradlew installApkRolloutDebug` / `adb logcat -c` + greps / `adb shell run-as ai.humynlabs.capture.apk ls|cat` / `adb shell dumpsys ...` / `adb shell dumpsys battery set level N` (§4 battery edges) + `adb shell dumpsys battery reset` / `adb shell cmd thermalservice override-status N` (§5; reset with `... 0`) / pulling files + `sha256sum` / `ffprobe` (§3 spec checks + reading the drift JSON in §5b) / `adb exec-out screencap -p > /tmp/x.png` then Read it to see the screen.
- **User does the irreducibly physical / UI / perceptual bits:** the Google account picker at Sign-up, granting Camera/Mic, the compat-check taps, **physically rotating the phone** (NOT the `__DEV__` "Pretend I rotated →" pill — see CR-01 caveat below), mounting the phone on a head rig + **bringing 2 hands into frame** for the gate, listening for the en-IN TTS / the 520 Hz low-battery beep / the descending thermal tones, feeling the haptics, observing the ~5% brightness drop, placing/answering/declining calls from a 2nd phone (§4 a/b), setting a system alarm (§4 c), filling storage to <5 GB (§4 h). The user reports what they see/hear/feel; the assistant cross-checks via logcat/dumpsys/files where possible.
- **Ask the user before each state-changing step** (uninstall, `battery set level`, `thermalservice override-status`). They approve each step. Escalate (don't silently rabbit-hole) if a step turns into a multi-rebuild detour.

## Environment / device facts

- **Device:** Pixel 10a, adb serial `5C161JEA304304` (only device; `adb devices` should list it as `device`).
- **App package (applicationId):** `ai.humynlabs.capture.apk` (the `apkRollout` flavor's `.apk` suffix). **Code namespace:** `ai.humynlabs.capture` — so MainActivity is `ai.humynlabs.capture.MainActivity`. **Launch the app with** `adb shell monkey -p ai.humynlabs.capture.apk -c android.intent.category.LAUNCHER 1` — the explicit `am start -n ai.humynlabs.capture.apk/.MainActivity` form FAILS ("Activity class … does not exist") because namespace ≠ applicationId.
- `adb reverse tcp:8081 tcp:8081` is required for the debug build to reach Metro — re-set it after any device reconnect / on resume.
- **Metro must be running with the current babel config.** `curl -s http://localhost:8081/status` should print `packager-status:running`. (A `/clear` doesn't kill the background Metro process, but verify.) If it's not running, or if you see `WorkletsError: Failed to create a worklet` in logcat: `cd apps/mobile && npx react-native start --reset-cache` (run in background). `babel.config.js` now ends with `react-native-worklets/plugin`; Metro must have been (re)started after that change or it serves a stale, un-worklet-transformed bundle.
- The installed APK is the **new** `apkRollout` _debug_ build — `versionName 0.1.0-apk`, lastUpdateTime ≥ 2026-05-11 ~18:05. It contains the Phase-4 gap-closure changes (04-11 / 04-12) plus the reanimated-4 / Crashlytics / HandLandmarkerOptions fixes. `__DEV__ === true` (DEBUGGABLE flag), which means:
  - **§2 CR-01 check** — advance rotate-prompt → ready by **physically rotating the phone**; do NOT use the `__DEV__`-only "Pretend I rotated →" pill (it would mask a release-build dead-end). The runbook §2 allows counting only the physical-rotation path on a debug build.
  - **§3** — start a non-practice recording via the `__DEV__`-gated **long-press (>800 ms) on the Tasks "coming in Phase 6." heading**.
- Tooling on the workstation: `ffprobe` at `/opt/homebrew/bin/ffprobe`; `python` at `/opt/anaconda3/bin/python` (or `python3`). Repo root: `/Users/adnaan/Documents/hl-homelander`; mobile app: `apps/mobile`; Android project: `apps/mobile/android`. GSD CLI: `node .claude/get-shit-done/bin/gsd-tools.cjs <cmd>` (there is no `gsd-sdk` binary on PATH — workflows that say `gsd-sdk query X.Y` map to `gsd-tools X Y`).

## What just got fixed (commits on `main`)

- `57ed029` — `fix(deps): bump react-native-reanimated 3.16.7 → 4.3.1 for RN 0.83 compat` — also adds `react-native-worklets@~0.8.3` (reanimated 4's required peer; `react-native-worklets-core@1.6.3` stays for VisionCamera 4.7.3), appends `react-native-worklets/plugin` to `babel.config.js` (must be last), updates CLAUDE.md's LOCKED pin + Version Compatibility Pinpoints. Root cause: the reanimated 3.x line references Paper-era APIs RN 0.83 removed; reanimated 4.x is the RN-0.83 line.
- `d97637a` — `fix: HandLandmarkerOptions is nested in HandLandmarker (tasks-vision 0.10.21)` — `HumynHandDetectorModule.kt` import fix (from 04-04; never compiled before because the reanimated wall stopped the build first).
- `e9ab59d` — `fix(android): apply the Firebase Crashlytics Gradle plugin` — `android/build.gradle` += `classpath com.google.firebase:firebase-crashlytics-gradle:3.0.6`; `android/app/build.gradle` += `apply plugin "com.google.firebase.crashlytics"` (after google-services). Without it the app crashed on launch ("The Crashlytics build ID is missing").
- `b112b9d` — `docs(debug): reanimated-rn083-build-fail — fix applied + verified` — the debug-session doc.
- (Earlier today, the `--gaps-only` execute-phase run, for context: `96e4468`/`f19eea1` worktree merges; `c32034c` tracking; `6b3af52` refreshed code review; `46d2da2` HUMAN-UAT persisted; gap-closure executor commits 04-11 `4f08457`/`f663254`/`a5701b7`/`0bff422`/`55b4cbf`, 04-12 `395fafa`/`0fe24ee`/`9226e42`.)
- `git status` was clean at handoff time — nothing uncommitted.

## Open GSD state (the bigger picture this runbook feeds)

- We were running `/gsd-execute-phase 4 --gaps-only`. Both gap-closure plans executed + merged + tracking updated; code review refreshed (`04-REVIEW.md` — 0 blockers, 4 warnings on the Kotlin native modules + 1 info, all advisory; consider `/gsd-code-review 04 --fix` later); the `gsd-verifier` ran and returned **`human_needed`** (`04-VERIFICATION.md` — 5/5 success criteria code-verified, all prior gaps closed, all 36 requirement IDs traced) with **5 on-device verification items** persisted to `04-HUMAN-UAT.md`. **Phase 4 is NOT yet marked complete** — it is waiting on this runbook walk (especially the `[BLOCKING]` §5b ±1 ms video↔IMU drift re-measurement on the new gate→record handoff).
- **After the runbook signs off (§6 = YES):** update `04-HUMAN-UAT.md` (each item's `result:` → pass; fix the Summary counts; status → resolved), then resolve the reanimated debug session (below), then mark Phase 4 complete (`node .claude/get-shit-done/bin/gsd-tools.cjs phase complete 04`) → update REQUIREMENTS traceability → commit → route to Phase 5 (Upload pipeline). If §6 = NO / a functional regression turns up → `/gsd-debug`. If §5b drift regresses past ±1 ms or past Phase-3 smoke-7 (mean 0.594 / p99 0.728 ms): first bump `SETTLE_MS` in `apps/mobile/src/screens/recording/RecordingScreen.tsx` and re-walk §5b; escalate a surgical Phase-3 follow-up if that's not enough; **never re-introduce audio**. Cosmetic nits found mid-walk → new file `04-COSMETIC-GAPS.md` per the runbook's §7 protocol (do NOT rebuild mid-smoke).
- **reanimated debug session** `.planning/debug/reanimated-rn083-build-fail.md` is at `status: awaiting_human_verify`. The fix is verified at build/compile/test level (build green, vitest 579/579, tsc clean, app boots, `RNFBCrashlyticsInit: initialization successful`). Once §2's **PracticeCompleteScreen** renders on device with working confetti + badge-pop animations (that exercises reanimated 4 at runtime), move that file to `.planning/debug/resolved/` and set its frontmatter `status: resolved`.
- Non-fatal note seen at boot: `[splash] bootstrap_hard_timeout` fired ~8 s into the splash bootstrap (a safety net — likely Play Integrity or RemoteConfig taking >8 s). The app proceeded normally. During the §2 gate substate, check whether the RemoteConfig `gate.consecutive_hits_required` / `gate.cadence_ms` values actually arrived (vs the hardcoded `5 / 400` fallback) — that's the WR-01 / HAND-11 surface.

## Resume sequence (do these in order)

1. Read `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md` end-to-end (the runbook). Also skim `04-VERIFICATION.md` and `04-HUMAN-UAT.md`.
2. Verify environment: `adb devices` (Pixel 10a `5C161JEA304304` as `device`); `curl -s http://localhost:8081/status` (Metro running — restart `--reset-cache` if not); `adb reverse tcp:8081 tcp:8081`.
3. **§2.1 — fresh install** (ask the user to approve first): `adb uninstall ai.humynlabs.capture.apk` → `cd apps/mobile/android && ./gradlew installApkRolloutDebug` (incremental, fast — the build cache is warm) → `adb logcat -c` → `adb shell monkey -p ai.humynlabs.capture.apk -c android.intent.category.LAUNCHER 1`.
4. Walk §2 → §3 → §4 → §5 → §5b → §6 of `04-MANUAL-SMOKE.md` with the user (assistant drives scripting; user does physical bits; one step at a time, user approves each). Tick the checkboxes in `04-MANUAL-SMOKE.md` as you go; commit it when the walk completes (`commit_docs` is true).
5. On §6 sign-off YES → do the "after the runbook signs off" sequence in the Open GSD State section above. On NO → `/gsd-debug`.
