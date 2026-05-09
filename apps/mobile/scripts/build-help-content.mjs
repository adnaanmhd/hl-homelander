#!/usr/bin/env node
/**
 * D-HELP-01 — bake help-center-content.md into a typed JSON for HelpCenterScreen
 * to render. Runs at npm prebuild (committed JSON for review; no runtime
 * markdown dependency).
 *
 * Schema:
 *   {
 *     accordions: [
 *       {
 *         id: 'instructions-guide' | 'faqs' | 'troubleshooting',
 *         title: 'Instructions Guide' | 'FAQs' | 'Troubleshooting',
 *         items: [
 *           { kind: 'subsection', heading: string, body: string }   // Instructions Guide
 *         | { kind: 'qa', question: string, answer: string }         // FAQs
 *         | { kind: 'issue', heading: string, resolution: string }   // Troubleshooting
 *         ]
 *       }, ...
 *     ],
 *     contactSupport: { headline: string, body: string }
 *   }
 *
 * Source of truth: `help-center-content.md` at the repo root. The HELP-01 order
 * invariant (`instructions-guide`, `faqs`, `troubleshooting`) is asserted in
 * `main()` so a malformed markdown commit fails the build instead of shipping
 * broken content.
 *
 * Why ESM .mjs (not .ts): keeps the script zero-dep and runnable from any
 * Node 20+ shell without a TypeScript toolchain (vitest tests import the parser
 * via `@ts-ignore` since the consumer is JS-only). The build step is a single
 * `node scripts/build-help-content.mjs` call wired into the `prebuild` npm
 * script, so installing dependencies / running the dev server transparently
 * re-bakes the JSON whenever the source markdown changes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(__dirname, '../../../help-center-content.md');
const OUT = resolve(__dirname, '../src/screens/help/content.json');

/**
 * Parse the help-center-content.md file into the schema described in the
 * top-of-file doc comment. Pure function — no fs side-effects so vitest can
 * call it on a fixture-loaded string.
 */
export function parseHelpCenter(md) {
  const lines = md.split(/\r?\n/);

  const accordions = [];
  const contactSupport = { headline: 'Need more help?', body: '' };

  /** Currently-open accordion (or `__contact` for the Contact Support section). */
  let currentAccordion = null;
  /** Heading text of the item in progress (subsection / question / issue). */
  let pendingItem = null;
  /** Lines collected for the in-progress item's body. */
  let bodyLines = [];

  const flushItem = () => {
    if (!pendingItem || !currentAccordion) return;
    if (currentAccordion.id === '__contact') {
      // Should not happen — contact section uses its own line accumulator
      // path below, never `pendingItem`.
      pendingItem = null;
      bodyLines = [];
      return;
    }
    const body = bodyLines.join('\n').trim();
    if (currentAccordion.id === 'instructions-guide') {
      currentAccordion.items.push({ kind: 'subsection', heading: pendingItem, body });
    } else if (currentAccordion.id === 'faqs') {
      currentAccordion.items.push({ kind: 'qa', question: pendingItem, answer: body });
    } else if (currentAccordion.id === 'troubleshooting') {
      currentAccordion.items.push({ kind: 'issue', heading: pendingItem, resolution: body });
    }
    pendingItem = null;
    bodyLines = [];
  };

  for (const line of lines) {
    // ## 1. Instructions Guide / 2. FAQs / 3. Troubleshooting / Contact Support
    const h2 = line.match(/^## (?:\d+\. )?(.+)$/);
    if (h2) {
      flushItem();
      currentAccordion = null;
      const title = h2[1].trim();
      if (title === 'Instructions Guide') {
        currentAccordion = { id: 'instructions-guide', title: 'Instructions Guide', items: [] };
        accordions.push(currentAccordion);
      } else if (title === 'FAQs') {
        currentAccordion = { id: 'faqs', title: 'FAQs', items: [] };
        accordions.push(currentAccordion);
      } else if (title === 'Troubleshooting') {
        currentAccordion = {
          id: 'troubleshooting',
          title: 'Troubleshooting',
          items: [],
        };
        accordions.push(currentAccordion);
      } else if (title === 'Contact Support') {
        currentAccordion = { id: '__contact', items: [] };
      }
      continue;
    }

    // ### Subsection (Instructions Guide only).
    const h3 = line.match(/^### (.+)$/);
    if (h3 && currentAccordion?.id === 'instructions-guide') {
      flushItem();
      pendingItem = h3[1].trim();
      continue;
    }

    // **Question** (FAQs and Troubleshooting both use bold-only Q-headlines).
    // Trim is defensive — markdown editors occasionally leave a trailing space.
    const bold = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (bold && (currentAccordion?.id === 'faqs' || currentAccordion?.id === 'troubleshooting')) {
      flushItem();
      pendingItem = bold[1].trim();
      continue;
    }

    if (currentAccordion?.id === '__contact') {
      contactSupport.body += (contactSupport.body ? '\n' : '') + line.trim();
      continue;
    }

    if (pendingItem != null) {
      bodyLines.push(line);
    }
  }
  flushItem();

  // Strip horizontal-rule markers from the contact body and collapse leading
  // / trailing whitespace.
  contactSupport.body = contactSupport.body.replace(/^---+$/gm, '').trim();

  return { accordions, contactSupport };
}

function main() {
  const md = readFileSync(SOURCE, 'utf-8');
  const parsed = parseHelpCenter(md);

  // HELP-01 invariant baked into the script so a malformed markdown commit
  // fails the build with a useful message.
  const order = parsed.accordions.map((a) => a.id);
  const expected = ['instructions-guide', 'faqs', 'troubleshooting'];
  if (order.length !== 3 || order.some((id, i) => id !== expected[i])) {
    throw new Error(
      `HELP-01 violation: expected accordions [${expected.join(', ')}], got [${order.join(', ')}]`,
    );
  }
  if (parsed.accordions.some((a) => a.items.length === 0)) {
    throw new Error(
      'HELP-02 violation: at least one accordion has 0 items — check help-center-content.md formatting',
    );
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `build-help-content: wrote ${OUT} (${parsed.accordions.length} accordions, ${parsed.accordions.reduce((n, a) => n + a.items.length, 0)} items)`,
  );
}

// Allow import without execution for tests. process.argv[1] is the absolute
// path of the entry script when invoked directly via `node scripts/...`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
