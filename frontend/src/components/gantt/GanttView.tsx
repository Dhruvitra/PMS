import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { GanttToolbar, type ZoomLevel } from './GanttToolbar';
import type { Task, TaskStatus } from '../../types';
import api from '../../services/api';

// ─── Helpers ──────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date, fmt: 'short' | 'month' | 'day'): string {
  if (fmt === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (fmt === 'day') return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const STATUS_BAR_COLORS: Record<TaskStatus, { bg: string; border: string; text: string }> = {
  OPEN: { bg: '#e5e7eb', border: '#9ca3af', text: '#374151' },
  PENDING: { bg: '#fed7aa', border: '#f97316', text: '#9a3412' },
  IN_PROGRESS: { bg: '#bfdbfe', border: '#3b82f6', text: '#1e40af' },
  IN_REVIEW: { bg: '#fde68a', border: '#f59e0b', text: '#92400e' },
  COMPLETED: { bg: '#bbf7d0', border: '#22c55e', text: '#166534' },
  ACCEPTED: { bg: '#cffafe', border: '#06b6d4', text: '#164e63' },
  REJECTED: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  CLOSED: { bg: '#f3f4f6', border: '#1f2937', text: '#111827' },
};

function calculateProgress(task: Task): number {
  if (task.status === 'COMPLETED' || task.status === 'ACCEPTED' || task.status === 'CLOSED') return 100;
  if (task.status === 'IN_REVIEW') return 75;
  if (task.status === 'IN_PROGRESS') return 50;
  if (task.status === 'PENDING') return 25;
  return 0;
}

// ─── Constants ────────────────────────────────────────

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 52;
const SIDEBAR_WIDTH = 220;
const CELL_WIDTHS: Record<ZoomLevel, number> = { day: 40, week: 120, month: 160 };
const DEFAULT_DURATION = 3; // days for tasks without due date

// ─── Component ────────────────────────────────────────

interface GanttViewProps {
  tasks: Task[];
  onTasksChange: () => void;
}

export function GanttView({ tasks, onTasksChange }: GanttViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [dragState, setDragState] = useState<{
    taskId: string;
    startX: number;
    originalEnd: Date;
    edge: 'bar' | 'right';
  } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);

  const cellWidth = CELL_WIDTHS[zoom];

  // Filter tasks
  const filteredTasks = useMemo(() =>
    statusFilter === 'ALL' ? tasks : tasks.filter((t) => t.status === statusFilter),
    [tasks, statusFilter]
  );

  // Compute timeline range
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    let min = today;
    let max = addDays(today, 14);

    filteredTasks.forEach((t) => {
      const start = startOfDay(new Date(t.createdAt));
      const end = t.dueDate ? startOfDay(new Date(t.dueDate)) : addDays(start, DEFAULT_DURATION);
      if (start < min) min = start;
      if (end > max) max = end;
    });

    // Add padding
    const timelineStart = addDays(min, -3);
    const timelineEnd = addDays(max, 7);
    const totalDays = diffDays(timelineStart, timelineEnd);

    return { timelineStart, timelineEnd, totalDays };
  }, [filteredTasks]);

  // Generate date columns
  const columns = useMemo(() => {
    const cols: { date: Date; label: string; isToday: boolean; isWeekend: boolean; groupLabel?: string }[] = [];
    const today = startOfDay(new Date());

    if (zoom === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(timelineStart, i);
        const isFirst = i === 0 || d.getDate() === 1;
        cols.push({
          date: d,
          label: `${d.getDate()}`,
          isToday: d.getTime() === today.getTime(),
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          groupLabel: isFirst ? formatDate(d, 'month') : undefined,
        });
      }
    } else if (zoom === 'week') {
      let d = new Date(timelineStart);
      // Align to Monday
      while (d.getDay() !== 1) d = addDays(d, 1);
      while (d < timelineEnd) {
        const weekEnd = addDays(d, 6);
        cols.push({
          date: d,
          label: `${formatDate(d, 'short')} - ${formatDate(weekEnd, 'short')}`,
          isToday: today >= d && today <= weekEnd,
          isWeekend: false,
          groupLabel: d.getDate() <= 7 ? formatDate(d, 'month') : undefined,
        });
        d = addDays(d, 7);
      }
    } else {
      let d = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
      while (d < timelineEnd) {
        cols.push({
          date: d,
          label: formatDate(d, 'month'),
          isToday: today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth(),
          isWeekend: false,
        });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
    }

    return cols;
  }, [zoom, totalDays, timelineStart, timelineEnd]);

  // Today position
  const todayOffset = useMemo(() => {
    const today = startOfDay(new Date());
    if (zoom === 'day') {
      return diffDays(timelineStart, today) * cellWidth;
    } else if (zoom === 'week') {
      const totalMs = timelineEnd.getTime() - timelineStart.getTime();
      const todayMs = today.getTime() - timelineStart.getTime();
      return (todayMs / totalMs) * columns.length * cellWidth;
    } else {
      const totalMs = timelineEnd.getTime() - timelineStart.getTime();
      const todayMs = today.getTime() - timelineStart.getTime();
      return (todayMs / totalMs) * columns.length * cellWidth;
    }
  }, [zoom, timelineStart, timelineEnd, cellWidth, columns.length]);

  // Task bar positioning
  const getBarPosition = useCallback((task: Task) => {
    const start = startOfDay(new Date(task.createdAt));
    const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : addDays(start, DEFAULT_DURATION);

    if (zoom === 'day') {
      const left = diffDays(timelineStart, start) * cellWidth;
      const width = Math.max(diffDays(start, end), 1) * cellWidth;
      return { left, width };
    } else {
      const totalMs = timelineEnd.getTime() - timelineStart.getTime();
      const totalWidth = columns.length * cellWidth;
      const left = ((start.getTime() - timelineStart.getTime()) / totalMs) * totalWidth;
      const width = Math.max(((end.getTime() - start.getTime()) / totalMs) * totalWidth, 20);
      return { left, width };
    }
  }, [zoom, timelineStart, timelineEnd, cellWidth, columns.length]);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(todayOffset - scrollRef.current.clientWidth / 2, 0);
    }
  }, [todayOffset]);

  useEffect(() => {
    // Auto-scroll to today on mount
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, taskId: string, task: Task, edge: 'bar' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : addDays(startOfDay(new Date(task.createdAt)), DEFAULT_DURATION);
    setDragState({ taskId, startX: e.clientX, originalEnd: end, edge });
    setDragDelta(0);
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragState.startX;
      setDragDelta(delta);
    };

    const handleMouseUp = async () => {
      if (dragState && dragDelta !== 0) {
        const daysDelta = Math.round(dragDelta / cellWidth);
        if (daysDelta !== 0) {
          const newEnd = addDays(dragState.originalEnd, daysDelta);
          try {
            await api.patch(`/tasks/${dragState.taskId}`, { dueDate: toISODate(newEnd) });
            onTasksChange();
          } catch (err) {
            console.error('Failed to update task:', err);
          }
        }
      }
      setDragState(null);
      setDragDelta(0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragDelta, cellWidth, onTasksChange]);

  const chartWidth = columns.length * cellWidth;

  return (
    <div className="flex flex-col h-full">
      <GanttToolbar
        zoom={zoom}
        onZoomChange={setZoom}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        taskCount={filteredTasks.length}
        onScrollToToday={scrollToToday}
      />

      {filteredTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          {tasks.length === 0
            ? 'No tasks to display. Create tasks with due dates for the Gantt chart.'
            : 'No tasks match the current filter.'}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Task names */}
          <div className="shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" style={{ width: SIDEBAR_WIDTH }}>
            {/* Sidebar header */}
            <div
              className="flex items-center px-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              style={{ height: HEADER_HEIGHT }}
            >
              Task Name
            </div>
            {/* Task names */}
            <div className="overflow-y-auto" style={{ maxHeight: `calc(100% - ${HEADER_HEIGHT}px)` }}>
              {filteredTasks.map((task) => {
                const colors = STATUS_BAR_COLORS[task.status];
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => navigate(`/tasks/${task.id}`, { state: { backgroundLocation: location } })}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colors.border }}
                    />
                    <span className="text-xs text-gray-900 dark:text-white truncate font-medium">
                      {task.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart area */}
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div style={{ width: chartWidth, minHeight: '100%' }} className="relative">
              {/* Header - Date columns */}
              <div className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700" style={{ height: HEADER_HEIGHT }}>
                {/* Month/group row */}
                <div className="flex h-1/2">
                  {columns.map((col, i) => (
                    col.groupLabel ? (
                      <div
                        key={`g-${i}`}
                        className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center px-1 border-l border-gray-200 dark:border-gray-700"
                        style={{ width: cellWidth, position: 'absolute', left: i * cellWidth }}
                      >
                        {col.groupLabel}
                      </div>
                    ) : null
                  ))}
                </div>
                {/* Day/week row */}
                <div className="flex h-1/2 absolute bottom-0 left-0">
                  {columns.map((col, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-center text-[10px] border-l ${col.isToday
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold'
                          : col.isWeekend
                            ? 'text-gray-400 dark:text-gray-500 bg-gray-100/50 dark:bg-gray-800/30'
                            : 'text-gray-500 dark:text-gray-400'
                        } border-gray-200 dark:border-gray-700`}
                      style={{ width: cellWidth }}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid lines + Task rows */}
              <div className="relative" style={{ minHeight: filteredTasks.length * ROW_HEIGHT }}>
                {/* Vertical grid lines */}
                {columns.map((col, i) => (
                  <div
                    key={`vl-${i}`}
                    className={`absolute top-0 bottom-0 border-l ${col.isWeekend
                        ? 'bg-gray-50/50 dark:bg-gray-800/20 border-gray-200/50 dark:border-gray-700/50'
                        : 'border-gray-100 dark:border-gray-700/30'
                      }`}
                    style={{ left: i * cellWidth, width: cellWidth }}
                  />
                ))}

                {/* Today indicator line */}
                <div
                  ref={todayRef}
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: todayOffset }}
                >
                  <div className="w-0.5 h-full bg-red-500 dark:bg-red-400 opacity-70" />
                  <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 rounded-full bg-red-500 dark:bg-red-400 border-2 border-white dark:border-gray-900" />
                </div>

                {/* Horizontal row lines */}
                {filteredTasks.map((_, i) => (
                  <div
                    key={`hl-${i}`}
                    className="absolute left-0 right-0 border-b border-gray-100 dark:border-gray-700/30"
                    style={{ top: (i + 1) * ROW_HEIGHT }}
                  />
                ))}

                {/* Task bars */}
                {filteredTasks.map((task, rowIndex) => {
                  const { left, width } = getBarPosition(task);
                  const colors = STATUS_BAR_COLORS[task.status];
                  const progress = calculateProgress(task);
                  const isDragging = dragState?.taskId === task.id;
                  const barLeft = isDragging && dragState?.edge === 'bar' ? left + dragDelta : left;
                  const barWidth = isDragging && dragState?.edge === 'right' ? width + dragDelta : width;

                  return (
                    <div
                      key={task.id}
                      className="absolute flex items-center"
                      style={{
                        left: barLeft,
                        width: Math.max(barWidth, 20),
                        top: rowIndex * ROW_HEIGHT + 8,
                        height: ROW_HEIGHT - 16,
                        zIndex: isDragging ? 30 : 5,
                      }}
                    >
                      {/* Bar */}
                      <div
                        className={`relative w-full h-full rounded-md border cursor-pointer group transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-indigo-400' : 'hover:shadow-md'
                          }`}
                        style={{
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                        }}
                        onClick={() => !isDragging && navigate(`/tasks/${task.id}`, { state: { backgroundLocation: location } })}
                        onMouseDown={(e) => handleMouseDown(e, task.id, task, 'bar')}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute top-0 left-0 h-full rounded-l-md opacity-30"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: colors.border,
                            borderRadius: progress >= 100 ? '0.375rem' : '0.375rem 0 0 0.375rem',
                          }}
                        />

                        {/* Task name on bar */}
                        <span
                          className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate select-none"
                          style={{ color: colors.text }}
                        >
                          {task.title}
                        </span>

                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 w-2 h-full cursor-e-resize opacity-0 group-hover:opacity-100 rounded-r-md"
                          style={{ backgroundColor: colors.border }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(e, task.id, task, 'right');
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
