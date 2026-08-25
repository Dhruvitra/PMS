import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { TrackingPageShell } from './TrackingPageShell';
import { Avatar } from '../../components/ui/Avatar';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M4 7h5m-5 4h5m-5 4h3" />
  </svg>
);

interface SummaryRow {
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  activeSeconds: number;
  idleSeconds: number;
  inputActiveSeconds: number;
  firstActivity: string;
  lastActivity: string;
  sessionCount: number;
  totalSeconds: number;
  activePercent: number;
  inputActivePercent: number;
}

interface SummaryData {
  rows: SummaryRow[];
  totals: { activeSeconds: number; idleSeconds: number; employeesWorked: number; totalMembers: number; notLogged: number };
}

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'IST (India)' },
  { value: 'UTC', label: 'UTC' },
  { value: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'Your device timezone' },
];

const DAY_RESET_OPTIONS = [
  { hour: 0, label: 'Midnight to Midnight' },
  { hour: 4, label: '4:00 AM to 3:59 AM next day' },
  { hour: 6, label: '6:00 AM to 5:59 AM next day' },
];

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// The team is India-based, so "today" means the IST calendar date, not UTC -- using UTC directly
// would silently show yesterday's data as "today" for anyone checking between 12:00-5:30 AM IST
// (still the previous date in UTC). Same fixed-offset trick used server-side in tracker.service.ts.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function todayStr() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Computes the actual UTC start/end instants for a date range, shifted by the day-reset hour
 *  (e.g. a "4:00 AM to 3:59 AM next day" reset means a day's data starts at 4am local, not midnight). */
function computeDateRange(startDate: string, endDate: string, dayResetHour: number) {
  const start = new Date(`${startDate}T${pad2(dayResetHour)}:00:00`);
  const endBase = new Date(`${endDate}T${pad2(dayResetHour)}:00:00`);
  const end = new Date(endBase.getTime() + 24 * 60 * 60 * 1000 - 1000);
  return { start, end };
}

function downloadCSV(data: SummaryData) {
  const header = ['Employee', 'First Activity', 'Last Activity', 'Active Time', 'Idle Timeout Deduction', 'Including Idle Timeout', '% Active Minutes', '% Active Seconds', 'Sessions'];
  const rows = data.rows.map(r => [
    `${r.user.firstName} ${r.user.lastName}`,
    new Date(r.firstActivity).toLocaleString(),
    new Date(r.lastActivity).toLocaleString(),
    formatDuration(r.activeSeconds),
    formatDuration(r.idleSeconds),
    formatDuration(r.totalSeconds),
    `${r.activePercent}%`,
    `${r.inputActivePercent}%`,
    String(r.sessionCount),
  ]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employee-summary-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SummaryContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [dayResetHour, setDayResetHour] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [trackingStatus, setTrackingStatus] = useState<{ user: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; isTracking: boolean }[]>([]);

  useEffect(() => {
    if (!currentOrg?.id) return;
    let cancelled = false;
    const loadStatus = () => {
      api.get<{ success: boolean; data: typeof trackingStatus }>('/tracker/status', { params: { orgId: currentOrg.id } })
        .then(res => { if (!cancelled) setTrackingStatus(res.data.data); })
        .catch(err => console.error('Failed to load tracking status:', err));
    };
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const { start, end } = computeDateRange(startDate, endDate, dayResetHour);
      const res = await api.get<{ success: boolean; data: SummaryData }>('/tracker/summary', {
        params: { orgId: currentOrg.id, startDate: start.toISOString(), endDate: end.toISOString() },
      });
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load employee summary:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, startDate, endDate, dayResetHour]);

  // Poll like the tracking-status widget above -- otherwise this table is a snapshot from
  // whenever the page was last opened/filtered, which drifts further from live tracker totals
  // the longer someone leaves the page open.
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

  const filteredRows = data?.rows.filter(r =>
    `${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const trackingNowCount = trackingStatus.filter(s => s.isTracking).length;

  return (
    <div className="flex flex-col">
      {/* Live Tracking Status -- who currently has the desktop tracker open, independent of the date filters below */}
      {trackingStatus.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5 bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 shrink-0">
            {trackingNowCount} of {trackingStatus.length} tracking now
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {trackingStatus.map(s => (
              <div key={s.user.id} className="flex items-center gap-1.5" title={s.isTracking ? 'Tracking now' : 'Not tracking'}>
                <div className="relative">
                  <Avatar firstName={s.user.firstName} lastName={s.user.lastName} avatarUrl={s.user.avatarUrl} size="xs" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1E2530] ${s.isTracking ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.user.firstName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={todayStr()}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Day Reset</label>
          <select value={dayResetHour} onChange={e => setDayResetHour(Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200 dark:[color-scheme:dark]">
            {DAY_RESET_OPTIONS.map(o => <option key={o.hour} value={o.hour}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Timezone</label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200 dark:[color-scheme:dark]">
            {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>
        <button onClick={load} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
          Refresh
        </button>
        <div className="flex-1" />
        <input type="text" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-transparent dark:text-gray-200 w-48" />
        <button
          onClick={() => data && downloadCSV(data)}
          disabled={!data || data.rows.length === 0}
          className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors"
        >
          Download CSV
        </button>
      </div>

      {/* Stat tiles */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-indigo-600 text-white rounded-2xl p-4">
            <div className="text-2xl font-black">{formatDuration(data.totals.activeSeconds + data.totals.idleSeconds)}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">Time Worked</div>
          </div>
          <div className="bg-emerald-600 text-white rounded-2xl p-4">
            <div className="text-2xl font-black">{formatDuration(data.totals.activeSeconds)}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">Active Time</div>
          </div>
          <div className="bg-rose-500 text-white rounded-2xl p-4">
            <div className="text-2xl font-black">{formatDuration(data.totals.idleSeconds)}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">Idle Time</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl p-4">
            <div className="text-2xl font-black">{data.totals.employeesWorked}<span className="text-sm font-bold text-gray-400"> / {data.totals.totalMembers}</span></div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Employees Worked</div>
          </div>
        </div>
      )}
      {data && data.totals.notLogged > 0 && (
        <div className="mb-4 inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          {data.totals.notLogged} of {data.totals.totalMembers} haven't logged any time in this range
        </div>
      )}

      {loading && <div className="px-4 py-10 text-center text-gray-400 text-sm">Loading...</div>}
      {!loading && filteredRows.length === 0 && (
        <div className="px-4 py-10 text-center text-gray-400 text-sm bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 mb-6">No activity found for this range.</div>
      )}

      {/* Desktop table */}
      {!loading && filteredRows.length > 0 && (
        <div className="hidden lg:block bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[calc(100vh-320px)] mb-6">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E2530] z-10">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-4 py-3 font-bold">Employee</th>
                <th className="text-left px-3 py-3 font-bold">Activity Span</th>
                <th className="text-right px-3 py-3 font-bold">Active Time</th>
                <th className="text-left px-3 py-3 font-bold">% Active Minutes</th>
                <th className="text-left px-3 py-3 font-bold">% Active Seconds</th>
                <th className="text-right px-3 py-3 font-bold">Idle Timeout Deduction</th>
                <th className="text-right px-3 py-3 font-bold">Including Idle Timeout</th>
                <th className="text-right px-3 py-3 font-bold">Sessions</th>
                <th className="text-right px-4 py-3 font-bold">Screenshots</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => (
                <tr key={r.user.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={r.user.firstName} lastName={r.user.lastName} avatarUrl={r.user.avatarUrl} size="sm" />
                      <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{r.user.firstName} {r.user.lastName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatTime(r.firstActivity)} → {formatTime(r.lastActivity)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatDuration(r.activeSeconds)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                        <div className="h-full bg-emerald-500" style={{ width: `${r.activePercent}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-9 shrink-0">{r.activePercent}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                        <div className="h-full bg-amber-500" style={{ width: `${r.inputActivePercent}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-9 shrink-0">{r.inputActivePercent}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-rose-500 font-semibold whitespace-nowrap">{formatDuration(r.idleSeconds)}</td>
                  <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDuration(r.totalSeconds)}</td>
                  <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-300">{r.sessionCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/tracking/screenshots?userId=${r.user.id}`} className="font-bold text-indigo-500 hover:underline whitespace-nowrap">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
            {data && (
              <tfoot>
                <tr className="bg-gray-50/50 dark:bg-gray-900/20 font-bold border-t-2 border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3" colSpan={2}>TOTAL ({data.totals.employeesWorked} employees)</td>
                  <td className="px-3 py-3 text-right">{formatDuration(data.totals.activeSeconds)}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right text-rose-500">{formatDuration(data.totals.idleSeconds)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && filteredRows.length > 0 && (
        <div className="lg:hidden space-y-3 mb-6">
          {filteredRows.map(r => (
            <div key={r.user.id} className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar firstName={r.user.firstName} lastName={r.user.lastName} avatarUrl={r.user.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">{r.user.firstName} {r.user.lastName}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatTime(r.firstActivity)} → {formatTime(r.lastActivity)}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Active</div>
                  <div className="font-bold text-gray-900 dark:text-white">{formatDuration(r.activeSeconds)}</div>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0">% Minutes</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${r.activePercent}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-9 shrink-0 text-right">{r.activePercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0">% Seconds</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${r.inputActivePercent}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-9 shrink-0 text-right">{r.inputActivePercent}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 dark:border-gray-800/50 text-center">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Idle Deduction</div>
                  <div className="text-sm font-semibold text-rose-500">{formatDuration(r.idleSeconds)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Incl. Idle</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatDuration(r.totalSeconds)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Sessions</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{r.sessionCount}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Screenshots</div>
                  <Link to={`/tracking/screenshots?userId=${r.user.id}`} className="text-sm font-bold text-indigo-500">View →</Link>
                </div>
              </div>
            </div>
          ))}
          {data && (
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">TOTAL ({data.totals.employeesWorked} employees)</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Active: <span className="font-bold text-gray-900 dark:text-white">{formatDuration(data.totals.activeSeconds)}</span></span>
                <span className="text-gray-500 dark:text-gray-400">Idle: <span className="font-bold text-rose-500">{formatDuration(data.totals.idleSeconds)}</span></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmployeeSummaryPage() {
  return (
    <TrackingPageShell
      title="Employee Summary"
      subtitle="Aggregated work hours and activity for your team."
      icon={Icon}
      phaseNote=""
    >
      <SummaryContent />
    </TrackingPageShell>
  );
}
