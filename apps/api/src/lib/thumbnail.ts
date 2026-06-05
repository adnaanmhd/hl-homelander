// Server-side poster-thumbnail generation for cross-device History (Bug 6 / D5).
//
// The capture device writes a local 64×64 thumbnail into its MMKV ledger, but a
// SECOND device (or a reinstall) has an empty ledger → the History row falls back
// to a gradient placeholder. To fix that, the server derives a poster JPEG from
// the already-assembled MP4 at /finalize and stores it at
// recordings/{userId}/{recordingId}/thumb.jpg; list/get then serve a short-TTL
// signed URL the client uses when it has no local thumbnail.
//
// The "files are never re-encoded" rule (CLAUDE.md) is about the CAPTURED bytes
// (MP4 / IMU CSV / metadata.json travel byte-for-byte). The poster is a NEW,
// derived object — the source MP4 is untouched.
//
// ffmpeg reads the MP4 via a short-lived presigned GET so it can range-seek to
// ~1s without the API process buffering the whole file. Everything here is
// best-effort: the caller wraps generatePosterThumbnail() in try/catch and a
// failure (ffmpeg missing, unreadable input, timeout) leaves s3_key_thumbnail
// NULL — it MUST NOT block the terminal-success flip.

import { spawn } from 'node:child_process';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const FFMPEG_TIMEOUT_MS = 10_000; // hard cap so a hung ffmpeg can't stall finalize
const THUMB_SEEK_SECONDS = 1; // poster frame ~1s in (skips any black lead-in)
const PRESIGN_TTL_SECONDS = 120; // just long enough for ffmpeg to read the input
const THUMB_MAX_EDGE = 640; // downscale the longest edge; History renders at 64px

/**
 * Derive a poster JPEG from the S3 video object and PUT it to `thumbKey`.
 * Throws on any failure — the caller treats that as "no thumbnail" (best-effort).
 */
export async function generatePosterThumbnail(args: {
  s3: S3Client;
  bucket: string;
  videoKey: string;
  thumbKey: string;
}): Promise<void> {
  const presignedGet = await getSignedUrl(
    args.s3,
    new GetObjectCommand({ Bucket: args.bucket, Key: args.videoKey }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );
  const jpeg = await runFfmpegPoster(presignedGet);
  await args.s3.send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.thumbKey,
      Body: jpeg,
      ContentType: 'image/jpeg',
    }),
  );
}

/** Spawn ffmpeg to grab one downscaled JPEG frame, returned as a Buffer via stdout. */
function runFfmpegPoster(inputUrl: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    // -ss BEFORE -i = fast input seek; one frame; scale the longest edge to
    // <=THUMB_MAX_EDGE keeping aspect (the -2 keeps the other dim even, which
    // mjpeg requires); pipe an mjpeg image to stdout.
    // Restrict ffmpeg to the protocols needed to fetch OUR server-generated
    // presigned URL — never file/concat/subfile/data. The MP4 *content* is
    // user-uploaded, so a crafted HLS/concat/image2-list payload could otherwise
    // make ffmpeg follow embedded file:// (local-file read) or
    // http://169.254.169.254/ (IMDS/SSRF) references. The presigned URL is
    // trusted + server-built, so we allow exactly ITS scheme: prod S3 is `https`
    // (which also refuses the http://IMDS vector); dev/LocalStack presigns `http`.
    const fetchScheme = inputUrl.startsWith('https:') ? 'https' : 'http';
    const proc = spawn('ffmpeg', [
      '-protocol_whitelist',
      `tcp,tls,${fetchScheme}`,
      '-nostdin',
      '-loglevel',
      'error',
      '-ss',
      String(THUMB_SEEK_SECONDS),
      '-i',
      inputUrl,
      '-frames:v',
      '1',
      '-vf',
      `scale='min(${THUMB_MAX_EDGE},iw)':-2`,
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg poster timed out'));
    }, FFMPEG_TIMEOUT_MS);

    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err); // e.g. ENOENT when ffmpeg isn't installed
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      if (code === 0 && out.byteLength > 0) {
        resolve(out);
      } else {
        reject(new Error(`ffmpeg poster failed (exit ${code}): ${stderr.slice(0, 200)}`));
      }
    });
  });
}
