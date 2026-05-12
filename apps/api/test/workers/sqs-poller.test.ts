// parseRecordingIdFromS3Event — the pure S3-event-key → recordingId parser used
// by the prod SQS poller (Plan 05-12). No live SQS/Redis needed: the parser is
// pure. WORKER_BOOTSTRAP=false (set BEFORE the import below) keeps importing the
// module from launching the polling loop.
process.env.WORKER_BOOTSTRAP = 'false';

import { describe, it, expect } from 'vitest';
import { parseRecordingIdFromS3Event } from '../../src/workers/sqs-poller.js';

// Valid 26-char Crockford-base32 (no I/L/O/U) ULID-shaped fixtures.
const USER_ID = '0123456789ABCDEFGHJKMNPQRS';
const REC_ID = 'TVWXYZ0123456789ABCDEFGHJK';

function eventBridgeBody(key: string): string {
  return JSON.stringify({
    version: '0',
    id: 'evt-1',
    'detail-type': 'Object Created',
    source: 'aws.s3',
    account: '123456789012',
    time: '2026-05-12T00:00:00Z',
    region: 'ap-south-1',
    resources: ['arn:aws:s3:::humyn-recordings-prod'],
    detail: {
      version: '0',
      bucket: { name: 'humyn-recordings-prod' },
      object: { key, size: 123, etag: 'abc', sequencer: '00' },
    },
  });
}

function s3DirectBody(key: string): string {
  return JSON.stringify({ Records: [{ s3: { object: { key } } }] });
}

describe('parseRecordingIdFromS3Event', () => {
  it('returns the recordingId from a well-formed EventBridge Object Created body for video.mp4', () => {
    expect(
      parseRecordingIdFromS3Event(eventBridgeBody(`recordings/${USER_ID}/${REC_ID}/video.mp4`)),
    ).toBe(REC_ID);
  });

  it('returns the same recordingId for the imu.csv variant', () => {
    expect(
      parseRecordingIdFromS3Event(eventBridgeBody(`recordings/${USER_ID}/${REC_ID}/imu.csv`)),
    ).toBe(REC_ID);
  });

  it('returns the same recordingId for the metadata.json variant', () => {
    expect(
      parseRecordingIdFromS3Event(eventBridgeBody(`recordings/${USER_ID}/${REC_ID}/metadata.json`)),
    ).toBe(REC_ID);
  });

  it('returns null for a non-recordings/ prefix', () => {
    expect(parseRecordingIdFromS3Event(eventBridgeBody('other/x/y/video.mp4'))).toBeNull();
  });

  it('returns null for a non-base32 / wrong-length recordingId segment', () => {
    expect(
      parseRecordingIdFromS3Event(eventBridgeBody(`recordings/${USER_ID}/not-a-ulid/video.mp4`)),
    ).toBeNull();
    // contains I/L/O/U (excluded from Crockford base32) — should not match
    expect(
      parseRecordingIdFromS3Event(
        eventBridgeBody(`recordings/${USER_ID}/ILOU56789ABCDEFGHJKMNPQRST/video.mp4`),
      ),
    ).toBeNull();
  });

  it('returns null for a non-JSON body', () => {
    expect(parseRecordingIdFromS3Event('<html>oops</html>')).toBeNull();
  });

  it('returns null for a JSON body with neither detail.object.key nor Records', () => {
    expect(parseRecordingIdFromS3Event(JSON.stringify({ hello: 'world' }))).toBeNull();
  });

  it('returns the recordingId from an S3-direct {Records:[{s3:{object:{key}}}]} body', () => {
    expect(
      parseRecordingIdFromS3Event(s3DirectBody(`recordings/${USER_ID}/${REC_ID}/imu.csv`)),
    ).toBe(REC_ID);
  });

  it('resolves a %2F-encoded key via the decode path', () => {
    // S3 event payloads sometimes URL-encode keys; the parser does a best-effort
    // decodeURIComponent(key.replace(/\+/g, ' ')) before matching.
    const pctKey = `recordings%2F${USER_ID}%2F${REC_ID}%2Fvideo.mp4`;
    expect(parseRecordingIdFromS3Event(eventBridgeBody(pctKey))).toBe(REC_ID);
  });

  it('falls back to the raw key when decodeURIComponent would throw (lone % escape)', () => {
    // A lone '%' not followed by two hex digits makes decodeURIComponent throw — but
    // since a malformed-% key can never match the strict regex anyway, the practical
    // assertion is just that the parser does not throw and returns null.
    expect(
      parseRecordingIdFromS3Event(eventBridgeBody(`recordings/${USER_ID}/${REC_ID}/video%mp4`)),
    ).toBeNull();
    expect(() =>
      parseRecordingIdFromS3Event(eventBridgeBody(`recordings/${USER_ID}/${REC_ID}/video%mp4`)),
    ).not.toThrow();
  });

  it('returns null when msg.Body is empty / undefined-ish', () => {
    expect(parseRecordingIdFromS3Event('')).toBeNull();
  });
});
