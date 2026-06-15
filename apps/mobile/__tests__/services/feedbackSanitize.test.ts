// Phase 6 (2026-06-10, Bug 6) — client-side feedback sanitize + send-and-clear.
//
//   1. telemetryRing.append strips NUL/C0 control chars AT APPEND TIME (the
//      analytics choke point) while preserving \t \n \r.
//   2. submitFeedback ships a sanitized diagnostic even when the PERSISTED
//      ring is historically poisoned (pre-fix MMKV blob), and clears the ring
//      after a 2xx (send-and-clear, finally wired).
//   3. A failed POST keeps the ring — the events must survive for the retry.
//
// Uses the REAL telemetryRing over the canonical react-native-mmkv mock from
// vitest.setup.ts (the poison has to round-trip through actual persistence);
// only the network edge (apiClient.postMultipart) and uuid are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native-uuid', () => ({
  default: { v4: () => 'fixed-uuid-sanitize' },
}));

const postMultipartMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    postMultipart: (...a: unknown[]) => postMultipartMock(...a),
  },
}));

import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';
import { telemetryRing } from '../../src/services/telemetryRing';
import { submitFeedback } from '../../src/services/feedbackService';
import { stripControlChars, stripControlCharsDeep } from '../../src/lib/sanitizeControlChars';

const NUL = String.fromCharCode(0);
const ESC = String.fromCharCode(27);

/** jsdom-version-agnostic Blob reader (older jsdom lacks Blob#text). */
async function readBlobText(b: Blob): Promise<string> {
  if (typeof (b as { text?: () => Promise<string> }).text === 'function') return b.text();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error('FileReader failed'));
    fr.readAsText(b);
  });
}

beforeEach(() => {
  secureMmkv.remove(KEYS.TELEMETRY_RING);
  postMultipartMock.mockReset();
  postMultipartMock.mockResolvedValue(undefined);
});

describe('telemetryRing append-time sanitize (Phase 6 item 1)', () => {
  it('strips NUL/C0 from event name, prop keys and values; keeps \\t \\n \\r; non-strings untouched', () => {
    telemetryRing.append({
      name: `signup_google${NUL}_failed`,
      ts: 1717999999999,
      props: {
        [`err${NUL}_key`]: `boom${NUL}${ESC} kept\t\n\r end`,
        attempt: 3,
        fatal: true,
      },
    });
    const snap = telemetryRing.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]!.name).toBe('signup_google_failed');
    expect(snap[0]!.props['err_key']).toBe('boom kept\t\n\r end');
    expect(snap[0]!.props.attempt).toBe(3);
    expect(snap[0]!.props.fatal).toBe(true);
    // The PERSISTED blob is clean too — no NUL survives into MMKV.
    expect(secureMmkv.getString(KEYS.TELEMETRY_RING)).not.toContain(NUL);
  });
});

describe('submitFeedback sanitize + send-and-clear (Phase 6 items 1+2)', () => {
  it('historically poisoned ring → shipped diagnostic + message are sanitized', async () => {
    // Simulate a pre-fix install: poison persisted RAW into MMKV, bypassing
    // the (now-sanitizing) append path.
    secureMmkv.set(
      KEYS.TELEMETRY_RING,
      JSON.stringify([
        { name: 'signup_google_failed', ts: 1, props: { message: `legacy${NUL}poison` } },
      ]),
    );
    await submitFeedback({ category: 'app-crashed', message: `crash${NUL} report` });

    expect(postMultipartMock).toHaveBeenCalledTimes(1);
    const form = postMultipartMock.mock.calls[0]![1] as FormData;
    expect(form.get('message')).toBe('crash report');
    const diagText = await readBlobText(form.get('diagnostic') as Blob);
    expect(diagText).not.toContain(NUL);
    const diag = JSON.parse(diagText) as {
      telemetryRing: Array<{ props: Record<string, unknown> }>;
    };
    expect(diag.telemetryRing[0]!.props.message).toBe('legacypoison');
  });

  it('2xx → ring cleared (a second report ships fresh events)', async () => {
    telemetryRing.append({ name: 'upload_started', ts: 2, props: {} });
    expect(telemetryRing.snapshot()).toHaveLength(1);

    await submitFeedback({ category: 'upload-stuck', message: 'stuck' });

    expect(telemetryRing.snapshot()).toEqual([]);
    expect(secureMmkv.getString(KEYS.TELEMETRY_RING)).toBeUndefined();
  });

  it('postMultipart rejection → ring KEPT for the retry', async () => {
    telemetryRing.append({ name: 'upload_started', ts: 3, props: {} });
    postMultipartMock.mockRejectedValue(new Error('failed: 500'));

    await expect(submitFeedback({ category: 'upload-stuck', message: 'stuck' })).rejects.toThrow(
      'failed: 500',
    );

    expect(telemetryRing.snapshot()).toHaveLength(1);
    expect(telemetryRing.snapshot()[0]!.name).toBe('upload_started');
  });
});

describe('stripControlChars helpers (Phase 6 item 1)', () => {
  it('strips C0 except tab/LF/CR; deep variant walks arrays, keys, nested objects', () => {
    expect(stripControlChars(`a${NUL}b${ESC}c\t\n\r`)).toBe('abc\t\n\r');
    expect(
      stripControlCharsDeep({
        [`k${NUL}`]: [`v${ESC}1`, 2, null, { inner: `x${NUL}y` }],
      }),
    ).toEqual({ k: ['v1', 2, null, { inner: 'xy' }] });
  });

  it('replaces LONE surrogates with U+FFFD but preserves valid astral pairs (review fix V13)', () => {
    // A length-truncated emoji in an err.message leaves a lone high surrogate —
    // the other Postgres-unstorable class besides NUL. Hermes 0.14 has no
    // String#toWellFormed; the sanitizer must neutralize these itself.
    const LONE_HIGH = '\uD800';
    const LONE_LOW = '\uDC00';
    expect(stripControlChars(`oops ${LONE_HIGH} truncated`)).toBe('oops � truncated');
    expect(stripControlChars(`tail${LONE_LOW}`)).toBe('tail�');
    // A VALID pair (😀 = D83D DE00) passes through untouched — including when a
    // lone surrogate sits right next to it.
    expect(stripControlChars('hi 😀 there')).toBe('hi 😀 there');
    expect(stripControlChars(`😀${LONE_HIGH}😀`)).toBe('😀�😀');
    expect(stripControlCharsDeep({ msg: `e${LONE_HIGH}` })).toEqual({ msg: 'e�' });
  });
});
