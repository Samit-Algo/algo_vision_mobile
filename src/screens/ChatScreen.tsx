import React, {useState, useRef, useCallback, useEffect} from 'react';
import {View, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Message, Attachment, type ChatMode} from '../types/chat';
import ChatBubble from '../components/chat/ChatBubble';
import TypingIndicator from '../components/chat/TypingIndicator';
import SuggestionChips from '../components/chat/SuggestionChips';
import AttachmentPreview from '../components/chat/AttachmentPreview';
import ChatInput from '../components/chat/ChatInput';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {
  assistantTextFromGeneralResponse,
  chatApi,
  structuredAssistantMessage,
} from '../services/api';

export default function ChatScreen() {
  const {colors, isDark} = useTheme();
  const {user} = useAuth();

  const [messages,           setMessages]           = useState<Message[]>([]);
  const [isTyping,           setIsTyping]           = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  /** Ask mode ↔ general-chat; Agent mode ↔ /api/v1/chat — separate sessions. */
  const [askSessionId,       setAskSessionId]       = useState<string | undefined>();
  const [agentSessionId,     setAgentSessionId]     = useState<string | undefined>();
  const [chatMode,           setChatMode]           = useState<ChatMode>('ask');
  const [resumeMessageId,    setResumeMessageId]    = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 80);
  }, []);

  // ── Upsert a message (add or update by id) ─────────────────────────────────
  const upsertMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msg.id);
      if (idx === -1) {return [...prev, msg];}
      const next = [...prev];
      next[idx] = msg;
      return next;
    });
    scrollToBottom();
  }, [scrollToBottom]);

  // ── Send: Ask → general-chat; Agent → POST /api/v1/chat/message (non-stream) ──
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const hasAttachments = pendingAttachments.length > 0;
      const safeMessage = trimmed ? text : (hasAttachments ? ' ' : text);

      const userMsg: Message = {
        id:          `u-${Date.now()}`,
        role:        'user',
        content:     trimmed,
        timestamp:   new Date(),
        attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      };
      upsertMessage(userMsg);
      setPendingAttachments([]);
      setIsTyping(true);

      const aiId = `a-${Date.now()}`;

      try {
        const sessionIdForMode =
          chatMode === 'ask' ? askSessionId : agentSessionId;

        const res =
          chatMode === 'ask'
            ? await chatApi.sendGeneral({
                message: safeMessage,
                session_id: sessionIdForMode,
              })
            : await chatApi.sendAgent({
                message: safeMessage,
                session_id: sessionIdForMode,
              });

        if (res.session_id) {
          if (chatMode === 'ask') {
            setAskSessionId(res.session_id);
          } else {
            setAgentSessionId(res.session_id);
          }
        }

        const replyText = assistantTextFromGeneralResponse(res);
        const structured = structuredAssistantMessage(res);
        upsertMessage({
          id: aiId,
          role: 'assistant',
          content: replyText,
          timestamp: new Date(),
          ...structured,
          ...(chatMode === 'agent' ? {agentEnvelope: res} : {}),
        });
        scrollToBottom();
      } catch (err: any) {
        console.error('[ChatSend]', err?.message ?? err);
        const errMsg = 'Sorry, something went wrong. Please try again.';
        upsertMessage({
          id:          aiId,
          role:        'assistant',
          content:     errMsg,
          isError:     true,
          timestamp:   new Date(),
        });
      } finally {
        setIsTyping(false);
      }
    },
    [
      pendingAttachments,
      askSessionId,
      agentSessionId,
      chatMode,
      upsertMessage,
      scrollToBottom,
    ],
  );

  const handleVoiceResult = useCallback((text: string) => sendMessage(text), [sendMessage]);

  /** HITL: Approve / Reject — same resume payload as `layout/chatbot-core.js` (non-stream). */
  const handleAgentResume = useCallback(
    async (messageId: string, decision: 'approve' | 'reject') => {
      if (chatMode !== 'agent') {
        return;
      }
      const sid =
        messagesRef.current.find(m => m.id === messageId)?.agentEnvelope?.session_id ??
        agentSessionId;
      if (!sid) {
        console.warn('[Chat] resume missing session_id');
        return;
      }
      setResumeMessageId(messageId);
      setIsTyping(true);
      try {
        const res = await chatApi.sendAgent({
          message: '',
          session_id: sid,
          resume: {decisions: [{type: decision}]},
        });
        if (res.session_id) {
          setAgentSessionId(res.session_id);
        }
        const replyText = assistantTextFromGeneralResponse(res);
        const structured = structuredAssistantMessage(res);
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  content: replyText,
                  ...structured,
                  agentEnvelope: res,
                  isError: false,
                }
              : m,
          ),
        );
        scrollToBottom();
      } catch (err: any) {
        console.error('[ChatResume]', err?.message ?? err);
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  content: 'Could not complete approval. Please try again.',
                  isError: true,
                  agentEnvelope: undefined,
                  contentBlocks: undefined,
                  evidence: undefined,
                }
              : m,
          ),
        );
      } finally {
        setIsTyping(false);
        setResumeMessageId(null);
      }
    },
    [agentSessionId, chatMode, scrollToBottom],
  );

  /** Zone HITL — same resume shape as `layout/chatbot-zone-editor.js` + `chatbot-core.js`. */
  const handleAgentZoneSave = useCallback(
    async (messageId: string, zoneData: unknown) => {
      if (chatMode !== 'agent') {
        return;
      }
      const sid =
        messagesRef.current.find(m => m.id === messageId)?.agentEnvelope?.session_id ??
        agentSessionId;
      if (!sid) {
        console.warn('[Chat] zone resume missing session_id');
        return;
      }
      setResumeMessageId(messageId);
      setIsTyping(true);
      try {
        const res = await chatApi.sendAgent({
          message: '',
          session_id: sid,
          resume: {decisions: [{type: 'approve', zone: zoneData}]},
        });
        if (res.session_id) {
          setAgentSessionId(res.session_id);
        }
        const replyText = assistantTextFromGeneralResponse(res);
        const structured = structuredAssistantMessage(res);
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  content: replyText,
                  ...structured,
                  agentEnvelope: res,
                  isError: false,
                }
              : m,
          ),
        );
        scrollToBottom();
      } catch (err: any) {
        console.error('[ChatZoneResume]', err?.message ?? err);
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  content: 'Could not apply zone. Please try again.',
                  isError: true,
                  contentBlocks: undefined,
                  evidence: undefined,
                }
              : m,
          ),
        );
      } finally {
        setIsTyping(false);
        setResumeMessageId(null);
      }
    },
    [agentSessionId, chatMode, scrollToBottom],
  );

  const handleAttachmentPick = (kind: 'image' | 'video' | 'file') => {
    const type: Attachment['type'] =
      kind === 'file' ? 'file' : kind === 'video' ? 'video' : 'image';
    addMockAttachment(type);
  };

  const addMockAttachment = (type: Attachment['type']) => {
    const names: Record<string, string> = {
      image: 'photo_capture.jpg',
      video: 'camera_recording.mp4',
      file:  'report.pdf',
    };
    setPendingAttachments(prev => [
      ...prev,
      {id: Date.now().toString(), type, name: names[type], uri: ''},
    ]);
  };

  const removeAttachment = (id: string) =>
    setPendingAttachments(prev => prev.filter(a => a.id !== id));

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: isDark ? colors.bg : '#ffffff'}]}
      edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {isEmpty ? (
          <View style={styles.flex}>
            <SuggestionChips onSelect={sendMessage} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <ChatBubble
                message={item}
                onAgentResume={handleAgentResume}
                onAgentZoneSave={handleAgentZoneSave}
                resumeBusy={resumeMessageId === item.id}
              />
            )}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          />
        )}

        <AttachmentPreview
          attachments={pendingAttachments}
          onRemove={removeAttachment}
        />

        <ChatInput
          onSend={sendMessage}
          onAttachmentPick={handleAttachmentPick}
          onVoiceResult={handleVoiceResult}
          disabled={isTyping}
          pendingAttachments={pendingAttachments}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  flex: {flex: 1},
  // Leave room so the shared bottom footer + chat input never overlap.
  messageList: {paddingTop: 16, paddingBottom: 130},
});
