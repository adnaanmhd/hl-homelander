/**
 * Task catalog body translation generator — plan 07-12 (G-08 closure).
 *
 * Mirrors the structure of tools/i18n/help-content-generate.ts (the help-
 * content body generator from plan 07-13) but operates on the TypeScript
 * source file `apps/mobile/src/i18n/taskCatalog.i18n.ts`. Reads the en
 * slots out of the canonical TS file via the TypeScript compiler API,
 * calls Claude Opus 4.7 seven times (one per non-English locale), validates
 * each response against the en-shape gate, and re-emits the full TS file
 * with the new translations spliced into the 7 non-English locale slots.
 *
 * Invariants:
 *   - The header (everything before `export const TASK_CATALOG_I18N`)
 *     is preserved byte-identical.
 *   - The footer (`normalizeForReverseSearch` + `buildReverseMaps` +
 *     `REVERSE_BY_LOCALE` export) is preserved byte-identical.
 *   - Every `en` slot is preserved byte-identical (the LLM never sees a
 *     request to translate en; the renderer pulls en straight from the
 *     extracted source-of-truth and writes it back unchanged).
 *   - The 7 non-English locale slots for every task are overwritten with
 *     the LLM output.
 *
 * Run via `pnpm i18n:generate:task-catalog` from the tools/ workspace.
 *
 * Outputs:
 *   - apps/mobile/src/i18n/taskCatalog.i18n.ts  (overwritten in place)
 *   - apps/mobile/src/i18n/taskCatalog.audit.json (model + sha + ts +
 *     per-locale completion timestamps)
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';
import { TARGET_LOCALES, LOCALE_NAMES, type TargetLocale } from './locale-config.js';
import {
  TASK_VERNACULAR_BRIEF,
  TASK_CATALOG_BRIEF_VERSION,
  taskCatalogUserPromptFor,
} from './task-catalog-prompts.js';

const MODEL_ID = 'claude-opus-4-7'; // matches the help-content + screen-string generators
// 86 tasks × (1 name + 1 desc + ~2-3 instructions averaging ~80 tokens each) → ~6 KB ascii
// per locale; Devanagari / Tamil are ~3× the byte count → ~20 KB ascii equivalents in
// tokens. 32 K cap leaves comfortable headroom for the heaviest scripts.
const MAX_TOKENS = 32_000;

// ---------------------------------------------------------------------------
// Shape mirrored from apps/mobile/src/i18n/taskCatalog.i18n.ts. Keep in
// lockstep with the TaskBody interface in that file.
// ---------------------------------------------------------------------------
export interface TaskBody {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}

export type TaskCatalogShape = Record<string, Record<string, TaskBody>>;

// ---------------------------------------------------------------------------
// JSON-shape validator. Enforces:
//   - top-level object
//   - every task name from the en catalog exists in the translated payload
//   - per-task: name is a string, description is a string, instructions is a
//     string[], examples is a string[]
// Drift in any of the above gets rejected — the LLM is forbidden from
// dropping a task, hallucinating an extra task with a different key, or
// emitting a non-string in the wrong slot.
// ---------------------------------------------------------------------------
export function validateTaskCatalogShape(
  enCatalog: Record<string, TaskBody>,
  translated: unknown,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof translated !== 'object' || translated === null) {
    return { ok: false, errors: ['translated catalog is not an object'] };
  }
  const t = translated as Record<string, unknown>;
  for (const taskName of Object.keys(enCatalog)) {
    const body = t[taskName];
    if (body === undefined) {
      errors.push(`Missing task '${taskName}'`);
      continue;
    }
    if (typeof body !== 'object' || body === null) {
      errors.push(`Task '${taskName}' body is not an object`);
      continue;
    }
    const b = body as Record<string, unknown>;
    if (typeof b.name !== 'string') {
      errors.push(`Task '${taskName}'.name is not a string`);
    }
    if (typeof b.description !== 'string') {
      errors.push(`Task '${taskName}'.description is not a string`);
    }
    if (!Array.isArray(b.instructions)) {
      errors.push(`Task '${taskName}'.instructions is not an array`);
    } else if (!(b.instructions as unknown[]).every((s) => typeof s === 'string')) {
      errors.push(`Task '${taskName}'.instructions has non-string elements`);
    }
    if (!Array.isArray(b.examples)) {
      errors.push(`Task '${taskName}'.examples is not an array`);
    } else if (!(b.examples as unknown[]).every((s) => typeof s === 'string')) {
      errors.push(`Task '${taskName}'.examples has non-string elements`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Strip the ```json or bare ``` fences the model sometimes adds despite the
// brief saying "no markdown fences". Mirrors help-content-generate.ts's
// cleaner.
// ---------------------------------------------------------------------------
export function parseTaskCatalogResponse(text: string): Record<string, TaskBody> {
  const cleaned = text
    .replace(/^```json\s*\n?/i, '')
    .replace(/^```\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, TaskBody>;
  } catch (e) {
    throw new Error(
      `[task-catalog-generate] response was not valid JSON: ${(e as Error).message}\n--- response head ---\n${cleaned.slice(0, 200)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// TS-AST extractor: walk the `TASK_CATALOG_I18N` ObjectLiteralExpression and
// pull out the `en` slot for every task. Uses the TypeScript compiler API
// (already a tools/ devDependency) so we get a robust parse rather than a
// regex that can drift on quote/escape edge cases.
// ---------------------------------------------------------------------------
export function extractEnSlots(catalogSrc: string): Record<string, TaskBody> {
  const sf = ts.createSourceFile(
    'taskCatalog.i18n.ts',
    catalogSrc,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );

  let dataLiteral: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (dataLiteral) return;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          decl.name &&
          ts.isIdentifier(decl.name) &&
          decl.name.text === 'TASK_CATALOG_I18N' &&
          decl.initializer &&
          ts.isObjectLiteralExpression(decl.initializer)
        ) {
          dataLiteral = decl.initializer;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!dataLiteral) {
    throw new Error('[task-catalog-generate] TASK_CATALOG_I18N const not found in source file');
  }

  const out: Record<string, TaskBody> = {};
  for (const prop of dataLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const taskName = propertyNameToString(prop.name);
    if (taskName === undefined) continue;
    if (!ts.isObjectLiteralExpression(prop.initializer)) continue;

    // Find the `en:` slot inside this task's locale-keyed object.
    let enBody: TaskBody | undefined;
    for (const locProp of prop.initializer.properties) {
      if (!ts.isPropertyAssignment(locProp)) continue;
      const locName = propertyNameToString(locProp.name);
      if (locName !== 'en') continue;
      if (!ts.isObjectLiteralExpression(locProp.initializer)) continue;
      enBody = objectLiteralToTaskBody(locProp.initializer);
      break;
    }
    if (enBody) out[taskName] = enBody;
  }

  return out;
}

/** Extract a PropertyName text — handles 'Quoted Task Name', UnquotedName, "Double Quoted". */
function propertyNameToString(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

/** Convert an ObjectLiteralExpression of shape { name; description; instructions[]; examples[] } to TaskBody. */
function objectLiteralToTaskBody(obj: ts.ObjectLiteralExpression): TaskBody {
  const out: Partial<TaskBody> = {};
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyNameToString(prop.name);
    if (!key) continue;
    if (key === 'name' || key === 'description') {
      const v = literalToString(prop.initializer);
      if (v !== undefined) (out as Record<string, unknown>)[key] = v;
    } else if (key === 'instructions' || key === 'examples') {
      if (ts.isArrayLiteralExpression(prop.initializer)) {
        const arr: string[] = [];
        for (const el of prop.initializer.elements) {
          const v = literalToString(el);
          if (v !== undefined) arr.push(v);
        }
        (out as Record<string, unknown>)[key] = arr;
      }
    }
  }
  return {
    name: out.name ?? '',
    description: out.description ?? '',
    instructions: out.instructions ?? [],
    examples: out.examples ?? [],
  };
}

/** Read a string literal node (single / double / template-no-substitution) into its text. */
function literalToString(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

// ---------------------------------------------------------------------------
// File renderer: rebuild the TS source by splicing the new data block
// between the preserved header + preserved footer.
//
// Strategy:
//   - Header  = catalogSrc.slice(0, idx of 'export const TASK_CATALOG_I18N')
//   - Footer  = catalogSrc.slice(end of TASK_CATALOG_I18N's '};')
//   - Body    = string-template the new object literal using the
//               source-of-truth en (preserved) + translated (per-locale
//               LLM output).
//
// The data block is hand-formatted to match the source style:
//   2-space indent for top-level task keys
//   4-space indent for locale keys
//   6-space indent for TaskBody fields
//   single quotes for all string literals
//   trailing commas after every object/array element
// ---------------------------------------------------------------------------
const LOCALE_ORDER = ['en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'] as const;

export function renderCatalogFile(
  originalSrc: string,
  en: Record<string, TaskBody>,
  translated: Record<string, Record<string, TaskBody>>,
): string {
  // Find the data-block boundaries via the TS-AST so we don't fragile-match
  // on comment text or string contents that happen to mention the const.
  const sf = ts.createSourceFile(
    'taskCatalog.i18n.ts',
    originalSrc,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );

  let dataStmt: ts.VariableStatement | undefined;
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (
          decl.name &&
          ts.isIdentifier(decl.name) &&
          decl.name.text === 'TASK_CATALOG_I18N'
        ) {
          dataStmt = stmt;
          break;
        }
      }
    }
    if (dataStmt) break;
  }
  if (!dataStmt) {
    throw new Error(
      '[task-catalog-generate] TASK_CATALOG_I18N statement not found — cannot rewrite file',
    );
  }

  const dataStart = dataStmt.getFullStart();
  const dataEnd = dataStmt.getEnd();
  // getFullStart includes leading trivia (whitespace + comments preceding the
  // statement). We want to preserve those in the header, so use the leading-
  // trivia-aware start. dataStmt.getStart(sf, false) skips leading trivia.
  const headerEnd = dataStmt.getStart(sf, /*includeJsDoc*/ false);
  const header = originalSrc.slice(0, headerEnd);
  const footer = originalSrc.slice(dataEnd);
  // We intentionally swallow ANY whitespace/newlines between header end and
  // footer start by reading them from the original — they live in the
  // original between header end and dataStart-leading-trivia start.
  void dataStart; // referenced for clarity; not used directly

  const dataBlock = renderDataBlock(en, translated);
  return header + dataBlock + footer;
}

function renderDataBlock(
  en: Record<string, TaskBody>,
  translated: Record<string, Record<string, TaskBody>>,
): string {
  const lines: string[] = [];
  lines.push('export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {');
  for (const taskName of Object.keys(en)) {
    const key = formatPropertyKey(taskName);
    lines.push(`  ${key}: {`);
    for (const loc of LOCALE_ORDER) {
      let body: TaskBody;
      if (loc === 'en') {
        body = en[taskName]!;
      } else {
        const locCatalog = translated[loc];
        const candidate = locCatalog?.[taskName];
        // Fallback to en if the LLM somehow dropped this task — the validator
        // should have rejected the response before we got here, but defense
        // in depth keeps the rendered file syntactically valid.
        body = candidate ?? en[taskName]!;
      }
      const locKey = formatPropertyKey(loc);
      lines.push(`    ${locKey}: {`);
      lines.push(`      name: ${formatStringLiteral(body.name)},`);
      lines.push(`      description: ${formatStringLiteral(body.description)},`);
      lines.push(`      instructions: ${formatStringArray(body.instructions, 6)},`);
      lines.push(`      examples: ${formatStringArray(body.examples, 6)},`);
      lines.push('    },');
    }
    lines.push('  },');
  }
  lines.push('};');
  return lines.join('\n');
}

/** Quote a property key only when it isn't a bare TS identifier. Mirrors the original file style. */
function formatPropertyKey(name: string): string {
  // BCP-47 locale tags (`pt-BR`, `hi-IN`) and task names with spaces / hyphens
  // need quoting. Bare identifiers (letters, digits, underscore, $) don't.
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return name;
  return formatStringLiteral(name);
}

/**
 * Format a string as a TS single-quoted literal. Single quotes get backslash-
 * escaped; backslashes get doubled; control chars use \\u escapes.
 * For lossless round-trip we also need to escape newline / tab / form-feed /
 * vertical-tab.
 */
function formatStringLiteral(s: string): string {
  let out = "'";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === "'") out += "\\'";
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\v') out += '\\v';
    else if (ch === '\0') out += '\\0';
    else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += ch;
  }
  out += "'";
  return out;
}

/** Format an array of strings for the rendered file. Empty → []; one element → single-line; many → multi-line. */
function formatStringArray(arr: string[], baseIndent: number): string {
  if (arr.length === 0) return '[]';
  if (arr.length === 1) return `[${formatStringLiteral(arr[0]!)}]`;
  const pad = ' '.repeat(baseIndent);
  const innerPad = ' '.repeat(baseIndent + 2);
  const inner = arr.map((s) => `${innerPad}${formatStringLiteral(s)},`).join('\n');
  return `[\n${inner}\n${pad}]`;
}

// ---------------------------------------------------------------------------
// LLM call wrapper (per locale).
// ---------------------------------------------------------------------------
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
      {
        role: 'user',
        content: taskCatalogUserPromptFor(
          LOCALE_NAMES[loc],
          enCatalog as unknown as Record<string, unknown>,
        ),
      },
    ],
  });
  const text = response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { type: string; text?: string }) => b.text ?? '')
    .join('');
  const parsed = parseTaskCatalogResponse(text);
  const v = validateTaskCatalogShape(enCatalog, parsed);
  if (!v.ok) {
    throw new Error(
      `[task-catalog-generate] ${loc} shape errors: ${v.errors.slice(0, 5).join('; ')}`,
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Audit sidecar.
// ---------------------------------------------------------------------------
export function buildAuditSidecar(
  enSource: string,
  locales: Record<string, string>,
  tasksTranslated: number,
): Record<string, unknown> {
  return {
    model: MODEL_ID,
    generated_at: new Date().toISOString(),
    brief_version: TASK_CATALOG_BRIEF_VERSION,
    en_source_sha: createHash('sha256').update(enSource, 'utf8').digest('hex'),
    locales_generated: locales,
    tasks_translated: tasksTranslated,
  };
}

// ---------------------------------------------------------------------------
// CLI entry.
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      '[task-catalog-generate] ANTHROPIC_API_KEY not set. Create tools/.env from tools/.env.example and re-run.',
    );
    process.exit(2);
  }

  const repoRoot = resolve(import.meta.dirname, '..', '..');
  const catalogPath = resolve(repoRoot, 'apps/mobile/src/i18n/taskCatalog.i18n.ts');
  const auditPath = resolve(repoRoot, 'apps/mobile/src/i18n/taskCatalog.audit.json');

  const enSource = readFileSync(catalogPath, 'utf8');
  const enCatalog = extractEnSlots(enSource);
  const taskCount = Object.keys(enCatalog).length;
  console.log(
    `[task-catalog-generate] extracted ${taskCount} en task entries from ${catalogPath}`,
  );
  if (taskCount === 0) {
    console.error('[task-catalog-generate] no en tasks extracted — aborting');
    process.exit(1);
  }

  const client = new Anthropic();
  const generated: Record<string, Record<string, TaskBody>> = {};
  const auditEntries: Record<string, string> = {};

  for (const loc of TARGET_LOCALES) {
    console.log(`[task-catalog-generate] ${loc}: calling Claude Opus 4.7...`);
    try {
      generated[loc] = await generateTaskCatalogLocale(client, loc, enCatalog);
      auditEntries[loc] = new Date().toISOString();
      console.log(
        `[task-catalog-generate] ${loc}: OK (${Object.keys(generated[loc]).length} tasks)`,
      );
    } catch (e) {
      console.error(`[task-catalog-generate] ${loc}: FAILED —`, (e as Error).message);
      console.error('[task-catalog-generate] aborting; fix prompt or re-run');
      process.exit(1);
    }
  }

  const newFile = renderCatalogFile(enSource, enCatalog, generated);
  writeFileSync(catalogPath, newFile);
  writeFileSync(
    auditPath,
    JSON.stringify(buildAuditSidecar(enSource, auditEntries, taskCount), null, 2) + '\n',
  );

  console.log(
    `[task-catalog-generate] done — ${taskCount} tasks × ${TARGET_LOCALES.length} locales committed to ${catalogPath}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
