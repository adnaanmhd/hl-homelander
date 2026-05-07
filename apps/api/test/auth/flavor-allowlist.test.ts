import { describe, it, expect } from 'vitest';
import { isFlavorAllowed } from '../../src/auth/flavor-allowlist.js';

describe('flavor-allowlist', () => {
  it('accepts known pairs', () => {
    expect(isFlavorAllowed('apkRollout', 'ai.humynlabs.capture.apk')).toBe(true);
    expect(isFlavorAllowed('playStore', 'ai.humynlabs.capture')).toBe(true);
    expect(isFlavorAllowed('iosAppStore', 'ai.humynlabs.capture')).toBe(true);
  });
  it('rejects mismatched pairs', () => {
    expect(isFlavorAllowed('playStore', 'ai.humynlabs.capture.apk')).toBe(false);
    expect(isFlavorAllowed('apkRollout', 'ai.humynlabs.capture')).toBe(false);
    expect(isFlavorAllowed('iosAppStore', 'ai.humynlabs.capture.apk')).toBe(false);
  });
  it('rejects unknown flavor entirely', () => {
    expect(isFlavorAllowed('compatRecon', 'ai.humynlabs.capture.apk')).toBe(false);
    expect(isFlavorAllowed('admin', 'ai.humynlabs.capture')).toBe(false);
  });
});
