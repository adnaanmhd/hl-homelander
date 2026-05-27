---
phase: 07-multi-linguality-live-cam-feed
plan: 12
type: execute
wave: 2
depends_on: [06, 11]
files_modified:
  - tools/i18n/task-catalog-generate.ts
  - tools/i18n/task-catalog-prompts.ts
  - tools/i18n/__tests__/task-catalog-generate.test.ts
  - tools/package.json
  - apps/mobile/src/i18n/taskCatalog.i18n.ts
  - apps/mobile/src/i18n/__tests__/taskCatalog.body.test.ts
autonomous: true
gap_closure: true
requirements: [I18N-01, I18N-10]
tags: [i18n, llm, tools, taskCatalog, gap-closure]
must_haves:
  truths:
    - 'G-08 closed: a hi-IN (or any non-en) user opening TasksScreen sees task names + categories + descriptions + instructions + examples for all 77 catalog entries rendered in the active locale (NOT English-skeleton).'
    - '`apps/mobile/src/i18n/taskCatalog.i18n.ts` no longer carries identical English values across `en` and the 7 non-English locale slots for any task entry; each non-English slot has locale-appropriate translations of `name`, `description`, `instructions[]`, and `examples[]` (D-01 — full body translates, not just name).'
    - "Reverse-search Stage 1 + Stage 2 (per D-14, D-15) is now functionally meaningful: `reverseSearch('चाय बनाओ', 'hi-IN')` returns the canonical English task name (Stage 1 full-string match), not the input as-is."
    - "TaskDetailsSheet in hi-IN renders the full body in Devanagari (D-01 + the operator's §6 walk acceptance row)."
    - 'A new tool entrypoint `tools/i18n/task-catalog-generate.ts` is added (sibling to `tools/i18n/generate.ts` from plan 07-02) so the task-catalog body regen is repeatable: `pnpm i18n:task-catalog:generate` re-runs the 7-locale full-body translation pass.'
    - 'The tool uses Claude Opus 4.7 (per D-10) with a task-catalog-specific system prompt that preserves the JSON shape `Record<TaskName, Record<Locale, TaskBody>>` and translates `name` / `description` / `instructions[]` / `examples[]` per locale per task; the canonical English `en` slot stays byte-identical to the existing source (the LLM does NOT translate `en` entries).'
    - 'Token-fallback reverse-map (Stage 2) — the `buildReverseMaps` function (existing at taskCatalog.i18n.ts:5267) is UNCHANGED; the upstream catalog body is what feeds it real data.'
    - 'No backend change (D-16): `apps/api/drizzle/migrations/` count unchanged; `/tasks/search` is unchanged.'
    - "Owner-approved scope: ALL 77 catalog entries get translated across 7 non-English locales (NOT a sub-set). The original plan 07-06 SUMMARY documented 7 skeleton entries; the operator's §6 walk evidence shows the skeleton-English state actually covers ALL 77 entries — so this plan absorbs the full body."
    - 'iOS untouched (I18N-21); no DB migration (D-16); Phase-6 cosmetic-gaps untouched (I18N-11); ultrawide lens code untouched; HevcEncoder / FinalizeWorker / MetadataComposer untouched.'
  artifacts:
    - path: tools/i18n/task-catalog-generate.ts
      provides: 'LLM regen tool for the 77-task body translation; reads taskCatalog.i18n.ts, calls Claude Opus 4.7 7 times (one per non-English locale), writes the result back into taskCatalog.i18n.ts via codegen'
      contains: 'TASK_CATALOG_I18N'
    - path: tools/i18n/task-catalog-prompts.ts
      provides: 'System prompt + per-locale user prompt for the task-catalog regen (separate from the screen-string prompts in tools/i18n/prompts.ts because the task body has different style constraints: must remain actionable instructions, not marketing copy)'
      contains: 'VERNACULAR_BRIEF'
    - path: apps/mobile/src/i18n/taskCatalog.i18n.ts
      provides: "TASK_CATALOG_I18N const with all 7 non-English locale slots fully translated for all 77 tasks (no English-skeleton entries except where the LLM legitimately can't translate, e.g. proper-noun task names — flagged in the audit sidecar)"
      contains: 'hi-IN'
    - path: apps/mobile/src/i18n/__tests__/taskCatalog.body.test.ts
      provides: 'Vitest assertions that for every task entry, the hi-IN.name differs from en.name (or is explicitly noted as a proper-noun carve-out in a const allowlist)'
      contains: 'TASK_CATALOG_I18N'
  key_links:
    - from: tools/i18n/task-catalog-generate.ts
      to: apps/mobile/src/i18n/taskCatalog.i18n.ts
      via: 'Read existing TASK_CATALOG_I18N en entries; LLM translate; codegen the full file'
      pattern: 'TASK_CATALOG_I18N'
    - from: apps/mobile/src/services/tasksApi.ts
      to: apps/mobile/src/i18n/reverseSearch.ts
      via: 'reverseSearch(q, i18n.language) — uses the rebuilt REVERSE_BY_LOCALE which derives from TASK_CATALOG_I18N at module load'
      pattern: 'REVERSE_BY_LOCALE'
---

<objective>
Close G-08 from `07-HUMAN-UAT.md`. Investigation of `apps/mobile/src/i18n/taskCatalog.i18n.ts` confirms the gap is the **catalog body itself**, not the call-site wiring:

- The file has 5305 LOC across 77 task entries.
- For EVERY task entry, the `'pt-BR'` / `'es'` / `'hi-IN'` / `'bn-IN'` / `'ta-IN'` / `'te-IN'` / `'mr-IN'` slots carry **identical English values** for `name` / `description` / `instructions[]` / `examples[]` as the `en` slot.
- Plan 07-06 SUMMARY documented this as "7 skeleton-English carve-outs" — investigation shows the scope is actually ALL 77 entries (the SUMMARY's documentation was incomplete).
- The reverse-search 3-stage chain (`apps/mobile/src/i18n/reverseSearch.ts`) is correctly WIRED — Stage 1 / Stage 2 / Stage 3 logic is intact — but with an English-only catalog body, Stage 1 will only match if the user types the English task name verbatim. The operator's `'चाय बनाओ' → 'Make tea'` walk fails because the hi-IN slot for "Make tea" contains the English string, not `चाय बनाओ`.

This plan ships an LLM regen tool extension (sibling to plan 07-02's `tools/i18n/generate.ts`) that translates the full body — `name` / `description` / `instructions[]` / `examples[]` — for all 77 tasks across 7 non-English locales. The output is committed into `apps/mobile/src/i18n/taskCatalog.i18n.ts` via the tool's codegen (the file is regenerated, not hand-edited).

**Owner-confirmation gate:** the original Phase 7 plan 07-06 SUMMARY scoped the task-catalog regen as a "follow-on tool" deferred from Phase 7. The operator's hi-IN walk (G-08 evidence) explicitly demands this be closed for Phase 7 sign-off. This plan absorbs the previously-deferred scope. CONTEXT.md D-15 + the §v1 deferral are both unchanged; the SPEC.md I18N-10 acceptance criterion ("reverse-search reaches the localized task name") is now actually achievable on hardware.

**Non-negotiable invariants:**

- `git diff --stat apps/mobile/ios/` MUST remain empty (I18N-21).
- `git diff --stat apps/api/drizzle/migrations/` MUST remain empty (D-16).
- `06-COSMETIC-GAPS.md` MUST remain untouched (I18N-11).
- `git diff --stat apps/mobile/android/` MUST remain empty (no Android changes in this plan).
- The canonical English `en` slot for every task in TASK_CATALOG_I18N is **byte-identical** to its current value post-regen (the LLM is instructed NOT to touch `en` entries; the regen tool verifies this).
- The `buildReverseMaps` function at line 5267 + the `REVERSE_BY_LOCALE` export at line 5305 are UNCHANGED (only the catalog data changes; the derivation logic is intact).
- The `tools/i18n/generate.ts` from plan 07-02 (screen-string regen) is UNCHANGED — this plan adds a sibling tool, doesn't modify the existing one.
- The 24 new en.json keys from plan 07-11 are NOT touched by this plan.
- The Help Center body (`apps/mobile/src/screens/help/content.json`) is NOT touched — that's plan 07-13's scope.

Output: a `hi-IN`-active build where TasksScreen renders 77 translated task names, TaskDetailsSheet renders full Hindi bodies, and reverse-search Stage 1 actually surfaces results from typed Hindi queries.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-06-tts-fallback-and-reverse-search-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-06-SUMMARY.md
@apps/mobile/src/i18n/taskCatalog.i18n.ts
@apps/mobile/src/i18n/reverseSearch.ts
@apps/mobile/src/services/tasksApi.ts
@tools/i18n/generate.ts
@tools/i18n/prompts.ts
@tools/i18n/locale-config.ts
@tools/i18n/validate.ts
@tools/package.json
@CLAUDE.md
task-taxonomy.md

<interfaces>
<!-- The existing public surfaces this plan extends — not modifies. -->

From apps/mobile/src/i18n/taskCatalog.i18n.ts (existing — lines 43-56):

```typescript
export type Locale = 'en' | 'pt-BR' | 'es' | 'hi-IN' | 'bn-IN' | 'ta-IN' | 'te-IN' | 'mr-IN';

export interface TaskBody {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}

export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {
  'Cooking a meal': { en: {...}, 'pt-BR': {...} /* skeleton-English today */, /* ...7 locales */ },
  // ... 77 task entries
};
```

Current state (for ALL 77 tasks):

```typescript
'Cooking a meal': {
  en: { name: 'Cooking a meal', description: '...', instructions: [...], examples: [] },
  'pt-BR': { name: 'Cooking a meal' /* skeleton */, description: '...' /* skeleton */, ... },
  // ... 7 locale slots ALL holding English-skeleton values today
}
```

Target state after this plan:

```typescript
'Cooking a meal': {
  en: { name: 'Cooking a meal', description: '...', instructions: [...], examples: [] },
  'pt-BR': { name: 'Preparar uma refeição', description: '...', ... },
  'es': { name: 'Preparar una comida', description: '...', ... },
  'hi-IN': { name: 'खाना बनाना', description: '...', ... },
  'bn-IN': { name: 'খাবার রান্না', description: '...', ... },
  // ... etc; each slot has authentic translations
}
```

From apps/mobile/src/i18n/reverseSearch.ts (existing — UNCHANGED by this plan):

```typescript
export function reverseSearch(input: string, locale: string): string {
  // Stage 1: full-string lookup via REVERSE_BY_LOCALE[locale].fullStringMap
  // Stage 2: token-fallback via REVERSE_BY_LOCALE[locale].tokenMap
  // Stage 3: passthrough (return input as-is)
}
```

From apps/mobile/src/i18n/taskCatalog.i18n.ts (existing — lines 5267-5305 — UNCHANGED):

```typescript
export function buildReverseMaps(catalog: typeof TASK_CATALOG_I18N): Record<string, ReverseMap> {
  // Derives fullStringMap + tokenMap from TASK_CATALOG_I18N at module load
}
export const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);
```

The deriver is correct; it just receives English-skeleton input today. Once this plan ships real translations, Stage 1 + Stage 2 become meaningful.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build the task-catalog LLM regen tool — `tools/i18n/task-catalog-generate.ts` + `task-catalog-prompts.ts` + unit test scaffolding</name>
  <files>tools/i18n/task-catalog-generate.ts, tools/i18n/task-catalog-prompts.ts, tools/i18n/__tests__/task-catalog-generate.test.ts, tools/package.json</files>
  <read_first>
    - tools/i18n/generate.ts (the screen-string regen — the structural analog; this new tool mirrors its shape but reads/writes taskCatalog.i18n.ts instead of locales/*.json)
    - tools/i18n/prompts.ts (the existing VERNACULAR_BRIEF + userPromptFor — adapt for task-catalog style)
    - tools/i18n/locale-config.ts (TARGET_LOCALES + LOCALE_NAMES exports — reuse as-is)
    - tools/i18n/validate.ts (the existing shape-parity validator — we adapt the approach for task-catalog body shape)
    - tools/package.json (add the new `i18n:task-catalog:generate` script entry)
    - apps/mobile/src/i18n/taskCatalog.i18n.ts (the existing structure — confirm how 77 entries are laid out across 8 locale slots; the new tool reads this file's `en` slots as input and writes back the full file)
    - task-taxonomy.md (the 65-task source — confirm if the 77 entries in TASK_CATALOG_I18N include some extras vs the SPEC's 65; either way, treat ALL entries in the file as the canonical scope, per the operator's hi-IN walk)
  </read_first>
  <behavior>
    - `tools/i18n/task-catalog-prompts.ts` exports `TASK_VERNACULAR_BRIEF` (a system prompt distinct from the screen-string one — emphasizes "actionable instructions, not marketing copy"; "preserve the JSON structure exactly — `name` is a single string, `description` is a single string, `instructions` is an array of 1-5 strings, `examples` is an array of 0-N strings; translate each string value but DO NOT touch the en slot") and `taskCatalogUserPromptFor(localeName, enCatalog)` (the user-side prompt that asks the LLM to produce a Record<TaskName, TaskBody> for a single locale).
    - `tools/i18n/task-catalog-generate.ts` exports `generateTaskCatalogLocale(client, loc, enCatalog)` (mirrors the screen-string `generateLocale`) and a `main()` that:
      1. Imports TASK_CATALOG_I18N from `apps/mobile/src/i18n/taskCatalog.i18n.ts` (or — to avoid bundler-eval overhead — parses the file via a small AST/regex extractor to pull the `en` slots).
      2. Builds an `en-only` catalog: `{ [taskName]: TaskBody (en slot only) }` to send as input to the LLM (the LLM doesn't need the other 7 slots — they're being overwritten).
      3. Iterates over the 7 non-English locales sequentially. For each, calls Claude Opus 4.7 with `TASK_VERNACULAR_BRIEF` as system + `taskCatalogUserPromptFor(localeName, enOnlyCatalog)` as user.
      4. Parses the LLM response (full JSON for the locale), validates the shape via a new `validateTaskCatalogShape(en, translated)` helper (asserts each task name in `en` exists in the translated, asserts `name` is a string, `description` is a string, `instructions` and `examples` are arrays of strings).
      5. Stores the 7 successful responses in memory.
      6. **Code-generates the new `taskCatalog.i18n.ts`** by reading the existing file, splicing in the new locale slots for each task entry. Use a robust approach: parse the existing file as TypeScript via `ts.createSourceFile`, walk the AST, find the `TASK_CATALOG_I18N` ObjectLiteralExpression, and replace each task's non-`en` slot with the LLM output. Pretty-print the result with the same indentation pattern as the original.

         **Alternative (simpler, more brittle)** if AST surgery proves heavy: regenerate the file from a template — read the `en` slots (they're the source of truth), build the full Record in memory in JS, and write a hand-crafted `taskCatalog.i18n.ts` file that preserves the docstring header (lines 1-56), the type/interface declarations, the `buildReverseMaps` function (lines 5267-5305), and only the data-payload between gets regenerated. The header / types / `buildReverseMaps` / `REVERSE_BY_LOCALE` exports are static text the tool emits verbatim.
      7. Writes an audit sidecar: `apps/mobile/src/i18n/taskCatalog.audit.json` capturing `{ model, generated_at, brief_version, en_source_sha, locales_generated: [...] }`.
    - The tool is invokable via `pnpm i18n:task-catalog:generate` (a new entry in `tools/package.json` `scripts`).
    - The unit test in `tools/i18n/__tests__/task-catalog-generate.test.ts` covers `validateTaskCatalogShape` (does NOT call the LLM — too expensive for CI). Tests:
      - `it('rejects when a task name in en is missing from translated')`
      - `it('rejects when name is not a string')`
      - `it('rejects when instructions is not an array')`
      - `it('rejects when examples is missing')`
      - `it('accepts a well-shaped translated catalog')`
      - `it('does NOT touch the en slot when given an en input')`
    - The actual end-to-end LLM call is a manual run (`pnpm i18n:task-catalog:generate`) in Task 2 — Task 1 is just the tool plumbing + scaffolding.

  </behavior>
  <action>
1. **Create `tools/i18n/task-catalog-prompts.ts`** with the task-catalog-specific vernacular brief:

```typescript
export const TASK_CATALOG_BRIEF_VERSION = 1;

export const TASK_VERNACULAR_BRIEF = `
You are translating a catalog of everyday task instructions for a mobile app
that records egocentric (head-mounted) video of users performing daily tasks.
The translated text appears on TaskDetailsSheet — users open this sheet
immediately before recording the task.

Rules:
- Translate as a native speaker would say it in casual everyday conversation,
  NOT academically. Use vernacular vocabulary. Avoid loanwords from English
  where a common everyday native word exists.
- Preserve the JSON structure EXACTLY: the response is a Record<TaskName, TaskBody>
  where TaskBody = { name: string; description: string; instructions: string[]; examples: string[] }.
- Do NOT change the top-level keys — they are the canonical English task names
  used as object keys in the TypeScript file. Only translate the VALUES.
- Instructions must remain actionable second-person commands (e.g.
  "Look down at your work area." → "अपने काम की जगह की ओर देखें।" in hi-IN).
- Examples may be empty arrays — preserve them as-is if so.
- Output STRICT JSON only, no markdown fences, no commentary.
`.trim();

export function taskCatalogUserPromptFor(
  localeName: string,
  enCatalog: Record<string, unknown>,
): string {
  return `Translate this task catalog to ${localeName}. Keep the JSON structure exactly as given; translate string VALUES only. Return strict JSON.\n\n${JSON.stringify(enCatalog, null, 2)}`;
}
```

2. **Create `tools/i18n/task-catalog-generate.ts`** mirroring the structure of `tools/i18n/generate.ts`:

   ````typescript
   /**
    * Task-catalog regen per D-01, D-10, D-11, D-15 + 07-HUMAN-UAT.md G-08.
    *
    * Reads en-slots from apps/mobile/src/i18n/taskCatalog.i18n.ts, calls Claude
    * Opus 4.7 7 times (one per non-English locale), writes the regenerated
    * taskCatalog.i18n.ts back with all 8 locale slots populated for all 77 tasks.
    *
    * Run with `pnpm i18n:task-catalog:generate` AFTER plan 07-11's screen-string
    * regen stabilizes (so the locale-set in taskCatalog matches the screen-string
    * catalogs).
    */
   import Anthropic from '@anthropic-ai/sdk';
   import { readFileSync, writeFileSync } from 'node:fs';
   import { createHash } from 'node:crypto';
   import { resolve } from 'node:path';
   import { TARGET_LOCALES, LOCALE_NAMES, type TargetLocale } from './locale-config.js';
   import {
     TASK_VERNACULAR_BRIEF,
     TASK_CATALOG_BRIEF_VERSION,
     taskCatalogUserPromptFor,
   } from './task-catalog-prompts.js';

   const MODEL_ID = 'claude-opus-4-7';
   const MAX_TOKENS = 32_000; // 77 tasks × ~120 tokens each + headroom

   export interface TaskBody {
     name: string;
     description: string;
     instructions: string[];
     examples: string[];
   }

   export type TaskCatalogShape = Record<string, Record<string, TaskBody>>;

   /** Validates that the LLM-output shape conforms to TaskBody for every task. */
   export function validateTaskCatalogShape(
     enCatalog: Record<string, TaskBody>,
     translated: unknown,
   ): { ok: boolean; errors: string[] } {
     const errors: string[] = [];
     if (typeof translated !== 'object' || translated === null) {
       return { ok: false, errors: ['Translated catalog is not an object'] };
     }
     const t = translated as Record<string, unknown>;
     for (const taskName of Object.keys(enCatalog)) {
       const body = t[taskName];
       if (!body) {
         errors.push(`Missing task '${taskName}'`);
         continue;
       }
       if (typeof body !== 'object' || body === null) {
         errors.push(`Task '${taskName}' body is not object`);
         continue;
       }
       const b = body as Record<string, unknown>;
       if (typeof b.name !== 'string') errors.push(`Task '${taskName}'.name is not a string`);
       if (typeof b.description !== 'string')
         errors.push(`Task '${taskName}'.description is not a string`);
       if (!Array.isArray(b.instructions))
         errors.push(`Task '${taskName}'.instructions is not an array`);
       else if (!(b.instructions as unknown[]).every((s) => typeof s === 'string'))
         errors.push(`Task '${taskName}'.instructions has non-string elements`);
       if (!Array.isArray(b.examples)) errors.push(`Task '${taskName}'.examples is not an array`);
       else if (!(b.examples as unknown[]).every((s) => typeof s === 'string'))
         errors.push(`Task '${taskName}'.examples has non-string elements`);
     }
     return { ok: errors.length === 0, errors };
   }

   export async function generateTaskCatalogLocale(
     client: Anthropic,
     loc: TargetLocale,
     enCatalog: Record<string, TaskBody>,
   ): Promise<Record<string, TaskBody>> {
     const response = await client.messages.create({
       model: MODEL_ID,
       max_tokens: MAX_TOKENS,
       system: TASK_VERNACULAR_BRIEF,
       messages: [
         { role: 'user', content: taskCatalogUserPromptFor(LOCALE_NAMES[loc], enCatalog) },
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
     const v = validateTaskCatalogShape(enCatalog, parsed);
     if (!v.ok) {
       throw new Error(
         `[task-catalog-generate] ${loc} shape errors: ${v.errors.slice(0, 5).join('; ')}`,
       );
     }
     return parsed as Record<string, TaskBody>;
   }

   async function main(): Promise<void> {
     if (!process.env.ANTHROPIC_API_KEY) {
       console.error(
         '[task-catalog-generate] ANTHROPIC_API_KEY not set. Create tools/.env from tools/.env.example and re-run.',
       );
       process.exit(1);
     }

     const repoRoot = resolve(__dirname, '../..');
     const catalogPath = resolve(repoRoot, 'apps/mobile/src/i18n/taskCatalog.i18n.ts');
     const catalogSrc = readFileSync(catalogPath, 'utf-8');

     // Extract the en-only catalog by:
     // 1. Importing the compiled module (via dynamic import OR ts-node) — but this is heavy in a tools/ context.
     // 2. SIMPLER: regex-parse the file to find the TASK_CATALOG_I18N const and extract via an in-process JSON evaluation
     //    of just the data block. We'll use approach 2 + a known fragile-but-controlled extractor.
     // For robustness, executor should use a TS-based AST walker (ts.createSourceFile + visit) — implement here.

     // ... AST walker reads en slots → buildEnOnlyCatalog: Record<string, TaskBody>
     // ... (executor implements; this is the only non-trivial bit)
     const enOnlyCatalog = extractEnSlots(catalogSrc); // helper to be implemented

     const client = new Anthropic();
     const generated: Record<string, Record<string, TaskBody>> = {};
     for (const loc of TARGET_LOCALES) {
       console.log(`[task-catalog-generate] ${loc}: calling Claude Opus 4.7...`);
       try {
         generated[loc] = await generateTaskCatalogLocale(client, loc, enOnlyCatalog);
         console.log(
           `[task-catalog-generate] ${loc}: OK (${Object.keys(generated[loc]).length} tasks)`,
         );
       } catch (e) {
         console.error(`[task-catalog-generate] ${loc}: FAILED —`, (e as Error).message);
         console.error(`[task-catalog-generate] aborting; fix prompt or re-run`);
         process.exit(1);
       }
     }

     // Rebuild the file: emit the header + types + TASK_CATALOG_I18N const with all 8 slots filled,
     // then re-append the buildReverseMaps function + REVERSE_BY_LOCALE export verbatim.
     const newFile = renderCatalogFile(catalogSrc, enOnlyCatalog, generated);
     writeFileSync(catalogPath, newFile);

     // Audit sidecar
     const auditPath = resolve(repoRoot, 'apps/mobile/src/i18n/taskCatalog.audit.json');
     writeFileSync(
       auditPath,
       JSON.stringify(
         {
           model: MODEL_ID,
           generated_at: new Date().toISOString(),
           brief_version: TASK_CATALOG_BRIEF_VERSION,
           en_source_sha: createHash('sha256').update(catalogSrc, 'utf-8').digest('hex'),
           locales_generated: TARGET_LOCALES,
           tasks_translated: Object.keys(enOnlyCatalog).length,
         },
         null,
         2,
       ) + '\n',
     );

     console.log(
       `[task-catalog-generate] done — ${Object.keys(enOnlyCatalog).length} tasks × 7 locales committed.`,
     );
   }

   // Helpers (executor implements per the action steps):
   declare function extractEnSlots(catalogSrc: string): Record<string, TaskBody>;
   declare function renderCatalogFile(
     originalSrc: string,
     en: Record<string, TaskBody>,
     generated: Record<string, Record<string, TaskBody>>,
   ): string;

   if (require.main === module) {
     void main();
   }
   ````

   **Implementation note for the executor:** the `extractEnSlots` + `renderCatalogFile` helpers are the load-bearing engineering. Use the TypeScript compiler API (`import * as ts from 'typescript'`) — `ts.createSourceFile` + `ts.forEachChild` to walk the AST. Identify the `TASK_CATALOG_I18N` ObjectLiteralExpression, iterate its PropertyAssignment children, extract the `en` slot per task as a TaskBody. For rendering, EITHER (a) modify the AST in place and pretty-print via `ts.createPrinter`, OR (b) string-template the new file by reading the lines BEFORE the const opening + lines AFTER the const closing from `originalSrc`, then emit a hand-formatted Object literal for the new data block. Approach (b) is simpler and the format is well-known — 4 spaces indent, single quotes, trailing commas in objects.

3. **Update `tools/package.json`** to add the new script:

   ```json
   {
     "scripts": {
       "i18n:generate": "tsx i18n/generate.ts",
       "i18n:validate": "tsx i18n/validate.ts",
       "i18n:task-catalog:generate": "tsx i18n/task-catalog-generate.ts"
     }
   }
   ```

4. **Create `tools/i18n/__tests__/task-catalog-generate.test.ts`** with the 6 vitest cases listed in `<behavior>`. The tests target `validateTaskCatalogShape` only — no LLM calls in CI.

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { validateTaskCatalogShape, type TaskBody } from '../task-catalog-generate';

   const sampleEn: Record<string, TaskBody> = {
     'Cooking a meal': {
       name: 'Cooking a meal',
       description: 'Make a full meal from start to finish.',
       instructions: ['Look down at your work area.'],
       examples: [],
     },
   };

   describe('validateTaskCatalogShape', () => {
     it('rejects when a task name in en is missing from translated', () => {
       const v = validateTaskCatalogShape(sampleEn, {});
       expect(v.ok).toBe(false);
       expect(v.errors[0]).toMatch(/Missing task/);
     });

     it('rejects when name is not a string', () => {
       const v = validateTaskCatalogShape(sampleEn, {
         'Cooking a meal': { name: 42, description: 'd', instructions: [], examples: [] },
       });
       expect(v.ok).toBe(false);
       expect(v.errors.find((e) => /\.name is not a string/.test(e))).toBeDefined();
     });

     it('rejects when instructions is not an array', () => {
       const v = validateTaskCatalogShape(sampleEn, {
         'Cooking a meal': { name: 'X', description: 'd', instructions: 'not array', examples: [] },
       });
       expect(v.ok).toBe(false);
     });

     it('rejects when examples is missing', () => {
       const v = validateTaskCatalogShape(sampleEn, {
         'Cooking a meal': { name: 'X', description: 'd', instructions: [] },
       });
       expect(v.ok).toBe(false);
     });

     it('accepts a well-shaped translated catalog', () => {
       const v = validateTaskCatalogShape(sampleEn, {
         'Cooking a meal': {
           name: 'पकाना',
           description: 'पूरा खाना बनाएं।',
           instructions: ['काम की जगह देखें।'],
           examples: [],
         },
       });
       expect(v.ok).toBe(true);
       expect(v.errors).toHaveLength(0);
     });

     it('rejects non-object input', () => {
       const v = validateTaskCatalogShape(sampleEn, 'not an object');
       expect(v.ok).toBe(false);
     });
   });
   ```

5. **Run the test suite in tools/:**

   ```bash
   cd tools && pnpm test 2>&1 | tail -20
   ```

   Confirm exit 0.

6. **Do NOT run the actual LLM call yet** — Task 2 handles the end-to-end regen. Task 1 ships the tool plumbing + scaffolding only. The tool builds (`cd tools && pnpm tsx i18n/task-catalog-generate.ts --help` should print a usage message if you wire one OR at least not crash on import).

7. **Invariant checks:** - `git diff --stat apps/mobile/ios/` empty - `git diff --stat apps/api/drizzle/migrations/` empty - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty - `git diff --stat apps/mobile/android/` empty - `git diff --stat apps/mobile/src/i18n/locales/` empty (this plan does NOT touch the screen-string catalogs from plan 07-11) - `git diff --stat apps/mobile/src/screens/help/` empty (plan 07-13's scope) - `git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts` empty (Task 1 does NOT touch the catalog yet — that's Task 2)
   </action>
   <verify>
   <automated>cd tools && pnpm test 2>&1 | tail -10</automated>
   </verify>
   <acceptance_criteria> - `test -f tools/i18n/task-catalog-generate.ts && test -f tools/i18n/task-catalog-prompts.ts && test -f tools/i18n/__tests__/task-catalog-generate.test.ts` → all three exist. - `grep -c "VERNACULAR" tools/i18n/task-catalog-prompts.ts` returns at least 1. - `grep -c "validateTaskCatalogShape" tools/i18n/task-catalog-generate.ts` returns at least 2 (definition + main-flow use). - `grep -c "generateTaskCatalogLocale" tools/i18n/task-catalog-generate.ts` returns at least 2. - `grep -c '"i18n:task-catalog:generate"' tools/package.json` returns at least 1. - `cd tools && pnpm test` exits 0 and all 6 new validateTaskCatalogShape tests pass. - `git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts` empty (Task 1 does NOT modify the catalog itself). - `git diff --stat apps/mobile/ios/ apps/api/drizzle/migrations/ apps/mobile/android/ .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md apps/mobile/src/i18n/locales/ apps/mobile/src/screens/help/` all empty.
   </acceptance_criteria>
   <done>The task-catalog regen tool is built + tested at the unit level + wired into tools/package.json scripts. End-to-end LLM regen is Task 2.</done>
   </task>

<task type="auto">
  <name>Task 2: Run the LLM regen → all 77 tasks × 7 non-English locales translated → committed catalog + audit sidecar</name>
  <files>apps/mobile/src/i18n/taskCatalog.i18n.ts, apps/mobile/src/i18n/taskCatalog.audit.json, apps/mobile/src/i18n/__tests__/taskCatalog.body.test.ts</files>
  <read_first>
    - tools/i18n/task-catalog-generate.ts (the entrypoint built in Task 1)
    - apps/mobile/src/i18n/taskCatalog.i18n.ts (the current catalog — 5305 LOC; the regen overwrites all non-`en` slots)
    - apps/mobile/src/i18n/reverseSearch.ts (the consumer — confirm REVERSE_BY_LOCALE is rebuilt at module load from the new TASK_CATALOG_I18N)
    - apps/mobile/src/services/tasksApi.ts (the call site that wires reverseSearch into /tasks/search)
  </read_first>
  <behavior>
    - Run `pnpm i18n:task-catalog:generate`. The tool reads the existing `en` slots, calls Claude Opus 4.7 7 times, validates each response, regenerates the full `taskCatalog.i18n.ts` file with all 8 locale slots filled, and writes the audit sidecar.
    - The regen overwrites `taskCatalog.i18n.ts` in place. The header (lines 1-56), the type/interface declarations, the `buildReverseMaps` function (line 5267), and the `REVERSE_BY_LOCALE` export (line 5305) all remain byte-identical post-regen — only the data payload changes.
    - A new test `apps/mobile/src/i18n/__tests__/taskCatalog.body.test.ts` asserts that for every task entry, the hi-IN.name differs from en.name AND is non-empty AND contains non-ASCII characters (a proxy for "actual Devanagari translation, not English-skeleton"). Similar asserts for the other 6 locales.
    - Owner-confirmation: if a task name is a proper noun (e.g. a brand/product the LLM legitimately can't translate, like "Cooking a meal" being a generic phrase but "Make tea" being borderline), the LLM may keep the English value. This is acceptable IF the task's `description` + `instructions` are translated. The test allows up to 5 task entries per locale where `name === en.name` — flagging more than 5 triggers a CI failure that prompts the operator to investigate.
    - **REVERSE_BY_LOCALE rebuild** happens automatically at module load (the existing line 5305) — no manual rebuild needed.
    - **Reverse-search Stage 1** is now functionally meaningful: a unit test exercises `reverseSearch('चाय बनाओ', 'hi-IN')` and asserts the return is the canonical English task name (assuming the LLM correctly translated "Make tea" → "चाय बनाओ" in hi-IN).
  </behavior>
  <action>
1. **Run the regen tool:**

```bash
pnpm i18n:task-catalog:generate 2>&1 | tee /tmp/07-12-regen.log
```

Expected: 7 lines `[task-catalog-generate] {locale}: OK (77 tasks)` and a final `[task-catalog-generate] done — 77 tasks × 7 locales committed.`. If any locale fails, fix the validator error and re-run.

2. **Manually spot-check the hi-IN translations** for sanity. Pick 5 sample tasks and verify the hi-IN.name is Devanagari script (not English):

   ```bash
   node -e "const c = require('./apps/mobile/src/i18n/taskCatalog.i18n.ts'); console.log(JSON.stringify(Object.fromEntries(Object.entries(c.TASK_CATALOG_I18N).slice(0,5).map(([k,v]) => [k, v['hi-IN'].name])), null, 2));"
   ```

   (If the `node -e` approach hits a TS/CommonJS interop snag, fall back to grepping the file: `grep -A 1 "'hi-IN': {" apps/mobile/src/i18n/taskCatalog.i18n.ts | grep "name:" | head -10` — confirm Devanagari script in the values.)

3. **Create `apps/mobile/src/i18n/__tests__/taskCatalog.body.test.ts`** with the assertions:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { TASK_CATALOG_I18N, REVERSE_BY_LOCALE } from '../taskCatalog.i18n';

   const NON_EN_LOCALES = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'] as const;

   // POST-CHECKER-REV (WARNING #4): tightened from 5→2 AND extended to
   // count description+instructions skeleton-English (not just name).
   // The catalog is everyday tasks — most "proper nouns" DO translate.
   // A task counts as skeleton-English ONLY if name AND description AND
   // first instruction all match the canonical English. That's a 3-axis
   // gate — much harder to slip through than a name-only check.
   const PROPER_NOUN_TOLERANCE = 2;

   describe('TASK_CATALOG_I18N body translation (G-08 closure)', () => {
     for (const loc of NON_EN_LOCALES) {
       it(`${loc}: more than ${PROPER_NOUN_TOLERANCE} tasks are skeleton-English across name+description+instructions[0]`, () => {
         const total = Object.keys(TASK_CATALOG_I18N).length;
         let englishSkeleton = 0;
         for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
           const body = byLocale[loc];
           const en = byLocale['en'];
           expect(body, `${canonical}.${loc} body missing`).toBeDefined();
           expect(typeof body!.name).toBe('string');
           // 3-axis skeleton check: name + description + first-instruction all match en
           const nameEn = body!.name === en!.name;
           const descEn = body!.description === en!.description;
           const instEn = (body!.instructions?.[0] ?? '') === (en!.instructions?.[0] ?? '');
           if (nameEn && descEn && instEn) englishSkeleton++;
         }
         expect(
           englishSkeleton,
           `${loc}: ${englishSkeleton}/${total} tasks still skeleton-English (name+description+instructions[0] all match en)`,
         ).toBeLessThanOrEqual(PROPER_NOUN_TOLERANCE);
       });

       it(`${loc}: every task body has non-empty description + instructions`, () => {
         for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
           const body = byLocale[loc]!;
           expect(body.description.length).toBeGreaterThan(0);
           expect(Array.isArray(body.instructions)).toBe(true);
           expect(body.instructions.length).toBeGreaterThan(0);
         }
       });
     }

     it('hi-IN reverse-search Stage 1: typing a translated name maps back to canonical English', () => {
       const hiIn = REVERSE_BY_LOCALE['hi-IN'];
       expect(hiIn).toBeDefined();
       expect(Object.keys(hiIn!.fullStringMap).length).toBeGreaterThan(50);
       // At least one entry — pick the first one — maps to a canonical English task name in the catalog.
       const [localizedName, canonicalEn] = Object.entries(hiIn!.fullStringMap)[0]!;
       expect(TASK_CATALOG_I18N[canonicalEn]).toBeDefined();
     });
   });
   ```

4. **Run the test suite** (per memory `feedback_post_merge_test_env.md`):

   ```bash
   set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
   ```

   Confirm exit 0. The new `taskCatalog.body.test.ts` should pass for all 7 locales.

5. **Verify the audit sidecar exists:**

   ```bash
   test -f apps/mobile/src/i18n/taskCatalog.audit.json && jq '.locales_generated, .tasks_translated, .generated_at' apps/mobile/src/i18n/taskCatalog.audit.json
   ```

   Expected: 7 locales listed, 77 tasks_translated, recent timestamp.

6. **Verify the structural integrity of taskCatalog.i18n.ts:**

   - `grep -c "export const TASK_CATALOG_I18N" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns exactly 1.
   - `grep -c "export function buildReverseMaps" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns exactly 1.
   - `grep -c "export const REVERSE_BY_LOCALE" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns exactly 1.
   - `tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | tail -10` exits 0 (the regenerated file parses as valid TS).

7. **Run a smoke build verification:**

   ```bash
   cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug 2>&1 | tail -10
   ```

   Confirm BUILD SUCCESSFUL — the regenerated file builds cleanly into the APK.

8. **Invariant checks:**
   - `git diff --stat apps/mobile/ios/` empty
   - `git diff --stat apps/api/drizzle/migrations/` empty
   - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty
   - `git diff --stat apps/mobile/android/` empty
   - `git diff --stat apps/mobile/src/i18n/locales/` empty (only `taskCatalog.i18n.ts` and `taskCatalog.audit.json` move)
   - `git diff --stat apps/mobile/src/screens/help/` empty
   - The `buildReverseMaps` function body is byte-identical post-regen: `git diff apps/mobile/src/i18n/taskCatalog.i18n.ts | grep -E '^[+-].*buildReverseMaps|^[+-].*REVERSE_BY_LOCALE'` shows no lines (the function/export survived the regen).
     </action>
     <verify>
     <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -15</automated>
     </verify>
     <acceptance_criteria>
   - `apps/mobile/src/i18n/taskCatalog.i18n.ts` total LOC remained roughly the same (5305 ± 200 LOC; the regen didn't accidentally truncate the file).
   - `apps/mobile/src/i18n/taskCatalog.audit.json` exists with `locales_generated.length === 7` and `tasks_translated >= 70`.
   - POST-CHECKER-REV (WARNING #4): For each of the 7 non-English locales, at most **2** of the 77 task entries have all three of `body.name === en.name` AND `body.description === en.description` AND `body.instructions[0] === en.instructions[0]` (the 3-axis skeleton-English gate; tightened from name-only/tolerance 5 → 3-axis/tolerance 2). The remaining ≥ 75 entries have at least one translated axis.
   - The new `taskCatalog.body.test.ts` test passes for all 7 locales with the 3-axis check + tolerance 2.
   - POST-CHECKER-REV (WARNING #5): `grep -cE "reverseSearch|REVERSE_BY_LOCALE" apps/mobile/src/services/tasksApi.ts` returns at least 1 (the reverse-search call-site wiring shipped in plan 07-06 (D-14, D-15) is STILL intact; this plan only refreshes the catalog data side, but verifying the upstream wiring is unbroken keeps the closure path honest).
   - POST-CHECKER-REV (WARNING #5): `git diff --stat apps/mobile/src/services/tasksApi.ts apps/mobile/src/i18n/reverseSearch.ts` returns empty (this plan ONLY refreshes catalog data; the wiring + 3-stage chain shipped in plan 07-06 stay frozen).
   - `tsc --noEmit -p apps/mobile/tsconfig.json` exits 0.
   - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` (with JDK 17) exits BUILD SUCCESSFUL.
   - `grep -c "export const TASK_CATALOG_I18N\|export function buildReverseMaps\|export const REVERSE_BY_LOCALE" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns exactly 3.
   - `git diff --stat apps/mobile/ios/ apps/api/drizzle/migrations/ apps/mobile/android/ .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md apps/mobile/src/i18n/locales/ apps/mobile/src/screens/help/` all empty.
     </acceptance_criteria>
     <done>All 77 tasks × 7 non-English locales translated by the LLM, written into `taskCatalog.i18n.ts`, audit sidecar committed, body-translation test green, APK build green. G-08 closed at the code level pending the operator's §6 re-walk in plan 07-15.</done>
     </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                     | Description                                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| LLM-generated task body → user-facing recording instructions | Untrusted LLM text appears in TaskDetailsSheet immediately before recording — could mislead the user if hallucinated. |
| LLM regen tool → committed source file                       | The regenerated taskCatalog.i18n.ts becomes the canonical source of truth checked into the repo.                      |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                               | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------- | ----------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| T-07-12-01 | Tampering              | LLM hallucination in `instructions[]`                                   | mitigate    | `validateTaskCatalogShape` enforces structural conformance (every task in en exists in translated, all fields are correct types). Human-translator review pass deferred per CONTEXT.md "Deferred Ideas". The operator's §6 re-walk in plan 07-15 is the human-in-the-loop sanity check. |
| T-07-12-02 | Information Disclosure | Catalog body                                                            | accept      | Public task names + public instructions; no PII, no secrets.                                                                                                                                                                                                                            |
| T-07-12-03 | Tampering              | en slot accidentally modified during regen                              | mitigate    | The tool reads en slots into memory before the LLM call and writes them back UNCHANGED (the LLM never sees a request to translate en; only the 7 non-English slots get overwritten). A diff post-regen `git diff apps/mobile/src/i18n/taskCatalog.i18n.ts                               | grep -E "^[+-]\s+en:"` should show roughly equal +/- counts (the structural movement, not content drift). |
| T-07-12-04 | Tampering              | LLM produces a translated key (top-level) that doesn't match the en key | mitigate    | The validator asserts `Object.keys(translated) ⊇ Object.keys(en)` so a translated catalog with renamed keys gets rejected before write.                                                                                                                                                 |

</threat_model>

<verification>
1. `cd tools && pnpm test` exits 0 (Task 1 validator tests).
2. `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile"` exits 0 (Task 2 body-translation test).
3. `tsc --noEmit -p apps/mobile/tsconfig.json` exits 0.
4. `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` BUILD SUCCESSFUL.
5. `apps/mobile/src/i18n/taskCatalog.audit.json` exists with 7 locales + ≥ 70 tasks_translated.
6. All 4 invariant gates green.
</verification>

<success_criteria>

- G-08 (TasksScreen task data in English) closed at the code level: 77 × 7 = 539 task-body slots translated.
- TaskDetailsSheet renders full hi-IN body (name + description + instructions + examples) per D-01 — to be re-walked on hardware in plan 07-15 §6.
- Reverse-search Stage 1 + Stage 2 are now meaningful: `'चाय बनाओ' → 'Make tea'` resolves via the fullStringMap.
- LLM regen tool is repeatable (`pnpm i18n:task-catalog:generate`).
- Owner deviation (en slot byte-identical) preserved.
- All invariants green.
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-12-SUMMARY.md` documenting:
- The total tasks translated × locales × LLM-call cost (audit sidecar fields).
- A 3-row spot-check table (canonical EN name, hi-IN name, pt-BR name) for sanity.
- The number of proper-noun carve-outs per locale (where the LLM kept English).
- A pointer to plan 07-15 §6 for the operator's hardware re-walk.
</output>
