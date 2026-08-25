import { User, UserMinus, Share2, MessageSquare, Plus, Trash2, CheckCircle2, Clock, Play, Square, MoreHorizontal, Trash } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { useState } from 'react';
import type { Activity } from './ActivityTimeline';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { linkifyEscapedPlainText } from '../../utils/text';

interface Props {
  activity: Activity;
  onImagePreview?: (url: string, name: string) => void;
  onRefresh?: () => void;
  onReply?: (activity: Activity) => void;
  onLike?: (activity: Activity) => void;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ` at ${timeStr}`;
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; iconColor: string }> = {
  'task.created': { icon: Plus, color: 'text-gray-500', iconColor: 'text-green-500' },
  'task.deleted': { icon: Trash2, color: 'text-gray-400', iconColor: 'text-red-500' },
  'task.status_changed': { icon: CheckCircle2, color: 'text-gray-500', iconColor: 'text-amber-500' },
  'task.assigned': { icon: User, color: 'text-indigo-600', iconColor: 'text-indigo-500' },
  'task.unassigned': { icon: UserMinus, color: 'text-gray-400', iconColor: 'text-gray-400' },
  'task.shared': { icon: Share2, color: 'text-indigo-600', iconColor: 'text-indigo-400' },
  'comment.created': { icon: MessageSquare, color: 'text-gray-600', iconColor: 'text-blue-400' },
  'time_entry.created': { icon: Play, color: 'text-gray-500', iconColor: 'text-pink-500' },
  'time_entry.stopped': { icon: Square, color: 'text-gray-500', iconColor: 'text-orange-500' },
};

export function ActivityItem({ activity, onImagePreview, onRefresh, onReply, onLike }: Props) {
  const { currentUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const name = `${activity.user.firstName} ${activity.user.lastName}`;
  const changes = activity.changes as Record<string, any>;
  
  const isReply = !!changes.replyToId || activity.action === 'comment.created' && changes.text?.includes('@');

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.(activity);
  };

  const performDelete = async () => {
    if (!changes.commentId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/comments/${changes.commentId}`);
      setConfirmDeleteOpen(false);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  let actionText = '';
  let actionKey = activity.action;

  switch (activity.action) {
    case 'task.created': actionText = 'created this task'; break;
    case 'task.deleted': actionText = 'deleted this task'; break;
    case 'task.status_changed': actionText = changes.status ? `changed status to ${changes.status.to}` : 'changed the status'; break;
    case 'task.assigned': {
      const assignee = changes.assignee;
      if (assignee) {
        if (!assignee.from && assignee.to) {
          actionText = `assigned this task to ${assignee.to === 'you' || assignee.to === name ? 'you' : assignee.to}`;
        } else if (assignee.from && !assignee.to) {
          actionKey = 'task.unassigned';
          actionText = `unassigned ${assignee.from} from this task`;
        } else {
          actionText = `reassigned from ${assignee.from} to ${assignee.to}`;
        }
      } else {
        actionText = 'assigned this task to you';
      }
      break;
    }
    case 'task.shared': actionText = 'shared this task with you'; break;
    case 'comment.created': actionText = 'added a comment'; break;
    default: actionText = 'updated this task';
  }

  const config = ACTION_CONFIG[actionKey] || { icon: Clock, color: 'text-gray-500', iconColor: 'text-gray-400' };
  const Icon = config.icon;

  if (activity.action === 'comment.created') {
    return (
      <div className="group bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all overflow-hidden mb-4 relative">
         {isReply && (
          <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] text-white font-bold shrink-0">
              {activity.user.firstName[0]}
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
              Thread by <span className="text-gray-600 dark:text-gray-300">{name}</span>
            </span>
          </div>
        )}

        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isReply ? 'bg-orange-500/80' : 'bg-indigo-500/80'}`} />
        
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <Avatar firstName={activity.user.firstName} lastName={activity.user.lastName} avatarUrl={activity.user.avatarUrl} size="sm" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{name}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatTime(activity.createdAt)}</span>
                </div>
                {currentUser?.id === activity.userId && (
                  <button 
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={isDeleting}
                    className="p-1 px-2 text-[10px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                )}
              </div>
              
              {changes?.text && (
                <p
                  className="text-[14px] text-gray-700 dark:text-gray-300 leading-relaxed font-sans whitespace-pre-wrap break-words min-w-0 mt-2"
                  dangerouslySetInnerHTML={{ __html: linkifyEscapedPlainText(changes.text) }}
                />
              )}
              
              {changes?.fileUrl && (
                <div className="mt-3">
                  {changes.fileType?.startsWith('image/') ? (
                    <div
                      className="relative group/img w-32 h-32 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer"
                      onClick={() => onImagePreview?.(changes.fileUrl, changes.fileName || 'Attachment')}
                    >
                      <img src={changes.fileUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                       <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-500 shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-gray-700 dark:text-gray-200 truncate">{changes.fileName || 'Attachment'}</p>
                      </div>
                      <a href={changes.fileUrl} download={changes.fileName} className="p-2 text-gray-400 hover:text-indigo-500" title="Download file"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg></a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLike}
                className={`flex items-center justify-center transition-all active:scale-90 ${isLiked ? 'text-indigo-600 scale-110' : 'text-gray-400 hover:text-indigo-500'}`}
                title="Like"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg>
              </button>
              <button className="flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-all active:scale-90" title="Mention">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </button>
            </div>
            <button 
              onClick={() => onReply?.(activity)}
              className="text-[12px] font-black text-[#5F6D81] dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-widest transition-colors"
            >
              Reply
            </button>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDeleteOpen}
          title="Are you sure?"
          description="Do you want to delete this comment?"
          confirmText="Delete"
          cancelText="Cancel"
          tone="danger"
          isBusy={isDeleting}
          onClose={() => { if (!isDeleting) setConfirmDeleteOpen(false); }}
          onConfirm={performDelete}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between py-2 px-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 rounded-lg transition-all text-gray-500 dark:text-gray-400">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={13} className={`${config.iconColor} opacity-70 shrink-0`} />
        <div className="flex items-center gap-1.5 text-[12px] truncate font-sans">
          <span className="font-medium text-gray-400 dark:text-gray-500">{name}</span>
          <span className="font-normal">{actionText}</span>
        </div>
      </div>
      <span className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity ml-4">{formatTime(activity.createdAt)}</span>
    </div>
  );
}
