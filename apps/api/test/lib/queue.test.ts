// queue.ts — assert the lazy memoized singletons + the queue name. No live
// Redis required for the singleton/name checks; the actual enqueue round-trip
// is gated on REDIS_URL (and skipped in CI without a Redis container).
import { describe, it, expect, afterAll } from 'vitest';
import { getRedisConnection, getQueue, enqueueVerify } from '../../src/lib/queue.js';

describe('lib/queue', () => {
  it('getRedisConnection() returns the same ioredis instance on repeated calls (singleton)', () => {
    const a = getRedisConnection();
    const b = getRedisConnection();
    expect(a).toBe(b);
  });

  it("getQueue() is memoized and named 'verify'", () => {
    const q1 = getQueue();
    const q2 = getQueue();
    expect(q1).toBe(q2);
    expect(q1.name).toBe('verify');
  });

  it('enqueueVerify round-trips a job with jobId === recordingId (when Redis is up)', async () => {
    if (!process.env.REDIS_URL) {
      // No Redis configured in this environment — singleton/name checks above cover the rest.
      return;
    }
    const recordingId = '01HVTQUEUE000000000000000ZZ';
    const q = getQueue();
    await q.remove(recordingId).catch(() => {});
    await enqueueVerify(recordingId);
    const job = await q.getJob(recordingId);
    expect(job?.id).toBe(recordingId);
    expect(job?.data).toEqual({ recordingId });
    // double-enqueue collapses to one job
    await enqueueVerify(recordingId);
    const again = await q.getJob(recordingId);
    expect(again?.id).toBe(recordingId);
    await q.remove(recordingId).catch(() => {});
  });

  afterAll(async () => {
    // Close the BullMQ queue + the shared ioredis connection so the test
    // process exits cleanly even when REDIS_URL is set.
    try {
      await getQueue().close();
    } catch {
      /* not opened */
    }
    try {
      getRedisConnection().disconnect();
    } catch {
      /* not opened */
    }
  });
});
