// types/navigation.ts
export type RootStackParamList = {
  Home: undefined;
  CreateLiveScreen: undefined;
  BroadcastScreen: { liveId: string };
  WatchLiveScreen: { live: any };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}