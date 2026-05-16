// uploadReconcile — the app-launch / foreground reconciliation sweep (Plan
// 05-08; VERIFY-06; 05-RESEARCH Pattern 4 + Pitfall 3). The convergent backstop
// for a `verified` `_events` envelope that never arrived (the response that
// would have carried it failed / the app was killed between the verify and the
// next authed call): on cold start AND on each AppState→`active` rehydrate,
// `GET /recordings/verified-ids?since=<cursor>` → for every verified id that
// STILL has a local queue row → `HumynUpload.clearVerified([id])` (unlinks the
// local mp4/csv/json + drops the row — UP-15) + mark the `${id}:verified` key
// processed (so a later redelivered `_events` is a no-op) → store `next_cursor`
// in the shared MMKV (D-STATE-01 — no new instance).
//
// Safety:
//   - The sweep only `clearVerified`s ids that BOTH appear in the server's
//     `verified` set AND match a row in the local queue (the intersection) —
//     a bogus id the app doesn't have is a no-op (T-5-08-06).
//   - The local path is recomputed natively from the recording's known
//     location — never from the server payload (T-5-08-02).
//   - Everything is try/catch-wrapped and swallows (next launch retries — like
//     `bootRecoveryListener.ts`'s `.catch(() => undefined)`). A build without
//     `HumynUpload` (iOS / JSDOM) never crashes boot.
//   - It runs on cold start + AppState→`active` ONLY (not on a timer), is
//     cursor-paginated, and never retry-storms (T-5-08-05).
//
// Mirrors `hooks/useForegroundUserRehydrate.ts` (the mount + AppState→`active`
// re-fire shape) + `boot/bootRecoveryListener.ts` (the one-shot boot install +
// the try/catch-around-native-calls / `.catch(() => undefined)` template). The
// boot install lives in `App.tsx` next to `installBootRecoveryListener()`.

import { AppState, type AppStateStatus } from 'react-native';
import Config from 'react-native-config';
import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { apiClient } from './api';
import { HumynUpload } from '../native/HumynUpload';
import { markEventProcessed } from './recordingEvents';
import { decodeGoogleSubFromJwt } from '../lib/jwtSub';
import { useAppStore } from '../state/appStore';

interface VerifiedIdsResponse {
  ids: string[];
  next_cursor: string | null;
}

/**
 * Push the upload coordinator's auth context (API base URL + bearer JWT + sub)
 * from the JS-side single source (`react-native-config` + the `AUTH_JWT` MMKV
 * key) — Kotlin can't conveniently read the encrypted MMKV (Plan 05-06). Called
 * on boot, on every AppState→`active` (a JWT refresh is picked up), and on every
 * `appStore.jwt` change (post-sign-in). Best-effort + boot-safe (no native
 * module / JSDOM → no-op). Also `resume()`s after a same-user re-login (the
 * coordinator's process-lived paused flag may be set from a prior logout — the
 * native `bootstrap(currentSub)` then only resumes own-rows).
 */
async function pushUploadContext(opts?: { resume?: boolean }): Promise<void> {
  const baseUrl = Config.API_BASE_URL;
  if (!baseUrl) return; // no API base URL configured (a test/JSDOM env) — nothing to push
  const jwt = secureMmkv.getString(KEYS.AUTH_JWT) ?? null;
  const sub = decodeGoogleSubFromJwt(jwt);
  await HumynUpload.setUploadContextSafe(baseUrl, jwt, sub);
  if (opts?.resume && jwt) {
    try {
      await HumynUpload.resume();
    } catch {
      /* no native module / transient — non-fatal */
    }
  }
}

/**
 * Run the reconciliation sweep once. Swallows all errors (next launch / the
 * next AppState→`active` retries). Returns the number of stale local triples
 * cleared — handy for tests.
 */
export async function reconcileOnce(): Promise<number> {
  // Refresh the coordinator's auth context before the authed GET (a JWT refresh
  // since the last sweep is picked up here).
  await pushUploadContext();
  // Wave-1.5 Item 8 — cold-start drain on stale queue. installApk re-launch
  // after a force-quit leaves a row in {pending, uploading} on disk; nothing
  // else kicks the drainer (enqueue / JWT change / RecordingScreen.resume /
  // Pending-Uploads Retry are all user-driven), so the row sits forever.
  // Kick the drainer if there's stale work. Order matters: pushUploadContext
  // first (the coordinator needs getCurrentSub() to drain); drainNowSafe after.
  // Wrapped in try/catch + boot-safe via drainNowSafe — never crashes boot.
  try {
    const queue = await HumynUpload.getQueueSafe();
    // Dead-letter auto-revive (the "missing recovery step" for client-side
    // dead-letters). A row hits DEAD_LETTER after 6 part-PUT retries
    // (~127 s wall-clock) on a transient like "Socket closed". `drainNow()`
    // deliberately SKIPS dead-letter rows (UploadCoordinator.kt:206-213), so
    // without an explicit revive a single flaky window during a long session
    // can strand many rows permanently — requiring per-row taps on
    // PendingUploadsScreen. Revive them here on every cold start / AppState→
    // active before the drain kick. We use `reviveDeadLetterSafe` (NOT
    // `reupload`) — the latter has a FULL-RESET footgun when `row.reupload`
    // was already set, see `.planning/debug/resolved/uploads-stuck-multi-segment.md`.
    const deadLetters = queue.filter((r) => r.state === 'dead-letter');
    for (const r of deadLetters) {
      await HumynUpload.reviveDeadLetterSafe(r.recordingId);
    }
    const hasStale =
      deadLetters.length > 0 || queue.some((r) => r.state === 'pending' || r.state === 'uploading');
    if (hasStale) {
      await HumynUpload.drainNowSafe();
    }
  } catch {
    /* boot-safe — never crash the reconcile sweep over a queue read */
  }
  try {
    const since = secureMmkv.getString(KEYS.UPLOAD_RECONCILE_CURSOR);
    const resp = await apiClient.get<VerifiedIdsResponse>('/recordings/verified-ids', {
      ...(since ? { query: { since } } : {}),
    });
    if (resp == null || !Array.isArray(resp.ids)) return 0;
    const verifiedIds = resp.ids.filter((v): v is string => typeof v === 'string');
    // Only act on ids the app actually has queued locally (the intersection).
    let queue: { recordingId: string }[] = [];
    try {
      queue = await HumynUpload.getQueueSafe();
    } catch {
      queue = [];
    }
    const queuedIds = new Set(queue.map((r) => r.recordingId));
    const stale = verifiedIds.filter((id) => queuedIds.has(id));
    if (stale.length > 0) {
      try {
        await HumynUpload.clearVerified(stale);
      } catch {
        /* no native module / transient — the next sweep retries; don't advance cursor below */
      }
      for (const id of stale) {
        try {
          markEventProcessed(id, 'verified');
        } catch {
          /* MMKV write hiccup — non-fatal */
        }
      }
    }
    if (resp.next_cursor != null && typeof resp.next_cursor === 'string') {
      secureMmkv.set(KEYS.UPLOAD_RECONCILE_CURSOR, resp.next_cursor);
    }
    return stale.length;
  } catch {
    // Network down / server hiccup / a build without the API base URL — swallow.
    return 0;
  }
}

/**
 * Install the reconciliation sweep. Call once at app boot (App.tsx, next to
 * `installBootRecoveryListener()` — wrap the call in try/catch there so a build
 * without `HumynUpload` / JSDOM never crashes boot). Runs `reconcileOnce()`
 * immediately + on every AppState change to `'active'`. Returns a teardown that
 * removes the AppState listener.
 */
export function installUploadReconcile(): () => void {
  void reconcileOnce();
  const appStateSub = AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') void reconcileOnce();
  });
  // React to every appStore.jwt change (UP-13):
  //   - jwt → null (logout): HumynUpload.pause() — abort in-flight PUTs but
  //     PRESERVE the queue + local files (do NOT clear). (The RecordingScreen
  //     case is also covered by useRecordingLifecycle's onStop('logout') →
  //     handleStop → HumynUpload.pause(); this is the not-recording / logged-out-
  //     elsewhere path.)
  //   - jwt → <value> (sign-in / same-user re-login): re-push the auth context
  //     + resume() — the native bootstrap(currentSub) only resumes own-rows.
  let lastJwt: string | null = useAppStore.getState().jwt;
  const storeUnsub = useAppStore.subscribe((state) => {
    if (state.jwt !== lastJwt) {
      lastJwt = state.jwt;
      if (state.jwt) {
        void pushUploadContext({ resume: true });
      } else {
        try {
          void HumynUpload.pause().catch(() => undefined);
        } catch {
          /* no native module — non-fatal */
        }
      }
    }
  });
  return () => {
    appStateSub.remove();
    storeUnsub();
  };
}

export default installUploadReconcile;
