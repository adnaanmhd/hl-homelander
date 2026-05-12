// recording_events_outbox CRUD — thin functions over the one table (mirrors
// idempotency-store.ts's lookup/persist shape).
//
// - appendOutboxEvent(tx, ...): used by verify-recording.ts inside the
//   qa_status-flip transaction so the event row and the status flip commit
//   atomically (no lost-event window).
// - drainOutbox(userId) / markDelivered(ids): used by the `events-outbox`
//   onSend hook (Plan 05-05) — drain undelivered rows for the authenticated
//   user, attach to the response, then mark delivered. At-least-once: the
//   client de-dups on (recording_id, event_type).
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../db/index.js';

// The transaction handle drizzle hands the db.transaction callback. Using the
// inferred type keeps appendOutboxEvent callable with the same `tx` finalize.ts uses.
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RecordingOutboxEventType = (typeof schema.recordingEventTypeEnum.enumValues)[number]; // 'verified' | 're-upload'

export interface OutboxRow {
  id: string;
  recordingId: string;
  eventType: RecordingOutboxEventType;
}

export async function appendOutboxEvent(
  tx: DbTx,
  args: { userId: string; recordingId: string; eventType: RecordingOutboxEventType },
): Promise<void> {
  await tx.insert(schema.recordingEventsOutbox).values({
    id: ulid(),
    userId: args.userId,
    recordingId: args.recordingId,
    eventType: args.eventType,
  });
}

const DRAIN_LIMIT = 50;

export async function drainOutbox(userId: string): Promise<OutboxRow[]> {
  const rows = await db
    .select({
      id: schema.recordingEventsOutbox.id,
      recordingId: schema.recordingEventsOutbox.recordingId,
      eventType: schema.recordingEventsOutbox.eventType,
    })
    .from(schema.recordingEventsOutbox)
    .where(
      and(
        eq(schema.recordingEventsOutbox.userId, userId),
        isNull(schema.recordingEventsOutbox.deliveredAt),
      ),
    )
    .orderBy(asc(schema.recordingEventsOutbox.createdAt))
    .limit(DRAIN_LIMIT);
  return rows;
}

export async function markDelivered(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(schema.recordingEventsOutbox)
    .set({ deliveredAt: new Date() })
    .where(inArray(schema.recordingEventsOutbox.id, ids));
}
