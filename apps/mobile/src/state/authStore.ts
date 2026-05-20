// Quest auth store — holds accessToken + refreshToken in memory after login.
// AsyncStorage is the persistence layer (see authStorage.ts); this store is the
// in-memory source so components don't async-read on every render.
// Hydrated at app boot from AsyncStorage by calling hydrateAuthStore().
import { create } from 'zustand';
import {
  saveQuestAuthDetails,
  clearQuestAuthDetails,
  getQuestAuthDetails,
  type QuestAuthDetails,
} from '../utils/authStorage';

export interface QuestAuthState {
  accessToken: string | null;
  refreshToken: string | null;

  setTokens(accessToken: string, refreshToken: string, idToken?: string): Promise<void>;
  updateAccessToken(accessToken: string): Promise<void>;
  clearTokens(): Promise<void>;
}

export const useAuthStore = create<QuestAuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,

  setTokens: async (accessToken, refreshToken, idToken) => {
    const details: QuestAuthDetails =
      idToken !== undefined
        ? { accessToken, refreshToken, idToken }
        : { accessToken, refreshToken };
    await saveQuestAuthDetails(details);
    set({ accessToken, refreshToken });
  },

  updateAccessToken: async (accessToken) => {
    const { refreshToken } = get();
    if (refreshToken) {
      await saveQuestAuthDetails({ accessToken, refreshToken });
    }
    set({ accessToken });
  },

  clearTokens: async () => {
    await clearQuestAuthDetails();
    set({ accessToken: null, refreshToken: null });
  },
}));

// Call once at app boot to rehydrate from AsyncStorage.
export async function hydrateAuthStore(): Promise<void> {
  const stored = await getQuestAuthDetails();
  if (stored) {
    useAuthStore.setState({
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
    });
  }
}
