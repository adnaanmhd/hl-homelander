import { describe, it, expect, afterEach } from 'vitest';
import { shouldBypassInstallSource } from '../../src/auth/install-source-bypass.js';

const ORIG_RC = process.env.REMOTE_CONFIG_JSON;
afterEach(() => {
  if (ORIG_RC === undefined) delete process.env.REMOTE_CONFIG_JSON;
  else process.env.REMOTE_CONFIG_JSON = ORIG_RC;
});

describe('install-source-bypass — double-gate', () => {
  it('apkRollout + correct applicationId + Remote Config true → bypass', async () => {
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture.apk': true,
    });
    const ok = await shouldBypassInstallSource({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
    });
    expect(ok).toBe(true);
  });
  it('apkRollout + correct applicationId but Remote Config false → no bypass', async () => {
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture.apk': false,
    });
    const ok = await shouldBypassInstallSource({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
    });
    expect(ok).toBe(false);
  });
  it('playStore cannot bypass even with Remote Config true (static allowlist hard-codes false)', async () => {
    // Even if an attacker crafts the impossible RC key for playStore applicationId
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture': true,
    });
    const ok = await shouldBypassInstallSource({
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    });
    expect(ok).toBe(false);
  });
  it('apkRollout flavor with wrong applicationId → no bypass (allowlist gate)', async () => {
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture': true,
    });
    const ok = await shouldBypassInstallSource({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture',
    });
    expect(ok).toBe(false);
  });
  it('iosAppStore cannot bypass', async () => {
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture': true,
    });
    const ok = await shouldBypassInstallSource({
      flavor: 'iosAppStore',
      applicationId: 'ai.humynlabs.capture',
    });
    expect(ok).toBe(false);
  });
});
