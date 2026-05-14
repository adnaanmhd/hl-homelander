// tasksApi — contract verification for fetchTasks / searchTasks /
// useTaskSearch (TASK-03 / TASK-04). Asserts:
//   - fetchTasks proxies GET /tasks with the right query.
//   - searchTasks proxies GET /tasks/search with q + filters + 5s timeout.
//   - useTaskSearch debounces by 200ms + cancels in-flight on rapid input.
//
// Mocks apiClient.getJson so we can assert on the wire-side params
// without round-tripping fetch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Drain microtasks under fake timers. `vi.advanceTimersByTime` fires the
 * setTimeout callback synchronously but the async work inside (the
 * `await searchTasks(...)` chain) only resolves on the microtask queue,
 * which fake timers don't automatically flush. Two awaits cover (1) the
 * apiClient.getJson mock's resolved promise and (2) the setState that
 * follows.
 */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const getJsonMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    getJson: (...args: unknown[]) => getJsonMock(...args),
  },
}));

import { fetchTasks, searchTasks, useTaskSearch } from '../../src/services/tasksApi';

beforeEach(() => {
  getJsonMock.mockReset();
});

describe('tasksApi — fetchTasks', () => {
  it('fetchTasks() with no args calls GET /tasks with an empty query', async () => {
    getJsonMock.mockResolvedValue({ items: [], nextCursor: null });
    await fetchTasks();
    expect(getJsonMock).toHaveBeenCalledWith('/tasks', { query: {} });
  });

  it('fetchTasks() forwards category + setting + cursor + limit', async () => {
    getJsonMock.mockResolvedValue({ items: [], nextCursor: null });
    await fetchTasks({
      category: 'Cooking',
      setting: 'indoor',
      cursor: '01JABCDE7M5XYZ7XHJK7QV0W3M',
      limit: 25,
    });
    expect(getJsonMock).toHaveBeenCalledWith('/tasks', {
      query: {
        category: 'Cooking',
        setting: 'indoor',
        cursor: '01JABCDE7M5XYZ7XHJK7QV0W3M',
        limit: '25', // GetJsonOptions.query is Record<string,string> — stringify
      },
    });
  });
});

describe('tasksApi — searchTasks', () => {
  it('searchTasks(q) calls GET /tasks/search?q= with a 5s timeout', async () => {
    getJsonMock.mockResolvedValue({ items: [] });
    await searchTasks('chop');
    expect(getJsonMock).toHaveBeenCalledWith('/tasks/search', {
      query: { q: 'chop' },
      timeoutMs: 5_000,
    });
  });

  it('searchTasks forwards category + setting + limit alongside q', async () => {
    getJsonMock.mockResolvedValue({ items: [] });
    await searchTasks('mop', { category: 'Cleaning', setting: 'indoor', limit: 5 });
    expect(getJsonMock).toHaveBeenCalledWith('/tasks/search', {
      query: { q: 'mop', category: 'Cleaning', setting: 'indoor', limit: '5' },
      timeoutMs: 5_000,
    });
  });
});

describe('tasksApi — useTaskSearch (200ms debounce)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('empty query → results: null, no network call', () => {
    const { result } = renderHook(({ q }) => useTaskSearch(q), {
      initialProps: { q: '' },
    });
    expect(result.current).toEqual({ results: null, loading: false, error: null });
    expect(getJsonMock).not.toHaveBeenCalled();
  });

  it('non-empty query fires GET /tasks/search after 200ms', async () => {
    getJsonMock.mockResolvedValue({
      items: [{ id: 't1', slug: 'chopping', name: 'Chopping', lex_score: 0.9 }],
    });
    const { result } = renderHook(({ q }) => useTaskSearch(q), {
      initialProps: { q: 'chop' },
    });
    // Loading flag should be set immediately (the effect's first synchronous body).
    expect(result.current.loading).toBe(true);
    // Hasn't fired yet — under the 200ms threshold.
    expect(getJsonMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(199);
    });
    expect(getJsonMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1); // crosses 200ms — fires the timer callback
      await flushMicrotasks();
    });
    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(getJsonMock).toHaveBeenCalledWith('/tasks/search', {
      query: { q: 'chop' },
      timeoutMs: 5_000,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.results).toHaveLength(1);
  });

  it('rapid retyping cancels the prior debounce timer (only the latest query lands)', async () => {
    getJsonMock.mockResolvedValue({ items: [] });
    const { rerender } = renderHook(({ q }) => useTaskSearch(q), {
      initialProps: { q: 'c' },
    });
    // 100ms in — no fire yet.
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({ q: 'ch' });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({ q: 'cho' });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    // Three rerenders — none have fired yet because each rerender resets the timer.
    expect(getJsonMock).not.toHaveBeenCalled();
    // Now wait the full 200ms after the last rerender.
    await act(async () => {
      vi.advanceTimersByTime(200);
      await flushMicrotasks();
    });
    expect(getJsonMock).toHaveBeenCalledTimes(1);
    // Only the latest query reached the network.
    expect(getJsonMock).toHaveBeenCalledWith('/tasks/search', {
      query: { q: 'cho' },
      timeoutMs: 5_000,
    });
  });
});
