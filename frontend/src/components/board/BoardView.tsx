import React, { useState, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';

import { AvatarStack } from '../ui/AvatarStack';
import type { Task, TaskStatus } from '../../types';

interface BoardViewProps {
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  canCreateTask?: boolean;
  canUpdateTaskStatus?: boolean;
}

const STATUS_COLUMNS: TaskStatus[] = ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'CLOSED'];

const STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN PROGRESS',
  IN_REVIEW: 'IN REVIEW',
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500 dark:text-gray-400',
  MEDIUM: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
};

export const BoardView = React.memo(function BoardView({ tasks, onTaskStatusChange, canCreateTask = true, canUpdateTaskStatus = true }: BoardViewProps) {
  const location = useLocation();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Memoize tasks grouped by status to avoid re-filtering on every render
  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const status of STATUS_COLUMNS) {
      map[status] = [];
    }
    for (const task of tasks) {
      if (map[task.status]) {
        map[task.status].push(task);
      }
    }
    return map;
  }, [tasks]);


  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires dataTransfer data to be set for drag to work
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      const task = tasks.find((t) => t.id === draggedTaskId);
      if (task && task.status !== targetStatus) {
        onTaskStatusChange(draggedTaskId, targetStatus);
      }
      setDraggedTaskId(null);
    }
  }, [draggedTaskId, tasks, onTaskStatusChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
  }, []);

  return (
    <div className="flex h-full gap-4 p-4 sm:p-6 overflow-x-auto items-start">
      {STATUS_COLUMNS.map((status) => {
        const columnTasks = tasksByStatus[status];
        return (
          <div
            key={status}
            className="flex flex-col w-72 shrink-0 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 max-h-full"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div className={`px-4 py-3 rounded-t-xl border-b border-gray-200 dark:border-gray-700/50 flex items-center justify-between
              ${status === 'OPEN' ? 'bg-gray-100 dark:bg-gray-800' :
                status === 'IN_PROGRESS' ? 'bg-pink-50 dark:bg-pink-900/20' :
                  status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                    'bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full 
                  ${status === 'OPEN' ? 'bg-gray-400' :
                    status === 'PENDING' ? 'bg-amber-500' :
                      status === 'IN_PROGRESS' ? 'bg-[#FF4B91]' :
                        status === 'IN_REVIEW' ? 'bg-indigo-500' :
                          status === 'ACCEPTED' ? 'bg-blue-500' :
                            status === 'COMPLETED' ? 'bg-[#00DFA2]' :
                              status === 'REJECTED' ? 'bg-red-500' :
                                'bg-gray-500'
                  }`}
                />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {STATUS_LABELS[status]}
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    {columnTasks.length}
                  </span>
                </h3>
              </div>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Column options">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" />
                </svg>
              </button>
            </div>

            {/* Tasks Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[150px]">
              <AnimatePresence>
                {columnTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout // Animates column changes seamlessly
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    draggable={canUpdateTaskStatus}
                    onDragStart={(e: any) => canUpdateTaskStatus && handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 space-y-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow
                      ${draggedTaskId === task.id ? 'opacity-50 border-indigo-400 scale-[0.98]' : ''}`}
                  >
                    <Link
                      to={`/tasks/${task.id}`}
                      state={{ backgroundLocation: location }}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600 block line-clamp-2"
                    >
                      {task.title}
                    </Link>

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {task.tags.map((tag) => {
                          const tagStyle = {
                            backgroundColor: `${tag.color}25`,
                            color: '#374151',
                          } as React.CSSProperties;
                          return (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded text-[10px] font-medium"
                              {...({ style: tagStyle })}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                      <div className="flex items-center gap-2">
                        {task.dueDate && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <AvatarStack users={task.assignees} showPlaceholder />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add Task Button */}
            {canCreateTask && (
              <div className="p-2 border-t border-gray-200 dark:border-gray-700/50">
                <button className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Task
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
