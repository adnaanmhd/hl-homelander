---
phase: 6
slug: tasks-history-home-tiles-lexical-search
type: smoke-walk-resume
canonical: false
created: 2026-05-14
status: closed
closed_at: 2026-05-14
closed_commit: null
---

# Phase 6 manual smoke — resume handoff

> **CLOSED 2026-05-14.** Plan 06-12 cosmetic cleanup landed (commits
> `7a55e0c`, `a55d943`, `4bec668`, `a8664dd`, `10c6d26`). Owner spot-
> check on Pixel 10a green across all 5 surfaces. `06-MANUAL-SMOKE.md`
> §7 sign-off flipped to **YES**. One new finding (14 — Home YOUR
> CONTRIBUTION right-tile has no unit label) logged in
> `06-COSMETIC-GAPS.md`, deferred to Phase 8. Phase 6 closes.
>
> Historical reopen note (2026-05-14): Walk had originally signed at
> HEAD `40040fe` but the owner reopened §7 to add 4 new cosmetic gaps +
> promoted the Tasks-tab pull-to-refresh + the seek-deferral. All
> findings captured in `06-COSMETIC-GAPS.md`; cleanup scoped in
> `06-12-PLAN.md`. That cleanup is now done.

---

# (historical) Phase 6 manual smoke — resume handoff

Mid-walk handoff written for the next conversation. The previous session
was running an interactive runbook walk in the
**orchestrator-runs-everything / owner-only-interacts-with-the-device**
pattern: I (Claude) executed every shell / git / API command + edited
code; the owner only tapped the Pixel 10a and reported what they saw.

**Continue in the same pattern.** Do not start a fresh smoke session;
resume from §5 and finish §5 → §6 → §7.

---

## Walk progress (as of 2026-05-14 ~16:00 IST)

| §   | Title                            | Status                                                                                                                                                  |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1  | D-09 HumynBeep audibility        | **DEFERRED** (owner directive 2026-05-14 "fuck the beep – not required"). See [[feedback_d09_audibility_deferred]] in MEMORY.md. Not blocking sign-off. |
| §2  | Tasks tab (TASK-01..10)          | **PASS** (all 10 boxes ticked; 2 fix-packs landed mid-walk: search-includes-category migration 0008 + JSON body for /task-requests)                     |
| §3  | Home tab (HOME-01..06,09,10)     | **PASS** with caveats (HOME-01 + HOME-02 + HOME-03 + HOME-04 + HOME-05-visible + HOME-09 all confirmed; HOME-10 is the documented Plan 06-08 stub)      |
| §4  | History tab (HIST-01..06,10,11)  | **PASS** (HIST-04 empty state confirmed verbatim; row layout / day-grouping / filter chip / no-delete-affordance all OK on the one recorded row)        |
| §5  | Player + streaming (HIST-07..09) | **PASS** with 2 deferred items — see §5 close-out below                                                                                                 |
| §6  | Cross-cutting                    | PENDING                                                                                                                                                 |
| §7  | Sign-off                         | PENDING                                                                                                                                                 |

---

## §5 close-out (2026-05-14 ~16:00 IST)

The "Couldn't load video. Tap to retry." error from the prior session
was traced to a thread-affinity bug in `PlayerController`. Resolved.
Five more player-side fixes landed in this session. Two issues remain
deferred (not blocking sign-off) — both captured in the Findings list
below.

### Root cause of the original block

`PlayerController.prepare` called `ep.setMediaItem(...)` and
`ep.prepare()` from RN's `mqt_native_modules` thread while the
ExoPlayer's application looper had been pinned to main (commit
`5aa4288`'s `setLooper(Main)` fix). ExoPlayer's `verifyApplicationThread()`
threw `IllegalStateException`, the catch fired `cb(Result.failure(t))`
silently (no `Log.w` in the catch), the JS Promise rejected, and
`resolveSource`'s blanket `catch {}` set `errorState='network'`. No
`HumynPlayer playback error` log line because ExoPlayer's
`onPlayerError` listener was never registered — the throw fired
before `addListener`.

### Player-side fixes landed this session

All in one fixpack:

1. **PlayerController main-looper dispatch.** Wrapped every player
   touch (`prepare`, `play`, `pause`, `seekTo`, `release`,
   `onSurfaceAvailable`, `onSurfaceDestroyed`) in an `onMain {}` helper
   so ExoPlayer's thread-affinity check always passes. Added `Log.w`
   in the prepare catch for future visibility.
2. **TIME_UNSET → NaN coercion.** Progress emit now sends `Double.NaN`
   when `ep.duration == C.TIME_UNSET` instead of the raw `Long.MIN_VALUE`
   sentinel — JS Number.isFinite guards now work.
3. **`emitProgress()` on STATE_READY.** Pushes duration/position to JS
   the moment the timeline resolves, even before the user taps play —
   total-time + scrub-bar now correct on first render.
4. **ScrubBar NaN-aware percentages.** With NaN duration, fall back to
   0 % fills (not the previous saturating `safeDuration=1` which
   misreported playback as ended).
5. **Authoritative duration via route param.** `HistoryScreen.onRowTap`
   now passes `durationMs` (mirrors `recordings.duration_ms`) to
   PlayerScreen, used as the initial total-time seed. Necessary because
   ExoPlayer can't derive duration from HumynCapture's fragmented MP4
   output (see Finding 9 below).
6. **Drag-to-seek via PanResponder.** Replaced the v2-deferred
   tap-to-midpoint stub with a real drag-to-seek wrapper (`hitSlop=12`
   on a 24 px-tall transparent grip over the 4 px visible track).
   Drag computes delta from `e.nativeEvent.pageX - pressOriginPageX`
   because RN 0.83 + Fabric's `gestureState.dx` was confirmed via
   diagnostic logging to stay at 0 across move events. Drag logic
   verified end-to-end on device.

### What still doesn't work (deferred to Findings)

- **`gestureState.dx === 0` on RN 0.83 Fabric** — diagnosed but the
  `pageX`-delta workaround makes it moot for the scrub bar. (Not
  filed as a finding — the workaround stands.)
- **Seek lands at byte 0 even when ExoPlayer reports the right
  position** — root-caused to HumynCapture's fragmented MP4 output
  carrying no `sidx` / `mfra` seek-index boxes. media3 1.10's
  `FragmentedMp4Muxer.Builder` exposes no API to emit either; the
  jar strings show literally zero references to "sidx" or "mfra".
  Switching to flat MP4 would violate `idea-brief.md §6.6`'s
  mid-recording crash-resilience guarantee. **Filed as Finding 9 —
  needs a Phase 3 follow-on plan (finalize-time remux step).**
- **"View only — not downloadable." sticks** — design-spec §14 +
  06-UI-SPEC line 291 both spec a persistent footer; owner wants
  toast-with-5s-fadeout. **Filed as Finding 8.**

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
   Banner doesn't appear when airplane mode toggles. Promote to a Phase 8
   plan.
7. **Pending Uploads row tap navigates to History instead of triggering
   drainNowSafe** — Phase 5 D-10 wired a tile-tap retry kick; current
   behavior opens the History row (which doesn't exist server-side yet
   if the upload is still pending) and shows HIST-04 empty state. Not
   a Phase 6 issue; Phase 5 D-10 wiring decision.
8. **Player "View only — not downloadable." footer sticks** — owner
   wants toast-with-5s-fadeout; design-spec §14 + 06-UI-SPEC line 291
   spec it as a persistent footer (12 / `text2` style on dark =
   white@60 %). Owner-vs-spec divergence; defer to a UI/copy revision
   plan. **Found 2026-05-14 §5 close-out.**
9. **Player drag-to-seek lands at byte 0** — ExoPlayer's
   `seekTo(positionMs)` updates the internal `currentPosition` to the
   target ms, then snaps back to byte 0 because the recording's
   fragmented MP4 (Plan 03-04 / CAP-02 / `idea-brief.md §6.6`) carries
   no `sidx` or `mfra` seek-index boxes. media3 1.10.0's
   `FragmentedMp4Muxer.Builder` exposes no API to emit either (jar
   strings: zero "sidx"/"mfra" references). Switching to flat MP4
   violates the mid-recording crash-resilience constraint. **Needs a
   Phase 3 follow-on plan: a finalize-time remux step (read fmp4 →
   write flat MP4 with proper moov/sample-tables; adds ~5–10 s +
   transient disk doubling per recording). The PlayerScreen drag-to-
   seek wiring is correct and will start working the moment the
   recording side emits seekable MP4s.** Found 2026-05-14 §5 close-out.

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
