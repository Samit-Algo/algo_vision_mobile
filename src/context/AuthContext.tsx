import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  authApi,
  devicesApi,
  notifApi,
  saveToken,
  getToken,
  clearToken,
  setUnauthorizedHandler,
  UserProfile,
  notificationSocket,
} from '../api';
import messaging from '@react-native-firebase/messaging';
import {promptNotificationPermissionAfterLogin} from '../utils/notificationPermission';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthCtx {
  user:    UserProfile | null;
  token:   string | null;
  loading: boolean;
  login:    (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout:   () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => {}, register: async () => {}, logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── After a successful login/register: fetch profile, register FCM, open WS ──
  const afterAuth = useCallback(async (accessToken: string) => {
    await saveToken(accessToken);
    setToken(accessToken);

    // Fetch user profile
    try {
      const profile = await authApi.me();
      setUser(profile);
    } catch {
      console.warn('Could not fetch user profile');
    }

    // Ask for notification permission right after login/register (system dialog + optional Settings prompt)
    await promptNotificationPermissionAfterLogin();

    // Register FCM token with backend
    try {
      const fcmToken = await messaging().getToken();
      await devicesApi.registerFcm(fcmToken);
      await notifApi.enableFcm();
      console.log('FCM registered with backend');
    } catch (e) {
      console.warn('FCM registration failed:', e);
    }

    // Open WebSocket for real-time notifications
    if (typeof (notificationSocket as any)?.connect === 'function') {
      notificationSocket.connect(accessToken);
    } else {
      console.warn('notificationSocket.connect is not available');
    }
  }, []);

  // ── Bootstrap: restore session on app start ───────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (stored) {
          const profile = await authApi.me();   // validates token is still good
          setToken(stored);
          setUser(profile);
          notificationSocket.connect(stored);
        }
      } catch {
        await clearToken();                      // token expired / invalid
      } finally {
        setLoading(false);
      }
    })();

    // Redirect to login on any 401
    setUnauthorizedHandler(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const res = await authApi.login({email, password});
    await afterAuth(res.access_token);
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await authApi.register({full_name: fullName.trim(), email, password});
    await afterAuth(res.access_token);
  };

  const logout = useCallback(() => {
    clearToken();
    notificationSocket.disconnect();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{user, token, loading, login, register, logout}}>
      {children}
    </AuthContext.Provider>
  );
}
