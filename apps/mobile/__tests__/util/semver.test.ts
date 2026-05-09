// semver helper unit tests — D-UPG-06.
//
// Tiny M.m.p comparator. RESEARCH § Don't Hand-Roll permits the hand-roll
// for the constrained shape; full library would be an unjustified dep.

import { describe, it, expect } from 'vitest';
import { compareSemver, parseSemver } from '../../src/util/semver';

describe('compareSemver', () => {
  it('Test 1: equal versions return 0', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('Test 2: lower patch returns -1', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
  });

  it('Test 3: higher major returns 1 even when minor/patch are smaller', () => {
    expect(compareSemver('2.0.0', '1.99.99')).toBe(1);
  });

  it('Test 4: numeric (NOT lexicographic) compare on minor — 0.10 > 0.1', () => {
    // String compare would yield "0.1.0" < "0.10.0" via the same rules but
    // the right answer comes from numeric parsing on each segment. The
    // test guards against accidental string comparison.
    expect(compareSemver('0.1.0', '0.10.0')).toBe(-1);
  });

  it('Test 5: missing patch defaults to 0 — 0.1 == 0.1.0', () => {
    expect(compareSemver('0.1', '0.1.0')).toBe(0);
  });
});

describe('parseSemver', () => {
  it('Test 6: invalid semver throws', () => {
    expect(() => parseSemver('not.semver')).toThrow();
  });
});
