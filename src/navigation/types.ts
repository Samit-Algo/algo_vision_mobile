/** Bottom-nav order; stack uses a single `MainTabs` host + native pager. */
export type MainTabRouteName =
  | 'Dashboard'
  | 'Events'
  | 'AgentActivity'
  | 'Cameras'
  | 'Chat';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  /** Swipeable main tabs (Dashboard … Chat). Use `jumpTo` when opening from e.g. CameraLive. */
  MainTabs: {jumpTo?: MainTabRouteName} | undefined;
  CameraLive: {cameraId: string; cameraName?: string};
};