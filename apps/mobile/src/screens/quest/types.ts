export type QuestState = 'Live' | 'Ended' | 'Published';
export type QuestUserStatus = 'active' | 'not started' | 'completed';
export type FilterType = 'Live' | 'All' | 'Upcoming' | 'Ended';
export type CategoryType = 'AI' | 'GAMING';

export interface SponsorPlatform {
  name: string;
  image: string;
}

export interface GamerEarning {
  earningType: string;
  earningAmount: number;
}

export interface StageBasicDetails {
  stage_title: string;
  proof: boolean;
  number_of_slots: number;
  remainingSlots: number;
  totalSubmissionCount: number;
  submissionTypes: string[];
  proofSubmissionScreenshotCount: number;
}

export interface Stage {
  stage: number;
  basic_details: StageBasicDetails;
  earnings: {
    gamer_earnings: GamerEarning[];
    clan_chief_earnings: unknown[];
  };
  steps: Array<{
    text: string;
    embeddedLink?: string;
    mediaType?: string;
    url_of_media?: string;
    selectedCaption?: string;
  }>;
}

export interface Quest {
  questId: string;
  quest_slug: string;
  quest_title: string;
  quest_description: string;
  quest_type: string;
  quest_state: QuestState;
  quest_reward: number;
  total_reward: number;
  gameId: string;
  businessGameId: string;
  stages: Stage[];
  sponsor_genre: string;
  sponsor_name: string;
  sponsor_logo: string;
  sponsor_platform: SponsorPlatform[];
  questUploadFile: string;
  youtubeLink: string;
  end_live: string;
  go_live: string;
  enableModalUploadValidation: boolean;
  isThirdPartyQuest: boolean;
  userQuestProgress?: number;
  questStatus?: { status: QuestUserStatus };
}

export interface FeaturedQuest extends Quest {
  priority: number;
  isCampaign?: boolean;
  isMiniGames?: boolean;
  banner_img?: string;
  campaignID?: string;
}

// ─── Quest detail (kgen API) ───────────────────────────────────────────────

export interface LoginDetailsStageStep {
  step: number;
  text: string;
  urlOfMedia?: string;
  mediaType?: string;
}

export interface LoginDetailsStage {
  title: string;
  totalSteps: number;
  steps: LoginDetailsStageStep[];
}

export interface QuestDetail extends Quest {
  createdAt?: number;
  questAndLeaderboardFirstPositionReward?: number;
  loginDetailsStage?: LoginDetailsStage;
  loginMethods?: string[];
  loginMethodsWithTitle?: Record<string, string>;
  hasAccessCode?: boolean;
  rules?: { title?: string; points?: string[] };
  notes?: { title?: string; points?: string[] };
  gameYoutubeVideo?: string;
  thirdPartyClientId?: string;
}

export interface QuestStageStatus {
  stage: number;
  status: string;
}

export interface QuestStatusDetails {
  quest: string;
  stages: QuestStageStatus[];
}

export interface QuestProfile {
  userId: string;
  phone_number?: string;
  name?: string;
}

export const QUEST_STAGE_STATUS = {
  NOT_SUBMITTED: 'NOT SUBMITTED',
  VALIDATING_PROOF: 'VALIDATING PROOF',
  VALIDATED_PROOF: 'VALIDATED PROOF',
  EARNING_CREDITED: 'EARNING CREDITED',
  INVALID_PROOF: 'INVALID PROOF',
  DUPLICATE_PROOF: 'DUPLICATE PROOF',
  NOEARNINGS_PROOF: 'NOEARNINGS PROOF',
} as const;
