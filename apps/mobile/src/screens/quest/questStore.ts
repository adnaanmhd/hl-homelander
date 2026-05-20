import { create } from 'zustand';
import type { CategoryType, FeaturedQuest, FilterType, Quest } from './types';

const NOW = Date.now();
const DAY = 86_400_000;

const MOCK_FEATURED: FeaturedQuest[] = [
  {
    questId: 'feat-001',
    quest_slug: 'valorant-ace-challenge',
    quest_title: 'Valorant Ace Challenge',
    quest_description: 'Get 5 aces in ranked matches and unlock exclusive rewards worth ₹500',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 500,
    total_reward: 500,
    gameId: 'valorant',
    businessGameId: 'val-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Get 5 Aces',
          proof: true,
          number_of_slots: 1000,
          remainingSlots: 342,
          totalSubmissionCount: 658,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 3,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 500 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'FPS',
    sponsor_name: 'Riot Games',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/valorant/600/300',
    youtubeLink: '',
    end_live: new Date(NOW + 3 * DAY).toISOString(),
    go_live: new Date(NOW - DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    priority: 1,
    questStatus: { status: 'not started' },
    userQuestProgress: 0,
  },
  {
    questId: 'feat-002',
    quest_slug: 'bgmi-chicken-dinner',
    quest_title: 'BGMI Chicken Dinner',
    quest_description: 'Win 3 squad matches in BGMI and earn up to ₹250 in rewards',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 250,
    total_reward: 250,
    gameId: 'bgmi',
    businessGameId: 'bgmi-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Win 3 Matches',
          proof: true,
          number_of_slots: 500,
          remainingSlots: 120,
          totalSubmissionCount: 380,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 2,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 250 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'Battle Royale',
    sponsor_name: 'Krafton',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/bgmiq/600/300',
    youtubeLink: '',
    end_live: new Date(NOW + 5 * DAY).toISOString(),
    go_live: new Date(NOW - 2 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    priority: 2,
    questStatus: { status: 'active' },
    userQuestProgress: 60,
  },
  {
    questId: 'feat-003',
    quest_slug: 'free-fire-sniper-king',
    quest_title: 'Free Fire Sniper King',
    quest_description: "Score 100 sniper kills and prove you're the best marksman",
    quest_type: 'UGC and Social',
    quest_state: 'Published',
    quest_reward: 300,
    total_reward: 300,
    gameId: 'freefire',
    businessGameId: 'ff-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: '100 Sniper Kills',
          proof: true,
          number_of_slots: 750,
          remainingSlots: 750,
          totalSubmissionCount: 0,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 3,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 300 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'Battle Royale',
    sponsor_name: 'Garena',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/freefireq/600/300',
    youtubeLink: '',
    end_live: new Date(NOW + 10 * DAY).toISOString(),
    go_live: new Date(NOW + 2 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    priority: 3,
    questStatus: { status: 'not started' },
    userQuestProgress: 0,
  },
];

const MOCK_IN_PROGRESS: Quest[] = [
  {
    questId: 'ip-001',
    quest_slug: 'bgmi-chicken-dinner',
    quest_title: 'BGMI Chicken Dinner',
    quest_description: 'Win 3 matches',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 250,
    total_reward: 250,
    gameId: 'bgmi',
    businessGameId: 'bgmi-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Win 3 Matches',
          proof: true,
          number_of_slots: 500,
          remainingSlots: 120,
          totalSubmissionCount: 380,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 2,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 250 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'Battle Royale',
    sponsor_name: 'Krafton',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/bgmiip/400/200',
    youtubeLink: '',
    end_live: new Date(NOW + 5 * DAY).toISOString(),
    go_live: new Date(NOW - 2 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    userQuestProgress: 60,
    questStatus: { status: 'active' },
  },
  {
    questId: 'ip-002',
    quest_slug: 'cod-mobile-headshots',
    quest_title: 'COD Mobile Headshots',
    quest_description: 'Get 30 headshots',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 150,
    total_reward: 150,
    gameId: 'codmobile',
    businessGameId: 'cod-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: '30 Headshots',
          proof: true,
          number_of_slots: 400,
          remainingSlots: 180,
          totalSubmissionCount: 220,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 2,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 150 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'FPS',
    sponsor_name: 'Activision',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/codip/400/200',
    youtubeLink: '',
    end_live: new Date(NOW + 4 * DAY).toISOString(),
    go_live: new Date(NOW - 3 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    userQuestProgress: 30,
    questStatus: { status: 'active' },
  },
];

const MOCK_RECOMMENDED: Quest[] = [
  {
    questId: 'rec-001',
    quest_slug: 'valorant-ace-challenge',
    quest_title: 'Valorant Ace Challenge',
    quest_description: 'Get 5 aces',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 500,
    total_reward: 500,
    gameId: 'valorant',
    businessGameId: 'val-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Get 5 Aces',
          proof: true,
          number_of_slots: 1000,
          remainingSlots: 342,
          totalSubmissionCount: 658,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 3,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 500 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'FPS',
    sponsor_name: 'Riot Games',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/rec1/400/300',
    youtubeLink: '',
    end_live: new Date(NOW + 3 * DAY).toISOString(),
    go_live: new Date(NOW - DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    questStatus: { status: 'not started' },
    userQuestProgress: 0,
  },
  {
    questId: 'rec-002',
    quest_slug: 'bgmi-chicken-dinner',
    quest_title: 'BGMI Chicken Dinner',
    quest_description: 'Win 3 matches',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 250,
    total_reward: 250,
    gameId: 'bgmi',
    businessGameId: 'bgmi-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Win 3 Matches',
          proof: true,
          number_of_slots: 500,
          remainingSlots: 120,
          totalSubmissionCount: 380,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 2,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 250 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'Battle Royale',
    sponsor_name: 'Krafton',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/rec2/400/300',
    youtubeLink: '',
    end_live: new Date(NOW + 5 * DAY).toISOString(),
    go_live: new Date(NOW - 2 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    questStatus: { status: 'active' },
    userQuestProgress: 60,
  },
  {
    questId: 'rec-003',
    quest_slug: 'cod-mobile-headshots',
    quest_title: 'COD Mobile Headshots',
    quest_description: 'Get 30 headshots in ranked',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 150,
    total_reward: 150,
    gameId: 'codmobile',
    businessGameId: 'cod-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: '30 Headshots',
          proof: true,
          number_of_slots: 400,
          remainingSlots: 180,
          totalSubmissionCount: 220,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 2,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 150 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'FPS',
    sponsor_name: 'Activision',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/rec3/400/300',
    youtubeLink: '',
    end_live: new Date(NOW + 4 * DAY).toISOString(),
    go_live: new Date(NOW - 3 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    questStatus: { status: 'active' },
    userQuestProgress: 30,
  },
  {
    questId: 'rec-004',
    quest_slug: 'free-fire-sniper',
    quest_title: 'Free Fire Sniper King',
    quest_description: 'Score 100 sniper kills',
    quest_type: 'UGC and Social',
    quest_state: 'Published',
    quest_reward: 300,
    total_reward: 300,
    gameId: 'freefire',
    businessGameId: 'ff-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: '100 Sniper Kills',
          proof: true,
          number_of_slots: 750,
          remainingSlots: 750,
          totalSubmissionCount: 0,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 3,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 300 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'Battle Royale',
    sponsor_name: 'Garena',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/rec4/400/300',
    youtubeLink: '',
    end_live: new Date(NOW + 10 * DAY).toISOString(),
    go_live: new Date(NOW + 2 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    questStatus: { status: 'not started' },
    userQuestProgress: 0,
  },
  {
    questId: 'rec-005',
    quest_slug: 'pubg-survival-master',
    quest_title: 'PUBG Survival Master',
    quest_description: 'Survive top 10 in 5 matches',
    quest_type: 'In-Game Progression',
    quest_state: 'Ended',
    quest_reward: 200,
    total_reward: 200,
    gameId: 'pubg',
    businessGameId: 'pubg-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Top 10 Five Times',
          proof: true,
          number_of_slots: 600,
          remainingSlots: 0,
          totalSubmissionCount: 600,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 2,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 200 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'Battle Royale',
    sponsor_name: 'Krafton',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/rec5/400/300',
    youtubeLink: '',
    end_live: new Date(NOW - DAY).toISOString(),
    go_live: new Date(NOW - 8 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    questStatus: { status: 'completed' },
    userQuestProgress: 100,
  },
  {
    questId: 'rec-006',
    quest_slug: 'lol-pentakill-quest',
    quest_title: 'LoL Pentakill Quest',
    quest_description: 'Score a pentakill in ranked solo queue',
    quest_type: 'In-Game Progression',
    quest_state: 'Live',
    quest_reward: 400,
    total_reward: 400,
    gameId: 'lol',
    businessGameId: 'lol-001',
    stages: [
      {
        stage: 1,
        basic_details: {
          stage_title: 'Get a Pentakill',
          proof: true,
          number_of_slots: 300,
          remainingSlots: 87,
          totalSubmissionCount: 213,
          submissionTypes: ['SCREENSHOT'],
          proofSubmissionScreenshotCount: 3,
        },
        earnings: {
          gamer_earnings: [{ earningType: 'INR', earningAmount: 400 }],
          clan_chief_earnings: [],
        },
        steps: [],
      },
    ],
    sponsor_genre: 'MOBA',
    sponsor_name: 'Riot Games',
    sponsor_logo: '',
    sponsor_platform: [],
    questUploadFile: 'https://picsum.photos/seed/rec6/400/300',
    youtubeLink: '',
    end_live: new Date(NOW + 7 * DAY).toISOString(),
    go_live: new Date(NOW - 2 * DAY).toISOString(),
    enableModalUploadValidation: false,
    isThirdPartyQuest: false,
    questStatus: { status: 'not started' },
    userQuestProgress: 0,
  },
];

interface QuestStoreState {
  featured: FeaturedQuest[];
  inProgress: Quest[];
  recommended: Quest[];
  isFeaturedLoading: boolean;
  isInProgressLoading: boolean;
  isRecommendedLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  page: number;
  fetchFeatured: (category: CategoryType) => Promise<void>;
  fetchInProgress: (category: CategoryType) => Promise<void>;
  fetchRecommended: (opts: {
    category: CategoryType;
    filter: FilterType;
    page: number;
  }) => Promise<void>;
  clearRecommended: () => void;
}

export const useQuestStore = create<QuestStoreState>((set, _get) => ({
  featured: [],
  inProgress: [],
  recommended: [],
  isFeaturedLoading: false,
  isInProgressLoading: false,
  isRecommendedLoading: false,
  isLoadingMore: false,
  hasMore: true,
  page: 1,

  fetchFeatured: async (_category: CategoryType) => {
    set({ isFeaturedLoading: true });
    await new Promise<void>((r) => setTimeout(r, 800));
    set({ isFeaturedLoading: false, featured: MOCK_FEATURED });
  },

  fetchInProgress: async (_category: CategoryType) => {
    set({ isInProgressLoading: true });
    await new Promise<void>((r) => setTimeout(r, 600));
    set({ isInProgressLoading: false, inProgress: MOCK_IN_PROGRESS });
  },

  fetchRecommended: async ({ filter, page }) => {
    if (page === 1) {
      set({ isRecommendedLoading: true, recommended: [] });
    } else {
      set({ isLoadingMore: true });
    }
    await new Promise<void>((r) => setTimeout(r, 1000));

    const all = MOCK_RECOMMENDED;
    const filtered =
      filter === 'All'
        ? all
        : filter === 'Live'
          ? all.filter((q) => q.quest_state === 'Live')
          : filter === 'Upcoming'
            ? all.filter((q) => q.quest_state === 'Published')
            : all.filter((q) => q.quest_state === 'Ended');

    set((state) => ({
      isRecommendedLoading: false,
      isLoadingMore: false,
      recommended: page === 1 ? filtered : [...state.recommended, ...filtered],
      hasMore: false,
      page: page + 1,
    }));
  },

  clearRecommended: () => {
    set({ recommended: [], page: 1, hasMore: true });
  },
}));
