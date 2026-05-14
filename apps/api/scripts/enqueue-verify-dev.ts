// Dev-only one-shot: re-enqueue a recording into the BullMQ 'verify' queue.
// Used by the Phase-5 UAT re-walk when a prior worker run failed due to a
// stale state. NOT shipped — keep under apps/api/scripts/ (not imported by
// runtime code; tsx watch on hash-verify.ts won't reload from this path).
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const rid = process.argv[2];
if (!rid) {
  console.error('usage: tsx scripts/enqueue-verify-dev.ts <recording_id>');
  process.exit(1);
}

const connection = new IORedis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
const q = new Queue('verify', { connection });
const existing = await q.getJob(rid);
if (existing) {
  console.log('removing prior:', await existing.getState());
  await existing.remove();
}
await q.add(
  'verify',
  { recordingId: rid },
  {
    jobId: rid,
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
);
console.log('re-enqueued', rid);
await q.close();
connection.disconnect();
process.exit(0);
