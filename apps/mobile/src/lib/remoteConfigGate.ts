// remoteConfigGate — HAND-11. The pre-record hand-gate's cadence / target-hits
// / minimum-detection-confidence are Firebase Remote Config keys so they can be
// retuned without an app release — e.g. lower `min_hand_detection_confidence`
// if the Skip-rate climbs above ~30% in a locale (Pitfall 8/12), or shorten the
// cadence on faster hardware. MUST degrade gracefully to the hard-coded Android
// defaults on a fetch failure or a missing/invalid key (Security V14 — a
// RemoteConfig outage can never block the gate).
//
//   gate.consecutive_hits_required  → targetHits                 (Android default 2 — 2×250 ms ≈ 0.5 s "hands in frame")
//   gate.cadence_ms                 → cadenceMs                   (Android default 250)
//   gate.min_hand_detection_confidence → minHandDetectionConfidence (Android default 0.5)
//
// Values are clamped to sane ranges: targetHits ≥ 1, cadenceMs ≥ 100,
// minHandDetectionConfidence ∈ [0, 1].

import remoteConfig from '@react-native-firebase/remote-config';

export interface GateConfig {
  targetHits: number;
  cadenceMs: number;
  minHandDetectionConfidence: number;
}

// Android hard-coded defaults — the unconditional fallback if RemoteConfig is
// unreachable or returns garbage (Security V14).
export const GATE_DEFAULTS: GateConfig = {
  targetHits: 2,
  cadenceMs: 250,
  minHandDetectionConfidence: 0.5,
};

const KEY_TARGET_HITS = 'gate.consecutive_hits_required';
const KEY_CADENCE_MS = 'gate.cadence_ms';
const KEY_MIN_CONF = 'gate.min_hand_detection_confidence';

/**
 * Read the gate config from Firebase Remote Config. Best-effort: sets the
 * Android defaults, runs `fetchAndActivate()` (a failure here is swallowed —
 * the activated/default values are still readable), then reads + clamps each
 * key. Any thrown error → the hard-coded Android defaults.
 */
export async function readGateConfig(): Promise<GateConfig> {
  try {
    const rc = remoteConfig();
    try {
      await rc.setDefaults({
        [KEY_TARGET_HITS]: GATE_DEFAULTS.targetHits,
        [KEY_CADENCE_MS]: GATE_DEFAULTS.cadenceMs,
        [KEY_MIN_CONF]: GATE_DEFAULTS.minHandDetectionConfidence,
      });
      await rc.fetchAndActivate();
    } catch {
      // RemoteConfig fetch failed (offline / throttled / not configured) —
      // proceed with whatever `getValue` returns (the setDefaults values, or
      // the engine's own defaults). Never let this block the gate.
    }
    const targetHits = Math.max(
      1,
      Math.round(rc.getValue(KEY_TARGET_HITS).asNumber() || GATE_DEFAULTS.targetHits),
    );
    const cadenceMs = Math.max(
      100,
      Math.round(rc.getValue(KEY_CADENCE_MS).asNumber() || GATE_DEFAULTS.cadenceMs),
    );
    const minHandDetectionConfidence = Math.min(
      1,
      Math.max(0, rc.getValue(KEY_MIN_CONF).asNumber() || GATE_DEFAULTS.minHandDetectionConfidence),
    );
    return { targetHits, cadenceMs, minHandDetectionConfidence };
  } catch {
    return { ...GATE_DEFAULTS };
  }
}
