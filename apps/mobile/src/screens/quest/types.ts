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
