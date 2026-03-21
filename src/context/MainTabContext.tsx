import React, {createContext, useContext} from 'react';
import PagerView from 'react-native-pager-view';
import type {MainTabRouteName} from '../navigation/types';

export type MainTabContextValue = {
  activeRouteName: MainTabRouteName;
  requestTab: (name: MainTabRouteName) => void;
  pagerRef: React.RefObject<PagerView | null>;
  /** Dashboard pushes live alert badge count for the shared `AppHeader`. */
  setDashboardLiveAlerts: (count: number) => void;
};

export const MainTabContext = createContext<MainTabContextValue | null>(null);

export function useMainTabOptional() {
  return useContext(MainTabContext);
}
