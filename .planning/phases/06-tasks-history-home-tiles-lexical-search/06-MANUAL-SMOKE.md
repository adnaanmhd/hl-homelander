---
phase: 6
slug: tasks-history-home-tiles-lexical-search
type: manual-smoke
canonical: true
created: 2026-05-14
re_walked_on: pending
---

# Phase 6 Manual Smoke — Tasks, History, Home Tiles & Lexical Search (on-hardware acceptance)

**Status:** AUTHORED 2026-05-14 — operator on-device walk pending. This is the canonical Pattern-56 runbook for Phase 6. Plans 06-01..06-10 all landed (SUMMARY.md committed for each); Plan 06-11 ships this runbook + the ROADMAP/STATE refresh and pauses at the human-verify checkpoint below.

> Per `06-CONTEXT.md` D-09b (owner directive 2026-05-14): **Wave 1 → Wave 2 → … → Wave 7 ran sequentially with no human approval between waves.** The Wave 1 D-09 on-hardware audibility verdict is captured here in §1 — **BLOCKING for phase sign-off, NOT for Wave 2 entry.** Other on-hardware verifications for the rest of Phase 6's success criteria (Tasks pills + search, Home tiles + pull-to-refresh + offline banner, History rows + filter + thumbnails, Player + streaming) live in §2-§5; cross-cutting checks in §6; sign-off in §7.

**Operator:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Date:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Device:** Pixel 10a (`5C161JEA304304`) **Android version:** **\_\_\_\_**

> Throughout: the app package id for the `apkRollout` flavor is `ai.humynlabs.capture.apk` — every `adb shell run-as` below uses that. Run `adb logcat -c` before each section so the logcat greps match the latest run. The app NEVER runs CLI commands; the operator only visits screens, taps UI, evaluates visuals/audio/haptics, and runs the `adb` diagnostics quoted inline.
>
> **iOS is out of scope (Android-only MVP).** The iOS player analogue (`HumynPlayerIOS` / AVPlayer) is deferred — `REQUIREMENTS.md §v2` IOS-01..07. This runbook is Android-only by design (D-07a).

---

## §1 — Wave 1 D-09 HumynBeep audibility + Vibrator haptics restore (BLOCKING for sign-off, NOT for Wave 2 entry)

Plan 06-01 closed here: SoundPool flipped `USAGE_ASSISTANCE_SONIFICATION` → `USAGE_MEDIA` (routes the cue through STREAM_MUSIC so the operator's MAX media-volume control actually controls it), `<uses-permission android:name="android.permission.VIBRATE" />` declared in the base manifest, and `Log.i("HumynBeep", ...)` instrumentation at every observable boundary. The on-hardware verdict was deferred from per-wave gating to this section per D-09b.

Steps:

- [ ] App build: `cd apps/mobile/android && ./gradlew installApkRolloutDebug`. Confirm `__DEV__ === true` (`adb shell dumpsys package ai.humynlabs.capture.apk | grep -i versionName` returns the debug variant); HEAD commit recorded: **\_\_\_\_\_\_**.
- [ ] Set device media volume to **MAX** (the volume rocker on the side, with media playing — this routes to STREAM_MUSIC which is where `USAGE_MEDIA` lands).
- [ ] `adb logcat -c` then `adb logcat -s HumynBeep` running in a side terminal — this surfaces the load → loadComplete → playTone request → play returned → streamVolume / maxVolume diagnostic lifecycle (Plan 06-01 instrumentation).
- [ ] Long-press the "Tasks" tab heading to enter the `__DEV__` dev affordance (or any taskCard → Start Recording). Pass the hand-gate (2 hands × 250 ms × 2 hits) → reach the active recording substate.
- [ ] **Battery-15% alert path** — `adb shell dumpsys battery set level 14` while recording. Verify:
  - [ ] **Visual:** AlertPill chrome renders "Battery 15%" (already passed in Phase 5 — visual is regression-only here).
  - [ ] **Audio:** the 520 Hz / 200 ms beep is **audible** at MAX media volume.
  - [ ] **Haptic:** the `[100, 50, 100]` ms vibration pattern is **felt** at the wrist/hand.
  - [ ] **Voice:** "Battery low. Consider charging soon." (en-US female-leaning per CLAUDE.md TTS owner deviation) speaks.
  - [ ] Logcat shows: `Log.i HumynBeep load`, `loadComplete`, `playTone request streamVolume=15 maxVolume=15`, `play returned streamId=<non-zero>`.
- [ ] Restore battery: `adb shell dumpsys battery reset`.
- [ ] **Thermal SEVERE kill path** — `adb shell cmd thermalservice override-status 3` (SEVERE) while recording. Verify:
  - [ ] **Audio:** the 440 → 560 → 680 Hz descending tone sequence is **audible**.
  - [ ] **Haptic:** the 800 ms continuous vibrate is **felt**.
  - [ ] **Voice:** "Phone too hot, stopping recording" speaks.
  - [ ] Recording ends cleanly within ~2.5 s (the graceful-stop budget per Phase 4 D-THERM-01).
  - [ ] Toast: "Recording stopped — phone needs to cool." renders.
- [ ] Restore thermal: `adb shell cmd thermalservice override-status 0`.
- [ ] No `streamId=0` BEEP_FAILED rejections in logcat for either path (the Plan 06-01 streamIdGuard helper guards both the synchronous and the queued/pending-play branches; `Log.w pendingPlay returned 0` should NOT fire on a healthy device).

**§1 Acceptance:** the 520 Hz battery beep AND the 440→560→680 Hz thermal sequence are **audible** at MAX media volume; the `[100,50,100]` ms battery vibrate AND the 800 ms thermal vibrate are **felt**; the en-US female-leaning voice cues play; logcat shows the Plan 06-01 instrumentation lines (load / loadComplete / playTone request with streamVolume / maxVolume / play returned). If any audio path is still silent or any haptic still inert, the verdict is **NO** for §1 (Phase 6 sign-off blocked) — refer to Plan 06-01 SUMMARY's "Next Phase Readiness" + 06-RESEARCH Pattern 8 for the diagnostic flow and consider a `/gsd-debug` cycle.

**Re-walked-on:** YYYY-MM-DD HEAD<commit>

---

## §2 — Tasks tab end-to-end (TASK-01..TASK-10 coverage)

Plans 06-02 (lexical-only `/tasks/search` + pg_trgm fallback at threshold 0.3) and 06-07 (TasksScreen + TaskDetailsSheet + SendRequestSheet + 4 reusable components) close here.

Steps:

- [ ] Open the **Tasks** tab (the atomic 3-tab swap landed in Plan 06-09 — `MainTabs.tsx` now mounts `TasksScreen`, not `TasksPlaceholderScreen`).
- [ ] **TASK-01 grid render:** All 65 task cards render across the 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby). Each card shows the `<TaskIcon>` (lucide via `lucide-react-native@1.14.0` per Plan 06-05 `TaskIcon.native.tsx`) + UPPERCASE category eyebrow + name + 2-line description.
- [ ] **TASK-02 category pills:** Tap each of the 10 category pills + the "All" pill (11 total). The grid filters correctly each time. Active pill shows `text` fill + white label.
- [ ] **TASK-03 lexical hit:** Type `make` in the always-visible search input. After 200 ms (Plan 06-07 `useTaskSearch` debounce), results appear; at least one Cooking task matches (`ts_vector` + `ts_rank` happy path).
- [ ] **TASK-03 fuzzy fallback (pg_trgm):** Clear search. Type `sweping` (or `sweepng`). After 200 ms, the pg_trgm fallback (Plan 06-02 D-02) returns "Sweeping the floor" or similar via `similarity(name, q) > 0.3 OR similarity(description, q) > 0.3` (the 0.3 threshold is pinned explicitly in the WHERE clause — Pitfall 4 mitigation).
- [ ] **TASK-10 empty state:** Clear search. Type `zzzzzzzz` (no plausible matches). After 200 ms, the TASK-10 empty state renders the lucide `SearchX` icon + heading + body **"No tasks match. Try clearing filters or send a request."** (UI-SPEC §10 / 06-UI-SPEC.md line 286 verbatim).
- [ ] **TASK-05 details sheet (open):** Clear search. Tap any card. The Task details bottom sheet (Plan 06-07 `TaskDetailsSheet.tsx`) opens with grab handle.
  - [ ] Category chip renders (+ Outdoor chip too if the task is outdoor-tagged, e.g. any Gardening task — TASK-04).
  - [ ] **TASK-06 universal-rules block:** All 4 verbatim labels render inside the `universalRulesBg`-coloured well — `front_hand` / `videocam` / `lightbulb` / `apps` (hardcoded `UNIVERSAL_RULES` per task-taxonomy.md; lucide stand-ins HandMetal / Video / Lightbulb / LayoutGrid per Plan 06-07 D-Material).
  - [ ] **TASK-07 per-task instructions:** Up to 3 bullets render verbatim from the server's `instructions` field.
  - [ ] **Start Recording CTA** (sticky footer): tap → routes to RecordingScreen with `{ taskId, taskName, isPractice: false }`.
- [ ] **TASK-08 send-request sheet (open):** Back to Tasks. Tap the footer link "Can't find a task? Send request →" (UI-SPEC §10). The SendRequestSheet (Plan 06-07 — RN `<Modal>`-based multipart form) opens.
- [ ] **TASK-08 client-side validation:** Type a 1-character name + submit. Inline coral error appears (verbatim "Task name needs at least 3 characters." or similar — see UI-SPEC §12 validation rules).
- [ ] **TASK-08 submit happy path:** Fill name=3..80 chars / description=10..240 chars / category=Other / setting=Indoor. Leave the optional sample-video tile untapped (the picker is NOT wired at MVP per Plan 06-07 D-sample-video — TASK-08 marks the field OPTIONAL). Tap **Send request**. Verify:
  - [ ] Success toast: **"Request sent. We'll review and add it to your list."** (TASK-09 verbatim from UI-SPEC §12).
  - [ ] Sheet closes; user lands back on Tasks.
  - [ ] **TASK-09 invariant** (no submitted-request status surfaced anywhere): no badge, no banner, no row added — that's the contract.
- [ ] **TASK-08 retry-after-failure path:** Submit while the backend is unreachable (airplane mode + 5 s wait), tap Send. Banner-with-Retry shows "Couldn't send. Try again." → toggle airplane off → tap Retry → succeeds.

**§2 Acceptance:** all 65 tasks render across 10 categories + 11 pills; 200 ms debounced lexical search lands real hits + a pg_trgm fallback on `sweping`-style typos; TASK-10 empty state copy is verbatim; TaskDetailsSheet renders Category + (conditional) Outdoor + the 4-rule Universal block + per-task bullets + Start Recording CTA; Send Request validates client-side, posts to `/task-requests`, surfaces TASK-09 success toast with no request status afterwards.

**Re-walked-on:** YYYY-MM-DD HEAD<commit>

---

## §3 — Home tab end-to-end (HOME-01..06 + 09 + 10)

Plan 06-08 (HomeScreen + HomeHero + ContributionTile + OfflineBanner + FilterSheet) closes here. Plan 06-09's atomic MainTabs swap put the real `HomeScreen` on the Home tab; Phase 5 D-10 Pending Uploads wiring is preserved byte-for-byte inside the section.

Steps:

- [ ] **HOME-01 first-time empty hero:** `adb shell pm clear ai.humynlabs.capture.apk` (or fresh install). Sign in, walk through Compat + Permissions + RigTutorial → land on Home. Verify:
  - [ ] Empty hero variant renders: "Record your first task" copy + "Pick a task and start recording" sub + Start Recording CTA.
  - [ ] Both ContributionTiles (recording-duration + tasks-recorded) show `0s / 0` (zero-state).
- [ ] **HOME-02 returning hero:** Long-press Tasks → record a 60+ s segment via the `__DEV__` dev affordance → stop → back to Home. Verify:
  - [ ] Returning hero variant renders with the lifetime numeric (44 px mono `formatContributionDuration`) + "Across N tasks" + Start Recording CTA.
  - [ ] Counter-ease animation runs 1200 ms ease-out cubic on the lifetime numeric (UI-SPEC §Motion 8 — Plan 06-08 `setInterval` + ease-out cubic, no Reanimated worklet).
- [ ] **HOME-03 duration-tile range filter:** Tap the time-range chevron on the **recording-duration** tile. FilterSheet (Plan 06-08 `screens/shared/FilterSheet.tsx`) opens with the 16a quick-select layer. Verify the 6 named windows render: **Today / Yesterday / This week / This month / All time / Custom range**.
  - [ ] Tap "Yesterday". Sheet closes; the tile re-fetches `/contributions/timeseries?aggregate=true&start=…&end=…` (Plan 06-03 D-03a single-bucket variant) with the local-tz boundaries (Plan 06-05 `services/timeRange.computeRange` — Monday-start week per 06-RESEARCH A6); chevron label updates to **"yesterday ▾"**.
- [ ] **HOME-04 tasks-recorded-tile range filter:** Repeat the FilterSheet open + select "This week". The **tasks-recorded** tile re-fetches with `COUNT(DISTINCT task_id)` (NOT a sum across daily buckets — Plan 06-03 — would double-count) and updates.
- [ ] **HOME-03/04 custom range:** Open FilterSheet on either tile. Tap "Custom range". The 16b custom-range layer pushes in (free-text `<TextInput>`-based YYYY-MM-DD fields per Plan 06-08 D-date-input — `@react-native-community/datetimepicker` is intentionally NOT a dep). Enter valid From + To (From ≤ To ≤ today per D-03c). Tap **Apply**. Tile updates to the custom window.
  - [ ] **Validation errors:** missing one date / inverted range (From > To) / future date — each shows the inline coral error per UI-SPEC §16b; Apply is disabled when invalid.
- [ ] **HOME-09 pull-to-refresh:** Pull down on the Home ScrollView. `RefreshControl` spinner shows (Plan 06-08 first consumer of this RN primitive in the codebase); on release, the lifetime + aggregate re-fetch.
- [ ] **HOME-05 Pending Uploads visibility:** With 0 pending uploads on the device — verify the **Pending Uploads section is HIDDEN** (the `pendingRows.length > 0` gate that Plan 06-08 wraps around the Phase 5 D-10 wiring).
- [ ] **HOME-05 Pending Uploads VISIBLE:** Start an upload that doesn't complete (e.g. enter `adb shell svc wifi disable && adb shell svc data disable` after starting a recording so the upload is queued + offline). Background the app + foreground it. Verify the **Pending Uploads section is VISIBLE** with the queued row(s).
- [ ] **HOME-10 offline banner inside Pending Uploads:** With uploads queued AND airplane mode on, verify the **OfflineBanner** renders inside the Pending Uploads section header (neutral palette — `colors.line` bg, lucide `WifiOff` icon, `text2` label per Plan 06-08 D-offline-banner; copy verbatim from UI-SPEC §HOME-10). Toggle airplane back off → the banner clears once connectivity returns (note: the offline signal is still a JS-local `useState<boolean>` per Plan 06-08 Known Stub — a future plan wires the native NetworkMonitor event; for this walk, the operator can simulate the banner by triggering the dev-mode toggle if the JS-side hook is wired to a debug flag, OR accept that the banner won't auto-toggle until the native plumbing lands and document the stub).
- [ ] **HOME-06 duration formatter regression:** the lifetime + tile numerics render via `formatContributionDuration` — `<1m → Xs`, `<1h → Xm`, `≥1h → Xh Ym` floored to the previous minute (Phase 4 carry-over; Plan 06-05 reuses without changes).

**§3 Acceptance:** empty hero + zero-state tiles fire on a fresh install; returning hero animates the lifetime numeric on cold-mount; FilterSheet 16a 6-option list + 16b custom range work for both tiles with `Accept-Timezone`-aware local-tz boundaries; pull-to-refresh refetches; Pending Uploads section is hidden at 0 / visible at ≥1; offline banner renders inside the section header (modulo the JS-stub note above).

**Re-walked-on:** YYYY-MM-DD HEAD<commit>

---

## §4 — History tab end-to-end (HIST-01..06 + 10 + 11)

Plans 06-04 (ThumbnailExtractor + FinalizeWorker step 8.5 + JS thumbnailLedger), 06-05 (historyGrouping + recordingsApi), and 06-09 (HistoryScreen + HistoryRow + HistoryDayHeader + FilterChip + the atomic MainTabs swap + RecordingScreen ledger-write extension) close here.

Steps:

- [ ] Open **History** tab with ≥1 successful recording (≥60 s, finalized + uploaded). HistoryScreen SectionList renders.
- [ ] **HIST-02 day-group headers:** Section headers render via `HistoryDayHeader` per UI-SPEC §13 grouping rules (Plan 06-05 `historyGrouping.groupByDay`): **Today / Yesterday / This week / This month / `{MonthName YYYY}`**. Server returns newest-first DESC `created_at`; sections emit in first-hit order (O(n), no re-sort — Plan 06-05 D-groupByDay).
- [ ] **HIST-06 row layout** (`HistoryRow` per UI-SPEC §13):
  - [ ] 64×64 thumbnail leading — local JPEG from `filesDir/thumbs/${base}.thumb.jpg` (Plan 06-04 `ThumbnailExtractor` MediaMetadataRetriever first-I-frame; persisted on FinalizeWorker step 8.5; indexed via `pendingThumb.{recordingId}.v1` MMKV ledger per Plan 06-04 D-04). For at least one row: confirm the JPEG renders (not the gradient + first-letter fallback).
  - [ ] For a row whose ledger entry is missing (e.g. a recording uploaded pre-Plan-06-04 install, or a fresh install with no local ledger): the **gradient + first-letter fallback** renders (D-04 `thumbFallbackStart`/`thumbFallbackEnd` tokens from Plan 06-05).
  - [ ] Filename derived from `created_at` ULID (`${YYYYMMDD_HHMMSS_NNN}.mp4` fallback shape per D-04) renders next to the duration + task name + recorded-at timestamp ("May 14, 2026 | 15:49" pattern).
  - [ ] `UploadStatusChip` renders the appropriate variant for the row's `qa_status` (verified → success; uploading|pending|uploaded → progress; hash-mismatch → failed-with-retry; paused-no-wifi → paused) — Phase 5 D-10 chip reused via Plan 06-09's row mapping.
  - [ ] **HIST-11 "Feedback (coming soon)" slot:** present at the trailing edge of the row in the `comingSoonBadge` text style (10/14 UPPERCASE +0.6 px tracking, `text3` colour); confirm it is **NOT pressable** (no ripple/scale feedback on tap).
- [ ] **HIST-10 no Delete affordance:** Long-press any row, swipe any row, look in any context menu — there is NO delete option, NO three-dot menu, NO swipe-action. (View-only contract.)
- [ ] **HIST-03 filter chip:** Tap the "All time ▾" FilterChip at the top of the screen. The shared FilterSheet opens with the same 16a quick-select (Today / Yesterday / This week / This month / All time / Custom range). Tap "Today" → rows narrow to today only; chevron label updates to "Today ▾". Repeat for "This week" → fetch re-fires with the local-tz Monday-start week boundary.
- [ ] **HIST-04 empty state (no recordings):** `adb shell pm clear ai.humynlabs.capture.apk`, re-sign-in, open History before recording anything. Empty state renders: lucide `Inbox` 48 px stroke 1.75 in `text3` + heading **"Your recordings will live here."** (24/28/700 sheetTitle style) + body **"You haven't recorded anything yet. [Pick a task](#) and try one."** (UI-SPEC §13 State 3 verbatim — Plan 06-09 HIST-04). Tap the "Pick a task" accent link → navigates to MainTabs / Tasks.
- [ ] **HIST-05 empty state (filter applied):** Record something so History has rows. Open History → FilterChip → pick a window with zero recordings (e.g. "Yesterday" if you only recorded today). The HIST-05 empty state renders: same Inbox illustration + heading **"No recordings in this range."** + body **"No recordings in this range. [Show all time](#)."** (UI-SPEC §13 verbatim). Tap "Show all time" → resets the FilterChip to "All time" and re-fetches.
- [ ] **Cursor pagination:** Scroll History to the bottom (with enough rows to require it). `onEndReached` drains the next cursor page (Plan 06-09 `fetchRecordings` next-cursor wiring).
- [ ] **Pull-to-refresh:** Pull-down on History → RefreshControl spinner → re-fetches with the active range.

**§4 Acceptance:** rows render with locked layout (thumb / name+meta / chip / Feedback slot), day-group headers fire (Today / Yesterday / This week / This month / Month YYYY), real-JPEG thumbnails render for post-06-04-build recordings + gradient fallback for legacy rows, FilterChip + FilterSheet narrow correctly, HIST-04 / HIST-05 empty states render verbatim with working accent links, HIST-10 has no delete affordance, HIST-11 "Feedback (coming soon)" slot is present + not pressable.

**Re-walked-on:** YYYY-MM-DD HEAD<commit>

---

## §5 — Player + streaming (HIST-07/08/09)

Plans 06-03 (`GET /recordings/:id/stream-url` + ArchiveState envelope), 06-06 (hand-rolled `HumynPlayer` Kotlin native module on `androidx.media3:media3-exoplayer:1.10.0`), and 06-10 (PlayerScreen + Player route in RootNativeStack) close here.

Steps:

- [ ] **HIST-07 local playback (file://):** Tap a History row whose local MP4 is still on disk (post-Plan-06-04 ledger entry has `mp4LocalPath` non-empty AND `RNFS.exists()` true). PlayerScreen opens full-bleed (the route is a RootNativeStack sibling of MainTabs — Plan 06-10 D-route-shape — so the bottom-nav is suppressed). Verify:
  - [ ] Portrait-locked (Plan 06-10 D-portrait-letterboxed); 16:9 letterboxed video frame; `colors.playerBg` (#000) background.
  - [ ] Top bar: X-close on the left + centered task name + lock badge ("View-only", lucide `Lock`) on the right.
  - [ ] 64×64 round play overlay (lucide `Play` icon) centered over the video; tap → playback starts.
  - [ ] 4 px accent-coloured scrub bar (with buffered overlay) advances as playback progresses.
  - [ ] Mono current/total time row updates ("Menlo" fontFamily per Plan 06-10 D-mono-time).
  - [ ] Footer: **"View only — not downloadable."** (verbatim from UI-SPEC §14).
  - [ ] Tap-anywhere on the scrub bar → midpoint-seek (MVP affordance per Plan 06-10 D-tap-seek; full drag-to-seek is §v2 polish).
  - [ ] Tap X-close → returns to History; unmount invariant fires (`HumynPlayer.release()` + every event subscription `.remove()`'d + `Orientation.unlockAllOrientations()` per Plan 06-10).
- [ ] **HIST-08 remote streaming (post-verified, local MP4 cleared):** Find or seed a recording whose `qa_status='verified'` event cleared the local MP4 (the Phase 5 verified-event drain runs `clearLocalPath(recordingId)` which empties `mp4LocalPath` but preserves `thumbnailPath` per Plan 06-04 D-04). Tap the row. PlayerScreen calls `getRecordingStreamUrl(recordingId)` (Plan 06-03 `GET /recordings/:id/stream-url`):
  - [ ] Response envelope: `{ presignedUrl: <CF-signed>, expiresAt: ISO, archiveState: 'available' }` (TTL 5 min — Plan 06-03 STREAM_TTL_SECONDS).
  - [ ] `HumynPlayer.prepare(presignedUrl)` runs; `DefaultDataSource` handles `https://` URL natively (Plan 06-06 D-source-switch).
  - [ ] Video streams from S3/CloudFront. Same UI chrome as §HIST-07.
- [ ] **HIST-08 deep-archive (>90 d):** Find or seed a row whose `created_at` is >90 days old (or use a dev tool to inject a synthetic row). Tap the row. PlayerScreen reads `archiveState='deep-archive'` and `presignedUrl=null` from the stream-url response (Plan 06-03 D-08 — derived from `created_at` >90 d in-process, NO S3 HeadObject). Verify:
  - [ ] DisabledOverlay renders with verbatim copy: **"This recording has been archived. Contact support for retrieval."** (UI-SPEC §14 / 06-CONTEXT D-06 verbatim).
  - [ ] No play affordance; X-close still works.
- [ ] **HIST-09 pending-upload (still uploading):** Find or seed a row whose `qa_status='pending'` (the row is enqueued for upload but the S3 object doesn't exist yet). Tap the row. PlayerScreen reads `archiveState='unavailable'` and `presignedUrl=null` from the stream-url response (Plan 06-03 D-08). Verify:
  - [ ] DisabledOverlay renders with verbatim copy: **"Still uploading — try again in a moment."** (UI-SPEC §14 / 06-CONTEXT D-08 verbatim).
  - [ ] No play affordance; X-close still works.
- [ ] **Cross-user 404 check (security T-1.7-10):** If a dev path exists for it, simulate hitting `GET /recordings/:id/stream-url` with a `qa_status='takedown'` row or another user's ID — the server returns 404 application/problem+json (NO existence leak per Plan 06-03 D-08 + the recordings-stream-url.test.ts cases 5/6/7). Operator note: this is a backend invariant verified by Plan 06-03's Vitest matrix; on-hardware this surface isn't normally reachable, so this is a smoke-only spot-check (operator can skip if no synthetic row is available).
- [ ] **Player event-subscription cleanup:** Open Player → background the app → foreground it → close Player → repeat 3×. No memory leak / no orphan ExoPlayer instance (operator can monitor via `adb shell dumpsys meminfo ai.humynlabs.capture.apk | grep Native` — value should stabilize, not grow monotonically). Pattern enforced by Plan 06-10 `subsRef` + try/catch `.remove()` cleanup.

**§5 Acceptance:** local-MP4 playback works via `file://` source; post-verified rows stream via CloudFront-signed `presignedUrl` (`archiveState='available'`); >90-day rows show the verbatim "Archived. Contact support for retrieval." disabled overlay (`archiveState='deep-archive'`); `qa_status='pending'` rows show the verbatim "Still uploading — try again in a moment." disabled overlay (`archiveState='unavailable'`); X-close + unmount cleans up the player; no memory leak on open/close cycles.

**Re-walked-on:** YYYY-MM-DD HEAD<commit>

---

## §6 — Cross-cutting checks

- [x] **Phase-5 carry-over preserved:** _DEFERRED_ — no pending uploads existed during the walk (the only recording uploaded + verified before the walk started). Code-grep confirms the Phase 5 D-10 wiring (`pendingRows.length > 0` gate, UploadStatusChip, determinate progress fill, verified-event auto-poll, drainNowSafe tile-tap kick) is byte-for-byte preserved. To exercise visually, record a short clip with airplane mode toggled — left to a future smoke / Phase 7 cross-check.
- [x] **`__DEV__` dev affordance preserved:** Long-press on the Tasks tab heading routes to RecordingScreen — confirmed on-device 2026-05-14.
- [x] **No-hex-literals lint passes:** 60/60 tests passed.
- [x] **Mobile Vitest green:** 811/811 tests passed across 109 test files. The 3 unhandled-rejection warnings from `BatteryOptimizationScreen.tsx` were the documented baseline noise (NOT a Phase 6 regression). Two new test-side fixes landed in commit `94f8cfa`: vitest.setup.ts gained a `PanResponder` stub for the new ScrubBar drag-to-seek (commit `819fdf5`), and the HistoryScreen row-tap assertion now includes the `durationMs` route-param.
- [x] **Mobile typecheck baseline:** Exit 0 modulo the documented pre-existing `design-system/task-icons/TaskIcon.tsx → lucide-react` baseline error. No new errors.
- [x] **Backend Vitest green:** 206/206 (+2 skipped) passed. tasks-search.test.ts `beforeEach` cleanup gained a `delete(recordings)` before `delete(tasks)` (commit `94f8cfa`) — the FK `recordings_task_id_tasks_id_fk` (ON DELETE RESTRICT) was blocking the existing `delete(tasks)` once the smoke walk left a recording row in the dev DB.
- [x] **Robolectric green:** BUILD SUCCESSFUL (HumynBeepModuleTest + ThumbnailExtractorTest + HumynPlayerModuleTest all pass).
- [x] **Drizzle migrations clean:** `0 applied, 8 skipped (total 8)`. Migration 0008_tasks_name_search_includes_category.sql landed during §2 of this walk (commit `175f59d`). No schema drift.
- [x] **REQUIREMENTS.md reflects D-06 rewording:** HIST-07 / HIST-08 / HIST-09 all show the `_Reworded by Phase 6 Plan 06-03 per CONTEXT D-06_` tag.

**Re-walked-on:** 2026-05-14 HEAD `94f8cfa`

---

## §7 — Sign-off

- [x] All §1-§6 walked. Outstanding findings listed below.

**Walk-level summary (2026-05-14):**

| §   | Title                     | Status                                                                                                                                                                           |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1  | D-09 HumynBeep audibility | **DEFERRED** by owner (`feedback_d09_audibility_deferred`); Plan 06-01 instrumentation stays.                                                                                    |
| §2  | Tasks tab                 | **PASS** — 2 mid-walk fixpacks landed: migration 0008 (search includes category) + `/task-requests` JSON body.                                                                   |
| §3  | Home tab                  | **PASS** with documented caveats (HOME-10 OfflineBanner data-binding is the Plan 06-08 Known Stub → see Finding 6).                                                              |
| §4  | History tab               | **PASS** — empty state, row layout, day-grouping, filter chip, no-delete affordance all verified.                                                                                |
| §5  | Player + streaming        | **PASS** — 6-bug fixpack `819fdf5` (main-looper dispatch, NaN duration, STATE_READY emit, route-param seed, drag-to-seek, NaN-aware scrub). Two deferred items → Findings 8 + 9. |
| §6  | Cross-cutting             | **PASS** — see the 9 checked items above; test-side fixpack `94f8cfa`.                                                                                                           |

**Findings:** 14 total — see `06-COSMETIC-GAPS.md` (status table at top).

> Findings:
>
> 1. Tasks tab pull-to-refresh inert — **✅ Fixed in Plan 06-12 / `7a55e0c`.**
> 2. TaskDetailsSheet swipe-down dismiss inert — defer (cosmetic).
> 3. AlertPill placement during battery-15 % alert — non-blocking, owner directive (move below Stop Recording button).
> 4. §1 D-09 HumynBeep inaudible — DEFERRED by owner directive 2026-05-14.
> 5. Home custom date range is free-text TextInput — defer (cosmetic; needs `@react-native-community/datetimepicker` dep).
> 6. HOME-10 OfflineBanner not wired to NetworkMonitor — Plan 06-08 Known Stub; promote to a Phase 7 plan.
> 7. Pending Uploads row tap navigates to History instead of triggering `drainNowSafe` — Phase 5 follow-on (not a Phase 6 issue).
> 8. Player "View only — not downloadable." footer sticks — owner wants toast w/ 5 s fadeout; spec says persistent footer. Needs a copy / interaction decision before code lands.
> 9. Player drag-to-seek lands at byte 0 — root-caused to HumynCapture's fragmented MP4 carrying no `sidx` / `mfra` seek-index boxes. Player wiring is correct (fixpack `819fdf5`). Needs a Phase 3 follow-on plan (finalize-time remux step).
> 10. History filter pill shows two chevrons — **✅ Fixed in Plan 06-12 / `4bec668`.**
> 11. History empty state body needs a line break — **✅ Fixed in Plan 06-12 / `a8664dd`.**
> 12. Tasks — hide Upload Sample at MVP — **✅ Fixed in Plan 06-12 / `a55d943`.**
> 13. Tasks — task cards wiped by `pnpm test` — **✅ Fixed in Plan 06-12 / `10c6d26`** (`apps/api` posttest reseed hook + `WORKER_BOOTSTRAP=false` test env).
> 14. Home — second YOUR CONTRIBUTION tile has no unit label — added 2026-05-14 §7 close-out, deferred to Phase 7 / future cosmetic plan.

**Phase 6 sign-off:** **YES** — all locked acceptance items + the
owner-requested Plan 06-12 cleanup (Findings 1, 10, 11, 12, 13) green
on Pixel 10a 2026-05-14. Findings 2, 3, 5, 6, 7, 9, 14 deferred per
dispositions; Finding 8 awaits owner copy decision; Finding 4 is the
audibility deferral. Plan 06-12 commits: `7a55e0c` (PTR), `a55d943`
(Upload Sample hidden), `4bec668` (single chevron), `a8664dd` (HIST-04
line break), `10c6d26` (posttest reseed). Closeout commit lands `06-12`.

**Operator signature:** Adnaan Mohammed **Walked-on:** 2026-05-14 **Commit:** `40040fe` (initial close) → reopened `be64233` → closeout via Plan 06-12 **Device:** Pixel 10a (`5C161JEA304304`), Android 16

> **Amendments protocol (D-WAVE-09 pattern carry-over):** New COSMETIC gaps surfaced during this walk (visual nits, copy tweaks, spacing) go into a NEW file: `.planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` (create on first use). They are picked up either by Phase 7's plan-phase (it may roll them into an early plan) OR by a dedicated cleanup plan before Phase 7 starts — per memory `feedback_functionality_first_during_smoke.md`. **Never** write Phase-6 amendments back into the FROZEN Phase 4 / Phase 5 cosmetic-gaps files — those are closed.
>
> **Functional regressions** (broken behavior, spec violations, audibility / haptic silent on Pixel 10a / Android 16 in §1, archive-state envelope mis-routing the wrong overlay, etc.) are NOT cosmetic — they block §7 sign-off and get a debug session (`/gsd-debug`), not an amendment-file entry.
