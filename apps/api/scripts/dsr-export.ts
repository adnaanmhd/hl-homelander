// DSR access/portability fulfillment CLI (D-LEGAL-02 — mailto+ops flow).
//
// User emails dsr@humyn-labs.io requesting access/portability of their data.
// Ops verifies identity (Google account email match against users.email per
// .planning/runbooks/dsr-mailto-export.md), then runs:
//
//   OPS_ENGINEER="<your-name>" pnpm dsr:build-export <user_id>
//
// The script:
//   1. Looks up the user by id; aborts if missing.
//   2. Pulls users + profiles + recordings + contributions + events +
//      consent_log rows for that user (in parallel, all parameterised).
//   3. Writes the bundle to apps/api/dsr-exports/<user_id>/<export_id>.json
//      on local disk.
//   4. Inserts a dsr_log audit row recording the fulfillment timestamp +
//      OPS_ENGINEER name + the on-disk path (T-1.11-02 mitigation).
//
// Ops then zips, uploads to humyn-ops-dsr-prod, and emails the user a 24-h
// presigned link per the runbook. NO HTTP route exposes this functionality —
// the CLI is invoked manually by ops only (D-LEGAL-02 method-agnostic).

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../src/db/index.js';

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: pnpm dsr:build-export <user_id>');
    console.error('  ENV: OPS_ENGINEER="<your-name>" (recorded in dsr_log audit row)');
    process.exit(2);
  }

  // 1. Verify the user exists.
  const userRows = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (userRows.length === 0) {
    console.error(`No user with id=${userId}`);
    process.exit(3);
  }
  const user = userRows[0]!;

  // 2. Pull every relevant table for that user (parallel; all parameterised).
  const [profile, recordings, contributions, events, consents] = await Promise.all([
    db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)),
    db.select().from(schema.recordings).where(eq(schema.recordings.userId, userId)),
    db.select().from(schema.contributions).where(eq(schema.contributions.userId, userId)),
    db.select().from(schema.events).where(eq(schema.events.userId, userId)),
    db.select().from(schema.consentLog).where(eq(schema.consentLog.userId, userId)),
  ]);

  // 3. Compose the dump.
  const exportId = ulid();
  const dump = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    exportId,
    userId,
    user,
    profile: profile[0] ?? null,
    recordings,
    contributions,
    events,
    consentLog: consents,
  };

  // 4. Write to local disk under apps/api/dsr-exports/<user_id>/<export_id>.json
  const outDir = resolve(process.cwd(), 'dsr-exports', userId);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, `${exportId}.json`);
  writeFileSync(jsonPath, JSON.stringify(dump, null, 2), 'utf8');

  // 5. Audit row — records the fulfillment for counsel-side evidence (T-1.11-04).
  await db.insert(schema.dsrLog).values({
    id: ulid(),
    userId,
    requestType: 'access',
    requestReceivedAt: new Date(),
    fulfilledAt: new Date(),
    opsEngineer: process.env.OPS_ENGINEER ?? 'unknown',
    notes: `dsr-export.ts wrote ${jsonPath}`,
  });

  console.log(`[dsr-export] wrote ${jsonPath}`);
  console.log(`[dsr-export] audit row written to dsr_log (export_id=${exportId})`);
  console.log(`[dsr-export] next steps:`);
  console.log(`  1. Zip the file: cd ${outDir} && zip ${exportId}.zip ${exportId}.json`);
  console.log(`  2. Upload to ops bucket:`);
  console.log(
    `     aws s3 cp ${exportId}.zip s3://humyn-ops-dsr-prod/${userId}/${exportId}.zip --sse AES256`,
  );
  console.log(`  3. Mint a 24-h presigned GET URL:`);
  console.log(
    `     aws s3 presign s3://humyn-ops-dsr-prod/${userId}/${exportId}.zip --expires-in 86400`,
  );
  console.log(`  4. Reply to the user's mail thread with the URL.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
