// One-shot host-side reproduction for the on-device /recordings/init 400.
// Feeds the EXACT body shape the device's UploadCoordinator.kt builds (from
// the captured metadata.json for recordingId 01KRFVZ8W3K4V6HYC2HEBKXGFX) into
// the project's own RecordingsInitRequestSchema and prints the zod error.
//
// Run: `pnpm --filter @humyn/api tsx scripts/repro-init-400.ts`
//   or  `npx tsx apps/api/scripts/repro-init-400.ts` from repo root.
//
// Delete once the on-device half of the Phase-5 smoke walk is signed off.
import { RecordingsInitRequestSchema } from '@humyn/shared-types';

const deviceBody = {
  recordingId: '01KRFVZ8W3K4V6HYC2HEBKXGFX',
  taskId: '01HVDEVSEEDTASK00000000000',
  practice: false,
  partsCount: 28, // 138 MB / 5 MB ≈ 28
  durationMs: 142236,
  fileSha256: 'a'.repeat(64), // placeholder; shape-only test
  imuSha256: 'b'.repeat(64),
  fileSizeBytes: 138018591,
  imuSizeBytes: 6463344,
  capturedAt: '2026-05-13T10:41:53.48219+05:30', // <- the actual device emission
};

console.log('--- with device body (offset +05:30) ---');
const r1 = RecordingsInitRequestSchema.safeParse(deviceBody);
console.log('success:', r1.success);
if (!r1.success) console.log('issues:', JSON.stringify(r1.error.issues, null, 2));

console.log('\n--- same body but capturedAt rewritten to Z ---');
const utcBody = { ...deviceBody, capturedAt: '2026-05-13T05:11:53.482Z' };
const r2 = RecordingsInitRequestSchema.safeParse(utcBody);
console.log('success:', r2.success);
if (!r2.success) console.log('issues:', JSON.stringify(r2.error.issues, null, 2));
