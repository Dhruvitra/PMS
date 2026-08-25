import React, { useState, useRef, useEffect } from 'react';
import type { TaskStatus, TaskPriority } from '../../types';

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'OPEN', label: 'Open', color: '#9ca3af' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: '#ef4444' },
  { value: 'PENDING', label: 'Pending', color: '#f59e0b' },
  { value: 'IN_REVIEW', label: 'In Review', color: '#a855f7' },
  { value: 'COMPLETED', label: 'Completed', color: '#22c55e' },
  { value: 'ACCEPTED', label: 'Accepted', color: '#3b82f6' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'URGENT', label: 'Urgent', color: '#dc2626' },
  { value: 'HIGH', label: 'High', color: '#f97316' },
  { value: 'MEDIUM', label: 'Medium', color: '#3b82f6' },
  { value: 'LOW', label: 'Low', color: '#9ca3af' },
];

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkStatusChange?: (status: TaskStatus) => void;
  onBulkPriorityChange?: (priority: TaskPriority) => void;
  onBulkAssign?: (assigneeIds: string[]) => void;
  onBulkDueDate?: (date: string | null) => void;
  onBulkDelete?: () => void;
  members: { id: string; firstName: string; lastName: string; email: string }[];
}

type OpenMenu = 'status' | 'priority' | 'assignee' | 'dueDate' | null;

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkAssign,
  onBulkDueDate,
  onBulkDelete,
  members,
}: BulkActionBarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = selectedCount === totalCount;

  return (
    <div className="sticky top-0 z-30 bg-indigo-600 dark:bg-indigo-700 text-white px-4 sm:px-6 py-2 flex items-center gap-3 animate-fade-in shadow-lg">
      {/* Selection info */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="w-5 h-5 rounded border-2 border-white/60 flex items-center justify-center hover:border-white transition-colors"
          title={allSelected ? "Deselect All" : "Select All"}
        >
          {allSelected && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <button
          onClick={onDeselectAll}
          className="text-xs text-white/70 hover:text-white underline"
        >
          Clear
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-white/30" />

      {/* Action buttons */}
      <div ref={menuRef} className="flex items-center gap-1 flex-wrap relative">
        {/* Status */}
        {onBulkStatusChange && (
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:bg-white/15 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status
            </button>
            {openMenu === 'status' && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] animate-scale-in z-50">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { onBulkStatusChange(opt.value); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="w-2.5 h-2.5 rounded-full" {...{ style: { backgroundColor: opt.color } }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Priority */}
        {onBulkPriorityChange && (
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'priority' ? null : 'priority')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:bg-white/15 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Priority
            </button>
            {openMenu === 'priority' && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] animate-scale-in z-50">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { onBulkPriorityChange(opt.value); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="w-2.5 h-2.5 rounded-full" {...{ style: { backgroundColor: opt.color } }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assignee */}
        {onBulkAssign && (
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'assignee' ? null : 'assignee')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:bg-white/15 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Assignee
            </button>
            {openMenu === 'assignee' && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px] max-h-[200px] overflow-y-auto animate-scale-in z-50">
                <button
                  onClick={() => { onBulkAssign([]); setOpenMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 italic"
                >
                  Unassign
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onBulkAssign(m.id ? [m.id] : []); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-[9px] font-medium shrink-0">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>
                    <span className="truncate">{m.firstName} {m.lastName}</span>
                  </button>
                ))}
                {members.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No members found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Due Date */}
        {onBulkDueDate && (
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'dueDate' ? null : 'dueDate')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:bg-white/15 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Due Date
            </button>
            {openMenu === 'dueDate' && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] animate-scale-in z-50">
                <input
                  type="date"
                  title="Due Date"
                  placeholder="Due Date"
                  onChange={(e) => {
                    if (e.target.value) {
                      onBulkDueDate(e.target.value);
                      setOpenMenu(null);
                    }
                  }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => { onBulkDueDate(null); setOpenMenu(null); }}
                  className="w-full mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-center py-1"
                >
                  Clear due date
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Delete */}
      {onBulkDelete && (
        <button
          onClick={onBulkDelete}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-500/20 hover:bg-red-500/40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      )}
    </div>
  );
}
