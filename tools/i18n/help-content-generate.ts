/**
 * Help Center body translation generator — plan 07-13 (G-10 closure).
 *
 * Mirrors the structure of tools/i18n/generate.ts (the screen-string-catalog
 * generator) but operates on the richer help/content.json shape: 3 accordions,
 * each carrying an items[] array of tagged-union entries
 * (kind: 'subsection' | 'qa' | 'issue'), plus a top-level contactSupport
 * object. The validator below enforces shape parity with the en source so a
 * partial-regen / hallucinated response never lands as a sibling locale file.
 *
 * Run via `pnpm i18n:help-content:generate` from the tools/ workspace.
 *
 * Outputs:
 *   - apps/mobile/src/screens/help/content.{loc}.json  (per locale)
 *   - apps/mobile/src/screens/help/content.audit.json  (model + sha + ts)
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { TARGET_LOCALES, LOCALE_NAMES, type TargetLocale } from './locale-config.js';
import {
  HELP_CONTENT_VERNACULAR_BRIEF,
  HELP_CONTENT_BRIEF_VERSION,
  helpContentUserPromptFor,
} from './help-content-prompts.js';

const MODEL_ID = 'claude-opus-4-7'; // matches the screen-string catalog generator
const MAX_TOKENS = 16_000; // help content is ~12 KB; well within budget

// ---------------------------------------------------------------------------
// Shape mirrored from apps/mobile/src/screens/help/content.json. Keep in
// lockstep with apps/mobile/src/screens/help/HelpCenterScreen.tsx's
// AccordionItemPayload + AccordionContent. If the en source grows new
// shapes, update both this validator AND the screen renderer.
// ---------------------------------------------------------------------------
export type AccordionItem =
  | { kind: 'subsection'; heading: string; body: string }
  | { kind: 'qa'; question: string; answer: string }
  | { kind: 'issue'; heading: string; resolution: string };

export interface Accordion {
  id: string;
  title: string;
  items: AccordionItem[];
}

export interface ContactSupport {
  headline: string;
  body: string;
}

export interface HelpContent {
  accordions: Accordion[];
  contactSupport: ContactSupport;
}

// ---------------------------------------------------------------------------
// JSON-shape validator. Enforces:
//   - top-level object with accordions array + contactSupport object
//   - accordions count matches en (no dropped / hallucinated accordions)
//   - per-accordion: id matches en byte-for-byte (stable identifier),
//                    title is a string, items count matches en
//   - per-item: kind matches en (stable enum), the kind-specific string
//               fields exist and are non-null strings
//   - contactSupport.headline + body exist and are strings
// ---------------------------------------------------------------------------
export function validateHelpContentShape(
  en: HelpContent,
  translated: unknown,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof translated !== 'object' || translated === null) {
    return { ok: false, errors: ['translated content is not an object'] };
  }
  const t = translated as Record<string, unknown>;

  // accordions
  if (!Array.isArray(t.accordions)) {
    errors.push('translated content.accordions is not an array');
  } else {
    const tAcc = t.accordions as unknown[];
    if (tAcc.length !== en.accordions.length) {
      errors.push(
        `accordions count mismatch: en=${en.accordions.length} translated=${tAcc.length}`,
      );
    }
    const minLen = Math.min(en.accordions.length, tAcc.length);
    for (let i = 0; i < minLen; i++) {
      const enA = en.accordions[i]!;
      const tA = tAcc[i] as Record<string, unknown> | null;
      if (!tA || typeof tA !== 'object') {
        errors.push(`accordion[${i}] is not an object`);
        continue;
      }
      if (tA.id !== enA.id) {
        errors.push(`accordion[${i}].id mismatch: en='${enA.id}' translated='${String(tA.id)}'`);
      }
      if (typeof tA.title !== 'string') {
        errors.push(`accordion[${i}].title is not a string`);
      }
      if (!Array.isArray(tA.items)) {
        errors.push(`accordion[${i}].items is not an array`);
        continue;
      }
      const tItems = tA.items as unknown[];
      if (tItems.length !== enA.items.length) {
        errors.push(
          `accordion[${i}] item count mismatch: en=${enA.items.length} translated=${tItems.length}`,
        );
      }
      const minItemLen = Math.min(enA.items.length, tItems.length);
      for (let j = 0; j < minItemLen; j++) {
        const enIt = enA.items[j]!;
        const tIt = tItems[j] as Record<string, unknown> | null;
        if (!tIt || typeof tIt !== 'object') {
          errors.push(`accordion[${i}].items[${j}] is not an object`);
          continue;
        }
        if (tIt.kind !== enIt.kind) {
          errors.push(
            `accordion[${i}].items[${j}].kind mismatch: en='${enIt.kind}' translated='${String(tIt.kind)}'`,
          );
          continue; // can't validate kind-specific fields if kind is wrong
        }
        if (enIt.kind === 'subsection') {
          if (typeof tIt.heading !== 'string') {
            errors.push(`accordion[${i}].items[${j}].heading is not a string`);
          }
          if (typeof tIt.body !== 'string') {
            errors.push(`accordion[${i}].items[${j}].body is not a string`);
          }
        } else if (enIt.kind === 'qa') {
          if (typeof tIt.question !== 'string') {
            errors.push(`accordion[${i}].items[${j}].question is not a string`);
          }
          if (typeof tIt.answer !== 'string') {
            errors.push(`accordion[${i}].items[${j}].answer is not a string`);
          }
        } else if (enIt.kind === 'issue') {
          if (typeof tIt.heading !== 'string') {
            errors.push(`accordion[${i}].items[${j}].heading is not a string`);
          }
          if (typeof tIt.resolution !== 'string') {
            errors.push(`accordion[${i}].items[${j}].resolution is not a string`);
          }
        }
      }
    }
  }

  // contactSupport
  if (typeof t.contactSupport !== 'object' || t.contactSupport === null) {
    errors.push('translated content.contactSupport is missing or not an object');
  } else {
    const cs = t.contactSupport as Record<string, unknown>;
    if (typeof cs.headline !== 'string') {
      errors.push('contactSupport.headline is not a string');
    }
    if (typeof cs.body !== 'string') {
      errors.push('contactSupport.body is not a string');
    }
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Strip the ```json or bare ``` fences the model sometimes adds despite the
// brief saying "no markdown fences". Mirrors generate.ts's cleaner.
// ---------------------------------------------------------------------------
export function parseHelpContentResponse(text: string): HelpContent {
  const cleaned = text
    .replace(/^```json\s*\n?/i, '')
    .replace(/^```\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as HelpContent;
  } catch (e) {
    throw new Error(
      `[help-content-generate] response was not valid JSON: ${(e as Error).message}\n--- response head ---\n${cleaned.slice(0, 200)}`,
    );
  }
}

export async function generateHelpContentLocale(
  client: Anthropic,
  loc: TargetLocale,
  en: HelpContent,
): Promise<HelpContent> {
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: HELP_CONTENT_VERNACULAR_BRIEF,
    messages: [
      {
        role: 'user',
        content: helpContentUserPromptFor(
          LOCALE_NAMES[loc],
          en as unknown as Record<string, unknown>,
        ),
      },
    ],
  });
  const text = response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { type: string; text?: string }) => b.text ?? '')
    .join('');
  const parsed = parseHelpContentResponse(text);
  const v = validateHelpContentShape(en, parsed);
  if (!v.ok) {
    throw new Error(
      `[help-content-generate] ${loc} shape errors: ${v.errors.slice(0, 5).join('; ')}`,
    );
  }
  return parsed;
}

export function buildAuditSidecar(
  enSource: string,
  locales: Record<string, string>,
): Record<string, unknown> {
  return {
    model: MODEL_ID,
    generated_at: new Date().toISOString(),
    brief_version: HELP_CONTENT_BRIEF_VERSION,
    en_source_sha: createHash('sha256').update(enSource, 'utf8').digest('hex'),
    locales_generated: locales,
  };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      '[help-content-generate] ANTHROPIC_API_KEY not set. Create tools/.env from tools/.env.example and re-run.',
    );
    process.exit(2);
  }

  const repoRoot = resolve(import.meta.dirname, '..', '..');
  const contentDir = resolve(repoRoot, 'apps/mobile/src/screens/help');
  const enPath = resolve(contentDir, 'content.json');
  const enSource = readFileSync(enPath, 'utf8');
  const en = JSON.parse(enSource) as HelpContent;
  const client = new Anthropic();
  const auditEntries: Record<string, string> = {};

  for (const loc of TARGET_LOCALES) {
    console.log(`[help-content-generate] ${loc}: calling Claude Opus 4.7...`);
    try {
      const translated = await generateHelpContentLocale(client, loc, en);
      writeFileSync(
        resolve(contentDir, `content.${loc}.json`),
        JSON.stringify(translated, null, 2) + '\n',
      );
      auditEntries[loc] = new Date().toISOString();
      console.log(
        `[help-content-generate] ${loc}: OK (${translated.accordions.length} accordions)`,
      );
    } catch (e) {
      console.error(`[help-content-generate] ${loc}: FAILED —`, (e as Error).message);
      process.exit(1);
    }
  }

  writeFileSync(
    resolve(contentDir, 'content.audit.json'),
    JSON.stringify(buildAuditSidecar(enSource, auditEntries), null, 2) + '\n',
  );
  console.log('[help-content-generate] done.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
