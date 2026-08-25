import { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { PayrollPageShell } from './PayrollPageShell';
import { Avatar } from '../../components/ui/Avatar';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2v8m0 0v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface Member {
  userId: string;
  role: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

interface SalaryRow {
  userId: string;
  monthlyAmount: string;
  effectiveFrom: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function SalaryMasterContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [members, setMembers] = useState<Member[]>([]);
  const [salaries, setSalaries] = useState<Map<string, SalaryRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editEffectiveFrom, setEditEffectiveFrom] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [membersRes, salariesRes] = await Promise.all([
        api.get<{ success: boolean; data: Member[] }>(`/organizations/${currentOrg.id}/members`),
        api.get<{ success: boolean; data: SalaryRow[] }>('/payroll/salaries', { params: { orgId: currentOrg.id } }),
      ]);
      setMembers(membersRes.data.data.filter(m => m.role !== 'OWNER'));
      setSalaries(new Map(salariesRes.data.data.map(s => [s.userId, s])));
    } catch (err) {
      console.error('Failed to load salary master:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (m: Member) => {
    setEditingUserId(m.userId);
    const existing = salaries.get(m.userId);
    setEditAmount(existing ? existing.monthlyAmount : '');
    setEditEffectiveFrom(todayStr());
  };

  const saveSalary = async (userId: string) => {
    if (!currentOrg?.id || !editAmount) return;
    setSaving(true);
    try {
      await api.post('/payroll/salaries', {
        userId,
        monthlyAmount: Number(editAmount),
        effectiveFrom: editEffectiveFrom,
      }, { params: { orgId: currentOrg.id } });
      setEditingUserId(null);
      load();
    } catch (err) {
      console.error('Failed to save salary:', err);
      alert('Failed to save salary. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400 text-sm py-10">Loading...</div>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[calc(100vh-280px)]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-[#1E2530] z-10">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-4 py-3 font-bold">Employee</th>
              <th className="text-right px-3 py-3 font-bold">Current Monthly Salary</th>
              <th className="text-right px-3 py-3 font-bold">Effective From</th>
              <th className="text-right px-4 py-3 font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const salary = salaries.get(m.userId);
              const isEditing = editingUserId === m.userId;
              return (
                <tr key={m.userId} className="border-b border-gray-50 dark:border-gray-800/50 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={m.user.firstName} lastName={m.user.lastName} avatarUrl={m.user.avatarUrl} size="sm" />
                      <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{m.user.firstName} {m.user.lastName}</span>
                    </div>
                  </td>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-3 text-right">
                        <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus
                          placeholder="Amount"
                          className="w-32 text-sm text-right border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent dark:text-gray-200" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input type="date" value={editEffectiveFrom} onChange={e => setEditEffectiveFrom(e.target.value)}
                          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent dark:text-gray-200" />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => saveSalary(m.userId)} disabled={saving || !editAmount}
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 rounded-lg mr-2">
                          Save
                        </button>
                        <button onClick={() => setEditingUserId(null)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {salary ? formatCurrency(Number(salary.monthlyAmount)) : <span className="text-gray-400 font-normal">Not set</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {salary ? new Date(salary.effectiveFrom).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(m)} className="text-xs font-bold text-indigo-500 hover:underline">
                          {salary ? 'Update' : 'Set Salary'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {members.map(m => {
          const salary = salaries.get(m.userId);
          const isEditing = editingUserId === m.userId;
          return (
            <div key={m.userId} className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar firstName={m.user.firstName} lastName={m.user.lastName} avatarUrl={m.user.avatarUrl} size="sm" />
                <span className="font-semibold text-gray-900 dark:text-white truncate">{m.user.firstName} {m.user.lastName}</span>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus
                    placeholder="Monthly amount"
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent dark:text-gray-200" />
                  <input type="date" value={editEffectiveFrom} onChange={e => setEditEffectiveFrom(e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent dark:text-gray-200" />
                  <div className="flex gap-2">
                    <button onClick={() => saveSalary(m.userId)} disabled={saving || !editAmount}
                      className="flex-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-2 rounded-lg">
                      Save
                    </button>
                    <button onClick={() => setEditingUserId(null)} className="flex-1 text-xs font-bold text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                      {salary ? `Since ${new Date(salary.effectiveFrom).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'Not set'}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {salary ? formatCurrency(Number(salary.monthlyAmount)) : <span className="text-gray-400 text-sm font-normal">No salary set</span>}
                    </div>
                  </div>
                  <button onClick={() => startEdit(m)} className="text-xs font-bold text-indigo-500 shrink-0">
                    {salary ? 'Update' : 'Set Salary'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function SalaryMasterPage() {
  return (
    <PayrollPageShell title="Salary Master" subtitle="Set each employee's monthly salary." icon={Icon}>
      <SalaryMasterContent />
    </PayrollPageShell>
  );
}
