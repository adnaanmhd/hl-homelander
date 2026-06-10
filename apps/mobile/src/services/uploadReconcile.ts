// uploadReconcile — the app-launch / foreground reconciliation sweep (Plan
// 05-08; 05-RESEARCH Pattern 4 + Pitfall 3). On cold start AND on each
// AppState→`active` rehydrate it (1) drains stale queue rows and (2) runs the
// terminal-success backstop.
//
// Enh 3 / D1 (2026-06-04): the hash-verify flow was removed. `uploaded` is the
// terminal success state; the coordinator deletes the local bundle + drops the
// queue row on /finalize 200. This sweep is now the convergent BACKSTOP for a
// /finalize 200 that was applied server-side but never reached the device
// (dropped response / kill between): `GET /recordings` (first page) → for every
// recording the server reports at terminal success ('uploaded', or a legacy
// 'verified') that STILL has a local queue row → `HumynUpload.clearUploaded([id])`
// (unlinks the local mp4/csv/json + drops the row). (Replaces the removed
// GET /recordings/verified-ids + `_events`/cursor machinery.)
//
// Safety:
//   - The sweep only `clearUploaded`s ids that BOTH appear in the server's
//     terminal-success set AND match a row in the local queue (the intersection)
//     — a bogus id the app doesn't have is a no-op (T-5-08-06).
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
import { HumynUpload, type UploadQueueRow } from '../native/HumynUpload';
import { decodeGoogleSubFromJwt } from '../lib/jwtSub';
import { useAppStore } from '../state/appStore';
import { AUTH_FAILURE_REASON_PREFIX } from './uploadQueueStore';

/**
 * Phase 1 item 7 (2026-06-10) — true for a row the native coordinator parked
 * after an auth-classified 401 (`lastFailureReason` carries the `auth: <slug>`
 * marker). The foreground reconcile must NOT auto-revive/drain these: the
 * token is dead, so kicking the drainer just re-fires the 401 (ping-pong).
 * Recovery comes from the jwt-change subscription below (fresh token →
 * context push + resume) or the `onUploadAuthFailure` listener's silent
 * re-auth — both clear the pause; a successful drain clears the marker.
 */
function isAuthBlocked(r: UploadQueueRow): boolean {
  return r.lastFailureReason?.startsWith(AUTH_FAILURE_REASON_PREFIX) ?? false;
}

// Enh 3 / D1 (2026-06-04): the reconcile backstop now reads GET /recordings (the
// canonical list) instead of the removed GET /recordings/verified-ids. A row the
// server reports at terminal-success ('uploaded', or a legacy 'verified') that
// still has a local queue row gets its local bundle cleared.
interface RecordingsListItemLite {
  recording_id: string;
  qa_status: 'pending' | 'uploaded' | 'verified' | 'hash-mismatch' | 'rejected';
}
interface RecordingsListResponseLite {
  items: RecordingsListItemLite[];
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
    // Phase 1 item 7 (2026-06-10) — skip auth-blocked rows (the `auth: <slug>`
    // marker): reviving/draining them with the same dead token just re-fires
    // the 401. They recover via the jwt-change resume path below.
    const deadLetters = queue.filter((r) => r.state === 'dead-letter' && !isAuthBlocked(r));
    for (const r of deadLetters) {
      await HumynUpload.reviveDeadLetterSafe(r.recordingId);
    }
    const hasStale =
      deadLetters.length > 0 ||
      queue.some((r) => (r.state === 'pending' || r.state === 'uploading') && !isAuthBlocked(r));
    if (hasStale) {
      await HumynUpload.drainNowSafe();
    }
  } catch {
    /* boot-safe — never crash the reconcile sweep over a queue read */
  }
  try {
    // Backstop (Enh 3 / D1 §9): the coordinator deletes the local bundle on
    // /finalize 200, but if that 200 was applied server-side yet never reached
    // the device (dropped response / kill between), the local row + files can
    // linger. Read the server's recordings and clear any local row the server
    // already reports at terminal success ('uploaded', or a legacy 'verified').
    // First page only (limit 100) — best-effort, no pagination storm. (Replaces
    // the removed GET /recordings/verified-ids sweep.)
    const resp = await apiClient.get<RecordingsListResponseLite>('/recordings', {
      query: { limit: '100' },
    });
    if (resp == null || !Array.isArray(resp.items)) return 0;
    const terminalSuccessIds = resp.items
      .filter((it) => it.qa_status === 'uploaded' || it.qa_status === 'verified')
      .map((it) => it.recording_id)
      .filter((id): id is string => typeof id === 'string');
    // Only act on ids the app actually has queued locally (the intersection).
    let queue: { recordingId: string }[] = [];
    try {
      queue = await HumynUpload.getQueueSafe();
    } catch {
      queue = [];
    }
    const queuedIds = new Set(queue.map((r) => r.recordingId));
    const stale = terminalSuccessIds.filter((id) => queuedIds.has(id));
    if (stale.length > 0) {
      try {
        await HumynUpload.clearUploaded(stale);
      } catch {
        /* no native module / transient — the next sweep retries */
      }
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
