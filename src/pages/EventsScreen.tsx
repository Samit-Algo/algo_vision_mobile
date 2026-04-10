import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../context/ThemeContext';
import type {RootStackParamList} from '../navigation/types';
import {eventsApi, getToken, AppEvent, EventRange} from '../api';

type SeverityFilter = 'all' | 'high' | 'medium' | 'info';

export default function EventsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {colors} = useTheme();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>([]);

  // “No filter” initial state
  const [range, setRange] = useState<EventRange>('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [openFilter, setOpenFilter] = useState<null | 'date' | 'severity'>(null);

  useEffect(() => {
    let mounted = true;
    getToken()
      .then(t => {
        if (mounted) {setAuthToken(t);}
      })
      .catch(() => {});
    return () => {mounted = false;};
  }, []);

  const fetchEvents = useCallback(
    async (r: EventRange, mode: 'initial' | 'refresh' = 'initial') => {
      try {
        if (mode === 'initial') {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        const list = await eventsApi.list(r, 200, 0);
        setEvents(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Events fetch error:', err);
        setEvents([]);
      } finally {
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    fetchEvents(range, 'initial');
  }, [range, fetchEvents]);

  const eventsFiltered = useMemo(() => {
    const sorted = events
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (severity === 'all') {return sorted;}
    const s = String(severity).toLowerCase();
    return sorted.filter(e => String(e.severity).toLowerCase() === s);
  }, [events, severity]);

  const dateChips: Array<{key: EventRange; label: string}> = [
    {key: 'all', label: 'All'},
    {key: 'today', label: 'Today'},
    {key: 'yesterday', label: 'Yesterday'},
  ];

  const sevChips: Array<{key: SeverityFilter; label: string}> = [
    {key: 'all', label: 'All'},
    {key: 'high', label: 'High'},
    {key: 'medium', label: 'Medium'},
    {key: 'info', label: 'Info'},
  ];

  const selectedDateLabel = dateChips.find(c => c.key === range)?.label ?? 'All';
  const selectedSeverityLabel = sevChips.find(c => c.key === severity)?.label ?? 'All';

  const sevColor = (sev: string) => {
    const s = String(sev).toLowerCase();
    if (s === 'high') {return {dot: colors.danger, text: colors.danger};}
    if (s === 'medium') {return {dot: colors.warning, text: colors.warning};}
    return {dot: colors.success, text: colors.success};
  };

  const FilterDropdown = ({
    title,
    selectedLabel,
    options,
    open,
    onToggle,
    onSelect,
  }: {
    title: string;
    selectedLabel: string;
    options: Array<{key: any; label: string}>;
    open: boolean;
    onToggle: () => void;
    onSelect: (key: any) => void;
  }) => {
    return (
      <View style={s.dropdownWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            s.dropdownHeader,
            {borderColor: colors.inputBorder, backgroundColor: colors.inputBg},
          ]}
          onPress={onToggle}>
          <View style={s.dropdownLabelRow}>
            <Text style={[s.dropdownTitleInline, {color: colors.subText}]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[s.dropdownSep, {color: colors.muted}]}> · </Text>
            <Text style={[s.dropdownValueInline, {color: colors.text}]} numberOfLines={1}>
              {selectedLabel}
            </Text>
          </View>
          <Text style={[s.dropdownCaret, {color: colors.subText}]}>
            {open ? '▾' : '▸'}
          </Text>
        </TouchableOpacity>

        {open && (
          <View
            style={[
              s.dropdownMenu,
              {borderColor: colors.cardBorder, backgroundColor: colors.card},
            ]}>
            {options.map(opt => (
              <TouchableOpacity
                key={String(opt.key)}
                style={s.dropdownItem}
                onPress={() => onSelect(opt.key)}>
                <Text style={[s.dropdownItemText, {color: colors.text}]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[s.safe, {backgroundColor: colors.bg}]}
      edges={['left', 'right']}>
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEvents(range, 'refresh')}
            tintColor={colors.accent}
            colors={Platform.OS === 'android' ? [colors.accent] : undefined}
          />
        }>

        <View style={s.filtersRow}>
          <FilterDropdown
            title="Date"
            selectedLabel={selectedDateLabel}
            options={dateChips.map(c => ({key: c.key, label: c.label}))}
            open={openFilter === 'date'}
            onToggle={() => setOpenFilter(v => (v === 'date' ? null : 'date'))}
            onSelect={k => {
              setRange(k as EventRange);
              setOpenFilter(null);
            }}
          />

          <FilterDropdown
            title="Severity"
            selectedLabel={selectedSeverityLabel}
            options={sevChips.map(c => ({key: c.key, label: c.label}))}
            open={openFilter === 'severity'}
            onToggle={() => setOpenFilter(v => (v === 'severity' ? null : 'severity'))}
            onSelect={k => {
              setSeverity(k as SeverityFilter);
              setOpenFilter(null);
            }}
          />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : eventsFiltered.length === 0 ? (
          <Text style={[s.emptyText, {color: colors.muted}]}>No events found</Text>
        ) : (
          eventsFiltered.map(ev => {
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
                  s.row,
                  {backgroundColor: colors.card, borderColor: colors.cardBorder, borderLeftColor: sc.dot},
                ]}>
                <View style={s.rowBody}>
                  <View style={{flex: 1}}>
                    <Text style={[s.rowTitle, {color: colors.text}]} numberOfLines={1}>
                      {ev.event_type}
                    </Text>
                    <Text style={[s.rowSub, {color: colors.subText}]} numberOfLines={1}>
                      Camera: {ev.camera_id ?? ev.camera_name ?? '—'}
                    </Text>
                    <Text style={[s.rowTime, {color: colors.muted}]}>
                      {new Date(ev.timestamp).toLocaleString([], {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'})}
                    </Text>
                  </View>

                  <View style={s.rightThumb}>
                    {thumbSrc ? (
                      <Image source={thumbSrc} style={s.thumb} />
                    ) : (
                      <View style={[s.thumb, {backgroundColor: colors.inputBorder}]} />
                    )}
                  </View>
                </View>

                <Text style={[s.severityPillText, {color: sc.text}]}>
                  {String(ev.severity).toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1},
  scroll: {paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 30},
  emptyText: {paddingVertical: 20, textAlign: 'center', fontWeight: '600'},

  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
    zIndex: 2,
  },
  dropdownWrap: {flex: 1},
  dropdownHeader: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  dropdownTitleInline: {fontWeight: '800', textTransform: 'uppercase', fontSize: 10},
  dropdownSep: {fontSize: 12, fontWeight: '700'},
  dropdownValueInline: {fontSize: 13, fontWeight: '800', flexShrink: 1},
  dropdownCaret: {fontSize: 12, fontWeight: '900'},
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {paddingHorizontal: 14, paddingVertical: 12},
  dropdownItemText: {fontSize: 13, fontWeight: '800'},

  row: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {fontSize: 14, fontWeight: '800'},
  rowSub: {fontSize: 12, fontWeight: '600', marginTop: 4},
  rowTime: {fontSize: 11, fontWeight: '600', marginTop: 6},
  rightThumb: {alignItems: 'flex-end', justifyContent: 'center'},
  thumb: {width: 56, height: 40, borderRadius: 10},
  severityPillText: {marginTop: 10, fontSize: 11, fontWeight: '900', textTransform: 'uppercase'},

});

