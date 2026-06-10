import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function bootstrapSecrets(): Promise<void> {
  const secretName = process.env.APP_NAME;
  if (!secretName) {
    return;
  }
  const region = process.env.AWS_REGION || 'ap-south-1';
  console.log(
    `[Migrate] Fetching secrets for "${secretName}" from AWS Secrets Manager (${region})...`,
  );
  const client = new SecretsManagerClient({ region });
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      for (const [key, value] of Object.entries(secrets)) {
        if (process.env[key] === undefined) {
          process.env[key] = String(value);
        }
      }
    }
  } catch (error) {
    console.error(`[Migrate] Failed to load secrets from AWS Secrets Manager:`, error);
    throw error;
  }
}

async function main() {
  await bootstrapSecrets();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  // Source lives at src/scripts/migrate.ts (tsx dev path); the build emits
  // dist/scripts/migrate.js. The raw SQL lives only under src/db/migrations —
  // the Docker image copies that dir alongside dist, so the compiled branch
  // walks up out of dist/ into src/.
  const isCompiled = import.meta.url.endsWith('.js');
  const migrationsDir = isCompiled
    ? new URL('../../src/db/migrations/', import.meta.url)
    : new URL('../db/migrations/', import.meta.url);
  const entries = await readdir(migrationsDir);
  const files = entries.filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    console.error('No migration files found');
    process.exit(1);
  }
  const useSSL =
    url.includes('rds.amazonaws.com') || url.includes('sslmode=') || url.includes('ssl=');
  const pool = new Pool({
    connectionString: url,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();
  try {
    // Bookkeeping table — tracks which migration files have been applied.
    // Migrations run in lexicographic order; once a file's name is in this table
    // it is skipped on subsequent runs. Created idempotently inside its own TX.
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename varchar(128) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('COMMIT');

    const appliedRes = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations',
    );
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    let appliedCount = 0;
    let skippedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping ${file} (already applied).`);
        skippedCount += 1;
        continue;
      }
      const sql = await readFile(new URL(file, migrationsDir), 'utf8');
      console.log(`Applying ${file} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`  ${file} applied.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ${file} failed:`, err);
        throw err;
      }
    }
    console.log(
      `Migrations: ${appliedCount} applied, ${skippedCount} skipped (total ${files.length}).`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
