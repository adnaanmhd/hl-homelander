// Axios client for the Quest API (kgen backend).
// Request interceptor: reads accessToken from AsyncStorage → Authorization header.
// Response interceptor: on 401, refreshes via refreshToken → retries once.
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../state/authStore';

const AUTH_DETAILS_KEY = 'quest_auth_details';

const questClient = axios.create({
  baseURL: Config.QUEST_API_URL ?? '',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

// ─── Request interceptor — attach access token ───────────────────────────────
questClient.interceptors.request.use(async (config) => {
  const stored = await AsyncStorage.getItem(AUTH_DETAILS_KEY);
  const { accessToken } = stored ? JSON.parse(stored) : {};
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ─── Response interceptor — silent token refresh on 401 ──────────────────────
questClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const stored = await AsyncStorage.getItem(AUTH_DETAILS_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      const refreshToken: string | undefined = parsed?.refreshToken;

      if (refreshToken) {
        const { data } = await questClient.get<{ accessToken: string }>(
          `/oauth/refresh_token?refresh_token=${refreshToken}`,
        );
        const updated = { ...parsed, accessToken: data.accessToken };
        await AsyncStorage.setItem(AUTH_DETAILS_KEY, JSON.stringify(updated));
        // Sync in-memory store.
        useAuthStore.getState().updateAccessToken(data.accessToken);
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${data.accessToken}`,
        };
        return questClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export default questClient;
