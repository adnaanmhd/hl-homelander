// auth.signInWithGoogle — Bug 4 / D2 verifies the client sends the stable
// per-install id on /auth/google so the server can bind the account to this
// device (newest-login-wins) and mint a JWT carrying it.
//
// Pattern mirrors auth.signOut.test.ts: every RN-adjacent transitive import of
// auth.ts is stubbed at the module boundary so importing auth.ts never touches
// a native bridge. The installationId service is stubbed to a fixed value; the
// assertion is that it lands in the /auth/google POST body.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({ type: 'success', data: { idToken: 'g-id-token' } }),
  },
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
vi.mock('../../src/services/installationId', () => ({
  getInstallationId: vi.fn().mockResolvedValue('inst-uuid-xyz'),
}));
vi.mock('../../src/services/api', () => ({
  apiClient: { post: vi.fn(), postNoBody: vi.fn() },
}));

import { signInWithGoogle } from '../../src/services/auth';
import { apiClient } from '../../src/services/api';

// A JWT whose payload decodes to the build-time (flavor, applicationId) — the
// post-flight assertion in signInWithGoogle requires the match.
function fakeJwt(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${b64}.sig`;
}

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.postNoBody as ReturnType<typeof vi.fn>).mockResolvedValue({
    nonceId: 'nonce-id',
    nonce: 'nonce-value',
  });
  (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
    jwt: fakeJwt({ sub: 'u1', flavor: 'apkRollout', applicationId: 'ai.humynlabs.capture.apk' }),
    user: { id: 'u1', email: 'a@b.com', name: 'A', avatarUrl: null },
  });
});

describe('auth.signInWithGoogle (Bug 4 / D2)', () => {
  it('sends installationId in the /auth/google body', async () => {
    await signInWithGoogle();
    const postMock = apiClient.post as ReturnType<typeof vi.fn>;
    const [path, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/auth/google');
    expect(body.installationId).toBe('inst-uuid-xyz');
    // The rest of the contract is unchanged.
    expect(body.flavor).toBe('apkRollout');
    expect(body.applicationId).toBe('ai.humynlabs.capture.apk');
    expect(body.nonceId).toBe('nonce-id');
  });
});
