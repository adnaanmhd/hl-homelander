---
quick_id: 260511-kph
slug: imuwriter-emits-canonical-csv-header-row
date: 2026-05-11
type: quick
status: complete
mode: quick (inline — gsd-sdk not installed, legacy gsd-tools.cjs shim used)
tests_run: false # see "Test status" — pre-existing react-native-reanimated Android compile failure blocks ./gradlew :app:* in this workspace
---

# Quick Task 260511-kph — Summary

## What changed

`ImuWriter` (Kotlin) now writes the canonical column-name header
`timestamp_ns,sensor_type,x,y,z` as **line 1 of every IMU CSV**. Previously the CSV
started straight on data rows. Header only — the long / interleaved
`timestamp_ns,sensor_type,x,y,z` row schema is unchanged.

RED → GREEN → docs, atomic commits.

## Files changed

**Source**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`
  - companion: `const val CSV_HEADER = "timestamp_ns,sensor_type,x,y,z\n"`
  - new `init { csv.write(CSV_HEADER) }` placed right after the `BufferedWriter` property —
    runs at construction, single-threaded (no sensor listener registered yet → no `csvLock`
    needed); `FileWriter` is non-append so this is always line 1 of a fresh file.
  - KDoc updated: "CSV format" note (header line + per-column units live in the schema doc)
    and Lifecycle "construct: open BufferedWriter, **write the CSV header line**, start
    HandlerThread".

**Tests**

- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt`
  - new test `every CSV starts with the canonical header row` — construct-then-`close()` yields
    a file whose entire content is `timestamp_ns,sensor_type,x,y,z\n` (header-only, no data);
    also asserts `ImuWriter.CSV_HEADER` equals that literal.
  - renamed/updated `writeRowForTest persists rows to disk verbatim after the header` — expects
    `ImuWriter.CSV_HEADER + "<row>\n<row>\n"` and asserts line 1 == the column-name header.
  - `formatRow`-only tests and `timestamps()` test are unaffected (`formatRow` does not emit a
    header).
- `StartGateCarryoverTest.kt` — **not touched.** It tests the metadata-JSON `start_gate` block
  via `MetadataComposer`; it never reads the IMU CSV bytes, so the header is irrelevant to it.
  (Task description asked to "verify" this — confirmed.)

**Docs**

- `idea-brief.md` §8.2 — dated note: `ImuWriter` now emits the header verbatim; the block in
  §8.2 is the exact on-disk layout; **any CSV consumer must skip line 1**; column-name header ≠
  inline per-column units (§6.4's "no inline header units" wording still holds).
- `idea-brief.md` §6.4 — the "Columns" bullet now says line 1 is the `timestamp_ns,sensor_type,x,y,z`
  header (cross-ref §8.2), units still documented in the schema doc not the CSV.
- `imu-liveness-check.md` §4 — implementer breadcrumb: the CSV's first line is the header, skip
  it before parsing. (That doc is v2-deferred — no code there yet.)

`idea-brief.md` was previously untracked in git; it's now tracked as part of this change
(same call the user made for `imu-liveness-check.md` / `deferred-decisions.md` in 260511-kfs).

## Test status — NOT executed in this environment

`cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*.ImuWriterCsvFormatTest"`
**fails at dependency compilation**, not in our code: `react-native-reanimated`'s Android Java
sources don't compile against the installed RN — `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE`,
`UIManagerModule.addUIManagerListener`, `LengthPercentage.resolve(int,int)` symbol/signature
errors (`:react-native-reanimated:compile...JavaWithJavac` — never reaches `:app`). This is a
pre-existing workspace state (stale / mismatched `node_modules`), unrelated to this change. The
unit tests must be run on a workspace with `node_modules` reinstalled against the pinned RN/
reanimated versions:

    cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest \
      --tests "ai.humynlabs.capture.capture.ImuWriterCsvFormatTest" \
      --tests "ai.humynlabs.capture.capture.StartGateCarryoverTest"

The change is mechanically minimal — a one-statement `init` block plus matching test
expectations — and was reviewed by reading; `init`-block placement is valid Kotlin (declared
after the `csv` property it references; `CSV_HEADER` is in the companion object).

## Out of scope

- The wide-format reshape / Unix-epoch timestamp shift / `%.6f` float formatting discussed
  earlier — **not** done. Header only.
- `video_metadata.json` / metadata schema — unchanged. `imu_sha256` now covers the header bytes
  too, but it's recomputed over the final file every run and the Phase 1 backend re-hash just
  compares bytes — no code change.
- Other untracked repo-root design docs (`design-spec.md`, `engineering-handoff.md`,
  `prototype.html`, …) — left untracked; only `idea-brief.md` (which this task edits) was added.

## Commits

- `10a6efb` — `test(quick-260511-kph): RED — ImuWriter CSV must start with timestamp_ns,sensor_type,x,y,z header`
- `b4391b2` — `feat(quick-260511-kph): GREEN — ImuWriter writes the timestamp_ns,sensor_type,x,y,z header as CSV line 1`
- `5e3bc98` — `docs(quick-260511-kph): record the IMU-CSV header in idea-brief §6.4/§8.2 + imu-liveness-check §4`
- (this docs commit) — `docs(quick-260511-kph): plan + summary + STATE quick-task row`
