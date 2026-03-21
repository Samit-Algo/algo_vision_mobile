import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../../context/ThemeContext';
import {useMainTabOptional} from '../../context/MainTabContext';
import type {MainTabRouteName, RootStackParamList} from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type NavItem = {
  label: string;
  route: MainTabRouteName;
};

const NAV_ITEMS: NavItem[] = [
  {label: 'Home', route: 'Dashboard'},
  {label: 'Events', route: 'Events'},
  {label: 'Agents', route: 'AgentActivity'},
  {label: 'Cameras', route: 'Cameras'},
  {label: 'Chat', route: 'Chat'},
];

export default function BottomNav() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute();
  const mainTab = useMainTabOptional();
  const {colors} = useTheme();

  const stackName = route.name as keyof RootStackParamList;
  const highlightTab: MainTabRouteName | null = mainTab
    ? mainTab.activeRouteName
    : stackName === 'CameraLive'
      ? 'Cameras'
      : null;

  return (
    <View
      style={[
        s.bottomNav,
        {backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder},
      ]}>
      {NAV_ITEMS.map(item => {
        const isActive = highlightTab != null && item.route === highlightTab;
        return (
          <TouchableOpacity
            key={item.label}
            style={s.navItem}
            onPress={() => {
              if (mainTab) {
                mainTab.requestTab(item.route);
              } else {
                navigation.navigate('MainTabs', {jumpTo: item.route});
              }
            }}>
            {isActive && (
              <View style={[s.navIndicator, {backgroundColor: colors.accent}]} />
            )}
            <Text
              style={[
                s.navLabel,
                {
                  color: isActive ? colors.accent : colors.tabIcon,
                },
                isActive && s.navLabelActive,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingBottom: 16,
  },
  navItem: {flex: 1, alignItems: 'center', gap: 5, paddingTop: 4},
  navIndicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    position: 'absolute',
    top: 0,
  },
  navLabel: {fontSize: 11, fontWeight: '500', marginTop: 6},
  navLabelActive: {fontWeight: '700'},
});
