import React, {useCallback, useEffect, useState} from 'react';
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
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../context/ThemeContext';
import {RootStackParamList} from '../navigation/types';
import {camerasApi, Camera} from '../api';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CamerasScreen() {
  const navigation = useNavigation<NavProp>();
  const {colors} = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);

  const fetchCameras = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      try {
        if (mode === 'initial') {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        const list = await camerasApi.list();
        setCameras(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Cameras fetch error:', err);
        setCameras([]);
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
    fetchCameras('initial');
  }, [fetchCameras]);

  const statusMeta = (status: Camera['status']) => {
    if (status === 'live') {
      return {border: colors.success, bg: colors.successBg, text: colors.success};
    }
    if (status === 'paused') {
      return {border: colors.warning, bg: colors.warningBg, text: colors.warning};
    }
    return {border: colors.danger, bg: colors.dangerBg, text: colors.danger};
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
            onRefresh={() => fetchCameras('refresh')}
            tintColor={colors.accent}
            colors={Platform.OS === 'android' ? [colors.accent] : undefined}
          />
        }>
        <View style={[s.sectionHeader, {borderBottomColor: colors.divider}]}>
          <Text style={[s.sectionTitle, {color: colors.text}]}>Cameras</Text>
          <TouchableOpacity onPress={() => fetchCameras('refresh')}>
            <Text style={[s.sectionAction, {color: colors.accent}]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : cameras.length === 0 ? (
          <Text style={[s.emptyText, {color: colors.muted}]}>No cameras found</Text>
        ) : (
          cameras.map((cam, i) => {
            const meta = statusMeta(cam.status);
            const id = String(cam.id ?? '');
            return (
              <TouchableOpacity
                key={cam.id ?? String(i)}
                activeOpacity={0.75}
                style={[
                  s.row,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    borderLeftColor: meta.border,
                  },
                ]}
                onPress={() => {
                  if (!id) {return;}
                  navigation.navigate('CameraLive', {
                    cameraId: id,
                    cameraName: cam.name,
                  });
                }}>
                <View style={s.rowMain}>
                  <Text style={[s.camName, {color: colors.text}]}>
                    {cam.name}
                  </Text>
                  <Text style={[s.camSub, {color: colors.subText}]}>
                    {cam.location ?? cam.stream_url ?? '—'}
                  </Text>
                </View>
                <View style={s.rowRight}>
                  <View style={[s.statusPill, {backgroundColor: meta.bg}]}>
                    <Text style={[s.statusPillText, {color: meta.text}]}>
                      {cam.status}
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
  scroll: {paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40},

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 14, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase'},
  sectionAction: {fontSize: 13, fontWeight: '700'},
  emptyText: {fontSize: 13, paddingVertical: 12},

  row: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: {flex: 1},
  camName: {fontSize: 14, fontWeight: '800'},
  camSub: {fontSize: 12, marginTop: 2},
  rowRight: {alignItems: 'flex-end'},

  statusPill: {borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4},
  statusPillText: {fontSize: 12, fontWeight: '800', textTransform: 'capitalize'},
});

