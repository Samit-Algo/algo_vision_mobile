import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import {agentsApi, Agent} from '../services/api';

type StatusFilter = 'all' | Agent['status'];

export default function AgentActivityScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {colors} = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [openFilter, setOpenFilter] = useState<null | 'status' | 'type'>(null);

  const fetchAgents = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const {agents: list, total: n} = await agentsApi.listWithTotal();
      setAgents(Array.isArray(list) ? list : []);
      setTotal(typeof n === 'number' ? n : list.length);
    } catch (err) {
      console.warn('Agents list error:', err);
      setAgents([]);
      setTotal(0);
    } finally {
      if (mode === 'initial') {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAgents('initial');
  }, [fetchAgents]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    agents.forEach(a => {
      if (a.type) {
        set.add(a.type);
      }
    });
    return ['all', ...Array.from(set).sort()];
  }, [agents]);

  const filtered = useMemo(() => {
    let rows = agents.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (status !== 'all') {
      rows = rows.filter(a => a.status === status);
    }
    if (typeFilter !== 'all') {
      rows = rows.filter(a => a.type === typeFilter);
    }
    return rows;
  }, [agents, status, typeFilter]);

  const statusChips: Array<{key: StatusFilter; label: string}> = [
    {key: 'all', label: 'All'},
    {key: 'active', label: 'Active'},
    {key: 'paused', label: 'Paused'},
    {key: 'stopped', label: 'Stopped'},
  ];

  const selectedStatusLabel =
    statusChips.find(c => c.key === status)?.label ?? 'All';
  const selectedTypeLabel =
    typeFilter === 'all' ? 'All' : typeFilter;

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
    options: Array<{key: string; label: string}>;
    open: boolean;
    onToggle: () => void;
    onSelect: (key: string) => void;
  }) => (
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

  return (
    <SafeAreaView
      style={[s.safe, {backgroundColor: colors.bg}]}
      edges={['left', 'right']}>
      <Text style={[s.agentsMeta, {color: colors.muted}]}>
        {total} agents
      </Text>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAgents('refresh')}
            tintColor={colors.accent}
            colors={Platform.OS === 'android' ? [colors.accent] : undefined}
          />
        }>
        <View style={s.filtersRow}>
          <FilterDropdown
            title="Status"
            selectedLabel={selectedStatusLabel}
            options={statusChips.map(c => ({key: c.key, label: c.label}))}
            open={openFilter === 'status'}
            onToggle={() =>
              setOpenFilter(v => (v === 'status' ? null : 'status'))
            }
            onSelect={k => {
              setStatus(k as StatusFilter);
              setOpenFilter(null);
            }}
          />
          <FilterDropdown
            title="Type"
            selectedLabel={selectedTypeLabel}
            options={typeOptions.map(t => ({
              key: t,
              label: t === 'all' ? 'All' : t,
            }))}
            open={openFilter === 'type'}
            onToggle={() => setOpenFilter(v => (v === 'type' ? null : 'type'))}
            onSelect={k => {
              setTypeFilter(k);
              setOpenFilter(null);
            }}
          />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <Text style={[s.emptyText, {color: colors.muted}]}>No agents found</Text>
        ) : (
          filtered.map(agent => {
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
                ]}>
                <View style={s.agentBody}>
                  <Text style={[s.agentName, {color: colors.text}]}>{agent.name}</Text>
                  <Text style={[s.agentCamera, {color: colors.subText}]}>
                    {agent.camera_name ?? agent.camera_id ?? 'No camera'}
                  </Text>
                </View>
                <View style={s.agentRight}>
                  <View style={[s.typePill, {backgroundColor: colors.accentBg}]}>
                    <Text style={[s.typePillText, {color: colors.accent}]}>
                      {agent.type}
                    </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1},
  agentsMeta: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scroll: {paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32},
  center: {alignItems: 'center', justifyContent: 'center', paddingVertical: 30},
  emptyText: {paddingVertical: 20, textAlign: 'center', fontWeight: '600'},

  filtersRow: {
    flexDirection: 'row',
    gap: 10,
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
  dropdownItem: {paddingHorizontal: 12, paddingVertical: 10},
  dropdownItemText: {fontSize: 13, fontWeight: '700'},

  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  agentBody: {flex: 1, marginRight: 12},
  agentName: {fontSize: 14, fontWeight: '700'},
  agentCamera: {fontSize: 12, marginTop: 2},
  agentRight: {alignItems: 'flex-end', gap: 6},
  typePill: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  typePillText: {fontSize: 10, fontWeight: '600'},
  statusPill: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  statusPillText: {fontSize: 10, fontWeight: '700', textTransform: 'capitalize'},
});
