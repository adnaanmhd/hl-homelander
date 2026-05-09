/**
 * Plan 02-07 Task 2 — JS bridge unit test for HumynUpdater native module.
 *
 * The HumynUpdater bridge wraps two Kotlin native methods that ONLY exist on
 * the apkRollout flavor's runtime path:
 *   - downloadAndVerifyApk(url, expectedSha256) → Promise<{path, sha256}>
 *   - launchInstaller(apkPath) → Promise<boolean>
 *
 * Defensive flavor guard (RESEARCH § Pattern 3): if `getFlavorContext().flavor`
 * is anything other than 'apkRollout', the bridge MUST refuse the call before
 * touching NativeModules — so a playStore build that accidentally imports the
 * module fails fast at the call site (rather than hitting NativeModules and
 * potentially exposing a registered-but-not-flavor-scoped surface).
 *
 * Behaviors covered:
 *   1. flavor=playStore           → downloadAndVerifyApk rejects with /apkRollout/
 *   2. flavor=apkRollout, no NM   → rejects with "HumynUpdater native module not registered"
 *   3. flavor=apkRollout, mocked  → forwards args verbatim, returns resolved value
 *   4. native rejects INSTALL_NOT_ALLOWED → JS rejects with same error code (passthrough)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynUpdater (flavor guard)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Only unmock the per-test AppFlavor stub. We do NOT unmock 'react-native'
    // here — vitest.setup.ts's `vi.mock('react-native', ...)` is the global
    // shim every test in this file relies on; unmocking it would force vitest
    // to load the real react-native/index.js (which uses Flow `import typeof`
    // syntax that Rollup cannot parse).
    vi.doUnmock('../../src/native/AppFlavor');
  });

  it('downloadAndVerifyApk rejects on playStore flavor (defensive guard)', async () => {
    vi.doMock('../../src/native/AppFlavor', () => ({
      getFlavorContext: () => ({
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        versionName: '1.0.0',
        versionCode: 1,
        deviceModel: 'jsdom',
      }),
    }));
    const { downloadAndVerifyApk } = await import('../../src/native/HumynUpdater');
    await expect(downloadAndVerifyApk('https://example.test/app.apk', 'deadbeef')).rejects.toThrow(
      /apkRollout/,
    );
  });
});

describe('HumynUpdater (apkRollout, native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Same rationale as the previous describe — only the per-test AppFlavor
    // stub is unmocked. The setup file's react-native shim must persist.
    vi.doUnmock('../../src/native/AppFlavor');
  });

  it('downloadAndVerifyApk rejects when native module missing', async () => {
    vi.doMock('../../src/native/AppFlavor', () => ({
      getFlavorContext: () => ({
        flavor: 'apkRollout',
        applicationId: 'ai.humynlabs.capture.apk',
        versionName: '1.0.0',
        versionCode: 1,
        deviceModel: 'jsdom',
      }),
    }));
    const { downloadAndVerifyApk } = await import('../../src/native/HumynUpdater');
    await expect(downloadAndVerifyApk('https://example.test/app.apk', 'deadbeef')).rejects.toThrow(
      /HumynUpdater native module not registered/,
    );
  });
});

describe('HumynUpdater (apkRollout, native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../../src/native/AppFlavor');
    vi.doUnmock('react-native');
  });

  it('downloadAndVerifyApk forwards args and returns resolved value verbatim', async () => {
    const native = {
      downloadAndVerifyApk: vi
        .fn()
        .mockResolvedValue({ path: '/data/cache/update-123.apk', sha256: 'abc123' }),
      launchInstaller: vi.fn(),
    };
    vi.doMock('../../src/native/AppFlavor', () => ({
      getFlavorContext: () => ({
        flavor: 'apkRollout',
        applicationId: 'ai.humynlabs.capture.apk',
        versionName: '1.0.0',
        versionCode: 1,
        deviceModel: 'jsdom',
      }),
    }));
    vi.doMock('react-native', () => ({ NativeModules: { HumynUpdater: native } }));
    const { downloadAndVerifyApk } = await import('../../src/native/HumynUpdater');
    const result = await downloadAndVerifyApk('https://example.test/app.apk', 'abc123');
    expect(native.downloadAndVerifyApk).toHaveBeenCalledTimes(1);
    expect(native.downloadAndVerifyApk).toHaveBeenCalledWith(
      'https://example.test/app.apk',
      'abc123',
    );
    expect(result).toEqual({ path: '/data/cache/update-123.apk', sha256: 'abc123' });
  });

  it('launchInstaller propagates INSTALL_NOT_ALLOWED rejection', async () => {
    const native = {
      downloadAndVerifyApk: vi.fn(),
      launchInstaller: vi.fn().mockRejectedValue(new Error('INSTALL_NOT_ALLOWED: deep-link sent')),
    };
    vi.doMock('../../src/native/AppFlavor', () => ({
      getFlavorContext: () => ({
        flavor: 'apkRollout',
        applicationId: 'ai.humynlabs.capture.apk',
        versionName: '1.0.0',
        versionCode: 1,
        deviceModel: 'jsdom',
      }),
    }));
    vi.doMock('react-native', () => ({ NativeModules: { HumynUpdater: native } }));
    const { launchInstaller } = await import('../../src/native/HumynUpdater');
    await expect(launchInstaller('/data/cache/update-123.apk')).rejects.toThrow(
      /INSTALL_NOT_ALLOWED/,
    );
    expect(native.launchInstaller).toHaveBeenCalledTimes(1);
    expect(native.launchInstaller).toHaveBeenCalledWith('/data/cache/update-123.apk');
  });
});
