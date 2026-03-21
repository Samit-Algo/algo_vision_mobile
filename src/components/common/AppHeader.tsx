import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';

interface Props {
  notificationCount?: number;
}

export default function AppHeader({notificationCount = 3}: Props) {
  const {isDark, toggleTheme, colors} = useTheme();
  const {user, logout} = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = useMemo(() => user?.username ?? 'User', [user?.username]);
  const email = useMemo(() => user?.email ?? '', [user?.email]);

  return (
    <View
      style={[
        s.header,
        {backgroundColor: colors.headerBg, borderBottomColor: colors.headerBorder},
      ]}>

      {/* ── Left: username ── */}
      <View style={s.left}>
        <Text style={[s.username, {color: colors.headerText}]} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      {/* ── Right: theme + alerts + profile menu ── */}
      <View style={s.right}>

        {/* Theme toggle */}
        <TouchableOpacity
          style={[s.iconBtn, {backgroundColor: colors.headerIconBg}]}
          onPress={toggleTheme}>
          <Text style={[s.icon, {color: colors.headerText}]}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>

        {/* Alerts / Notifications */}
        <TouchableOpacity style={[s.iconBtn, {backgroundColor: colors.headerIconBg}]}>
          <Text style={[s.icon, {color: colors.headerText}]}>🔔</Text>
          {notificationCount > 0 && (
            <View style={[s.badge, {borderColor: colors.headerBg}]}>
              <Text style={[s.badgeText, {color: colors.headerText}]}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile avatar + dropdown */}
        <View style={s.profileWrap}>
          <TouchableOpacity
            style={[s.avatar, {backgroundColor: colors.headerIconBg}]}
            onPress={() => setMenuOpen(v => !v)}
            activeOpacity={0.85}>
            <Text style={[s.avatarText, {color: colors.headerText}]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>

          {menuOpen && (
            <View
              style={[
                s.menu,
                {backgroundColor: colors.card, borderColor: colors.cardBorder},
              ]}>
              <View style={s.menuHeader}>
                <Text style={[s.menuName, {color: colors.text}]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[s.menuEmail, {color: colors.subText}]} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.menuItem, {borderBottomColor: colors.divider}]}
                onPress={() => {
                  setMenuOpen(false);
                  Alert.alert('Settings', 'Settings screen coming soon.');
                }}>
                <Text style={[s.menuItemText, {color: colors.headerText}]}>
                  Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  logout();
                }}>
                <Text style={[s.menuItemText, {color: colors.danger, fontWeight: '700'}]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10,
    elevation: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    maxWidth: 180,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 15,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  profileWrap: {
    position: 'relative',
    zIndex: 50,
    elevation: 20,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  menu: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 20,
    zIndex: 999,
  },
  menuHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  menuName: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  menuEmail: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  menuItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
