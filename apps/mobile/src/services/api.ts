// Minimal HTTP client used by the Phase 1 sign-in flow. Reads the API base URL
// from react-native-config (apps/mobile/.env.{flavor} → API_BASE_URL). The
// Phase 1 surface only needs POST {body} + POST {no body} variants; the full
// Tasks/Recordings/etc. surface lands in Phase 2+.

import Config from 'react-native-config';

const BASE_URL = (): string => {
  const u = Config.API_BASE_URL;
  if (!u) {
    throw new Error('API_BASE_URL not configured in apps/mobile/.env.{flavor}');
  }
  return u;
};

export interface ApiClient {
  post<T>(path: string, body: object, opts?: { idempotencyKey?: string }): Promise<T>;
  postNoBody<T>(path: string): Promise<T>;
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
};
