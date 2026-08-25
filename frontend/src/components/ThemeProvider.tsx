import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { applyTheme, loadUserTheme } from '../store/slices/themeSlice';

/**
 * Initializes and syncs the theme with the DOM.
 * Loads per-user theme preference when the logged-in user changes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.theme);
  const userId = useAppSelector((state) => state.user.currentUser?.id);

  // Load user-specific theme when user changes (login / switch account)
  useEffect(() => {
    if (userId) {
      dispatch(loadUserTheme(userId));
    }
  }, [userId, dispatch]);

  // Apply on mount and whenever theme preference changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS preference changes when set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return <>{children}</>;
}
