// Root native-stack route params — screens mounted as siblings in RootNativeStack.

export type RootStackParamList = {
  OnboardingStack: undefined;
  MainTabs: undefined;
  Recording: { taskId?: string; practice?: boolean } | undefined;
  Player: { recordingId: string };
  Profile: undefined;
  PendingUploads: undefined;
  BatteryOptimization: undefined;
  HelpCenter: undefined;
  ForceUpgrade: undefined;
  LogoutModal: undefined;
  DeleteAccountModal: undefined;
  QuestDetails: { questSlug: string };
};
