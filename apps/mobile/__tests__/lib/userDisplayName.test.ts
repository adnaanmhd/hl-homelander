import { describe, it, expect } from 'vitest';
import { coalesceDisplayName } from '../../src/lib/userDisplayName';

describe('coalesceDisplayName (UAT-2026-05-13 gap closure — V11-mirror name propagation)', () => {
  it('passes through a non-empty name unchanged', () => {
    expect(coalesceDisplayName('Alice', 'alice@example.com')).toBe('Alice');
  });
  it('trims whitespace from a non-empty name', () => {
    expect(coalesceDisplayName('  Alice  ', 'alice@example.com')).toBe('Alice');
  });
  it('falls back to email-local-part when name is null', () => {
    expect(coalesceDisplayName(null, 'alice@example.com')).toBe('alice');
  });
  it('falls back to email-local-part when name is empty string', () => {
    expect(coalesceDisplayName('', 'alice@example.com')).toBe('alice');
  });
  it('falls back to email-local-part when name is whitespace-only', () => {
    expect(coalesceDisplayName('   ', 'alice@example.com')).toBe('alice');
  });
  it('preserves + in email-local-part (gmail subaddressing)', () => {
    expect(coalesceDisplayName(null, 'tester+tag@example.com')).toBe('tester+tag');
  });
  it('returns null when both name and email are empty', () => {
    expect(coalesceDisplayName(null, '')).toBeNull();
    expect(coalesceDisplayName('', '')).toBeNull();
    expect(coalesceDisplayName('   ', '   ')).toBeNull();
  });
  it('returns null when both inputs are null', () => {
    expect(coalesceDisplayName(null, null)).toBeNull();
    expect(coalesceDisplayName(undefined, undefined)).toBeNull();
  });
  it('returns null when email-local-part is empty after trim', () => {
    // ' @example.com' has empty local-part after split + trim.
    expect(coalesceDisplayName(null, ' @example.com')).toBeNull();
  });
  it('handles the dev tester user shape (Tester / tester@example.com)', () => {
    // Sanity check matching the dev DB row from 05-HUMAN-UAT.md.
    expect(coalesceDisplayName('Tester', 'tester@example.com')).toBe('Tester');
  });
});
