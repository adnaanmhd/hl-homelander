// reverseSearch — locale-text → canonical-English shim for /tasks/search.
//
// Plan 07-06 Task 2 (I18N-10 / D-14 / D-15 / D-16). The user types a task
// name / fragment in their active locale; this shim rewrites it to the
// canonical English that the backend's ts_vector + GIN + pg_trgm fallback
// (Phase 6 plan 06-02) is indexed against. The backend route is UNCHANGED
// per D-16 — `/tasks/search` continues to consume English queries.
//
// 3-stage chain (D-14):
//   Stage 1 — NFC-normalized full-string lookup against the per-locale
//             fullStringMap derived from taskCatalog.i18n.ts. Hits when
//             the user types a complete localized task name (e.g.
//             'चाय बनाओ' → 'Make tea' once the LLM regen has populated hi-IN).
//   Stage 2 — whitespace tokenize, look up each token in the locale's
//             tokenMap, rebuild an English query from the matches. Hits
//             when the user types a partial/multi-word locale phrase that
//             aligns 1:1 with the English token count.
//   Stage 3 — passthrough (raw input). The backend pg_trgm threshold (0.3
//             per Phase 6 D-02) catches whatever Latin-script noise the
//             user typed; non-Latin script falls through to "no results"
//             which is the expected degraded state, not a bug.
//
// Skeleton-phase note (D-15): until the LLM regen tool populates the 7
// non-English entries in taskCatalog.i18n.ts, the localized name === the
// English name for every task. Stage 1 therefore resolves typed English
// to English (the identity); the reverse-search path is structurally live
// from the moment this file lands, and the string-value swap happens
// atomically when the regen tool commits the LLM output.
//
// PII / privacy posture: the user's input is locale text that gets
// rewritten to English. Both forms are POST-d to /tasks/search via the
// existing apiClient; no additional persistence here. The shim does NOT
// log the input or the rewrite outcome — keeps the surface auditable.
//
// Performance: the per-locale maps are built ONCE at module load by
// taskCatalog.i18n.ts (see buildReverseMaps); subsequent reverseSearch()
// calls are O(1) hash-map lookups + an NFD/NFC normalize on each token.

import {
  REVERSE_BY_LOCALE,
  normalizeForReverseSearch,
  EN_TOKEN_ALIASES,
  type ReverseMap,
} from './taskCatalog.i18n';

/**
 * Rewrite a locale-text task search input to canonical English.
 *
 * Returns the input verbatim when:
 *   - `locale === 'en'` AND no en alias entry matches (G-13 closure,
 *     Plan 07-16: en tokens are rewritten via EN_TOKEN_ALIASES so
 *     "recyclable"/"recycle"/"recycling" all hit the indexed "recyclables"
 *     stem regardless of Snowball-stemmer config drift on the server)
 *   - the locale has no reverse map (e.g. an out-of-allowlist BCP-47 tag
 *     that somehow leaks past i18n.changeLanguage)
 *   - none of Stages 1/2 hit (Stage-3 passthrough)
 *
 * For all other cases returns the canonical English equivalent.
 */
export function reverseSearch(input: string, locale: string): string {
  if (locale === 'en') {
    // G-13 (Plan 07-16 Task 3): rewrite each whitespace-token through the
    // curated alias map. Tokens absent from the map pass through unchanged
    // (the previous identity behaviour for the en branch).
    return input
      .split(/\s+/)
      .filter(Boolean)
      .map((tok) => EN_TOKEN_ALIASES[tok.toLowerCase()] ?? tok)
      .join(' ');
  }

  const map: ReverseMap | undefined = REVERSE_BY_LOCALE[locale];
  if (!map) return input;

  const normalized = normalizeForReverseSearch(input);
  if (!normalized) return input;

  // Stage 1 — full-string lookup.
  const fullStringHit = map.fullStringMap[normalized];
  if (fullStringHit) return fullStringHit;

  // Stage 1.5 — substring lookup against the localized full-name catalog.
  // Plan 07-17 re-walk 2026-05-27: partial Hindi queries (a single
  // Devanagari word like "खाना" or "बर्तन") used to fall through to
  // Stage 2's token map, which is built only when localized + English
  // names tokenize to the SAME COUNT — a fragile heuristic that
  // produced wrong English ("खाना बनाना" → "खाना coffee") or no
  // mapping at all ("खाना" → unchanged → server gets Hindi → 0 hits).
  //
  // 1.5a: scan for any localized name that CONTAINS the normalized
  // user input as a substring. First hit's canonical English name is
  // returned. Catches the common "user types one Hindi word" case.
  // 1.5b: if 1.5a misses, tokenize the input and for each token find
  // every catalog name containing it; aggregate the canonical English
  // names (de-duped, capped at 5) and return them as a space-joined
  // multi-keyword query. The server's ts_vector matches any of them.
  // Both pass before Stage 2's fragile token-count-match. O(N×|q|) per
  // keystroke where N ≈ 86 tasks — well within the 200ms debounce
  // budget. D-16 still holds (no backend changes).
  for (const [localizedNorm, canonical] of Object.entries(map.fullStringMap)) {
    if (localizedNorm.includes(normalized)) return canonical;
  }
  const inputTokens = normalized.split(/\s+/).filter(Boolean);
  if (inputTokens.length > 0) {
    const englishCandidates = new Set<string>();
    for (const tok of inputTokens) {
      for (const [localizedNorm, canonical] of Object.entries(map.fullStringMap)) {
        if (localizedNorm.includes(tok)) {
          englishCandidates.add(canonical);
          if (englishCandidates.size >= 5) break;
        }
      }
      if (englishCandidates.size >= 5) break;
    }
    if (englishCandidates.size > 0) {
      return [...englishCandidates].join(' ');
    }
  }

  // Stage 2 — token fallback. Rebuild an English string by mapping each
  // normalized localized token via the per-locale tokenMap; tokens that
  // don't match stay as-is (the backend pg_trgm threshold catches them).
  // We return the Stage-2 rebuild only when at least one token actually
  // mapped — otherwise it's identical to Stage-3 passthrough. Kept as a
  // last-resort safety net before passthrough — Stage 1.5 should catch
  // most realistic queries first.
  const rawTokens = input.split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map(normalizeForReverseSearch);
  const mapped = normalizedTokens.map((t) => map.tokenMap[t] ?? t);
  const anyMapped = mapped.some((mappedTok, i) => mappedTok !== normalizedTokens[i]);
  if (anyMapped) {
    return mapped.join(' ');
  }

  // Stage 3 — passthrough.
  return input;
}

// Re-export for callers / debugging surfaces.
export { REVERSE_BY_LOCALE };
