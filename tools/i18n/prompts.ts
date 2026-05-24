/**
 * The vernacular brief locked in 07-CONTEXT.md D-10. MUST appear verbatim
 * as the Anthropic Messages.create `system` field. Do not paraphrase, do
 * not add structure — owner specified this exact string.
 */
export const VERNACULAR_BRIEF =
  'Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists.';

/** Version stamp recorded in audit sidecar; bump when the brief changes. */
export const BRIEF_VERSION = 1;

export function userPromptFor(localeName: string, enCatalog: unknown): string {
  return (
    `Translate this catalog to ${localeName}. Keep the JSON structure ` +
    `exactly; translate only the string VALUES. Return the full JSON, ` +
    `nothing else.\n\n${JSON.stringify(enCatalog, null, 2)}`
  );
}
