import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../types/notification.types';

export function NotificationBell() {
  const { notifications, unreadCount, badgeCount, markAsRead, markAllAsRead, resetUnreadCount } = useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    notificationsSupported ? window.Notification.permission : 'unsupported'
  );

  const handleEnableDesktopAlerts = async () => {
    if (!notificationsSupported) return;
    const result = await window.Notification.requestPermission();
    setPermission(result);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      if (badgeCount > 0) {
        resetUnreadCount();
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, unreadCount, resetUnreadCount]);

  const handleNotificationClick = async (id: string, link: string | null) => {
    if (id) await markAsRead(id);
    setShowDropdown(false);
    if (link) {
      if (link.startsWith('/tasks/')) {
        navigate(link, { state: { backgroundLocation: location } });
      } else {
        navigate(link);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-gray-900 shadow-sm px-1">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-14 sm:top-full sm:right-0 sm:mt-2 w-auto sm:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 dropdown-enter overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{unreadCount} unread</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {permission === 'default' && (
            <div className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between gap-2">
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-snug">
                Turn on desktop alerts so you don't miss comments.
              </p>
              <button
                onClick={handleEnableDesktopAlerts}
                className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Enable
              </button>
            </div>
          )}
          {permission === 'denied' && (
            <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                Desktop alerts are blocked. Enable them for this site in your browser's settings to get notified of new comments.
              </p>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {notifications.map((notif: Notification) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id, notif.link)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all flex gap-3 ${!notif.isRead ? 'bg-indigo-50/10 dark:bg-indigo-900/10' : ''}`}
                  >
                    <div className="mt-1">
                      {!notif.isRead ? (
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-tight ${!notif.isRead ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(notif.createdAt))}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <button
              onClick={() => { setShowDropdown(false); navigate('/inbox'); }}
              className="w-full py-1.5 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              View Full Inbox
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
