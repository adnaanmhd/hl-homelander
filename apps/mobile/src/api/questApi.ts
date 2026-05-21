import type { AxiosResponse } from 'axios';
import Config from 'react-native-config';
import questClient from './questClient';
import {
  noProofSubmission,
  proofSubmission,
  questBanner,
  questDetailSlug,
  questDetailV2,
  questLoginMethod,
  questShareUrl,
  questStatus,
  startQuest,
  startQuestFormSubmission,
} from './questUrls';
import type {
  CategoryType,
  FilterType,
  Quest,
  QuestDetail,
  QuestProfile,
  QuestStatusDetails,
} from '../screens/quest/types';
import { questList } from './questUrls';
import { encodeQuestValue, formatPhoneForQuestApi } from '../screens/quest/utils/questEncode';

function unwrap<T>(res: AxiosResponse<unknown>): T {
  const body = res.data as Record<string, unknown>;
  if (body && typeof body === 'object' && 'data' in body) {
    const inner = body.data as Record<string, unknown>;
    if (inner && typeof inner === 'object' && 'success' in inner && inner.data) {
      return inner.data as T;
    }
    if (inner && !('success' in inner)) {
      return inner as T;
    }
  }
  return body as T;
}

export async function fetchQuestProfile(): Promise<QuestProfile> {
  const res = await questClient.get('users/me/profile');
  const data = unwrap<QuestProfile>(res);
  return data;
}

export async function resolveQuestIdBySlug(slug: string): Promise<string | null> {
  const res = await questClient.get(questDetailSlug(slug));
  const data = unwrap<{ questId?: string }>(res);
  return data?.questId ?? null;
}

export async function fetchQuestDetail(questId: string): Promise<QuestDetail> {
  const res = await questClient.get(questDetailV2(questId));
  return unwrap<QuestDetail>(res);
}

export async function fetchQuestBannerImage(
  gameId: string,
  businessGameId: string,
): Promise<string | null> {
  try {
    const res = await questClient.get(questBanner(gameId, businessGameId));
    const data = unwrap<{ imageUrl?: string; url?: string } | string>(res);
    if (typeof data === 'string') return data;
    return data?.imageUrl ?? data?.url ?? null;
  } catch {
    return null;
  }
}

export async function fetchQuestUserStatus(
  questId: string,
  userId: string,
): Promise<QuestStatusDetails> {
  const res = await questClient.get(questStatus(questId, userId));
  return unwrap<QuestStatusDetails>(res);
}

export async function postStartQuest(
  questId: string,
  userId: string,
  accessCode?: string,
): Promise<void> {
  await questClient.post(startQuest(questId, userId, accessCode ?? ''), {});
}

export async function postLoginDetailsForm(params: {
  gameId: string;
  userId: string;
  loginType: string;
  loginValue: string;
  gamerDetails: Record<string, string>[];
  questId: string;
}): Promise<void> {
  const url = startQuestFormSubmission(
    params.gameId,
    params.userId,
    params.loginType,
    encodeQuestValue(params.loginValue),
    params.gamerDetails,
    params.questId,
  );
  await questClient.post(url, {});
}

export async function fetchGameLoginMethod(
  gameId: string,
  userId: string,
  questId: string,
): Promise<{
  loginMethod?: string;
  gamerloginmethod?: string;
  details?: Record<string, string>[];
} | null> {
  try {
    const res = await questClient.get(questLoginMethod(gameId, userId, questId));
    const data = unwrap<{
      loginMethod?: string;
      gamerloginmethod?: string;
      details?: Record<string, string>[];
    }>(res);
    return data;
  } catch {
    return null;
  }
}

export async function submitProofWithImages(params: {
  questId: string;
  userId: string;
  stage: number;
  phone: string;
  reward: number;
  type: string;
  proof: { submissionType: string; submissionTypeValue: string }[];
  images: { uri: string; fileName?: string }[];
  loginMethod?: string;
  gamerloginmethod?: string;
  details?: Record<string, string>[];
  isLoginDetailsStageAvailable: boolean;
}): Promise<void> {
  const url = proofSubmission({
    questId: params.questId,
    userId: params.userId,
    stage: params.stage,
    phone: formatPhoneForQuestApi(params.phone),
    reward: params.reward,
    type: params.type,
    proof: params.proof,
    isLoginDetailsStageAvailable: params.isLoginDetailsStageAvailable,
    ...(params.loginMethod ? { loginMethod: params.loginMethod } : {}),
    ...(params.gamerloginmethod ? { gamerloginmethod: params.gamerloginmethod } : {}),
    ...(params.details ? { details: params.details } : {}),
  });

  const form = new FormData();
  params.images.forEach((photo, i) => {
    form.append('file', {
      uri: photo.uri,
      name: photo.fileName ?? `proof_${i}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });
  form.append('questId', params.questId);
  form.append('stage', String(params.stage));
  form.append('proof', JSON.stringify(params.proof));

  await questClient.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function submitProofText(params: {
  questId: string;
  userId: string;
  stage: number;
  phone: string;
  reward: number;
  type: string;
  proofValue: string;
  submissionType: string;
  loginMethod?: string;
  gamerloginmethod?: string;
  details?: Record<string, string>[];
  isLoginDetailsStageAvailable: boolean;
}): Promise<void> {
  const proof = [
    {
      submissionType: params.submissionType,
      submissionTypeValue: encodeQuestValue(params.proofValue),
    },
  ];

  if (params.proofValue.trim()) {
    const url = proofSubmission({
      questId: params.questId,
      userId: params.userId,
      stage: params.stage,
      phone: formatPhoneForQuestApi(params.phone),
      reward: params.reward,
      type: params.type,
      proof,
      isLoginDetailsStageAvailable: params.isLoginDetailsStageAvailable,
      ...(params.loginMethod ? { loginMethod: params.loginMethod } : {}),
      ...(params.gamerloginmethod ? { gamerloginmethod: params.gamerloginmethod } : {}),
      ...(params.details ? { details: params.details } : {}),
    });
    const form = new FormData();
    form.append('questId', params.questId);
    form.append('stage', String(params.stage));
    form.append('proof', JSON.stringify(proof));
    await questClient.post(url, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return;
  }

  const url = noProofSubmission({
    questId: params.questId,
    userId: params.userId,
    stage: params.stage,
    phone: formatPhoneForQuestApi(params.phone),
    reward: params.reward,
    isLoginDetailsStageAvailable: params.isLoginDetailsStageAvailable,
    ...(params.loginMethod ? { loginMethod: params.loginMethod } : {}),
    ...(params.gamerloginmethod ? { gamerloginmethod: params.gamerloginmethod } : {}),
    ...(params.details ? { details: params.details } : {}),
  });
  await questClient.post(url, {});
}

export function getQuestShareLink(questId: string): string {
  return questShareUrl(questId, Config.QUEST_REDIRECT_URI ?? undefined);
}

const FILTER_STATE: Record<FilterType, string | undefined> = {
  Live: 'LIVE',
  Upcoming: 'PUBLISHED',
  Ended: 'ENDED',
  All: undefined,
};

export async function fetchRecommendedQuests(opts: {
  category: CategoryType;
  filter: FilterType;
  page: number;
  limit?: number;
}): Promise<{ quests: Quest[]; hasMore: boolean }> {
  const limit = opts.limit ?? 10;
  const url = questList(opts.page, limit, opts.category, FILTER_STATE[opts.filter]);
  const res = await questClient.get(url);
  const body = unwrap<{ quests?: Quest[] } | Quest[]>(res);
  const quests = Array.isArray(body) ? body : (body?.quests ?? []);
  return { quests, hasMore: quests.length >= limit };
}
