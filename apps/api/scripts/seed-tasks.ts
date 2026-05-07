// Idempotent task seed — runs via `pnpm seed:tasks`.
//
// Re-running produces the same end DB state: ON CONFLICT (slug) DO UPDATE
// rewrites every column on each run, so changes to task-taxonomy.md or
// mapping.json flow through without manual intervention. Embeddings are
// recomputed each run (acceptable — same model, same input, same output)
// per D-EMB-03.
//
// Source files:
//   - task-taxonomy.md         — repo root; markdown table with 65 task rows
//   - design-system/task-icons/mapping.json — slug + icon-key by task name
//
// Both files are anchored relative to the repo root, NOT cwd, so the script
// works whether invoked from apps/api/ (via `pnpm seed:tasks`) or from the
// repo root.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ulid } from 'ulid';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { embed, buildEmbeddedText } from '../src/lib/embedder.js';
import { joinTaxonomyWithMapping, loadIconMapping, parseTaxonomy } from './parse-taxonomy.js';

// __dirname is apps/api/scripts at runtime; the repo root is two levels up.
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '../../../..');
const TAXONOMY_PATH = resolve(REPO_ROOT, 'task-taxonomy.md');
const ICON_MAPPING_PATH = resolve(REPO_ROOT, 'design-system/task-icons/mapping.json');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const [parsedTasks, iconMapping] = await Promise.all([
    parseTaxonomy(TAXONOMY_PATH),
    loadIconMapping(ICON_MAPPING_PATH),
  ]);
  const seedRows = joinTaxonomyWithMapping(parsedTasks, iconMapping);

  console.log(
    `[seed-tasks] parsed ${parsedTasks.length} taxonomy rows, joined with ${iconMapping.size} mapping entries → ${seedRows.length} seed rows`,
  );

  let upserted = 0;
  for (const task of seedRows) {
    const text = buildEmbeddedText({
      name: task.name,
      description: task.description,
      category: task.category,
    });
    const embedding = await embed(text);
    // INSERT or UPDATE keyed by unique slug. Postgres rejects writes to
    // GENERATED ALWAYS columns, so name_search is excluded — Postgres
    // recomputes it from (name, description) on every INSERT/UPDATE.
    await db.execute(sql`
      INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
      VALUES (
        ${ulid()}, ${task.slug}, ${task.name}, ${task.description},
        ${task.category}, ${task.setting}::task_setting, ${task.iconKey},
        ${JSON.stringify(task.instructions)}::jsonb,
        ${`[${embedding.join(',')}]`}::vector(384)
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        setting = EXCLUDED.setting,
        icon_key = EXCLUDED.icon_key,
        instructions = EXCLUDED.instructions,
        embedding = EXCLUDED.embedding,
        updated_at = now()
    `);
    upserted += 1;
    if (upserted % 10 === 0 || upserted === seedRows.length) {
      console.log(`[seed-tasks]   ${upserted}/${seedRows.length} upserted`);
    }
  }
  console.log(`[seed-tasks] done — ${upserted} tasks upserted`);
}

main().catch((err) => {
  console.error('[seed-tasks] failed', err);
  process.exit(1);
});
