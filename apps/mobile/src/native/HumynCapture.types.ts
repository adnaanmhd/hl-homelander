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
