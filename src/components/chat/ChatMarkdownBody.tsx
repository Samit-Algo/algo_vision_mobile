import React, {useMemo} from 'react';
import {Platform, StyleSheet} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {useTheme} from '../../context/ThemeContext';

interface Props {
  content: string;
}

/**
 * Assistant message body: markdown (same idea as `layout/chatbot-markdown.js` in the web app).
 */
export default function ChatMarkdownBody({content}: Props) {
  const {colors, isDark} = useTheme();

  const mdStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: colors.text,
          fontSize: 14,
          lineHeight: 22,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: 8,
        },
        bullet_list: {
          marginBottom: 8,
        },
        ordered_list: {
          marginBottom: 8,
        },
        code_inline: {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          paddingHorizontal: 4,
          borderRadius: 4,
          fontFamily: Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'}),
        },
        fence: {
          backgroundColor: isDark ? '#1e1e2e' : '#f0f2fa',
          padding: 10,
          borderRadius: 8,
          marginVertical: 6,
        },
        link: {
          color: colors.accent,
        },
        strong: {
          fontWeight: '700',
        },
      }),
    [colors.text, colors.accent, isDark],
  );

  return <Markdown style={mdStyles}>{content}</Markdown>;
}
