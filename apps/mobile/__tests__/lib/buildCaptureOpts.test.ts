// buildCaptureOpts + readGateConfig — plan 04-09 Task 1.
//
// buildCaptureOpts must produce a shape that `CaptureSessionOptsSchema.parse`
// ACCEPTS (the Kotlin side re-validates with the same Zod shape — T-3.3-01),
// throw when consent is absent (V11 — consent never defaulted), coerce an
// unrecognized gender to `null`, round a fractional gate duration, and accept
// the apkRollout `-apk`-suffixed semver. readGateConfig must return the
// hard-coded Android defaults when RemoteConfig throws (Security V14).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptureSessionOptsSchema } from '@humyn/shared-types';

// ---------------------------------------------------------------------------
// @react-native-firebase/remote-config — not in vitest.setup.ts; mocked here.
// The default export is a function returning the RC instance; tests flip its
// behaviour per-case via the spies below.
// ---------------------------------------------------------------------------
const { rcSetDefaults, rcFetchAndActivate, rcGetValue, rcFactory } = vi.hoisted(() => {
  const rcSetDefaults = vi.fn().mockResolvedValue(true);
  const rcFetchAndActivate = vi.fn().mockResolvedValue(true);
  // getValue(key) → { asNumber(): number }. Default returns 0 so the `|| default`
  // fallback in readGateConfig kicks in (covers the "key missing" path too).
  const rcGetValue = vi.fn((_key: string): { asNumber: () => number } => ({
    asNumber: (): number => 0,
  }));
  const rcFactory = vi.fn(() => ({
    setDefaults: rcSetDefaults,
    fetchAndActivate: rcFetchAndActivate,
    getValue: rcGetValue,
  }));
  return { rcSetDefaults, rcFetchAndActivate, rcGetValue, rcFactory };
});

vi.mock('@react-native-firebase/remote-config', () => ({ default: rcFactory }));

import { buildCaptureOpts } from '../../src/lib/buildCaptureOpts';
import { readGateConfig, GATE_DEFAULTS } from '../../src/lib/remoteConfigGate';

function validArgs(overrides: Partial<Parameters<typeof buildCaptureOpts>[0]> = {}) {
  return {
    taskId: 'cooking_chop_vegetables',
    taskName: 'Chop vegetables',
    taskCategory: 'cooking',
    taskSetting: 'indoor' as const,
    isPractice: false,
    gate: { passed: true, skipped: false, bypassed: false, durationMs: 1500 },
    gateConfig: { targetHits: 5, cadenceMs: 400 },
    compat: { ultrawideDfovMeasuredDeg: 115.2 },
    user: {
      name: 'Test Contributor',
      email: 'test@example.com',
      age: 27,
      gender: 'female' as string | null,
      consentPresent: true,
    },
    appVersion: '1.0.0',
    ...overrides,
  };
}

describe('buildCaptureOpts (D-API-02 shape)', () => {
  it('produces a CaptureSessionOpts that CaptureSessionOptsSchema.parse accepts (non-practice)', () => {
    expect(() => CaptureSessionOptsSchema.parse(buildCaptureOpts(validArgs()))).not.toThrow();
  });

  it('produces a parseable CaptureSessionOpts for a practice recording', () => {
    const opts = buildCaptureOpts(
      validArgs({
        taskId: '__practice__',
        taskName: 'Practice — 60 sec',
        taskCategory: 'practice',
        isPractice: true,
        gate: { passed: false, skipped: true, bypassed: false, durationMs: 0 },
      }),
    );
    expect(() => CaptureSessionOptsSchema.parse(opts)).not.toThrow();
    expect(opts.isPractice).toBe(true);
    expect(opts.startGate.skipped).toBe(true);
    expect(opts.startGate.passed).toBe(false);
  });

  it('THROWS when the verified consent state is absent (V11 — consent never defaulted)', () => {
    expect(() =>
      buildCaptureOpts(validArgs({ user: { ...validArgs().user, consentPresent: false } })),
    ).toThrow(/without recorded consent/);
  });

  it('coerces an unrecognized gender to null', () => {
    const opts = buildCaptureOpts(
      validArgs({ user: { ...validArgs().user, gender: 'something-weird' } }),
    );
    expect(opts.contributor.gender).toBeNull();
    expect(() => CaptureSessionOptsSchema.parse(opts)).not.toThrow();
  });

  it('passes through a recognized narrow gender', () => {
    expect(
      buildCaptureOpts(validArgs({ user: { ...validArgs().user, gender: 'non-binary' } }))
        .contributor.gender,
    ).toBe('non-binary');
  });

  it('rounds a fractional gate duration to the nearest integer', () => {
    expect(
      buildCaptureOpts(
        validArgs({ gate: { passed: true, skipped: false, bypassed: false, durationMs: 1500.7 } }),
      ).startGate.durationMs,
    ).toBe(1501);
  });

  it('accepts the apkRollout -apk-suffixed semver appVersion', () => {
    const opts = buildCaptureOpts(validArgs({ appVersion: '1.0.0-apk' }));
    expect(() => CaptureSessionOptsSchema.parse(opts)).not.toThrow();
    expect(opts.appVersion).toBe('1.0.0-apk');
  });

  it('threads dfovDegrees + startGate config + location:null + type:hand_detection', () => {
    const opts = buildCaptureOpts(validArgs({ gateConfig: { targetHits: 3, cadenceMs: 600 } }));
    expect(opts.dfovDegrees).toBe(115.2);
    expect(opts.startGate.type).toBe('hand_detection');
    expect(opts.startGate.consecutiveHitsRequired).toBe(3);
    expect(opts.startGate.platformCadenceMs).toBe(600);
    expect(opts.location).toBeNull();
  });
});

describe('readGateConfig (HAND-11 — RemoteConfig with hard-coded fallbacks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rcGetValue.mockImplementation((_key: string) => ({ asNumber: (): number => 0 }));
    rcFactory.mockImplementation(() => ({
      setDefaults: rcSetDefaults,
      fetchAndActivate: rcFetchAndActivate,
      getValue: rcGetValue,
    }));
    rcFetchAndActivate.mockResolvedValue(true);
  });

  it('returns the activated RemoteConfig values, clamped to sane ranges', async () => {
    rcGetValue.mockImplementation((key: string) => {
      if (key === 'gate.consecutive_hits_required') return { asNumber: (): number => 3 };
      if (key === 'gate.cadence_ms') return { asNumber: (): number => 600 };
      if (key === 'gate.min_hand_detection_confidence') return { asNumber: (): number => 0.4 };
      return { asNumber: (): number => 0 };
    });
    const cfg = await readGateConfig();
    expect(cfg).toEqual({ targetHits: 3, cadenceMs: 600, minHandDetectionConfidence: 0.4 });
  });

  it('clamps out-of-range values (targetHits ≥ 1, cadenceMs ≥ 100, conf ∈ [0,1])', async () => {
    rcGetValue.mockImplementation((key: string) => {
      if (key === 'gate.consecutive_hits_required') return { asNumber: (): number => -2 };
      if (key === 'gate.cadence_ms') return { asNumber: (): number => 10 };
      if (key === 'gate.min_hand_detection_confidence') return { asNumber: (): number => 5 };
      return { asNumber: (): number => 0 };
    });
    const cfg = await readGateConfig();
    // -2 → 0 falls back to the default 5 then Math.max(1, …); 10 → 100; 5 → 1.
    expect(cfg.targetHits).toBeGreaterThanOrEqual(1);
    expect(cfg.cadenceMs).toBeGreaterThanOrEqual(100);
    expect(cfg.minHandDetectionConfidence).toBeLessThanOrEqual(1);
    expect(cfg.minHandDetectionConfidence).toBeGreaterThanOrEqual(0);
  });

  it('returns the hard-coded Android defaults when RemoteConfig throws (Security V14)', async () => {
    rcFactory.mockImplementation(() => {
      throw new Error('RemoteConfig not configured');
    });
    const cfg = await readGateConfig();
    expect(cfg).toEqual(GATE_DEFAULTS);
    expect(cfg).toEqual({ targetHits: 5, cadenceMs: 400, minHandDetectionConfidence: 0.5 });
  });

  it('still returns usable values when fetchAndActivate rejects (offline)', async () => {
    rcFetchAndActivate.mockRejectedValue(new Error('offline'));
    rcGetValue.mockImplementation((_key: string) => ({ asNumber: (): number => 0 }));
    const cfg = await readGateConfig();
    // getValue returns 0 → the `|| default` fallback applies.
    expect(cfg).toEqual({ targetHits: 5, cadenceMs: 400, minHandDetectionConfidence: 0.5 });
  });
});
