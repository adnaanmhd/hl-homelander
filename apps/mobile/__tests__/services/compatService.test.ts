// compatService unit tests — Phase 2 plan 02-15 Task 1.
//
// Coverage:
//   - happy path: all 12 checks pass, MMKV writes both blobs, returns CompatResult
//   - low-storage: freeStorageGB < 5 sets warningOnly=true but does NOT fail
//   - IMU low: sustainedHz=44 fails imuSustained100Hz; passed=false; clears compatPassed
//   - needsRerun: true when no stored result
//   - needsRerun: false when signature matches stored
//   - getStoredCompatResult round-trips; clearStoredCompatResult wipes both keys
//
// Pattern: rely on the canonical react-native-mmkv mock from vitest.setup.ts.
// vi.mock the three HumynCompat probe functions + AppFlavor + installationId
// service so the orchestration is observed end-to-end without touching native.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';

// Hoisted mocks for the three probes + the sync sha256 surface.
const mocks = vi.hoisted(() => ({
  runEncoderProbe: vi.fn(),
  runImuProbe: vi.fn(),
  readDeviceCaps: vi.fn(),
  sha256Spy: vi.fn((s: string) => `sig-${s.length.toString(16).padStart(16, '0')}`),
}));

vi.mock('../../src/native/HumynCompat', () => ({
  runEncoderProbe: mocks.runEncoderProbe,
  runImuProbe: mocks.runImuProbe,
  readDeviceCaps: mocks.readDeviceCaps,
}));

vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
    versionName: '0.1.0',
    versionCode: 1,
    deviceModel: 'Pixel 7a',
  }),
  getOrMintInstallationId: vi.fn(async () => 'inst-uuid-fixed'),
}));

vi.mock('../../src/services/installationId', () => ({
  getInstallationId: vi.fn(async () => {
    secureMmkv.set(KEYS.INSTALLATION_ID, 'inst-uuid-fixed');
    return 'inst-uuid-fixed';
  }),
  getInstallationIdSync: () => 'inst-uuid-fixed',
}));

// react-native shim — extend NativeModules to expose AppFlavor.sha256First16Hex.
vi.mock('react-native', () => ({
  NativeModules: {
    AppFlavor: {
      sha256First16Hex: mocks.sha256Spy,
    },
  },
}));

// Default fixtures — happy path (all checks pass).
const HAPPY_ENCODER = {
  bFramePresent: false,
  oisOff: true,
  hdrSdrForced: true,
  encoderClipPath: '/tmp/x.mp4',
};
const HAPPY_IMU = { sustainedHz: 200, p99IntervalMs: 6, samplesCollected: 6000 };
const HAPPY_CAPS = {
  resolutionMax: { w: 1920, h: 1080 },
  fpsMax: 30,
  ultrawideDfovDeg: 118,
  micSampleRateMax: 48000,
  realtimeTimestampSource: true,
  motionSensorsPresent: true,
  rooted: false,
  freeStorageGB: 12.5,
};

beforeEach(() => {
  for (const k of Object.values(KEYS)) {
    secureMmkv.remove(k);
  }
  mocks.runEncoderProbe.mockReset();
  mocks.runImuProbe.mockReset();
  mocks.readDeviceCaps.mockReset();
  mocks.sha256Spy.mockClear();
  // Restore default-happy resolved values.
  mocks.runEncoderProbe.mockResolvedValue(HAPPY_ENCODER);
  mocks.runImuProbe.mockResolvedValue(HAPPY_IMU);
  mocks.readDeviceCaps.mockResolvedValue(HAPPY_CAPS);
});

describe('compatService.runCompatCheck', () => {
  it('Test 1: happy path — all 12 checks pass; MMKV blobs persisted', async () => {
    const { runCompatCheck } = await import('../../src/services/compatService');

    const result = await runCompatCheck();

    expect(result.passed).toBe(true);
    expect(result.failedKeys).toEqual([]);
    expect(result.checks.imuSustained100Hz.measuredHz).toBe(200);
    expect(result.checks.freeStorageGB.warningOnly).toBe(false);
    expect(result.checks.freeStorageGB.pass).toBe(true);

    const fullRaw = secureMmkv.getString(KEYS.COMPAT_LAST_RESULT);
    expect(fullRaw).toBeDefined();
    const parsedFull = JSON.parse(fullRaw!) as { passed: boolean };
    expect(parsedFull.passed).toBe(true);

    const passedRaw = secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED);
    expect(passedRaw).toBeDefined();
    const parsedPassed = JSON.parse(passedRaw!) as { passed: boolean };
    expect(parsedPassed.passed).toBe(true);

    // Native probes called with the documented contract.
    expect(mocks.runImuProbe).toHaveBeenCalledWith(30_000, true);
  });

  it('Test 2: freeStorageGB < 5 → warningOnly=true, pass=true (does NOT fail the check)', async () => {
    mocks.readDeviceCaps.mockResolvedValueOnce({ ...HAPPY_CAPS, freeStorageGB: 3.2 });
    const { runCompatCheck } = await import('../../src/services/compatService');

    const result = await runCompatCheck();

    expect(result.passed).toBe(true);
    expect(result.checks.freeStorageGB.warningOnly).toBe(true);
    expect(result.checks.freeStorageGB.pass).toBe(true);
    expect(result.checks.freeStorageGB.measuredGB).toBe(3.2);
  });

  it('Test 3: IMU sustained < 100 Hz → fails imuSustained100Hz; clears compatPassed key', async () => {
    mocks.runImuProbe.mockResolvedValueOnce({
      sustainedHz: 44,
      p99IntervalMs: 25,
      samplesCollected: 1320,
    });
    const { runCompatCheck } = await import('../../src/services/compatService');

    const result = await runCompatCheck();

    expect(result.passed).toBe(false);
    expect(result.failedKeys).toContain('imuSustained100Hz');
    expect(result.failedKeys).toContain('imuP99Ms');
    expect(result.checks.imuSustained100Hz.measuredHz).toBe(44);
    expect(result.checks.imuP99Ms.measuredMs).toBe(25);
    // compatPassed key cleared on a failed run.
    expect(secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED)).toBeUndefined();
    // Full result still persisted (so FailScreen can render diagnostic copy).
    expect(secureMmkv.getString(KEYS.COMPAT_LAST_RESULT)).toBeDefined();
  });

  it('Test 4: ultrawide dFOV < 110° fails ultrawideDfov with measured value', async () => {
    mocks.readDeviceCaps.mockResolvedValueOnce({ ...HAPPY_CAPS, ultrawideDfovDeg: 92 });
    const { runCompatCheck } = await import('../../src/services/compatService');

    const result = await runCompatCheck();

    expect(result.passed).toBe(false);
    expect(result.failedKeys).toContain('ultrawideDfov');
    expect(result.checks.ultrawideDfov.measuredDeg).toBe(92);
    expect(result.checks.ultrawideDfov.pass).toBe(false);
  });

  it('Test 5: bFramePresent=true fails encoderNoBFrames (HEVC spec violation)', async () => {
    mocks.runEncoderProbe.mockResolvedValueOnce({ ...HAPPY_ENCODER, bFramePresent: true });
    const { runCompatCheck } = await import('../../src/services/compatService');

    const result = await runCompatCheck();

    expect(result.passed).toBe(false);
    expect(result.failedKeys).toContain('encoderNoBFrames');
    expect(result.checks.encoderNoBFrames).toBe(false);
  });
});

describe('compatService.needsRerun', () => {
  it('Test 6: returns true when no stored result', async () => {
    const { needsRerun, clearStoredCompatResult } = await import(
      '../../src/services/compatService'
    );
    clearStoredCompatResult();
    expect(needsRerun()).toBe(true);
  });

  it('Test 7: returns false when signature matches stored', async () => {
    const { runCompatCheck, needsRerun } = await import('../../src/services/compatService');
    await runCompatCheck();
    expect(needsRerun()).toBe(false);
  });
});

describe('compatService.getStoredCompatResult / clearStoredCompatResult', () => {
  it('Test 8: round-trip MMKV; clear deletes both keys', async () => {
    const { runCompatCheck, getStoredCompatResult, clearStoredCompatResult } = await import(
      '../../src/services/compatService'
    );
    await runCompatCheck();
    expect(getStoredCompatResult()?.passed).toBe(true);

    clearStoredCompatResult();
    expect(getStoredCompatResult()).toBeUndefined();
    expect(secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED)).toBeUndefined();
  });
});
