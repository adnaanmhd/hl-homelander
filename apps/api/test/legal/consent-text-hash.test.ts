// Hash-invariant test for the canonical consent text.
//
// CONSENT_TEXT lives in apps/api/src/legal/consent-text.ts (verbatim from
// idea-brief.md §5.2). CONSENT_TEXT_SHA256 lives in consent-text-hash.ts and
// is regenerated deterministically by `pnpm --filter @humyn/api run legal:hash`.
//
// This test asserts the two stay in lock-step. If a future PR mutates
// consent-text.ts but forgets to re-run legal:hash, this test fails — and the
// boot-guard (boot-guard.test.ts) likewise refuses to start the API.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { CONSENT_TEXT } from '../../src/legal/consent-text.js';
import { CONSENT_TEXT_SHA256 } from '../../src/legal/consent-text-hash.js';

describe('consent-text hash invariant', () => {
  it('CONSENT_TEXT_SHA256 matches the actual SHA-256 of CONSENT_TEXT', () => {
    const actual = createHash('sha256').update(CONSENT_TEXT).digest('hex');
    expect(actual).toBe(CONSENT_TEXT_SHA256);
  });

  it('CONSENT_TEXT starts with "By signing in" (canonical anchor from idea-brief.md §5.2)', () => {
    expect(CONSENT_TEXT).toMatch(/^By signing in/);
  });

  it('CONSENT_TEXT_SHA256 is a 64-char lowercase hex string and not the zero hash', () => {
    expect(CONSENT_TEXT_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(CONSENT_TEXT_SHA256).not.toBe(
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('CONSENT_TEXT references DPDP and LGPD regulatory frameworks', () => {
    expect(CONSENT_TEXT).toMatch(/DPDP/);
    expect(CONSENT_TEXT).toMatch(/LGPD/);
  });
});
