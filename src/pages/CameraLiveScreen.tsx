import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Video from 'react-native-video';
import {useTheme} from '../context/ThemeContext';
import AppHeader from '../components/layout/AppHeader';
import BottomNav from '../components/layout/BottomNav';
import {RootStackParamList} from '../navigation/types';
import {getToken, streamsLiveMpegTsUrl} from '../api';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'CameraLive'>;
type Route = RouteProp<RootStackParamList, 'CameraLive'>;

export default function CameraLiveScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<Route>();
  const {cameraId, cameraName} = route.params;
  const {colors, isDark} = useTheme();

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [playError, setPlayError] = useState<string | null>(null);

  const loadToken = useCallback(async () => {
    setTokenLoading(true);
    setPlayError(null);
    try {
      const t = await getToken();
      setToken(t);
    } finally {
      setTokenLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  const title = cameraName?.trim() || 'Live camera';
  const liveUri = token ? streamsLiveMpegTsUrl(cameraId) : null;

  return (
    <SafeAreaView
      style={[s.safe, {backgroundColor: colors.bg}]}
      edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.headerBg}
      />

      <AppHeader notificationCount={0} />

      <View style={[s.subHeader, {borderBottomColor: colors.divider}]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[s.backText, {color: colors.headerText}]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.subHeaderTitle, {color: colors.text}]} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={[s.playerWrap, {backgroundColor: '#000'}]}>
          {tokenLoading ? (
            <View style={s.playerCenter}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : !token ? (
            <View style={s.playerCenter}>
              <Text style={[s.errText, {color: colors.muted}]}>No session. Sign in again.</Text>
            </View>
          ) : liveUri ? (
            <Video
              source={{
                uri: liveUri,
                headers: {Authorization: `Bearer ${token}`},
              }}
              style={s.video}
              controls
              resizeMode="contain"
              paused={false}
              onError={e => {
                const ne = (e as {error?: {errorString?: string; localizedDescription?: string}})?.error;
                const msg = ne?.errorString ?? ne?.localizedDescription ?? 'Playback failed';
                setPlayError(String(msg));
              }}
              onLoad={() => setPlayError(null)}
            />
          ) : null}
        </View>

        {playError ? (
          <Text style={[s.errBanner, {color: colors.danger}]}>{playError}</Text>
        ) : null}

        <View style={[s.card, {backgroundColor: colors.card, borderColor: colors.cardBorder}]}>
          <Text style={[s.label, {color: colors.muted}]}>Camera ID</Text>
          <Text style={[s.value, {color: colors.text}]} selectable>
            {cameraId}
          </Text>
        </View>

        <View style={[s.card, {backgroundColor: colors.card, borderColor: colors.cardBorder}]}>
          <Text style={[s.label, {color: colors.muted}]}>Stream</Text>
          <Text style={[s.hint, {color: colors.subText}]}>
            HTTP MPEG-TS: <Text style={{fontWeight: '800'}}>live.ts</Text> with{' '}
            <Text style={{fontWeight: '800'}}>Authorization: Bearer</Text> on the player (see{' '}
            <Text style={{fontWeight: '800'}}>streamsLiveMpegTsUrl</Text> in api.ts).
          </Text>
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={{backgroundColor: colors.tabBar}}>
        <BottomNav />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1},
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {fontSize: 18, fontWeight: '700'},
  subHeaderTitle: {flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center', marginHorizontal: 8},
  scroll: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24},
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  video: {width: '100%', height: '100%'},
  playerCenter: {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 100},
  errText: {fontSize: 13, padding: 12},
  errBanner: {fontSize: 13, marginBottom: 8, fontWeight: '600'},
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  label: {fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5},
  value: {fontSize: 14, fontWeight: '700', marginTop: 6},
  hint: {fontSize: 13, lineHeight: 20, marginTop: 8},
});
