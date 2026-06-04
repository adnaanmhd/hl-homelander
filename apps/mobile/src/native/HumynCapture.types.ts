/**
 * Phase 3 D-API-03 event payload contracts for the `HumynCapture` native
 * module. Mirrored on the Kotlin side via `WritableMap` composition in
 * `HumynCaptureModule.kt` (Plan 03-09 wires the Kotlin emit path).
 *
 * These shapes are the public contract Phase 4's RecordingScreen
 * subscribes to via the `onSegmentStart` / `onSegmentComplete` /
 * `onSessionStop` / `onThermalAbort` / `onError` helpers exported from
 * `./HumynCapture`.
 */

/** Emitted when a new segment's encoder is up + the first frame is written. */
export interface SegmentStartEvent {
  /** ULID for this segment. */
  segmentId: string;
  /** ULID for the recording (per-segment, no parent_recording_id linkage). */
  recordingId: string;
  /** ISO 8601 wallclock with offset, captured at segment-start. */
  startedAt: string;
  /** YYYYMMDD_HHMMSS_NNN — same base for the .mp4 / .csv / .json triple. */
  filenameBase: string;
}

/** Emitted after the per-segment finalize completes (SHA + drift + JSON). */
export interface SegmentCompleteEvent {
  segmentId: string;
  recordingId: string;
  /**
   * Bug 9 (260604) — the task this segment was recorded under, copied from the
   * sidecar at capture-start (mirrors `SegmentCanceledEvent.taskId`). The JS
   * auto-enqueue keys the upload's task on THIS value, not a render closure over
   * `route.params.taskId`, so a late segment-complete fired after the Recording
   * route was reused for another task can't be uploaded under the wrong name.
   */
  taskId: string;
  /** Absolute filesystem path to the finalized fragmented MP4. */
  mp4Path: string;
  /** Absolute path to the IMU sidecar CSV. */
  csvPath: string;
  /** Absolute path to the per-segment metadata JSON (schema 1.1.0). */
  jsonPath: string;
  durationMs: number;
  /**
   * Drift figures `{max, mean, p99}` per `idea-brief.md §6.5` least-squares
   * residual subtraction. Memory `project_drift_metrics.md` — three
   * figures, never just `mean`.
   */
  drift: { max: number; mean: number; p99: number };
  /**
   * D-IMU-02 — sliding-window-1s p1 over inter-sample IMU intervals,
   * stamped into the metadata JSON's `metadata.metadata.imu_min_rate_hz_observed_p1`.
   */
  imuMinRateHzObservedP1: number;
  /**
   * Phase 6 D-05 (Plan 06-04) — absolute path to the first-frame JPEG
   * thumbnail extracted by `FinalizeWorker` step 8.5, or `null` when the
   * native extractor failed (best-effort). The Plan 06-09 JS-side
   * segment-complete handler in `RecordingScreen.tsx` reads this and
   * passes it to `thumbnailLedger.writeEntry({ thumbnailPath, ... })` so
   * the History row renders the local JPEG (D-05); absent/null falls
   * back to the gradient + first-letter task-name overlay (D-04).
   *
   * Optional on the type for backward compatibility with native builds
   * that pre-date Plan 06-04 (older payloads simply omit the key).
   */
  thumbnailPath?: string | null;
}

/**
 * Quick task 260517-p5g CAPTURE-QA-01..04 — emitted by the native
 * FinalizeWorker when a segment fails one of the capture-quality gates
 * (mean_fps < 29, MP4-track-header w<1920 || h<1080, videoFrameTimestamps
 * < 2 entries) and is therefore canceled. The segment NEVER enters the
 * upload queue; the RecordingScreen handler writes a History-row ledger
 * entry then deletes the MP4 + CSV + metadata JSON bundle files from
 * cacheDir (write-then-delete).
 */
export type SegmentCancelReason = 'fps_dropped' | 'resolution_dropped' | 'insufficient_frames';

export interface SegmentCanceledEvent {
  /** ULID for the canceled segment. */
  segmentId: string;
  /** ULID for the recording (per-segment, mirrors SegmentCompleteEvent). */
  recordingId: string;
  /** Task ID copied from the sidecar (so the History ledger entry can resolve task name). */
  taskId: string;
  /** YYYYMMDD_HHMMSS_NNN — for the History ledger filename field. */
  filenameBase: string;
  /** Absolute filesystem path to the segment's MP4 — to be unlinked AFTER the ledger write. */
  mp4Path: string;
  /** Absolute path to the IMU sidecar CSV — to be unlinked. */
  csvPath: string;
  /**
   * Absolute path to the (never-written) metadata JSON — unlinked
   * defensively; the FinalizeWorker cancel branch does NOT call
   * `MetadataComposer.compose`, so the JSON file should not exist on
   * disk, but the unlink is best-effort idempotent.
   */
  jsonPath: string;
  /** Wallclock at session start — for the History row's createdAt. */
  recordedAt: string;
  /** Wall-clock duration even when truncated (the user still spent time). */
  durationMs: number;
  /** Reason code matching the native CancelReason taxonomy. */
  reason: SegmentCancelReason;
  /** Measured mean FPS — present only when reason === 'fps_dropped'. */
  meanFps: number | null;
  /** Muxed-track width — present only when reason === 'resolution_dropped'. */
  width: number | null;
  /** Muxed-track height — present only when reason === 'resolution_dropped'. */
  height: number | null;
}

/** Emitted on session-end after the final segment finalizes. */
export interface SessionStopEvent {
  sessionId: string;
  segmentsCompleted: number;
}

/**
 * Emitted when `PowerManager.OnThermalStatusChangedListener` fires with
 * `≥ THROTTLING_SEVERE` mid-record. Phase 4 listens here and fires the
 * voice cue + toast (D-THERM-01).
 */
export interface ThermalAbortEvent {
  segmentId: string;
  /** Stringified `PowerManager.THERMAL_STATUS_*` constant. */
  currentStatus: string;
}

/**
 * Generic capture-pipeline failure surface. The `code` taxonomy is
 * planner-discretion (D-CONTEXT — error semantics on encoder/storage
 * crash); examples include:
 *   - `thermal_throttling` (T-3.3-01 indirect — pre-record refuse)
 *   - `storage_full`
 *   - `permission_revoked`
 *   - `internal_error` (filename_seq_exhausted, etc.)
 */
export interface CaptureErrorEvent {
  code: string;
  message: string;
  recoverable: boolean;
  segmentId?: string;
}

/**
 * D-LIFE-04 (Phase 4 plan 04-10) — emitted ONCE on app launch when the
 * Phase-3 app-launch sweep (`CaptureLaunchSweep`) re-finalizes orphan
 * segments after a force-quit / OS-evict (i.e. there is recoverable
 * capture work). `recovered` lists the re-finalize-candidate
 * `filenameBase`s the sweep logged off their `.session.json` sidecars;
 * the actual re-finalize off the sidecar happens later (Phase 5's upload
 * pipeline picks the triple up — Phase 4 just surfaces the Home
 * "Recording recovered after force-quit — uploading." toast). RecordingScreen
 * is NOT shown during recovery; the user sees the recording arrive in
 * History (Phase 6). One-shot per launch: the JS listener `.remove()`s
 * itself after the first fire.
 */
export interface CrashRecoveryEvent {
  /** Re-finalize-candidate filenameBases (YYYYMMDD_HHMMSS_NNN). */
  recovered: string[];
}

/**
 * Resolution shape of `HumynCapture.start(opts)`. Resolves when the
 * encoder is up and the first frame is written. Promise rejects with
 * `Error(code: '...')` for pre-flight failures (thermal, permission,
 * storage) per D-API-01.
 */
export interface CaptureStartResponse {
  sessionId: string;
  segmentId: string;
  recordingId: string;
  /** YYYYMMDD_HHMMSS_NNN — same base for the .mp4 / .csv / .json triple. */
  filenameBase: string;
}
