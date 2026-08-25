import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { cn } from '../../utils/cn';
import type { TimeEntry } from '../../types';

interface TimeTrackerProps {
  taskId: string;
  onEntryChange?: () => void;
}

/**
 * Natural language duration parser
 * Converts "3h 20m", "1.5h", "45m", "1:30" etc. to seconds
 */
function parseDuration(input: string): number {
  if (!input) return 0;
  
  // Try format 1:30
  if (input.includes(':')) {
    const parts = input.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }

  let totalSeconds = 0;
  const hMatch = input.match(/(\d+(\.\d+)?)h/i);
  const mMatch = input.match(/(\d+(\.\d+)?)m/i);
  const sMatch = input.match(/(\d+(\.\d+)?)s/i);

  if (hMatch) totalSeconds += parseFloat(hMatch[1]) * 3600;
  if (mMatch) totalSeconds += parseFloat(mMatch[1]) * 60;
  if (sMatch) totalSeconds += parseFloat(sMatch[1]);

  // If no units, assume hours if > 8? No, let's assume minutes if no units
  if (!hMatch && !mMatch && !sMatch) {
    const val = parseFloat(input);
    if (!isNaN(val)) totalSeconds = val * 60; // default to minutes
  }

  return Math.round(totalSeconds);
}

function formatDurationHм(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDurationClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(1, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export function TimeTracker({ taskId, onEntryChange }: TimeTrackerProps) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Helper to format Date into HH:mm
  const formatTime = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Manual entry states
  const [timeInput, setTimeInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(formatTime(new Date()));
  const [endTime, setEndTime] = useState(formatTime(new Date(Date.now() + 30 * 60000)));
  const [notes, setNotes] = useState('');
  const [isBillable, setIsBillable] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Total time for the task
  const [totalTime, setTotalTime] = useState(0);

  const loadActiveAndTotal = useCallback(async () => {
    try {
      const [activeRes, entriesRes] = await Promise.all([
        api.get<{ success: boolean; data: TimeEntry | null }>('/users/me/time-entries/active'),
        api.get<{ success: boolean; data: TimeEntry[] }>(`/tasks/${taskId}/time-entries`)
      ]);
      
      const entry = activeRes.data.data;
      if (entry && entry.taskId === taskId) {
        setActiveEntry(entry);
      } else {
        setActiveEntry(null);
      }

      if (entriesRes.data.success) {
        setTotalTime(entriesRes.data.data.reduce((sum, e) => sum + e.durationSeconds, 0));
      }
    } catch { /* ignore */ }
  }, [taskId]);

  useEffect(() => {
    loadActiveAndTotal();
  }, [loadActiveAndTotal]);

  useEffect(() => {
    if (activeEntry?.startTime) {
      const startMs = new Date(activeEntry.startTime).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeEntry]);

  const handleStart = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: TimeEntry }>(
        `/tasks/${taskId}/time-entries`,
        { description: notes || undefined }
      );
      setActiveEntry(res.data.data);
      loadActiveAndTotal();
      onEntryChange?.();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start timer');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeEntry || loading) return;
    setLoading(true);
    try {
      await api.put(`/time-entries/${activeEntry.id}/stop`);
      setActiveEntry(null);
      setElapsed(0);
      loadActiveAndTotal();
      onEntryChange?.();
    } catch {
      alert('Failed to stop timer');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManual = async () => {
    const duration = parseDuration(timeInput);
    
    // Construct ISO strings for start and end based on selected date and time range
    const startISO = new Date(`${selectedDate}T${startTime}`).toISOString();
    const endISO = new Date(`${selectedDate}T${endTime}`).toISOString();

    setLoading(true);
    try {
      const payload: any = {
        description: notes || undefined,
      };

      if (duration > 0) {
        payload.durationSeconds = duration;
      } else {
        payload.startTime = startISO;
        payload.endTime = endISO;
      }

      await api.post(`/tasks/${taskId}/time-entries`, payload);
      
      setTimeInput('');
      setNotes('');
      setIsExpanded(false);
      loadActiveAndTotal();
      onEntryChange?.();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save time entry');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTimer = async () => {
    if (!activeEntry || !window.confirm('Abandon this timer? Recorded time will be lost.')) return;
    setLoading(true);
    try {
      await api.delete(`/time-entries/${activeEntry.id}`);
      setActiveEntry(null);
      setElapsed(0);
      loadActiveAndTotal();
      onEntryChange?.();
    } catch {
      alert('Failed to delete timer');
    } finally {
      setLoading(false);
    }
  };

  const isActive = !!activeEntry;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800/50">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Time on this task</h3>
        <div className="flex items-center gap-3">
          {isActive && (
            <button 
              onClick={handleCancelTimer}
              className="text-[10px] font-bold text-red-400 hover:text-red-500 uppercase tracking-tight"
            >
              Delete
            </button>
          )}
          <span className="text-sm font-black text-gray-900 dark:text-white">
            {isActive ? formatDurationClock(elapsed) : formatDurationHм(totalTime)}
          </span>
        </div>
      </div>

      {/* Main Box */}
      <div className="p-4 space-y-4">
        {/* Time Entry / Timer Row */}
        <div className="relative group">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <input
              type="text"
              value={isActive ? formatDurationClock(elapsed) : timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              disabled={isActive}
              placeholder="Enter time (ex: 3h 20m) or start timer"
              className="flex-1 bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              onFocus={() => setIsExpanded(true)}
              title="Time input"
            />
            <button
              onClick={isActive ? handleStop : handleStart}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm",
                isActive 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-gray-400 dark:bg-gray-600 group-hover:bg-indigo-500 text-white"
              )}
              title={isActive ? "Stop timer" : "Start timer"}
            >
              {isActive ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Details Section (Expanded) */}
        {(isExpanded || isActive) && (
          <div className="space-y-3 animate-fade-in">
            {/* Date and Time range */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none outline-none cursor-pointer hover:text-indigo-500 transition-colors font-medium" 
                  title="Select date"
                />
                <span className="opacity-40 px-1">|</span>
                <input 
                  type="time" 
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-transparent border-none outline-none cursor-pointer hover:text-indigo-500 transition-colors font-medium" 
                  title="Start time"
                />
                <span className="opacity-40">–</span>
                <input 
                  type="time" 
                  value={endTime} 
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-transparent border-none outline-none cursor-pointer hover:text-indigo-500 transition-colors font-medium" 
                  title="End time"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder-gray-400 font-medium"
                title="Notes"
              />
            </div>

            {/* Tags (Placeholder for now) */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M13.414 2.586a2 2 0 012.828 0L21.414 8.414a2 2 0 010 2.828l-7.586 7.586a2 2 0 01-2.828 0L2.586 10.086a2 2 0 010-2.828l5.828-5.828a2 2 0 012.828 0z" /></svg>
              <span className="cursor-pointer hover:text-indigo-500 transition-colors font-medium">Add tags</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {(isExpanded || isActive) && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBillable(!isBillable)}
              className={cn(
                "w-8 h-4 rounded-full relative transition-all duration-200",
                isBillable ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-700"
              )}
              title={isBillable ? "Billable" : "Not billable"}
            >
              <div className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                isBillable ? "left-4.5" : "left-0.5"
              )}>
                <span className="text-[6px] font-bold text-gray-400 absolute inset-0 flex items-center justify-center">$</span>
              </div>
            </button>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Billable</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsExpanded(false)}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 truncate"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveManual}
              disabled={loading || (!isActive && !timeInput && (startTime === endTime))}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-black rounded-lg shadow-md transition-all active:scale-95"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
