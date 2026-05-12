// recording-state.ts — the qa_status transition graph. Migration 0006 (Plan
// 05-03) adds the `hash-mismatch → pending` edge so POST /recordings/:id/reupload
// can move a mismatched row back into the upload lifecycle (UP-16). The row
// stays terminal-until-re-uploaded — isTerminal('hash-mismatch') is still true.
//
// No DB / no S3 — pure function tests; can run before the schema push.
import { describe, it, expect } from 'vitest';
import { canTransition, isTerminal } from '../../src/lib/recording-state.js';

describe('lib/recording-state', () => {
  describe('canTransition', () => {
    it('allows hash-mismatch → pending (re-upload re-enters the lifecycle)', () => {
      expect(canTransition('hash-mismatch', 'pending')).toBe(true);
    });

    it('does NOT allow hash-mismatch → uploaded (re-upload must go via pending)', () => {
      expect(canTransition('hash-mismatch', 'uploaded')).toBe(false);
    });

    it('does NOT allow hash-mismatch → verified directly', () => {
      expect(canTransition('hash-mismatch', 'verified')).toBe(false);
    });

    it('keeps the existing uploaded → verified edge', () => {
      expect(canTransition('uploaded', 'verified')).toBe(true);
    });

    it('keeps the existing uploaded → hash-mismatch edge', () => {
      expect(canTransition('uploaded', 'hash-mismatch')).toBe(true);
    });

    it('keeps hash-mismatch → takedown', () => {
      expect(canTransition('hash-mismatch', 'takedown')).toBe(true);
    });

    it('verified is still a near-sink (only → takedown)', () => {
      expect(canTransition('verified', 'takedown')).toBe(true);
      expect(canTransition('verified', 'pending')).toBe(false);
    });

    it('takedown is a sink', () => {
      expect(canTransition('takedown', 'pending')).toBe(false);
      expect(canTransition('takedown', 'verified')).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('hash-mismatch is still terminal (terminal-until-re-uploaded)', () => {
      expect(isTerminal('hash-mismatch')).toBe(true);
    });

    it('verified / rejected / takedown are terminal', () => {
      expect(isTerminal('verified')).toBe(true);
      expect(isTerminal('rejected')).toBe(true);
      expect(isTerminal('takedown')).toBe(true);
    });

    it('pending / uploaded are not terminal', () => {
      expect(isTerminal('pending')).toBe(false);
      expect(isTerminal('uploaded')).toBe(false);
    });
  });
});
