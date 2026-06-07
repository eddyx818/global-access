import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, setStoredTheme, t, THEMES } from '../lib/theme';

const ThemeContext = createContext({
  theme: THEMES.DAY,
  setTheme: () => {},
  toggleTheme: () => {},
  isNight: false,
  t,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    const value = next === THEMES.NIGHT ? THEMES.NIGHT : THEMES.DAY;
    setThemeState(value);
    setStoredTheme(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === THEMES.NIGHT ? THEMES.DAY : THEMES.NIGHT);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      isNight: theme === THEMES.NIGHT,
      t,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
