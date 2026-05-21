// Quest API path builders — mirrors community-app apiUrls (kgen backend).

const APP_PLATFORM = 'applicablePlatform=APP';

export function questList(
  page: number,
  limit: number,
  category: string,
  questState?: string,
): string {
  const stateParam = questState ? `&questState=${questState}` : '';
  return `/userquest/v2/questlist?geoGraphy=Other&page=${page}&limit=${limit}&${APP_PLATFORM}&applicableCategory=${category}${stateParam}`;
}

export function questDetailSlug(slug: string): string {
  const sep = slug.includes('?') ? '&' : '?';
  return `quest/slug/${slug}${sep}${APP_PLATFORM}`;
}

export function questDetailV2(questId: string): string {
  const sep = questId.includes('?') ? '&' : '?';
  return `quest/v2/${questId}${sep}${APP_PLATFORM}`;
}

export function questBanner(gameId: string, businessGameId: string): string {
  return `game/${gameId}/${businessGameId}`;
}

export function questStatus(questId: string, userId: string): string {
  return `userquest/queststatus?questid=${questId}&userid=${userId}`;
}

export function startQuest(questId: string, userId: string, accessCode = ''): string {
  return `userquest/start?questid=${questId}&userid=${userId}&accessCode=${accessCode}`;
}

export function questLoginMethod(gameId: string, userId: string, questId: string): string {
  return `game/loginmethod?gameid=${gameId}&userid=${userId}&questid=${questId}`;
}

export function startQuestFormSubmission(
  gameId: string,
  userId: string,
  loginType: string,
  loginValue: string,
  gamerDetails: Record<string, string>[],
  questId: string,
): string {
  return `/game/loginmethod?gameid=${gameId}&userid=${userId}&questid=${questId}&loginmethod=${loginType}&gamerloginmethod=${loginValue}&gamedetails=${JSON.stringify(gamerDetails)}`;
}

export function proofSubmission(params: {
  questId: string;
  userId: string;
  stage: number;
  phone: string;
  reward: number;
  loginMethod?: string;
  gamerloginmethod?: string;
  type: string;
  details?: Record<string, string>[];
  proof: { submissionType: string; submissionTypeValue: string }[];
  isLoginDetailsStageAvailable: boolean;
}): string {
  const {
    questId,
    userId,
    stage,
    phone,
    reward,
    loginMethod,
    gamerloginmethod,
    type,
    details,
    proof,
    isLoginDetailsStageAvailable,
  } = params;
  let url = `userquest/v2/proof?questid=${questId}&userid=${userId}&stage=${stage}&phone=${phone}&reward=${reward}&type=${type}&proof=${JSON.stringify(proof)}`;
  if (isLoginDetailsStageAvailable && loginMethod && gamerloginmethod) {
    url += `&loginmethod=${loginMethod}&gamerloginmethod=${gamerloginmethod}&gamedetails=${JSON.stringify(details ?? [])}`;
  }
  return url;
}

export function noProofSubmission(params: {
  questId: string;
  userId: string;
  stage: number;
  phone: string;
  reward: number;
  loginMethod?: string;
  gamerloginmethod?: string;
  details?: Record<string, string>[];
  isLoginDetailsStageAvailable: boolean;
}): string {
  const {
    questId,
    userId,
    stage,
    phone,
    reward,
    loginMethod,
    gamerloginmethod,
    details,
    isLoginDetailsStageAvailable,
  } = params;
  let url = `userquest/v2/proof/methods?questid=${questId}&userid=${userId}&stage=${stage}&phone=${phone}&reward=${reward}`;
  if (isLoginDetailsStageAvailable && loginMethod && gamerloginmethod) {
    url += `&loginmethod=${loginMethod}&gamerloginmethod=${gamerloginmethod}&gamedetails=${JSON.stringify(details ?? [])}`;
  }
  return url;
}

export function questShareUrl(questId: string, webBase?: string): string {
  const base = (webBase ?? 'https://engage.kgen.io/').replace(/\/?$/, '/');
  return `${base}k-quest/${questId}`;
}
