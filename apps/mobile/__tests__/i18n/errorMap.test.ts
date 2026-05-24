// errorMap unit tests — I18N-08 / D-34.
//
// Verifies the API-code → i18n-key mapping and the generic-fallback helper.
//
// Cross-validation against `apps/mobile/src/i18n/locales/en.json` is done
// against an INLINE SNAPSHOT of the en.json shape that plan 07-01 ships
// in the same Wave 1. Both plans run in parallel worktrees so the locale
// file is not present in this worktree at execution time. The integration
// test that does the runtime cross-validation against the real, populated
// en.json lives in plan 07-05 (full screen-string sweep), and plan 07-02's
// shape-parity validator will fail if 07-01's en.json drifts from the
// keys this module references.
//
// Deviation logged in SUMMARY.md under Rule-3 (blocking — parallel-wave
// file dependency).
//
// Test location follows the project convention `apps/mobile/__tests__/...`
// (vitest.config.ts `include` glob). The plan originally specified
// `apps/mobile/src/i18n/__tests__/errorMap.test.ts`; that path is not in
// the include glob. Deviation logged in SUMMARY.md under Rule-3.

import { describe, it, expect } from 'vitest';
import { ERROR_TOAST_KEYS, GENERIC_ERROR_KEY, toastKeyForCode } from '../../src/i18n/errorMap';

// Snapshot of the en.json structure plan 07-01 ships (07-01 PLAN.md
// lines 280-329). Used to validate every ERROR_TOAST_KEYS value resolves
// to a string in the catalog the runtime will load.
const EN_SKELETON = {
  common: { continue: 'Continue', cancel: 'Cancel', save: 'Save', close: 'Close' },
  onboarding: {
    chooseLanguage: { title: 'Choose your language', continueButton: 'Continue' },
  },
  profile: {
    language: { row: { label: 'Language' }, picker: { title: 'Select language' } },
  },
  recording: { preview: { live: 'Live preview' } },
  terms: {
    consent: { modalTitle: 'Terms of Use', body: 'I consent and agree to upload videos.' },
  },
  errors: {
    generic: 'Something went wrong',
    auth: {
      invalidToken: 'Please sign in again',
      expiredToken: 'Your session expired — please sign in again',
      googleFailed: 'Google sign-in failed',
    },
    upload: {
      quotaExceeded: 'Upload quota reached for today',
      networkLost: 'Network lost — retry when back online',
    },
    recording: { tooShort: 'Recording was too short' },
    compat: { failed: 'Your device is not compatible' },
  },
};

function readPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined,
      obj,
    );
}

describe('errorMap (I18N-08 / D-34)', () => {
  it('GENERIC_ERROR_KEY is "errors.generic" and exists in the en.json skeleton', () => {
    expect(GENERIC_ERROR_KEY).toBe('errors.generic');
    expect(readPath(EN_SKELETON, GENERIC_ERROR_KEY)).toBeTypeOf('string');
  });

  it('every mapped key resolves in the en.json skeleton (no dangling references)', () => {
    for (const [code, key] of Object.entries(ERROR_TOAST_KEYS)) {
      const v = readPath(EN_SKELETON, key);
      expect(v, `code=${code} key=${key} not in en.json skeleton`).toBeTypeOf('string');
    }
  });

  it('toastKeyForCode returns the mapped key for known codes', () => {
    expect(toastKeyForCode('AUTH_INVALID_TOKEN')).toBe('errors.auth.invalidToken');
    expect(toastKeyForCode('UPLOAD_NETWORK_LOST')).toBe('errors.upload.networkLost');
  });

  it('toastKeyForCode returns the generic key for unknown / falsy codes', () => {
    expect(toastKeyForCode('NEVER_HEARD_OF_THIS')).toBe(GENERIC_ERROR_KEY);
    expect(toastKeyForCode(null)).toBe(GENERIC_ERROR_KEY);
    expect(toastKeyForCode(undefined)).toBe(GENERIC_ERROR_KEY);
    expect(toastKeyForCode('')).toBe(GENERIC_ERROR_KEY);
  });
});
