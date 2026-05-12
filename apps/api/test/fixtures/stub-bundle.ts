// Shared stub upload bundle for the hash-verify worker tests (Wave-0 fixture,
// see 05-VALIDATION.md). Tiny synthetic video / IMU-CSV / metadata blobs plus
// their precomputed SHA-256 hex — the hashes are computed at module load from
// the same bytes so they always agree (no risk of a copy-paste drift between
// the blob and its expected hash).
//
// These are NOT real MP4 / CSV files — the worker only re-hashes raw bytes, it
// never parses them, so any deterministic byte blob works for the tests.
import { createHash } from 'node:crypto';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

// A few bytes that look vaguely like an MP4 'ftyp' box header, then padding.
export const STUB_VIDEO_BYTES: Buffer = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypisom', 'ascii'),
  Buffer.from('humyn-stub-video-payload-0001', 'ascii'),
]);

// A tiny IMU CSV: header + two sample rows (the real schema is t_ns,ax,ay,az,gx,gy,gz).
export const STUB_IMU_CSV_BYTES: Buffer = Buffer.from(
  't_ns,ax,ay,az,gx,gy,gz\n0,0.01,-9.81,0.02,0.001,0.002,0.003\n10000000,0.02,-9.80,0.01,0.002,0.001,0.004\n',
  'utf8',
);

export const STUB_VIDEO_SHA256: string = sha256(STUB_VIDEO_BYTES);
export const STUB_IMU_SHA256: string = sha256(STUB_IMU_CSV_BYTES);

// metadata.json mirrors video_metadata.json's shape (subset) — file_sha256 /
// imu_sha256 match the blobs above so a metadata-cross-check (if enabled) agrees.
export const STUB_METADATA: Record<string, unknown> = {
  schema_version: '1.0',
  recording_id: null, // filled per-test
  file_sha256: STUB_VIDEO_SHA256,
  imu_sha256: STUB_IMU_SHA256,
  file_size_bytes: STUB_VIDEO_BYTES.byteLength,
  imu_size_bytes: STUB_IMU_CSV_BYTES.byteLength,
  duration_ms: 1000,
};

export function stubMetadataJsonBytes(recordingId: string): Buffer {
  return Buffer.from(JSON.stringify({ ...STUB_METADATA, recording_id: recordingId }), 'utf8');
}
