import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  type IconDefinition,
  faHouse,
  faCamera,
  faUserTie,
  faBell,
  faMessage,
} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../../context/ThemeContext';
import {useMainTabOptional} from '../../context/MainTabContext';
import type {MainTabRouteName, RootStackParamList} from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type NavItem = {
  label: string;
  route: MainTabRouteName;
  icon: IconDefinition;
};

const NAV_ITEMS: NavItem[] = [
  {label: 'Home', route: 'Dashboard', icon: faHouse},
  {label: 'Camera', route: 'Cameras', icon: faCamera},
  {label: 'Agents', route: 'AgentActivity', icon: faUserTie},
  {label: 'Events', route: 'Events', icon: faBell},
  {label: 'Chat', route: 'Chat', icon: faMessage},
];

const TAB_LABEL_SIZE = 11;

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
        const tint = isActive ? colors.accent : colors.tabIcon;
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
            <FontAwesomeIcon
              icon={item.icon}
              size={TAB_LABEL_SIZE}
              color={tint}
              style={s.navIcon}
            />
            <Text
              style={[
                s.navLabel,
                {
                  color: tint,
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
  navItem: {flex: 1, alignItems: 'center', paddingTop: 4},
  navIndicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    position: 'absolute',
    top: 0,
  },
  navIcon: {marginTop: 6},
  navLabel: {fontSize: TAB_LABEL_SIZE, fontWeight: '500', marginTop: 4},
  navLabelActive: {fontWeight: '700'},
});
