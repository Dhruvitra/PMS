import type { TaskStatus } from '../../types';

export type ZoomLevel = 'day' | 'week' | 'month';

interface GanttToolbarProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  statusFilter: TaskStatus | 'ALL';
  onStatusFilterChange: (status: TaskStatus | 'ALL') => void;
  taskCount: number;
  onScrollToToday: () => void;
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const STATUS_FILTERS: { value: TaskStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
];

export function GanttToolbar({
  zoom,
  onZoomChange,
  statusFilter,
  onStatusFilterChange,
  taskCount,
  onScrollToToday,
}: GanttToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center gap-3">
        {/* Zoom level */}
        <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onZoomChange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${zoom === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as TaskStatus | 'ALL')}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Task count */}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {taskCount} task{taskCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Today button */}
        <button
          onClick={onScrollToToday}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Today
        </button>
      </div>
    </div>
  );
}
