// Test fixtures for mocking Play Integrity verdicts in the e2e suite.
//
// The fixtures mirror plan-05's apps/api/test/fixtures/play-integrity-fixtures.ts
// shape (TokenPayloadExternal from apps/api/src/auth/integrity-policy.ts).
// Each function returns a payload that, when fed through evaluateIntegrity(),
// triggers the corresponding reject reason.
//
// USAGE PATTERN:
//   1. Call setupAuthMocks() at module top (BEFORE any `import` from src/app.ts).
//      This declares vi.mock() for both verifyGoogleIdToken and decodeIntegrityToken.
//   2. Per-test, override decodeIntegrityToken's return value via
//      `(decodeIntegrityToken as any).mockResolvedValueOnce(<payload>)`.
//   3. The nonce inside the payload MUST match the nonce the route consumed
//      (`/auth/nonce` returns it). Pass the test's freshly-minted nonce into
//      the fixture builder so requestDetails.nonce lines up.
import { vi } from 'vitest';
import type { TokenPayloadExternal } from '../../../src/auth/integrity-policy.js';

const DEFAULT_APPLICATION_ID = 'ai.humynlabs.capture';

export function happyPlayStorePayload(
  nonce: string,
  applicationId = DEFAULT_APPLICATION_ID,
): TokenPayloadExternal {
  return {
    requestDetails: {
      requestPackageName: applicationId,
      timestampMillis: String(Date.now()),
      nonce,
    },
    appIntegrity: {
      appRecognitionVerdict: 'PLAY_RECOGNIZED',
      packageName: applicationId,
    },
    deviceIntegrity: {
      deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],
    },
    accountDetails: { appLicensingVerdict: 'LICENSED' },
  };
}

// Rooted device — empty deviceRecognitionVerdict. evaluateIntegrity falls
// through to integrity-rooted (no acceptable verdict).
export function rootedPayload(
  nonce: string,
  applicationId = DEFAULT_APPLICATION_ID,
): TokenPayloadExternal {
  return {
    ...happyPlayStorePayload(nonce, applicationId),
    deviceIntegrity: { deviceRecognitionVerdict: [] },
  };
}

// Emulator — MEETS_VIRTUAL_INTEGRITY is the hard-reject signal per
// integrity-policy.ts step 4.
export function emulatorPayload(
  nonce: string,
  applicationId = DEFAULT_APPLICATION_ID,
): TokenPayloadExternal {
  return {
    ...happyPlayStorePayload(nonce, applicationId),
    deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_VIRTUAL_INTEGRITY'] },
  };
}

// UNRECOGNIZED_VERSION — sideloaded APK that's not from Play Store. Triggers
// the integrity-install-source branch unless the apkRollout bypass is enabled.
export function unrecognizedVersionPayload(
  nonce: string,
  applicationId = DEFAULT_APPLICATION_ID,
): TokenPayloadExternal {
  return {
    ...happyPlayStorePayload(nonce, applicationId),
    appIntegrity: {
      appRecognitionVerdict: 'UNRECOGNIZED_VERSION',
      packageName: applicationId,
    },
  };
}

// Wires the vi.mock() declarations. Every e2e test that builds buildApp()
// MUST call this BEFORE importing buildApp — vi.mock() is hoisted but the
// import order still matters for vitest's static analysis.
//
// Mocks:
//   - verifyGoogleIdToken: always returns a fixed payload (we don't have a
//     real Google account in CI and don't want to call the real OAuth2Client).
//   - decodeIntegrityToken: defaults to a happy verdict; per-test overrides
//     via mockResolvedValueOnce.
export function setupAuthMocks(): void {
  vi.mock('../../../src/auth/verify-id-token.js', () => ({
    verifyGoogleIdToken: vi.fn(async (_idToken: string) => ({
      sub: '999999',
      email: 'e2e@test.com',
      email_verified: true,
      name: 'E2E',
      picture: null,
    })),
  }));
  vi.mock('../../../src/auth/verify-play-integrity.js', () => ({
    decodeIntegrityToken: vi.fn(async () => happyPlayStorePayload('default-nonce')),
  }));
}
