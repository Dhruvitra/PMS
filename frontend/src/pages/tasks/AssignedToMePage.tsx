import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { Avatar } from '../../components/ui/Avatar';
import { Loading } from '../../components/ui/Loading';
import { useOrgRole } from '../../hooks/useOrgRole';
import { cn } from '../../utils/cn';
import type { Task, TaskStatus, TaskPriority } from '../../types';
import { ConfirmDialog } from '../../components/modals/ConfirmDialog';

/* ─── Status config ──────────────────────────────────────────── */

const STATUS_GROUPS: { key: TaskStatus; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'OPEN', label: 'OPEN', color: 'text-gray-900 dark:text-gray-100', bg: 'bg-gray-100 dark:bg-gray-800', dot: 'bg-gray-400' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', dot: 'bg-red-500' },
  { key: 'PENDING', label: 'PENDING', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
  { key: 'IN_REVIEW', label: 'IN REVIEW', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', dot: 'bg-purple-500' },
  { key: 'COMPLETED', label: 'COMPLETED', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', dot: 'bg-green-500' },
  { key: 'ACCEPTED', label: 'ACCEPTED', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500' },
  { key: 'REJECTED', label: 'REJECTED', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30', dot: 'bg-rose-500' },
  { key: 'CLOSED', label: 'CLOSED', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/40', dot: 'bg-gray-300' },
];

/* ─── Priority config ────────────────────────────────────────── */
type PriorityKey = TaskPriority;
const PRIORITY_META: Record<PriorityKey, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: '#ef4444' },
  HIGH: { label: 'High', color: '#f97316' },
  MEDIUM: { label: 'Normal', color: '#3b82f6' },
  LOW: { label: 'Low', color: '#6b7280' },
};

const PRIORITY_BG_CLASSES: Record<PriorityKey, string> = {
  URGENT: 'bg-[#ef4444]',
  HIGH: 'bg-[#f97316]',
  MEDIUM: 'bg-[#3b82f6]',
  LOW: 'bg-[#6b7280]',
};

const AVATAR_BG_CLASSES: Record<string, string> = {
  '#ef4444': 'bg-[#ef4444]',
  '#f97316': 'bg-[#f97316]',
  '#eab308': 'bg-[#eab308]',
  '#22c55e': 'bg-[#22c55e]',
  '#3b82f6': 'bg-[#3b82f6]',
  '#8b5cf6': 'bg-[#8b5cf6]',
  '#ec4899': 'bg-[#ec4899]',
};

/* ─── Relative date ──────────────────────────────────────────── */
function relativeDate(dateStr: string | null): { text: string; overdue: boolean } {
  if (!dateStr) return { text: '', overdue: false };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const diff = Math.round((now.getTime() - due.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d`, overdue: false };
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Yesterday', overdue: true };
  return { text: `${diff}d`, overdue: true };
}

/* ─── Status pie icon (same as ListPage) ─────────────────────── */
function TaskStatusPie({ status, className = "w-[14px] h-[14px]" }: { status: TaskStatus; className?: string }) {
  let piePath = "";
  let pieColorClsMap = "";
  switch (status) {
    case 'OPEN': piePath = ""; pieColorClsMap = "text-[#3E4C59] dark:text-[#CBD5E0]"; break;
    case 'PENDING': piePath = "M12 12 L12 3 A9 9 0 0 1 18.36 5.64 Z"; pieColorClsMap = "text-[#FADB5E]"; break;
    case 'IN_PROGRESS': piePath = "M12 12 L12 3 A9 9 0 0 1 21 12 Z"; pieColorClsMap = "text-[#E11D48] dark:text-[#F43F5E]"; break;
    case 'IN_REVIEW': piePath = "M12 12 L12 3 A9 9 0 0 1 12 21 Z"; pieColorClsMap = "text-[#EA580C] dark:text-[#F97316]"; break;
    case 'ACCEPTED': piePath = "M12 12 L12 3 A9 9 0 1 1 3 12 Z"; pieColorClsMap = "text-[#C5221F] dark:text-[#EF4444]"; break;
    case 'REJECTED': piePath = "M12 12 L12 3 A9 9 0 1 1 5.64 5.64 Z"; pieColorClsMap = "text-[#9C27B0] dark:text-[#D946EF]"; break;
    case 'COMPLETED': piePath = "M12 12 L12 3 A9 9 0 1 1 11.99 3 Z"; pieColorClsMap = "text-gray-900 dark:text-gray-200"; break;
    case 'CLOSED': piePath = "M12 12 L12 3 A9 9 0 1 1 11.99 3 Z"; pieColorClsMap = "text-[#2E7D32] dark:text-[#4ADE80]"; break;
  }
  const hasColor = className?.includes('text-');
  const pieColorCls = hasColor ? "" : pieColorClsMap;
  return (
    <svg className={`shrink-0 ${pieColorCls} ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      {piePath && <path d={piePath} fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />}
    </svg>
  );
}

/* ─── Icon helpers ───────────────────────────────────────────── */
function FlagIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill={color}>
      <path d="M4 3a1 1 0 00-1 1v13a1 1 0 102 0v-5h4.586l.707.707A1 1 0 0011 13h5a1 1 0 001-1V5a1 1 0 00-1-1h-4.586l-.707-.707A1 1 0 0010 3H4z" />
    </svg>
  );
}

function AvatarPill({ firstName, lastName, avatarUrl }: { firstName: string; lastName: string; avatarUrl?: string | null }) {
  const letters = `${firstName ? firstName.charAt(0) : '?'}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();

  if (avatarUrl) return (
    <img
      src={avatarUrl}
      alt=""
      className="w-full h-full object-cover rounded-md"
    />
  );

  return (
    <div className="w-full h-full text-white text-[8px] font-black flex items-center justify-center shrink-0 rounded-md bg-gradient-to-br from-blue-500 to-purple-600">
      {letters}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export function AssignedToMePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'STATUS' | 'FAVORITES'>('STATUS');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { canDeleteTask } = useOrgRole();

  /* Search / filter */
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL');
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [projectFilter, setProjectFilter] = useState<string | 'ALL'>('ALL');

  /* Redux state */
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const currentUser = useAppSelector(state => (state as any).user.currentUser);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = currentOrg?.id ? `?orgId=${currentOrg.id}` : '';
      const r = await api.get<{ success: boolean; data: Task[] }>(`/tasks/my${params}`);
      setTasks(r.data.data);
    } catch (err) { 
      console.error('Failed to load tasks', err);
    } finally { 
      setLoading(false); 
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const socket = useSocket();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!socket) return;
    let timeout: any;
    const handleRefresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(loadTasks, 500);
    };
    socket.on('task:updated', handleRefresh);
    socket.on('task:refresh', handleRefresh);
    return () => {
      clearTimeout(timeout);
      socket.off('task:updated', handleRefresh);
      socket.off('task:refresh', handleRefresh);
    };
  }, [socket, loadTasks]);

  useEffect(() => { if (showSearch && searchRef.current) searchRef.current.focus(); }, [showSearch]);

  const toggleGroup = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  /* Derived data */
  const projects = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      if (t.project) map.set(t.project.id, t.project);
    });
    return Array.from(map.values());
  }, [tasks]);

  const filtered = useMemo(() => {
    let base = tasks;
    const qParams = new URLSearchParams(location.search);
    const filterParam = qParams.get('filter');

    if (filterParam === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      base = base.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() <= today.getTime() && t.status !== 'CLOSED' && t.status !== 'COMPLETED';
      });
    } else if (filterParam === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      base = base.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() < today.getTime() && t.status !== 'CLOSED' && t.status !== 'COMPLETED';
      });
    }

    if (view === 'FAVORITES') {
      base = base.filter(t => t.isFavorite);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(t => t.title.toLowerCase().includes(q));
    }
    if (statusFilter !== 'ALL') {
      base = base.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'ALL') {
      base = base.filter(t => t.priority === priorityFilter);
    }
    if (projectFilter !== 'ALL') {
      base = base.filter(t => t.project?.id === projectFilter);
    }
    return base;
  }, [tasks, search, view, location.search, statusFilter, priorityFilter, projectFilter]);

  const toggleFavorite = async (e: React.MouseEvent, taskId: string, current: boolean) => {
    e.stopPropagation();
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isFavorite: !current } : t));
      await api.patch(`/tasks/${taskId}`, { isFavorite: !current });
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isFavorite: current } : t));
    }
  };

  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const performDeleteTask = async () => {
    if (!confirmDeleteTaskId) return;
    try {
      setIsDeletingTask(true);
      await api.delete(`/tasks/${confirmDeleteTaskId}`);
      setTasks(p => p.filter(t => t.id !== confirmDeleteTaskId));
      setConfirmDeleteTaskId(null);
    } catch {
      alert('Failed to delete task');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    const closeMenu = () => setActiveMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  if (loading) return <Loading size="lg" />;

  const filterParam = new URLSearchParams(location.search).get('filter');

  const pendingDeleteTitle = confirmDeleteTaskId
    ? tasks.find(t => t.id === confirmDeleteTaskId)?.title
    : undefined;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex overflow-hidden font-sans antialiased text-gray-800">
      
      {/* ── Left Sidebar ── */}
      <aside className="w-64 border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 bg-[#F9FAFB] dark:bg-gray-900/50 hidden md:flex">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Tasks</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Assigned to me</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <nav className="space-y-1">
            <button
              onClick={() => { navigate('/tasks/assigned'); setView('STATUS'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold transition-all",
                (!filterParam && view === 'STATUS') ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9h18M3 15h18M3 3h18v18H3z" /></svg>
              All My Tasks
            </button>
            <button
              onClick={() => navigate('/tasks/assigned?filter=today')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold transition-all",
                filterParam === 'today' ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Today
            </button>
            <button
              onClick={() => navigate('/tasks/assigned?filter=overdue')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold transition-all",
                filterParam === 'overdue' ? "bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              Overdue
            </button>
            <button
              onClick={() => { navigate('/tasks/assigned'); setView('FAVORITES'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold transition-all",
                view === 'FAVORITES' ? "bg-white dark:bg-gray-800 text-amber-500 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={view === 'FAVORITES' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              Favorites
            </button>
          </nav>

          {projects.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3">Projects</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setProjectFilter('ALL')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all text-left",
                    projectFilter === 'ALL' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  All Projects
                </button>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProjectFilter(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all text-left",
                      projectFilter === p.id ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
           <div className="flex items-center gap-3 px-3">
              <Avatar firstName={currentUser?.firstName} lastName={currentUser?.lastName} avatarUrl={currentUser?.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{currentUser?.firstName} {currentUser?.lastName}</p>
                <p className="text-[10px] text-gray-400 truncate tracking-tight">{currentUser?.email}</p>
              </div>
           </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* ── Top toolbar ── */}
        <div className="h-[48px] sm:h-[52px] flex items-center justify-between px-3 sm:px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
             <h2 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mr-2 sm:mr-4 truncate">Assigned to me</h2>
          </div>

          <div className="flex items-center gap-1">
            <div className="relative" ref={filterRef}>
              <button
                title="Filter"
                onClick={() => setShowFilter(!showFilter)}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-lg transition-all",
                  (statusFilter !== 'ALL' || priorityFilter !== 'ALL')
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                {(statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-900" />
                )}
              </button>

              {showFilter && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 z-50 animate-scale-in">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Filters</span>
                    {(statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
                      <button
                        onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL'); }}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Status</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['ALL', 'OPEN', 'IN_PROGRESS', 'PENDING', 'IN_REVIEW', 'COMPLETED', 'ACCEPTED'].map(s => (
                          <button
                            key={s}
                            onClick={() => setStatusFilter(s as any)}
                            className={cn(
                              "px-2 py-1 text-[11px] font-bold rounded-lg border transition-all text-left",
                              statusFilter === s
                                ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                                : "bg-transparent border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                            )}
                          >
                            {s.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Priority</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['ALL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
                          <button
                            key={p}
                            onClick={() => setPriorityFilter(p as any)}
                            className={cn(
                              "px-2 py-1 text-[11px] font-bold rounded-lg border transition-all text-left",
                              priorityFilter === p
                                ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                                : "bg-transparent border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button title="Refresh" onClick={loadTasks} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg></button>
            <button title="Search" onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg></button>
          </div>
        </div>

        {showSearch && (
          <div className="px-3 sm:px-6 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 sm:gap-3 text-gray-400 dark:text-white animate-fade-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter tasks by name..."
              className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-700 dark:text-gray-200"
              autoFocus
            />
            <button title="Close search" onClick={() => { setShowSearch(false); setSearch(''); }} className="text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
          </div>
        )}

        {/* ── Mobile filter tabs (visible only on small screens) ── */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => { navigate('/tasks/assigned'); setView('STATUS'); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0",
              (!filterParam && view === 'STATUS') ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
            )}
          >
            All Tasks
          </button>
          <button
            onClick={() => navigate('/tasks/assigned?filter=today')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0",
              filterParam === 'today' ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
            )}
          >
            Today
          </button>
          <button
            onClick={() => navigate('/tasks/assigned?filter=overdue')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0",
              filterParam === 'overdue' ? "bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
            )}
          >
            Overdue
          </button>
          <button
            onClick={() => { navigate('/tasks/assigned'); setView('FAVORITES'); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0",
              view === 'FAVORITES' ? "bg-white dark:bg-gray-800 text-amber-500 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
            )}
          >
            Favorites
          </button>
        </div>

        {/* ── Task groups ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {STATUS_GROUPS.map(group => {
            const groupTasks = filtered.filter(t => t.status === group.key);
            const isCollapsed = collapsed[group.key] ?? false;
            if (groupTasks.length === 0) return null;

            return (
              <div key={group.key} className="mt-4">
                <div
                  className="flex items-center px-3 sm:px-6 py-1 cursor-pointer group/hdr"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="w-5 flex items-center justify-center mr-1 text-gray-400 dark:text-white">
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"
                      className={`shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  <div className={cn("px-2 py-0.5 rounded flex items-center gap-1.5 mr-2 border border-gray-100 dark:border-gray-800", group.bg)}>
                    <div className={cn("w-2 h-2 rounded-full border border-white/20", group.dot)} />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest leading-none", group.color)}>{group.label}</span>
                  </div>

                  <span className="text-[11px] font-black text-gray-400 tabular-nums">
                    {groupTasks.length}
                  </span>

                  <span className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors opacity-0 group-hover/hdr:opacity-100 cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
                    </svg>
                  </span>
                </div>

                {!isCollapsed && (
                  <div className="mt-2">
                    {/* Column headers */}
                    <div className="flex items-center px-3 sm:px-6 py-1.5 text-sm font-medium text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                      <div className="sm:w-[55%] min-w-0">Name</div>
                      <div className="sm:w-[15%] text-center shrink-0">Priority</div>
                      <div className="sm:w-[15%] text-center shrink-0">Due date</div>
                      <div className="w-[32px] flex justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <circle cx="12" cy="12" r="10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-[1px]">
                    {groupTasks.map(task => {
                      const due = relativeDate(task.dueDate);
                      const pr = PRIORITY_META[task.priority];
                      const statusMeta = STATUS_GROUPS.find(s => s.key === task.status);
                      return (
                        <div
                          key={task.id}
                          onClick={() => navigate(`/tasks/${task.id}`, { state: { backgroundLocation: location } })}
                          className="flex flex-col sm:flex-row sm:items-center px-3 sm:px-6 py-2 sm:py-2.5 hover:bg-gray-50 dark:hover:bg-indigo-900/10 group transition-all cursor-pointer border-b border-gray-50/50 dark:border-gray-800/30 gap-1 sm:gap-0"
                        >
                          {/* Title row */}
                          <div className="sm:w-[55%] flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 min-w-0">
                            {/* Status indicator */}
                            <div className="shrink-0" title={statusMeta?.label || task.status}>
                              <TaskStatusPie status={task.status} className="w-[24px] h-[24px]" />
                            </div>
                            <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
                              {task.title}
                            </span>
                            {task.project && (
                               <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-[8px] font-black uppercase tracking-tighter shrink-0 hidden sm:inline">{task.project.name}</span>
                            )}
                          </div>

                          {/* Meta: wraps on mobile, inline columns on desktop */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-0 sm:contents text-[10px]">

                            {/* Priority with flag icon */}
                            <div className="sm:w-[15%] flex items-center sm:justify-center gap-1.5">
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke={pr.color} viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V3m0 0h13l-4 4.5L16 12H3" />
                              </svg>
                              <span className="text-[14px] font-medium" style={{ color: '#646464', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>{pr.label}</span>
                            </div>

                            {/* Due date with calendar icon */}
                            <div className="sm:w-[15%] flex items-center sm:justify-center gap-1.5">
                              {due.text ? (
                                <span className={`text-[14px] font-medium ${due.overdue ? 'text-red-500' : ''}`} style={{ color: due.overdue ? undefined : '#646464', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>{due.text}</span>
                              ) : (
                                <svg className="w-4 h-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                                </svg>
                              )}
                            </div>

                            {/* Actions - always visible on mobile */}
                            <div className="flex items-center gap-1 sm:gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity ml-auto sm:ml-0 sm:pr-2">
                              <button
                                title={task.isFavorite ? "Remove from favorites" : "Add to favorites"}
                                onClick={(e) => toggleFavorite(e, task.id, task.isFavorite)}
                                className={`p-0.5 sm:p-1 transition-colors ${task.isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill={task.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                              </button>
                              {canDeleteTask && (
                                <button
                                  title="Delete task"
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteTaskId(task.id); }}
                                  className="p-0.5 sm:p-1 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteTaskId}
        title="Are you sure?"
        description={pendingDeleteTitle ? `Do you want to delete "${pendingDeleteTitle}"?` : 'Do you want to delete this task?'}
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        isBusy={isDeletingTask}
        onClose={() => { if (!isDeletingTask) setConfirmDeleteTaskId(null); }}
        onConfirm={performDeleteTask}
      />
    </div>
  );
}
