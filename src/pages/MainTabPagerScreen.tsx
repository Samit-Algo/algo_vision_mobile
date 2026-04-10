import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, StyleSheet, StatusBar} from 'react-native';
import PagerView from 'react-native-pager-view';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {MainTabContext} from '../context/MainTabContext';
import AppHeader from '../components/layout/AppHeader';
import BottomNav from '../components/layout/BottomNav';
import {MAIN_TAB_ROUTES} from '../data/mainTabOrder';
import type {MainTabRouteName, RootStackParamList} from '../navigation/types';

import DashboardScreen from './DashboardScreen';
import EventsScreen from './EventsScreen';
import AgentActivityScreen from './AgentActivityScreen';
import CamerasScreen from './CamerasScreen';
import ChatScreen from './ChatScreen';

function getInitialPage(jumpTo: MainTabRouteName | undefined): number {
  if (!jumpTo) {
    return 0;
  }
  const i = MAIN_TAB_ROUTES.indexOf(jumpTo);
  return i >= 0 ? i : 0;
}

function renderMainTabPage(name: MainTabRouteName) {
  switch (name) {
    case 'Dashboard':
      return <DashboardScreen />;
    case 'Events':
      return <EventsScreen />;
    case 'AgentActivity':
      return <AgentActivityScreen />;
    case 'Cameras':
      return <CamerasScreen />;
    case 'Chat':
      return <ChatScreen />;
    default:
      return <DashboardScreen />;
  }
}

export default function MainTabPagerScreen() {
  const {colors, isDark} = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MainTabs'>>();
  const pagerRef = useRef<PagerView>(null);

  const [initialPage] = useState(() =>
    getInitialPage(route.params?.jumpTo),
  );
  const [activeRouteName, setActiveRouteName] = useState<MainTabRouteName>(
    () => MAIN_TAB_ROUTES[initialPage] ?? 'Dashboard',
  );
  /** Keeps bottom bar in sync during drag; `onPageSelected` alone is late on Android. */
  const lastSyncedIndexRef = useRef(initialPage);

  const [dashboardLiveAlerts, setDashboardLiveAlerts] = useState(0);
  const headerNotificationCount =
    activeRouteName === 'Dashboard' ? dashboardLiveAlerts : 0;

  const applyIndex = useCallback((idx: number) => {
    const clamped = Math.min(
      MAIN_TAB_ROUTES.length - 1,
      Math.max(0, idx),
    );
    if (clamped === lastSyncedIndexRef.current) {
      return;
    }
    lastSyncedIndexRef.current = clamped;
    const name = MAIN_TAB_ROUTES[clamped];
    if (name) {
      setActiveRouteName(name);
    }
  }, []);

  const onPageScroll = useCallback(
    (e: {nativeEvent: {position: number; offset: number}}) => {
      const {position, offset} = e.nativeEvent;
      const idx = Math.round(position + offset);
      applyIndex(idx);
    },
    [applyIndex],
  );

  const requestTab = useCallback(
    (name: MainTabRouteName) => {
      const idx = MAIN_TAB_ROUTES.indexOf(name);
      if (idx < 0) {
        return;
      }
      lastSyncedIndexRef.current = idx;
      setActiveRouteName(name);
      pagerRef.current?.setPage(idx);
    },
    [],
  );

  const onPageSelected = useCallback(
    (e: {nativeEvent: {position: number}}) => {
      applyIndex(e.nativeEvent.position);
    },
    [applyIndex],
  );

  const jumpTo = route.params?.jumpTo;
  useEffect(() => {
    if (jumpTo == null) {
      return;
    }
    const idx = MAIN_TAB_ROUTES.indexOf(jumpTo);
    if (idx < 0) {
      return;
    }
    lastSyncedIndexRef.current = idx;
    setActiveRouteName(jumpTo);
    pagerRef.current?.setPage(idx);
    navigation.setParams({jumpTo: undefined});
  }, [jumpTo, navigation]);

  const contextValue = useMemo(
    () => ({
      activeRouteName,
      requestTab,
      pagerRef,
      setDashboardLiveAlerts,
    }),
    [activeRouteName, requestTab],
  );

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <MainTabContext.Provider value={contextValue}>
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={[
            styles.headerSafe,
            {backgroundColor: colors.headerBg},
          ]}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={colors.headerBg}
          />
          <AppHeader notificationCount={headerNotificationCount} />
        </SafeAreaView>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={initialPage}
          onPageScroll={onPageScroll}
          onPageSelected={onPageSelected}
          overdrag={false}
          scrollEnabled>
          {MAIN_TAB_ROUTES.map((name: MainTabRouteName) => (
            <View key={name} style={styles.page} collapsable={false}>
              {renderMainTabPage(name)}
            </View>
          ))}
        </PagerView>
        <SafeAreaView
          edges={['bottom']}
          style={[styles.footerSafe, {backgroundColor: colors.tabBar}]}>
          <BottomNav />
        </SafeAreaView>
      </MainTabContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  /** Must stack above PagerView so the profile menu (overflow) is not covered by tab pages. */
  headerSafe: {zIndex: 100, elevation: 100, overflow: 'visible'},
  pager: {flex: 1, zIndex: 0},
  page: {flex: 1},
  footerSafe: {},
});
