import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getQuickDates() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();

  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + ((8 - dayOfWeek) % 7 || 7));
  const nextWeekend = new Date(today); nextWeekend.setDate(today.getDate() + ((6 - dayOfWeek + 7) % 7 || 7));
  const twoWeeks = new Date(today); twoWeeks.setDate(today.getDate() + 14);
  const fourWeeks = new Date(today); fourWeeks.setDate(today.getDate() + 28);

  const dShort = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mShort = (d: Date) => `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;

  return [
    { label: 'Today', hint: dShort(today), date: today },
    { label: 'Tomorrow', hint: dShort(tomorrow), date: tomorrow },
    { label: 'Next week', hint: dShort(nextWeek), date: nextWeek },
    { label: 'Next weekend', hint: mShort(nextWeekend), date: nextWeekend },
    { label: '2 weeks', hint: mShort(twoWeeks), date: twoWeeks },
    { label: '4 weeks', hint: mShort(fourWeeks), date: fourWeeks },
  ];
}

export interface DatePickerPopupProps {
  selectedDate: string | null;
  onChange: (iso: string) => void;
  onClear: () => void;
  onClose: () => void;
  /** Optional position override; defaults to absolute top-full left-0 */
  positionClass?: string;
}

/**
 * Shared date+time picker. Closes on outside-click or after a calendar-day click.
 * Time inputs DO NOT close the popup so users can type freely.
 */
export default function DatePickerPopup({ selectedDate, onChange, onClear, onClose, positionClass }: DatePickerPopupProps) {
  const now = new Date();
  const sel = selectedDate ? new Date(selectedDate) : null;

  const [viewYear, setViewYear] = useState(sel ? sel.getFullYear() : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel ? sel.getMonth() : now.getMonth());

  const initHr = sel ? sel.getHours() : 9;
  const [hour12, setHour12] = useState<string>(String(((initHr % 12) || 12)).padStart(2, '0'));
  const [minute, setMinute] = useState<string>(sel ? String(sel.getMinutes()).padStart(2, '0') : '00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(sel ? (sel.getHours() >= 12 ? 'PM' : 'AM') : 'AM');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const quickDates = useMemo(() => getQuickDates(), []);

  // Outside-click closes the popup
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; inMonth: boolean; date: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    cells.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: new Date(viewYear, viewMonth, d) });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth + 1, d) });
  }

  const isToday = (d: Date) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const isSelected = (d: Date) => !!sel && d.getDate() === sel.getDate() && d.getMonth() === sel.getMonth() && d.getFullYear() === sel.getFullYear();

  const to24 = (h12: string, ap: 'AM' | 'PM'): number => {
    let h = parseInt(h12, 10);
    if (isNaN(h) || h < 1) h = 12;
    if (h > 12) h = 12;
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h;
  };
  const minNum = (m: string): number => {
    let n = parseInt(m, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 59) n = 59;
    return n;
  };

  const buildIso = (d: Date, h12v = hour12, mv = minute, apv = ampm) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), to24(h12v, apv), minNum(mv), 0, 0).toISOString();

  // Calendar day click: update value AND close
  const handlePickDate = (d: Date) => {
    onChange(buildIso(d));
    onClose();
  };

  // Time field change: update value but DO NOT close.
  // Only propagate when an existing date exists; otherwise just keep local time state.
  const propagateTime = (h12v: string, mv: string, apv: 'AM' | 'PM') => {
    if (sel) onChange(buildIso(sel, h12v, mv, apv));
  };

  const onHourChange = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setHour12(v);
    propagateTime(v, minute, ampm);
  };
  const onMinuteChange = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setMinute(v);
    propagateTime(hour12, v, ampm);
  };
  const onAmpmChange = (next: 'AM' | 'PM') => {
    setAmpm(next);
    propagateTime(hour12, minute, next);
  };

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "z-[300] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex",
        positionClass ?? "absolute left-0 top-full mt-1"
      )}
      style={{ width: '420px' }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Left: Quick options */}
      <div className="w-[150px] border-r border-gray-100 dark:border-gray-700 py-2">
        {quickDates.map(q => (
          <button
            key={q.label}
            onClick={() => handlePickDate(q.date)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="font-medium">{q.label}</span>
            <span className="text-gray-400 dark:text-gray-500 text-[11px]">{q.hint}</span>
          </button>
        ))}
        <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
          {sel && (
            <button
              onClick={() => { onClear(); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" /></svg>
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Right: Calendar + Time */}
      <div className="flex-1 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <div className="flex items-center gap-1">
            <button onClick={goToday} className="text-[11px] font-medium text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 px-1.5 py-0.5 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">Today</button>
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const selected = isSelected(c.date);
            const today = isToday(c.date);
            return (
              <button
                key={i}
                onClick={() => handlePickDate(c.date)}
                className={cn(
                  "w-[34px] h-[30px] text-[12px] rounded-lg transition-all flex items-center justify-center mx-auto",
                  !c.inMonth && "text-gray-300 dark:text-gray-600",
                  c.inMonth && !selected && !today && "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                  today && !selected && "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-bold",
                  selected && "bg-violet-500 text-white font-bold"
                )}
              >
                {c.day}
              </button>
            );
          })}
        </div>

        {/* Time picker */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            </svg>
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Time</span>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={hour12}
                onChange={(e) => onHourChange(e.target.value)}
                onBlur={() => {
                  const padded = String(parseInt(hour12, 10) || 12).padStart(2, '0');
                  setHour12(padded);
                  propagateTime(padded, minute, ampm);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-10 text-center text-[13px] font-medium border border-gray-200 dark:border-gray-700 rounded-md py-1 outline-none focus:border-violet-500 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                placeholder="HH"
              />
              <span className="text-gray-400 font-bold">:</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={minute}
                onChange={(e) => onMinuteChange(e.target.value)}
                onBlur={() => {
                  const padded = String(parseInt(minute, 10) || 0).padStart(2, '0');
                  setMinute(padded);
                  propagateTime(hour12, padded, ampm);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-10 text-center text-[13px] font-medium border border-gray-200 dark:border-gray-700 rounded-md py-1 outline-none focus:border-violet-500 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                placeholder="MM"
              />
              <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden ml-1">
                <button
                  onClick={() => onAmpmChange('AM')}
                  className={cn(
                    "px-2 py-1 text-[11px] font-semibold transition-colors",
                    ampm === 'AM' ? 'bg-violet-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >AM</button>
                <button
                  onClick={() => onAmpmChange('PM')}
                  className={cn(
                    "px-2 py-1 text-[11px] font-semibold transition-colors",
                    ampm === 'PM' ? 'bg-violet-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >PM</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
