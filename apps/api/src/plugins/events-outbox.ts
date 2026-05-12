// events-outbox — the server→client recording-status event channel (VERIFY-05).
//
// The hash-verify worker (Plan 05-03) writes one `recording_events_outbox` row
// per recording when it flips `qa_status` ('verified' or 're-upload'). This
// onSend hook drains the undelivered rows for the authenticated user on EVERY
// authenticated 2xx `application/json` response and attaches them under a
// `_events` envelope key, then marks them delivered. Mirrors
// `plugins/idempotency.ts`'s onSend shape.
//
// 2xx + application/json gate (WR-03 / VERIFY-05): the hook returns `payload`
// unchanged unless the response status is 2xx AND the `content-type` starts with
// `application/json` (not `application/problem+json`, not non-JSON). So RFC-7807
// error bodies never carry a `_events` key, and pending outbox events are NEVER
// marked delivered on a response the client treats as a hard failure (it doesn't
// parse a 4xx/5xx body for `_events`) — they're picked up on the next 2xx
// carrier response (and the reconcile sweep `GET /recordings/verified-ids` is
// the convergent backstop either way).
//
// Delivery semantics: at-least-once. The mark-delivered happens inside onSend,
// which has a tiny loss window (the response bytes could drop on the wire after
// the row is marked) AND a tiny duplicate window (a second concurrent response
// could re-attach a row that this one already drained but not yet marked). The
// client de-dups on `(recording_id, event_type)`, and the reconciliation sweep
// is the convergent backstop — so neither window is a correctness problem.
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
    app.addHook('onSend', async (req, reply, payload) => {
      const sub = (req.user as { sub?: string } | undefined)?.sub;
      if (!sub) return payload; // unauthenticated route — skip
      // Only touch 2xx application/json carrier responses — never RFC-7807
      // error bodies (application/problem+json) or any non-2xx response (WR-03).
      if (reply.statusCode < 200 || reply.statusCode >= 300) return payload;
      const ct = reply.getHeader('content-type');
      if (typeof ct !== 'string' || !ct.startsWith('application/json')) return payload;
      if (typeof payload !== 'string') return payload; // non-string body — skip; next authed GET picks it up
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
