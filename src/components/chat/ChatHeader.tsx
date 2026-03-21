import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../../context/ThemeContext';

interface Props {
  onNewChat: () => void;
}

export default function ChatHeader({onNewChat}: Props) {
  const navigation = useNavigation();
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.headerBg, borderBottomColor: colors.headerBorder},
      ]}>
      <TouchableOpacity
        style={[styles.backBtn, {backgroundColor: colors.headerIconBg}]}
        onPress={() => navigation.goBack()}>
        <Text style={[styles.backIcon, {color: colors.headerText}]}>←</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={[styles.title, {color: colors.headerText}]}>AlgoVision AI</Text>
        <View style={styles.modelBadge}>
          <View style={styles.onlineDot} />
          <Text style={[styles.modelText, {color: colors.headerSub}]}>
            Vision Agent
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.newChatBtn, {backgroundColor: colors.headerIconBg}]}
        onPress={onNewChat}>
        <Text style={styles.newChatIcon}>✏️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0bb07b',
  },
  modelText: {
    fontSize: 11,
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatIcon: {
    fontSize: 16,
  },
});
