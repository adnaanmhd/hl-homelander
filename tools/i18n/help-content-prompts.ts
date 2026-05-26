/**
 * Translation prompts specific to Help Center body content.
 *
 * Plan 07-13 — closes G-10 / fulfills D-03.
 *
 * The Help Center body is hand-written prose mixed with markdown markers
 * (bold, italic, ordered/unordered lists, headings, links, code spans).
 * The vernacular brief in `prompts.ts` covers the *register* (everyday
 * conversational, vernacular, avoid loanwords). The HELP_CONTENT brief
 * below ADDS the structural-preservation rules — the LLM is forbidden
 * from changing markdown markers, URLs, or stable identifiers, and
 * must output strict JSON matching the en source shape.
 */

/** Version stamp recorded in content.audit.json; bump when the brief changes. */
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
  - *italic* / _italic_ markers stay around the translated italic text.
  - Numbered lists (1. 2. 3.) stay as numbered lists in the same order.
  - Bullet lists (- text or * text) stay as bullet lists in the same order.
  - # Heading, ## Subheading lines keep their hash markers.
  - [link text](url) — translate "link text" but DO NOT change the url.
  - Code spans \`like this\` stay as code spans; do NOT translate the text inside backticks.
  - Newlines and paragraph breaks (\\n, \\n\\n) stay in the same positions.
  - Horizontal rules (---) stay as ---.
- DO NOT translate the "id" field of each accordion — it is a stable identifier.
- DO NOT translate the "kind" field of each item — it is a stable enum.
- DO NOT translate URLs, email addresses, or content inside backticks.
- DO NOT translate the brand name "Humyn Labs" or "Humyn Labs Capture".
- Translate the title, heading, body, question, answer, resolution string values.
- Translate the contactSupport.headline and contactSupport.body string values.
- Output STRICT JSON only — no markdown fences around the JSON itself, no
  commentary before or after the JSON, no trailing prose. Just the JSON object.
`.trim();

export function helpContentUserPromptFor(
  localeName: string,
  enContent: Record<string, unknown>,
): string {
  return (
    `Translate this Help Center content to ${localeName}. Keep the JSON ` +
    `structure exactly: only the human-readable string VALUES get translated. ` +
    `The "id" field of each accordion and the "kind" field of each item are ` +
    `stable identifiers — leave them untouched byte-for-byte. Return the ` +
    `full JSON object, nothing else.\n\n${JSON.stringify(enContent, null, 2)}`
  );
}
