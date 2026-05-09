// locationPermission service unit tests — PERM-03 (plan 02-14).
//
// Verifies the helper:
//   1. Calls react-native-permissions check/request with the canonical
//      ANDROID.ACCESS_COARSE_LOCATION permission string.
//   2. Maps every documented PermissionStatus to a typed CoarseLocationStatus,
//      including the unknown-status fall-through (defensive: react-native-
//      permissions has occasionally added new RESULTS.* over the years).
//
// The vitest.setup.ts canonical mock only registers ANDROID.CAMERA + ANDROID.
// RECORD_AUDIO. Per-test we override that mock with a richer one that
// exposes ANDROID.ACCESS_COARSE_LOCATION.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native-permissions', () => ({
  check: vi.fn(),
  request: vi.fn(),
  PERMISSIONS: {
    ANDROID: { ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION' },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
    UNAVAILABLE: 'unavailable',
  },
}));

import { check, request } from 'react-native-permissions';
import { checkCoarseLocation, requestCoarseLocation } from '../../src/services/locationPermission';

beforeEach(() => {
  vi.mocked(check).mockReset();
  vi.mocked(request).mockReset();
});

describe('locationPermission', () => {
  it('checkCoarseLocation maps GRANTED to granted and uses ACCESS_COARSE_LOCATION', async () => {
    vi.mocked(check).mockResolvedValue('granted' as never);
    await expect(checkCoarseLocation()).resolves.toBe('granted');
    expect(check).toHaveBeenCalledWith('android.permission.ACCESS_COARSE_LOCATION');
  });

  it('checkCoarseLocation maps BLOCKED to blocked', async () => {
    vi.mocked(check).mockResolvedValue('blocked' as never);
    await expect(checkCoarseLocation()).resolves.toBe('blocked');
  });

  it('checkCoarseLocation maps LIMITED to limited', async () => {
    vi.mocked(check).mockResolvedValue('limited' as never);
    await expect(checkCoarseLocation()).resolves.toBe('limited');
  });

  it('checkCoarseLocation maps UNAVAILABLE to unavailable', async () => {
    vi.mocked(check).mockResolvedValue('unavailable' as never);
    await expect(checkCoarseLocation()).resolves.toBe('unavailable');
  });

  it('requestCoarseLocation calls request and maps DENIED to denied', async () => {
    vi.mocked(request).mockResolvedValue('denied' as never);
    await expect(requestCoarseLocation()).resolves.toBe('denied');
    expect(request).toHaveBeenCalledWith('android.permission.ACCESS_COARSE_LOCATION');
  });

  it('requestCoarseLocation maps GRANTED to granted', async () => {
    vi.mocked(request).mockResolvedValue('granted' as never);
    await expect(requestCoarseLocation()).resolves.toBe('granted');
  });

  it('unknown PermissionStatus values fall through to unavailable', async () => {
    vi.mocked(check).mockResolvedValue('weird-future-status' as never);
    await expect(checkCoarseLocation()).resolves.toBe('unavailable');
  });
});
