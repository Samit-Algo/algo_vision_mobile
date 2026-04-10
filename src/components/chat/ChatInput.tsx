import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import {Attachment, type ChatMode} from '../../types/chat';
import {useTheme} from '../../context/ThemeContext';
import ChatComposerMenu, {type ComposerMenuAnchor} from './ChatComposerMenu';
import VoiceModePanel from './VoiceModeModal';
import {getGeneralChatVoiceStreamUrl, getToken} from '../../api';

const g = globalThis as typeof globalThis & {atob: (s: string) => string; btoa: (s: string) => string};

// ─── PCM helpers (base64 chunk from react-native-audio-record → binary frame) ─

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = g.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function mergeArrayBuffersToBase64(chunks: ArrayBuffer[]): string {
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(new Uint8Array(c), off);
    off += c.byteLength;
  }
  let bin = '';
  for (let i = 0; i < merged.length; i++) {
    bin += String.fromCharCode(merged[i]);
  }
  return g.btoa(bin);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSoundwave({color, size = 16}: {color: string; size?: number}) {
  const bars = [0.45, 0.75, 1.0, 0.75, 0.45];
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 2.5, height: size}}>
      {bars.map((h, i) => (
        <View key={i} style={{width: Math.max(2, size * 0.12), height: size * h, backgroundColor: color, borderRadius: 2}} />
      ))}
    </View>
  );
}

function IconArrowUp({color, size = 15}: {color: string; size?: number}) {
  return (
    <Text style={{color, fontSize: size * 1.15, fontWeight: '300', lineHeight: Math.round(size * 1.25), marginTop: Platform.OS === 'ios' ? 1 : 0, textAlign: 'center'}}>↑</Text>
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
  return <View style={{width: size, height: size, borderRadius: 2, backgroundColor: color}} />;
}

// ─── Permission ───────────────────────────────────────────────────────────────

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {return true;}
  try {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {title: 'Microphone', message: 'Voice input needs microphone access.', buttonPositive: 'Allow', buttonNegative: 'Deny'},
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {return false;}
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onSend:               (text: string) => void;
  onAttachmentPick:     (kind: 'image' | 'video' | 'file') => void;
  /** Server detected speech — create user bubble, return id */
  onVoiceSpeechStart:   () => string;
  onVoicePartialTranscript: (msgId: string, text: string) => void;
  onVoiceFinalTranscript:   (msgId: string, text: string) => void;
  /** Streaming assistant text */
  onVoiceAssistantDelta: (delta: string) => void;
  /** Optional full text from llm_done */
  onVoiceAssistantFinal?: (text: string) => void;
  /** Persist session_id from done */
  onVoiceSessionUpdate: (sessionId: string | undefined) => void;
  onVoiceActiveChange?: (active: boolean) => void;
  disabled?:            boolean;
  pendingAttachments:   Attachment[];
  chatMode:             ChatMode;
  onChatModeChange:     (mode: ChatMode) => void;
  askSessionId?:        string;
}

const DEFAULT_ANCHOR: ComposerMenuAnchor = {x: 0, y: 0, width: 44, height: 44};

type VoiceStatus = 'listening' | 'processing' | 'speaking';

type WsJson = Record<string, unknown>;

function strField(m: WsJson, ...keys: string[]): string {
  for (const k of keys) {
    const v = m[k];
    if (typeof v === 'string' && v.length > 0) {return v;}
  }
  return '';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatInput({
  onSend,
  onAttachmentPick,
  onVoiceSpeechStart,
  onVoicePartialTranscript,
  onVoiceFinalTranscript,
  onVoiceAssistantDelta,
  onVoiceAssistantFinal,
  onVoiceSessionUpdate,
  onVoiceActiveChange,
  disabled,
  pendingAttachments,
  chatMode,
  onChatModeChange,
  askSessionId,
}: Props) {
  const {isDark, colors} = useTheme();

  const C = {
    bg:          isDark ? '#0f0f17' : '#ffffff',
    inputBg:     isDark ? '#1a1a2e' : colors.card,
    border:      isDark ? '#2e2e4e' : colors.inputBorder,
    text:        isDark ? '#e8e8ff' : colors.text,
    placeholder: isDark ? '#55557a' : colors.muted,
    iconColor:   isDark ? '#aab4d4' : colors.subText,
    btnBg:       isDark ? '#2a2a3e' : colors.inputBg,
    sendCircle:  isDark ? '#ffffff' : '#111111',
    sendIcon:    isDark ? '#111111' : '#ffffff',
    danger:      colors.danger,
  };

  const [text,         setText]         = useState('');
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voiceStatus,  setVoiceStatus]  = useState<VoiceStatus>('listening');
  /** True from `tts_start` until playback ends or user taps interrupt — drives "Tap to interrupt" UI. */
  const [micMutedForAssistantTts, setMicMutedForAssistantTts] = useState(false);
  const [ttsUri,       setTtsUri]       = useState<string | null>(null);
  const [menuVisible,  setMenuVisible]  = useState(false);
  const [menuAnchor,   setMenuAnchor]   = useState<ComposerMenuAnchor>(DEFAULT_ANCHOR);
  const attachRef = useRef<View>(null);

  const wsRef                 = useRef<WebSocket | null>(null);
  const dataListener          = useRef<{remove: () => void} | null>(null);
  const conversationActive    = useRef(false);
  const micStreamingRef       = useRef(false);
  const voiceUserBubbleIdRef  = useRef('');
  const ttsBuffersRef         = useRef<ArrayBuffer[]>([]);
  /** True after `tts_start` until TTS playback finishes — avoids `done` forcing "Listening" over "Speaking". */
  const awaitingTtsPlaybackRef = useRef(false);
  const askSessionRef         = useRef(askSessionId);

  const onVoiceSpeechStartRef        = useRef(onVoiceSpeechStart);
  const onVoicePartialTranscriptRef  = useRef(onVoicePartialTranscript);
  const onVoiceFinalTranscriptRef    = useRef(onVoiceFinalTranscript);
  const onVoiceAssistantDeltaRef     = useRef(onVoiceAssistantDelta);
  const onVoiceAssistantFinalRef     = useRef(onVoiceAssistantFinal);
  const onVoiceSessionUpdateRef      = useRef(onVoiceSessionUpdate);
  const onVoiceActiveRef             = useRef(onVoiceActiveChange);

  useEffect(() => { onVoiceSpeechStartRef.current       = onVoiceSpeechStart;       }, [onVoiceSpeechStart]);
  useEffect(() => { onVoicePartialTranscriptRef.current = onVoicePartialTranscript; }, [onVoicePartialTranscript]);
  useEffect(() => { onVoiceFinalTranscriptRef.current   = onVoiceFinalTranscript;   }, [onVoiceFinalTranscript]);
  useEffect(() => { onVoiceAssistantDeltaRef.current    = onVoiceAssistantDelta;    }, [onVoiceAssistantDelta]);
  useEffect(() => { onVoiceAssistantFinalRef.current    = onVoiceAssistantFinal;    }, [onVoiceAssistantFinal]);
  useEffect(() => { onVoiceSessionUpdateRef.current     = onVoiceSessionUpdate;     }, [onVoiceSessionUpdate]);
  useEffect(() => { onVoiceActiveRef.current            = onVoiceActiveChange;      }, [onVoiceActiveChange]);
  useEffect(() => { askSessionRef.current               = askSessionId;             }, [askSessionId]);

  // Raw PCM16 mono 16kHz — required by /general-chat/voice-stream
  useEffect(() => {
    AudioRecord.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      wavFile: '',
    });
  }, []);

  const stopMicStreaming = useCallback(() => {
    dataListener.current?.remove();
    dataListener.current = null;
    try {
      AudioRecord.stop();
    } catch {/* already stopped */}
    micStreamingRef.current = false;
  }, []);

  const closeVoiceSocket = useCallback(() => {
    const w = wsRef.current;
    wsRef.current = null;
    if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) {
      try { w.close(1000, 'Session ended'); } catch {/* noop */}
    }
  }, []);

  const startMicStreaming = useCallback(() => {
    if (micStreamingRef.current) {return;}
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) {return;}
    try {
      AudioRecord.start();
    } catch (e) {
      console.warn('[Voice] AudioRecord.start failed', e);
      return;
    }
    micStreamingRef.current = true;
    const sub = AudioRecord.on('data', (b64: string) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {return;}
      try {
        socket.send(b64ToArrayBuffer(b64));
      } catch (e) {
        console.warn('[Voice] PCM send error', e);
      }
    }) as unknown as {remove: () => void};
    dataListener.current = sub;
  }, []);

  const playTtsFromBuffers = useCallback(async () => {
    const chunks = ttsBuffersRef.current.splice(0, ttsBuffersRef.current.length);
    if (chunks.length === 0) {
      awaitingTtsPlaybackRef.current = false;
      setMicMutedForAssistantTts(false);
      if (conversationActive.current) {
        setVoiceStatus('listening');
        startMicStreaming();
      }
      return;
    }
    try {
      const b64 = mergeArrayBuffersToBase64(chunks);
      const ttsPath = `${RNFS.CachesDirectoryPath}/tts_voice_${Date.now()}.wav`;
      await RNFS.writeFile(ttsPath, b64, 'base64');
      // Some backends may omit `tts_start`; ensure the interrupt UI appears while playing.
      setMicMutedForAssistantTts(true);
      setVoiceStatus('speaking');
      setTtsUri(`file://${ttsPath}`);
    } catch (e) {
      console.warn('[Voice] TTS write error', e);
      awaitingTtsPlaybackRef.current = false;
      setMicMutedForAssistantTts(false);
      setVoiceStatus('listening');
      if (conversationActive.current) {startMicStreaming();}
    }
  }, [startMicStreaming]);

  const handleWsJson = useCallback(
    (msg: WsJson) => {
      const t = typeof msg.type === 'string' ? msg.type : '';
      switch (t) {
        case 'ready':
          setVoiceStatus('listening');
          startMicStreaming();
          break;
        case 'interrupted':
          awaitingTtsPlaybackRef.current = false;
          setMicMutedForAssistantTts(false);
          setTtsUri(null);
          setVoiceStatus('listening');
          ttsBuffersRef.current = [];
          if (conversationActive.current) {startMicStreaming();}
          break;
        case 'speech_start':
          voiceUserBubbleIdRef.current = onVoiceSpeechStartRef.current();
          break;
        case 'partial_stt': {
          const text = strField(msg, 'text');
          if (!text) {break;}
          let id = voiceUserBubbleIdRef.current;
          if (!id) {
            id = onVoiceSpeechStartRef.current();
            voiceUserBubbleIdRef.current = id;
          }
          onVoicePartialTranscriptRef.current(id, text);
          break;
        }
        case 'speech_end':
          setVoiceStatus('processing');
          break;
        case 'final_stt': {
          const text = strField(msg, 'text');
          const id = voiceUserBubbleIdRef.current;
          if (id && text) {
            onVoiceFinalTranscriptRef.current(id, text);
          }
          break;
        }
        case 'llm_token': {
          const delta = strField(msg, 'delta', 'text', 'token', 'content');
          if (delta) {onVoiceAssistantDeltaRef.current(delta);}
          break;
        }
        case 'llm_done': {
          const full = strField(msg, 'text');
          if (full && onVoiceAssistantFinalRef.current) {
            onVoiceAssistantFinalRef.current(full);
          }
          break;
        }
        case 'tts_start':
          ttsBuffersRef.current = [];
          awaitingTtsPlaybackRef.current = true;
          setMicMutedForAssistantTts(true);
          stopMicStreaming(); // stop capture while assistant speaks (tap-to-interrupt unmutes)
          break;
        case 'tts_done':
          void playTtsFromBuffers();
          break;
        case 'done': {
          const sid = msg.session_id;
          onVoiceSessionUpdateRef.current(
            typeof sid === 'string' && sid.length > 0 ? sid : undefined,
          );
          // `done` often arrives before TTS finishes; only go to listening if no audio is playing/queued.
          if (!awaitingTtsPlaybackRef.current) {
            setVoiceStatus('listening');
          }
          break;
        }
        case 'error': {
          const errMsg = strField(msg, 'message', 'detail', 'error');
          if (errMsg) {Alert.alert('Voice', errMsg);}
          awaitingTtsPlaybackRef.current = false;
          setMicMutedForAssistantTts(false);
          setVoiceStatus('listening');
          if (conversationActive.current) {startMicStreaming();}
          break;
        }
        default:
          break;
      }
    },
    [playTtsFromBuffers, startMicStreaming, stopMicStreaming],
  );

  /** Option B: user explicitly stops TTS and resumes sending PCM (server should handle `{type:'interrupt'}`). */
  const userTapInterrupt = useCallback(() => {
    const w = wsRef.current;
    if (w?.readyState === WebSocket.OPEN) {
      try {
        w.send(JSON.stringify({type: 'interrupt'}));
      } catch (e) {
        console.warn('[Voice] interrupt send failed', e);
      }
    }
    awaitingTtsPlaybackRef.current = false;
    setMicMutedForAssistantTts(false);
    ttsBuffersRef.current = [];
    setTtsUri(null);
    setVoiceStatus('listening');
    if (conversationActive.current) {
      startMicStreaming();
    }
  }, [startMicStreaming]);

  const handleWsMessage = useCallback(
    (data: unknown) => {
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data) as WsJson;
          handleWsJson(msg);
        } catch {
          // ignore non-JSON string
        }
        return;
      }
      if (data instanceof ArrayBuffer) {
        if (data.byteLength > 0) {
          ttsBuffersRef.current.push(data);
        }
      }
    },
    [handleWsJson],
  );

  const openComposerMenu = useCallback(() => {
    if (disabled) {return;}
    attachRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({x, y, width, height});
      setMenuVisible(true);
    });
  }, [disabled]);
  const closeComposerMenu = useCallback(() => setMenuVisible(false), []);

  const endConversation = useCallback(() => {
    conversationActive.current = false;
    awaitingTtsPlaybackRef.current = false;
    setMicMutedForAssistantTts(false);
    voiceUserBubbleIdRef.current = '';
    ttsBuffersRef.current = [];
    stopMicStreaming();
    closeVoiceSocket();
    setVoiceVisible(false);
    setVoiceStatus('listening');
    setTtsUri(null);
    onVoiceActiveRef.current?.(false);
  }, [closeVoiceSocket, stopMicStreaming]);

  const endConversationRef = useRef(endConversation);
  useEffect(() => {
    endConversationRef.current = endConversation;
  }, [endConversation]);

  const onTtsEnd = useCallback(() => {
    awaitingTtsPlaybackRef.current = false;
    setMicMutedForAssistantTts(false);
    setTtsUri(null);
    if (conversationActive.current) {
      setVoiceStatus('listening');
      startMicStreaming();
    }
  }, [startMicStreaming]);

  const openVoiceMode = async () => {
    if (disabled) {return;}
    if (chatMode !== 'ask') {
      Alert.alert('Voice', 'Voice assistant is available in Ask mode only.');
      return;
    }
    const ok = await requestMicPermission();
    if (!ok) {
      Alert.alert('Permission denied', 'Microphone access is required for voice input.');
      return;
    }
    const token = await getToken();
    if (!token) {
      Alert.alert('Voice', 'Please sign in to use voice.');
      return;
    }

    conversationActive.current = true;
    awaitingTtsPlaybackRef.current = false;
    setMicMutedForAssistantTts(false);
    voiceUserBubbleIdRef.current = '';
    ttsBuffersRef.current = [];
    setVoiceVisible(true);
    setVoiceStatus('listening');
    onVoiceActiveRef.current?.(true);

    const url = getGeneralChatVoiceStreamUrl(token);
    const ws = new WebSocket(url);
    (ws as unknown as {binaryType: string}).binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      if (!conversationActive.current) {return;}
      try {
        ws.send(
          JSON.stringify({
            type: 'start',
            session_id: askSessionRef.current ?? null,
          }),
        );
      } catch (e) {
        console.warn('[Voice] start send failed', e);
      }
    };

    ws.onmessage = (ev: {data?: string | ArrayBuffer}) => {
      if (!conversationActive.current || ev.data === undefined) {return;}
      handleWsMessage(ev.data);
    };

    ws.onerror = () => {
      if (conversationActive.current) {
        Alert.alert('Voice', 'Connection error.');
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {wsRef.current = null;}
      stopMicStreaming();
      if (conversationActive.current) {
        Alert.alert('Voice', 'Connection closed.');
        endConversationRef.current();
      }
    };
  };

  useEffect(() => {
    return () => {
      conversationActive.current = false;
      stopMicStreaming();
      const w = wsRef.current;
      wsRef.current = null;
      if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) {
        try { w.close(1000, 'unmount'); } catch {/* noop */}
      }
    };
  }, [stopMicStreaming]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (disabled || (!trimmed && pendingAttachments.length === 0)) {return;}
    onSend(trimmed);
    setText('');
  };

  const hasText        = text.trim().length > 0;
  const hasSendContent = hasText || pendingAttachments.length > 0;
  const modeHint       = chatMode === 'ask' ? 'Ask' : 'Agent';

  return (
    <View style={[s.wrapper, {backgroundColor: C.bg}]}>
      {ttsUri && (
        <Video
          source={{uri: ttsUri}}
          style={s.hiddenPlayer}
          playInBackground
          onEnd={onTtsEnd}
          onError={onTtsEnd}
        />
      )}

      <ChatComposerMenu
        visible={menuVisible}
        onClose={closeComposerMenu}
        anchor={menuAnchor}
        chatMode={chatMode}
        onChatModeChange={onChatModeChange}
        onPickAttachment={onAttachmentPick}
      />

      <VoiceModePanel
        visible={voiceVisible}
        status={voiceStatus}
        showInterruptButton={
          micMutedForAssistantTts &&
          (voiceStatus === 'speaking' || voiceStatus === 'processing')
        }
        onInterrupt={userTapInterrupt}
      />

      <View style={[s.inputRow, {backgroundColor: C.inputBg, borderColor: voiceVisible ? '#3a82f0' : C.border}]}>
        <View ref={attachRef} collapsable={false} style={s.attachHit}>
          <TouchableOpacity style={[s.sideBtn, {backgroundColor: C.btnBg}]} onPress={openComposerMenu} disabled={disabled} activeOpacity={0.7}>
            <IconPlus color={C.iconColor} size={14} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={[s.input, {color: C.text}]}
          placeholder={`${modeHint} · Message…`}
          placeholderTextColor={C.placeholder}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          editable={!disabled && !voiceVisible}
          returnKeyType="default"
        />

        {voiceVisible ? (
          <TouchableOpacity
            style={[s.stopBtn, {backgroundColor: C.danger}]}
            onPress={endConversation}
            activeOpacity={0.8}>
            <IconStop color="#ffffff" size={11} />
          </TouchableOpacity>
        ) : hasSendContent ? (
          <TouchableOpacity
            style={[s.sendCircleBtn, {backgroundColor: C.sendCircle, borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.08)'}]}
            onPress={handleSend}
            disabled={disabled}
            activeOpacity={0.85}>
            <IconArrowUp color={C.sendIcon} size={15} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.speakBtn, {backgroundColor: C.sendCircle}]}
            onPress={openVoiceMode}
            disabled={disabled}
            activeOpacity={0.8}>
            <IconSoundwave color={C.sendIcon} size={14} />
            <Text style={[s.speakLabel, {color: C.sendIcon}]}>Speak</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:      {paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 14},
  hiddenPlayer: {width: 0, height: 0, position: 'absolute'},
  inputRow:     {flexDirection: 'row', alignItems: 'flex-end', borderRadius: 16, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8, gap: 8},
  attachHit:    {width: 36, height: 36, flexShrink: 0},
  sideBtn:      {width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  input:        {flex: 1, fontSize: 15, lineHeight: 22, maxHeight: 120, minHeight: 36, paddingTop: Platform.OS === 'ios' ? 7 : 6, paddingBottom: Platform.OS === 'ios' ? 7 : 6, paddingHorizontal: 4},
  speakBtn:     {flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, flexShrink: 0},
  speakLabel:   {fontSize: 14, fontWeight: '600', letterSpacing: 0.1},
  stopBtn:      {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0},
  sendCircleBtn:{width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: StyleSheet.hairlineWidth},
});
