import { describe, it, expect } from 'vitest';
import { generateLocale, buildAuditSidecar } from '../generate.js';
import { VERNACULAR_BRIEF } from '../prompts.js';

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
