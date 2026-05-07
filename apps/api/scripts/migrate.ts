import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const migrationsDir = new URL('../src/db/migrations/', import.meta.url);
  const entries = await readdir(migrationsDir);
  const files = entries.filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    console.error('No migration files found');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
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
