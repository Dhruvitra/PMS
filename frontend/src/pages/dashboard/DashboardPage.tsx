import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { motion, useInView } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

/* ── Scroll-triggered animation wrapper ── */
function ScrollReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 1.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
import api from '../../services/api';
import { Avatar } from '../../components/ui/Avatar';
import { batchRequests } from '../../services/requestManager';
import { useAppSelector, useAppDispatch } from '../../store';
import { useSocket } from '../../hooks/useSocket';
import { useNotifications } from '../../hooks/useNotifications';
import { useOrgRole } from '../../hooks/useOrgRole';
import { fetchUnreadCounts, incrementUnread, resetUnread } from '../../store/slices/messageSlice';
import type { DashboardStats, Task } from '../../types';
import { ChartDetailModal } from '../../components/dashboard/ChartDetailModal';

/* ── Custom Widgets & Sub-components ── */

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Icy fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌦️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '❄️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Rain showers', icon: '🌧️' },
  82: { label: 'Heavy showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Hail storm', icon: '⛈️' },
  99: { label: 'Heavy hail', icon: '⛈️' },
};

function useWeather() {
  const [weather, setWeather] = useState<{ temp: number; code: number; city: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Check sessionStorage cache first (avoid repeated API calls)
    const cached = sessionStorage.getItem('weather_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 30 * 60 * 1000) { // 30 min cache
          setWeather(parsed.data);
          return;
        }
      } catch { /* ignore */ }
    }

    (async () => {
      try {
        // Use ip-api.com (free, CORS-enabled, no key needed)
        const geoRes = await fetch('http://ip-api.com/json/?fields=city,lat,lon');
        if (!geoRes.ok) return;
        const geo = await geoRes.json();
        const lat = geo.lat;
        const lon = geo.lon;
        const city = geo.city || '';
        if (!lat || !lon) return;

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        if (!weatherRes.ok) return;
        const data = await weatherRes.json();
        if (!cancelled && data.current_weather) {
          const result = { temp: Math.round(data.current_weather.temperature), code: data.current_weather.weathercode, city };
          setWeather(result);
          sessionStorage.setItem('weather_cache', JSON.stringify({ data: result, ts: Date.now() }));
        }
      } catch {
        // Silently fail — weather is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return weather;
}

function GreetingSection({ name }: { name: string }) {
  const hour = new Date().getHours();
  let greetingText = 'Good evening';
  if (hour < 12) { greetingText = 'Good morning'; }
  else if (hour < 17) { greetingText = 'Good afternoon'; }

  const weather = useWeather();
  const weatherInfo = weather ? WEATHER_CODES[weather.code] || { label: 'Weather', icon: '🌡️' } : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-5 sm:p-6 text-white shadow-2xl"
    >
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-2">
            {greetingText}, <span className="text-indigo-200">{name}</span>!
          </h1>
          <p className="text-indigo-100/80 max-w-md text-sm sm:text-lg font-medium leading-relaxed">
            Welcome back to your workspace. Everything is updated in real-time.
          </p>
          <div className="mt-5 sm:mt-8 flex flex-wrap gap-2 sm:gap-3">
            <Link to="/tasks/assigned" className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-sm font-bold transition-all flex items-center gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              My Open Tasks
            </Link>
            <Link to="/inbox" className="bg-indigo-500/30 hover:bg-indigo-500/40 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-sm font-bold transition-all flex items-center gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Review Inbox
            </Link>
          </div>
        </div>

        {/* Weather Widget */}
        {weather && weatherInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shrink-0 self-start"
          >
            <span className="text-3xl sm:text-4xl">{weatherInfo.icon}</span>
            <div className="flex flex-col">
              <span className="text-2xl sm:text-3xl font-black leading-none">{weather.temp}°C</span>
              <span className="text-[11px] sm:text-xs font-semibold text-indigo-200 mt-0.5">{weatherInfo.label}</span>
              {weather.city && <span className="text-[10px] sm:text-[11px] font-medium text-indigo-300/70">{weather.city}</span>}
            </div>
          </motion.div>
        )}
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-purple-400/20 rounded-full blur-2xl" />
    </motion.div>
  );
}

function TagBadge({ color, name }: { color: string; name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.backgroundColor = color || '#3b82f6';
  }, [color]);
  return (
    <span
      ref={ref}
      className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black text-white shadow-sm shrink-0 whitespace-nowrap uppercase tracking-tighter"
    >
      {name}
    </span>
  );
}

function ScrollingActivityTicker({ notifications }: { notifications: any[] }) {
  if (notifications.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden bg-white/50 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl h-10 flex items-center group">
      <div className="flex whitespace-nowrap animate-marquee group-hover:pause-animation">
        {[...notifications, ...notifications].map((n, i) => (
          <div key={`${n.id}-${i}`} className="inline-flex items-center gap-3 px-8 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{n.title}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-[240px]">{n.message}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 45s linear infinite;
        }
        .group:hover .animate-marquee {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  link,
  colorClass,
  delay = 0,
  avatars = [],
  hoverItems = [],
  hoverTitle,
  tickerLabel,
  tickerValue,
  tickerAvatarUrl,
  tickerInitial,
  onTickerClick,
  onHoverItemClick,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Link to={link} className="group relative bg-white dark:bg-gray-800/80 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md hover:border-indigo-200/70 dark:hover:border-indigo-700/50 transition-all duration-300 flex flex-col">
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm shrink-0 ${colorClass}`}>
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, {
              className: `w-5 h-5 sm:w-6 sm:h-6 ${(icon as any).props?.className || ''}`
            }) : icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest truncate">{label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-0.5 tracking-tight">{value}</h3>
              <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            </div>
          </div>
        </div>
        <div className="mt-2 pt-3 border-t border-gray-50 dark:border-gray-700/30 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            {tickerValue ? (
              <div className="min-w-0">
                {tickerLabel && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 truncate">
                    {tickerLabel}
                  </p>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    if (!onTickerClick) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onTickerClick();
                  }}
                  className="w-full text-left flex items-center gap-2 text-[11px] font-bold text-gray-800 dark:text-gray-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title={tickerValue}
                >
                  {(tickerAvatarUrl || tickerInitial) ? (
                    <span className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-gray-200/70 dark:border-gray-700/70 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      {tickerAvatarUrl ? (
                        <img
                          src={tickerAvatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If image fails, hide it so initial becomes visible
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      {!tickerAvatarUrl && tickerInitial ? (
                        <span className="text-[9px] font-black text-white">
                          {String(tickerInitial).slice(0, 2).toUpperCase()}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="truncate">{tickerValue}</span>
                </button>
              </div>
            ) : (
              <div className="flex -space-x-1.5">
                {avatars.length > 0 ? (
                  avatars.slice(0, 4).map((m: any, i: number) => (
                    <div key={m.id || i} title={m.name} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px]">{(m.name || '').split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'}</span>
                      )}
                    </div>
                  ))
                ) : (
                  [1, 2, 3].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0" />
                  ))
                )}
              </div>
            )}
          </div>
          <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Browse
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>

        {Array.isArray(hoverItems) && hoverItems.length > 0 && (
          <div className="pointer-events-none absolute left-4 right-4 top-[92%] z-20 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 ease-out">
            <div className="pointer-events-auto rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                {hoverTitle || 'Items'} (top {Math.min(hoverItems.length, 5)})
              </p>
              <div className="space-y-1.5">
                {hoverItems.slice(0, 5).map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => {
                      if (!onHoverItemClick) return;
                      e.preventDefault();
                      e.stopPropagation();
                      onHoverItemClick(t);
                    }}
                    className="w-full flex items-center gap-2 text-left hover:opacity-90 transition-opacity"
                    title={t.title || t.name || 'Untitled'}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {t.avatarUrl ? (
                      <span className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-gray-200/70 dark:border-gray-700/70 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <img
                          src={t.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </span>
                    ) : null}
                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 truncate">
                      {t.title || t.name || 'Untitled'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

function InboxFeed({ notifications, markTaskAsRead }: { notifications: any[], markTaskAsRead: (n: any) => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const extractTaskId = (link: string | null | undefined) => {
    if (!link) return null;
    const match = link.match(/\/(?:tasks|inbox\/task)\/([^/?#]+)/);
    return match ? match[1] : null;
  };

  const handleNotifClick = (n: any) => {
    const taskId = extractTaskId(n.link);
    if (taskId) navigate(`/tasks/${taskId}`, { state: { backgroundLocation: location } });
    else if (n.link) navigate(n.link);
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const sorted = [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-3">
      {sorted.slice(0, 10).map((n, idx) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className={`group relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-all ${idx === 0
            ? 'bg-gradient-to-r from-indigo-50/80 via-white to-white dark:from-indigo-950/30 dark:via-gray-800/40 dark:to-gray-800/40 border-indigo-200/70 dark:border-indigo-700/40 shadow-lg shadow-indigo-500/5'
            : !n.isRead ? 'bg-white dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/40 shadow-sm' : 'bg-gray-50/30 dark:bg-gray-800/10 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30'
            }`}
        >
          <div className="relative shrink-0">
            {n.senderAvatarUrl ? (
              <img
                src={n.senderAvatarUrl}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-gray-800"
                alt=""
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-xs sm:text-sm uppercase shadow-sm ring-2 ring-white dark:ring-gray-800">
                {n.title.charAt(0)}
              </div>
            )}
            {!n.isRead && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900 shadow-sm" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[12px] sm:text-[13px] tracking-tight truncate ${!n.isRead ? 'font-black text-gray-900 dark:text-white' : 'font-bold text-gray-500 dark:text-gray-400'}`}>{n.title}</span>
                {idx === 0 && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-500 text-[7px] font-black text-white uppercase tracking-wider leading-none">
                    New
                  </span>
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight shrink-0">
                {getRelativeTime(n.createdAt)}
              </span>
            </div>
            <p className={`text-[12px] sm:text-[13px] line-clamp-1 mb-2 ${!n.isRead ? 'font-medium text-gray-600 dark:text-gray-300' : 'font-normal text-gray-400 dark:text-gray-500'}`}>{n.message}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNotifClick(n)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-600 hover:text-white dark:text-indigo-400 dark:hover:bg-indigo-500 dark:hover:text-white transition-all active:scale-95"
              >
                View
              </button>
              {!n.isRead && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-0.5 sm:mx-1" />
                  <button
                    onClick={(e) => { e.stopPropagation(); markTaskAsRead(n); }}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
      {notifications.length === 0 && (
        <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-700/20 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Your feed is quiet. Check back later!</p>
        </div>
      )}
    </div>
  );
}

/* ── Scrolling Due Tasks Marquee (for Admin/Super Admin/Owner) ── */
function DueTasksMarquee({ tasks, onTaskClick }: { tasks: Task[], onTaskClick: (t: Task) => void }) {
  if (tasks.length === 0) return (
    <div className="text-center py-8 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800">
      <p className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest text-[10px]">No due or overdue tasks</p>
    </div>
  );

  const getDueLabel = (dueDate: string | null) => {
    if (!dueDate) return '';
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    return `Due in ${diffDays}d`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-amber-950/20 border border-red-100 dark:border-red-900/30">
      <div className="flex flex-col divide-y divide-red-100 dark:divide-red-900/30 max-h-[360px] overflow-y-auto custom-scrollbar">
        {tasks.map((task, idx) => {
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.4 }}
              onClick={() => onTaskClick(task)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/60 dark:hover:bg-gray-800/30 cursor-pointer transition-all group"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] sm:text-[13px] font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.assignees?.length > 0 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                      {task.assignees.map(a => a.firstName).join(', ')}
                    </span>
                  )}
                  {task.list?.space?.name && (
                    <>
                      <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{task.list.space.name}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isOverdue
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                }`}>
                {getDueLabel(task.dueDate)}
              </span>
            </motion.div>
          );
        })}
      </div>
      <style>{`
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}

/* ── Personal Due Tasks List (for Member/Limited Member/Guest) ── */
function PersonalDueTasksList({ tasks, onTaskClick }: { tasks: Task[], onTaskClick: (t: Task) => void }) {
  if (tasks.length === 0) return (
    <div className="text-center py-8 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800">
      <p className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest text-[10px]">No due tasks assigned to you</p>
    </div>
  );

  const getDueLabel = (dueDate: string | null) => {
    if (!dueDate) return '';
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    return `Due in ${diffDays}d`;
  };

  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar">
      {tasks.map((task, idx) => {
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.5 }}
            onClick={() => onTaskClick(task)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isOverdue
              ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
              : 'bg-white dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/40'
              }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
              }`}>
              <svg className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] sm:text-[13px] font-bold text-gray-900 dark:text-white truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {task.list?.space?.name && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{task.list.space.name}</span>
                )}
                {task.project?.name && (
                  <>
                    <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{task.project.name}</span>
                  </>
                )}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isOverdue
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
              }`}>
              {getDueLabel(task.dueDate)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** One cohesive, professional categorical palette shared by every chart on this page,
 *  instead of separate ad-hoc color lists per chart. Cycles if a series has more entries. */
const CHART_PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#64748b', // slate
  '#eab308', // yellow
  '#06b6d4', // cyan
];

const STATUS_COLORS = CHART_PALETTE;
const ASSIGNEE_COLORS = CHART_PALETTE;

/** Shared recharts tooltip styling so all three charts look like one cohesive design system. */
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 12px',
  },
  itemStyle: { fontSize: 12 },
  labelStyle: { fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 2 },
  cursor: { fill: 'rgba(99, 102, 241, 0.06)' },
};

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [isAdminLevel, setIsAdminLevel] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'due'>('feed');
  const [chartData, setChartData] = useState<{ workloadByStatus: any[]; totalTasksByAssignee: any[]; openTasksByAssignee: any[] } | null>(null);
  const [chartModal, setChartModal] = useState<{
    open: boolean;
    chartType: 'workloadByStatus' | 'totalTasksByAssignee' | 'openTasksByAssignee';
    chartTitle: string;
    chartData: any[];
    selectedSegment: string | null;
  }>({ open: false, chartType: 'workloadByStatus', chartTitle: '', chartData: [], selectedSegment: null });
  const [mounted, setMounted] = useState(false);
  const [unassignedTickerIdx, setUnassignedTickerIdx] = useState(0);
  const [assignedTickerIdx, setAssignedTickerIdx] = useState(0);
  const [dueTickerIdx, setDueTickerIdx] = useState(0);
  const [memberTickerIdx, setMemberTickerIdx] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const items = stats?.unassignedOpenTasksPreview || [];
    if (!items || items.length <= 1) return;
    const id = window.setInterval(() => {
      setUnassignedTickerIdx((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [stats?.unassignedOpenTasksPreview]);

  useEffect(() => {
    const items = stats?.recentTasks || [];
    if (!items || items.length <= 1) return;
    const id = window.setInterval(() => {
      setAssignedTickerIdx((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [stats?.recentTasks]);

  useEffect(() => {
    const items = dueTasks || [];
    if (!items || items.length <= 1) return;
    const id = window.setInterval(() => {
      setDueTickerIdx((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [dueTasks]);

  useEffect(() => {
    const items = stats?.members || [];
    if (!items || items.length <= 1) return;
    const id = window.setInterval(() => {
      setMemberTickerIdx((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [stats?.members]);
  const { notifications, unreadCount: notifUnread, markTaskAsRead, resetUnreadCount } = useNotifications();
  const { unreadCounts } = useAppSelector(state => state.message);
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const currentOrg = useAppSelector((state) => state.organization.currentOrg);
  const socket = useSocket();

  const { isSuperAdmin, isAdmin, canAccessEmployeeTracking } = useOrgRole();
  const [leaderboard, setLeaderboard] = useState<{ user: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; activeSeconds: number }[]>([]);
  const [lateToday, setLateToday] = useState<{ configured: boolean; officeStartTime: string | null; lateMembers: { user: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; clockedInAt: string }[] } | null>(null);

  useEffect(() => {
    if (!canAccessEmployeeTracking || !currentOrg?.id) return;
    api.get<{ success: boolean; data: typeof leaderboard }>('/tracker/leaderboard', { params: { orgId: currentOrg.id } })
      .then(res => setLeaderboard(res.data.data))
      .catch(err => console.error('Failed to load hours leaderboard:', err));
    api.get<{ success: boolean; data: typeof lateToday }>('/tracker/late-today', { params: { orgId: currentOrg.id } })
      .then(res => setLateToday(res.data.data))
      .catch(err => console.error('Failed to load late-today list:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessEmployeeTracking, currentOrg?.id]);
  const unreadDMCount = Object.values(unreadCounts).reduce((a: number, b: number) => a + b, 0);

  // AbortController for cancelling in-flight requests on unmount / org switch
  const abortRef = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async () => {
    // Cancel any previous load
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = currentOrg?.id ? `?orgId=${currentOrg.id}` : '';
      const [statsRes, dueRes, chartRes] = await batchRequests([
        () => api.get(`/dashboard/stats${params}`, { signal: controller.signal }),
        () => api.get(`/dashboard/due-tasks${params}`, { signal: controller.signal }),
        () => api.get(`/dashboard/chart-data${params}`, { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
        setRecentTasks(statsRes.data.data.recentTasks || []);
        dispatch(fetchUnreadCounts());
      }
      if (dueRes.data.success) {
        setDueTasks(dueRes.data.data.dueTasks || []);
        setIsAdminLevel(dueRes.data.data.isAdminLevel || false);
      }
      if (chartRes.data.success) {
        setChartData(chartRes.data.data);
      }
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') return;
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, dispatch]);

  useEffect(() => {
    loadDashboard();
    return () => { abortRef.current?.abort(); };
  }, [loadDashboard]);

  // Real-time listeners
  useEffect(() => {
    if (!socket) return;

    let timeout: any;
    const handleRefresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(loadDashboard, 300);
    };

    socket.on('notification:new', handleRefresh);
    socket.on('dashboard:refresh', handleRefresh);
    socket.on('people:updated', handleRefresh);
    socket.on('task:updated', handleRefresh);
    socket.on('task:refresh', handleRefresh);
    socket.on('notification:read_sync', handleRefresh);
    socket.on('notification:read_all_sync', handleRefresh);
    socket.on('notification:task_read_sync', handleRefresh);

    socket.on('users:online-list', (users: string[]) => {
      if (Array.isArray(users)) setOnlineUserIds(users);
    });
    // The one-time initial push fires when the shared socket first connects,
    // which is usually before this page mounts — request a fresh snapshot.
    socket.emit('users:get-online-list');

    socket.on('user:online', (data: { userId: string }) => {
      if (data?.userId) {
        setOnlineUserIds(prev => Array.from(new Set([...prev, data.userId])));
      }
    });

    socket.on('message:new', (msg: any) => {
      if (msg?.receiverId === currentUser?.id) {
        dispatch(incrementUnread(msg.senderId));
      }
    });

    socket.on('messages:read-receipt', (data: any) => {
      if (data?.readBy === currentUser?.id && data.senderId) {
        dispatch(resetUnread(data.senderId));
      }
      handleRefresh();
    });

    socket.on('user:offline', (data: { userId: string }) => {
      if (data?.userId) {
        setOnlineUserIds(prev => prev.filter(id => id !== data.userId));
      }
    });

    return () => {
      clearTimeout(timeout);
      socket.off('notification:new', handleRefresh);
      socket.off('dashboard:refresh', handleRefresh);
      socket.off('people:updated', handleRefresh);
      socket.off('task:updated', handleRefresh);
      socket.off('task:refresh', handleRefresh);
      socket.off('notification:read_sync', handleRefresh);
      socket.off('notification:read_all_sync', handleRefresh);
      socket.off('notification:task_read_sync', handleRefresh);
      socket.off('message:new');
      socket.off('messages:read-receipt');
      socket.off('users:online-list');
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [socket, loadDashboard, currentUser?.id]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 sm:space-y-8">
        <div className="h-40 sm:h-48 w-full rounded-2xl animate-pulse bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 sm:h-32 rounded-2xl animate-pulse bg-gray-50 dark:bg-gray-800/50" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-4 md:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 font-sans scroll-smooth custom-scrollbar">

      {/* ── Welcome Area ── */}
      <div className="space-y-4">
        <GreetingSection name={currentUser?.firstName || 'there'} />
      </div>

      {/* ── Highlights Grid ── */}
      <ScrollReveal delay={0.1}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-4 gap-4 sm:gap-6">
          {!(isSuperAdmin || isAdmin) && (
            <StatCard
              delay={0.12}
              label="Total Completed Tasks"
              value={stats?.completedTaskCount ?? 0}
              link="/tasks/assigned"
              colorClass="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          )}
          <StatCard
            delay={0.2}
            label="Tasks Assigned"
            value={stats?.taskCount || 0}
            link="/tasks/assigned"
            hoverTitle="Recent tasks"
            hoverItems={(stats?.recentTasks || []).map((t: any) => ({ id: t.id, title: t.title }))}
            tickerLabel={(stats?.recentTasks?.length || 0) > 0 ? 'Now showing' : undefined}
            tickerValue={(stats?.recentTasks?.length || 0) > 0 ? ((stats?.recentTasks || [])[assignedTickerIdx]?.title || '') : undefined}
            onTickerClick={() => {
              const t = (stats?.recentTasks || [])[assignedTickerIdx];
              if (!t?.id) return;
              navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } });
            }}
            onHoverItemClick={(t: any) => {
              if (!t?.id) return;
              navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } });
            }}
            colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
          />
          {(isSuperAdmin || isAdmin) && (
            <StatCard
              delay={0.28}
              label="Unassigned Open Tasks"
              value={stats?.unassignedOpenTaskCount ?? 0}
              link="/tasks/assigned"
              hoverItems={stats?.unassignedOpenTasksPreview || []}
              tickerLabel={(stats?.unassignedOpenTasksPreview?.length || 0) > 0 ? 'Now showing' : undefined}
              tickerValue={(stats?.unassignedOpenTasksPreview?.length || 0) > 0
                ? ((stats?.unassignedOpenTasksPreview || [])[unassignedTickerIdx]?.title || '')
                : undefined}
              onTickerClick={() => {
                const t = (stats?.unassignedOpenTasksPreview || [])[unassignedTickerIdx];
                if (!t?.id) return;
                navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } });
              }}
              onHoverItemClick={(t: any) => {
                if (!t?.id) return;
                navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } });
              }}
              colorClass="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V6a4 4 0 118 0v1m-9 4h10m-9 8h8a2 2 0 002-2v-7a2 2 0 00-2-2H8a2 2 0 00-2 2v7a2 2 0 002 2z" />
                </svg>
              }
            />
          )}
          <StatCard
            delay={0.3}
            label="Team Members"
            value={stats?.memberCount || 0}
            link="/people"
            avatars={stats?.members}
            hoverTitle="Team members"
            hoverItems={(stats?.members || []).map((m: any) => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl }))}
            tickerLabel={(stats?.members?.length || 0) > 0 ? 'Now showing' : undefined}
            tickerValue={(stats?.members?.length || 0) > 0 ? ((stats?.members || [])[memberTickerIdx]?.name || '') : undefined}
            tickerAvatarUrl={(stats?.members?.length || 0) > 0 ? ((stats?.members || [])[memberTickerIdx]?.avatarUrl || null) : null}
            tickerInitial={(stats?.members?.length || 0) > 0 && !((stats?.members || [])[memberTickerIdx]?.avatarUrl)
              ? (((stats?.members || [])[memberTickerIdx]?.name || '').trim().split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join(''))
              : ''}
            onTickerClick={() => navigate('/people')}
            onHoverItemClick={() => navigate('/people')}
            colorClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <StatCard
            delay={0.4}
            label="Due Tasks"
            value={dueTasks.length}
            link="/tasks/assigned"
            hoverTitle="Due tasks"
            hoverItems={dueTasks.map((t: any) => ({ id: t.id, title: t.title }))}
            tickerLabel={dueTasks.length > 0 ? 'Now showing' : undefined}
            tickerValue={dueTasks.length > 0 ? (dueTasks[dueTickerIdx]?.title || '') : undefined}
            onTickerClick={() => {
              const t = dueTasks[dueTickerIdx];
              if (!t?.id) return;
              navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } });
            }}
            onHoverItemClick={(t: any) => {
              if (!t?.id) return;
              navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } });
            }}
            colorClass="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            icon={
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          } />
        </div>
      </ScrollReveal>

      {/* ── Charts Section ── */}
      {(isSuperAdmin || isAdmin) && chartData && (chartData.workloadByStatus?.length > 0 || chartData.totalTasksByAssignee?.length > 0 || chartData.openTasksByAssignee?.length > 0) && (
        <ScrollReveal delay={0.2}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Workload by Status - Pie Chart */}
            <div
              onClick={() => setChartModal({ open: true, chartType: 'workloadByStatus', chartTitle: 'Workload by Status', chartData: chartData.workloadByStatus, selectedSegment: chartData.workloadByStatus[0]?.name || null })}
              className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-4 sm:p-6 shadow-sm min-h-[400px] flex flex-col min-w-0 cursor-pointer hover:shadow-md hover:border-indigo-200/70 dark:hover:border-indigo-700/50 transition-all duration-300 group"
            >
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Workload by Status</h3>
              <div className="flex-1 w-full flex items-center justify-center min-w-0">
                {chartData.workloadByStatus.length > 0 && mounted ? (
                  <div className="w-full h-[360px]">
                    <ResponsiveContainer width="99%" height={360}>
                      <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
                        <Pie
                          data={chartData.workloadByStatus}
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          dataKey="value"
                          labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                          label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                            const RADIAN = Math.PI / 180;
                            const angle = midAngle ?? 0;
                            const radius = outerRadius + 28;
                            const x = cx + radius * Math.cos(-angle * RADIAN);
                            const y = cy + radius * Math.sin(-angle * RADIAN);
                            const pct = ((percent || 0) * 100).toFixed(1);
                            if ((percent || 0) < 0.02) return null;
                            return (
                              <text
                                x={x}
                                y={y}
                                fill="#374151"
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                style={{ fontSize: '11px', fontWeight: 600 }}
                              >
                                {`${(name || '').replace(/_/g, ' ')} ${pct}%`}
                              </text>
                            );
                          }}
                          strokeWidth={2}
                        >
                          {chartData.workloadByStatus.map((_entry, index) => (
                            <Cell key={`cell-status-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [value, 'Tasks']} {...CHART_TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No data available</p>
                )}
              </div>
            </div>

            {/* Total Tasks by Assignee - Pie Chart */}
            <div
              onClick={() => setChartModal({ open: true, chartType: 'totalTasksByAssignee', chartTitle: 'Total Tasks by Assignee', chartData: chartData.totalTasksByAssignee, selectedSegment: chartData.totalTasksByAssignee[0]?.name || null })}
              className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-4 sm:p-6 shadow-sm min-h-[400px] flex flex-col min-w-0 cursor-pointer hover:shadow-md hover:border-indigo-200/70 dark:hover:border-indigo-700/50 transition-all duration-300 group"
            >
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Total Tasks by Assignee</h3>
              <div className="flex-1 w-full flex items-center justify-center min-w-0">
                {chartData.totalTasksByAssignee.length > 0 && mounted ? (
                  <div className="w-full h-[360px]">
                    <ResponsiveContainer width="99%" height={360}>
                      <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
                        <Pie
                          data={chartData.totalTasksByAssignee}
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          dataKey="value"
                          labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                          label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                            const RADIAN = Math.PI / 180;
                            const angle = midAngle ?? 0;
                            const radius = outerRadius + 28;
                            const x = cx + radius * Math.cos(-angle * RADIAN);
                            const y = cy + radius * Math.sin(-angle * RADIAN);
                            const pct = ((percent || 0) * 100).toFixed(1);
                            if ((percent || 0) < 0.02) return null;
                            return (
                              <text
                                x={x}
                                y={y}
                                fill="#374151"
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                style={{ fontSize: '11px', fontWeight: 600 }}
                              >
                                {`${name} ${pct}%`}
                              </text>
                            );
                          }}
                          strokeWidth={2}
                        >
                          {chartData.totalTasksByAssignee.map((_entry, index) => (
                            <Cell key={`cell-assignee-${index}`} fill={ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any, _name: any, props: any) => [value, props.payload.name]} {...CHART_TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No data available</p>
                )}
              </div>
            </div>

            {/* Open Tasks by Assignee - Bar Chart */}
            <div
              onClick={() => setChartModal({ open: true, chartType: 'openTasksByAssignee', chartTitle: 'Open Tasks by Assignee', chartData: chartData.openTasksByAssignee, selectedSegment: chartData.openTasksByAssignee[0]?.name || null })}
              className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-4 sm:p-6 shadow-sm min-h-[340px] flex flex-col min-w-0 cursor-pointer hover:shadow-md hover:border-indigo-200/70 dark:hover:border-indigo-700/50 transition-all duration-300 group"
            >
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Open Tasks by Assignee</h3>
              <div className="flex-1 w-full flex items-center justify-center min-w-0">
                {chartData.openTasksByAssignee.length > 0 && mounted ? (
                  <div className="w-full h-[280px]">
                    <ResponsiveContainer width="99%" height={280}>
                      <BarChart data={chartData.openTasksByAssignee} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} />
                        <Bar dataKey="Tasks" radius={[4, 4, 0, 0]}>
                          {chartData.openTasksByAssignee.map((_entry, index) => (
                            <Cell key={`cell-bar-${index}`} fill={ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No data available</p>
                )}
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Chart Detail Modal */}
      {(isSuperAdmin || isAdmin) && chartData && (
        <ChartDetailModal
          open={chartModal.open}
          onClose={() => setChartModal(prev => ({ ...prev, open: false }))}
          chartType={chartModal.chartType}
          chartTitle={chartModal.chartTitle}
          chartData={chartModal.chartData}
          selectedSegment={chartModal.selectedSegment}
          orgId={currentOrg?.id || ''}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start">

        {/* Main Workspace Column — Tabbed Feed */}
        <ScrollReveal delay={0.15} className="lg:col-span-6 2xl:col-span-8 space-y-6">
          <div className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-4 sm:p-8 shadow-sm">
            {/* Tab Header */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 mb-5 sm:mb-6">
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setActiveTab('feed')}
                  className={`px-4 py-2 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'feed'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Real-time Feed
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('due')}
                  className={`px-4 py-2 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'due'
                    ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Due Tasks
                    {dueTasks.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[8px] font-black text-white leading-none">{dueTasks.length}</span>
                    )}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {activeTab === 'feed' ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      Live
                    </div>
                    <Link to="/inbox" className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest hover:underline whitespace-nowrap">View All</Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-800/50 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      {dueTasks.length} Due
                    </div>
                    <Link to="/tasks/assigned" className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest hover:underline whitespace-nowrap">View All</Link>
                  </>
                )}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'feed' ? (
              <div className="max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                <InboxFeed notifications={notifications} markTaskAsRead={markTaskAsRead} />
              </div>
            ) : (
              isAdminLevel ? (
                <DueTasksMarquee tasks={dueTasks} onTaskClick={(t) => navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } })} />
              ) : (
                <PersonalDueTasksList tasks={dueTasks} onTaskClick={(t) => navigate(`/tasks/${t.id}`, { state: { backgroundLocation: location } })} />
              )
            )}
          </div>
        </ScrollReveal>

        {/* Right Sidebar: Real-time Presence */}
        <ScrollReveal delay={0.25} className="lg:col-span-6 2xl:col-span-4 space-y-6">
          <div className="bg-indigo-600 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-base sm:text-lg font-black mb-1">Collaboration Pulse</h3>
              <p className="text-[10px] sm:text-xs text-indigo-200 font-bold uppercase tracking-widest mb-4 sm:mb-6">{onlineUserIds.length} Team Members Online</p>

              <div className="flex flex-wrap gap-3">
                {onlineUserIds.map((userId, idx) => {
                  const member = stats?.members?.find(m => m.id === userId);
                  const name = member?.name || 'Teammate';
                  const avatar = member?.avatarUrl;

                  return (
                    <motion.button
                      key={userId}
                      type="button"
                      onClick={() => navigate(`/tasks/team?userId=${userId}`)}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <div className="relative group" title={`Chat with ${name}`}>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 border border-white/20 overflow-hidden shadow-sm group-hover:scale-110 transition-transform flex items-center justify-center font-black text-sm sm:text-base">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <span className={`text-white/90 ${avatar ? 'hidden' : ''}`}>{name.split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}</span>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full border border-indigo-600 shadow-sm" />
                      </div>
                    </motion.button>
                  );
                })}
                {onlineUserIds.length === 0 && <p className="text-sm font-medium opacity-60 italic">Your team is resting...</p>}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-12 translate-x-12" />
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-7 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-widest">Real-time Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">Sync Status</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100 dark:border-emerald-800">Connected</span>
              </div>
              <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              </div>
            </div>
          </div>

          {canAccessEmployeeTracking && (
            <div className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-7 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Top Hours This Month</h3>
                <Link to="/tracking/summary" className="text-[11px] font-bold text-indigo-500 hover:underline">View All</Link>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No tracked time yet this month.</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((row, idx) => {
                    const hours = Math.floor(row.activeSeconds / 3600);
                    const mins = Math.floor((row.activeSeconds % 3600) / 60);
                    return (
                      <div key={row.user.id} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-black text-gray-400">{idx + 1}</span>
                        <Avatar firstName={row.user.firstName} lastName={row.user.lastName} avatarUrl={row.user.avatarUrl} size="sm" />
                        <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{row.user.firstName} {row.user.lastName}</span>
                        <span className="text-xs font-bold text-gray-500 shrink-0">{hours}h {mins}m</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {canAccessEmployeeTracking && lateToday?.configured && (
            <div className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-7 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-widest">Late Today</h3>
              {lateToday.lateMembers.length === 0 ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Everyone's on time today.</p>
              ) : (
                <div className="space-y-3">
                  {lateToday.lateMembers.map(m => (
                    <div key={m.user.id} className="flex items-center gap-3">
                      <Avatar firstName={m.user.firstName} lastName={m.user.lastName} avatarUrl={m.user.avatarUrl} size="sm" />
                      <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{m.user.firstName} {m.user.lastName}</span>
                      <span className="text-xs font-bold text-rose-500 shrink-0">{new Date(m.clockedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollReveal>

      </div>
    </div>
  );
}
