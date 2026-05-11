// Plan 04-07 — Visual snapshots for the RecordingScreen shell (design-spec §7).
//
// 8 static-surface baselines, one per substate the shell renders without a
// live camera (the live-camera substates, the 5%-brightness state, confetti,
// and the thermal/battery alert pills are skipped per D-WAVE-03):
//   recording-rotate-prompt       — substate rotate-prompt
//   recording-ready               — substate ready (camera off)
//   recording-gate-ring-0         — substate gate, phase waiting, consecutiveHits 0
//   recording-gate-ring-50        — substate gate, phase waiting, consecutiveHits ≈ target/2
//   recording-gate-ring-100       — substate gate, phase confirmed, consecutiveHits === target
//   recording-active-t10s         — substate active, durationMs 10_000
//   recording-active-t05m32s      — substate active, durationMs 332_000
//   recording-stop-confirm-modal  — substate stop-confirm
//
// Structural-render-tree PNG (see _utils/renderToImage). A regression that
// drops a chrome element / moves the timer / removes the gate ring shifts the
// rendered rectangles and the diff fires. Baseline filenames via
// customSnapshotIdentifier.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn(), reset: vi.fn(), push: vi.fn() }),
  useRoute: () => ({
    key: 'Recording-1',
    name: 'Recording',
    params: { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true },
  }),
}));
vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));

// appStore — a signed-in user (jwt non-null) so the WR-06 `loggedOut` wiring
// (RecordingScreen passes `loggedOut={appStore.jwt == null}` into
// useRecordingLifecycle) doesn't fire the §10 logout-stop in the `active`
// baselines. Mirrors the getState()/selector shape RecordingScreen uses.
vi.mock('../../src/state/appStore', () => {
  const state = {
    jwt: 'test-jwt',
    user: { id: 'u', email: 'u@example.com', name: 'U', avatarUrl: null },
    consent: { acceptedAt: '2026-05-01T00:00:00Z', consentVersion: 'v1' },
  };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import RecordingScreen from '../../src/screens/recording/RecordingScreen';
import { initialRecState, type RecState } from '../../src/screens/recording/recState';
import { renderToImage } from './_utils/renderToImage';

function stateIn(substate: RecState['substate'], overrides: Partial<RecState> = {}): RecState {
  const s = initialRecState({
    taskId: '__practice__',
    taskName: 'Practice — 60 sec',
    isPractice: true,
  });
  return { ...s, ...overrides, substate, gate: { ...s.gate, ...(overrides.gate ?? {}) } };
}

const CASES: ReadonlyArray<readonly [string, RecState]> = [
  ['recording-rotate-prompt', stateIn('rotate-prompt')],
  ['recording-ready', stateIn('ready')],
  [
    'recording-gate-ring-0',
    stateIn('gate', { gate: { ...stateIn('gate').gate, phase: 'waiting', consecutiveHits: 0 } }),
  ],
  [
    'recording-gate-ring-50',
    stateIn('gate', {
      gate: {
        ...stateIn('gate').gate,
        phase: 'waiting',
        consecutiveHits: Math.round(stateIn('gate').gate.targetHits / 2),
      },
    }),
  ],
  [
    'recording-gate-ring-100',
    stateIn('gate', {
      gate: {
        ...stateIn('gate').gate,
        phase: 'confirmed',
        consecutiveHits: stateIn('gate').gate.targetHits,
        confirmedAt: 0,
      },
    }),
  ],
  ['recording-active-t10s', stateIn('active', { startedAt: 0, durationMs: 10_000 })],
  ['recording-active-t05m32s', stateIn('active', { startedAt: 0, durationMs: 332_000 })],
  ['recording-stop-confirm-modal', stateIn('stop-confirm', { startedAt: 0, durationMs: 5000 })],
];

describe('RecordingScreen visual (plan 04-07 — design-spec §7)', () => {
  afterEach(() => cleanup());

  for (const [id, state] of CASES) {
    it(`matches baseline (${id})`, () => {
      const { container } = render(<RecordingScreen __test_initialState={state} />);
      const png = renderToImage(container);
      expect(png).toMatchImageSnapshot({ customSnapshotIdentifier: id });
    });
  }
});
