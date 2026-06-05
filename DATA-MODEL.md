# Homelander — Data Model & Flow

## 1. What this app actually produces

Every recording is called a **segment**. A segment produces exactly **three files**:

| File            | What it is                         | Format                                              |
| --------------- | ---------------------------------- | --------------------------------------------------- |
| `video.mp4`     | The egocentric video               | HEVC, 1080p, 30fps, ultrawide (≥110° field of view) |
| `imu.csv`       | The motion-sensor stream           | CSV, ~100+ Hz accelerometer + gyroscope             |
| `metadata.json` | A "receipt" describing the segment | JSON, ~50 fields (codec, drift, task, device…)      |

These three files travel **byte-for-byte** from the phone to cloud storage — they are
**never re-encoded or modified** server-side. What the phone wrote is exactly what the
training pipeline reads.

There are **two places data lands**, and they answer different questions:

| Store                   | Contains                                                                         | Use it for                                                                |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **PostgreSQL**          | One row per user, recording, task, contribution, event… (metadata + bookkeeping) | Dashboards, analytics, funnels, fleet health — **this is what you query** |
| **S3 (object storage)** | The actual `video.mp4` / `imu.csv` / `metadata.json` payload files               | The training-data lake — large binary/CSV files, consumed by ML pipelines |

Postgres is the **index**; S3 is the **content**. A recording row in Postgres carries the
S3 keys (`s3_key_video`, `s3_key_imu`, `s3_key_metadata`) pointing at its files.

---

## 2. End to end data flow

```mermaid
flowchart TD
    subgraph Phone["📱 Android phone"]
        REC["Record segment<br/>(camera + IMU sensors)"]
        FILES["3 files written to disk:<br/>video.mp4 · imu.csv · metadata.json"]
        QGATE{"Capture-quality<br/>cancel gate"}
        QUEUE["On-device upload queue<br/>(durable JSON on disk)"]
        REC --> FILES --> QGATE
    end

    QGATE -->|"fps<29 / res<1080 /<br/><2 frames → CANCEL<br/>(deleted, never uploaded)"| DROP["🗑 Deleted locally<br/>shown as failed in History"]
    QGATE -->|"pass"| QUEUE

    subgraph Backend["☁️ Backend (Fastify API + Postgres + S3)"]
        API["API: /recordings/init,<br/>/parts, /finalize"]
        S3[("S3 bucket<br/>recordings/{user}/{rec}/")]
        PG[("PostgreSQL")]
        API --> PG
        API --> S3
        API -->|"at finalize: poster<br/>thumb.jpg (ffmpeg, D5)"| S3
    end

    QUEUE -->|"1 - init (get presigned URLs)"| API
    QUEUE -->|"2 - PUT file parts directly"| S3
    QUEUE -->|"3 - finalize → qa_status=uploaded (done);<br/>device deletes local files"| API

    PG --> DASH["📊 Dashboards & analytics<br/>(you are here)"]
    S3 --> ML["🤖 Training pipeline<br/>(reads MP4 + IMU + metadata)"]
```

**In words:**

1. The phone records a segment → 3 files on disk.
2. A **quality gate** runs after recording. If the video dropped below 29fps, isn't 1080p,
   or has too few frames, the segment is **cancelled and deleted locally** — it never reaches
   the server and never appears in any server table. (See [§9](#9-gotchas-for-analysts).)
3. Passing segments enter an **on-device upload queue**. The app asks the API to start an
   upload (`init`), uploads the file chunks **directly to S3** using presigned URLs, then
   tells the API it's done (`finalize`). On a `finalize` 200 the recording is **`uploaded` —
   terminal success** — and the phone **deletes its local copy**. _(Enh 3 / D1, 2026-06-04:
   the former server-side hash-verify worker — re-hash MP4 + IMU, flip to `verified` — was
   removed; `uploaded` is now the final good state. See [§8](#8-the-recording-lifecycle-qa_status).)_
4. At `finalize` the server also extracts a **poster thumbnail** (`thumb.jpg`) for cross-device
   History (Bug 6 / D5) — best-effort, never blocks the upload.
5. **You query Postgres** for dashboards. The **ML team reads S3** for training.

---

## 3. S3 storage layout

Two buckets (names suffixed by environment, e.g. `humyn-recordings-prod`):

```
humyn-recordings-{env}/
└── recordings/{userId}/{recordingId}/
    ├── video.mp4        # ContentType video/mp4   — multipart upload
    ├── imu.csv          # ContentType text/csv     — multipart upload
    ├── metadata.json    # ContentType application/json — single PUT
    └── thumb.jpg        # ContentType image/jpeg — server-generated poster (Bug 6 / D5); best-effort, may be absent

humyn-feedback-{env}/
└── feedback/{userId}/{feedbackId}/
    └── diagnostic.json  # in-app feedback attachments (≤5MB)
```

- `userId` and `recordingId` are both **ULIDs** (26-char sortable IDs). The `recordingId`
  is generated **on the device** and is the same value used as the primary key of the
  `recordings` table — so an S3 key fully determines the DB row and vice-versa.
- Large files (`video.mp4`, `imu.csv`) are uploaded in **8 MiB parts** (5 MiB on cellular)
  via S3 multipart upload, max 1000 parts. `metadata.json` is one small `PUT`.
- The three captured files are **immutable once uploaded** (`finalize` is terminal; the device
  deletes its local copy and there is no re-upload path). _(Enh 3 / D1, 2026-06-04: the former
  hash-mismatch re-upload overwrite was removed with the verification flow.)_ The server-derived
  `thumb.jpg` (Bug 6 / D5) is the only object the backend writes after upload.
- **S3 object keys are independent of the device-local filename.** As of schema `1.2.0`
  (quick 260522-elm) the on-device files are prefixed with the segment's 26-char ULID
  (`{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`) so they are self-identifying on disk — but
  the S3 object keys are still literally `video.mp4` / `imu.csv` / `metadata.json` (the
  `recordingId` is the folder, not the object name). The upload path derives the key from
  `recordingKeys({userId, recordingId})`, never from the local filename.

---

## 4. The per-segment `metadata.json` (the quality + provenance receipt)

This is the most important file for **data quality and training**. It is written by the
phone (`MetadataComposer.kt`), uploaded byte-for-byte, and most of its fields are also copied
into the `recordings` Postgres row. **Schema version: `1.5.0`** _(two 2026-06-04 changes: Enh 3 / D1 removed `file_sha256` / `imu_sha256` — `1.3.0` → `1.4.0`; Bug 3 / D3 changed `capture_device_info.location` from a coarse string to the precise object `{ lat, lng, accuracy_m, provider, captured_at, label }` — `1.4.0` → `1.5.0`, with the consent text updated + consent version bumped.)_

It has **six** blocks (the sixth, `calibration`, was added in schema `1.2.0` — quick task
260522-elm). Below is every field.

### `contributor_info`

| Field     | Type           | Notes                                |
| --------- | -------------- | ------------------------------------ |
| `name`    | string         |                                      |
| `email`   | string         |                                      |
| `age`     | int \| null    |                                      |
| `gender`  | string \| null |                                      |
| `consent` | boolean        | Did the user accept the consent text |

### `task_info`

| Field           | Type   | Notes                                    |
| --------------- | ------ | ---------------------------------------- |
| `task_id`       | string | FK to `tasks.id`                         |
| `task_name`     | string |                                          |
| `task_category` | string |                                          |
| `environment`   | string | e.g. indoor/outdoor as actually captured |
| `setting`       | string | task's configured setting                |
| `time_of_day`   | string |                                          |

### `capture_device_info`

| Field          | Type           | Notes                                                                                                                                                                    |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`         | string         | device class                                                                                                                                                             |
| `model`        | string         | phone model                                                                                                                                                              |
| `os`           | string         | "Android"                                                                                                                                                                |
| `os_version`   | string         |                                                                                                                                                                          |
| `app_version`  | string         |                                                                                                                                                                          |
| `dfov_degrees` | number         | diagonal field of view (must be ≥110°)                                                                                                                                   |
| `ip_address`   | string \| null | usually filled server-side                                                                                                                                               |
| `location`     | object \| null | precise GPS `{ lat, lng, accuracy_m, provider, captured_at, label }` (Bug 3 / D3, schema 1.5.0); `label` = optional reverse-geocoded "City, Country"; `null` when no fix |

### `metadata` (the capture-spec block — the heart of quality monitoring)

**File sizes** _(per-file SHA-256 removed 2026-06-04 — Enh 3 / D1; no upload hashing)_
| Field | Type | Notes |
|---|---|---|
| `footage_type` | string | always `"egocentric_head"` |
| `filename` | string | the MP4 filename — local on-disk name `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.mp4` (ULID-prefixed, schema 1.2.0; quick 260522-elm). **S3 object key is UNCHANGED — still literally `video.mp4`** under `recordings/{userId}/{recordingId}/` |
| `file_size_bytes` | number | actual MP4 byte count || `imu_filename` | string | local on-disk name `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.csv` (ULID-prefixed). **S3 object key UNCHANGED — still literally `imu.csv`** |
| `imu_size_bytes` | number | actual CSV byte count |
**IMU rates & video↔IMU drift** _(quality telemetry)_
| Field | Type | Notes |
|---|---|---|
| `imu_gyro_rate_hz` | int | observed gyroscope sample rate |
| `imu_accel_rate_hz` | int | observed accelerometer sample rate |
| `imu_min_rate_hz_observed_p1` | number \| null | 1st-percentile (worst) IMU rate — must stay ≥100 Hz |
| `imu_video_drift_max_ms` | number \| null | max time misalignment between video & IMU clocks |
| `imu_video_drift_mean_ms` | number \| null | mean drift |
| `imu_video_drift_p99_ms` | number \| null | 99th-percentile drift |

**Audio** — _always null_:
`audio_sample_rate_hz`, `audio_codec`, `audio_bitrate_bps`, `audio_channels` → all `null`.

**Timing**
| Field | Type | Notes |
|---|---|---|
| `start_timestamp` / `end_timestamp` | ISO-8601 w/ offset | video wall-clock bounds |
| `imu_start_timestamp` / `imu_end_timestamp` | ISO-8601 w/ offset | first/last IMU sample |
| `duration_seconds` | number | |

**Video spec** _(everything below is measured from the actual encoded file, not hardcoded)_
| Field | Type | Notes |
|---|---|---|
| `container_format` | string | `"mp4"` |
| `resolution` | string | e.g. `"1920x1080"` (from MP4 track header) |
| `fps` | number | measured mean fps (cancel gate fails below 29) |
| `orientation` | string | `"landscape_left"` or `"landscape_right"` |
| `video_codec` | string | `"hevc"` / `"h264"` |
| `video_profile` | string | `"main"`, `"main10"`, `"main-still"`, `"unknown"` |
| `bitrate_bps` | number | encoder-reported (or configured fallback) |
| `bitrate_source` | string | `"reported"` or `"configured"` |
| `bitrate_mode` | string | `"cbr"` / `"vbr"` / `"cq"` / `"unknown"` |
| `gop` | int | group-of-pictures size (frames) |
| `color_depth_bits` | int | 8 (Main) or 10 (Main10) |
| `color_space` | string | `"bt709"` / `"bt2020"` / `"bt601"` / `"unknown"` |
| `hdr` | boolean | always `false` |
| `b_frames` | boolean | true if encoder used B-frames |
| `image_stabilization` | boolean | always `false` |

**`start_gate`** (the pre-record hand-detection gate result — same for every segment in a session)
| Field | Type |
|---|---|
| `type` | string |
| `passed` / `skipped` / `bypassed` | boolean |
| `duration_ms` | int |
| `consecutive_hits_required` | int |
| `platform_cadence_ms` | int |

### `calibration` _(schema 1.2.0 — quick 260522-elm; additive telemetry)_

A **top-level sibling** of `metadata` (NOT nested inside it). Live-Camera2 camera
intrinsics + cam-IMU offset (temporal + spatial), mirroring the SPC2 reference rig's
`meta.json`. It is **ALWAYS present** with the full key structure — when the device reports
`UNCALIBRATED` (common on Pixels) or runs under JVM/CI, the params are `null` and the source
fields say so (the block never throws, never blocks capture). The existing
`imu_video_drift_{max,mean,p99}_ms` fields (in the `metadata` block) are **unchanged** —
calibration _adds_ offset/extrinsics telemetry alongside them.

**`calibration.camera`** (intrinsics, read from the **ultrawide physical sub-camera** — the
lens the HEVC stream actually records on)
| Field | Type | Notes |
|---|---|---|
| `model` | string | `"pinhole"` |
| `resolution` | `[w, h]` \| null | intrinsics reference frame (`SENSOR_INFO_ACTIVE_ARRAY_SIZE`) |
| `params` | object | `{ fx, fy, cx, cy, skew }` — each `number \| null` (null when uncalibrated) |
| `distortion_coeffs` | number[] \| null | radial/tangential (`LENS_DISTORTION`); null when uncalibrated |
| `intrinsics_source` | string | `"camera2"` (real values) or `"camera2_uncalibrated"` (null fallback) |

**`calibration.cam_imu_extrinsics`** (cam-IMU offset)
| Field | Type | Notes |
|---|---|---|
| `T_cam_imu` | 4×4 \| null | homogeneous transform (cam→imu); null unless `LENS_POSE_REFERENCE == GYROSCOPE` |
| `T_imu_cam` | 4×4 \| null | inverse (imu→cam) |
| `T_cam_imu_translation_mm` | `[x,y,z]` \| null | translation in millimetres |
| `timeshift_cam_imu_sec` | number | temporal offset; default `0.0` (Camera2 shares the boottime clock) |
| `timeshift_meaning` | string | verbatim: `"t_imu = t_cam + timeshift"` |
| `clock_sync_note` | string | derived from `SENSOR_INFO_TIMESTAMP_SOURCE` (REALTIME → shared boottime clock) |
| `extrinsics_source` | string | `"camera2"` (real values) or `"camera2_no_imu_reference"` (null fallback) |

> Genuine non-null intrinsics/extrinsics **values** only exist on a real device whose
> ultrawide sub-camera reports a factory calibration; the null-fallback block is the
> expected typical-device + CI output. Android only — iOS analogues deferred.

---

## 5. The `imu.csv` format

Plain CSV. **Line 1 is a header — skip it when parsing.**

```
timestamp_ns,sensor_type,x,y,z
5283001234567,accel,0.4123,9.6087,1.8233
5283002434567,gyro,-0.0148,0.0231,-0.0067
```

| Column         | Type    | Units / meaning                                                                                                                        |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp_ns` | int64   | nanoseconds, monotonic clock (`elapsedRealtimeNanos`). **Not** wall-clock — use it for _relative_ timing/alignment, not calendar time. |
| `sensor_type`  | string  | exactly `"gyro"` or `"accel"`                                                                                                          |
| `x`, `y`, `z`  | float32 | gyro → rad/s · accel → m/s² (gravity **not** removed). Raw device axes, no conversion.                                                 |

Notes for whoever parses this:

- Rows are **interleaved by physical timestamp**, not strictly alternating accel/gyro.
- Sensors are batched (~200 ms), so samples can arrive in **bursts** — but each row's
  `timestamp_ns` is the true sample time, so timing stays correct.
- No magnetometer, no audio.
- To map a sample to calendar time, anchor against the metadata's `imu_start_timestamp`.

---

## 6. PostgreSQL — entity relationships

This is the database you query for analytics. Below is the relationship map, then the full
column-by-column DDL for every table.

```mermaid
erDiagram
    users ||--|| profiles : "has lifetime rollup"
    users ||--o{ recordings : "captures"
    users ||--o{ contributions : "daily buckets"
    users ||--o{ task_requests : "requests"
    users ||--o{ events : "emits"
    users ||--o{ feedback : "submits"
    users ||--o{ consent_log : "accepts (every sign-in)"
    tasks  ||--o{ recordings : "is recorded for"

    users {
        varchar26 id PK
        text googleSub UK
        text email
        build_flavor flavor
        timestamp consentAcceptedAt
        timestamp deletedAt
    }
    recordings {
        varchar26 id PK
        varchar26 userId FK
        varchar26 taskId FK
        qa_status qaStatus
        int durationMs
        text s3KeyVideo
        text s3KeyThumbnail
        timestamp capturedAt
    }
    tasks {
        varchar26 id PK
        varchar80 slug UK
        text name
        vector384 embedding
        tsvector nameSearch
    }
    contributions {
        varchar26 userId PK
        text bucketDate PK
        bigint durationMs
        int recordingCount
    }
    profiles {
        varchar26 userId PK
        bigint lifetimeContributionMs
        int taskCount
    }
    events {
        varchar26 id PK
        varchar26 userId FK
        varchar80 name
        jsonb properties
    }
```

**The three relationships analysts use most:**

- **User → videos:** `recordings.user_id = users.id`. Each recording row has the S3 keys to its files.
- **Recording → task:** `recordings.task_id = tasks.id`.
- **Daily activity:** `contributions` is **pre-aggregated** (a DB trigger rolls up per user
  per UTC day) — use it instead of `GROUP BY` over raw recordings when you can.

---

## 7. Full DDL — every table, every column

> Types are the Drizzle/Postgres types. `varchar(26)` IDs are **ULIDs**. All `timestamp`
> columns are UTC. PK = primary key, FK = foreign key, UK = unique.

### Enums (controlled vocabularies)

```
qa_status            : pending | uploaded | verified | hash-mismatch | rejected | takedown
                       (NOTE: 'verified' / 'hash-mismatch' are LEGACY — kept in the enum
                        because Postgres can't cheaply drop values, but NOTHING writes them
                        since Enh 3 / D1, 2026-06-04. 'uploaded' is terminal success; any
                        legacy 'verified' row is read as a success synonym.)
build_flavor         : apkRollout | playStore | iosAppStore
integrity_verdict    : passed | bypassed_apk
task_setting         : indoor | outdoor | either
task_request_status  : pending | reviewed | rejected | accepted
(recording_event_type enum REMOVED — Enh 3 / D1, migration 0011)
```

### `users` — one row per signed-in person

| Column                      | Type                  | Notes                                                                                                                                                                                                            |
| --------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | varchar(26) PK        | ULID                                                                                                                                                                                                             |
| `google_sub`                | text UK NOT NULL      | Google account ID (stable identity)                                                                                                                                                                              |
| `email`                     | text NOT NULL         |                                                                                                                                                                                                                  |
| `name`                      | text NOT NULL         |                                                                                                                                                                                                                  |
| `age`                       | integer               | nullable                                                                                                                                                                                                         |
| `gender`                    | text                  | nullable                                                                                                                                                                                                         |
| `avatar_url`                | text                  | nullable                                                                                                                                                                                                         |
| `consent_version`           | text NOT NULL         | latest consent version accepted (denormalized)                                                                                                                                                                   |
| `consent_accepted_at`       | timestamp NOT NULL    |                                                                                                                                                                                                                  |
| `deleted_at`                | timestamp             | set when user requests deletion                                                                                                                                                                                  |
| `delete_grace_until`        | timestamp             | grace window before hard delete                                                                                                                                                                                  |
| `flavor`                    | build_flavor NOT NULL | which build (`apkRollout` at MVP)                                                                                                                                                                                |
| `application_id`            | text NOT NULL         | Android package id                                                                                                                                                                                               |
| `current_installation_id`   | text                  | nullable; Bug 4 / D2 (2026-06-04) — most-recent sign-in's installation id; `requireAuth` 401s (`device-evicted`) any JWT whose `installationId` diverges. NULL for pre-Bug-4 rows. Overrides LOCKED `D-AUTH-03`. |
| `practice_completed_at`     | timestamp             | nullable; Bug 5 / D7 (2026-06-04) — set once when the user finishes the practice tutorial; surfaced on `GET /me` so a reinstall / new device skips the walkthrough forever. NULL until completed.                |
| `created_at` / `updated_at` | timestamp             |                                                                                                                                                                                                                  |

_Indexes:_ unique on `google_sub`; index on `deleted_at`.

### `profiles` — lifetime rollup, one row per user

| Column                     | Type                    | Notes                         |
| -------------------------- | ----------------------- | ----------------------------- |
| `user_id`                  | varchar(26) PK FK→users | ON DELETE CASCADE             |
| `lifetime_contribution_ms` | bigint DEFAULT 0        | total recorded time, all-time |
| `task_count`               | integer DEFAULT 0       | distinct tasks contributed    |
| `updated_at`               | timestamp               |                               |

### `tasks` — the catalog of things people record

| Column                      | Type                    | Notes                                                 |
| --------------------------- | ----------------------- | ----------------------------------------------------- |
| `id`                        | varchar(26) PK          |                                                       |
| `slug`                      | varchar(80) UK NOT NULL |                                                       |
| `name`                      | text NOT NULL           |                                                       |
| `description`               | text NOT NULL           |                                                       |
| `category`                  | varchar(40) NOT NULL    |                                                       |
| `setting`                   | task_setting NOT NULL   | indoor/outdoor/either                                 |
| `icon_key`                  | text NOT NULL           | which task icon                                       |
| `instructions`              | jsonb NOT NULL          | up to 3 steps                                         |
| `embedding`                 | vector(384) NOT NULL    | pgvector — semantic search (descoped from MVP client) |
| `name_search`               | tsvector (generated)    | full-text search index over name+description          |
| `created_at` / `updated_at` | timestamp               |                                                       |

_Indexes:_ unique `slug`; `category`; HNSW on `embedding`; GIN on `name_search`.

### `recordings` — **one row per uploaded segment (the analyst's main table)**

| Column                        | Type                        | Notes                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                          | varchar(26) PK              | = device-side `recording_id` = S3 folder name                                                                                                                                                                                                                                                                                   |
| `user_id`                     | varchar(26) FK→users        | ON DELETE RESTRICT (can't delete a user with recordings)                                                                                                                                                                                                                                                                        |
| `task_id`                     | varchar(26) FK→tasks        | ON DELETE RESTRICT                                                                                                                                                                                                                                                                                                              |
| `practice`                    | boolean DEFAULT false       | practice runs (note: practice is normally **not** uploaded)                                                                                                                                                                                                                                                                     |
| `qa_status`                   | qa_status DEFAULT 'pending' | lifecycle state — see [§8](#8-the-recording-lifecycle-qa_status)                                                                                                                                                                                                                                                                |
| `duration_ms`                 | integer NOT NULL            | segment length                                                                                                                                                                                                                                                                                                                  |
| `file_size_bytes`             | bigint NOT NULL             | _(Enh 3 / D1, 2026-06-04: `file_sha256` + `imu_sha256` columns dropped — migration 0011; no upload hashing)_                                                                                                                                                                                                                    |
| `imu_size_bytes`              | bigint NOT NULL             |                                                                                                                                                                                                                                                                                                                                 |
| `imu_video_drift_max_ms`      | integer                     | quality telemetry (nullable)                                                                                                                                                                                                                                                                                                    |
| `imu_video_drift_mean_ms`     | integer                     |                                                                                                                                                                                                                                                                                                                                 |
| `imu_video_drift_p99_ms`      | integer                     |                                                                                                                                                                                                                                                                                                                                 |
| `imu_min_rate_hz_observed_p1` | integer                     | worst-case IMU rate                                                                                                                                                                                                                                                                                                             |
| `calibration`                 | jsonb                       | the whole metadata.json `calibration` block (camera intrinsics + cam-IMU extrinsics); nullable (schema 1.2.0; quick 260522-elm)                                                                                                                                                                                                 |
| `s3_key_video`                | text NOT NULL               | path to `video.mp4`                                                                                                                                                                                                                                                                                                             |
| `s3_key_imu`                  | text NOT NULL               | path to `imu.csv`                                                                                                                                                                                                                                                                                                               |
| `s3_key_metadata`             | text NOT NULL               | path to `metadata.json`                                                                                                                                                                                                                                                                                                         |
| `s3_key_thumbnail`            | text                        | nullable; Bug 6 / D5 (2026-06-04) — server-generated poster JPEG (`…/thumb.jpg`) for cross-device History; best-effort (NULL if ffmpeg failed / legacy row)                                                                                                                                                                     |
| `location`                    | jsonb                       | nullable; Bug 3 / D3 (2026-06-04) — precise-GPS block `{ lat, lng, accuracy_m, provider, captured_at, label }` mirrored from `metadata.json`'s `capture_device_info.location` (sibling to `ip_address`). `null` when no fix / partial grant. Overrides the formerly-LOCKED coarse-only rule (consent updated + version-bumped). |
| `liveness_score`              | integer                     | 0–100, anti-fraud (nullable; descoped at MVP)                                                                                                                                                                                                                                                                                   |
| `captured_at`                 | timestamp NOT NULL          | when recorded on device                                                                                                                                                                                                                                                                                                         |
| `upload_started_at`           | timestamp                   |                                                                                                                                                                                                                                                                                                                                 |
| `upload_completed_at`         | timestamp                   | _(Enh 3 / D1, 2026-06-04: the `verified_at` column was dropped here — migration 0011; no verify step)_                                                                                                                                                                                                                          |
| `created_at`                  | timestamp                   | row insert time                                                                                                                                                                                                                                                                                                                 |
| `ip_address`                  | text                        | server-populated                                                                                                                                                                                                                                                                                                                |
| `flavor`                      | build_flavor NOT NULL       |                                                                                                                                                                                                                                                                                                                                 |
| `s3_upload_id`                | text                        | AWS multipart upload id (video)                                                                                                                                                                                                                                                                                                 |
| `parts_count`                 | integer                     | number of upload parts (1–1000)                                                                                                                                                                                                                                                                                                 |

_Indexes:_ `(user_id, captured_at)`, `qa_status`, `task_id`, and `recordings_user_qa_idx` on `(user_id, qa_status)` INCLUDE `(duration_ms, task_id)` (covering index for the two `/contributions` per-user scans — Bug 10, 2026-06-04, migration 0016).

### `contributions` — **pre-aggregated daily activity** (use for time-series dashboards)

| Column            | Type                    | Notes                      |
| ----------------- | ----------------------- | -------------------------- |
| `user_id`         | varchar(26) PK FK→users |                            |
| `bucket_date`     | text PK                 | `'YYYY-MM-DD'` UTC         |
| `duration_ms`     | bigint DEFAULT 0        | total recorded ms that day |
| `recording_count` | integer DEFAULT 0       |                            |
| `task_count`      | integer DEFAULT 0       | distinct tasks that day    |

PK is `(user_id, bucket_date)`. Maintained by a DB trigger as recordings reach `uploaded` _(was "as recordings verify" pre-Enh-3 / D1; `uploaded` is now terminal success)_.

### `events` — **behavioral / funnel analytics**

| Column        | Type                 | Notes                   |
| ------------- | -------------------- | ----------------------- |
| `id`          | varchar(26) PK       |                         |
| `user_id`     | varchar(26) FK→users | ON DELETE SET NULL      |
| `name`        | varchar(80) NOT NULL | event name              |
| `properties`  | jsonb DEFAULT '{}'   | arbitrary event payload |
| `occurred_at` | timestamp NOT NULL   | client event time       |
| `flavor`      | build_flavor         |                         |
| `created_at`  | timestamp            |                         |

_Indexes:_ `(user_id, occurred_at)`, `name`.

### `task_requests` — user-suggested new tasks

| Column                | Type                                  | Notes           |
| --------------------- | ------------------------------------- | --------------- |
| `id`                  | varchar(26) PK                        |                 |
| `user_id`             | varchar(26) FK→users                  |                 |
| `name`                | varchar(80) NOT NULL                  |                 |
| `description`         | text NOT NULL                         |                 |
| `category`            | varchar(40) NOT NULL                  |                 |
| `setting`             | task_setting NOT NULL                 |                 |
| `sample_video_s3_key` | text                                  | optional sample |
| `status`              | task_request_status DEFAULT 'pending' |                 |
| `created_at`          | timestamp                             |                 |

### `feedback` — in-app feedback

| Column       | Type                 | Notes                                                        |
| ------------ | -------------------- | ------------------------------------------------------------ |
| `id`         | varchar(26) PK       |                                                              |
| `user_id`    | varchar(26) FK→users |                                                              |
| `category`   | varchar(40) NOT NULL |                                                              |
| `message`    | text NOT NULL        |                                                              |
| `diagnostic` | jsonb NOT NULL       | device/app diagnostics, first 100KB inline (full file in S3) |
| `created_at` | timestamp            |                                                              |

### `app_versions` — update/force-upgrade control, keyed by build flavor

| Column                     | Type                  | Notes           |
| -------------------------- | --------------------- | --------------- |
| `flavor`                   | build_flavor PK       |                 |
| `min_supported` / `latest` | text NOT NULL         | semver          |
| `force_upgrade`            | boolean DEFAULT false |                 |
| `apk_url` / `apk_sha256`   | text / varchar(64)    | apkRollout only |
| `play_store_url`           | text                  | playStore only  |
| `updated_at`               | timestamp             |                 |

### Compliance / legal tables (append-only by convention)

**`consent_log`** — one row **every sign-in**:
`id` PK, `user_id` FK, `consent_version`, `consent_text_hash` (sha256), `accepted_at`,
`ip`, `user_agent`, `build_flavor`. Index `(user_id, accepted_at)`.

**`takedown_log`** — regulator/legal takedowns:
`id` PK, `request_received_at`, `request_authority`, `affected_user_id` FK,
`affected_recording_ids` (jsonb string[]), `action_taken`, `completed_at`,
`counsel_reviewer`, `notes`, `created_at`.

**`dsr_log`** — data-subject requests (access/portability):
`id` PK, `user_id` FK, `request_type` (`access`|`portability`), `request_received_at`,
`fulfilled_at`, `ops_engineer`, `notes`, `created_at`.

### Plumbing tables (rarely queried for analytics, listed for completeness)

- _(Enh 3 / D1, 2026-06-04: **`recordings_to_verify`** and **`recording_events_outbox`** were dropped with the hash-verify flow — migration 0011. `uploaded` is terminal; there is no verify queue and no server→device event outbox.)_
- **`idempotency_keys`** — dedupes retried API calls: `(user_id, key)` PK, `method`, `path`,
  `request_hash`, `status_code`, `response_body` (jsonb), `expires_at`.
- **`auth_nonces`** — anti-replay for sign-in: `id` PK, `nonce_sha256`, `expires_at`.

---

## 8. The recording lifecycle (`qa_status`)

This is the single most important state for analytics. Every uploaded recording moves through it:

```mermaid
stateDiagram-v2
    [*] --> pending: POST /recordings/init<br/>(row created, upload starting)
    pending --> uploaded: POST /finalize<br/>(all parts in S3 — ✅ TERMINAL SUCCESS)
    pending --> rejected: client/server aborts upload
    uploaded --> takedown: legal/regulator removal
    uploaded --> [*]: ✅ usable training data
```

> **Enh 3 / D1 (2026-06-04): `uploaded` is now terminal success.** The former
> `uploaded → verified` / `hash-mismatch` hash-verify transitions were removed with the
> verification flow. The `qa_status` enum still _contains_ the legacy `verified` /
> `hash-mismatch` values (Postgres can't cheaply drop them) but **nothing writes them** —
> any pre-existing `verified` row is read as a success synonym for `uploaded`.

| `qa_status`     | Meaning                                 | Counts as good data?             |
| --------------- | --------------------------------------- | -------------------------------- |
| `pending`       | Row created, upload in progress         | No — in flight                   |
| `uploaded`      | All files in S3 — **terminal success**  | ✅ **Yes**                       |
| `verified`      | _Legacy_ — pre-Enh-3 hash-verified rows | ✅ Yes (success synonym)         |
| `hash-mismatch` | _Legacy_ — never written anymore        | No                               |
| `rejected`      | Upload aborted                          | No                               |
| `takedown`      | Removed for legal/compliance reasons    | No — **exclude from everything** |

> **For "real" training-data and contribution counts, filter `qa_status IN ('uploaded','verified')`**
> (`uploaded` is the live terminal state; `verified` only appears on legacy pre-Enh-3 rows).
> The app's own History view and contribution rollups count these as success.
> `takedown` rows should be excluded from every analysis.

---

## 9. How uploads actually happen (device → S3 → uploaded)

The upload is **resumable, chunked, and survives app restarts**. The phone owns a durable
upload queue; the API only hands out S3 permissions and records state.

### On-device upload queue

- Stored as JSON on the app's private disk (`filesDir/upload-queue/queue.json`), written
  atomically (write-to-`.partial`-then-rename) so a crash mid-write can't corrupt it.
- Each row carries the `owner_user_id`, so on a **shared phone** one account never uploads
  another account's files.
- **Practice recordings and quality-cancelled segments are refused at enqueue** — they never
  upload. (This is why they never appear in any server table.)

### The client-side state machine (one segment's journey)

```mermaid
stateDiagram-v2
    [*] --> PENDING: enqueued
    PENDING --> UPLOADING: coordinator starts
    UPLOADING --> FINALIZING: all parts PUT to S3
    FINALIZING --> UPLOADED: POST /finalize 2xx<br/>(local files deleted — terminal)
    UPLOADING --> NEEDS_ATTENTION: retries exhausted<br/>(user taps Retry)
    NEEDS_ATTENTION --> UPLOADING: manual retry
    UPLOADING --> DEAD_LETTER: permanent rejection (403/409)
    UPLOADED --> [*]
```

### The wire sequence

```mermaid
sequenceDiagram
    participant P as Phone (upload queue)
    participant A as API (Fastify)
    participant S as S3

    P->>A: POST /recordings/init {recordingId, taskId, partsCount, sizes}
    A->>S: create multipart uploads (video + imu)
    A->>P: presigned URLs + uploadId
    A-->>A: insert recordings row (qa_status=pending)
    loop each part
        P->>S: PUT part bytes (direct, presigned)
        S->>P: ETag
    end
    P->>S: PUT metadata.json
    P->>A: POST /recordings/:id/finalize {parts+etags}
    A->>S: complete multipart upload (video + imu)
    A->>S: extract + PUT thumb.jpg (poster, best-effort — Bug 6 / D5)
    A-->>A: qa_status pending→uploaded (✅ TERMINAL SUCCESS)
    A->>P: 200 OK
    P-->>P: delete local files (mp4 + csv + json)
```

**Key facts for engineers:**

- File bytes go **straight to S3** via presigned URLs — they do **not** pass through the API
  server. The API only orchestrates and records metadata.
- **Idempotency:** each step carries a stable idempotency key, so retries (flaky networks)
  don't create duplicate rows or double-count.
- **`finalize` is terminal:** a `/finalize` 200 transitions the row to `uploaded` (final
  success) and the phone deletes its local copy. _(Enh 3 / D1, 2026-06-04: the former
  independent hash-verify worker + the 5-min "stuck in uploaded" re-enqueue cron were removed
  — there is nothing left to re-hash or sweep.)_

---

## 10. Data references

| Question                                 | Where                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| How many users signed up?                | `users` (filter `deleted_at IS NULL` for active)                              |
| A user's recordings + their video files  | `recordings WHERE user_id = …`, then `s3_key_video`                           |
| Only _usable_ recordings                 | `recordings WHERE qa_status IN ('uploaded','verified')` (`verified` = legacy) |
| Recordings per day / contribution time   | `contributions` (pre-aggregated, UTC daily)                                   |
| Lifetime totals per user                 | `profiles`                                                                    |
| Most-recorded tasks                      | `recordings` joined to `tasks`, group by `task_id`                            |
| Capture quality (fps/res/drift/IMU rate) | `recordings` drift columns + the per-segment `metadata.json` in S3            |
| Funnels / feature usage / retention      | `events` (filter by `name`, parse `properties` jsonb)                         |
| Hash-mismatch / re-upload rate           | _n/a — removed with the hash-verify flow (Enh 3 / D1, 2026-06-04)_            |
| Consent audit trail                      | `consent_log` (one row per sign-in)                                           |
| New-task demand                          | `task_requests`                                                               |
| The raw motion data for training         | `imu.csv` in S3 (skip header row)                                             |

**Joining users to their videos (the common one):**

```sql
SELECT u.id AS user_id, u.email,
       r.id AS recording_id, r.qa_status, r.duration_ms,
       r.captured_at, t.name AS task_name,
       r.s3_key_video, r.s3_key_imu, r.s3_key_metadata
FROM recordings r
JOIN users u ON u.id = r.user_id
JOIN tasks t ON t.id = r.task_id
WHERE r.qa_status IN ('uploaded', 'verified')  -- 'uploaded' = terminal success; 'verified' = legacy pre-Enh-3
ORDER BY r.captured_at DESC;
```

---

## 11. Gotchas (read before you trust a number)

1. **Filter `qa_status IN ('uploaded','verified')`** for anything about real data volume
   (`uploaded` is terminal success since Enh 3 / D1, 2026-06-04; `verified` only on legacy
   pre-Enh-3 rows). `pending` is in-flight; `rejected`/`hash-mismatch` (legacy) failed;
   **`takedown` must always be excluded.**
2. **Drift is telemetry, not a gate.** `imu_video_drift_*` of ~1.7–6.2 ms is _expected and
   acceptable_ — the ultrawide lens causes it. Do **not** flag recordings as bad on drift.
   The relevant hard quality bars are **fps (≥29 effective), resolution (1080p), IMU rate (≥100 Hz)**.
3. **Cancelled & practice segments never reach the server.** If a recording dropped below
   29fps / 1080p / had <2 frames, it was deleted on-device and you will never see it in
   Postgres or S3. Same for practice runs. So server data is **survivorship-biased toward
   good captures** — to study capture _failures_ you'd need on-device telemetry/`events`,
   not `recordings`.
4. **Audio fields are always null** — audio was dropped from the spec.
5. **IMU timestamps are monotonic-clock nanoseconds, not wall-clock.** Use them for relative
   alignment; anchor to `imu_start_timestamp` in metadata for calendar time.
6. **`contributions` is UTC daily buckets**, maintained by trigger. For per-user-timezone
   views, the API re-buckets using an `Accept-Timezone` header — raw `contributions` is UTC.
7. **The dev Postgres gets wiped by the API test suite** (test `beforeEach` truncates). Don't
   run analysis against a dev DB that someone is testing on; re-seed first.
8. **MVP scope:** `liveness_score` and `vector(384)` semantic search exist in the schema but
   are **descoped/unused at MVP** — `liveness_score` will usually be null.

```

```
