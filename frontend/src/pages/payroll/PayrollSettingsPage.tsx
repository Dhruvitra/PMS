import { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { PayrollPageShell } from './PayrollPageShell';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

type SaturdayRule = 'ALL_OFF' | 'ALL_WORKING' | 'CUSTOM';
type DayRateMode = 'FIXED_30' | 'ACTUAL_WORKING_DAYS';
type AttendanceMode = 'DAYS' | 'HOURS';

interface Settings {
  weeklyOffDays: number[];
  saturdayRule: SaturdayRule;
  saturdayWorkingOccurrences: number[];
  dayRateMode: DayRateMode;
  attendanceMode: AttendanceMode;
  standardHoursPerDay: number;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const SATURDAY_OCCURRENCE_CHIPS = [
  { value: 1, label: '1st Saturday' },
  { value: 2, label: '2nd Saturday' },
  { value: 3, label: '3rd Saturday' },
  { value: 4, label: '4th Saturday' },
  { value: -2, label: '2nd-Last Saturday' },
  { value: -1, label: 'Last Saturday' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function SettingsContent() {
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [newHolidayDate, setNewHolidayDate] = useState(todayStr());
  const [newHolidayName, setNewHolidayName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [settingsRes, holidaysRes] = await Promise.all([
        api.get<{ success: boolean; data: Settings }>('/payroll/settings', { params: { orgId: currentOrg.id } }),
        api.get<{ success: boolean; data: Holiday[] }>('/payroll/holidays', { params: { orgId: currentOrg.id, year } }),
      ]);
      setSettings(settingsRes.data.data);
      setHolidays(holidaysRes.data.data);
    } catch (err) {
      console.error('Failed to load payroll settings:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, year]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (next: Settings) => {
    if (!currentOrg?.id) return;
    setSettings(next);
    setSaving(true);
    try {
      await api.put('/payroll/settings', next, { params: { orgId: currentOrg.id } });
    } catch (err) {
      console.error('Failed to save payroll settings:', err);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleWeeklyOff = (day: number) => {
    if (!settings) return;
    const next = settings.weeklyOffDays.includes(day)
      ? settings.weeklyOffDays.filter(d => d !== day)
      : [...settings.weeklyOffDays, day];
    saveSettings({ ...settings, weeklyOffDays: next });
  };

  const toggleSaturdayOccurrence = (val: number) => {
    if (!settings) return;
    const next = settings.saturdayWorkingOccurrences.includes(val)
      ? settings.saturdayWorkingOccurrences.filter(v => v !== val)
      : [...settings.saturdayWorkingOccurrences, val];
    saveSettings({ ...settings, saturdayWorkingOccurrences: next });
  };

  const addHoliday = async () => {
    if (!currentOrg?.id || !newHolidayName.trim()) return;
    try {
      await api.post('/payroll/holidays', { date: newHolidayDate, name: newHolidayName.trim() }, { params: { orgId: currentOrg.id } });
      setNewHolidayName('');
      load();
    } catch (err) {
      console.error('Failed to add holiday:', err);
      alert('Failed to add holiday. Please try again.');
    }
  };

  const deleteHoliday = async (id: string) => {
    if (!currentOrg?.id) return;
    if (!window.confirm('Remove this holiday?')) return;
    try {
      await api.delete(`/payroll/holidays/${id}`, { params: { orgId: currentOrg.id } });
      setHolidays(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('Failed to delete holiday:', err);
    }
  };

  if (loading || !settings) {
    return <div className="text-center text-gray-400 text-sm py-10">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Weekly Off Days */}
      <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Weekly Off Days</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Days that are always off, every week (e.g. Sunday).</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(w => (
            <button
              key={w.value}
              onClick={() => toggleWeeklyOff(w.value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                settings.weeklyOffDays.includes(w.value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Saturday Rule */}
      <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Saturday Rule</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saturdays vary by company &mdash; set exactly how yours works.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { value: 'ALL_OFF', label: 'All Saturdays Off' },
            { value: 'ALL_WORKING', label: 'All Saturdays Working' },
            { value: 'CUSTOM', label: 'Custom' },
          ] as { value: SaturdayRule; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => saveSettings({ ...settings, saturdayRule: opt.value })}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                settings.saturdayRule === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {settings.saturdayRule === 'CUSTOM' && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Which Saturdays are WORKING days:</p>
            <div className="flex flex-wrap gap-2">
              {SATURDAY_OCCURRENCE_CHIPS.map(chip => (
                <button
                  key={chip.value}
                  onClick={() => toggleSaturdayOccurrence(chip.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    settings.saturdayWorkingOccurrences.includes(chip.value)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Salary Calculation Method */}
      <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Salary Calculation Method</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Pay based on whether they showed up, or proportional to actual tracked hours.</p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'DAYS', label: 'Based on Days Present' },
            { value: 'HOURS', label: 'Based on Hours Tracked' },
          ] as { value: AttendanceMode; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => saveSettings({ ...settings, attendanceMode: opt.value })}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                settings.attendanceMode === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {saving && <p className="text-[11px] text-gray-400 mt-3">Saving...</p>}
      </div>

      {/* Salary Rate Basis -- same underlying choice for both modes: a fixed monthly baseline vs
          this month's actual working days. In Hours mode this also gets divided by Standard Work
          Day below to produce an hourly rate (e.g. Fixed 30 -> salary / 30 / hours-per-day). */}
      <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          {settings.attendanceMode === 'DAYS' ? 'Per-Day Salary Rate' : 'Per-Hour Salary Rate Basis'}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {settings.attendanceMode === 'DAYS'
            ? "How the daily rate is derived from an employee's monthly salary."
            : "How the hourly rate is derived from an employee's monthly salary. Fixed 30 keeps the rate constant year-round (salary ÷ 30 ÷ hours/day); Actual Working Days recalculates it every month based on that month's working-day count."}
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'FIXED_30', label: 'Monthly ÷ Fixed 30' },
            { value: 'ACTUAL_WORKING_DAYS', label: 'Monthly ÷ Actual Working Days' },
          ] as { value: DayRateMode; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => saveSettings({ ...settings, dayRateMode: opt.value })}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                settings.dayRateMode === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {settings.attendanceMode === 'HOURS' && (
        /* Standard hours per working day, used for Target Hours and to turn the rate above into an hourly figure */
        <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Standard Work Day</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Expected hours per working day. Target hours for the month = working days &times; this number.
            Holidays and paid leave are always credited in full, regardless of tracking.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={24}
              value={settings.standardHoursPerDay}
              onChange={e => saveSettings({ ...settings, standardHoursPerDay: Math.max(1, Math.min(24, Number(e.target.value) || 8)) })}
              className="w-24 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent dark:text-gray-200"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 font-semibold">hours / day</span>
          </div>
        </div>
      )}

      {/* Holiday Calendar */}
      <div className="bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Holiday Calendar</h2>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent dark:text-gray-200 dark:[color-scheme:dark]">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Festival/holiday dates &mdash; counted as paid, never as absence.</p>

        <div className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Date</label>
            <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-transparent dark:text-gray-200" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Name</label>
            <input type="text" placeholder="e.g. Diwali" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-transparent dark:text-gray-200" />
          </div>
          <button onClick={addHoliday} disabled={!newHolidayName.trim()}
            className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors">
            Add Holiday
          </button>
        </div>

        {holidays.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-6">No holidays added for {year} yet.</div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800/50">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-28">
                    {new Date(h.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{h.name}</span>
                </div>
                <button onClick={() => deleteHoliday(h.id)} className="text-xs font-bold text-rose-500 hover:text-rose-600">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PayrollSettingsPage() {
  return (
    <PayrollPageShell title="Payroll Settings" subtitle="Configure your company's work calendar and pay rules." icon={Icon}>
      <SettingsContent />
    </PayrollPageShell>
  );
}
