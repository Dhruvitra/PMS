import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router';
import {
  ChevronRight,
  Star,
  BellOff,
  Archive,
  Clock,
  Check,
  Maximize2,
  MoreHorizontal,
  Send,
  Plus,
  Smile,
  AtSign,
  Paperclip,
  Zap,
  X,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import api from '../../services/api';
import { useAppSelector } from '../../store';
import { Loading, SkeletonActivity } from '../../components/ui/Loading';
import { useNotifications } from '../../hooks/useNotifications';
import { useSocket } from '../../hooks/useSocket';
import { ActivityTimeline, Activity } from '../../components/activity/ActivityTimeline';
import { TaskDetailPage } from '../tasks/TaskDetailPage';
import type { Task } from '../../types';
import { ConfirmDialog } from '../../components/modals/ConfirmDialog';
import { linkifyHtmlText } from '../../utils/text';

export function InboxDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { markTaskAsRead } = useNotifications();
  const currentOrg = useAppSelector((state) => state.organization.currentOrg);
  const [task, setTask] = useState<Task | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  
  useEffect(() => {
    if (task) setIsFavorite(task.isFavorite);
  }, [task]);

  /* ── Comment & Reply State ── */
  const [commentText, setCommentText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Activity | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const snoozeRef = useRef<HTMLDivElement>(null);

  // Close snooze menu on outside click
  useEffect(() => {
    if (!showSnoozeMenu) return;
    const handler = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        setShowSnoozeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSnoozeMenu]);

  /* ── File Upload State ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  /* ── Comment-area drag-and-drop ── */
  const [commentDragging, setCommentDragging] = useState(false);
  const commentDragCounter = useRef(0);

  /* ── Mention State ── */
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  /* ── Emoji State ── */
  const [showEmoji, setShowEmoji] = useState(false);
  const emojis = ['👍', '🔥', '✅', '🚀', '⭐', '❤️', '😊', '💡', '🎉', '📍'];
  const emojiRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  // Close mention picker on outside click
  useEffect(() => {
    if (!showMentions) return;
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMentions]);

  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
      loadMembers();
    }
  }, [taskId, currentOrg?.id]);

  const loadTask = async (id: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Task }>(`/tasks/${id}`);
      setTask(res.data.data);
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      if (!silent) setTimeout(() => setLoading(false), 200);
    }
  };

  const loadMembers = async () => {
    if (!currentOrg?.id) return;
    try {
      const res = await api.get<{ success: boolean; data: any[] }>('/users/all', { params: { orgId: currentOrg.id } });
      setMembers(res.data.data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handlePostComment = async () => {
    if ((!commentText.trim() && pendingFiles.length === 0) || !taskId || isPosting) return;

    setIsPosting(true);
    try {
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          // Step 1: Upload the file via the attachment endpoint
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await api.post<{ success: boolean; data: { filename: string; originalName: string; mimeType: string; size: number } }>(
            `/attachments/task/${taskId}`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );

          if (!uploadRes.data.success) throw new Error('File upload failed');

          const att = uploadRes.data.data;
          const fileUrl = `${api.defaults.baseURL?.replace('/api/v1', '') || ''}/uploads/${att.filename}`;

          const replyId = replyingTo?.changes?.commentId;

          // Step 2: Post comment as JSON with the uploaded file URL
          await api.post(`/tasks/${taskId}/comments`, {
            text: commentText.trim() || '',
            fileUrl,
            fileName: att.originalName,
            fileType: att.mimeType,
            fileSize: att.size,
            ...(att.mimeType.startsWith('image/') ? { imageUrl: fileUrl } : {}),
            ...(replyId ? { replyToId: String(replyId) } : {})
          });
        }
      } else {
        await api.post(`/tasks/${taskId}/comments`, {
          text: commentText.trim(),
          replyToId: (replyingTo?.changes?.commentId as string) || null
        });
      }
      setCommentText('');
      setReplyingTo(null);
      setPendingFiles([]);
      setRefreshKey(prev => prev + 1);
      if (commentInputRef.current) commentInputRef.current.style.height = 'auto';
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsPosting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || val[lastAtIdx - 1] === ' ')) {
      const query = val.slice(lastAtIdx + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (user: any) => {
    const lastAtIdx = commentText.lastIndexOf('@');
    const spaceIdx = commentText.indexOf(' ', lastAtIdx);
    const before = commentText.slice(0, lastAtIdx);
    const after = commentText.slice(spaceIdx === -1 ? commentText.length : spaceIdx);
    const mentionText = `@${user.firstName}${user.lastName} `;
    setCommentText(before + mentionText + after);
    setShowMentions(false);
    const cursorPos = before.length + mentionText.length;
    setTimeout(() => {
      const el = commentInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      }
    }, 50);
  };

  const insertEmoji = (emoji: string) => {
    setCommentText(prev => prev + emoji);
    setShowEmoji(false);
    commentInputRef.current?.focus();
  };

  const handleAIAction = () => {
    const aiPrompts = ["Can we get an update on this?", "Summarize current progress please.", "Looks good, proceeding."];
    setCommentText(prev => prev + (prev ? ' ' : '') + aiPrompts[Math.floor(Math.random() * aiPrompts.length)]);
    commentInputRef.current?.focus();
  };

  const handleToggleFavorite = async () => {
    if (!taskId || !task) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await api.patch(`/tasks/${taskId}`, { isFavorite: next });
    } catch {
      setIsFavorite(!next);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleSnooze = async (hours: number) => {
    if (!taskId || !task) return;
    try {
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + hours);
      await api.patch(`/tasks/${taskId}`, { dueDate: dueDate.toISOString() });
      setShowSnoozeMenu(false);
      loadTask(taskId);
    } catch (err) {
      console.error('Failed to snooze:', err);
    }
  };

  const handleArchive = async () => {
    if (!taskId || !task) return;
    try {
      setIsArchiving(true);
      await api.patch(`/tasks/${taskId}`, { status: 'CLOSED' });
      setConfirmArchiveOpen(false);
      navigate('/inbox');
    } catch (err) {
      console.error('Failed to archive:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const filteredMembers = members.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex-1 flex flex-col min-h-0 h-full bg-[#f8f9fb] dark:bg-[#0F172A] overflow-hidden font-sans relative ${isFullscreen ? 'p-4' : ''}`}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" title="Upload files" />
      <input type="file" ref={imageInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" title="Upload images" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1E2530] border-b border-gray-100 dark:border-gray-800 shrink-0 z-[210] shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 font-medium font-sans">
              <span onClick={() => navigate('/inbox')} className="hover:text-indigo-600 cursor-pointer transition-colors uppercase tracking-widest">Inbox</span>
              <ChevronRight size={10} className="shrink-0" />
              <span className="hover:text-gray-600 hidden sm:inline uppercase tracking-widest">Notifications</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-white text-[9px] font-black shrink-0">T</div>
              <h1
                onClick={() => { if (task?.id) setShowTaskModal(true); }}
                className="text-[14px] font-bold text-gray-900 dark:text-gray-100 truncate tracking-tight cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {task?.title || 'Loading...'}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-4 mr-2 text-slate-400 dark:text-slate-500">
            <button
              onClick={handleToggleFullscreen}
              className={`p-2 sm:p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 sm:hover:bg-transparent sm:dark:hover:bg-transparent transition-colors ${isFullscreen ? 'text-indigo-500' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Expand"
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={handleToggleFavorite}
              className={`p-2 sm:p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 sm:hover:bg-transparent sm:dark:hover:bg-transparent transition-colors ${isFavorite ? 'text-amber-500' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Favorite"
            >
              {isFavorite ? <Star size={18} fill="currentColor" /> : <Star size={18} />}
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 sm:p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 sm:hover:bg-transparent sm:dark:hover:bg-transparent transition-colors ${isMuted ? 'text-rose-500' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Mute"
            >
              {isMuted ? <Check size={18} /> : <BellOff size={18} />}
            </button>
            <button
              onClick={() => setConfirmArchiveOpen(true)}
              className="p-2 sm:p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 sm:hover:bg-transparent sm:dark:hover:bg-transparent hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Archive"
            >
              <Archive size={18} />
            </button>
            <div className="relative" ref={snoozeRef}>
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                className={`p-2 sm:p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 sm:hover:bg-transparent sm:dark:hover:bg-transparent transition-colors ${showSnoozeMenu ? 'text-indigo-500' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
                title="Snooze"
              >
                <Clock size={18} />
              </button>
              <AnimatePresence>
                {showSnoozeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-[#1E2530] border border-gray-100 dark:border-gray-800 rounded-xl shadow-2xl z-[300] py-1.5 overflow-hidden"
                  >
                    <div className="px-3 py-1.5 border-b border-gray-50 dark:border-gray-800/50 mb-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Snooze until</span>
                    </div>
                    {[
                      { label: '1 hour', value: 1 },
                      { label: '3 hours', value: 3 },
                      { label: 'Tomorrow', value: 24 },
                      { label: 'Next Week', value: 168 }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => handleSnooze(opt.value)}
                        className="w-full text-left px-4 py-2 text-[12px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2" />

          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl text-[13px] font-bold transition-all mr-2 shadow-sm ${showDetails ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <MoreHorizontal size={16} />
            Details
          </button>

        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex relative">
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
          {/* Scrollable Activity */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
            <div className="w-full max-w-3xl">
              <div className="space-y-6 pb-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Activity Stream</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live</span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                      <SkeletonActivity count={3} />
                    </motion.div>
                  ) : (
                    <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full">
                      <ActivityTimeline
                        taskId={taskId!}
                        refreshKey={refreshKey}
                        onImagePreview={(url, name) => setPreviewImage({ url, name })}
                        onReply={(act) => { setReplyingTo(act); commentInputRef.current?.focus(); }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Persistent Comment Bar – sticky footer */}
          <div
            className="relative shrink-0 w-full flex justify-center border-t border-gray-100 dark:border-gray-800/60 bg-[#f8f9fb] dark:bg-[#0F172A] px-4 py-3"
            onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); commentDragCounter.current++; setCommentDragging(true); } }}
            onDragLeave={() => { commentDragCounter.current--; if (commentDragCounter.current === 0) setCommentDragging(false); }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              commentDragCounter.current = 0;
              setCommentDragging(false);
              const dropped = Array.from(e.dataTransfer.files);
              if (dropped.length > 0) setPendingFiles(prev => [...prev, ...dropped]);
            }}
          >
            {commentDragging && (
              <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center border-2 border-dashed border-indigo-400 rounded-xl bg-indigo-50/90 dark:bg-indigo-900/50 backdrop-blur-[1px] mx-4">
                <div className="flex flex-col items-center gap-1.5">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-500"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">Drop files to attach</span>
                </div>
              </div>
            )}
            <div className="relative w-full max-w-3xl">
              <AnimatePresence>
                {pendingFiles.length > 0 && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-xl p-3 flex flex-wrap gap-2 mb-[-1px] shadow-lg">
                    {pendingFiles.map((file, idx) => {
                      const isImg = file.type.startsWith('image/');
                      const previewUrl = isImg ? URL.createObjectURL(file) : '';
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 group relative">
                          {isImg ? (
                            <img src={previewUrl} alt={file.name} className="w-8 h-8 rounded object-cover" onLoad={() => URL.revokeObjectURL(previewUrl)} />
                          ) : (
                            <FileText size={14} className="text-indigo-400" />
                          )}
                          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 max-w-[140px] truncate">{file.name}</span>
                          <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove attachment"><X size={12} /></button>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {replyingTo && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className={`${pendingFiles.length > 0 ? 'bg-orange-50/80' : 'bg-orange-50'} dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 rounded-t-xl px-4 py-2 flex items-center justify-between mb-[-1px] relative z-0`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest shrink-0">Replying to {replyingTo.user.firstName}</span>
                      <p className="text-[11px] text-orange-500/70 truncate italic">"{(replyingTo.changes?.text as string) || ''}"</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-orange-400 hover:text-orange-600 transition-colors" title="Cancel reply"><X size={14} /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={`bg-white dark:bg-[#1E2530] border border-gray-200 dark:border-gray-800 ${(replyingTo || pendingFiles.length > 0) ? 'rounded-b-2xl' : 'rounded-2xl'} shadow-2xl transition-all duration-300 group ring-1 ring-black/5`}>
                <AnimatePresence>
                  {showEmoji && (
                    <motion.div ref={emojiRef} initial={{ scale: 0.9, opacity: 0, y: -10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="absolute bottom-full left-4 mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl p-2 flex gap-2 z-50">
                      {emojis.map(e => <button key={e} onClick={() => insertEmoji(e)} className="text-xl hover:scale-125 transition-transform p-1" title={`Add ${e}`}>{e}</button>)}
                    </motion.div>
                  )}
                  {showMentions && filteredMembers.length > 0 && (
                    <motion.div ref={mentionRef} initial={{ scale: 0.9, opacity: 0, y: -10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="absolute bottom-full left-4 mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px] z-50">
                      <div className="p-2 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">People</span></div>
                      {filteredMembers.map((m, idx) => (
                        <button key={m.id} onClick={() => insertMention(m)} className={`w-full flex items-center gap-3 p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left ${idx === mentionIndex ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`} title={`Mention ${m.firstName}`}><div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">{m.firstName[0]}{m.lastName?.[0]}</div><div><p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">{m.firstName} {m.lastName}</p><p className="text-[10px] text-gray-400">{m.email}</p></div></button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="p-3">
                  <textarea ref={commentInputRef} value={commentText} onChange={handleTextChange} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }} placeholder="Reply or type '/' for commands..." className="w-full bg-transparent border-none focus:ring-0 text-[14px] text-gray-700 dark:text-gray-200 placeholder-gray-400 resize-none min-h-[70px] font-sans overflow-y-auto" rows={3} style={{ maxHeight: '300px' }} title="Comment input" />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800/50">
                    <div className="flex items-center gap-1">
                      <button onClick={handleAIAction} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="AI Suggestion"><Zap size={18} className="fill-current text-amber-500 opacity-50" /></button>
                      <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Emoji"><Smile size={18} /></button>
                      <button onClick={() => { setCommentText(prev => prev + '@'); setShowMentions(true); }} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Mention"><AtSign size={18} /></button>
                      <button onClick={() => imageInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Attach image"><ImageIcon size={18} /></button>
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Attach file"><Paperclip size={18} /></button>
                    </div>
                    <button onClick={handlePostComment} disabled={(!commentText.trim() && pendingFiles.length === 0) || isPosting} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${(commentText.trim() || pendingFiles.length > 0) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'}`} title="Post comment">
                      {isPosting ? 'Sending...' : 'Post'} <Send size={14} strokeWidth={3} className={(commentText.trim() || pendingFiles.length > 0) ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showDetails && (
            <>
              {/* Mobile-only backdrop: on lg+ the panel sits in-flow beside the content, but on mobile it becomes a slide-over drawer that needs a way to dismiss by tapping outside it */}
              <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setShowDetails(false)} />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 z-40 w-80 max-w-[85vw] lg:static lg:max-w-none border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1E2530] shrink-0 overflow-y-auto shadow-2xl"
              >
              <div className="p-6 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Task Details</h3>
                  <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Close details">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Title</label>
                    <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100 leading-snug">{task?.title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</label>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${task?.status === 'COMPLETED' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">{task?.status}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Priority</label>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${task?.priority === 'URGENT' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{task?.priority}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Assignees</label>
                    <div className="flex flex-wrap gap-2">
                      {task?.assignees.map(a => (
                        <div key={a.id} className="flex items-center gap-2 p-1.5 pr-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold">{a.firstName[0]}{a.lastName?.[0]}</div>
                          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{a.firstName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {task?.description && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                      <div
                        className="prose prose-sm max-w-none text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50/50 dark:bg-gray-800/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-auto"
                        dangerouslySetInnerHTML={{ __html: linkifyHtmlText(task.description) }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/98 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => { setPreviewImage(null); setZoom(1); setRotation(0); }} />
          <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
            <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 4))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10" title="Zoom in"><Plus size={20} /></button>
            <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10" title="Zoom out"><X size={20} className="rotate-45" /></button>
            <button onClick={() => setPreviewImage(null)} className="w-12 h-12 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center shadow-xl transition-all" title="Close preview"><X size={24} /></button>
          </div>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} className="relative max-w-full max-h-full transition-transform duration-300 ease-out z-10"><img src={previewImage.url} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl shadow-indigo-500/10" /></motion.div>
        </div>
      )}
      {/* Task Detail Modal */}
      {showTaskModal && task?.id && (
        <TaskDetailPage
          isModal
          taskId={task.id}
          onClose={() => { setShowTaskModal(false); loadTask(task.id, true); }}
        />
      )}

      <ConfirmDialog
        open={confirmArchiveOpen}
        title="Are you sure?"
        description={task?.title ? `Do you want to archive "${task.title}"?` : 'Do you want to archive this task?'}
        confirmText="Archive"
        cancelText="Cancel"
        tone="default"
        isBusy={isArchiving}
        busyLabel="Archiving..."
        onClose={() => { if (!isArchiving) setConfirmArchiveOpen(false); }}
        onConfirm={handleArchive}
      />
    </motion.div>
  );
}
