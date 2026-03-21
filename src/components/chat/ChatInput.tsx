import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import {Attachment, type ChatMode} from '../../types/chat';
import {useTheme} from '../../context/ThemeContext';
import ChatComposerMenu, {type ComposerMenuAnchor} from './ChatComposerMenu';

interface Props {
  onSend: (text: string) => void;
  /** Picked from the + composer menu (Camera, Photos, Video, Files). */
  onAttachmentPick: (kind: 'image' | 'video' | 'file') => void;
  onVoiceResult: (text: string) => void;
  disabled?: boolean;
  pendingAttachments: Attachment[];
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
}

// ─── Inline icon components (no emoji, no external lib) ───────────────────────

function IconMic({color, size = 16}: {color: string; size?: number}) {
  const w = size * 0.44;
  const h = size * 0.6;
  const archW = size * 0.82;
  const archH = size * 0.38;
  const stemH = size * 0.2;
  return (
    <View style={{alignItems: 'center', width: size, height: size + stemH}}>
      <View
        style={{
          width: w,
          height: h,
          borderRadius: w / 2,
          borderWidth: 1.6,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: archW,
          height: archH,
          borderLeftWidth: 1.6,
          borderRightWidth: 1.6,
          borderBottomWidth: 1.6,
          borderColor: color,
          borderTopWidth: 0,
          borderBottomLeftRadius: archW / 2,
          borderBottomRightRadius: archW / 2,
          marginTop: -(h * 0.25),
        }}
      />
      <View style={{width: 1.6, height: stemH, backgroundColor: color}} />
      <View
        style={{
          width: size * 0.5,
          height: 1.6,
          backgroundColor: color,
          marginTop: 0,
        }}
      />
    </View>
  );
}

function IconArrowUp({color, size = 15}: {color: string; size?: number}) {
  return (
    <Text
      style={{
        color,
        fontSize: size * 1.15,
        fontWeight: '300',
        lineHeight: Math.round(size * 1.25),
        marginTop: Platform.OS === 'ios' ? 1 : 0,
        textAlign: 'center',
      }}>
      ↑
    </Text>
  );
}

function IconPlus({color, size = 16}: {color: string; size?: number}) {
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{width: size, height: 1.8, backgroundColor: color, position: 'absolute'}} />
      <View style={{width: 1.8, height: size, backgroundColor: color, position: 'absolute'}} />
    </View>
  );
}

function IconStop({color, size = 12}: {color: string; size?: number}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        backgroundColor: color,
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_ANCHOR: ComposerMenuAnchor = {x: 0, y: 0, width: 44, height: 44};

export default function ChatInput({
  onSend,
  onAttachmentPick,
  onVoiceResult,
  disabled,
  pendingAttachments,
  chatMode,
  onChatModeChange,
}: Props) {
  const {isDark, colors} = useTheme();

  const C = {
    bg: isDark ? '#0f0f17' : '#ffffff',
    inputBg: isDark ? '#1a1a2e' : colors.card,
    border: isDark ? '#2e2e4e' : colors.inputBorder,
    text: isDark ? '#e8e8ff' : colors.text,
    placeholder: isDark ? '#55557a' : colors.muted,
    accent: colors.accent,
    danger: colors.danger,
    muted: isDark ? '#55557a' : colors.subText,
    iconColor: isDark ? '#aab4d4' : colors.subText,
    btnBg: isDark ? '#2a2a3e' : colors.inputBg,
    sendCircle: isDark ? '#ffffff' : '#111111',
    sendIcon: isDark ? '#111111' : '#ffffff',
  };

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<ComposerMenuAnchor>(DEFAULT_ANCHOR);
  const attachRef = useRef<View>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const openComposerMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    attachRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({x, y, width, height});
      setMenuVisible(true);
    });
  }, [disabled]);

  const closeComposerMenu = useCallback(() => setMenuVisible(false), []);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {toValue: 1.15, duration: 600, useNativeDriver: true}),
        Animated.timing(pulseAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
      ]),
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, {toValue: 1, duration: 150, useNativeDriver: true}).start();
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      stopPulse();
      onVoiceResult('Voice input transcription will appear here');
    } else {
      setIsRecording(true);
      startPulse();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (disabled) {
      return;
    }
    if (!trimmed && !hasAttachments) {
      return;
    }
    onSend(trimmed);
    setText('');
  };

  const hasText = text.trim().length > 0;
  const hasAttachments = pendingAttachments.length > 0;
  const hasSendContent = hasText || hasAttachments;

  const placeholderBase = isRecording ? 'Listening...' : 'Message…';
  const modeHint = chatMode === 'ask' ? 'Ask' : 'Agent';
  const placeholder =
    isRecording ? placeholderBase : `${modeHint} · ${placeholderBase}`;

  return (
    <View style={[s.wrapper, {backgroundColor: C.bg}]}>
      <ChatComposerMenu
        visible={menuVisible}
        onClose={closeComposerMenu}
        anchor={menuAnchor}
        chatMode={chatMode}
        onChatModeChange={onChatModeChange}
        onPickAttachment={onAttachmentPick}
      />

      {isRecording && (
        <View style={[s.recordingBar, {backgroundColor: C.inputBg, borderColor: C.danger}]}>
          <View style={[s.recDot, {backgroundColor: C.danger}]} />
          <Text style={[s.recText, {color: C.danger}]}>Listening  —  tap stop when done</Text>
        </View>
      )}

      <View
        style={[
          s.inputRow,
          {
            backgroundColor: C.inputBg,
            borderColor: isRecording ? C.danger : C.border,
          },
        ]}>
        <View ref={attachRef} collapsable={false} style={s.attachHit}>
          <TouchableOpacity
            style={[s.sideBtn, {backgroundColor: C.btnBg}]}
            onPress={openComposerMenu}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open composer menu: mode and attachments">
            <IconPlus color={C.iconColor} size={14} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={[s.input, {color: C.text}]}
          placeholder={placeholder}
          placeholderTextColor={C.placeholder}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          editable={!disabled && !isRecording}
          returnKeyType="default"
        />

        {isRecording ? (
          <TouchableOpacity
            style={[s.sendBtn, {backgroundColor: C.danger}]}
            onPress={toggleRecording}
            disabled={disabled}
            activeOpacity={0.8}>
            <IconStop color="#ffffff" size={11} />
          </TouchableOpacity>
        ) : hasSendContent ? (
          <TouchableOpacity
            style={[
              s.sendCircleBtn,
              {
                backgroundColor: C.sendCircle,
                borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.08)',
              },
            ]}
            onPress={handleSend}
            disabled={disabled}
            activeOpacity={0.85}>
            <IconArrowUp color={C.sendIcon} size={15} />
          </TouchableOpacity>
        ) : (
          <Animated.View style={{transform: [{scale: pulseAnim}]}}>
            <TouchableOpacity
              style={[s.sideBtn, {backgroundColor: C.btnBg}]}
              onPress={toggleRecording}
              disabled={disabled}
              activeOpacity={0.7}>
              <IconMic color={C.iconColor} size={15} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },

  attachHit: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },

  sideBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 36,
    paddingTop: Platform.OS === 'ios' ? 7 : 6,
    paddingBottom: Platform.OS === 'ios' ? 7 : 6,
    paddingHorizontal: 4,
  },

  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  sendCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
