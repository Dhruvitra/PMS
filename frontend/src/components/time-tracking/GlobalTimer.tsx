import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import api from '../../services/api';
import { useAppSelector } from '../../store';
import type { TimeEntry } from '../../types';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GlobalTimer() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.accessToken);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for active timer
  useEffect(() => {
    if (!token) return;
    checkActive();
    const poll = setInterval(checkActive, 30000);
    return () => clearInterval(poll);
  }, [token]);

  // Also listen for storage events (cross-tab sync)
  useEffect(() => {
    const handler = () => checkActive();
    window.addEventListener('storage', handler);
    // Custom event for same-tab updates
    window.addEventListener('timer-update', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('timer-update', handler);
    };
  }, []);

  // Tick
  useEffect(() => {
    if (activeEntry?.startTime) {
      const startMs = new Date(activeEntry.startTime).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeEntry]);

  const checkActive = async () => {
    try {
      const res = await api.get<{ success: boolean; data: TimeEntry | null }>('/users/me/time-entries/active');
      setActiveEntry(res.data.data || null);
      if (res.data.data) {
        localStorage.setItem('activeTimer', JSON.stringify({
          entryId: res.data.data.id,
          taskId: res.data.data.taskId,
          taskTitle: res.data.data.task?.title || '',
          startTime: res.data.data.startTime,
        }));
      } else {
        localStorage.removeItem('activeTimer');
      }
    } catch {
      // Try localStorage fallback
      const cached = localStorage.getItem('activeTimer');
      if (cached) {
        try {
          const data = JSON.parse(cached);
          setActiveEntry({
            id: data.entryId,
            taskId: data.taskId,
            userId: '',
            startTime: data.startTime,
            endTime: null,
            durationSeconds: 0,
            description: null,
            createdAt: '',
            task: { id: data.taskId, title: data.taskTitle, projectId: '' },
          });
        } catch {
          // ignore
        }
      }
    }
  };

  const handleStop = async () => {
    if (!activeEntry) return;
    try {
      await api.put(`/time-entries/${activeEntry.id}/stop`);
      setActiveEntry(null);
      setElapsed(0);
      localStorage.removeItem('activeTimer');
      window.dispatchEvent(new Event('timer-update'));
    } catch {
      alert('Failed to stop timer');
    }
  };

  if (!activeEntry) return null;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
      onClick={() => navigate(`/tasks/${activeEntry.taskId}`, { state: { backgroundLocation: location } })}
      title={`Tracking: ${activeEntry.task?.title || 'Task'}`}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>

      {/* Timer */}
      <span className="font-mono text-xs font-semibold text-green-700 dark:text-green-400 tabular-nums">
        {formatDuration(elapsed)}
      </span>

      {/* Task name (truncated) */}
      <span className="text-[11px] text-green-600 dark:text-green-400 truncate max-w-[120px] hidden sm:block">
        {activeEntry.task?.title || 'Task'}
      </span>

      {/* Stop button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleStop();
        }}
        className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shrink-0 transition-colors"
        title="Stop timer"
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
          <rect x="4" y="4" width="16" height="16" rx="1" />
        </svg>
      </button>
    </div>
  );
}
