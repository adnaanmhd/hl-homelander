// build-help-content — verifies the HELP-01 ordering invariant + each
// accordion's parsed shape against the canonical help-center-content.md at
// the repo root. Reads the source markdown directly (the build script's input)
// rather than the baked content.json, so any drift between markdown and
// parser surfaces here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error — .mjs ESM import from a TypeScript test file. The script
// is intentionally vanilla ESM so it can be executed by `node` without a TS
// toolchain at build time.
import { parseHelpCenter } from '../../scripts/build-help-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(resolve(__dirname, '../../../../help-center-content.md'), 'utf-8');

interface Accordion {
  id: string;
  title: string;
  items: Array<
    | { kind: 'subsection'; heading: string; body: string }
    | { kind: 'qa'; question: string; answer: string }
    | { kind: 'issue'; heading: string; resolution: string }
  >;
}

interface Parsed {
  accordions: Accordion[];
  contactSupport: { headline: string; body: string };
}

describe('build-help-content', () => {
  it('parses 3 accordions in HELP-01 order', () => {
    const parsed = parseHelpCenter(md) as Parsed;
    expect(parsed.accordions.map((a) => a.id)).toEqual([
      'instructions-guide',
      'faqs',
      'troubleshooting',
    ]);
  });

  it('Instructions Guide has all 7 subsections', () => {
    const parsed = parseHelpCenter(md) as Parsed;
    const ig = parsed.accordions.find((a) => a.id === 'instructions-guide')!;
    const headings = ig.items.map((i) => (i as { heading: string }).heading);
    expect(headings).toEqual([
      'Before you record',
      'Starting a recording',
      'While recording',
      'Stopping a recording',
      'Your first recording (Practice)',
      'Uploads',
      'Payouts',
    ]);
  });

  it('FAQs accordion has multiple Q/A pairs (kind=qa)', () => {
    const parsed = parseHelpCenter(md) as Parsed;
    const faqs = parsed.accordions.find((a) => a.id === 'faqs')!;
    expect(faqs.items.length).toBeGreaterThanOrEqual(10);
    expect(faqs.items[0]?.kind).toBe('qa');
    const first = faqs.items[0] as { kind: 'qa'; question: string; answer: string };
    expect(first.question).toMatch(/.+/);
    expect(first.answer).toMatch(/.+/);
  });

  it('Troubleshooting accordion items use kind=issue', () => {
    const parsed = parseHelpCenter(md) as Parsed;
    const ts = parsed.accordions.find((a) => a.id === 'troubleshooting')!;
    expect(ts.items.length).toBeGreaterThanOrEqual(5);
    expect(ts.items[0]?.kind).toBe('issue');
    const first = ts.items[0] as { kind: 'issue'; heading: string; resolution: string };
    expect(first.heading).toMatch(/.+/);
    expect(first.resolution).toMatch(/.+/);
  });

  it('Contact Support body contains [EMAIL_ADDRESS] placeholder until OPEN QUESTION resolves', () => {
    const parsed = parseHelpCenter(md) as Parsed;
    expect(parsed.contactSupport.body).toContain('[EMAIL_ADDRESS]');
  });
});
