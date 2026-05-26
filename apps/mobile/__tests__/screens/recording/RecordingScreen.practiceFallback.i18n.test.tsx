// RecordingScreen practice fallback — Plan 07-17 Task 3 G-25.
//
// Pins the en.json contract for the new `recording.practiceFallback` key +
// the source-level invariant that:
//   (1) PracticeIntroScreen.tsx no longer hardcodes `taskName` in
//       PRACTICE_ROUTE_PARAMS (the taskName field is intentionally omitted so
//       the recipient screen's t() fallback wins),
//   (2) RecordingScreen.tsx:178 no longer carries the hardcoded fallback
//       string `'Practice — 60 sec'`,
//   (3) RecordingScreen.tsx wires `params.taskName ?? t('recording.practiceFallback')`,
//   (4) the `const taskName` declaration comes AFTER the `useTranslation()` hook
//       (otherwise `t` is undefined when the fallback is evaluated).
//
// Mirrors the source-grep + key-shape pattern from
// `__tests__/screens/tasks/SendRequestSheet.i18n.test.tsx`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

const PRACTICE_INTRO_SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../../src/screens/tutorial/PracticeIntroScreen.tsx'),
  'utf8',
);
const RECORDING_SCREEN_SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../../src/screens/recording/RecordingScreen.tsx'),
  'utf8',
);

describe('RecordingScreen practice fallback — Plan 07-17 G-25 (i18n)', () => {
  it('en.json carries the new recording.practiceFallback key', () => {
    expect((enJson.recording as Record<string, unknown>).practiceFallback).toBe(
      'Practice — 60 sec',
    );
  });

  it('the new recording.practiceFallback key resolves to a non-empty en string', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    const v = t('recording.practiceFallback');
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toBe('recording.practiceFallback');
  });

  it('PracticeIntroScreen.tsx PRACTICE_ROUTE_PARAMS no longer carries a hardcoded taskName', () => {
    // The taskName field is intentionally omitted from the const itself;
    // RecordingScreen.tsx falls back to t('recording.practiceFallback') so
    // the locale switch in Profile re-renders the app-bar. The two
    // comment-context references to the legacy string (the route-shape doc
    // at line 22 + the prototype.html cite at line 45) are intentionally
    // preserved — they document the historical path, not the current code.
    // We assert by extracting the const body and confirming no taskName field.
    const constMatch = PRACTICE_INTRO_SOURCE.match(
      /const PRACTICE_ROUTE_PARAMS\s*=\s*\{[\s\S]*?\}\s*as const;/,
    );
    expect(constMatch).not.toBeNull();
    expect(constMatch![0]).not.toContain('taskName');
  });

  it('RecordingScreen.tsx no longer carries the hardcoded fallback literal', () => {
    expect(RECORDING_SCREEN_SOURCE).not.toContain("params.taskName ?? 'Practice — 60 sec'");
  });

  it('RecordingScreen.tsx wires the locale-reactive fallback through t()', () => {
    expect(RECORDING_SCREEN_SOURCE).toContain("params.taskName ?? t('recording.practiceFallback')");
  });

  it('RecordingScreen.tsx declares useTranslation BEFORE the taskName fallback (hook order)', () => {
    // Without this ordering, `t` is undefined when the fallback evaluates and
    // the RN bundle throws at component mount.
    const useTransIdx = RECORDING_SCREEN_SOURCE.indexOf('const { t, i18n } = useTranslation()');
    const taskNameIdx = RECORDING_SCREEN_SOURCE.indexOf(
      "const taskName = params.taskName ?? t('recording.practiceFallback')",
    );
    expect(useTransIdx).toBeGreaterThan(0);
    expect(taskNameIdx).toBeGreaterThan(0);
    expect(useTransIdx).toBeLessThan(taskNameIdx);
  });
});
