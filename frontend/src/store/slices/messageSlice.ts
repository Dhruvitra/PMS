import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

interface MessageState {
  unreadCounts: Record<string, number>;
  loading: boolean;
  pendingReads: string[]; // Track IDs being marked as read to prevent stale fetch overwrites
  activeChatUserId: string | null; // Currently open DM conversation
}

const initialState: MessageState = {
  unreadCounts: {},
  loading: false,
  pendingReads: [],
  activeChatUserId: null,
};

export const fetchUnreadCounts = createAsyncThunk(
  'message/fetchUnreadCounts',
  async () => {
    const response = await api.get<{ success: boolean; data: Record<string, number> }>('/messages/unread-counts');
    return response.data.data;
  }
);

export const markAsRead = createAsyncThunk(
  'message/markAsRead',
  async (senderId: string, { dispatch }) => {
    dispatch(beginMarkAsRead(senderId)); 
    try {
      // Corrected URL to match backend: /messages/:senderId/read
      await api.post(`/messages/${senderId}/read`);
      return senderId;
    } catch (err) {
      dispatch(endMarkAsRead(senderId));
      throw err;
    }
  }
);

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    beginMarkAsRead: (state, action: PayloadAction<string>) => {
      const senderId = action.payload;
      state.unreadCounts[senderId] = 0;
      if (!state.pendingReads.includes(senderId)) {
        state.pendingReads.push(senderId);
      }
    },
    endMarkAsRead: (state, action: PayloadAction<string>) => {
      state.pendingReads = state.pendingReads.filter(id => id !== action.payload);
    },
    incrementUnread: (state, action: PayloadAction<string>) => {
      const senderId = action.payload;
      // Don't increment if we are actively marking this as read OR if this is the active chat
      if (state.pendingReads.includes(senderId) || state.activeChatUserId === senderId) {
        state.unreadCounts[senderId] = 0;
        return;
      }
      state.unreadCounts[senderId] = (state.unreadCounts[senderId] || 0) + 1;
    },
    resetUnread: (state, action: PayloadAction<string>) => {
      state.unreadCounts[action.payload] = 0;
    },
    setAllUnread: (state, action: PayloadAction<Record<string, number>>) => {
      state.unreadCounts = action.payload;
    },
    setActiveChat: (state, action: PayloadAction<string | null>) => {
      state.activeChatUserId = action.payload;
      if (action.payload) {
        state.unreadCounts[action.payload] = 0;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCounts.fulfilled, (state, action) => {
        const newCounts = { ...action.payload };
        // Force 0 for anything currently being marked as read or active chat
        state.pendingReads.forEach(id => {
          newCounts[id] = 0;
        });
        if (state.activeChatUserId) {
          newCounts[state.activeChatUserId] = 0;
        }
        state.unreadCounts = newCounts;
        state.loading = false;
      })
      .addCase(fetchUnreadCounts.pending, (state) => {
        state.loading = true;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        state.unreadCounts[action.payload] = 0;
        state.pendingReads = state.pendingReads.filter(id => id !== action.payload);
      });
  },
});

export const { 
  incrementUnread, 
  resetUnread, 
  setAllUnread, 
  beginMarkAsRead, 
  endMarkAsRead,
  setActiveChat
} = messageSlice.actions;
export default messageSlice.reducer;
