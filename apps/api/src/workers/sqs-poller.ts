// SQS poller — the prod EventBridge→SQS→BullMQ trigger leg (VERIFY-01).
// Standalone ECS-container entrypoint: `node dist/workers/sqs-poller.js` (the 2nd
// container in the worker task def; see infra/terraform/modules/verify-queue/main.tf).
// Long-polls the `verify` SQS queue, derives `recordingId` from the S3 'Object
// Created' event key, `enqueueVerify`s the BullMQ job (jobId=recordingId → the 3
// events per bundle — video.mp4 + imu.csv + metadata.json — collapse to one),
// then DeleteMessages. Does NOT import buildApp or the DB — `verifyRecording`
// runs in `hash-verify.ts`. Dev uses the `/finalize` LocalStack shim instead;
// `recordings_to_verify` + the `verify-sweep` cron are the durable backstop
// either way. Bootstrap is gated on `WORKER_BOOTSTRAP !== 'false'` so unit tests
// can import the pure `parseRecordingIdFromS3Event` without launching the loop.
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import pino from 'pino';
import { loggerOptions } from '../plugins/logger.js';
import { enqueueVerify } from '../lib/queue.js';

const log = pino(loggerOptions).child({ component: 'sqs-poller' });

// recordings/{userId}/{recordingId}/{video.mp4|imu.csv|metadata.json}
// userId & recordingId are 26-char Crockford-base32 ULIDs (no I/L/O/U).
// The SECOND capture group is the recordingId.
const RECORDING_KEY_RE =
  /^recordings\/[0-9A-HJKMNP-TV-Z]{26}\/([0-9A-HJKMNP-TV-Z]{26})\/(?:video\.mp4|imu\.csv|metadata\.json)$/;

/**
 * Defensively derive the `recordingId` from an SQS message body that carries
 * either an EventBridge S3 'Object Created' envelope or an S3-direct event.
 * Returns `null` for anything that doesn't parse as JSON or whose object key
 * doesn't match the locked `recordings/<ULID>/<ULID>/{video.mp4|imu.csv|metadata.json}`
 * shape — the poller never trusts the key to point at a real recording (the
 * BullMQ job is a no-op via `verifyRecording` if the row doesn't exist / isn't
 * `qa_status='uploaded'`).
 */
export function parseRecordingIdFromS3Event(messageBody: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(messageBody);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  // EventBridge envelope: { source:'aws.s3', 'detail-type':'Object Created', detail:{ bucket:{name}, object:{key} } }
  let rawKey: string | undefined;
  const detail = obj.detail as Record<string, unknown> | undefined;
  if (detail && typeof detail === 'object') {
    const object = detail.object as Record<string, unknown> | undefined;
    if (object && typeof object.key === 'string') rawKey = object.key;
  }
  // S3-direct: { Records: [ { s3: { object: { key } } } ] }
  if (rawKey === undefined && Array.isArray(obj.Records)) {
    const rec0 = obj.Records[0] as Record<string, unknown> | undefined;
    const s3 = rec0?.s3 as Record<string, unknown> | undefined;
    const object = s3?.object as Record<string, unknown> | undefined;
    if (object && typeof object.key === 'string') rawKey = object.key;
  }
  if (typeof rawKey !== 'string') return null;

  // Best-effort URL-decode (S3 event keys percent-encode some chars and use '+'
  // for spaces). Keep the raw key as a fallback if decode throws (lone '%' etc.).
  let decodedKey = rawKey;
  try {
    decodedKey = decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    decodedKey = rawKey;
  }

  const m = RECORDING_KEY_RE.exec(decodedKey) ?? RECORDING_KEY_RE.exec(rawKey);
  return m?.[1] ?? null;
}

let running = true;

function makeSqs(): SQSClient {
  return new SQSClient({
    region: process.env.AWS_REGION ?? 'ap-south-1',
    ...(process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL } : {}),
  });
}

async function pollOnce(sqs: SQSClient, queueUrl: string): Promise<void> {
  const out = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // long-poll — cheap when the queue is empty
      VisibilityTimeout: 60, // >> the enqueueVerify latency
    }),
  );
  const messages: Message[] = out.Messages ?? [];
  for (const msg of messages) {
    const body = msg.Body ?? '';
    const recordingId = parseRecordingIdFromS3Event(body);

    if (recordingId === null) {
      // Did the body at least parse as JSON? If so it's a real-but-not-ours /
      // malformed S3 event — delete it (don't requeue garbage). If it didn't
      // even parse, leave it: it'll dead-letter after the queue's maxReceiveCount.
      let didParse = false;
      try {
        JSON.parse(body);
        didParse = true;
      } catch {
        didParse = false;
      }
      if (didParse) {
        log.warn(
          { msgId: msg.MessageId },
          'S3 event key did not match a recording bundle — deleting',
        );
        await sqs.send(
          new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle! }),
        );
      } else {
        log.warn({ msgId: msg.MessageId }, 'unparseable SQS message body — leaving for the DLQ');
      }
      continue;
    }

    try {
      await enqueueVerify(recordingId); // jobId = recordingId → idempotent collapse
      await sqs.send(
        new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle! }),
      );
      log.info({ recordingId, msgId: msg.MessageId }, 'enqueued verify + deleted SQS message');
    } catch (err) {
      log.error(
        { err, recordingId, msgId: msg.MessageId },
        'enqueueVerify failed — NOT deleting (will retry / DLQ)',
      );
    }
  }
}

async function loop(): Promise<void> {
  const queueUrl = process.env.VERIFY_QUEUE_URL;
  if (!queueUrl) {
    log.error('VERIFY_QUEUE_URL is not set — cannot run the SQS poller');
    process.exit(1);
  }
  const sqs = makeSqs();
  log.info({ queueUrl }, 'SQS poller started');
  while (running) {
    try {
      await pollOnce(sqs, queueUrl);
    } catch (err) {
      log.error({ err }, 'SQS poll iteration failed — backing off 5s');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  log.info('SQS poller loop exited');
  process.exit(0);
}

function shutdown(signal: string): void {
  log.info({ signal }, 'SQS poller shutting down');
  running = false;
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Bootstrap — guarded so unit tests can import the pure parser without the loop.
if (process.env.WORKER_BOOTSTRAP !== 'false') void loop();
