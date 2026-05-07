import { describe, it, expect, afterEach } from 'vitest';
import { evaluateIntegrity } from '../../src/auth/integrity-policy.js';
import { FIXTURES } from '../fixtures/play-integrity-fixtures.js';

const ORIG_RC = process.env.REMOTE_CONFIG_JSON;
afterEach(() => {
  if (ORIG_RC === undefined) delete process.env.REMOTE_CONFIG_JSON;
  else process.env.REMOTE_CONFIG_JSON = ORIG_RC;
});

describe('evaluateIntegrity', () => {
  const expectedNonce = 'expected-nonce';
  const flavor = 'playStore' as const;
  const applicationId = 'ai.humynlabs.capture';

  it('happy path: PLAY_RECOGNIZED + DEVICE_INTEGRITY → pass', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.happyPlayStore(),
      expectedNonce,
    });
    expect(r).toEqual({ pass: true, verdict: 'passed' });
  });
  it('rooted device → integrity-rooted', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.rooted(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('integrity-rooted');
  });
  it('emulator → integrity-emulator', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.emulator(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('integrity-emulator');
  });
  it('stale token (>10 min) → integrity-stale', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.staleToken(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('integrity-stale');
  });
  it('nonce mismatch → integrity-nonce', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.nonceMismatch(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('integrity-nonce');
  });
  it('unrecognized version on playStore (no bypass) → integrity-install-source', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.unrecognizedVersion(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('integrity-install-source');
  });
  it('unrecognized version on apkRollout WITHOUT Remote Config → integrity-install-source', async () => {
    delete process.env.REMOTE_CONFIG_JSON;
    const payload = FIXTURES.unrecognizedVersion();
    payload.requestDetails.requestPackageName = 'ai.humynlabs.capture.apk';
    payload.appIntegrity.packageName = 'ai.humynlabs.capture.apk';
    const r = await evaluateIntegrity({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      payload,
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('integrity-install-source');
  });
  it('unrecognized version on apkRollout WITH Remote Config bypass → bypassed_apk', async () => {
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture.apk': true,
    });
    const payload = FIXTURES.unrecognizedVersion();
    payload.requestDetails.requestPackageName = 'ai.humynlabs.capture.apk';
    payload.appIntegrity.packageName = 'ai.humynlabs.capture.apk';
    const r = await evaluateIntegrity({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      payload,
      expectedNonce,
    });
    expect(r).toEqual({ pass: true, verdict: 'bypassed_apk' });
  });
  it('package_name mismatch → reject', async () => {
    const r = await evaluateIntegrity({
      flavor,
      applicationId,
      payload: FIXTURES.packageMismatch(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('package_name_mismatch');
  });
  it('flavor + applicationId mismatch → flavor_app_id_mismatch', async () => {
    const r = await evaluateIntegrity({
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture.apk',
      payload: FIXTURES.happyPlayStore(),
      expectedNonce,
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('flavor_app_id_mismatch');
  });
});
