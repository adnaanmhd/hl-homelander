import { create } from 'zustand';
import type { Quest } from './types';

/** List-item snapshot passed into QuestDetails when API slug lookup is unavailable (mock/dev). */
export const useQuestSelectionStore = create<{
  preview: Quest | null;
  setPreview: (quest: Quest | null) => void;
}>((set) => ({
  preview: null,
  setPreview: (quest) => set({ preview: quest }),
}));
