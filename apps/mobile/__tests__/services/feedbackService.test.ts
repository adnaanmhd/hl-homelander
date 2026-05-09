// feedbackService — verifies the wire contract for HELP-05 / D-HELP-02:
//   - buildDiagnosticSnapshot assembles the expected shape from the AppFlavor
//     native module + telemetry ring.
//   - submitFeedback POSTs multipart to /feedback with a fresh Idempotency-Key.
//   - Pre-flight validation rejects unknown categories and out-of-range
//     message lengths before hitting the network.
//   - FEEDBACK_CATEGORIES matches the Phase 1 enum exactly (8 values, same
//     order as shared/types/src/feedback.ts).
//
// react-native-uuid is mocked with a fixed v4 so the Idempotency-Key
// assertion is deterministic. The mobile dep tree ships uuid (NOT ulid);
// see feedbackService.ts top-of-file comment for the rationale (matches
// profileService 02-17 deviation).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native-uuid', () => ({
  default: { v4: () => 'fixed-uuid-fb' },
}));

// Override the canonical vitest.setup.ts react-native mock to inject the
// AppFlavor native-module fixture that buildDiagnosticSnapshot reads. We
// can't `vi.importActual('react-native')` here — the real module ships
// Flow syntax that Vite/Rollup can't parse — so we re-stub the surface
// feedbackService.ts touches (Platform + NativeModules.AppFlavor only).
vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 35 },
  NativeModules: {
    AppFlavor: {
      versionName: '0.1.0',
      versionCode: 1,
      flavor: 'apkRollout',
      deviceModel: 'Pixel 7a',
    },
  },
}));

const postMultipartMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    postMultipart: (...a: unknown[]) => postMultipartMock(...a),
  },
}));

vi.mock('../../src/services/telemetryRing', () => ({
  telemetryRing: {
    snapshot: () => [{ name: 'signup_success', ts: 1, props: { flavor: 'apkRollout' } }],
  },
}));

import {
  submitFeedback,
  buildDiagnosticSnapshot,
  FEEDBACK_CATEGORIES,
} from '../../src/services/feedbackService';

beforeEach(() => {
  postMultipartMock.mockReset();
  postMultipartMock.mockResolvedValue(undefined);
});

describe('feedbackService', () => {
  it('buildDiagnosticSnapshot assembles the expected D-HELP-02 shape', () => {
    const snap = buildDiagnosticSnapshot();
    expect(snap.appVersion).toBe('0.1.0');
    expect(snap.buildIdentifier).toBe('0.1.0-apkRollout (1)');
    expect(snap.osVersion).toBe('android 35');
    expect(snap.deviceModel).toBe('Pixel 7a');
    expect(snap.telemetryRing[0]?.name).toBe('signup_success');
  });

  it('submitFeedback POSTs multipart with category + message + diagnostic + idempotency-key', async () => {
    await submitFeedback({ category: 'upload-stuck', message: 'My upload is stuck' });
    expect(postMultipartMock).toHaveBeenCalledTimes(1);
    const [path, form, opts] = postMultipartMock.mock.calls[0]!;
    expect(path).toBe('/feedback');
    expect(form).toBeInstanceOf(FormData);
    // FormData.get returns a string for plain fields and a Blob/File for the
    // diagnostic part — assert both reach the wire boundary.
    expect((form as FormData).get('category')).toBe('upload-stuck');
    expect((form as FormData).get('message')).toBe('My upload is stuck');
    expect((form as FormData).get('diagnostic')).not.toBeNull();
    expect(opts.headers['Idempotency-Key']).toBe('fixed-uuid-fb');
  });

  it('rejects an unknown category before hitting the network', async () => {
    await expect(submitFeedback({ category: 'invalid' as never, message: 'x' })).rejects.toThrow(
      /feedback_invalid_category/,
    );
    expect(postMultipartMock).not.toHaveBeenCalled();
  });

  it('rejects empty message before hitting the network', async () => {
    await expect(submitFeedback({ category: 'other', message: '' })).rejects.toThrow(
      /length_out_of_range/,
    );
    expect(postMultipartMock).not.toHaveBeenCalled();
  });

  it('rejects message > 4000 chars before hitting the network', async () => {
    await expect(submitFeedback({ category: 'other', message: 'a'.repeat(4001) })).rejects.toThrow(
      /length_out_of_range/,
    );
    expect(postMultipartMock).not.toHaveBeenCalled();
  });

  it('FEEDBACK_CATEGORIES matches Phase 1 enum exactly (8 values, same order)', () => {
    expect(FEEDBACK_CATEGORIES).toEqual([
      'app-crashed',
      'task-doesnt-start',
      'upload-stuck',
      'login-issue',
      'video-quality-issue',
      'imu-issue',
      'thermal-issue',
      'other',
    ]);
  });
});
