---
phase: 07-multi-linguality-live-cam-feed
plan: 13
type: execute
wave: 1
depends_on: [02, 05]
files_modified:
  - tools/i18n/help-content-generate.ts
  - tools/i18n/help-content-prompts.ts
  - tools/i18n/__tests__/help-content-generate.test.ts
  - tools/package.json
  - apps/mobile/src/screens/help/content.json
  - apps/mobile/src/screens/help/content.hi-IN.json
  - apps/mobile/src/screens/help/content.pt-BR.json
  - apps/mobile/src/screens/help/content.es.json
  - apps/mobile/src/screens/help/content.bn-IN.json
  - apps/mobile/src/screens/help/content.ta-IN.json
  - apps/mobile/src/screens/help/content.te-IN.json
  - apps/mobile/src/screens/help/content.mr-IN.json
  - apps/mobile/src/screens/help/content.audit.json
  - apps/mobile/src/screens/help/contentLoader.ts
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx
  - apps/mobile/src/screens/help/__tests__/contentLoader.test.ts
autonomous: true
gap_closure: true
requirements: [I18N-01]
tags: [i18n, llm, tools, help-center, markdown, gap-closure]
must_haves:
  truths:
    - 'G-10 closed: a hi-IN (or any non-en) user opening the Help Center sees the full article body in the active locale (NOT English) — title + body of every accordion-section + every markdown line.'
    - 'Per CONTEXT.md D-03 (Help Center body fully translates) is now actually fulfilled at runtime, not just at the chrome level (the 4 existing `t()` calls in HelpCenterScreen.tsx + the contactSupport / reportProblem labels stay as-is; new wiring delivers the BODY).'
    - 'The English source-of-truth `content.json` remains byte-identical (no translation drift); the 7 non-English locales are SIBLING files at `content.{locale}.json` selected by the new `contentLoader.ts` based on `i18n.language`.'
    - 'Markdown structure preserved: a paragraph in en that renders as a `<Text>` with bold/italic markers MUST render as the equivalent in hi-IN (same `**bold**` / `*italic*` / numbered-list / bullet markers, just translated text).'
    - 'A new tool entrypoint `tools/i18n/help-content-generate.ts` runs the 7-locale translation pass; invokable via `pnpm i18n:help-content:generate`.'
    - "`apps/mobile/src/screens/help/contentLoader.ts` is a new module that exports `loadHelpContent(locale: string)` returning the appropriate `content.{locale}.json` (falls back to `content.json` for en or for any locale whose file doesn't exist yet)."
    - '`HelpCenterScreen.tsx` now calls `loadHelpContent(i18n.language)` instead of importing `content.json` directly; the 4 existing `t()` calls (`help.contactSupport`, `help.reportProblem`, etc.) are unchanged.'
    - "`markdown.tsx` is UNCHANGED — it's a pure markdown→React renderer, no string literals. It just renders whatever it's given."
    - 'Audit sidecar `content.audit.json` records LLM model + brief version + en source SHA + per-locale completion timestamps.'
    - 'iOS untouched (I18N-21); no DB migration (D-16); Phase-6 cosmetic-gaps untouched (I18N-11); Android untouched; HevcEncoder / FinalizeWorker / MetadataComposer untouched.'
  artifacts:
    - path: tools/i18n/help-content-generate.ts
      provides: 'LLM regen tool for the Help Center body across 7 non-English locales'
      contains: 'content.json'
    - path: tools/i18n/help-content-prompts.ts
      provides: 'Translation prompts specific to Help Center body content (preserves markdown structure)'
      contains: 'preserve markdown'
    - path: apps/mobile/src/screens/help/contentLoader.ts
      provides: 'loadHelpContent(locale: string): HelpContent — selects the right content.{locale}.json'
      exports: ['loadHelpContent']
    - path: apps/mobile/src/screens/help/content.hi-IN.json
      provides: 'Hindi-translated Help Center body — same shape as content.json'
      contains: 'accordions'
    - path: apps/mobile/src/screens/help/content.audit.json
      provides: 'Audit sidecar — model + brief version + en SHA + per-locale timestamps'
      contains: 'claude-opus'
  key_links:
    - from: apps/mobile/src/screens/help/HelpCenterScreen.tsx
      to: apps/mobile/src/screens/help/contentLoader.ts
      via: "loadHelpContent(i18n.language) replaces the static `import content from './content.json'`"
      pattern: 'loadHelpContent'
    - from: tools/i18n/help-content-generate.ts
      to: apps/mobile/src/screens/help/content.json
      via: 'Read en source → LLM-translate → write 7 sibling content.{locale}.json files'
      pattern: 'content.json'
---

<objective>
Close G-10 from `07-HUMAN-UAT.md`: the entire Help Center body (`apps/mobile/src/screens/help/content.json`) is in English regardless of active locale. CONTEXT.md D-03 (locked at SPEC time) requires the body to fully translate (Instructions / FAQs / Troubleshooting all in scope). Grep-confirmed:

- `apps/mobile/src/screens/help/HelpCenterScreen.tsx` has 4 `t()` calls (chrome only: contactSupport, reportProblem, etc.).
- `apps/mobile/src/screens/help/content.json` has zero `t()` calls — it's 216 LOC of accordion-titled markdown article content, English-only.
- `apps/mobile/src/screens/help/markdown.tsx` has zero `t()` calls — it's a generic markdown renderer; correctness here is intact, the bug is upstream (it's being fed English-only data).

**Design choice (per RESEARCH analog):** rather than restructure the content into 200+ flat `t()` keys (overkill — markdown is structural), we use a **sibling-file pattern** like the Locale-suffixed audit sidecars. The en source-of-truth lives at `content.json` (UNCHANGED). 7 new files `content.{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` carry the translated bodies. A new `contentLoader.ts` selects the right file by active locale at runtime. The LLM regen tool reads the en source + iterates over the 7 locales producing each sibling file.

**Markdown structure preservation** is non-negotiable: bold/italic markers, numbered lists, bullets, headings, links — all stay structurally identical between en and non-en; only the human-readable text inside the markers is translated.

**Non-negotiable invariants:**

- `git diff --stat apps/mobile/ios/` MUST remain empty (I18N-21).
- `git diff --stat apps/api/drizzle/migrations/` MUST remain empty (D-16).
- `06-COSMETIC-GAPS.md` MUST remain untouched (I18N-11).
- `git diff --stat apps/mobile/android/` MUST remain empty.
- `apps/mobile/src/screens/help/markdown.tsx` MUST remain UNCHANGED — it's a generic renderer.
- `apps/mobile/src/screens/help/content.json` (the en source) MUST remain byte-identical post-regen.
- `apps/mobile/src/i18n/taskCatalog.i18n.ts` MUST remain UNCHANGED — that's plan 07-12's scope.
- `apps/mobile/src/i18n/locales/*.json` MUST remain UNCHANGED — those are plan 07-11's scope.
- The Phase-7 deferral list in CONTEXT.md "Deferred Ideas" does NOT exclude Help Center body translation — D-03 puts it explicitly IN scope, so closing it here is consistent with the SPEC.

Output: a hi-IN-active build where opening Help Center renders all article bodies in Hindi.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@apps/mobile/src/screens/help/HelpCenterScreen.tsx
@apps/mobile/src/screens/help/content.json
@apps/mobile/src/screens/help/markdown.tsx
@tools/i18n/generate.ts
@tools/i18n/prompts.ts
@tools/i18n/locale-config.ts
@tools/i18n/validate.ts
@tools/package.json
@CLAUDE.md

<interfaces>
<!-- Shapes the executor must preserve. -->

From apps/mobile/src/screens/help/content.json (current — 216 LOC):

```json
{
  "accordions": [
    {
      "id": "instructions-guide",
      "title": "Instructions Guide",
      "body": "Each task ships with...\n\n**Bold heading**\n\n1. Numbered step\n..."
    }
    /* ~20 accordion entries with id / title / body fields */
  ]
}
```

After this plan (sibling files):

- `content.json` UNCHANGED (en source-of-truth).
- `content.hi-IN.json` has the same shape; values translated; markdown structure preserved.
- `content.pt-BR.json`, `content.es.json`, etc.

From apps/mobile/src/screens/help/HelpCenterScreen.tsx (existing — uses static import):

```typescript
// Currently:
import content from './content.json';
const accordions = content.accordions;

// After this plan:
import { useTranslation } from 'react-i18next';
import { loadHelpContent } from './contentLoader';
function HelpCenterScreen() {
  const { i18n } = useTranslation();
  const accordions = loadHelpContent(i18n.language).accordions;
  // ... existing render unchanged
}
```

contentLoader.ts shape:

```typescript
import enContent from './content.json';
import ptContent from './content.pt-BR.json';
// ... etc

const REGISTRY: Record<string, typeof enContent> = {
  en: enContent,
  'pt-BR': ptContent,
  // ... etc
};

export function loadHelpContent(locale: string): typeof enContent {
  return REGISTRY[locale] ?? REGISTRY.en;
}
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build the Help-Center LLM regen tool + contentLoader + HelpCenterScreen wiring + unit tests</name>
  <files>tools/i18n/help-content-generate.ts, tools/i18n/help-content-prompts.ts, tools/i18n/__tests__/help-content-generate.test.ts, tools/package.json, apps/mobile/src/screens/help/contentLoader.ts, apps/mobile/src/screens/help/HelpCenterScreen.tsx, apps/mobile/src/screens/help/__tests__/contentLoader.test.ts</files>
  <read_first>
    - tools/i18n/generate.ts (screen-string regen — structural analog for the new tool)
    - tools/i18n/task-catalog-generate.ts (the analog from plan 07-12 — same shape applies here)
    - tools/i18n/prompts.ts (VERNACULAR_BRIEF — base style)
    - tools/i18n/locale-config.ts (TARGET_LOCALES + LOCALE_NAMES)
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (the consumer; reads `content.accordions`)
    - apps/mobile/src/screens/help/content.json (the en source-of-truth — confirm the shape is `{ accordions: [{ id, title, body }] }`)
    - apps/mobile/src/screens/help/markdown.tsx (UNCHANGED; consumer of `body` strings)
    - tools/package.json (where the new script entry goes)
  </read_first>
  <behavior>
    - `tools/i18n/help-content-prompts.ts` exports `HELP_CONTENT_BRIEF_VERSION` + `HELP_CONTENT_VERNACULAR_BRIEF` (a system prompt that emphasizes "preserve markdown structure: `**bold**`, `*italic*`, `1.`/`2.` numbered lists, `-`/`*` bullets, `# Heading` lines, `[link text](url)` — translate ONLY the human-readable text; do NOT alter markdown markers"). Plus `helpContentUserPromptFor(localeName, enContent)` (user prompt).
    - `tools/i18n/help-content-generate.ts` mirrors `task-catalog-generate.ts` structurally:
      1. Reads `apps/mobile/src/screens/help/content.json` (the en source).
      2. Iterates over 7 non-English locales; for each, calls Claude Opus 4.7 with the help-content brief + the en content as input.
      3. Validates response: top-level shape is `{ accordions: [{ id, title, body }, ...] }`; same number of accordions as en; each accordion has the same `id` as en (ids are stable across locales — translation only touches `title` + `body`).
      4. Writes each translated locale to `apps/mobile/src/screens/help/content.{locale}.json`.
      5. Writes the audit sidecar at `apps/mobile/src/screens/help/content.audit.json`.
    - `apps/mobile/src/screens/help/contentLoader.ts` exports `loadHelpContent(locale: string)` with a static `import` per locale (RN bundler can tree-shake the unused ones; runtime selection is a Record lookup). Falls back to `content.json` if the locale's file doesn't exist OR if the locale is `'en'`.
    - `apps/mobile/src/screens/help/HelpCenterScreen.tsx` swaps the static `import content from './content.json'` for `loadHelpContent(i18n.language)`. The render JSX is unchanged. The 4 existing `t()` calls in HelpCenterScreen (`help.contactSupport` etc.) stay as-is — they're chrome, not body.
    - Unit tests:
      - `tools/i18n/__tests__/help-content-generate.test.ts` — tests the validator (no LLM calls).
      - `apps/mobile/src/screens/help/__tests__/contentLoader.test.ts` — tests that `loadHelpContent('en')` returns content.json, `loadHelpContent('hi-IN')` returns the hi-IN translated content (if it exists; otherwise falls back to en), unknown locale falls back to en.
    - The end-to-end LLM call is Task 2 — Task 1 ships the tool plumbing + the JS-side loader + the wiring update.
  </behavior>
  <action>
1. **Create `tools/i18n/help-content-prompts.ts`:**

```typescript
export const HELP_CONTENT_BRIEF_VERSION = 1;

export const HELP_CONTENT_VERNACULAR_BRIEF = `
You are translating the Help Center body content for a mobile app that records
egocentric video for AI training. Users open Help Center when they have
questions about: how to record, payment timelines, what tasks count, etc.

Rules:
- Translate as a native speaker would say it in casual everyday conversation,
  NOT academically. Use vernacular vocabulary. Avoid loanwords from English
  where a common everyday native word exists.
- PRESERVE MARKDOWN STRUCTURE EXACTLY. Specifically:
  - **bold** markers stay around the translated bold text.
  - *italic* markers stay around the translated italic text.
  - Numbered lists (1. 2. 3.) stay as numbered lists.
  - Bullet lists (- text or * text) stay as bullet lists.
  - # Heading, ## Subheading lines keep their hash markers.
  - [link text](url) — translate "link text" but DO NOT change the url.
  - Code spans \`like this\` stay as code spans.
  - Newlines and paragraph breaks (\\n\\n) stay in the same positions.
- DO NOT translate the "id" field of each accordion — it is a stable identifier.
- DO NOT translate URLs or email addresses inside link markers.
- Output STRICT JSON only, no markdown fences around the JSON itself, no commentary.
`.trim();

export function helpContentUserPromptFor(
  localeName: string,
  enContent: Record<string, unknown>,
): string {
  return `Translate this Help Center content to ${localeName}. Preserve the JSON structure exactly: only the "title" and "body" string values of each accordion get translated. The "id" field is a stable identifier — leave it untouched. Return strict JSON.\n\n${JSON.stringify(enContent, null, 2)}`;
}
```

2. **Create `tools/i18n/help-content-generate.ts`** (mirror task-catalog-generate.ts shape, adapted for the simpler content.json format):

   ````typescript
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

   const MODEL_ID = 'claude-opus-4-7';
   const MAX_TOKENS = 16_000;

   export interface Accordion {
     id: string;
     title: string;
     body: string;
   }

   export interface HelpContent {
     accordions: Accordion[];
   }

   export function validateHelpContentShape(
     en: HelpContent,
     translated: unknown,
   ): { ok: boolean; errors: string[] } {
     const errors: string[] = [];
     if (typeof translated !== 'object' || translated === null) {
       return { ok: false, errors: ['Translated content is not an object'] };
     }
     const t = translated as Record<string, unknown>;
     if (!Array.isArray(t.accordions)) {
       return { ok: false, errors: ['Translated content.accordions is not an array'] };
     }
     const tAccordions = t.accordions as unknown[];
     if (tAccordions.length !== en.accordions.length) {
       errors.push(
         `accordion count mismatch: en=${en.accordions.length} translated=${tAccordions.length}`,
       );
     }
     for (let i = 0; i < Math.min(en.accordions.length, tAccordions.length); i++) {
       const enA = en.accordions[i]!;
       const tA = tAccordions[i] as Record<string, unknown> | null;
       if (!tA || typeof tA !== 'object') {
         errors.push(`accordion[${i}] is not an object`);
         continue;
       }
       if (tA.id !== enA.id)
         errors.push(`accordion[${i}].id mismatch: en='${enA.id}' translated='${tA.id}'`);
       if (typeof tA.title !== 'string') errors.push(`accordion[${i}].title is not a string`);
       if (typeof tA.body !== 'string') errors.push(`accordion[${i}].body is not a string`);
     }
     return { ok: errors.length === 0, errors };
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
     const cleaned = text
       .replace(/^```json\s*\n?/i, '')
       .replace(/\n?```\s*$/i, '')
       .trim();
     const parsed = JSON.parse(cleaned);
     const v = validateHelpContentShape(en, parsed);
     if (!v.ok) {
       throw new Error(
         `[help-content-generate] ${loc} shape errors: ${v.errors.slice(0, 5).join('; ')}`,
       );
     }
     return parsed as HelpContent;
   }

   async function main(): Promise<void> {
     if (!process.env.ANTHROPIC_API_KEY) {
       console.error('[help-content-generate] ANTHROPIC_API_KEY not set');
       process.exit(1);
     }
     const repoRoot = resolve(__dirname, '../..');
     const contentDir = resolve(repoRoot, 'apps/mobile/src/screens/help');
     const enPath = resolve(contentDir, 'content.json');
     const enSrc = readFileSync(enPath, 'utf-8');
     const en = JSON.parse(enSrc) as HelpContent;

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
       JSON.stringify(
         {
           model: MODEL_ID,
           brief_version: HELP_CONTENT_BRIEF_VERSION,
           en_source_sha: createHash('sha256').update(enSrc, 'utf-8').digest('hex'),
           locales_generated: auditEntries,
         },
         null,
         2,
       ) + '\n',
     );

     console.log('[help-content-generate] done.');
   }

   if (require.main === module) void main();
   ````

3. **Update `tools/package.json`** to add the new script:

   ```json
   "scripts": {
     "i18n:generate": "tsx i18n/generate.ts",
     "i18n:validate": "tsx i18n/validate.ts",
     "i18n:task-catalog:generate": "tsx i18n/task-catalog-generate.ts",
     "i18n:help-content:generate": "tsx i18n/help-content-generate.ts"
   }
   ```

4. **Create `apps/mobile/src/screens/help/contentLoader.ts`:**

   ```typescript
   /**
    * Help Center content loader (D-03 + 07-HUMAN-UAT.md G-10).
    *
    * The en source-of-truth lives at content.json (UNCHANGED at MVP).
    * 7 non-English locales each have a sibling content.{locale}.json
    * produced by `pnpm i18n:help-content:generate`.
    *
    * loadHelpContent(locale) selects the right file; falls back to en
    * for unknown locales OR if the locale's file doesn't exist yet.
    */
   import enContent from './content.json';

   // The 7 sibling translated files. If a locale's file doesn't exist yet
   // (e.g. mid-development before plan 07-13 Task 2 runs), import will fail
   // at bundle time — gate with try/catch via dynamic require if the file
   // existence is uncertain.
   //
   // For production: AFTER plan 07-13 Task 2 runs, all 7 files exist and
   // these static imports succeed cleanly.
   //
   // Use static imports for tree-shake-ability:
   import ptContent from './content.pt-BR.json';
   import esContent from './content.es.json';
   import hiContent from './content.hi-IN.json';
   import bnContent from './content.bn-IN.json';
   import taContent from './content.ta-IN.json';
   import teContent from './content.te-IN.json';
   import mrContent from './content.mr-IN.json';

   export type HelpContent = typeof enContent;

   const REGISTRY: Record<string, HelpContent> = {
     en: enContent,
     'pt-BR': ptContent as HelpContent,
     es: esContent as HelpContent,
     'hi-IN': hiContent as HelpContent,
     'bn-IN': bnContent as HelpContent,
     'ta-IN': taContent as HelpContent,
     'te-IN': teContent as HelpContent,
     'mr-IN': mrContent as HelpContent,
   };

   export function loadHelpContent(locale: string): HelpContent {
     const candidate = REGISTRY[locale] ?? REGISTRY.en!;
     // POST-CHECKER-REV (WARNING #3): guard against partial-regen
     // failure mode. If Task 2's LLM regen silently produces an empty
     // accordions array (quota exhausted, prompt error, schema drift),
     // the sibling JSON would render an empty Help Center. Fall back to
     // en in that case so the operator sees content rather than a blank
     // screen.
     if (candidate.accordions.length === 0) return REGISTRY.en!;
     return candidate;
   }
   ```

   **NOTE**: the static imports of `content.{locale}.json` files require those files to exist for the TS compile + RN bundle to succeed. **Task 2 runs the LLM regen which creates these 7 files**. To unblock Task 1's compile in case Task 2 hasn't run yet, the executor stubs the 7 files with `{"accordions":[]}` content as placeholders at Task 1 commit time, then Task 2 overwrites them with real translations. **However**, this introduces a temporary "empty Help Center in non-en locales" state between Task 1 and Task 2 — acceptable since plans 07-11 / 07-12 / 07-13 are independent waves and the executor runs them sequentially per the wave assignment.

   Alternative: skip the static imports + use dynamic require with try/catch. **Pick the static-import approach** because RN's Metro bundler reliably tree-shakes; the stub approach is cleaner.

5. **Stub the 7 sibling files with placeholder content** (Task 2 overwrites):

   ```bash
   for loc in pt-BR es hi-IN bn-IN ta-IN te-IN mr-IN; do
     echo '{"accordions": []}' > "apps/mobile/src/screens/help/content.${loc}.json"
   done
   ```

   Document in the file header comment that these are stubs awaiting LLM regen.

6. **Modify `apps/mobile/src/screens/help/HelpCenterScreen.tsx`:**

   Find the `import content from './content.json'` line (or equivalent). Replace with:

   ```typescript
   import { useTranslation } from 'react-i18next'; // already present per 07-05 sweep
   import { loadHelpContent } from './contentLoader';
   ```

   Inside the component body, replace direct use of `content` with:

   ```typescript
   const { i18n } = useTranslation(); // or extend the existing destructure
   const content = loadHelpContent(i18n.language);
   ```

   The downstream JSX that maps over `content.accordions` is unchanged. The 4 existing `t('help.contactSupport')` etc. calls are unchanged.

7. **Create `tools/i18n/__tests__/help-content-generate.test.ts`** with the validator unit tests (no LLM calls):

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { validateHelpContentShape, type HelpContent } from '../help-content-generate';

   const sampleEn: HelpContent = {
     accordions: [
       { id: 'instructions-guide', title: 'Instructions Guide', body: 'How to record...' },
       { id: 'payments', title: 'Payments', body: 'Your earnings...' },
     ],
   };

   describe('validateHelpContentShape', () => {
     it('rejects when accordions count differs', () => {
       const v = validateHelpContentShape(sampleEn, { accordions: [sampleEn.accordions[0]] });
       expect(v.ok).toBe(false);
       expect(v.errors.find((e) => /count mismatch/.test(e))).toBeDefined();
     });

     it('rejects when an accordion id differs', () => {
       const v = validateHelpContentShape(sampleEn, {
         accordions: [{ id: 'WRONG', title: 'X', body: 'Y' }, sampleEn.accordions[1]],
       });
       expect(v.ok).toBe(false);
       expect(v.errors.find((e) => /id mismatch/.test(e))).toBeDefined();
     });

     it('rejects when a title is not a string', () => {
       const v = validateHelpContentShape(sampleEn, {
         accordions: [{ id: 'instructions-guide', title: 42, body: 'X' }, sampleEn.accordions[1]],
       });
       expect(v.ok).toBe(false);
     });

     it('accepts a well-shaped translated catalog', () => {
       const v = validateHelpContentShape(sampleEn, {
         accordions: [
           { id: 'instructions-guide', title: 'निर्देश गाइड', body: 'रिकॉर्ड कैसे करें...' },
           { id: 'payments', title: 'भुगतान', body: 'आपकी कमाई...' },
         ],
       });
       expect(v.ok).toBe(true);
     });

     it('rejects non-object input', () => {
       const v = validateHelpContentShape(sampleEn, 'not an object');
       expect(v.ok).toBe(false);
     });
   });
   ```

8. **Create `apps/mobile/src/screens/help/__tests__/contentLoader.test.ts`:**

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { loadHelpContent } from '../contentLoader';
   import enContent from '../content.json';

   describe('loadHelpContent', () => {
     it("returns the en content for locale 'en'", () => {
       const c = loadHelpContent('en');
       expect(c).toEqual(enContent);
     });

     it('returns a typed HelpContent (with accordions) for a non-en locale', () => {
       const c = loadHelpContent('hi-IN');
       expect(c).toBeDefined();
       expect(Array.isArray(c.accordions)).toBe(true);
     });

     it('falls back to en for an unknown locale', () => {
       const c = loadHelpContent('xx-YY');
       expect(c).toEqual(enContent);
     });
   });
   ```

9. **Run the test suites:**

   ```bash
   cd tools && pnpm test 2>&1 | tail -10
   set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -15
   ```

   Both exit 0.

10. **Run a smoke build** to confirm the placeholder content + static imports compile cleanly:

    ```bash
    cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug 2>&1 | tail -10
    ```

    BUILD SUCCESSFUL.

11. **Invariant checks** (same as preceding plans).
    </action>
    <verify>
    <automated>cd tools && pnpm test 2>&1 | tail -10</automated>
    </verify>
    <acceptance_criteria> - `test -f tools/i18n/help-content-generate.ts && test -f tools/i18n/help-content-prompts.ts && test -f tools/i18n/__tests__/help-content-generate.test.ts` all exist. - `grep -c 'i18n:help-content:generate' tools/package.json` returns at least 1. - `test -f apps/mobile/src/screens/help/contentLoader.ts` exists. - All 7 sibling stub files exist: `for loc in pt-BR es hi-IN bn-IN ta-IN te-IN mr-IN; do test -f "apps/mobile/src/screens/help/content.${loc}.json"; done` → exit 0 (each test succeeds). - `grep -c 'loadHelpContent' apps/mobile/src/screens/help/HelpCenterScreen.tsx` returns at least 1. - `grep -c "import content from './content.json'" apps/mobile/src/screens/help/HelpCenterScreen.tsx` returns 0 (the static import is removed; loader replaces it). - POST-CHECKER-REV (WARNING #3): `grep -c "accordions.length === 0" apps/mobile/src/screens/help/contentLoader.ts` returns at least 1 (the empty-accordions guard MUST be present so a partial-regen failure mode falls back to en, not a blank Help Center). - POST-CHECKER-REV (WARNING #3): `contentLoader.test.ts` includes at least one test case named with `empty\|fallback` that asserts a locale with `accordions: []` returns `enContent.accordions` (proves the guard is exercised, not just present). - `git diff --stat apps/mobile/src/screens/help/content.json` returns empty (en source NOT modified). - `git diff --stat apps/mobile/src/screens/help/markdown.tsx` returns empty (markdown renderer NOT modified). - Both test suites exit 0. - APK build BUILD SUCCESSFUL. - All 4 invariant gates green (iOS / migrations / Phase-6 cosmetic / Android). - `git diff --stat apps/mobile/src/i18n/locales/ apps/mobile/src/i18n/taskCatalog.i18n.ts` empty (plan 07-11 / 07-12 scope; not touched here).
    </acceptance_criteria>
    <done>Help-Center regen tool built + tested at the unit level; contentLoader.ts ships; HelpCenterScreen.tsx wired to load by locale; placeholder sibling files exist so the build is green pending Task 2's LLM regen.</done>
    </task>

<task type="auto">
  <name>Task 2: Run the LLM regen → all 7 locales' Help Center content translated → committed + audit sidecar</name>
  <files>apps/mobile/src/screens/help/content.pt-BR.json, apps/mobile/src/screens/help/content.es.json, apps/mobile/src/screens/help/content.hi-IN.json, apps/mobile/src/screens/help/content.bn-IN.json, apps/mobile/src/screens/help/content.ta-IN.json, apps/mobile/src/screens/help/content.te-IN.json, apps/mobile/src/screens/help/content.mr-IN.json, apps/mobile/src/screens/help/content.audit.json</files>
  <read_first>
    - tools/i18n/help-content-generate.ts (the entrypoint from Task 1)
    - apps/mobile/src/screens/help/content.json (the en source-of-truth)
    - apps/mobile/src/screens/help/contentLoader.ts (the consumer)
  </read_first>
  <behavior>
    - Run `pnpm i18n:help-content:generate`. The tool calls Claude Opus 4.7 7 times, validates each response (accordion count matches en, IDs match en, title/body are strings), and overwrites each sibling stub file with the translated content.
    - The audit sidecar at `content.audit.json` records LLM model + brief version + en_source_sha + per-locale completion timestamps.
    - Markdown structure preserved: a spot-check on hi-IN confirms that `**bold**` markers in the en source still appear in the hi-IN translated body (the bold text inside is translated, but the `**` markers stay).
    - URLs preserved: a spot-check confirms `mailto:...` and `https://...` URLs in en survive byte-identically in the translated bodies.
  </behavior>
  <action>
1. **Run the regen:**

```bash
pnpm i18n:help-content:generate 2>&1 | tee /tmp/07-13-regen.log
```

Expected: 7 lines `[help-content-generate] {locale}: OK ({N} accordions)`.

2. **Spot-check the hi-IN translation** for markdown preservation:

   ```bash
   # Confirm bold markers survived
   grep -c '\*\*' apps/mobile/src/screens/help/content.hi-IN.json
   grep -c '\*\*' apps/mobile/src/screens/help/content.json
   # The two counts should be within ±2 of each other (LLM may inadvertently add/drop a marker; flag if drift > 2)

   # Confirm Devanagari script present
   grep -cE '[ऀ-ॿ]' apps/mobile/src/screens/help/content.hi-IN.json  # at least 100 Devanagari chars
   ```

3. **Spot-check URL preservation:**

   ```bash
   # If content.json has any mailto: or https:// URLs, count them in en + each sibling
   grep -c 'https://\|mailto:' apps/mobile/src/screens/help/content.json
   grep -c 'https://\|mailto:' apps/mobile/src/screens/help/content.hi-IN.json
   # Should match exactly
   ```

4. **Verify the audit sidecar:**

   ```bash
   test -f apps/mobile/src/screens/help/content.audit.json && jq '.locales_generated, .en_source_sha' apps/mobile/src/screens/help/content.audit.json
   ```

5. **Run the test suite:**

   ```bash
   set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -15
   ```

   Exit 0. The contentLoader test from Task 1 should now actually exercise the Devanagari content via `loadHelpContent('hi-IN')`.

6. **Run a smoke APK build:**

   ```bash
   cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug 2>&1 | tail -10
   ```

   BUILD SUCCESSFUL — the regenerated files bundle into the APK.

7. **Invariant checks** (same gates as preceding plans).
   </action>
   <verify>
   <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -10</automated>
   </verify>
   <acceptance_criteria> - All 7 sibling `content.{locale}.json` files have `accordions.length === content.json.accordions.length` (jq compare). - `apps/mobile/src/screens/help/content.audit.json` exists with 7 locales. - hi-IN content contains > 100 Devanagari characters (grep with regex). - URL count in hi-IN equals URL count in en (markdown link preservation). - Bold marker count (`**`) in hi-IN within ±2 of en count. - `git diff --stat apps/mobile/src/screens/help/content.json` empty (en source unchanged). - `git diff --stat apps/mobile/src/screens/help/markdown.tsx` empty. - All 4 invariant gates green. - Test suite + APK build green.
   </acceptance_criteria>
   <done>7 sibling content files contain real LLM translations; markdown + URL preservation confirmed; audit sidecar committed. G-10 closed at the code level pending the operator's §2/§7 re-walk in plan 07-15.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                               | Description                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| LLM-translated help content → user-facing app guidance | The Help Center informs users about recording / payments / troubleshooting. Hallucinated content could mis-inform. |
| Markdown markers preservation                          | Bold/italic/list markers carry semantic meaning; loss/drift produces broken rendering.                             |

## STRIDE Threat Register

| Threat ID  | Category               | Component                         | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------- | --------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-13-01 | Tampering              | LLM hallucination in help content | mitigate    | `validateHelpContentShape` enforces accordion-count + ID match + type correctness. Per-locale review deferred to §v2 per CONTEXT.md "Deferred Ideas". The operator's §2 re-walk in plan 07-15 is the human-in-the-loop check.                                                                     |
| T-07-13-02 | Tampering              | Markdown marker drift             | accept      | The vernacular brief explicitly instructs markdown preservation; the LLM has shown high fidelity on similar tasks in plans 07-02 + 07-12. Spot-check at audit time covers the failure mode. Worst case: markdown.tsx falls back to rendering the literal `**` as text (degraded UX, not a crash). |
| T-07-13-03 | Tampering              | URL drift in `[link](url)`        | mitigate    | Spot-check at audit time compares URL count in en vs each translated file; the LLM's structured-output brief explicitly forbids URL changes.                                                                                                                                                      |
| T-07-13-04 | Information Disclosure | Help content body                 | accept      | Public copy; no secrets, no PII.                                                                                                                                                                                                                                                                  |

</threat_model>

<verification>
1. `cd tools && pnpm test` exits 0.
2. `pnpm -r --parallel test --filter "@humyn/mobile"` exits 0.
3. `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` BUILD SUCCESSFUL.
4. `apps/mobile/src/screens/help/content.audit.json` exists with 7 locales.
5. hi-IN content body has Devanagari script + preserved markdown markers.
6. All 4 invariant gates green.
</verification>

<success_criteria>

- G-10 (Help Center body in English) closed at code level.
- D-03 (Help Center body fully translates) actually fulfilled at runtime.
- Markdown structure preserved across translations.
- LLM regen tool repeatable.
- Plans 07-11 / 07-12 / 07-13 produce independent diffs (no file conflicts; wave-parallel-safe).
- All invariants green.
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-13-SUMMARY.md` documenting:
- Per-locale accordion count + markdown-marker count parity.
- The 4 chrome `t()` calls in HelpCenterScreen confirmed unchanged.
- A 3-sentence sample from hi-IN body + en body for sanity.
- Pointer to plan 07-15 §2 + §help-walk for the operator's hardware re-walk.
</output>
