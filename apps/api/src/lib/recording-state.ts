// Recording state machine — single source of truth for allowed qa_status
// transitions at the API layer.
//
// Enh 3 / D1 (2026-06-04): the hash-verify flow was removed. `uploaded` is now
// the TERMINAL success state — there is no longer a `uploaded → verified` edge,
// no `hash-mismatch`, and no `/reupload`. The qa_status enum still CONTAINS the
// legacy `verified` / `hash-mismatch` values (Postgres can't cheaply drop enum
// values), so they remain in the type and are treated as terminal success
// synonyms on read paths; nothing writes them anymore.

import { schema } from '../db/index.js';

export type QaStatus = (typeof schema.qaStatusEnum.enumValues)[number];

// State transitions allowed at runtime. `takedown` is reachable only via ops
// script (D-LEGAL-04). Everything except `pending` is terminal (→ takedown only).
const ALLOWED: Record<QaStatus, QaStatus[]> = {
  pending: ['uploaded', 'rejected', 'takedown'],
  uploaded: ['takedown'], // terminal success (Enh 3 — no more → verified)
  verified: ['takedown'], // legacy terminal (pre-Enh-3 rows; success synonym)
  'hash-mismatch': ['takedown'], // legacy terminal (reupload path removed)
  rejected: ['takedown'],
  takedown: [],
};

export function canTransition(from: QaStatus, to: QaStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function isTerminal(s: QaStatus): boolean {
  // Only `pending` is non-terminal. `uploaded` is terminal success after Enh 3;
  // `verified` / `hash-mismatch` are legacy terminal rows; `rejected` / `takedown`
  // are terminal dispositions.
  return s !== 'pending';
}
