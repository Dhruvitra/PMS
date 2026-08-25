import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { TimeEntry } from '../../types';

interface TimeEntryListProps {
  taskId: string;
  refreshKey?: number;
}

function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function TimeEntryList({ taskId, refreshKey }: TimeEntryListProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');

  const loadEntries = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: TimeEntry[] }>(`/tasks/${taskId}/time-entries`);
      setEntries(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshKey]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/time-entries/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete entry');
    }
  };

  const handleEditSave = async (id: string) => {
    try {
      await api.put(`/time-entries/${id}`, { description: editDesc });
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, description: editDesc } : e))
      );
      setEditingId(null);
    } catch {
      alert('Failed to update');
    }
  };

  // Total tracked time
  // Total tracked time is now shown in TimeTracker header

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Header with total */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Recent Entries
        </span>
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {entries.map((entry) => {
          const isRunning = entry.startTime && !entry.endTime;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded group text-xs ${
                isRunning
                  ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {/* Running indicator */}
              {isRunning && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
              )}

              {/* User avatar */}
              {entry.user && (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                  {entry.user.firstName.charAt(0)}{entry.user.lastName.charAt(0)}
                </div>
              )}

              {/* Description / label */}
              <div className="flex-1 min-w-0">
                {editingId === entry.id ? (
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(entry.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleEditSave(entry.id)}
                    autoFocus
                    placeholder="Entry description"
                    title="Edit description"
                    className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 outline-none bg-transparent dark:text-gray-300"
                  />
                ) : (
                  <span
                    className="text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-indigo-500 block"
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditDesc(entry.description || '');
                    }}
                  >
                    {entry.description || (isRunning ? 'Tracking...' : 'No description')}
                  </span>
                )}
              </div>

              {/* Start/Stop times */}
              {entry.startTime && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                  {formatTime(entry.startTime)}
                  {entry.endTime ? ` → ${formatTime(entry.endTime)}` : ''}
                </span>
              )}

              {/* Duration */}
              <span className={`font-mono tabular-nums shrink-0 ${
                isRunning ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {isRunning ? 'Running' : formatDurationCompact(entry.durationSeconds)}
              </span>

              {/* Date */}
              {entry.createdAt && !isRunning && !entry.startTime && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 hidden sm:block">
                  {formatDateTime(entry.createdAt)}
                </span>
              )}

              {/* Delete button */}
              {!isRunning && (
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors shrink-0"
                  title="Delete time entry"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
