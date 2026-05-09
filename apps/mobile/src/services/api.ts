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

const BASE_URL = (): string => {
  const u = Config.API_BASE_URL;
  if (!u) {
    throw new Error('API_BASE_URL not configured in apps/mobile/.env.{flavor}');
  }
  return u;
};

export interface GetJsonOptions {
  query?: Record<string, string>;
  timeoutMs?: number;
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

export const apiClient: ApiClient = {
  async post<T>(path: string, body: object, opts?: { idempotencyKey?: string }): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
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
    return (await res.json()) as T;
  },
  async postNoBody<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL()}${path}`, { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  },
  async getJson<T>(path: string, opts?: GetJsonOptions): Promise<T> {
    const url = buildUrl(path, opts?.query);
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
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
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  },
  async get<T>(path: string, opts?: GetJsonOptions): Promise<T> {
    return this.getJson<T>(path, opts);
  },
  async patch<T>(path: string, body: object, opts?: PatchOptions): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
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
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  },
  async postMultipart<T>(path: string, body: FormData, opts?: PostMultipartOptions): Promise<T> {
    // Critical: do NOT set content-type. fetch derives the boundary from the
    // FormData instance (`multipart/form-data; boundary=----...`); a manual
    // header would strip the boundary parameter and the backend's
    // @fastify/multipart parser would reject the body as unparseable.
    const headers: Record<string, string> = {};
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
        return JSON.parse(text) as T;
      } catch {
        return undefined as T;
      }
    } finally {
      clearTimeout(timer);
    }
  },
};
