import React, {createContext, useContext, useState} from 'react';

// ─── Color palettes ───────────────────────────────────────────────────────────

const light = {
  // Backgrounds
  bg: '#f0f4ff',
  card: '#ffffff',
  cardBorder: '#eef1ff',
  inputBg: '#f5f7ff',
  inputBorder: '#dde1f0',

  // Text
  text: '#1a1a2e',
  subText: '#555577',
  muted: '#aaaacc',

  // Header (light theme)
  headerBg: '#ffffff',
  headerBorder: '#eef1ff',
  headerIconBg: '#eef1ff',
  headerText: '#1a1a2e',
  headerSub: '#555577',

  // Accent & status
  accent: '#4a6cf7',
  accentBg: '#eef1ff',
  success: '#0bb07b',
  successBg: '#e6f9f4',
  warning: '#f7a44a',
  warningBg: '#fff5e6',
  danger: '#e74c3c',
  dangerBg: '#fdecea',

  // Misc
  divider: '#eef1ff',
  shadow: '#000000',
  tabBar: '#ffffff',
  tabBarBorder: '#eef1ff',
  tabIcon: '#999999',
};

const dark = {
  // Backgrounds
  bg: '#0f0f17',
  card: '#1a1a2e',
  cardBorder: '#2e2e4e',
  inputBg: '#2a2a3e',
  inputBorder: '#3a3a5e',

  // Text
  text: '#e8e8ff',
  subText: '#aab4d4',
  muted: '#55557a',

  // Header
  headerBg: '#0a0a12',
  headerBorder: '#1e1e30',
  headerIconBg: '#1e1e30',
  headerText: '#ffffff',
  headerSub: '#7070a0',

  // Accent & status
  accent: '#4a6cf7',
  accentBg: '#1a1a40',
  success: '#0bb07b',
  successBg: '#0a2a1e',
  warning: '#f7a44a',
  warningBg: '#2a1a0a',
  danger: '#e74c3c',
  dangerBg: '#2a0a0a',

  // Misc
  divider: '#2e2e4e',
  shadow: '#000000',
  tabBar: '#12121e',
  tabBarBorder: '#2e2e4e',
  tabIcon: '#55557a',
};

export type ThemeColors = typeof light;
export type ThemeMode = 'light' | 'dark';

interface ThemeCtx {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: 'light',
  colors: light,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const isDark = mode === 'dark';
  const toggleTheme = () => setMode(m => (m === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{mode, colors: isDark ? dark : light, isDark, toggleTheme}}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
