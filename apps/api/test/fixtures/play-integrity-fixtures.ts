import type { TokenPayloadExternal } from '../../src/auth/integrity-policy.js';

export function basePayload(overrides: Partial<TokenPayloadExternal> = {}): TokenPayloadExternal {
  return {
    requestDetails: {
      requestPackageName: 'ai.humynlabs.capture',
      timestampMillis: String(Date.now()),
      nonce: 'expected-nonce',
    },
    appIntegrity: {
      appRecognitionVerdict: 'PLAY_RECOGNIZED',
      packageName: 'ai.humynlabs.capture',
      certificateSha256Digest: ['deadbeef'],
      versionCode: '1',
    },
    deviceIntegrity: {
      deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],
    },
    accountDetails: { appLicensingVerdict: 'LICENSED' },
    ...overrides,
  };
}

export const FIXTURES = {
  happyPlayStore: () => basePayload(),
  rooted: () => basePayload({ deviceIntegrity: { deviceRecognitionVerdict: [] } }),
  emulator: () =>
    basePayload({
      deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_VIRTUAL_INTEGRITY'] },
    }),
  unrecognizedVersion: () =>
    basePayload({
      appIntegrity: {
        ...basePayload().appIntegrity,
        appRecognitionVerdict: 'UNRECOGNIZED_VERSION',
      },
    }),
  staleToken: () =>
    basePayload({
      requestDetails: {
        ...basePayload().requestDetails,
        timestampMillis: String(Date.now() - 11 * 60 * 1000),
      },
    }),
  packageMismatch: () =>
    basePayload({
      requestDetails: {
        ...basePayload().requestDetails,
        requestPackageName: 'com.evil.clone',
      },
    }),
  nonceMismatch: () =>
    basePayload({
      requestDetails: {
        ...basePayload().requestDetails,
        nonce: 'attacker-supplied',
      },
    }),
};
