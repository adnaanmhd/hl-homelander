/**
 * Translation prompts specific to the task catalog body (G-08 closure).
 *
 * Plan 07-12 — closes G-08 / fulfills D-01 + D-15.
 *
 * The task catalog body is short imperative prose: each task has a
 * one-line `name`, a single-paragraph `description`, an array of
 * actionable second-person `instructions`, and an `examples` array that
 * is empty for every entry at MVP. The vernacular brief in `prompts.ts`
 * covers the *register* (everyday conversational, vernacular, avoid
 * loanwords). The TASK_VERNACULAR brief below ADDS:
 *
 *   - "Preserve the JSON structure EXACTLY" — the response must remain
 *     Record<TaskName, TaskBody> where TaskBody = { name; description;
 *     instructions[]; examples[] }.
 *   - "Do NOT change the top-level keys" — they are the canonical
 *     English task names used as object keys in the TypeScript file.
 *   - "Translate VALUES only" — names, descriptions, instructions
 *     get translated; examples stay [] (mirrors en).
 *   - "Instructions must remain actionable" — second-person imperative
 *     mood; do not turn them into descriptive prose.
 *   - "Strict JSON output, no markdown fences."
 *
 * The en slot is NEVER passed to the LLM (the regen tool sends an
 * en-only catalog as the input; the LLM produces a parallel catalog in
 * the target locale). The tool's renderer then merges: en stays
 * byte-identical from the source file; the 7 non-English locales are
 * overwritten with the LLM output.
 */

/** Version stamp recorded in taskCatalog.audit.json; bump when the brief changes. */
export const TASK_CATALOG_BRIEF_VERSION = 1;

export const TASK_VERNACULAR_BRIEF = `
You are translating a catalog of everyday task instructions for a mobile app
that records egocentric (head-mounted) video of users performing daily tasks.
The translated text appears on TaskDetailsSheet — users open this sheet
immediately before recording the task. The instructions guide the user's
physical actions; mistranslating them harms recording quality.

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
- The examples array is empty ([]) for every task in the en source — keep
  examples as [] in the translated output.
- Preserve the count and order of instructions for each task (no merging,
  no splitting, no reordering).
- Do NOT translate the brand name "Humyn Labs" or "Humyn Labs Capture" if
  it appears in any description.
- Output STRICT JSON only — no markdown fences around the JSON itself,
  no commentary before or after the JSON, no trailing prose. Just the
  JSON object mapping task names to translated bodies.
`.trim();

export function taskCatalogUserPromptFor(
  localeName: string,
  enCatalog: Record<string, unknown>,
): string {
  return (
    `Translate this task catalog to ${localeName}. Keep the JSON ` +
    `structure exactly: only the human-readable string VALUES get ` +
    `translated. The top-level keys (canonical English task names) ` +
    `are stable identifiers — leave them untouched byte-for-byte. ` +
    `The examples array stays [] for every task. Return the full ` +
    `JSON object, nothing else.\n\n${JSON.stringify(enCatalog, null, 2)}`
  );
}
