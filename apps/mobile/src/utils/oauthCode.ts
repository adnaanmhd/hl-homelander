// Extracts the OAuth `code` from a redirect URL. Google codes contain `/`
// which round-trips through `%2F` → `%252F` via the backend relay, so up to
// 3 decoding passes are needed to reach the raw value.
export function extractOAuthCodeFromUrl(url: string): string | null {
  if (!url) return null;

  const match = url.match(/[?&]code=([^&#]+)/);
  if (!match) return null;

  let code = match[1] ?? '';
  for (let i = 0; i < 3; i++) {
    if (!code.includes('%')) break;
    try {
      const next = decodeURIComponent(code);
      if (next === code) break;
      code = next;
    } catch {
      break;
    }
  }
  return code || null;
}
