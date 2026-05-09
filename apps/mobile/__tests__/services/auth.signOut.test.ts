// auth.signOut — verifies AUTH-08 client-cleanup contract:
//   - JWT cleared (auth.jwt.v1).
//   - All onboarding flags cleared
//     (consent.v1 / permsGranted.v1 / compatPassed.v1 / tutorialDone.v1).
//   - Device-bound state PRESERVED:
//       * compat.lastResult.v1   (signature embeds installation_id; same-
//         device re-login should NOT re-run the 30-second compat probe)
//       * installation_id.v1     (anchor for compat.signature)
//       * telemetry.ring.v1      (diagnostic ring; device-scoped)
//       * appVersion.cache.v1    (soft-upgrade cache; device-scoped)
//   - useAppStore.signOut() also called so the in-memory `jwt` slice is
//     wiped (defense-in-depth alongside the explicit MMKV.remove).
//
// Pattern: relies on the canonical react-native-mmkv mock from
// vitest.setup.ts (one shared in-memory store keyed by id). All other RN-
// adjacent imports (GoogleSignin, Keychain, Config, AppFlavor, PlayIntegrity,
// apiClient) are stubbed at the module boundary so importing auth.ts does
// not invoke any native bridge.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module stubs — keep auth.ts's transitive imports tree-shakeable in JSDOM.
// ---------------------------------------------------------------------------
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: vi.fn(), hasPlayServices: vi.fn(), signIn: vi.fn() },
}));
vi.mock('react-native-keychain', () => ({
  setGenericPassword: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('react-native-config', () => ({
  default: { GOOGLE_WEB_CLIENT_ID: '', API_BASE_URL: 'http://localhost:8080' },
}));
vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({ flavor: 'apkRollout', applicationId: 'ai.humynlabs.capture.apk' }),
}));
vi.mock('../../src/native/PlayIntegrity', () => ({
  requestIntegrityToken: vi.fn().mockResolvedValue('test-integrity-token'),
}));
vi.mock('../../src/services/api', () => ({
  apiClient: {
    post: vi.fn(),
    postNoBody: vi.fn(),
    get: vi.fn(),
    getJson: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postMultipart: vi.fn(),
  },
}));

import { signOut } from '../../src/services/auth';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';
import { useAppStore } from '../../src/state/appStore';

function seedFullDeviceState() {
  // Seed every key the canonical KEYS table knows about so the post-signOut
  // assertion has a baseline to verify against.
  secureMmkv.set(KEYS.AUTH_JWT, 'jwt-token-abc');
  secureMmkv.set(
    KEYS.ONBOARDING_CONSENT,
    JSON.stringify({ acceptedAt: 'x', consentVersion: 'v1' }),
  );
  secureMmkv.set(
    KEYS.ONBOARDING_PERMS_GRANTED,
    JSON.stringify({ camera: true, mic: true, grantedAt: 'x' }),
  );
  secureMmkv.set(KEYS.ONBOARDING_COMPAT_PASSED, JSON.stringify({ signature: 'sig', runAt: 'x' }));
  secureMmkv.set(KEYS.ONBOARDING_TUTORIAL_DONE, 'true');
  // Device-bound — must survive signOut.
  secureMmkv.set(KEYS.COMPAT_LAST_RESULT, JSON.stringify({ signature: 'sig', runAt: 'x' }));
  secureMmkv.set(KEYS.INSTALLATION_ID, 'install-uuid-zzz');
  secureMmkv.set(KEYS.TELEMETRY_RING, JSON.stringify([{ name: 'evt', ts: 1, props: {} }]));
  secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify({ response: {}, fetchedAt: 1 }));
  // In-memory: also seed the store so the sign-out side-effect is observable.
  useAppStore.setState({ jwt: 'jwt-token-abc' });
}

beforeEach(() => {
  // Reset MMKV + zustand store before each test so order doesn't matter.
  for (const k of Object.values(KEYS)) {
    secureMmkv.remove(k);
  }
  useAppStore.setState({
    jwt: null,
    consent: null,
    permsGranted: null,
    compatPassed: null,
    compatLastResult: null,
    tutorialDone: false,
    installationId: null,
    appVersionCache: null,
    softUpgradeAvailable: null,
    forceUpgradeBlocked: false,
  });
});

describe('auth.signOut (AUTH-08)', () => {
  it('clears auth.jwt.v1', () => {
    seedFullDeviceState();
    signOut();
    expect(secureMmkv.getString(KEYS.AUTH_JWT)).toBeUndefined();
  });

  it('clears all onboarding.* keys', () => {
    seedFullDeviceState();
    signOut();
    expect(secureMmkv.getString(KEYS.ONBOARDING_CONSENT)).toBeUndefined();
    expect(secureMmkv.getString(KEYS.ONBOARDING_PERMS_GRANTED)).toBeUndefined();
    expect(secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED)).toBeUndefined();
    expect(secureMmkv.getString(KEYS.ONBOARDING_TUTORIAL_DONE)).toBeUndefined();
  });

  it('PRESERVES compat.lastResult.v1 (device-bound — same-device re-login skips compat re-run)', () => {
    seedFullDeviceState();
    signOut();
    expect(secureMmkv.getString(KEYS.COMPAT_LAST_RESULT)).toBeDefined();
  });

  it('PRESERVES installation_id.v1 (anchor for compat.signature)', () => {
    seedFullDeviceState();
    signOut();
    expect(secureMmkv.getString(KEYS.INSTALLATION_ID)).toBe('install-uuid-zzz');
  });

  it('PRESERVES telemetry.ring.v1 + appVersion.cache.v1 (device-scoped)', () => {
    seedFullDeviceState();
    signOut();
    expect(secureMmkv.getString(KEYS.TELEMETRY_RING)).toBeDefined();
    expect(secureMmkv.getString(KEYS.APP_VERSION_CACHE)).toBeDefined();
  });

  it('also resets the in-memory store jwt slice (defense-in-depth)', () => {
    seedFullDeviceState();
    expect(useAppStore.getState().jwt).toBe('jwt-token-abc');
    signOut();
    expect(useAppStore.getState().jwt).toBeNull();
  });
});
