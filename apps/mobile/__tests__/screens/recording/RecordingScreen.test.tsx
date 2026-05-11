// RecordingScreen shell — render test (plan 04-07).
//
// The shell is substate-driven; this test exercises each substate via the
// `__test_initialState` escape hatch (the same prop the visual baselines use)
// and asserts the dark-theme chrome renders the verbatim copy + the
// substate-specific affordances. Tapping Skip dispatches GATE_SKIP — the
// reducer transitions gate→confirmed(skipped) — so the rendered state changes
// (the Skip link disappears, the gate ring stays mounted at full).
//
// Mocks: @react-navigation/native (useNavigation + useRoute), analytics
// logEvent. The Phase-4 RN libs are mocked globally by plan 04-01 (vitest.setup.ts).

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGoBack, mockNavigate } = vi.hoisted(() => ({
  mockGoBack: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    reset: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({
    key: 'Recording-1',
    name: 'Recording',
    params: { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true },
  }),
}));

vi.mock('../../../src/util/analytics', () => ({ logEvent: () => undefined }));

import RecordingScreen from '../../../src/screens/recording/RecordingScreen';
import { initialRecState, type RecState } from '../../../src/screens/recording/recState';

function stateIn(substate: RecState['substate'], overrides: Partial<RecState> = {}): RecState {
  const s = initialRecState({
    taskId: '__practice__',
    taskName: 'Practice — 60 sec',
    isPractice: true,
  });
  return { ...s, ...overrides, substate, gate: { ...s.gate, ...(overrides.gate ?? {}) } };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('RecordingScreen shell (plan 04-07)', () => {
  it('renders the dark recording surface with the task name + close button', () => {
    render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    expect(screen.getByLabelText('Recording screen')).toBeTruthy();
    expect(screen.getByText('Practice — 60 sec')).toBeTruthy();
    expect(screen.getByLabelText('recording-close')).toBeTruthy();
    // 3s overlay tip renders on mount.
    expect(screen.getByText("Don't exit while recording.")).toBeTruthy();
  });

  it('rotate-prompt substate renders the rotate-prompt label', () => {
    render(<RecordingScreen __test_initialState={stateIn('rotate-prompt')} />);
    expect(screen.getByLabelText('rotate-prompt')).toBeTruthy();
    expect(screen.getByText('Rotate to landscape and mount on rig')).toBeTruthy();
  });

  it('ready substate renders the record button + "Start Recording" label', () => {
    render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    expect(screen.getByLabelText('recording-record-button')).toBeTruthy();
    expect(screen.getByText('Start Recording')).toBeTruthy();
  });

  it('gate substate renders the GateRing + the verbatim gate prompt + the Skip link', () => {
    render(
      <RecordingScreen
        __test_initialState={stateIn('gate', {
          gate: { ...stateIn('gate').gate, phase: 'waiting' },
        })}
      />,
    );
    expect(screen.getByLabelText('gate-ring')).toBeTruthy();
    expect(
      screen.getByText('Mount the phone on your head and bring your hands in frame for 2 secs'),
    ).toBeTruthy();
    expect(screen.getByLabelText('recording-skip')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('gate.loading substate renders the "Preparing camera…" caption (HAND-06)', () => {
    render(
      <RecordingScreen
        __test_initialState={stateIn('gate', {
          gate: { ...stateIn('gate').gate, phase: 'loading' },
        })}
      />,
    );
    expect(screen.getByText('Preparing camera…')).toBeTruthy();
  });

  it('active substate renders the HH:MM:SS timer + the stop button', () => {
    render(
      <RecordingScreen
        __test_initialState={stateIn('active', { startedAt: 0, durationMs: 332_000 })}
      />,
    );
    expect(screen.getByLabelText('recording-timer')).toBeTruthy();
    // 332_000 ms = 00:05:32
    expect(screen.getByText('00:05:32')).toBeTruthy();
    expect(screen.getByLabelText('recording-stop')).toBeTruthy();
  });

  it('stop-confirm substate renders the StopConfirmModal with the LOCKED body copy', () => {
    render(
      <RecordingScreen
        __test_initialState={stateIn('stop-confirm', { startedAt: 0, durationMs: 5000 })}
      />,
    );
    expect(screen.getByLabelText('stop-confirm-modal')).toBeTruthy();
    expect(screen.getByText('Stop recording?')).toBeTruthy();
    expect(screen.getByText('Recordings under 1 minute are discarded.')).toBeTruthy();
    expect(screen.getByLabelText('stop-confirm-keep')).toBeTruthy();
    expect(screen.getByLabelText('stop-confirm-stop')).toBeTruthy();
  });

  it('tapping Skip in the gate substate dispatches GATE_SKIP — the Skip link disappears, the ring stays mounted', () => {
    render(
      <RecordingScreen
        __test_initialState={stateIn('gate', {
          gate: { ...stateIn('gate').gate, phase: 'waiting' },
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('recording-skip'));
    // gate → confirmed(skipped): the Skip link is gone, the gate ring still mounted.
    expect(screen.queryByLabelText('recording-skip')).toBeNull();
    expect(screen.getByLabelText('gate-ring')).toBeTruthy();
  });

  it('tapping the close button while active dispatches X_PRESSED → the stop-confirm modal appears', () => {
    render(
      <RecordingScreen
        __test_initialState={stateIn('active', { startedAt: 0, durationMs: 5000 })}
      />,
    );
    expect(screen.queryByLabelText('stop-confirm-modal')).toBeNull();
    fireEvent.click(screen.getByLabelText('recording-close'));
    expect(screen.getByLabelText('stop-confirm-modal')).toBeTruthy();
  });

  it('tapping the close button pre-record (ready) calls navigation.goBack() (HAND-10 — silent dismiss)', () => {
    render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    fireEvent.click(screen.getByLabelText('recording-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
