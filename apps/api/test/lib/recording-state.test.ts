// recording-state.ts — the qa_status transition graph.
//
// Enh 3 / D1 (2026-06-04): the hash-verify flow was removed. `uploaded` is now
// the TERMINAL success state — there is no `uploaded → verified` edge, no
// `hash-mismatch → pending` re-upload edge, and no `/reupload`. The qa_status
// enum still CONTAINS the legacy `verified` / `hash-mismatch` values (Postgres
// can't cheaply drop enum values); nothing writes them, and they are treated as
// terminal success synonyms on read paths.
//
// No DB / no S3 — pure function tests; can run before the schema push.
import { describe, it, expect } from 'vitest';
import { canTransition, isTerminal } from '../../src/lib/recording-state.js';

describe('lib/recording-state', () => {
  describe('canTransition', () => {
    it('allows pending → uploaded (the /finalize success edge)', () => {
      expect(canTransition('pending', 'uploaded')).toBe(true);
    });

    it('allows pending → rejected / takedown', () => {
      expect(canTransition('pending', 'rejected')).toBe(true);
      expect(canTransition('pending', 'takedown')).toBe(true);
    });

    it('uploaded is terminal success — only → takedown (Enh 3: no more → verified)', () => {
      expect(canTransition('uploaded', 'takedown')).toBe(true);
      expect(canTransition('uploaded', 'verified')).toBe(false);
      expect(canTransition('uploaded', 'hash-mismatch')).toBe(false);
      expect(canTransition('uploaded', 'pending')).toBe(false);
    });

    it('legacy hash-mismatch no longer re-enters the lifecycle (reupload removed)', () => {
      expect(canTransition('hash-mismatch', 'pending')).toBe(false);
      expect(canTransition('hash-mismatch', 'uploaded')).toBe(false);
      expect(canTransition('hash-mismatch', 'verified')).toBe(false);
      // …but an ops takedown is still reachable.
      expect(canTransition('hash-mismatch', 'takedown')).toBe(true);
    });

    it('legacy verified is a near-sink (only → takedown)', () => {
      expect(canTransition('verified', 'takedown')).toBe(true);
      expect(canTransition('verified', 'pending')).toBe(false);
    });

    it('takedown is a sink', () => {
      expect(canTransition('takedown', 'pending')).toBe(false);
      expect(canTransition('takedown', 'verified')).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('uploaded is terminal success after Enh 3', () => {
      expect(isTerminal('uploaded')).toBe(true);
    });

    it('legacy verified / hash-mismatch + rejected / takedown are terminal', () => {
      expect(isTerminal('verified')).toBe(true);
      expect(isTerminal('hash-mismatch')).toBe(true);
      expect(isTerminal('rejected')).toBe(true);
      expect(isTerminal('takedown')).toBe(true);
    });

    it('only pending is non-terminal', () => {
      expect(isTerminal('pending')).toBe(false);
    });
  });
});
