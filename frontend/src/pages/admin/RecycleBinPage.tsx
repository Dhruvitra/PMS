import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrgRole } from '../../hooks/useOrgRole';
import { useAppSelector } from '../../store';
import { useToast } from '../../components/ui/Toast';
import { Loading } from '../../components/ui/Loading';
import { useSocket } from '../../hooks/useSocket';
import api from '../../services/api';
import { ImagePreview } from '../../components/attachments/ImagePreview';


type ItemType = 'task' | 'folder' | 'list' | 'attachment';

interface TrashedItem {
  id: string;
  name?: string;
  title?: string;
  originalName?: string;
  // attachment-specific fields (present when ItemType === 'attachment')
  isImage?: boolean;
  thumbnailUrl?: string;
  filename?: string;
  size?: number;
  attachments?: { size: number }[];
  lists?: {
    tasks: {
      attachments: { size: number }[];
    }[];
  }[];
  tasks?: {
    attachments: { size: number }[];
  }[];
  deletedAt: string;
  deletedBy?: {
    firstName: string;
    lastName: string;
  };
}

export const RecycleBinPage: React.FC = () => {
  const { isSuperAdmin, isOwner } = useOrgRole();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const toast = useToast();
  const socket = useSocket();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ItemType>('task');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [trashData, setTrashData] = useState<{
    tasks: TrashedItem[];
    folders: TrashedItem[];
    lists: TrashedItem[];
    attachments: TrashedItem[];
  }>({
    tasks: [],
    folders: [],
    lists: [],
    attachments: []
  });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);


  const fetchTrash = useCallback(async (showLoading = true) => {
    if (!currentOrg?.id) return;
    try {
      if (showLoading) setLoading(true);
      const response = await api.get(`/admin/trash/${currentOrg.id}`);
      if (response.data.success) {
        setTrashData(response.data.data);
      }
    } catch (error) {
      const msg =
        (error as any)?.response?.data?.message ||
        (error as any)?.message ||
        'Failed to fetch trash data';
      if (showLoading) toast.error(msg);
      // Helpful for debugging forbidden/unauthorized
      // eslint-disable-next-line no-console
      console.error('Recovery Panel fetchTrash failed:', (error as any)?.response?.status, (error as any)?.response?.data || error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (isSuperAdmin || isOwner) {
      fetchTrash();
    }
  }, [isSuperAdmin, isOwner, fetchTrash]);

  // WebSocket Refresh Logic & Room Joining
  useEffect(() => {
    if (!socket || !currentOrg?.id) return;

    // Ensure we are in the org room
    socket.emit('join-organization', currentOrg.id);

    const handleRefresh = (data?: any) => {
      // Small delay to ensure DB transaction is fully committed before re-fetching
      setTimeout(() => fetchTrash(false), 100);
    };

    socket.on('task:refresh', handleRefresh);
    socket.on('space:updated', handleRefresh);
    socket.on('dashboard:refresh', handleRefresh);

    return () => {
      socket.off('task:refresh', handleRefresh);
      socket.off('space:updated', handleRefresh);
      socket.off('dashboard:refresh', handleRefresh);
    };
  }, [socket, currentOrg?.id, fetchTrash]);

  const calculateItemSize = (item: TrashedItem, type: ItemType): number => {
    if (type === 'attachment') return item.size || 0;
    
    let total = 0;
    if (type === 'task') {
      total = item.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0;
    } else if (type === 'list') {
      total = item.tasks?.reduce((sum, task) => 
        sum + (task.attachments?.reduce((tSum, att) => tSum + (att.size || 0), 0) || 0), 0) || 0;
    } else if (type === 'folder') {
      total = item.lists?.reduce((lSum, list) => 
        lSum + (list.tasks?.reduce((tSum, task) => 
          tSum + (task.attachments?.reduce((attSum, att) => attSum + (att.size || 0), 0) || 0), 0) || 0), 0) || 0;
    }
    return total;
  };

  const handleRestore = async (type: ItemType, id: string) => {
    // Optimistic Update: Remove from UI immediately
    const previousData = { ...trashData };
    const key = `${type}s` as keyof typeof trashData;
    setTrashData(prev => ({
      ...prev,
      [key]: prev[key].filter(item => item.id !== id)
    }));

    try {
      const response = await api.post(`/admin/trash/restore/${type}/${id}`, { organizationId: currentOrg?.id });
      if (response.data.success) {
        toast.success('Item restored successfully');
        // socket will trigger a full background refresh
      } else {
        setTrashData(previousData);
      }
    } catch (error) {
      toast.error('Failed to restore item');
      setTrashData(previousData);
    }
  };

  const handlePermanentDelete = async (type: ItemType, id: string) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;
    
    // Optimistic Update
    const previousData = { ...trashData };
    const key = `${type}s` as keyof typeof trashData;
    setTrashData(prev => ({
      ...prev,
      [key]: prev[key].filter(item => item.id !== id)
    }));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      const response = await api.delete(`/admin/trash/permanent/${type}/${id}`, { data: { organizationId: currentOrg?.id } });
      if (response.data.success) {
        toast.success('Item permanently deleted');
      } else {
        setTrashData(previousData);
      }
    } catch (error) {
      toast.error('Failed to delete item permanently');
      setTrashData(previousData);
    }
  };

  const handleBulkAction = async (action: 'restore' | 'wipe') => {
    if (selectedIds.size === 0) return;
    if (action === 'wipe' && !window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} items?`)) return;

    setIsBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      const endpoint = action === 'restore' 
        ? `/admin/trash/bulk-restore/${activeTab}` 
        : `/admin/trash/bulk-wipe/${activeTab}`;
      
      const response = await api.post(endpoint, { 
        ids, 
        organizationId: currentOrg?.id 
      });

      if (response.data.success) {
        toast.success(`${selectedIds.size} items ${action === 'restore' ? 'restored' : 'wiped'} successfully`);
        setSelectedIds(new Set());
        fetchTrash(false);
      }
    } catch (error) {
      toast.error(`Bulk ${action} failed`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: TrashedItem[]) => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalTrashSize = useMemo(() => {
    let tasksSize = trashData.tasks.reduce((sum, task) => sum + calculateItemSize(task, 'task'), 0);
    let foldersSize = trashData.folders.reduce((sum, folder) => sum + calculateItemSize(folder, 'folder'), 0);
    let listsSize = trashData.lists.reduce((sum, list) => sum + calculateItemSize(list, 'list'), 0);
    let attSize = trashData.attachments.reduce((sum, att) => sum + (att.size || 0), 0);
    return tasksSize + foldersSize + listsSize + attSize;
  }, [trashData]);

  if (!isSuperAdmin && !isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 font-sans">Access Denied</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">This area is reserved for Super Admins and Owners.</p>
      </div>
    );
  }

  const items = activeTab === 'task' ? trashData.tasks :
                activeTab === 'folder' ? trashData.folders :
                activeTab === 'list' ? trashData.lists :
                trashData.attachments;

  return (
    <div className="w-full h-full overflow-y-auto p-3 sm:p-4 md:p-8 max-w-6xl mx-auto bg-gray-50/30 dark:bg-transparent font-sans flex flex-col custom-scrollbar">
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 md:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1 sm:mb-2 italic">Admin Recovery Panel</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] sm:text-[11px] tracking-widest">Restore or permanently wipe deleted items from your workspace.</p>
        </div>
        
        <div className="bg-white/80 dark:bg-[#1E2530] px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
             <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Recoverable Storage</p>
            <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter tabular-nums">{formatSize(totalTrashSize)}</p>
          </div>
        </div>
      </div>

      {/* Tabs & Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
        <div className="flex gap-1.5 sm:gap-2 bg-white/50 dark:bg-gray-800/30 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 w-full sm:w-fit overflow-x-auto scrollbar-none">
          {(['task', 'list', 'attachment'] as ItemType[]).map((tab) => {
            const count = trashData[`${tab}s` as keyof typeof trashData].length;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
                className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-[13px] font-bold transition-all duration-300 capitalize flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 sm:ring-4 ring-indigo-500/10'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {tab}s
                <span className={`px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black ${
                  activeTab === tab ? 'bg-indigo-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-500/20 w-full sm:w-auto"
            >
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg sm:rounded-xl">
                {selectedIds.size} SELECTED
              </div>
              <button 
                onClick={() => handleBulkAction('restore')}
                disabled={isBulkLoading}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md flex items-center gap-1.5 sm:gap-2"
              >
                {isBulkLoading ? 'Processing...' : 'BULK RESTORE'}
              </button>
              <button 
                onClick={() => handleBulkAction('wipe')}
                disabled={isBulkLoading}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black bg-red-500 text-white hover:bg-red-600 transition-all shadow-md"
              >
                BULK WIPE
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white dark:bg-[#1E2530] rounded-2xl sm:rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-gray-200 dark:border-gray-800/50 overflow-hidden backdrop-blur-3xl">
        {loading ? (
          <div className="h-60 sm:h-96 flex items-center justify-center">
            <Loading size="lg" text="Auditing trash logs..." />
          </div>
        ) : items.length === 0 ? (
          <div className="h-60 sm:h-96 flex flex-col items-center justify-center text-center opacity-60 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[11px] sm:text-[12px] tracking-widest">Trash is currently clear</p>
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            {/* Inner boxed area (max 9 items, then scroll) */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/20 overflow-hidden">
              <div className="max-h-[620px] overflow-y-auto">
                {/* Desktop Table - hidden on mobile */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-gray-50/90 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800/50 sticky top-0 z-10 backdrop-blur">
                    <th className="px-6 py-4 w-10">
                      <input 
                        type="checkbox" 
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onChange={() => toggleSelectAll(items)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                        title="Select all"
                      />
                    </th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Item Name</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Storage Size</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Deleted By</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date Removed</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => {
                      const size = calculateItemSize(item, activeTab);
                      return (
                        <motion.tr
                          key={item.id}
                           initial={{ opacity: 0, scale: 0.98 }}
                           animate={{ opacity: 1, scale: 1 }}
                           exit={{ opacity: 0, x: 20 }}
                           className={`group transition-all ${selectedIds.has(item.id) ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/20'}`}
                         >
                           <td className="px-6 py-5">
                              <input 
                                type="checkbox" 
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelect(item.id)}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                                title="Select item"
                              />
                           </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              {activeTab === 'attachment' && item.isImage && item.thumbnailUrl && (
                                 <div 
                                   className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-zoom-in hover:scale-110 transition-transform"
                                   onClick={() => {
                                     const imageAttachments = trashData.attachments.filter(a => a.isImage);
                                     const idx = imageAttachments.findIndex(a => a.id === item.id);
                                     setPreviewIndex(idx);
                                   }}
                                 >
                                   <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                 </div>
                              )}
                              <button
                                onClick={() => {
                                  if (activeTab === 'attachment' && item.isImage) {
                                    const imageAttachments = trashData.attachments.filter(a => a.isImage);
                                    const idx = imageAttachments.findIndex(a => a.id === item.id);
                                    setPreviewIndex(idx);
                                  }
                                }}
                                className={`font-bold text-gray-900 dark:text-gray-100 tracking-tight text-left ${activeTab === 'attachment' && item.isImage ? 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline' : ''}`}
                              >
                                {item.title || item.name || item.originalName || 'Untitled'}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`text-[12px] font-black px-2 py-1 rounded shadow-sm ${
                              size > 0 ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'text-gray-400 bg-gray-50 dark:bg-gray-800'
                            }`}>
                              {formatSize(size)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                                {item.deletedBy ? `${item.deletedBy.firstName?.[0] || ''}${item.deletedBy.lastName?.[0] || ''}` : 'U'}
                              </div>
                              <span className="text-[13px] font-bold text-gray-700 dark:text-gray-300">
                                {item.deletedBy ? `${item.deletedBy.firstName} ${item.deletedBy.lastName}` : 'System'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-[12px] font-bold text-gray-500 dark:text-gray-500 tabular-nums">
                              {new Date(item.deletedAt).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right space-x-3">
                            <button
                              onClick={() => handleRestore(activeTab, item.id)}
                              className="px-4 py-2 rounded-xl text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
                            >
                              RESTORE
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(activeTab, item.id)}
                              className="px-4 py-2 rounded-xl text-[11px] font-black text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/25 active:scale-95 uppercase tracking-widest"
                            >
                              WIPE
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
                </div>

                {/* Mobile Card Layout - shown only on mobile */}
                <div className="md:hidden max-h-[760px] overflow-y-auto">
              {/* Select All bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                <input 
                  type="checkbox" 
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onChange={() => toggleSelectAll(items)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                  title="Select all"
                />
                <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select All</span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                <AnimatePresence mode="popLayout">
                  {items.map((item) => {
                    const size = calculateItemSize(item, activeTab);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`p-4 transition-all ${selectedIds.has(item.id) ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5 shrink-0" 
                            title="Select item"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {activeTab === 'attachment' && item.isImage && item.thumbnailUrl && (
                                <div 
                                  className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-zoom-in shrink-0"
                                  onClick={() => {
                                    const imageAttachments = trashData.attachments.filter(a => a.isImage);
                                    const idx = imageAttachments.findIndex(a => a.id === item.id);
                                    setPreviewIndex(idx);
                                  }}
                                >
                                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  if (activeTab === 'attachment' && item.isImage) {
                                    const imageAttachments = trashData.attachments.filter(a => a.isImage);
                                    const idx = imageAttachments.findIndex(a => a.id === item.id);
                                    setPreviewIndex(idx);
                                  }
                                }}
                                className={`font-bold text-[13px] text-gray-900 dark:text-gray-100 tracking-tight text-left truncate ${activeTab === 'attachment' && item.isImage ? 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline' : ''}`}
                              >
                                {item.title || item.name || item.originalName || 'Untitled'}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
                              <span className={`font-black px-1.5 py-0.5 rounded shadow-sm ${
                                size > 0 ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'text-gray-400 bg-gray-50 dark:bg-gray-800'
                              }`}>
                                {formatSize(size)}
                              </span>
                              <span className="text-gray-300 dark:text-gray-600">·</span>
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[8px] font-black text-white">
                                  {item.deletedBy ? `${item.deletedBy.firstName?.[0] || ''}${item.deletedBy.lastName?.[0] || ''}` : 'U'}
                                </div>
                                <span className="font-bold text-gray-600 dark:text-gray-400">
                                  {item.deletedBy ? `${item.deletedBy.firstName} ${item.deletedBy.lastName}` : 'System'}
                                </span>
                              </div>
                              <span className="text-gray-300 dark:text-gray-600">·</span>
                              <span className="font-bold text-gray-400 dark:text-gray-500 tabular-nums">
                                {new Date(item.deletedAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRestore(activeTab, item.id)}
                                className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest text-center"
                              >
                                RESTORE
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(activeTab, item.id)}
                                className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/25 active:scale-95 uppercase tracking-widest text-center"
                              >
                                WIPE
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {previewIndex !== null && (
        <ImagePreview
          images={trashData.attachments.filter(a => a.isImage).map(a => ({
            url: `/uploads/${(a as any).filename}`,
            name: a.title || a.name || a.originalName || 'Untitled'
          }))}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
};
