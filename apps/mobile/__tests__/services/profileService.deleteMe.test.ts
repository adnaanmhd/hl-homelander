// profileService.deleteMe — verifies the AUTH-09 / AUTH-10 wire contract:
//   - DELETE /me with `query: { confirm: 'DELETE' }` (Phase 1 plan 01-08
//     enforces this query param via MeDeleteQuerySchema; client gate is
//     UX-only defense-in-depth).
//   - Idempotency-Key header forwarded (Phase 1 API-15 — backend de-duplicates
//     retries by this header, and applies its own per-applicationId
//     5-call/min rate-limit on top).
//
// Mocks react-native-uuid with a fixed v4 so the assertion is deterministic.
// Mirrors the profileService.test.ts and feedbackService.test.ts patterns.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native-uuid', () => ({
  default: { v4: () => 'fixed-uuid-del' },
}));

const deleteMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import { deleteMe } from '../../src/services/profileService';

beforeEach(() => {
  deleteMock.mockReset();
  deleteMock.mockResolvedValue(undefined);
});

describe('profileService.deleteMe', () => {
  it('calls DELETE /me with confirm=DELETE query param', async () => {
    await deleteMe();
    expect(deleteMock).toHaveBeenCalledTimes(1);
    const [path, opts] = deleteMock.mock.calls[0]!;
    expect(path).toBe('/me');
    expect(opts.query).toEqual({ confirm: 'DELETE' });
  });

  it('forwards an Idempotency-Key header (Phase 1 API-15)', async () => {
    await deleteMe();
    const [, opts] = deleteMock.mock.calls[0]!;
    expect(opts.headers).toEqual({ 'Idempotency-Key': 'fixed-uuid-del' });
  });

  it('returns void on success', async () => {
    await expect(deleteMe()).resolves.toBeUndefined();
  });

  it('propagates apiClient.delete rejection', async () => {
    deleteMock.mockReset();
    deleteMock.mockRejectedValue(new Error('DELETE /me failed: 429 rate-limited'));
    await expect(deleteMe()).rejects.toThrow(/rate-limited/);
  });
});
