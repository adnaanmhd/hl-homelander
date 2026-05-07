// Boot-guard tests — the consent-text drift detection that runs at the start
// of `buildApp()`. The happy path proves that on-disk text + committed hash
// match (paired with consent-text-hash.test.ts). The drift path mocks
// CONSENT_TEXT_SHA256 to a known-wrong value and asserts the guard throws.

import { describe, it, expect, vi } from 'vitest';
import { verifyConsentTextHash, ConsentTextDriftError } from '../../src/legal/boot-guard.js';

describe('boot-guard verifyConsentTextHash', () => {
  it('does not throw when hash matches (real text + real hash)', () => {
    expect(() => verifyConsentTextHash()).not.toThrow();
  });

  it('throws ConsentTextDriftError when the hash module is mocked to a wrong value', async () => {
    vi.resetModules();
    vi.doMock('../../src/legal/consent-text-hash.js', () => ({
      CONSENT_TEXT_SHA256: 'a'.repeat(64),
    }));
    const { verifyConsentTextHash: mockedVerify, ConsentTextDriftError: ErrCls } = await import(
      '../../src/legal/boot-guard.js'
    );
    expect(() => mockedVerify()).toThrow(ErrCls);
    vi.doUnmock('../../src/legal/consent-text-hash.js');
  });

  it('error message names both the on-disk and committed SHA-256 values', () => {
    const err = new ConsentTextDriftError('aa', 'bb');
    expect(err.message).toContain('aa');
    expect(err.message).toContain('bb');
    expect(err.name).toBe('ConsentTextDriftError');
  });
});
