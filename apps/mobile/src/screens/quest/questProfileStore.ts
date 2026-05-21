import { create } from 'zustand';
import { fetchQuestProfile } from '../../api/questApi';
import type { QuestProfile } from './types';

interface QuestProfileState {
  profile: QuestProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: () => Promise<QuestProfile | null>;
  clear: () => void;
}

export const useQuestProfileStore = create<QuestProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await fetchQuestProfile();
      set({ profile, isLoading: false });
      return profile;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  clear: () => set({ profile: null, error: null }),
}));
