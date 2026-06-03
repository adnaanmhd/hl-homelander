# E2E walk bugs — 2026-05-18 (Pixel 8a + Pixel 10a, parallel session)

Bugs surfaced during the orchestrated E2E walk on 2026-05-17 → 2026-05-18.
Devices: Pixel 8a (`4B301XEKB1H8D2`, m.adnaan161@gmail.com) + Pixel 10a (`5C161JEA304304`, adnaan@kgen.io).
Build: `app-apkRollout-debug.apk` from `22ffec5` (`apkRollout` flavor — Play-Integrity install-source bypass via Remote Config).

Total captured during the walk: 16 recordings in DB, 15 fully uploaded + verified server-side, ~1 h 16 min of capture per device. Metadata for the 15 verified is preserved at `/tmp/humyn-metadata-dump/` (`_summary.json` + per-RID `<rid>.metadata.json`).

---

## BUG-260518-01 — `HumynCapture-Imu` thread leaks Java heap → process crash mid-recording

**Severity:** **CRITICAL**. Kills capture mid-segment with no in-app warning, no recovery prompt, no resume.

**Symptom on device:** Pixel 10a "abruptly ended the recording by itself" ≈ 5 min into a 10-min segment. App force-closed to the launcher. The truncated segment (`01KRVMZFJAZ6H7ARTD8ZA4NMKS`, kgen.io, duration 297.4 s instead of 600 s) is in the DB and S3 as `verified` — i.e. the partial bundle was still uploaded successfully.

**Crash chain (Pixel 10a, device time `03:50:45.721` → `03:50:47.462`):**

```
03:50:45.721  FATAL EXCEPTION: HumynCapture-Imu
              java.lang.OutOfMemoryError: Failed to allocate a 16 byte allocation
                with 668080 free bytes and 652KB until OOM,
                target footprint 268435456, growth limit 268435456;
                giving up on allocation because <1% of heap free after GC.
                at java.lang.Integer.valueOf(Integer.java:1197)
                at android.hardware.SystemSensorManager$SensorEventQueue
                    .dispatchSensorEvent(SystemSensorManager.java:1060)

03:50:46.149  E/ReactNativeJS  OutOfMemoryError in HostFunction (JS thread reports the same wall)

03:50:47.462  F/libc  Fatal signal 6 (SIGABRT) in tid 5380 (FileObserver), pid 5310
              Abort message: 'JNI DETECTED ERROR IN APPLICATION:
                JNI CallVoidMethodV called with pending exception java.lang.OutOfMemoryError'
              at android.os.FileObserver$ObserverThread.observe   ← process killed here
```

**Root cause hypothesis (highly likely, not yet proven by heap-dump):** the IMU sample-pump on the `HumynCapture-Imu` thread is autoboxing sensor values (`Integer.valueOf` in the `SystemSensorManager.SensorEventQueue.dispatchSensorEvent` path is the boxing-from-`int` for sensor accuracy or sample-index fields) and accumulating the boxed objects in a Java collection / event-emitter buffer that **is not released at 10-min segment rollover**. The 268 MB cap is the configured Hermes/Dalvik growth limit. At sustained ~800–934 Hz combined IMU rate × ~60 minutes of cumulative capture, the boxed-Integer churn alone is enough to exhaust 268 MB.

**Why we believe it's segment-rollover-cumulative, not per-segment:** the crash hit during the 7th 10-min segment on 10a; segments 1–6 ran clean. If it were per-segment, segment 1 would have crashed.

**Why Pixel 8a didn't crash (yet):** 8a's session was equivalent in shape (8a had a similarly bad mid-session drift spike on segment 3 — see BUG-04). 8a probably has slightly more headroom (different Hermes heap tuning, different system overhead) and was lucky. **Will crash on the same workload eventually.**

**Locations to look:**

- `apps/mobile/android/.../HumynCapture/*Imu*.kt` — the IMU SensorEventListener + the buffer/queue between sensor callback and CSV writer.
- The segment-rollover hook (where capture stops the old encoder/CSV and starts a new one). Confirm the IMU buffer/queue is `.clear()`-ed there and that the boxed `Integer`s are released, not retained by a long-lived listener reference.
- Check for any RN bridge event emitter pushing per-sample data to JS — that path would also retain `WritableMap`s.

**Test:** record continuously for ≥75 minutes on a Pixel 8a or 7a-class device. Watch `dumpsys meminfo ai.humynlabs.capture.apk` Java-heap "Alloc" climb. Expected pre-fix: monotonic growth. Expected post-fix: sawtooth that flushes at each segment boundary.

---

## BUG-260518-02 — Upload queue is head-of-line-blocked by a single `FINALIZING` entry

**Severity:** **CRITICAL**. Worse-than-it-looks: a single transient `/finalize` 5xx or timeout permanently strangles the device's entire upload queue. All subsequent recordings stay queued forever, eating the device's `files/` storage at ~600 MB / 10 min.

**Symptom on device:** Pixel 8a's upload progress UI never moves for the second-onwards recording, while Pixel 10a's keeps progressing. From the user: _"That's NOT concurrency, that's stupidity."_

**Side-by-side `files/upload-queue/queue.json` snapshot at host time `00:51 IST`:**

| Device        | Queue depth                                              | State distribution                                                       |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Pixel 8a**  | 28 entries, 16 GB of mp4+csv+json in `files/recordings/` | 1 × `FINALIZING` (parts 72/72 DONE), **27 × `PENDING` with `parts 0/0`** |
| **Pixel 10a** | 14 entries, 8.2 GB of mp4+csv+json                       | 1 × `AWAITING_VERIFY`, 1 × `UPLOADING`, 12 × `PENDING`                   |

The 8a `FINALIZING` entry is recording `01KRVPP7RKSYXD3DK2H5KKXYXA`. Its 71 video parts + 1 IMU multipart are all `status: "DONE"` with valid S3 ETags. Server side this recording is `qa_status = verified` (its sha matches the metadata.json we extracted: `63840c889c59…`). So **the server has the recording — the client just doesn't know.**

**Root cause:**

1. **Strict FIFO serialization across the queue.** `UploadCoord` advances one entry at a time; queue entry N+1 cannot move from `PENDING` → `INITING` until entry N reaches a terminal state. Entries behind a stuck head show `parts 0/0` because `/recordings/init` was never even called.
2. **No reconciliation for the `FINALIZING` state.** If `POST /recordings/:id/finalize` returns 5xx, hangs, or the response is lost (TCP drop, server restart, BullMQ enqueue failure during disk-pressure — which is exactly what happened: see BUG-03 chain), the entry stays `FINALIZING` forever. There is no:
   - retry-with-backoff on transient finalize failure
   - poll of `GET /recordings/:id` to detect "server says it's already finalized/verified"
   - timeout + skip to next queue entry
   - manual-retry affordance in the UI

**Fix surface:**

- Make per-recording state-machine progress independent of queue order (true concurrent uploads with a configurable parallelism cap, OR at minimum, drop the FIFO lock and treat each entry as an independent reconciliation loop).
- Add a "reconcile FINALIZING" pass on app foreground + on coordinator tick: `GET /recordings/:id` and if server already shows `uploaded`/`verified`, mark local entry as DONE and remove from queue.
- Cap retries on stuck states; after N failures, mark entry as `NEEDS_ATTENTION` and surface in History UI as a retry-able row (don't silently strangle).
- Telemetry on time-in-state per queue entry so we can alert on entries stuck > 5 min.

**Locations to look:**

- `apps/mobile/android/.../upload/UploadCoordinator*.kt` (or whatever owns the queue.json round-robin)
- `apps/mobile/android/.../upload/FinalizeWorker.kt`
- The MMKV-backed queue persistence — `files/upload-queue/queue.json` schema lives in the native upload module

---

## BUG-260518-03 — Disk pressure cascade: `Docker.raw` bloats unboundedly under steady-state E2E load

**Severity:** **HIGH** (dev-environment, but it broke the walk and cost ≈ 20 GB of unrecoverable headroom).

**Symptom on host (developer Mac):** during a single ≈ 90-minute walk with both devices recording continuously, the Mac's `/System/Volumes/Data` filled from "comfortable" to **100 % (432 MiB free)**. `~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw` ballooned to **460 GB**, occupying the entire SSD. Docker daemon then started returning `input/output error` on `docker exec`, container `hosts` files corrupted, postgres port-forward (5432) started refusing new TCP connections. The hash-verify worker's existing pool stayed working; the API server's existing pool stayed working; but **anything spawning a new container client failed**.

**Trigger:** LocalStack stored ~9 GB of completed recordings + however much in multipart-part overhead. Docker Desktop's sparse `Docker.raw` only grows, never auto-shrinks; macOS APFS does not reclaim sparse bytes without TRIM, which Docker Desktop only issues on restart / explicit compact.

**Knock-on effects observed during the walk:**

- Pixel 8a `/finalize` requests started returning 5xx (BullMQ couldn't enqueue jobs to the I/O-erroring Redis container) — directly caused BUG-02's stuck `FINALIZING`.
- `docker exec humyn-postgres psql …` failed → required bypassing docker entirely (host-side `pg` client, direct S3 REST to `localhost:4566`).
- The hash-verify worker (host-side Node process) stayed alive but was effectively read-only on new Redis connections.

**Mitigations (none are real fixes — this is dev-environment-only, but it'll bite again):**

- Bake a `docker compose down -v && docker system prune -af --volumes` step into the post-walk teardown so `Docker.raw` doesn't carry segments forward.
- Cap LocalStack disk usage (community-edition supports `LOCALSTACK_S3_DIR_BACKEND` with quotas in some configs — investigate).
- Add a host-side disk-headroom precheck to E2E-WALK-PROMPT.md: require `df -h /` to show ≥ 30 GB free before greenlight, and warn if `Docker.raw` is already > 100 GB.
- Run a periodic `fstrim` inside the Docker VM (`docker run --privileged --pid=host alpine nsenter -t1 -m -u -n -i fstrim /`) at the end of every walk.

**Not a product bug** — but it directly caused BUG-02's stuck queue on a real walk, so the test environment needs to be hardened or the bug is going to keep recurring.

---

## BUG-260518-04 — `video_codec` reported as `"unknown"` in every segment's `metadata.json`

**Severity:** **MEDIUM** (data-pipeline correctness — downstream training jobs key on `video_codec` to dispatch the right decoder; "unknown" will either misroute or be hard-coded to fall back to a wrong assumption).

**Evidence:** all 15 verified segments from this walk have `metadata.metadata.video_codec = "unknown"`. `video_profile = "main"` is correctly populated; `bitrate_bps = 8000000`, `bitrate_source = "configured"`, `bitrate_mode = "cbr"`, `gop = 30`, `b_frames = false`, `color_space = "bt709"`, `color_depth_bits = 8` all populate correctly. Only `video_codec` is `"unknown"`.

**Expected:** `"hevc"` per the LOCKED capture spec (`idea-brief.md` §2.1) and the CAPTURE-QA-01 banner: _"every spec-relevant field (`fps` / `resolution` / `video_codec` / …) is derived from the encoder's `OUTPUT_FORMAT_CHANGED` MediaFormat + MediaExtractor track-header read + measured surface rotation"_.

**Likely cause:** `MetadataComposer.compose()` reads the codec name from the `MediaFormat` returned in `INFO_OUTPUT_FORMAT_CHANGED` via a key that's either:

- not populated on the codec's output format (some Android encoders only expose codec name on the input format), or
- being read with a key that resolves to `null` and fed through a `?: "unknown"` fallback.

The fix is to derive the codec from the codec name we explicitly configure (`"video/hevc"` MIME → `"hevc"`), or from `MediaExtractor` on the produced MP4's track header (the spec-compliant path). Likely a one-line fix in `MetadataComposer.composeVideo*()`.

**Trail:** quick task `.planning/quick/260517-p5g-capture-spec-enforcement-metadata-truthf/` documents the truthfulness work that landed CAPTURE-QA-01; this regression slipped past it.

---

## BUG-260518-05 — Early-session IMU↔video drift spikes far outside spec; recovers after several minutes

**Severity:** **MEDIUM-HIGH** (drift-gate is currently telemetry-only per the relaxed-banner decision 2026-05-12, so this doesn't fail any recording — but it shows the capture pipeline is genuinely unable to maintain even the relaxed drift target on cold-start or under sustained load).

**Evidence (per-segment `imu_video_drift_{max,mean,p99}_ms`, in capture order):**

Pixel 10a (kgen.io, ultrawide gate is HEVC stream's lens):
| seg | drift max / mean / p99 ms |
|---|---|
| 1 (01KRVKTSFA) | **258.65 / 114.44 / 254.34** |
| 2 (01KRVMD4HF) | **181.62 / 33.14 / 158.41** |
| 3 (01KRVMZFJA — truncated, crash) | 123.73 / 20.74 / 112.35 |
| 4 (01KRVN9C73) | 77.57 / 6.90 / 62.33 |
| 5 (01KRVNVQ8S) | 3.66 / 3.16 / 3.20 |
| 6 (01KRVPE29T) | 3.78 / 3.24 / 3.28 |
| 7 (01KRVQ0DBE) | 1.29 / 0.01 / 0.10 |
| 8 (01KRVQJRC7) | 1.73 / 0.41 / 0.47 |
| 9 (01KRVR53DA) | 3.35 / 2.98 / 3.03 |

Pixel 8a (m.adnaan161):
| seg | drift max / mean / p99 ms |
|---|---|
| 1 (01KRVKTGT2) | 14.91 / 0.68 / 0.92 |
| 2 (01KRVMCVTE) | 10.89 / 0.90 / 1.15 |
| 3 (01KRVMZ6ST) | **357.97 / 137.58 / 341.56** |
| 4 (01KRVNHHS5) | 2.36 / 1.68 / 1.93 |
| 5 (01KRVP3WRP) | 1.29 / 0.50 / 0.74 |
| 6 (01KRVPP7RK) | 3.11 / 2.20 / 2.45 |

**Pattern:** monotonic recovery on Pixel 10a from segment 1 → segment 5 (likely thermal warm-up + ultrawide-pipeline buffer settling); single isolated catastrophic spike on Pixel 8a segment 3 (likely the same IMU-leak-pressure event from BUG-01 hitting the dispatch path).

**Decision per CLAUDE.md drift banner:** keep recording, do not gate. But the magnitude here is well beyond the relaxed-banner's documented ultrawide profile (max 6.16 / mean 5.58 / p99 5.63 ms on a clean 10-min gate-pass segment). Worth a follow-up to either:

- understand why the first 2-3 segments after fresh start are an order of magnitude worse, OR
- introduce a "warm-up" segment that's not uploaded (record-and-discard for 60 s after start), OR
- accept and document explicitly in `ULTRAWIDE-DRIFT-FINDINGS.md`.

The Pixel 8a seg-3 spike (`357.97 / 137.58 / 341.56`) is essentially impossible without something blocking the IMU dispatcher mid-segment. Combined with BUG-01 it strongly suggests the IMU buffer accumulation also slows dispatch, not just retains memory.

---

## Other observations (non-bugs, captured for completeness)

- Pixel 10a has TWO Google accounts signed in (`m.adnaan161@gmail.com` AND `adnaan@kgen.io`); Pixel 8a has only `m.adnaan161@gmail.com`. The recording-to-account binding worked correctly in both cases.
- All 15 verified segments stamped `fps ≥ 29.74` (well above the 29.0 cancel-gate from CAPTURE-QA-01); resolution `1920×1080` confirmed on every segment.
- IMU `min_rate_hz_observed_p1` = 798 (Pixel 10a) / 934 (Pixel 8a) on every segment — well above the LOCKED 100 Hz floor.
- `dfov_degrees` = 115.95° on Pixel 8a; ≥ 110° spec confirmed.
- Capture device: Pixel 8a stamped `Android 16` / `app_version 0.1.0-apk` correctly; Pixel 10a same.
- Start-gate (`hand_detection`) passed on every segment; `consecutive_hits_required: 2`, `platform_cadence_ms: 250`.
