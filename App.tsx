import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ThemeProvider} from './src/context/ThemeContext';
import {AuthProvider, useAuth} from './src/context/AuthContext';

import LoginScreen    from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainTabPagerScreen from './src/screens/MainTabPagerScreen';
import CameraLiveScreen from './src/screens/CameraLiveScreen';
import {RootStackParamList} from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Inner navigator — decides stack based on auth state ────────────────────
function RootNavigator() {
  const {token, loading} = useAuth();

  if (loading) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f17'}}>
        <ActivityIndicator color="#4a6cf7" size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {token ? (
        // ── Authenticated ──
        <>
          <Stack.Screen name="MainTabs" component={MainTabPagerScreen} />
          <Stack.Screen name="CameraLive" component={CameraLiveScreen} />
        </>
      ) : (
        // ── Unauthenticated ──
        <>
          <Stack.Screen name="Login"    component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
