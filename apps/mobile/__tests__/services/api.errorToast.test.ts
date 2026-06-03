// surfaceApiError — Plan 07-05 Task 2 (I18N-08 / D-34 / D-35).
//
// Behaviour matrix:
//   1. Maps a known code (errorMap.ts) to the translated toast key.
//   2. Falls through to the generic 'errors.generic' key for unknown codes.
//   3. Handles a missing `code` field gracefully (treated as unknown).
//   4. Writes a Crashlytics breadcrumb with `{ event, code, raw_detail }`.
//   5. Crashlytics failures NEVER propagate up to the caller.
//
// Tests run under JSDOM with the vitest.setup.ts react-native shim. We
// hoist mocks for `../../components/Toast` and `@react-native-firebase/
// crashlytics` so `surfaceApiError`'s `showToast` / `crashlytics().log`
// calls are observable as vi.fn() spies. The i18n singleton from
// `src/i18n` resolves keys against the bundled en.json (i18next is loaded
// synchronously in vitest.setup.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted lifts these spies so they're defined BEFORE the hoisted
// vi.mock() factories execute (vitest hoists mocks to the top of the
// module — a bare `const` would still be in the TDZ when the factory ran).
const { showToast, crashLog } = vi.hoisted(() => ({
  showToast: vi.fn(),
  crashLog: vi.fn(),
}));

vi.mock('../../src/components/Toast', () => ({
  showToast,
}));
vi.mock('@react-native-firebase/crashlytics', () => ({
  default: () => ({ log: crashLog }),
}));

// React-native-config (read by services/api.ts at module load for BASE_URL).
// We only need the module to import — no runtime call is exercised here.
vi.mock('react-native-config', () => ({
  default: { API_BASE_URL: 'http://localhost:8080' },
}));

import i18n from '../../src/i18n';
import { surfaceApiError } from '../../src/services/api';

describe('surfaceApiError (I18N-08 / D-34 / D-35)', () => {
  beforeEach(async () => {
    showToast.mockClear();
    crashLog.mockClear();
    await i18n.changeLanguage('en');
  });

  it('maps a known code to the translated toast key', () => {
    surfaceApiError({ code: 'AUTH_INVALID_TOKEN', detail: 'jwt expired' });
    expect(showToast).toHaveBeenCalledTimes(1);
    // en.json says "Please sign in again" for errors.auth.invalidToken
    expect(showToast.mock.calls[0]?.[0]).toBe('Please sign in again');
  });

  it('falls through to the generic toast for unknown code', () => {
    surfaceApiError({ code: 'NEVER_HEARD', detail: 'mystery' });
    expect(showToast).toHaveBeenCalledWith('Something went wrong');
  });

  it('handles missing code field gracefully', () => {
    surfaceApiError({ detail: 'no code at all' });
    expect(showToast).toHaveBeenCalledWith('Something went wrong');
  });

  it('writes a Crashlytics breadcrumb with code + raw_detail (D-35)', () => {
    surfaceApiError({ code: 'UPLOAD_NETWORK_LOST', detail: 'tcp reset' });
    expect(crashLog).toHaveBeenCalledTimes(1);
    const arg = JSON.parse(crashLog.mock.calls[0]?.[0] as string);
    expect(arg.event).toBe('api_error');
    expect(arg.code).toBe('UPLOAD_NETWORK_LOST');
    expect(arg.raw_detail).toBe('tcp reset');
  });

  it('records UNKNOWN in the breadcrumb when code is null or undefined', () => {
    surfaceApiError({ detail: 'no code' });
    const arg = JSON.parse(crashLog.mock.calls[0]?.[0] as string);
    expect(arg.code).toBe('UNKNOWN');
    expect(arg.raw_detail).toBe('no code');
  });

  it('Crashlytics failures do not propagate', () => {
    crashLog.mockImplementationOnce(() => {
      throw new Error('flaky');
    });
    expect(() => surfaceApiError({ code: 'COMPAT_FAILED', detail: 'oops' })).not.toThrow();
    // The toast still fired before the breadcrumb threw.
    expect(showToast).toHaveBeenCalledWith('Your device is not compatible');
  });
});
