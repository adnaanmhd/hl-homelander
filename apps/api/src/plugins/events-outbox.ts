// events-outbox — the server→client recording-status event channel (VERIFY-05).
//
// The hash-verify worker (Plan 05-03) writes one `recording_events_outbox` row
// per recording when it flips `qa_status` ('verified' or 're-upload'). This
// onSend hook drains the undelivered rows for the authenticated user on EVERY
// authenticated JSON response and attaches them under a `_events` envelope key,
// then marks them delivered. Mirrors `plugins/idempotency.ts`'s onSend shape.
//
// Delivery semantics: at-least-once. The mark-delivered happens inside onSend,
// which has a tiny loss window (the response bytes could drop on the wire after
// the row is marked) AND a tiny duplicate window (a second concurrent response
// could re-attach a row that this one already drained but not yet marked). The
// client de-dups on `(recording_id, event_type)`, and the reconciliation sweep
// (`GET /recordings/verified-ids`, Plan 05-08 client side) is the convergent
// backstop — so neither window is a correctness problem.
//
// Pattern 22 (STATE.md): any route declaring a strict `response.200` zod schema
// that this hook touches must add the optional `_events` key to that schema so
// the added key doesn't trip the serializer — handled for
// `RecordingsListResponseSchema` + `MeResponseSchema`. Routes with NO strict
// `response` schema (the new `verified-ids`, the new `reupload`) carry the key
// for free.

import fp from 'fastify-plugin';
import { drainOutbox, markDelivered } from '../lib/recording-events.js';

export default fp(
  async (app) => {
    app.addHook('onSend', async (req, _reply, payload) => {
      const sub = (req.user as { sub?: string } | undefined)?.sub;
      if (!sub) return payload; // unauthenticated route — skip
      if (typeof payload !== 'string') return payload; // non-JSON body — skip; next authed GET picks it up
      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        return payload;
      }
      if (body == null || typeof body !== 'object' || Array.isArray(body)) return payload; // only object envelopes
      const rows = await drainOutbox(sub);
      if (rows.length === 0) return payload;
      (body as Record<string, unknown>)._events = rows.map((r) => ({
        recording_id: r.recordingId,
        event_type: r.eventType,
      }));
      await markDelivered(rows.map((r) => r.id));
      return JSON.stringify(body);
    });
  },
  { name: 'events-outbox', dependencies: ['auth'] },
);
