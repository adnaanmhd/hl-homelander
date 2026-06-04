// apiClient bearer-header attachment — quick task 260510-003.
//
// Coverage:
//   - GET attaches Authorization: Bearer <jwt> when MMKV has a JWT
//   - GET sends NO Authorization when MMKV has no JWT (pre-sign-in calls)
//   - PATCH attaches BOTH content-type and authorization
//   - postMultipart attaches authorization but does NOT set content-type
//     (boundary preservation — multipart parser depends on fetch deriving
//     the boundary from the FormData instance)
//
// Pattern: rely on the canonical react-native-mmkv + react-native-config
// mocks from vitest.setup.ts. Use the `Config` named export so we can set
// API_BASE_URL deterministically. Spy on global fetch to capture init.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Config } from 'react-native-config';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';
import { apiClient } from '../../src/services/api';

const TEST_JWT = 'eyJhbGciOiJIUzI1NiJ9.fake.signature';

beforeEach(() => {
  Config.API_BASE_URL = 'http://test.example';
  secureMmkv.remove(KEYS.AUTH_JWT);
  vi.restoreAllMocks();
});

function mockFetchOk<T>(body: T): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }) as unknown as Response,
  );
}

function fetchInitOf(spy: ReturnType<typeof vi.spyOn>, callIndex = 0): RequestInit {
  const args = (spy.mock.calls[callIndex] ?? []) as [string, RequestInit?];
  return args[1] ?? {};
}

function headersToObject(init: RequestInit): Record<string, string> {
  const h = init.headers ?? {};
  if (h instanceof Headers) {
    const out: Record<string, string> = {};
    h.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  if (Array.isArray(h)) {
    return Object.fromEntries(h.map(([k, v]) => [k.toLowerCase(), v as string]));
  }
  return Object.fromEntries(
    Object.entries(h as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
  );
}

describe('apiClient — Authorization Bearer attachment', () => {
  it('Test 1: GET /me with JWT in MMKV → fetch sees authorization: Bearer <jwt>', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, TEST_JWT);
    const spy = mockFetchOk({ ok: true });

    await apiClient.get('/me');

    const headers = headersToObject(fetchInitOf(spy));
    expect(headers.authorization).toBe(`Bearer ${TEST_JWT}`);
    expect(headers.accept).toBe('application/json');
  });

  it('Test 2: GET /app/version with NO JWT in MMKV → fetch sees no authorization header', async () => {
    // Pre-sign-in path: MMKV is empty after the beforeEach reset.
    const spy = mockFetchOk({ flavor: 'apkRollout', minVersionCode: 1 });

    await apiClient.get('/app/version');

    const headers = headersToObject(fetchInitOf(spy));
    expect(headers.authorization).toBeUndefined();
  });

  it('Test 3: PATCH /me forwards both authorization and content-type', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, TEST_JWT);
    const spy = mockFetchOk({ id: 'u1' });

    await apiClient.patch(
      '/me',
      { displayName: 'Adnaan' },
      { headers: { 'idempotency-key': 'k1' } },
    );

    const init = fetchInitOf(spy);
    const headers = headersToObject(init);
    expect(headers.authorization).toBe(`Bearer ${TEST_JWT}`);
    expect(headers['content-type']).toBe('application/json');
    expect(headers['idempotency-key']).toBe('k1');
    expect(init.method).toBe('PATCH');
  });

  it('Test 4: postMultipart attaches authorization but does NOT set content-type', async () => {
    // Boundary preservation: the multipart parser on the backend relies on
    // fetch deriving `multipart/form-data; boundary=----...` from the
    // FormData instance. Manually setting content-type would strip the
    // boundary parameter (Pattern from plan 02-18).
    secureMmkv.set(KEYS.AUTH_JWT, TEST_JWT);
    const spy = mockFetchOk({ id: 'fb1' });

    const form = new FormData();
    form.append('category', 'bug');
    form.append('message', 'test');
    await apiClient.postMultipart('/feedback', form, { headers: { 'idempotency-key': 'k2' } });

    const headers = headersToObject(fetchInitOf(spy));
    expect(headers.authorization).toBe(`Bearer ${TEST_JWT}`);
    expect(headers['content-type']).toBeUndefined();
    expect(headers['idempotency-key']).toBe('k2');
  });

  it('Test 5: DELETE /me with JWT in MMKV → authorization + text/plain content-type attached', async () => {
    // Bug 1 (260604): DELETE must pin an explicit content-type Fastify can parse.
    // Without it, RN/OkHttp attaches a default content-type Fastify has no parser
    // for → 415 before the handler runs. text/plain (not application/json — an
    // empty JSON body 400s) lets the built-in parser accept the bodiless request.
    secureMmkv.set(KEYS.AUTH_JWT, TEST_JWT);
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }) as unknown as Response);

    await apiClient.delete('/me', { query: { confirm: 'DELETE' } });

    const init = fetchInitOf(spy);
    const headers = headersToObject(init);
    expect(headers.authorization).toBe(`Bearer ${TEST_JWT}`);
    expect(headers['content-type']).toBe('text/plain');
    expect(init.method).toBe('DELETE');
  });
});
