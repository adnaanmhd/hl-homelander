// E2E consent-drift test — verifies plan-11's boot-time hash guard refuses to
// start the API when CONSENT_TEXT_SHA256 doesn't match the on-disk SHA-256 of
// CONSENT_TEXT (counsel-trust invariant).
//
// Strategy: vi.doMock() rewrites the consent-text-hash module to return an
// intentionally wrong value; buildApp() (which calls verifyConsentTextHash()
// FIRST per app.ts) should throw ConsentTextDriftError. We then doUnmock and
// resetModules so subsequent test files see the real value again.

import { describe, it, expect, vi } from 'vitest';

describe('Consent text drift — boot guard', () => {
  it('buildApp throws ConsentTextDriftError when consent-text-hash is mocked to a wrong value', async () => {
    vi.resetModules();
    vi.doMock('../../src/legal/consent-text-hash.js', () => ({
      CONSENT_TEXT_SHA256: 'a'.repeat(64), // intentionally wrong
    }));
    const { buildApp } = await import('../../src/app.js');
    const { ConsentTextDriftError } = await import('../../src/legal/boot-guard.js');
    await expect(buildApp()).rejects.toThrow(ConsentTextDriftError);
    vi.doUnmock('../../src/legal/consent-text-hash.js');
    vi.resetModules();
  });
});
