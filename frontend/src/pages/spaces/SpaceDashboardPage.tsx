import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { Space, Task } from '../../types';
import { BarChart2, CheckCircle2, Calendar, AlertCircle, List, Star, ArrowLeft, X, ChevronRight, TrendingUp, Users, FolderOpen, Layout } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../hooks/useSocket';
import { useNotifications } from '../../hooks/useNotifications';
import { useAppSelector } from '../../store';
import { Modal } from '../../components/ui/Modal';
import { TaskDetailPage } from '../tasks/TaskDetailPage';

interface SpaceStats {
  active: number;
  completed: number;
  dueToday: number;
  late: number;
  all: number;
  starred: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1.5
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1.5
    }
  }
} as const;

function ScrollingActivityTicker({ notifications }: { notifications: any[] }) {
  if (notifications.length === 0) return null;

  // Quadruple notifications for an ultra-seamless long loop
  const displayItems = [...notifications, ...notifications, ...notifications, ...notifications];

  return (
    <div className="relative w-full overflow-hidden bg-white/40 dark:bg-gray-800/10 backdrop-blur-xl border-y border-gray-100 dark:border-white/5 py-4 group">
      {/* Precision Gradient Overlays for high-end depth */}
      <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-gray-50/80 dark:from-gray-900/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-gray-50/80 dark:from-gray-900/80 to-transparent z-10 pointer-events-none" />

      <div className="flex whitespace-nowrap animate-marquee-smooth group-hover:pause-animation">
        {displayItems.map((n, i) => (
          <div 
            key={`${n.id}-${i}`}
            className="inline-flex items-center gap-6 px-14 py-1 select-none"
          >
            {/* Action Emoji as the primary 'Avatar' */}
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-2xl border border-gray-100 dark:border-gray-700 shrink-0 transform group-hover:rotate-12 transition-transform">
              {n.message.toLowerCase().includes('comment') ? '💬' : 
               n.message.toLowerCase().includes('attach') ? '📎' : 
               n.message.toLowerCase().includes('assign') ? '👤' : 
               n.message.toLowerCase().includes('due') ? '📅' : '📝'}
            </div>
            
            <div className="flex flex-col">
              <span className="text-[13px] font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">
                {n.title}
              </span>
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                {n.message}
              </span>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee-smooth {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-smooth {
          display: inline-flex;
          animation: marquee-smooth 65s linear infinite;
        }
        .group:hover .animate-marquee-smooth {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

export function SpaceDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [stats, setStats] = useState<SpaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const navigate = useNavigate();
  const socket = useSocket();
  const { notifications } = useNotifications();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);

  const fetchStats = useCallback(async () => {
    try {
      const [spaceRes, statsRes] = await Promise.all([
        api.get<{ success: boolean; data: Space }>(`/spaces/${id}`),
        api.get<{ success: boolean; data: SpaceStats }>(`/spaces/${id}/stats`)
      ]);
      if (spaceRes.data.success) setSpace(spaceRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch space stats:', err);
    }
  }, [id]);

  const fetchFilteredTasks = useCallback(async (filterId: string) => {
    setFetchingTasks(true);
    try {
      const res = await api.get<{ success: boolean; data: Task[] }>(`/spaces/${id}/tasks?filter=${filterId}`);
      if (res.data.success) setFilteredTasks(res.data.data);
    } catch (err) {
      console.error('Failed to fetch filtered tasks:', err);
    } finally {
      setFetchingTasks(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  const activeFilterRef = useRef(activeFilter);
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    if (!socket || !currentOrg?.id) return;

    socket.emit('join-organization', currentOrg.id);

    let timeout: any;
    const handleRefresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        fetchStats();
        const activeLabel = activeFilterRef.current;
        if (activeLabel) {
          const map: Record<string, string> = {
            'Active': 'active', 'Completed': 'completed', 'Due today': 'dueToday',
            'Late': 'late', 'All': 'all', 'Starred': 'starred'
          };
          fetchFilteredTasks(map[activeLabel]);
        }
      }, 500);
    };

    socket.on('task:updated', handleRefresh);
    socket.on('dashboard:refresh', handleRefresh);

    return () => {
      clearTimeout(timeout);
      socket.off('task:updated', handleRefresh);
      socket.off('dashboard:refresh', handleRefresh);
    };
  }, [socket, currentOrg?.id, fetchStats, fetchFilteredTasks]);

  const selectFilter = async (filterId: string, label: string) => {
    setActiveFilter(label);
    fetchFilteredTasks(filterId);
  };

  const completionPercentage = useMemo(() => {
    if (!stats || !stats.all) return 0;
    return Math.round((stats.completed / stats.all) * 100);
  }, [stats]);

  if (loading) return <Loading size="lg" text="Crafting your dashboard..." />;
  if (!space || !stats) return (
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-gray-50 dark:bg-[#0F172A]">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400"
      >
        <Layout size={40} />
      </motion.div>
      <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Space not found</div>
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-indigo-500 hover:text-indigo-400 font-bold transition-all group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Go back
      </button>
    </div>
  );

  const statCards = [
    { id: 'active', label: 'Active', value: stats.active, icon: BarChart2, color: '#3B82F6', text: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
    { id: 'completed', label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#10B981', text: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
    { id: 'dueToday', label: 'Due today', value: stats.dueToday, icon: Calendar, color: '#6366F1', text: 'text-indigo-500', bg: 'bg-indigo-50/50 dark:bg-indigo-900/10' },
    { id: 'late', label: 'Late', value: stats.late, icon: AlertCircle, color: '#F43F5E', text: 'text-rose-500', bg: 'bg-rose-50/50 dark:bg-rose-900/10' },
    { id: 'all', label: 'All', value: stats.all, icon: List, color: '#6B7280', text: 'text-gray-500', bg: 'bg-gray-50/50 dark:bg-gray-800/50' },
    { id: 'starred', label: 'Starred', value: stats.starred, icon: Star, color: '#F59E0B', text: 'text-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-[#0F172A] relative custom-scrollbar">
      {/* Background blobs for premium feel */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 relative z-10"
      >

        {/* Header Section */}
        <motion.header
          variants={itemVariants}
          className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div className="flex items-center gap-8">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.2}
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl text-white shadow-2xl shadow-indigo-500/30 cursor-grab active:cursor-grabbing relative group"
              style={{ backgroundColor: space.color || '#6366f1' }}
            >
              <span className="relative z-10">{space.icon || space.name.charAt(0).toUpperCase()}</span>
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl blur-sm" />
            </motion.div>
            <div>
              <motion.h1 
                layoutId="space-title"
                className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-3"
              >
                {space.name}
              </motion.h1>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                  {space.description || 'Elevating your workspace vision'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="h-12 px-6 glass rounded-2xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm border border-gray-200/50 dark:border-gray-700/50"
            >
              Back
            </button>
            <div className="h-12 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block" />
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tighter">Real-time</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Active Insight</p>
            </div>
          </div>
        </motion.header>

        {/* Real-time Task Activity Ticker */}
        <motion.div variants={itemVariants} className="mb-12">
          <ScrollingActivityTicker notifications={notifications} />
        </motion.div>

        {/* Feature Cards Grid (Progress visualization) */}
        <motion.div variants={itemVariants} className="mb-12">
          <div className="glass-card rounded-[40px] p-8 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -mr-32 -mt-32 rounded-full group-hover:bg-indigo-500/20 transition-all duration-700" />
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1 w-full flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                    <TrendingUp className="text-indigo-500" />
                    Overall Progress
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md font-medium">
                    You've finalized <b>{completionPercentage}%</b> of all objectives in this space. Keep the momentum high to hit your targets!
                  </p>
                </div>
                
                <div className="w-full space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Space Completion Rate</span>
                    <span className="text-xl font-black text-indigo-500">{completionPercentage}%</span>
                  </div>
                  <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-1 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPercentage}%` }}
                      transition={{ duration: 1.5, ease: 'circOut' }}
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full shadow-lg relative"
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full lg:w-auto shrink-0">
                <div className="p-6 rounded-3xl bg-white/50 dark:bg-white/5 border border-white dark:border-white/10 shadow-sm flex flex-col gap-2">
                  <Users className="text-indigo-500" size={24} />
                  <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{space.members?.length || 0}</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Collaborators</span>
                </div>
                <div className="p-6 rounded-3xl bg-white/50 dark:bg-white/5 border border-white dark:border-white/10 shadow-sm flex flex-col gap-2">
                  <FolderOpen className="text-purple-500" size={24} />
                  <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{space.folders?.length || 0}</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Folders</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={itemVariants}
          layout
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-12"
        >
          {statCards.map((card, idx) => (
            <motion.div
              key={card.label}
              whileHover={{ y: -8, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => selectFilter(card.id, card.label)}
              className={`p-6 rounded-[32px] ${card.bg} border border-white dark:border-gray-800 flex flex-col gap-6 backdrop-blur-md shadow-lg shadow-gray-200/50 dark:shadow-none transition-all cursor-pointer relative overflow-hidden group ${activeFilter === card.label ? 'ring-2 ring-indigo-500 ring-offset-4 dark:ring-offset-[#0F172A]' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl ${card.bg.replace('bg-', 'bg-opacity-40 bg-')} ${card.text} flex items-center justify-center shadow-inner`}>
                  <card.icon size={22} strokeWidth={2.5} />
                </div>
                {activeFilter === card.label && (
                   <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                )}
              </div>
              <div>
                <motion.div
                  key={card.value}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter"
                >
                  {card.value}
                </motion.div>
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                  {card.label}
                </p>
              </div>

              {/* Decorative background element */}
              <div className={`absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-all transform scale-150 rotate-12 group-hover:rotate-0 ${card.text}`}>
                <card.icon size={80} strokeWidth={3} />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Dynamic Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[500px]">
          <>
            {!activeFilter ? (
              <div className="glass-card p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full" />
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                  Space Architecture
                </h3>
                <div className="grid gap-4">
                  {[
                    { label: 'System Folders', val: space.folders?.length || 0, icon: FolderOpen, color: 'text-indigo-500' },
                    { label: 'Total Task Lists', val: (space.lists?.length || 0) + (space.folders?.reduce((acc: any, f: any) => acc + (f.lists?.length || 0), 0) || 0), icon: List, color: 'text-purple-500' },
                    { label: 'Active Members', val: space.members?.length || 0, icon: Users, color: 'text-emerald-500' }
                  ].map((item, i) => (
                    <motion.div 
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="flex items-center justify-between p-6 rounded-3xl bg-gray-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-gray-100 dark:hover:border-white/10 group cursor-default shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-white dark:bg-gray-800 ${item.color} shadow-sm group-hover:scale-110 transition-transform`}>
                          <item.icon size={20} />
                        </div>
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">{item.label}</span>
                      </div>
                      <span className="text-2xl font-black text-gray-900 dark:text-white">{item.val}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-card p-10 rounded-[40px] shadow-2xl flex flex-col h-full overflow-hidden border-2 border-indigo-500/10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-none">{activeFilter} Tasks</h3>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 animate-pulse">Filtered Active Feed</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ rotate: 90, scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setActiveFilter(null)} 
                    className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar max-h-[400px]">
                  {fetchingTasks ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                      <Loading size="lg" />
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest animate-pulse">Syncing tasks</p>
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full py-20 text-gray-300 dark:text-gray-600 gap-4"
                    >
                      <List size={64} strokeWidth={1} />
                      <p className="font-black uppercase tracking-[0.2em] text-xs">Horizon is empty</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTasks.map((task, idx) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="p-5 rounded-3xl bg-gray-50/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border-2 border-transparent hover:border-indigo-500/20 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex items-center justify-between"
                        >
                          <div className="flex items-center gap-5 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center text-[11px] font-black uppercase tracking-tighter shadow-md border border-gray-100 dark:border-gray-700 transition-all group-hover:shadow-indigo-500/10 ${
                              task.priority === 'URGENT' ? 'text-rose-500 border-rose-500/20' :
                              task.priority === 'HIGH' ? 'text-orange-500 border-orange-500/20' :
                              'text-indigo-500 border-indigo-500/20'
                            }`}>
                              {task.priority.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-bold text-gray-800 dark:text-white truncate group-hover:text-indigo-500 transition-colors leading-tight mb-1">{task.title}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{task.project?.name || 'Workspace Root'}</p>
                                {task.dueDate && (
                                  <>
                                    <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{new Date(task.dueDate).toLocaleDateString()}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <motion.div 
                            whileHover={{ x: 3 }}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent group-hover:bg-indigo-500/10 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 transition-all"
                          >
                            <ChevronRight size={20} />
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>

          <div
            className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 p-10 rounded-[40px] text-white shadow-2xl shadow-indigo-500/30 flex flex-col justify-between relative overflow-hidden group"
          >
            {/* Background pattern for card */}
            <div className="absolute inset-0 pattern-dots opacity-10" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6 shadow-soft">
                <Star className="text-white fill-white" size={24} />
              </div>
              <h3 className="text-3xl font-black mb-4">Elite Summary</h3>
              <p className="text-indigo-50/80 font-medium text-base leading-relaxed max-w-[280px]">
                Currently orchestrating <b>{stats.all}</b> missions in <b>"{space.name}"</b>.
                Your focus on the {stats.active} active tasks is driving the efficiency to <b>{completionPercentage}%</b>.
              </p>
            </div>

            <div className="mt-12 flex items-end justify-between relative z-10">
              <div className="flex -space-x-4">
                {[...Array(3)].map((_, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -10, zIndex: 10 }}
                    className="w-14 h-14 rounded-[20px] border-4 border-indigo-600 bg-white dark:bg-[#1E2530] flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase shadow-xl"
                  >
                    AI
                  </motion.div>
                ))}
                <div className="w-14 h-14 rounded-[20px] border-4 border-indigo-600 bg-indigo-400 flex items-center justify-center text-white text-[10px] font-black uppercase shadow-xl">
                  +{space.members?.length || 0}
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em]">Momentum</span>
                  <TrendingUp size={12} className="text-emerald-400" />
                </div>
                <div className="text-5xl font-black tracking-tighter">
                  {completionPercentage}<span className="text-lg ml-1 opacity-60">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Modal
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          className="max-w-6xl w-[95%] h-[90vh] p-0 overflow-hidden rounded-[32px] border-none shadow-none"
        >
          {selectedTaskId && (
            <TaskDetailPage
              isModal={true}
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
            />
          )}
        </Modal>

      </motion.div>
    </div>
  );
}
