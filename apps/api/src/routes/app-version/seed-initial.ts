// Seeds appVersions with placeholder rows for all three flavors so /app/version
// returns rows from day 0 of dev work + plan 12 e2e. Replaced at release time
// by the CI deploy pipeline (which writes the apkSha256 after building the APK
// + the published play_store_url + the published apps.apple.com URL).
//
// Idempotent — `ON CONFLICT (flavor) DO NOTHING` so re-running is safe.

import { db, schema } from '../../db/index.js';

export async function seedAppVersions(): Promise<void> {
  await db
    .insert(schema.appVersions)
    .values([
      {
        flavor: 'apkRollout',
        minSupported: '0.1.0',
        latest: '0.1.0',
        forceUpgrade: false,
        apkUrl: 'https://apk.humyn.ai/humyn-labs-capture-v0.1.0.apk',
        apkSha256: '0000000000000000000000000000000000000000000000000000000000000000',
        playStoreUrl: null,
      },
      {
        flavor: 'playStore',
        minSupported: '0.1.0',
        latest: '0.1.0',
        forceUpgrade: false,
        apkUrl: null,
        apkSha256: null,
        playStoreUrl: 'https://play.google.com/store/apps/details?id=ai.humynlabs.capture',
      },
      {
        flavor: 'iosAppStore',
        minSupported: '0.1.0',
        latest: '0.1.0',
        forceUpgrade: false,
        apkUrl: null,
        apkSha256: null,
        playStoreUrl: 'https://apps.apple.com/app/humyn-labs-capture/id000000000',
      },
    ])
    .onConflictDoNothing();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAppVersions()
    .then(() => {
      console.log('seeded app_versions');
      process.exit(0);
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}
