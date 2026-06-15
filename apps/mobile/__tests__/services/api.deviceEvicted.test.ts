// apiClient — Bug 4 / D2 single-device newest-login-wins eviction.
//
// When an authed request 401s with the `device-evicted` problem slug, the
// client clears the session (JWT in store + MMKV), flags the eviction so the
// Signup screen can explain it, and (best-effort) resets navigation to Signup.
// A generic 401 (unauthorized / token-version) must NOT trigger eviction.
//
// Pattern mirrors api.test.ts: spy on global fetch to drive the response.
// navigationRef.resetToOnboarding() no-ops here (no NavigationContainer is
// attached in the test env → isReady() is false), so the observable contract
// is the store + MMKV side effects.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Config } from 'react-native-config';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';
import { apiClient } from '../../src/services/api';
import { useAppStore } from '../../src/state/appStore';

const TEST_JWT = 'eyJhbGciOiJIUzI1NiJ9.fake.signature';
const EVICTED_BODY = JSON.stringify({
  type: 'https://humyn-app.io/problems/device-evicted',
  title: 'Signed out',
  status: 401,
  detail: 'Your account was used on another device',
});
const UNAUTHORIZED_BODY = JSON.stringify({
  type: 'https://humyn-app.io/problems/unauthorized',
  title: 'Unauthorized',
  status: 401,
});

function mock401(body: string): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, {
      status: 401,
      headers: { 'content-type': 'application/problem+json' },
    }) as unknown as Response,
  );
}

beforeEach(() => {
  Config.API_BASE_URL = 'http://test.example';
  secureMmkv.set(KEYS.AUTH_JWT, TEST_JWT);
  useAppStore.setState({ jwt: TEST_JWT, deviceEvicted: false });
  vi.restoreAllMocks();
});

describe('apiClient — device-evicted 401 (Bug 4 / D2)', () => {
  it('clears the session + flags eviction, then still throws', async () => {
    mock401(EVICTED_BODY);
    await expect(apiClient.get('/me')).rejects.toThrow(/401/);
    expect(useAppStore.getState().jwt).toBeNull();
    expect(useAppStore.getState().deviceEvicted).toBe(true);
    expect(secureMmkv.getString(KEYS.AUTH_JWT)).toBeUndefined();
  });

  it('triggers on a POST 401 device-evicted too', async () => {
    mock401(EVICTED_BODY);
    await expect(apiClient.post('/recordings/init', { foo: 1 })).rejects.toThrow(/401/);
    expect(useAppStore.getState().deviceEvicted).toBe(true);
  });

  it('a generic 401 (unauthorized) does NOT trigger eviction', async () => {
    mock401(UNAUTHORIZED_BODY);
    await expect(apiClient.get('/me')).rejects.toThrow(/401/);
    expect(useAppStore.getState().deviceEvicted).toBe(false);
    // session left intact for the caller's own handling.
    expect(useAppStore.getState().jwt).toBe(TEST_JWT);
  });
});
