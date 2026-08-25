import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import api from '../../services/api';
import type { Task } from '../../types';

const STATUS_COLORS = [
  '#1e1e1e', '#f59e0b', '#ec4899', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4',
];

const ASSIGNEE_COLORS = [
  '#3b82f6', '#1e1e1e', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4',
  '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#d946ef', '#84cc16', '#0ea5e9',
  '#f43f5e', '#a855f7', '#22c55e', '#eab308', '#64748b', '#be185d',
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  COMPLETED: 'Completed',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

interface ChartDetailModalProps {
  open: boolean;
  onClose: () => void;
  chartType: 'workloadByStatus' | 'totalTasksByAssignee' | 'openTasksByAssignee';
  chartTitle: string;
  chartData: any[];
  selectedSegment: string | null;
  orgId: string;
}

export function ChartDetailModal({ open, onClose, chartType, chartTitle, chartData, selectedSegment, orgId }: ChartDetailModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Sync activeSegment when modal opens or selectedSegment changes
  useEffect(() => {
    if (open && selectedSegment) {
      setActiveSegment(selectedSegment);
    }
    if (!open) {
      setActiveSegment(null);
      setTasks([]);
      setTotalCount(0);
      setError(null);
    }
  }, [open, selectedSegment]);

  // Fetch tasks whenever activeSegment changes
  const fetchTasks = useCallback(async (segment: string) => {
    if (!segment || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/chart-tasks', {
        params: { orgId, chartType, filterValue: segment },
      });
      if (res.data.success) {
        setTasks(res.data.data.tasks || []);
        setTotalCount(res.data.data.total || 0);
      } else {
        setTasks([]);
        setTotalCount(0);
        setError('Failed to load tasks');
      }
    } catch (err: any) {
      console.error('chart-tasks error:', err);
      setTasks([]);
      setTotalCount(0);
      setError(err?.response?.data?.message || err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [orgId, chartType]);

  useEffect(() => {
    if (open && activeSegment) {
      fetchTasks(activeSegment);
    }
  }, [open, activeSegment, fetchTasks]);

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`, { state: { backgroundLocation: location } });
  };

  const handlePieClick = (data: any) => {
    // Recharts Pie onClick gives the slice data directly with { name, value, ... }
    if (data?.name) {
      setActiveSegment(data.name);
    }
  };

  const handleBarClick = (data: any) => {
    // Recharts BarChart onClick gives { activePayload: [...] }
    const name = data?.activePayload?.[0]?.payload?.name;
    if (name) {
      setActiveSegment(name);
    }
  };

  const getSegmentColor = () => {
    if (!activeSegment) return '#6366f1';
    const idx = chartData.findIndex(d => d.name === activeSegment);
    if (chartType === 'workloadByStatus') return STATUS_COLORS[idx % STATUS_COLORS.length];
    return ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length];
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      IN_PROGRESS: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      IN_REVIEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  if (!open) return null;

  const isBarChart = chartType === 'openTasksByAssignee';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-[95vw] max-w-[1200px] h-[85vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getSegmentColor() }} />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{chartTitle}</h2>
                {activeSegment && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">/</span>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                      {STATUS_LABELS[activeSegment] || activeSegment}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Chart */}
              <div className="w-1/2 border-r border-gray-100 dark:border-gray-800 p-6 flex flex-col">
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height={400}>
                    {isBarChart ? (
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
                        onClick={handleBarClick}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="Tasks" radius={[4, 4, 0, 0]} cursor="pointer">
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length]}
                              opacity={activeSegment && entry.name !== activeSegment ? 0.3 : 1}
                              stroke={entry.name === activeSegment ? '#000' : 'none'}
                              strokeWidth={entry.name === activeSegment ? 2 : 0}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          outerRadius="80%"
                          dataKey="value"
                          label={chartType === 'workloadByStatus'
                            ? ({ name, value }) => `${(STATUS_LABELS[name] || name.replace('_', ' '))} ${value}`
                            : ({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(1)}%`
                          }
                          labelLine={true}
                          strokeWidth={2}
                          onClick={handlePieClick}
                          cursor="pointer"
                        >
                          {chartData.map((entry, index) => {
                            const colors = chartType === 'workloadByStatus' ? STATUS_COLORS : ASSIGNEE_COLORS;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={colors[index % colors.length]}
                                opacity={activeSegment && entry.name !== activeSegment ? 0.3 : 1}
                                stroke={entry.name === activeSegment ? '#000' : '#fff'}
                                strokeWidth={entry.name === activeSegment ? 3 : 1}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, 'Tasks']} />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-2 max-h-[80px] overflow-y-auto">
                  {chartData.map((entry, index) => {
                    const colors = (chartType === 'workloadByStatus') ? STATUS_COLORS : ASSIGNEE_COLORS;
                    const isActive = entry.name === activeSegment;
                    return (
                      <button
                        key={entry.name}
                        onClick={() => setActiveSegment(entry.name)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                          isActive
                            ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 shadow-sm'
                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                          {STATUS_LABELS[entry.name] || entry.name}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                          {entry.value ?? entry.Tasks}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Task list */}
              <div className="w-1/2 flex flex-col">
                {/* Task list header */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {activeSegment ? (STATUS_LABELS[activeSegment] || activeSegment) : 'Select a segment'}
                    </span>
                  </div>
                  {activeSegment && (
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                      {totalCount} Task{totalCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Task list body */}
                <div className="flex-1 overflow-y-auto">
                  {!activeSegment && (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                      Click a chart segment to view tasks
                    </div>
                  )}

                  {activeSegment && loading && (
                    <div className="space-y-3 p-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 rounded-xl animate-pulse bg-gray-50 dark:bg-gray-800/50" />
                      ))}
                    </div>
                  )}

                  {activeSegment && !loading && tasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm gap-2">
                      {error ? (
                        <>
                          <span className="text-red-500 dark:text-red-400">Error: {error}</span>
                          <button onClick={() => fetchTasks(activeSegment)} className="text-xs text-indigo-500 hover:text-indigo-700 underline">Retry</button>
                        </>
                      ) : (
                        'No tasks found'
                      )}
                    </div>
                  )}

                  {activeSegment && !loading && tasks.length > 0 && (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                        >
                          {/* Status indicator */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            task.status === 'COMPLETED' || task.status === 'ACCEPTED' || task.status === 'CLOSED'
                              ? 'border-emerald-500 bg-emerald-500'
                              : task.status === 'IN_PROGRESS'
                              ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20'
                              : task.status === 'IN_REVIEW'
                              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {(task.status === 'COMPLETED' || task.status === 'ACCEPTED' || task.status === 'CLOSED') && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          {/* Task info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {task.list?.space?.name && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{task.list.space.name}</span>
                              )}
                              {task.project?.name && (
                                <>
                                  <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{task.project.name}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Status badge */}
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(task.status)}`}>
                            {STATUS_LABELS[task.status] || task.status}
                          </span>

                          {/* Priority */}
                          {task.priority && task.priority !== 'MEDIUM' && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                              task.priority === 'URGENT' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                              task.priority === 'HIGH' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}>
                              {task.priority === 'URGENT' ? 'p' : task.priority === 'HIGH' ? 'p' : ''}
                            </span>
                          )}

                          {/* Assignees */}
                          <div className="flex -space-x-1.5 shrink-0">
                            {task.assignees?.slice(0, 3).map((a) => (
                              <div
                                key={a.id}
                                title={`${a.firstName} ${a.lastName}`}
                                className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden flex items-center justify-center text-[9px] font-bold text-white"
                              >
                                {a.avatarUrl ? (
                                  <img src={a.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  `${a.firstName?.[0] || ''}${a.lastName?.[0] || ''}`.toUpperCase()
                                )}
                              </div>
                            ))}
                            {(task.assignees?.length || 0) > 3 && (
                              <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-500 dark:text-gray-400">
                                +{task.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
