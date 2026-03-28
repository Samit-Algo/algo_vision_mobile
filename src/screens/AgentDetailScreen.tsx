import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../context/ThemeContext';
import {
  agentsApi,
  AgentDetailResponse,
  ApiError,
} from '../services/api';
import type {RootStackParamList} from '../navigation/types';
import {getAgentControlUi} from '../utils/agentControls';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AgentDetail'>;

function formatTs(iso?: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function Row({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: {text: string; subText: string};
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, {color: colors.subText}]}>{label}</Text>
      <Text style={[styles.rowValue, {color: colors.text}]} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function AgentDetailScreen() {
  const {colors} = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'AgentDetail'>>();
  const {agentId} = route.params;

  const [detail, setDetail] = useState<AgentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  /** `refresh` = pull-to-refresh or after pause/stop/resume — keeps content on screen. */
  const fetchDetail = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const d = await agentsApi.get(agentId);
        setDetail(d);
      } catch (e) {
        const msg =
          e instanceof ApiError ? String(e.message) : 'Could not load agent';
        setError(msg);
        if (mode === 'initial') {
          setDetail(null);
        }
      } finally {
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [agentId],
  );

  useEffect(() => {
    fetchDetail('initial');
  }, [fetchDetail]);

  const id = detail?.id ?? agentId;
  const control = getAgentControlUi(detail?.status);

  const runStop = useCallback(async () => {
    if (!id) {
      return;
    }
    setActionBusy(true);
    try {
      await agentsApi.stop(id, {
        agentSource:
          detail?.agent_source === 'workflow' ? 'workflow' : undefined,
      });
      await fetchDetail('refresh');
    } catch (e) {
      const msg =
        e instanceof ApiError ? String(e.message) : 'Stop failed';
      Alert.alert('Stop', msg);
    } finally {
      setActionBusy(false);
    }
  }, [id, detail?.agent_source, fetchDetail]);

  const runPause = useCallback(async () => {
    if (!id) {
      return;
    }
    setActionBusy(true);
    try {
      await agentsApi.pause(id);
      await fetchDetail('refresh');
    } catch (e) {
      const msg =
        e instanceof ApiError ? String(e.message) : 'Pause failed';
      Alert.alert('Pause', msg);
    } finally {
      setActionBusy(false);
    }
  }, [id, fetchDetail]);

  const runResume = useCallback(async () => {
    if (!id) {
      return;
    }
    setActionBusy(true);
    try {
      await agentsApi.resume(id);
      await fetchDetail('refresh');
    } catch (e) {
      const msg =
        e instanceof ApiError ? String(e.message) : 'Resume failed';
      Alert.alert('Resume', msg);
    } finally {
      setActionBusy(false);
    }
  }, [id, fetchDetail]);

  const confirmStop = () => {
    Alert.alert(
      'Stop agent',
      'This will stop the agent and set it to inactive.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Stop', style: 'destructive', onPress: () => void runStop()},
      ],
    );
  };

  const rulesCount = Array.isArray(detail?.rules) ? detail.rules.length : 0;

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: colors.bg}]}
      edges={['top', 'left', 'right']}>
      <View style={[styles.header, {borderBottomColor: colors.divider}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          style={styles.backBtn}>
          <Text style={[styles.backText, {color: colors.accent}]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]} numberOfLines={1}>
          Agent details
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerPad}>
          <Text style={[styles.errText, {color: colors.danger}]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, {backgroundColor: colors.accent}]}
            onPress={() => fetchDetail('initial')}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : detail ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDetail('refresh')}
              tintColor={colors.accent}
              colors={Platform.OS === 'android' ? [colors.accent] : undefined}
            />
          }>
          <View
            style={[
              styles.card,
              {backgroundColor: colors.card, borderColor: colors.cardBorder},
            ]}>
            <Text style={[styles.title, {color: colors.text}]} numberOfLines={3}>
              {detail.name}
            </Text>
            <Text style={[styles.statusLine, {color: colors.subText}]}>
              Status:{' '}
              <Text style={{color: colors.text, fontWeight: '700'}}>
                {detail.status}
              </Text>
            </Text>

            <Row label="Agent ID" value={String(id)} colors={colors} />
            <Row
              label="Camera"
              value={detail.camera_name ?? detail.camera_id ?? '—'}
              colors={colors}
            />
            <Row label="Camera ID" value={detail.camera_id ?? '—'} colors={colors} />
            <Row label="Model" value={detail.model ?? '—'} colors={colors} />
            <Row
              label="FPS"
              value={detail.fps != null ? String(detail.fps) : '—'}
              colors={colors}
            />
            <Row
              label="Run mode"
              value={detail.run_mode ?? '—'}
              colors={colors}
            />
            <Row
              label="Interval (min)"
              value={
                detail.interval_minutes != null
                  ? String(detail.interval_minutes)
                  : '—'
              }
              colors={colors}
            />
            <Row
              label="Check duration (s)"
              value={
                detail.check_duration_seconds != null
                  ? String(detail.check_duration_seconds)
                  : '—'
              }
              colors={colors}
            />
            <Row
              label="Start"
              value={formatTs(detail.start_time)}
              colors={colors}
            />
            <Row label="End" value={formatTs(detail.end_time)} colors={colors} />
            <Row
              label="Schedule type"
              value={detail.schedule_type ?? '—'}
              colors={colors}
            />
            <Row
              label="Active days"
              value={
                detail.active_days?.length
                  ? detail.active_days.join(', ')
                  : '—'
              }
              colors={colors}
            />
            <Row
              label="Requires zone"
              value={detail.requires_zone ? 'Yes' : 'No'}
              colors={colors}
            />
            <Row
              label="Agent source"
              value={detail.agent_source ?? '—'}
              colors={colors}
            />
            <Row
              label="Workflow ID"
              value={detail.workflow_id ?? '—'}
              colors={colors}
            />
            <Row
              label="Rules"
              value={rulesCount ? `${rulesCount} rule(s)` : '—'}
              colors={colors}
            />
            <Row
              label="Created"
              value={formatTs(detail.created_at)}
              colors={colors}
            />
            <Row
              label="Updated"
              value={formatTs(detail.updated_at)}
              colors={colors}
            />
          </View>

          {control.mode !== 'none' ? (
            <View style={styles.actionsWrap}>
              {control.mode === 'paused_resume_stop' && control.pausedLabel ? (
                <View
                  style={[
                    styles.pausedBanner,
                    {backgroundColor: colors.warningBg, borderColor: colors.warning},
                  ]}>
                  <Text style={[styles.pausedBannerText, {color: colors.warning}]}>
                    {control.pausedLabel}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                {control.mode === 'pause_stop' ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.btnSecondary,
                        {borderColor: colors.accent, opacity: actionBusy ? 0.6 : 1},
                      ]}
                      disabled={actionBusy}
                      onPress={runPause}>
                      <Text style={[styles.btnSecondaryText, {color: colors.accent}]}>
                        Pause
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.btnDanger,
                        {backgroundColor: colors.danger, opacity: actionBusy ? 0.6 : 1},
                      ]}
                      disabled={actionBusy}
                      onPress={confirmStop}>
                      <Text style={styles.btnDangerText}>Stop</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {control.mode === 'paused_resume_stop' ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.btnSecondary,
                        {borderColor: colors.accent, opacity: actionBusy ? 0.6 : 1},
                      ]}
                      disabled={actionBusy}
                      onPress={runResume}>
                      <Text style={[styles.btnSecondaryText, {color: colors.accent}]}>
                        Resume
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.btnDanger,
                        {backgroundColor: colors.danger, opacity: actionBusy ? 0.6 : 1},
                      ]}
                      disabled={actionBusy}
                      onPress={confirmStop}>
                      <Text style={styles.btnDangerText}>Stop</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {paddingVertical: 8, paddingHorizontal: 8},
  backText: {fontSize: 16, fontWeight: '600'},
  headerTitle: {flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700'},
  headerSpacer: {width: 72},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  centerPad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errText: {textAlign: 'center', marginBottom: 16, fontWeight: '600'},
  retryBtn: {paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12},
  retryBtnText: {color: '#fff', fontWeight: '700'},
  scroll: {flex: 1},
  scrollContent: {padding: 16, paddingBottom: 32},
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  title: {fontSize: 20, fontWeight: '800', marginBottom: 6},
  statusLine: {fontSize: 14, marginBottom: 14},
  row: {marginBottom: 12},
  rowLabel: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  rowValue: {fontSize: 14, marginTop: 4, fontWeight: '600'},
  actionsWrap: {marginTop: 16},
  pausedBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  pausedBannerText: {fontSize: 14, fontWeight: '800', textTransform: 'uppercase'},
  actionRow: {flexDirection: 'row', gap: 12},
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  btnSecondaryText: {fontSize: 15, fontWeight: '800'},
  btnDanger: {},
  btnDangerText: {color: '#fff', fontSize: 15, fontWeight: '800'},
});
