import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { setUser } from '../../store/slices/userSlice';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../store/slices/themeSlice';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useToast } from '../ui/Toast';

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'US (MM/DD)', example: '03/21/2026' },
  { value: 'DD/MM/YYYY', label: 'International', example: '21/03/2026' },
  { value: 'YYYY-MM-DD', label: 'ISO Standard', example: '2026-03-21' },
];

const WEEK_STARTS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

export function PreferencesSettings() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const { theme: currentTheme, setTheme: handleThemeChange } = useTheme();
  const { success: showSuccess, error: showError } = useToast();

  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [weekStart, setWeekStart] = useState('monday');
  const [notifications, setNotifications] = useState({
    taskAssigned: true,
    taskUpdated: true,
    taskComments: true,
    dueDateReminder: true,
    weeklyDigest: false,
    mentions: true,
  });

  // Load preferences from currentUser.settings
  useEffect(() => {
    if (currentUser?.settings) {
      const settings = currentUser.settings as any;
      if (settings.dateFormat) setDateFormat(settings.dateFormat);
      if (settings.weekStart) setWeekStart(settings.weekStart);
      if (settings.notifications) {
        setNotifications((prev) => ({ ...prev, ...settings.notifications }));
      }
    }
  }, [currentUser]);

  const saveSettings = async (newSettings: any) => {
    try {
      const mergedSettings = {
        ...(currentUser?.settings as any || {}),
        ...newSettings,
      };
      
      const res = await api.patch('/users/me', { settings: mergedSettings });
      if (res.data.success) {
        dispatch(setUser(res.data.data));
      }
    } catch (err) {
      showError('Failed to save preferences');
    }
  };

  const toggleNotification = async (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    await saveSettings({ notifications: updated });
  };

  const updateFormat = async (key: 'dateFormat' | 'weekStart', value: string) => {
    if (key === 'dateFormat') setDateFormat(value);
    else setWeekStart(value);
    await saveSettings({ [key]: value });
  };

  const Switch = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      type="button"
      title="Toggle notification"
      className={`relative w-12 h-6.5 rounded-full transition-colors duration-300 ${
        active ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <motion.div
        animate={{ x: active ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 left-1 w-4.5 h-4.5 bg-white rounded-full shadow-md"
      />
    </button>
  );

  return (
    <div className="space-y-12 pb-10">
      {/* Visual Identity Section */}
      <section className="space-y-6">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.172-1.172a4 4 0 115.656 5.656L15 13.172V17" />
          </svg>
          Visual Appearance
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            {
              key: 'light' as Theme,
              label: 'Morning Light',
              desc: 'Clean and bright',
              preview: 'bg-white border-gray-100',
              icon: (
                <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7a5 5 0 100 10 5 5 0 000-10zM2 13h2a1 1 0 100-2H2a1 1 0 100 2zm18 0h2a1 1 0 100-2h-2a1 1 0 100 2zM11 2v2a1 1 0 102 0V2a1 1 0 10-2 0zm0 18v2a1 1 0 102 0v-2a1 1 0 10-2 0zM5.99 4.58a1 1 0 10-1.41 1.41l1.41-1.41zm12.02 12.02a1 1 0 10-1.41 1.41l1.41-1.41zm-12.02 0l-1.41 1.41a1 1 0 101.41-1.41zm12.02-12.02l-1.41 1.41a1 1 0 101.41-1.41z" />
                </svg>
              ),
            },
            {
              key: 'dark' as Theme,
              label: 'Midnight Sky',
              desc: 'Soft on eyes',
              preview: 'bg-gray-900 border-gray-800',
              icon: (
                <svg className="w-6 h-6 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ),
            },
            {
              key: 'system' as Theme,
              label: 'Adaptive',
              desc: 'Sync with OS',
              preview: 'bg-gradient-to-br from-indigo-50 to-gray-900 border-gray-200 dark:border-gray-800',
              icon: (
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l2 1h2l2-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" />
                </svg>
              ),
            },
          ]).map((opt) => {
            const isActive = currentTheme === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={async () => {
                  handleThemeChange(opt.key);
                  await saveSettings({ theme: opt.key });
                }}
                title={`Select ${opt.label} theme`}
                className={`relative group flex flex-col p-4 rounded-3xl border-2 transition-all duration-300 ${
                  isActive
                    ? 'border-indigo-600 dark:border-indigo-500 bg-white dark:bg-gray-800 shadow-xl shadow-indigo-500/10'
                    : 'border-transparent bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-800/80 grayscale'
                }`}
              >
                <div className={`w-full h-20 rounded-2xl ${opt.preview} border mb-4 flex items-center justify-center transition-transform group-hover:scale-[1.03]`}>
                   <div className={`p-2 rounded-xl ${isActive ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm' : ''}`}>
                      {opt.icon}
                   </div>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{opt.label}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{opt.desc}</span>
                {isActive && (
                  <motion.div layoutId="theme-dot" className="absolute top-3 right-3 w-2 h-2 bg-indigo-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Regional Formats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-10">
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Date Representation</h4>
          <div className="space-y-2">
            {DATE_FORMATS.map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => updateFormat('dateFormat', fmt.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                  dateFormat === fmt.value
                    ? 'border-indigo-600/30 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-transparent bg-gray-50/50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-sm font-bold">{fmt.label}</span>
                <span className="text-xs font-mono opacity-60 italic">{fmt.example}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Calendar Start</h4>
          <div className="grid grid-cols-2 gap-3">
            {WEEK_STARTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateFormat('weekStart', opt.value)}
                className={`px-4 py-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${
                  weekStart === opt.value
                    ? 'border-indigo-600 bg-white dark:bg-gray-800 shadow-lg text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent bg-gray-50/50 dark:bg-gray-900/30 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${
                   weekStart === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/40' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                   {opt.label[0]}
                </div>
                <span className="text-sm font-bold">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Modern Notifications Section */}
      <section className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
           <div>
              <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications Control
              </h3>
              <p className="text-xs text-gray-400 mt-1 ml-6">Fine-tune your workspace alerts and daily summaries</p>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2">
           <div className="space-y-1">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 ml-2">Workflow Events</h4>
              <AnimatePresence>
                {([
                  { key: 'taskAssigned' as const, label: 'Immediate Assignments', desc: 'Alert when tasks are directed to you' },
                  { key: 'mentions' as const, label: 'Direct Mentions', desc: 'When you are cited in a discussion' },
                  { key: 'taskUpdated' as const, label: 'Status Shifts', desc: 'Lifecycle transitions in your tasks' },
                  { key: 'taskComments' as const, label: 'Discussion Activity', desc: 'New insights from collaborators' },
                ]).map(({ key, label, desc }, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={key}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50 group transition-all"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-bold text-gray-950 dark:text-white leading-tight">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{desc}</p>
                    </div>
                    <Switch active={notifications[key]} onToggle={() => toggleNotification(key)} />
                  </motion.div>
                ))}
              </AnimatePresence>
           </div>

           <div className="space-y-1 mt-8 sm:mt-0">
              <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4 ml-2">Analytics & Reporting</h4>
              {([
                { key: 'dueDateReminder' as const, label: 'Proactive Deadlines', desc: 'Early warnings for upcoming goals' },
                { key: 'weeklyDigest' as const, label: 'Performance Summary', desc: 'Weekly lookback at productivity' },
              ]).map(({ key, label, desc }, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + idx * 0.05 }}
                  key={key}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50 group transition-all"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-bold text-gray-950 dark:text-white leading-tight">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{desc}</p>
                  </div>
                  <Switch active={notifications[key]} onToggle={() => toggleNotification(key)} />
                </motion.div>
              ))}
              
              <div className="mt-8 p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20">
                 <div className="flex items-center gap-3 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-xs font-black uppercase tracking-widest">Power Feature</span>
                 </div>
                 <p className="text-sm font-medium leading-relaxed">
                    Browser push notifications are currently **active**. You'll stay updated even when the app is closed.
                 </p>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}
