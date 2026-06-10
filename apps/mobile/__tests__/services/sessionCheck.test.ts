// Phase 2 item 2 (2026-06-10, Bug 3) — preRecordSessionCheck. A definitive
// 401 blocks (and routes through the eviction UX); ANY other failure proceeds
// (offline capture stays legal — the upload queue holds).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/api', () => ({
  apiClient: { get: vi.fn() },
  applyDeviceEviction: vi.fn(),
}));

import { preRecordSessionCheck } from '../../src/services/sessionCheck';
import { apiClient, applyDeviceEviction } from '../../src/services/api';

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(applyDeviceEviction).mockClear();
});

describe('preRecordSessionCheck', () => {
  it('healthy session → true, no eviction', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ id: 'u1' });
    await expect(preRecordSessionCheck()).resolves.toBe(true);
    expect(applyDeviceEviction).not.toHaveBeenCalled();
  });

  it('definitive 401 → false + the re-sign-in UX fires', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      new Error('GET /me failed: 401 {"type":"https://humyn-app.io/problems/device-evicted"}'),
    );
    await expect(preRecordSessionCheck()).resolves.toBe(false);
    expect(applyDeviceEviction).toHaveBeenCalledWith('reauth');
  });

  it('network error → true (offline capture stays legal), no eviction', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network request failed'));
    await expect(preRecordSessionCheck()).resolves.toBe(true);
    expect(applyDeviceEviction).not.toHaveBeenCalled();
  });

  it('server 5xx → true (indeterminate — never blocks recording)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('GET /me failed: 503 upstream'));
    await expect(preRecordSessionCheck()).resolves.toBe(true);
    expect(applyDeviceEviction).not.toHaveBeenCalled();
  });
});
