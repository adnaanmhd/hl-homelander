import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { colors, spacing } from '../../ui/tokens';
import {
  fetchGameLoginMethod,
  fetchQuestBannerImage,
  fetchQuestDetail,
  fetchQuestUserStatus,
  getQuestShareLink,
  postLoginDetailsForm,
  postStartQuest,
  resolveQuestIdBySlug,
  submitProofText,
  submitProofWithImages,
} from '../../api/questApi';
import type { RootStackParamList } from '../../navigation/rootTypes';
import type { QuestDetail, QuestStatusDetails } from './types';
import { useQuestProfileStore } from './questProfileStore';
import { useQuestSelectionStore } from './questSelectionStore';
import QuestDetailHeader from './components/detail/QuestDetailHeader';
import QuestDetailHero from './components/detail/QuestDetailHero';
import QuestLoginDetailsSection from './components/detail/QuestLoginDetailsSection';
import QuestStageCard from './components/detail/QuestStageCard';
import LoginDetailsSheet from './components/detail/LoginDetailsSheet';
import ProofSubmitSheet from './components/detail/ProofSubmitSheet';
import StartRulesModal from './components/detail/StartRulesModal';

type DetailsRoute = RouteProp<RootStackParamList, 'QuestDetails'>;

function sumRemainingSlots(quest: QuestDetail): number {
  return quest.stages.reduce((sum, s) => sum + (s.basic_details?.remainingSlots ?? 0), 0);
}

export default function QuestDetailsScreen() {
  const route = useRoute<DetailsRoute>();
  const { questSlug } = route.params;

  const { profile, fetchProfile } = useQuestProfileStore();
  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [questStatus, setQuestStatus] = useState<QuestStatusDetails | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [loginDisabled, setLoginDisabled] = useState(false);
  const [gameLoginSubmittedId, setGameLoginSubmittedId] = useState<string>();
  const [showRules, setShowRules] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [proofSheet, setProofSheet] = useState<{
    stage: number;
    reward: number;
    needsProof: boolean;
    title: string;
    submissionType: string;
    maxScreenshots: number;
  } | null>(null);
  const [isProofSubmitting, setIsProofSubmitting] = useState(false);

  const userId = profile?.userId;
  const phone = profile?.phone_number ?? '';

  const loadDetail = useCallback(async () => {
    try {
      const questId = await resolveQuestIdBySlug(questSlug);
      if (!questId) {
        throw new Error('Quest not found');
      }

      const detail = await fetchQuestDetail(questId);
      setQuest(detail);

      const banner = await fetchQuestBannerImage(detail.gameId, detail.businessGameId);
      if (banner) setBannerUri(banner);

      const prof = useQuestProfileStore.getState().profile ?? (await fetchProfile());
      const uid = prof?.userId;
      if (uid) {
        const status = await fetchQuestUserStatus(questId, uid);
        setQuestStatus(status);

        if (detail.loginDetailsStage) {
          const login = await fetchGameLoginMethod(detail.gameId, uid, questId);
          if (login?.gamerloginmethod) {
            setLoginDisabled(true);
            setGameLoginSubmittedId(login.gamerloginmethod);
          } else {
            setLoginDisabled(false);
          }
        } else {
          setLoginDisabled(true);
        }
      }
    } catch {
      const preview = useQuestSelectionStore.getState().preview;
      if (preview?.quest_slug === questSlug) {
        setQuest(preview);
        if (preview.questUploadFile) setBannerUri(preview.questUploadFile);
        const status = preview.questStatus?.status ?? 'not started';
        setQuestStatus({
          quest: status === 'active' ? 'validating' : status.replace(' ', '_'),
          stages: [],
        });
        setLoginDisabled(true);
      } else {
        Alert.alert('Error', 'Failed to load quest. Please try again.');
      }
    }
  }, [questSlug, fetchProfile]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadDetail();
      setLoading(false);
    })();
  }, [questSlug]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDetail();
    setRefreshing(false);
  }, [loadDetail]);

  const totalRemainingSlots = useMemo(() => (quest ? sumRemainingSlots(quest) : 0), [quest]);

  const onShare = useCallback(async () => {
    if (!quest?.questId) return;
    const url = getQuestShareLink(quest.questId);
    try {
      await Share.share({
        message: `Check out this quest: ${quest.quest_title}\n${url}`,
        url,
      });
    } catch {
      /* user dismissed */
    }
  }, [quest]);

  const handleStartQuest = useCallback(async () => {
    if (!quest || !userId) {
      Alert.alert('Sign in required', 'Please sign in with Google to start this quest.');
      return;
    }
    setIsStarting(true);
    try {
      await postStartQuest(quest.questId, userId);
      await loadDetail();
    } catch {
      Alert.alert('Error', 'Could not start quest. Please try again.');
    } finally {
      setIsStarting(false);
      setShowRules(false);
    }
  }, [quest, userId, loadDetail]);

  const onStartPress = useCallback(() => {
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in with Google to start this quest.');
      return;
    }
    if (quest?.rules?.points?.length || quest?.notes?.points?.length) {
      setShowRules(true);
    } else {
      void handleStartQuest();
    }
  }, [quest, userId, handleStartQuest]);

  const onLoginSubmit = useCallback(
    async (loginType: string, loginValue: string) => {
      if (!quest || !userId) return;
      setIsLoginSubmitting(true);
      try {
        await postLoginDetailsForm({
          gameId: quest.gameId,
          userId,
          loginType,
          loginValue,
          gamerDetails: [{ [loginType]: loginValue }],
          questId: quest.questId,
        });
        setLoginDisabled(true);
        setGameLoginSubmittedId(loginValue);
        await loadDetail();
      } catch {
        Alert.alert('Error', 'Could not submit login details.');
      } finally {
        setIsLoginSubmitting(false);
      }
    },
    [quest, userId, loadDetail],
  );

  const onProofSubmit = useCallback(
    async (payload: { proofValue: string; images: { uri: string; fileName?: string }[] }) => {
      if (!quest || !userId || !proofSheet) return;
      setIsProofSubmitting(true);
      try {
        const stageData = quest.stages.find((s) => s.stage === proofSheet.stage);
        const submissionType = stageData?.basic_details?.submissionTypes?.[0] ?? 'SCREENSHOT';
        const login = await fetchGameLoginMethod(quest.gameId, userId, quest.questId);
        const isLoginStage = Boolean(quest.loginDetailsStage);

        const loginFields = {
          ...(login?.loginMethod ? { loginMethod: login.loginMethod } : {}),
          ...(login?.gamerloginmethod ? { gamerloginmethod: login.gamerloginmethod } : {}),
          ...(login?.details ? { details: login.details } : {}),
        };

        if (payload.images.length > 0) {
          await submitProofWithImages({
            questId: quest.questId,
            userId,
            stage: proofSheet.stage,
            phone,
            reward: proofSheet.reward,
            type: quest.quest_type,
            proof: [
              {
                submissionType,
                submissionTypeValue: payload.proofValue || 'File',
              },
            ],
            images: payload.images,
            isLoginDetailsStageAvailable: isLoginStage,
            ...loginFields,
          });
        } else {
          await submitProofText({
            questId: quest.questId,
            userId,
            stage: proofSheet.stage,
            phone,
            reward: proofSheet.reward,
            type: quest.quest_type,
            proofValue: payload.proofValue,
            submissionType,
            isLoginDetailsStageAvailable: isLoginStage,
            ...loginFields,
          });
        }
        await loadDetail();
      } catch {
        Alert.alert('Error', 'Proof submission failed. Please try again.');
      } finally {
        setIsProofSubmitting(false);
      }
    },
    [quest, userId, phone, proofSheet, loadDetail],
  );

  const openProofSheet = useCallback(
    (stageNum: number, reward: number, needsProof: boolean) => {
      if (!quest) return;
      const stageData = quest.stages.find((s) => s.stage === stageNum);
      setProofSheet({
        stage: stageNum,
        reward,
        needsProof,
        title: stageData?.basic_details?.stage_title ?? `Stage ${stageNum}`,
        submissionType: stageData?.basic_details?.submissionTypes?.[0] ?? 'SCREENSHOT',
        maxScreenshots: stageData?.basic_details?.proofSubmissionScreenshotCount ?? 3,
      });
    },
    [quest],
  );

  if (loading && !quest) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  if (!quest) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <Text variant="body" tone="secondary">
            Quest not found.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padding={0}>
      <QuestDetailHeader onShare={onShare} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        <QuestDetailHero
          quest={quest}
          questStatus={questStatus}
          bannerUri={bannerUri}
          totalRemainingSlots={totalRemainingSlots}
          onStartQuest={onStartPress}
          isStarting={isStarting}
        />

        {quest.loginDetailsStage && (
          <QuestLoginDetailsSection
            quest={quest}
            questStatus={questStatus}
            disabled={loginDisabled}
            {...(gameLoginSubmittedId ? { submittedId: gameLoginSubmittedId } : {})}
            onOpenLoginModal={() => setShowLoginSheet(true)}
          />
        )}

        <Text variant="eyebrow" tone="tertiary" style={styles.stagesLabel}>
          STAGES
        </Text>

        {quest.stages.map((stage) => (
          <QuestStageCard
            key={stage.stage}
            stage={stage}
            quest={quest}
            questStatus={questStatus}
            loginDetailsDisabled={loginDisabled}
            onSubmit={openProofSheet}
          />
        ))}
      </ScrollView>

      <StartRulesModal
        visible={showRules}
        quest={quest}
        onDismiss={() => setShowRules(false)}
        onAgree={() => void handleStartQuest()}
      />

      <LoginDetailsSheet
        visible={showLoginSheet}
        quest={quest}
        onDismiss={() => setShowLoginSheet(false)}
        onSubmit={onLoginSubmit}
        isSubmitting={isLoginSubmitting}
      />

      {proofSheet && (
        <ProofSubmitSheet
          visible
          stageTitle={proofSheet.title}
          needsProof={proofSheet.needsProof}
          submissionType={proofSheet.submissionType}
          maxScreenshots={proofSheet.maxScreenshots}
          onDismiss={() => setProofSheet(null)}
          onSubmit={onProofSubmit}
          isSubmitting={isProofSubmitting}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stagesLabel: { marginHorizontal: spacing.l, marginBottom: spacing.s },
});
