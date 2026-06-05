// ffmpeg protocol-whitelist hardening for the poster thumbnail (Bug 6 / D5).
//
// thumbnail.ts hands ffmpeg a SERVER-built presigned S3 URL, but the MP4 *bytes*
// are user-uploaded. A crafted HLS/concat/image2-list payload could otherwise
// make ffmpeg follow an embedded file:// (local-file read) or
// http://169.254.169.254/ (IMDS/SSRF) reference. The defence is
// `-protocol_whitelist tcp,tls,<scheme>`, pinned to exactly the presigned URL's
// transport — never file/data/concat.
//
// These tests pin that defence through thumbnail.ts's OWN code path:
//   1. the spawned ffmpeg argv carries `-protocol_whitelist tcp,tls,<scheme>`
//      (and NOT file/data/concat) — asserted via a spawn spy, no ffmpeg needed.
//   2. the REAL ffmpeg refuses a non-allowed (file://) input because of that
//      whitelist — gated on ffmpeg being installed.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { S3Client } from '@aws-sdk/client-s3';

// vi.mock is hoisted above module-level consts, so the spawn spy's toggle +
// recorder must live in vi.hoisted to be referenceable from the factory.
const h = vi.hoisted(() => ({
  delegateReal: false,
  lastArgs: null as string[] | null,
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: (cmd: string, args: string[]) => {
      h.lastArgs = args;
      if (h.delegateReal) return actual.spawn(cmd, args);
      // Fake child: record argv, then fail fast so generatePosterThumbnail()
      // rejects without touching a real ffmpeg (argv is already captured).
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: () => void;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setImmediate(() => child.emit('error', new Error('spawn mocked — argv captured')));
      return child;
    },
  };
});

// getSignedUrl is the only thing between us and the spawn — stub it so we control
// the exact input URL (and its scheme) ffmpeg is handed.
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generatePosterThumbnail } from '../../src/lib/thumbnail.js';

const HAS_FFMPEG = (() => {
  try {
    return spawnSync('ffmpeg', ['-version']).status === 0;
  } catch {
    return false;
  }
})();

const s3 = {} as unknown as S3Client; // never used — getSignedUrl is mocked
const presign = vi.mocked(getSignedUrl);

beforeEach(() => {
  h.delegateReal = false;
  h.lastArgs = null;
  presign.mockReset();
});

describe('thumbnail poster — ffmpeg protocol whitelist (Bug 6 / D5)', () => {
  it('passes -protocol_whitelist tcp,tls,https (never file/data/concat) to ffmpeg', async () => {
    presign.mockResolvedValue('https://s3.example.test/recordings/u/r/video.mp4?X-Amz-Signature=x');

    // The fake child errors — we only care about the argv it captured.
    await expect(
      generatePosterThumbnail({ s3, bucket: 'b', videoKey: 'video.mp4', thumbKey: 'thumb.jpg' }),
    ).rejects.toThrow();

    const args = h.lastArgs;
    expect(args).not.toBeNull();
    const i = args!.indexOf('-protocol_whitelist');
    expect(i).toBeGreaterThanOrEqual(0);
    const value = args![i + 1];
    expect(value).toBe('tcp,tls,https');
    expect(value).not.toMatch(/file|data|concat|subfile/);
    // The whitelist must precede -i (input) so it actually constrains the input.
    expect(i).toBeLessThan(args!.indexOf('-i'));
  });

  it('pins the whitelist to http when the presigned URL is http (dev/LocalStack)', async () => {
    presign.mockResolvedValue('http://localhost:4566/humyn-recordings-dev/u/r/video.mp4?sig=x');

    await expect(
      generatePosterThumbnail({ s3, bucket: 'b', videoKey: 'video.mp4', thumbKey: 'thumb.jpg' }),
    ).rejects.toThrow();

    const args = h.lastArgs!;
    expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('tcp,tls,http');
  });

  it.skipIf(!HAS_FFMPEG)(
    'real ffmpeg refuses a non-allowed (file://) input because of the whitelist',
    async () => {
      // A file that WOULD be readable if file:// were allowed → the only reason
      // ffmpeg fails is the protocol whitelist, proving the control actually bites.
      const decoy = join(tmpdir(), `thumb-protocol-${Date.now()}.bin`);
      writeFileSync(decoy, 'not a video');
      try {
        h.delegateReal = true; // run the REAL ffmpeg, via thumbnail.ts's argv
        presign.mockResolvedValue(pathToFileURL(decoy).href); // file:// input
        await expect(
          generatePosterThumbnail({
            s3,
            bucket: 'b',
            videoKey: 'video.mp4',
            thumbKey: 'thumb.jpg',
          }),
        ).rejects.toThrow(/whitelist/i);
      } finally {
        rmSync(decoy, { force: true });
      }
    },
  );
});
