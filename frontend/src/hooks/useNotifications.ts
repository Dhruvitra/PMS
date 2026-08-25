import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { Notification } from '../types/notification.types';
import { useAppSelector, useAppDispatch } from '../store';
import {
  fetchNotifications,
  addNotification,
  syncReadStatus,
  markAsReadAction,
  markTaskAsReadAction,
  markAllAsReadAction,
  markInboxSeen,
} from '../store/slices/notificationSlice';
import { playNotificationReceived } from '../utils/notificationSound';


const extractTaskId = (link: string | null | undefined) => {
  if (!link) return null;
  const match = link.match(/\/(?:tasks|inbox\/task)\/([^/?#]+)/);
  return match ? match[1] : null;
};

export function useNotifications() {
  const dispatch = useAppDispatch();
  const { notifications, unreadCount, badgeCount, loading } = useAppSelector((state) => state.notification);
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const token = useAppSelector(state => state.auth.accessToken);
  const socket = useSocket();
  const taskReadDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const loadData = useCallback(async (orgId?: string) => {
    dispatch(fetchNotifications(orgId));
  }, [dispatch]);

  useEffect(() => {
    if (!token) return;
    loadData(currentOrg?.id);
  }, [loadData, currentOrg?.id, token]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif: Notification) => {
      dispatch(addNotification(newNotif));
      playNotificationReceived();

      const lastNotifTime = parseInt(localStorage.getItem('last_notif_time') || '0');
      const now = Date.now();
      if (now - lastNotifTime > 1000) {
        localStorage.setItem('last_notif_time', now.toString());
        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification(newNotif.title, {
            body: newNotif.message,
            icon: '/tab-icon.png',
            badge: '/tab-icon.png',
          });
        }
      }
    };

    const handleReadSync = (data: { id: string }) => {
      dispatch(syncReadStatus(data));
    };

    const handleReadAllSync = () => {
      dispatch(markAllAsReadAction());
    };

    const handleTaskReadSync = () => {
      // Debounce to prevent multiple rapid refetches
      if (taskReadDebounceRef.current) clearTimeout(taskReadDebounceRef.current);
      taskReadDebounceRef.current = setTimeout(() => {
        dispatch(fetchNotifications(currentOrg?.id));
      }, 500);
    };

    const handleMessagesRead = () => {
      // Debounce message read refetches
      if (taskReadDebounceRef.current) clearTimeout(taskReadDebounceRef.current);
      taskReadDebounceRef.current = setTimeout(() => {
        loadData(currentOrg?.id);
      }, 500);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read_sync', handleReadSync);
    socket.on('notification:read_all_sync', handleReadAllSync);
    socket.on('notification:task_read_sync', handleTaskReadSync);
    socket.on('messages:read-receipt', handleMessagesRead);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read_sync', handleReadSync);
      socket.off('notification:read_all_sync', handleReadAllSync);
      socket.off('notification:task_read_sync', handleTaskReadSync);
      socket.off('messages:read-receipt', handleMessagesRead);
    };
  }, [socket, loadData, currentOrg?.id, dispatch]);

  const markAsRead = useCallback(async (id: string) => {
    dispatch(markAsReadAction(id));
  }, [dispatch]);

  const resetUnreadCount = useCallback(() => {
    dispatch(markInboxSeen());
  }, [dispatch]);

  const markAllAsRead = useCallback(async () => {
    dispatch(markAllAsReadAction(currentOrg?.id));
  }, [dispatch, currentOrg?.id]);

  const markTaskAsRead = useCallback(async (target: Notification | string) => {
    if (!target) return;
    const taskId = typeof target === 'string' ? target : extractTaskId(target.link);
    if (taskId) {
      dispatch(markTaskAsReadAction(taskId));
    } else if (typeof target !== 'string') {
      dispatch(markAsReadAction(target.id));
    }
  }, [dispatch]);

  return {
    notifications,
    unreadCount,
    badgeCount,
    loading,
    markAsRead,
    markAllAsRead,
    markTaskAsRead,
    resetUnreadCount,
    refresh: loadData
  };
}
