
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  LIGHT_COLORS,
  DARK_COLORS,
  type ThemeColors,
} from '@/constants/colors';

type ThemeContextType = {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setDarkMode: (enabled: boolean) => void;
  loading: boolean;
};

const STORAGE_KEY = 'qr-att-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);

        if (mounted && saved !== null) {
          setIsDark(saved === 'dark');
        }
      } catch (error) {
        console.error('Could not load saved theme:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const setDarkMode = useCallback(async (enabled: boolean) => {
    setIsDark(enabled);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        enabled ? 'dark' : 'light'
      );
    } catch (error) {
      console.error('Could not save theme:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    void setDarkMode(!isDark);
  }, [isDark, setDarkMode]);

  const colors: ThemeColors = isDark
    ? DARK_COLORS
    : LIGHT_COLORS;

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        colors,
        toggleTheme,
        setDarkMode,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useAppTheme must be used inside ThemeProvider'
    );
  }

  return context;
}
