// Tiny M.m.p semver comparator — D-UPG-06.
//
// RESEARCH § Don't Hand-Roll permits the hand-roll for the constrained
// shape (`installedVersion` is the Android `BuildConfig.VERSION_NAME`
// string, always M.m.p with optional patch). Bringing the full `semver`
// dep would be ~80 KB for one comparator on the splash hot-path.
//
// Numeric segment compare guards against accidental string ordering
// where "0.10.0" would sort before "0.1.0" lexicographically.

/**
 * Parse an `M.m.p` version string into a 3-tuple of integers.
 * Missing patch (`0.1`) defaults to 0.
 *
 * Throws on any string that doesn't match the constrained shape; the caller
 * is responsible for guarding non-version inputs (BuildConfig is always
 * well-formed, so the throw is a programmer-error guard, not a runtime one).
 */
export function parseSemver(s: string): [number, number, number] {
  const m = s.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error(`invalid semver: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? '0')];
}

/**
 * Compare two `M.m.p` version strings. Returns:
 *   -1  if a <  b
 *    0  if a == b
 *    1  if a >  b
 *
 * Each segment is parsed as a number so `0.10.0 > 0.1.0` (numeric, not
 * lexicographic).
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}
