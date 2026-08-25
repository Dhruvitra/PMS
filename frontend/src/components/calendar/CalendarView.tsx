import { useState } from 'react';
import type { Task } from '../../types';
import { Link, useLocation } from 'react-router';

interface CalendarViewProps {
  tasks: Task[];
}

export function CalendarView({ tasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const location = useLocation();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Group tasks by date
  // A task appears if its dueDate matches
  const tasksByDate = new Map<number, Task[]>();
  tasks.forEach((task) => {
    if (task.dueDate) {
      const taskDate = new Date(task.dueDate);
      if (taskDate.getMonth() === month && taskDate.getFullYear() === year) {
        const d = taskDate.getDate();
        if (!tasksByDate.has(d)) tasksByDate.set(d, []);
        tasksByDate.get(d)!.push(task);
      }
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      case 'IN_REVIEW':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'COMPLETED':
      case 'ACCEPTED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'PENDING':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
      case 'CLOSED':
        return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            <button
              onClick={prevMonth}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6">
        <div className="grid grid-cols-7 gap-px rounded-xl bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 overflow-hidden text-sm flex-1">
          {/* Days of week header */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="bg-gray-50 dark:bg-gray-800 p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
              {d}
            </div>
          ))}

          {/* Empty padding days for first week */}
          {paddingDays.map((p) => (
            <div key={`empty-${p}`} className="bg-white dark:bg-gray-900 min-h-[100px] opacity-30" />
          ))}

          {/* Actual days */}
          {days.map((d) => {
            const dayTasks = tasksByDate.get(d) || [];
            return (
              <div
                key={d}
                className={`bg-white dark:bg-gray-900 p-2 min-h-[100px] flex flex-col gap-1 overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isToday(d) ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/10' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday(d) ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {d}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
                  {dayTasks.map((task) => (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      state={{ backgroundLocation: location }}
                      className={`text-[11px] font-medium px-2 py-1 rounded truncate block hover:opacity-80 transition-opacity border border-black/5 dark:border-white/5 ${getStatusColor(task.status)}`}
                      title={task.title}
                    >
                      {task.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Pad the remaining to keep grid square */}
          {Array.from({ length: Math.max(0, 42 - (paddingDays.length + days.length)) }).map((_, i) => (
            <div key={`end-empty-${i}`} className="bg-white dark:bg-gray-900 min-h-[100px] opacity-30" />
          ))}
        </div>
      </div>
    </div>
  );
}
