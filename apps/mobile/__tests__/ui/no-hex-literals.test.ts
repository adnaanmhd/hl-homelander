// Phase 2 plan 02-22 — D-UI-01 / D-UI-02 token discipline gate (phase-wide).
//
// Walks every .ts / .tsx file under apps/mobile/src/screens/ AND
// apps/mobile/src/components/, strips line + block comments, and asserts
// the result contains ZERO hex-color literals (`'#RGB'`, `'#RRGGBB'`,
// 4/8-digit shorthand). The 02-02 primitives gate enforces token-binding
// for the 8 ui/primitives/* components; this test extends the same rule
// to every screen body and every cross-screen component shipped through
// the rest of Phase 2 (02-15..20).
//
// Exclusions:
//   - apps/mobile/src/ui/primitives/*.tsx — the 8 primitives consume tokens
//     directly and are gated by the 02-02 primitives.test.tsx file.
//   - apps/mobile/src/ui/tokens.ts — THE canonical hex-value source. Every
//     other file MUST import colors / type / spacing from this module.
//   - *.test.tsx / *.test.ts — tests legitimately assert specific hex
//     values (e.g. primitives.test.tsx asserts colors.coral === '#FF6B6B').
//
// Match form: a single-quoted string starting with '#' followed by 3 to 8
// hex digits. Catches the common React Native StyleSheet usage like
// `color: '#FAF7F2'` and the rgba-string form `'rgba(...)'` is intentionally
// allowed (no hex digits) because rgba is the prescribed way to express
// scrim opacity in design-spec §18; hex-color violations are the loud
// regression vector here.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

/** Recursively list .tsx and .ts files under a directory; excludes test
 *  files. Returns absolute paths. */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (
      (full.endsWith('.tsx') || full.endsWith('.ts')) &&
      !full.endsWith('.test.tsx') &&
      !full.endsWith('.test.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Strip /* block *\/ comments AND // line comments before grep so doc
 *  comments illustrating tokens (e.g. '#FAF7F2 → colors.bg') don't trigger
 *  the gate. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const SCREENS_DIR = resolve(ROOT, 'src/screens');
const COMPONENTS_DIR = resolve(ROOT, 'src/components');

const HEX_LITERAL = /'#[0-9A-Fa-f]{3,8}'/g;

describe('Phase 2 token discipline (D-UI-01 / D-UI-02) — no hex-color literals in screens or components', () => {
  const screenFiles = listSourceFiles(SCREENS_DIR);
  const componentFiles = listSourceFiles(COMPONENTS_DIR);

  it('finds at least one screen file (sanity check that the scan ran)', () => {
    expect(screenFiles.length).toBeGreaterThan(0);
  });

  it('finds at least one component file (sanity check that the scan ran)', () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  for (const file of [...screenFiles, ...componentFiles]) {
    const relative = file.slice(ROOT.length + 1);
    it(`${relative} contains no hex-color literals`, () => {
      const stripped = stripComments(readFileSync(file, 'utf-8'));
      const matches = stripped.match(HEX_LITERAL) ?? [];
      // Failure message names the offending literals so a regression PR
      // gets immediately-actionable output. Steer fixes back to colors.*
      // tokens from apps/mobile/src/ui/tokens.ts.
      expect(
        matches,
        `Hex literal(s) found in ${relative}: ${matches.join(
          ', ',
        )}. Use colors.* tokens from apps/mobile/src/ui/tokens.ts instead.`,
      ).toEqual([]);
    });
  }
});
