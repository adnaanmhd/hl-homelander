// Minimal HTTP client used by the Phase 1 sign-in flow. Reads the API base URL
// from react-native-config (apps/mobile/.env.{flavor} → API_BASE_URL). Phase 1
// shipped POST {body} + POST {no body}; Phase 2 plan 02-08 added GET via
// `getJson<T>(path, { query?, timeoutMs? })` for the /app/version splash check;
// plan 02-17 adds PATCH (for /me) and a `get` alias so call sites that prefer
// the bare verb-name don't have to remember `getJson`.
//
// `getJson` / `get` wraps fetch with:
//   - URL-encoded `query` object → `?k1=v1&k2=v2`
//   - AbortController-based timeout (default 30 s; splash uses 5 s)
//   - non-2xx → throws with RFC 7807 problem-detail body when the response
//     was JSON, or the raw text otherwise. The thrown Error's `.message`
//     mirrors Phase 1's `POST {path} failed: {status} {text}` shape.
//
// `patch` mirrors `post` (JSON body, content-type: application/json) plus
// header forwarding so callers can pass an Idempotency-Key per request
// (Phase 1 API-15 — backend de-duplicates retries by this header).
//
// `postMultipart` is the multipart-form-data sibling of `post`. Phase 2
// plan 02-18 (HELP-05 Report-a-problem) sends a FormData with `category`,
// `message`, and a JSON-blob `diagnostic` part to POST /feedback. The
// crucial difference vs. `post`: do NOT set content-type yourself — let
// fetch generate the boundary header from the FormData instance, otherwise
// the multipart parser on the backend can't locate part separators. Header
// forwarding stays so callers can attach an Idempotency-Key per request.

import Config from 'react-native-config';
import crashlytics from '@react-native-firebase/crashlytics';
import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { processRecordingEvents } from './recordingEvents';
import { toastKeyForCode } from '../i18n/errorMap';
import i18n from '../i18n';
import { showToast } from '../components/Toast';

const BASE_URL = (): string => {
  const u = Config.API_BASE_URL;
  if (!u) {
    throw new Error('API_BASE_URL not configured in apps/mobile/.env.{flavor}');
  }
  return u;
};

/**
 * Returns `{ authorization: 'Bearer <jwt>' }` if a JWT is present in MMKV,
 * else `{}`. Spread into every request's headers so authenticated endpoints
 * see a valid Bearer; pre-sign-in calls (no JWT) emit no Authorization
 * header. Reads MMKV directly (NOT via services/auth.ts) to avoid a
 * circular dependency — auth.ts already imports apiClient.post for the
 * /auth/google bootstrap call.
 */
function bearerHeader(): Record<string, string> {
  const jwt = secureMmkv.getString(KEYS.AUTH_JWT);
  return jwt ? { authorization: `Bearer ${jwt}` } : {};
}

export interface GetJsonOptions {
  query?: Record<string, string>;
  timeoutMs?: number;
  /** Extra request headers (e.g. `Accept-Timezone`). Lower-cased on the wire. */
  headers?: Record<string, string>;
}

export interface PatchOptions {
  /** Extra request headers (e.g. `Idempotency-Key`). */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface PostMultipartOptions {
  /** Extra request headers (e.g. `Idempotency-Key`). Lower-cased on the wire. */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface DeleteOptions {
  /** Query params merged into the URL (`?k=v&...`). */
  query?: Record<string, string>;
  /** Extra request headers (e.g. `Idempotency-Key`). Lower-cased on the wire. */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ApiClient {
  post<T>(path: string, body: object, opts?: { idempotencyKey?: string }): Promise<T>;
  postNoBody<T>(path: string): Promise<T>;
  getJson<T>(path: string, opts?: GetJsonOptions): Promise<T>;
  /** Alias of `getJson` — preferred for call sites that read more naturally as `apiClient.get(...)`. */
  get<T>(path: string, opts?: GetJsonOptions): Promise<T>;
  patch<T>(path: string, body: object, opts?: PatchOptions): Promise<T>;
  /**
   * POST a multipart/form-data body. Caller assembles the FormData (text fields
   * + Blob/file parts); this wrapper does NOT set content-type — fetch derives
   * `multipart/form-data; boundary=...` from the FormData instance so the
   * backend's multipart parser can locate part separators.
   *
   * Phase 1 plan 01-08 idempotency falls back to (method, path, undefined-body)
   * for multipart, but the Idempotency-Key header is still required so retries
   * de-dup against the same key. T = response shape; void if the backend returns
   * 201 with an empty body (HELP-05 today returns `{ id, diagnosticS3Key }`).
   */
  postMultipart<T>(path: string, body: FormData, opts?: PostMultipartOptions): Promise<T>;
  /**
   * DELETE {path}[?query] with optional Idempotency-Key. Phase 2 plan 02-19
   * uses this for `DELETE /me?confirm=DELETE` (AUTH-09 soft-delete). Returns
   * the parsed JSON body when present, or `undefined` for empty 200/204
   * responses (DELETE /me returns 200 with empty body per Phase 1
   * MeDeleteResponseSchema).
   */
  delete<T>(path: string, opts?: DeleteOptions): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function buildUrl(path: string, query?: Record<string, string>): string {
  const base = `${BASE_URL()}${path}`;
  if (!query) return base;
  const entries = Object.entries(query);
  if (entries.length === 0) return base;
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${base}?${qs}`;
}

/**
 * Plan 05-08 — the `_events`-envelope interceptor. Every authenticated JSON
 * object response MAY carry `_events: [{ recording_id, event_type }]` (drained
 * server-side by the events-outbox onSend hook, Plan 05-05). Hand it to
 * `processRecordingEvents` (which is idempotent + payload-shape-validated +
 * swallows its own errors). The `_events` key is left on the body — it's an
 * optional key in the Pattern-22 carrier schemas, so callers that don't read it
 * are unaffected. Wrapped in try/catch so a bad envelope can never break a
 * successful HTTP call.
 */
/**
 * Plan 07-05 Task 2 — API error → translated toast pipeline (I18N-08 / D-34 /
 * D-35). Call this from any catch-block where the server returned an
 * RFC 7807 problem detail (or a similar `{ code, detail }` payload). Two
 * side effects:
 *
 *  1. **Translated toast** — the server `code` is mapped to an i18n key via
 *     `toastKeyForCode(code)` and resolved through `i18n.t(...)` so the user
 *     sees a localized message in their active locale. Unknown / null /
 *     undefined codes resolve to `errors.generic`.
 *  2. **Crashlytics breadcrumb** — a structured `{ event: 'api_error', code,
 *     raw_detail }` entry is logged for triage. The English `detail` field
 *     NEVER reaches the user; it only goes to Crashlytics (D-35). The call
 *     is best-effort (try/catch — never throws) so a missing native module
 *     can't break the error-surface flow.
 *
 * Use at any error-surface point where the client currently passes raw
 * English server text into a toast. Phase 1..6 sites that throw bare
 * `Error(...)` strings (the `getJson` / `post` paths above) can be migrated
 * incrementally — the helper itself is pure-additive and accepts the loose
 * `{ code?, detail? }` shape the RFC 7807 envelope provides.
 */
export function surfaceApiError(error: { code?: string | null; detail?: string | null }): void {
  const code = typeof error?.code === 'string' ? error.code : null;
  const key = toastKeyForCode(code);
  showToast(i18n.t(key as never));
  try {
    crashlytics().log(
      JSON.stringify({
        event: 'api_error',
        code: code ?? 'UNKNOWN',
        raw_detail: typeof error?.detail === 'string' ? error.detail : null,
      }),
    );
  } catch {
    /* best-effort — never let the breadcrumb fail the error-surface flow */
  }
}

function interceptEvents<T>(body: T): T {
  try {
    if (body != null && typeof body === 'object') {
      const ev = (body as { _events?: unknown })._events;
      if (Array.isArray(ev)) processRecordingEvents(ev);
    }
  } catch {
    /* never let the events side-channel break the response */
  }
  return body;
}

export const apiClient: ApiClient = {
  async post<T>(path: string, body: object, opts?: { idempotencyKey?: string }): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...bearerHeader(),
    };
    if (opts?.idempotencyKey) {
      headers['idempotency-key'] = opts.idempotencyKey;
    }
    const res = await fetch(`${BASE_URL()}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    return interceptEvents((await res.json()) as T);
  },
  async postNoBody<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...bearerHeader(),
    };
    const res = await fetch(`${BASE_URL()}${path}`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    return interceptEvents((await res.json()) as T);
  },
  async getJson<T>(path: string, opts?: GetJsonOptions): Promise<T> {
    const url = buildUrl(path, opts?.query);
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        ...bearerHeader(),
      };
      // Forward caller-supplied headers (lower-cased on the wire to match
      // the patch/postMultipart/delete convention) — e.g. Phase 6 plans
      // attach `Accept-Timezone: <IANA>` so the server can interpret the
      // YYYY-MM-DD start/end query params against the device's local tz
      // (Plan 06-03 D-03b).
      if (opts?.headers) {
        for (const [k, v] of Object.entries(opts.headers)) {
          headers[k.toLowerCase()] = v;
        }
      }
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        // Try to parse the RFC 7807 body; fall back to raw text. Either
        // shape is folded into the thrown Error's message so callers get
        // a uniform string failure mode.
        let body: string;
        try {
          const parsed = (await res.json()) as Record<string, unknown>;
          body = JSON.stringify(parsed);
        } catch {
          body = await res.text();
        }
        throw new Error(`GET ${path} failed: ${res.status} ${body}`);
      }
      return interceptEvents((await res.json()) as T);
    } finally {
      clearTimeout(timer);
    }
  },
  async get<T>(path: string, opts?: GetJsonOptions): Promise<T> {
    return this.getJson<T>(path, opts);
  },
  async patch<T>(path: string, body: object, opts?: PatchOptions): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...bearerHeader(),
    };
    if (opts?.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        // Lowercase the header name on the wire — Phase 1 backend reads
        // `idempotency-key` case-insensitively but several Fastify plugins
        // expect lowercase. Matches the existing post()'s convention.
        headers[k.toLowerCase()] = v;
      }
    }
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE_URL()}${path}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        let bodyText: string;
        try {
          const parsed = (await res.json()) as Record<string, unknown>;
          bodyText = JSON.stringify(parsed);
        } catch {
          bodyText = await res.text();
        }
        throw new Error(`PATCH ${path} failed: ${res.status} ${bodyText}`);
      }
      return interceptEvents((await res.json()) as T);
    } finally {
      clearTimeout(timer);
    }
  },
  async delete<T>(path: string, opts?: DeleteOptions): Promise<T> {
    // Mirror patch/post header forwarding semantics — lower-case names on the
    // wire so Fastify plugins (e.g. @fastify/idempotency) read them
    // case-uniformly. NO content-type set: DELETE has no body.
    const headers: Record<string, string> = { ...bearerHeader() };
    if (opts?.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        headers[k.toLowerCase()] = v;
      }
    }
    const url = buildUrl(path, opts?.query);
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        let bodyText: string;
        try {
          const parsed = (await res.json()) as Record<string, unknown>;
          bodyText = JSON.stringify(parsed);
        } catch {
          bodyText = await res.text();
        }
        throw new Error(`DELETE ${path} failed: ${res.status} ${bodyText}`);
      }
      // 200 with empty body (DELETE /me) → undefined. Otherwise try-parse.
      const text = await res.text();
      if (!text) return undefined as T;
      try {
        return interceptEvents(JSON.parse(text) as T);
      } catch {
        return undefined as T;
      }
    } finally {
      clearTimeout(timer);
    }
  },
  async postMultipart<T>(path: string, body: FormData, opts?: PostMultipartOptions): Promise<T> {
    // Critical: do NOT set content-type. fetch derives the boundary from the
    // FormData instance (`multipart/form-data; boundary=----...`); a manual
    // header would strip the boundary parameter and the backend's
    // @fastify/multipart parser would reject the body as unparseable.
    // The Authorization Bearer header is safe to attach — it does not affect
    // the multipart body framing.
    const headers: Record<string, string> = { ...bearerHeader() };
    if (opts?.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        headers[k.toLowerCase()] = v;
      }
    }
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE_URL()}${path}`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        let bodyText: string;
        try {
          const parsed = (await res.json()) as Record<string, unknown>;
          bodyText = JSON.stringify(parsed);
        } catch {
          bodyText = await res.text();
        }
        throw new Error(`POST ${path} failed: ${res.status} ${bodyText}`);
      }
      // POST /feedback returns JSON ({ id, diagnosticS3Key }); other
      // multipart endpoints may return empty 201s. Try parse-as-JSON; if the
      // body is empty, surface undefined as T (callers that don't care about
      // the response can bind to Promise<void>).
      const text = await res.text();
      if (!text) return undefined as T;
      try {
        return interceptEvents(JSON.parse(text) as T);
      } catch {
        return undefined as T;
      }
    } finally {
      clearTimeout(timer);
    }
  },
};
