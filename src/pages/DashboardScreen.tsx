import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../context/ThemeContext';
import type {RootStackParamList} from '../navigation/types';
import {useAuth} from '../context/AuthContext';
import {useMainTabOptional} from '../context/MainTabContext';
import {
  camerasApi,
  agentsApi,
  eventsApi,
  notificationSocket,
  Camera,
  Agent,
  AppEvent,
  WsNotification,
  getToken,
} from '../api';

export default function DashboardScreen() {
  const mainTab = useMainTabOptional();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {colors} = useTheme();
  useAuth(); // ensures auth provider is initialized

  const [cameras,     setCameras]     = useState<Camera[]>([]);
  const [agents,      setAgents]      = useState<Agent[]>([]);
  const [events,      setEvents]      = useState<AppEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [liveAlerts,  setLiveAlerts]  = useState(0);   // WS new-event counter
  const [authToken,  setAuthToken]   = useState<string | null>(null);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [c, a, e] = await Promise.all([
        camerasApi.list(),
        agentsApi.list(),
        // Load all events so we can show the latest 3 even if they are 1-2 days old.
        eventsApi.list('all', 50),
      ]);
      // Normalize (backend may return envelopes like {data: [...]}).
      setCameras(Array.isArray(c) ? c : []);
      setAgents(Array.isArray(a) ? a : []);
      setEvents(Array.isArray(e) ? e : []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  // Needed for thumbnails since <Image> cannot attach Authorization headers.
  useEffect(() => {
    let mounted = true;
    getToken()
      .then(t => { if (mounted) {setAuthToken(t);} })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // ── WebSocket — real-time new event badge ───────────────────────────────────
  useEffect(() => {
    const handler = (n: WsNotification) => {
      if (n.type === 'event' || n.event_id) {
        setLiveAlerts(p => p + 1);
        // Prepend to events list
        setEvents(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return [{
            id:          n.event_id ?? String(Date.now()),
            camera_id:   '',
            camera_name: n.camera_name,
            event_type:  n.event_type ?? 'Unknown',
            severity:    (n.severity as AppEvent['severity']) ?? 'low',
            timestamp:   n.timestamp ?? new Date().toISOString(),
            description: n.message,
          }, ...safePrev.slice(0, 49)];
        });
      }
    };
    // Guard against stale bundles / unexpected runtime shape.
    // IMPORTANT: call as `notificationSocket.addListener(...)` to preserve `this`.
    if (typeof (notificationSocket as any)?.addListener === 'function') {
      notificationSocket.addListener(handler);
      return () => {
        if (typeof (notificationSocket as any)?.removeListener === 'function') {
          notificationSocket.removeListener(handler);
        }
      };
    }

    console.warn('notificationSocket.addListener is not available');
    return undefined;
  }, []);

  useEffect(() => {
    mainTab?.setDashboardLiveAlerts(liveAlerts);
  }, [liveAlerts, mainTab]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const safeEvents: AppEvent[] = Array.isArray(events) ? events : [];
  // Latest 3 events by timestamp (newest first)
  const eventsToShow: AppEvent[] = safeEvents
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    })
    .slice(0, 3);
  const liveCams     = cameras.filter(c => c.status === 'live').length;
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const isToday = (ts: string) => {
    const d = new Date(ts);
    const n = new Date();
    return (
      d.getFullYear() === n.getFullYear() &&
      d.getMonth() === n.getMonth() &&
      d.getDate() === n.getDate()
    );
  };
  const todayAlerts  = safeEvents.filter(ev => isToday(ev.timestamp)).length + liveAlerts;

  const STATS = [
    {label: 'Cameras',       value: String(cameras.length || '--'), colorKey: 'accent'  as const},
    {label: 'Active Agents', value: String(activeAgents    || '--'), colorKey: 'success' as const},
    {label: 'Alerts Today',  value: String(todayAlerts     || '--'), colorKey: 'warning' as const},
    {label: 'Live Feeds',    value: liveCams ? `${liveCams}/${cameras.length}` : '--', colorKey: 'danger' as const},
  ];

  const sevColor = (sev: string) => {
    const s = String(sev).toLowerCase();
    if (s === 'high' || s === 'critical') {
      return {dot: colors.danger, text: colors.danger};
    }
    if (s === 'medium' || s === 'warning') {
      return {dot: colors.warning, text: colors.warning};
    }
    if (s === 'info') {
      return {dot: colors.accent, text: colors.accent};
    }
    return {dot: colors.success, text: colors.success};
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[s.safe, {backgroundColor: colors.bg}]}
      edges={['left', 'right']}>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" />
      </View>
      ) : (
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={Platform.OS === 'android' ? [colors.accent] : undefined}
            />
          }>

          {/* ── Stats grid ── */}
            <View style={s.statsGrid}>
              {STATS.map(st => (
              <View
                key={st.label}
                style={[s.statCard, {backgroundColor: colors.card, borderColor: colors.cardBorder}]}>
                <View style={[s.statAccent, {backgroundColor: colors[st.colorKey]}]} />
                  <Text style={[s.statValue, {color: colors[st.colorKey]}]}>{st.value}</Text>
                  <Text style={[s.statLabel, {color: colors.subText}]}>{st.label}</Text>
                </View>
              ))}
            </View>

          {/* ── Recent Alerts ── */}
          <View style={[s.sectionHeaderCentered, {borderBottomColor: colors.divider, marginTop: 24}]}>
            <Text style={[s.sectionTitle, {color: colors.text}]}>
              Recent Alerts
              {liveAlerts > 0 && (
                <Text style={{color: colors.danger}}> +{liveAlerts} new</Text>
              )}
            </Text>
                <TouchableOpacity
              onPress={() => {
                // keep badge logic simple: opening full list marks them as seen
                setLiveAlerts(0);
                mainTab?.requestTab('Events');
              }}>
              <Text style={[s.sectionAction, {color: colors.accent}]}>View more</Text>
                </TouchableOpacity>
          </View>
          <View style={s.eventCenterList}>
            {eventsToShow.length === 0 ? (
              <Text style={[s.emptyText, {color: colors.muted}]}>No alerts found</Text>
            ) : (
              eventsToShow.map((ev, i) => {
                const sc = sevColor(ev.severity);
                const thumbSrc =
                  ev.id && ev.has_image && authToken
                    ? eventsApi.imageSourceWithAuth(ev.id, authToken)
                    : null;
                return (
                  <TouchableOpacity
                    key={ev.id}
                    activeOpacity={0.85}
                    disabled={!ev.id}
                    onPress={() =>
                      navigation.navigate('EventDetail', {eventId: ev.id})
                    }
                    style={[
                      s.alertRow,
                      {backgroundColor: colors.card, borderColor: colors.cardBorder},
                      i === eventsToShow.length - 1 && {marginBottom: 0},
                    ]}>
                    <View style={[s.sevDot, {backgroundColor: sc.dot}]} />
                    <View style={s.alertBody}>
                      <Text style={[s.alertEvent, {color: colors.text}]} numberOfLines={1}>
                        {ev.event_type}
                      </Text>
                      <Text style={[s.alertCamera, {color: colors.subText}]}>
                        Camera: {ev.camera_id ?? ev.camera_name ?? '—'}
                      </Text>
                    </View>
                    <View style={s.alertRight}>
                      {thumbSrc ? (
                        <Image source={thumbSrc} style={s.eventThumb} />
                      ) : (
                        <View style={[s.eventThumb, {backgroundColor: colors.inputBorder}]} />
                      )}
                      <Text style={[s.sevLabel, {color: sc.text}]} numberOfLines={1}>
                        {ev.severity.toUpperCase()}
                      </Text>
                      <Text style={[s.alertTime, {color: colors.muted}]} numberOfLines={1}>
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
            </View>
                  </TouchableOpacity>
                );
              })
            )}
            </View>

          {/* ── Active Agents (moved to bottom) ── */}
          <View style={[s.sectionHeader, {borderBottomColor: colors.divider, marginTop: 26}]}>
            <Text style={[s.sectionTitle, {color: colors.text}]}>Active Agents</Text>
              <TouchableOpacity
                onPress={() => mainTab?.requestTab('AgentActivity')}>
              <Text style={[s.sectionAction, {color: colors.accent}]}>View more</Text>
              </TouchableOpacity>
            </View>

          {agents.length === 0 ? (
            <Text style={[s.emptyText, {color: colors.muted}]}>No agents found</Text>
          ) : (
            agents.slice(0, 6).map((agent, i) => {
              const isActive = agent.status === 'active';
              return (
                <TouchableOpacity
                  key={agent.id}
                  activeOpacity={0.85}
                  disabled={!agent.id}
                  onPress={() =>
                    navigation.navigate('AgentDetail', {agentId: agent.id})
                  }
                  style={[
                    s.agentRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      borderLeftColor: isActive ? colors.success : colors.warning,
                    },
                    i === Math.min(agents.length, 6) - 1 && {marginBottom: 0},
                  ]}>
                  <View style={s.agentBody}>
                    <Text style={[s.agentName, {color: colors.text}]}>{agent.name}</Text>
                    <Text style={[s.agentCamera, {color: colors.subText}]}>
                      {agent.camera_name ?? agent.camera_id ?? 'No camera'}
                    </Text>
                  </View>
                  <View style={s.agentRight}>
                    <View style={[s.typePill, {backgroundColor: colors.accentBg}]}>
                      <Text style={[s.typePillText, {color: colors.accent}]}>{agent.type}</Text>
                    </View>
                    <View
                      style={[
                        s.statusPill,
                        {backgroundColor: isActive ? colors.successBg : colors.warningBg},
                      ]}>
                      <Text
                        style={[
                          s.statusPillText,
                          {color: isActive ? colors.success : colors.warning},
                        ]}>
                        {agent.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* (logout is in the topbar menu now) */}

      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scroll: {paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32},

  statsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28},
  statCard: {
    width: '47%', borderRadius: 14, borderWidth: 1, padding: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statAccent: {position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 14, borderTopRightRadius: 14},
  statValue:  {fontSize: 32, fontWeight: '800', marginTop: 14, letterSpacing: -0.5},
  statLabel:  {fontSize: 12, fontWeight: '500', marginTop: 4, letterSpacing: 0.2},

  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 12},
  sectionHeaderCentered: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 12, width: '100%'},
  sectionTitle:  {fontSize: 14, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase'},
  sectionAction: {fontSize: 13, fontWeight: '600'},
  emptyText:     {fontSize: 13, paddingVertical: 12},

  agentRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1,
    borderLeftWidth: 3, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  agentBody:       {flex: 1, marginRight: 12},
  agentName:       {fontSize: 14, fontWeight: '700'},
  agentCamera:     {fontSize: 12, marginTop: 2},
  agentRight:      {alignItems: 'flex-end', gap: 6},
  typePill:        {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  typePillText:    {fontSize: 10, fontWeight: '600'},
  statusPill:      {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  statusPillText:  {fontSize: 10, fontWeight: '700', textTransform: 'capitalize'},

  alertRow: {
    width: '100%',
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  sevDot:    {width: 8, height: 8, borderRadius: 4, marginRight: 12},
  alertBody: {flex: 1},
  alertEvent: {fontSize: 14, fontWeight: '600'},
  alertCamera: {fontSize: 12, marginTop: 2},
  alertRight: {alignItems: 'flex-end', gap: 4},
  eventThumb: {width: 44, height: 28, borderRadius: 8},
  sevLabel:  {fontSize: 10, fontWeight: '800', letterSpacing: 0.5},
  alertTime: {fontSize: 11},
  eventCenterList: {alignItems: 'center', width: '100%'},
});
