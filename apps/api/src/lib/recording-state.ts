// Recording state machine — single source of truth for allowed qa_status
// transitions at the API layer. Migration 0003 extended the qa_status enum with
// 'rejected' so /recordings/:id/reject can transition pending uploads when the
// client cancels.
//
// Migration 0006 (Plan 05-03) adds the `hash-mismatch → pending` edge so
// POST /recordings/:id/reupload can move a mismatched row back into the upload
// lifecycle (UP-16). `isTerminal('hash-mismatch')` stays true — it's terminal
// until the client re-uploads; the re-upload runs a fresh /init → /finalize
// cycle that transitions pending → uploaded → verified again.

import { schema } from '../db/index.js';

export type QaStatus = (typeof schema.qaStatusEnum.enumValues)[number];

// State transitions allowed at runtime — `takedown` is reachable only via ops
// script (D-LEGAL-04).
const ALLOWED: Record<QaStatus, QaStatus[]> = {
  pending: ['uploaded', 'rejected', 'takedown'],
  uploaded: ['verified', 'hash-mismatch', 'rejected', 'takedown'],
  verified: ['takedown'],
  'hash-mismatch': ['pending', 'takedown'], // 'pending' added in Plan 05-03 — re-upload re-enters the lifecycle
  rejected: ['takedown'],
  takedown: [],
};

export function canTransition(from: QaStatus, to: QaStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function isTerminal(s: QaStatus): boolean {
  return s === 'verified' || s === 'rejected' || s === 'takedown' || s === 'hash-mismatch';
}
