import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setTheme, toggleTheme, applyTheme, resolveTheme, type Theme } from '../store/slices/themeSlice';
import api from '../services/api';

export function useTheme() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.theme);
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const userId = currentUser?.id;
  const resolved = resolveTheme(theme);
  const manualOverride = useRef(false);

  // Sync with database settings on initial load (not after manual changes)
  useEffect(() => {
    if (manualOverride.current) {
      manualOverride.current = false;
      return;
    }
    const dbTheme = (currentUser?.settings as any)?.theme;
    if (dbTheme && dbTheme !== theme) {
      dispatch(setTheme({ theme: dbTheme, userId }));
      applyTheme(dbTheme);
    }
  }, [currentUser?.settings]);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS preference changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const saveTheme = async (newTheme: Theme) => {
    try {
      const mergedSettings = {
        ...(currentUser?.settings as any || {}),
        theme: newTheme,
      };
      await api.patch('/users/me', { settings: mergedSettings });
    } catch (err) {
      console.error('Failed to persist theme to backend:', err);
    }
  };

  return {
    theme,
    resolved,
    isDark: resolved === 'dark',
    setTheme: (t: Theme) => {
      manualOverride.current = true;
      dispatch(setTheme({ theme: t, userId }));
      applyTheme(t);
      saveTheme(t);
    },
    toggle: () => {
      manualOverride.current = true;
      const resolvedBefore = resolveTheme(theme);
      const newTheme = resolvedBefore === 'light' ? 'dark' : 'light';
      dispatch(setTheme({ theme: newTheme, userId }));
      applyTheme(newTheme);
      saveTheme(newTheme);
    },
  };
}
