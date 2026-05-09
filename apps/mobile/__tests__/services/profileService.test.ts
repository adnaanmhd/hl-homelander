// profileService — verifies the wire contract: GET /me, PATCH /me with a
// fresh Idempotency-Key, GET /contributions with the durationMs → totalSeconds
// conversion, and PATCH-with-null fields (PROF-01 nullable age/gender).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the UUID generator with a fixed value so the Idempotency-Key
// assertion is deterministic. react-native-uuid's default export is an
// object with a v4() method.
vi.mock('react-native-uuid', () => ({
  default: { v4: () => 'fixed-uuid-01' },
}));

const getMock = vi.fn();
const patchMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

import { fetchMe, patchMe, fetchLifetimeContribution } from '../../src/services/profileService';

beforeEach(() => {
  getMock.mockReset();
  patchMock.mockReset();
});

describe('profileService', () => {
  it('fetchMe calls GET /me and returns the body', async () => {
    getMock.mockResolvedValue({
      id: '1',
      email: 'a@b.c',
      name: 'A',
      age: null,
      gender: null,
      avatarUrl: null,
      consentVersion: 'v1',
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      deletedAt: null,
      deleteGraceUntil: null,
      createdAt: '2026-05-01T00:00:00Z',
    });
    const me = await fetchMe();
    expect(getMock).toHaveBeenCalledWith('/me');
    expect(me.name).toBe('A');
  });

  it('patchMe calls PATCH /me with an Idempotency-Key header', async () => {
    patchMock.mockResolvedValue({ name: 'New' });
    await patchMe({ name: 'New' });
    expect(patchMock).toHaveBeenCalledWith(
      '/me',
      { name: 'New' },
      { headers: { 'Idempotency-Key': 'fixed-uuid-01' } },
    );
  });

  it('patchMe accepts null for age + gender (PROF-01 nullable fields)', async () => {
    patchMock.mockResolvedValue({});
    await patchMe({ age: null, gender: null });
    expect(patchMock).toHaveBeenCalledWith('/me', { age: null, gender: null }, expect.any(Object));
  });

  it('fetchLifetimeContribution calls GET /contributions and converts durationMs to totalSeconds', async () => {
    // Server returns ms (7440000 ms = 7440 s = 2h 4m 0s).
    getMock.mockResolvedValue({
      durationMs: 7_440_000,
      recordingCount: 25,
      taskCount: 12,
      perTask: [],
    });
    const r = await fetchLifetimeContribution();
    expect(getMock).toHaveBeenCalledWith('/contributions', { query: { range: 'all' } });
    expect(r.totalSeconds).toBe(7440);
    expect(r.taskCount).toBe(12);
  });

  it('fetchLifetimeContribution defends against missing fields (returns 0/0)', async () => {
    // Defensive: partial server response → 0 totalSeconds / 0 taskCount.
    getMock.mockResolvedValue({});
    const r = await fetchLifetimeContribution();
    expect(r.totalSeconds).toBe(0);
    expect(r.taskCount).toBe(0);
  });
});
