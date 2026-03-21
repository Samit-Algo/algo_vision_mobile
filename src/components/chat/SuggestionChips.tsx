import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import {Suggestion} from '../../types/chat';
import {useTheme} from '../../context/ThemeContext';

const SUGGESTIONS: Suggestion[] = [
  {id: '1', icon: '📷', label: 'How many cameras are active?'},
  {id: '2', icon: '🤖', label: 'Create a new detection agent'},
  {id: '3', icon: '⚠️', label: 'Show recent alerts'},
  {id: '4', icon: '🎞️', label: 'Analyse uploaded video'},
  {id: '5', icon: '👥', label: 'Count people in warehouse'},
  {id: '6', icon: '🔥', label: 'Detect fire or smoke'},
];

interface Props {
  onSelect: (text: string) => void;
}

export default function SuggestionChips({onSelect}: Props) {
  const {colors} = useTheme();
  return (
    <View style={styles.wrapper}>

      {/* Welcome message — vertically centered */}
      <View style={styles.center}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>AI</Text>
        </View>
        <Text style={[styles.greeting, {color: colors.text}]}>How can I help you?</Text>
        <Text style={[styles.sub, {color: colors.subText}]}>
          Ask about cameras, agents, alerts,{'\n'}or upload a video for analysis.
        </Text>
      </View>

      {/* Suggestion chips — pinned to bottom */}
      <View style={styles.chipsSection}>
        <Text style={[styles.chipsLabel, {color: colors.muted}]}>Suggestions</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>
          {SUGGESTIONS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, {backgroundColor: colors.card, borderColor: colors.cardBorder}]}
              onPress={() => onSelect(s.label)}
              activeOpacity={0.75}>
              <Text style={styles.chipIcon}>{s.icon}</Text>
              <Text style={[styles.chipText, {color: colors.text}]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 8,
  },

  /* ── Center welcome ── */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#4a6cf7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#4a6cf7',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* ── Bottom chips ── */
  chipsSection: {
    paddingBottom: 4,
  },
  chipsLabel: {
    fontSize: 11,
    color: '#bbb',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginLeft: 16,
    marginBottom: 8,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef1ff',
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },
});
