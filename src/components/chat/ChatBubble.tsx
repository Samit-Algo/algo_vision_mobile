import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {Message} from '../../types/chat';
import {useTheme} from '../../context/ThemeContext';
import ChatMarkdownBody from './ChatMarkdownBody';
import ChatContentBlocks from './ChatContentBlocks';
import AgentChatExtras from './AgentChatExtras';

interface Props {
  message: Message;
  onAgentResume?: (messageId: string, decision: 'approve' | 'reject') => void;
  onAgentZoneSave?: (messageId: string, zoneData: unknown) => Promise<void> | void;
  resumeBusy?: boolean;
}

function AttachmentChip({name, type}: {name: string; type: string}) {
  // No emoji: keep attachment labels compact.
  const icon = type === 'image' ? 'IMG' : type === 'video' ? 'VID' : 'DOC';
  return (
    <View style={styles.attachChip}>
      <Text style={styles.attachIcon}>{icon}</Text>
      <Text style={styles.attachName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export default function ChatBubble({
  message,
  onAgentResume,
  onAgentZoneSave,
  resumeBusy,
}: Props) {
  const isUser = message.role === 'user';
  const {colors, isDark} = useTheme();

  // For AI replies: transparent background (only text should be visible).
  const aiBubbleBg = 'transparent';
  const aiTextColor = colors.text;

  const userBubbleBg = isDark ? 'rgba(74,108,247,0.20)' : 'rgba(74,108,247,0.12)';
  const userTextColor = colors.text;

  const useStructuredBlocks =
    message.role === 'assistant' &&
    !message.isError &&
    message.contentBlocks !== undefined &&
    (message.contentBlocks.length > 0 || (message.evidence?.length ?? 0) > 0);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAI]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          {backgroundColor: isUser ? userBubbleBg : aiBubbleBg},
          !isUser && {borderRadius: 0},
        ]}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachments}>
            {message.attachments.map(att =>
              att.type === 'image' ? (
                <Image
                  key={att.id}
                  source={{uri: att.uri}}
                  style={styles.imageAttachment}
                  resizeMode="cover"
                />
              ) : (
                <AttachmentChip key={att.id} name={att.name} type={att.type} />
              ),
            )}
          </View>
        )}

        {/* Assistant: structured blocks (layout parity) or markdown; user/errors: plain text. */}
        {isUser || message.isError ? (
          message.content ? (
            <Text
              style={[
                styles.text,
                isUser ? styles.textUser : styles.textAI,
                {color: isUser ? userTextColor : message.isError ? colors.danger : aiTextColor},
              ]}>
              {message.content}
            </Text>
          ) : null
        ) : useStructuredBlocks ? (
          <ChatContentBlocks blocks={message.contentBlocks!} evidence={message.evidence} />
        ) : message.content ? (
          <ChatMarkdownBody content={message.content} />
        ) : null}

        {message.role === 'assistant' && message.agentEnvelope && !message.isError ? (
          <AgentChatExtras
            envelope={message.agentEnvelope}
            onApprovalDecision={decision => onAgentResume?.(message.id, decision)}
            onZoneSave={zoneData => onAgentZoneSave?.(message.id, zoneData)}
            resumeBusy={resumeBusy}
          />
        ) : null}

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAI: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#4a6cf7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  aiAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 4,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: 'transparent',
    borderBottomRightRadius: 6,
  },
  bubbleAI: {
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  textUser: {
    color: '#ffffff',
  },
  textAI: {
    color: '#1a1a2e',
  },
  attachments: {
    gap: 8,
    marginBottom: 6,
  },
  imageAttachment: {
    width: 200,
    height: 140,
    borderRadius: 10,
  },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  attachIcon: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  attachName: {
    fontSize: 11,
    color: '#fff',
    maxWidth: 140,
    fontWeight: '500',
  },
});
