import { describe, it, expect } from 'vitest';
import { validateShapeParity } from '../validate.js';

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
