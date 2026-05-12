// Hash-verify worker queue — the ONE Redis carve-out at MVP (CLAUDE.md). The
// on-device upload queue is MMKV-backed; this is the server-side re-hash queue.
//
// `getRedisConnection()` / `getQueue()` are lazy memoized singletons (same
// pattern as `s3-client.ts#getS3Client`) so importing this module never opens a
// socket until something actually enqueues — keeps the unit-test pool quiet and
// lets the Fastify API import `enqueueVerify` without a live Redis at boot.
//
// `enqueueVerify` uses `jobId = recordingId` so a double-enqueue (a redelivered
// SQS message + the verify-sweep cron firing on the same row) collapses to one
// BullMQ job — see threat T-5-03-01 in the plan.
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let _redis: Redis | undefined;
export function getRedisConnection(): Redis {
  if (_redis) return _redis;
  // maxRetriesPerRequest must be null for BullMQ's blocking commands (BRPOPLPUSH).
  _redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return _redis;
}

let _queue: Queue | undefined;
export function getQueue(): Queue {
  if (_queue) return _queue;
  _queue = new Queue('verify', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  return _queue;
}

export async function enqueueVerify(recordingId: string): Promise<void> {
  // jobId = recordingId → a double-enqueue collapses to one job (idempotent enqueue).
  await getQueue().add('verify', { recordingId }, { jobId: recordingId });
}
