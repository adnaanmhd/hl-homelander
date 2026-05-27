# Hardware Walk — Reusable Prompt

Pasted-prompt block for running a clean **end-to-end deep walk** on a real device. The agent (Claude Code) handles every command — backend, build, install, server-side wipe, S3 + Redis reset, adb tunnels. You only interact with the phone.

## How to use

1. Copy everything between the `<<<WALK-START>>>` and `<<<WALK-END>>>` fences below.
2. Paste it into a fresh Claude Code chat in this repo.
3. The agent reads the directive and starts the bring-up sequence. Within ~7 minutes (build dominates), the device launches a fresh-install app and the agent hands the device back to you.
4. Walk the app. Say `shot` / `next` / `capture` when you want a screencap; describe what you see in your own words.
5. When done, type `walk done` (or `we're done` / `that's it` — any natural phrase). The agent slices the logcat + API/worker logs into a `REPORT.md`, commits the report, and ends the session.

## Knobs (edit before pasting if you want to override the defaults)

| Knob               | Default                                                  | Where                                     |
| ------------------ | -------------------------------------------------------- | ----------------------------------------- |
| Test account email | `m.adnaan161@gmail.com`                                  | `TEST_ACCOUNT` line in the prompt block   |
| Device serial      | first attached                                           | `DEVICE_SERIAL` (blank = auto-pick)       |
| Build mode         | full clean (~6.5 min)                                    | append `--skip-build` to re-walk same APK |
| Locale             | device locale untouched (pick in-app via ChooseLanguage) | `FORCE_LOCALE` (blank by default)         |

---

<<<WALK-START>>>

You are driving a full end-to-end hardware walk for Homelander (Android-first egocentric video capture app). The operator will interact with the device; you handle every backend / build / wipe / adb command yourself.

**Knobs (override inline only if explicitly stated above):**

- `TEST_ACCOUNT = m.adnaan161@gmail.com`
- `DEVICE_SERIAL = ` (blank = first attached)
- `FORCE_LOCALE = ` (blank = leave device locale untouched)
- `SKIP_BUILD = false` (set true if the operator passes `--skip-build`)

**Step 0 — Initialize the walk directory.**

Generate a timestamp slug (`YYYYMMDD-HHMM`) and create `walks/{slug}/` at the repo root. This directory is gitignored except for `REPORT.md` (see `.gitignore`). Inside it create empty `screencaps/`, `logs/`, and start a streaming `logcat.txt` capture from the device (`adb logcat -v threadtime > walks/{slug}/logs/logcat.txt &`). Record the logcat PID — you'll need to kill it when the walk ends.

Print: `[walk] Session: walks/{slug}/  ·  Test account: {TEST_ACCOUNT}  ·  Device: {resolved serial}`.

**Step 1 — Pre-flight gates (fail loud, do not auto-recover unless the recovery is obvious).**

1. `adb -s {DEVICE_SERIAL} get-state` must equal `device`. If multiple devices and `DEVICE_SERIAL` blank, pick the first; print which one.
2. Docker containers `humyn-postgres` + `humyn-localstack` + `humyn-redis` must be `Up` and `healthy`. If any is missing, run `docker compose -f infra/docker-compose.yml up -d` from the repo root.
3. Postgres must have the `tasks` table with **≥ 86 rows** (the Phase-6 + quick-260524-p3n seed). If under, refuse to walk and tell the operator to re-seed.
4. LocalStack S3 buckets `humyn-recordings-dev`, `humyn-apk-dev`, `humyn-feedback-dev` must all exist.
5. Metro on host port `:8081` must be **free** (`lsof -i :8081` returns nothing). If a Metro is running, kill it — the apkRolloutDebug flavor prefers the dev server over bundled JS, so a stale Metro will mask the APK's code (per `feedback_metro_intercepts_apk_walks`). If you can't kill it, abort and surface the PID.
6. Java toolchain — `JAVA_HOME` must point at `temurin-17.jdk` for gradle (per `feedback_android_build_needs_jdk17`). Export it before any gradle invocation: `export JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"`.

**Step 2 — Wipe server-side state (preserve `tasks` and reference data).**

Run this inside `humyn-postgres` as user `humyn` against db `humyn_dev`. Introspect the schema before the wipe — column names have evolved (e.g. `recordings.started_at` no longer exists). If a referenced table is missing, log the skip but proceed.

```sql
BEGIN;
-- Cascade order: child rows before parents.
DELETE FROM consent_log         WHERE user_id IN (SELECT id FROM users WHERE email = :test_email);
DELETE FROM compat_results      WHERE user_id IN (SELECT id FROM users WHERE email = :test_email);
DELETE FROM recordings          WHERE user_id IN (SELECT id FROM users WHERE email = :test_email);
DELETE FROM uploads             WHERE user_id IN (SELECT id FROM users WHERE email = :test_email);  -- if exists
DELETE FROM contributions       WHERE user_id IN (SELECT id FROM users WHERE email = :test_email);  -- if exists
DELETE FROM users               WHERE email = :test_email;
COMMIT;
```

After the wipe, run a check query: `SELECT COUNT(*) FROM users WHERE email = :test_email` must return `0`. `SELECT COUNT(*) FROM tasks` must still return ≥ 86.

**Step 3 — Wipe LocalStack S3 orphan recordings.**

```bash
docker exec humyn-localstack awslocal s3 rm s3://humyn-recordings-dev/recordings/ --recursive
```

Leave `humyn-apk-dev` and `humyn-feedback-dev` alone. Verify with `awslocal s3 ls s3://humyn-recordings-dev/recordings/` → empty.

**Step 4 — Drain the Redis BullMQ hash-verify queue.**

```bash
docker exec humyn-redis redis-cli FLUSHDB
```

The hash-verify worker reconnects automatically; the queue starts empty. (If the operator has other Redis-backed state in dev that matters, narrow this to `DEL bull:hash-verify-recording:*`.)

**Step 5 — Restart the API + hash-verify worker fresh.**

Kill any running `pnpm --filter @humyn/api dev` process (find by `lsof -i :8080`). Then start fresh with the env sourced (per `feedback_post_merge_test_env`):

```bash
set -a && source apps/api/.env && set +a
pnpm --filter @humyn/api dev > walks/{slug}/logs/api.log 2>&1 &
```

Wait up to 10 s for `Server listening at http://127.0.0.1:8080` in `api.log` AND for `hash-verify worker started` (concurrency 4). If either is missing after 10 s, abort and dump the last 30 lines.

**Step 6 — adb reverse all three tunnels (per `feedback_dev_tunnels_include_localstack_4566`).**

```bash
adb -s {DEVICE_SERIAL} reverse tcp:8080 tcp:8080  # Fastify API
adb -s {DEVICE_SERIAL} reverse tcp:8081 tcp:8081  # Metro (harmless when Metro is off)
adb -s {DEVICE_SERIAL} reverse tcp:4566 tcp:4566  # LocalStack S3 — forgetting this dead-letters every multipart PUT
```

Verify with `adb reverse --list` — all three must appear.

**Step 7 — Full clean rebuild (unless `--skip-build`).**

Per `feedback_apk_build_pitfalls`: **two stages**, NEVER chained.

```bash
cd apps/mobile/android
./gradlew clean > /tmp/walk-clean.log 2>&1            # Stage 1 — wipes prefab caches
echo "CLEAN_EXIT=$?"
./gradlew :app:assembleApkRolloutDebug :app:installApkRolloutDebug \
  --no-build-cache > /tmp/walk-build.log 2>&1         # Stage 2 — full rebuild
echo "BUILD_EXIT=$?"
```

After each stage, verify success via the **literal marker**: `grep -E "BUILD SUCCESSFUL|BUILD FAILED" /tmp/walk-build.log`. Never trust `| tail` exit codes — the wrapper returns 0 even on `BUILD FAILED` (per `feedback_apk_build_pitfalls` Rule 1). On `BUILD FAILED`, dump the last 50 lines and abort.

Expected duration: ~6.5 minutes. Run the build in the background and tell the operator the ETA + which native module is currently compiling (poll the log every ~60 s for status, not progress).

**Step 8 — Clear app data on device (post-install).**

```bash
adb -s {DEVICE_SERIAL} shell am force-stop ai.humynlabs.capture.apk
adb -s {DEVICE_SERIAL} shell pm clear ai.humynlabs.capture.apk
# Clear Crashlytics local crash log so this walk's crashes (if any) are isolated.
adb -s {DEVICE_SERIAL} shell run-as ai.humynlabs.capture.apk rm -rf files/.crashlytics 2>/dev/null || true
```

**Step 9 — Wake + launch + initial screencap.**

```bash
adb -s {DEVICE_SERIAL} shell input keyevent KEYCODE_WAKEUP
adb -s {DEVICE_SERIAL} shell am start -n ai.humynlabs.capture.apk/ai.humynlabs.capture.MainActivity
```

Wait 3 s; capture `walks/{slug}/screencaps/00-launch.png`. Print the walk-gates summary (device, API, Postgres, LocalStack, tunnels, Metro-free) all green. Then hand off to the operator with:

```
[walk] Bring-up complete. Walk the app. Say "shot" / "next" / "capture" for a screencap.
       Say "walk done" / "we're done" when finished — I'll generate REPORT.md and commit.
```

**Step 10 — During the walk.**

- On `shot` / `next` / `capture` / `screencap`: take a screencap, save as `screencaps/NN-{free-form-slug-or-foreground-activity}.png`, append a one-line entry to an in-memory `events.md` (timestamp + foreground activity + what the operator described).
- On any error or unexpected behavior the operator surfaces: capture immediately, ALSO grab the last 100 logcat lines around that timestamp into `logs/incident-{NN}.txt`.
- On recording-related events: read the API log (`walks/{slug}/logs/api.log`) and capture the recording_id + qa_status transitions inline in `events.md`.
- Do NOT auto-poll the foreground activity. Capture only on operator request. The operator drives pacing.

**Step 11 — End-of-walk trigger.**

When the operator says `walk done`, `we're done`, `that's it`, or any clearly-terminal phrase:

1. Kill the streaming logcat capture (the PID recorded in Step 0).
2. Slice the API + worker logs to the walk window: from `[walk] Bring-up complete` timestamp to now.
3. Generate `walks/{slug}/REPORT.md` with this structure:

   ```markdown
   # Walk Report — {slug}

   **Started:** {ISO timestamp at Step 9}
   **Ended:** {ISO timestamp at walk-done}
   **Duration:** {hh:mm}
   **Test account:** {TEST_ACCOUNT}
   **Device:** {serial + model + Android version}
   **APK build:** {git HEAD short + lastUpdateTime}

   ## Pre-flight gates

   {table — all green or any waivers}

   ## Wipe scope applied

   - Postgres: {N users deleted, N recordings deleted, ...}
   - S3: {N objects deleted from humyn-recordings-dev/recordings/}
   - Redis: FLUSHDB applied
   - App data + Crashlytics local crash log cleared

   ## Walk timeline

   {chronological events.md, one bullet per operator-recorded event}

   ## Recordings created

   {table: recording_id, started_at, duration_s, qa_status final, bytes_uploaded, drift_max/mean/p99}

   ## Incidents

   {list of any incident-NN.txt files, each with the foreground activity + what the operator described}

   ## Closing verdict

   {one paragraph — PASS / PASS WITH FOLLOW-UPS / FAIL — and the load-bearing reasons}
   ```

4. `git add walks/{slug}/REPORT.md` (the rest of `walks/{slug}/` is gitignored).
5. Commit as `Adnaan Mohammed <m.adnaan161@gmail.com>`:

   ```
   docs(walk-{slug}): hardware walk — {one-line verdict}
   ```

6. Leave the backend running so the next walk has a warm start (`pnpm dev` will be re-killed + restarted at the next `/walk` anyway). The operator can stop it manually if needed.
7. Print: `[walk] REPORT.md committed. Walk slug: {slug}.`

**Memory rules this prompt honors (do not violate without surfacing):**

- `feedback_apk_build_pitfalls` — two-stage clean rebuild; literal markers; never `| tail`.
- `feedback_metro_intercepts_apk_walks` — kill Metro on :8081 before installing the APK.
- `feedback_dev_tunnels_include_localstack_4566` — three reverse tunnels, not two.
- `feedback_android_build_needs_jdk17` — JDK 17 for gradle, not JDK 26.
- `feedback_dev_api_runs_hash_verify_worker` — `pnpm dev` forks Fastify + worker.
- `feedback_post_merge_test_env` — source `apps/api/.env` before `pnpm dev`.
- `feedback_api_tests_wipe_dev_db` — do NOT run `pnpm test`; that truncates the tasks table.
- `feedback_walk_locale_order` — default-walk order is hi-IN → pt-BR → en (per session needs).
- `feedback_inspect_before_destroying_worktrees` — leave any locked agent worktrees alone.
- `feedback_git_commit_email` — every commit author is `Adnaan Mohammed <m.adnaan161@gmail.com>`.

<<<WALK-END>>>

---

## What this prompt does NOT do

- Run automated tests (lint, typecheck, unit, Detox). If you want CI gates, run `/gsd-quick` separately.
- Wipe Firebase/Crashlytics cloud records, Play Integrity attestations, or Google account state. Those live outside this dev stack.
- Run a `/code-review` on the diff. Run `/code-review` directly if you want a review of the changes you walked.
- Update `STATE.md` or any phase plan. Walks are operator validation, not phase closure — phase closure goes through `/gsd-verify-work` or the manual smoke runbook for the phase.

## Troubleshooting

- **Build hangs on `react-native-reanimated` CMake configure:** known-slow phase on `--no-build-cache`. Wait it out; first clean rebuild after a deps bump can take 8 min.
- **`adb reverse` fails after device sleep:** plug-cycle the cable, then re-run `adb reverse --list` to re-establish.
- **API logs show `ECONNREFUSED 4566`:** LocalStack container died. Restart with `docker compose -f infra/docker-compose.yml restart localstack`.
- **App crashes on launch with `JNI ERROR (app bug)`:** the install partially succeeded; force-stop + clear + re-launch. If still crashing, do a stage-1 `./gradlew clean` and re-walk with full rebuild.
- **The 16 KB-page Android-16 warning dialog covers the app on launch:** known platform-level warning about unaligned `.so` libs in third-party RN deps (mediapipe, mmkv, reanimated, etc.). Tap "Don't show again" — it does not affect the walk. Real fix is a Phase 8 packaging-options task.
