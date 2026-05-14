// contributionsApi — contract verification for fetchLifetime +
// fetchContributionsAggregate. Asserts the right path, the
// `aggregate: 'true'` query flag (D-03a), and the Accept-Timezone header
// pass-through (D-03b).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getJsonMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    getJson: (...args: unknown[]) => getJsonMock(...args),
  },
}));

import { fetchLifetime, fetchContributionsAggregate } from '../../src/services/contributionsApi';

beforeEach(() => {
  getJsonMock.mockReset();
});

describe('contributionsApi', () => {
  it('fetchLifetime calls GET /contributions with no query or headers', async () => {
    getJsonMock.mockResolvedValue({
      durationMs: 7_440_000,
      recordingCount: 25,
      taskCount: 12,
      perTask: [],
    });
    const result = await fetchLifetime();
    expect(getJsonMock).toHaveBeenCalledWith('/contributions');
    expect(result.recordingCount).toBe(25);
  });

  it('fetchContributionsAggregate sends aggregate=true + start+end + Accept-Timezone', async () => {
    getJsonMock.mockResolvedValue({ buckets: [] });
    await fetchContributionsAggregate({
      start: '2026-05-14',
      end: '2026-05-15',
      tz: 'Asia/Kolkata',
    });
    expect(getJsonMock).toHaveBeenCalledWith('/contributions/timeseries', {
      query: {
        aggregate: 'true',
        start: '2026-05-14',
        end: '2026-05-15',
      },
      headers: { 'Accept-Timezone': 'Asia/Kolkata' },
    });
  });

  it('fetchContributionsAggregate works with `range` + no explicit start/end and no tz', async () => {
    getJsonMock.mockResolvedValue({ buckets: [] });
    await fetchContributionsAggregate({ range: '7d' });
    expect(getJsonMock).toHaveBeenCalledWith('/contributions/timeseries', {
      query: { aggregate: 'true', range: '7d' },
      headers: {},
    });
  });

  it('fetchContributionsAggregate with no args still sends aggregate=true', async () => {
    getJsonMock.mockResolvedValue({ buckets: [] });
    await fetchContributionsAggregate();
    expect(getJsonMock).toHaveBeenCalledWith('/contributions/timeseries', {
      query: { aggregate: 'true' },
      headers: {},
    });
  });
});
