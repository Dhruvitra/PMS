import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';

interface Company {
  id: string;
  name: string;
  slug: string;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  plan: { id: string; name: string; storageLimitGB: number } | null;
  freeAccessNote: string | null;
  memberCount: number;
  createdAt: string;
  storageUsedBytes: number;
}

interface Plan {
  id: string;
  name: string;
  priceInPaise: number;
  storageLimitGB: number;
}

interface Stats {
  totalCompanies: number;
  totalUsers: number;
  statusCounts: Record<string, number>;
}

interface ServerHealth {
  cpuUsagePercent: number;
  memory: { totalBytes: number; usedBytes: number; usedPercent: number };
  disk: { totalBytes: number; usedBytes: number; usedPercent: number } | null;
  uptimeSeconds: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB';
  const gb = bytes / (1024 ** 3);
  if (gb < 0.01) return '<0.01 GB';
  return `${gb.toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

const STATUS_STYLES: Record<Company['status'], string> = {
  PENDING_PAYMENT: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  ACTIVE: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  SUSPENDED: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  REJECTED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function GaugeBar({ percent, warn = 70, danger = 90 }: { percent: number; warn?: number; danger?: number }) {
  const color = percent >= danger ? 'bg-rose-500' : percent >= warn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [freeAccessTarget, setFreeAccessTarget] = useState<Company | null>(null);
  const [freeAccessNote, setFreeAccessNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, plansRes, statsRes, healthRes] = await Promise.all([
        api.get<{ success: boolean; data: Company[] }>('/platform-admin/companies'),
        api.get<{ success: boolean; data: Plan[] }>('/plans'),
        api.get<{ success: boolean; data: Stats }>('/platform-admin/stats'),
        api.get<{ success: boolean; data: ServerHealth }>('/platform-admin/server-health'),
      ]);
      setCompanies(companiesRes.data.data);
      setPlans(plansRes.data.data);
      setStats(statsRes.data.data);
      setHealth(healthRes.data.data);
    } catch (err) {
      console.error('Failed to load platform admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ success: boolean; data: ServerHealth }>('/platform-admin/server-health');
        setHealth(res.data.data);
      } catch { /* ignore transient poll failures */ }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id: string, status: Company['status']) => {
    setBusyId(id);
    try {
      await api.patch(`/platform-admin/companies/${id}/status`, { status });
      await load();
    } catch (err) {
      console.error('Failed to update company status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const grantFreeAccess = async () => {
    if (!freeAccessTarget) return;
    setBusyId(freeAccessTarget.id);
    try {
      await api.post(`/platform-admin/companies/${freeAccessTarget.id}/grant-free-access`, { note: freeAccessNote || undefined });
      setFreeAccessTarget(null);
      setFreeAccessNote('');
      await load();
    } catch (err) {
      console.error('Failed to grant free access:', err);
      alert('Failed to grant free access. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const revertToPlan = async (id: string, planId: string) => {
    setBusyId(id);
    try {
      await api.post(`/platform-admin/companies/${id}/revert-to-plan`, { planId });
      await load();
    } catch (err) {
      console.error('Failed to revert to plan:', err);
      alert('Failed to revert to plan. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="Loading platform data…" />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-3 sm:p-4 md:p-8 max-w-7xl mx-auto bg-gray-50/30 dark:bg-transparent font-sans flex flex-col custom-scrollbar">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1 italic">Platform Admin</h1>
        <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] sm:text-[11px] tracking-widest">Every company on the platform, growth stats, and server health.</p>
      </div>

      {/* Growth stats + server health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {stats && (
          <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Growth</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Companies</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalCompanies}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Users</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Active</p>
                <p className="text-lg font-bold text-emerald-600">{stats.statusCounts.ACTIVE || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Pending Payment</p>
                <p className="text-lg font-bold text-amber-600">{stats.statusCounts.PENDING_PAYMENT || 0}</p>
              </div>
            </div>
          </div>
        )}

        {health && (
          <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Server Health</h2>
              <span className="text-[10px] font-bold text-gray-400">Uptime {formatUptime(health.uptimeSeconds)}</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                  <span>CPU</span><span>{health.cpuUsagePercent}%</span>
                </div>
                <GaugeBar percent={health.cpuUsagePercent} />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                  <span>Memory</span><span>{formatBytes(health.memory.usedBytes)} / {formatBytes(health.memory.totalBytes)}</span>
                </div>
                <GaugeBar percent={health.memory.usedPercent} />
              </div>
              {health.disk && (
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                    <span>Disk</span><span>{formatBytes(health.disk.usedBytes)} / {formatBytes(health.disk.totalBytes)}</span>
                  </div>
                  <GaugeBar percent={health.disk.usedPercent} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Companies table */}
      <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-3 py-3">Status</th>
              <th className="text-left px-3 py-3">Plan</th>
              <th className="text-right px-3 py-3">Storage Used</th>
              <th className="text-right px-3 py-3">Members</th>
              <th className="text-left px-3 py-3">Signed Up</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900 dark:text-white">{c.name}</div>
                  <div className="text-[11px] text-gray-400">{c.slug}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLES[c.status]}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {c.plan ? (
                    <span className="text-gray-700 dark:text-gray-300">{c.plan.name} ({c.plan.storageLimitGB}GB)</span>
                  ) : (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold" title={c.freeAccessNote || undefined}>
                      Unlimited{c.freeAccessNote ? ` — ${c.freeAccessNote}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-300">{formatBytes(c.storageUsedBytes)}</td>
                <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-300">{c.memberCount}</td>
                <td className="px-3 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {c.status === 'PENDING_PAYMENT' && (
                      <Button size="sm" variant="primary" disabled={busyId === c.id} onClick={() => updateStatus(c.id, 'ACTIVE')}>Approve</Button>
                    )}
                    {c.status !== 'REJECTED' && c.status !== 'ACTIVE' && (
                      <Button size="sm" variant="danger" disabled={busyId === c.id} onClick={() => updateStatus(c.id, 'REJECTED')}>Reject</Button>
                    )}
                    {c.status === 'ACTIVE' && (
                      <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => updateStatus(c.id, 'SUSPENDED')}>Suspend</Button>
                    )}
                    {c.status === 'SUSPENDED' && (
                      <Button size="sm" variant="primary" disabled={busyId === c.id} onClick={() => updateStatus(c.id, 'ACTIVE')}>Reactivate</Button>
                    )}
                    {c.plan ? (
                      <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => setFreeAccessTarget(c)}>Grant Free Access</Button>
                    ) : (
                      plans.length > 0 && (
                        <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => revertToPlan(c.id, plans[0].id)} title={`Revert to ${plans[0].name}`}>
                          Revert to Plan
                        </Button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grant free access modal */}
      {freeAccessTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setFreeAccessTarget(null)}>
          <div className="bg-white dark:bg-[#1E2530] rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Grant Free Access</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {freeAccessTarget.name} will no longer be tied to a paid plan (unlimited/internal, same as Shreeji Software). This note is for your own records — not shown to the company.
            </p>
            <textarea
              value={freeAccessNote}
              onChange={e => setFreeAccessNote(e.target.value)}
              placeholder="e.g. beta partner, friend of the business"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent dark:text-gray-200 mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFreeAccessTarget(null)}>Cancel</Button>
              <Button variant="primary" disabled={busyId === freeAccessTarget.id} onClick={grantFreeAccess}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
