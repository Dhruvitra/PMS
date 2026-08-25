import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { batchRequests } from '../../services/requestManager';
import { Notification } from '../../types/notification.types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  badgeCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  badgeCount: 0,
  loading: false,
  error: null,
};

// --- Thunks ---

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (orgId?: string) => {
    const params = orgId ? `?orgId=${orgId}` : '';
    const [countRes, notifsRes] = await batchRequests([
      () => api.get<{ success: boolean; data: { count: number } }>(`/notifications/unread-count${params}`),
      () => api.get<{ success: boolean; data: Notification[] }>(`/notifications${params}`),
    ]);
    return {
      unreadCount: countRes.data.data.count,
      notifications: notifsRes.data.data,
    };
  }
);

export const markAsReadAction = createAsyncThunk(
  'notifications/markRead',
  async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    return id;
  }
);

const extractTaskId = (link: string | null | undefined) => {
  if (!link) return null;
  // Match both /tasks/uuid and /inbox/task/uuid
  const match = link.match(/\/(?:tasks|inbox\/task)\/([^/?#]+)/);
  return match ? match[1] : null;
};

export const markTaskAsReadAction = createAsyncThunk(
  'notifications/markTaskRead',
  async (taskId: string) => {
    await api.patch(`/notifications/task/${taskId}/read`);
    return taskId;
  }
);

export const markAllAsReadAction = createAsyncThunk(
  'notifications/markAllRead',
  async (orgId?: string) => {
    const params = orgId ? `?orgId=${orgId}` : '';
    await api.patch(`/notifications/mark-all-read${params}`);
    return;
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Deduplication check: ignore if notification already exists
      const exists = state.notifications.some(n => n.id === action.payload.id);
      if (exists) return;

      state.notifications.unshift(action.payload);
      const lastSeen = parseInt(localStorage.getItem('inbox_last_seen') || '0', 10);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
        if (new Date(action.payload.createdAt).getTime() > lastSeen) {
          state.badgeCount += 1;
        }
      }
    },
    syncReadStatus: (state, action: PayloadAction<{ id: string }>) => {
      const notif = state.notifications.find(n => n.id === action.payload.id);
      if (notif && !notif.isRead) {
        notif.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        const lastSeen = parseInt(localStorage.getItem('inbox_last_seen') || '0', 10);
        if (new Date(notif.createdAt).getTime() > lastSeen) {
          state.badgeCount = Math.max(0, state.badgeCount - 1);
        }
      }
    },
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
    },
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
    markInboxSeen: (state) => {
      // One-time view reset: Clear the badge count but keep total unread count
      state.badgeCount = 0;
      localStorage.setItem('inbox_last_seen', Date.now().toString());
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;

        // Calculate badge count based on last seen
        const lastSeen = parseInt(localStorage.getItem('inbox_last_seen') || '0', 10);
        state.badgeCount = action.payload.notifications.filter(n =>
          !n.isRead && new Date(n.createdAt).getTime() > lastSeen
        ).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notifications';
      })
      .addCase(markAsReadAction.fulfilled, (state, action) => {
        const notif = state.notifications.find(n => n.id === action.payload);
        if (notif && !notif.isRead) {
          notif.isRead = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          const lastSeen = parseInt(localStorage.getItem('inbox_last_seen') || '0', 10);
          if (new Date(notif.createdAt).getTime() > lastSeen) {
            state.badgeCount = Math.max(0, state.badgeCount - 1);
          }
        }
      })
      .addCase(markAllAsReadAction.fulfilled, (state) => {
        state.notifications.forEach(n => n.isRead = true);
        state.unreadCount = 0;
        state.badgeCount = 0;
      })
      .addCase(markTaskAsReadAction.fulfilled, (state, action) => {
        const taskId = action.payload;
        let countReduced = 0;

        state.notifications = state.notifications.map(n => {
          // Check if notification is related to this task
          const notifTaskId = extractTaskId(n.link);
          const isMatch = notifTaskId === taskId;

          if (isMatch && !n.isRead) {
            countReduced++;
            return { ...n, isRead: true };
          }
          return n;
        });

        // Only reduce the count if the unreadCount actually included these newer notifications
        state.unreadCount = Math.max(0, state.unreadCount - countReduced);

        // Recalculate badgeCount for safety or just decrement? Recalculate is safer.
        const lastSeen = parseInt(localStorage.getItem('inbox_last_seen') || '0', 10);
        state.badgeCount = state.notifications.filter(n =>
          !n.isRead && new Date(n.createdAt).getTime() > lastSeen
        ).length;
      });
  },
});

export const { addNotification, syncReadStatus, setNotifications, setUnreadCount, markInboxSeen } = notificationSlice.actions;
export default notificationSlice.reducer;
