---
phase: 6
slug: tasks-history-home-tiles-lexical-search
type: smoke-walk-resume
canonical: false
created: 2026-05-14
status: in-progress
---

# Phase 6 manual smoke — resume handoff

Mid-walk handoff written for the next conversation. The previous session
was running an interactive runbook walk in the
**orchestrator-runs-everything / owner-only-interacts-with-the-device**
pattern: I (Claude) executed every shell / git / API command + edited
code; the owner only tapped the Pixel 10a and reported what they saw.

**Continue in the same pattern.** Do not start a fresh smoke session;
resume from §5 and finish §5 → §6 → §7.

---

## Walk progress (as of 2026-05-14 ~13:50 IST)

| §   | Title                            | Status                                                                                                                                                  |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1  | D-09 HumynBeep audibility        | **DEFERRED** (owner directive 2026-05-14 "fuck the beep – not required"). See [[feedback_d09_audibility_deferred]] in MEMORY.md. Not blocking sign-off. |
| §2  | Tasks tab (TASK-01..10)          | **PASS** (all 10 boxes ticked; 2 fix-packs landed mid-walk: search-includes-category migration 0008 + JSON body for /task-requests)                     |
| §3  | Home tab (HOME-01..06,09,10)     | **PASS** with caveats (HOME-01 + HOME-02 + HOME-03 + HOME-04 + HOME-05-visible + HOME-09 all confirmed; HOME-10 is the documented Plan 06-08 stub)      |
| §4  | History tab (HIST-01..06,10,11)  | **PASS** (HIST-04 empty state confirmed verbatim; row layout / day-grouping / filter chip / no-delete-affordance all OK on the one recorded row)        |
| §5  | Player + streaming (HIST-07..09) | **IN PROGRESS** (4 functional bugs fixed; one still open — see below)                                                                                   |
| §6  | Cross-cutting                    | PENDING                                                                                                                                                 |
| §7  | Sign-off                         | PENDING                                                                                                                                                 |

---

## Active §5 bug (resume point)

The video Player keeps showing **"Couldn't load video. Tap to retry."**
even after these 5 fixes landed (commit `5aa4288`):

1. Metro `sourceExts` order (ts/tsx before json)
2. `/task-requests` JSON body
3. `/recordings/:id/stream-url` S3 presigned fallback when CF env unset
4. PlayerScreen TextureView wrap-not-style
5. PlayerController `setLooper(main)` + `http://localhost:*` validator
   allow-list

After (5), the device's stream-url call returns 200 with a presigned
URL pointing to `http://localhost:4566/humyn-recordings-dev/recordings/...`,
ExoPlayer should accept it (validator now passes http://localhost), but
the user still sees the "Couldn't load video" runtime-error overlay.
Last logcat capture didn't show a HumynPlayer onPlayerError line —
suggesting the failure may be in the JS `resolveSource` try/catch
BEFORE the native call OR something silent in ExoPlayer's HTTP fetch.

**Next investigation steps (run these first when you resume):**

1. Clear logcat + tail with a wide filter, then have owner tap retry:
   ```bash
   adb logcat -c
   adb logcat -s 'HumynPlayer:*' 'ExoPlayerImpl:*' 'HttpDataSource:*' 'DefaultDataSource:*' 'OkHttpClient:*' 'AndroidRuntime:*' '*:E'
   ```
2. If no HumynPlayer error fires → the JS `resolveSource` is throwing
   pre-native. Add a debug `console.log` to `apps/mobile/src/screens/history/PlayerScreen.tsx`
   inside `resolveSource` after `getRecordingStreamUrl` returns + before
   `HumynPlayer.prepare`.
3. Probe the presigned URL from the device-side perspective. `curl` and
   `wget` aren't on the device shell; use `adb shell am start -a android.intent.action.VIEW -d "<url>"`
   to open it in a browser — if the browser can fetch the bytes,
   ExoPlayer can too.
4. Check whether ExoPlayer needs `setAllowChunklessPreparation(true)` or
   a different `DataSource.Factory` for plain MP4 served over HTTP without
   `Accept-Ranges`. LocalStack S3 may not advertise `Accept-Ranges: bytes`
   which ExoPlayer needs for HEVC progressive playback.
5. Alternate hypothesis: the recording uploaded as a `pending` /
   `uploading` chip is now actually `verified`, which triggered the
   Phase 5 verified-event drain to call `clearLocalPath(recordingId)`.
   Verify by reading the MMKV ledger entry on the device — if
   `mp4LocalPath` is empty, we're 100% on the remote path. If it's
   still set, `RNFS.exists()` may be returning true on a path that
   the player can't actually read.

---

## Findings (open) — will go to 06-COSMETIC-GAPS.md at §7 sign-off

Non-blocking items recorded during the walk. **Do NOT create
06-COSMETIC-GAPS.md until §7 — every entry below stays in this file
until then so the next session has one source of truth.**

1. **Tasks tab pull-to-refresh inert** — no `RefreshControl` on the
   FlatList. Not a spec requirement; deferred polish.
2. **TaskDetailsSheet swipe-down dismiss inert** — sheet can be
   dismissed by tapping backdrop / X-close, but the pan-down gesture
   isn't wired. TASK-05 acceptance has the open + start-recording path
   only; cosmetic.
3. **AlertPill placement** — during battery 15% alert, the AlertPill
   rendered in the wrong spot. Owner wants it at the bottom of the
   recording screen, below the Stop Recording button.
4. **§1 D-09 audibility** — beep inaudible on Pixel 10a / Android 16.
   Owner deferred ("fuck the beep – not required"). Memory:
   [[feedback_d09_audibility_deferred]]. Plan 06-01 instrumentation
   stays (`load → loadComplete → playTone request → play returned`).
5. **Home tab → custom date range** — currently free-text `YYYY-MM-DD`
   TextInput; owner wants a calendar picker. Plan 06-08 D-date-input
   deferred this (`@react-native-community/datetimepicker` not in deps);
   needs a new plan + dep add.
6. **HOME-10 OfflineBanner not wired** — Plan 06-08 Known Stub. JS-local
   `useState<boolean>` isn't fed by the native NetworkMonitor event yet.
   Banner doesn't appear when airplane mode toggles. Promote to a Phase 7
   plan.
7. **Pending Uploads row tap navigates to History instead of triggering
   drainNowSafe** — Phase 5 D-10 wired a tile-tap retry kick; current
   behavior opens the History row (which doesn't exist server-side yet
   if the upload is still pending) and shows HIST-04 empty state. Not
   a Phase 6 issue; Phase 5 D-10 wiring decision.

---

## Functional fixes landed mid-walk (already committed)

Don't re-do these. They live on `main` already.

| Commit    | What                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `52031d1` | Metro watchFolders for design-system/                                                                                                                                       |
| `175f59d` | Migration 0008 — tasks.name_search includes category                                                                                                                        |
| `5aa4288` | Smoke-walk fixpack: Metro sourceExts, /task-requests JSON, stream-url S3 fallback, PlayerScreen TextureView wrap, PlayerController Looper.main + http://localhost validator |

---

## Environment — bring-up commands (run these FIRST after resume)

The previous session left these background processes running but they
may have been killed across context clears or restarts. Verify + restart
as needed.

```bash
# 1) Verify dev infra (Postgres + LocalStack + Redis) is up
docker compose ps

# 2) Verify tasks table is seeded (this gets wiped if anyone runs apps/api tests)
#    See [[feedback_api_tests_wipe_dev_db]] in MEMORY.md.
docker exec humyn-postgres psql -U humyn -d humyn_dev -t -c "SELECT COUNT(*) FROM tasks;"
# If 0: re-seed
set -a && source apps/api/.env && set +a
cd apps/api && pnpm seed:tasks && pnpm seed:dev-task && cd -

# 3) Verify the backfill user row exists (the original Google sign-in user
#    was wiped by an api test run earlier; backfilled at JWT.sub matching
#    the device's keychain token).
docker exec humyn-postgres psql -U humyn -d humyn_dev -c "SELECT id, email, flavor FROM users;"
# Expect: 01KRJN20MQ17YKNNRJ11T7B4DB / smoke-walk@example.com / apkRollout
# If missing, re-insert:
docker exec humyn-postgres psql -U humyn -d humyn_dev -c "INSERT INTO users (id, google_sub, email, name, consent_version, consent_accepted_at, flavor, application_id) VALUES ('01KRJN20MQ17YKNNRJ11T7B4DB', 'backfill-01KRJN20MQ17YKNNRJ11T7B4DB', 'smoke-walk@example.com', 'Smoke Walk User', '1.0', now(), 'apkRollout', 'ai.humynlabs.capture.apk') ON CONFLICT DO NOTHING;"

# 4) Start the API (port 8080) — kill any stale instance first
lsof -nP -iTCP:8080 -sTCP:LISTEN -t | xargs -r kill
ps aux | grep -E "tsx watch.*src/index|@humyn/api.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill
sleep 2
set -a && source apps/api/.env && set +a
# Note: AWS_ENDPOINT_URL must be http://localhost:4566 (NOT a stale trycloudflare tunnel)
# Run in background; capture its log to a known path:
WORKER_BOOTSTRAP=false pnpm --filter @humyn/api dev   # use Bash run_in_background:true

# 5) Start Metro (port 8081) — kill any stale instance first
lsof -nP -iTCP:8081 -sTCP:LISTEN -t | xargs -r kill
sleep 2
cd apps/mobile && npx react-native start --reset-cache  # use Bash run_in_background:true

# 6) Verify adb reverse mappings (device → host):
adb reverse --list
# Expect: tcp:8080, tcp:8081, tcp:4566
# If any missing, re-add: adb reverse tcp:8080 tcp:8080  etc.

# 7) Confirm the apkRolloutDebug build is installed on the device
adb devices  # expect 5C161JEA304304 device
adb shell dumpsys package ai.humynlabs.capture.apk | grep versionName
# If app data is fine (signed in as Smoke Walk User, can reach Tasks tab
# with 65 cards), proceed. Otherwise rebuild:
#   cd apps/mobile/android && ./gradlew installApkRolloutDebug
```

---

## Owner-facing prompt to paste after `/clear`

> Resume the Phase 6 manual smoke walk where we left off. The walk is in
> the orchestrator-runs-everything / owner-only-interacts-with-device
> pattern. Read
> `.planning/phases/06-tasks-history-home-tiles-lexical-search/06-SMOKE-WALK-RESUME.md`
> first — it has all the context (progress through §1-§5, the open §5
> player bug, the 7 findings list, env bring-up commands, commits
> already landed). Bring up the dev infra per its "Environment" section,
> then continue from the **Active §5 bug** investigation steps. Do not
> restart §1-§4 — they passed. I (the owner) am sitting at the Pixel
> 10a; you run every shell / git / API / build command and tell me what
> to tap.

---

## Behavioral notes for the resume session

- **Memories already saved this session** (consult them, don't re-discover):
  - `feedback_d09_audibility_deferred` — beep is dead, don't debug
  - `feedback_api_tests_wipe_dev_db` — running api tests truncates dev
    tasks + users; re-seed after
  - `feedback_post_merge_test_env` — bare `pnpm test` fails with SCRAM
    password; use `set -a && source apps/api/.env && set +a &&
WORKER_BOOTSTRAP=false pnpm -r --parallel test`
- **CLAUDE.md says** to start work through a GSD command. Smoke walks
  are an exception — the runbook is the gating artifact + we're
  finishing a checkpoint plan already in-flight (06-11 Task 3).
- **Functionality first** during the walk
  ([[feedback_functionality_first_during_smoke]]). Findings 1-7 above
  are cosmetic / deferred — don't pause the walk to fix them. Only
  pause for functional bugs (auth blocks, render crashes, API 500s,
  data loss) — and even then commit the fix as a tight fixpack and
  move on. The 5aa4288 commit is the model.
- **Do NOT spawn subagents** for this — it's a tight interactive loop;
  subagents add latency + lose state.
