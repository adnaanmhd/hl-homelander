// Quest Google OAuth helpers.
// Step 1: getSocialAuthUrl() → GET endpoint that returns the Google redirect URL.
// Step 2: loginWithGoogle(code) → POST oauth/authenticate?source=app
//         Body: { provider, platform, code, redirectUri } (matches community-app pattern).
//         Response is wrapped: { data: { data: { accessToken, refreshToken, ... } } }
//
// QUEST_HOST value must be confirmed with the kgen backend team.
import { Platform } from 'react-native';
import Config from 'react-native-config';
import { isAxiosError } from 'axios';
import questClient from './questClient';

export interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  isNewUser: boolean;
  isPrimaryConnected: boolean;
}

export function getSocialAuthUrl(): string {
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  const host = Config.QUEST_HOST ?? 'INDIGG';
  const redirectUri = Config.QUEST_REDIRECT_URI_ENCODED ?? '';
  return `social-auth?provider=GOOGLE&host=${host}&platform=${platform}&redirectUri=${redirectUri}`;
}

export async function fetchGoogleRedirectUrl(): Promise<string> {
  const endpoint = getSocialAuthUrl();
  console.log('[googleAuth] fetchGoogleRedirectUrl → GET', endpoint);
  try {
    const { data } = await questClient.get<{ data: { redirectUrl: string } }>(endpoint);
    console.log('[googleAuth] fetchGoogleRedirectUrl ← OK', data);
    return data.data.redirectUrl;
  } catch (err) {
    if (isAxiosError(err)) {
      console.error(
        '[googleAuth] fetchGoogleRedirectUrl ← ERROR',
        err.response?.status,
        err.response?.data ?? err.message,
      );
    } else {
      console.error('[googleAuth] fetchGoogleRedirectUrl ← ERROR', err);
    }
    throw err;
  }
}

export async function loginWithGoogle(code: string): Promise<GoogleAuthResponse> {
  // source is always 'app' for this project (matches community-app APIS_SOURCE.APP).
  const source = 'app';
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  // redirectUri = encoded URI + provider appended (community-app pattern).
  const redirectUri = (Config.QUEST_REDIRECT_URI_ENCODED ?? '') + 'GOOGLE';
  const url = `oauth/authenticate?source=${encodeURIComponent(source)}`;

  console.log('[googleAuth] loginWithGoogle → POST', url, '| code length:', code.length);
  try {
    const { data } = await questClient.post<{ data: GoogleAuthResponse }>(url, {
      provider: 'GOOGLE',
      platform,
      code,
      redirectUri,
    });
    console.log('[googleAuth] loginWithGoogle ← raw response data:', JSON.stringify(data));
    const result = data.data;
    console.log('[googleAuth] loginWithGoogle ← OK', {
      isNewUser: result.isNewUser,
      isPrimaryConnected: result.isPrimaryConnected,
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken,
    });
    return result;
  } catch (err) {
    if (isAxiosError(err)) {
      console.error(
        '[googleAuth] loginWithGoogle ← ERROR',
        err.response?.status,
        err.response?.data ?? err.message,
      );
    } else {
      console.error('[googleAuth] loginWithGoogle ← ERROR', err);
    }
    throw err;
  }
}
