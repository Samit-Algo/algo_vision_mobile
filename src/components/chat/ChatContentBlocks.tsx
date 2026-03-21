import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import type {GeneralChatContentBlock} from '../../services/api';
import {textFromContentBlock, urlWithAuthForMedia} from '../../services/api';
import {useTheme} from '../../context/ThemeContext';
import ChatMarkdownBody from './ChatMarkdownBody';

interface Props {
  blocks: GeneralChatContentBlock[];
  evidence?: unknown[];
}

function collectMediaUrls(
  blocks: GeneralChatContentBlock[],
  evidence: unknown[] | undefined,
): Set<string> {
  const s = new Set<string>();
  for (const b of blocks) {
    if (!b) {
      continue;
    }
    if ((b.type === 'image' || b.type === 'video' || b.type === 'file') && b.url) {
      s.add(b.url);
    }
    if (b.type === 'table' && Array.isArray(b.rows)) {
      for (const row of b.rows) {
        if (!Array.isArray(row)) {
          continue;
        }
        for (const cell of row) {
          let obj: {type?: string; url?: string} | null = null;
          if (typeof cell === 'string' && cell.trim().startsWith('{')) {
            try {
              obj = JSON.parse(cell) as {type?: string; url?: string};
            } catch {
              obj = null;
            }
          } else if (cell && typeof cell === 'object') {
            obj = cell as {type?: string; url?: string};
          }
          if (obj?.type === 'image' && obj.url) {
            s.add(obj.url);
          }
        }
      }
    }
  }
  for (const e of evidence || []) {
    if (e && typeof e === 'object') {
      const ex = e as {type?: string; url?: string};
      if (ex.type === 'image' && ex.url) {
        s.add(ex.url);
      }
    }
  }
  return s;
}

function parseCell(
  cell: unknown,
): {type: 'image'; url: string; caption?: string} | {type: 'text'; text: string} {
  if (typeof cell === 'string' && cell.trim().startsWith('{')) {
    try {
      const o = JSON.parse(cell) as {type?: string; url?: string; caption?: string};
      if (o?.type === 'image' && o.url) {
        return {type: 'image', url: o.url, caption: o.caption};
      }
    } catch {
      /* fall through */
    }
  }
  if (cell && typeof cell === 'object') {
    const o = cell as {type?: string; url?: string; caption?: string};
    if (o.type === 'image' && o.url) {
      return {type: 'image', url: o.url, caption: o.caption};
    }
  }
  const text = typeof cell === 'string' ? cell : String(cell ?? '');
  return {type: 'text', text: text.replace(/\\n/g, '\n')};
}

export default function ChatContentBlocks({blocks, evidence}: Props) {
  const {colors, isDark} = useTheme();
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  const urlsKey = useMemo(() => {
    const set = collectMediaUrls(blocks, evidence);
    return [...set].sort().join('|');
  }, [blocks, evidence]);

  useEffect(() => {
    let cancelled = false;
    const set = collectMediaUrls(blocks, evidence);
    if (set.size === 0) {
      setUrlMap({});
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const entries = await Promise.all(
        [...set].map(async u => [u, await urlWithAuthForMedia(u)] as const),
      );
      if (!cancelled) {
        setUrlMap(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlsKey]);

  const resolve = (u: string) => urlMap[u] ?? u;

  const evidenceSection = useMemo(() => {
    const list = (evidence || []).filter(
      e => e && typeof e === 'object' && (e as {type?: string}).type === 'image' && (e as {url?: string}).url,
    ) as {type: string; url: string; title?: string; description?: string}[];
    if (!list.length) {
      return null;
    }
    return (
      <View style={styles.evidenceWrap}>
        {list.map((e, i) => (
          <View key={`ev-${i}`} style={[styles.evidenceCard, {borderColor: colors.cardBorder}]}>
            <Image
              source={{uri: resolve(e.url)}}
              style={styles.evidenceImg}
              resizeMode="cover"
            />
            {e.title ? (
              <Text style={[styles.evidenceTitle, {color: colors.text}]}>{e.title}</Text>
            ) : null}
            {e.description ? (
              <Text style={[styles.evidenceDesc, {color: colors.subText}]}>{e.description}</Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  }, [evidence, colors.cardBorder, colors.text, colors.subText, urlMap]);

  return (
    <View>
      {(blocks || []).map((block, i) => {
        if (!block?.type) {
          return null;
        }
        const key = `cb-${i}-${block.type}`;

        switch (block.type) {
          case 'text': {
            const v = textFromContentBlock(block);
            if (!v.trim()) {
              return null;
            }
            return (
              <View key={key} style={styles.block}>
                <ChatMarkdownBody content={v} />
              </View>
            );
          }
          case 'markdown': {
            const v = textFromContentBlock(block);
            if (!v.trim()) {
              return null;
            }
            return (
              <View key={key} style={styles.block}>
                <ChatMarkdownBody content={v} />
              </View>
            );
          }
          case 'image': {
            if (!block.url) {
              return null;
            }
            const cap =
              block.caption ||
              (block.metadata && typeof block.metadata === 'object'
                ? (block.metadata as {label?: string}).label
                : undefined);
            return (
              <View key={key} style={styles.block}>
                <View style={[styles.imageCard, {backgroundColor: isDark ? '#1e1e2e' : '#f0f2fa'}]}>
                  <Image
                    source={{uri: resolve(block.url)}}
                    style={styles.blockImage}
                    resizeMode="contain"
                  />
                  {cap ? (
                    <Text style={[styles.imageCaption, {color: colors.subText}]}>{cap}</Text>
                  ) : null}
                </View>
              </View>
            );
          }
          case 'table': {
            const cols = (block.columns || []) as string[];
            const rows = (block.rows || []) as unknown[][];
            if (!cols.length) {
              return null;
            }
            return (
              <View key={key} style={styles.block}>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={[styles.table, {borderColor: colors.cardBorder}]}>
                    <View style={[styles.tr, styles.trHead, {backgroundColor: isDark ? '#2a2a3c' : '#e8eaf4'}]}>
                      {cols.map((c, j) => (
                        <View key={`h-${j}`} style={[styles.th, {borderColor: colors.cardBorder}]}>
                          <Text style={[styles.thText, {color: colors.text}]} numberOfLines={4}>
                            {String(c)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {rows.map((row, ri) => (
                      <View
                        key={`r-${ri}`}
                        style={[styles.tr, {borderColor: colors.cardBorder, backgroundColor: colors.bg}]}>
                        {row.map((cell, ci) => {
                          const parsed = parseCell(cell);
                          return (
                            <View key={`c-${ci}`} style={[styles.td, {borderColor: colors.cardBorder}]}>
                              {parsed.type === 'image' ? (
                                <Image
                                  source={{uri: resolve(parsed.url)}}
                                  style={styles.cellImg}
                                  resizeMode="contain"
                                />
                              ) : (
                                <ChatMarkdownBody content={parsed.text} />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            );
          }
          case 'chart': {
            const labels = (block.labels || []) as unknown[];
            const values = (block.values || []) as unknown[];
            const rows =
              labels.length > 0
                ? labels.map((lab, idx) => ({lab: String(lab), val: String(values[idx] ?? '')}))
                : values.map((v, idx) => ({lab: String(idx + 1), val: String(v)}));
            return (
              <View key={key} style={styles.block}>
                <View style={[styles.chartBox, {borderColor: colors.cardBorder, backgroundColor: isDark ? '#1e1e2e' : '#f6f7fb'}]}>
                  <Text style={[styles.chartTitle, {color: colors.text}]}>
                    {block.chart_type ? `Chart (${block.chart_type})` : 'Chart'}
                  </Text>
                  {rows.map((row, idx) => (
                    <View key={`ch-${idx}`} style={styles.chartRow}>
                      <Text style={[styles.chartLab, {color: colors.subText}]} numberOfLines={2}>
                        {row.lab}
                      </Text>
                      <Text style={[styles.chartVal, {color: colors.text}]}>{row.val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          }
          case 'code': {
            const v = textFromContentBlock(block);
            if (!v && !block.language) {
              return null;
            }
            return (
              <View key={key} style={styles.block}>
                <View style={[styles.codeBox, {backgroundColor: isDark ? '#1e1e2e' : '#f0f2fa'}]}>
                  {block.language ? (
                    <Text style={[styles.codeLang, {color: colors.subText}]}>{block.language}</Text>
                  ) : null}
                  <Text
                    style={[styles.codeText, {color: colors.text}]}
                    selectable>
                    {v}
                  </Text>
                </View>
              </View>
            );
          }
          case 'diagram': {
            const v = textFromContentBlock(block);
            if (!v.trim()) {
              return null;
            }
            return (
              <View key={key} style={styles.block}>
                <View style={[styles.codeBox, {backgroundColor: isDark ? '#1e1e2e' : '#f0f2fa'}]}>
                  <Text style={[styles.diagHint, {color: colors.subText}]}>Diagram (Mermaid)</Text>
                  <Text style={[styles.codeText, {color: colors.text}]} selectable>
                    {v}
                  </Text>
                </View>
              </View>
            );
          }
          case 'video': {
            if (!block.url) {
              return null;
            }
            const label =
              (block.metadata && typeof block.metadata === 'object'
                ? (block.metadata as {label?: string}).label
                : undefined) || 'Video';
            return (
              <View key={key} style={styles.block}>
                <Text style={[styles.mediaLabel, {color: colors.subText}]}>{label}</Text>
                <Video
                  source={{uri: resolve(block.url)}}
                  style={styles.video}
                  controls
                  resizeMode="contain"
                  paused
                />
              </View>
            );
          }
          case 'file': {
            if (!block.url) {
              return null;
            }
            const name = block.name || 'Download';
            const href = resolve(block.url);
            return (
              <View key={key} style={styles.block}>
                <Pressable onPress={() => Linking.openURL(href)}>
                  <Text style={[styles.fileLink, {color: colors.accent}]}>{name}</Text>
                </Pressable>
              </View>
            );
          }
          default: {
            const v = textFromContentBlock(block);
            if (!v.trim()) {
              return null;
            }
            return (
              <View key={key} style={styles.block}>
                <ChatMarkdownBody content={v} />
              </View>
            );
          }
        }
      })}
      {evidenceSection}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 10,
  },
  imageCard: {
    borderRadius: 10,
    overflow: 'hidden',
    padding: 8,
  },
  blockImage: {
    width: '100%',
    minHeight: 160,
    maxHeight: 280,
    borderRadius: 8,
  },
  imageCaption: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 280,
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trHead: {},
  th: {
    padding: 8,
    minWidth: 88,
    maxWidth: 220,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  thText: {
    fontSize: 12,
    fontWeight: '700',
  },
  td: {
    padding: 6,
    minWidth: 88,
    maxWidth: 220,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-start',
  },
  cellImg: {
    width: 72,
    height: 72,
  },
  chartBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  chartLab: {flex: 1, fontSize: 12},
  chartVal: {fontSize: 12, fontWeight: '600'},
  codeBox: {
    borderRadius: 8,
    padding: 10,
  },
  codeLang: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'lowercase',
  },
  diagHint: {
    fontSize: 11,
    marginBottom: 6,
  },
  codeText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'}),
  },
  mediaLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  video: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  fileLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  evidenceWrap: {
    marginTop: 4,
    gap: 10,
  },
  evidenceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  evidenceImg: {
    width: '100%',
    height: 160,
  },
  evidenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  evidenceDesc: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingTop: 4,
  },
});
