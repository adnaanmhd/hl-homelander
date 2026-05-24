---
phase: 07-multi-linguality-live-cam-feed
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - tools/package.json
  - tools/tsconfig.json
  - tools/.env.example
  - tools/.gitignore
  - tools/i18n/generate.ts
  - tools/i18n/validate.ts
  - tools/i18n/prompts.ts
  - tools/i18n/locale-config.ts
  - tools/i18n/__tests__/generate.test.ts
  - tools/i18n/__tests__/validate.test.ts
  - .gitignore
autonomous: true
requirements: [I18N-05]
tags: [tools, llm, anthropic, i18n]
user_setup:
  - service: anthropic
    why: 'Claude Opus 4.7 powers the catalog translation per D-10'
    env_vars:
      - name: ANTHROPIC_API_KEY
        source: 'Anthropic Console → Settings → API Keys → Create Key'
    dashboard_config:
      - task: 'Write the key into tools/.env (NOT apps/mobile/.env or apps/api/.env)'
        location: 'Repo root tools/.env (gitignored)'
must_haves:
  truths:
    - '`pnpm i18n:generate` (or `npm run i18n:generate` from the tools workspace) translates en.json into the 7 non-English JSONs via Claude Opus 4.7'
    - 'The vernacular brief from D-10 lives verbatim in source as the system prompt'
    - 'Shape-parity validator catches missing or extra keys in any locale JSON vs en.json'
    - 'ANTHROPIC_API_KEY lives only in tools/.env (gitignored); it never ships in the mobile bundle'
  artifacts:
    - path: tools/i18n/generate.ts
      provides: 'Claude Opus 4.7 catalog generator'
      contains: '@anthropic-ai/sdk'
    - path: tools/i18n/validate.ts
      provides: 'Shape-parity validator vs en.json'
      contains: 'shape parity'
    - path: tools/i18n/prompts.ts
      provides: 'Verbatim D-10 vernacular brief'
      contains: 'Translate as a native speaker'
    - path: tools/package.json
      provides: 'tools workspace with @anthropic-ai/sdk@^0.98.0 + tsx'
      contains: '@anthropic-ai/sdk'
  key_links:
    - from: tools/i18n/generate.ts
      to: tools/i18n/prompts.ts
      via: VERNACULAR_BRIEF import as Anthropic Messages.create system field
      pattern: 'VERNACULAR_BRIEF'
    - from: tools/i18n/generate.ts
      to: apps/mobile/src/i18n/locales/en.json
      via: file read at generation time
      pattern: 'locales/en.json'
    - from: tools/i18n/generate.ts
      to: apps/mobile/src/i18n/locales/{loc}.json
      via: file write per locale
      pattern: 'fs.writeFile'
---

<objective>
Ship the offline LLM catalog generator at `tools/i18n/generate.ts`. The tool reads `apps/mobile/src/i18n/locales/en.json`, calls Claude Opus 4.7 once per non-English locale with the verbatim D-10 vernacular brief as the system prompt, and overwrites each `{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` with the translated catalog. A sibling `validate.ts` runs the shape-parity check (recursive key-set diff against `en.json`) — both as a CI sanity step and as a post-generate gate.

Purpose: this is the only mechanism for keeping the 7 non-English catalogs in sync with English (D-12 — drift handling). Without it, the screen-sweep plan (07-05) adds keys to `en.json` and the non-English catalogs silently miss them; key-fallback masks the gap at runtime but the surfaces show English text in supposedly-translated screens.

Output: a `tools/` workspace at repo root with `@anthropic-ai/sdk@^0.98.0` + `tsx` + a JSON-shape-parity validator. The actual LLM run is deferred to plan 07-05's final task (after the screen sweep finalizes `en.json`); this plan only ships the tooling + validates the tooling.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md
@CLAUDE.md
@apps/api/package.json
@apps/api/tsconfig.json
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create tools/ workspace + shape-parity validator + tests</name>
  <files>tools/package.json, tools/tsconfig.json, tools/.env.example, tools/.gitignore, tools/i18n/locale-config.ts, tools/i18n/validate.ts, tools/i18n/__tests__/validate.test.ts, .gitignore</files>
  <read_first>
    - apps/api/package.json (analog: Node 22 + TypeScript shape)
    - apps/api/tsconfig.json (analog: moduleResolution + target)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-10, D-11, D-12, D-13
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Catalog Generation Tool" (lines 624-722)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "tools/i18n/generate.ts + tools/package.json + tools/tsconfig.json + tools/.env"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Output Validation" — two-layer validation
    - apps/mobile/src/i18n/locales/en.json (Plan 07-01's starter catalog)
    - .gitignore (verify tools/.env not yet covered)
  </read_first>
  <behavior>
    - `tools/package.json` declares the workspace with deps `@anthropic-ai/sdk@^0.98.0` + `zod@^4.4.3` + dev deps `typescript@^5.6.3` + `tsx@^4.0.0` + `vitest@^4.1.5`.
    - `tools/.env` is gitignored (added to repo root `.gitignore`); `tools/.env.example` documents the required key.
    - `validate.ts` exports `validateShapeParity(en, locale) → { missing: string[], extra: string[] }` (returns dotted paths).
    - `validate.ts` accepts en/locale as plain JSON-parsed objects and walks recursively.
    - Validator catches missing keys (`extra` is `[]`, `missing` non-empty).
    - Validator catches extra keys (`missing` is `[]`, `extra` non-empty).
    - Validator returns both empty when shapes match exactly.
    - Validator rejects mismatched leaf types (string vs object) as `extra` + `missing` at the same path.
  </behavior>
  <action>
1. **Create the `tools/` workspace at repo root.** Verify directory does not exist with `ls tools 2>/dev/null` — if it does not, `mkdir -p tools/i18n/__tests__`.

2. **Create `tools/package.json`**:

   ```json
   {
     "name": "@humyn/tools",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "i18n:generate": "tsx i18n/generate.ts",
       "i18n:validate": "tsx i18n/validate.ts",
       "test": "vitest run"
     },
     "dependencies": {
       "@anthropic-ai/sdk": "^0.98.0",
       "zod": "^4.4.3"
     },
     "devDependencies": {
       "typescript": "^5.6.3",
       "tsx": "^4.0.0",
       "vitest": "^4.1.5"
     }
   }
   ```

3. **Create `tools/tsconfig.json`**:

   ```json
   {
     "compilerOptions": {
       "target": "es2022",
       "module": "nodenext",
       "moduleResolution": "nodenext",
       "esModuleInterop": true,
       "strict": true,
       "skipLibCheck": true,
       "resolveJsonModule": true,
       "noEmit": true
     },
     "include": ["i18n/**/*.ts"]
   }
   ```

4. **Create `tools/.env.example`**:

   ```
   # Anthropic API key for tools/i18n/generate.ts (Claude Opus 4.7 catalog generator).
   # Get one at https://console.anthropic.com/settings/keys
   # NEVER commit a real key — tools/.env is gitignored.
   ANTHROPIC_API_KEY=sk-ant-...
   ```

5. **Create `tools/.gitignore`** (defense-in-depth on top of repo root):

   ```
   .env
   node_modules/
   ```

6. **Add `tools/.env` and `tools/node_modules` to the repo root `.gitignore`** if not already covered. Read `.gitignore`; if `tools/.env` is not matched by any existing pattern, append:

   ```
   # Phase 7: tools workspace secrets — never commit
   tools/.env
   tools/node_modules/
   ```

7. **Create `tools/i18n/locale-config.ts`** (D-18 + D-11 — locale ordering + names):

   ```typescript
   export const TARGET_LOCALES = [
     'pt-BR',
     'es',
     'hi-IN',
     'bn-IN',
     'ta-IN',
     'te-IN',
     'mr-IN',
   ] as const;
   export type TargetLocale = (typeof TARGET_LOCALES)[number];

   export const LOCALE_NAMES: Record<TargetLocale, string> = {
     'pt-BR': 'Brazilian Portuguese',
     es: 'Spanish',
     'hi-IN': 'Hindi (India)',
     'bn-IN': 'Bengali (India)',
     'ta-IN': 'Tamil (India)',
     'te-IN': 'Telugu (India)',
     'mr-IN': 'Marathi (India)',
   };
   ```

8. **Create `tools/i18n/validate.ts`** — shape-parity validator:

   ```typescript
   /**
    * Shape-parity validator per D-12 + 07-RESEARCH §"Output Validation".
    * Walks en.json + each locale JSON recursively and reports
    * - keys present in en but missing in the locale
    * - keys present in the locale but absent in en (LLM hallucinated)
    * Returns dotted paths; intended for the post-generate gate
    * (the runtime fallback handles missing keys, but we want to know).
    */
   import { readFileSync } from 'node:fs';
   import { resolve } from 'node:path';
   import { TARGET_LOCALES } from './locale-config';

   type Catalog = { [key: string]: string | Catalog };

   export function validateShapeParity(
     en: Catalog,
     locale: Catalog,
   ): { missing: string[]; extra: string[] } {
     const missing: string[] = [];
     const extra: string[] = [];
     walk(en, locale, '', missing, extra);
     return { missing, extra };
   }

   function walk(
     en: Catalog | string,
     loc: Catalog | string,
     prefix: string,
     missing: string[],
     extra: string[],
   ): void {
     if (typeof en === 'string' || typeof loc === 'string') {
       if (typeof en !== typeof loc) {
         // type mismatch counts as both missing and extra at the same path
         missing.push(prefix);
         extra.push(prefix);
       }
       return;
     }
     for (const k of Object.keys(en)) {
       const path = prefix ? `${prefix}.${k}` : k;
       if (!(k in loc)) {
         missing.push(path);
       } else {
         walk(en[k] as Catalog | string, loc[k] as Catalog | string, path, missing, extra);
       }
     }
     for (const k of Object.keys(loc)) {
       if (!(k in en)) {
         extra.push(prefix ? `${prefix}.${k}` : k);
       }
     }
   }

   // Allow `tsx tools/i18n/validate.ts` as a CLI gate.
   if (import.meta.url === `file://${process.argv[1]}`) {
     const repoRoot = resolve(import.meta.dirname, '..', '..');
     const localesDir = resolve(repoRoot, 'apps/mobile/src/i18n/locales');
     const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf8')) as Catalog;
     let exit = 0;
     for (const loc of TARGET_LOCALES) {
       const data = JSON.parse(readFileSync(resolve(localesDir, `${loc}.json`), 'utf8')) as Catalog;
       const { missing, extra } = validateShapeParity(en, data);
       if (missing.length || extra.length) {
         console.error(`[validate] ${loc}: missing=${missing.length} extra=${extra.length}`);
         missing.slice(0, 10).forEach((p) => console.error(`  - missing: ${p}`));
         extra.slice(0, 10).forEach((p) => console.error(`  + extra:   ${p}`));
         exit = 1;
       } else {
         console.log(`[validate] ${loc}: OK`);
       }
     }
     process.exit(exit);
   }
   ```

9. **Create `tools/i18n/__tests__/validate.test.ts`**:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { validateShapeParity } from '../validate';

   describe('validateShapeParity', () => {
     it('returns both empty when shapes match exactly', () => {
       const en = { a: 'x', b: { c: 'y' } };
       const loc = { a: 'X', b: { c: 'Y' } };
       const r = validateShapeParity(en as never, loc as never);
       expect(r.missing).toEqual([]);
       expect(r.extra).toEqual([]);
     });

     it('reports a missing top-level key', () => {
       const en = { a: 'x', b: 'y' };
       const loc = { a: 'X' };
       const r = validateShapeParity(en as never, loc as never);
       expect(r.missing).toEqual(['b']);
       expect(r.extra).toEqual([]);
     });

     it('reports a missing nested key with dotted path', () => {
       const en = { a: { b: { c: 'x' } } };
       const loc = { a: { b: {} } };
       const r = validateShapeParity(en as never, loc as never);
       expect(r.missing).toEqual(['a.b.c']);
     });

     it('reports an extra key in the locale (LLM hallucinated)', () => {
       const en = { a: 'x' };
       const loc = { a: 'X', b: 'Y' };
       const r = validateShapeParity(en as never, loc as never);
       expect(r.missing).toEqual([]);
       expect(r.extra).toEqual(['b']);
     });

     it('reports a leaf type mismatch as both missing and extra at the same path', () => {
       const en = { a: { b: 'x' } };
       const loc = { a: 'string-not-object' };
       const r = validateShapeParity(en as never, loc as never);
       expect(r.missing).toContain('a');
       expect(r.extra).toContain('a');
     });
   });
   ```

10. **Install the workspace deps** so the test command resolves:
    `bash
    cd tools && npm install
    `
    </action>
    <verify>
    <automated>cd tools && npm test -- --run i18n/**tests**/validate.test.ts 2>&1 | tail -15</automated>
    </verify>
    <acceptance_criteria> - Directory `tools/` exists with `package.json`, `tsconfig.json`, `i18n/` subdirectory. - `grep -c '"@anthropic-ai/sdk"' tools/package.json` returns 1. - `grep -c 'sk-ant-...' tools/.env.example` returns 1; `ls tools/.env 2>/dev/null` returns NOTHING (real .env not created in this task — operator step). - `grep -E '^tools/\.env$' .gitignore` returns 1 line. - File `tools/i18n/validate.ts` exists; exports `validateShapeParity`. - Test command above exits 0; all 5 `it()` cases under `validateShapeParity` green.
    </acceptance_criteria>
    <done>Tools workspace bootstrapped with deps installed, shape-parity validator implemented + tested, .gitignore covers tools/.env. No LLM calls made yet.</done>
    </task>

<task type="auto" tdd="true">
  <name>Task 2: LLM generator script + verbatim vernacular brief + offline test</name>
  <files>tools/i18n/generate.ts, tools/i18n/prompts.ts, tools/i18n/__tests__/generate.test.ts</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-10, D-11, D-12, D-13 (verbatim vernacular brief is non-negotiable)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Catalog Generation Tool" + "Prompt Skeleton" (lines 649-702) — copy the skeleton verbatim
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Audit-Trail Header"
    - tools/i18n/locale-config.ts (Task 1's exports)
    - tools/i18n/validate.ts (Task 1's validator — generator uses it as a post-write gate)
  </read_first>
  <behavior>
    - `VERNACULAR_BRIEF` in `tools/i18n/prompts.ts` contains the D-10 brief VERBATIM (string match).
    - `generateLocale(client, loc, en)` returns a parsed catalog object; throws on JSON parse failure.
    - The user prompt mentions the LOCALE_NAME (e.g. "Hindi (India)") and instructs "keep JSON structure, translate the string VALUES".
    - Strips a leading "```json\n" + trailing "```" if the model wraps the response in fences.
    - Writes an audit sidecar `{loc}.audit.json` next to each locale JSON with `{ model, generated_at, brief_version, en_source_sha }` (per 07-RESEARCH "Audit-Trail Header").
    - When invoked as a CLI (`tsx tools/i18n/generate.ts`), reads `ANTHROPIC_API_KEY` from env; exits with helpful error message if absent.
    - The offline test mocks the Anthropic client and verifies the catalog-extraction + audit-sidecar paths without making real API calls.
  </behavior>
  <action>
1. **Create `tools/i18n/prompts.ts`** with the verbatim D-10 brief (do NOT paraphrase):
   ```typescript
   /**
    * The vernacular brief locked in 07-CONTEXT.md D-10. MUST appear verbatim
    * as the Anthropic Messages.create `system` field. Do not paraphrase, do
    * not add structure — owner specified this exact string.
    */
   export const VERNACULAR_BRIEF =
     'Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists.';

/\*_ Version stamp recorded in audit sidecar; bump when the brief changes. _/
export const BRIEF_VERSION = 1;

export function userPromptFor(localeName: string, enCatalog: unknown): string {
return (
`Translate this catalog to ${localeName}. Keep the JSON structure ` +
`exactly; translate only the string VALUES. Return the full JSON, ` +
`nothing else.\n\n${JSON.stringify(enCatalog, null, 2)}`
);
}

````

2. **Create `tools/i18n/generate.ts`** — Anthropic SDK client + per-locale generator:
```typescript
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
import { TARGET_LOCALES, LOCALE_NAMES, type TargetLocale } from './locale-config';
import { VERNACULAR_BRIEF, BRIEF_VERSION, userPromptFor } from './prompts';
import { validateShapeParity } from './validate';

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
  const cleaned = text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

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
````

3. **Create `tools/i18n/__tests__/generate.test.ts`** (offline — no real API call):

   ````typescript
   import { describe, it, expect } from 'vitest';
   import { generateLocale, buildAuditSidecar } from '../generate';
   import { VERNACULAR_BRIEF } from '../prompts';

   describe('catalog generator', () => {
     it('VERNACULAR_BRIEF matches D-10 verbatim', () => {
       expect(VERNACULAR_BRIEF).toBe(
         'Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists.',
       );
     });

     it('parses a clean JSON response', async () => {
       const fakeClient = {
         messages: {
           create: async () => ({
             content: [{ type: 'text', text: '{"common":{"continue":"Continuar"}}' }],
           }),
         },
       } as never;
       const result = await generateLocale(fakeClient, 'es', { common: { continue: 'Continue' } });
       expect(result).toEqual({ common: { continue: 'Continuar' } });
     });

     it('strips markdown code fences around the JSON', async () => {
       const fakeClient = {
         messages: {
           create: async () => ({
             content: [{ type: 'text', text: '```json\n{"a":"b"}\n```' }],
           }),
         },
       } as never;
       const result = await generateLocale(fakeClient, 'pt-BR', { a: 'x' });
       expect(result).toEqual({ a: 'b' });
     });

     it('throws on malformed JSON', async () => {
       const fakeClient = {
         messages: {
           create: async () => ({ content: [{ type: 'text', text: 'this is not json' }] }),
         },
       } as never;
       await expect(generateLocale(fakeClient, 'es', {})).rejects.toThrow(/not valid JSON/);
     });

     it('buildAuditSidecar records model + brief version + sha + iso ts', () => {
       const audit = buildAuditSidecar('{"a":"b"}');
       expect(audit.model).toBe('claude-opus-4-7');
       expect(audit.brief_version).toBe(1);
       expect(typeof audit.en_source_sha).toBe('string');
       expect((audit.en_source_sha as string).length).toBe(64);
       expect(typeof audit.generated_at).toBe('string');
     });
   });
   ````

     </action>
     <verify>
       <automated>cd tools && npm test -- --run i18n/__tests__/ 2>&1 | tail -25</automated>
     </verify>
     <acceptance_criteria>
       - File `tools/i18n/generate.ts` exists; `grep -c "claude-opus-4-7" tools/i18n/generate.ts` returns at least 1.
       - File `tools/i18n/prompts.ts` exists; the verbatim brief check: `grep -c "Translate as a native speaker would say it in casual everyday conversation" tools/i18n/prompts.ts` returns 1.
       - `grep -c "VERNACULAR_BRIEF" tools/i18n/generate.ts` returns at least 1 (imported + used as `system` field).
       - Test command above exits 0; all 5 `it()` cases under "catalog generator" green plus the 5 cases from Task 1.
       - `cd tools && npx tsc --noEmit` exits 0 (type-checks clean).
     </acceptance_criteria>
     <done>Generator script ships with D-10 verbatim brief + audit sidecar + JSON-fence stripper + shape-parity gate; offline tests prove the extraction path. Actual LLM run defers to plan 07-05 (after en.json is finalized by the screen sweep).</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                         | Description                                            |
| -------------------------------- | ------------------------------------------------------ |
| tools/.env → generator runtime   | API key read from disk into Anthropic client           |
| Anthropic API → catalog JSONs    | LLM response written into the mobile bundle            |
| tools/ workspace → mobile bundle | Tool MUST NOT leak ANTHROPIC_API_KEY into apps/mobile/ |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                       | Disposition | Mitigation Plan                                                                                                                                                                                     |
| ---------- | ---------------------- | ----------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-02-01 | Information Disclosure | ANTHROPIC_API_KEY committed to git              | mitigate    | `tools/.env.example` is the committed reference; `tools/.env` added to repo root `.gitignore` + `tools/.gitignore`. PLAN's user_setup makes the operator step explicit.                             |
| T-07-02-02 | Information Disclosure | API key bleeds into apps/mobile/ bundle         | mitigate    | Generator runs in Node-only `tools/` workspace — never imported from `apps/mobile/`. Acceptance criteria includes `grep -r "ANTHROPIC_API_KEY" apps/mobile/` returning zero.                        |
| T-07-02-03 | Tampering              | LLM produces malicious JSON (XSS-style payload) | accept      | i18next escapes `{{var}}` interpolations by default; React Native Text rendering is XSS-safe. Catalog values are display strings only. Validator catches shape divergence but does not lint values. |
| T-07-02-04 | Denial of Service      | Anthropic API rate-limit / outage               | mitigate    | Sequential per-locale calls (D-11); single-locale failure logs + continues. Shape-parity gate prevents writing a busted catalog.                                                                    |
| T-07-02-05 | Repudiation            | Catalog regenerated without an audit trail      | mitigate    | `buildAuditSidecar` writes `{loc}.audit.json` with model id, ISO timestamp, brief version, en source SHA on every successful generate.                                                              |

</threat_model>

<verification>
- `cd tools && npm test -- --run` exits 0
- `cd tools && npx tsc --noEmit` exits 0
- `git status tools/.env` shows NOT TRACKED (or "Untracked files: tools/.env" — never staged) — Task 1 .gitignore entry verified
- `grep -rE "(ANTHROPIC_API_KEY|sk-ant-)" apps/mobile/ apps/api/ 2>/dev/null | grep -v node_modules` returns zero hits (defense-in-depth)
</verification>

<success_criteria>

- 7 files under `tools/i18n/` exist
- All vitest cases pass (offline — no real API call)
- `tools/.env` not committed (verified via .gitignore + git status check)
- Verbatim D-10 brief preserved (grep'd)
- Generator script can be invoked end-to-end but is not run in this plan (deferred to 07-05 final task)
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-02-SUMMARY.md` per the standard template. Include a note that the actual `pnpm i18n:generate` run is deferred to plan 07-05's last task and requires the operator to provision `tools/.env`.
</output>
