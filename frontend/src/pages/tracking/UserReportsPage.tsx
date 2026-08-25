import { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { TrackingPageShell } from './TrackingPageShell';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
  </svg>
);

interface Member {
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

interface SessionRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
  activeSeconds: number;
  idleSeconds: number;
  workMode: 'WFO' | 'WFH';
  task: { id: string; title: string } | null;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function downloadCSV(memberLabel: string, rows: SessionRow[]) {
  const header = ['Date', 'Start', 'End', 'Task', 'Work Mode', 'Active Time', 'Idle Time'];
  const csvRows = rows.map(s => [
    new Date(s.startedAt).toLocaleDateString(),
    new Date(s.startedAt).toLocaleTimeString(),
    s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : 'In progress',
    s.task?.title || '—',
    s.workMode,
    formatDuration(s.activeSeconds),
    formatDuration(s.idleSeconds),
  ]);
  const csv = [header, ...csvRows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${memberLabel.replace(/\s+/g, '-').toLowerCase()}-report-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startDate, setStartDate] = useState(weekAgoStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrg?.id) return;
    api.get<{ success: boolean; data: Member[] }>(`/organizations/${currentOrg.id}/members`)
      .then(res => {
        setMembers(res.data.data);
        if (res.data.data.length > 0) setSelectedUserId(res.data.data[0].userId);
      })
      .catch(err => console.error('Failed to load members:', err));
  }, [currentOrg?.id]);

  const load = useCallback(async () => {
    if (!currentOrg?.id || !selectedUserId) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: SessionRow[] }>('/tracker/sessions', {
        params: { orgId: currentOrg.id, userId: selectedUserId, startDate: new Date(startDate).toISOString(), endDate: new Date(endDate + 'T23:59:59').toISOString() },
      });
      setSessions(res.data.data);
    } catch (err) {
      console.error('Failed to load user report:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, selectedUserId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const selectedMember = members.find(m => m.userId === selectedUserId);
  const totalActive = sessions.reduce((sum, s) => sum + s.activeSeconds, 0);
  const totalIdle = sessions.reduce((sum, s) => sum + s.idleSeconds, 0);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Employee</label>
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200 dark:[color-scheme:dark]">
            {members.map(m => (
              <option key={m.userId} value={m.userId}>{m.user.firstName} {m.user.lastName}</option>
            ))}
          </select>
        </div>
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
        <button onClick={load} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
          Refresh
        </button>
        <div className="flex-1" />
        <button
          onClick={() => selectedMember && downloadCSV(`${selectedMember.user.firstName} ${selectedMember.user.lastName}`, sessions)}
          disabled={sessions.length === 0}
          className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors"
        >
          Download CSV
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-emerald-600 text-white rounded-2xl p-4">
            <div className="text-2xl font-black">{formatDuration(totalActive)}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">Total Active Time</div>
          </div>
          <div className="bg-rose-500 text-white rounded-2xl p-4">
            <div className="text-2xl font-black">{formatDuration(totalIdle)}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">Total Idle Time</div>
          </div>
        </div>
      )}

      {loading && <div className="px-4 py-10 text-center text-gray-400 text-sm">Loading...</div>}
      {!loading && sessions.length === 0 && (
        <div className="px-4 py-10 text-center text-gray-400 text-sm bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 mb-6">No sessions for this employee in this range.</div>
      )}

      {/* Desktop table */}
      {!loading && sessions.length > 0 && (
        <div className="hidden md:block bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[calc(100vh-320px)] mb-6">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E2530] z-10">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-4 py-3 font-bold">Date</th>
                <th className="text-left px-3 py-3 font-bold">Start → End</th>
                <th className="text-left px-3 py-3 font-bold">Task</th>
                <th className="text-left px-3 py-3 font-bold">Mode</th>
                <th className="text-right px-3 py-3 font-bold">Active</th>
                <th className="text-right px-4 py-3 font-bold">Idle</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{new Date(s.startedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-500 font-semibold">In progress</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{s.task?.title || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.workMode === 'WFO' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                      {s.workMode}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatDuration(s.activeSeconds)}</td>
                  <td className="px-4 py-3 text-right text-rose-500 font-semibold whitespace-nowrap">{formatDuration(s.idleSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && sessions.length > 0 && (
        <div className="md:hidden space-y-3 mb-6">
          {sessions.map(s => (
            <div key={s.id} className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white">{new Date(s.startedAt).toLocaleDateString()}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.workMode === 'WFO' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                  {s.workMode}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-500 font-semibold">In progress</span>}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate">{s.task?.title || 'No task'}</div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Active</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDuration(s.activeSeconds)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Idle</div>
                  <div className="text-sm font-bold text-rose-500">{formatDuration(s.idleSeconds)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UserReportsPage() {
  return (
    <TrackingPageShell
      title="User Reports"
      subtitle="Exportable hours reports per employee and date range."
      icon={Icon}
      phaseNote=""
    >
      <ReportsContent />
    </TrackingPageShell>
  );
}
