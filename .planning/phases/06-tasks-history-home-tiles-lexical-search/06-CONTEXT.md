# Phase 6: Tasks, History, Home Tiles & Lexical Search — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 lights up the three previously placeholder user surfaces and the data underneath them:

1. **Tasks** — full 65-task catalog from `task-taxonomy.md` across 10 categories, horizontally-scrollable per-category pills, always-visible 200 ms-debounced server-side **lexical** task search (`ts_vector` + GIN + pg_trgm fuzzy fallback), Task details sheet with Universal-rules block + per-task instructions + Start Recording CTA, and the Send Request form (name 3–80 / description 10–240 / category+Other / Indoor/Outdoor / optional ≤30 s ≤50 MB sample video). `<TaskIcon>` from `design-system/task-icons/` (already authored) wires up to the live Tasks screen.
2. **Home** — first-time empty hero + zero-state tiles AND returning hero (lifetime contribution numeric, task count, Start Recording CTA) + real-data tiles. Recording-duration + tasks-recorded tiles toggle across **today / yesterday / this week / this month / all time / custom range** (canonical six). Pending Uploads tile gains its `count > 0` visibility logic + pull-to-refresh fetching `/contributions` + non-blocking offline banner (Phase-5 D-10 explicitly punted these to Phase 6).
3. **History** — every successful recording (≥60 s) grouped by day newest-first, filterable across the same six time-range options, rows = filename + duration + task name + recorded-at timestamp + upload-state chip + first-frame thumbnail; **in-app fullscreen player** playing local MP4s from disk AND **server-streaming any non-discarded recording** (verified, in-flight, hash-mismatch) the user no longer has locally, with the >90-day Deep-Archive edge shown but disabled.
4. **Backend** — gut `/tasks/search` from RRF hybrid to lexical-only + pg_trgm fuzzy fallback (the pgvector/embedder code stays in the tree, becomes dead at MVP, lives for §v2 SEARCH-V2-01); extend `/contributions/timeseries` and `/recordings` with optional `start`/`end` ISO date params (the six-option range model is computed client-side from `Date.now()` and passed through); mint a new `GET /recordings/:id/stream-url` for player streaming; update REQUIREMENTS to reflect the streaming-in-MVP shift.
5. **Wave 1 — Phase 5 carry-over cleanup** (Phase-3-pattern Wave 1): `HumynBeep` SoundPool tones (520 Hz / 440→560→680 Hz) + `Vibrator` haptics silent on Pixel 10a / Android 16 — instrument the SoundPool + Vibrator paths on cue invocation, restore audibility/haptic feedback. Folded in per ROADMAP §Phase 6 carry-over. **Not** a Phase 5 functional defect (voice cues + visual cues + the graceful self-stop all fire correctly) — observability degradation only.

**Out of scope this phase** (deferred to follow-on milestones):

- iOS player parity (deferred with the rest of the iOS native modules — §v2 IOS-01..07).
- pgvector + RRF hybrid search surfaced on the client (§v2 SEARCH-V2-01).
- Streaming UI for Deep-Archive (>90 d) recordings — disabled-with-message at MVP; the async-thaw flow is a §v2 / Phase-8 question.
- Pre-payout fraud dashboard / IMU-liveness check / FRAUD-05/06 (already in §v2).
- Per-OEM battery-optimization device sweep (Phase 8 carry-over from Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Lexical search wiring (TASK-03, TASK-10)

- **D-01:** **Gut `/tasks/search` to lexical-only.** Replace the existing RRF hybrid CTE (`apps/api/src/routes/tasks/search.ts:15–116`) with the `lexical_ranks` CTE alone, ordered by `ts_rank(name_search, plainto_tsquery('english', $q)) DESC`. The 384-float pgvector path + the embedder.ts dep + the HNSW index stay shipped but unreferenced — §v2 (SEARCH-V2-01) revives them via git history.
- **D-01a:** Response field `rrf_score` → `lex_score` (number) in `TasksSearchResponseSchema` (`shared/types/`). Wire-breaking but the mobile client doesn't consume `/tasks/search` yet (Phase 6 is the first consumer), so cheap.
- **D-02:** **Fuzzy fallback = `pg_trgm` similarity at threshold 0.3.** When the `ts_vector` query returns zero rows, retry with `name % $q OR description % $q` ordered by `greatest(similarity(name,$q), similarity(description,$q))`. Add `CREATE EXTENSION IF NOT EXISTS pg_trgm` in a new migration (pg_trgm is in `postgres:17`); GIN trigram index on `tasks.name` is optional given the 65-row catalog. Catches typos (`sweepng` → `sweeping`) without an embedder.
- **D-02a:** TASK-03 wording matches the implementation — `ts_vector` + GIN + pg_trgm trigram fuzzy fallback. No REQUIREMENTS rewording needed (TASK-03 already says "fuzzy fallback"; this just names the mechanism).

### Time-range model (HOME-03, HOME-04, HIST-03)

- **D-03:** **Extend `/contributions/timeseries` and `/recordings` with optional `start` + `end` (ISO date) query params**, keeping the existing `range` enum (`7d|30d|90d|all`) as a convenience alias. When `start`/`end` are present, they take precedence and `range` is ignored. Client computes start/end from a single `Date.now()` for the five named windows (today / yesterday / this week / this month / all); custom-range passes the explicit dates from the §16b date-input layer.
- **D-03a:** Home tiles render a **single aggregate** (sum of `duration_ms`, distinct-task count) for the picked range; whether tiles read a new thin aggregate endpoint (`/contributions/range?start=&end=`) OR sum the daily buckets returned by `/contributions/timeseries` is **researcher/planner's call** — sum-locally is simpler if the bucket-by-day query is cheap on the prod-shape table; a dedicated aggregate endpoint avoids transferring 30+ buckets just to render a tile number.
- **D-03b:** "This week" and "this month" use the **device's local timezone** (not UTC), with explicit start-of-week / start-of-month computed on the client (the §v1 user base is India + Brazil; both have stable single-timezone-per-locale). The `start`/`end` ISO dates are sent as `YYYY-MM-DD` at local midnight, converted to timestamptz server-side using the request's `Accept-Timezone` header (if absent, the existing implicit UTC). Planner should add the header (or accept a `tz=` query) and validate against IANA names — explicit edge in planning.
- **D-03c:** Custom-range validation in §16b stays client-side: missing dates, inverted range (From > To), `max=today`. Existing design-spec §16b rules.

### History data + thumbnails (HIST-01..11, design-spec §13/§14)

- **D-04:** **Backend recordings is the truth-source for the History row list; a local MMKV ledger overlays filename + thumbnail-path keyed by `recording_id`.** On re-install, rows survive (re-fetched from `GET /recordings?start=&end=`), but the local ledger is empty — the thumbnail slot renders the token-color gradient + first letter of the task name fallback (same as the per-row no-thumb fallback), and tap-to-play uses the stream-URL path (not the lost local file). Filename in the row falls back to a derived form `${YYYYMMDD_HHMMSS_NNN}.mp4` from the row's `created_at` ULID portion if the ledger entry is missing.
- **D-04a:** No app-launch reconcile sweep beyond what Phase 5 already runs (`uploadReconcile.ts` reads `/recordings/verified-ids`). The local ledger gets a row added in `HumynUpload`'s enqueue path; rows whose `recording_id` is no longer in `GET /recordings` (server-side `takedown` / `rejected` / `delete account`) age out via an opportunistic cleanup on cold start (compare ledger keys to the latest `/recordings?range=all` page — best-effort, not load-bearing).
- **D-05:** **Thumbnail = native MediaMetadataRetriever first-I-frame extraction at recording-stop time**, persisted to `filesDir/thumbs/${base}.thumb.jpg` (a **separate** directory from the MP4, so it survives the post-`verified` MP4 delete). Path stored in the local MMKV ledger keyed by `recording_id`. Approx. 20–50 ms per recording; runs after the metadata-JSON SHA-256 finalize, doesn't gate upload enqueue.
- **D-05a:** Where the thumbnail extraction code physically lives — extending `HumynCapture`'s `FinalizeWorker` vs. a new tiny `HumynThumbnail` native helper called by `HumynUpload` at enqueue time vs. inline inside `HumynUpload` — is **planner's call**. Extending FinalizeWorker is the smallest-blast-radius option; a dedicated module mirrors the other hand-rolled native pattern.
- **D-05b:** Crash-recovered segments don't have thumbnails (the post-30 s force-quit fragment is now **discarded** per Phase 5 D-03, so there's no recovered upload-able segment to thumbnail). The thumbnail slot renders the gradient + first-letter fallback in this edge — but per D-03 it shouldn't fire at all.

### In-app player (HIST-07, HIST-08, HIST-09)

- **D-06:** **Scope expansion — the player plays ALL non-discarded recordings, not just locally-resident ones.** Local MP4 still on disk → plays from `file://`. Verified-and-deleted-local OR in-flight (`pending` / `uploaded` / `hash-mismatch`) → streams via the new presigned-GET endpoint. Recordings older than 90 days (Deep Archive per the Phase-1 S3 lifecycle) → row visible in History but tap shows the disabled "Archived" message. **REQUIREMENTS rewording required during planning** (HIST-07/08/09 + design-spec §13/§14):
  - HIST-07 reworded: "Tap thumbnail opens the in-app fullscreen player (play / pause / seek only — no download / share / export). Plays from the local MP4 when present; otherwise streams via the server."
  - HIST-08 reworded: "Once the `verified` event clears the local MP4, the thumbnail remains and tap streams from the server. If the recording is in Deep Archive (>90 d), tap shows 'This recording has been archived. Contact support for retrieval.'"
  - HIST-09 reworded (or removed): "Streaming uploaded recordings back from the server is **in MVP** for Phase 6, via a short-TTL presigned GET. Deep-Archive (>90 d) thawing is §v2 / Phase 8."
- **D-07:** **Hand-rolled `HumynPlayer` Kotlin native module on `androidx.media3:media3-exoplayer:1.10.0`** (same media3 minor we already use in HumynCapture's muxer — single pin to maintain). `<HumynPlayerView>` = TextureView surface; JS bridge methods `prepare(uri)` / `play()` / `pause()` / `seekTo(ms)`; events `onProgress({positionMs,bufferedMs,durationMs})` / `onBuffer({buffering})` / `onEnd()` / `onError({code,msg})`. ~150–200 LOC. Source switches between local `file://` and remote `https://` presigned URL — same code path, ExoPlayer's `DefaultDataSource` handles both natively.
- **D-07a:** No iOS counterpart this phase (defer with the rest of iOS — §v2 IOS-01..07). The JS bridge stub is wired to Android only.
- **D-07b:** Player surface respects design-spec §14: portrait-locked screen, black `#000` background, X-close (top-left → History), centered task name, lock badge on top-right (cosmetic — playback is always local-or-streamed-presigned, the badge is iconographic), 64×64 centered play overlay, 4 px scrub bar, mono current/total time. Footer "View only — not downloadable." Owner deviation surface is none — copy is verbatim §14.

### Stream-URL endpoint (Claude's discretion lock)

- **D-08:** **New route `GET /recordings/:id/stream-url`** (per Claude's discretion lock 2026-05-14):
  - Auth: `requireAuth` + `WHERE user_id = $sub AND qa_status NOT IN ('takedown','rejected','pending')`.
  - Body: `{ presignedUrl: string|null, expiresAt: ISO-8601, archiveState: 'available'|'deep-archive'|'unavailable' }`.
  - `archiveState='deep-archive'` is derived from `created_at` (>90 d → deep-archive — matches the Phase 1 lifecycle without an S3 HeadObject); when deep-archive, `presignedUrl: null` and the client renders the disabled state.
  - `archiveState='unavailable'` covers the `pending` case (no S3 object yet) — same `presignedUrl: null`; client tap shows "Still uploading — try again in a moment."
  - TTL = 5 min (`PRESIGNED_TTL_SECONDS` from `apps/api/src/lib/s3-client.ts`).
  - Per-user rate-limit 60/min using the existing `keyGenerator` pattern from `/contributions`.

### Phase 5 carry-over (Wave 1)

- **D-09:** **`HumynBeep` SoundPool tones + `Vibrator` haptics restoration** is **Wave 1** of Phase 6, before any new Tasks/Home/History work (carries the Phase 5 `04-COSMETIC-GAPS.md` cleanup ordering, but **without** the human-gate-between-waves enforcement — see D-09b). Scope:
  - (a) Instrument `HumynBeep.playTone` and the Vibrator call sites — log SoundPool load/play return values + the Vibrator service availability on cue invocation; verify the audio focus + stream type + volume routing on Android 16 / Pixel 10a.
  - (b) Restore audibility — likely a SoundPool `setAudioAttributes` / stream-type issue on Android 16, or a Vibrator `VibrationEffect` API-level mismatch. Owner observed silence at MAX media volume during the Phase-5 Item-5 walk; the en-US-female TTS path is audible (different stream).
  - Trail: `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` D-06; STATE.md 2026-05-13 Phase-5 close-out.
- **D-09a:** **Not** a Phase 5 functional defect — voice + visual cues + the graceful self-stop all fire correctly during battery-low / thermal abort, so capture / upload are unaffected. The cosmetic restoration is observability for the operator-experience, not a capture-spec regression.
- **D-09b (owner directive 2026-05-14):** **Wave 1 does NOT gate Wave 2.** The "Wave 1 cosmetic-fixup blocks downstream feature waves with a manual operator walk" pattern from Phase 3 (`project_phase3_wave1_cosmetic_fixup.md`) and Phase 5 (`project_phase5_wave1_cosmetic_fixup.md`) is **explicitly relaxed for Phase 6**. Execution flows Wave 1 → Wave 2 → Wave 3 → Wave 4 → … → Wave n automatically, with **no human approval between waves**. Wave 1's on-hardware audibility verdict is captured in `06-MANUAL-SMOKE.md §1` (authored by Plan 06-11) and is **BLOCKING for phase sign-off, NOT for Wave 2 entry** — the operator walks it once at end-of-phase alongside every other Phase 6 success-criterion verification (Tasks pills + search, Home tiles, History rows, Player, Send Request, pull-to-refresh + offline). The Wave 1 + Wave 2/3 file-modification sets are disjoint (Wave 1: mobile Kotlin/JS audio + manifest; Waves 2/3: backend routes + Drizzle migrations + shared types) — there is no functional dependency to defend, so gating wastes wall-clock for no integrity gain. Plan 06-11 stays `autonomous: false` (the manual-walk verdict at the very end of the phase remains owner-only); every other plan in Phase 6 (06-01 through 06-10) executes autonomously in normal wave-sequential order.
  - **What stays intact (do NOT skip):** every standard GSD automated gate runs as normal between every wave — intra-wave overlap check, per-plan worktree, pre-wave dependency check, post-wave build & test, post-merge tracking update, code review, regression, schema-drift, codebase-drift, verifier. Per-plan `<verify>` blocks and `<acceptance_criteria>` are unchanged. Plan 06-11's `<task type="checkpoint">` owner-only walk at end-of-phase is also unchanged. **Only the human approval / `checkpoint:human-verify` step between Wave 1 and Wave 2 is removed.**

### Send Request UX (TASK-08, TASK-09)

- **D-10:** TASK-08 form submits to the existing Phase 1 `POST /task-requests` endpoint (already shipped — see `apps/api/src/routes/tasks/create-request.ts`). TASK-09 stands: no status surfaced to the user; submission success shows an inline toast `"Request sent. We'll review and add it to your list."` and closes the sheet. Submission error: in-sheet banner `"Couldn't send. Try again."` with a retry CTA. The optional ≤30 s ≤50 MB sample video uploads through the existing `@fastify/multipart` route — client-side size + duration validation before the network call.

### Claude's Discretion

- **The "this week" / "this month" timezone wire format** (Accept-Timezone header vs `tz=` query param vs implicit UTC + server-side `created_at::date AT TIME ZONE 'Asia/Kolkata'`-style coercion). Pick the cleanest server-side approach during research; document the choice.
- **Whether Home tiles read a new thin `/contributions/range?start=&end=` aggregate route or sum the daily buckets of `/contributions/timeseries?start=&end=` client-side.** Sum-locally is simpler and avoids a new route; a dedicated aggregate saves transferring N buckets. Pick the cleaner option after measuring the SQL cost on the seeded prod-shape table.
- **Where the thumbnail extraction Kotlin code physically lives** (extend `HumynCapture`'s `FinalizeWorker` vs. new `HumynThumbnail` native helper vs. inline in `HumynUpload`). Smallest-blast-radius is `FinalizeWorker`; the dedicated module mirrors the existing hand-rolled-native pattern.
- **The local MMKV ledger schema** (`thumbnailLedger.{recording_id}.{path,filename,createdAt}` blob vs. a per-key MMKV stash). MMKV's `setObject` blob is simpler; per-key is slightly faster to iterate.
- **Whether the player surface auto-rotates to landscape during fullscreen** or stays portrait with letterboxing (design-spec §14 implies portrait + letterboxed; HIST-07 says "fullscreen" without specifying orientation). Portrait + letterboxed is what design-spec dictates verbatim and what avoids the orientation-lock dance.
- **The exact `pg_trgm` similarity threshold** (D-02 says 0.3 — researcher can re-tune on the 65-task fixture if 0.3 recalls too aggressively).
- **The exact REQUIREMENTS-rewording sequence for HIST-07/08/09** — the planner does this as part of the Phase-6 plan and commits the edits alongside the implementation; do not pre-edit REQUIREMENTS.md before planning starts.

### Folded Todos

None — no pending-todo matches for Phase 6 scope (the Phase-5 carry-over comes from ROADMAP, not the todo system).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec / domain / design source-of-truth

- `task-taxonomy.md` (repo root) — the 65-task table across 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby); Universal-rules header (`front_hand` / `videocam` / `lightbulb` / `apps` + the four canonical labels); per-task max-3-bullet instructions. Source of truth for TASK-01 / TASK-04 / TASK-06 / TASK-07.
- `prototype.html` (repo root) — locked visual reference for Home (§9) / Tasks (§10) / Task details sheet (§11) / Send Request sheet (§12) / History (§13) / Player (§14) / Filter sheet (§16). The pills / cards / chips / sheet structure is copied verbatim.
- `design-spec.md §9` — Home (first-time empty + returning + filter sheet states); `§10` — Tasks (pills + search + grid); `§11` — Task details sheet (chip + Universal-rules block + per-task instructions); `§12` — Send Request sheet (form fields + validation); `§13` — History (filter chip + day groups + row); `§14` — Player (X-close + lock badge + scrub bar + footer); `§16` — Filter sheet (six options + custom-range layer); `§20` — duration formatter / mono-font rules; `§21.7` — RESOLVED upload-queue chip mapping (Phase-5 D-10 already locked).
- `engineering-handoff.md §4.7` — react-native-config flavor handling; `§6.3` — en-US-female TTS (owner deviation logged); `§11` — Firebase Analytics event funnel including `tasks_*` / `history_*` / `home_*` event names.
- `CLAUDE.md` — project rules: `Files never re-encoded` (the player streams S3 bytes back, the worker re-hashes them; no re-encode at any point); the Tech-Stack pins; the descope banners; the `Do NOT Use → Redis at MVP` carve-out (lexical search uses Postgres, not Redis).

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — TASK-01..TASK-10, HOME-01..HOME-06 / HOME-09 / HOME-10, HIST-01..HIST-11 (HOME-07/HOME-08 already shipped Phase 2); §v2 SEARCH-V2-01 (the pgvector/RRF hybrid layer this phase descopes the client surface from). **HIST-07/HIST-08/HIST-09 to be reworded by the planner** per D-06.
- `.planning/ROADMAP.md` — Phase 6 section (goal + 5 success criteria); the Phase 6 carry-over banner (`HumynBeep` SoundPool / Vibrator restore — D-09); the Phase 5 / Phase 6 split for the upload-queue screen (Phase 5 ships the queue, Phase 6 owns the Home-tile `count>0` visibility + pull-to-refresh + offline banner).
- `.planning/STATE.md` — Phase 5 close-out 2026-05-13 (the `HumynBeep` cosmetic finding); the Roadmap-Evolution descope trail (2026-05-11 MVP-descope of pgvector/RRF + iOS + Play-Store rollout); the Phase-1/2/3/4/5 close-outs that establish the patterns this phase mirrors.

### Phase 1 backend (already shipped — Phase 6 modifies / extends)

- `apps/api/src/routes/tasks/search.ts` — the current RRF hybrid `/tasks/search` route (`vector_ranks` + `lexical_ranks` + FULL OUTER JOIN with k=60). **D-01 guts this to lexical-only.**
- `apps/api/src/routes/tasks/list.ts` — `/tasks` paginated list (cursor / category / setting filters); the Tasks-screen All-pill path.
- `apps/api/src/routes/tasks/create-request.ts` — `/task-requests` POST already shipped; the Send Request sheet's submit target (D-10).
- `apps/api/src/routes/tasks/get.ts` — `/tasks/:id` detail; powers the Task details sheet.
- `apps/api/src/routes/contributions/list.ts` — `/contributions` lifetime aggregate (Profile + Home returning-hero today's tile baseline); `apps/api/src/routes/contributions/timeseries.ts` — `/contributions/timeseries?range=7d|30d|90d`. **D-03 extends both with optional `start` / `end` ISO dates.**
- `apps/api/src/routes/recordings/list.ts` — `/recordings` paginated list (`7d|30d|90d|all` + cursor + `qa_status NOT 'takedown'` filter). **D-03 extends with `start` / `end`.** Powers the History row list.
- `apps/api/src/routes/recordings/get.ts` — `/recordings/:id` detail. Used by the player streaming path for metadata, but the new presigned-GET stream URL lives at a dedicated route per D-08.
- `apps/api/src/db/schema.ts` — `recordings` table (`created_at`, `duration_ms`, `qa_status`, `task_id`, `s3_key_video` etc.); `tasks` table (`name_search` tsvector + GIN index; ix already in place). **D-02 adds `CREATE EXTENSION pg_trgm` + (optional) GIN trigram index on tasks.name in a new migration.**
- `apps/api/src/lib/s3-client.ts` — `RECORDINGS_BUCKET`, `recordingKeys(...)`, `PRESIGNED_TTL_SECONDS` (5 min); the AWS SDK v3 presigner. The new `/recordings/:id/stream-url` route reuses these.
- `apps/api/src/plugins/auth.ts` (`requireAuth`, JWT sub), `apps/api/src/plugins/rate-limit.ts` (the `keyGenerator` pattern via best-effort `jwtVerify()`), `apps/api/src/lib/problem-detail.ts` — the patterns the new endpoints mirror.
- `shared/types/src/tasks.ts` — `TasksSearchQuerySchema` / `TasksSearchResponseSchema` (`rrf_score` → `lex_score` per D-01a); `TasksListQuerySchema` etc.
- `shared/types/src/contributions.ts` — `ContributionsTimeseriesQuerySchema` (range enum) / `ContributionsLifetimeSchema`. **D-03 adds optional `start`/`end` to the query schema.**
- `apps/api/src/routes/recordings/schemas.ts` — `RecordingsListQuerySchema` (range enum + cursor + limit). **D-03 extends with `start`/`end`.**

### Phase 2 mobile shell (already shipped — Phase 6 replaces placeholders)

- `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` — the active Home screen (Phase 2 shell + Phase 5 Pending-Uploads section). Phase 6 adds the empty-hero / returning-hero / contribution tile pair / filter sheet wiring; preserves the Phase 5 pending-uploads section.
- `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` — replaced by a real `TasksScreen.tsx`. The `__DEV__` long-press debug affordance stays (or moves to a dev-only sub-route).
- `apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx` — replaced by a real `HistoryScreen.tsx`.
- `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` (Phase 5 D-10) — referenced from the Home tile (already wired); no Phase 6 changes here beyond verifying the deep-link entry still works.
- `apps/mobile/src/navigation/RootNativeStack.tsx` + `MainTabs.tsx` — HOME-07/08 already locked structurally; the new `Player` route lands in `RootNativeStack` (not as a tab) to preserve §13 row → §14 player navigation.
- `apps/mobile/src/components/TopBar.tsx` + `apps/mobile/src/hooks/useTabTopBarProps.ts` — reused across all three tabs (avatar-to-Profile path already established Pattern 71).
- `apps/mobile/src/lib/durationFormat.ts` — HOME-06 / REC-04 formatter already shipped; reused on tiles + History row + Profile.
- `apps/mobile/src/state/appStore.ts` (Zustand) + `apps/mobile/src/state/mmkv.ts` — the existing state surface; new state: `homeRange`, `historyRange`, `pendingThumbnailLedger`. The MMKV thumbnail ledger lands here.

### Design-system / icons

- `design-system/task-icons/TaskIcon.tsx` + `design-system/task-icons/mapping.ts` + `design-system/task-icons/index.ts` — the 65-task lucide icon registry (`<TaskIcon task={slug} size={28} strokeWidth={1.75} />`); already-authored, drop-in for Phase 6.
- `design-system/task-icons/README.md` — the per-task-slug ↔ icon-name mapping (truth-source for the seed JSON consumed by the Phase 1 task seeder).

### Mobile capture/upload (Phases 3–5 — Phase 6 hooks into these)

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` + `apps/mobile/.../capture/FinalizeWorker.kt` — the finalize path; **D-05 extends here (or via a dedicated `HumynThumbnail` module) to extract the first-frame thumbnail**.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/audiocue/HumynBeep.kt` — the SoundPool wiring (**D-09 Wave 1** instrumentation + restoration target). The Vibrator call sites in `useRecordingLifecycle.ts` + the native side.
- `apps/mobile/src/native/HumynUpload.ts` + the Kotlin `HumynUploadModule` — the upload queue (Phase 5); the local ledger may piggy-back on the existing queue rows or live in MMKV under a sibling key. The thumbnail path lands here at enqueue time per D-05a.
- `apps/mobile/src/services/uploadReconcile.ts` — the cold-start `/recordings/verified-ids` sweep; reused. D-04a adds an opportunistic ledger cleanup on cold start (best-effort, not load-bearing).

### Research (read for the [research]-tagged requirements)

- `.planning/research/STACK.md` — `media3-exoplayer` already pinned at 1.10.0 (HumynCapture's muxer uses media3); ExoPlayer is the same minor — no new pin.
- `.planning/research/FEATURES.md` + `.planning/research/PITFALLS.md` — Android 16 / Pixel 10a SoundPool + Vibrator quirks (relevant to D-09); media3 ExoPlayer HEVC playback edges.
- `idea-brief.md §5.x` (Home + Tasks + History UX); `§6.5/§6.7/§8.3` (drift methodology — irrelevant here but the metadata JSON schema the player+history both read is in §8.3); `§13` (TTS — owner-deviated to en-US-female, irrelevant for Phase 6 but for the awareness of cue-voice owner deviation).
- `IMU-FORMAT.md` — the CSV format the worker re-hashes; not touched by Phase 6 but cited because the player path crosses paths with the upload pipeline.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`design-system/task-icons/`** — already-authored 65-task `<TaskIcon>` + lucide mapping, drop-in for the Tasks grid + Task details sheet. No new design tokens or icon mapping work.
- **`apps/mobile/src/lib/durationFormat.ts`** (HOME-06 formatter, shipped Phase 4) — reused on tiles + History rows + Profile. Same `<1m → Xs`, `<1h → Xm`, `≥1h → Xh Ym` floored-to-previous-minute spec.
- **`apps/mobile/src/components/UploadStatusChip.tsx`** (Phase 5 D-10) — chip variants `chip-progress`, `chip-failed`, `chip-success`, `chip-verifying`, `chip-paused-no-wifi`. History row chip mapping aligns: `verified` → success, `uploading|pending|uploaded` → progress, `hash-mismatch` → failed-with-retry, paused → paused-no-wifi. **No new chip variant** needed.
- **`apps/api/src/routes/tasks/search.ts`** — gut RRF, keep lexical CTE structure. The `keyGenerator` + auth + Pattern-22 patterns already in place (the route is intentionally public — anonymous-tier rate-limit applies). Same is true for `apps/api/src/routes/tasks/list.ts`.
- **`apps/api/src/routes/recordings/get.ts`** — pattern reference for the new `GET /recordings/:id/stream-url` (auth + user-id filter + qa_status filter).
- **`apps/api/src/lib/s3-client.ts`** (`PRESIGNED_TTL_SECONDS`, `recordingKeys`, S3 client) — direct reuse for `getSignedUrl(GetObjectCommand)` on the new stream-url route.
- **`apps/mobile/src/components/Toast.tsx`** (Phase 4) — reused for Send Request success + error notices (`showToast(text, durationMs)`).
- **The `keyGenerator` per-user rate-limit pattern** from `apps/api/src/routes/contributions/list.ts` — copy verbatim for the new stream-url + extended endpoints.
- **`apps/mobile/src/state/appStore.ts` (Zustand) + `apps/mobile/src/state/mmkv.ts`** — `pendingThumbnailLedger` lands as a new MMKV-persisted slice, hydrated via the existing `hydrate.ts`. The MMKV key naming follows Phase 4's `practiceDoneKey(sub)` pattern.

### Established Patterns

- **Server never reads recording bytes** (CLAUDE.md file-fidelity rule) — the new `/recordings/:id/stream-url` mints a presigned GET, the **client** (player) reads bytes; the server still never touches them. Phase-5 worker is the lone bytes-read exception, unchanged here.
- **Pattern 22 (STATE.md)** — don't declare `response.201` schemas on routes that also return problem-detail 400s. Applies to all new Phase 6 routes (stream-url, extended timeseries, lexical search).
- **Pattern 28 — Fastify radix-tree precedence** — `/tasks/search` registers BEFORE `/tasks/:id` (already true in `apps/api/src/routes/tasks/index.ts`). No new precedence pitfall.
- **Wave-1-first cleanup** (Phase 3 + Phase 5) — Phase 6 Wave 1 = the `HumynBeep` SoundPool / Vibrator restore (D-09), then the new feature waves. **Note (D-09b):** the Phase 3/5 _manual-gate-between-waves_ enforcement is **NOT** carried over — Phase 6 runs Wave 1 → Wave 2 → … → Wave n automatically; Wave 1's on-hardware audibility verdict is collected in `06-MANUAL-SMOKE.md §1` at end-of-phase, not between waves.
- **Hand-rolled native modules** — `HumynCapture`, `HumynHandDetector`, `HumynGateCamera`, `HumynUpload`, `HumynBeep`, `HumynBattery`, `HumynPhoneState`, `HumynUpdater` are all hand-rolled. `HumynPlayer` joins the family (D-07) — same `MainApplication` registration, same JS-bridge stub-then-body pattern.
- **Per-user rate-limit keying** via best-effort `jwtVerify()` in the `keyGenerator` — pattern in `/contributions`. Reuse for the new stream-url route (60/min keyed by `user:${sub}`, fallback `ip:${req.ip}`).
- **Local-state-survives-restart via MMKV** — Phase 4 practice flag, Phase 5 upload queue. The thumbnail ledger follows the same pattern.
- **The `_events` envelope onSend hook** (Phase 5 VERIFY-05) — piggy-backs `verified` / `re-upload` events on every authenticated response. Phase 6 doesn't add new event types; the History rows passively re-render when `qa_status` flips via the existing channel.

### Integration Points

- `TasksScreen` ← `GET /tasks` (list, with category filter), `GET /tasks/search?q=` (lexical), `POST /task-requests` (send-request submit).
- `TaskDetailsSheet` ← `GET /tasks/:id` (cached from list-row data when possible).
- `HomeScreen` ← `GET /contributions?start=&end=` (or sum-bucket variant per D-03a) + `GET /contributions` lifetime baseline + the existing `HumynUpload.onUploadQueueChanged` (Phase 5 D-10 wiring) for the Pending Uploads tile real-rows.
- `HistoryScreen` ← `GET /recordings?start=&end=` (paginated by cursor) + the local MMKV thumbnail ledger overlay (D-04 / D-05) + the `_events` envelope drive `qa_status` chip flips.
- `PlayerScreen` ← decides local-vs-remote source from the local ledger + `qa_status`: local MP4 if `filesDir/<base>.mp4` exists, else `GET /recordings/:id/stream-url` → set source URL on `HumynPlayer.prepare(uri)`.
- `HumynPlayer` (new) → `MainApplication.onCreate` registration; JS bridge in `apps/mobile/src/native/HumynPlayer.ts`; `<HumynPlayerView>` host in `PlayerScreen.tsx`.
- `FinalizeWorker` (or new `HumynThumbnail`) — extends the finalize path to write `filesDir/thumbs/${base}.thumb.jpg`; the ledger entry lands in MMKV via the same path that enqueues the upload (`HumynUpload.enqueue(...)`).
- `HumynBeep` + `Vibrator` (D-09 Wave 1) — touches `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/audiocue/HumynBeep.kt` + the lifecycle hook call sites in `apps/mobile/src/hooks/useRecordingLifecycle.ts`. No effect on the capture-spec critical path.

</code_context>

<specifics>
## Specific Ideas

- **"Play all the videos (except the discarded ones)."** Owner's words. The streaming-from-server scope expansion is load-bearing — HIST-07/08/09 + design-spec §13/§14 need rewording during planning. Local copy plays locally when present; otherwise stream from a new presigned-GET; >90 d Deep-Archive rows visible but disabled.
- **"pg_trgm at threshold 0.3."** Owner-picked the fuzzy fallback (D-02) without a research phase — researcher can re-tune on the 65-row fixture if 0.3 over-recalls.
- **"Extend the existing endpoints with start/end ISO dates."** Owner explicitly rejected the "pull-all-and-aggregate-client-side" path; backend stays the truth for time-range filters.
- **"Backend recordings is the truth + a local overlay."** Owner picked the cleanest re-install-survival model (D-04).
- **"Hand-rolled HumynPlayer."** Owner picked hand-rolled over `react-native-video` (D-07) — matches the rest of the native-module pattern; no new RN dep.
- **"Show but disable for Deep Archive."** Owner picked the minimal-fuss edge handling — no async thaw flow at MVP, no S3 lifecycle edit. The 'Archived' message lives in the player path.
- **Phase 5 carry-over folded as Wave 1.** Per ROADMAP carry-over; carries Phase 3/5's Wave-1-first _ordering_ but **explicitly NOT** the manual-gate-between-waves enforcement (D-09b, owner 2026-05-14): Wave 1 → 2 → … → n executes automatically; the audibility/haptic on-hardware verdict is captured in `06-MANUAL-SMOKE.md §1` at end-of-phase. Audibility/haptic restore is observability not a capture-spec issue.

</specifics>

<deferred>
## Deferred Ideas

- **Server-side semantic / pgvector + RRF hybrid search surfaced on the client** — §v2 SEARCH-V2-01. The backend ships the hybrid CTE today; Phase 6 just stops calling it. §v2 flips the client back over and possibly resurfaces.
- **Async thaw flow for Deep-Archive (>90 d) recordings.** Phase 6 shows the row but disables the tap with the 'Archived' message. The actual `restore-archive` S3 call + the asynchronous wait + the "ready in 12–48 hours, tap to be notified" UX is §v2 / Phase 8 territory.
- **iOS player parity (`HumynPlayerIOS` / AVPlayer / iOS native module).** Deferred with the rest of iOS native modules — §v2 IOS-01..07.
- **OEM battery-optimization device sweep** (Xiaomi MIUI / Oppo ColorOS / Vivo FunTouch / Samsung OneUI) — already folded into Phase 8 per Phase 5 close-out.
- **Per-OEM SoundPool / Vibrator routing nuances** beyond Pixel 10a / Android 16. Phase 6 Wave 1 restores audibility on the test device; broad-fleet OEM-specific fixes (if any) are Phase 8 observability work.
- **A "verifying — try again in a moment" auto-retry for streaming a `pending` row.** Phase 6 just shows the message; auto-retry-on-status-change is §v2 polish.
- **History row deletion / re-record / sharing.** Locked OUT of MVP by HIST-10/HIST-07 ("View only — not downloadable.").
- **Search results sort options** (date / popularity / category-weighted). MVP is lex-score DESC only; sort options are §v2.
- **Pull-to-refresh on the Tasks screen.** Phase 6 ships pull-to-refresh on Home only (HOME-09 [research]); Tasks pulls on category-pill tap. Tasks PTR is §v2 polish.
- **A "your contribution week-on-week" trend tile on Profile.** Out-of-scope for Phase 6; Profile shipped Phase 2.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 6 scope.

</deferred>

---

_Phase: 6-tasks-history-home-tiles-lexical-search_
_Context gathered: 2026-05-14_
