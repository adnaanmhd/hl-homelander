// Hash-verify worker — standalone ECS task entrypoint: `node dist/workers/hash-verify.js`.
// Same Docker image as the API, different entrypoint (apps/api is one codebase,
// two ECS task defs — `node dist/server.js` for Fastify, this for the BullMQ
// consumer). Scales independently on queue depth (VERIFY-07 — the autoscale
// policy is Terraform, Plan 05-05).
//
// Does NOT import buildApp() — only db + s3-client (via verify-recording) +
// queue (the Redis connection). The EventBridge→SQS leg + the dev /finalize
// shim that feed the 'verify' queue are Plan 05-05.
import { Worker } from 'bullmq';
import pino from 'pino';
import { loggerOptions } from '../plugins/logger.js';
import { getRedisConnection } from '../lib/queue.js';
import { verifyRecording } from '../lib/verify-recording.js';

const log = pino(loggerOptions).child({ component: 'hash-verify-worker' });

const worker = new Worker<{ recordingId: string }>(
  'verify',
  async (job) => {
    await verifyRecording(job.data.recordingId);
  },
  { connection: getRedisConnection(), concurrency: 4 },
);

worker.on('completed', (job) => {
  log.info({ jobId: job.id, recordingId: job.data.recordingId }, 'hash-verify job completed');
});

worker.on('failed', (job, err) => {
  // BullMQ already retries per the queue's attempts/backoff — this is just visibility.
  log.error({ jobId: job?.id, recordingId: job?.data?.recordingId, err }, 'hash-verify job failed');
});

worker.on('error', (err) => {
  log.error({ err }, 'hash-verify worker error');
});

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'hash-verify worker shutting down');
  try {
    await worker.close();
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

log.info({ concurrency: 4 }, 'hash-verify worker started');
