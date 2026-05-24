/**
 * Catalog generator per D-10, D-11. Reads apps/mobile/src/i18n/locales/en.json,
 * makes 7 sequential calls to Claude Opus 4.7, writes each locale JSON +
 * audit sidecar. Run with `tsx tools/i18n/generate.ts` after en.json
 * stabilizes (typically the end of plan 07-05's screen sweep).
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { TARGET_LOCALES, LOCALE_NAMES, type TargetLocale } from './locale-config.js';
import { VERNACULAR_BRIEF, BRIEF_VERSION, userPromptFor } from './prompts.js';
import { validateShapeParity } from './validate.js';

const MODEL_ID = 'claude-opus-4-7'; // confirmed at PLAN time per RESEARCH A5
const MAX_TOKENS = 16_000; // ~500 strings × ~30 tokens each

export async function generateLocale(
  client: Anthropic,
  loc: TargetLocale,
  en: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: VERNACULAR_BRIEF,
    messages: [{ role: 'user', content: userPromptFor(LOCALE_NAMES[loc], en) }],
  });

  const text = response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { type: string; text?: string }) => b.text ?? '')
    .join('');

  // Strip markdown fences the model sometimes adds despite the prompt
  const cleaned = text
    .replace(/^```json\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `[generate] ${loc}: response was not valid JSON: ${(e as Error).message}\n--- response head ---\n${cleaned.slice(0, 200)}`,
    );
  }
}

export function buildAuditSidecar(enSource: string): Record<string, unknown> {
  return {
    model: MODEL_ID,
    generated_at: new Date().toISOString(),
    brief_version: BRIEF_VERSION,
    en_source_sha: createHash('sha256').update(enSource, 'utf8').digest('hex'),
  };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      '[generate] ANTHROPIC_API_KEY not set. Create tools/.env from tools/.env.example and re-run.',
    );
    process.exit(2);
  }

  const repoRoot = resolve(import.meta.dirname, '..', '..');
  const localesDir = resolve(repoRoot, 'apps/mobile/src/i18n/locales');
  const enPath = resolve(localesDir, 'en.json');
  const enSource = readFileSync(enPath, 'utf8');
  const en = JSON.parse(enSource) as Record<string, unknown>;
  const client = new Anthropic();

  for (const loc of TARGET_LOCALES) {
    console.log(`[generate] ${loc}: calling Claude Opus 4.7...`);
    try {
      const translated = await generateLocale(client, loc, en);
      const { missing, extra } = validateShapeParity(en as never, translated as never);
      if (missing.length || extra.length) {
        console.error(
          `[generate] ${loc}: shape mismatch missing=${missing.length} extra=${extra.length}`,
        );
        missing.slice(0, 5).forEach((p: string) => console.error(`  - missing: ${p}`));
        extra.slice(0, 5).forEach((p: string) => console.error(`  + extra:   ${p}`));
        console.error(`[generate] ${loc}: SKIPPED — fix prompt or re-run`);
        continue;
      }
      writeFileSync(resolve(localesDir, `${loc}.json`), JSON.stringify(translated, null, 2) + '\n');
      writeFileSync(
        resolve(localesDir, `${loc}.audit.json`),
        JSON.stringify(buildAuditSidecar(enSource), null, 2) + '\n',
      );
      console.log(`[generate] ${loc}: OK`);
    } catch (e) {
      console.error(`[generate] ${loc}: failed —`, (e as Error).message);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
