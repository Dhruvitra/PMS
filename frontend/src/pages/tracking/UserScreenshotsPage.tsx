import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { TrackingPageShell } from './TrackingPageShell';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="14" rx="2" strokeWidth="2.5" />
    <circle cx="8.5" cy="9.5" r="1.5" strokeWidth="2.5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 15l-5-5L5 21" />
  </svg>
);

interface Member {
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

interface Screenshot {
  id: string;
  sessionId: string;
  imageUrl: string;
  capturedAt: string;
  session?: { user: { id: string; firstName: string; lastName: string; avatarUrl: string | null } };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ScreenshotsContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get('userId') || '');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewShot, setPreviewShot] = useState<Screenshot | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) return;
    api.get<{ success: boolean; data: Member[] }>(`/organizations/${currentOrg.id}/members`)
      .then(res => setMembers(res.data.data))
      .catch(err => console.error('Failed to load members:', err));
  }, [currentOrg?.id]);

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Screenshot[] }>('/tracker/screenshots', {
        params: {
          orgId: currentOrg.id,
          ...(selectedUserId ? { userId: selectedUserId } : {}),
          startDate: new Date(startDate + 'T00:00:00').toISOString(),
          endDate: new Date(endDate + 'T23:59:59.999').toISOString(),
        },
      });
      setScreenshots(res.data.data);
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, selectedUserId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setSearchParams(userId ? { userId } : {});
  };

  const handleDelete = async (screenshot: Screenshot) => {
    if (!currentOrg?.id) return;
    if (!window.confirm('Delete this screenshot? This cannot be undone.')) return;
    try {
      await api.delete(`/tracker/screenshots/${screenshot.id}`, { params: { orgId: currentOrg.id } });
      setScreenshots(prev => prev.filter(s => s.id !== screenshot.id));
      setPreviewShot(current => (current?.id === screenshot.id ? null : current));
    } catch (err) {
      console.error('Failed to delete screenshot:', err);
      alert('Failed to delete screenshot. Please try again.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Employee</label>
          <select value={selectedUserId} onChange={e => handleUserChange(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200 dark:[color-scheme:dark]">
            <option value="">All Employees</option>
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
        <span className="text-xs text-gray-400 font-semibold">{screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
        {loading && <div className="text-center text-gray-400 text-sm py-10">Loading...</div>}
        {!loading && screenshots.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10">No screenshots {selectedUserId ? 'for this employee' : 'for anyone'} in this range.</div>
        )}
        {!loading && screenshots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {screenshots.map(s => (
              <div key={s.id} className="group relative text-left">
                <button onClick={() => setPreviewShot(s)} className="block w-full text-left">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <img src={s.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    {!selectedUserId && s.session?.user && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold truncate max-w-[85%]">
                        {s.session.user.firstName} {s.session.user.lastName}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                    {new Date(s.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                  title="Delete screenshot"
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewShot && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewShot(null)}>
          {!selectedUserId && previewShot.session?.user && (
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm font-bold">
              {previewShot.session.user.firstName} {previewShot.session.user.lastName}
            </div>
          )}
          <img src={previewShot.imageUrl} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(previewShot); }}
            title="Delete screenshot"
            className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z" />
            </svg>
          </button>
          <button onClick={() => setPreviewShot(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function UserScreenshotsPage() {
  return (
    <TrackingPageShell
      title="User Screenshots"
      subtitle="Review desktop captures taken every 3 minutes while active."
      icon={Icon}
      phaseNote=""
    >
      <ScreenshotsContent />
    </TrackingPageShell>
  );
}
