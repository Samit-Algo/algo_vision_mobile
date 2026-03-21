import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import type {ChatMode} from '../../types/chat';

const WIN = Dimensions.get('window');

// ─── Row icons (line art in circle — matches reference pattern) ─────────────

function IconCircle({
  children,
  bg,
}: {
  children: React.ReactNode;
  bg: string;
}) {
  return (
    <View style={[rowStyles.iconCircle, {backgroundColor: bg}]}>
      {children}
    </View>
  );
}

function IconAsk({color}: {color: string}) {
  return (
    <View style={{width: 20, height: 16, justifyContent: 'center'}}>
      <View
        style={{
          width: 16,
          height: 12,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 3,
          bottom: -1,
          width: 5,
          height: 4,
          borderLeftWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: color,
          borderBottomLeftRadius: 2,
          transform: [{rotate: '-10deg'}],
        }}
      />
    </View>
  );
}

function IconAgent({color}: {color: string}) {
  return (
    <Text style={{color, fontSize: 18, fontWeight: '400', lineHeight: 20}}>∞</Text>
  );
}

function IconCamera({color}: {color: string}) {
  return (
    <View style={{width: 20, height: 16, alignItems: 'center', justifyContent: 'center'}}>
      <View
        style={{
          width: 18,
          height: 12,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 2,
          width: 6,
          height: 3,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          borderWidth: 1.5,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

function IconPhotos({color}: {color: string}) {
  return (
    <View style={{width: 18, height: 14, flexDirection: 'row', gap: 3}}>
      <View style={{flex: 1, borderRadius: 2, borderWidth: 1.5, borderColor: color}} />
      <View style={{flex: 1, borderRadius: 2, borderWidth: 1.5, borderColor: color}} />
    </View>
  );
}

function IconVideo({color}: {color: string}) {
  return (
    <View style={{width: 20, height: 16, alignItems: 'center', justifyContent: 'center'}}>
      <View
        style={{
          width: 16,
          height: 11,
          borderRadius: 2,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderTopWidth: 4,
          borderBottomWidth: 4,
          borderLeftColor: color,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          marginLeft: 2,
        }}
      />
    </View>
  );
}

function IconFiles({color}: {color: string}) {
  return (
    <View style={{width: 16, height: 18, justifyContent: 'center'}}>
      <View style={{width: 12, height: 14, borderWidth: 1.5, borderColor: color, borderRadius: 2}} />
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 4,
          width: 8,
          height: 10,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 1,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}

function IconCheck({color}: {color: string}) {
  return <Text style={{color, fontSize: 15, fontWeight: '700'}}>✓</Text>;
}

// ─── Menu ───────────────────────────────────────────────────────────────────

export interface ComposerMenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  anchor: ComposerMenuAnchor;
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  onPickAttachment: (kind: 'image' | 'video' | 'file') => void;
}

export default function ChatComposerMenu({
  visible,
  onClose,
  anchor,
  chatMode,
  onChatModeChange,
  onPickAttachment,
}: Props) {
  const {isDark, colors} = useTheme();
  const insets = useSafeAreaInsets();

  const T = {
    panel: isDark ? '#2d2d33' : '#ffffff',
    panelBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    iconRing: isDark ? '#3f3f48' : '#e8eaf0',
    label: isDark ? '#f4f4f8' : '#14141c',
    muted: isDark ? '#9898a8' : '#6a6a78',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    rowPress: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    shadow: '#000',
  };

  const iconGlyph = isDark ? '#e8e8f0' : '#2a2a36';

  const openPickMode = useCallback(
    (mode: ChatMode) => {
      onChatModeChange(mode);
      onClose();
    },
    [onChatModeChange, onClose],
  );

  const openAttach = useCallback(
    (kind: 'image' | 'video' | 'file') => {
      onPickAttachment(kind);
      onClose();
    },
    [onPickAttachment, onClose],
  );

  /** Panel sits just above the + control, left-aligned with it. */
  const gap = 10;
  const bottomFromScreenBottom = WIN.height - anchor.y + gap;
  const maxBottom = insets.bottom + 72;
  const panelBottom = Math.max(maxBottom, bottomFromScreenBottom);

  const panelLeft = Math.min(
    Math.max(12, anchor.x - 2),
    WIN.width - 16 - Math.min(300, WIN.width - 24),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={[styles.backdrop, {backgroundColor: 'rgba(0,0,0,0.42)'}]}
          onPress={onClose}
          accessibilityLabel="Close menu"
        />
        <View
          style={[
            styles.panel,
            {
              left: panelLeft,
              bottom: panelBottom,
              width: Math.min(300, WIN.width - 24),
              backgroundColor: T.panel,
              borderColor: T.panelBorder,
              ...Platform.select({
                ios: {
                  shadowColor: T.shadow,
                  shadowOffset: {width: 0, height: 8},
                  shadowOpacity: isDark ? 0.45 : 0.18,
                  shadowRadius: 20,
                },
                android: {elevation: 16},
              }),
            },
          ]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={styles.scroll}>
          <Text style={[styles.sectionHint, {color: T.muted}]}>Mode</Text>
          <MenuRow
            label="Ask"
            subtitle="General assistant"
            icon={
              <IconCircle bg={T.iconRing}>
                <IconAsk color={iconGlyph} />
              </IconCircle>
            }
            selected={chatMode === 'ask'}
            checkColor={colors.accent}
            mutedColor={T.muted}
            labelColor={T.label}
            rowPress={T.rowPress}
            onPress={() => openPickMode('ask')}
          />
          <MenuRow
            label="Agent"
            subtitle="Vision agent & tools"
            icon={
              <IconCircle bg={T.iconRing}>
                <IconAgent color={iconGlyph} />
              </IconCircle>
            }
            selected={chatMode === 'agent'}
            checkColor={colors.accent}
            mutedColor={T.muted}
            labelColor={T.label}
            rowPress={T.rowPress}
            onPress={() => openPickMode('agent')}
          />

          <View style={[styles.divider, {backgroundColor: T.divider}]} />

          <Text style={[styles.sectionHint, {color: T.muted, marginTop: 2}]}>Attach</Text>
          <MenuRow
            label="Camera"
            subtitle="Take a photo"
            icon={
              <IconCircle bg={T.iconRing}>
                <IconCamera color={iconGlyph} />
              </IconCircle>
            }
            selected={false}
            checkColor={colors.accent}
            mutedColor={T.muted}
            labelColor={T.label}
            rowPress={T.rowPress}
            onPress={() => openAttach('image')}
          />
          <MenuRow
            label="Photos"
            subtitle="From gallery"
            icon={
              <IconCircle bg={T.iconRing}>
                <IconPhotos color={iconGlyph} />
              </IconCircle>
            }
            selected={false}
            checkColor={colors.accent}
            mutedColor={T.muted}
            labelColor={T.label}
            rowPress={T.rowPress}
            onPress={() => openAttach('image')}
          />
          <MenuRow
            label="Video"
            subtitle="Record or pick clip"
            icon={
              <IconCircle bg={T.iconRing}>
                <IconVideo color={iconGlyph} />
              </IconCircle>
            }
            selected={false}
            checkColor={colors.accent}
            mutedColor={T.muted}
            labelColor={T.label}
            rowPress={T.rowPress}
            onPress={() => openAttach('video')}
          />
          <MenuRow
            label="Files"
            subtitle="Documents & more"
            icon={
              <IconCircle bg={T.iconRing}>
                <IconFiles color={iconGlyph} />
              </IconCircle>
            }
            selected={false}
            checkColor={colors.accent}
            mutedColor={T.muted}
            labelColor={T.label}
            rowPress={T.rowPress}
            onPress={() => openAttach('file')}
            isLast
          />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({
  label,
  subtitle,
  icon,
  selected,
  checkColor,
  mutedColor,
  labelColor,
  rowPress,
  onPress,
  isLast,
}: {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  selected: boolean;
  checkColor: string;
  mutedColor: string;
  labelColor: string;
  rowPress: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <TouchableOpacity
      style={[
        rowStyles.row,
        {backgroundColor: pressed ? rowPress : 'transparent'},
        !isLast && rowStyles.rowSpacing,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected}}>
      {icon}
      <View style={rowStyles.rowText}>
        <Text style={[rowStyles.rowLabel, {color: labelColor}]}>{label}</Text>
        {subtitle ? (
          <Text style={[rowStyles.rowSub, {color: mutedColor}]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {selected ? <IconCheck color={checkColor} /> : <View style={rowStyles.checkSpacer} />}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 12,
  },
  rowSpacing: {
    marginBottom: 2,
  },
  rowText: {
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  checkSpacer: {width: 18},
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 10,
    maxHeight: WIN.height * 0.72,
  },
  scroll: {
    maxHeight: WIN.height * 0.68,
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
    marginHorizontal: 6,
  },
});
