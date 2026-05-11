---
quick_id: 260511-kph
slug: imuwriter-emits-canonical-csv-header-row
date: 2026-05-11
type: quick
status: in-progress
mode: quick (inline — gsd-sdk shim only; ImuWriter.kt is tracked so worktree would work, but kept inline for consistency with 260511-kfs)
---

# Quick Task 260511-kph: ImuWriter emits the canonical CSV header row as line 1

## Goal

`ImuWriter` (Kotlin, `apps/mobile/android/.../capture/ImuWriter.kt`) currently opens the
`BufferedWriter` and only ever appends data rows — the IMU CSV starts straight on data. Make
every IMU CSV start with the header `timestamp_ns,sensor_type,x,y,z\n` (the _current_ long /
interleaved format, matching the example already shown in `idea-brief.md §8.2` and the
implementation note in `ImuWriter.kt`'s KDoc). **No other format change** — the
`timestamp_ns,sensor_type,x,y,z` row schema is unchanged.

## Tasks (RED → GREEN → docs)

1. **RED — `ImuWriterCsvFormatTest.kt`** — update the `writeRowForTest persists row to disk
verbatim` expectation to include the header as line 1; add a new test asserting that a
   freshly-constructed-then-`close()`d `ImuWriter` produces a file whose sole line is
   `timestamp_ns,sensor_type,x,y,z\n` (header-only, no data). Fails against the current
   no-header writer.
2. **GREEN — `ImuWriter.kt`** — add `const val CSV_HEADER = "timestamp_ns,sensor_type,x,y,z\n"`
   to the companion object and an `init { csv.write(CSV_HEADER) }` block (construction-time,
   single-threaded — no `csvLock` needed, no sensor listener registered yet). Update the KDoc
   "CSV row format" note to mention the header line. Tests go GREEN.
3. **Docs** — `idea-brief.md`: add a dated note under §8.2 that the CSV now emits the column-name
   header verbatim and any consumer must skip line 1; add a tiny parenthetical to §6.4
   ("...now also emits the column-name header row — see §8.2") — the existing "no inline header
   _units_" wording stays (units live in the schema doc, not the CSV).
   `imu-liveness-check.md`: append a one-line implementer breadcrumb to §4 that the CSV's first
   line is the header — skip it before parsing. (That doc is v2-deferred; no code there.)

## Out of scope

- `StartGateCarryoverTest.kt` — does **not** read the IMU CSV (it tests the metadata JSON
  `start_gate` block via `MetadataComposer`), so it's unaffected by the header. Left untouched;
  noted here per the task description's "verify" ask.
- The wide-format / epoch-shift / `%.6f` reformatting discussed earlier — explicitly NOT in
  scope. Header only.
- `video_metadata.json` / metadata schema — unchanged. (`imu_sha256` now covers the header
  bytes too, but that hash is computed fresh over the final file every run; the Phase 1 backend
  re-hash just compares bytes — no code change.)

## Verify

- `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ImuWriterCsvFormatTest"` exits 0.
- `grep -q 'CSV_HEADER' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`
- `grep -q 'init {' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`
- A freshly-closed `ImuWriter` file == `timestamp_ns,sensor_type,x,y,z\n`.
- `idea-brief.md §8.2` carries the dated header note; `imu-liveness-check.md §4` carries the skip-line-1 breadcrumb.
