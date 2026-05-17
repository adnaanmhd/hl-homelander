# E2E Walk — Fully Orchestrated Prompt

Paste the block below into a fresh Claude Code session at the repo root. The
session will handle every Mac-side action (state wipe, build, install, tunnels,
Metro reset, live monitoring, post-recording IMU dumps, summary).

**Operator role:** plug the device(s) in, open the app, walk the screens.
Nothing else.

**Works for 1 or 2 devices** — Claude auto-detects what's on `adb devices`.

---

## Prompt (copy from here)

```text
[E2E walk — fully orchestrated. My role: plug the devices in, open the app, walk the screens.
 Your role: everything else. Don't ask me to copy-paste shell commands or run watchers in
 other terminals — handle all of it in your own session.]

PRE-FLIGHT (you do this, then confirm green before I touch any device)

1. Detect every device on `adb devices` — works for 1 or 2 devices, just adapt.
2. Server state wipe:
   - TRUNCATE all Postgres tables CASCADE except schema_migrations.
   - Re-seed: app_versions (apps/api/src/routes/app-version/seed-initial.ts) + tasks
     (pnpm --filter @humyn/api seed:tasks) + dev-task (pnpm --filter @humyn/api seed:dev-task).
   - Empty s3://humyn-recordings-dev (recursive).
   - DEL bull:verify:* in Redis.
3. Per-device wipe + tunnels (FOR EACH connected device, use `adb -s <serial>`):
   - pm clear ai.humynlabs.capture.apk
   - adb -s <serial> reverse tcp:8080 tcp:8080   # API
   - adb -s <serial> reverse tcp:8081 tcp:8081   # Metro
   - adb -s <serial> reverse tcp:4566 tcp:4566   # LocalStack S3 — DO NOT FORGET this one.
     Without 4566, every presigned multipart PUT fails and the row dead-letters silently.
     See memory `feedback-dev-tunnels-include-localstack-4566`.
4. Build once (current HEAD; no test-induction hacks; fps threshold stays at 29.0):
   - cd apps/mobile/android && ./gradlew :app:clean :app:assembleApkRolloutDebug
   - APK is at apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
5. Install in parallel on every device: `adb -s <serial> install -r <APK> &` then `wait`.
6. Kill any running Metro, restart with --reset-cache, log to /tmp/humyn-metro.log.
7. Sanity green-light:
   - API @8080: HTTP 200
   - Metro @8081: HTTP 200
   - LocalStack /_localstack/health: HTTP 200
   - Postgres: tasks=66, app_versions=3, users=0, recordings=0
   - Redis verify: wait=0 active=0 delayed=0 completed=0 failed=0
   - Hash-verify worker process alive (pgrep -f workers/hash-verify)
   - Per device: `adb -s <serial> reverse --list` shows all three tunnels
8. Tell me: "Ready — open the app on each device." List the connected serials + models so I
   know which device is which.

DURING THE WALK

I'll drive both devices through these screens in parallel:
  splash → sign-up (Google m.adnaan161@gmail.com) → consent → permissions
  → compat check → rig tutorial → practice recording → home
  → Tasks → select task → record ≥ 60 s → stop → uploading → verifying → done
  → Session History → video playback → home (dashboard)
  → profile → explore profile → explore help center → logout

While I walk, YOU:
- Tail /tmp/humyn-api.log for /recordings/*, /finalize, /reupload, /events.
- Poll `recordings.qa_status` every ~5 s per recording.
- Watch the S3 bucket fill (mp4 + imu.csv + metadata.json — 3 objects per recording).
- Logcat watcher per device, filtered for HumynUpload | UploadCoord | ChunkUploader |
  DEAD_LETTER | VERIFIED | onSegment.
- Speak up UNPROMPTED at each milestone, naming the device explicitly:
    "Pixel 10a — /recordings/init landed at HH:MM:SS"
    "Pixel 8a — finalized: 247 MB, 3 S3 objects present"
    "Pixel 10a — hash-verify completed, qa_status=verified"
- When a recording verifies, IMMEDIATELY (without me asking) print to the terminal:
    - The 3 S3 objects + their human-readable byte sizes
    - From metadata.json: durationMs, fps, resolution, video_codec, video_profile,
      bitrate_bps, bitrate_source, gop, b_frames, orientation, imu.video_drift_max_ms,
      imu.video_drift_mean_ms, imu.video_drift_p99_ms, imu.min_rate_hz_observed_p1
    - DB row: id, qa_status, duration_ms, file_sha256
- If anything stalls (recording in `pending` > 60 s, DEAD_LETTER row, /me 404, 401s):
  diagnose proactively. Order of checks: `adb -s <serial> reverse --list` → docker ps →
  hash-verify worker alive → logcat by app pid for the specific row id. Tell me what
  you found and what you're doing — don't ask me to run anything.

I'll only message you if I see something obviously broken on-device.

POST-WALK

When both devices reach logout, post a single summary block:
- Per-device timeline (key timestamps)
- Per-recording: 3-file listing + sizes + IMU drift + min sample rate + sha256
- Verify dashboard: contributions row, events outbox count, queue stats
- Anything anomalous worth flagging
- NO commits.
```

---

## Notes

- **Identity:** the walk signs in with `m.adnaan161@gmail.com`. Both devices share the
  same Google account → same `users` row server-side → contributions accumulate per
  account, but Pending Uploads / History on each device is MMKV-local.
- **FPS gate:** current `main` HEAD has `mean_fps < 29.0` (tightened 28 → 29 on
  2026-05-17 after the Pixel 10a + Pixel 8a cancel-walk). Healthy recordings stamp
  ~30 fps and pass; only genuine drops cancel.
- **`name` is optional, `email` required** as of the same 2026-05-17 follow-on. No
  "complete your profile" toast unless the email is empty.
- **Tunnels are per-USB-connection** — they drop on unplug. Re-establish all three
  (8080 + 8081 + 4566) every time a device reconnects.
- **`pnpm --filter @humyn/api test` wipes the dev DB** — don't run the api test suite
  mid-walk; the truncate hooks will nuke `users` + `recordings` + `tasks` and you'll
  have to re-seed.
- **Distinct from `E2E-DEMO-PROMPT.md`** — that one is the single-device Phase-6 demo
  walk; this is the fully-orchestrated 1+-device version where Claude does all the
  terminal work.
