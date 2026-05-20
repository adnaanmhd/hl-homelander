// NOTE: CLAUDE.md prefers MMKV for token storage. AsyncStorage is used here
// intentionally for the Quest subsystem to match the community-app pattern and
// its backend's auth contract (separate from the Capture JWT in MMKV).
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_DETAILS_KEY = 'quest_auth_details';

export interface QuestAuthDetails {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  isNewUser?: boolean;
}

export const saveQuestAuthDetails = (details: QuestAuthDetails): Promise<void> =>
  AsyncStorage.setItem(AUTH_DETAILS_KEY, JSON.stringify(details));

export const getQuestAuthDetails = async (): Promise<QuestAuthDetails | null> => {
  const stored = await AsyncStorage.getItem(AUTH_DETAILS_KEY);
  return stored ? (JSON.parse(stored) as QuestAuthDetails) : null;
};

export const clearQuestAuthDetails = (): Promise<void> => AsyncStorage.removeItem(AUTH_DETAILS_KEY);
