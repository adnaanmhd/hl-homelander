// Recording state machine — single source of truth for allowed qa_status
// transitions at the API layer. Migration 0003 (this plan) extended the
// qa_status enum with 'rejected' so /recordings/:id/reject can transition
// pending uploads when the client cancels.

import { schema } from '../db/index.js';

export type QaStatus = (typeof schema.qaStatusEnum.enumValues)[number];

// State transitions allowed at runtime — `takedown` is reachable only via ops
// script (D-LEGAL-04).
const ALLOWED: Record<QaStatus, QaStatus[]> = {
  pending: ['uploaded', 'rejected', 'takedown'],
  uploaded: ['verified', 'hash-mismatch', 'rejected', 'takedown'],
  verified: ['takedown'],
  'hash-mismatch': ['takedown'],
  rejected: ['takedown'],
  takedown: [],
};

export function canTransition(from: QaStatus, to: QaStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function isTerminal(s: QaStatus): boolean {
  return s === 'verified' || s === 'rejected' || s === 'takedown' || s === 'hash-mismatch';
}
