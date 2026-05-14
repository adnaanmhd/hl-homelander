# Homelander E2E demo — orchestrator-runs / owner-taps

Run the full Homelander E2E demo on the Pixel 10a in the
**orchestrator-runs-everything / owner-only-interacts-with-the-device**
pattern. I (the owner) am sitting at the device (`5C161JEA304304`,
Android 16); you run **every** shell / git / API / docker / adb /
build command and tell me what to tap. Do NOT spawn subagents — this
is a tight interactive loop.

Project context lives in `CLAUDE.md` (read first if you need pin /
locked-spec / drift-banner background). All Plan 06-12 follow-on
fixes are already on `main`; do not change any source code except
the single temporary compat-fail force-line documented below
(revert immediately after that scenario).

---

## Phase 0 — Setup (you run, then sign-off "ready" before I touch the device)

Verify in this order; restart anything that's missing.

1. **Docker:** `docker compose ps` — expect `humyn-postgres`,
   `humyn-localstack`, `humyn-redis` all healthy.
2. **Postgres tasks table:**
   `docker exec humyn-postgres psql -U humyn -d humyn_dev -t -c "SELECT COUNT(*) FROM tasks;"` — expect **66**.
   If 0: `set -a && source apps/api/.env && set +a && cd apps/api && pnpm seed:tasks && pnpm seed:dev-task && cd -`
3. **Wipe everything else** so the owner starts from a clean slate:
   - `adb shell pm clear ai.humynlabs.capture.apk`
   - `docker exec humyn-postgres psql -U humyn -d humyn_dev -c "DELETE FROM recordings; DELETE FROM task_requests; DELETE FROM events; DELETE FROM users;"` (DO NOT touch `tasks`)
   - `docker exec humyn-localstack awslocal s3 rm s3://humyn-recordings-dev/ --recursive`
4. **Ports + adb reverse:**
   - `lsof -nP -iTCP:8080 -sTCP:LISTEN -t` and `:8081` — both must be listening.
   - If 8080 free: `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm --filter @humyn/api dev > /tmp/humyn-api.log 2>&1 &` (background; wait until listening).
   - If 8081 free: `cd apps/mobile && npx react-native start --reset-cache > /tmp/humyn-metro.log 2>&1 &` (background; wait until listening).
   - `adb reverse --list` — expect `tcp:8080`, `tcp:8081`, `tcp:4566`. Re-add any missing with `adb reverse tcp:NNNN tcp:NNNN`.
5. **APK install state:** `adb shell dumpsys package ai.humynlabs.capture.apk | grep versionName` — if installed, fine. If not: `cd apps/mobile/android && ./gradlew :app:installApkRolloutDebug`.
6. **Force-launch the app:** `adb shell monkey -p ai.humynlabs.capture.apk -c android.intent.category.LAUNCHER 1`.

Say **"ready — sign in as m.adnaan161@gmail.com"** when steps 1-6 are done. Do NOT advance until I confirm I'm at the Splash → sign-up screen.

---

## Phase 1 — Happy Path

I walk through these. You stay quiet except at the **IMU/3-file checkpoint** (step E below).

A. Sign in with Google (m.adnaan161@gmail.com) → consent → profile (name pre-filled from Google).
B. Permissions (camera, mic, etc.) — grant all.
C. CompatRunningScreen → passes naturally on Pixel 10a → CompatPassScreen.
D. Rig tutorial → practice recording → Home dashboard.
E. Tasks tab → pick any task → Start Recording → live recording for **>60 s** → Stop → upload progress → verifying → done.

**When I say "recording is done, dump the imu + 3-file payload":**

Run these and pretty-print the result in a markdown table:

```bash
# Most-recent verified non-practice recording, full row:
docker exec humyn-postgres psql -U humyn -d humyn_dev -c \
  "SELECT id, user_id, practice, qa_status, duration_ms, \
   ROUND(duration_ms/1000.0, 1) AS duration_s, \
   pg_size_pretty(file_size_bytes) AS video_size, \
   pg_size_pretty(imu_size_bytes) AS imu_size, \
   imu_video_drift_max_ms AS drift_max, \
   imu_video_drift_mean_ms AS drift_mean, \
   imu_video_drift_p99_ms AS drift_p99, \
   imu_min_rate_hz_observed_p1 AS imu_p1, \
   captured_at, upload_completed_at, verified_at \
   FROM recordings WHERE practice=false ORDER BY created_at DESC LIMIT 1;"

# 3-file list:
docker exec humyn-localstack awslocal s3 ls \
  s3://humyn-recordings-dev/recordings/<USER_ID>/<RECORDING_ID>/ --human-readable

# Metadata.json full body (drift figures + capture spec):
docker exec humyn-localstack awslocal s3 cp \
  s3://humyn-recordings-dev/recordings/<USER_ID>/<RECORDING_ID>/metadata.json -

# IMU CSV header + row count:
docker exec humyn-localstack awslocal s3 cp \
  s3://humyn-recordings-dev/recordings/<USER_ID>/<RECORDING_ID>/imu.csv - | head -5
docker exec humyn-localstack awslocal s3 cp \
  s3://humyn-recordings-dev/recordings/<USER_ID>/<RECORDING_ID>/imu.csv - | wc -l
```

Show:

- 3-file bundle (`video.mp4`, `imu.csv`, `metadata.json`) with sizes
- Postgres row summary table
- Capture-spec table (resolution / fps / dfov / codec / etc. from metadata.json)
- **IMU calculations** — drift max/mean/p99 + min p1 rate + gyro/accel nominal rates
- IMU CSV header + total row count
- Hash-verify confirmation note (sha256s + qa_status=verified → first-verified-non-practice flips the Home hero to "Hi {first_name}")

F. Go to History tab → tap row → video playback works.
G. Home → Profile → explore profile → Help Center → logout.

Say "logged out" when I'm back at the sign-up screen.

---

## Phase 2 — Negative Scenarios

Between each negative, you run:

```bash
adb shell pm clear ai.humynlabs.capture.apk
docker exec humyn-postgres psql -U humyn -d humyn_dev -c "DELETE FROM recordings; DELETE FROM task_requests; DELETE FROM events;"
docker exec humyn-localstack awslocal s3 rm s3://humyn-recordings-dev/ --recursive
adb shell monkey -p ai.humynlabs.capture.apk -c android.intent.category.LAUNCHER 1
```

(Keep the `users` row — same Google sub re-signs in.)

### 2.1 — Compat fail

The Pixel 10a passes compat natively. Force-fail with a Metro-reloadable edit:

```diff
# apps/mobile/src/services/compatService.ts — inside runCompatCheck(),
# AFTER the failedKeys for-loop, BEFORE `const passed = failedKeys.length === 0;`:
+  // E2E NEGATIVE SCENARIO TEST — force a compat fail (revert immediately after).
+  failedKeys.push('imuSustained100Hz');
```

No rebuild needed; Metro picks it up on relaunch.

Owner walk: sign in → permissions → CompatRunningScreen runs all 3 probes → routes to **CompatFailScreen** because of the forced `imuSustained100Hz`. Owner says "compat fail explored".

**REVERT THE EDIT IMMEDIATELY** (delete the pushed line) before the next negative — otherwise every subsequent scenario fails compat.

### 2.2 — Thermal throttling (two sub-scenarios)

Owner walks all the way to the recording-ready screen (sign-in → permissions → compat passes → rig → practice → Home → Tasks → pick task → Start Recording → camera preview / Start button visible).

Owner says **"ready to record"**:

```bash
adb shell cmd thermalservice override-status 2   # MODERATE → pre-flight refuse
```

Owner taps Start → expect `thermal_throttling` toast, stays on recording screen.

Owner says **"refused, reset thermal and let me try again"**:

```bash
adb shell cmd thermalservice reset
adb shell cmd thermalservice override-status 0
```

Owner taps Start again → recording begins normally. Run ~10 s. Owner says **"recording"**:

```bash
adb shell cmd thermalservice override-status 3   # SEVERE → mid-record graceful-stop
```

Within ~2.5 s the session winds down, `onThermalAbort` fires, app lands on Home. Owner confirms "landed on home, move to next".

```bash
adb shell cmd thermalservice reset
adb shell cmd thermalservice override-status 0
```

### 2.3 — Battery <15% (AlertPill, recording continues)

Walk to recording, start recording, ~10 s. Owner says **"recording"**:

```bash
adb shell dumpsys battery set level 10
```

Expect AlertPill **"Battery 15%"** rendering BELOW the Stop Recording button (Finding 3 fix — in-flow, not absolute top-right). Haptic pulse. Recording continues. Owner says "battery 15 done".

```bash
adb shell dumpsys battery reset
```

### 2.4 — Battery <5% (auto-stop)

Walk to recording, start recording, ~10 s. Owner says **"recording"**:

```bash
adb shell dumpsys battery set level 3
```

Expect auto-stop within a few seconds (D-05 device-distress path) → routes back to Home → "battery too low" toast. Owner confirms "stopped".

---

## Phase 3 — Closeout (you run automatically after Phase 2)

```bash
adb shell dumpsys battery reset
adb shell cmd thermalservice reset
adb shell cmd thermalservice override-status 0
```

Verify `compatService.ts` has NO uncommitted changes:

```bash
git diff apps/mobile/src/services/compatService.ts   # must be empty
```

If non-empty, revert the force-fail line.

Print a final summary table covering all 5 scenarios (happy + 4 negatives) with the trigger command and observed result for each.

---

## Behavioral notes

- Stay quiet between checkpoints. Don't narrate. Run the command, post the result table, wait for the next "ready" / "recording" / "done" cue.
- Memory cross-checks already saved on this project:
  - `feedback_d09_audibility_deferred` — the recording-start beep is deferred ("fuck the beep — not required"); don't debug.
  - `feedback_api_tests_wipe_dev_db` — never run `pnpm --filter @humyn/api test` between seed and walk (it truncates tasks); `apps/api` now has a `posttest` reseed hook + `WORKER_BOOTSTRAP=false` in the test script that mitigate this on success.
  - `feedback_post_merge_test_env` — bare `pnpm test` fails with SCRAM password; always env-source first.
- If anything looks broken on-device that ISN'T scripted (auth blocks, render crashes, API 500s), stop and ask before recovering.
