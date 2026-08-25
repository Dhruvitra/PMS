import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types';

interface UserState {
  currentUser: User | null;
  loading: boolean;
  onlineUsers: string[];
}

function loadUserFromStorage(): User | null {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

const initialState: UserState = {
  currentUser: loadUserFromStorage(),
  loading: false,
  onlineUsers: [],
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.loading = false;
      sessionStorage.setItem('currentUser', JSON.stringify(action.payload));
    },
    clearUser: (state) => {
      state.currentUser = null;
      state.loading = false;
      sessionStorage.removeItem('currentUser');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading, setOnlineUsers } = userSlice.actions;
export default userSlice.reducer;
