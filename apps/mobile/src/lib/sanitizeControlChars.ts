// Phase 6 item 1 (2026-06-10, Bug 6) — control-character sanitizer.
//
// Postgres rejects a NUL byte (U+0000) inside jsonb (22P05) and text (22021);
// other C0 controls are never legitimate in telemetry strings either. The
// known poison vector is a raw `err.message` landing in telemetry props (e.g.
// `signup_google_failed`), getting persisted into the MMKV ring, and then
// replaying inside EVERY subsequent /feedback diagnostic — one bad event made
// "Report a problem" 500 forever. The server now strips NUL defensively too
// (apps/api/src/routes/feedback/post.ts), but the client must stop SHIPPING
// poison: sanitize at ring-append time (the single choke point for analytics
// events) and over the whole snapshot + message before the multipart POST.
//
// \t \n \r are preserved — the user's typed message may legitimately contain
// them; they are storable and harmless. The regex is built at runtime because
// a control-char literal trips ESLint `no-control-regex` (same approach as
// the server's NUL_RE).

const C0_EXCEPT_TAB_LF_CR_RE = new RegExp(
  '[' +
    String.fromCharCode(0) +
    '-' +
    String.fromCharCode(8) +
    String.fromCharCode(11) +
    String.fromCharCode(12) +
    String.fromCharCode(14) +
    '-' +
    String.fromCharCode(31) +
    ']',
  'g',
);

// Review fix (2026-06-10) — LONE (unpaired) UTF-16 surrogates are the other
// Postgres-unstorable class (jsonb rejects the `\udXXX` escape with a 22xxx
// SQLSTATE): one length-truncated emoji in an err.message prop poisons the
// ring exactly like a NUL did, and the server's degrade path then drops the
// whole inline diagnostic. Matches a VALID surrogate pair first (kept) or any
// remaining (= lone) surrogate (replaced with U+FFFD). Lookbehind-free on
// purpose — Hermes 0.14 has neither `String.prototype.toWellFormed` nor
// reliable lookbehind (verified against the bundled libhermesvm).
const SURROGATE_PAIR_OR_LONE_RE = /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g;

/**
 * Strip C0 control chars (keeping \t \n \r) and replace lone surrogates with
 * U+FFFD, yielding a well-formed, Postgres-storable string.
 */
export function stripControlChars(s: string): string {
  return s
    .replace(C0_EXCEPT_TAB_LF_CR_RE, '')
    .replace(SURROGATE_PAIR_OR_LONE_RE, (m, pair: string | undefined) => pair ?? '�');
}

/** Deep-sanitize every string key + value in a JSON-ish structure. */
export function stripControlCharsDeep<T>(value: T): T {
  if (typeof value === 'string') return stripControlChars(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => stripControlCharsDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[stripControlChars(k)] = stripControlCharsDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
