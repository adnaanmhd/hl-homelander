import { Linking } from 'react-native';
import Config from 'react-native-config';
import { useAuthStore } from '../../../state/authStore';

/** Opens k-quest web flow for AI training quests (community-app parity). */
export function redirectToAiTrainingQuest(questId: string): void {
  const base = (Config.QUEST_REDIRECT_URI ?? 'https://engage.kgen.io/').replace(/\/?$/, '/');
  const { accessToken, refreshToken } = useAuthStore.getState();
  const url = `${base}k-quest/${questId}?accessToken=${accessToken ?? ''}&refreshToken=${refreshToken ?? ''}`;
  void Linking.openURL(url);
}
