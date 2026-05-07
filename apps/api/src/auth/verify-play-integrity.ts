import { google } from 'googleapis';
import type { TokenPayloadExternal } from './integrity-policy.js';

let _client: ReturnType<typeof google.playintegrity> | undefined;

function getClient() {
  if (_client) return _client;
  // Per RESEARCH §2.7 — secret stored in env as JSON inline.
  const saJson = process.env.PLAY_INTEGRITY_SA_KEY_JSON;
  if (!saJson) throw new Error('PLAY_INTEGRITY_SA_KEY_JSON not set');
  let credentials;
  try {
    credentials = JSON.parse(saJson);
  } catch {
    throw new Error('PLAY_INTEGRITY_SA_KEY_JSON is not valid JSON');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/playintegrity'],
  });
  _client = google.playintegrity({ version: 'v1', auth });
  return _client;
}

export async function decodeIntegrityToken(opts: {
  packageName: string; // applicationId — 'ai.humynlabs.capture' or 'ai.humynlabs.capture.apk'
  integrityToken: string;
}): Promise<TokenPayloadExternal> {
  const res = await getClient().v1.decodeIntegrityToken({
    packageName: opts.packageName,
    requestBody: { integrityToken: opts.integrityToken },
  });
  if (!res.data?.tokenPayloadExternal) throw new Error('decode_returned_no_payload');
  return res.data.tokenPayloadExternal as unknown as TokenPayloadExternal;
}
