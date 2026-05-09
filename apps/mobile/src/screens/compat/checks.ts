// Display-row mapping for the compat-running checklist (design-spec §4).
//
// The CompatResult schema (shared/types/src/CompatResult.ts) carries 12 internal
// per-check fields (resolution, fps, ultrawideDfov, imuSustained100Hz, imuP99Ms,
// micSampleRate, realtimeTimestamp, root, freeStorageGB, encoderNoBFrames,
// oisOff, hdrSdrForced) — but design-spec §4 collapses these into 7 user-facing
// rows. This module owns the collapse-mapping so the running screen and the
// fail screen agree on which internal failures roll up into which row.
//
// Plan 02-15 Task 1.

import type { CompatResult } from '@humyn/shared-types';

/** Stable key for each user-facing row in the CompatRunning checklist. */
export type DisplayRowKey =
  | 'ultrawide'
  | 'resolutionFps'
  | 'motionSensors'
  | 'imu'
  | 'mic'
  | 'realtime'
  | 'integrity';

/** Verbatim row order + labels from design-spec §4. */
export const DISPLAY_ROWS: { key: DisplayRowKey; label: string }[] = [
  { key: 'ultrawide', label: 'Ultrawide camera' },
  { key: 'resolutionFps', label: '1080p @ 30 FPS' },
  { key: 'motionSensors', label: 'Motion sensors' },
  { key: 'imu', label: 'Stable sensor stream' },
  { key: 'mic', label: 'Microphone' },
  { key: 'realtime', label: 'Time sync source' },
  { key: 'integrity', label: 'Device integrity' },
];

export interface DisplayRow {
  key: DisplayRowKey;
  pass: boolean;
  detail?: string;
}

/**
 * Map an assembled CompatResult into a per-row pass/fail array for the UI.
 *
 * Internal-to-display roll-up:
 *   - ultrawide       ← checks.ultrawideDfov.pass (with measured dFOV detail)
 *   - resolutionFps   ← checks.resolution AND checks.fps
 *   - motionSensors   ← checks.imuSustained100Hz.pass OR checks.imuP99Ms.pass
 *                       (presence-of-stream signal; "passes" if either survives)
 *   - imu             ← checks.imuSustained100Hz.pass AND checks.imuP99Ms.pass
 *                       (full stability with measured Hz detail)
 *   - mic             ← checks.micSampleRate
 *   - realtime        ← checks.realtimeTimestamp
 *   - integrity       ← checks.root.pass AND .encoderNoBFrames AND .oisOff
 *                       AND .hdrSdrForced
 */
export function rowsFromResult(r: CompatResult): DisplayRow[] {
  const c = r.checks;
  const rows: DisplayRow[] = [];

  const ultrawideRow: DisplayRow = { key: 'ultrawide', pass: c.ultrawideDfov.pass };
  if (!c.ultrawideDfov.pass) {
    ultrawideRow.detail = `${c.ultrawideDfov.measuredDeg.toFixed(0)}° (need 110°+)`;
  }
  rows.push(ultrawideRow);

  rows.push({ key: 'resolutionFps', pass: c.resolution && c.fps });
  rows.push({ key: 'motionSensors', pass: c.imuSustained100Hz.pass || c.imuP99Ms.pass });

  const imuRow: DisplayRow = {
    key: 'imu',
    pass: c.imuSustained100Hz.pass && c.imuP99Ms.pass,
  };
  if (!c.imuSustained100Hz.pass) {
    imuRow.detail = `yours: ${c.imuSustained100Hz.measuredHz.toFixed(0)} Hz (need 100 Hz+)`;
  }
  rows.push(imuRow);

  rows.push({ key: 'mic', pass: c.micSampleRate });
  rows.push({ key: 'realtime', pass: c.realtimeTimestamp });
  rows.push({
    key: 'integrity',
    pass: c.root.pass && c.encoderNoBFrames && c.oisOff && c.hdrSdrForced,
  });

  return rows;
}
