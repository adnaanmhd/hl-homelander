# Phase 6: Tasks, History, Home Tiles & Lexical Search — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 38 (8 EDIT, 27 NEW, 3 OPTIONAL/NEW-helper)
**Analogs found:** 38 / 38 — every file has a direct in-tree analog. No NEW patterns; every screen / route / native module / migration / schema / state slice / test mirrors a shipped Phase 1-5 file by role and data flow.

This phase is UI + thin backend extensions. The analog hit-rate is 100 % because the codebase already contains the exact shapes for every new artifact:

- Three placeholder screens replace three already-mounted placeholders (`HomeSkeletonScreen` / `TasksPlaceholderScreen` / `HistoryPlaceholderScreen`) — copy the working `HomeSkeletonScreen` (Pending-Uploads section) shape verbatim.
- Three backend endpoint edits + one NEW endpoint mirror `apps/api/src/routes/recordings/{get,list}.ts` + `apps/api/src/routes/contributions/{list,timeseries}.ts`.
- `HumynPlayer` Kotlin native module mirrors the canonical `HumynGateCamera` triad (`Module` / `Package` / `View`) line-for-line, plus a `MainApplication.kt` registration line.
- Thumbnail extraction extends `FinalizeWorker.kt` post-step-7 in a new ~30 LOC `ThumbnailExtractor.kt` helper.
- The MMKV thumbnail ledger mirrors Phase 4's `practiceDoneKey(sub)` per-key stash pattern.
- Wave 1 D-09 SoundPool/Vibrator restore is a single-file edit on `HumynBeepModule.kt` (the `AudioAttributes.USAGE_*` constant) — no new file.

---

## File Classification

| New/Modified File                                                                                                          | Role                | Data Flow                                           | Closest Analog                                                                                                                                                         | Match Quality     |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **WAVE 1 — D-09 SoundPool/Vibrator restore**                                                                               |                     |                                                     |                                                                                                                                                                        |                   |
| `apps/mobile/android/.../beep/HumynBeepModule.kt` (EDIT)                                                                   | native-module       | event-driven (single-shot)                          | self (line edit on `USAGE_*` + return-value log)                                                                                                                       | exact (self-edit) |
| `apps/mobile/android/app/src/main/AndroidManifest.xml` (EDIT — verify `VIBRATE`)                                           | manifest            | n/a                                                 | self                                                                                                                                                                   | exact (self-edit) |
| **WAVE 2 — Backend lexical-only + range params + stream-url**                                                              |                     |                                                     |                                                                                                                                                                        |                   |
| `apps/api/src/db/migrations/0007_pg_trgm.sql` (NEW)                                                                        | migration           | one-shot DDL                                        | `0006_recording_events_outbox.sql`                                                                                                                                     | role-match        |
| `apps/api/src/routes/tasks/search.ts` (EDIT — gut RRF)                                                                     | route handler       | request-response (read)                             | self (keep `lexical_ranks` CTE)                                                                                                                                        | exact (self-edit) |
| `apps/api/src/routes/recordings/list.ts` (EDIT — add `start`/`end`)                                                        | route handler       | request-response (read, paginated)                  | self                                                                                                                                                                   | exact (self-edit) |
| `apps/api/src/routes/recordings/schemas.ts` (EDIT — `start`/`end`)                                                         | zod-schema          | type-def                                            | self                                                                                                                                                                   | exact (self-edit) |
| `apps/api/src/routes/contributions/timeseries.ts` (EDIT — add `start`/`end` + `aggregate=true`)                            | route handler       | request-response (read)                             | self                                                                                                                                                                   | exact (self-edit) |
| `apps/api/src/routes/recordings/stream-url.ts` (NEW)                                                                       | route handler       | request-response (read, mint signed URL)            | `apps/api/src/routes/recordings/get.ts`                                                                                                                                | exact             |
| `apps/api/src/routes/recordings/index.ts` (EDIT — register stream-url BEFORE `/:id`)                                       | route-barrel        | composition                                         | self                                                                                                                                                                   | exact (self-edit) |
| `shared/types/src/task.ts` (EDIT — `rrf_score` → `lex_score`)                                                              | zod-schema          | type-def                                            | self                                                                                                                                                                   | exact (self-edit) |
| `shared/types/src/contributions.ts` (EDIT — `start`/`end` + `aggregate`)                                                   | zod-schema          | type-def                                            | self                                                                                                                                                                   | exact (self-edit) |
| `shared/types/src/recording.ts` (EDIT — `RecordingsStreamUrlResponseSchema`)                                               | zod-schema          | type-def                                            | `RecordingsGetResponseSchema` in `apps/api/src/routes/recordings/schemas.ts`                                                                                           | role-match        |
| **Backend tests (Wave 2)**                                                                                                 |                     |                                                     |                                                                                                                                                                        |                   |
| `apps/api/test/routes/recordings/stream-url.test.ts` (NEW)                                                                 | test                | request-response                                    | `apps/api/test/routes/recordings-get.test.ts`                                                                                                                          | exact             |
| `apps/api/test/routes/tasks-search.test.ts` (EDIT — drop RRF cases, add fuzzy fallback)                                    | test                | request-response                                    | self                                                                                                                                                                   | exact (self-edit) |
| `apps/api/test/routes/recordings-list.test.ts` (EDIT — `start`/`end`)                                                      | test                | request-response                                    | self                                                                                                                                                                   | exact (self-edit) |
| `apps/api/test/routes/contributions.test.ts` (EDIT — `start`/`end` + `aggregate`)                                          | test                | request-response                                    | self                                                                                                                                                                   | exact (self-edit) |
| **WAVE 3 — Thumbnail extraction + MMKV ledger**                                                                            |                     |                                                     |                                                                                                                                                                        |                   |
| `apps/mobile/android/.../capture/ThumbnailExtractor.kt` (NEW)                                                              | native-helper       | file-I/O (read MP4 → write JPEG)                    | `apps/mobile/android/.../capture/HashStreamer.kt` (sibling helper called from FinalizeWorker step 1)                                                                   | role-match        |
| `apps/mobile/android/.../capture/FinalizeWorker.kt` (EDIT — step 7.5 extract + add `thumbnailPath` to `onSegmentComplete`) | native-orchestrator | event-driven                                        | self                                                                                                                                                                   | exact (self-edit) |
| `apps/mobile/src/services/thumbnailLedger.ts` (NEW)                                                                        | service             | CRUD (MMKV)                                         | `apps/mobile/src/services/uploadReconcile.ts` (MMKV reads/writes for Phase 5 outbox cursors)                                                                           | role-match        |
| `apps/mobile/src/state/keys.ts` (EDIT — add `pendingThumbKey(recordingId)`)                                                | constants           | n/a                                                 | self                                                                                                                                                                   | exact (self-edit) |
| **WAVE 4 — Three real screens + sheets + filter UI**                                                                       |                     |                                                     |                                                                                                                                                                        |                   |
| `apps/mobile/src/screens/home/HomeScreen.tsx` (NEW; replaces `HomeSkeletonScreen.tsx`)                                     | screen              | request-response (multi-fetch + subscription)       | `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (preserve Pending-Uploads section verbatim)                                                                      | exact (same path) |
| `apps/mobile/src/screens/tasks/TasksScreen.tsx` (NEW; replaces `TasksPlaceholderScreen.tsx`)                               | screen              | request-response (debounced search + list)          | `HomeSkeletonScreen.tsx` (TopBar+ScrollView shell)                                                                                                                     | role-match        |
| `apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx` (NEW)                                                                 | component (sheet)   | request-response (cached)                           | `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` (lines 162-190 `<Sheet>` body)                                                                                | role-match        |
| `apps/mobile/src/screens/tasks/SendRequestSheet.tsx` (NEW)                                                                 | component (sheet)   | request-response (multipart POST)                   | `apps/mobile/src/components/ReportProblemSheet.tsx`                                                                                                                    | exact             |
| `apps/mobile/src/screens/history/HistoryScreen.tsx` (NEW; replaces `HistoryPlaceholderScreen.tsx`)                         | screen              | request-response (paginated cursor list + grouping) | `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` (row layout)                                                                                                | role-match        |
| `apps/mobile/src/screens/shared/FilterSheet.tsx` (NEW)                                                                     | component (sheet)   | local-state                                         | `apps/mobile/src/ui/primitives/Sheet.tsx` (raw primitive) + Filter chip-row pattern from `ReportProblemSheet.tsx`                                                      | role-match        |
| `apps/mobile/src/components/TaskCard.tsx` (NEW)                                                                            | component           | n/a                                                 | `PendingUploadsScreen.tsx` row block (lines 248-322 — backgroundColor / borderRadius / padding)                                                                        | role-match        |
| `apps/mobile/src/components/TaskCategoryPills.tsx` (NEW)                                                                   | component           | local-state                                         | (no exact analog — closest is FEEDBACK_CATEGORIES chip row in `ReportProblemSheet.tsx`)                                                                                | role-match        |
| `apps/mobile/src/components/HistoryRow.tsx` (NEW)                                                                          | component           | n/a                                                 | `PendingUploadsScreen.tsx` row (the `renderRow` closure + StyleSheet at lines 248-330)                                                                                 | exact             |
| `apps/mobile/src/components/HistoryDayHeader.tsx` (NEW)                                                                    | component           | n/a                                                 | `HomeSkeletonScreen.tsx` "PENDING UPLOADS" eyebrow Text (lines 200-207)                                                                                                | role-match        |
| `apps/mobile/src/components/HomeHero.tsx` (NEW — empty + returning variants)                                               | component           | n/a                                                 | (no direct analog) — closest: `apps/mobile/src/screens/onboarding/...` hero blocks; structural reference is `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx` | partial           |
| `apps/mobile/src/components/ContributionTile.tsx` (NEW)                                                                    | component           | n/a                                                 | `HomeSkeletonScreen.tsx` `styles.card` block                                                                                                                           | role-match        |
| `apps/mobile/src/components/FilterChip.tsx` (NEW)                                                                          | component           | n/a                                                 | `apps/mobile/src/components/UploadStatusChip.tsx` (chip shape)                                                                                                         | role-match        |
| `apps/mobile/src/components/SearchInput.tsx` (NEW — debounced)                                                             | component           | request-response                                    | `apps/mobile/src/screens/profile/InlineEditField.tsx` (TextInput pattern)                                                                                              | partial           |
| `apps/mobile/src/components/OfflineBanner.tsx` (NEW)                                                                       | component           | n/a                                                 | `apps/mobile/src/components/SoftUpgradeBanner.tsx`                                                                                                                     | role-match        |
| `apps/mobile/src/services/tasksApi.ts` (NEW)                                                                               | service             | request-response                                    | `apps/mobile/src/services/feedbackService.ts` (FormData multipart) + `services/api.ts` getJson reuse                                                                   | role-match        |
| `apps/mobile/src/services/recordingsApi.ts` (NEW)                                                                          | service             | request-response                                    | `apps/mobile/src/services/uploadReconcile.ts`                                                                                                                          | role-match        |
| `apps/mobile/src/services/contributionsApi.ts` (NEW)                                                                       | service             | request-response                                    | (none — fresh; mirrors `tasksApi.ts` shape)                                                                                                                            | role-match        |
| `apps/mobile/src/services/timeRange.ts` (NEW — six named windows → ISO date pair)                                          | service             | pure-function                                       | `apps/mobile/src/services/durationFormatter.ts` (pure formatter convention)                                                                                            | role-match        |
| `apps/mobile/src/services/taskRequestService.ts` (NEW — multipart Send Request)                                            | service             | request-response (multipart)                        | `apps/mobile/src/services/feedbackService.ts`                                                                                                                          | exact             |
| `apps/mobile/src/state/appStore.ts` (EDIT — add `homeRange`, `historyRange`, `pendingThumbnailLedger` slice)               | state               | local-store                                         | self                                                                                                                                                                   | exact (self-edit) |
| **WAVE 5 — HumynPlayer + PlayerScreen**                                                                                    |                     |                                                     |                                                                                                                                                                        |                   |
| `apps/mobile/android/.../player/HumynPlayerModule.kt` (NEW)                                                                | native-module       | event-driven (lifecycle)                            | `apps/mobile/android/.../gatecamera/HumynGateCameraModule.kt`                                                                                                          | exact             |
| `apps/mobile/android/.../player/HumynPlayerPackage.kt` (NEW)                                                               | native-package      | RN registration                                     | `apps/mobile/android/.../gatecamera/HumynGateCameraPackage.kt`                                                                                                         | exact             |
| `apps/mobile/android/.../player/HumynPlayerView.kt` (NEW — TextureView surface)                                            | native-view         | event-driven                                        | `apps/mobile/android/.../gatecamera/HumynGateCameraView.kt`                                                                                                            | exact             |
| `apps/mobile/android/.../player/HumynPlayerViewManager.kt` (NEW)                                                           | native-viewmanager  | RN registration                                     | `apps/mobile/android/.../gatecamera/HumynGateCameraViewManager.kt`                                                                                                     | exact             |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (EDIT — add `HumynPlayerPackage()`)        | bootstrap           | RN registration                                     | self                                                                                                                                                                   | exact (self-edit) |
| `apps/mobile/android/app/build.gradle` (EDIT — add `media3-exoplayer:1.10.0`)                                              | build-config        | n/a                                                 | self (next to `media3-muxer:1.10.0`)                                                                                                                                   | exact (self-edit) |
| `apps/mobile/src/native/HumynPlayer.ts` (NEW — JS bridge)                                                                  | bridge              | event-driven                                        | `apps/mobile/src/native/HumynGateCamera.ts`                                                                                                                            | exact             |
| `apps/mobile/src/native/HumynPlayer.types.ts` (NEW)                                                                        | type-def            | n/a                                                 | inline types in `HumynGateCamera.ts`                                                                                                                                   | role-match        |
| `apps/mobile/src/screens/history/PlayerScreen.tsx` (NEW — Player route in RootNativeStack)                                 | screen              | event-driven (player lifecycle + stream-URL fetch)  | `apps/mobile/src/screens/recording/RecordingScreen.tsx` (full-bleed + dark theme + `gestureEnabled:false`)                                                             | role-match        |
| `apps/mobile/src/navigation/RootNativeStack.tsx` (EDIT — add `Player` route)                                               | navigation          | composition                                         | self (mirror Recording route registration L83-86)                                                                                                                      | exact (self-edit) |
| `apps/mobile/__tests__/screens/HomeScreen.test.tsx` (NEW; replaces HomeSkeletonScreen test)                                | test                | request-response                                    | `apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx`                                                                                                            | exact             |
| `apps/mobile/__tests__/screens/TasksScreen.test.tsx` (NEW)                                                                 | test                | request-response                                    | `apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx` (replace)                                                                                              | exact             |
| `apps/mobile/__tests__/screens/HistoryScreen.test.tsx` (NEW)                                                               | test                | request-response                                    | `apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx` (replace)                                                                                            | exact             |
| `apps/mobile/__tests__/screens/PlayerScreen.test.tsx` (NEW)                                                                | test                | event-driven                                        | (none direct) — closest mock pattern is `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx`                                                             | partial           |

---

## Pattern Assignments

### `apps/api/src/routes/tasks/search.ts` (route handler, request-response — EDIT) — D-01 + D-02

**Analog:** self (preserve the `lexical_ranks` CTE; drop everything else).

**Today** (lines 1-117) does an RRF k=60 hybrid — `vector_ranks` ∪ `lexical_ranks` joined via FULL OUTER, ordered by RRF score. The mobile client doesn't consume `/tasks/search` yet (Phase 6 is the first consumer), so the wire-break of `rrf_score` → `lex_score` is cheap.

**Imports pattern (keep, lines 1-6 — drop `embed` import):**

```typescript
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
// REMOVE: import { embed } from '../../lib/embedder.js';
import { TasksSearchQuerySchema, TasksSearchResponseSchema } from '@humyn/shared-types';
```

**Core pattern — two-stage query** (replace lines 30-114 entirely, see RESEARCH.md §Pattern 1):

```typescript
const result = await db.execute<TaskRow>(sql`
  WITH lex AS (
    SELECT t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
           t.icon_key, t.instructions,
           ts_rank(t.name_search, plainto_tsquery('english', ${q})) AS lex_score
    FROM tasks t
    WHERE t.name_search @@ plainto_tsquery('english', ${q})
      AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null}::text)
      AND (${setting ?? null}::text IS NULL OR t.setting::text = ${setting ?? null}::text OR t.setting::text = 'either')
    ORDER BY lex_score DESC
    LIMIT ${limit}
  )
  SELECT * FROM lex
`);
const rows = (result as unknown as { rows: TaskRow[] }).rows;
if (rows.length === 0) {
  // pg_trgm fallback — threshold 0.3 default
  const fuzzy = await db.execute<TaskRow>(sql`
    SELECT t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
           t.icon_key, t.instructions,
           GREATEST(similarity(t.name, ${q}), similarity(t.description, ${q})) AS lex_score
    FROM tasks t
    WHERE (t.name % ${q} OR t.description % ${q})
      AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null}::text)
      AND (${setting ?? null}::text IS NULL OR t.setting::text = ${setting ?? null}::text OR t.setting::text = 'either')
    ORDER BY lex_score DESC
    LIMIT ${limit}
  `);
  return { items: mapRows((fuzzy as unknown as { rows: TaskRow[] }).rows) };
}
return { items: mapRows(rows) };
```

**Response-shape mapping:** `rrf_score` → `lex_score` (D-01a). Mapper unchanged otherwise (lines 103-113).

**Out-of-scope but kept in tree:** the `embedder.ts` import, the `embedding <=> vector(384)` distance, the `vector_ranks` CTE, the FULL OUTER JOIN, the `k = 60` constant — DELETE from this route, KEEP the files (`apps/api/src/lib/embedder.ts`, the HNSW index in `0001_init.sql`) so §v2 SEARCH-V2-01 can revive via git history (D-01).

---

### `apps/api/src/routes/recordings/stream-url.ts` (route handler, request-response — NEW) — D-08

**Analog:** `apps/api/src/routes/recordings/get.ts` (the closest — same auth gate, same single-row fetch, same `qa_status` filter, same CloudFront-signer path; the response shape differs).

**Imports pattern** (copy verbatim from `get.ts:11-19`, drop the `RecordingsGetResponseSchema` import):

```typescript
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import { db, schema } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import { RecordingsGetParamsSchema } from './schemas.js';
import { RecordingsStreamUrlResponseSchema } from '@humyn/shared-types'; // NEW shared type
```

**CloudFront helper** (copy `get.ts:26-38` verbatim — same env contract `CLOUDFRONT_RECORDINGS_PRIVATE_KEY` / `CLOUDFRONT_RECORDINGS_KEY_PAIR_ID` / `CLOUDFRONT_RECORDINGS_BASE_URL`):

```typescript
function getCloudFrontSigningKey(): { key: string; keyPairId: string; baseUrl: string } {
  const key = process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY;
  const keyPairId = process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID;
  const baseUrl = process.env.CLOUDFRONT_RECORDINGS_BASE_URL;
  if (!key || !keyPairId || !baseUrl) throw new Error('CloudFront signing config missing');
  return { key, keyPairId, baseUrl };
}
```

**Constants:**

```typescript
const STREAM_TTL_SECONDS = 5 * 60; // D-08 — 5-min TTL
const DEEP_ARCHIVE_DAYS = 90; // Phase 1 S3 lifecycle parity
```

**Auth + rate-limit + Pattern 22 omission** (mirror `contributions/list.ts:25-46` for the rate limit, `get.ts:41-51` for the route shell):

```typescript
export default async function recordingsStreamUrlRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings/:id/stream-url',
    {
      schema: {
        params: RecordingsGetParamsSchema,
        // Response intentionally omitted (Pattern 22 — declaring response.200
        // narrows reply.code() and breaks 404 returns).
      },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const sub = (req.user as { sub?: string } | undefined)?.sub;
              if (sub) return `user:${sub}`;
            } catch {
              /* fall-through */
            }
            return `ip:${req.ip}`;
          },
        },
      },
    },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub;
      // (lookup + auth filter — see below)
    },
  );
}
```

**Core pattern — single-row fetch + qa_status filter** (mirror `get.ts:53-71`):

```typescript
const rows = await db
  .select()
  .from(schema.recordings)
  .where(eq(schema.recordings.id, req.params.id))
  .limit(1);
// Cross-user OR not-found OR takedown OR rejected → 404 recording-not-found
// (T-1.7-10 — never leak existence).
if (
  rows.length === 0 ||
  rows[0]!.userId !== userId ||
  rows[0]!.qaStatus === 'takedown' ||
  rows[0]!.qaStatus === 'rejected'
) {
  const pd = buildProblemDetail({
    slug: PROBLEM_SLUGS.recordingNotFound,
    title: 'Recording not found',
    status: 404,
    instance: req.id as string,
  });
  return reply.status(404).type('application/problem+json').send(pd);
}
const rec = rows[0]!;
```

**Pending + Deep-Archive envelope** (D-08; no S3 HeadObject — derive from `created_at`):

```typescript
if (rec.qaStatus === 'pending') {
  return reply.send({
    presignedUrl: null,
    expiresAt: new Date().toISOString(),
    archiveState: 'unavailable' as const,
  });
}
const ageDays = (Date.now() - rec.createdAt.getTime()) / (1000 * 60 * 60 * 24);
if (ageDays > DEEP_ARCHIVE_DAYS) {
  return reply.send({
    presignedUrl: null,
    expiresAt: new Date().toISOString(),
    archiveState: 'deep-archive' as const,
  });
}
```

**URL mint — CloudFront-signed** (mirror `get.ts:88-95`, RECOMMENDED over S3 presigned per RESEARCH §Pattern 3 — same env contract, same code path used by `/recordings/:id`):

```typescript
const { key, keyPairId, baseUrl } = getCloudFrontSigningKey();
const expiresAt = new Date(Date.now() + STREAM_TTL_SECONDS * 1000);
const presignedUrl = getCloudFrontSignedUrl({
  url: `${baseUrl}/${rec.s3KeyVideo}`,
  privateKey: key,
  keyPairId,
  dateLessThan: expiresAt.toISOString(),
});
return reply.send({
  presignedUrl,
  expiresAt: expiresAt.toISOString(),
  archiveState: 'available' as const,
});
```

**Route registration order (Pattern 28):** `apps/api/src/routes/recordings/index.ts` MUST `await app.register(recordingsStreamUrlRoute)` BEFORE `recordingsGetRoute` (the parameterised `/:id` would steal `/recordings/:id/stream-url` calls). The `verified-ids` pattern already establishes this (`index.ts:26` registers `verified-ids` before `list` before `get`).

---

### `apps/api/src/routes/recordings/list.ts` + `schemas.ts` (route + schema, EDIT — D-03)

**Analog:** self.

**Schema edit** (`schemas.ts:9-13`) — add optional `start` / `end` while keeping the `range` enum as a convenience alias:

```typescript
export const RecordingsListQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  cursor: z.string().length(26).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // D-03 — explicit ISO dates take precedence over `range` when both are present.
  // Sent by the client as 'YYYY-MM-DD' at local midnight; converted to timestamptz
  // server-side via the Accept-Timezone header (D-03b — see route).
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
```

**Route edit** (`list.ts:30-45`) — replace the `RANGE_TO_INTERVAL` branch with an `if (start && end) ... else if (range !== 'all') ... else /* no range filter */`:

```typescript
const { range, cursor, limit, start, end } = req.query;
const tz = req.headers['accept-timezone'] as string | undefined; // D-03b — IANA name
const where: SQL[] = [
  eq(schema.recordings.userId, userId),
  ne(schema.recordings.qaStatus, 'takedown'),
];
if (start && end) {
  // D-03 — explicit window takes precedence. start = inclusive local-midnight,
  // end = exclusive next-day local-midnight (client sends end = the day AFTER the
  // last-included day). tz coerces from device local → server timestamptz.
  const tzClause = tz ? sql`AT TIME ZONE ${tz}` : sql``;
  where.push(sql`${schema.recordings.createdAt} >= (${start}::date ${tzClause})`);
  where.push(sql`${schema.recordings.createdAt} <  (${end}::date   ${tzClause})`);
} else if (range !== 'all') {
  where.push(
    sql`${schema.recordings.createdAt} >= now() - (${RANGE_TO_INTERVAL[range]})::interval`,
  );
}
// cursor handling unchanged (list.ts:46-65)
```

**No new error path** — invalid `start`/`end` (inverted, future-dated, malformed) → fastify-zod regex reject → 400 problem-detail (existing handler in `apps/api/src/plugins/error-handler.ts`). D-03c says client validates inverted range / `max=today` BEFORE sending.

---

### `apps/api/src/routes/contributions/timeseries.ts` (route handler, EDIT — D-03 + D-03a aggregate)

**Analog:** self + sibling `contributions/list.ts`.

**Schema edit** — `shared/types/src/contributions.ts` (lines 28-31):

```typescript
export const ContributionsTimeseriesQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** D-03a — when true, returns one aggregated bucket (sum + COUNT(DISTINCT task_id)) instead of daily buckets. */
  aggregate: z.coerce.boolean().default(false),
});
```

**Route edit** — branch on `aggregate`. When `true`, return `{ buckets: [{ bucketDate: start, durationMs: SUM, recordingCount: COUNT(*), taskCount: COUNT(DISTINCT task_id) }] }` (a single-element array preserves the existing response shape):

```typescript
if (req.query.aggregate) {
  // D-03a — one aggregated bucket. Same recordings-table query as
  // contributions/list.ts:51-58 but windowed by the start/end pair (or `range`
  // when start/end absent).
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(duration_ms), 0)::bigint AS duration_ms,
      COALESCE(COUNT(*), 0)::int AS recording_count,
      COALESCE(COUNT(DISTINCT task_id), 0)::int AS task_count
    FROM recordings
    WHERE user_id = ${sub}
      AND qa_status NOT IN ('takedown', 'rejected')
      ${
        start && end
          ? sql`AND created_at >= (${start}::date ${tzClause})
                           AND created_at <  (${end}::date   ${tzClause})`
          : sql``
      }
  `);
  // ... return shape with a single-element buckets array, bucketDate = start (or window-floor)
}
```

**Otherwise** (daily-buckets path) — unchanged from `timeseries.ts:51-66`, but `bucket_date >= ...` cutoff now derives from `start`/`end` when present.

---

### `apps/api/src/db/migrations/0007_pg_trgm.sql` (NEW — migration)

**Analog:** `0006_recording_events_outbox.sql` (lines 1-21) — single CREATE EXTENSION + idempotency pattern.

**Pattern to copy** (idempotent + comment header):

```sql
-- 0007 — Phase 6 plan 06-02 (D-02)
-- pg_trgm extension — fuzzy-fallback for /tasks/search when ts_vector returns
-- zero rows. Threshold defaults to pg_trgm.similarity_threshold = 0.3 (PG 17).
-- A GIN trigram index on tasks.name is OPTIONAL on a 65-row catalog; left out
-- until measured as a regression on the seeded prod-shape fixture.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optional, defer until measured:
-- CREATE INDEX IF NOT EXISTS tasks_name_trgm_idx
--   ON tasks USING gin (name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS tasks_desc_trgm_idx
--   ON tasks USING gin (description gin_trgm_ops);
```

---

### `apps/api/test/routes/recordings/stream-url.test.ts` (NEW — test)

**Analog:** `apps/api/test/routes/recordings-get.test.ts` (the closest — same CloudFront-keypair generation pattern, same `seedRec` helper for varied `qa_status`, same JWT minting).

**Setup pattern** (copy verbatim from `recordings-get.test.ts:1-100` — RSA keypair gen, user inserts, task insert, recording seed helper).

**Test matrix** (one `describe` block per state):

| State (input)                                | Expected output                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `qa_status=verified`, age < 90d              | `200 { presignedUrl: '<cf-url>', expiresAt: ISO, archiveState: 'available' }` |
| `qa_status=uploaded`, age < 90d              | same as `verified`                                                            |
| `qa_status=hash-mismatch`, age < 90d         | same as above (D-08 only excludes `takedown`/`rejected`/`pending`)            |
| `qa_status=pending`                          | `200 { presignedUrl: null, expiresAt: <now>, archiveState: 'unavailable' }`   |
| `qa_status=takedown`                         | `404 recording-not-found` problem-detail                                      |
| `qa_status=rejected`                         | `404 recording-not-found`                                                     |
| cross-user recording (correct id, wrong sub) | `404 recording-not-found` (T-1.7-10)                                          |
| `age > 90d`                                  | `200 { presignedUrl: null, archiveState: 'deep-archive' }`                    |
| Unauthenticated                              | `401 unauthorized`                                                            |
| Over rate-limit (61st req/min)               | `429 rate-limited`                                                            |

**Skeleton:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// ... copy imports + `tok()` + `beforeAll`/`afterAll`/`seedRec` from recordings-get.test.ts

describe('GET /recordings/:id/stream-url', () => {
  it('returns CloudFront-signed URL for an uploaded recording', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.archiveState).toBe('available');
    expect(body.presignedUrl).toMatch(/^https:\/\/recordings-dev\.humyn\.ai\//);
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  // ...
});
```

---

### `apps/mobile/src/screens/home/HomeScreen.tsx` (screen, NEW — replaces `HomeSkeletonScreen.tsx`)

**Analog:** `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (same path on disk — Phase 6 replaces the placeholder while **preserving the Pending Uploads section verbatim**).

**Shell pattern (keep verbatim lines 169-194):**

```typescript
return (
  <ScreenContainer accessibilityLabel="Home screen" padding={0}>
    <TopBar {...topBarProps} />
    {softUpgradeAvailable ? (
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <SoftUpgradeBanner />
      </View>
    ) : null}
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}  // NEW — HOME-09
    >
      {/* NEW — empty vs returning hero block */}
      <HomeHero
        variant={lifetime.recordingCount === 0 ? 'empty' : 'returning'}
        lifetimeMs={lifetime.durationMs}
        taskCount={lifetime.taskCount}
        onStartRecording={() => navigation.navigate('MainTabs', { screen: 'Tasks' })}
      />
      {/* NEW — "Your contribution" section header + tile pair + filter chip */}
      <Text variant="eyebrow" tone="secondary" style={styles.sectionHeader}>YOUR CONTRIBUTION</Text>
      <ContributionTile range={homeRange} kind="duration" value={duration} onTapChip={openFilterSheet} />
      <ContributionTile range={homeRange} kind="taskCount" value={taskCount} onTapChip={openFilterSheet} />
      {lifetime.recordingCount === 0 && (
        <Text variant="caption" tone="secondary">Your hours and tasks will track here as you record.</Text>
      )}
      {/* PRESERVE — Pending Uploads section (Phase 5 D-10 wiring). Wrap in
          `pendingRows.length > 0` guard (HOME-05 — D-09 gate) + the new
          OfflineBanner inside the section header. */}
      {pendingRows.length > 0 && (
        <>
          <Text variant="eyebrow" tone="secondary" style={styles.sectionHeader}>PENDING UPLOADS</Text>
          {offline ? <OfflineBanner /> : null}
          <Pressable onPress={() => { void HumynUpload.drainNowSafe(); navigation.navigate('MainTabs', { screen: 'History' }); }} style={styles.card}>
            {/* identical row mapping from HomeSkeletonScreen.tsx:242-291 */}
          </Pressable>
        </>
      )}
    </ScrollView>
    <FilterSheet
      visible={filterOpen}
      onDismiss={closeFilterSheet}
      value={homeRange}
      onChange={setHomeRange}
    />
  </ScreenContainer>
);
```

**Data hooks pattern (extend HomeSkeletonScreen.tsx:101-167):**

- Keep the existing `pendingRows` + `progressById` subscriptions (Phase 5 D-10 wiring, lines 112-132).
- Keep the `drainPendingUploadToast()` + `useFocusEffect` 30 s poll (lines 140-167).
- Add `lifetime` fetch (`GET /contributions`) + `aggregate` fetch (`GET /contributions/timeseries?start=&end=&aggregate=true`) with `useFocusEffect`-driven re-fetch + a `RefreshControl` `onPullRefresh` handler that re-fires both.

**Time-range plumbing:** `homeRange` (slice on `appStore`) → `computeRange(homeRange)` (`services/timeRange.ts`) → `{ start, end }` query params (D-03 / D-03b / RESEARCH §Pattern 2).

---

### `apps/mobile/src/screens/tasks/TasksScreen.tsx` (screen, NEW)

**Analog:** `HomeSkeletonScreen.tsx` for the shell + `PendingUploadsScreen.tsx` for the row-list rendering.

**Shell (mirror HomeSkeletonScreen.tsx:169-194):**

```typescript
<ScreenContainer accessibilityLabel="Tasks screen" padding={0}>
  <TopBar {...topBarProps} />
  <SearchInput
    placeholder="Search tasks…"
    onChangeDebounced={onSearchDebounced}
    debounceMs={200}                       // TASK-03 — 200 ms debounce
  />
  <TaskCategoryPills selected={category} onSelect={setCategory} />
  <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
    {results.length === 0
      ? <TasksNoResultsEmpty onSendRequest={openSendRequestSheet} />  // TASK-10
      : <TaskGrid items={results} onTapCard={openTaskDetails} />}
    <SendRequestFooterLink onPress={openSendRequestSheet} />
  </ScrollView>
  <TaskDetailsSheet visible={detailsOpen} task={selectedTask} onDismiss={closeDetails} onStartRecording={...} />
  <SendRequestSheet visible={requestOpen} onDismiss={closeRequest} />
</ScreenContainer>
```

**Debounced search:** `SearchInput.tsx` hosts a `useEffect` with `setTimeout(() => onChangeDebounced(value), debounceMs)` + clear on next change.

**`__DEV__` long-press affordance:** preserve from `TasksPlaceholderScreen.tsx:72-90` (the `__DEV__`-gated debug entry to `RecordingScreen` with the `DEV_TASK_ID` constant — keep the constant + comment trail verbatim).

---

### `apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx` (NEW — bottom sheet)

**Analog:** `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx:162-190` (uses `<Sheet>` primitive verbatim).

**Pattern:**

```typescript
import { Sheet } from '../../ui/primitives/Sheet';
// ...
return (
  <Sheet visible={visible} onDismiss={onDismiss} accessibilityLabel="task-details-sheet">
    {/* 40×4 grab handle (design-spec §11) */}
    <View style={styles.grabHandle} />
    {/* 64 px accent-soft well + 40 px TaskIcon */}
    <View style={styles.iconWell}><TaskIcon task={task.slug} size={40} strokeWidth={1.75} color={colors.accent} /></View>
    {/* chips (Category, conditional Setting=Outdoor) + name + description */}
    <Text variant="sheetTitle">{task.name}</Text>
    <Text variant="body" tone="secondary">{task.description}</Text>
    {/* Universal-rules well: 4 hard-coded rows from task-taxonomy.md */}
    <View style={styles.rulesWell}>
      <Text variant="eyebrow" style={{color: colors.accent}}>ALWAYS</Text>
      {UNIVERSAL_RULES.map(r => <UniversalRuleRow key={r.icon} icon={r.icon} label={r.label} />)}
    </View>
    {/* "For this task" — up to 3 instructions from task.instructions */}
    <Text variant="eyebrow">FOR THIS TASK</Text>
    {task.instructions.map((line, i) => <BulletRow key={i} text={line} />)}
    {/* Sticky Start Recording CTA */}
    <Button variant="primary" label="Start Recording" onPress={onStartRecording} />
  </Sheet>
);
```

**Universal-rules constants** (hard-coded; verbatim from `task-taxonomy.md` header):

```typescript
const UNIVERSAL_RULES = [
  { icon: 'front_hand', label: 'Keep your hands in frame' },
  { icon: 'videocam', label: 'Mount the device firmly on the rig' },
  { icon: 'lightbulb', label: 'Make sure your space is well-lit' },
  { icon: 'apps', label: 'Close all other apps before you start' },
] as const;
```

**Start-Recording navigation** (mirror `TasksPlaceholderScreen.tsx:72-76` Recording-route push shape):

```typescript
onStartRecording={() => {
  onDismiss();
  setTimeout(() => navigation.navigate('Recording', {
    taskId: task.id,
    taskName: task.name,
    taskCategory: task.category,
    taskSetting: task.setting,
    isPractice: false,
  }), 200);  // 200 ms close delay (design-spec §11 footer)
}}
```

---

### `apps/mobile/src/screens/tasks/SendRequestSheet.tsx` (NEW — multipart form sheet)

**Analog:** `apps/mobile/src/components/ReportProblemSheet.tsx` (the exact pattern — modal bottom-sheet + form fields + multipart submit + Idempotency-Key + Toast).

**Imports pattern** (copy verbatim from `ReportProblemSheet.tsx:28-38`):

```typescript
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, spacing, radii } from '../../ui/tokens';
import { submitTaskRequest } from '../../services/taskRequestService';
```

**Form + validation pattern** (mirror `ReportProblemSheet.tsx:44-68`):

- `category` chip-row (10 taxonomy options + `Other`)
- `name` 3-80 chars TextInput
- `description` 10-240 chars textarea (3 rows)
- `setting` segmented Indoor/Outdoor
- optional sample video (≤30 s, ≤50 MB) via document/video picker; client-side validation before network call

**Submit pattern** (mirror `ReportProblemSheet.tsx:49-68`):

```typescript
const submit = async () => {
  if (!validate()) return;
  setSubmitting(true);
  try {
    await submitTaskRequest({ name, description, category, setting, sampleVideoUri });
    showToast("Request sent. We'll review and add it to your list.", 5000); // TASK-09 success
    onClose();
  } catch (e) {
    setBanner({ kind: 'error', text: "Couldn't send. Try again." }); // TASK-09 error
  } finally {
    setSubmitting(false);
  }
};
```

---

### `apps/mobile/src/screens/history/HistoryScreen.tsx` (screen, NEW)

**Analog:** `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` for the row layout (the file is already the History-row visual contract per its own header comment — "Row layout mirrors `design-spec.md §16`").

**SectionList pattern** (HIST-02 — RESEARCH §Pattern 6):

```typescript
<SectionList
  sections={groupedSections}   // [{ title: 'Today', data: [...] }, { title: 'This week', data: [...] }, ...]
  keyExtractor={r => r.recording_id}
  renderItem={({ item }) => <HistoryRow row={item} ledgerEntry={ledger[item.recording_id]} onTap={openPlayer} />}
  renderSectionHeader={({ section }) => <HistoryDayHeader title={section.title} />}
  stickySectionHeadersEnabled={false}
  ListHeaderComponent={<FilterChip range={historyRange} onPress={openFilterSheet} />}
  ListEmptyComponent={hasFilter ? <HistEmptyFiltered onShowAllTime={...} /> : <HistEmptyNew onPickTask={...} />}
  onEndReached={() => fetchMore(cursor)}
  onEndReachedThreshold={0.5}
/>
```

**Day-grouping logic** (UI-SPEC §History day-group header — Today / Yesterday / This week / This month / "{MonthName YYYY}"):

- `Today` — `created_at` is today (device local-tz)
- `Yesterday` — `created_at` is yesterday
- `This week` — last 7 days excluding today/yesterday
- `This month` — older than 7 days, within current calendar month
- `{MonthName YYYY}` — prior months (Apr 2026, Mar 2026, …)

**Row pattern (`HistoryRow.tsx`)** — copy `PendingUploadsScreen.tsx:156-215` (the entire `renderRow` closure + the styles block lines 248-330). Replace `fileName(row.mp4Path)` with the ledger-overlay path; replace `mp4Path` with `taskName` (task name resolved from `task_id`); preserve the 64×64 thumb / chip variant / meta line shape.

**Thumbnail fallback** (D-04 — when ledger entry is missing):

```typescript
{ledgerEntry?.thumbnailPath
  ? <Image source={{ uri: `file://${ledgerEntry.thumbnailPath}` }} style={styles.thumb} />
  : <View style={[styles.thumb, styles.thumbFallback]}>
      <Text style={styles.thumbLetter}>{taskName.slice(0,1).toUpperCase()}</Text>
    </View>
}
```

---

### `apps/mobile/src/screens/history/PlayerScreen.tsx` (NEW — full-bleed dark player)

**Analog:** `apps/mobile/src/screens/recording/RecordingScreen.tsx` (the closest — same full-bleed dark surface + `gestureEnabled:false`/`headerShown:false`/`animation:fade` route options at `RootNativeStack.tsx:83-86`).

**Route registration** (mirror `RootNativeStack.tsx:83-86` Recording screen options):

```typescript
<Root.Screen
  name="Player"
  component={PlayerScreen}
  options={{ gestureEnabled: false, headerShown: false, animation: 'fade' }}
/>
```

**Screen shell** — dark theme (`colors.recBg` / `colors.recTextPrimary` etc. already in tokens.ts:43-55):

```typescript
<View style={[StyleSheet.absoluteFill, { backgroundColor: colors.recBg }]}>
  {/* Top bar (50/22/18 padding per UI-SPEC) */}
  <View style={styles.topBar}>
    <Pressable onPress={() => navigation.goBack()}><Icon name="X" size={24} color={colors.recTextPrimary} /></Pressable>
    <Text style={styles.taskName}>{taskName}</Text>
    <View style={styles.lockBadge}><Icon name="Lock" size={16} /><Text style={styles.lockLabel}>View-only</Text></View>
  </View>
  {/* HumynPlayerView — 16 px radius video frame letterboxed inside the portrait surface */}
  <HumynPlayerView style={styles.videoFrame} />
  {/* Centered 64×64 play overlay (visible while paused) */}
  {paused && <Pressable onPress={play}><View style={styles.playOverlay}>▶</View></Pressable>}
  {/* 4 px scrub bar + mono time row */}
  <View style={styles.scrubRow}>
    <Text style={styles.timeLabel}>{formatTime(positionMs)}</Text>
    <ScrubBar position={positionMs} buffered={bufferedMs} duration={durationMs} onSeek={seek} />
    <Text style={styles.timeLabel}>{formatTime(durationMs)}</Text>
  </View>
  {/* Footer */}
  <Text style={styles.footer}>View only — not downloadable.</Text>
  {/* Disabled overlays for archiveState !== 'available' */}
  {archiveState === 'deep-archive' && <DisabledOverlay text="This recording has been archived. Contact support for retrieval." />}
  {archiveState === 'unavailable' && <DisabledOverlay text="Still uploading — try again in a moment." />}
</View>
```

**Source-resolution logic** (D-06):

```typescript
useEffect(() => {
  const ledgerEntry = readThumbnailLedger(recordingId);
  if (ledgerEntry?.mp4LocalPath && (await RNFS.exists(ledgerEntry.mp4LocalPath))) {
    HumynPlayer.prepare(`file://${ledgerEntry.mp4LocalPath}`);
  } else {
    const { presignedUrl, archiveState } = await getRecordingStreamUrl(recordingId);
    setArchiveState(archiveState);
    if (presignedUrl) HumynPlayer.prepare(presignedUrl);
  }
}, [recordingId]);
```

---

### `apps/mobile/android/.../player/HumynPlayerModule.kt` (NEW — native module)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraModule.kt` (exact — same 3-file native-module triad with a `View` sibling).

**Imports pattern (copy from `HumynGateCameraModule.kt:1-7`):**

```kotlin
package ai.humynlabs.capture.player

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
```

**Module shell (copy verbatim from `HumynGateCameraModule.kt:28-69` — rename + swap methods):**

```kotlin
@ReactModule(name = HumynPlayerModule.NAME)
class HumynPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object { const val NAME = "HumynPlayer" }

    override fun getName(): String = NAME

    @ReactMethod
    fun prepare(uri: String, promise: Promise) {
        PlayerController.prepare(reactApplicationContext, uri) { result ->
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { promise.reject("PLAYER_PREPARE_FAILED", it.message, it) },
            )
        }
    }

    @ReactMethod
    fun play(promise: Promise) { /* PlayerController.play(...) */ }

    @ReactMethod
    fun pause(promise: Promise) { /* PlayerController.pause(...) */ }

    @ReactMethod
    fun seekTo(positionMs: Double, promise: Promise) { /* PlayerController.seekTo(...) */ }

    @ReactMethod
    fun release(promise: Promise) { /* PlayerController.release(...) */ }
}
```

**ExoPlayer body** (in a sibling `PlayerController.kt` — pattern mirrors `GateCameraController` in `gatecamera/GateCameraController.kt`):

```kotlin
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player

object PlayerController {
    private var player: ExoPlayer? = null

    fun prepare(ctx: Context, uri: String, cb: (Result<Unit>) -> Unit) {
        try {
            val ep = player ?: ExoPlayer.Builder(ctx).build().also { player = it }
            ep.setMediaItem(MediaItem.fromUri(uri))
            ep.prepare()
            ep.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) { /* emit onProgress/onBuffer/onEnd */ }
                override fun onPlayerError(error: PlaybackException) { /* emit onError */ }
            })
            cb(Result.success(Unit))
        } catch (t: Throwable) { cb(Result.failure(t)) }
    }
    // play/pause/seekTo/release — direct ExoPlayer delegates
}
```

**Event emission pattern** (mirror `apps/mobile/android/.../upload/UploadCoordinator.kt`'s `RCTDeviceEventEmitter` shape — re-use the same emit helper):

- `onProgress` `{ positionMs, bufferedMs, durationMs }` — emit on a 250 ms ticker
- `onBuffer` `{ buffering: boolean }` — emit on `STATE_BUFFERING` transitions
- `onEnd` `{}` — emit on `STATE_ENDED`
- `onError` `{ code, msg }` — emit on `PlaybackException`

---

### `apps/mobile/android/.../player/HumynPlayerView.kt` (NEW — TextureView surface)

**Analog:** `apps/mobile/android/.../gatecamera/HumynGateCameraView.kt` (exact — same TextureView + SurfaceTexture publish pattern).

**Imports + class shell (copy verbatim from `HumynGateCameraView.kt:1-44`, swap controller reference):**

```kotlin
package ai.humynlabs.capture.player

import android.content.Context
import android.graphics.SurfaceTexture
import android.view.Surface
import android.view.TextureView

class HumynPlayerView(context: Context) : TextureView(context), TextureView.SurfaceTextureListener {
    private var surface: Surface? = null
    init {
        surfaceTextureListener = this
        if (isAvailable) surfaceTexture?.let { onSurfaceTextureAvailable(it, width, height) }
    }
    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
        val s = Surface(st); surface = s
        PlayerController.onSurfaceAvailable(s)   // ← swapped from GateCameraController
    }
    override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {}
    override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
        PlayerController.onSurfaceDestroyed(surface)
        surface?.release(); surface = null
        return true
    }
    override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
}
```

**Difference from gate camera:** no `configureTransform()` matrix needed — ExoPlayer's `Player.setVideoSurface(surface)` handles aspect-ratio inside the surface (with `RESIZE_MODE_FIT` letterboxing per design-spec §14 portrait + letterboxed).

---

### `apps/mobile/android/.../player/HumynPlayerPackage.kt` + `HumynPlayerViewManager.kt` (NEW)

**Analog:** `HumynGateCameraPackage.kt` (verbatim — 17-line file) + `HumynGateCameraViewManager.kt` (verbatim — same `SimpleViewManager` boilerplate + the no-op `@ReactProp` to silence the `ViewManagerPropertyUpdater` warning).

```kotlin
// HumynPlayerPackage.kt — copy verbatim from HumynGateCameraPackage.kt, rename
class HumynPlayerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext) =
        listOf(HumynPlayerModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext) =
        listOf(HumynPlayerViewManager())
}
```

**Registration** — `MainApplication.kt:53` style append, single line after `HumynUploadPackage()`:

```kotlin
packages.add(HumynPlayerPackage())  // Phase 6 D-07 — in-app HEVC player (media3 ExoPlayer)
```

---

### `apps/mobile/src/native/HumynPlayer.ts` (NEW — JS bridge)

**Analog:** `apps/mobile/src/native/HumynGateCamera.ts` (exact — same `ensure()` guard + `requireNativeComponent` pattern + the `is*Available()` discriminant).

**Imports + ensure pattern (copy verbatim from `HumynGateCamera.ts:33-52`, rename):**

```typescript
import {
  NativeModules,
  NativeEventEmitter,
  requireNativeComponent,
  type EmitterSubscription,
  type ViewStyle,
} from 'react-native';

interface HumynPlayerNativeModule {
  prepare(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  release(): Promise<void>;
}

function ensure(): HumynPlayerNativeModule {
  const native = NativeModules.HumynPlayer as HumynPlayerNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynPlayer native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

export const isPlayerAvailable = (): boolean => NativeModules.HumynPlayer != null;

export const HumynPlayer = {
  prepare: (uri: string) => ensure().prepare(uri),
  play: () => ensure().play(),
  pause: () => ensure().pause(),
  seekTo: (positionMs: number) => ensure().seekTo(positionMs),
  release: () => ensure().release(),
} as const;
```

**Native component view (copy `HumynGateCamera.ts:71-74`):**

```typescript
export const HumynPlayerView = requireNativeComponent<{ style?: ViewStyle }>('HumynPlayerView');
```

**Event subscriptions (copy `HumynUpload.ts:246-275` pattern — lazy `NativeEventEmitter`):**

```typescript
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) _emitter = new NativeEventEmitter(NativeModules.HumynPlayer);
  return _emitter;
}
export function onPlayerProgress(
  listener: (e: { positionMs: number; bufferedMs: number; durationMs: number }) => void,
): EmitterSubscription {
  return emitter().addListener('onProgress', listener);
}
export function onPlayerBuffer(listener: (e: { buffering: boolean }) => void): EmitterSubscription {
  /* ... */
}
export function onPlayerEnd(listener: () => void): EmitterSubscription {
  /* ... */
}
export function onPlayerError(
  listener: (e: { code: string; msg: string }) => void,
): EmitterSubscription {
  /* ... */
}
```

---

### `apps/mobile/android/.../capture/ThumbnailExtractor.kt` (NEW — D-05)

**Analog:** `apps/mobile/android/.../capture/HashStreamer.kt` (a sibling read-only helper consumed by `FinalizeWorker.finalize`).

**Pattern** (the body matches RESEARCH §Pattern 5 verbatim):

```kotlin
package ai.humynlabs.capture.capture

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.util.Log
import java.io.File
import java.io.FileOutputStream

object ThumbnailExtractor {
    fun extractFirstFrame(mp4File: File, thumbsDir: File): File? {
        thumbsDir.mkdirs()
        val outFile = File(thumbsDir, "${mp4File.nameWithoutExtension}.thumb.jpg")
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(mp4File.absolutePath)
            val bitmap = retriever.getFrameAtTime(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC) ?: return null
            FileOutputStream(outFile).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out) }
            bitmap.recycle()
            return outFile
        } catch (t: Throwable) {
            Log.w("ThumbnailExtractor", "extract failed for ${mp4File.name}", t)
            outFile.delete()
            return null
        } finally { retriever.release() }
    }
}
```

---

### `apps/mobile/android/.../capture/FinalizeWorker.kt` (EDIT — D-05)

**Analog:** self (insert step 7.5 between step 7 SidecarManager.delete and step 8 emit).

**Insertion point** (`FinalizeWorker.kt:127-149`):

```kotlin
// 7. Orphan-sidecar contract: deleting the sidecar signals "finalize complete"
SidecarManager.delete(seg.sidecarFile)

// 7.5 NEW — Phase 6 D-05: best-effort first-frame thumbnail extraction.
//      Skipped for practice segments + crash-recovered fragments (those rows
//      never reach the upload ledger). On any throwable, log and continue —
//      the thumbnail is best-effort (D-04 fallback: gradient + first letter).
val thumbsDir = File(seg.mp4File.parentFile?.parentFile, "thumbs")  // filesDir/thumbs/, sibling of filesDir/<recording>/
val thumbnailFile: File? = if (!seg.sidecar.isPractice) {
    ThumbnailExtractor.extractFirstFrame(seg.mp4File, thumbsDir)
} else null

// 8. Emit onSegmentComplete — extend payload with thumbnailPath
val payload = Arguments.createMap().apply {
    putString("segmentId", seg.segmentId)
    // ... (existing keys lines 133-148)
    putString("thumbnailPath", thumbnailFile?.absolutePath)  // NEW — nullable
}
emit("onSegmentComplete", payload)
```

**JS-side handoff (`apps/mobile/src/services/thumbnailLedger.ts`):** write the ledger entry from the segment-complete handler (mirror the existing `HumynUpload.enqueue(...)` call site in RecordingScreen.tsx) — D-05a's "JS-side writes MMKV" rationale (single MMKV-key derivation source).

---

### `apps/mobile/src/services/thumbnailLedger.ts` (NEW — MMKV CRUD)

**Analog:** `apps/mobile/src/services/uploadReconcile.ts` (MMKV reads/writes for Phase 5 outbox cursors — closest existing service that owns a slice of MMKV state).

**Pattern** (per-key stash, mirrors Phase 4's `practiceDoneKey(sub)` from `state/keys.ts:50-52`):

```typescript
import { secureMmkv } from '../state/mmkv';
import { pendingThumbKey } from '../state/keys';

export interface ThumbnailLedgerEntry {
  recordingId: string;
  thumbnailPath: string | null; // filesDir/thumbs/<base>.thumb.jpg
  filename: string; // <base>.mp4
  mp4LocalPath: string; // filesDir/<recording>/<base>.mp4 — null after verified-cleanup
  createdAtMs: number;
}

export function readEntry(recordingId: string): ThumbnailLedgerEntry | null {
  const raw = secureMmkv.getString(pendingThumbKey(recordingId));
  return raw ? (JSON.parse(raw) as ThumbnailLedgerEntry) : null;
}

export function writeEntry(entry: ThumbnailLedgerEntry): void {
  secureMmkv.set(pendingThumbKey(entry.recordingId), JSON.stringify(entry));
}

export function clearLocalPath(recordingId: string): void {
  const e = readEntry(recordingId);
  if (!e) return;
  writeEntry({ ...e, mp4LocalPath: '' }); // thumbnail survives; mp4LocalPath cleared on verified-cleanup
}

export function deleteEntry(recordingId: string): void {
  secureMmkv.remove(pendingThumbKey(recordingId));
}

/** D-04a — opportunistic cleanup on cold start (best-effort). */
export async function cleanupOpportunistic(serverRecordingIds: Set<string>): Promise<void> {
  // Iterate known recording_id keys; delete entries whose id isn't in the server's recent set.
  // No app-launch reconcile sweep beyond Phase 5's uploadReconcile.ts (D-04a).
}
```

**Keys edit** (`apps/mobile/src/state/keys.ts:38-52` style — add at the bottom):

```typescript
/**
 * Phase 6 (D-04 / D-05) — per-recording thumbnail-ledger entry key.
 * Pattern: `pendingThumb.{recordingId}.v1` — mirrors `practiceDoneKey(sub)`.
 * Written by FinalizeWorker's segment-complete handoff; survives the post-
 * verified MP4 delete; cleared by `cleanupOpportunistic` on cold start.
 */
export function pendingThumbKey(recordingId: string): string {
  return `pendingThumb.${recordingId}.v1`;
}
```

---

### `apps/mobile/android/.../beep/HumynBeepModule.kt` (Wave 1 — D-09)

**Analog:** self (line edit on lines 99-104).

**Today** (`HumynBeepModule.kt:99-104`):

```kotlin
.setAudioAttributes(
    AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
)
```

**Suspected fix** (RESEARCH §Wave 1 — `USAGE_ASSISTANCE_SONIFICATION` may be routed to a muted "system" stream on Android 16 / Pixel 10a; flip to `USAGE_MEDIA`):

```kotlin
.setAudioAttributes(
    AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)              // CHANGED — media stream is what user MAX-volume controls
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
)
```

**Instrumentation** (add before/after the `pool.play(...)` call at line 150):

```kotlin
val streamId = pool.play(id, 1f, 1f, 1, 0, 1f)
Log.i("HumynBeep", "playTone name=$name sampleId=$id streamId=$streamId loadedIds=$loadedSampleIds")
if (streamId == 0) {
    Log.w("HumynBeep", "play returned 0 (max streams busy or load incomplete)")
    promise.reject("BEEP_FAILED", "SoundPool.play returned 0 for $name")
    return
}
```

**Vibrator restore** (separate edit — investigate at JS call sites in `apps/mobile/src/hooks/useRecordingLifecycle.ts`; the AndroidManifest's `android.permission.VIBRATE` may need an explicit declaration on Android 14+).

---

## Shared Patterns

### Authentication (every authenticated route)

**Source:** `apps/api/src/plugins/auth.ts:49-73` — `app.requireAuth` decorator.

**Apply to:** `stream-url.ts` (NEW), `list.ts` (EDIT), `timeseries.ts` (EDIT). **NOT** `tasks/search.ts` (`/tasks/search` is intentionally public per `apps/api/src/routes/tasks/search.ts` header — anonymous-tier rate-limit applies).

**Pattern:**

```typescript
preHandler: [app.requireAuth],
// then inside the handler:
const userId = (req.user as { sub: string }).sub;
```

---

### Per-user rate-limit keyed by JWT sub (best-effort)

**Source:** `apps/api/src/routes/contributions/list.ts:30-44` (canonical) and `apps/api/src/routes/tasks/create-request.ts:19-27` (alternate shape using `JwtPayload`).

**Apply to:** `stream-url.ts` (D-08 — 60/min per user), `timeseries.ts` extended (already 60/min, unchanged), `list.ts` extended (no rate-limit today; keep as-is — D-08 only specifies for stream-url).

**Pattern:**

```typescript
config: {
  rateLimit: {
    max: 60,
    timeWindow: '1 minute',
    keyGenerator: async (req) => {
      try {
        await req.jwtVerify();
        const sub = (req.user as { sub?: string } | undefined)?.sub;
        if (sub) return `user:${sub}`;
      } catch { /* fall-through */ }
      return `ip:${req.ip}`;
    },
  },
},
```

The `keyGenerator` MUST do its own `jwtVerify()` because `@fastify/rate-limit` fires BEFORE `preHandler` (so `req.user` is not yet populated).

---

### Pattern 22 — omit `response.{status}` schema when error returns vary

**Source:** STATE.md Pattern 22, applied verbatim at `apps/api/src/routes/recordings/get.ts:44-49` and `apps/api/src/routes/tasks/create-request.ts:30-33`.

**Apply to:** `stream-url.ts` (NEW — returns 200 with `presignedUrl: null` AND 404 problem-detail; must omit `response.200` so `reply.code(404)` isn't type-narrowed).

**Pattern:**

```typescript
schema: {
  params: RecordingsGetParamsSchema,
  // Response schema intentionally omitted (Pattern 22 — declaring response.200
  // narrows reply.code() and breaks 404 returns).
},
```

---

### Pattern 28 — Fastify radix-tree precedence (literal before parameterised)

**Source:** `apps/api/src/routes/recordings/index.ts:26-28` + `apps/api/src/routes/tasks/index.ts:9-14`.

**Apply to:** `apps/api/src/routes/recordings/index.ts` (EDIT — register `recordingsStreamUrlRoute` AFTER `verified-ids` AND `list` but BEFORE `recordingsGetRoute`):

```typescript
await app.register(recordingsVerifiedIdsRoute); // GET /recordings/verified-ids (literal)
await app.register(recordingsListRoute); // GET /recordings (literal)
await app.register(recordingsStreamUrlRoute); // GET /recordings/:id/stream-url (Phase 6 — literal suffix beats /:id)
await app.register(recordingsGetRoute); // GET /recordings/:id (parameterised — LAST)
```

The radix tree resolves `/recordings/:id/stream-url` ONLY because the literal `/stream-url` suffix registers first; flipping the order makes `/:id` swallow it.

---

### Native module triad — Module / Package / View(Manager)

**Source:** `apps/mobile/android/.../gatecamera/HumynGateCamera{Module,Package,View,ViewManager}.kt` (4-file native module — exact same shape).

**Apply to:** `apps/mobile/android/.../player/HumynPlayer{Module,Package,View,ViewManager}.kt`.

**Pattern (4 files):**

1. `*Module.kt` — `ReactContextBaseJavaModule` + `@ReactMethod` body
2. `*Package.kt` — `ReactPackage` returning the module + the view manager
3. `*View.kt` — `TextureView` + `SurfaceTextureListener`
4. `*ViewManager.kt` — `SimpleViewManager<*View>` with a no-op `@ReactProp` to silence `ViewManagersPropertyCache` warning (see `HumynGateCameraViewManager.kt:25-41`)

**Plus** the `MainApplication.kt:40-54` `packages.add(...)` line.

---

### MMKV-backed per-key state (encryption + versioned keys)

**Source:** `apps/mobile/src/state/mmkv.ts` (singleton) + `apps/mobile/src/state/keys.ts:50-52` (`practiceDoneKey(sub)` per-key stash pattern).

**Apply to:** thumbnail ledger (Phase 6 D-04) — add `pendingThumbKey(recordingId)` to `keys.ts`; use `secureMmkv.set/getString/remove` from `services/thumbnailLedger.ts`. NEVER create a second MMKV instance (mmkv.ts header rule).

---

### JS bridge stub-then-body pattern

**Source:** `apps/mobile/src/native/HumynUpload.ts:128-244` (the canonical `ensure()` + `*Safe()` + lazy `NativeEventEmitter` triad) and `apps/mobile/src/native/HumynGateCamera.ts:44-75` (the simpler ensure() + `is*Available()` discriminant + `requireNativeComponent`).

**Apply to:** `apps/mobile/src/native/HumynPlayer.ts` — mirror `HumynGateCamera.ts` for the bridge methods + `requireNativeComponent` and mirror `HumynUpload.ts:246-275` for the event subscriptions.

---

### Bottom-sheet primitive

**Source:** `apps/mobile/src/ui/primitives/Sheet.tsx` (the canonical `<Sheet visible onDismiss>...children...</Sheet>` modal) — used by `RigTutorialScreen.tsx:162-190`.

**Apply to:** `TaskDetailsSheet.tsx` (Wave 4), `FilterSheet.tsx` (Wave 4).

**Pattern:**

```typescript
<Sheet visible={visible} onDismiss={onDismiss} accessibilityLabel="...-sheet">
  {/* 40×4 grab handle for sheets that need it (TaskDetails per §11) */}
  {children}
</Sheet>
```

For the **Send Request sheet** specifically: use raw RN `Modal` (mirror `ReportProblemSheet.tsx:71-72`) because the form needs scrolling + a sticky footer button that the `Sheet` primitive doesn't expose. The `ReportProblemSheet.tsx` rationale (header lines 11-14) is verbatim applicable.

---

### `_events` envelope passthrough (Phase 5 VERIFY-05)

**Source:** `apps/api/src/plugins/events-outbox.ts` + the schema additions at `apps/api/src/routes/recordings/schemas.ts:27-29` (`_events: z.array(RecordingServerEventSchema).optional()`).

**Apply to:** the NEW `stream-url.ts` 200-shape — since the route is authenticated, the events-outbox onSend hook WILL piggy-back `_events`. The response shape must accept the optional `_events` key. Since Pattern 22 says to OMIT `response.200` schema on this route, no explicit schema change is needed; the hook attaches the key freely.

For the existing `list.ts` (EDIT — extended with `start`/`end`): the schema already includes `_events` (line 29) — unchanged.

---

### TopBar + `useTabTopBarProps` (every tab body)

**Source:** `apps/mobile/src/hooks/useTabTopBarProps.ts` (Pattern 71).

**Apply to:** all three new screens (`HomeScreen` / `TasksScreen` / `HistoryScreen`).

**Pattern:**

```typescript
const topBarProps = useTabTopBarProps();
return (
  <ScreenContainer accessibilityLabel="... screen" padding={0}>
    <TopBar {...topBarProps} />
    {/* ... */}
  </ScreenContainer>
);
```

The `PlayerScreen` (full-bleed, dark) does NOT use TopBar — it owns its own header per design-spec §14 (X-close left, task name center, lock badge right).

---

### `formatDuration(seconds)` reuse

**Source:** `apps/mobile/src/services/durationFormatter.ts` (HOME-06 / PROF-03 — shipped Phase 4).

**Apply to:** Home tile numbers, Home returning-hero lifetime, History row meta-line, Player current/total time. The function is byte-identical across screens — never re-implement (mobile-state mirror service `durationFormatter.ts` lives at this path; some Phase 5 files reference it as `lib/durationFormat.ts` — CONTEXT.md mentions both. Researcher VERIFIED in RESEARCH.md §Standard Stack that the live path is `services/durationFormatter.ts`).

---

### Token discipline (no hex literals in screens/components)

**Source:** `apps/mobile/src/ui/tokens.ts` (the canonical export surface for `colors`, `typography`, `spacing`, `radii`); `apps/mobile/__tests__/ui/no-hex-literals.test.ts` is the enforcement gate.

**Apply to:** all NEW screens + components. UI-SPEC §Color flags new tokens to add (`colors.heroGradStart`, `colors.heroGradEnd`, `colors.thumbFallbackStart`, `colors.thumbFallbackEnd`, `colors.universalRulesBg`) and new typography ramps (`taskCardName`, `taskCardDesc`, `ruleLabel`, `taskBullet`, `rowMeta`, `playerTime`). Add to `tokens.ts` in a single `tokens-extend-phase6` Wave 4 edit; the no-hex-literals test will catch any screen-body hex.

---

### Multipart submit with Idempotency-Key

**Source:** `apps/mobile/src/services/feedbackService.ts:110-180` — multipart FormData + uuid-v4 Idempotency-Key + Hermes-vs-JSDOM Blob shape branch.

**Apply to:** `apps/mobile/src/services/taskRequestService.ts` (NEW — D-10 sample-video upload).

**Pattern (copy verbatim from `feedbackService.ts:110-180`, swap fields):**

```typescript
const form = new FormData();
form.append('name', input.name);
form.append('description', input.description);
form.append('category', input.category);
form.append('setting', input.setting);
if (input.sampleVideoUri) {
  // Hermes branch (RN runtime) — { name, type, uri } shape; the multipart
  // parser on the backend reads the file from the URI.
  // (For Send Request the sample video is a real file URI, not a JSON blob —
  //  follow react-native FormData docs: `{ uri, name, type }`.)
  form.append('sample', {
    uri: input.sampleVideoUri,
    name: 'sample.mp4',
    type: 'video/mp4',
  } as unknown as Blob);
}
await apiClient.postMultipart<{ id: string }>('/task-requests', form, {
  headers: { 'Idempotency-Key': uuid.v4() as string },
});
```

---

### Toast surface for success/error notices

**Source:** `apps/mobile/src/components/Toast.tsx` + `apps/mobile/src/state/uploadToastBus.ts` (the global toast host pattern from Phase 4).

**Apply to:** Send Request success (`"Request sent. We'll review and add it to your list."` — 5 s), error in-sheet banner with retry.

**Pattern:**

```typescript
import { showToast } from '../../components/Toast';
// success path
showToast("Request sent. We'll review and add it to your list.", 5000);
// error path renders an inline banner (NOT a toast) per UI-SPEC §Send Request error state
```

---

## No Analog Found

None. Every Phase 6 file has at least a role-match in-tree analog. The closest things to "no analog":

| File                                                  | Role                 | Best partial                                                       | Reason                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/HomeHero.tsx`             | hero block           | `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx`         | No prior hero with a `displayHero` 46/46 mono numeric on a dark gradient card; the gradient stops (`#1A1A1A` → `#2A2A2A`) need new tokens (UI-SPEC §Color flagged). Pattern is straightforward: `<View style={{backgroundColor: colors.heroGradStart}}>` (or `LinearGradient` if needed — `react-native-linear-gradient` is NOT in the dep list; verify) + `<Text variant="displayHero" style={{color: colors.recTextPrimary}}>`. |
| `apps/mobile/src/components/SearchInput.tsx`          | debounced text input | `apps/mobile/src/screens/profile/InlineEditField.tsx` (TextInput)  | No prior debounced search input. Pattern: `useEffect(() => { const t = setTimeout(() => onDebounce(value), 200); return () => clearTimeout(t); }, [value])`. Straightforward — listed as "partial" only because the 200 ms debounce + focus-ring + clear-X are net-new visual elements.                                                                                                                                           |
| `apps/mobile/__tests__/screens/PlayerScreen.test.tsx` | screen test (player) | `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx` | No prior player-surface test; existing screen tests don't mock a `NativeEventEmitter`-emitting native module like `HumynPlayer`. The RecordingScreen test mocks `HumynCapture` similarly (event emitter + commands) so the mock shape is portable.                                                                                                                                                                                |

---

## Metadata

**Analog search scope:**

- `apps/api/src/routes/**` (all 32 route files)
- `apps/api/src/lib/**` (10 lib files — s3-client, problem-detail, queue, verify-recording, recording-state, embedder, etc.)
- `apps/api/src/plugins/**` (8 plugins — auth, events-outbox, rate-limit, idempotency, error-handler, etc.)
- `apps/api/src/db/migrations/**` (6 migrations)
- `apps/api/src/db/schema.ts`
- `apps/api/test/routes/**` (30+ test files)
- `apps/mobile/src/screens/**` (16 screen dirs)
- `apps/mobile/src/components/**` (10 components)
- `apps/mobile/src/native/**` (12 JS bridges)
- `apps/mobile/src/services/**` (14 services)
- `apps/mobile/src/state/**` (appStore, mmkv, keys, hydrate)
- `apps/mobile/src/ui/primitives/**` (8 primitives)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/**` (10 native packages — capture, beep, upload, gatecamera, handdetector, etc.)
- `apps/mobile/__tests__/screens/**` (20+ test files)
- `design-system/task-icons/**`
- `shared/types/src/**`

**Files scanned:** ~180 source files + ~50 test files.

**Pattern extraction date:** 2026-05-14
