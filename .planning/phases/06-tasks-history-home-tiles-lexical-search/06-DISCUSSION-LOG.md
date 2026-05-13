# Phase 6: Tasks, History, Home Tiles & Lexical Search — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 06-tasks-history-home-tiles-lexical-search
**Areas discussed:** Lexical search wiring, Time-range model, History data + thumbnails, In-app player (scope + tech), Stream-URL endpoint

---

## Lexical search wiring

| Option                           | Description                                                                                                                            | Selected |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Gut to lexical-only              | Replace route body with the lexical CTE alone. Embedder.ts + pgvector HNSW stay shipped but unreferenced. §v2 revives via git history. | ✓        |
| Add `?mode=lexical\|hybrid` flag | Keep both code paths; default to `lexical`; client always passes `lexical`.                                                            |          |
| Fork to a new lexical endpoint   | Introduce `/tasks/search/lexical`; keep `/tasks/search` at hybrid but unwired from MVP client.                                         |          |

**User's choice:** Gut to lexical-only.
**Notes:** Cleanest MVP. The pgvector HNSW index + the 384-float embedder stay alive in the codebase, just unused — §v2 SEARCH-V2-01 picks them back up. Wire-breaks the response field (`rrf_score` → `lex_score`) but the mobile client is the first consumer of `/tasks/search` so there's nothing to break in practice.

---

## Lexical fuzzy fallback

| Option                                | Description                                                                                                                                      | Selected |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `pg_trgm` similarity at threshold 0.3 | Add a fallback: if `ts_vector` returns 0 rows, retry with `name % $q OR description % $q` ordered by `greatest(similarity(...))`. Catches typos. | ✓        |
| `ILIKE %q%` prefix fallback           | Substring/prefix match, no extension. Less "fuzzy" — no typo tolerance.                                                                          |          |
| No fallback — reword TASK-03          | Skip fuzzy at MVP; let the empty state render.                                                                                                   |          |

**User's choice:** pg_trgm at threshold 0.3.
**Notes:** Adds `CREATE EXTENSION IF NOT EXISTS pg_trgm` migration. GIN trigram index on `tasks.name` is optional on a 65-row table. Researcher can re-tune 0.3 if it over-recalls.

---

## Time-range model (Home tiles + History filter)

| Option                                        | Description                                                                                                                                          | Selected |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Extend endpoints with `start`/`end` ISO dates | Add optional `start` + `end` to `/contributions/timeseries` and `/recordings`; keep `range` enum as convenience. Client computes named-window dates. | ✓        |
| Aggregate client-side from a single wide pull | Pull `/recordings?range=all` + `/contributions/timeseries=90d` once and bucket locally.                                                              |          |
| New `/contributions/range` aggregate endpoint | Separate single-aggregate route alongside the daily-bucket timeseries route.                                                                         |          |

**User's choice:** Extend endpoints with `start`/`end`.
**Notes:** Whether tiles read a thin aggregate endpoint or sum the timeseries buckets is planner's call (D-03a). Timezone handling: "this week" / "this month" use the device's local timezone (India/Brazil — stable single-tz-per-locale) — researcher picks Accept-Timezone header vs `tz=` query param vs implicit server-side coercion (Claude's discretion).

---

## History data source (truth)

| Option                                                        | Description                                                                                                                                                            | Selected |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Backend recordings + local overlay                            | `GET /recordings` is the row list; MMKV ledger overlays filename + thumbnail-path. On re-install rows survive, thumbnails are lost (fallback gradient + first letter). | ✓        |
| Local ledger only                                             | MMKV ledger is the truth. On re-install History is empty.                                                                                                              |          |
| Hybrid: backend truth + local cache, reconciled on cold start | Same as A in steady state, but adds a cold-start ledger ↔ `/recordings` reconcile pass.                                                                               |          |

**User's choice:** Backend recordings + local overlay.
**Notes:** No explicit cold-start reconcile sweep beyond Phase 5's `verified-ids` (uploadReconcile.ts) — opportunistic cleanup only, not load-bearing.

---

## Thumbnail generation timing

| Option                                             | Description                                                                                                                                                 | Selected |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| At recording-stop, persisted to `filesDir/thumbs/` | Native MediaMetadataRetriever extracts first I-frame at finalize, write to a separate thumbs/ dir so it survives the post-`verified` MP4 delete.            | ✓        |
| Lazy on first History render                       | First History view triggers per-row native extract. Slower first paint; edge: if `verified` clears the MP4 before History opens, no thumb is ever produced. |          |
| Skip thumbnails at MVP                             | Render gradient + first-letter fallback only; walks back HIST-06.                                                                                           |          |

**User's choice:** At recording-stop, persisted to separate thumbs/ dir.
**Notes:** ~20–50 ms per recording; runs after metadata-JSON SHA-256 finalize. Where the Kotlin extraction code lives (extending `FinalizeWorker` vs new `HumynThumbnail` helper vs inline in `HumynUpload`) is planner's call.

---

## In-app player — scope

| Option                                                 | Description                                                                                                                                                                  | Selected |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| All non-discarded recordings (local + server-stream)   | Local MP4 plays from disk; verified-cleared / in-flight stream via new presigned-GET endpoint. Deep Archive (>90 d) shown but disabled. REQUIREMENTS HIST-07/08/09 reworded. | ✓        |
| Verified-only stream from server + local-while-present | Same as A but only `qa_status='verified'` rows stream; in-flight rows that have a local copy play locally; uploaded-not-yet-verified shows a wait message.                   |          |
| Stay local-only (matches today's REQUIREMENTS)         | HIST-07/08/09 stand; cleared = "Local copy cleared." HIDE all non-local rows from player.                                                                                    |          |

**User's choice:** All non-discarded recordings (local + server-stream).
**Notes:** Owner words: "I want users to be able to play all the videos (except the discarded ones)." This is a deliberate scope expansion past the locked HIST-07/08/09 — the planner reworked the requirements during planning.

---

## Deep-Archive (>90 d) edge

| Option                                                       | Description                                                                                             | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------- |
| Show but disable — tap shows 'Archived' message              | Row remains in History; tap shows "Archived. Contact support for retrieval." No async thaw flow at MVP. | ✓        |
| Narrow Glacier IR window to >180 d, push Deep Archive to §v2 | Edit Phase-1 S3 lifecycle. Bigger ops cost.                                                             |          |
| Decide later — fold into Phase 7 distribution hardening      | Park the edge; Phase 7 or §v2 decides whether to keep Deep Archive.                                     |          |

**User's choice:** Show but disable.
**Notes:** No S3 lifecycle edit. Archive-state derived from `created_at` (>90 d → deep-archive) without an S3 HeadObject. The async-thaw flow is §v2.

---

## In-app player — tech choice

| Option                                                     | Description                                                                                                                                                                     | Selected |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Hand-rolled `HumynPlayer` (media3 ExoPlayer + TextureView) | New Kotlin module mirroring HumynCapture / HumynGateCamera. ~150–200 LOC. No new JS dep. `androidx.media3:media3-exoplayer:1.10.0` (same media3 minor as HumynCapture's muxer). | ✓        |
| `react-native-video` (community lib)                       | Drop in `<Video>`. Quickest. Adds RN dep with peer-matrix maintenance.                                                                                                          |          |
| `MediaPlayer` (no ExoPlayer)                               | Hand-rolled with `android.media.MediaPlayer`. Less robust HEVC seek; not chosen.                                                                                                |          |

**User's choice:** Hand-rolled `HumynPlayer` (media3 ExoPlayer + TextureView).
**Notes:** Matches the rest of the hand-rolled native pattern. Source URI switches between `file://` (local) and `https://` (presigned). iOS counterpart deferred with the rest of the iOS modules.

---

## Stream-URL endpoint shape

| Option                                                                       | Description                                                                      | Selected                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| `GET /recordings/:id/stream-url` → `{presignedUrl, expiresAt, archiveState}` | Dedicated, intention-revealing route. Lazy mint. 5-min TTL. Per-user rate-limit. | ✓ (Claude's discretion lock) |
| Expand `GET /recordings/:id` with `presignedUrl?` + `archiveState`           | Reuse the detail route. Couples "get metadata" with "mint URL".                  |                              |
| Inline on `GET /recordings` list rows                                        | Every row gets a presignedUrl. Wasteful + URLs may expire before tap.            |                              |

**User's choice:** "you decide" — Claude locked option A.
**Notes:** Dedicated route, body `{presignedUrl: string|null, expiresAt: ISO, archiveState: 'available'|'deep-archive'|'unavailable'}`. Per-user rate-limit 60/min via the existing `keyGenerator` pattern. Planner can refine field names.

---

## Claude's Discretion

- The "this week" / "this month" timezone wire format (Accept-Timezone header vs `tz=` query param vs implicit UTC coercion).
- Whether Home tiles read a new `/contributions/range?start=&end=` aggregate route OR sum daily buckets from `/contributions/timeseries?start=&end=`.
- Where the thumbnail extraction Kotlin code physically lives (extend `FinalizeWorker` vs new `HumynThumbnail` helper vs inline in `HumynUpload`).
- The MMKV ledger schema (`setObject` blob vs. per-key MMKV stash).
- Whether the player surface auto-rotates to landscape during fullscreen or stays portrait + letterboxed (design-spec §14 reads portrait + letterboxed).
- The exact `pg_trgm` similarity threshold (D-02 locks 0.3; researcher may re-tune on the fixture).
- The exact REQUIREMENTS-rewording sequence for HIST-07/08/09 (planner edits during the Phase 6 plan, not pre-edit).
- Stream-URL endpoint response field names (the contract is locked; field names refinable).

---

## Deferred Ideas

- pgvector + RRF hybrid search surfaced on the client (§v2 SEARCH-V2-01).
- Async thaw flow for Deep-Archive (>90 d) recordings (§v2 / Phase 7).
- iOS player parity (`HumynPlayerIOS` / AVPlayer) — deferred with the rest of iOS modules (§v2 IOS-01..07).
- OEM battery-optimization device sweep (folded into Phase 7 from Phase 5).
- Per-OEM SoundPool / Vibrator routing nuances beyond Pixel 10a / Android 16 (Phase 7 observability work).
- Auto-retry for streaming a `pending` row that briefly fails (§v2 polish).
- History row deletion / re-record / sharing (locked OUT by HIST-07/HIST-10).
- Search results sort options (date / popularity / category-weighted) — §v2.
- Pull-to-refresh on the Tasks screen — §v2 polish (Phase 6 ships PTR on Home only).
- A "your contribution week-on-week" trend tile on Profile — out-of-scope; Profile shipped Phase 2.
