import { useEffect, useState } from 'react';

const DISMISS_KEY = 'notif_prompt_dismissed_at';
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // don't re-nag for 24h after "Not now"

export function EnableNotificationsPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'default') return;

    const dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = async () => {
    const result = await window.Notification.requestPermission();
    setVisible(false);
    if (result !== 'granted') {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[500] w-[340px] max-w-[calc(100vw-2.5rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Turn on notifications</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            Get notified on your desktop when someone comments or assigns you a task — even when this tab isn't focused.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAllow}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
            >
              Turn on
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-bold transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
