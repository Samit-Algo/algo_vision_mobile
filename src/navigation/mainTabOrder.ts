import type {MainTabRouteName} from './types';

/** Must match `BottomNav` order — used for horizontal swipe between tabs. */
export const MAIN_TAB_ROUTES: MainTabRouteName[] = [
  'Dashboard',
  'Cameras',
  'AgentActivity',
  'Events',
  'Chat',
];

export function isMainTabRoute(name: string): boolean {
  return (MAIN_TAB_ROUTES as string[]).includes(name);
}
