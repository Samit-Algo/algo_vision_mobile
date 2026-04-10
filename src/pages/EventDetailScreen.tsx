import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../context/ThemeContext';
import {
  eventsApi,
  EventDetailResponse,
  getToken,
  ApiError,
} from '../api';
import type {RootStackParamList} from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EventDetail'>;

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

export default function EventDetailScreen() {
  const {colors} = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'EventDetail'>>();
  const {eventId} = route.params;

  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [t, d] = await Promise.all([getToken(), eventsApi.get(eventId)]);
        setToken(t);
        setDetail(d);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? String(e.message)
            : 'Could not load event';
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
    [eventId],
  );

  useEffect(() => {
    fetchDetail('initial');
  }, [fetchDetail]);

  const sevColor = (sev: string) => {
    const s = String(sev).toLowerCase();
    if (s === 'high' || s === 'critical') {
      return colors.danger;
    }
    if (s === 'medium' || s === 'warning') {
      return colors.warning;
    }
    if (s === 'info') {
      return colors.accent;
    }
    return colors.success;
  };

  const imageSource =
    detail?.has_image && token
      ? eventsApi.imageSourceWithAuth(detail.id, token)
      : null;

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
          Event details
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
          {imageSource ? (
            <View
              style={[
                styles.imageWrap,
                {backgroundColor: colors.card, borderColor: colors.cardBorder},
              ]}>
              <Image
                source={imageSource}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ) : detail.has_image ? (
            <Text style={[styles.muted, {color: colors.muted}]}>
              Image not available (sign in again if this persists).
            </Text>
          ) : (
            <Text style={[styles.muted, {color: colors.muted}]}>
              No image for this event.
            </Text>
          )}

          <View
            style={[
              styles.card,
              {backgroundColor: colors.card, borderColor: colors.cardBorder},
            ]}>
            <Text style={[styles.title, {color: colors.text}]} numberOfLines={3}>
              {detail.label}
            </Text>
            <Text
              style={[
                styles.severityBadge,
                {color: sevColor(detail.severity)},
              ]}>
              {String(detail.severity).toUpperCase()}
            </Text>

            <Row label="Event ID" value={detail.id} colors={colors} />
            <Row label="Session" value={detail.session_id} colors={colors} />
            <Row
              label="Camera"
              value={detail.camera_id ?? '—'}
              colors={colors}
            />
            <Row
              label="Agent"
              value={detail.agent_name ?? detail.agent_id ?? '—'}
              colors={colors}
            />
            <Row
              label="Device"
              value={detail.device_id ?? '—'}
              colors={colors}
            />
            <Row
              label="Event time"
              value={formatTs(detail.event_ts)}
              colors={colors}
            />
            <Row
              label="Received"
              value={formatTs(detail.received_at)}
              colors={colors}
            />
            <Row
              label="Has JSON evidence"
              value={detail.has_json ? 'Yes' : 'No'}
              colors={colors}
            />
            {detail.rule_index != null ? (
              <Row
                label="Rule index"
                value={String(detail.rule_index)}
                colors={colors}
              />
            ) : null}
          </View>
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
  imageWrap: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    minHeight: 200,
  },
  image: {width: '100%', height: 260},
  muted: {marginBottom: 12, fontSize: 13},
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  title: {fontSize: 20, fontWeight: '800', marginBottom: 8},
  severityBadge: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  row: {marginBottom: 12},
  rowLabel: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  rowValue: {fontSize: 14, marginTop: 4, fontWeight: '600'},
});
