import { OAuth2Client } from 'google-auth-library';

const WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
let _client: OAuth2Client | undefined;

function getClient(): OAuth2Client {
  if (!_client) {
    if (!WEB_CLIENT_ID) throw new Error('GOOGLE_WEB_CLIENT_ID not set');
    _client = new OAuth2Client(WEB_CLIENT_ID);
  }
  return _client;
}

export interface GoogleIdTokenPayload {
  sub: string; // stable Google account ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  if (!WEB_CLIENT_ID) throw new Error('GOOGLE_WEB_CLIENT_ID not set');
  const ticket = await getClient().verifyIdToken({ idToken, audience: WEB_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) throw new Error('id_token_no_payload');
  if (payload.email_verified !== true) throw new Error('id_token_email_unverified');
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: true,
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.picture !== undefined ? { picture: payload.picture } : {}),
  };
}
