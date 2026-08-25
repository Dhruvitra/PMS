import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { PayrollPageShell } from './PayrollPageShell';
import { Avatar } from '../../components/ui/Avatar';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m1-9a1 1 0 001 1h6a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
);

interface UserRef { id: string; firstName: string; lastName: string; avatarUrl: string | null }

interface RangeRow {
  user: UserRef;
  hasSalarySet: boolean;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  offDays: number;
  holidayDays: number;
  paidLeaveDays: number;
  targetHours: number;
  actualHours: number;
  rate: number;
  earnedAmount: number;
}

interface PreviewRow {
  user: UserRef;
  hasSalarySet: boolean;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  offDays: number;
  holidayDays: number;
  paidLeaveDays: number;
  targetHours: number;
  actualHours: number;
  perDayRate: number;
  grossSalary: number;
  deductions: number;
  bonus: number;
  netPayable: number;
}

interface FinalizedRecord {
  id: string;
  userId: string;
  user: UserRef;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  offDays: number;
  holidayDays: number;
  paidLeaveDays: number;
  targetHours: string;
  actualHours: string;
  perDayRate: string;
  grossSalary: string;
  deductions: string;
  bonus: string;
  netPayable: string;
  notes: string | null;
}

interface FinalizedRun {
  id: string;
  month: string;
  status: 'DRAFT' | 'FINALIZED';
  finalizedAt: string | null;
  finalizedBy: { firstName: string; lastName: string } | null;
  records: FinalizedRecord[];
}

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function downloadCSV(month: string, isHoursMode: boolean, rows: { name: string; workingDays: number; presentDays: number; absentDays: number; offDays: number; holidayDays: number; targetHours: number; actualHours: number; perDayRate: number; grossSalary: number; deductions: number; bonus: number; netPayable: number }[]) {
  const header = isHoursMode
    ? ['Employee', 'Working Days', 'Off Days', 'Holidays', 'Target Hours', 'Hours Tracked', 'Per-Hour Rate', 'Gross Salary', 'Deductions', 'Bonus', 'Net Payable']
    : ['Employee', 'Working Days', 'Present', 'Absent', 'Off Days', 'Holidays', 'Per-Day Rate', 'Gross Salary', 'Deductions', 'Bonus', 'Net Payable'];
  const csvRows = rows.map(r => isHoursMode
    ? [r.name, r.workingDays, r.offDays, r.holidayDays, r.targetHours, r.actualHours, r.perDayRate, r.grossSalary, r.deductions, r.bonus, r.netPayable]
    : [r.name, r.workingDays, r.presentDays, r.absentDays, r.offDays, r.holidayDays, r.perDayRate, r.grossSalary, r.deductions, r.bonus, r.netPayable]);
  const csv = [header, ...csvRows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RunContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [month, setMonth] = useState(currentMonthStr());
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [finalizedRun, setFinalizedRun] = useState<FinalizedRun | null>(null);
  const [editing, setEditing] = useState(false);
  const [adjustments, setAdjustments] = useState<Map<string, { deductions: number; bonus: number; notes: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [isHoursMode, setIsHoursMode] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [previewRes, runRes, settingsRes] = await Promise.all([
        api.get<{ success: boolean; data: PreviewRow[] }>('/payroll/runs/preview', { params: { orgId: currentOrg.id, month } }),
        api.get<{ success: boolean; data: FinalizedRun | null }>('/payroll/runs/current', { params: { orgId: currentOrg.id, month } }),
        api.get<{ success: boolean; data: { attendanceMode: 'DAYS' | 'HOURS' } }>('/payroll/settings', { params: { orgId: currentOrg.id } }),
      ]);
      setPreviewRows(previewRes.data.data);
      setFinalizedRun(runRes.data.data);
      setIsHoursMode(settingsRes.data.data.attendanceMode === 'HOURS');
      setEditing(false);

      const seed = new Map<string, { deductions: number; bonus: number; notes: string }>();
      if (runRes.data.data) {
        for (const r of runRes.data.data.records) {
          seed.set(r.userId, { deductions: Number(r.deductions), bonus: Number(r.bonus), notes: r.notes || '' });
        }
      } else {
        for (const r of previewRes.data.data) {
          seed.set(r.user.id, { deductions: r.deductions, bonus: r.bonus, notes: '' });
        }
      }
      setAdjustments(seed);
    } catch (err) {
      console.error('Failed to load payroll run:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, month]);

  useEffect(() => { load(); }, [load]);

  const startEditing = () => {
    const seed = new Map<string, { deductions: number; bonus: number; notes: string }>();
    for (const r of previewRows) {
      const existing = finalizedRun?.records.find(rec => rec.userId === r.user.id);
      seed.set(r.user.id, existing
        ? { deductions: Number(existing.deductions), bonus: Number(existing.bonus), notes: existing.notes || '' }
        : { deductions: r.deductions, bonus: r.bonus, notes: '' });
    }
    setAdjustments(seed);
    setEditing(true);
  };

  const updateAdjustment = (userId: string, field: 'deductions' | 'bonus' | 'notes', value: string) => {
    setAdjustments(prev => {
      const next = new Map(prev);
      const existing = next.get(userId) || { deductions: 0, bonus: 0, notes: '' };
      next.set(userId, { ...existing, [field]: field === 'notes' ? value : Number(value) || 0 });
      return next;
    });
  };

  const finalize = async () => {
    if (!currentOrg?.id) return;
    if (!window.confirm(`Finalize payroll for ${month}? This locks the numbers for every employee this month.`)) return;
    setFinalizing(true);
    try {
      const payload = previewRows.filter(r => r.hasSalarySet).map(r => {
        const a = adjustments.get(r.user.id);
        return { userId: r.user.id, deductions: a?.deductions ?? r.deductions, bonus: a?.bonus ?? r.bonus, notes: a?.notes || undefined };
      });
      await api.post('/payroll/runs/finalize', { adjustments: payload }, { params: { orgId: currentOrg.id, month } });
      await load();
    } catch (err) {
      console.error('Failed to finalize payroll:', err);
      alert('Failed to finalize payroll. Please try again.');
    } finally {
      setFinalizing(false);
    }
  };

  const displayRows = useMemo(() => {
    if (finalizedRun && !editing) {
      return finalizedRun.records.map(r => ({
        user: r.user,
        hasSalarySet: true,
        workingDays: r.workingDays,
        presentDays: r.presentDays,
        absentDays: r.absentDays,
        offDays: r.offDays,
        holidayDays: r.holidayDays,
        targetHours: Number(r.targetHours),
        actualHours: Number(r.actualHours),
        perDayRate: Number(r.perDayRate),
        grossSalary: Number(r.grossSalary),
        deductions: Number(r.deductions),
        bonus: Number(r.bonus),
        netPayable: Number(r.netPayable),
      }));
    }
    return previewRows.map(r => {
      const a = adjustments.get(r.user.id);
      const deductions = a?.deductions ?? r.deductions;
      const bonus = a?.bonus ?? r.bonus;
      return { ...r, deductions, bonus, netPayable: Math.max(0, r.grossSalary - deductions + bonus) };
    });
  }, [finalizedRun, editing, previewRows, adjustments]);

  const isLocked = !!finalizedRun && !editing;
  const totalNet = displayRows.reduce((sum, r) => sum + r.netPayable, 0);

  if (loading) {
    return <div className="text-center text-gray-400 text-sm py-10">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} max={currentMonthStr()}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent dark:text-gray-200" />
        </div>
        {isLocked ? (
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            Finalized {finalizedRun?.finalizedAt ? new Date(finalizedRun.finalizedAt).toLocaleDateString() : ''}
            {finalizedRun?.finalizedBy ? ` by ${finalizedRun.finalizedBy.firstName} ${finalizedRun.finalizedBy.lastName}` : ''}
          </span>
        ) : (
          <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
            Draft &mdash; not yet finalized
          </span>
        )}
        {!isLocked && month === currentMonthStr() && (
          <span className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold" title="This month is still in progress. Numbers below only reflect days that have actually happened so far, and will keep changing daily until the month ends.">
            In progress &mdash; day {new Date().getDate()} of {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}, not a final total yet
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => downloadCSV(month, isHoursMode, displayRows.map(r => ({ name: `${r.user.firstName} ${r.user.lastName}`, workingDays: r.workingDays, presentDays: r.presentDays, absentDays: r.absentDays, offDays: r.offDays, holidayDays: r.holidayDays, targetHours: r.targetHours, actualHours: r.actualHours, perDayRate: r.perDayRate, grossSalary: r.grossSalary, deductions: r.deductions, bonus: r.bonus, netPayable: r.netPayable })))}
          className="text-sm font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
        >
          Download CSV
        </button>
        {isLocked ? (
          <button onClick={startEditing} className="text-sm font-bold text-white bg-gray-700 hover:bg-gray-800 px-4 py-1.5 rounded-lg transition-colors">
            Edit &amp; Re-finalize
          </button>
        ) : (
          <button onClick={finalize} disabled={finalizing}
            className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 py-1.5 rounded-lg transition-colors">
            {finalizing ? 'Finalizing...' : 'Finalize Payroll'}
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[calc(100vh-320px)] mb-6">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-[#1E2530] z-10">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-4 py-3 font-bold">Employee</th>
              <th className="text-right px-2 py-3 font-bold">Working</th>
              {isHoursMode ? (
                <>
                  <th className="text-right px-2 py-3 font-bold">Hours Tracked</th>
                  <th className="text-right px-2 py-3 font-bold">Target Hours</th>
                </>
              ) : (
                <>
                  <th className="text-right px-2 py-3 font-bold">Present</th>
                  <th className="text-right px-2 py-3 font-bold">Absent</th>
                </>
              )}
              <th className="text-right px-2 py-3 font-bold">Off</th>
              <th className="text-right px-2 py-3 font-bold">Holiday</th>
              <th className="text-right px-2 py-3 font-bold">{isHoursMode ? 'Per-Hour' : 'Per-Day'}</th>
              <th className="text-right px-2 py-3 font-bold">Gross</th>
              <th className="text-right px-2 py-3 font-bold">Deductions</th>
              <th className="text-right px-2 py-3 font-bold">Bonus</th>
              <th className="text-right px-4 py-3 font-bold">Net Payable</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(r => {
              const noSalary = !r.hasSalarySet;
              return (
                <tr key={r.user.id} className={`border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 ${noSalary ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={r.user.firstName} lastName={r.user.lastName} avatarUrl={r.user.avatarUrl} size="sm" />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{r.user.firstName} {r.user.lastName}</div>
                        {noSalary && <div className="text-[10px] font-bold text-rose-500">No salary set</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right text-gray-600 dark:text-gray-300">{r.workingDays}</td>
                  {isHoursMode ? (
                    <>
                      <td className="px-2 py-3 text-right text-emerald-600 font-semibold whitespace-nowrap">{r.actualHours.toFixed(1)}h</td>
                      <td className="px-2 py-3 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.targetHours.toFixed(1)}h</td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-3 text-right text-emerald-600 font-semibold">{r.presentDays}</td>
                      <td className="px-2 py-3 text-right text-rose-500 font-semibold">{r.absentDays}</td>
                    </>
                  )}
                  <td className="px-2 py-3 text-right text-gray-500 dark:text-gray-400">{r.offDays}</td>
                  <td className="px-2 py-3 text-right text-gray-500 dark:text-gray-400">{r.holidayDays}</td>
                  <td className="px-2 py-3 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatCurrency(r.perDayRate)}</td>
                  <td className="px-2 py-3 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatCurrency(r.grossSalary)}</td>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    {isLocked ? (
                      <span className="text-rose-500">{formatCurrency(r.deductions)}</span>
                    ) : (
                      <input type="number" value={adjustments.get(r.user.id)?.deductions ?? r.deductions}
                        onChange={e => updateAdjustment(r.user.id, 'deductions', e.target.value)}
                        disabled={noSalary}
                        className="w-20 text-sm text-right border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 bg-transparent dark:text-gray-200" />
                    )}
                  </td>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    {isLocked ? (
                      <span className="text-emerald-600">{formatCurrency(r.bonus)}</span>
                    ) : (
                      <input type="number" value={adjustments.get(r.user.id)?.bonus ?? r.bonus}
                        onChange={e => updateAdjustment(r.user.id, 'bonus', e.target.value)}
                        disabled={noSalary}
                        className="w-20 text-sm text-right border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 bg-transparent dark:text-gray-200" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(r.netPayable)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50/50 dark:bg-gray-900/20 font-bold border-t-2 border-gray-100 dark:border-gray-800">
              <td className="px-4 py-3" colSpan={10}>TOTAL PAYABLE</td>
              <td className="px-4 py-3 text-right">{formatCurrency(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3 mb-6">
        {displayRows.map(r => {
          const noSalary = !r.hasSalarySet;
          return (
            <div key={r.user.id} className={`bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 ${noSalary ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar firstName={r.user.firstName} lastName={r.user.lastName} avatarUrl={r.user.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">{r.user.firstName} {r.user.lastName}</div>
                    {noSalary && <div className="text-[10px] font-bold text-rose-500">No salary set</div>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Net Payable</div>
                  <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(r.netPayable)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Working</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{r.workingDays}</div>
                </div>
                {isHoursMode ? (
                  <>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Hours Tracked</div>
                      <div className="text-sm font-semibold text-emerald-600">{r.actualHours.toFixed(1)}h</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Target Hours</div>
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{r.targetHours.toFixed(1)}h</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Present</div>
                      <div className="text-sm font-semibold text-emerald-600">{r.presentDays}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Absent</div>
                      <div className="text-sm font-semibold text-rose-500">{r.absentDays}</div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Off</div>
                  <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{r.offDays}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Holiday</div>
                  <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{r.holidayDays}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{isHoursMode ? 'Per-Hour' : 'Per-Day'}</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(r.perDayRate)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Gross</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(r.grossSalary)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Deductions</div>
                  {isLocked ? (
                    <div className="text-sm font-semibold text-rose-500">{formatCurrency(r.deductions)}</div>
                  ) : (
                    <input type="number" value={adjustments.get(r.user.id)?.deductions ?? r.deductions}
                      onChange={e => updateAdjustment(r.user.id, 'deductions', e.target.value)}
                      disabled={noSalary}
                      className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent dark:text-gray-200" />
                  )}
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bonus</div>
                  {isLocked ? (
                    <div className="text-sm font-semibold text-emerald-600">{formatCurrency(r.bonus)}</div>
                  ) : (
                    <input type="number" value={adjustments.get(r.user.id)?.bonus ?? r.bonus}
                      onChange={e => updateAdjustment(r.user.id, 'bonus', e.target.value)}
                      disabled={noSalary}
                      className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent dark:text-gray-200" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between font-bold">
          <span className="text-sm text-gray-700 dark:text-gray-300">Total Payable</span>
          <span className="text-gray-900 dark:text-white">{formatCurrency(totalNet)}</span>
        </div>
      </div>
    </div>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Read-only attendance + earned-amount preview for an arbitrary date range -- distinct from the
 *  monthly Finalize/Deductions/Bonus workflow above, which is always a full calendar month. Useful
 *  for checking a custom period (e.g. a mid-month advance) without touching that flow. */
function RangeContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [endDate, setEndDate] = useState(todayStr());
  const [rows, setRows] = useState<RangeRow[]>([]);
  const [isHoursMode, setIsHoursMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [rangeRes, settingsRes] = await Promise.all([
        api.get<{ success: boolean; data: RangeRow[] }>('/payroll/runs/preview-range', { params: { orgId: currentOrg.id, startDate, endDate } }),
        api.get<{ success: boolean; data: { attendanceMode: 'DAYS' | 'HOURS' } }>('/payroll/settings', { params: { orgId: currentOrg.id } }),
      ]);
      setRows(rangeRes.data.data);
      setIsHoursMode(settingsRes.data.data.attendanceMode === 'HOURS');
    } catch (err) {
      console.error('Failed to load date-range preview:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const totalEarned = rows.reduce((sum, r) => sum + r.earnedAmount, 0);

  return (
    <div className="flex-1 flex flex-col">
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
        <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold">
          Read-only &mdash; not a payroll run, no Finalize
        </span>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-10">Loading...</div>
      ) : (
        <>
          <div className="hidden lg:block bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[calc(100vh-320px)] mb-6">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-[#1E2530] z-10">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-3 font-bold">Employee</th>
                  <th className="text-right px-2 py-3 font-bold">Working</th>
                  {isHoursMode ? (
                    <>
                      <th className="text-right px-2 py-3 font-bold">Hours Tracked</th>
                      <th className="text-right px-2 py-3 font-bold">Target Hours</th>
                    </>
                  ) : (
                    <>
                      <th className="text-right px-2 py-3 font-bold">Present</th>
                      <th className="text-right px-2 py-3 font-bold">Absent</th>
                    </>
                  )}
                  <th className="text-right px-2 py-3 font-bold">Off</th>
                  <th className="text-right px-2 py-3 font-bold">Holiday</th>
                  <th className="text-right px-2 py-3 font-bold">{isHoursMode ? 'Per-Hour' : 'Per-Day'}</th>
                  <th className="text-right px-4 py-3 font-bold">Earned Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const noSalary = !r.hasSalarySet;
                  return (
                    <tr key={r.user.id} className={`border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 ${noSalary ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar firstName={r.user.firstName} lastName={r.user.lastName} avatarUrl={r.user.avatarUrl} size="sm" />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{r.user.firstName} {r.user.lastName}</div>
                            {noSalary && <div className="text-[10px] font-bold text-rose-500">No salary set</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right text-gray-600 dark:text-gray-300">{r.workingDays}</td>
                      {isHoursMode ? (
                        <>
                          <td className="px-2 py-3 text-right text-emerald-600 font-semibold whitespace-nowrap">{r.actualHours.toFixed(1)}h</td>
                          <td className="px-2 py-3 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.targetHours.toFixed(1)}h</td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-3 text-right text-emerald-600 font-semibold">{r.presentDays}</td>
                          <td className="px-2 py-3 text-right text-rose-500 font-semibold">{r.absentDays}</td>
                        </>
                      )}
                      <td className="px-2 py-3 text-right text-gray-500 dark:text-gray-400">{r.offDays}</td>
                      <td className="px-2 py-3 text-right text-gray-500 dark:text-gray-400">{r.holidayDays}</td>
                      <td className="px-2 py-3 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatCurrency(r.rate)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(r.earnedAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/50 dark:bg-gray-900/20 font-bold border-t-2 border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3" colSpan={7}>TOTAL EARNED (this period)</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totalEarned)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3 mb-6">
            {rows.map(r => {
              const noSalary = !r.hasSalarySet;
              return (
                <div key={r.user.id} className={`bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 ${noSalary ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar firstName={r.user.firstName} lastName={r.user.lastName} avatarUrl={r.user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{r.user.firstName} {r.user.lastName}</div>
                        {noSalary && <div className="text-[10px] font-bold text-rose-500">No salary set</div>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Earned</div>
                      <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(r.earnedAmount)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Working</div>
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{r.workingDays}</div>
                    </div>
                    {isHoursMode ? (
                      <>
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Hours Tracked</div>
                          <div className="text-sm font-semibold text-emerald-600">{r.actualHours.toFixed(1)}h</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Target Hours</div>
                          <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{r.targetHours.toFixed(1)}h</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Present</div>
                          <div className="text-sm font-semibold text-emerald-600">{r.presentDays}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Absent</div>
                          <div className="text-sm font-semibold text-rose-500">{r.absentDays}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between font-bold">
              <span className="text-sm text-gray-700 dark:text-gray-300">Total Earned (this period)</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(totalEarned)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function PayrollRunPage() {
  const [mode, setMode] = useState<'month' | 'range'>('month');
  return (
    <PayrollPageShell title="Run Payroll" subtitle="Review attendance and finalize monthly pay." icon={Icon}>
      <div className="flex items-center gap-2 mb-4">
        {([
          { value: 'month', label: 'Month' },
          { value: 'range', label: 'Date Range' },
        ] as { value: 'month' | 'range'; label: string }[]).map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              mode === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === 'month' ? <RunContent /> : <RangeContent />}
    </PayrollPageShell>
  );
}
