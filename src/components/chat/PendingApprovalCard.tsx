import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type {PendingApprovalPayload} from '../../services/api';
import {useTheme} from '../../context/ThemeContext';

interface Props {
  approval: PendingApprovalPayload | null | undefined;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}

function formatConfigValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '—';
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

/** Mirrors `fieldIconMap` in `layout/chatbot-core.js` — compact ASCII hints (no emoji). */
const FIELD_LABEL: Record<string, string> = {
  fps: 'fps',
  confidence: 'cf',
  run_mode: 'rm',
  alert_cooldown_seconds: 'cd',
  confidence_threshold: 'ct',
  confirm_frames: 'fr',
  detectable_classes: 'dc',
  schedule_type: 'st',
  camera_id: 'cam',
  start_time: 't0',
  end_time: 't1',
  model: 'md',
  zone: 'zn',
  fps_limit: 'fl',
  interval_minutes: 'im',
  check_duration_seconds: 'cs',
};

export default function PendingApprovalCard({
  approval,
  onApprove,
  onReject,
  busy,
}: Props) {
  const {colors, isDark} = useTheme();

  const summary = approval?.summary ?? {};
  const ruleId =
    typeof summary.rule_id === 'string' && summary.rule_id.length > 0
      ? summary.rule_id
      : '—';
  const rawConfig = summary.agent_rule_config;
  const config =
    rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
      ? (rawConfig as Record<string, unknown>)
      : {};
  const configEntries = Object.entries(config);

  const headerBg = isDark ? '#2d3a58' : '#e8ecff';
  const headerAccent = isDark ? '#4a6cf7' : '#4a6cf7';
  const bodyBg = isDark ? '#1a1d2a' : '#f8f9fc';
  const border = isDark ? '#3e4558' : '#d8dce8';
  const sub = colors.subText;

  return (
    <View style={[styles.card, {borderColor: border, backgroundColor: bodyBg}]}>
      <View style={[styles.header, {backgroundColor: headerBg}]}>
        <View style={[styles.headerAccent, {backgroundColor: headerAccent}]} />
        <View style={styles.headerRow}>
          <View style={styles.shieldRing}>
            <Text style={styles.shieldGlyph}>S</Text>
          </View>
          <View style={styles.headerTextCol}>
            <Text style={[styles.title, {color: '#ffffff'}]}>
              Save agent configuration?
            </Text>
            <Text style={[styles.subtitle, {color: 'rgba(255,255,255,0.82)'}]}>
              Review and confirm before the agent starts
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.body, {borderTopColor: border}]}>
        <View style={styles.ruleBlock}>
          <Text style={[styles.sectionLabel, {color: sub}]}>RULE</Text>
          <View style={[styles.ruleBadge, {backgroundColor: `${colors.accent}22`}]}>
            <Text style={[styles.ruleBadgeText, {color: colors.accent}]}>{ruleId}</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, {color: sub, marginTop: 14}]}>CONFIGURATION</Text>
        <View style={[styles.configBox, {borderColor: border}]}>
          {configEntries.length === 0 ? (
            <Text style={[styles.emptyConfig, {color: sub}]}>No configuration</Text>
          ) : (
            configEntries.map(([key, val], idx) => (
              <View
                key={key}
                style={[
                  styles.configRow,
                  {
                    borderBottomColor: border,
                    borderBottomWidth:
                      idx === configEntries.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}>
                <Text style={[styles.rowGlyph, {color: colors.accent}]}>
                  {FIELD_LABEL[key] ?? '•'}
                </Text>
                <Text style={[styles.configKey, {color: colors.text}]} numberOfLines={1}>
                  {key}
                </Text>
                <Text
                  style={[styles.configVal, {color: colors.text}]}
                  selectable
                  numberOfLines={4}>
                  {formatConfigValue(val)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={[styles.footer, {borderTopColor: border}]}>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerLeft]}
          onPress={onReject}
          disabled={busy}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Reject configuration">
          {busy ? (
            <ActivityIndicator size="small" color={sub} />
          ) : (
            <>
              <Text style={[styles.rejectIcon, {color: sub}]}>✕</Text>
              <Text style={[styles.footerBtnText, {color: colors.text}]}>Reject</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={[styles.footerDivider, {backgroundColor: border}]} />
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerRight]}
          onPress={onApprove}
          disabled={busy}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Approve configuration">
          {busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Text style={[styles.approveIcon, {color: colors.accent}]}>✓</Text>
              <Text style={[styles.footerBtnTextApprove, {color: colors.accent}]}>
                Approve
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    paddingBottom: 12,
  },
  headerAccent: {
    height: 3,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
  },
  shieldRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shieldGlyph: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ruleBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ruleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ruleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  configBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  emptyConfig: {
    padding: 12,
    fontSize: 13,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  rowGlyph: {
    width: 28,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  configKey: {
    flex: 0.42,
    fontSize: 12,
    fontWeight: '600',
  },
  configVal: {
    flex: 0.58,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  footerLeft: {},
  footerRight: {},
  footerDivider: {
    width: StyleSheet.hairlineWidth,
  },
  rejectIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  approveIcon: {
    fontSize: 15,
    fontWeight: '800',
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footerBtnTextApprove: {
    fontSize: 15,
    fontWeight: '700',
  },
});
