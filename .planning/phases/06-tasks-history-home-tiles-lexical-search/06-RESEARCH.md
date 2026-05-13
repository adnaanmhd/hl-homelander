# Phase 6: Tasks, History, Home Tiles & Lexical Search — Research

**Researched:** 2026-05-14
**Domain:** Mobile UI (Tasks/Home/History), backend lexical search & range filters, in-app HEVC player (media3 ExoPlayer + presigned-GET), thumbnail extraction, Phase-5 Wave-1 SoundPool/Vibrator restore.
**Confidence:** HIGH for stack, schema, and architecture (everything is in-tree and verified); MEDIUM-HIGH for the D-08 stream-URL contract (must reconcile with the Phase-1 CloudFront-signed path already in `/recordings/:id`); MEDIUM for D-09 root cause (cannot be confirmed without Pixel 10a / Android 16 device).

---

## Summary

Phase 6 is a UI-heavy phase that lights up three previously placeholder tabs and one new full-screen route (`Player`), backed by surgical backend edits — not new services. The 65-task catalog and contributions pipeline are already in the database with seed data and triggers; what's missing is the client wiring, three small endpoint extensions, and one new endpoint. The in-app player is a hand-rolled Kotlin native module (`HumynPlayer`) on `androidx.media3:media3-exoplayer:1.10.0` — the same media3 minor already in the tree via `media3-muxer`, so no new pin to maintain. Thumbnail generation is `android.media.MediaMetadataRetriever` with `OPTION_CLOSEST_SYNC` at `timeUs=0` against the just-finalized MP4 — no new dependency. Wave 1 is the Phase-5 carry-over `HumynBeep` SoundPool + `Vibrator` instrumentation/restore on Android 16 / Pixel 10a (D-09).

**Primary recommendation:** Treat this as a 5-wave phase. **Wave 1** = D-09 cleanup (SoundPool `USAGE_ASSISTANCE_SONIFICATION` → `USAGE_MEDIA` flip + `VIBRATE` manifest audit + Robolectric coverage). **Wave 2** = three thin backend changes (gut `/tasks/search` to lexical-only + pg_trgm fallback in a 0007 migration; extend `/recordings` and `/contributions/timeseries` with `start`/`end`; mint `GET /recordings/:id/stream-url`). **Wave 3** = thumbnail extraction in `FinalizeWorker` + MMKV ledger slice. **Wave 4** = three screen replacements (`HomeScreen` / `TasksScreen` / `HistoryScreen`) + the filter sheet + Send Request sheet, all design-spec-verbatim. **Wave 5** = `HumynPlayer` Kotlin native module + the `Player` route + the D-08 stream-URL plumbing on the client. Wave 4 and Wave 5 can parallelise after Wave 3.

Two load-bearing facts surfaced during research that the planner MUST address:

1. **`/recordings/:id` already mints a CloudFront-signed playback URL** (`apps/api/src/routes/recordings/get.ts:88-95`), not an S3 presigned URL. The D-08 stream-URL endpoint must either reuse the existing CloudFront path or live alongside it — but the CONTEXT.md D-08 wording ("S3 presigned GET") contradicts the shipped pattern. RECOMMENDATION: keep the CONTEXT's `archiveState` envelope but mint the URL with `getCloudFrontSignedUrl` (same key material, same TTL semantics) so prod traffic stays on CloudFront. This is documented in §Open Questions Q-1.
2. **`design-system/task-icons/TaskIcon.tsx` imports from `lucide-react` (web), not `lucide-react-native`.** It will not compile in RN today. The repo already has a working `lucide-react-native`-based `Icon` primitive at `apps/mobile/src/ui/primitives/Icon.tsx`; the planner must port `TaskIcon` (or add a `TaskIcon.native.tsx` sibling) to use `lucide-react-native` exports before Wave 4. Documented in §Open Questions Q-2.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Gut `/tasks/search` to lexical-only.** Replace the existing RRF hybrid CTE (`apps/api/src/routes/tasks/search.ts:15–116`) with the `lexical_ranks` CTE alone, ordered by `ts_rank(name_search, plainto_tsquery('english', $q)) DESC`. The 384-float pgvector path + the embedder.ts dep + the HNSW index stay shipped but unreferenced — §v2 (SEARCH-V2-01) revives them via git history.

**D-01a:** Response field `rrf_score` → `lex_score` (number) in `TasksSearchResponseSchema` (`shared/types/`). Wire-breaking but the mobile client doesn't consume `/tasks/search` yet.

**D-02: Fuzzy fallback = `pg_trgm` similarity at threshold 0.3.** When the `ts_vector` query returns zero rows, retry with `name % $q OR description % $q` ordered by `greatest(similarity(name,$q), similarity(description,$q))`. Add `CREATE EXTENSION IF NOT EXISTS pg_trgm` in a new migration; GIN trigram index on `tasks.name` is optional given the 65-row catalog.

**D-02a:** TASK-03 wording matches the implementation. No REQUIREMENTS rewording needed.

**D-03: Extend `/contributions/timeseries` and `/recordings` with optional `start` + `end` (ISO date) query params**, keeping the existing `range` enum (`7d|30d|90d|all`) as a convenience alias. When `start`/`end` are present, they take precedence and `range` is ignored. Client computes start/end from a single `Date.now()` for the five named windows.

**D-03b:** "This week" and "this month" use the **device's local timezone** (not UTC). The `start`/`end` ISO dates are sent as `YYYY-MM-DD` at local midnight, converted to timestamptz server-side using the request's `Accept-Timezone` header.

**D-03c:** Custom-range validation stays client-side: missing dates, inverted range (From > To), `max=today`.

**D-04: Backend recordings is the truth-source for the History row list; a local MMKV ledger overlays filename + thumbnail-path keyed by `recording_id`.** On re-install, rows survive (re-fetched from `GET /recordings?start=&end=`), but the local ledger is empty.

**D-04a:** No app-launch reconcile sweep beyond Phase 5's `uploadReconcile.ts`. Opportunistic cleanup on cold start; best-effort, not load-bearing.

**D-05: Thumbnail = native MediaMetadataRetriever first-I-frame extraction at recording-stop time**, persisted to `filesDir/thumbs/${base}.thumb.jpg` (separate directory from MP4 — survives post-`verified` MP4 delete).

**D-05b:** Crash-recovered segments don't have thumbnails (Phase 5 D-03 discards them).

**D-06: Player scope expansion — plays ALL non-discarded recordings.** Local MP4 → plays from `file://`. Verified-and-deleted-local OR in-flight (`pending` / `uploaded` / `hash-mismatch`) → streams via new presigned-GET. >90 days (Deep Archive) → row visible but tap shows disabled "Archived" message. REQUIREMENTS rewording for HIST-07/08/09 is done by the planner during planning.

**D-07: Hand-rolled `HumynPlayer` Kotlin native module on `androidx.media3:media3-exoplayer:1.10.0`** (same media3 minor as HumynCapture's muxer). `<HumynPlayerView>` = TextureView surface; JS bridge methods `prepare(uri)` / `play()` / `pause()` / `seekTo(ms)`; events `onProgress` / `onBuffer` / `onEnd` / `onError`.

**D-07a:** No iOS counterpart this phase.

**D-07b:** Player surface design-spec §14 — portrait-locked, black `#000` background, X-close top-left → History, centered task name, lock badge top-right (cosmetic), 64×64 centered play overlay, 4 px scrub bar, mono current/total time, footer "View only — not downloadable."

**D-08: New route `GET /recordings/:id/stream-url`.** Auth: `requireAuth` + `WHERE user_id = $sub AND qa_status NOT IN ('takedown','rejected','pending')`. Body: `{ presignedUrl: string|null, expiresAt: ISO-8601, archiveState: 'available'|'deep-archive'|'unavailable' }`. TTL = 5 min. Per-user rate-limit 60/min.

**D-09: `HumynBeep` SoundPool + `Vibrator` restore is Wave 1.** Instrument SoundPool load/play return values + Vibrator service availability on cue invocation; restore audibility on Android 16 / Pixel 10a.

**D-09a:** Not a Phase-5 functional defect — observability degradation only.

**D-10: TASK-08 form submits to existing Phase-1 `POST /task-requests`.** TASK-09 stands: no submitted-request status surfaced. Success toast `"Request sent. We'll review and add it to your list."`. Error in-sheet banner `"Couldn't send. Try again."` with retry. Optional ≤30s ≤50MB sample video uploads through existing `@fastify/multipart` route; client-side size + duration validation before network.

### Claude's Discretion

- Timezone wire format (Accept-Timezone header vs `tz=` query param vs implicit UTC). **Researcher recommends `Accept-Timezone` header** — see §Architecture Patterns / Pattern 3 below.
- Home tile aggregation source (new `/contributions/range` route vs sum daily buckets client-side from `/contributions/timeseries?start=&end=`). **Researcher recommends sum-locally** — see §Architecture Patterns / Pattern 4.
- Where the thumbnail extraction Kotlin code lives (`FinalizeWorker` extension vs new `HumynThumbnail` helper vs inline in `HumynUpload`). **Researcher recommends extending `FinalizeWorker`** — see §Architecture Patterns / Pattern 5.
- The MMKV ledger schema (`setObject` blob vs per-key MMKV stash). **Researcher recommends per-key stash under `pendingThumb.{recordingId}`** — mirrors Phase 4's `practiceDoneKey(sub)` pattern (STATE Pattern 71), iterates faster on cold-start reconcile, no schema-versioning needed.
- Player auto-rotate to landscape vs portrait + letterboxed. **Researcher recommends portrait + letterboxed** — design-spec §14 is the contract; recordings ARE landscape 16:9 so they letterbox cleanly in a portrait surface and this avoids the orientation-lock dance.
- `pg_trgm` similarity threshold (D-02 picked 0.3 = the `pg_trgm.similarity_threshold` default per Postgres docs). **Re-tune only if 0.3 over-recalls on the 65-task fixture.**
- The exact REQUIREMENTS-rewording sequence for HIST-07/08/09 — planner edits during planning, NOT pre-edited before planning starts.

### Deferred Ideas (OUT OF SCOPE)

- Server-side semantic / pgvector + RRF hybrid surfaced on the client — §v2 SEARCH-V2-01.
- Async thaw flow for Deep-Archive (>90 d) recordings — §v2 / Phase 7.
- iOS player parity (`HumynPlayerIOS` / AVPlayer / iOS native module) — §v2 IOS-01..07.
- OEM battery-optimization device sweep — Phase 7.
- Per-OEM SoundPool / Vibrator routing nuances beyond Pixel 10a / Android 16 — Phase 7.
- Auto-retry for streaming a `pending` row — §v2 polish.
- History row deletion / re-record / sharing — locked OUT by HIST-07/HIST-10.
- Search results sort options — §v2.
- Pull-to-refresh on the Tasks screen — §v2 polish (Phase 6 ships PTR on Home only per HOME-09).
- "Week-on-week" trend tile on Profile — out of scope; Profile shipped Phase 2.

---

## Phase Requirements

| ID      | Description                                                                                                                                | Research Support                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-01 | Browse 65 tasks across 10 categories                                                                                                       | `task-taxonomy.md` (truth source) + Phase-1 `tasks` table seeded from `mapping.json` + `GET /tasks?category=&setting=&cursor=&limit=` already shipped (`apps/api/src/routes/tasks/list.ts`). Wave 4.                                                                                                                                                                                                                                         |
| TASK-02 | Per-category pills, horizontally scrollable                                                                                                | Design-spec §10 enumerates the 11 pills (All + 10 categories). Pure UI; no backend change. Wave 4.                                                                                                                                                                                                                                                                                                                                           |
| TASK-03 | 200 ms-debounced server-side lexical search (`ts_vector` + GIN + pg_trgm fuzzy fallback)                                                   | D-01 + D-02. Existing route `apps/api/src/routes/tasks/search.ts` already has the `lexical_ranks` CTE shape; gut the hybrid. Wave 2 (backend) + Wave 4 (client debounce).                                                                                                                                                                                                                                                                    |
| TASK-04 | Task card: lucide icon (28 px stroke 1.75) via `<TaskIcon task={slug} />` + name + category eyebrow + 1-2 line description                 | Q-2 caveat: TaskIcon must be ported to `lucide-react-native`. Wave 4.                                                                                                                                                                                                                                                                                                                                                                        |
| TASK-05 | Task details sheet: chips + verbatim name/description + Universal-rules block + per-task instructions + Start Recording CTA                | Design-spec §11 verbatim. Cached from list-row data when possible; falls back to `GET /tasks/:id` (already shipped). Wave 4.                                                                                                                                                                                                                                                                                                                 |
| TASK-06 | Universal-rules block: 4 equal-weight rules (`front_hand` / `videocam` / `lightbulb` / `apps`) from taxonomy header                        | Hard-coded in client; the 4 rules are verbatim from `task-taxonomy.md` header. Wave 4.                                                                                                                                                                                                                                                                                                                                                       |
| TASK-07 | Per-task instructions task-specific only; server-side validation rejects `instructions.length > 3` or duplicates of universal-rule strings | Already enforced at seed-time via `task-taxonomy.md` source. Server-side validation on `POST /task-requests` body (`TaskRequestCreateSchema`) — instructions field is NOT in the request shape, so no rejection path exists today. **Research finding:** TASK-07 is satisfied by the seeded fixture; no Phase 6 server work required unless `/tasks` is later extended to accept admin updates. Document as "satisfied by seed" in the plan. |
| TASK-08 | Send Request form (3-80 name / 10-240 desc / category+Other / Indoor/Outdoor / optional ≤30s ≤50MB video)                                  | D-10. `POST /task-requests` shipped (`apps/api/src/routes/tasks/create-request.ts`). Sample video uploads through existing `@fastify/multipart` route. Wave 4.                                                                                                                                                                                                                                                                               |
| TASK-09 | No submitted-request status surfaced                                                                                                       | D-10. Show toast on success, banner on error. Wave 4.                                                                                                                                                                                                                                                                                                                                                                                        |
| TASK-10 | Non-prototype "no results" empty state (`SearchX` icon + send-request link)                                                                | Design-spec §10 State 4 recommends this; the planner ships it verbatim. Wave 4.                                                                                                                                                                                                                                                                                                                                                              |
| HOME-01 | First-time empty hero ("Record your first task") + zero-state tiles                                                                        | Design-spec §9a. Server returns `recordingCount=0` ⇒ render empty hero. Wave 4.                                                                                                                                                                                                                                                                                                                                                              |
| HOME-02 | Returning hero: lifetime numeric + task count + Start Recording CTA + real-data tiles                                                      | Design-spec §9b. `GET /contributions` lifetime (shipped) drives the hero. Wave 4.                                                                                                                                                                                                                                                                                                                                                            |
| HOME-03 | Recording-duration tile: today / yesterday / week / month / all / custom                                                                   | D-03. Wave 2 (backend `start`/`end`) + Wave 4 (client).                                                                                                                                                                                                                                                                                                                                                                                      |
| HOME-04 | Tasks-recorded tile: same six time-range toggles                                                                                           | D-03. Distinct-task count comes from `/contributions/timeseries` `taskCount` bucket OR sum-locally; researcher recommends sum-locally (see §Architecture Patterns Pattern 4).                                                                                                                                                                                                                                                                |
| HOME-05 | Pending Uploads tile visible only when count > 0; tap → upload-queue screen                                                                | Phase 5 D-10 already wires the rows. Phase 6 adds the `count > 0` visibility guard on the section header + the offline banner. Wave 4.                                                                                                                                                                                                                                                                                                       |
| HOME-06 | Duration formatter (`<1m→Xs`, `<1h→Xm`, `≥1h→Xh Ym` floored)                                                                               | Already shipped: `apps/mobile/src/services/durationFormatter.ts` (verified Phase 4). Reused.                                                                                                                                                                                                                                                                                                                                                 |
| HOME-09 | Pull-to-refresh on Home tiles fetches `/contributions`                                                                                     | Standard `RefreshControl` on the outer `ScrollView` already in `HomeSkeletonScreen.tsx`. Wave 4.                                                                                                                                                                                                                                                                                                                                             |
| HOME-10 | Non-blocking offline banner in Pending Uploads tile when network unreachable                                                               | Reuse the `NetInfo`-equivalent signal from Phase 5's `NetworkMonitor.kt`; surfaced via `HumynUpload.oemAutostartAvailableSafe` family or a new `onConnectivityChanged` event (researcher recommends extending the existing `onUploadQueueChanged` payload with a top-level `offline: boolean` to avoid a new bridge event). Wave 4.                                                                                                          |
| HIST-01 | Every successful recording (≥60 s) appears regardless of upload state                                                                      | `GET /recordings?range=` already shipped; `qa_status NOT 'takedown'` filter in place. Wave 4.                                                                                                                                                                                                                                                                                                                                                |
| HIST-02 | Default view groups by day, newest first                                                                                                   | SectionList by `created_at` calendar day (researcher recommendation, see §Pattern 6). Wave 4.                                                                                                                                                                                                                                                                                                                                                |
| HIST-03 | Filter across six time-range options                                                                                                       | D-03. Wave 2 backend + Wave 4 client.                                                                                                                                                                                                                                                                                                                                                                                                        |
| HIST-04 | Empty state (no recordings) — "Your recordings will live here." + tap-to-tasks link                                                        | Design-spec §13 State 3. Wave 4.                                                                                                                                                                                                                                                                                                                                                                                                             |
| HIST-05 | Empty state (filter applied) — "No recordings in this range." + reset-filter link                                                          | Design-spec §13 State 4. Wave 4.                                                                                                                                                                                                                                                                                                                                                                                                             |
| HIST-06 | Row: filename + duration + task name + recorded-at + upload chip + first-frame thumbnail                                                   | D-04 + D-05. Server fields: `recording_id` + `task_id` + `duration_ms` + `created_at` + `qa_status`. Client overlays from MMKV ledger: filename + thumbnail path. Wave 4.                                                                                                                                                                                                                                                                    |
| HIST-07 | Tap thumbnail → in-app fullscreen player while local MP4 exists; otherwise stream from server                                              | D-06 + D-07. Wave 5. **REWORD during planning.**                                                                                                                                                                                                                                                                                                                                                                                             |
| HIST-08 | Local cleared → thumbnail remains, tap streams from server (Deep Archive shows disabled message)                                           | D-06. Wave 5. **REWORD during planning.**                                                                                                                                                                                                                                                                                                                                                                                                    |
| HIST-09 | Streaming uploaded recordings is IN MVP for Phase 6 (was "out of MVP")                                                                     | D-06. Wave 5. **REWORD during planning.**                                                                                                                                                                                                                                                                                                                                                                                                    |
| HIST-10 | User cannot delete recordings (locally or server-side)                                                                                     | Already locked by HIST-10; no delete affordance in player or row. Wave 4/5.                                                                                                                                                                                                                                                                                                                                                                  |
| HIST-11 | Each row reserves Feedback button slot (disabled, "coming soon")                                                                           | Static UI element; design-spec §13 row description. Wave 4.                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Architectural Responsibility Map

| Capability                                              | Primary Tier                      | Secondary Tier                                            | Rationale                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 65-task catalog browse + search                         | API / Backend                     | Browser/Client (debounce + render)                        | Catalog lives in Postgres; client paginates + lexically queries. Server is truth.                                                                 |
| Pull-to-refresh contributions                           | API / Backend                     | Browser/Client                                            | `GET /contributions` is truth; client just triggers re-fetch.                                                                                     |
| Time-range aggregation (today/yesterday/week/month/all) | API / Backend                     | Browser/Client (local-tz date math + sum-bucket fallback) | Server pre-aggregates daily buckets (`contributions` table, migration 0004). Client maps named windows → `start`/`end` ISO dates → request param. |
| Local MMKV thumbnail ledger                             | Browser/Client                    | —                                                         | Pure device-local state — Phase 5 pattern (`uploadReconcile.ts` + MMKV). Backend stays the row truth-source.                                      |
| Thumbnail extraction                                    | Browser/Client (native)           | —                                                         | Reads local MP4 byte stream via `MediaMetadataRetriever`; never uploaded; never re-encodes the MP4 (CAP-18 invariant preserved).                  |
| In-app playback                                         | Browser/Client (native ExoPlayer) | API / Backend (mints stream URL on demand)                | Bytes flow direct from S3/CloudFront → device; server only mints the signed URL. CAP-18 invariant: server never reads recording bytes.            |
| Send Request submit                                     | API / Backend                     | Browser/Client                                            | `POST /task-requests` already shipped; client validates + submits.                                                                                |
| Pending Uploads tile visibility + offline banner        | Browser/Client                    | API / Backend (none — pure UI state)                      | Connectivity + queue state are device-local.                                                                                                      |
| Stream-URL minting (D-08)                               | API / Backend                     | CDN / Static (CloudFront serves the signed bytes)         | Server is the trust boundary that decides whether a recording is `available` / `deep-archive` / `unavailable` and signs the URL.                  |
| Lexical search ranking                                  | API / Backend                     | —                                                         | `ts_rank` + `pg_trgm.similarity` are Postgres-native; no client-side fallback.                                                                    |
| Wave-1 Vibrator + SoundPool restore                     | Browser/Client (native)           | —                                                         | Device-local audio routing + `VIBRATE` permission.                                                                                                |

---

## Standard Stack

### Mobile (already in `apps/mobile/package.json` — verified)

| Library                          | Version  | Purpose                                                                                         | Why Standard                                                                                                                                |
| -------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native`                   | 0.83.0   | App shell                                                                                       | Locked, Hermes new-arch [VERIFIED: package.json L29].                                                                                       |
| `react-native-mmkv`              | 4.3.1    | Thumbnail ledger persistence                                                                    | Encrypted-on-Android, sync read/write, mirrors Phase 5 upload-queue pattern [VERIFIED: package.json L26].                                   |
| `react-native-fs`                | 2.20.0   | Path joins for `filesDir/thumbs/${base}.thumb.jpg` resolution on the JS side                    | Already used in Phase 3-5; no new dep [VERIFIED: package.json L23].                                                                         |
| `react-native-svg`               | ^15.15.4 | SearchX glyph + any future SVG                                                                  | Already in tree [VERIFIED: package.json L34].                                                                                               |
| `lucide-react-native`            | 1.14.0   | Icon registry for `<TaskIcon>` + History row icons + filter chevrons                            | Q-2: design-system/task-icons currently imports `lucide-react` (web); MUST be ported to `lucide-react-native` [VERIFIED: package.json L20]. |
| `react-native-haptic-feedback`   | 2.3.3    | Filter-sheet selection haptic, row-tap haptic, history-tap haptic                               | Already in tree [VERIFIED: package.json L25].                                                                                               |
| `react-native-reanimated`        | ~4.3.1   | Filter sheet slide, contribution counter ease, scale-pop press feedback                         | Already in tree [VERIFIED: package.json L31].                                                                                               |
| `@react-navigation/native-stack` | 7.3.7    | The new `Player` route lands in `RootNativeStack` (sibling of `MainTabs`) so it goes full-bleed | Already in tree [VERIFIED: package.json L17].                                                                                               |
| `zustand`                        | 5.0.2    | New state slices: `homeRange`, `historyRange`, `pendingThumbnailLedger`                         | Already in tree [VERIFIED: package.json L40].                                                                                               |

### Mobile (Android, native — already in `apps/mobile/android/app/build.gradle`)

| Library                                              | Version    | Purpose                                                                                                                                      | Why Standard                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `androidx.media3:media3-exoplayer`                   | 1.10.0     | The `HumynPlayer` Kotlin module — local + remote HEVC playback                                                                               | Same media3 minor as the already-pinned `media3-muxer:1.10.0` (verified in `build.gradle` L192). Adding `media3-exoplayer:1.10.0` is single-pin-line maintenance [CITED: Media3 1.10 release notes — github.com/androidx/media/releases].     |
| `androidx.media3:media3-common`                      | 1.10.0     | Transitive of `media3-exoplayer`; `Player` / `MediaItem` / `PlaybackException` types                                                         | Comes in transitively; no explicit pin needed [VERIFIED: `media3-muxer` pulls `media3-common:1.10.0` transitively today per the build.gradle comment].                                                                                        |
| `androidx.media3:media3-ui`                          | _not used_ | Compose / view-based player UI widgets                                                                                                       | We hand-roll the player surface from design-spec §14 — do NOT install `media3-ui`.                                                                                                                                                            |
| `android.media.MediaMetadataRetriever`               | platform   | First-I-frame thumbnail extraction                                                                                                           | Built-in since API 1; `OPTION_CLOSEST_SYNC` at `timeUs=0` retrieves the nearest key frame at or before the start [CITED: developer.android.com/reference/android/media/MediaMetadataRetriever].                                               |
| `android.media.SoundPool`                            | platform   | D-09 — already in `HumynBeepModule.kt`; restore audibility                                                                                   | Built-in. The fix is configuration (`AudioAttributes.USAGE_MEDIA` instead of `USAGE_ASSISTANCE_SONIFICATION`), not a library swap [CITED: developer.android.com/reference/android/media/AudioAttributes].                                     |
| `android.os.Vibrator` / `android.os.VibratorManager` | platform   | D-09 — restore haptics on Android 16. `VibratorManager` is the new API on API 31+; `Vibrator` is deprecated for API 31+ but still functional | Built-in. The fix is `VIBRATE` manifest declaration (already present as platform default? — must verify) + `VibrationEffect.createWaveform(...)` for the patterned vibes [CITED: developer.android.com/reference/android/os/VibratorManager]. |

### Backend (already in `apps/api/package.json` — verified)

| Library                         | Version            | Purpose                                                                                                                              | Why Standard                                                                                                                                                                                                                              |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fastify`                       | 5.8.5              | Routes for the new `/recordings/:id/stream-url` + the extended `/recordings` and `/contributions/timeseries`                         | Locked.                                                                                                                                                                                                                                   |
| `drizzle-orm`                   | 0.45.2             | Schema + query for the lexical-only + pg_trgm fallback `/tasks/search`                                                               | Locked.                                                                                                                                                                                                                                   |
| `@aws-sdk/cloudfront-signer`    | 3.1036.0           | The D-08 stream-URL — researcher recommends keeping CloudFront-signed (consistent with existing `/recordings/:id`), NOT S3 presigned | Already in tree, shipped in Phase 1 for `/recordings/:id` (`apps/api/src/routes/recordings/get.ts:16`). Same env contract (`CLOUDFRONT_RECORDINGS_PRIVATE_KEY` + `CLOUDFRONT_RECORDINGS_KEY_PAIR_ID` + `CLOUDFRONT_RECORDINGS_BASE_URL`). |
| `@aws-sdk/s3-request-presigner` | 3.1044.0           | _Optional_ — if planner picks raw S3 presigned over CloudFront-signed                                                                | Already in tree, used by the multipart-upload route. Pin-pair-locked with `@aws-sdk/client-s3:3.1044.0` per CLAUDE.md.                                                                                                                    |
| `pg_trgm` extension             | bundled with PG 17 | D-02 fuzzy fallback                                                                                                                  | Built-in since PG ≥9.1; no extra dep [CITED: postgresql.org/docs/current/pgtrgm.html].                                                                                                                                                    |

### Alternatives Considered

| Instead of                         | Could Use                            | Tradeoff                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-rolled `HumynPlayer`          | `react-native-video` (community lib) | Adds RN dep + peer-matrix maintenance; ships an Activity that doesn't compose into the §14 dark surface design without overrides. Locked by CLAUDE.md "Do NOT Use" — also forbidden by D-07 owner pick. |
| Hand-rolled `HumynPlayer`          | `MediaPlayer` (platform)             | Less robust HEVC seek; no buffering events; no `BufferedPosition`. Rejected D-07.                                                                                                                       |
| `MediaMetadataRetriever`           | FFmpeg-based extractor               | Heavy native binding for a 1-frame extract; `MediaMetadataRetriever` is the platform tool.                                                                                                              |
| `lucide-react-native` icons        | Custom SVG bundle                    | Already in tree at 1.14.0; 65-task mapping authored in `design-system/task-icons/mapping.ts`.                                                                                                           |
| `SectionList` for History          | `FlatList` with sticky-header layout | SectionList ships sticky day headers + group-keyed render out of the box [CITED: reactnative.dev/docs/sectionlist]; SectionList is the recommended pattern for History (confirmed by web search).       |
| CloudFront-signed for D-08         | S3 `getSignedUrl(GetObjectCommand)`  | S3 presigned: simpler dev (LocalStack supports it); CloudFront: cheaper egress + cache hits + already in prod path. Recommend CloudFront for prod parity with `/recordings/:id`.                        |
| `Accept-Timezone` header for D-03b | `tz=` query param                    | Both are zero-cost; header keeps the query string clean. `tz=` is more visible in logs. Recommend header for parity with HTTP convention but planner can override.                                      |

**Installation:**

```gradle
// apps/mobile/android/app/build.gradle — Phase 6 Wave 5
// Same media3 minor as the existing media3-muxer:1.10.0 pin. No new ABI risk.
implementation 'androidx.media3:media3-exoplayer:1.10.0'
```

No new JS deps required.

```sql
-- apps/api/src/db/migrations/0007_pg_trgm.sql — Phase 6 Wave 2
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- GIN trigram index on tasks.name is OPTIONAL on a 65-row table; leave out unless
-- the planner measures the seq scan as a regression. The threshold = the
-- pg_trgm.similarity_threshold session default of 0.3 (pgvector docs verified).
```

**Version verification (npm view / Maven Central):**

- `androidx.media3:media3-exoplayer:1.10.0` — released 2026-03, fixes Dolby Vision fallback issue, supports HEVC Main profile (which our capture pipeline produces) [CITED: android-developers.googleblog.com/2026/03/media3-110-is-out.html].
- `pg_trgm` ships with Postgres 9.1+; PG 17 (our locked version) has the default `pg_trgm.similarity_threshold = 0.3` [CITED: postgresql.org/docs/current/pgtrgm.html].
- All other versions already verified by shipped Phase 1-5 work.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  RN APP (apps/mobile)                                           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────┐ │
│  │ HomeScreen  │  │ TasksScreen  │  │ HistoryScr │  │ Player  │ │
│  │ (hero,tiles)│  │ (pills,grid, │  │(SectionList│  │ (full-  │ │
│  │ + filter    │  │  search,     │  │  by day,   │  │  bleed) │ │
│  │ sheet       │  │  detail sht, │  │  filter    │  │         │ │
│  │             │  │  request sht)│  │  sheet,    │  │         │ │
│  │             │  │              │  │  thumbnails│  │         │ │
│  └─────┬───────┘  └──────┬───────┘  └─────┬──────┘  └────┬────┘ │
│        │                 │                │              │      │
│        │ Zustand: homeRange/historyRange/pendingThumbnailLedger  │
│        │ MMKV: pendingThumb.{recordingId} per-key stash          │
│        │                 │                │              │      │
│        v                 v                v              v      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │             services/api.ts (Fastify client)             │   │
│  │  + recordingEvents.ts (verified/re-upload outbox drain)  │   │
│  └─────┬────────┬─────────┬───────────┬───────────┬─────────┘   │
│        │        │         │           │           │             │
│        │ GET    │ GET    │ GET       │ POST       │ GET         │
│        │ /tasks │ /tasks  │ /contrib  │ /task-     │ /recordings │
│        │        │ /search │ + /recor- │ requests   │ /:id/       │
│        │        │ (lex+   │ dings     │ (multipart)│ stream-url  │
│        │        │  trgm)  │ ?start=&  │            │             │
│        │        │         │ end=      │            │             │
│        v        v         v           v            v             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Native Modules (Kotlin)                                 │   │
│  │                                                          │   │
│  │  HumynPlayer  HumynUpload  HumynCapture  HumynBeep       │   │
│  │  (NEW)        (Phase 5)    +FinalizeWorker (Wave 1       │   │
│  │  media3       MMKV+S3+     →extract thumb)  fix)         │   │
│  │  ExoPlayer    OkHttp                                     │   │
│  │  + TextureV.  + JobService                               │   │
│  └────┬────────────────┬─────────────────┬──────────────────┘   │
│       │                │                 │                       │
│       │ file:// (local │ S3 multipart    │ MediaMetadataRetriever│
│       │ MP4) OR        │ upload (Phase 5)│ → filesDir/thumbs/    │
│       │ https://       │                 │                       │
│       │ (presigned)    │                 │                       │
└───────│────────────────│─────────────────┴──────────────────────┘
        │                │
        v                v
┌─────────────┐  ┌──────────────────────────────────────────────────┐
│ S3 / CDN    │  │  Fastify API (apps/api)                          │
│             │  │                                                  │
│ recordings/ │<─│  /tasks/search (gut to lexical_ranks CTE only)   │
│ {userId}/   │  │  /tasks/:id    /tasks    /task-requests          │
│ {recId}/    │  │  /recordings?start=&end=  /recordings/:id        │
│  video.mp4  │  │  /recordings/:id/stream-url  (NEW)               │
│  imu.csv    │  │  /contributions/timeseries?start=&end=           │
│  metadata.j │  │  /contributions                                  │
│             │  │                                                  │
└─────────────┘  └─────────┬────────────────────────────────────────┘
                           │
                           v
                  ┌──────────────────────┐
                  │  Postgres 17         │
                  │                      │
                  │  tasks (name_search  │
                  │   tsvector + GIN +   │
                  │   pg_trgm NEW)       │
                  │  recordings          │
                  │  contributions       │
                  │  task_requests       │
                  └──────────────────────┘
```

### Recommended Project Structure

```
apps/mobile/src/
├── screens/
│   ├── home/HomeScreen.tsx              # NEW (replaces HomeSkeletonScreen)
│   ├── tasks/TasksScreen.tsx            # NEW (replaces TasksPlaceholderScreen)
│   ├── tasks/TaskDetailsSheet.tsx       # NEW
│   ├── tasks/SendRequestSheet.tsx       # NEW
│   ├── history/HistoryScreen.tsx        # NEW (replaces HistoryPlaceholderScreen)
│   ├── history/PlayerScreen.tsx         # NEW (new Player route in RootNativeStack)
│   └── shared/FilterSheet.tsx           # NEW — used by Home tiles + History chip
├── components/
│   ├── ContributionTile.tsx             # NEW
│   ├── HomeHero.tsx                     # NEW (empty vs returning variants)
│   ├── TaskCard.tsx                     # NEW
│   ├── TaskCategoryPills.tsx            # NEW
│   ├── HistoryRow.tsx                   # NEW
│   ├── HistoryDayHeader.tsx             # NEW
│   ├── FilterChip.tsx                   # NEW
│   ├── SearchInput.tsx                  # NEW (200 ms debounce, SearchX empty)
│   └── OfflineBanner.tsx                # NEW (HOME-10)
├── native/
│   ├── HumynPlayer.ts                   # NEW (JS bridge stub-then-body pattern)
│   └── HumynPlayer.types.ts             # NEW
├── services/
│   ├── tasksApi.ts                      # NEW — wraps /tasks, /tasks/search
│   ├── recordingsApi.ts                 # NEW — wraps /recordings, /recordings/:id/stream-url
│   ├── contributionsApi.ts              # NEW — wraps /contributions, /contributions/timeseries
│   ├── timeRange.ts                     # NEW — local-tz date math for 6 named windows
│   ├── taskRequestService.ts            # NEW — multipart submit wrapper
│   └── thumbnailLedger.ts               # NEW — MMKV ledger CRUD
├── state/
│   ├── appStore.ts                      # EXTEND — add homeRange, historyRange
│   └── keys.ts                          # EXTEND — add pendingThumbKey(recordingId)

apps/api/src/
├── routes/
│   ├── tasks/search.ts                  # EDIT (gut RRF → lexical-only + pg_trgm fallback)
│   ├── recordings/list.ts               # EDIT (accept start/end query params)
│   ├── recordings/schemas.ts            # EDIT (RecordingsListQuerySchema + start/end)
│   ├── recordings/stream-url.ts         # NEW
│   ├── recordings/index.ts              # EDIT (register stream-url BEFORE /:id per Pattern 28)
│   └── contributions/timeseries.ts      # EDIT (accept start/end)
└── db/
    └── migrations/
        └── 0007_pg_trgm.sql              # NEW

apps/mobile/android/app/src/main/java/ai/humynlabs/capture/
├── beep/HumynBeepModule.kt              # EDIT — Wave 1 D-09 (USAGE_MEDIA + return-value logging)
├── capture/FinalizeWorker.kt            # EDIT — Wave 3 D-05 (extract thumb after sidecar delete)
├── capture/ThumbnailExtractor.kt        # NEW — small helper, callable from FinalizeWorker
├── player/HumynPlayerModule.kt          # NEW — Wave 5 D-07 (~150 LOC)
├── player/HumynPlayerPackage.kt         # NEW — Wave 5 (RN package boilerplate)
├── player/HumynPlayerView.kt            # NEW — Wave 5 (TextureView host)
└── MainApplication.kt                   # EDIT — register HumynPlayerPackage
```

### Pattern 1: Lexical Search with pg_trgm Fuzzy Fallback (D-01 + D-02)

**What:** Gut `apps/api/src/routes/tasks/search.ts` from RRF hybrid to a two-stage query: `ts_vector` first; if zero rows, `pg_trgm` similarity at threshold 0.3.

**When to use:** Every search query.

**Example:**

```typescript
// Source: D-01 + verified shape from apps/api/src/routes/tasks/search.ts
const result = await db.execute<TaskRow>(sql`
  WITH lex AS (
    SELECT
      t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
      t.icon_key, t.instructions,
      ts_rank(t.name_search, plainto_tsquery('english', ${q})) AS lex_score
    FROM tasks t
    WHERE
      t.name_search @@ plainto_tsquery('english', ${q})
      AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null}::text)
      AND (${setting ?? null}::text IS NULL OR t.setting::text = ${setting ?? null}::text OR t.setting::text = 'either')
    ORDER BY lex_score DESC
    LIMIT ${limit}
  )
  SELECT * FROM lex
`);
if (result.rows.length === 0) {
  // pg_trgm fuzzy fallback — threshold 0.3 (pg_trgm.similarity_threshold default)
  const fuzzy = await db.execute<TaskRow>(sql`
    SELECT
      t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
      t.icon_key, t.instructions,
      GREATEST(similarity(t.name, ${q}), similarity(t.description, ${q})) AS lex_score
    FROM tasks t
    WHERE
      (t.name % ${q} OR t.description % ${q})
      AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null}::text)
      AND (${setting ?? null}::text IS NULL OR t.setting::text = ${setting ?? null}::text OR t.setting::text = 'either')
    ORDER BY lex_score DESC
    LIMIT ${limit}
  `);
  return mapRows(fuzzy);
}
return mapRows(result);
```

**Why this works:** `pg_trgm` `%` operator uses the session-level `pg_trgm.similarity_threshold` (default 0.3) — no per-query tuning needed [CITED: postgresql.org/docs/current/pgtrgm.html]. The GIN trigram index on `tasks.name` (optional on 65 rows) makes the fallback sub-millisecond at scale. Drizzle's `sql` template parameterises `q` and `category` (no injection).

### Pattern 2: Local Time-Range Computation (D-03 + D-03b)

**What:** Compute the `start` + `end` ISO dates for the six named windows on the client, in the device's local timezone.

**When to use:** Every tile filter change + history filter change.

**Example:**

```typescript
// Source: design-spec §16 + D-03b. New file: services/timeRange.ts
export type NamedRange = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'all' | 'custom';

export function computeRange(
  named: NamedRange,
  now = new Date(),
): { start?: string; end?: string } {
  const localNow = new Date(now); // already local-tz in JS
  const startOfToday = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  switch (named) {
    case 'today':
      return { start: toIsoDate(startOfToday), end: toIsoDate(endOfToday) };
    case 'yesterday':
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfToday.getDate() - 1);
      return { start: toIsoDate(startOfYesterday), end: toIsoDate(startOfToday) };
    case 'this-week':
      // Monday-start week — design-spec doesn't specify; researcher picks Monday to match Indian/Brazilian conventions
      const dayOfWeek = (startOfToday.getDay() + 6) % 7; // 0=Mon
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);
      return { start: toIsoDate(startOfWeek), end: toIsoDate(endOfToday) };
    case 'this-month':
      const startOfMonth = new Date(localNow.getFullYear(), localNow.getMonth(), 1);
      return { start: toIsoDate(startOfMonth), end: toIsoDate(endOfToday) };
    case 'all':
      return {}; // omit start/end ⇒ all-time
    case 'custom':
      throw new Error('Custom range — caller supplies start+end explicitly');
  }
}

function toIsoDate(d: Date): string {
  // 'YYYY-MM-DD' in LOCAL tz — D-03b sends as ISO date string, server interprets via Accept-Timezone
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

**Server side (D-03b):** Add an `Accept-Timezone` header parser that validates against IANA names (Node's `Intl.DateTimeFormat` resolves IANA names natively); reject unknown TZ with a 400 problem-detail. Cast `start::date AT TIME ZONE <tz>` to convert local-midnight YYYY-MM-DD to timestamptz.

### Pattern 3: D-08 Stream-URL Endpoint (with CloudFront alignment recommendation)

**What:** `GET /recordings/:id/stream-url` that mints a short-lived signed URL.

**When to use:** Every Player tap when the local MP4 is missing.

**Example:**

```typescript
// Source: D-08 + Phase 1 /recordings/:id pattern (CloudFront-signed today)
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import { RECORDINGS_BUCKET, recordingKeys } from '../../lib/s3-client.js';

const STREAM_TTL_SECONDS = 5 * 60;
const DEEP_ARCHIVE_DAYS = 90; // Phase-1 S3 lifecycle parity

export default async function recordingsStreamUrlRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings/:id/stream-url',
    {
      schema: {
        params: RecordingsGetParamsSchema /* response intentionally omitted — Pattern 22 */,
      },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: keyByUserOrIp, // same pattern as /contributions/list.ts
        },
      },
    },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub;
      const rec = await loadRecording(req.params.id);
      // 404 surfaces cross-user, missing, takedown, rejected — never leak existence (T-1.7-10)
      if (
        !rec ||
        rec.userId !== userId ||
        rec.qaStatus === 'takedown' ||
        rec.qaStatus === 'rejected'
      ) {
        return reply.status(404).type('application/problem+json').send(notFoundProblem(req));
      }
      // pending = upload not complete; tap shows "Still uploading — try again in a moment."
      if (rec.qaStatus === 'pending') {
        return reply.send({
          presignedUrl: null,
          expiresAt: new Date().toISOString(),
          archiveState: 'unavailable' as const,
        });
      }
      // >90 days ⇒ Deep Archive — derive from created_at, no S3 HeadObject needed
      const ageDays = (Date.now() - rec.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > DEEP_ARCHIVE_DAYS) {
        return reply.send({
          presignedUrl: null,
          expiresAt: new Date().toISOString(),
          archiveState: 'deep-archive' as const,
        });
      }
      // Mint URL — RECOMMENDATION: stay on CloudFront-signed for prod parity with /recordings/:id
      const expiresAt = new Date(Date.now() + STREAM_TTL_SECONDS * 1000);
      const { key, keyPairId, baseUrl } = getCloudFrontSigningKey(); // shared helper with /recordings/:id
      const presignedUrl = getCloudFrontSignedUrl({
        url: `${baseUrl}/${rec.s3KeyVideo}`,
        privateKey: key,
        keyPairId,
        dateLessThan: expiresAt.toISOString(),
      });
      return reply.send({
        presignedUrl,
        expiresAt: expiresAt.toISOString(),
        archiveState: 'available' as const,
      });
    },
  );
}
```

**Why CloudFront-signed (not S3 presigned):** `/recordings/:id` already mints CloudFront-signed URLs (verified `apps/api/src/routes/recordings/get.ts:88-95`); reusing the same path keeps prod traffic on CloudFront (cheaper egress, cache hits, no S3 cold-cache latency on Mumbai → São Paulo cross-region streams), reuses the same env contract, and avoids surprising the ops runbook with two URL families. **Caveat:** LocalStack does not implement CloudFront-signer at MVP, so e2e tests will need to mock the signer — see §Common Pitfalls / Pitfall 3. Planner can override to S3 presigned if they want dev-stack parity at the cost of prod-stack uniformity.

**Route registration order (Pattern 28):** `/recordings/:id/stream-url` MUST register BEFORE `/recordings/:id` in `routes/recordings/index.ts` — Fastify radix-tree precedence; literal `/stream-url` after `:id` beats a wildcard that would steal the call.

### Pattern 4: Home Tile Aggregation — Sum Daily Buckets Client-Side

**What:** When the user picks a named window, fetch `/contributions/timeseries?start=&end=` (D-03 extended), sum `durationMs` and re-count distinct tasks on the client — no new `/contributions/range` route.

**When to use:** Every tile filter change on Home (D-03a — Claude's discretion).

**Why sum-locally beats a new route:**

- Smallest blast radius — `/contributions/timeseries` already exists; D-03 extends it with `start`/`end` for free.
- The pre-aggregated `contributions` table (migration 0004) holds one row per (user, day) — at most ~365 rows/year × 1 user-fetch = 365 buckets transferred for an "all-time" filter on a 1-year contributor. JSON-serialized this is ~30 KB; sum-locally is sub-millisecond.
- The distinct-task count of a window is the union of `task_count` buckets — but `task_count` per bucket is unique-tasks-that-day, so summing over a range double-counts. The correct value comes from `taskCount` aggregated from raw `recordings` rows in the window. **Mitigation:** the existing `GET /contributions` lifetime endpoint already returns lifetime `taskCount`; we extend `/contributions/timeseries` with an optional `aggregate=true` param that returns a single summed bucket + correct distinct-task `COUNT(DISTINCT task_id)`. This is a tiny query change, not a new route.

**Caveat:** Researcher recommends sum-locally for `durationMs` and the aggregate-true approach for `taskCount`, but the planner can pick a single thin aggregate sub-route (`/contributions/range`) if they prefer to keep the response shape clean — both choices satisfy D-03a.

### Pattern 5: Thumbnail Extraction in `FinalizeWorker` (D-05a)

**What:** Extend `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt` to call a new `ThumbnailExtractor.extractFirstFrame(mp4File, thumbsDir)` AFTER the sidecar delete (step 7 in the current finalize sequence). The new helper writes `filesDir/thumbs/${base}.thumb.jpg` and resolves with the path. On any throwable, log + continue — the thumbnail is best-effort.

**When to use:** Once per finalized segment that is NOT a practice and NOT a crash-recovered fragment.

**Example (sketch):**

```kotlin
// New: capture/ThumbnailExtractor.kt — ~30 LOC
object ThumbnailExtractor {
    fun extractFirstFrame(mp4File: File, thumbsDir: File): File? {
        thumbsDir.mkdirs()
        val outFile = File(thumbsDir, "${mp4File.nameWithoutExtension}.thumb.jpg")
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(mp4File.absolutePath)
            // OPTION_CLOSEST_SYNC at timeUs=0 = nearest key frame at/before start (which is the first I-frame).
            // HEVC Main profile is supported by MediaMetadataRetriever on all Android API >= 21 devices.
            val bitmap = retriever.getFrameAtTime(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC) ?: return null
            FileOutputStream(outFile).use { out ->
                // 80% quality JPEG — 1920x1080 first-frame → ~30-50 KB; trivial on a 64x64 row thumb
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
            }
            bitmap.recycle()
            return outFile
        } catch (t: Throwable) {
            // Best-effort — log and let the ledger render the gradient + first-letter fallback (D-04)
            Log.w("ThumbnailExtractor", "extract failed for ${mp4File.name}", t)
            outFile.delete()
            return null
        } finally {
            retriever.release()
        }
    }
}
```

**Cross-process handoff to `HumynUpload.enqueue(...)`:** After `extractFirstFrame` returns the path, `FinalizeWorker` emits the path on the existing `onSegmentComplete` event (extend the payload with `thumbnailPath: string | null`); the JS-side enqueue path (`RecordingScreen.tsx`'s segment-complete handler that already calls `HumynUpload.enqueue(...)`) then writes the ledger entry. **Why not write the ledger from Kotlin?** MMKV's encrypted-on-Android key requires the same shared-secret derivation the JS side already owns; writing from Kotlin would duplicate that derivation. JS-side write keeps a single source of MMKV truth.

**Why `OPTION_CLOSEST_SYNC` at timeUs=0:** Returns the nearest key frame at/before the given time [CITED: developer.android.com/reference/android/media/MediaMetadataRetriever]. HEVC GOP=30, no B-frames (CAP-01) — frame 0 IS a key frame, so the retriever returns it directly with no decode delay.

**Where it physically lives — alternatives:**

- **Extend `FinalizeWorker` (RECOMMENDED, smallest blast radius)** — one file edit + one new ~30 LOC helper. Already runs on `finalizeExecutor` (separate thread); thumbnail extract is post-sidecar-delete so it can't break the finalize integrity invariant.
- New `HumynThumbnail` native module — mirrors the canonical 3-file native-module triad (Module/Package/JS-binding); cleaner separation but requires the planner to wire `MainApplication.kt` and add the JS bridge stub. Pick if the planner wants a dedicated test surface.
- Inline in `HumynUpload.enqueue(...)` — couples upload-queue logic with extract logic; rejected.

### Pattern 6: History List = SectionList Grouped by Day

**What:** Replace `HistoryPlaceholderScreen.tsx` with a `<SectionList>` whose `sections` are grouped by `created_at.toLocaleDateString()` (local-tz), sorted newest-first.

**When to use:** Every History render.

**Why SectionList over FlatList:** SectionList ships sticky day headers + group-keyed render out of the box [CITED: reactnative.dev/docs/sectionlist]; FlatList would require us to inline header rows and manage their layout manually.

**Sticky header note:** `stickySectionHeadersEnabled` can impact Android performance per the docs — test on Pixel 10a (60 fps target). If perf regresses, set `stickySectionHeadersEnabled={false}` and accept that the day header scrolls with the rows.

**`getItemLayout` recommendation:** History rows are uniform (64 px thumb + 14 px padding + 14 px gap + body height) — measuring the row once at mount lets us supply `getItemLayout` for instant `scrollToIndex` and smooth scroll. Planner can defer if perf is fine without it.

### Pattern 7: HumynPlayer Native Module Shape (D-07)

**What:** Mirror the canonical 3-file native-module triad already used by `HumynCapture`, `HumynUpload`, `HumynBeep`, `HumynBattery`, `HumynPhoneState`, `HumynUpdater`.

**File layout:**

- `apps/mobile/android/.../player/HumynPlayerModule.kt` — `ReactContextBaseJavaModule` with `@ReactMethod`s `prepare(uri: String, promise: Promise)`, `play(promise: Promise)`, `pause(promise: Promise)`, `seekTo(ms: Double, promise: Promise)`. Holds the `ExoPlayer` instance.
- `apps/mobile/android/.../player/HumynPlayerPackage.kt` — RN `ReactPackage` boilerplate.
- `apps/mobile/android/.../player/HumynPlayerView.kt` — `SimpleViewManager<TextureView>` that exposes the `TextureView` host. The view manager hands the `TextureView` to the module via `player.setVideoTextureView(textureView)`.
- `apps/mobile/src/native/HumynPlayer.ts` — JS bridge: `ensure()` guard + lazy `NativeEventEmitter` (mirrors `HumynUpload.ts:248-255`) + event subscribers `onProgress`/`onBuffer`/`onEnd`/`onError`.

**ExoPlayer Builder example:**

```kotlin
// Source: Context7 /androidx/media — verified ExoPlayer 1.10 builder shape
val player = ExoPlayer.Builder(reactApplicationContext)
    .setAudioAttributes(
        AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
            .build(),
        /* handleAudioFocus = */ true,
    )
    .setHandleAudioBecomingNoisy(true)
    .build()

player.addListener(object : Player.Listener {
    override fun onPlaybackStateChanged(state: Int) {
        emit("onBuffer", Arguments.createMap().apply {
            putBoolean("buffering", state == Player.STATE_BUFFERING)
        })
        if (state == Player.STATE_ENDED) emit("onEnd", Arguments.createMap())
    }
    override fun onPlayerError(error: PlaybackException) {
        emit("onError", Arguments.createMap().apply {
            putInt("code", error.errorCode)
            putString("msg", error.message ?: "playback error")
        })
    }
})

player.setMediaItem(MediaItem.fromUri(uri))
player.prepare()
```

**`prepare(uri)` URI scheme:** ExoPlayer's `DefaultDataSource` (the default `MediaSource.Factory` source) handles both `file://` and `https://` natively [CITED: Context7 /androidx/media]; the same code path serves local + remote.

**Progress events:** Run a `Handler.postDelayed { ... }` 250 ms loop while playing, emitting `onProgress({ positionMs: player.currentPosition, bufferedMs: player.bufferedPosition, durationMs: player.duration })`. Cancel on pause/stop.

**Release on JS module invalidate:** Override `ReactContextBaseJavaModule.invalidate()` to call `player.release()` — mirrors `HumynBeepModule.invalidate()` (HumynBeep Pitfall 5).

### Pattern 8: `HumynBeep` Audibility Fix (D-09 Wave 1)

**What:** Change `HumynBeepModule.kt:99-104` from `USAGE_ASSISTANCE_SONIFICATION` + `CONTENT_TYPE_SONIFICATION` to `USAGE_MEDIA` + `CONTENT_TYPE_SONIFICATION` (or `CONTENT_TYPE_MUSIC`). Add instrumentation (Log.i) on each `pool.load()` return value, each `loadComplete` status, each `pool.play()` return value, and the Vibrator's `Vibrator.hasVibrator()` + `VibratorManager.getDefaultVibrator()` availability.

**Why the flip:** `USAGE_ASSISTANCE_SONIFICATION` routes to the "system" volume stream — distinct from "media" volume on AOSP devices; on a "max media volume" device with system volume at 0, the cue is silent [CITED: developer.android.com/reference/android/media/AudioAttributes]. The Phase-5 Item-5 walk observed exactly this. Switching to `USAGE_MEDIA` puts the cue on the media stream where the operator's volume control IS the relevant control. Sibling SDKs (`react-native-track-player`, ExoPlayer's own default — Pattern 7) all use `USAGE_MEDIA` for the same reason.

**Vibrator fix candidates:**

- **API-31+ Vibrator deprecation:** `Context.getSystemService(Vibrator::class.java)` works on all API levels but is deprecated on API 31+ in favor of `VibratorManager`. The fix is `if (Build.VERSION.SDK_INT >= 31) (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator else (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator)`. Without this, `Vibrator.vibrate(...)` may silently fail on Android 16.
- **`VIBRATE` permission:** Must be declared in `apps/mobile/android/app/src/main/AndroidManifest.xml`. Wave 1 must `grep VIBRATE android/app/src/main/AndroidManifest.xml` and add `<uses-permission android:name="android.permission.VIBRATE" />` if absent (a runtime no-op on most devices but mandatory on some OEMs and on the Pixel 10a Android 16 build).
- **`VibrationEffect` API surface:** API ≥26 mandates `Vibrator.vibrate(VibrationEffect.createWaveform([0,100,50,100], -1))` instead of the deprecated raw long-array overload [CITED: developer.android.com/reference/android/os/VibratorManager]. `useRecordingLifecycle.ts:309 / 341` currently calls `Vibration.vibrate([0, 100, 50, 100])` (RN's `Vibration` module) — this DOES translate to `VibrationEffect.createWaveform` on API 26+ per RN's RCTVibrator. So the RN path is probably OK; the issue is more likely on the SoundPool side, with the Vibrator path being a defensive audit.

**Wave 1 acceptance criteria:**

- On Pixel 10a Android 16 at MAX media volume, the 520 Hz battery beep is audible.
- On Pixel 10a Android 16, the 440→560→680 Hz thermal sequence is audible.
- The `[100,50,100]ms` battery vibrate and 800 ms thermal vibrate are felt.
- Robolectric: a unit test that asserts `SoundPool.Builder.setAudioAttributes(...)` is called with `USAGE_MEDIA`. (The actual audibility is device-only and not unit-testable.)

### Anti-Patterns to Avoid

- **Polling `/recordings/:id/stream-url` until `archiveState != 'unavailable'`.** The CONTEXT explicitly defers auto-retry to §v2. Just show "Still uploading — try again in a moment." and let the user re-tap.
- **Pre-fetching stream URLs on the History row list.** Wastes URL TTL and rate-limit budget; mint lazily on Player open. (Documented in design-decisions.)
- **Inlining `lucide-react` (web) in design-system/task-icons** — breaks RN bundle. Port to `lucide-react-native` first (Q-2).
- **Hand-rolling a date-picker for §16b custom range.** Use the platform's native date picker via a thin RN wrapper (recommendation: `react-native-date-picker` or the platform `DatePickerAndroid` API). Decide during planning; for MVP a HTML-style date input is overkill on a phone.
- **Calling `pool.load()` synchronously in the rate-limit-key path.** Already mitigated in current `HumynBeepModule.kt` (`pool.load()` is async, the `OnLoadCompleteListener` queues plays). Don't regress.
- **Server-side bytes read on stream-url.** The CAP-18 invariant says files travel byte-for-byte device → S3 → user — the server NEVER reads the bytes. The stream-url route only mints a signed URL; bytes flow CloudFront/S3 → device directly.
- **Returning `playback_url: null` with a 200 OK.** Use a discriminated response (`archiveState` field) so the client switch is type-safe. Don't overload `null`.
- **Sharing a single `ExoPlayer` instance across Player route remounts.** Create-on-`prepare()`, release-on-unmount or on JS module invalidate. ExoPlayer leaks codec resources if you forget [CITED: developer.android.com/media/media3/exoplayer].

---

## Don't Hand-Roll

| Problem                       | Don't Build                                 | Use Instead                                                                     | Why                                                                                                                                    |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| HEVC video playback           | A custom `MediaCodec` decoder + render loop | `androidx.media3:media3-exoplayer:1.10.0`                                       | ExoPlayer handles HEVC, seek, buffering, codec fallback, audio focus, and audio-becoming-noisy. ~150 LOC wrapper vs. ~2000 LOC custom. |
| First-frame thumbnail         | Custom `MediaCodec` decoder                 | `android.media.MediaMetadataRetriever` with `OPTION_CLOSEST_SYNC` at `timeUs=0` | Built-in, ~20-50 ms per extract.                                                                                                       |
| Trigram fuzzy search          | Levenshtein in TS                           | Postgres `pg_trgm` extension                                                    | Built-in to PG, GIN-indexable, faster than client-side at scale.                                                                       |
| Day-grouped scrollable list   | Manual FlatList + sticky-header overlay     | `<SectionList>`                                                                 | RN ships sticky headers + group-keyed render.                                                                                          |
| MMKV ledger schema versioning | Custom version field + migration            | Per-key MMKV stash (`pendingThumb.{recordingId}`)                               | Phase 5 pattern; absent keys mean "no ledger entry"; no migration needed.                                                              |
| Time-range button cluster     | Custom popover                              | The existing `Filter sheet` from design-spec §16                                | Already designed; same sheet primitive used today by Profile/Logout/Delete confirmations (transparent-modal Pattern 2:plan 02-19).     |
| Native Date Picker            | HTML-style date input                       | `@react-native-community/datetimepicker` (or platform date picker)              | Phones do not have keyboards; use the native picker. Planner picks; not load-bearing for the data model.                               |
| Network availability signal   | Custom `ConnectivityManager` listener       | Existing Phase-5 `NetworkMonitor.kt`                                            | Already wired; surface via a new event on the existing `HumynUpload` emitter.                                                          |
| Vibration patterns            | Raw `Vibration.vibrate([...])`              | `VibrationEffect.createWaveform` on API ≥26                                     | Already done by RN's `Vibration` module; verify but don't replace.                                                                     |

**Key insight:** This phase is 90% UI-wiring against shipped backend infrastructure. The only new native surface is `HumynPlayer` (~200 LOC) + a thumbnail helper (~30 LOC). Everything else is composing primitives that already exist.

---

## Runtime State Inventory

> This is primarily a NEW-FEATURE phase (not a rename/refactor) — included for completeness because Phase 6 does touch runtime state in Wave 1 (the SoundPool fix) and Wave 3 (the MMKV thumbnail ledger).

| Category            | Items Found                                                                                                                                                                                                                                                                                                                       | Action Required                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Stored data         | (1) MMKV: new per-key namespace `pendingThumb.{recordingId}` will be added by Wave 3. Existing keys (`auth.jwt.v1`, `pendingUploadQueue`, etc.) untouched. (2) Postgres: no schema changes to existing tables. New extension `pg_trgm` enabled via migration 0007. The HNSW index + `embedding` column STAY for §v2 SEARCH-V2-01. | Code edits only; no data migration on existing tables.                                                                            |
| Live service config | None — no n8n / Datadog / Cloudflare resources referenced in Phase 6.                                                                                                                                                                                                                                                             | None — verified by grep of CONTEXT.md + ROADMAP Phase 6 section.                                                                  |
| OS-registered state | None — no Windows / launchd / pm2 references.                                                                                                                                                                                                                                                                                     | None — verified by grep.                                                                                                          |
| Secrets/env vars    | (1) `CLOUDFRONT_RECORDINGS_PRIVATE_KEY` / `CLOUDFRONT_RECORDINGS_KEY_PAIR_ID` / `CLOUDFRONT_RECORDINGS_BASE_URL` — already set in prod for `/recordings/:id`; reused by `/recordings/:id/stream-url` if we pick CloudFront-signed (recommended). (2) No new env var needed for `pg_trgm`.                                         | Verify the CloudFront env trio is loaded in the dev compose stack if e2e tests need a signer; otherwise mock the signer in tests. |
| Build artifacts     | None — no installed packages to refresh from this phase's edits. The `media3-exoplayer:1.10.0` dep adds ~1.5 MB to the APK (`media3-exoplayer:1.8.0` aar = 1.5 MB per Maven Central; 1.10 is comparable).                                                                                                                         | None beyond the standard `./gradlew :app:assembleApkRolloutDebug` rebuild.                                                        |

---

## Common Pitfalls

### Pitfall 1: Sticky Section Headers Hurt Android Performance

**What goes wrong:** On Android, `<SectionList stickySectionHeadersEnabled>` causes janky scroll over ~100 rows.
**Why it happens:** RN's sticky-header implementation forces a re-layout per scroll tick on the platform.
**How to avoid:** Test on Pixel 10a. If perf regresses, set `stickySectionHeadersEnabled={false}` and accept scrolling day headers.
**Warning signs:** 60→30 FPS drop on the Pixel 10a History scroll. [CITED: dev.to/swarnaliroy94/react-native-flatlist-or-sectionlist].

### Pitfall 2: `MediaMetadataRetriever.setDataSource` Leaks on Throw

**What goes wrong:** A throw inside `setDataSource(path)` leaves the retriever in a half-initialized state; failing to call `release()` leaks the underlying media-server handle.
**Why it happens:** Native resource not Java-GC'd.
**How to avoid:** Wrap in `try { ... } finally { retriever.release() }` (sketched in Pattern 5).
**Warning signs:** "media server died" log entries after a few hundred extracts.

### Pitfall 3: LocalStack Does Not Implement CloudFront-Signer

**What goes wrong:** If the planner picks CloudFront-signed (recommended for prod parity), e2e tests against LocalStack will fail because LocalStack 4.x does not implement CloudFront content distribution.
**Why it happens:** LocalStack focuses on S3, SQS, Lambda; CloudFront is Pro-tier and even there partial.
**How to avoid:** Mock `@aws-sdk/cloudfront-signer`'s `getSignedUrl` in tests (return a stub URL with `?expires=...`); the existing `/recordings/:id` route's tests already do this if you grep for it. Or — fall back to `@aws-sdk/s3-request-presigner` for dev only, but that creates two URL families (prod = CloudFront, dev = S3) which complicates the runbook.
**Warning signs:** `e2e/recordings/stream-url.test.ts` fails with `Error: CLOUDFRONT_RECORDINGS_PRIVATE_KEY missing` even when LocalStack is up.

### Pitfall 4: `pg_trgm` Default Threshold Is Session-Level

**What goes wrong:** `pg_trgm.similarity_threshold` is a session-level setting. The `%` operator uses it. If the planner ever changes the threshold mid-session (a future plan), the search results diverge from the design-spec.
**Why it happens:** `pg_trgm.similarity_threshold` is a runtime setting, not a per-query knob, and defaults to 0.3 [CITED: postgresql.org/docs/current/pgtrgm.html].
**How to avoid:** Use `similarity(...) > 0.3` explicitly in the WHERE clause rather than `name % $q`, so the threshold is hard-coded in the route — independent of session state. (Alternative: keep `%` but `SET LOCAL pg_trgm.similarity_threshold = 0.3` at route start.) Researcher recommends the explicit `similarity(...) > 0.3` form.
**Warning signs:** Tests that pass locally fail in CI because the test connection has a different session default.

### Pitfall 5: TextureView Surface Loss on Background

**What goes wrong:** When the app goes to background, the `TextureView`'s `SurfaceTexture` is destroyed; ExoPlayer logs an error and stops rendering. On foreground return, `player.setVideoTextureView(textureView)` must be re-called.
**Why it happens:** Android lifecycle.
**How to avoid:** Hook `LifecycleEventListener` in `HumynPlayerModule` (mirrors `HumynCaptureModule`'s existing `LifecycleEventListener` Plan 04-10 pattern); on `onHostPause` call `player.pause()`, on `onHostResume` re-bind the surface if the view is still mounted. Document the assumption that the Player route is full-bleed and does NOT background mid-playback unless the OS evicts it.
**Warning signs:** Player shows black frame on resume; logcat "no surface available".

### Pitfall 6: `_events` Onsend-Hook Envelope Breaks Strict Response Schemas

**What goes wrong:** The Phase-5 `events-outbox` hook (`apps/api/src/plugins/events-outbox.ts`) piggy-backs `_events` on every authenticated response. New routes that declare a strict `response.200` schema reject the envelope.
**Why it happens:** Zod-strict schema doesn't permit unknown keys.
**How to avoid:** Pattern 22 — DO NOT declare `response.200` on routes that also return problem-detail 400s, AND extend response schemas with the optional `_events: z.array(RecordingServerEventSchema).optional()` key per `apps/api/src/routes/recordings/schemas.ts:28`. Apply to all three new/edited routes (`/recordings/:id/stream-url`, the extended `/recordings`, the extended `/contributions/timeseries`).
**Warning signs:** "response does not match schema" 500s on the strict serializer.

### Pitfall 7: Lucide-React-Native API Drift

**What goes wrong:** `lucide-react-native` 1.14.0 uses different exports than `lucide-react` (web) in some icon families.
**Why it happens:** Different bundler targets; some icons renamed in the RN port.
**How to avoid:** When porting `TaskIcon.tsx` (Q-2), verify each of the 65 mapped icons exists in `lucide-react-native` 1.14.0 — the README explicitly calls out `BrushCleaning`, `ShowerHead`, `Tractor`, `Container` as requiring lucide-react ≥0.400. The RN port pinned at 1.14.0 should be inspected for these four names; mapping.ts's typed `LucideIconName` union will fail the typecheck if any are missing.
**Warning signs:** Compile error "Module has no exported member 'BrushCleaning'".

### Pitfall 8: `practiceDoneKey(sub)` Pattern vs. Global Ledger Keys

**What goes wrong:** Phase 4's `practiceDoneKey(sub)` is per-user; if the planner copies that pattern verbatim for the thumbnail ledger and the user logs out, the ledger entries leak to the next user OR vanish on logout.
**Why it happens:** Phase 5's `signOut()` clears `auth.jwt.v1` + onboarding flags but explicitly preserves device-bound MMKV (compat.lastResult, installation_id) — see Pattern 48 in STATE.
**How to avoid:** Use `pendingThumb.{recordingId}` (NOT per-user-keyed) — the `recordingId` IS the natural index, and the row truth-source (server `GET /recordings`) is already per-user-authed. Don't double-scope. Log out preserves the ledger; the next sign-in's first `/recordings` fetch effectively GCs orphan ledger entries via D-04a's opportunistic cleanup.
**Warning signs:** History thumbnails missing after logout/login of the SAME user.

---

## Code Examples

### Example 1: 200 ms-Debounced Lexical Search

```typescript
// Source: design-spec §10 (200 ms debounce) + verified shape from
// services/feedbackService.ts (existing async + timeout pattern)
import { useEffect, useState } from 'react';
import { getJson } from '../services/api';
import type { TasksSearchResponse } from '@humyn/shared-types';

export function useTaskSearch(query: string): {
  results: TasksSearchResponse['items'] | null;
  loading: boolean;
  error: Error | null;
} {
  const [state, setState] = useState({ results: null, loading: false, error: null });
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setState({ results: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<TasksSearchResponse>('/tasks/search', {
          query: { q: trimmed },
          timeoutMs: 5000,
        });
        if (!ctrl.signal.aborted) setState({ results: data.items, loading: false, error: null });
      } catch (e) {
        if (!ctrl.signal.aborted) setState({ results: null, loading: false, error: e as Error });
      }
    }, 200); // design-spec §10 debounce
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);
  return state;
}
```

### Example 2: Filter Sheet — 6 Named Windows + Custom Range

```tsx
// Source: design-spec §16 verbatim copy; researcher-recommended structure
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../ui/primitives/Text';

const OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this-week', label: 'This week' },
  { id: 'this-month', label: 'This month' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
] as const;

export function FilterSheet({
  value,
  onSelect,
  onCustomRange,
}: {
  value: string;
  onSelect: (id: string) => void;
  onCustomRange: () => void;
}) {
  return (
    <View accessibilityLabel="filter-sheet" /* ...sheet wrapper... */>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          accessibilityRole="button"
          accessibilityLabel={`filter-option-${opt.id}`}
          onPress={() => (opt.id === 'custom' ? onCustomRange() : onSelect(opt.id))}
          /* ...row styles... */
        >
          <Text style={value === opt.id ? selectedStyle : labelStyle}>{opt.label}</Text>
          {value === opt.id ? <Check size={20} color={accent} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
```

### Example 3: HumynPlayer JS Bridge Shape

```typescript
// Source: D-07 + verified shape mirror from HumynUpload.ts and HumynCapture.ts
import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';

export type PlayerProgressEvent = { positionMs: number; bufferedMs: number; durationMs: number };
export type PlayerBufferEvent = { buffering: boolean };
export type PlayerErrorEvent = { code: number; msg: string };

interface HumynPlayerNativeModule {
  prepare(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(ms: number): Promise<void>;
}

function ensure(): HumynPlayerNativeModule {
  const native = NativeModules.HumynPlayer as HumynPlayerNativeModule | undefined;
  if (!native) throw new Error('HumynPlayer native module not registered');
  return native;
}

export const HumynPlayer = {
  prepare: (uri: string) => ensure().prepare(uri),
  play: () => ensure().play(),
  pause: () => ensure().pause(),
  seekTo: (ms: number) => ensure().seekTo(ms),
} as const;

let _emitter: NativeEventEmitter | null = null;
function emitter() {
  if (_emitter == null) _emitter = new NativeEventEmitter(NativeModules.HumynPlayer);
  return _emitter;
}
export function onProgress(l: (e: PlayerProgressEvent) => void): EmitterSubscription {
  return emitter().addListener('onProgress', l);
}
export function onBuffer(l: (e: PlayerBufferEvent) => void): EmitterSubscription {
  return emitter().addListener('onBuffer', l);
}
export function onEnd(l: () => void): EmitterSubscription {
  return emitter().addListener('onEnd', l);
}
export function onError(l: (e: PlayerErrorEvent) => void): EmitterSubscription {
  return emitter().addListener('onError', l);
}
```

---

## State of the Art

| Old Approach                                     | Current Approach                       | When Changed             | Impact                                                                                      |
| ------------------------------------------------ | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| ExoPlayer 2.x via `com.google.android.exoplayer` | `androidx.media3:media3-exoplayer`     | 2023 (media3 1.0)        | Same engine, renamed namespace. We're on 1.10 — current.                                    |
| RRF (k=60) hybrid client-side search             | `ts_vector` lexical-only (Phase 6 MVP) | 2026-05-11 owner descope | Backend pipeline still ships; client doesn't call it. §v2 SEARCH-V2-01 reinstates.          |
| `MediaPlayer` for HEVC                           | `ExoPlayer` (media3)                   | Android 5.0+             | More robust HEVC seek, codec fallback, buffering events.                                    |
| `Vibrator` (deprecated API 31+)                  | `VibratorManager.getDefaultVibrator()` | API 31 (Android 12)      | Same behavior; new API needed for forward-compat. Wave 1 must use the version-guarded form. |
| `AsyncStorage`                                   | `react-native-mmkv`                    | Phase 1 lock             | Already done.                                                                               |
| `react-native-video`                             | Hand-rolled `HumynPlayer`              | Phase 6 D-07             | Matches hand-rolled native module pattern; no new RN dep.                                   |

**Deprecated/outdated:**

- `com.google.android.exoplayer` (the v2 namespace) — DO NOT USE. We migrate to / are on `androidx.media3`.
- `MediaMetadataRetriever.getFrameAtTime(long)` (no flags) — use the 2-arg form with `OPTION_CLOSEST_SYNC`.

---

## Assumptions Log

| #   | Claim                                                                                                                                     | Section        | Risk if Wrong                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | `androidx.media3:media3-exoplayer:1.10.0` adds ~1.5 MB to APK                                                                             | Standard Stack | If significantly larger, APK distribution gets fatter; user impact minimal at MVP scale. The 1.8.0 figure is from Maven Central; 1.10 size not explicitly verified.            |
| A2  | `lucide-react-native@1.14.0` ships `BrushCleaning`/`ShowerHead`/`Tractor`/`Container` icons                                               | Pitfall 7      | Compile error if any missing; trivial to swap in fallbacks (the README lists them).                                                                                            |
| A3  | Pixel 10a Android 16 SoundPool silence is caused by `USAGE_ASSISTANCE_SONIFICATION` routing to "system" stream                            | Pattern 8      | If wrong, Wave 1 must continue debugging via instrumentation (which is part of D-09's scope anyway).                                                                           |
| A4  | `MediaMetadataRetriever.getFrameAtTime(0, OPTION_CLOSEST_SYNC)` returns a non-null bitmap for HEVC Main profile on Pixel 7a-class devices | Pattern 5      | If null, the thumbnail slot renders the gradient + first-letter fallback (D-04 already specifies this). Best-effort by design.                                                 |
| A5  | `pg_trgm.similarity_threshold = 0.3` is the right recall point for the 65-task fixture                                                    | D-02           | If over-recalls, bump to 0.4. Tune in the same plan that lands the migration.                                                                                                  |
| A6  | Local-tz "this week" starts on Monday for India/Brazil                                                                                    | Pattern 2      | Easy to flip to Sunday-start by changing one expression. Researcher recommends Monday; planner can re-pick.                                                                    |
| A7  | Phase-5 `NetworkMonitor.kt` can surface a JS-side `offline: boolean` signal cheaply                                                       | HOME-10        | If the existing module doesn't emit a bridge event, Wave 4 needs a new ~30-LOC native event. Defensive: leave a planner-pick in the plan for this.                             |
| A8  | Reusing CloudFront-signed (not S3 presigned) for `/recordings/:id/stream-url` is owner-approved                                           | D-08 + Q-1     | Open question — owner picked "you decide" with the S3 presigned mention; researcher recommends CloudFront for prod parity. Surface in the plan as a fork choice if it matters. |

---

## Open Questions (RESOLVED)

> All five questions resolved during planning. The selected choice for each is now adopted in the Phase-6 plans (cross-reference noted per question). No outstanding planner discretion left.

### Q-1. **D-08 Stream URL — CloudFront-signed or S3 presigned?**

- **What we know:** D-08 wording in CONTEXT mentions `PRESIGNED_TTL_SECONDS` from `apps/api/src/lib/s3-client.ts`, suggesting S3 presigned. But the shipped `/recordings/:id` route already mints **CloudFront-signed** URLs via `@aws-sdk/cloudfront-signer` (`apps/api/src/routes/recordings/get.ts:88-95`). The S3 presigned path is used for upload PUTs, not downloads.
- **What's unclear:** Does the owner want the new route to use CloudFront-signed (prod parity with `/recordings/:id`) or S3 presigned (mentioned in CONTEXT)?
- **RESOLVED:** **CloudFront-signed** — prod parity with the existing `/recordings/:id` route, cheaper egress, cache hits, reuses the same env contract. `PRESIGNED_TTL_SECONDS` in CONTEXT was a docs reference, not a binding signer choice. The new `/recordings/:id/stream-url` route sets TTL to 5 min per D-08. Adopted in **Plan 06-03 Task 3**.

### Q-2. **TaskIcon must be ported to `lucide-react-native`.**

- **What we know:** `design-system/task-icons/TaskIcon.tsx:67` imports from `lucide-react` (web library, not the RN port). The repo already has a working `lucide-react-native`-based `Icon` primitive at `apps/mobile/src/ui/primitives/Icon.tsx`.
- **What's unclear:** Should the planner edit the design-system `TaskIcon.tsx` to use `lucide-react-native`, OR add a `TaskIcon.native.tsx` sibling for RN consumers and leave the web version alone for future web/desktop builds?
- **RESOLVED:** **Add a `TaskIcon.native.tsx` sibling.** Metro's platform-specific module resolution picks `.native.tsx` over `.tsx` automatically. The web version stays alive for §v2 ARCH-V2-02 (web/desktop/tablet review-only client). No `mapping.ts` change needed; the `LucideIconName` union is identical between `lucide-react` and `lucide-react-native`. Adopted in **Plan 06-05** (Wave 3).

### Q-3. **Custom-range date picker library.**

- **What we know:** Design-spec §16b says "native HTML date inputs (`max=today`)" — but HTML date inputs are a poor UX on phones.
- **What's unclear:** Which native date picker should the planner pick? `@react-native-community/datetimepicker` is the de-facto pick.
- **RESOLVED:** Planner's discretion — chosen pick lands in **Plan 06-08 FilterSheet.tsx** (custom-range branch). Default: `@react-native-community/datetimepicker` (de-facto RN pick). Not load-bearing for the data model; the canonical contract is the `{ start, end }` ISO-date pair fed to `services/timeRange.ts` and onto `/contributions/timeseries?start=&end=` (D-03). If the picker library is skipped at planning time, the fallback is a `<TextInput>` per design-spec §16b verbatim.

### Q-4. **Day-grouping calendar boundary.**

- **What we know:** Design-spec §13 says day-group headers are e.g. **"Today"**, **"Yesterday"**, **"This week"**, **"May 2026"** — they switch labels based on recency.
- **What's unclear:** When is a row "this week" vs. "May 2026"? Researcher reads §13 to mean: rows from today and yesterday get their own headers; rows from earlier this week share a "This week" header; older rows in the same month share the month header (e.g., "May 2026"); older months get their own headers.
- **RESOLVED:** Researcher's read is adopted: rows from today → "Today"; yesterday → "Yesterday"; days 2–6 within current ISO-week → "This week"; older rows within the current calendar month → the month name (e.g., "May 2026"); older months → their own month header. Codified in **Plan 06-05 `services/historyGrouping.ts`**.

### Q-5. **`SearchX` icon availability in `lucide-react-native@1.14.0`.**

- **What we know:** TASK-10 / design-spec §10 State 4 specifies the `SearchX` icon for the no-results empty state.
- **What's unclear:** Whether `SearchX` exists in lucide-react-native 1.14.0 (it's confirmed in lucide-react ≥0.400 web).
- **RESOLVED:** Spot-check at execute time — **Plan 06-07 Task 2** writes `import { SearchX } from 'lucide-react-native'` and lets the TypeScript build settle the question. If the export is absent in 1.14.0, fall back to `Search` + strikethrough overlay (or `XCircle`). Documented in Plan 06-07 acceptance criteria.

---

## Environment Availability

| Dependency                                | Required By                                                                            | Available                                                            | Version  | Fallback                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| PostgreSQL 16/17                          | `pg_trgm` migration, lexical search                                                    | ✓ (LocalStack dev compose; verified Phase 1)                         | 17.x     | —                                                                                                         |
| pgvector extension                        | (Phase-6 unused — kept for §v2; the HNSW index stays even though we descope the query) | ✓                                                                    | 0.8.x    | —                                                                                                         |
| `androidx.media3:media3-exoplayer:1.10.0` | HumynPlayer (Wave 5)                                                                   | ✓ (Google Maven; same minor as `media3-muxer:1.10.0` already pinned) | 1.10.0   | None — locked.                                                                                            |
| `android.media.MediaMetadataRetriever`    | Thumbnail extract (Wave 3)                                                             | ✓ (platform, API ≥21)                                                | platform | None — locked.                                                                                            |
| `android.media.SoundPool`                 | D-09 fix (Wave 1)                                                                      | ✓ (platform)                                                         | platform | None — already in tree.                                                                                   |
| `android.os.VibratorManager`              | D-09 fix (Wave 1)                                                                      | ✓ (platform, API ≥31)                                                | platform | Fall back to `Vibrator` on API <31 (version-guarded — see Pattern 8).                                     |
| `@aws-sdk/cloudfront-signer`              | D-08 stream-URL (recommended path)                                                     | ✓ (Phase 1)                                                          | 3.1036.0 | `@aws-sdk/s3-request-presigner@3.1044.0` (Phase 1) — see Q-1.                                             |
| `lucide-react-native`                     | TaskIcon port (Q-2) + all phase-6 icons                                                | ✓                                                                    | 1.14.0   | None — locked at 1.14.0.                                                                                  |
| `react-native-haptic-feedback`            | Filter sheet + row tap haptics                                                         | ✓                                                                    | 2.3.3    | RN's `Vibration` module (already used in `useRecordingLifecycle.ts`).                                     |
| Pixel 10a + Android 16 dev device         | Wave 1 audibility verification                                                         | ✓ (operator hardware confirmed Phase 5)                              | —        | —                                                                                                         |
| `@react-native-community/datetimepicker`  | Custom-range date picker (Q-3)                                                         | ✗ (not in package.json)                                              | —        | Hand-rolled `<TextInput>` matching design-spec §16b verbatim — but bad phone UX. Recommend installing it. |

**Missing dependencies with no fallback:**

- None — every Phase-6 dependency is either in-tree or platform-native.

**Missing dependencies with fallback:**

- `@react-native-community/datetimepicker` — fallback is hand-rolled text inputs (worse UX; planner picks).

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | `vitest@4.1.5` (mobile + backend) + Robolectric `4.16.1` (Kotlin host JVM)                                                                                                        |
| Config file        | `apps/mobile/vitest.config.ts`, `apps/api/vitest.config.ts` (unit), `apps/api/vitest.e2e.config.ts` (e2e)                                                                         |
| Quick run command  | `npm run test --workspace=apps/mobile -- --run` / `npm run test --workspace=apps/api -- --run`                                                                                    |
| Full suite command | `npm run test --workspace=apps/mobile` + `npm run test --workspace=apps/api` + e2e `npm run test:e2e --workspace=apps/api` + Android `./gradlew :app:testApkRolloutDebugUnitTest` |
| Phase gate         | Full suite green + manual smoke on Pixel 10a (see `06-MANUAL-SMOKE.md` to be authored)                                                                                            |

### Phase Requirements → Test Map

| Req ID               | Behavior                                                     | Test Type                                      | Automated Command                                                                         | File Exists?      |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| TASK-01              | 65 tasks load from `/tasks` paginated                        | integration (backend)                          | `npm run test --workspace=apps/api -- src/routes/tasks/list.test.ts`                      | ✅                |
| TASK-02              | Per-category pills filter the grid                           | unit (mobile)                                  | `npm run test --workspace=apps/mobile -- src/screens/tasks/TasksScreen.test.tsx`          | ❌ Wave 0         |
| TASK-03              | 200 ms debounce + lexical search                             | unit + e2e                                     | `vitest -- src/services/tasksApi.test.ts` + e2e against `/tasks/search`                   | ❌ Wave 0         |
| TASK-03 fuzzy        | `pg_trgm` zero-row fallback                                  | integration (backend)                          | `npm run test --workspace=apps/api -- src/routes/tasks/search.test.ts` (extend)           | ✅ (extend)       |
| TASK-04              | TaskCard renders correct lucide icon                         | unit (mobile)                                  | `vitest -- src/components/TaskCard.test.tsx`                                              | ❌ Wave 0         |
| TASK-05              | Task details sheet — Universal block + per-task instructions | unit (mobile)                                  | `vitest -- src/screens/tasks/TaskDetailsSheet.test.tsx`                                   | ❌ Wave 0         |
| TASK-06              | 4 Universal rules hard-coded with correct icons              | unit (mobile)                                  | included in TaskDetailsSheet.test.tsx                                                     | ❌ Wave 0         |
| TASK-07              | Server seed honors max-3 + no universal-rule duplicates      | integration (Phase 1 seed test)                | already covered in Phase 1 seed                                                           | ✅                |
| TASK-08              | Send Request submits 3-80/10-240 + multipart video           | unit + e2e                                     | `vitest -- src/services/taskRequestService.test.ts` + e2e POST `/task-requests`           | ❌ Wave 0         |
| TASK-09              | No request-status surface                                    | unit (mobile, negative test)                   | `vitest -- src/screens/tasks/SendRequestSheet.test.tsx` (asserts no status chip rendered) | ❌ Wave 0         |
| TASK-10              | No-results state with SearchX + send-request link            | unit (mobile)                                  | `vitest -- src/screens/tasks/TasksScreen.test.tsx` (no-results case)                      | ❌ Wave 0         |
| HOME-01              | First-time empty hero                                        | unit (mobile)                                  | `vitest -- src/screens/home/HomeScreen.test.tsx` (empty state)                            | ❌ Wave 0         |
| HOME-02              | Returning hero with lifetime + task count                    | unit (mobile)                                  | `vitest -- src/screens/home/HomeScreen.test.tsx` (returning state)                        | ❌ Wave 0         |
| HOME-03/04           | Time-range toggles re-fetch + re-render                      | unit + integration                             | mobile mock + backend `/contributions/timeseries?start=&end=`                             | ❌ Wave 0         |
| HOME-05              | Pending Uploads tile visible only when count > 0             | unit (mobile)                                  | extends existing `HomeSkeletonScreen.test.tsx`                                            | ✅ (extend)       |
| HOME-06              | Duration formatter                                           | unit (mobile)                                  | `vitest -- src/services/durationFormatter.test.ts`                                        | ✅                |
| HOME-09              | Pull-to-refresh fires `/contributions`                       | unit (mobile)                                  | `vitest -- src/screens/home/HomeScreen.test.tsx` (RefreshControl onRefresh)               | ❌ Wave 0         |
| HOME-10              | Offline banner                                               | unit (mobile)                                  | with mocked NetworkMonitor signal                                                         | ❌ Wave 0         |
| HIST-01              | Successful recordings appear regardless of upload state      | integration                                    | extends `apps/api/src/routes/recordings/list.test.ts`                                     | ✅ (extend)       |
| HIST-02              | Day-group newest-first                                       | unit (mobile)                                  | `vitest -- src/screens/history/HistoryScreen.test.tsx` (grouping)                         | ❌ Wave 0         |
| HIST-03              | Filter by 6 time-ranges                                      | unit + integration                             | same as HOME-03                                                                           | ❌ Wave 0         |
| HIST-04/05           | Empty states                                                 | unit (mobile)                                  | `vitest -- src/screens/history/HistoryScreen.test.tsx` (empty variants)                   | ❌ Wave 0         |
| HIST-06              | Row layout + thumbnail overlay                               | unit (mobile)                                  | `vitest -- src/components/HistoryRow.test.tsx`                                            | ❌ Wave 0         |
| HIST-07              | Player opens for local MP4                                   | unit (mobile, mocked HumynPlayer)              | `vitest -- src/screens/history/PlayerScreen.test.tsx` (local source)                      | ❌ Wave 0         |
| HIST-08              | Player streams when local cleared                            | unit (mobile) + integration (backend)          | mocked + `/recordings/:id/stream-url` route test                                          | ❌ Wave 0         |
| HIST-08 deep-archive | >90 d row shows disabled message                             | unit + integration                             | `archiveState='deep-archive'` path tests                                                  | ❌ Wave 0         |
| HIST-09              | Streaming uploaded recordings is IN MVP                      | (covered by HIST-08 tests)                     | —                                                                                         | ❌ Wave 0         |
| HIST-10              | No delete affordance anywhere                                | unit (mobile, negative tests)                  | grep + structural test                                                                    | manual smoke only |
| HIST-11              | Feedback (coming soon) button slot                           | unit (mobile)                                  | `vitest -- src/components/HistoryRow.test.tsx` (disabled chip present)                    | ❌ Wave 0         |
| D-05 thumbnail       | First-frame extraction writes to thumbs/                     | unit (Kotlin Robolectric)                      | `./gradlew :app:testApkRolloutDebugUnitTest` → `ThumbnailExtractorTest`                   | ❌ Wave 0         |
| D-07 player          | ExoPlayer prepares local + remote URI                        | unit (Kotlin Robolectric, with fake ExoPlayer) | `HumynPlayerModuleTest`                                                                   | ❌ Wave 0         |
| D-08 stream-url      | All four archive states                                      | integration (backend)                          | `vitest -- src/routes/recordings/stream-url.test.ts`                                      | ❌ Wave 0         |
| D-09 SoundPool       | `AudioAttributes.USAGE_MEDIA` used                           | unit (Kotlin Robolectric)                      | extends `HumynBeepModuleTest` (if exists)                                                 | ❌ Wave 0         |

### Sampling Rate

- **Per task commit:** Run the mobile vitest matching that screen + the backend vitest for the route touched. ≈ 20 s.
- **Per wave merge:** Full vitest suite + Robolectric. ≈ 4 min.
- **Phase gate:** Full suite green + Pixel 10a manual smoke (`06-MANUAL-SMOKE.md` to be authored — mirrors `05-MANUAL-SMOKE.md` Pattern 56 shape).

### Wave 0 Gaps

- [ ] `apps/mobile/src/screens/tasks/TasksScreen.test.tsx`
- [ ] `apps/mobile/src/screens/tasks/TaskDetailsSheet.test.tsx`
- [ ] `apps/mobile/src/screens/tasks/SendRequestSheet.test.tsx`
- [ ] `apps/mobile/src/screens/home/HomeScreen.test.tsx`
- [ ] `apps/mobile/src/screens/history/HistoryScreen.test.tsx`
- [ ] `apps/mobile/src/screens/history/PlayerScreen.test.tsx`
- [ ] `apps/mobile/src/components/TaskCard.test.tsx`
- [ ] `apps/mobile/src/components/HistoryRow.test.tsx`
- [ ] `apps/mobile/src/services/tasksApi.test.ts`
- [ ] `apps/mobile/src/services/recordingsApi.test.ts`
- [ ] `apps/mobile/src/services/contributionsApi.test.ts`
- [ ] `apps/mobile/src/services/taskRequestService.test.ts`
- [ ] `apps/mobile/src/services/timeRange.test.ts`
- [ ] `apps/mobile/src/services/thumbnailLedger.test.ts`
- [ ] `apps/api/src/routes/tasks/search.test.ts` — extend existing for pg_trgm fallback
- [ ] `apps/api/src/routes/recordings/list.test.ts` — extend existing for `start`/`end` params
- [ ] `apps/api/src/routes/recordings/stream-url.test.ts` (NEW)
- [ ] `apps/api/src/routes/contributions/timeseries.test.ts` — extend existing for `start`/`end`
- [ ] `apps/mobile/android/app/src/test/java/.../player/HumynPlayerModuleTest.kt` (NEW Robolectric)
- [ ] `apps/mobile/android/app/src/test/java/.../capture/ThumbnailExtractorTest.kt` (NEW Robolectric)
- [ ] Existing `HumynBeepModuleTest.kt` extension to assert USAGE_MEDIA + decode-then-play path

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                               |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | `requireAuth` preHandler on all phase-6 authenticated routes; per-user rate-limit keyed by `user:${sub}`                                                                                                                                       |
| V3 Session Management | yes     | JWT-based session already in place; no Phase 6 changes                                                                                                                                                                                         |
| V4 Access Control     | yes     | `WHERE user_id = $sub` on every recording/contribution query — no cross-user reads. `qa_status NOT IN ('takedown','rejected','pending')` on `/recordings/:id/stream-url` per D-08                                                              |
| V5 Input Validation   | yes     | Zod schemas on all route params + query strings: `RecordingsListQuerySchema` (extend with `start`/`end` ISO date validation), `TasksSearchQuerySchema` (existing), new `RecordingsStreamUrlParamsSchema` (mirrors `RecordingsGetParamsSchema`) |
| V6 Cryptography       | yes     | CloudFront-signed URL (or S3 presigned) — never hand-roll signature; keys in `process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY` (already in prod secrets manager)                                                                                 |

### Known Threat Patterns for {Fastify + Postgres + RN + S3} Stack

| Pattern                                                  | STRIDE                            | Standard Mitigation                                                                                                                                                                                                   |
| -------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-user recording access via guessed ULID             | Spoofing / Information Disclosure | `WHERE user_id = $sub` on every query; 404 (NOT 403) for cross-user / missing / takedown / rejected to avoid existence leak (T-1.7-10 — already Phase-1 pattern).                                                     |
| Stream-URL replay after takedown                         | Spoofing                          | URL TTL = 5 min (per D-08); takedown status flips immediately and next mint refuses with 404. Existing CloudFront-signed URL respects the original validity window — accepted tradeoff.                               |
| Tasks search SQL injection                               | Tampering                         | Drizzle `sql` template parameterises `q` + `category` (already in `search.ts:25`); `pg_trgm` operators `%` and `similarity()` also parameterised.                                                                     |
| `ts_vector` query bomb (huge q)                          | DoS                               | `TasksSearchQuerySchema` already limits `q.max(200)` (verified `shared/types/src/task.ts:48-52`).                                                                                                                     |
| pg_trgm scan over a million-row table                    | DoS                               | 65-row table; trigram scan is bounded. The GIN trigram index is OPTIONAL for this scale.                                                                                                                              |
| `start`/`end` date parameter abuse (massive window)      | DoS                               | Validate ISO date format (Zod); cap range to e.g. 5 years; existing `range='all'` is already unbounded so no new ceiling raised.                                                                                      |
| `Accept-Timezone` header injection                       | Tampering                         | Validate against IANA names via `Intl.DateTimeFormat(...).resolvedOptions().timeZone` round-trip; reject unknown with 400.                                                                                            |
| Per-user rate-limit bypass via stale JWT                 | Spoofing                          | Pattern 16 — disjoint user-bucket vs ip-bucket; `keyGenerator` does best-effort `jwtVerify()` first then falls back to `ip:`. Already in place across `/contributions`.                                               |
| Send Request multipart upload bomb (>50 MB)              | DoS                               | `@fastify/multipart` config caps body; client-side validates ≤30 s ≤50 MB before submit per D-10.                                                                                                                     |
| Local MP4 path traversal via thumbnail ledger            | Tampering                         | The MMKV ledger key IS the `recordingId` (server-issued ULID); native side derives `filesDir/thumbs/${base}.thumb.jpg` from `mp4File.nameWithoutExtension` — no user-controlled path component.                       |
| ExoPlayer URI scheme abuse (`file://` to arbitrary path) | Information Disclosure            | `HumynPlayerModule.prepare(uri)` should validate `uri` starts with `file://${filesDir}/recordings/` OR `https://${expectedCdnHost}/`; reject otherwise. Sandboxes the Player against a malicious JS-side bridge call. |

---

## Sources

### Primary (HIGH confidence)

- **In-tree code (verified via Read):**

  - `apps/api/src/routes/tasks/search.ts` (existing RRF hybrid → guts to lexical-only per D-01)
  - `apps/api/src/routes/tasks/list.ts` (existing — /tasks pagination)
  - `apps/api/src/routes/tasks/create-request.ts` (existing — POST /task-requests)
  - `apps/api/src/routes/recordings/list.ts` (existing — /recordings paginated)
  - `apps/api/src/routes/recordings/get.ts` (existing — CloudFront-signed playback URL; Q-1 evidence)
  - `apps/api/src/routes/recordings/schemas.ts` (extend with start/end)
  - `apps/api/src/routes/contributions/list.ts` + `apps/api/src/routes/contributions/timeseries.ts` (existing — Phase 1)
  - `apps/api/src/lib/s3-client.ts` (PRESIGNED_TTL_SECONDS, recordingKeys, S3 client)
  - `apps/api/src/plugins/rate-limit.ts` + `apps/api/src/lib/problem-detail.ts` (Phase 1 patterns)
  - `apps/api/src/db/migrations/0001_init.sql` + `0004_contributions_trigger_and_feedback_bucket.sql` (schema truth)
  - `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (the surface Phase 6 replaces)
  - `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` (Phase 5 reference for the row layout)
  - `apps/mobile/src/native/HumynUpload.ts` (reference shape for the new HumynPlayer.ts bridge)
  - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt` (D-09 Wave 1 target)
  - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt` (D-05a Wave 3 extension point)
  - `apps/mobile/android/app/build.gradle` (verified media3-muxer 1.10.0 pin — same minor as media3-exoplayer)
  - `apps/mobile/package.json` (verified all RN deps)
  - `design-spec.md` §§ 9, 10, 11, 12, 13, 14, 16, 20 (design source of truth)
  - `engineering-handoff.md` §§ 6, 7, 11 (audio/haptics, data model, telemetry)
  - `task-taxonomy.md` (65-task truth)
  - `design-system/task-icons/TaskIcon.tsx` (Q-2 evidence — imports `lucide-react` not `lucide-react-native`)
  - `CLAUDE.md` (tech stack pins, do-not-use list)
  - `.planning/REQUIREMENTS.md` (TASK-01..10, HOME-01..06+09+10, HIST-01..11, §v2 SEARCH-V2-01)
  - `.planning/ROADMAP.md` (Phase 6 section + carry-over banner)
  - `.planning/STATE.md` (Patterns 22, 28, 48, 71; Pattern 56 smoke-runbook shape)

- **Context7 / Official docs:**
  - `/androidx/media` library docs (ExoPlayer.Builder, Player.Listener, MediaItem.fromUri, setVideoTextureView)
  - `developer.android.com/jetpack/androidx/releases/media3` (Media3 1.10 release notes)
  - `android-developers.googleblog.com/2026/03/media3-110-is-out.html` (1.10 release announcement)
  - `developer.android.com/reference/android/media/MediaMetadataRetriever` (OPTION_CLOSEST_SYNC at timeUs=0)
  - `developer.android.com/reference/android/media/AudioAttributes` (USAGE_MEDIA vs USAGE_NOTIFICATION volume routing)
  - `developer.android.com/reference/android/media/SoundPool` (SoundPool.Builder API)
  - `developer.android.com/reference/android/os/VibratorManager` (API 31+ VibratorManager)
  - `reactnative.dev/docs/sectionlist` (SectionList vs FlatList tradeoffs)
  - `postgresql.org/docs/current/pgtrgm.html` (pg_trgm 0.3 default threshold, GIN index syntax)
  - `aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/` (getSignedUrl GetObjectCommand shape)

### Secondary (MEDIUM confidence)

- WebSearch results cross-verified against official:
  - SectionList sticky-header Android perf — DEV community write-ups + RN docs (verified via official docs).
  - Media3 1.10 dependency footprint — Maven Central (verified for 1.8.0 = 1.5 MB; 1.10 not explicitly verified, A1 assumption).

### Tertiary (LOW confidence)

- The exact root cause of the Pixel 10a Android 16 SoundPool silence (A3 assumption) — researcher's hypothesis is `USAGE_ASSISTANCE_SONIFICATION` routing to system stream; verification requires the device.

---

## Metadata

**Confidence breakdown:**

- Standard Stack: **HIGH** — every dep is already in the tree (verified via Read of `package.json` and `build.gradle`); media3-exoplayer 1.10.0 matches the already-pinned media3-muxer minor.
- Architecture: **HIGH** — every pattern mirrors a Phase 1-5 shipped pattern. The only new shape is the HumynPlayer view manager (single canonical 3-file native-module triad — sixth of its kind in the tree).
- Pitfalls: **MEDIUM-HIGH** — Pitfalls 1-7 are verified against shipped behavior + official docs; Pitfall 8 is a Phase-5 STATE Pattern.
- D-09 root cause: **MEDIUM** — `USAGE_MEDIA` flip is the most likely fix per AOSP docs but cannot be confirmed without a Pixel 10a / Android 16. Wave 1's instrumentation step is part of D-09's scope and resolves the uncertainty before the audibility fix lands.
- D-08 signing approach (CloudFront vs S3 presigned): **MEDIUM** — Q-1 surfaces the divergence between CONTEXT wording and the shipped pattern. Planner picks during planning.

**Research date:** 2026-05-14
**Valid until:** 2026-06-13 (30 days; media3 + RN + Postgres are stable; only the lucide-react-native icon availability for `BrushCleaning`/`ShowerHead`/`Tractor`/`Container`/`SearchX` should be re-verified if the planner waits past this window).
