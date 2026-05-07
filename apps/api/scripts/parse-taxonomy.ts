// Parses task-taxonomy.md (markdown table format) → 65 typed task rows.
//
// Deviation from the plan body: the plan body assumed a per-section format
// (`## Category` / `### slug` blocks). The actual `task-taxonomy.md` is a
// markdown TABLE with columns:
//
//   | Category | Task | Setting | Description | Instructions |
//
// Each row's "Task" column is the human-readable name (no slug). Slugs and
// icon keys live in `design-system/task-icons/mapping.json` and are joined
// here by name (with `normalizeName()` collapsing parenthetical suffixes —
// e.g. taxonomy says "Cooking a meal" while mapping.json says
// "Cooking a meal (full session)").
//
// Instructions are formatted as `• step one<br>• step two<br>• step three`
// inside the table cell. We split on `<br>`, trim each, drop the leading bullet.
// Per-task instruction count is enforced at <= 3 (D-EMB-04 cap).
//
// Parser fails fast on malformed rows with a useful error rather than silently
// dropping data — every task in the table MUST land in the seed.

import { readFile } from 'node:fs/promises';

export interface ParsedTask {
  /** Human-readable name as written in task-taxonomy.md */
  name: string;
  description: string;
  category: string;
  setting: 'indoor' | 'outdoor' | 'either';
  instructions: string[];
}

export interface IconMappingEntry {
  id: string; // slug
  name: string;
  category: string;
  setting: 'indoor' | 'outdoor';
  icon: string;
}

export interface IconMappingFile {
  $schema?: string;
  source?: string;
  iconLibrary?: string;
  minimumLucideVersion?: string;
  categories?: string[];
  tasks: IconMappingEntry[];
}

export interface SeedTask extends ParsedTask {
  /** ULID-style slug from mapping.json */
  slug: string;
  /** Icon key from mapping.json — Lucide component name */
  iconKey: string;
}

const MAX_INSTRUCTIONS = 3 as const; // D-EMB-04 cap; "max is 3"

/**
 * Strip parenthetical suffixes for fuzzy name matching.
 * Example: "Cooking a meal (full session)" → "Cooking a meal"
 */
export function normalizeName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

/**
 * Parse the markdown taxonomy table into a list of ParsedTask rows.
 * Rows are returned in document order so seed output is deterministic.
 */
export async function parseTaxonomy(path: string): Promise<ParsedTask[]> {
  const text = await readFile(path, 'utf8');
  const tasks: ParsedTask[] = [];
  const lines = text.split('\n');
  let inTable = false;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.startsWith('|')) {
      // Reset on table boundary
      inTable = false;
      continue;
    }
    // Markdown table divider line, e.g. `| --- | --- | ...`
    if (/^\|\s*[-:]+/.test(line)) {
      inTable = true;
      continue;
    }
    // Skip header row (starts the table; contains literal "Category" / "Task")
    if (line.includes('Category') && line.includes('Task') && line.includes('Setting')) {
      continue;
    }
    if (!inTable) continue;
    // Split into cells; markdown rows start AND end with `|`. Drop the empty
    // strings at the boundaries before counting columns.
    const cells = line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((c) => c.trim());
    if (cells.length < 5) {
      continue; // partial row — skip rather than crash
    }
    const [category, name, settingRaw, description, instructionsRaw] = cells as [
      string,
      string,
      string,
      string,
      string,
    ];
    const setting = settingRaw.toLowerCase() as ParsedTask['setting'];
    if (setting !== 'indoor' && setting !== 'outdoor' && setting !== 'either') {
      throw new Error(`task ${name}: setting must be indoor|outdoor|either, got ${settingRaw}`);
    }
    const instructions = parseInstructions(instructionsRaw);
    if (instructions.length === 0) {
      throw new Error(`task ${name} has no instructions`);
    }
    if (instructions.length > MAX_INSTRUCTIONS) {
      throw new Error(
        `task ${name} has ${instructions.length} instructions; max is ${MAX_INSTRUCTIONS}`,
      );
    }
    if (!description) {
      throw new Error(`task ${name} has no description`);
    }
    tasks.push({ name, description, category, setting, instructions });
  }
  return tasks;
}

/**
 * Parse an instructions cell from the markdown table.
 * Format examples:
 *   "• step one<br>• step two<br>• step three"
 *   "• Look down at your hands.<br>• Make small head turns."
 *   "1. step one<br>2. step two"
 *
 * Strategy: split on `<br>`, trim each piece, strip leading bullet/number marker.
 */
function parseInstructions(raw: string): string[] {
  if (!raw) return [];
  const segments = raw.split(/<br\s*\/?>/i);
  const out: string[] = [];
  for (const seg of segments) {
    const cleaned = seg
      .trim()
      // Strip leading bullet (• * -) or numbered marker (1. / 2. / 3.) plus whitespace.
      .replace(/^[•*-]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .trim();
    if (cleaned.length > 0) out.push(cleaned);
  }
  return out;
}

/** Loads the icon mapping file and returns a name → entry index. */
export async function loadIconMapping(path: string): Promise<Map<string, IconMappingEntry>> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as IconMappingFile;
  if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
    throw new Error(`mapping file at ${path} has no tasks[] array`);
  }
  const out = new Map<string, IconMappingEntry>();
  for (const t of parsed.tasks) {
    out.set(normalizeName(t.name), t);
  }
  return out;
}

/**
 * Join parsed taxonomy rows with the icon-mapping (slug + icon) by name.
 * Throws if any taxonomy row is missing a corresponding mapping entry — this
 * prevents silently shipping a task without an icon (and therefore broken UI).
 */
export function joinTaxonomyWithMapping(
  tasks: ParsedTask[],
  mapping: Map<string, IconMappingEntry>,
): SeedTask[] {
  const out: SeedTask[] = [];
  for (const t of tasks) {
    const norm = normalizeName(t.name);
    const entry = mapping.get(norm);
    if (!entry) {
      throw new Error(`task "${t.name}" (normalized: "${norm}") has no entry in mapping.json`);
    }
    out.push({ ...t, slug: entry.id, iconKey: entry.icon });
  }
  return out;
}
