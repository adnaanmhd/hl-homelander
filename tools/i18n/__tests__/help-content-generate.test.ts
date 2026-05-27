/**
 * Unit tests for validateHelpContentShape and parseHelpContentResponse
 * from help-content-generate.ts.
 *
 * Plan 07-13 Task 1 — closes G-10 (Help Center body translation) at the
 * validator level. The real LLM call is exercised in Task 2; here we
 * test the JSON-shape gate that protects against LLM hallucination.
 *
 * The Help Center content.json shape (3 accordions × N items; items
 * are tagged unions of kind: 'subsection' | 'qa' | 'issue') is richer
 * than the simplified sketch in the PLAN's <interfaces> block. The
 * validator must walk:
 *
 *   accordions[]
 *     id: string (NEVER translated — stable identifier)
 *     title: string (translated)
 *     items[]
 *       kind: 'subsection' | 'qa' | 'issue' (NEVER translated)
 *       (subsection) heading + body
 *       (qa)         question + answer
 *       (issue)      heading + resolution
 *   contactSupport
 *     headline: string (translated)
 *     body: string (translated)
 *
 * The validator enforces:
 *  - top-level shape exists (accordions array + contactSupport object)
 *  - accordions count matches en
 *  - per-accordion: id matches en, items count matches en
 *  - per-item: kind matches en, the kind-specific string fields exist
 *  - contactSupport.headline + body exist as strings
 *
 * Drift in any of the above gets rejected — the LLM is forbidden from
 * dropping an item, hallucinating an extra accordion, or changing an id.
 */
import { describe, it, expect } from 'vitest';
import {
  validateHelpContentShape,
  parseHelpContentResponse,
  type HelpContent,
} from '../help-content-generate.js';

const sampleEn: HelpContent = {
  accordions: [
    {
      id: 'instructions-guide',
      title: 'Instructions Guide',
      items: [
        { kind: 'subsection', heading: 'Before you record', body: 'Mount your phone...' },
        { kind: 'subsection', heading: 'Starting a recording', body: 'Open the task...' },
      ],
    },
    {
      id: 'faqs',
      title: 'FAQs',
      items: [
        { kind: 'qa', question: 'What kind of phone?', answer: 'A phone with...' },
        { kind: 'qa', question: 'Can I record children?', answer: 'No.' },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      items: [{ kind: 'issue', heading: "Recording won't start", resolution: 'Phone too warm...' }],
    },
  ],
  contactSupport: {
    headline: 'Need more help?',
    body: 'Tap Contact Support...',
  },
};

describe('validateHelpContentShape', () => {
  it('accepts a well-shaped translated catalog (Hindi/Devanagari sample)', () => {
    const translated: HelpContent = {
      accordions: [
        {
          id: 'instructions-guide',
          title: 'निर्देश गाइड',
          items: [
            {
              kind: 'subsection',
              heading: 'रिकॉर्ड करने से पहले',
              body: 'अपने फोन को माउंट करें...',
            },
            {
              kind: 'subsection',
              heading: 'रिकॉर्डिंग शुरू करना',
              body: 'टास्क खोलें...',
            },
          ],
        },
        {
          id: 'faqs',
          title: 'सामान्य प्रश्न',
          items: [
            { kind: 'qa', question: 'मुझे कैसा फोन चाहिए?', answer: 'एक ऐसा फोन...' },
            { kind: 'qa', question: 'क्या मैं बच्चों को रिकॉर्ड कर सकता हूं?', answer: 'नहीं।' },
          ],
        },
        {
          id: 'troubleshooting',
          title: 'समस्या निवारण',
          items: [
            {
              kind: 'issue',
              heading: 'रिकॉर्डिंग शुरू नहीं होगी',
              resolution: 'फोन बहुत गर्म...',
            },
          ],
        },
      ],
      contactSupport: { headline: 'और मदद चाहिए?', body: 'संपर्क करें...' },
    };
    const v = validateHelpContentShape(sampleEn, translated);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('rejects non-object input', () => {
    const v = validateHelpContentShape(sampleEn, 'not an object');
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it('rejects null input', () => {
    const v = validateHelpContentShape(sampleEn, null);
    expect(v.ok).toBe(false);
  });

  it('rejects when accordions is missing', () => {
    const v = validateHelpContentShape(sampleEn, { contactSupport: sampleEn.contactSupport });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /accordions/.test(e))).toBeDefined();
  });

  it('rejects when accordions count differs', () => {
    const v = validateHelpContentShape(sampleEn, {
      accordions: [sampleEn.accordions[0]],
      contactSupport: sampleEn.contactSupport,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /count mismatch/.test(e))).toBeDefined();
  });

  it('rejects when an accordion id differs (drift in stable identifier)', () => {
    const drifted = JSON.parse(JSON.stringify(sampleEn)) as HelpContent;
    drifted.accordions[0]!.id = 'WRONG-ID';
    const v = validateHelpContentShape(sampleEn, drifted);
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /id mismatch/.test(e))).toBeDefined();
  });

  it('rejects when an item count under an accordion differs', () => {
    const drifted = JSON.parse(JSON.stringify(sampleEn)) as HelpContent;
    drifted.accordions[0]!.items = [drifted.accordions[0]!.items[0]!];
    const v = validateHelpContentShape(sampleEn, drifted);
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /item count mismatch/.test(e))).toBeDefined();
  });

  it('rejects when an item kind differs (subsection became qa)', () => {
    const drifted = JSON.parse(JSON.stringify(sampleEn)) as HelpContent;
    (drifted.accordions[0]!.items[0] as unknown as Record<string, unknown>) = {
      kind: 'qa',
      question: 'X',
      answer: 'Y',
    };
    const v = validateHelpContentShape(sampleEn, drifted);
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /kind mismatch/.test(e))).toBeDefined();
  });

  it('rejects when a subsection body is not a string', () => {
    const drifted = JSON.parse(JSON.stringify(sampleEn)) as HelpContent;
    (drifted.accordions[0]!.items[0] as unknown as Record<string, unknown>).body = 42;
    const v = validateHelpContentShape(sampleEn, drifted);
    expect(v.ok).toBe(false);
  });

  it('rejects when a qa answer is not a string', () => {
    const drifted = JSON.parse(JSON.stringify(sampleEn)) as HelpContent;
    (drifted.accordions[1]!.items[0] as unknown as Record<string, unknown>).answer = null;
    const v = validateHelpContentShape(sampleEn, drifted);
    expect(v.ok).toBe(false);
  });

  it('rejects when an issue resolution is not a string', () => {
    const drifted = JSON.parse(JSON.stringify(sampleEn)) as HelpContent;
    (drifted.accordions[2]!.items[0] as unknown as Record<string, unknown>).resolution = false;
    const v = validateHelpContentShape(sampleEn, drifted);
    expect(v.ok).toBe(false);
  });

  it('rejects when contactSupport is missing', () => {
    const v = validateHelpContentShape(sampleEn, { accordions: sampleEn.accordions });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /contactSupport/.test(e))).toBeDefined();
  });

  it('rejects when contactSupport.headline is not a string', () => {
    const v = validateHelpContentShape(sampleEn, {
      accordions: sampleEn.accordions,
      contactSupport: { headline: 12, body: 'X' },
    });
    expect(v.ok).toBe(false);
  });
});

describe('parseHelpContentResponse', () => {
  it('parses a clean JSON response', () => {
    const text = JSON.stringify(sampleEn);
    const parsed = parseHelpContentResponse(text);
    expect(parsed.accordions.length).toBe(3);
  });

  it('strips ```json markdown fences', () => {
    const text = '```json\n' + JSON.stringify(sampleEn) + '\n```';
    const parsed = parseHelpContentResponse(text);
    expect(parsed.accordions.length).toBe(3);
  });

  it('strips bare ``` fences', () => {
    const text = '```\n' + JSON.stringify(sampleEn) + '\n```';
    const parsed = parseHelpContentResponse(text);
    expect(parsed.accordions.length).toBe(3);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseHelpContentResponse('this is not json at all')).toThrow();
  });
});
