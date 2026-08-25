import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
}

/** Read theme from localStorage for a given user */
export function loadThemeForUser(userId?: string | null): Theme {
  try {
    if (userId) {
      const userTheme = localStorage.getItem(`theme_${userId}`);
      if (userTheme === 'dark' || userTheme === 'light' || userTheme === 'system') return userTheme;
      // No saved preference for this user — default to light
      return 'light';
    }
  } catch { }
  return 'light';
}

function getInitialUserId(): string | null {
  try {
    const stored = sessionStorage.getItem('currentUser');
    if (stored) return JSON.parse(stored).id;
  } catch { }
  return null;
}

const initialState: ThemeState = {
  theme: loadThemeForUser(getInitialUserId()),
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<{ theme: Theme; userId?: string | null }>) {
      state.theme = action.payload.theme;
      try {
        if (action.payload.userId) {
          localStorage.setItem(`theme_${action.payload.userId}`, action.payload.theme);
        }
      } catch { }
    },
    /** Load the stored theme for a specific user (called on login / user change) */
    loadUserTheme(state, action: PayloadAction<string>) {
      state.theme = loadThemeForUser(action.payload);
    },
    toggleTheme(state, action: PayloadAction<string | undefined>) {
      const resolved = resolveTheme(state.theme);
      state.theme = resolved === 'light' ? 'dark' : 'light';
      try {
        if (action.payload) {
          localStorage.setItem(`theme_${action.payload}`, state.theme);
        }
      } catch { }
    },
  },
});

/** Resolve 'system' to actual light/dark based on OS preference */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/** Apply the resolved theme to the document element */
export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const { setTheme, toggleTheme, loadUserTheme } = themeSlice.actions;
export default themeSlice.reducer;
